// Alerts that matter right now: Nankai Trough special information and tsunami
// warnings, advisories and forecasts, all from JMA.
import { NANKAI_FEED, TSUNAMI_AREAS, TSUNAMI_BASE, TSUNAMI_LIST } from "./config.js";

// ---- Nankai Trough earthquake information (from JMA's XML Atom feed) ----
// The long feed covers roughly the last week. Notices are matched by title.

/** Nankai notice states, most serious first; `key` matches strings in i18n.js. */
const NANKAI_STATES = [
  { word: "巨大地震警戒", key: "nkWarning", level: "red" },
  { word: "巨大地震注意", key: "nkAdvisory", level: "amber" },
  { word: "調査中", key: "nkInvestigating", level: "amber" },
  { word: "調査終了", key: "nkEnded", level: "calm" },
];

/**
 * Latest Nankai Trough notices in the feed. Resolves to
 * { latest: {state, title, text, time, url} | null, explain: {...} | null, sinceDays }.
 */
export async function fetchNankai() {
  const res = await fetch(NANKAI_FEED + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
  const entries = [...xml.getElementsByTagName("entry")].map((en) => ({
    title: en.getElementsByTagName("title")[0]?.textContent || "",
    text: en.getElementsByTagName("content")[0]?.textContent || "",
    time: new Date(en.getElementsByTagName("updated")[0]?.textContent || 0),
    url: en.getElementsByTagName("link")[0]?.getAttribute("href") || "",
  }));
  const oldest = entries.reduce((m, e) => (e.time < m ? e.time : m), new Date());
  const sinceDays = Math.max(1, Math.round((Date.now() - oldest) / 86400e3));
  const nankai = entries.filter((e) => e.title.includes("南海トラフ")).sort((a, b) => b.time - a.time);
  const special = nankai.find((e) => e.title.includes("臨時情報"));
  const explain = nankai.find((e) => e.title.includes("解説情報")) || null;
  let latest = null;
  if (special) {
    const s = NANKAI_STATES.find((st) => (special.title + special.text).includes(st.word));
    latest = { ...special, state: s ? s.key : "nkIssued", level: s ? s.level : "amber" };
  }
  return { latest, explain, sinceDays };
}

// ---- tsunami ----

/** JMA tsunami categories by name, most serious first, with JMA's colors. */
const TSUNAMI_KINDS = [
  { match: (n) => n.includes("大津波警報") && !n.includes("解除"), key: "tsMajor", color: "#c800ff", rank: 4 },
  { match: (n) => n.includes("津波警報") && !n.includes("解除"), key: "tsWarning", color: "#ff2800", rank: 3 },
  { match: (n) => n.includes("津波注意報") && !n.includes("解除"), key: "tsAdvisory", color: "#faf500", rank: 2 },
  { match: (n) => n.includes("津波予報"), key: "tsForecast", color: "#38a6e0", rank: 1 },
];
export const tsunamiKind = (name) => TSUNAMI_KINDS.find((k) => k.match(name || "")) || { key: "tsNone", color: "#9aa5b1", rank: 0 };

/** A warning or advisory stays "current" for a day unless lifted; a slight-change forecast for 6 hours. */
function isCurrent(report) {
  const age = Date.now() - report.time;
  return report.rank >= 2 ? age < 24 * 3600e3 : report.rank === 1 && age < 6 * 3600e3;
}

/** Tsunami reports of the last ~30 days, newest first, one per earthquake. */
export async function fetchTsunamiList() {
  const res = await fetch(TSUNAMI_LIST + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const seen = new Set(), out = [];
  for (const r of await res.json()) {
    if (!r || !r.eid || seen.has(r.eid)) continue; // newest report per earthquake
    seen.add(r.eid);
    const kinds = (r.kind || []).map((k) => tsunamiKind(k.kind));
    const rank = Math.max(0, ...kinds.map((k) => k.rank));
    out.push({
      eid: r.eid, file: r.json, time: new Date(r.rdt), origin: new Date(r.at),
      anm: r.anm || "", anmEn: r.en_anm || "", mag: r.mag || "", cancelled: r.ift === "取消",
      areas: (r.kind || []).length, rank,
    });
  }
  out.sort((a, b) => b.time - a.time);
  for (const r of out) r.current = !r.cancelled && isCurrent(r);
  return out;
}

const tsCache = new Map();

/** Areas of one tsunami report with their category, expected height and first arrival. */
export function fetchTsunamiDetail(file) {
  if (!tsCache.has(file)) {
    const p = fetch(TSUNAMI_BASE + file, { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((d) => {
        const items = d?.Body?.Tsunami?.Forecast?.Item || [];
        const areas = items.map((it) => {
          const kind = tsunamiKind(it.Category?.Kind?.Name);
          return {
            code: it.Area?.Code || "", name: it.Area?.Name || "", nameEn: it.Area?.enName || "",
            kindName: it.Category?.Kind?.Name || "", ...kind,
            height: it.MaxHeight?.TsunamiHeight || it.MaxHeight?.Condition || "",
            arrival: it.FirstHeight?.ArrivalTime ? new Date(it.FirstHeight.ArrivalTime) : null,
            arrivalNote: it.FirstHeight?.Condition || "",
          };
        }).sort((a, b) => b.rank - a.rank);
        const c = d?.Body?.Comments?.WarningComment || {};
        return { areas, comment: c.Text || "", commentEn: (c.enText || "").trim() };
      });
    p.catch(() => tsCache.delete(file));
    tsCache.set(file, p);
  }
  return tsCache.get(file);
}

let areaShapes = null;
/** Coastline segments of JMA's tsunami forecast areas, keyed by area code (loaded once). */
export function fetchTsunamiAreas() {
  if (!areaShapes) {
    areaShapes = fetch(TSUNAMI_AREAS)
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .catch((err) => { areaShapes = null; throw err; });
  }
  return areaShapes;
}
