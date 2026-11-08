// Entry point: holds page state and wires data, map and panel together.
import { REFRESH_MS } from "./config.js";
import { fetchDetail, fetchEvents } from "./data.js";
import { defaultHome, loadHome, pickedHome, saveHome } from "./home.js";
import {
  drawHome, drawQuakes, drawStations, enterDetail, exitDetail, flyToView,
  initMap, onMapClick, setNankaiVisible, setPickCursor,
} from "./map.js";
import {
  bindSegment, renderDetail, renderList, renderStats, setHomeLabel, setPickButton,
  setStatus, showDetailView, tooltipHtml,
} from "./ui.js";
import { $, fmtClock, km, rank } from "./util.js";

const state = {
  events: [],
  seen: null,          // event ids from the previous load; null before the first
  fresh: new Set(),    // ids that appeared after the page opened
  sig: "",
  periodHours: "168",  // "24" | "168" | "all"
  minRank: 0,
  home: loadHome(),
  picking: false,
  selected: null,      // eid of the earthquake shown in the detail panel
};

function visibleEvents() {
  const cut = state.periodHours === "all" ? 0 : Date.now() - +state.periodHours * 3600e3;
  return state.events.filter((e) => e.time >= cut && rank(e.maxi) >= state.minRank);
}

function render() {
  for (const e of state.events) e.dist = km(state.home, e.loc);
  const list = visibleEvents();
  drawQuakes(list, { tooltipFor: tooltipHtml, onSelect: openDetail });
  renderStats(list);
  renderList(list, { home: state.home, fresh: state.fresh, hasAny: state.events.length > 0, onSelect: openDetail });
}

async function openDetail(e) {
  state.selected = e.eid;
  showDetailView(true);
  enterDetail(e);
  if (!e.detail) {
    renderDetail(e, { home: state.home, message: "气象厅没有发布这次地震各地的震度。" });
    return;
  }
  renderDetail(e, { home: state.home });
  try {
    const detail = await fetchDetail(e.detail);
    if (state.selected !== e.eid) return; // the viewer moved on while it loaded
    drawStations(e, detail.stations);
    renderDetail(e, { home: state.home, detail });
  } catch (err) {
    if (state.selected === e.eid) {
      renderDetail(e, { home: state.home, message: "无法读取这次地震的各地震度，请稍后再试。" });
    }
  }
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
  // Refresh distances in an open detail panel (the report itself is cached).
  const sel = state.events.find((e) => e.eid === state.selected);
  if (sel && sel.detail) fetchDetail(sel.detail).then(
    (detail) => { if (state.selected === sel.eid) renderDetail(sel, { home, detail }); },
    () => {},
  );
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
    const freshNote = state.fresh.size ? `有${state.fresh.size}次新地震 · ` : "";
    setStatus(freshNote + "更新于 " + fmtClock.format(new Date()), true);
    if (changed) render();
  } catch (err) {
    setStatus("无法读取气象厅数据，60秒后自动重试", false);
    if (!state.events.length) render();
  }
}

// ---- wiring ----
initMap($("map"));
drawHome(state.home);
setHomeLabel(state.home);

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
$("reset-home").addEventListener("click", () => { setPicking(false); saveHome(null); setHome(defaultHome()); });
onMapClick((lat, lon) => {
  if (!state.picking) return;
  const home = pickedHome(lat, lon);
  saveHome(home);
  setPicking(false);
  setHome(home);
});

$("refresh").addEventListener("click", load);
load();
setInterval(load, REFRESH_MS);
// Refresh "x分钟前" labels even when no new data arrives.
setInterval(() => { if (state.events.length) render(); }, 5 * 60_000);
