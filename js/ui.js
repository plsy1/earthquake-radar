// Side panel: status line, controls, summary numbers, earthquake list, detail.
import { COLOR, DARKTEXT, NEAR_KM, NEARBY_STATION_KM, ORDER, UNKNOWN_COLOR } from "./config.js";
import { ago, depthText, fmtTime, intLabel, magText, pick, placeName, t } from "./i18n.js";
import { $, esc, km, rank } from "./util.js";

export function setStatus(text, ok) {
  $("status").textContent = text;
  $("dot").classList.toggle("err", !ok);
}

export function setHomeLabel(home) {
  $("home-name").textContent = t(home ? "homeSet" : "homeUnset");
  $("reset-home").hidden = !home;
  const viewBtn = document.querySelector('#view button[data-v="home"]');
  viewBtn.disabled = !home;
  viewBtn.title = home ? "" : t("homeFirst");
}

/** Short notes next to the location controls, e.g. while asking the browser. */
export function setHomeNote(text) {
  $("home-name").textContent = text;
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

export function tooltipHtml(e) {
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
  top.appendChild(chipEl(e.maxi, "chip big"));
  const head = el("div");
  head.style.minWidth = "0";
  head.append(
    el("h2", null, placeName(e)),
    el("div", "facts", t("whenAgo", { time: fmtTime(e.time), ago: ago(e.time) })),
    el("div", "facts", `${magText(e.mag)} · ${depthText(e.loc.depth)} · ${t("coords", { lat: e.loc.lat, lon: e.loc.lon })}`),
  );
  if (home) head.appendChild(el("div", "facts", t("distFromMe", { d: Math.round(e.dist) })));
  top.appendChild(head);
  body.appendChild(top);

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

const SCOPE_KEY = { "24": "scope24", "168": "scope168", all: "scopeAll" };

/**
 * Four summary tiles for the earthquakes currently shown. Labels say which
 * time range and intensity filter the numbers cover.
 */
export function renderStats(list, { home, periodHours, minRank }) {
  const top = list.reduce((a, b) => (!a || rank(b.maxi) > rank(a.maxi) ? b : a), null);
  const big = list.reduce((a, b) => (!a || (+b.mag || 0) > (+a.mag || 0) ? b : a), null);
  const scope = t(SCOPE_KEY[periodHours]);

  $("s-count").textContent = list.length;
  $("s-count-lbl").textContent = minRank > 0
    ? t("countMin", { scope, v: intLabel(ORDER[minRank]) })
    : t("countFelt", { scope });
  $("s-maxi").textContent = top ? t("int", { v: intLabel(top.maxi) }) : "–";
  $("s-maxi-lbl").textContent = top ? `${t("strongest")} · ${placeName(top)}` : t("strongest");
  $("s-mag").textContent = big && !isNaN(+big.mag) ? magText(big.mag) : "–";
  $("s-mag-lbl").textContent = big ? `${t("largest")} · ${placeName(big)}` : t("largest");
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

  const chip = chipEl(e.maxi);
  chip.title = t("chipTitle");

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
