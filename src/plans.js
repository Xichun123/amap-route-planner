const PLANS_KEY = "amap-route-planner-plans";

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLANS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((plan) => plan && Array.isArray(plan.stops));
  } catch {
    return [];
  }
}

function writeAll(plans) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

function nowIso() {
  return new Date().toISOString();
}

function genId() {
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function listPlans() {
  return readAll().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

export function getPlan(planId) {
  return readAll().find((plan) => plan.id === planId) || null;
}

export function savePlan({ name, stops, originStopId, routeMode, manualOrder, replaceId }) {
  const plans = readAll();
  const clean = {
    id: replaceId || genId(),
    name: String(name || "").trim() || "未命名方案",
    savedAt: nowIso(),
    stops: stops.map(({ id, sourceId, name: stopName, address, city, position, priority }) => ({
      id,
      sourceId: sourceId || "",
      name: stopName || "未命名地点",
      address: address || "",
      city: city || "",
      position: [Number(position[0]), Number(position[1])],
      priority: Boolean(priority),
    })),
    originStopId: originStopId || "",
    routeMode: routeMode || "auto",
    manualOrder: Boolean(manualOrder),
  };
  const existingIndex = replaceId ? plans.findIndex((plan) => plan.id === replaceId) : -1;
  if (existingIndex >= 0) plans[existingIndex] = clean;
  else plans.push(clean);
  writeAll(plans);
  return clean;
}

export function deletePlan(planId) {
  const plans = readAll().filter((plan) => plan.id !== planId);
  writeAll(plans);
}

export function findPlanByName(name) {
  const key = String(name || "").trim();
  if (!key) return null;
  return readAll().find((plan) => plan.name === key) || null;
}
