// Side panel: status line, controls, summary numbers, earthquake list.
import { COLOR, DARKTEXT, LABEL, NEAR_KM, UNKNOWN_COLOR } from "./config.js";
import { $, ago, depthText, esc, fmtTime, magText, rank } from "./util.js";

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

export function popupHtml(e, home) {
  return `<b>${esc(e.anm || "震源不明")}</b><br>${fmtTime.format(e.time)}（${ago(e.time)}）<br>` +
    `${magText(e.mag)} · ${depthText(e.loc.depth)} · 最大震度 ${LABEL[e.maxi] || "–"}<br>` +
    `距${esc(home.name)}约 ${Math.round(e.dist)} km`;
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

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.style.background = COLOR[e.maxi] || UNKNOWN_COLOR;
  chip.style.color = DARKTEXT.has(e.maxi) ? "#1a1a1a" : "#fff";
  chip.textContent = LABEL[e.maxi] || "–";
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
