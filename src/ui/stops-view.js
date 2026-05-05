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

function buildToolbar(meta) {
  const toolbar = document.createElement("div");
  toolbar.className = "search-results-toolbar";
  const total = meta.total || meta.loaded || 0;
  const loaded = meta.loaded || 0;
  const countText = total > loaded
    ? `${loaded} / ${total} 个候选 · 滑到底加载更多`
    : `${total || loaded} 个候选 · 点击地图标记可直接添加`;
  toolbar.innerHTML = `
    <span class="search-results-count">${escapeHtml(countText)}</span>
    <button class="search-results-close" type="button" data-action="close-search-results" aria-label="收起搜索列表">${ICONS.chevronDown}</button>
  `;
  return toolbar;
}

function buildResultButton(poi, onPick) {
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
  return button;
}

function buildSentinel(meta) {
  const sentinel = document.createElement("div");
  sentinel.className = "search-results-sentinel";
  sentinel.dataset.role = "sentinel";
  if (meta.loading) {
    sentinel.innerHTML = '<span class="search-spinner" aria-hidden="true"></span><span>加载中…</span>';
  } else if (meta.hasMore) {
    sentinel.textContent = "继续滚动加载更多";
  } else {
    sentinel.textContent = "—— 没有更多了 ——";
    sentinel.classList.add("end");
  }
  return sentinel;
}

function refreshToolbarOnly(meta) {
  const tb = dom.searchResults.querySelector(".search-results-toolbar .search-results-count");
  if (!tb) return;
  const total = meta.total || meta.loaded || 0;
  const loaded = meta.loaded || 0;
  tb.textContent = total > loaded
    ? `${loaded} / ${total} 个候选 · 滑到底加载更多`
    : `${total || loaded} 个候选 · 点击地图标记可直接添加`;
}

function refreshSentinel(meta) {
  const old = dom.searchResults.querySelector('[data-role="sentinel"]');
  if (old) old.remove();
  if (meta.loaded > 0 || meta.loading) {
    dom.searchResults.appendChild(buildSentinel(meta));
  }
}

/**
 * 渲染搜索结果列表。
 * meta.append=false: 重置整个列表（首屏）
 * meta.append=true:  在现有结果后追加（加载下一页）
 */
export function renderSearchResults(pois, onPick, meta = {}) {
  // 首屏（非 append）— 重置整个列表
  if (!meta.append) {
    dom.searchResults.innerHTML = "";
    dom.searchResults.hidden = pois.length === 0;
    if (!pois.length) return;
    dom.searchResults.appendChild(buildToolbar(meta));
    pois.forEach((poi) => dom.searchResults.appendChild(buildResultButton(poi, onPick)));
    refreshSentinel(meta);
    return;
  }

  // append 路径
  if (meta.loading && pois.length === 0) {
    // 仅切换底部 sentinel 到"加载中"
    refreshSentinel(meta);
    return;
  }
  // 把新结果插到 sentinel 之前
  const sentinel = dom.searchResults.querySelector('[data-role="sentinel"]');
  pois.forEach((poi) => {
    const node = buildResultButton(poi, onPick);
    if (sentinel) dom.searchResults.insertBefore(node, sentinel);
    else dom.searchResults.appendChild(node);
  });
  refreshToolbarOnly(meta);
  refreshSentinel(meta);
}
