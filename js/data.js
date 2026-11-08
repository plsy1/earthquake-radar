// Reads JMA's earthquake list and turns it into one record per earthquake.
import { DETAIL_BASE, LP_BASE, LP_LIST, SRC } from "./config.js";
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
      g = { source: "jma", eid: r.eid, time: eidDate(r.eid), maxi: "", mag: "", anm: "", anmEn: "", loc: null, dist: 0, detail: "" };
      byId.set(r.eid, g);
    }
    if (rank(r.maxi) > rank(g.maxi)) g.maxi = r.maxi;
    const loc = parseCod(r.cod);
    if (loc && !g.loc) { g.loc = loc; g.mag = r.mag; g.anm = r.anm; g.anmEn = r.en_anm || ""; }
    if (!g.anm && r.anm) { g.anm = r.anm; g.anmEn = r.en_anm || ""; }
    // The newest "hypocenter and intensity" report carries every station's reading.
    if (!g.detail && r.ttl === "震源・震度情報" && r.json) g.detail = r.json;
  }
  return [...byId.values()]
    .filter((g) => g.loc && g.loc.lat > 20 && g.loc.lat < 50 && g.loc.lon > 120 && g.loc.lon < 156)
    .sort((a, b) => b.time - a.time);
}

export async function fetchEvents() {
  const [res, lp] = await Promise.all([
    fetch(SRC + "?t=" + Date.now(), { cache: "no-store" }),
    fetchLongPeriodList().catch(() => new Map()), // optional: the list still works without it
  ]);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const events = toEvents(await res.json());
  for (const e of events) {
    const l = lp.get(e.eid);
    if (l) { e.lg = l.maxl; e.lgFile = l.file; }
  }
  return events;
}

/**
 * Long-period ground motion list: event id -> highest class and report file.
 * JMA lists only earthquakes that reached class 1 or more; the newest report wins.
 */
async function fetchLongPeriodList() {
  const res = await fetch(LP_LIST + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const byId = new Map();
  for (const r of await res.json()) {
    if (r && r.eid && r.maxl && !byId.has(r.eid)) byId.set(r.eid, { maxl: String(r.maxl), file: r.json });
  }
  return byId;
}

const lpCache = new Map();

/** Stations that reached long-period class 1+, with their Sva (cm/s) and intensity. */
export function fetchLongPeriodDetail(file) {
  if (!lpCache.has(file)) {
    const p = fetch(LP_BASE + file, { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((d) => {
        const obs = d?.Body?.Intensity?.Observation;
        const stations = [];
        for (const pref of obs?.Pref || []) {
          for (const area of pref.Area || []) {
            for (const st of area.IntensityStation || []) {
              if (!st.latlon || !st.LgInt) continue;
              stations.push({
                name: st.Name, nameEn: st.enName || "", pref: pref.Name, prefEn: pref.enName || "",
                lg: String(st.LgInt), int: st.Int || "", sva: st.Sva ? +st.Sva : null,
                lat: +st.latlon.lat, lon: +st.latlon.lon,
              });
            }
          }
        }
        stations.sort((a, b) => b.lg.localeCompare(a.lg) || (b.sva || 0) - (a.sva || 0));
        return { maxLg: String(obs?.MaxLgInt || ""), stations };
      });
    p.catch(() => lpCache.delete(file));
    lpCache.set(file, p);
  }
  return lpCache.get(file);
}

/** Station readings, city summary and comments (Japanese and English) from one detail report. */
export function parseDetail(d) {
  const obs = d?.Body?.Intensity?.Observation;
  const stations = [], cities = [];
  for (const pref of obs?.Pref || []) {
    for (const area of pref.Area || []) {
      for (const city of area.City || []) {
        if (rank(city.MaxInt) >= 0) {
          cities.push({ pref: pref.Name, prefEn: pref.enName || "", name: city.Name, nameEn: city.enName || "", int: city.MaxInt });
        }
        for (const st of city.IntensityStation || []) {
          if (st.latlon && rank(st.Int) >= 0) {
            stations.push({ name: st.Name, nameEn: st.enName || "", int: st.Int, lat: +st.latlon.lat, lon: +st.latlon.lon });
          }
        }
      }
    }
  }
  const c = d?.Body?.Comments || {};
  const comment = [c.ForecastComment?.Text, c.FreeFormComment].filter(Boolean).join("\n");
  const commentEn = (c.ForecastComment?.enText || "").trim();
  return { stations, cities, comment, commentEn, maxInt: obs?.MaxInt || "" };
}

const detailCache = new Map();

/** Fetch and parse a detail file once; failed fetches are retried next time. */
export function fetchDetail(file) {
  if (!detailCache.has(file)) {
    const p = fetch(DETAIL_BASE + file, { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(parseDetail);
    p.catch(() => detailCache.delete(file));
    detailCache.set(file, p);
  }
  return detailCache.get(file);
}
