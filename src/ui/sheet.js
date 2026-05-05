import { dom } from "../dom.js";
import { saveSheetPosition } from "../storage.js";

// peek = 仅 header / mid = 默认 / full = 几乎全屏
const POSITIONS = ["peek", "mid", "full"];

const LABELS = {
  peek: { sheet: "展开路线面板", grip: "展开路线面板" },
  mid: { sheet: "收起到顶端", grip: "扩展到全屏" },
  full: { sheet: "缩回半屏", grip: "缩回半屏" },
};

// 从 DOM 读取当前状态，避免模块缓存 / 双重加载导致的状态不同步
function readCurrent() {
  const cls = dom.appShell.classList;
  if (cls.contains("sheet-peek")) return "peek";
  if (cls.contains("sheet-full")) return "full";
  return "mid";
}

export function applySheetPosition(position) {
  if (!POSITIONS.includes(position)) position = "mid";

  dom.appShell.classList.toggle("sheet-peek", position === "peek");
  dom.appShell.classList.toggle("sheet-full", position === "full");
  // 旧 class 名兼容（若有外部样式 / 测试依赖）
  dom.appShell.classList.toggle("sheet-collapsed", position === "peek");

  const expanded = position !== "peek";
  dom.sheetGripButton.setAttribute("aria-expanded", String(expanded));
  dom.sheetCollapseButton.setAttribute("aria-expanded", String(expanded));
  dom.sheetGripButton.setAttribute("aria-label", LABELS[position].grip);
  dom.sheetCollapseButton.setAttribute("aria-label", LABELS[position].sheet);
}

// Grip：往大尺寸方向循环（peek → mid → full → peek）
export function expandSheet() {
  const next = { peek: "mid", mid: "full", full: "peek" }[readCurrent()];
  applySheetPosition(next);
  saveSheetPosition(next);
}

// Chevron：往小尺寸方向循环；peek 时反向回 mid，避免死锁
export function collapseSheet() {
  const next = { full: "mid", mid: "peek", peek: "mid" }[readCurrent()];
  applySheetPosition(next);
  saveSheetPosition(next);
}

// 兼容旧 API（main.js 引用名仍可用）
export function applySheetCollapsed(collapsed) {
  applySheetPosition(collapsed ? "peek" : "mid");
}

export function toggleSheet() {
  collapseSheet();
}

