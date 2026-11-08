// Entry point: holds page state and wires data, map and panel together.
import { PROFILE_PRESETS, depthProfile, findAftershocks, profileBand } from "./analysis.js";
import { fetchNankai, fetchTsunamiAreas, fetchTsunamiDetail, fetchTsunamiList } from "./alerts.js";
import { ALERTS_REFRESH_MS, NANKAI_REFRESH_MS, REFRESH_MS, USGS_YEAR_REFRESH_MS } from "./config.js";
import { FEATURE_GROUPS, setBasemap, setFeatureVisible } from "./basemap.js";
import { fetchDetail, fetchEvents, fetchLongPeriodDetail } from "./data.js";
import { applyStatic, fmtClock, onLangChange, setLang, t } from "./i18n.js";
import { loadHome, locateBrowser, makeHome, saveHome } from "./home.js";
import {
  clearProfile, clearTsunami, drawAftershocks, drawHome, drawLongPeriod, drawProfile, drawTsunami, drawQuakes, drawStations, enterDetail, exitDetail,
  fitProfile, flyToView, initMap, onMapClick, refreshMapLanguage, setHeatPoints, setHeatVisible, setHistoricVisible,
  setInundationVisible, setLegendSource, setNankaiVisible, setPickCursor, setPlatesVisible, setProfileHandler,
  setSegmentsVisible, setShelterHandler, setShelterType,
} from "./map.js";
import {
  applySourceUi, bindSegment, lpStationLine, pressSegment, renderAlertsBar, renderAlertsView, renderDetail, renderList, renderProfile, renderStats, setHomeLabel,
  refreshListTimes, setHomeNote, setMapSettingsOpen, setPickButton, setStatus, showDetailView, showPanel, tooltipHtml,
  tsunamiAreaLabel,
  updateMapSummary,
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
  // Depth profile: line A→B, half-width of the band, chosen preset, and "A"/"B" while drawing.
  profile: { open: false, A: null, B: null, widthKm: 100, preset: null, picking: null },
  // Nankai Trough information and tsunami reports; `detail` caches tsunami reports by event id.
  alerts: {
    nankai: null, nankaiFailed: false, nankaiAt: 0,
    tsunami: null, tsunamiFailed: false,
    open: false, viewingEid: null, detail: {},
  },
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
  if (state.profile.open) renderProfilePanel();
}

/** Aftershocks of `e` among everything loaded for this source, drawn on the map too. */
function aftershocksFor(e) {
  const info = findAftershocks(e, cur().events);
  drawAftershocks(e, info.list, info.radiusKm, tooltipHtml);
  return info;
}

/**
 * Everything the open detail panel shows. The JMA intensity report and the
 * long-period report load separately; each repaints the panel when it arrives.
 */
let detailCtx = null;

function paintDetail(ctx) {
  if (state.selected !== ctx.e.eid) return;
  renderDetail(ctx.e, {
    home: state.home, detail: ctx.detail, messageKey: ctx.messageKey,
    aftershocks: ctx.aftershocks, longPeriod: ctx.lp,
  });
}

function loadLongPeriod(ctx) {
  ctx.lp = { loading: true };
  fetchLongPeriodDetail(ctx.e.lgFile).then(
    (data) => {
      if (state.selected !== ctx.e.eid) return;
      ctx.lp = { data };
      drawLongPeriod(data.stations, lpStationLine);
      paintDetail(ctx);
    },
    () => { ctx.lp = { failed: true }; paintDetail(ctx); },
  );
}

async function openDetail(e) {
  // While a point is being picked on the map, clicks on circles belong to the picking.
  if (state.picking || state.profile.picking) return;
  closeProfile();
  closeAlerts();
  state.selected = e.eid;
  showDetailView(true);
  enterDetail(e);
  const ctx = detailCtx = { e, detail: null, messageKey: undefined, aftershocks: aftershocksFor(e), lp: null };
  if (e.source !== "usgs" && !e.detail) ctx.messageKey = "noDetail";
  if (e.lgFile) loadLongPeriod(ctx);
  paintDetail(ctx);
  if (e.source === "usgs" || !e.detail) return;
  try {
    const detail = await fetchDetail(e.detail);
    if (state.selected !== e.eid) return; // the viewer moved on while it loaded
    ctx.detail = detail;
    drawStations(e, detail.stations);
  } catch (err) {
    ctx.messageKey = "detailFailed";
  }
  paintDetail(ctx);
}

/**
 * Repaint the open detail panel after new data, a location or a language change.
 * Stations are redrawn (and the map refit) only when asked, e.g. for new labels.
 */
function refreshDetail({ stations = false } = {}) {
  const sel = cur().events.find((e) => e.eid === state.selected);
  if (!sel || !detailCtx || detailCtx.e.eid !== sel.eid) return;
  const ctx = detailCtx;
  ctx.e = sel; // the list was reloaded: newer magnitude, intensity or long-period class
  ctx.aftershocks = aftershocksFor(sel);
  if (stations && ctx.detail) drawStations(sel, ctx.detail.stations);
  if (stations && ctx.lp?.data) drawLongPeriod(ctx.lp.data.stations, lpStationLine);
  if (sel.lgFile && !ctx.lp) loadLongPeriod(ctx); // a long-period report appeared later
  paintDetail(ctx);
}

// ---- alerts: Nankai Trough information and tsunami ----

async function loadAlerts(force = false) {
  const a = state.alerts;
  const jobs = [fetchTsunamiList().then((l) => { a.tsunami = l; a.tsunamiFailed = false; }, () => { a.tsunamiFailed = true; })];
  // The Nankai feed is ~180 KB, so it refreshes less often than the small tsunami list.
  if (force || Date.now() - a.nankaiAt > NANKAI_REFRESH_MS) {
    jobs.push(fetchNankai().then((n) => { a.nankai = n; a.nankaiFailed = false; a.nankaiAt = Date.now(); }, () => { a.nankaiFailed = true; }));
  }
  await Promise.all(jobs);
  paintAlerts();
  updateTsunamiMap();
}

function paintAlerts() {
  renderAlertsBar(state.alerts);
  if (state.alerts.open) renderAlertsPanel();
}

/** The tsunami report shown in the panel: the one clicked, else the current one, else the newest. */
function viewingReport() {
  const a = state.alerts, list = a.tsunami || [];
  return list.find((r) => r.eid === a.viewingEid) || list.find((r) => r.current) || list[0] || null;
}

function ensureTsunamiDetail(r) {
  const a = state.alerts;
  if (!r || a.detail[r.eid]) return;
  a.detail[r.eid] = { loading: true };
  fetchTsunamiDetail(r.file).then(
    (data) => { a.detail[r.eid] = { data }; paintAlerts(); updateTsunamiMap(); },
    () => { a.detail[r.eid] = { failed: true }; paintAlerts(); },
  );
}

function renderAlertsPanel() {
  const a = state.alerts, v = viewingReport();
  ensureTsunamiDetail(v);
  renderAlertsView({ nankai: a.nankai, nankaiFailed: a.nankaiFailed, tsunami: a.tsunami, viewing: v, viewingDetail: v ? a.detail[v.eid] : null });
}

/** A current tsunami report is always on the map; past ones only while viewed in the panel. */
async function updateTsunamiMap() {
  const a = state.alerts, list = a.tsunami || [];
  const target = a.open ? viewingReport() : list.find((r) => r.current);
  if (!target || target.rank === 0) { clearTsunami(); return; }
  ensureTsunamiDetail(target);
  const det = a.detail[target.eid];
  if (!det?.data) { clearTsunami(); return; } // drawn when the report arrives
  try { drawTsunami(det.data.areas, await fetchTsunamiAreas(), tsunamiAreaLabel); } catch (err) { clearTsunami(); }
}

function openAlerts(section) {
  closeDetail();
  closeProfile();
  const a = state.alerts;
  a.open = true;
  a.viewingEid = null;
  showPanel("alerts-view");
  renderAlertsPanel();
  updateTsunamiMap();
  document.getElementById(section === "tsunami" ? "al-tsunami" : "al-nankai")?.scrollIntoView({ block: "start" });
}

function closeAlerts() {
  const a = state.alerts;
  if (!a.open) return;
  a.open = false;
  showPanel("overview");
  updateTsunamiMap();
}

// ---- depth profile ----

function renderProfilePanel() {
  const p = state.profile;
  const result = p.A && p.B ? depthProfile(visibleEvents(), p.A, p.B, p.widthKm) : null;
  const suggestUsgs = !(state.source === "usgs" && state.periodHours === "year");
  renderProfile({ result, widthKm: p.widthKm, picking: p.picking, suggestUsgs });
  for (const b of $("profile-presets").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.preset === p.preset));
  $("profile-draw").setAttribute("aria-pressed", String(!!p.picking));
}

function drawProfileLine(fit) {
  const p = state.profile;
  const band = p.A && p.B ? profileBand(p.A, p.B, p.widthKm) : null;
  drawProfile(p.A, p.B, band);
  if (fit && band) fitProfile(band);
}

function setProfilePicking(which) {
  state.profile.picking = which;
  setPickCursor(!!which);
}

function usePreset(key) {
  const p = state.profile, pr = PROFILE_PRESETS[key];
  p.A = { ...pr.A }; p.B = { ...pr.B }; p.preset = key;
  setProfilePicking(null);
  drawProfileLine(true);
  renderProfilePanel();
}

function openProfile() {
  closeDetail();
  closeAlerts();
  setPicking(false);
  state.profile.open = true;
  showPanel("profile");
  if (!state.profile.A) usePreset("tohoku");
  else { drawProfileLine(true); renderProfilePanel(); }
}

function closeProfile() {
  const p = state.profile;
  if (!p.open) return;
  p.open = false;
  setProfilePicking(null);
  clearProfile();
  showPanel("overview");
}

function closeDetail() {
  if (!state.selected) return;
  state.selected = null;
  detailCtx = null;
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
    const sig = next.map((e) => e.eid + e.maxi + e.mag + (e.lg || "")).join("|");
    const changed = sig !== f.sig;
    f.sig = sig;
    f.events = next;
    f.updatedAt = new Date();
    f.failed = false;
    f.loading = false;
    showStatus();
    if (changed) {
      render();
      if (state.selected) refreshDetail(); // keep the aftershock count current
    }
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
for (const id of ["plates", "historic", "heat", "inundation"]) {
  $(id).addEventListener("change", () => updateMapSummary(state.basemap, state.nankaiMode));
}
$("inundation").addEventListener("change", (ev) => setInundationVisible(ev.target.checked));

// Evacuation sites: one hazard type at a time, shown once zoomed in to street level.
let shelterStatus = { state: "off" };
function showShelterStatus() {
  const s = shelterStatus, note = $("shelter-note");
  const text = s.state === "zoomIn" ? t("shZoomIn") : s.state === "loading" ? t("shLoading")
    : s.state === "ok" ? t("shCount", { n: s.count }) : s.state === "failed" ? t("shFailed") : "";
  note.textContent = text;
  note.hidden = !text;
}
setShelterHandler((s) => { shelterStatus = s; showShelterStatus(); });
bindSegment("shelter-type", (v) => setShelterType(v === "off" ? null : v));

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
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (state.profile.picking) { setProfilePicking(null); renderProfilePanel(); return; }
  closeDetail();
  closeProfile();
  closeAlerts();
});

$("alert-nankai").addEventListener("click", () => openAlerts("nankai"));
$("alert-tsunami").addEventListener("click", () => openAlerts("tsunami"));
$("alerts-back").addEventListener("click", closeAlerts);
$("alerts-body").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-eid]");
  if (!b) return;
  state.alerts.viewingEid = b.dataset.eid;
  renderAlertsPanel();
  updateTsunamiMap();
});

setProfileHandler(() => (state.profile.open ? closeProfile() : openProfile()));
$("profile-back").addEventListener("click", closeProfile);
$("profile-presets").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) usePreset(b.dataset.preset);
});
bindSegment("profile-width", (v) => {
  state.profile.widthKm = +v;
  drawProfileLine(false);
  renderProfilePanel();
});
$("profile-draw").addEventListener("click", () => {
  setPicking(false);
  setProfilePicking(state.profile.picking ? null : "A");
  renderProfilePanel();
});
$("profile-chart").addEventListener("click", (ev) => {
  if (!ev.target.closest('[data-action="use-usgs"]')) return;
  state.periodHours = "year";
  pressSegment("period", "year");
  if (state.source === "usgs") { render(); load(); } else { pressSegment("source", "usgs"); setSource("usgs"); }
});

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
  const p = state.profile;
  if (p.picking === "A") {
    p.A = { lat, lon }; p.B = null; p.preset = null;
    p.picking = "B";
    drawProfileLine(false);
    renderProfilePanel();
    return;
  }
  if (p.picking === "B") {
    p.B = { lat, lon };
    setProfilePicking(null);
    drawProfileLine(false);
    renderProfilePanel();
    return;
  }
  if (!state.picking) return;
  const home = makeHome(lat, lon);
  saveHome(home);
  setPicking(false);
  setHome(home);
});

// Theme: "auto" follows the system; "light"/"dark" are saved and set data-theme on <html>.
const THEME_KEY = "quake-radar.theme";
function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  pressSegment("theme", theme === "light" || theme === "dark" ? theme : "auto");
}
let savedTheme = "auto";
try { savedTheme = localStorage.getItem(THEME_KEY) || "auto"; } catch (_) { /* default */ }
applyTheme(savedTheme);
bindSegment("theme", (v) => {
  applyTheme(v);
  try { if (v === "auto") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, v); } catch (_) { /* not remembered */ }
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
  refreshDetail({ stations: true });
  paintAlerts();
  updateTsunamiMap();
  showShelterStatus();
});

$("refresh").addEventListener("click", () => { load(); loadAlerts(true); });
loadAlerts(true);
load();

// ---- refreshing ----
// Nothing is fetched while the page is hidden (another tab, phone locked); coming back
// refreshes at once. The JMA list and short USGS windows refresh every minute, a year
// of USGS data every 10 minutes, alerts every minute (Nankai feed every 5).
let lastAuto = Date.now();
const dataEvery = () => (state.source === "usgs" && state.periodHours === "year" ? USGS_YEAR_REFRESH_MS : REFRESH_MS);
function tick() {
  if (document.hidden) return;
  if (Date.now() - lastAuto >= dataEvery() - 1000) { lastAuto = Date.now(); load(); }
  loadAlerts();
}
setInterval(tick, Math.min(REFRESH_MS, ALERTS_REFRESH_MS));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  // Back from the background: refresh what is stale and the "x minutes ago" labels.
  if (Date.now() - lastAuto >= REFRESH_MS) { lastAuto = Date.now(); load(); }
  loadAlerts();
  refreshTimes();
});

/** Only the relative times change between data updates, so only they are rewritten. */
function refreshTimes() {
  if (!cur().events.length) return;
  refreshListTimes(state.home);
  renderStats(visibleEvents(), state);
}
setInterval(() => { if (!document.hidden) refreshTimes(); }, 5 * 60_000);
