import { state } from "../state.js";
import { ROUTE_MODES } from "../config.js";

export function openFirstLegNavigation() {
  if (!state.lastRouteStart || !state.routeOrder.length) return;
  const firstStop = state.stops.find((stop) => stop.id === state.routeOrder[0]);
  if (!firstStop) return;
  const [slon, slat] = state.lastRouteStart;
  const [dlon, dlat] = firstStop.position;
  const url = new URL("https://uri.amap.com/navigation");
  url.searchParams.set("from", `${slon},${slat},${state.lastRouteStartLabel || "出发点"}`);
  url.searchParams.set("to", `${dlon},${dlat},${firstStop.name}`);
  url.searchParams.set("mode", ROUTE_MODES[state.lastRouteMode]?.navMode || "car");
  url.searchParams.set("policy", "1");
  url.searchParams.set("coordinate", "gaode");
  url.searchParams.set("callnative", "1");
  url.searchParams.set("src", "amap-route-planner");
  window.location.href = url.toString();
}
