function $(id) {
  return document.getElementById(id);
}

export const dom = {
  appShell: document.querySelector(".app-shell"),
  map: $("map"),
  statusText: $("status-text"),
  searchForm: $("search-form"),
  searchInput: $("search-input"),
  cityInput: $("city-input"),
  searchResults: $("search-results"),
  stopList: $("stop-list"),
  routeSummary: $("route-summary"),
  sheetGripButton: $("sheet-grip-button"),
  sheetCollapseButton: $("sheet-collapse-button"),
  manualOrderToggle: $("manual-order-toggle"),
  routeModeSelect: $("route-mode-select"),
  planRouteButton: $("plan-route-button"),
  locateButton: $("locate-button"),
  clearStopsButton: $("clear-stops-button"),
  openNavigationButton: $("open-navigation-button"),
  reloadButton: $("reload-button"),
  savePlanButton: $("save-plan-button"),
  loadPlanButton: $("load-plan-button"),
  planCount: $("plan-count"),
  savePlanDialog: $("save-plan-dialog"),
  savePlanForm: $("save-plan-form"),
  savePlanName: $("save-plan-name"),
  savePlanMessage: $("save-plan-message"),
  planListDialog: $("plan-list-dialog"),
  planList: $("plan-list"),
};
