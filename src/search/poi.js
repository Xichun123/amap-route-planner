import { state } from "../state.js";
import { dom } from "../dom.js";
import { lngLatToArray, isValidPoint } from "../utils/geo.js";
import { setStatus } from "../ui/status.js";

function tipToPoi(tip, fallbackCity) {
  const position = tip.location ? lngLatToArray(tip.location) : null;
  if (!position || !isValidPoint(position)) return null;
  const name = String(tip.name || "未命名地点");
  const district = String(tip.district || "");
  return {
    id: tip.id || `${name}-${position.join(",")}`,
    name,
    address: district,
    city: extractCity(district) || fallbackCity || "",
    position,
  };
}

function extractCity(district) {
  if (!district) return "";
  const match = String(district).match(/^([^省]+省)?([^市]+市)/);
  return match ? match[2] : "";
}

export function searchPois(keyword, city, onResult) {
  if (!state.autoComplete) {
    setStatus("地图还没有加载");
    return;
  }
  const trimmed = String(keyword || "").trim();
  if (!trimmed) {
    onResult([]);
    return;
  }
  state.autoComplete.setCity(city || "");
  state.autoComplete.search(trimmed, (status, result) => {
    if (status !== "complete" || !result || !Array.isArray(result.tips)) {
      if (status === "no_data") {
        onResult([]);
        setStatus("没有找到匹配地点");
        return;
      }
      onResult([]);
      setStatus("搜索失败，请重试");
      return;
    }
    const pois = result.tips
      .map((tip) => tipToPoi(tip, city))
      .filter(Boolean);
    onResult(pois);
    if (!pois.length) setStatus("没有找到匹配地点");
    else setStatus(`找到 ${pois.length} 个地点`);
  });
}

export function ensureSearchInstances(AMap) {
  if (!state.autoComplete) {
    state.autoComplete = new AMap.AutoComplete({ city: "" });
  }
  if (!state.placeSearch) {
    state.placeSearch = new AMap.PlaceSearch({
      pageSize: 10,
      pageIndex: 1,
      extensions: "all",
    });
  }
}

export function bindAutocompleteInput(input, cityInput, onSelect) {
  let timer = 0;
  let lastQuery = "";
  let composing = false; // IME 中文拼音组合期标记

  const trigger = () => {
    const keyword = input.value.trim();
    // 用户填的城市优先；没填则用定位拿到的城市做偏置，避免远距离结果
    const city = (cityInput.value.trim() || state.currentCity || "").trim();
    if (!keyword) {
      lastQuery = "";
      onSelect([]);
      return;
    }
    if (keyword === lastQuery) return;
    lastQuery = keyword;
    searchPois(keyword, city, onSelect);
  };

  const scheduleTrigger = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(trigger, 380);
  };

  // 关键：组合期不触发搜索，避免拼音逐字母触发"haidi…"这种垃圾搜索
  input.addEventListener("compositionstart", () => {
    composing = true;
    window.clearTimeout(timer);
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    // 组合结束（已成词）立即触发，无需再等 debounce
    window.clearTimeout(timer);
    trigger();
  });

  input.addEventListener("input", (event) => {
    // Safari 上 compositionend 之后还会再发一个 input 事件，
    // 用 isComposing 兜底；同时显式忽略组合期间的 input
    if (composing || event.isComposing) return;
    scheduleTrigger();
  });

  cityInput.addEventListener("change", () => {
    lastQuery = "";
    trigger();
  });
}
