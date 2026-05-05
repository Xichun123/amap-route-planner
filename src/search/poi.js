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
  const trigger = () => {
    const keyword = input.value.trim();
    const city = cityInput.value.trim();
    if (!keyword) {
      onSelect([]);
      return;
    }
    if (keyword === lastQuery) return;
    lastQuery = keyword;
    searchPois(keyword, city, onSelect);
  };
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(trigger, 220);
  });
  cityInput.addEventListener("change", () => {
    lastQuery = "";
    trigger();
  });
}
