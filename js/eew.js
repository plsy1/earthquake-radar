// Earthquake Early Warnings (緊急地震速報), received live over WebSocket from two free relays:
// - P2P地震情報: warnings (警報) only, with each area's forecast intensity and arrival time.
// - Wolfx: every forecast (予報) and warning, with JMA's report number and maximum intensity.
// Messages about the same earthquake share JMA's event id and are merged into one event.
// Neither relay guarantees delivery, and nothing arrives while the page is closed or asleep.
import { EEW_P2P_LAST, EEW_P2P_WS, EEW_WOLFX_LAST, EEW_WOLFX_WS } from "./config.js";

const STALE_MS = 3 * 60_000;          // older reports (e.g. history fetched on load) never go live
const SHOW_AFTER_UPDATE_MS = 90_000;  // an event stays on screen this long after its last report…
const SHOW_AFTER_ORIGIN_MS = 120_000; // …and at least this long after the earthquake began
const SHOW_MAX_MS = 5 * 60_000;
const SHOW_CANCELLED_MS = 15_000;
const WOLFX_SILENCE_MS = 3 * 60_000;  // Wolfx sends a heartbeat every minute

/** P2P intensity codes → the codes used everywhere else ("5-" = 5 弱). */
const P2P_SCALE = { 0: "0", 10: "1", 20: "2", 30: "3", 40: "4", 45: "5-", 50: "5+", 55: "6-", 60: "6+", 70: "7" };
/** Wolfx / JMA intensity strings → the same codes. */
const JMA_INT = {
  0: "0", 1: "1", 2: "2", 3: "3", 4: "4", "5-": "5-", "5弱": "5-", "5+": "5+", "5強": "5+",
  "6-": "6-", "6弱": "6-", "6+": "6+", "6強": "6+", 7: "7",
};
const RANK = ["0", "1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];
export const intRank = (code) => RANK.indexOf(code);

/** "2026/11/08 01:04:35(.608)" in Japan time → Date. */
const jst = (s) => (s ? new Date(String(s).replace(/\//g, "-").replace(" ", "T") + "+09:00") : null);

function hypo(lat, lon, depth, name) {
  const ok = isFinite(lat) && isFinite(lon) && lat > 15 && lat < 55 && lon > 115 && lon < 160;
  return ok ? { lat: +lat, lon: +lon, depth: isFinite(depth) && depth >= 0 ? Math.trunc(depth) : null, name: name || "" } : null;
}

// ---- clock: wave fronts and countdowns use the relay's clock, not a possibly wrong local one ----
let clockOffset = 0;
function syncClock(serverMs) {
  const off = serverMs - Date.now();
  if (Math.abs(off) < 10 * 60_000) clockOffset = off;
}
export const eewNow = () => Date.now() + clockOffset;

// ---- normalising both feeds into one shape ----

function fromWolfx(m) {
  if (!m || !m.EventID || (m.type && m.type !== "jma_eew")) return null;
  return {
    id: String(m.EventID), source: "wolfx", serial: +m.Serial || null,
    warn: !!m.isWarn, cancel: !!m.isCancel, final: !!m.isFinal, test: !!m.isTraining,
    assumed: !!m.isAssumption,
    announced: jst(m.AnnouncedTime), origin: jst(m.OriginTime),
    hypo: hypo(m.Latitude, m.Longitude, m.Depth, m.Hypocenter),
    mag: isFinite(m.Magnitude ?? m.Magunitude) ? +(m.Magnitude ?? m.Magunitude) : null,
    maxInt: JMA_INT[m.MaxIntensity] || null,
    areas: (m.WarnArea || []).map((a) => ({
      name: a.Chiiki || "", from: JMA_INT[a.Shindo2] || null, to: JMA_INT[a.Shindo1] || null,
      arrival: null, arrived: a.Arrive === true || a.Arrive === "true",
    })),
  };
}

function fromP2p(m) {
  if (!m || m.code !== 556 || !m.issue?.eventId) return null;
  const q = m.earthquake || {}, h = q.hypocenter || {};
  return {
    id: String(m.issue.eventId), source: "p2p", serial: null,
    warn: true, cancel: !!m.cancelled, final: false, test: !!m.test,
    assumed: q.condition === "仮定震源要素",
    announced: jst(m.issue.time), origin: jst(q.originTime),
    hypo: hypo(h.latitude, h.longitude, h.depth, h.name),
    mag: h.magnitude >= 0 ? +h.magnitude : null,
    maxInt: null,
    areas: (m.areas || []).map((a) => ({
      name: a.name || "",
      from: P2P_SCALE[Math.trunc(a.scaleFrom)] || null,
      to: Math.trunc(a.scaleTo) === 99 ? "over" : P2P_SCALE[Math.trunc(a.scaleTo)] || null,
      arrival: jst(a.arrivalTime), arrived: a.kindCode === "11",
    })),
  };
}

// ---- events ----

const events = new Map();   // event id → merged event
const listeners = new Set();
let demoOn = false;

/** Highest forecast intensity of an event: the report's own, or higher in one of its areas. */
function maxIntOf(ev) {
  let best = ev.maxInt || null;
  for (const a of ev.areas) for (const c of [a.to, a.from]) if (c && c !== "over" && intRank(c) > intRank(best)) best = c;
  return best;
}

function absorb(msg, { history = false } = {}) {
  if (!msg) return;
  if (msg.test && !msg.demo) return; // JMA training messages
  const now = eewNow();
  let ev = events.get(msg.id);
  if (!ev) {
    ev = { id: msg.id, firstAt: now, updatedAt: now, sources: new Set(), areas: [], warn: false, cancel: false, demo: !!msg.demo };
    events.set(msg.id, ev);
  }
  ev.sources.add(msg.source);
  ev.updatedAt = now;
  ev.history = history || (msg.announced && now - msg.announced > STALE_MS);
  if (msg.cancel) { ev.cancel = true; ev.cancelAt = now; }
  if (msg.warn) ev.warn = true;
  // The latest report wins for the hypocenter and magnitude; a P2P warning and a Wolfx
  // report can be announced at the same second, so ties go to the one with more detail.
  const newer = !ev.announced || (msg.announced && (msg.announced > ev.announced || (+msg.announced === +ev.announced && msg.source === "wolfx")));
  if (newer && !msg.cancel) {
    ev.announced = msg.announced;
    if (msg.origin) ev.origin = msg.origin;
    if (msg.hypo) ev.hypo = msg.hypo;
    if (msg.mag != null) ev.mag = msg.mag;
    ev.assumed = msg.assumed;
    if (msg.serial) ev.serial = msg.serial;
    if (msg.final) ev.final = true;
    if (msg.maxInt) ev.maxInt = msg.maxInt;
  }
  // Only P2P gives each area's arrival time, so its area list is preferred.
  if (msg.areas.length && (msg.source === "p2p" || !ev.p2pAreas)) {
    ev.areas = msg.areas;
    if (msg.source === "p2p") ev.p2pAreas = true;
  }
  ev.maxIntAll = maxIntOf(ev);
  // keep the map small
  if (events.size > 30) events.delete(events.keys().next().value);
  emit();
}

/** Whether an event should be on screen at `now`. */
function isShown(ev, now) {
  if (ev.history || !ev.origin) return false;
  if (ev.cancel) return now - ev.cancelAt < SHOW_CANCELLED_MS;
  const until = Math.min(ev.firstAt + SHOW_MAX_MS, Math.max(ev.updatedAt + SHOW_AFTER_UPDATE_MS, +ev.origin + SHOW_AFTER_ORIGIN_MS));
  return now < until;
}

/** Warnings and forecasts of intensity 4 or more are the ones worth interrupting for. */
export const isSignificant = (ev) => !!ev && !ev.cancel && (ev.warn || intRank(ev.maxIntAll) >= intRank("4"));

// ---- connections ----

const status = { p2p: "connecting", wolfx: "connecting" };
const sockets = {};

function connect(name, url, onMessage, { watchdogMs = 0 } = {}) {
  let ws = null, retry = 0, timer = 0, lastMsg = 0;
  const schedule = () => {
    clearTimeout(timer);
    const delay = Math.min(60_000, 2000 * 2 ** retry++) * (0.75 + Math.random() * 0.5);
    timer = setTimeout(open, delay);
  };
  function open() {
    clearTimeout(timer);
    status[name] = "connecting";
    emit();
    try { ws = new WebSocket(url); } catch (_) { status[name] = "closed"; emit(); schedule(); return; }
    ws.onopen = () => { retry = 0; lastMsg = Date.now(); status[name] = "open"; emit(); };
    ws.onmessage = (e) => {
      lastMsg = Date.now();
      let m;
      try { m = JSON.parse(e.data); } catch (_) { return; }
      onMessage(m, ws);
    };
    ws.onclose = () => { ws = null; status[name] = "closed"; emit(); schedule(); };
    ws.onerror = () => { /* onclose follows */ };
  }
  // A connection can die silently (sleep, network change): reconnect when nothing arrives.
  if (watchdogMs) {
    setInterval(() => { if (ws && ws.readyState === 1 && Date.now() - lastMsg > watchdogMs) ws.close(); }, 30_000);
  }
  sockets[name] = {
    // Back from the background: reconnect now instead of waiting out the backoff.
    wake() { if (!ws) { retry = 0; open(); } },
  };
  open();
}

const seenP2p = new Set();

function startSockets() {
  connect("p2p", EEW_P2P_WS, (m) => {
    if (m.code !== 556) return;
    if (m.id) {
      if (seenP2p.has(m.id)) return; // the relay may send the same report twice
      seenP2p.add(m.id);
      if (seenP2p.size > 200) seenP2p.delete(seenP2p.values().next().value);
    }
    absorb(fromP2p(m));
  });
  connect("wolfx", EEW_WOLFX_WS, (m, ws) => {
    if (m.type === "heartbeat") {
      if (m.timestamp) syncClock(+m.timestamp);
      try { ws.send("ping"); } catch (_) { /* closing */ }
      return;
    }
    if (m.type === "pong") { if (m.timestamp) syncClock(+m.timestamp); return; }
    absorb(fromWolfx(m));
  }, { watchdogMs: WOLFX_SILENCE_MS });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const s of Object.values(sockets)) s.wake();
  });
}

/** The latest report of each relay, for "latest early warning" in the alerts panel. */
async function loadLatest() {
  const get = (url) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [p2p, wolfx] = await Promise.all([get(EEW_P2P_LAST), get(EEW_WOLFX_LAST)]);
  if (Array.isArray(p2p) && p2p[0]) absorb(fromP2p(p2p[0]), { history: true });
  if (wolfx) absorb(fromWolfx(wolfx), { history: true });
}

// ---- state for the page ----

function snapshot() {
  const now = eewNow();
  const all = [...events.values()];
  const shown = all.filter((ev) => isShown(ev, now))
    // warnings first, then the most recently updated
    .sort((a, b) => (b.warn - a.warn) || (b.updatedAt - a.updatedAt));
  const latest = all.filter((ev) => !ev.demo && ev.announced).sort((a, b) => b.announced - a.announced)[0] || null;
  return { status: { ...status }, active: shown[0] || null, latest, demo: demoOn };
}

function emit() {
  const s = snapshot();
  for (const fn of listeners) fn(s);
}

export function onEewChange(fn) { listeners.add(fn); }
export const eewState = snapshot;

let started = false;
export function startEew() {
  if (started) return;
  started = true;
  startSockets();
  loadLatest();
  // Events time out on their own; re-check every few seconds so the page notices.
  setInterval(() => { if (events.size) emit(); }, 5000);
}

// ---- demo: the 11/8 western Shizuoka earthquake, replayed as if it were happening now ----
// Report times, magnitudes and areas follow JMA's record of that event.

export function runEewDemo() {
  const LEAD = 8; // start just before the first report rather than at the origin time
  const origin = eewNow() - LEAD * 1000;
  const id = "demo-" + origin;
  const at = (s) => new Date(origin + s * 1000);
  const area = (name, from, to, arriveS, arrived = false) => ({ name, from, to, arrival: arriveS == null ? null : at(arriveS), arrived });
  const areas = [
    area("愛知県西部", "5-", "5-", 14),
    area("静岡県西部", "4", "4", null, true),
    area("愛知県東部", "4", "4", null, true),
    area("静岡県中部", "3", "4", 15),
    area("岐阜県美濃東部", "3", "4", 16),
  ];
  const base = { id, source: "wolfx", demo: true, test: true, cancel: false, assumed: false, origin: at(0) };
  const h = (depth) => ({ lat: 34.9, lon: 137.6, depth, name: "静岡県西部" });
  const steps = [
    [9.4, { serial: 1, warn: false, mag: 4.4, hypo: h(10), maxInt: "3", areas: [] }],
    [10.6, { serial: 4, warn: false, mag: 5.1, hypo: h(30), maxInt: "4", areas: [] }],
    [14.5, { serial: 6, warn: true, mag: 5.5, hypo: h(40), maxInt: "5-", areas }],
    [22.0, { serial: 13, warn: true, mag: 5.8, hypo: h(50), maxInt: "5+", areas: areas.map((a, i) => (i === 0 ? { ...a, from: "5+", to: "5+" } : a)) }],
    [23.4, { serial: 14, warn: true, mag: 6.0, hypo: h(50), maxInt: "5+", areas: areas.map((a, i) => (i === 0 ? { ...a, from: "5+", to: "5+" } : a)) }],
    [93.8, { serial: 19, warn: true, final: true, mag: 6.0, hypo: h(50), maxInt: "5+", areas: areas.map((a, i) => (i === 0 ? { ...a, from: "5+", to: "5+" } : a)) }],
  ];
  demoOn = true;
  for (const [s, part] of steps) {
    setTimeout(() => absorb({ ...base, final: false, ...part, announced: at(s) }), (s - LEAD) * 1000);
  }
  setTimeout(() => { demoOn = false; emit(); }, 200_000);
  emit();
}
