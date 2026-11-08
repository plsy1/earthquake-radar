// Leaflet map: base tiles, Nankai outline, home marker, earthquake circles.
import {
  COLOR, DARKTEXT, DEPTH_BANDS, NEAR_KM, ORDER, PLATE_LABELS, PLATES_URL, TILE_ATTRIBUTION_URL, TILE_URL,
  TRENCH_LABELS, UNKNOWN_COLOR, VIEWS, depthBand,
} from "./config.js";
import { intLabel, pick, placeName, t } from "./i18n.js";
import { NANKAI } from "./nankai.js";
import { esc, rank } from "./util.js";

const L = window.L;
let map, nankaiLayer, homeLayer, quakeLayer, detailLayer;
let userMoved = false; // once true, resizes no longer refit the whole country
let legendEl, legendSource = "jma", attribution = "";
let platesLines = null, platesLabels = null, platesOn = false;

const attributionHtml = () => `<a href="${TILE_ATTRIBUTION_URL}" target="_blank" rel="noopener">${t("attribution")}</a>`;
const swatch = (bg, dark, text, wide) =>
  `<i style="background:${bg};color:${dark ? "#1a1a1a" : "#fff"}${wide ? ";width:auto;padding:0 6px" : ""}">${text}</i>`;
const legendHtml = () => (legendSource === "usgs"
  ? esc(t("legendDepth")) + '<div class="scale">' + DEPTH_BANDS.map((b) => swatch(b.color, b.dark, b.label, true)).join("") + "</div>"
  : esc(t("legend")) + '<div class="scale">' + ORDER.map((k) => swatch(COLOR[k], DARKTEXT.has(k), intLabel(k))).join("") + "</div>")
  + (platesOn ? `<div class="key">${esc(t("platesKey"))}</div>` : "");

/** Circle color: JMA events by max intensity, USGS events by depth. */
export const quakeColor = (e) => (e.source === "usgs" ? depthBand(e.loc.depth).color : COLOR[e.maxi] || UNKNOWN_COLOR);

export function initMap(el) {
  map = L.map(el, { zoomControl: true, preferCanvas: true }).fitBounds(VIEWS.jp.bounds);
  L.tileLayer(TILE_URL, { maxZoom: 18, minZoom: 4 }).addTo(map);
  attribution = attributionHtml();
  map.attributionControl.addAttribution(attribution);

  nankaiLayer = L.polygon(NANKAI, {
    color: "#c8322b", weight: 1.5, dashArray: "6 5", fillColor: "#c8322b", fillOpacity: 0.07, interactive: false,
  }).addTo(map);
  // Plate lines and labels sit under the earthquake circles.
  map.createPane("plates").style.zIndex = 350;
  map.createPane("plateLabels").style.zIndex = 390;
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

/** Show the intensity scale (JMA) or the depth scale (USGS). */
export function setLegendSource(source) {
  legendSource = source;
  if (legendEl) legendEl.innerHTML = legendHtml();
}

// ---- plate boundaries (loaded on first use) ----

function buildPlateLabels() {
  const g = L.layerGroup();
  const add = (list, cls) => {
    for (const p of list) {
      L.marker([p.lat, p.lon], {
        pane: "plateLabels", interactive: false, keyboard: false,
        icon: L.divIcon({ className: cls, html: esc(t(p.key)), iconSize: null, iconAnchor: [0, 0] }),
      }).addTo(g);
    }
  };
  add(PLATE_LABELS, "plate-label");
  add(TRENCH_LABELS, "trench-label");
  return g;
}

/** Show or hide plate boundaries; resolves false if the data could not be loaded. */
export async function setPlatesVisible(on) {
  platesOn = on;
  if (on && !platesLines) {
    try {
      const res = await fetch(PLATES_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      platesLines = L.geoJSON(data, {
        pane: "plates", interactive: false,
        style: (f) => (f.properties.type === "subduction"
          ? { color: "#b5452a", weight: 2.6, opacity: 0.9 }
          : { color: "#8a5a44", weight: 1.4, opacity: 0.8, dashArray: "5 5" }),
      });
    } catch (err) {
      platesOn = false;
      return false;
    }
  }
  if (!platesLabels) platesLabels = buildPlateLabels();
  if (platesOn) { platesLines.addTo(map); platesLabels.addTo(map); }
  else if (platesLines) { map.removeLayer(platesLines); map.removeLayer(platesLabels); }
  if (legendEl) legendEl.innerHTML = legendHtml();
  return true;
}

/** Re-label the legend, plate names and attribution after a language change. */
export function refreshMapLanguage() {
  if (legendEl) legendEl.innerHTML = legendHtml();
  if (platesLabels) {
    map.removeLayer(platesLabels);
    platesLabels = buildPlateLabels();
    if (platesOn) platesLabels.addTo(map);
  }
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
  // Strongest (or largest) and newest on top.
  const drawOrder = [...list].sort((a, b) => rank(a.maxi) - rank(b.maxi) || (+a.mag || 0) - (+b.mag || 0) || a.time - b.time);
  for (const e of drawOrder) {
    const m = +e.mag;
    const radius = isNaN(m) ? 5 : Math.max(4, 3 + m * 2.4);
    const c = L.circleMarker([e.loc.lat, e.loc.lon], {
      radius, color: "#222", weight: 0.8, fillColor: quakeColor(e), fillOpacity: 0.88,
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
