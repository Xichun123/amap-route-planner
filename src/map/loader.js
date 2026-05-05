import { PLUGINS } from "../config.js";
import { state } from "../state.js";

export async function loadAMap(config) {
  if (!window.AMapLoader) throw new Error("AMapLoader 未加载，请检查网络");

  window._AMapSecurityConfig = config.serviceHost
    ? { serviceHost: config.serviceHost }
    : { securityJsCode: config.securityCode };

  const AMap = await window.AMapLoader.load({
    key: config.jsapiKey,
    version: "2.0",
    plugins: PLUGINS,
  });

  AMap.getConfig().appname = "amap-jsapi-skill";
  return AMap;
}

export function buildMap(AMap) {
  const map = new AMap.Map("map", {
    viewMode: "3D",
    zoom: 13,
    center: [116.397428, 39.90923],
    pitch: 0,
    mapStyle: "amap://styles/normal",
  });
  map.addControl(new AMap.Scale({ position: { left: "14px", top: "90px" } }));
  map.addControl(new AMap.ToolBar({ position: { right: "14px", top: "118px" } }));
  return map;
}

export function destroyMap() {
  if (state.map) {
    state.map.destroy();
    state.map = null;
    state.stopMarkers.clear();
    state.startMarker = null;
    state.accuracyCircle = null;
  }
}
