"use strict";

const CONFIG_KEY = "amap-route-planner-config";
const STOPS_KEY = "amap-route-planner-stops";
const ORIGIN_STOP_KEY = "amap-route-planner-origin-stop";
const ROUTE_MODE_KEY = "amap-route-planner-mode";
const SHEET_COLLAPSED_KEY = "amap-route-planner-sheet-collapsed";
const PLUGINS = [
  "AMap.Scale",
  "AMap.ToolBar",
  "AMap.Geolocation",
];
const ROUTE_MODES = {
  auto: { label: "自动" },
  driving: { label: "驾车", navMode: "car", color: "#1769e0" },
  walking: { label: "步行", navMode: "walk", color: "#12805c" },
  riding: { label: "骑行", navMode: "ride", color: "#d97706" },
  transfer: { label: "公交", navMode: "bus", color: "#7c3aed" },
};

const state = {
  AMap: null,
  map: null,
  geolocation: null,
  driving: null,
  walking: null,
  riding: null,
  transfer: null,
  currentPosition: null,
  currentAddress: "",
  startMarker: null,
  stops: [],
  stopMarkers: new Map(),
  routeOverlays: [],
  originStopId: "",
  routeOrder: [],
  lastRouteStart: null,
  lastRouteStartLabel: "",
  lastRouteMode: "driving",
  webserviceHost: "",
};

const dom = {
  appShell: document.querySelector(".app-shell"),
  map: document.getElementById("map"),
  statusText: document.getElementById("status-text"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  cityInput: document.getElementById("city-input"),
  searchResults: document.getElementById("search-results"),
  stopList: document.getElementById("stop-list"),
  routeSummary: document.getElementById("route-summary"),
  sheetGripButton: document.getElementById("sheet-grip-button"),
  sheetCollapseButton: document.getElementById("sheet-collapse-button"),
  manualOrderToggle: document.getElementById("manual-order-toggle"),
  routeModeSelect: document.getElementById("route-mode-select"),
  planRouteButton: document.getElementById("plan-route-button"),
  locateButton: document.getElementById("locate-button"),
  clearStopsButton: document.getElementById("clear-stops-button"),
  openNavigationButton: document.getElementById("open-navigation-button"),
  reloadButton: document.getElementById("reload-button"),
};

document.addEventListener("DOMContentLoaded", boot);

function boot() {
  bindEvents();
  localStorage.removeItem(CONFIG_KEY);
  applySheetCollapsed(localStorage.getItem(SHEET_COLLAPSED_KEY) === "1");
  dom.routeModeSelect.value = localStorage.getItem(ROUTE_MODE_KEY) || "auto";
  const config = readConfig();
  if (!config.jsapiKey || !config.webserviceHost || (!config.securityCode && !config.serviceHost)) {
    setStatus("服务器未配置高德 Key");
    renderStops();
    return;
  }
  initMap(config);
}

function bindEvents() {
  dom.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchPlaces();
  });

  dom.reloadButton.addEventListener("click", () => window.location.reload());

  dom.locateButton.addEventListener("click", locateUser);
  dom.sheetGripButton.addEventListener("click", toggleSheet);
  dom.sheetCollapseButton.addEventListener("click", toggleSheet);
  dom.planRouteButton.addEventListener("click", planRoute);
  dom.clearStopsButton.addEventListener("click", clearStops);
  dom.openNavigationButton.addEventListener("click", openFirstLegNavigation);

  dom.stopList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const stopId = button.closest(".stop-row")?.dataset.stopId;
    const action = button.dataset.action;
    const index = state.stops.findIndex((stop) => stop.id === stopId);
    if (index < 0) return;

    if (action === "up" && index > 0) {
      swapStops(index, index - 1);
    } else if (action === "down" && index < state.stops.length - 1) {
      swapStops(index, index + 1);
    } else if (action === "origin") {
      toggleOriginStop(stopId);
    } else if (action === "priority") {
      if (state.originStopId === stopId) {
        setStatus("出发地点不参与优先到达排序");
        return;
      }
      state.stops[index].priority = !state.stops[index].priority;
      saveStops();
      renderStops();
      refreshMarkers();
    } else if (action === "remove") {
      removeStop(stopId);
    }
  });

  dom.manualOrderToggle.addEventListener("change", () => {
    state.routeOrder = [];
    renderStops();
    refreshMarkers();
  });

  dom.routeModeSelect.addEventListener("change", () => {
    localStorage.setItem(ROUTE_MODE_KEY, dom.routeModeSelect.value);
    state.routeOrder = [];
    renderStops();
    refreshMarkers();
  });

  window.addEventListener("beforeunload", () => {
    if (state.map) state.map.destroy();
  });
}

function toggleSheet() {
  const collapsed = !dom.appShell.classList.contains("sheet-collapsed");
  applySheetCollapsed(collapsed);
  localStorage.setItem(SHEET_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function applySheetCollapsed(collapsed) {
  dom.appShell.classList.toggle("sheet-collapsed", collapsed);
  const label = collapsed ? "展开路线面板" : "收起路线面板";
  dom.sheetGripButton.setAttribute("aria-label", `${label}手柄`);
  dom.sheetGripButton.setAttribute("aria-expanded", String(!collapsed));
  dom.sheetCollapseButton.setAttribute("aria-label", label);
  dom.sheetCollapseButton.setAttribute("aria-expanded", String(!collapsed));
}

function readConfig() {
  const config = window.__AMAP_ROUTE_CONFIG__ || {};
  return {
    jsapiKey: String(config.jsapiKey || "").trim(),
    securityCode: String(config.securityCode || "").trim(),
    serviceHost: normalizeServiceHost(String(config.serviceHost || "").trim()),
    webserviceHost: normalizeServiceHost(String(config.webserviceHost || "").trim()),
  };
}

function normalizeServiceHost(value) {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function initMap(config) {
  try {
    setStatus("正在加载高德地图");
    if (state.map) {
      state.map.destroy();
      state.map = null;
      state.stopMarkers.clear();
      state.startMarker = null;
    }

    window._AMapSecurityConfig = config.serviceHost
      ? { serviceHost: config.serviceHost }
      : { securityJsCode: config.securityCode };

    if (!window.AMapLoader) {
      throw new Error("AMapLoader 未加载，请检查网络");
    }

    const AMap = await window.AMapLoader.load({
      key: config.jsapiKey,
      version: "2.0",
      plugins: PLUGINS,
    });

    AMap.getConfig().appname = "amap-jsapi-skill";
    state.AMap = AMap;
    state.webserviceHost = config.webserviceHost;
    state.map = new AMap.Map("map", {
      viewMode: "3D",
      zoom: 13,
      center: [116.397428, 39.90923],
      pitch: 0,
      mapStyle: "amap://styles/normal",
    });

    state.map.addControl(new AMap.Scale());
    state.map.addControl(new AMap.ToolBar({ position: { right: "14px", top: "118px" } }));

    state.geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
      showButton: false,
      showMarker: false,
      showCircle: true,
      panToLocation: true,
      zoomToAccuracy: true,
      convert: true,
      needAddress: true,
      getCityWhenFail: true,
    });
    state.map.addControl(state.geolocation);

    restoreStops();
    locateUser();
    setStatus("地图已加载");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "地图加载失败，请检查 Key");
  }
}

function locateUser() {
  if (!state.geolocation) {
    setStatus("地图还没有加载");
    return;
  }

  setStatus("正在定位");
  state.geolocation.getCurrentPosition((status, result) => {
    if (status === "complete" && result.position) {
      const position = lngLatToArray(result.position);
      state.currentPosition = position;
      state.currentAddress = result.formattedAddress || "当前位置";
      syncStartMarker();
      setStatus(`定位成功，精度约 ${Math.round(result.accuracy || 0)} 米`);
      renderStops();
      return;
    }

    const center = lngLatToArray(state.map.getCenter());
    state.currentPosition = center;
    state.currentAddress = "地图中心";
    syncStartMarker();
    setStatus("定位失败，已用地图中心作起点");
    renderStops();
  });
}

function syncStartMarker() {
  if (getOriginStop()) {
    removeCurrentStartMarker();
    return;
  }
  if (state.currentPosition) drawCurrentStartMarker(state.currentPosition);
}

function drawCurrentStartMarker(position) {
  const AMap = state.AMap;
  if (!AMap || !state.map) return;
  if (!state.startMarker) {
    state.startMarker = new AMap.Marker({
      content: '<div class="start-marker">起</div>',
      offset: new AMap.Pixel(-15, -15),
      title: "起点",
    });
    state.map.add(state.startMarker);
  }
  state.startMarker.setPosition(position);
}

function removeCurrentStartMarker() {
  if (!state.startMarker || !state.map) return;
  state.map.remove(state.startMarker);
  state.startMarker = null;
}

async function searchPlaces() {
  if (!state.AMap) {
    setStatus("地图还没有加载");
    return;
  }
  if (!state.webserviceHost) {
    setStatus("服务器未配置高德 WebService");
    return;
  }

  const keyword = dom.searchInput.value.trim();
  const city = dom.cityInput.value.trim();
  if (!keyword) {
    setStatus("请输入地点关键词");
    return;
  }

  try {
    setStatus("正在搜索地点");
    const result = await requestAmapWebService("/v3/place/text", {
      keywords: keyword,
      city,
      citylimit: city ? "true" : "false",
      offset: "10",
      page: "1",
      extensions: "all",
      output: "JSON",
    });
    assertAmapOk(result);
    const pois = (result.pois || [])
      .filter((poi) => poi.location)
      .map((poi) => ({
        id: poi.id,
        name: normalizePoiText(poi.name) || "未命名地点",
        address: normalizePoiText(poi.address || poi.district || ""),
        city: normalizePoiText(poi.cityname || city || ""),
        position: parsePoiLocation(poi.location),
      }))
      .filter((poi) => poi.position);

    if (!pois.length) {
      renderSearchResults([]);
      setStatus("没有找到匹配地点");
      return;
    }
    renderSearchResults(pois);
    setStatus(`找到 ${pois.length} 个地点`);
  } catch (error) {
    console.error(error);
    renderSearchResults([]);
    setStatus(`搜索失败：${error.message}`);
  }
}

function formatAmapServiceError(result, fallback) {
  const message = getAmapErrorMessage(result, fallback);
  return message === fallback ? fallback : `${fallback}: ${message}`;
}

function getAmapErrorMessage(result, fallback = "高德服务错误") {
  const info = result?.info || result?.errmsg || result?.message || result?.errdetail || result?.error || "";
  const infocode = result?.infocode || result?.errcode || result?.code || "";
  if (String(result?.status || "") === "1" && (!info || /^ok$/i.test(info))) return fallback;
  if (Number(result?.errcode) === 0 && (!info || /^ok$/i.test(info))) return fallback;
  if (info && infocode) return `${info} (${infocode})`;
  if (info) return info;
  return fallback;
}

function assertAmapOk(result) {
  if (String(result?.status || "") !== "1" && Number(result?.errcode) !== 0) {
    throw new Error(getAmapErrorMessage(result));
  }
}

async function requestAmapWebService(path, params) {
  if (!state.webserviceHost) throw new Error("服务器未配置高德 WebService");
  const url = new URL(`${state.webserviceHost}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function normalizePoiText(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value || "");
}

function parsePoiLocation(value) {
  if (typeof value === "string") return parsePoint(value);
  return lngLatToArray(value);
}

function renderSearchResults(pois) {
  dom.searchResults.innerHTML = "";
  dom.searchResults.hidden = pois.length === 0;

  pois.forEach((poi) => {
    const button = document.createElement("button");
    button.className = "result-item";
    button.type = "button";
    button.innerHTML = `
      <span>
        <span class="result-title">${escapeHtml(poi.name)}</span>
        <span class="result-meta">${escapeHtml([poi.city, poi.address].filter(Boolean).join(" · "))}</span>
      </span>
      <span class="text-button">添加</span>
    `;
    button.addEventListener("click", () => {
      addStop(poi);
      dom.searchResults.hidden = true;
      dom.searchInput.value = "";
    });
    dom.searchResults.appendChild(button);
  });
}

function addStop(poi) {
  const existing = state.stops.find((stop) => stop.sourceId && stop.sourceId === poi.id);
  if (existing) {
    setStatus("这个地点已经在列表里");
    focusStop(existing.id);
    return;
  }

  const stop = {
    id: `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceId: poi.id || "",
    name: poi.name || "未命名地点",
    address: poi.address || "",
    city: poi.city || "",
    position: poi.position,
    priority: false,
  };

  state.stops.push(stop);
  state.routeOrder = [];
  createStopMarker(stop);
  saveStops();
  renderStops();
  refreshMarkers();
  state.map.setFitView([...state.stopMarkers.values(), state.startMarker].filter(Boolean), false, [70, 70, 260, 70]);
  setStatus(`已添加 ${stop.name}`);
}

function createStopMarker(stop) {
  const AMap = state.AMap;
  if (!AMap || !state.map || state.stopMarkers.has(stop.id)) return;
  const marker = new AMap.Marker({
    position: stop.position,
    content: '<div class="stop-marker">1</div>',
    offset: new AMap.Pixel(-15, -15),
    title: stop.name,
  });
  marker.on("click", () => focusStop(stop.id));
  state.map.add(marker);
  state.stopMarkers.set(stop.id, marker);
}

function focusStop(stopId) {
  const stop = state.stops.find((item) => item.id === stopId);
  if (!stop || !state.map) return;
  state.map.setZoomAndCenter(Math.max(state.map.getZoom(), 15), stop.position);
  setStatus(stop.name);
}

function removeStop(stopId) {
  const marker = state.stopMarkers.get(stopId);
  if (marker && state.map) state.map.remove(marker);
  state.stopMarkers.delete(stopId);
  if (state.originStopId === stopId) {
    state.originStopId = "";
    saveOriginStop();
    syncStartMarker();
  }
  state.stops = state.stops.filter((stop) => stop.id !== stopId);
  state.routeOrder = [];
  saveStops();
  renderStops();
  refreshMarkers();
  if (state.driving) state.driving.clear();
  clearRouteOverlays();
  setStatus("已移除地点");
}

function swapStops(from, to) {
  const nextStops = [...state.stops];
  [nextStops[from], nextStops[to]] = [nextStops[to], nextStops[from]];
  state.stops = nextStops;
  state.routeOrder = [];
  saveStops();
  renderStops();
  refreshMarkers();
}

function clearStops() {
  if (state.map) {
    state.map.remove([...state.stopMarkers.values()]);
  }
  if (state.driving) state.driving.clear();
  clearRouteOverlays();
  state.stopMarkers.clear();
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

function saveStops() {
  const serializable = state.stops.map(({ id, sourceId, name, address, city, position, priority }) => ({
    id,
    sourceId,
    name,
    address,
    city,
    position,
    priority,
  }));
  localStorage.setItem(STOPS_KEY, JSON.stringify(serializable));
}

function restoreStops() {
  try {
    state.stops = JSON.parse(localStorage.getItem(STOPS_KEY) || "[]").filter((stop) => {
      return Array.isArray(stop.position) && stop.position.length === 2;
    });
  } catch {
    state.stops = [];
  }
  state.originStopId = localStorage.getItem(ORIGIN_STOP_KEY) || "";
  if (state.originStopId && !state.stops.some((stop) => stop.id === state.originStopId)) {
    state.originStopId = "";
    saveOriginStop();
  }

  state.stops.forEach(createStopMarker);
  renderStops();
  refreshMarkers();
  syncStartMarker();
}

function renderStops() {
  dom.stopList.innerHTML = "";
  const destinationStops = getDestinationStops();
  dom.clearStopsButton.disabled = state.stops.length === 0;
  dom.planRouteButton.disabled = destinationStops.length === 0;
  dom.openNavigationButton.disabled = state.routeOrder.length === 0;

  if (!state.stops.length) {
    dom.stopList.innerHTML = '<div class="empty-state">从上方搜索并添加地点</div>';
    dom.routeSummary.textContent = state.currentPosition
      ? `起点：${state.currentAddress || "当前位置"}`
      : "还没有添加地点";
    return;
  }

  const summaryParts = [`${destinationStops.length} 个待到访地点`];
  summaryParts.push(`起点：${getRouteStartLabel()}`);
  if (state.routeOrder.length) summaryParts.push("已生成顺序");
  dom.routeSummary.textContent = summaryParts.join(" · ");

  const activeOrder = getDisplayOrderMap();
  const listOrder = getListOrderMap();
  state.stops.forEach((stop, index) => {
    const row = document.createElement("div");
    const isOrigin = state.originStopId === stop.id;
    const orderNumber = isOrigin ? "起" : activeOrder.get(stop.id) || listOrder.get(stop.id) || index + 1;
    const indexClass = isOrigin ? "start" : stop.priority ? "priority" : "";
    row.className = "stop-row";
    row.dataset.stopId = stop.id;
    row.innerHTML = `
      <span class="stop-index ${indexClass}">${orderNumber}</span>
      <span>
        <span class="stop-title">${escapeHtml(stop.name)}</span>
        <span class="stop-meta">${escapeHtml(stop.address || stop.city || pointToText(stop.position))}</span>
      </span>
      <span class="stop-controls">
        <button class="mini-button ${isOrigin ? "origin-on" : ""}" type="button" data-action="origin" aria-label="设为出发点">起</button>
        <button class="mini-button" type="button" data-action="up" aria-label="上移">↑</button>
        <button class="mini-button" type="button" data-action="down" aria-label="下移">↓</button>
        <button class="mini-button ${stop.priority ? "priority-on" : ""}" type="button" data-action="priority" aria-label="优先" ${isOrigin ? "disabled" : ""}>先</button>
        <button class="mini-button" type="button" data-action="remove" aria-label="删除">×</button>
      </span>
    `;
    dom.stopList.appendChild(row);
  });
}

function refreshMarkers() {
  const activeOrder = getDisplayOrderMap();
  const listOrder = getListOrderMap();
  state.stops.forEach((stop, index) => {
    const marker = state.stopMarkers.get(stop.id);
    if (!marker) return;
    const isOrigin = state.originStopId === stop.id;
    const orderNumber = isOrigin ? "起" : activeOrder.get(stop.id) || listOrder.get(stop.id) || index + 1;
    const markerClass = isOrigin ? "start" : stop.priority ? "priority" : "";
    marker.setContent(`<div class="stop-marker ${markerClass}">${orderNumber}</div>`);
    marker.setPosition(stop.position);
    marker.setTitle(stop.name);
  });
}

function getDisplayOrderMap() {
  const map = new Map();
  state.routeOrder.forEach((stopId, index) => map.set(stopId, index + 1));
  return map;
}

function getListOrderMap() {
  const map = new Map();
  getDestinationStops().forEach((stop, index) => map.set(stop.id, index + 1));
  return map;
}

function planRoute() {
  if (!state.AMap || !state.map) {
    setStatus("地图还没有加载");
    return;
  }
  if (!state.webserviceHost) {
    setStatus("服务器未配置高德 WebService");
    return;
  }
  if (!state.stops.length) {
    setStatus("先添加地点");
    return;
  }

  const routeStart = resolveRouteStart();
  const start = routeStart.position;
  if (!getOriginStop() && !state.currentPosition) {
    state.currentPosition = start;
    state.currentAddress = "地图中心";
    syncStartMarker();
  }

  const orderedStops = resolveStopOrder(start);
  if (!orderedStops.length) {
    setStatus("至少需要一个到达地点");
    return;
  }
  const requestedMode = dom.routeModeSelect.value;
  const routeMode = requestedMode === "auto" ? recommendRouteMode(start, orderedStops) : requestedMode;
  if (routeMode === "driving" && orderedStops.length > 17) {
    setStatus("高德驾车路线最多支持 16 个途经点");
    return;
  }
  if (routeMode === "transfer" && !getTransferCity()) {
    setStatus("公交规划需要在城市框填写城市");
    return;
  }

  state.routeOrder = orderedStops.map((stop) => stop.id);
  state.lastRouteStart = [...start];
  state.lastRouteStartLabel = routeStart.label;
  state.lastRouteMode = routeMode;
  renderStops();
  refreshMarkers();
  clearAllRoutes();
  setStatus(`正在规划${ROUTE_MODES[routeMode].label}路线`);

  if (routeMode === "driving") {
    planDrivingRoute(start, orderedStops, requestedMode);
    return;
  }

  planSegmentedRoute(start, orderedStops, routeMode, requestedMode);
}

async function planDrivingRoute(start, orderedStops, requestedMode) {
  try {
    const route = await searchDrivingRoute(start, orderedStops);
    drawLeg("driving", route.paths, 0);
    fitRouteView();
    dom.routeSummary.textContent = buildRouteSummary(
      requestedMode,
      "driving",
      route.distance,
      route.time,
    );
    dom.openNavigationButton.disabled = false;
    setStatus("路线规划完成");
  } catch (error) {
    console.error(error);
    setStatus(`路线规划失败：${error.message}`);
  }
}

async function planSegmentedRoute(start, orderedStops, routeMode, requestedMode) {
  try {
    const points = [start, ...orderedStops.map((stop) => stop.position)];
    let totalDistance = 0;
    let totalTime = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
      setStatus(`正在规划${ROUTE_MODES[routeMode].label}路线 ${index + 1}/${points.length - 1}`);
      const leg = await searchLeg(routeMode, points[index], points[index + 1]);
      totalDistance += leg.distance || 0;
      totalTime += leg.time || 0;
      drawLeg(routeMode, leg.paths, index);
    }

    fitRouteView();
    dom.routeSummary.textContent = buildRouteSummary(requestedMode, routeMode, totalDistance, totalTime);
    dom.openNavigationButton.disabled = false;
    setStatus("路线规划完成");
  } catch (error) {
    console.error(error);
    setStatus(`路线规划失败：${error.message}`);
  }
}

function searchLeg(routeMode, origin, destination) {
  if (routeMode === "walking" || routeMode === "riding") {
    return searchSimpleLeg(routeMode, origin, destination);
  }
  if (routeMode === "transfer") return searchTransferLeg(origin, destination);
  return Promise.reject(new Error("不支持的交通方式"));
}

async function searchDrivingRoute(origin, orderedStops) {
  const destination = orderedStops[orderedStops.length - 1].position;
  const waypoints = orderedStops.slice(0, -1).map((stop) => pointParam(stop.position)).join(";");
  const result = await requestAmapWebService("/v3/direction/driving", {
    origin: pointParam(origin),
    destination: pointParam(destination),
    waypoints,
    strategy: "0",
    extensions: "all",
    output: "JSON",
  });
  assertAmapOk(result);
  return parsePathRouteResult(result, "driving");
}

async function searchSimpleLeg(routeMode, origin, destination) {
  const endpoint = routeMode === "riding" ? "/v4/direction/bicycling" : "/v3/direction/walking";
  const result = await requestAmapWebService(endpoint, {
    origin: pointParam(origin),
    destination: pointParam(destination),
    output: "JSON",
  });
  assertAmapOk(result);
  return parsePathRouteResult(result, routeMode);
}

async function searchTransferLeg(origin, destination) {
  const result = await requestAmapWebService("/v3/direction/transit/integrated", {
    origin: pointParam(origin),
    destination: pointParam(destination),
    city: getTransferCity(),
    strategy: "0",
    extensions: "all",
    output: "JSON",
  });
  assertAmapOk(result);
  const plan = result.route?.transits?.[0];
  if (!plan) throw new Error(getRouteError(result));
  return {
    distance: Number(plan.distance) || Number(plan.walking_distance) || 0,
    time: Number(plan.duration) || Number(plan.time) || 0,
    paths: extractTransferPaths(plan),
  };
}

function parsePathRouteResult(result, routeMode) {
  const path =
    result.route?.paths?.[0] ||
    result.data?.paths?.[0] ||
    result.data?.route?.paths?.[0] ||
    result.paths?.[0];
  if (!path) throw new Error(getRouteError(result));
  const paths = extractPathPolylines(path);
  if (!paths.length) throw new Error("路线没有返回可绘制轨迹");
  return {
    distance: Number(path.distance) || 0,
    time: Number(path.duration) || Number(path.time) || 0,
    paths: routeMode === "transfer" ? paths.map((pathItem) => ({ path: pathItem, walking: false })) : paths,
  };
}

function extractPathPolylines(path) {
  const segments = [];
  const steps = [
    ...(Array.isArray(path.steps) ? path.steps : []),
    ...(Array.isArray(path.rides) ? path.rides : []),
  ];
  steps.forEach((step) => appendPolyline(segments, step.polyline || step.path));
  appendPolyline(segments, path.polyline);
  return segments;
}

function extractTransferPaths(plan) {
  const paths = [];
  (plan.segments || []).forEach((segment) => {
    const walkingSteps = segment.walking?.steps || [];
    walkingSteps.forEach((step) => {
      appendPolyline(paths, step.polyline || step.path, true);
    });

    const busLines = segment.bus?.buslines || segment.transit?.buslines || [];
    busLines.forEach((line) => {
      appendPolyline(paths, line.polyline || line.path, false);
    });

    appendPolyline(paths, segment.transit?.polyline || segment.transit?.path, false);
    appendPolyline(paths, segment.railway?.polyline || segment.railway?.path, false);
    appendPolyline(paths, segment.taxi?.polyline || segment.taxi?.path, false);
  });
  return paths;
}

function appendPolyline(collection, value, walking) {
  const path = Array.isArray(value) ? value.map(lngLatToArray).filter(isValidPoint) : parsePolyline(value);
  if (!path.length) return;
  collection.push(typeof walking === "boolean" ? { path, walking } : path);
}

function parsePolyline(value) {
  return String(value || "")
    .split(";")
    .map(parsePoint)
    .filter(isValidPoint);
}

function drawLeg(routeMode, paths, legIndex) {
  const AMap = state.AMap;
  const color = ROUTE_MODES[routeMode].color;
  paths.forEach((item) => {
    const isTransferPart = item && typeof item === "object" && "path" in item;
    const path = isTransferPart ? item.path : item;
    if (!path || !path.length) return;
    const isDashed = routeMode === "walking" || (routeMode === "transfer" && item.walking);
    const overlay = new AMap.Polyline({
      path,
      strokeColor: isTransferPart && item.walking ? ROUTE_MODES.walking.color : color,
      strokeWeight: routeMode === "transfer" && !item.walking ? 6 : 5,
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

function clearAllRoutes() {
  if (state.driving) state.driving.clear();
  if (state.walking) state.walking.clear();
  if (state.riding) state.riding.clear();
  if (state.transfer) state.transfer.clear();
  clearRouteOverlays();
}

function clearRouteOverlays() {
  if (state.map && state.routeOverlays.length) {
    state.map.remove(state.routeOverlays);
  }
  state.routeOverlays = [];
}

function fitRouteView() {
  const overlays = [...state.routeOverlays, ...state.stopMarkers.values(), state.startMarker].filter(Boolean);
  if (overlays.length) state.map.setFitView(overlays, false, [70, 70, 260, 70]);
}

function recommendRouteMode(start, orderedStops) {
  const totalDistance = pathDistance(start, orderedStops);
  const stopCount = orderedStops.length;
  if (totalDistance <= 1800 && stopCount <= 4) return "walking";
  if (totalDistance <= 12000 && stopCount <= 8) return "riding";
  return "driving";
}

function buildRouteSummary(requestedMode, actualMode, distance, time) {
  const orderMode = dom.manualOrderToggle.checked ? "列表顺序" : "自动优化";
  const modeText =
    requestedMode === "auto"
      ? `自动推荐${ROUTE_MODES[actualMode].label}`
      : ROUTE_MODES[actualMode].label;
  return `${orderMode} · ${modeText} · ${formatDistance(distance)} · ${formatTime(time)}`;
}

function getRouteError(result) {
  if (typeof result === "string") return result;
  return formatAmapServiceError(result, "无可用路线");
}

function getTransferCity() {
  return dom.cityInput.value.trim();
}

function resolveStopOrder(start) {
  const destinationStops = getDestinationStops();
  if (dom.manualOrderToggle.checked) {
    return [...destinationStops];
  }

  const priorityStops = destinationStops.filter((stop) => stop.priority);
  const flexibleStops = destinationStops.filter((stop) => !stop.priority);
  const startForFlexible = priorityStops.length
    ? priorityStops[priorityStops.length - 1].position
    : start;
  return [...priorityStops, ...optimizeOpenPath(startForFlexible, flexibleStops)];
}

function getDestinationStops() {
  return state.stops.filter((stop) => stop.id !== state.originStopId);
}

function getOriginStop() {
  if (!state.originStopId) return null;
  return state.stops.find((stop) => stop.id === state.originStopId) || null;
}

function resolveRouteStart() {
  const originStop = getOriginStop();
  if (originStop) {
    return { position: originStop.position, label: originStop.name };
  }
  return {
    position: state.currentPosition || lngLatToArray(state.map.getCenter()),
    label: state.currentAddress || "地图中心",
  };
}

function getRouteStartLabel() {
  const originStop = getOriginStop();
  if (originStop) return originStop.name;
  return state.currentAddress || "当前位置";
}

function toggleOriginStop(stopId) {
  state.originStopId = state.originStopId === stopId ? "" : stopId;
  state.routeOrder = [];
  state.lastRouteStart = null;
  state.lastRouteStartLabel = "";
  saveOriginStop();
  clearAllRoutes();
  syncStartMarker();
  renderStops();
  refreshMarkers();
  const originStop = getOriginStop();
  setStatus(originStop ? `已设为出发点：${originStop.name}` : "已改回当前位置出发");
}

function saveOriginStop() {
  if (state.originStopId) {
    localStorage.setItem(ORIGIN_STOP_KEY, state.originStopId);
  } else {
    localStorage.removeItem(ORIGIN_STOP_KEY);
  }
}

function optimizeOpenPath(start, stops) {
  if (stops.length <= 1) return [...stops];
  if (stops.length <= 8) return bruteForceOpenPath(start, stops);
  return twoOptOpenPath(start, nearestNeighborPath(start, stops));
}

function bruteForceOpenPath(start, stops) {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOrder = [];
  const used = new Array(stops.length).fill(false);
  const current = [];

  function visit(lastPoint, distance) {
    if (distance >= bestDistance) return;
    if (current.length === stops.length) {
      bestDistance = distance;
      bestOrder = [...current];
      return;
    }

    for (let index = 0; index < stops.length; index += 1) {
      if (used[index]) continue;
      const stop = stops[index];
      used[index] = true;
      current.push(stop);
      visit(stop.position, distance + distanceBetween(lastPoint, stop.position));
      current.pop();
      used[index] = false;
    }
  }

  visit(start, 0);
  return bestOrder;
}

function nearestNeighborPath(start, stops) {
  const remaining = [...stops];
  const ordered = [];
  let cursor = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const distance = distanceBetween(cursor, stop.position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const [nextStop] = remaining.splice(bestIndex, 1);
    ordered.push(nextStop);
    cursor = nextStop.position;
  }
  return ordered;
}

function twoOptOpenPath(start, ordered) {
  let best = [...ordered];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 2; i += 1) {
      for (let k = i + 1; k < best.length - 1; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (pathDistance(start, candidate) < pathDistance(start, best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

function pathDistance(start, ordered) {
  let total = 0;
  let cursor = start;
  ordered.forEach((stop) => {
    total += distanceBetween(cursor, stop.position);
    cursor = stop.position;
  });
  return total;
}

function distanceBetween(a, b) {
  const earthRadius = 6371000;
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = toRadians(b[1] - a[1]);
  const deltaLng = toRadians(b[0] - a[0]);
  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function openFirstLegNavigation() {
  if (!state.lastRouteStart || !state.routeOrder.length) return;
  const firstStop = state.stops.find((stop) => stop.id === state.routeOrder[0]);
  if (!firstStop) return;
  const [slon, slat] = state.lastRouteStart;
  const [dlon, dlat] = firstStop.position;
  const url = new URL("https://uri.amap.com/navigation");
  url.searchParams.set("from", `${slon},${slat},${state.lastRouteStartLabel || "出发点"}`);
  url.searchParams.set("to", `${dlon},${dlat},${firstStop.name}`);
  url.searchParams.set("mode", ROUTE_MODES[state.lastRouteMode]?.navMode || "car");
  url.searchParams.set("policy", "1");
  url.searchParams.set("coordinate", "gaode");
  url.searchParams.set("callnative", "1");
  url.searchParams.set("src", "amap-route-planner");
  window.location.href = url.toString();
}

function lngLatToArray(value) {
  if (Array.isArray(value)) return [Number(value[0]), Number(value[1])];
  if (typeof value.getLng === "function" && typeof value.getLat === "function") {
    return [value.getLng(), value.getLat()];
  }
  return [Number(value.lng), Number(value.lat)];
}

function parsePoint(value) {
  if (Array.isArray(value)) return lngLatToArray(value);
  const [lng, lat] = String(value || "")
    .split(",")
    .map(Number);
  return [lng, lat];
}

function pointParam(position) {
  const point = lngLatToArray(position);
  return `${point[0]},${point[1]}`;
}

function isValidPoint(position) {
  return (
    Array.isArray(position) &&
    position.length === 2 &&
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1])
  );
}

function pointToText(position) {
  return `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`;
}

function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) return "距离未知";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  return `${Math.round(meters)} 米`;
}

function formatTime(seconds) {
  if (!Number.isFinite(Number(seconds))) return "时间未知";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function setStatus(message) {
  dom.statusText.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
