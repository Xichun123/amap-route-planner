import { dom } from "../dom.js";
import { saveSheetCollapsed } from "../storage.js";

export function applySheetCollapsed(collapsed) {
  dom.appShell.classList.toggle("sheet-collapsed", collapsed);
  const label = collapsed ? "展开路线面板" : "收起路线面板";
  dom.sheetGripButton.setAttribute("aria-label", `${label}手柄`);
  dom.sheetGripButton.setAttribute("aria-expanded", String(!collapsed));
  dom.sheetCollapseButton.setAttribute("aria-label", label);
  dom.sheetCollapseButton.setAttribute("aria-expanded", String(!collapsed));
}

export function toggleSheet() {
  const collapsed = !dom.appShell.classList.contains("sheet-collapsed");
  applySheetCollapsed(collapsed);
  saveSheetCollapsed(collapsed);
}
