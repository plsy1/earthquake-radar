// Leaflet map: base tiles, Nankai outline, home marker, earthquake circles.
import {
  COLOR, DARKTEXT, DEPTH_BANDS, INUNDATION_ATTRIBUTION, INUNDATION_LEGEND, INUNDATION_URL, LP_COLOR,
  SHELTER_ATTRIBUTION, SHELTER_MIN_ZOOM, SHELTER_TYPES, SHELTER_URL, HEAT_SCRIPT, HISTORIC_URL, NEAR_KM, ORDER, PLATE_LABELS, PLATES_URL,
  TILE_ATTRIBUTION_URL, TRENCH_LABELS, UNKNOWN_COLOR, VIEWS, depthBand,
} from "./config.js";
import { initBasemap } from "./basemap.js";
import { getLang, intLabel, pick, placeName, t } from "./i18n.js";
import { NANKAI, NANKAI_SEGMENTS, clipLon } from "./nankai.js";
import { esc, rank } from "./util.js";

const L = window.L;

/** Animated moves divide by the map size; skip them while the map has no size (hidden page). */
const hasSize = () => { const z = map.getSize(); return z.x > 0 && z.y > 0; };
let map, nankaiLayer, homeLayer, quakeLayer, detailLayer;
let userMoved = false; // once true, resizes no longer refit the whole country
let legendEl, legendSource = "jma", attribution = "";
let platesLines = null, platesLabels = null, platesOn = false;
let segmentsLayer = null, segmentsOn = false;
let historicData = null, historicLayer = null, historicOn = false;
let heatLayer = null, heatOn = false, heatPoints = [];
let afterLayer = null, afterRenderer = null;   // aftershocks of the selected earthquake
let lpLayer = null;                             // long-period ground motion stations
let tsunamiLayer = null, tsunamiRenderer = null, tsunamiOn = false;
let inundationLayer = null;                                  // tsunami inundation scenario tiles
let shelterLayer = null, shelterRenderer = null, shelterType = null, onShelterStatus = null;
const shelterTiles = new Map();                              // "type/x/y" -> Promise<features>
let profileLayer = null, profileBtn = null;     // depth profile line and its map button

const attributionHtml = () => `<a href="${TILE_ATTRIBUTION_URL}" target="_blank" rel="noopener">${t("attribution")}</a>`;
const swatch = (bg, dark, text, wide) =>
  `<i style="background:${bg};color:${dark ? "#1a1a1a" : "#fff"}${wide ? ";width:auto;padding:0 6px" : ""}">${text}</i>`;
const legendHtml = () => (legendSource === "usgs"
  ? esc(t("legendDepth")) + '<div class="scale">' + DEPTH_BANDS.map((b) => swatch(b.color, b.dark, b.label, true)).join("") + "</div>"
  : esc(t("legend")) + '<div class="scale">' + ORDER.map((k) => swatch(COLOR[k], DARKTEXT.has(k), intLabel(k))).join("") + "</div>")
  + (platesOn ? `<div class="key">${esc(t("platesKey"))}</div>` : "")
  + (tsunamiOn ? `<div class="key">${esc(t("tsKey"))}</div>` : "")
  + (inundationLayer && map.hasLayer(inundationLayer)
    ? `<div class="key">${esc(t("inKey"))}</div><div class="scale">` +
      INUNDATION_LEGEND.map((b) => swatch(b.color, true, b.label, true)).join("") + `</div><div class="key">${esc(t("inNote"))}</div>`
    : "");

/** Circle color: JMA events by max intensity, USGS events by depth. */
export const quakeColor = (e) => (e.source === "usgs" ? depthBand(e.loc.depth).color : COLOR[e.maxi] || UNKNOWN_COLOR);

/** Create the map. Resolves (via the returned promise) once the base map has settled. */
export function initMap(el, { basemap, features }) {
  map = L.map(el, { zoomControl: true, preferCanvas: true }).fitBounds(VIEWS.jp.bounds);
  const basemapReady = initBasemap(map, basemap, features);
  attribution = attributionHtml();
  map.attributionControl.addAttribution(attribution);

  nankaiLayer = L.polygon(NANKAI, {
    color: "#c8322b", weight: 1.5, dashArray: "6 5", fillColor: "#c8322b", fillOpacity: 0.07, interactive: false,
  }).addTo(map);
  // Plate lines and labels sit under the earthquake circles.
  map.createPane("segments").style.zIndex = 340;
  map.createPane("plates").style.zIndex = 350;
  map.createPane("historic").style.zIndex = 620;
  // Aftershocks draw above station dots, on their own canvas.
  map.createPane("aftershocks").style.zIndex = 450;
  afterRenderer = L.canvas({ pane: "aftershocks" });
  afterLayer = L.layerGroup();
  lpLayer = L.layerGroup();
  // Tsunami coastlines sit above everything drawn on canvas so warnings stand out.
  map.createPane("tsunami").style.zIndex = 470;
  tsunamiRenderer = L.canvas({ pane: "tsunami" });
  tsunamiLayer = L.layerGroup().addTo(map);
  // Inundation tiles sit just above the base map; shelters above the earthquake circles.
  map.createPane("inundation").style.zIndex = 320;
  map.createPane("shelters").style.zIndex = 455;
  shelterRenderer = L.canvas({ pane: "shelters" });
  shelterLayer = L.layerGroup().addTo(map);
  map.on("moveend", () => { if (shelterType) loadShelters(); });
  profileLayer = L.layerGroup().addTo(map);
  // Segment names stay readable above the earthquake circles; they ignore the pointer.
  map.createPane("topLabels").style.zIndex = 610;
  map.getPane("topLabels").style.pointerEvents = "none";
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
    if (!userMoved && map.getSize().y > 50) presetMove(() => map.fitBounds(VIEWS.jp.bounds));
  }).observe(el);
  // Any move that isn't one of the preset views means no preset is current any more.
  map.on("movestart", () => { if (!movingToPreset && onViewChange) onViewChange(null); });

  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = () => {
    legendEl = L.DomUtil.create("div", "legend");
    legendEl.innerHTML = legendHtml();
    return legendEl;
  };
  legend.addTo(map);

  // "Profile" button under the zoom control opens the depth profile panel.
  const pc = L.control({ position: "topleft" });
  pc.onAdd = () => {
    const wrap = L.DomUtil.create("div", "leaflet-bar profile-ctl");
    profileBtn = L.DomUtil.create("button", "", wrap);
    profileBtn.type = "button";
    profileBtn.textContent = t("profileBtn");
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.on(profileBtn, "click", () => onProfileClick && onProfileClick());
    return wrap;
  };
  pc.addTo(map);
  return basemapReady;
}

/** Show the intensity scale (JMA) or the depth scale (USGS). */
export function setLegendSource(source) {
  legendSource = source;
  if (legendEl) legendEl.innerHTML = legendHtml();
}

// ---- Nankai segments (1707 / 1854 / 1944–46 ruptures) ----

function buildSegments() {
  const g = L.layerGroup();
  for (const s of NANKAI_SEGMENTS) {
    L.polygon(clipLon(NANKAI, s.minLon, s.maxLon), {
      pane: "segments", interactive: false, color: s.color, weight: 1.2, fillColor: s.color, fillOpacity: 0.2,
    }).addTo(g);
    L.marker(s.label, {
      pane: "topLabels", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "segment-label", html: esc(t(s.key)).replace(/\n/g, "<br>"), iconSize: null, iconAnchor: [0, 0] }),
    }).addTo(g);
  }
  return g;
}

export function setSegmentsVisible(on) {
  segmentsOn = on;
  if (segmentsLayer) map.removeLayer(segmentsLayer);
  segmentsLayer = on ? buildSegments().addTo(map) : null;
}

// ---- historic earthquakes (static file, loaded on first use) ----

function historicPopup(ev) {
  const lang = getLang();
  const nf = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-GB");
  const facts = [ev.date, "M" + ev.mag];
  if (ev.maxInt) facts.push(t("histInt", { v: intLabel(ev.maxInt) }));
  const toll = ev.tollPlus ? t("tollPlus", { n: nf.format(ev.tollPlus) }) : t("toll", { n: nf.format(ev.toll) });
  return `<b>${esc(ev.name[lang] || ev.name.en)}</b><br>${esc(facts.join(" · "))}<br>${esc(toll)}` +
    `<div class="hist-note">${esc(ev.note[lang] || ev.note.en)}</div><div class="hist-src">${esc(t("histApprox"))}</div>`;
}

function buildHistoric() {
  const g = L.layerGroup();
  for (const ev of historicData.events) {
    const year = ev.date.slice(0, 4);
    L.marker([ev.lat, ev.lon], {
      pane: "historic", keyboard: true, title: ev.name[getLang()] || ev.name.en,
      icon: L.divIcon({ className: "hist", html: `<span class="hist-dot"></span><span class="hist-year">${year}</span>`, iconSize: [16, 16], iconAnchor: [8, 8] }),
    }).bindPopup(() => historicPopup(ev), { maxWidth: 280 }).addTo(g);
  }
  return g;
}

/** Show or hide historic earthquakes; resolves false if the data could not be loaded. */
export async function setHistoricVisible(on) {
  historicOn = on;
  if (on && !historicData) {
    try {
      const res = await fetch(HISTORIC_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      historicData = await res.json();
    } catch (err) {
      historicOn = false;
      return false;
    }
  }
  if (historicLayer) map.removeLayer(historicLayer);
  historicLayer = historicOn ? buildHistoric().addTo(map) : null;
  return true;
}

// ---- density heatmap (Leaflet.heat, loaded on first use) ----

let heatScript = null;
function loadHeatScript() {
  if (!heatScript) {
    heatScript = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = HEAT_SCRIPT;
      s.onload = () => resolve();
      s.onerror = () => { heatScript = null; reject(new Error("heat script")); };
      document.head.appendChild(s);
    });
  }
  return heatScript;
}

/** Larger earthquakes count for more, but every event adds some heat. */
const heatWeight = (e) => Math.min(1, 0.25 + Math.max(0, (+e.mag || 2) - 2) * 0.15);

/** Points for the heatmap: whatever earthquakes are currently shown. */
export function setHeatPoints(list) {
  heatPoints = list.map((e) => [e.loc.lat, e.loc.lon, heatWeight(e)]);
  if (heatLayer) heatLayer.setLatLngs(heatPoints);
}

/** Show or hide the heatmap; resolves false if the plugin could not be loaded. */
export async function setHeatVisible(on) {
  heatOn = on;
  if (on && !heatLayer) {
    try { await loadHeatScript(); } catch (err) { heatOn = false; return false; }
    heatLayer = L.heatLayer(heatPoints, {
      radius: 24, blur: 20, maxZoom: 9, minOpacity: 0.25,
      gradient: { 0.3: "#2c7fb8", 0.55: "#ffd166", 0.8: "#f4762d", 1: "#c0262d" },
    });
  }
  if (heatOn) heatLayer.addTo(map);
  else if (heatLayer) map.removeLayer(heatLayer);
  return true;
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
  if (profileBtn) profileBtn.textContent = t("profileBtn");
  if (legendEl) legendEl.innerHTML = legendHtml();
  if (platesLabels) {
    map.removeLayer(platesLabels);
    platesLabels = buildPlateLabels();
    if (platesOn) platesLabels.addTo(map);
  }
  if (segmentsOn) setSegmentsVisible(true);
  if (shelterType) loadShelters(); // tooltips carry hazard names
  if (historicOn && historicData) setHistoricVisible(true);
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
  afterLayer.clearLayers();
  afterLayer.addTo(map);
  lpLayer.clearLayers();
  lpLayer.addTo(map);
  addEpicenter(e);
  if (hasSize()) map.flyTo([e.loc.lat, e.loc.lon], Math.max(map.getZoom(), 7), { duration: 0.8 });
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
  if (pts.length > 1 && hasSize()) map.flyToBounds(L.latLngBounds(pts).pad(0.15), { duration: 0.8, maxZoom: 10 });
}

export function exitDetail() {
  map.removeLayer(detailLayer);
  detailLayer.clearLayers();
  map.removeLayer(afterLayer);
  afterLayer.clearLayers();
  map.removeLayer(lpLayer);
  lpLayer.clearLayers();
  quakeLayer.addTo(map);
}

/**
 * Color the coastline of each tsunami forecast area by its category.
 * `areas` come from fetchTsunamiDetail(), `shapes` from fetchTsunamiAreas().
 */
export function drawTsunami(areas, shapes, labelFor) {
  tsunamiLayer.clearLayers();
  const byCode = new Map(areas.map((a) => [a.code, a]));
  for (const f of shapes.features) {
    const a = byCode.get(String(f.properties.code));
    if (!a || a.rank === 0) continue;
    L.geoJSON(f, {
      renderer: tsunamiRenderer,
      style: { color: a.color, weight: a.rank >= 2 ? 7 : 5, opacity: 0.95, lineCap: "round", lineJoin: "round" },
    }).bindTooltip(esc(labelFor(a)), { sticky: true }).addTo(tsunamiLayer);
  }
  tsunamiOn = tsunamiLayer.getLayers().length > 0;
  if (legendEl) legendEl.innerHTML = legendHtml();
}

export function clearTsunami() {
  tsunamiLayer.clearLayers();
  tsunamiOn = false;
  if (legendEl) legendEl.innerHTML = legendHtml();
}

// ---- tsunami inundation scenario ----

export function setInundationVisible(on) {
  if (!inundationLayer) {
    inundationLayer = L.tileLayer(INUNDATION_URL, { pane: "inundation", opacity: 0.75, minZoom: 4, maxZoom: 18, maxNativeZoom: 17, minNativeZoom: 2 });
  }
  if (on && !map.hasLayer(inundationLayer)) { inundationLayer.addTo(map); map.attributionControl.addAttribution(INUNDATION_ATTRIBUTION); }
  if (!on && map.hasLayer(inundationLayer)) { map.removeLayer(inundationLayer); map.attributionControl.removeAttribution(INUNDATION_ATTRIBUTION); }
  if (legendEl) legendEl.innerHTML = legendHtml();
}

// ---- designated emergency evacuation sites ----

/** Hazards a site is designated for (properties disaster1…disaster8). */
const HAZARD_KEYS = ["", "hzFlood", "hzSlope", "hzSurge", "hzQuake", "hzTsunami", "hzFire", "hzInland", "hzVolcano"];
export const shelterHazards = (p) => HAZARD_KEYS.filter((k, i) => k && p["disaster" + i]).map((k) => t(k));

export const setShelterHandler = (fn) => { onShelterStatus = fn; };

/** Show sites for one hazard type ("quake", "tsunami", …), or null to hide them. */
export function setShelterType(type) {
  const was = shelterType;
  shelterType = type && SHELTER_TYPES[type] ? type : null;
  if (!was && shelterType) map.attributionControl.addAttribution(SHELTER_ATTRIBUTION);
  if (was && !shelterType) map.attributionControl.removeAttribution(SHELTER_ATTRIBUTION);
  shelterLayer.clearLayers();
  if (shelterType) loadShelters();
  else onShelterStatus && onShelterStatus({ state: "off" });
}

function shelterTile(code, x, y) {
  const key = `${code}/${x}/${y}`;
  if (!shelterTiles.has(key)) {
    const url = SHELTER_URL.replace("{type}", code).replace("{x}", x).replace("{y}", y);
    const p = fetch(url)
      .then((r) => (r.status === 404 ? { features: [] } : r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((d) => d.features || []);
    p.catch(() => shelterTiles.delete(key));
    shelterTiles.set(key, p);
  }
  return shelterTiles.get(key);
}

let shelterRequest = 0;
async function loadShelters() {
  const type = shelterType, req = ++shelterRequest;
  if (map.getZoom() < SHELTER_MIN_ZOOM) {
    shelterLayer.clearLayers();
    onShelterStatus && onShelterStatus({ state: "zoomIn" });
    return;
  }
  // Zoom-10 tiles covering the view.
  const b = map.getBounds(), n = 1024;
  const tx = (lon) => Math.floor(((lon + 180) / 360) * n);
  const ty = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
  const jobs = [];
  for (let x = tx(b.getWest()); x <= tx(b.getEast()); x++) {
    for (let y = ty(b.getNorth()); y <= ty(b.getSouth()); y++) jobs.push(shelterTile(SHELTER_TYPES[type], x, y));
  }
  onShelterStatus && onShelterStatus({ state: "loading" });
  try {
    const tiles = await Promise.all(jobs);
    if (req !== shelterRequest || type !== shelterType) return; // superseded by a newer move or type
    shelterLayer.clearLayers();
    let count = 0;
    for (const features of tiles) {
      for (const f of features) {
        const [lon, lat] = f.geometry?.coordinates || [];
        if (lat == null || !b.contains([lat, lon])) continue;
        const p = f.properties || {};
        L.circleMarker([lat, lon], {
          renderer: shelterRenderer, radius: 5.5, color: "#fff", weight: 1.5, fillColor: "#15803d", fillOpacity: 1,
        }).bindTooltip(`<b>${esc(p.name || "")}</b><br>${esc(p.address || "")}<br>${esc(t("shFor", { list: shelterHazards(p).join(t("nameSep")) }))}`, { direction: "top" })
          .addTo(shelterLayer);
        count++;
      }
    }
    onShelterStatus && onShelterStatus({ state: "ok", count });
  } catch (err) {
    if (req === shelterRequest) onShelterStatus && onShelterStatus({ state: "failed" });
  }
}

/** Stations that reached long-period class 1+, as numbered squares above the intensity dots. */
export function drawLongPeriod(stations, labelFor) {
  lpLayer.clearLayers();
  for (const s of stations) {
    L.marker([s.lat, s.lon], {
      pane: "historic", keyboard: false,
      icon: L.divIcon({ className: "", html: `<span class="lp-mark" style="background:${LP_COLOR[s.lg] || "#666"}">${esc(s.lg)}</span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
    }).bindTooltip(esc(labelFor(s)), { direction: "top" }).addTo(lpLayer);
  }
}

/** Aftershocks of the selected earthquake as hollow rings, inside a dashed search circle. */
export function drawAftershocks(main, list, radiusKm, tooltipFor) {
  afterLayer.clearLayers();
  L.circle([main.loc.lat, main.loc.lon], {
    radius: radiusKm * 1000, renderer: afterRenderer, interactive: false,
    color: "#b0127a", weight: 1.2, dashArray: "5 5", fill: false,
  }).addTo(afterLayer);
  for (const e of list) {
    const mag = +e.mag || 1;
    L.circleMarker([e.loc.lat, e.loc.lon], {
      renderer: afterRenderer, radius: Math.max(3, 1.5 + (mag - 1) * 1.4),
      color: "#b0127a", weight: 1.4, fillColor: "#fff", fillOpacity: 0.7,
    }).bindTooltip(tooltipFor(e), { direction: "top" }).addTo(afterLayer);
  }
}

// ---- depth profile line ----

let onProfileClick = null;
export const setProfileHandler = (fn) => { onProfileClick = fn; };

const endIcon = (label) => L.divIcon({ className: "profile-end", html: label, iconSize: [18, 18], iconAnchor: [9, 9] });

/** Draw A (and B when known) with the searched band around the line. */
export function drawProfile(A, B, band) {
  profileLayer.clearLayers();
  if (band) {
    L.polygon(band, { interactive: false, color: "#2c6fbb", weight: 1, dashArray: "4 4", fillColor: "#2c6fbb", fillOpacity: 0.08 }).addTo(profileLayer);
  }
  if (A && B) L.polyline([[A.lat, A.lon], [B.lat, B.lon]], { interactive: false, color: "#2c6fbb", weight: 2.5 }).addTo(profileLayer);
  if (A) L.marker([A.lat, A.lon], { icon: endIcon("A"), interactive: false, keyboard: false }).addTo(profileLayer);
  if (B) L.marker([B.lat, B.lon], { icon: endIcon("B"), interactive: false, keyboard: false }).addTo(profileLayer);
}

export function clearProfile() { profileLayer.clearLayers(); }

export function fitProfile(band) {
  userMoved = true;
  if (hasSize()) map.flyToBounds(L.latLngBounds(band).pad(0.1), { duration: 0.8 });
}

function addEpicenter(e) {
  L.marker([e.loc.lat, e.loc.lon], {
    icon: L.divIcon({ className: "", html: `<div class="epi" aria-label="${esc(t("epicenter"))}"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
    keyboard: false, title: `${t("epicenter")} · ${placeName(e)}`, zIndexOffset: 1000,
  }).addTo(detailLayer);
}

// ---- preset views (Japan, Tokai–Nankai, around my location) ----

let movingToPreset = false, onViewChange = null;
export const setViewChangeHandler = (fn) => { onViewChange = fn; };

/** Run a move that lands on a preset view without reporting it as "moved away". */
function presetMove(fn) {
  movingToPreset = true;
  fn();
  setTimeout(() => { movingToPreset = false; }, 1200); // flights take 0.8 s
}

export function flyToView(key, home) {
  if (!hasSize()) return;
  userMoved = true;
  if (key === "home") { if (home) presetMove(() => map.flyTo([home.lat, home.lon], 8, { duration: 0.8 })); }
  else if (VIEWS[key]) presetMove(() => map.flyToBounds(VIEWS[key].bounds, { duration: 0.8 }));
}

export function setPickCursor(on) {
  map.getContainer().style.cursor = on ? "crosshair" : "";
}

export function onMapClick(fn) {
  map.on("click", (ev) => fn(ev.latlng.lat, ev.latlng.lng));
}
