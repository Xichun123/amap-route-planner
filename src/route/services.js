import { state } from "../state.js";
import { lngLatToArray, isValidPoint } from "../utils/geo.js";

function routeError(status, result) {
  if (typeof result === "string" && result) return result;
  if (status === "no_data") return "无可用路线";
  return result?.info || "路线规划失败";
}

function toPoints(value) {
  if (!Array.isArray(value)) return [];
  return value.map(lngLatToArray).filter(isValidPoint);
}

export function ensureRoutingInstances(AMap, map) {
  if (!state.driving) {
    state.driving = new AMap.Driving({
      map,
      hideMarkers: true,
      autoFitView: false,
      showTraffic: false,
    });
  }
  if (!state.walking) state.walking = new AMap.Walking({ hideMarkers: true });
  if (!state.riding) state.riding = new AMap.Riding({ hideMarkers: true });
}

export function ensureTransfer(AMap, city) {
  if (state.transfer) {
    state.transfer.setCity(city);
    return state.transfer;
  }
  state.transfer = new AMap.Transfer({ city, hideMarkers: true });
  return state.transfer;
}

export function planDriving(origin, destination, waypoints) {
  return new Promise((resolve, reject) => {
    state.driving.clear();
    state.driving.search(origin, destination, { waypoints }, (status, result) => {
      if (status === "complete" && result.routes && result.routes[0]) {
        const route = result.routes[0];
        resolve({
          distance: Number(route.distance) || 0,
          time: Number(route.time) || 0,
        });
        return;
      }
      reject(new Error(routeError(status, result)));
    });
  });
}

export function planWalkingLeg(origin, destination) {
  return runSimple(state.walking, origin, destination, extractWalkingPaths);
}

export function planRidingLeg(origin, destination) {
  return runSimple(state.riding, origin, destination, extractRidingPaths);
}

export function planTransferLeg(origin, destination) {
  return new Promise((resolve, reject) => {
    if (!state.transfer) return reject(new Error("公交规划未初始化"));
    state.transfer.search(origin, destination, (status, result) => {
      if (status !== "complete") return reject(new Error(routeError(status, result)));
      const plan = result.plans?.[0];
      if (!plan) return reject(new Error("无可用公交线路"));
      resolve({
        distance: Number(plan.distance) || Number(plan.walking_distance) || 0,
        time: Number(plan.time) || Number(plan.duration) || 0,
        paths: extractTransferPaths(plan),
      });
    });
  });
}

function runSimple(instance, origin, destination, extractor) {
  return new Promise((resolve, reject) => {
    if (!instance) return reject(new Error("路线规划未初始化"));
    instance.search(origin, destination, (status, result) => {
      if (status !== "complete") return reject(new Error(routeError(status, result)));
      const route = result.routes?.[0];
      if (!route) return reject(new Error("无可用路线"));
      resolve({
        distance: Number(route.distance) || 0,
        time: Number(route.time) || 0,
        paths: extractor(route),
      });
    });
  });
}

function extractWalkingPaths(route) {
  const points = (route.steps || []).flatMap((step) => toPoints(step.path));
  return points.length ? [points] : [];
}

function extractRidingPaths(route) {
  const points = (route.rides || []).flatMap((step) => toPoints(step.path));
  return points.length ? [points] : [];
}

function extractTransferPaths(plan) {
  const out = [];
  (plan.segments || []).forEach((seg) => {
    const walkingPath = seg.walking?.path
      ? toPoints(seg.walking.path)
      : (seg.walking?.steps || []).flatMap((s) => toPoints(s.path));
    if (walkingPath.length) out.push({ path: walkingPath, walking: true });

    const ridePath = seg.transit?.path || seg.railway?.path || seg.taxi?.path;
    const ridePoints = toPoints(ridePath);
    if (ridePoints.length) out.push({ path: ridePoints, walking: false });
  });
  return out;
}
