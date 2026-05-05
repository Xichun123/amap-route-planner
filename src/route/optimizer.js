import { distanceBetween, pathDistance } from "../utils/geo.js";

export function optimizeOpenPath(start, stops) {
  if (stops.length <= 1) return [...stops];
  if (stops.length <= 8) return bruteForceOpenPath(start, stops);
  return twoOptOpenPath(start, nearestNeighborPath(start, stops));
}

function bruteForceOpenPath(start, stops) {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOrder = [];
  const used = new Array(stops.length).fill(false);
  const current = [];

  function visit(lastPoint, distance) {
    if (distance >= bestDistance) return;
    if (current.length === stops.length) {
      bestDistance = distance;
      bestOrder = [...current];
      return;
    }
    for (let i = 0; i < stops.length; i += 1) {
      if (used[i]) continue;
      const stop = stops[i];
      used[i] = true;
      current.push(stop);
      visit(stop.position, distance + distanceBetween(lastPoint, stop.position));
      current.pop();
      used[i] = false;
    }
  }
  visit(start, 0);
  return bestOrder;
}

function nearestNeighborPath(start, stops) {
  const remaining = [...stops];
  const ordered = [];
  let cursor = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, i) => {
      const d = distanceBetween(cursor, stop.position);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next.position;
  }
  return ordered;
}

function twoOptOpenPath(start, ordered) {
  let best = [...ordered];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 2; i += 1) {
      for (let k = i + 1; k < best.length - 1; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (pathDistance(start, candidate) < pathDistance(start, best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}
