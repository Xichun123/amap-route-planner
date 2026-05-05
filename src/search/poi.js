import { state } from "../state.js";
import { dom } from "../dom.js";
import { lngLatToArray, isValidPoint } from "../utils/geo.js";
import { setStatus } from "../ui/status.js";

const PAGE_SIZE = 10; // 高德 PlaceSearch 上限是 25，我们一页 10 条便于触底加载

function placeToPoi(p, fallbackCity) {
  const position = p && p.location ? lngLatToArray(p.location) : null;
  if (!position || !isValidPoint(position)) return null;
  const name = String(p.name || "未命名地点");
  const address = String(p.address || "");
  const city = String(p.cityname || p.pname || fallbackCity || "");
  return {
    id: p.id || `${name}-${position.join(",")}`,
    name,
    address,
    city,
    position,
  };
}

/**
 * 真正的搜索调用。统一走 PlaceSearch（支持分页）。
 * @param {string} keyword
 * @param {string} city
 * @param {number} page  从 1 开始
 * @param {(pois: any[], meta: { total: number, page: number, pageSize: number }) => void} onResult
 */
function searchPage(keyword, city, page, onResult) {
  if (!state.placeSearch) {
    setStatus("地图还没有加载");
    onResult([], { total: 0, page, pageSize: PAGE_SIZE });
    return;
  }
  state.placeSearch.setCity(city || "");
  state.placeSearch.setPageSize(PAGE_SIZE);
  state.placeSearch.setPageIndex(page);
  state.placeSearch.search(keyword, (status, result) => {
    if (status !== "complete" || !result || !result.poiList) {
      if (status === "no_data") {
        if (page === 1) setStatus("没有找到匹配地点");
        onResult([], { total: 0, page, pageSize: PAGE_SIZE });
        return;
      }
      onResult([], { total: 0, page, pageSize: PAGE_SIZE });
      if (page === 1) setStatus("搜索失败，请重试");
      return;
    }
    const total = Number(result.poiList.count) || 0;
    const pois = (result.poiList.pois || [])
      .map((p) => placeToPoi(p, city))
      .filter(Boolean);
    onResult(pois, { total, page, pageSize: PAGE_SIZE });
    if (page === 1) {
      if (!pois.length) setStatus("没有找到匹配地点");
      else setStatus(`找到 ${total || pois.length} 个地点`);
    }
  });
}

/**
 * 首屏搜索：重置分页状态，触发第一页查询。
 * onPage 同时承担"列表/标记"渲染。
 */
export function searchPois(keyword, city, onPage) {
  const trimmed = String(keyword || "").trim();
  if (!trimmed) {
    onPage([], { total: 0, page: 1, pageSize: PAGE_SIZE, append: false, loading: false, hasMore: false });
    return;
  }
  state.searchPagination = {
    keyword: trimmed,
    city: city || "",
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    loaded: 0,
    loading: true,
    hasMore: false,
  };
  searchPage(trimmed, city, 1, (pois, meta) => {
    state.searchPagination.total = meta.total;
    state.searchPagination.loaded = pois.length;
    state.searchPagination.loading = false;
    state.searchPagination.hasMore = pois.length > 0 && state.searchPagination.loaded < meta.total;
    onPage(pois, {
      ...meta,
      append: false,
      loading: false,
      hasMore: state.searchPagination.hasMore,
      loaded: state.searchPagination.loaded,
    });
  });
}

/**
 * 滚动到底加载下一页。pois 通过 onPage 追加渲染。
 */
export function loadMorePois(onPage) {
  const sp = state.searchPagination;
  if (!sp || sp.loading || !sp.hasMore || !sp.keyword) return false;
  sp.loading = true;
  // 通知 UI：本次为"加载中"
  onPage([], {
    total: sp.total,
    page: sp.page + 1,
    pageSize: sp.pageSize,
    append: true,
    loading: true,
    hasMore: sp.hasMore,
    loaded: sp.loaded,
  });
  searchPage(sp.keyword, sp.city, sp.page + 1, (pois, meta) => {
    sp.page = meta.page;
    sp.loaded += pois.length;
    sp.loading = false;
    sp.hasMore = pois.length > 0 && sp.loaded < sp.total;
    onPage(pois, {
      ...meta,
      append: true,
      loading: false,
      hasMore: sp.hasMore,
      loaded: sp.loaded,
    });
  });
  return true;
}

export function ensureSearchInstances(AMap) {
  if (!state.autoComplete) {
    state.autoComplete = new AMap.AutoComplete({ city: "" });
  }
  if (!state.placeSearch) {
    state.placeSearch = new AMap.PlaceSearch({
      pageSize: PAGE_SIZE,
      pageIndex: 1,
      extensions: "base", // 比 "all" 快很多
    });
  }
}

export function bindAutocompleteInput(input, cityInput, onPage) {
  let timer = 0;
  let lastQuery = "";
  let composing = false;

  const trigger = () => {
    const keyword = input.value.trim();
    const city = (cityInput.value.trim() || state.currentCity || "").trim();
    if (!keyword) {
      lastQuery = "";
      onPage([], { total: 0, page: 1, pageSize: PAGE_SIZE, append: false, loading: false, hasMore: false });
      return;
    }
    if (keyword === lastQuery) return;
    lastQuery = keyword;
    searchPois(keyword, city, onPage);
  };

  const scheduleTrigger = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(trigger, 380);
  };

  input.addEventListener("compositionstart", () => {
    composing = true;
    window.clearTimeout(timer);
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    window.clearTimeout(timer);
    trigger();
  });
  input.addEventListener("input", (event) => {
    if (composing || event.isComposing) return;
    scheduleTrigger();
  });
  cityInput.addEventListener("change", () => {
    lastQuery = "";
    trigger();
  });
}
