// Entry point: holds page state and wires data, map and panel together.
import { REFRESH_MS } from "./config.js";
import { fetchEvents } from "./data.js";
import { defaultHome, loadHome, pickedHome, saveHome } from "./home.js";
import { drawHome, drawQuakes, flyToView, focusQuake, initMap, onMapClick, setNankaiVisible, setPickCursor } from "./map.js";
import { bindSegment, popupHtml, renderList, renderStats, setHomeLabel, setPickButton, setStatus } from "./ui.js";
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
};

function visibleEvents() {
  const cut = state.periodHours === "all" ? 0 : Date.now() - +state.periodHours * 3600e3;
  return state.events.filter((e) => e.time >= cut && rank(e.maxi) >= state.minRank);
}

function render() {
  for (const e of state.events) e.dist = km(state.home, e.loc);
  const list = visibleEvents();
  drawQuakes(list, (e) => popupHtml(e, state.home));
  renderStats(list);
  renderList(list, { home: state.home, fresh: state.fresh, hasAny: state.events.length > 0, onSelect: focusQuake });
}

function setHome(home) {
  state.home = home;
  drawHome(home);
  setHomeLabel(home);
  render();
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
    // Re-render only when something changed, so an open popup isn't closed every minute.
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
