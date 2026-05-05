import { state } from "../state.js";
import { escapeHtml } from "../utils/format.js";

export function createStopMarker(stop, onClick) {
  const { AMap, map, stopMarkers } = state;
  if (!AMap || !map || stopMarkers.has(stop.id)) return;
  const marker = new AMap.Marker({
    position: stop.position,
    content: '<div class="stop-marker">1</div>',
    offset: new AMap.Pixel(-15, -15),
    title: stop.name,
  });
  if (onClick) marker.on("click", () => onClick(stop.id));
  map.add(marker);
  stopMarkers.set(stop.id, marker);
}

export function removeStopMarker(stopId) {
  const marker = state.stopMarkers.get(stopId);
  if (marker && state.map) state.map.remove(marker);
  state.stopMarkers.delete(stopId);
}

export function clearStopMarkers() {
  if (state.map) state.map.remove([...state.stopMarkers.values()]);
  state.stopMarkers.clear();
}

export function drawStartMarker(position) {
  const { AMap, map } = state;
  if (!AMap || !map) return;
  if (!state.startMarker) {
    state.startMarker = new AMap.Marker({
      content: '<div class="locate-marker" aria-hidden="true"><span class="locate-dot"></span></div>',
      offset: new AMap.Pixel(-10, -10),
      title: "当前位置（未指定起点）",
      zIndex: 110,
      bubble: true,
    });
    map.add(state.startMarker);
  }
  state.startMarker.setPosition(position);
}

export function removeStartMarker() {
  if (!state.startMarker || !state.map) return;
  state.map.remove(state.startMarker);
  state.startMarker = null;
}

export function drawAccuracyCircle(position, radius) {
  const { AMap, map } = state;
  if (!AMap || !map) return;
  if (!Number.isFinite(radius) || radius <= 0) {
    removeAccuracyCircle();
    return;
  }
  if (!state.accuracyCircle) {
    state.accuracyCircle = new AMap.Circle({
      center: position,
      radius,
      strokeColor: "#1a73e8",
      strokeOpacity: 0.5,
      strokeWeight: 1,
      fillColor: "#1a73e8",
      fillOpacity: 0.12,
      zIndex: 40,
      bubble: true,
    });
    map.add(state.accuracyCircle);
    return;
  }
  state.accuracyCircle.setCenter(position);
  state.accuracyCircle.setRadius(radius);
  state.accuracyCircle.show();
}

export function removeAccuracyCircle() {
  if (!state.accuracyCircle) return;
  if (state.map) state.map.remove(state.accuracyCircle);
  state.accuracyCircle = null;
}

export function syncStartMarker() {
  const originStop = getOriginStop();
  if (originStop) {
    removeStartMarker();
    removeAccuracyCircle();
    return;
  }
  if (state.currentPosition) drawStartMarker(state.currentPosition);
  if (state.currentPosition && Number.isFinite(state.currentAccuracy)) {
    drawAccuracyCircle(state.currentPosition, state.currentAccuracy);
  } else {
    removeAccuracyCircle();
  }
}

export function getOriginStop() {
  if (!state.originStopId) return null;
  return state.stops.find((stop) => stop.id === state.originStopId) || null;
}

/* ============================================================
   搜索结果候选标记（红色，点击直接添加为 stop）
   ============================================================ */
const SEARCH_FIT_PADDING = [80, 60, 60, 60];

function isPointInBounds(map, point) {
  try {
    const bounds = map.getBounds();
    if (!bounds || typeof bounds.contains !== "function") return false;
    return bounds.contains(point);
  } catch (_) {
    return false;
  }
}

export function renderSearchMarkers(pois, onPick) {
  // 渲染前记录当前是否已有标记 —— 用于判断是否要 fit 视野（仅首次出现时 fit）
  const hadPrevious = Array.isArray(state.searchMarkers) && state.searchMarkers.length > 0;

  clearSearchMarkers();
  const { AMap, map } = state;
  if (!AMap || !map || !Array.isArray(pois) || !pois.length) return;

  const markers = [];
  pois.forEach((poi, index) => {
    if (!poi || !Array.isArray(poi.position)) return;
    try {
      const marker = new AMap.Marker({
        position: poi.position,
        content: `<div class="search-marker" title="${escapeHtml(poi.name || "")}">${index + 1}</div>`,
        offset: new AMap.Pixel(-15, -15),
        zIndex: 95,
      });
      if (typeof onPick === "function") {
        marker.on("click", () => onPick(poi));
      }
      markers.push(marker);
    } catch (err) {
      console.warn("[search-marker] create failed", err);
    }
  });

  if (!markers.length) return;

  try {
    map.add(markers);
  } catch (err) {
    console.warn("[search-marker] add failed", err);
    return;
  }
  state.searchMarkers = markers;

  // 仅在「上一轮无候选」时才 fit 视野；用户输入后续字符时地图保持原状，
  // 避免每次 input 都触发地图飞行。
  if (hadPrevious) return;

  // 如果首条结果已经在当前视野内，无需 fit，避免不必要的飞行
  if (markers.length === 1 && isPointInBounds(map, pois[0].position)) return;

  try {
    if (markers.length === 1) {
      map.setCenter(pois[0].position);
    } else {
      // 检查所有点是否都已在视野内：是 → 不动；否 → fit
      const allVisible = pois.every((p) => isPointInBounds(map, p.position));
      if (!allVisible) {
        map.setFitView(markers, false, SEARCH_FIT_PADDING);
      }
    }
  } catch (err) {
    console.warn("[search-marker] setFitView failed", err);
  }
}

export function clearSearchMarkers() {
  if (!state.searchMarkers || !state.searchMarkers.length) return;
  try {
    if (state.map) state.map.remove(state.searchMarkers);
  } catch (err) {
    console.warn("[search-marker] clear failed", err);
  }
  state.searchMarkers = [];
}

/**
 * 追加搜索结果标记（用于"加载更多"），不清空已有，不 fit 视野。
 */
export function appendSearchMarkers(pois, onPick) {
  const { AMap, map } = state;
  if (!AMap || !map || !Array.isArray(pois) || !pois.length) return;
  const startIndex = state.searchMarkers ? state.searchMarkers.length : 0;
  const markers = [];
  pois.forEach((poi, i) => {
    if (!poi || !Array.isArray(poi.position)) return;
    try {
      const marker = new AMap.Marker({
        position: poi.position,
        content: `<div class="search-marker" title="${escapeHtml(poi.name || "")}">${startIndex + i + 1}</div>`,
        offset: new AMap.Pixel(-15, -15),
        zIndex: 95,
      });
      if (typeof onPick === "function") {
        marker.on("click", () => onPick(poi));
      }
      markers.push(marker);
    } catch (err) {
      console.warn("[search-marker] append create failed", err);
    }
  });
  if (!markers.length) return;
  try {
    map.add(markers);
  } catch (err) {
    console.warn("[search-marker] append add failed", err);
    return;
  }
  state.searchMarkers = (state.searchMarkers || []).concat(markers);
}
