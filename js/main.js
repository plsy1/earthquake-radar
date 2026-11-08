// Entry point: holds page state and wires data, map and panel together.
import { REFRESH_MS } from "./config.js";
import { fetchDetail, fetchEvents } from "./data.js";
import { applyStatic, fmtClock, onLangChange, setLang, t } from "./i18n.js";
import { loadHome, locateBrowser, makeHome, saveHome } from "./home.js";
import {
  drawHome, drawQuakes, drawStations, enterDetail, exitDetail, flyToView,
  initMap, onMapClick, refreshMapLanguage, setNankaiVisible, setPickCursor,
} from "./map.js";
import {
  bindSegment, renderDetail, renderList, renderStats, setHomeLabel, setHomeNote, setPickButton,
  setStatus, showDetailView, tooltipHtml,
} from "./ui.js";
import { $, km, rank } from "./util.js";

const state = {
  events: [],
  seen: null,          // event ids from the previous load; null before the first
  fresh: new Set(),    // ids that appeared after the page opened
  sig: "",
  periodHours: "168",  // "24" | "168" | "all"
  minRank: 0,
  home: loadHome(),     // null until the viewer sets a location
  picking: false,
  selected: null,      // eid of the earthquake shown in the detail panel
  updatedAt: null,     // time of the last successful load
  loadFailed: false,
};

function visibleEvents() {
  const cut = state.periodHours === "all" ? 0 : Date.now() - +state.periodHours * 3600e3;
  return state.events.filter((e) => e.time >= cut && rank(e.maxi) >= state.minRank);
}

function render() {
  for (const e of state.events) e.dist = state.home ? km(state.home, e.loc) : null;
  const list = visibleEvents();
  drawQuakes(list, { tooltipFor: tooltipHtml, onSelect: openDetail });
  renderStats(list, state);
  renderList(list, { home: state.home, fresh: state.fresh, hasAny: state.events.length > 0, onSelect: openDetail });
}

async function openDetail(e) {
  state.selected = e.eid;
  showDetailView(true);
  enterDetail(e);
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

/** Redraw an open detail panel from the cached report (after a location or language change). */
function refreshDetail() {
  const sel = state.events.find((e) => e.eid === state.selected);
  if (!sel || !sel.detail) return;
  fetchDetail(sel.detail).then(
    (detail) => {
      if (state.selected !== sel.eid) return;
      drawStations(sel, detail.stations);
      renderDetail(sel, { home: state.home, detail });
    },
    () => {},
  );
}

function showStatus() {
  if (state.loadFailed) { setStatus(t("loadFailed"), false); return; }
  if (!state.updatedAt) { setStatus(t("loading"), true); return; }
  const freshNote = state.fresh.size ? t("fresh", { n: state.fresh.size }) : "";
  setStatus(freshNote + t("updated", { t: fmtClock(state.updatedAt) }), true);
}

function closeDetail() {
  state.selected = null;
  exitDetail();
  showDetailView(false);
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

async function load() {
  try {
    const next = await fetchEvents();
    if (state.seen) for (const e of next) if (!state.seen.has(e.eid)) state.fresh.add(e.eid);
    state.seen = new Set(next.map((e) => e.eid));
    // Re-render only when something changed, so hovering and reading aren't interrupted every minute.
    const sig = next.map((e) => e.eid + e.maxi + e.mag).join("|");
    const changed = sig !== state.sig;
    state.sig = sig;
    state.events = next;
    state.updatedAt = new Date();
    state.loadFailed = false;
    showStatus();
    if (changed) render();
  } catch (err) {
    state.loadFailed = true;
    showStatus();
    if (!state.events.length) render();
  }
}

// ---- wiring ----
applyStatic();
initMap($("map"));
drawHome(state.home);
setHomeLabel(state.home);
setPickButton(false);
renderStats([], state);

bindSegment("period", (v) => { state.periodHours = v; render(); });
bindSegment("minint", (v) => { state.minRank = +v; render(); });
$("view").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (b) flyToView(b.dataset.v, state.home);
});
$("nankai").addEventListener("change", (ev) => setNankaiVisible(ev.target.checked));
$("back").addEventListener("click", closeDetail);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && state.selected) closeDetail(); });

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
setInterval(load, REFRESH_MS);
// Refresh the "x minutes ago" labels even when no new data arrives.
setInterval(() => { if (state.events.length) render(); }, 5 * 60_000);
