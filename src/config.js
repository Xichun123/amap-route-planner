export const PLUGINS = [
  "AMap.Scale",
  "AMap.ToolBar",
  "AMap.Geolocation",
  "AMap.AutoComplete",
  "AMap.PlaceSearch",
  "AMap.Driving",
  "AMap.Walking",
  "AMap.Riding",
  "AMap.Transfer",
];

export const ROUTE_MODES = {
  auto: { label: "自动" },
  driving: { label: "驾车", navMode: "car", color: "#1769e0" },
  walking: { label: "步行", navMode: "walk", color: "#12805c" },
  riding: { label: "骑行", navMode: "ride", color: "#d97706" },
  transfer: { label: "公交", navMode: "bus", color: "#7c3aed" },
};

export const STORAGE_KEYS = {
  stops: "amap-route-planner-stops",
  origin: "amap-route-planner-origin-stop",
  mode: "amap-route-planner-mode",
  collapsed: "amap-route-planner-sheet-collapsed",        // legacy
  sheetPosition: "amap-route-planner-sheet-position",     // peek | mid | full
};

function trimSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function readConfig() {
  const raw = window.__AMAP_ROUTE_CONFIG__ || {};
  return {
    jsapiKey: String(raw.jsapiKey || "").trim(),
    securityCode: String(raw.securityCode || "").trim(),
    serviceHost: trimSlash(String(raw.serviceHost || "").trim()),
  };
}

export function isConfigComplete(config) {
  return Boolean(config.jsapiKey && (config.securityCode || config.serviceHost));
}
