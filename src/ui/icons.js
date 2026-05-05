// 内联 SVG 图标库 — 24×24 viewBox，1.8 描边，currentColor 上色
// 风格参考 SF Symbols：圆头线条、几何克制
const SW = 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"';

export const ICONS = {
  search: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  reload: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronUp: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4 2.5 4H5"/></svg>`,
  star: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="m12 3 2.85 6.18 6.65.81-5 4.51 1.45 6.5L12 17.77 6.05 21l1.45-6.5-5-4.51 6.65-.81L12 3Z"/></svg>`,
  starFilled: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" aria-hidden="true"><path d="m12 3 2.85 6.18 6.65.81-5 4.51 1.45 6.5L12 17.77 6.05 21l1.45-6.5-5-4.51 6.65-.81L12 3Z"/></svg>`,
  xmark: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4Z"/></svg>`,
  list: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  navigate: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8-8-2Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M4 7h16M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M12 19V5"/><polyline points="6 11 12 5 18 11"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M12 5v14"/><polyline points="6 13 12 19 18 13"/></svg>`,
  route: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 4-4V9"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M5 12h14"/><polyline points="13 6 19 12 13 18"/></svg>`,
  download: `<svg viewBox="0 0 24 24" ${SW} aria-hidden="true"><path d="M12 4v12"/><polyline points="6 12 12 18 18 12"/><path d="M5 21h14"/></svg>`,
};

export function icon(name) {
  return ICONS[name] || "";
}
