import { readConfig, isConfigComplete } from "./config.js";
import { state } from "./state.js";
import { dom } from "./dom.js";
import {
  saveRouteMode,
  loadRouteMode,
  loadSheetPosition,
} from "./storage.js";
import { setStatus } from "./ui/status.js";
import { applySheetPosition, expandSheet, collapseSheet } from "./ui/sheet.js";
import { renderStops, refreshMarkers, renderSearchResults } from "./ui/stops-view.js";
import { loadAMap, buildMap, destroyMap } from "./map/loader.js";
import { locateUser } from "./map/locate.js";
import { ensureSearchInstances, bindAutocompleteInput } from "./search/poi.js";
import { renderSearchMarkers, clearSearchMarkers } from "./map/markers.js";
import { ensureRoutingInstances } from "./route/services.js";
import { planRoute, clearAllRoutes } from "./route/planner.js";
import { openFirstLegNavigation } from "./route/navigation.js";
import {
  addStop,
  removeStop,
  swapStops,
  togglePriority,
  toggleOriginStop,
  clearStops,
  restoreStops,
  applyPlan,
} from "./stops.js";
import { savePlan, getPlan, deletePlan, findPlanByName } from "./plans.js";
import {
  refreshPlanCount,
  renderPlanList,
  openSavePlanDialog,
  closeSavePlanDialog,
  setSavePlanMessage,
  openPlanListDialog,
  closePlanListDialog,
} from "./ui/plans-view.js";

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  bindEvents();
  applySheetPosition(loadSheetPosition());
  dom.routeModeSelect.value = loadRouteMode();
  refreshPlanCount();

  const config = readConfig();
  if (!isConfigComplete(config)) {
    setStatus("服务器未配置高德 Key");
    renderStops();
    return;
  }

  try {
    setStatus("正在加载高德地图");
    destroyMap();
    const AMap = await loadAMap(config);
    state.AMap = AMap;
    state.map = buildMap(AMap);
    state.geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
      showButton: false,
      showMarker: false,
      showCircle: false,
      panToLocation: true,
      zoomToAccuracy: true,
      convert: true,
      needAddress: true,
      getCityWhenFail: true,
    });
    state.map.addControl(state.geolocation);

    ensureSearchInstances(AMap);
    ensureRoutingInstances(AMap, state.map);

    bindAutocompleteInput(dom.searchInput, dom.cityInput, (pois) => {
      renderSearchResults(pois, handlePickPoi);
      try {
        renderSearchMarkers(pois, handlePickPoi);
      } catch (err) {
        console.warn("[search-markers] render failed", err);
      }
    });

    restoreStops();
    locateUser(() => {
      renderStops();
      // 定位成功 → 自动用当前城市做搜索偏置（仅在用户未手动填城市时）
      if (state.currentCity && !dom.cityInput.value.trim()) {
        dom.cityInput.value = state.currentCity;
      }
    });
    setStatus("地图已加载");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "地图加载失败，请检查 Key");
  }
}

function handlePickPoi(poi) {
  addStop(poi);
  dom.searchResults.hidden = true;
  dom.searchInput.value = "";
  clearSearchMarkers();
}

function handlePlanRoute() {
  planRoute(() => {
    renderStops();
    refreshMarkers();
  });
}

function handleClearStops() {
  clearStops(clearAllRoutes);
}

function handleRemoveStop(stopId) {
  removeStop(stopId, clearAllRoutes);
}

function handleToggleOrigin(stopId) {
  toggleOriginStop(stopId, clearAllRoutes);
}

function handleSavePlan(event) {
  event.preventDefault();
  if (!state.stops.length) {
    setSavePlanMessage("当前没有地点可保存", true);
    return;
  }
  const name = dom.savePlanName.value.trim();
  if (!name) {
    setSavePlanMessage("请填写方案名称", true);
    return;
  }
  const existing = findPlanByName(name);
  const saved = savePlan({
    name,
    stops: state.stops,
    originStopId: state.originStopId,
    routeMode: dom.routeModeSelect.value,
    manualOrder: dom.manualOrderToggle.checked,
    replaceId: existing?.id,
  });
  closeSavePlanDialog();
  refreshPlanCount();
  setStatus(existing ? `已覆盖方案：${saved.name}` : `已保存方案：${saved.name}`);
}

function handlePlanListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest(".plan-row");
  const action = button.dataset.action;
  if (action === "close-plan-list") {
    closePlanListDialog();
    return;
  }
  const planId = row?.dataset.planId;
  if (!planId) return;
  if (action === "load") {
    const plan = getPlan(planId);
    if (!plan) {
      setStatus("方案已不存在");
      renderPlanList();
      return;
    }
    applyPlan(plan, clearAllRoutes);
    closePlanListDialog();
  } else if (action === "delete") {
    const plan = getPlan(planId);
    if (!plan) return;
    const ok = window.confirm(`确认删除方案「${plan.name}」？`);
    if (!ok) return;
    deletePlan(planId);
    refreshPlanCount();
    renderPlanList();
    setStatus(`已删除方案：${plan.name}`);
  }
}

function bindEvents() {
  dom.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    // Trigger autocomplete flow by re-dispatching input.
    dom.searchInput.dispatchEvent(new Event("input"));
  });

  dom.reloadButton.addEventListener("click", () => window.location.reload());
  dom.locateButton.addEventListener("click", () => locateUser(renderStops));
  dom.sheetGripButton.addEventListener("click", expandSheet);
  dom.sheetCollapseButton.addEventListener("click", collapseSheet);
  dom.planRouteButton.addEventListener("click", handlePlanRoute);
  dom.clearStopsButton.addEventListener("click", handleClearStops);
  dom.openNavigationButton.addEventListener("click", openFirstLegNavigation);

  dom.stopList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const stopId = button.closest(".stop-row")?.dataset.stopId;
    if (!stopId) return;
    const index = state.stops.findIndex((s) => s.id === stopId);
    if (index < 0) return;
    const action = button.dataset.action;

    if (action === "up" && index > 0) swapStops(index, index - 1);
    else if (action === "down" && index < state.stops.length - 1) swapStops(index, index + 1);
    else if (action === "origin") handleToggleOrigin(stopId);
    else if (action === "priority") togglePriority(stopId);
    else if (action === "remove") handleRemoveStop(stopId);
  });

  dom.manualOrderToggle.addEventListener("change", () => {
    state.routeOrder = [];
    renderStops();
    refreshMarkers();
  });

  dom.routeModeSelect.addEventListener("change", () => {
    saveRouteMode(dom.routeModeSelect.value);
    state.routeOrder = [];
    renderStops();
    refreshMarkers();
  });

  window.addEventListener("beforeunload", destroyMap);

  dom.savePlanButton.addEventListener("click", () => {
    if (!state.stops.length) {
      setStatus("先添加地点再保存方案");
      return;
    }
    const originName = state.stops.find((s) => s.id === state.originStopId)?.name;
    const seed = originName ? `${originName}出发` : `${state.stops.length} 地点方案`;
    openSavePlanDialog(seed);
  });
  dom.savePlanForm.addEventListener("submit", handleSavePlan);
  dom.savePlanDialog.addEventListener("click", (event) => {
    if (event.target.dataset.action === "cancel") closeSavePlanDialog();
  });

  dom.loadPlanButton.addEventListener("click", openPlanListDialog);
  dom.planList.addEventListener("click", handlePlanListClick);
  dom.planListDialog.addEventListener("click", (event) => {
    if (event.target.dataset.action === "close-plan-list") closePlanListDialog();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
