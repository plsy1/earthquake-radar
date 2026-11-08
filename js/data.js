// Reads JMA's earthquake list and turns it into one record per earthquake.
import { SRC } from "./config.js";
import { rank } from "./util.js";

/** "+34.9+137.7-40000/" -> {lat, lon, depth(km)}; null for other formats. */
export function parseCod(cod) {
  const m = /^([+-]\d{1,2}\.\d+)([+-]\d{2,3}\.\d+)([+-]\d+)?\/?$/.exec(cod || "");
  if (!m) return null;
  return { lat: +m[1], lon: +m[2], depth: m[3] == null ? null : Math.abs(+m[3]) / 1000 };
}

/** Event id "20261108010441" is the origin time in JST. */
export function eidDate(eid) {
  const s = String(eid);
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+09:00`);
}

/**
 * JMA publishes several reports per earthquake (intensity flash, hypocenter, combined).
 * Merge them by event id, keep the strongest intensity, and drop distant earthquakes.
 * The list is newest report first, so the first located report wins.
 */
export function toEvents(reports) {
  const byId = new Map();
  for (const r of reports) {
    if (!r || !r.eid || (r.ttl || "").includes("遠地")) continue;
    let g = byId.get(r.eid);
    if (!g) {
      g = { eid: r.eid, time: eidDate(r.eid), maxi: "", mag: "", anm: "", loc: null, dist: 0 };
      byId.set(r.eid, g);
    }
    if (rank(r.maxi) > rank(g.maxi)) g.maxi = r.maxi;
    const loc = parseCod(r.cod);
    if (loc && !g.loc) { g.loc = loc; g.mag = r.mag; g.anm = r.anm; }
    if (!g.anm && r.anm) g.anm = r.anm;
  }
  return [...byId.values()]
    .filter((g) => g.loc && g.loc.lat > 20 && g.loc.lat < 50 && g.loc.lon > 120 && g.loc.lon < 156)
    .sort((a, b) => b.time - a.time);
}

export async function fetchEvents() {
  const res = await fetch(SRC + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return toEvents(await res.json());
}
