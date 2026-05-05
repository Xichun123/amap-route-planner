import { STORAGE_KEYS } from "./config.js";
import { state } from "./state.js";

export function saveStops() {
  const data = state.stops.map(({ id, sourceId, name, address, city, position, priority }) => ({
    id,
    sourceId,
    name,
    address,
    city,
    position,
    priority,
  }));
  localStorage.setItem(STORAGE_KEYS.stops, JSON.stringify(data));
}

export function loadStops() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.stops) || "[]");
    return raw.filter((stop) => Array.isArray(stop.position) && stop.position.length === 2);
  } catch {
    return [];
  }
}

export function saveOriginStop() {
  if (state.originStopId) {
    localStorage.setItem(STORAGE_KEYS.origin, state.originStopId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.origin);
  }
}

export function loadOriginStop() {
  return localStorage.getItem(STORAGE_KEYS.origin) || "";
}

export function saveRouteMode(mode) {
  localStorage.setItem(STORAGE_KEYS.mode, mode);
}

export function loadRouteMode() {
  return localStorage.getItem(STORAGE_KEYS.mode) || "auto";
}

export function saveSheetCollapsed(collapsed) {
  localStorage.setItem(STORAGE_KEYS.collapsed, collapsed ? "1" : "0");
}

export function loadSheetCollapsed() {
  return localStorage.getItem(STORAGE_KEYS.collapsed) === "1";
}

const SHEET_POSITIONS = ["peek", "mid", "full"];

export function saveSheetPosition(position) {
  if (!SHEET_POSITIONS.includes(position)) return;
  localStorage.setItem(STORAGE_KEYS.sheetPosition, position);
}

export function loadSheetPosition() {
  const stored = localStorage.getItem(STORAGE_KEYS.sheetPosition);
  if (SHEET_POSITIONS.includes(stored)) return stored;
  // 旧版本兼容：曾用过 boolean 折叠态
  if (localStorage.getItem(STORAGE_KEYS.collapsed) === "1") return "peek";
  return "mid";
}
