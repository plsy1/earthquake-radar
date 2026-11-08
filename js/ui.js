// Side panel: status line, controls, summary numbers, earthquake list, detail.
import { COLOR, DARKTEXT, NEAR_KM, NEARBY_STATION_KM, ORDER, UNKNOWN_COLOR, depthBand } from "./config.js";
import { ago, depthText, fmtTime, intLabel, magText, pick, placeName, t } from "./i18n.js";
import { $, esc, km, rank } from "./util.js";

export function setStatus(text, ok) {
  $("status").textContent = text;
  $("dot").classList.toggle("err", !ok);
}

export function setHomeLabel(home) {
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
const LAYER_IDS = ["plates", "historic", "heat"];

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
  const b = $("pick-home");
  b.setAttribute("aria-pressed", String(on));
  b.textContent = t(on ? "picking" : "pick");
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
  });
}

/** Switch the side panel between the earthquake list and one earthquake's detail. */
export function showDetailView(on) {
  $("overview").hidden = on;
  $("detail").hidden = !on;
  if (on) $("detail").scrollTop = 0;
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
export function renderDetail(e, { home, detail, messageKey }) {
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

  if (e.source === "usgs") { renderUsgsNotes(body, e); return; }

  if (!detail) {
    body.appendChild(el("div", "empty", t(messageKey || "loadingDetail")));
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

export function renderList(list, { home, fresh, hasAny, onSelect }) {
  const ul = $("list");
  ul.textContent = "";
  if (!list.length) {
    ul.appendChild(el("li", "empty", t(hasAny ? "emptyFiltered" : "emptyNone")));
    return;
  }
  for (const e of list) ul.appendChild(listItem(e, home, fresh.has(e.eid), onSelect));
}

function listItem(e, home, isFresh, onSelect) {
  const li = el("li", isFresh ? "fresh" : null);
  li.tabIndex = 0;

  const chip = quakeChip(e);
  chip.title = e.source === "usgs" ? depthText(e.loc.depth) : t("chipTitle");

  const mid = el("div");
  mid.style.minWidth = "0";
  const meta = `${fmtTime(e.time)} · ${ago(e.time)}` + (home ? t("listDist", { d: Math.round(e.dist) }) : "");
  mid.append(el("div", "place", placeName(e)), el("div", "meta", meta));

  const mag = el("div", "mag", magText(e.mag));
  mag.appendChild(el("small", null, depthText(e.loc.depth)));

  li.append(chip, mid, mag);
  li.addEventListener("click", () => onSelect(e));
  li.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(e); }
  });
  return li;
}
