// Small SVG charts drawn to scale: the magnitude–time diagram for aftershocks
// and the depth profile. Colors come from CSS classes so both themes work.
import { quakeColor } from "./map.js";

const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs, parent, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

/** 1, 2 or 5 × 10^n, the smallest at least `raw`. */
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  for (const f of [1, 2, 5, 10]) if (f * p >= raw) return f * p;
  return 10 * p;
}

/**
 * Magnitude–time diagram: one stem per earthquake at its time since the mainshock,
 * height = magnitude, plus the running count of aftershocks (right axis).
 * `labelFor(e)` gives the hover text for each stem.
 */
export function mtChart({ main, list, labelFor, cumLabel }) {
  const W = 340, H = 150, m = { l: 30, r: 40, t: 12, b: 20 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const spanH = Math.max((Date.now() - main.time) / 3600e3, 1);
  const days = spanH > 72;
  const unit = days ? 24 : 1, xMax = spanH / unit;
  const mags = [main, ...list].map((e) => +e.mag).filter((v) => isFinite(v) && v > 0);
  let yMin = Math.floor(Math.min(...mags, 9)), yMax = Math.ceil(Math.max(...mags, 0));
  if (yMax - yMin < 2) yMin = Math.max(0, yMax - 2);
  const x = (tm) => m.l + Math.min(1, ((tm - main.time) / 3600e3 / unit) / xMax) * pw;
  const y = (mag) => m.t + ph - ((mag - yMin) / (yMax - yMin)) * ph;

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
  // magnitude gridlines
  for (let v = yMin; v <= yMax; v++) {
    s("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "grid" }, svg);
    s("text", { x: m.l - 4, y: y(v) + 3, "text-anchor": "end" }, svg, "M" + v);
  }
  // time ticks
  const step = niceStep(xMax / 5);
  for (let v = 0; v <= xMax + 1e-9; v += step) {
    const px = m.l + (v / xMax) * pw;
    s("line", { x1: px, x2: px, y1: m.t + ph, y2: m.t + ph + 3, class: "axis" }, svg);
    s("text", { x: px, y: H - 5, "text-anchor": "middle" }, svg, String(+v.toFixed(1)));
  }
  s("line", { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, class: "axis" }, svg);

  // running count of aftershocks
  if (list.length) {
    const n = list.length;
    const yc = (k) => m.t + ph - (k / n) * ph;
    let d = `M${m.l},${yc(0)}`;
    list.forEach((e, i) => { d += ` H${x(e.time)} V${yc(i + 1)}`; });
    d += ` H${W - m.r}`;
    s("path", { d, class: "cum" }, svg);
    s("text", { x: W - m.r + 4, y: yc(n) + 3, class: "cum-label" }, svg, cumLabel(n));
  }

  // stems: aftershocks first, mainshock on top
  for (const e of list) {
    const v = +e.mag;
    if (!isFinite(v) || v <= 0) continue;
    const g = s("g", {}, svg);
    s("title", {}, g, labelFor(e));
    s("line", { x1: x(e.time), x2: x(e.time), y1: m.t + ph, y2: y(v), class: "stem" }, g);
    s("circle", { cx: x(e.time), cy: y(v), r: 2.6, fill: quakeColor(e), class: "dot" }, g);
  }
  if (isFinite(+main.mag) && +main.mag > 0) {
    const g = s("g", {}, svg);
    s("title", {}, g, labelFor(main));
    s("line", { x1: m.l, x2: m.l, y1: m.t + ph, y2: y(+main.mag), class: "stem main" }, g);
    s("circle", { cx: m.l, cy: y(+main.mag), r: 4.5, class: "dot main" }, g);
  }
  return { svg, days };
}

/**
 * Depth profile: distance along A→B against depth, circles sized by magnitude.
 * Returns the SVG and how much depth is stretched relative to distance.
 */
export function profileChart({ lengthKm, points, labelFor }) {
  const W = 340, H = 250, m = { l: 40, r: 12, t: 16, b: 22 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const deepest = Math.max(0, ...points.map((p) => p.depth));
  const dMax = Math.max(100, Math.ceil(deepest / 100) * 100);
  const x = (v) => m.l + (v / lengthKm) * pw;
  const y = (d) => m.t + (d / dMax) * ph;

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img" });
  const dStep = dMax <= 200 ? 50 : 100;
  for (let d = 0; d <= dMax; d += dStep) {
    s("line", { x1: m.l, x2: W - m.r, y1: y(d), y2: y(d), class: d === 0 ? "axis" : "grid" }, svg);
    s("text", { x: m.l - 4, y: y(d) + 3, "text-anchor": "end" }, svg, String(d));
  }
  const xStep = niceStep(lengthKm / 5);
  for (let v = 0; v <= lengthKm + 1e-9; v += xStep) {
    s("line", { x1: x(v), x2: x(v), y1: m.t, y2: m.t + ph, class: "grid" }, svg);
    s("text", { x: x(v), y: H - 6, "text-anchor": "middle" }, svg, String(v));
  }
  s("text", { x: m.l, y: m.t - 5, class: "end-label" }, svg, "A");
  s("text", { x: W - m.r, y: m.t - 5, "text-anchor": "end", class: "end-label" }, svg, "B");

  // small first so large events stay visible
  for (const p of [...points].sort((a, b) => (+a.e.mag || 0) - (+b.e.mag || 0))) {
    const mag = +p.e.mag || 2;
    const g = s("g", {}, svg);
    s("title", {}, g, labelFor(p));
    s("circle", { cx: x(p.along), cy: y(p.depth), r: 1.6 + Math.max(0, mag - 2) * 0.9, fill: quakeColor(p.e), class: "dot" }, g);
  }
  const stretch = (ph / dMax) / (pw / lengthKm);
  return { svg, stretch };
}
