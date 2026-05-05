import { state } from "../state.js";
import { dom } from "../dom.js";
import { escapeHtml } from "../utils/format.js";
import { pointToText } from "../utils/geo.js";
import { getDestinationStops, getRouteStartLabel } from "../route/planner.js";
import { ICONS } from "./icons.js";

function getDisplayOrderMap() {
  const map = new Map();
  state.routeOrder.forEach((stopId, i) => map.set(stopId, i + 1));
  return map;
}

function getListOrderMap() {
  const map = new Map();
  getDestinationStops().forEach((stop, i) => map.set(stop.id, i + 1));
  return map;
}

export function renderStops() {
  dom.stopList.innerHTML = "";
  const destinationStops = getDestinationStops();
  dom.clearStopsButton.disabled = state.stops.length === 0;
  dom.planRouteButton.disabled = destinationStops.length === 0;
  dom.openNavigationButton.disabled = state.routeOrder.length === 0;
  dom.savePlanButton.disabled = state.stops.length === 0;

  if (!state.stops.length) {
    dom.stopList.innerHTML = '<div class="empty-state">从上方搜索并添加地点</div>';
    dom.routeSummary.textContent = state.currentPosition
      ? `当前位置：${state.currentAddress || "已定位"}（点任意地点的「起」按钮可指定为起点）`
      : "还没有添加地点";
    return;
  }

  const parts = [`${destinationStops.length} 个待到访地点`];
  parts.push(`出发：${getRouteStartLabel()}`);
  if (state.routeOrder.length) parts.push("已生成顺序");
  dom.routeSummary.textContent = parts.join(" · ");

  const activeOrder = getDisplayOrderMap();
  const listOrder = getListOrderMap();
  state.stops.forEach((stop, index) => {
    const row = document.createElement("div");
    const isOrigin = state.originStopId === stop.id;
    const orderNumber = isOrigin
      ? "起"
      : activeOrder.get(stop.id) || listOrder.get(stop.id) || index + 1;
    const indexClass = isOrigin ? "start" : stop.priority ? "priority" : "";
    row.className = "stop-row";
    row.dataset.stopId = stop.id;
    row.innerHTML = `
      <span class="stop-index ${indexClass}">${orderNumber}</span>
      <span>
        <span class="stop-title">${escapeHtml(stop.name)}</span>
        <span class="stop-meta">${escapeHtml(stop.address || stop.city || pointToText(stop.position))}</span>
      </span>
      <span class="stop-controls">
        <button class="mini-button ${isOrigin ? "origin-on" : ""}" type="button" data-action="origin" aria-label="设为出发点" title="设为出发点">${ICONS.flag}</button>
        <button class="mini-button" type="button" data-action="up" aria-label="上移" title="上移">${ICONS.arrowUp}</button>
        <button class="mini-button" type="button" data-action="down" aria-label="下移" title="下移">${ICONS.arrowDown}</button>
        <button class="mini-button ${stop.priority ? "priority-on" : ""}" type="button" data-action="priority" aria-label="优先到访" title="优先到访" ${isOrigin ? "disabled" : ""}>${ICONS.star}</button>
        <button class="mini-button" type="button" data-action="remove" aria-label="删除" title="删除">${ICONS.xmark}</button>
      </span>
    `;
    dom.stopList.appendChild(row);
  });
}

export function refreshMarkers() {
  const activeOrder = getDisplayOrderMap();
  const listOrder = getListOrderMap();
  state.stops.forEach((stop, index) => {
    const marker = state.stopMarkers.get(stop.id);
    if (!marker) return;
    const isOrigin = state.originStopId === stop.id;
    const orderNumber = isOrigin
      ? "起"
      : activeOrder.get(stop.id) || listOrder.get(stop.id) || index + 1;
    const markerClass = isOrigin ? "start" : stop.priority ? "priority" : "";
    marker.setContent(`<div class="stop-marker ${markerClass}">${orderNumber}</div>`);
    marker.setPosition(stop.position);
    marker.setTitle(stop.name);
  });
}

export function renderSearchResults(pois, onPick) {
  dom.searchResults.innerHTML = "";
  dom.searchResults.hidden = pois.length === 0;
  pois.forEach((poi) => {
    const button = document.createElement("button");
    button.className = "result-item";
    button.type = "button";
    button.innerHTML = `
      <span>
        <span class="result-title">${escapeHtml(poi.name)}</span>
        <span class="result-meta">${escapeHtml([poi.city, poi.address].filter(Boolean).join(" · "))}</span>
      </span>
      <span class="text-button">添加</span>
    `;
    button.addEventListener("click", () => onPick(poi));
    dom.searchResults.appendChild(button);
  });
}
