// Entry point: holds page state and wires data, map and panel together.
import { REFRESH_MS, USGS_YEAR_REFRESH_MS } from "./config.js";
import { FEATURE_GROUPS, setBasemap, setFeatureVisible } from "./basemap.js";
import { fetchDetail, fetchEvents } from "./data.js";
import { applyStatic, fmtClock, onLangChange, setLang, t } from "./i18n.js";
import { loadHome, locateBrowser, makeHome, saveHome } from "./home.js";
import {
  drawHome, drawQuakes, drawStations, enterDetail, exitDetail, flyToView,
  initMap, onMapClick, refreshMapLanguage, setHeatPoints, setHeatVisible, setHistoricVisible,
  setLegendSource, setNankaiVisible, setPickCursor, setPlatesVisible, setSegmentsVisible,
} from "./map.js";
import {
  applySourceUi, bindSegment, pressSegment, renderDetail, renderList, renderStats, setHomeLabel,
  setHomeNote, setMapSettingsOpen, setPickButton, setStatus, showDetailView, tooltipHtml, updateMapSummary,
} from "./ui.js";
import { USGS_DAYS, fetchUsgs } from "./usgs.js";
import { $, km, rank } from "./util.js";

/** Per-source feed state. JMA is one fixed list; USGS is re-queried when its filters change. */
const feed = () => ({
  events: [],
  query: "",           // what the current events were fetched for (USGS)
  seen: null,          // event ids from the previous load of the same query; null before the first
  fresh: new Set(),    // ids that appeared after the page opened
  sig: "",
  updatedAt: null,     // time of the last successful load
  failed: false,
  loading: false,
});

const state = {
  source: "jma",       // "jma" | "usgs"
  feeds: { jma: feed(), usgs: feed() },
  periodHours: "168",  // "24" | "168" | "all" | "year" (USGS only)
  minRank: 0,          // JMA: minimum intensity rank
  minMag: 2.5,         // USGS: minimum magnitude
  home: loadHome(),    // null until the viewer sets a location
  basemap: "pale",
  nankaiMode: "area",  // "off" | "area" | "segments"
  picking: false,
  selected: null,      // eid of the earthquake shown in the detail panel
};

const cur = () => state.feeds[state.source];
const sourceName = () => t(state.source === "usgs" ? "usgsName" : "jmaName");

function visibleEvents() {
  const { events } = cur();
  if (state.source === "usgs") {
    // The USGS query already covers the period; filter only in case of a stale wider result.
    const cut = Date.now() - USGS_DAYS[state.periodHours] * 86400e3;
    return events.filter((e) => e.time >= cut && (+e.mag || 0) >= state.minMag);
  }
  const hours = state.periodHours === "all" ? 30 * 24 : +state.periodHours;
  const cut = Date.now() - hours * 3600e3;
  return events.filter((e) => e.time >= cut && rank(e.maxi) >= state.minRank);
}

function render() {
  const f = cur();
  for (const e of f.events) e.dist = state.home ? km(state.home, e.loc) : null;
  const list = visibleEvents();
  drawQuakes(list, { tooltipFor: tooltipHtml, onSelect: openDetail });
  setHeatPoints(list);
  renderStats(list, state);
  renderList(list, { home: state.home, fresh: f.fresh, hasAny: f.events.length > 0, onSelect: openDetail });
}

async function openDetail(e) {
  state.selected = e.eid;
  showDetailView(true);
  enterDetail(e);
  if (e.source === "usgs") {
    renderDetail(e, { home: state.home });
    return;
  }
  if (!e.detail) {
    renderDetail(e, { home: state.home, messageKey: "noDetail" });
    return;
  }
  renderDetail(e, { home: state.home });
  try {
    const detail = await fetchDetail(e.detail);
    if (state.selected !== e.eid) return; // the viewer moved on while it loaded
    drawStations(e, detail.stations);
    renderDetail(e, { home: state.home, detail });
  } catch (err) {
    if (state.selected === e.eid) renderDetail(e, { home: state.home, messageKey: "detailFailed" });
  }
}

/** Redraw an open detail panel (after a location or language change); JMA reports are cached. */
function refreshDetail() {
  const sel = cur().events.find((e) => e.eid === state.selected);
  if (!sel) return;
  if (sel.source === "usgs" || !sel.detail) { renderDetail(sel, { home: state.home }); return; }
  fetchDetail(sel.detail).then(
    (detail) => {
      if (state.selected !== sel.eid) return;
      drawStations(sel, detail.stations);
      renderDetail(sel, { home: state.home, detail });
    },
    () => {},
  );
}

function closeDetail() {
  if (!state.selected) return;
  state.selected = null;
  exitDetail();
  showDetailView(false);
}

function showStatus() {
  const f = cur();
  if (f.failed) { setStatus(t("loadFailed", { src: sourceName() }), false); return; }
  if (!f.updatedAt || f.loading && !f.events.length) { setStatus(t("loading", { src: sourceName() }), true); return; }
  const freshNote = f.fresh.size ? t("fresh", { n: f.fresh.size }) : "";
  setStatus(freshNote + t("updated", { t: fmtClock(f.updatedAt) }), true);
}

function setHome(home) {
  state.home = home;
  drawHome(home);
  setHomeLabel(home);
  render();
  refreshDetail();
}

function setPicking(on) {
  state.picking = on;
  setPickButton(on);
  setPickCursor(on);
}

const usgsQuery = () => ({ days: USGS_DAYS[state.periodHours], minMag: state.minMag });

/** Load the active source. `quiet` keeps the current list on screen while refreshing. */
async function load() {
  const source = state.source, f = state.feeds[source];
  let query = "", fetcher = fetchEvents;
  if (source === "usgs") {
    const q = usgsQuery();
    query = `${q.days}|${q.minMag}`;
    fetcher = () => fetchUsgs(q);
  }
  if (query !== f.query) { f.seen = null; f.fresh.clear(); f.sig = ""; }
  f.loading = true;
  showStatus();
  try {
    const next = await fetcher();
    if (state.source !== source) return; // switched away while loading
    if (source === "usgs" && query !== `${usgsQuery().days}|${usgsQuery().minMag}`) return; // filters changed
    if (f.seen) for (const e of next) if (!f.seen.has(e.eid)) f.fresh.add(e.eid);
    f.seen = new Set(next.map((e) => e.eid));
    f.query = query;
    // Re-render only when something changed, so hovering and reading aren't interrupted.
    const sig = next.map((e) => e.eid + e.maxi + e.mag).join("|");
    const changed = sig !== f.sig;
    f.sig = sig;
    f.events = next;
    f.updatedAt = new Date();
    f.failed = false;
    f.loading = false;
    showStatus();
    if (changed) render();
  } catch (err) {
    f.loading = false;
    f.failed = true;
    if (state.source === source) {
      showStatus();
      if (!f.events.length) render();
    }
  }
}

function setSource(source) {
  if (source === state.source) return;
  closeDetail();
  state.source = source;
  // "1 year" exists only for USGS; fall back to the JMA list's full range.
  if (source === "jma" && state.periodHours === "year") {
    state.periodHours = "all";
    pressSegment("period", "all");
  }
  applySourceUi(source);
  setLegendSource(source);
  showStatus();
  render();
  load();
}

// Which map features (names, rivers, roads…) are drawn; remembered per browser.
const FEATURES_KEY = "quake-radar.features";
const features = Object.fromEntries(FEATURE_GROUPS.map((g) => [g, g !== "terrain"]));
try { Object.assign(features, JSON.parse(localStorage.getItem(FEATURES_KEY) || "{}")); } catch (_) { /* defaults */ }

// ---- wiring ----
applyStatic();
applySourceUi(state.source);
initMap($("map"), { basemap: state.basemap, features }).then((vector) => {
  // Without the vector map the feature switches would do nothing, so hide them and say why.
  $("row-features").hidden = !vector;
  $("features-note").hidden = vector;
});
for (const box of document.querySelectorAll("#features input")) {
  const g = box.dataset.feature;
  box.checked = !!features[g];
  box.addEventListener("change", () => {
    features[g] = box.checked;
    setFeatureVisible(g, box.checked);
    try { localStorage.setItem(FEATURES_KEY, JSON.stringify(features)); } catch (_) { /* not remembered */ }
  });
}
drawHome(state.home);
setHomeLabel(state.home);
setPickButton(false);
renderStats([], state);

bindSegment("source", setSource);
bindSegment("period", (v) => {
  state.periodHours = v;
  render();
  if (state.source === "usgs") load();
});
bindSegment("minint", (v) => { state.minRank = +v; render(); });
bindSegment("minmag", (v) => {
  state.minMag = +v;
  render();
  load();
});
$("view").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) flyToView(b.dataset.v, state.home);
});
bindSegment("basemap", (v) => { state.basemap = v; setBasemap(v); updateMapSummary(v, state.nankaiMode); });
bindSegment("nankai-mode", (v) => {
  state.nankaiMode = v;
  setNankaiVisible(v === "area");
  setSegmentsVisible(v === "segments");
  updateMapSummary(state.basemap, v);
});
for (const id of ["plates", "historic", "heat"]) {
  $(id).addEventListener("change", () => updateMapSummary(state.basemap, state.nankaiMode));
}

// Map settings start open on wide screens and folded on phones, then follow the viewer's choice.
const MAP_OPEN_KEY = "quake-radar.mapOpen";
let mapOpen = matchMedia("(min-width: 861px)").matches;
try { const saved = localStorage.getItem(MAP_OPEN_KEY); if (saved !== null) mapOpen = saved === "1"; } catch (_) { /* default */ }
setMapSettingsOpen(mapOpen);
updateMapSummary(state.basemap, state.nankaiMode);
$("map-toggle").addEventListener("click", () => {
  mapOpen = !mapOpen;
  setMapSettingsOpen(mapOpen);
  try { localStorage.setItem(MAP_OPEN_KEY, mapOpen ? "1" : "0"); } catch (_) { /* not remembered */ }
});
// Layers that load data on first use untick themselves if loading fails.
for (const [id, show] of [["plates", setPlatesVisible], ["historic", setHistoricVisible], ["heat", setHeatVisible]]) {
  $(id).addEventListener("change", async (ev) => {
    const ok = await show(ev.target.checked);
    if (!ok) { ev.target.checked = false; updateMapSummary(state.basemap, state.nankaiMode); }
  });
}
$("back").addEventListener("click", closeDetail);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeDetail(); });

$("pick-home").addEventListener("click", () => setPicking(!state.picking));
$("reset-home").addEventListener("click", () => { setPicking(false); saveHome(null); setHome(null); });
$("locate-home").addEventListener("click", async () => {
  setPicking(false);
  setHomeNote(t("locating"));
  try {
    const home = await locateBrowser();
    saveHome(home);
    setHome(home);
    flyToView("home", home);
  } catch (msg) {
    setHomeLabel(state.home);
    setHomeNote(t(String(msg)));
  }
});
onMapClick((lat, lon) => {
  if (!state.picking) return;
  const home = makeHome(lat, lon);
  saveHome(home);
  setPicking(false);
  setHome(home);
});

$("lang").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) setLang(b.dataset.v);
});
onLangChange(() => {
  applySourceUi(state.source);
  updateMapSummary(state.basemap, state.nankaiMode);
  setHomeLabel(state.home);
  setPickButton(state.picking);
  drawHome(state.home);
  refreshMapLanguage();
  showStatus();
  render();
  refreshDetail();
});

$("refresh").addEventListener("click", load);
load();

// The JMA list and short USGS windows refresh every minute; a year of USGS data every 10 minutes.
let lastAuto = 0;
setInterval(() => {
  const every = state.source === "usgs" && state.periodHours === "year" ? USGS_YEAR_REFRESH_MS : REFRESH_MS;
  if (Date.now() - lastAuto >= every - 1000) { lastAuto = Date.now(); load(); }
}, REFRESH_MS);
// Refresh the "x minutes ago" labels even when no new data arrives.
setInterval(() => { if (cur().events.length) render(); }, 5 * 60_000);
