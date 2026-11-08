// Leaflet map: base tiles, Nankai outline, home marker, earthquake circles.
import { COLOR, DARKTEXT, NEAR_KM, ORDER, TILE_ATTRIBUTION_URL, TILE_URL, UNKNOWN_COLOR, VIEWS } from "./config.js";
import { intLabel, pick, placeName, t } from "./i18n.js";
import { NANKAI } from "./nankai.js";
import { esc, rank } from "./util.js";

const L = window.L;
let map, nankaiLayer, homeLayer, quakeLayer, detailLayer;
let userMoved = false; // once true, resizes no longer refit the whole country
let legendEl, attribution = "";

const attributionHtml = () => `<a href="${TILE_ATTRIBUTION_URL}" target="_blank" rel="noopener">${t("attribution")}</a>`;
const legendHtml = () => esc(t("legend")) + '<div class="scale">' + ORDER.map((k) =>
  `<i style="background:${COLOR[k]};color:${DARKTEXT.has(k) ? "#1a1a1a" : "#fff"}">${intLabel(k)}</i>`).join("") + "</div>";

export function initMap(el) {
  map = L.map(el, { zoomControl: true, preferCanvas: true }).fitBounds(VIEWS.jp.bounds);
  L.tileLayer(TILE_URL, { maxZoom: 18, minZoom: 4 }).addTo(map);
  attribution = attributionHtml();
  map.attributionControl.addAttribution(attribution);

  nankaiLayer = L.polygon(NANKAI, {
    color: "#c8322b", weight: 1.5, dashArray: "6 5", fillColor: "#c8322b", fillOpacity: 0.07, interactive: false,
  }).addTo(map);
  homeLayer = L.layerGroup().addTo(map);
  quakeLayer = L.layerGroup().addTo(map);
  detailLayer = L.layerGroup();

  // The container can get its real size only after Leaflet starts (or while the tab is
  // hidden). Keep fitting all of Japan on resize until the viewer moves the map.
  for (const t of ["mousedown", "touchstart", "wheel", "keydown"]) {
    el.addEventListener(t, () => { userMoved = true; }, { passive: true, once: true });
  }
  new ResizeObserver(() => {
    map.invalidateSize();
    if (!userMoved && map.getSize().y > 50) map.fitBounds(VIEWS.jp.bounds);
  }).observe(el);

  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = () => {
    legendEl = L.DomUtil.create("div", "legend");
    legendEl.innerHTML = legendHtml();
    return legendEl;
  };
  legend.addTo(map);
}

/** Re-label the legend and attribution after a language change. */
export function refreshMapLanguage() {
  if (legendEl) legendEl.innerHTML = legendHtml();
  map.attributionControl.removeAttribution(attribution);
  attribution = attributionHtml();
  map.attributionControl.addAttribution(attribution);
}

export function setNankaiVisible(on) {
  on ? nankaiLayer.addTo(map) : map.removeLayer(nankaiLayer);
}

export function drawHome(home) {
  homeLayer.clearLayers();
  if (!home) return;
  const at = [home.lat, home.lon];
  L.circle(at, { radius: NEAR_KM * 1000, color: "#5d6b7a", weight: 1, dashArray: "3 5", fill: false, interactive: false }).addTo(homeLayer);
  L.marker(at, {
    icon: L.divIcon({ className: "", html: '<div class="home"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }),
    keyboard: false, title: t("home"),
  }).addTo(homeLayer);
  L.marker(at, {
    icon: L.divIcon({ className: "home-label", html: esc(t("home")), iconSize: [96, 16], iconAnchor: [-8, 8] }),
    interactive: false, keyboard: false,
  }).addTo(homeLayer);
}

/** Draw one circle per earthquake; `list` is newest first. Clicking a circle selects it. */
export function drawQuakes(list, { tooltipFor, onSelect }) {
  quakeLayer.clearLayers();
  // Strongest and newest on top.
  const drawOrder = [...list].sort((a, b) => rank(a.maxi) - rank(b.maxi) || a.time - b.time);
  for (const e of drawOrder) {
    const m = +e.mag;
    const radius = isNaN(m) ? 5 : Math.max(4, 3 + m * 2.4);
    const c = L.circleMarker([e.loc.lat, e.loc.lon], {
      radius, color: "#222", weight: 0.8, fillColor: COLOR[e.maxi] || UNKNOWN_COLOR, fillOpacity: 0.88,
    }).bindTooltip(() => tooltipFor(e), { direction: "top", offset: [0, -radius] })
      .on("click", () => onSelect(e));
    c.addTo(quakeLayer);
  }
  if (list.length) {
    const latest = list[0];
    L.marker([latest.loc.lat, latest.loc.lon], {
      icon: L.divIcon({ className: "", html: '<div class="pulse"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false, keyboard: false,
    }).addTo(quakeLayer);
  }
}

// ---- detail mode: one earthquake's epicenter and every station's intensity ----

/** Hide the other earthquakes and mark the selected epicenter. */
export function enterDetail(e) {
  userMoved = true;
  map.removeLayer(quakeLayer);
  detailLayer.clearLayers();
  detailLayer.addTo(map);
  addEpicenter(e);
  map.flyTo([e.loc.lat, e.loc.lon], Math.max(map.getZoom(), 7), { duration: 0.8 });
}

/** Plot station readings, weakest first so strong ones sit on top, and frame the shaking. */
export function drawStations(e, stations) {
  detailLayer.clearLayers();
  const sorted = [...stations].sort((a, b) => rank(a.int) - rank(b.int));
  for (const s of sorted) {
    const r = rank(s.int);
    L.circleMarker([s.lat, s.lon], {
      radius: 3.5 + r * 0.7, color: "#333", weight: 0.6, fillColor: COLOR[s.int] || UNKNOWN_COLOR, fillOpacity: 0.95,
    }).bindTooltip(t("station", { name: esc(pick(s.name, s.nameEn)), int: intLabel(s.int) }), { direction: "top" })
      .addTo(detailLayer);
  }
  addEpicenter(e);

  // Frame stations of intensity 3 and up when there are enough; otherwise all of them.
  const strong = stations.filter((s) => rank(s.int) >= 2);
  const pts = (strong.length >= 3 ? strong : stations).map((s) => [s.lat, s.lon]);
  pts.push([e.loc.lat, e.loc.lon]);
  if (pts.length > 1) map.flyToBounds(L.latLngBounds(pts).pad(0.15), { duration: 0.8, maxZoom: 10 });
}

export function exitDetail() {
  map.removeLayer(detailLayer);
  detailLayer.clearLayers();
  quakeLayer.addTo(map);
}

function addEpicenter(e) {
  L.marker([e.loc.lat, e.loc.lon], {
    icon: L.divIcon({ className: "", html: `<div class="epi" aria-label="${esc(t("epicenter"))}"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
    keyboard: false, title: `${t("epicenter")} · ${placeName(e)}`, zIndexOffset: 1000,
  }).addTo(detailLayer);
}

export function flyToView(key, home) {
  userMoved = true;
  if (key === "home") { if (home) map.flyTo([home.lat, home.lon], 8, { duration: 0.8 }); }
  else if (VIEWS[key]) map.flyToBounds(VIEWS[key].bounds, { duration: 0.8 });
}

export function setPickCursor(on) {
  map.getContainer().style.cursor = on ? "crosshair" : "";
}

export function onMapClick(fn) {
  map.on("click", (ev) => fn(ev.latlng.lat, ev.latlng.lng));
}
