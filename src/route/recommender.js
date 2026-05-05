import { pathDistance } from "../utils/geo.js";

export function recommendRouteMode(start, orderedStops) {
  const totalDistance = pathDistance(start, orderedStops);
  const stopCount = orderedStops.length;
  if (totalDistance <= 1800 && stopCount <= 4) return "walking";
  if (totalDistance <= 12000 && stopCount <= 8) return "riding";
  return "driving";
}
