import { state } from "../state.js";
import { dom } from "../dom.js";
import { ROUTE_MODES } from "../config.js";
import { lngLatToArray } from "../utils/geo.js";
import { setStatus } from "../ui/status.js";
import { getOriginStop } from "../map/markers.js";
import { optimizeOpenPath } from "./optimizer.js";
import { recommendRouteMode } from "./recommender.js";
import {
  ensureTransfer,
  planDriving,
  planWalkingLeg,
  planRidingLeg,
  planTransferLeg,
} from "./services.js";
import { formatDistance, formatTime } from "../utils/format.js";

export function getDestinationStops() {
  return state.stops.filter((stop) => stop.id !== state.originStopId);
}

export function getRouteStartLabel() {
  const originStop = getOriginStop();
  if (originStop) return originStop.name;
  const where = state.currentAddress || "当前位置";
  return `${where}（未指定起点）`;
}

function resolveRouteStart() {
  const originStop = getOriginStop();
  if (originStop) return { position: originStop.position, label: originStop.name };
  return {
    position: state.currentPosition || lngLatToArray(state.map.getCenter()),
    label: state.currentAddress || "地图中心",
  };
}

function resolveStopOrder(start) {
  const destinationStops = getDestinationStops();
  if (dom.manualOrderToggle.checked) return [...destinationStops];

  const priorityStops = destinationStops.filter((stop) => stop.priority);
  const flexibleStops = destinationStops.filter((stop) => !stop.priority);
  const startForFlexible = priorityStops.length
    ? priorityStops[priorityStops.length - 1].position
    : start;
  return [...priorityStops, ...optimizeOpenPath(startForFlexible, flexibleStops)];
}

function clearRouteOverlays() {
  if (state.map && state.routeOverlays.length) state.map.remove(state.routeOverlays);
  state.routeOverlays = [];
}

export function clearAllRoutes() {
  state.driving?.clear();
  state.walking?.clear();
  state.riding?.clear();
  state.transfer?.clear();
  clearRouteOverlays();
}

function drawLeg(routeMode, paths, legIndex) {
  const AMap = state.AMap;
  const color = ROUTE_MODES[routeMode].color;
  paths.forEach((item) => {
    const isPart = item && typeof item === "object" && "path" in item;
    const path = isPart ? item.path : item;
    if (!path || !path.length) return;
    const isWalkingPart = isPart && item.walking;
    const isDashed = routeMode === "walking" || isWalkingPart;
    const overlay = new AMap.Polyline({
      path,
      strokeColor: isWalkingPart ? ROUTE_MODES.walking.color : color,
      strokeWeight: routeMode === "transfer" && !isWalkingPart ? 6 : 5,
      strokeOpacity: 0.9,
      strokeStyle: isDashed ? "dashed" : "solid",
      strokeDasharray: isDashed ? [10, 6] : undefined,
      lineJoin: "round",
      lineCap: "round",
      zIndex: 60 + legIndex,
    });
    state.routeOverlays.push(overlay);
    state.map.add(overlay);
  });
}

function fitRouteView() {
  const overlays = [
    ...state.routeOverlays,
    ...state.stopMarkers.values(),
    state.startMarker,
  ].filter(Boolean);
  if (overlays.length) state.map.setFitView(overlays, false, [70, 70, 260, 70]);
}

function buildRouteSummary(requestedMode, actualMode, distance, time) {
  const orderMode = dom.manualOrderToggle.checked ? "列表顺序" : "自动优化";
  const modeText =
    requestedMode === "auto"
      ? `自动推荐${ROUTE_MODES[actualMode].label}`
      : ROUTE_MODES[actualMode].label;
  return `${orderMode} · ${modeText} · ${formatDistance(distance)} · ${formatTime(time)}`;
}

function getTransferCity() {
  return dom.cityInput.value.trim();
}

export async function planRoute(onUpdated) {
  if (!state.AMap || !state.map) return setStatus("地图还没有加载");
  if (!state.stops.length) return setStatus("先添加地点");

  const routeStart = resolveRouteStart();
  const start = routeStart.position;
  const orderedStops = resolveStopOrder(start);
  if (!orderedStops.length) return setStatus("至少需要一个到达地点");

  const requestedMode = dom.routeModeSelect.value;
  const routeMode = requestedMode === "auto" ? recommendRouteMode(start, orderedStops) : requestedMode;

  if (routeMode === "driving" && orderedStops.length > 17) {
    return setStatus("高德驾车路线最多支持 16 个途经点");
  }
  if (routeMode === "transfer") {
    const city = getTransferCity();
    if (!city) return setStatus("公交规划需要在城市框填写城市");
    ensureTransfer(state.AMap, city);
  }

  state.routeOrder = orderedStops.map((stop) => stop.id);
  state.lastRouteStart = [...start];
  state.lastRouteStartLabel = routeStart.label;
  state.lastRouteMode = routeMode;
  onUpdated?.();
  clearAllRoutes();
  setStatus(`正在规划${ROUTE_MODES[routeMode].label}路线`);

  try {
    if (routeMode === "driving") {
      const waypoints = orderedStops.slice(0, -1).map((stop) => stop.position);
      const destination = orderedStops[orderedStops.length - 1].position;
      const route = await planDriving(start, destination, waypoints);
      // Driving plugin draws on the map itself; just fit and summarize.
      fitRouteView();
      dom.routeSummary.textContent = buildRouteSummary(requestedMode, "driving", route.distance, route.time);
    } else {
      const points = [start, ...orderedStops.map((stop) => stop.position)];
      let total = 0;
      let totalTime = 0;
      for (let i = 0; i < points.length - 1; i += 1) {
        setStatus(`正在规划${ROUTE_MODES[routeMode].label}路线 ${i + 1}/${points.length - 1}`);
        const leg = await planLegByMode(routeMode, points[i], points[i + 1]);
        total += leg.distance || 0;
        totalTime += leg.time || 0;
        drawLeg(routeMode, leg.paths, i);
      }
      fitRouteView();
      dom.routeSummary.textContent = buildRouteSummary(requestedMode, routeMode, total, totalTime);
    }
    dom.openNavigationButton.disabled = false;
    setStatus("路线规划完成");
  } catch (error) {
    console.error(error);
    setStatus(`路线规划失败：${error.message}`);
  }
}

function planLegByMode(routeMode, origin, destination) {
  if (routeMode === "walking") return planWalkingLeg(origin, destination);
  if (routeMode === "riding") return planRidingLeg(origin, destination);
  if (routeMode === "transfer") return planTransferLeg(origin, destination);
  return Promise.reject(new Error("不支持的交通方式"));
}
