import { state } from "../state.js";

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
