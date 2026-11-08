// Side panel: status line, controls, summary numbers, earthquake list.
import { COLOR, DARKTEXT, LABEL, NEAR_KM, NEARBY_STATION_KM, ORDER, UNKNOWN_COLOR } from "./config.js";
import { $, ago, depthText, esc, fmtTime, km, magText, rank } from "./util.js";

export function setStatus(text, ok) {
  $("status").textContent = text;
  $("dot").classList.toggle("err", !ok);
}

export function setHomeLabel(home) {
  $("home-name").textContent = home.name;
  $("s-near-lbl").textContent = `距${home.name}${NEAR_KM}km以内`;
}

export function setPickButton(on) {
  const b = $("pick-home");
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "点击地图上的位置…" : "在地图上选择";
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
  return `<b>${esc(e.anm || "震源不明")}</b> · ${magText(e.mag)} · 最大震度${LABEL[e.maxi] || "–"}<br>` +
    `${fmtTime.format(e.time)}（${ago(e.time)}）· 点击查看各地震度`;
}

/** Switch the side panel between the earthquake list and one earthquake's detail. */
export function showDetailView(on) {
  $("overview").hidden = on;
  $("detail").hidden = !on;
  if (on) $("detail").scrollTop = 0;
}

function chipEl(maxi, cls = "chip") {
  const c = document.createElement("div");
  c.className = cls;
  c.style.background = COLOR[maxi] || UNKNOWN_COLOR;
  c.style.color = DARKTEXT.has(maxi) ? "#1a1a1a" : "#fff";
  c.textContent = LABEL[maxi] || "–";
  return c;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * Detail panel for one earthquake. `detail` is the parsed JMA report, or absent
 * while loading; `message` replaces the intensity section (loading or error text).
 */
export function renderDetail(e, { home, detail, message }) {
  const body = $("detail-body");
  body.textContent = "";

  const top = el("div", "detail-top");
  top.appendChild(chipEl(e.maxi, "chip big"));
  const head = el("div");
  head.style.minWidth = "0";
  head.append(
    el("h2", null, e.anm || "震源不明"),
    el("div", "facts", `${fmtTime.format(e.time)}（${ago(e.time)}）`),
    el("div", "facts", `${magText(e.mag)} · ${depthText(e.loc.depth)} · 北纬${e.loc.lat} 东经${e.loc.lon}`),
    el("div", "facts", `距${home.name}约 ${Math.round(e.dist)} km`),
  );
  top.appendChild(head);
  body.appendChild(top);

  if (!detail) {
    body.appendChild(el("div", "empty", message || "正在读取各地震度…"));
    return;
  }

  if (detail.comment) body.appendChild(el("div", "note", detail.comment));

  // The station nearest to "my location" is the best guess at how it felt there.
  if (detail.stations.length) {
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
        el("span", "lbl", `离${home.name}最近的观测点`),
        document.createTextNode(`${near.name}（约 ${nearKm < 10 ? nearKm.toFixed(1) : Math.round(nearKm)} km）：震度${LABEL[near.int]}`),
      );
    } else {
      mine.append(
        el("span", "lbl", `${home.name}附近`),
        document.createTextNode(`${NEARBY_STATION_KM} km 以内没有观测点记录到震度1以上，那里应该基本感觉不到。`),
      );
    }
    body.appendChild(mine);
  }

  if (!detail.cities.length) {
    body.appendChild(el("div", "empty", "这次报告里没有各地的震度。"));
    return;
  }

  body.appendChild(el("div", "lbl groups-title", `各地震度 · ${detail.cities.length} 个市区町村 · ${detail.stations.length} 个观测点`));
  for (const maxi of [...ORDER].reverse()) {
    const cities = detail.cities.filter((c) => c.int === maxi);
    if (!cities.length) continue;
    const group = el("div", "group");
    group.appendChild(chipEl(maxi));
    const box = el("div", "cities");
    const lines = [];
    const byPref = new Map();
    for (const c of cities) {
      if (!byPref.has(c.pref)) byPref.set(c.pref, []);
      byPref.get(c.pref).push(c.name);
    }
    for (const [pref, names] of byPref) {
      const line = el("div");
      line.append(el("span", "pref", pref), document.createTextNode(names.join("、")));
      lines.push(line);
    }
    // Long lists of weak shaking fold away; the strong groups stay open.
    if (cities.length > 24) {
      const det = el("details");
      det.appendChild(el("summary", null, `${cities.length} 个市区町村，${byPref.size} 个都道府县（展开）`));
      det.append(...lines);
      box.appendChild(det);
    } else {
      box.append(...lines);
    }
    group.appendChild(box);
    body.appendChild(group);
  }
}

export function renderStats(list) {
  const top = list.reduce((a, b) => (!a || rank(b.maxi) > rank(a.maxi) ? b : a), null);
  const big = list.reduce((a, b) => (!a || (+b.mag || 0) > (+a.mag || 0) ? b : a), null);
  $("s-count").textContent = list.length;
  $("s-maxi").textContent = top ? "震度" + (LABEL[top.maxi] || "–") : "–";
  $("s-maxi-at").textContent = top ? top.anm : "最大震度";
  $("s-mag").textContent = big && !isNaN(+big.mag) ? magText(big.mag) : "–";
  $("s-mag-at").textContent = big ? big.anm : "最大震级";
  $("s-near").textContent = list.filter((e) => e.dist <= NEAR_KM).length;
}

export function renderList(list, { home, fresh, hasAny, onSelect }) {
  const ul = $("list");
  ul.textContent = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = hasAny ? "这个范围内没有符合条件的地震。换一个时间范围或震度试试。" : "暂时没有数据。";
    ul.appendChild(li);
    return;
  }
  for (const e of list) ul.appendChild(listItem(e, home, fresh.has(e.eid), onSelect));
}

function listItem(e, home, isFresh, onSelect) {
  const li = document.createElement("li");
  li.tabIndex = 0;
  if (isFresh) li.className = "fresh";

  const chip = chipEl(e.maxi);
  chip.title = "最大震度";

  const mid = document.createElement("div");
  mid.style.minWidth = "0";
  const place = document.createElement("div");
  place.className = "place";
  place.textContent = e.anm || "震源不明";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${fmtTime.format(e.time)} · ${ago(e.time)} · 距${home.name}${Math.round(e.dist)}km`;
  mid.append(place, meta);

  const mag = document.createElement("div");
  mag.className = "mag";
  mag.textContent = magText(e.mag);
  const depth = document.createElement("small");
  depth.textContent = depthText(e.loc.depth);
  mag.appendChild(depth);

  li.append(chip, mid, mag);
  li.addEventListener("click", () => onSelect(e));
  li.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect(e); }
  });
  return li;
}
