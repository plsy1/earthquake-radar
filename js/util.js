// Small helpers for formatting and geometry.
import { ORDER } from "./config.js";

export const $ = (id) => document.getElementById(id);

/** Position of an intensity class in ORDER; -1 when unknown. */
export const rank = (maxi) => ORDER.indexOf(maxi || "");

export const fmtTime = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
export const fmtClock = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Great-circle distance in km between two {lat, lon} points. */
export function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ago(date) {
  const m = Math.round((Date.now() - date) / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return m + "分钟前";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "小时前";
  return Math.floor(h / 24) + "天前";
}

export const depthText = (d) => (d == null ? "深度不明" : d === 0 ? "极浅" : `深${d}km`);
export const magText = (m) => (m && !isNaN(+m) ? "M" + (+m).toFixed(1) : "M不明");
