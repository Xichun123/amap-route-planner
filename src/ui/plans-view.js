import { dom } from "../dom.js";
import { listPlans } from "../plans.js";
import { escapeHtml } from "../utils/format.js";
import { ICONS } from "./icons.js";

export function refreshPlanCount() {
  const count = listPlans().length;
  dom.planCount.textContent = String(count);
  dom.loadPlanButton.setAttribute("aria-label", `方案库，已保存 ${count} 个方案`);
}

function formatSavedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const MODE_LABEL = {
  auto: "自动",
  driving: "驾车",
  walking: "步行",
  riding: "骑行",
  transfer: "公交",
};

export function renderPlanList() {
  const plans = listPlans();
  dom.planList.innerHTML = "";
  if (!plans.length) {
    dom.planList.innerHTML = '<div class="plan-empty">还没有保存过方案</div>';
    return;
  }
  plans.forEach((plan) => {
    const stopCount = plan.stops.length;
    const originName = plan.originStopId
      ? plan.stops.find((s) => s.id === plan.originStopId)?.name || ""
      : "";
    const modeLabel = MODE_LABEL[plan.routeMode] || "自动";
    const orderLabel = plan.manualOrder ? "列表顺序" : "自动优化";
    const metaBits = [
      `${stopCount} 个地点`,
      originName ? `起点：${originName}` : "起点：当前位置",
      `${modeLabel} · ${orderLabel}`,
      formatSavedAt(plan.savedAt),
    ].filter(Boolean);

    const row = document.createElement("div");
    row.className = "plan-row";
    row.dataset.planId = plan.id;
    row.innerHTML = `
      <div class="plan-row-main">
        <span class="plan-row-title">${escapeHtml(plan.name)}</span>
        <span class="plan-row-meta">${escapeHtml(metaBits.join(" · "))}</span>
      </div>
      <div class="plan-row-actions">
        <button class="mini-button" type="button" data-action="load" aria-label="加载方案" title="加载方案">${ICONS.download}<span>加载</span></button>
        <button class="mini-button danger" type="button" data-action="delete" aria-label="删除方案" title="删除方案">${ICONS.trash}</button>
      </div>
    `;
    dom.planList.appendChild(row);
  });
}

export function openSavePlanDialog(defaultName) {
  dom.savePlanName.value = defaultName || "";
  dom.savePlanMessage.textContent = "";
  dom.savePlanMessage.classList.remove("error");
  if (typeof dom.savePlanDialog.showModal === "function") {
    dom.savePlanDialog.showModal();
  } else {
    dom.savePlanDialog.setAttribute("open", "");
  }
  setTimeout(() => dom.savePlanName.focus(), 0);
}

export function closeSavePlanDialog() {
  if (dom.savePlanDialog.open) dom.savePlanDialog.close();
}

export function setSavePlanMessage(message, isError = false) {
  dom.savePlanMessage.textContent = message || "";
  dom.savePlanMessage.classList.toggle("error", Boolean(isError));
}

export function openPlanListDialog() {
  renderPlanList();
  if (typeof dom.planListDialog.showModal === "function") {
    dom.planListDialog.showModal();
  } else {
    dom.planListDialog.setAttribute("open", "");
  }
}

export function closePlanListDialog() {
  if (dom.planListDialog.open) dom.planListDialog.close();
}
