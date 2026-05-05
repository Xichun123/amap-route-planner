export function lngLatToArray(value) {
  if (Array.isArray(value)) return [Number(value[0]), Number(value[1])];
  if (value && typeof value.getLng === "function" && typeof value.getLat === "function") {
    return [value.getLng(), value.getLat()];
  }
  if (value && typeof value === "object") return [Number(value.lng), Number(value.lat)];
  return [NaN, NaN];
}

export function parsePoint(value) {
  if (Array.isArray(value)) return lngLatToArray(value);
  const [lng, lat] = String(value || "").split(",").map(Number);
  return [lng, lat];
}

export function isValidPoint(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

export function pointToText(p) {
  return `${p[0].toFixed(6)}, ${p[1].toFixed(6)}`;
}

const EARTH_RADIUS = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceBetween(a, b) {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function pathDistance(start, ordered) {
  let total = 0;
  let cursor = start;
  for (const stop of ordered) {
    total += distanceBetween(cursor, stop.position);
    cursor = stop.position;
  }
  return total;
}
