// Small language-independent helpers. Text formatting lives in i18n.js.
import { ORDER } from "./config.js";

export const $ = (id) => document.getElementById(id);

/** Position of an intensity class in ORDER; -1 when unknown. */
export const rank = (maxi) => ORDER.indexOf(maxi || "");

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
