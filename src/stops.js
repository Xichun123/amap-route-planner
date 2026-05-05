import { state } from "./state.js";
import {
  saveStops,
  saveOriginStop,
  loadStops,
  loadOriginStop,
  saveRouteMode,
} from "./storage.js";
import { setStatus } from "./ui/status.js";
import { dom } from "./dom.js";
import {
  createStopMarker,
  removeStopMarker,
  clearStopMarkers,
  syncStartMarker,
} from "./map/markers.js";
import { renderStops, refreshMarkers } from "./ui/stops-view.js";

function focusStop(stopId) {
  const stop = state.stops.find((item) => item.id === stopId);
  if (!stop || !state.map) return;
  state.map.setZoomAndCenter(Math.max(state.map.getZoom(), 15), stop.position);
  setStatus(stop.name);
}

function makeStop(poi) {
  return {
    id: `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceId: poi.id || "",
    name: poi.name || "未命名地点",
    address: poi.address || "",
    city: poi.city || "",
    position: poi.position,
    priority: false,
  };
}

export function addStop(poi) {
  if (poi.id) {
    const existing = state.stops.find((s) => s.sourceId && s.sourceId === poi.id);
    if (existing) {
      setStatus("这个地点已经在列表里");
      focusStop(existing.id);
      return;
    }
  }
  const stop = makeStop(poi);
  state.stops.push(stop);
  state.routeOrder = [];
  createStopMarker(stop, focusStop);
  saveStops();
  renderStops();
  refreshMarkers();
  const fittable = [...state.stopMarkers.values(), state.startMarker].filter(Boolean);
  if (fittable.length) state.map.setFitView(fittable, false, [70, 70, 260, 70]);
  setStatus(`已添加 ${stop.name}`);
}

export function removeStop(stopId, clearRouteFn) {
  removeStopMarker(stopId);
  if (state.originStopId === stopId) {
    state.originStopId = "";
    saveOriginStop();
    syncStartMarker();
  }
  state.stops = state.stops.filter((s) => s.id !== stopId);
  state.routeOrder = [];
  saveStops();
  renderStops();
  refreshMarkers();
  clearRouteFn?.();
  setStatus("已移除地点");
}

export function swapStops(from, to) {
  const next = [...state.stops];
  [next[from], next[to]] = [next[to], next[from]];
  state.stops = next;
  state.routeOrder = [];
  saveStops();
  renderStops();
  refreshMarkers();
}

export function togglePriority(stopId) {
  if (state.originStopId === stopId) {
    setStatus("出发地点不参与优先到达排序");
    return;
  }
  const stop = state.stops.find((s) => s.id === stopId);
  if (!stop) return;
  stop.priority = !stop.priority;
  saveStops();
  renderStops();
  refreshMarkers();
}

export function toggleOriginStop(stopId, clearRouteFn) {
  state.originStopId = state.originStopId === stopId ? "" : stopId;
  state.routeOrder = [];
  state.lastRouteStart = null;
  state.lastRouteStartLabel = "";
  saveOriginStop();
  clearRouteFn?.();
  syncStartMarker();
  renderStops();
  refreshMarkers();
  const origin = state.stops.find((s) => s.id === state.originStopId);
  setStatus(origin ? `已设为出发点：${origin.name}` : "已改回当前位置出发");
}

export function clearStops(clearRouteFn) {
  clearStopMarkers();
  clearRouteFn?.();
  state.stops = [];
  state.originStopId = "";
  state.routeOrder = [];
  state.lastRouteStart = null;
  state.lastRouteStartLabel = "";
  saveStops();
  saveOriginStop();
  syncStartMarker();
  renderStops();
  setStatus("已清空地点");
}

export function restoreStops() {
  state.stops = loadStops();
  state.originStopId = loadOriginStop();
  if (state.originStopId && !state.stops.some((s) => s.id === state.originStopId)) {
    state.originStopId = "";
    saveOriginStop();
  }
  state.stops.forEach((stop) => createStopMarker(stop, focusStop));
  renderStops();
  refreshMarkers();
  syncStartMarker();
}

export function applyPlan(plan, clearRouteFn) {
  if (!plan || !Array.isArray(plan.stops)) return;

  clearStopMarkers();
  clearRouteFn?.();

  state.stops = plan.stops.map((s) => ({
    id: s.id || `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceId: s.sourceId || "",
    name: s.name || "未命名地点",
    address: s.address || "",
    city: s.city || "",
    position: [Number(s.position[0]), Number(s.position[1])],
    priority: Boolean(s.priority),
  }));
  state.originStopId = plan.originStopId && state.stops.some((s) => s.id === plan.originStopId)
    ? plan.originStopId
    : "";
  state.routeOrder = [];
  state.lastRouteStart = null;
  state.lastRouteStartLabel = "";

  saveStops();
  saveOriginStop();

  const mode = plan.routeMode || "auto";
  dom.routeModeSelect.value = mode;
  saveRouteMode(mode);
  dom.manualOrderToggle.checked = Boolean(plan.manualOrder);

  state.stops.forEach((stop) => createStopMarker(stop, focusStop));
  syncStartMarker();
  renderStops();
  refreshMarkers();

  const fittable = [...state.stopMarkers.values(), state.startMarker].filter(Boolean);
  if (fittable.length && state.map) state.map.setFitView(fittable, false, [70, 70, 260, 70]);
  setStatus(`已加载方案：${plan.name || "未命名方案"}`);
}

export { focusStop };
