import { state } from "../state.js";
import { lngLatToArray } from "../utils/geo.js";
import { setStatus } from "../ui/status.js";
import { syncStartMarker } from "./markers.js";

function formatAccuracy(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  return `${Math.round(meters)} 米`;
}

function pickCity(addr) {
  if (!addr) return "";
  return String(addr.city || addr.province || addr.district || "").trim();
}

export function locateUser(onDone) {
  if (!state.geolocation) {
    setStatus("地图还没有加载");
    return;
  }
  setStatus("正在定位");
  state.geolocation.getCurrentPosition((status, result) => {
    if (status === "complete" && result.position) {
      state.currentPosition = lngLatToArray(result.position);
      state.currentAddress = result.formattedAddress || "当前位置";
      state.currentAccuracy = Number.isFinite(result.accuracy) ? Number(result.accuracy) : null;
      state.currentCity = pickCity(result.addressComponent);
      syncStartMarker();
      const accText = formatAccuracy(state.currentAccuracy);
      setStatus(accText ? `定位成功，精度约 ${accText}` : "定位成功");
    } else {
      state.currentPosition = lngLatToArray(state.map.getCenter());
      state.currentAddress = "地图中心";
      state.currentAccuracy = null;
      state.currentCity = "";
      syncStartMarker();
      setStatus("定位失败，已用地图中心作起点");
    }
    if (onDone) onDone();
  });
}
