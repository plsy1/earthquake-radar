// Side panel: status line, controls, summary numbers, earthquake list, detail.
import {
  COLOR, DARKTEXT, LP_COLOR, LP_PAGE, NANKAI_PAGE, NEAR_KM, NEARBY_STATION_KM, ORDER, TSUNAMI_PAGE, UNKNOWN_COLOR, depthBand,
} from "./config.js";
import { ago, depthText, fmtTime, intLabel, magText, pick, placeName, t } from "./i18n.js";
import { mtChart, profileChart } from "./charts.js";
import { $, esc, km, rank } from "./util.js";

export function setStatus(text, ok) {
  $("status").textContent = text;
  $("dot").classList.toggle("err", !ok);
}

// The location buttons show how the current location was set (and when picking is under way).
let homeShown = null, pickingShown = false;
function paintHomeButtons() {
  $("locate-home").setAttribute("aria-pressed", String(homeShown?.via === "gps"));
  const pick = $("pick-home");
  pick.setAttribute("aria-pressed", String(pickingShown || homeShown?.via === "map"));
  pick.textContent = t(pickingShown ? "picking" : "pick");
}

export function setHomeLabel(home) {
  homeShown = home;
  paintHomeButtons();
  $("home-name").textContent = t(home ? "homeSet" : "homeUnset");
  $("home-note").hidden = true;
  $("reset-home").hidden = !home;
  const viewBtn = document.querySelector('#view button[data-v="home"]');
  viewBtn.disabled = !home;
  viewBtn.title = home ? "" : t("homeFirst");
}

/** A line under the location controls, e.g. while asking the browser or after a refusal. */
export function setHomeNote(text) {
  $("home-note").textContent = text;
  $("home-note").hidden = !text;
}

const BASEMAP_KEY = { pale: "bmPale", std: "bmStd", photo: "bmPhoto", relief: "bmRelief" };
const LAYER_IDS = ["plates", "historic", "heat", "inundation"];

/** Fold or unfold the map settings rows. */
export function setMapSettingsOpen(open) {
  $("map-settings").hidden = !open;
  $("map-toggle").setAttribute("aria-expanded", String(open));
}

/** "Light · 2 layers" beside the map settings toggle, so a folded section still says what is on. */
export function updateMapSummary(basemap, nankaiMode) {
  const n = LAYER_IDS.filter((id) => $(id).checked).length + (nankaiMode === "off" ? 0 : 1);
  $("map-summary").textContent = `${t(BASEMAP_KEY[basemap] || "bmPale")} · ${!n ? t("layersNone") : n === 1 ? t("layerOne") : t("layersOn", { n })}`;
}

export function setPickButton(on) {
  pickingShown = on;
  paintHomeButtons();
}

/** A row of toggle buttons where exactly one is pressed. */
export function bindSegment(id, onChange) {
  const group = $(id);
  group.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    onChange(b.dataset.v);
  });
}

/** Show the controls and wording that fit the chosen data source. */
export function applySourceUi(source) {
  const usgs = source === "usgs";
  $("subtitle").textContent = t(usgs ? "subtitleUsgs" : "subtitle");
  $("row-minint").hidden = usgs;
  $("row-minmag").hidden = !usgs;
  document.querySelector('#period button[data-v="year"]').hidden = !usgs;
  $("detail-hint").textContent = t(usgs ? "detailHintUsgs" : "detailHint");
}

/** Press the button in a segment group whose value is `v`. */
export function pressSegment(id, v) {
  for (const b of $(id).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === v));
}

export function tooltipHtml(e) {
  if (e.source === "usgs") {
    return t("tooltipUsgs", {
      place: esc(placeName(e)), mag: magText(e.mag), depth: depthText(e.loc.depth),
      time: fmtTime(e.time), ago: ago(e.time),
    });
  }
  return t("tooltip", {
    place: esc(placeName(e)), mag: magText(e.mag), int: intLabel(e.maxi),
    time: fmtTime(e.time), ago: ago(e.time),
  }) + (e.lg ? ` · ${esc(t("lpBadge", { v: e.lg }))}` : "");
}

/** Show one of the side panel's views: the list, one earthquake's detail, the depth profile or alerts. */
export function showPanel(name) {
  for (const id of ["overview", "detail", "profile", "alerts-view"]) $(id).hidden = id !== name;
  if (name !== "overview") $(name).scrollTop = 0;
}
export const showDetailView = (on) => showPanel(on ? "detail" : "overview");

const quakeLine = (e) => `${placeName(e)} · ${magText(e.mag)} · ${fmtTime(e.time)}`;

/** Aftershock block: count, largest, magnitude–time diagram and what the data covers. */
function renderAftershocks(body, main, info) {
  if (!info) return;
  const box = el("section", "note aftershocks");
  const n = info.list.length;
  box.append(el("span", "lbl", t("asTitle")));
  const head = el("div", "as-head");
  head.append(el("b", "as-count", t("asCount", { n })), el("span", "as-scope", t("asScope", { r: info.radiusKm })));
  box.appendChild(head);
  if (n) {
    const big = info.list.reduce((a, b) => ((+b.mag || 0) > (+a.mag || 0) ? b : a));
    box.appendChild(el("div", null, t("asLargest", { q: quakeLine(big), ago: ago(big.time) })));
  } else {
    box.appendChild(el("div", null, t("asNone")));
  }
  const { svg, days } = mtChart({ main, list: info.list, labelFor: quakeLine, cumLabel: (k) => t("mtCum", { n: k }) });
  const wrap = el("div", "chart-wrap");
  wrap.appendChild(svg);
  wrap.appendChild(el("div", "chart-cap", t(days ? "mtAxisDays" : "mtAxisHours")));
  box.appendChild(wrap);
  box.appendChild(el("div", "chart-cap", t(main.source === "usgs" ? "asLimitUsgs" : "asLimitJma")));
  // JMA's standard advice after strong shaking, shown during the first week.
  const recent = Date.now() - main.time < 7 * 86400e3;
  if (recent && (rank(main.maxi) >= rank("5-") || +main.mag >= 6)) box.appendChild(el("div", "as-advice", t("asAdvice")));
  body.appendChild(box);
}

/**
 * Depth profile panel. `result` is from depthProfile(); `picking` is "A"/"B" while
 * the viewer is drawing a line; `suggestUsgs` adds a button to load USGS · 1 year.
 */
export function renderProfile({ result, widthKm, picking, suggestUsgs }) {
  $("profile-hint").textContent = picking
    ? t(picking === "A" ? "profileDrawingA" : "profileDrawingB")
    : t("profileHint", { w: widthKm });
  const box = $("profile-chart");
  box.textContent = "";
  if (result && !picking) {
    if (!result.points.length) {
      box.appendChild(el("div", "empty", t("profileEmpty")));
    } else {
      const { svg, stretch } = profileChart({
        lengthKm: result.lengthKm, points: result.points,
        labelFor: (p) => `${placeName(p.e)} · ${magText(p.e.mag)} · ${depthText(p.depth)} · ${fmtTime(p.e.time)}`,
      });
      box.appendChild(svg);
      const cap = [t("profileAxes"), t("profileCount", { n: result.points.length })];
      if (stretch >= 1.2) cap.push(t("profileStretch", { k: stretch.toFixed(1) }));
      box.appendChild(el("div", "chart-cap", cap.join(" · ")));
    }
  }
  if (suggestUsgs) {
    const tip = el("div", "note mine profile-tip");
    tip.appendChild(el("div", null, t("profileTip")));
    const b = el("button", null, t("profileUseUsgs"));
    b.type = "button";
    b.dataset.action = "use-usgs";
    tip.appendChild(b);
    box.appendChild(tip);
  }
}

/** Chip for a list row or detail header: intensity for JMA, magnitude on a depth color for USGS. */
function quakeChip(e, cls = "chip") {
  if (e.source !== "usgs") return chipEl(e.maxi, cls);
  const band = depthBand(e.loc.depth);
  const c = el("div", cls, e.mag === "" ? "–" : (+e.mag).toFixed(1));
  c.style.background = band.color;
  c.style.color = band.dark ? "#1a1a1a" : "#fff";
  return c;
}

function chipEl(maxi, cls = "chip") {
  const c = el("div", cls, intLabel(maxi));
  c.style.background = COLOR[maxi] || UNKNOWN_COLOR;
  c.style.color = DARKTEXT.has(maxi) ? "#1a1a1a" : "#fff";
  return c;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const roundKm = (d) => (d < 10 ? d.toFixed(1) : Math.round(d));

/**
 * Detail panel for one earthquake. `detail` is the parsed JMA report, or absent
 * while loading; `messageKey` replaces the intensity section (loading or error).
 */
/** One line per long-period station: name, class, Sva and intensity. */
export const lpStationLine = (s) =>
  t("lpStation", { name: pick(s.name, s.nameEn), l: s.lg, sva: s.sva ?? "–", int: intLabel(s.int) });

/** Long-period ground motion block: highest class, what it means, and the stations. */
function renderLongPeriod(body, e, lp) {
  if (!lp) return;
  const box = el("section", "note lp");
  box.appendChild(el("span", "lbl", t("lpTitle")));
  if (lp.loading || lp.failed) {
    box.appendChild(el("div", null, t(lp.failed ? "lpFailed" : "lpLoading")));
    body.appendChild(box);
    return;
  }
  const { maxLg, stations } = lp.data;
  const level = maxLg || e.lg;
  const head = el("div", "lp-head");
  const chip = el("span", "lp-chip", t("lpClass", { v: level }));
  chip.style.background = LP_COLOR[level] || "#666";
  head.append(chip, el("b", null, t("lpShort" + level)));
  box.append(head, el("div", null, t("lpDesc" + level)));
  if (stations.length) {
    box.appendChild(el("div", "lp-sub", t("lpStations", { n: stations.length })));
    const ul = el("ul", "lp-stations");
    for (const s of stations.slice(0, 12)) ul.appendChild(el("li", null, lpStationLine(s)));
    box.appendChild(ul);
  }
  const a = el("a", null, t("lpLink") + " ↗");
  a.href = LP_PAGE + e.eid;
  a.target = "_blank";
  a.rel = "noopener";
  const p = el("div", "lp-link");
  p.appendChild(a);
  box.append(p, el("div", "chart-cap", t("lpNote")));
  body.appendChild(box);
}

export function renderDetail(e, { home, detail, messageKey, aftershocks, longPeriod }) {
  const body = $("detail-body");
  body.textContent = "";

  const top = el("div", "detail-top");
  top.appendChild(quakeChip(e, "chip big"));
  const head = el("div");
  head.style.minWidth = "0";
  head.append(
    el("h2", null, placeName(e)),
    el("div", "facts", t("whenAgo", { time: fmtTime(e.time), ago: ago(e.time) })),
    el("div", "facts", `${magText(e.mag)} · ${depthText(e.loc.depth)} · ${t("coords", { lat: +e.loc.lat.toFixed(2), lon: +e.loc.lon.toFixed(2) })}`),
  );
  if (home) head.appendChild(el("div", "facts", t("distFromMe", { d: Math.round(e.dist) })));
  top.appendChild(head);
  body.appendChild(top);

  if (e.source === "usgs") { renderAftershocks(body, e, aftershocks); renderUsgsNotes(body, e); return; }
  renderLongPeriod(body, e, longPeriod);

  if (!detail) {
    body.appendChild(el("div", "empty", t(messageKey || "loadingDetail")));
    renderAftershocks(body, e, aftershocks);
    return;
  }

  const comment = pick(detail.comment, detail.commentEn);
  if (comment) body.appendChild(el("div", "note", comment));

  // The station nearest to "my location" is the best guess at how it felt there.
  if (home && detail.stations.length) {
    let near = null, nearKm = Infinity;
    for (const s of detail.stations) {
      const d = km(home, s);
      if (d < nearKm) { near = s; nearKm = d; }
    }
    const mine = el("div", "note mine");
    // Reports list only stations that felt intensity 1 or more, so a far "nearest"
    // station means the shaking most likely wasn't felt here.
    if (nearKm <= NEARBY_STATION_KM) {
      mine.append(
        el("span", "lbl", t("nearestLbl")),
        document.createTextNode(t("nearestText", { name: pick(near.name, near.nameEn), d: roundKm(nearKm), int: intLabel(near.int) })),
      );
    } else {
      mine.append(el("span", "lbl", t("nearbyLbl")), document.createTextNode(t("nearbyNone", { km: NEARBY_STATION_KM })));
    }
    body.appendChild(mine);
  }

  renderAftershocks(body, e, aftershocks);

  if (!detail.cities.length) {
    body.appendChild(el("div", "empty", t("noCities")));
    return;
  }

  body.appendChild(el("div", "lbl groups-title", t("groupsTitle", { c: detail.cities.length, s: detail.stations.length })));
  for (const maxi of [...ORDER].reverse()) {
    const cities = detail.cities.filter((c) => c.int === maxi);
    if (!cities.length) continue;
    const group = el("div", "group");
    group.appendChild(chipEl(maxi));
    const box = el("div", "cities");
    const byPref = new Map();
    for (const c of cities) {
      const pref = pick(c.pref, c.prefEn);
      if (!byPref.has(pref)) byPref.set(pref, []);
      byPref.get(pref).push(pick(c.name, c.nameEn));
    }
    const lines = [...byPref].map(([pref, names]) => {
      const line = el("div");
      line.append(el("span", "pref", pref), document.createTextNode(names.join(t("nameSep"))));
      return line;
    });
    // Long lists of weak shaking fold away; the strong groups stay open.
    if (cities.length > 24) {
      const det = el("details");
      det.appendChild(el("summary", null, t("fold", { c: cities.length, p: byPref.size })));
      det.append(...lines);
      box.appendChild(det);
    } else {
      box.append(...lines);
    }
    group.appendChild(box);
    body.appendChild(group);
  }
}

/** What USGS says about one event, plus a link to its event page. */
function renderUsgsNotes(body, e) {
  const facts = el("div", "note");
  const lines = [];
  if (e.magType) lines.push(t("usgsMagType", { t: e.magType }));
  lines.push(t(e.status === "reviewed" ? "usgsReviewed" : "usgsAutomatic"));
  if (e.felt) lines.push(t("usgsFelt", { n: e.felt }));
  if (e.alert) lines.push(t("usgsAlert", { level: e.alert }));
  facts.textContent = lines.join("\n");
  body.appendChild(facts);
  if (e.tsunami) body.appendChild(el("div", "note mine", t("usgsTsunami")));
  if (e.url) {
    const p = el("div", "note");
    const a = el("a", null, t("usgsLink") + " ↗");
    a.href = e.url;
    a.target = "_blank";
    a.rel = "noopener";
    p.appendChild(a);
    body.appendChild(p);
  }
  body.appendChild(el("div", "note lbl", t("usgsNote")));
}

const SCOPE_KEY = { "24": "scope24", "168": "scope168", all: "scopeAll", year: "scopeYear" };

/**
 * Four summary tiles for the earthquakes currently shown. Labels say which
 * time range and intensity filter the numbers cover.
 */
export function renderStats(list, { home, periodHours, minRank, minMag, source }) {
  const top = list.reduce((a, b) => (!a || rank(b.maxi) > rank(a.maxi) ? b : a), null);
  const big = list.reduce((a, b) => (!a || (+b.mag || 0) > (+a.mag || 0) ? b : a), null);
  const scope = t(SCOPE_KEY[periodHours]);

  $("s-count").textContent = list.length;
  if (source === "usgs") {
    // USGS has no intensities: tiles show largest magnitude and deepest hypocenter.
    const deep = list.reduce((a, b) => (!a || (b.loc.depth ?? 0) > (a.loc.depth ?? 0) ? b : a), null);
    $("s-count-lbl").textContent = t("countMag", { scope, m: minMag });
    $("s-maxi").textContent = big && !isNaN(+big.mag) ? magText(big.mag) : "–";
    $("s-maxi-lbl").textContent = big ? `${t("largest")} · ${placeName(big)}` : t("largest");
    $("s-mag").textContent = deep ? `${Math.round(deep.loc.depth ?? 0)} km` : "–";
    $("s-mag-lbl").textContent = deep ? `${t("deepest")} · ${placeName(deep)}` : t("deepest");
  } else {
    $("s-count-lbl").textContent = minRank > 0
      ? t("countMin", { scope, v: intLabel(ORDER[minRank]) })
      : t("countFelt", { scope });
    $("s-maxi").textContent = top ? t("int", { v: intLabel(top.maxi) }) : "–";
    $("s-maxi-lbl").textContent = top ? `${t("strongest")} · ${placeName(top)}` : t("strongest");
    $("s-mag").textContent = big && !isNaN(+big.mag) ? magText(big.mag) : "–";
    $("s-mag-lbl").textContent = big ? `${t("largest")} · ${placeName(big)}` : t("largest");
  }
  if (home) {
    $("s-near").textContent = list.filter((e) => e.dist != null && e.dist <= NEAR_KM).length;
    $("s-near-lbl").textContent = t("nearCount", { km: NEAR_KM });
  } else {
    // Newest first, so list[0] is the latest earthquake.
    $("s-near").textContent = list.length ? ago(list[0].time) : "–";
    $("s-near-lbl").textContent = list.length ? `${t("latest")} · ${placeName(list[0])}` : t("latest");
  }
}

// ---- earthquake list ----
// Long lists (USGS · 1 year has ~2000 rows) render in pages so the page stays responsive,
// and one listener on the <ul> serves every row.

const LIST_PAGE = 200;
const listState = { items: [], byId: new Map(), shown: LIST_PAGE, onSelect: null, home: null, fresh: new Set(), bound: false };

const metaText = (e, home) => `${fmtTime(e.time)} · ${ago(e.time)}` + (home ? t("listDist", { d: Math.round(e.dist) }) : "");

function bindList() {
  const ul = $("list");
  const pickRow = (ev) => {
    const li = ev.target.closest("li[data-eid]");
    return li && listState.byId.get(li.dataset.eid);
  };
  ul.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-more]")) { listState.shown += LIST_PAGE; paintList(); return; }
    const e = pickRow(ev);
    if (e) listState.onSelect(e);
  });
  ul.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const e = pickRow(ev);
    if (e) { ev.preventDefault(); listState.onSelect(e); }
  });
  listState.bound = true;
}

export function renderList(list, { home, fresh, hasAny, onSelect }) {
  if (!listState.bound) bindList();
  Object.assign(listState, { items: list, home, fresh, onSelect, byId: new Map(list.map((e) => [e.eid, e])) });
  // A shorter list (new filter) starts again from one page; a refresh keeps what was opened.
  listState.shown = Math.max(LIST_PAGE, Math.min(listState.shown, list.length));
  const ul = $("list");
  if (!list.length) {
    ul.textContent = "";
    ul.appendChild(el("li", "empty", t(hasAny ? "emptyFiltered" : "emptyNone")));
    return;
  }
  paintList();
}

function paintList() {
  const { items, home, fresh, shown } = listState;
  const frag = document.createDocumentFragment();
  for (const e of items.slice(0, shown)) frag.appendChild(listItem(e, home, fresh.has(e.eid)));
  if (items.length > shown) {
    const li = el("li", "more");
    const b = el("button", null, t("showMore", { n: Math.min(LIST_PAGE, items.length - shown), left: items.length - shown }));
    b.type = "button";
    b.dataset.more = "1";
    li.appendChild(b);
    frag.appendChild(li);
  }
  $("list").replaceChildren(frag);
}

/** Rewrite only the "x minutes ago" part of each visible row. */
export function refreshListTimes(home) {
  for (const meta of $("list").querySelectorAll("li[data-eid] .meta")) {
    const e = listState.byId.get(meta.parentElement.parentElement.dataset.eid);
    if (e) meta.textContent = metaText(e, home);
  }
}

function listItem(e, home, isFresh) {
  const li = el("li", isFresh ? "fresh" : null);
  li.tabIndex = 0;
  li.dataset.eid = e.eid;

  const chip = quakeChip(e);
  chip.title = e.source === "usgs" ? depthText(e.loc.depth) : t("chipTitle");

  const mid = el("div");
  mid.style.minWidth = "0";
  const placeRow = el("div", "place-row");
  placeRow.appendChild(el("div", "place", placeName(e)));
  if (e.lg) {
    const badge = el("span", "lp-badge", t("lpBadge", { v: e.lg }));
    badge.style.background = LP_COLOR[e.lg] || "#666";
    badge.title = t("lpTitle");
    placeRow.appendChild(badge);
  }
  mid.append(placeRow, el("div", "meta", metaText(e, home)));

  const mag = el("div", "mag", magText(e.mag));
  mag.appendChild(el("small", null, depthText(e.loc.depth)));

  li.append(chip, mid, mag);
  return li;
}

// ---- alerts: Nankai Trough information and tsunami ----

const TS_LEVEL = { 4: "purple", 3: "red", 2: "amber", 1: "info", 0: "calm" };
const tsKindKey = (rank) => ["tsNoneKind", "tsForecast", "tsAdvisory", "tsWarning", "tsMajor"][rank] || "tsNoneKind";
const fmtHeight = (h) => (/^[<>]?\d/.test(h) ? `${h} m` : h);

/** The two chips under the header. `tsunami` is the list from fetchTsunamiList(). */
export function renderAlertsBar({ nankai, nankaiFailed, tsunami, tsunamiFailed }) {
  const nb = $("alert-nankai"), tb = $("alert-tsunami");
  if (nankaiFailed && !nankai) { nb.dataset.level = "unknown"; $("nankai-text").textContent = t("nkFailed"); }
  else if (!nankai) { nb.dataset.level = "unknown"; $("nankai-text").textContent = "…"; }
  else if (nankai.latest) {
    nb.dataset.level = nankai.latest.level;
    $("nankai-text").textContent = `${t(nankai.latest.state)} · ${fmtTime(nankai.latest.time)}`;
  } else { nb.dataset.level = "calm"; $("nankai-text").textContent = t("nkNone", { d: nankai.sinceDays }); }

  const cur = (tsunami || []).find((r) => r.current);
  if (tsunamiFailed && !tsunami) { tb.dataset.level = "unknown"; $("tsunami-text").textContent = t("tsFailed"); }
  else if (!tsunami) { tb.dataset.level = "unknown"; $("tsunami-text").textContent = "…"; }
  else if (cur) {
    tb.dataset.level = TS_LEVEL[cur.rank];
    $("tsunami-text").textContent = `${t(tsKindKey(cur.rank))} · ${t("tsAreas", { n: cur.areas })}`;
  } else { tb.dataset.level = "calm"; $("tsunami-text").textContent = t("tsNone"); }
}

function link(text, href) {
  const p = el("div", "lp-link");
  const a = el("a", null, text + " ↗");
  a.href = href; a.target = "_blank"; a.rel = "noopener";
  p.appendChild(a);
  return p;
}

/**
 * Alerts panel. `viewing` is the tsunami report shown in full, `viewingDetail`
 * its parsed areas (or {loading}/{failed}).
 */
export function renderAlertsView({ nankai, nankaiFailed, tsunami, viewing, viewingDetail }) {
  const body = $("alerts-body");
  body.textContent = "";

  // Nankai Trough
  const nk = el("section", "note al-sec");
  nk.id = "al-nankai";
  nk.appendChild(el("h3", null, t("nkLabel")));
  if (!nankai) {
    nk.appendChild(el("div", null, t(nankaiFailed ? "nkFailed" : "loadingList")));
  } else if (nankai.latest) {
    const st = el("span", "al-state", t(nankai.latest.state));
    st.dataset.level = nankai.latest.level;
    nk.append(st, el("div", "chart-cap", t("nkLatest", { time: fmtTime(nankai.latest.time) })));
    if (nankai.latest.text) nk.appendChild(el("div", "al-text", nankai.latest.text));
    nk.appendChild(el("div", "al-text", t("nkDesc" + nankai.latest.state)));
  } else {
    const st = el("span", "al-state", t("nkNone", { d: nankai.sinceDays }));
    st.dataset.level = "calm";
    nk.append(st, el("div", "al-text", t("nkNoneLong", { d: nankai.sinceDays })));
  }
  if (nankai?.explain) nk.appendChild(el("div", "chart-cap", t("nkExplain", { time: fmtTime(nankai.explain.time) })));
  nk.appendChild(el("div", "al-text", t("nkAbout")));
  if (nankai) nk.appendChild(el("div", "chart-cap", t("nkFeedNote", { d: nankai.sinceDays })));
  nk.appendChild(link(t("nkLink"), NANKAI_PAGE));
  body.appendChild(nk);

  // Tsunami
  const ts = el("section", "note al-sec");
  ts.id = "al-tsunami";
  const cur = (tsunami || []).find((r) => r.current);
  ts.appendChild(el("h3", null, t(cur ? "tsCurrentTitle" : "tsLatestTitle")));
  if (!cur) {
    const st = el("span", "al-state", t("tsNone"));
    st.dataset.level = "calm";
    ts.appendChild(st);
  }
  if (viewing) {
    const head = el("div", "al-text", t("tsReportHead", { place: placeName(viewing), mag: viewing.mag ? "M" + viewing.mag : "", time: fmtTime(viewing.time) }));
    const st = el("span", "al-state", t(tsKindKey(viewing.rank)));
    st.dataset.level = TS_LEVEL[viewing.rank];
    ts.append(head, st);
    if (!viewingDetail || viewingDetail.loading) ts.appendChild(el("div", null, t("tsLoading")));
    else if (viewingDetail.failed) ts.appendChild(el("div", null, t("tsDetailFailed")));
    else {
      const d = viewingDetail.data;
      const comment = pick(d.comment, d.commentEn);
      if (comment) ts.appendChild(el("div", "al-text", comment));
      const ul = el("ul", "al-areas");
      for (const a of d.areas) {
        const li = el("li");
        const sw = el("span", "al-swatch");
        sw.style.background = a.color;
        const parts = [pick(a.name, a.nameEn), t(a.key)];
        if (a.height) parts.push(t("tsHeight", { h: fmtHeight(a.height) }));
        if (a.arrival) parts.push(t("tsArrival", { t: fmtTime(a.arrival) }));
        else if (a.arrivalNote) parts.push(a.arrivalNote);
        li.append(sw, el("span", null, parts.join(" · ")));
        ul.appendChild(li);
      }
      ts.appendChild(ul);
    }
    if (viewing.current && viewing.rank >= 2) ts.appendChild(el("div", "al-advice", t("tsAdvice")));
  }
  // History
  ts.appendChild(el("div", "lp-sub", t("tsHistory")));
  if (!tsunami || !tsunami.length) ts.appendChild(el("div", "chart-cap", t("tsHistoryEmpty")));
  else {
    const ul = el("ul", "al-hist");
    for (const r of tsunami) {
      const li = el("li");
      const b = el("button", null, `${fmtTime(r.time)} · ${placeName(r)} · ${t(tsKindKey(r.rank))} · ${t("tsAreas", { n: r.areas })}`);
      b.type = "button";
      b.dataset.eid = r.eid;
      b.setAttribute("aria-pressed", String(viewing?.eid === r.eid));
      li.appendChild(b);
      ul.appendChild(li);
    }
    ts.appendChild(ul);
  }
  ts.appendChild(link(t("tsLink"), TSUNAMI_PAGE));
  body.appendChild(ts);
}

/** Tooltip for a tsunami area on the map. */
export const tsunamiAreaLabel = (a) =>
  [pick(a.name, a.nameEn), t(a.key), a.height ? t("tsHeight", { h: fmtHeight(a.height) }) : ""].filter(Boolean).join(" · ");
