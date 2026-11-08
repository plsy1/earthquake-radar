// Leaflet map: base tiles, Nankai outline, home marker, earthquake circles.
import { COLOR, DARKTEXT, LABEL, NEAR_KM, ORDER, TILE_ATTRIBUTION, TILE_URL, UNKNOWN_COLOR, VIEWS } from "./config.js";
import { NANKAI } from "./nankai.js";
import { esc, rank } from "./util.js";

const L = window.L;
let map, nankaiLayer, homeLayer, quakeLayer;
let userMoved = false; // once true, resizes no longer refit the whole country
const markers = new Map();

export function initMap(el) {
  map = L.map(el, { zoomControl: true, preferCanvas: true }).fitBounds(VIEWS.jp.bounds);
  L.tileLayer(TILE_URL, { maxZoom: 18, minZoom: 4, attribution: TILE_ATTRIBUTION }).addTo(map);

  nankaiLayer = L.polygon(NANKAI, {
    color: "#c8322b", weight: 1.5, dashArray: "6 5", fillColor: "#c8322b", fillOpacity: 0.07, interactive: false,
  }).addTo(map);
  homeLayer = L.layerGroup().addTo(map);
  quakeLayer = L.layerGroup().addTo(map);

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
    const d = L.DomUtil.create("div", "legend");
    d.innerHTML = '最大震度 · 圆越大震级越高<div class="scale">' + ORDER.map((k) =>
      `<i style="background:${COLOR[k]};color:${DARKTEXT.has(k) ? "#1a1a1a" : "#fff"}">${LABEL[k]}</i>`).join("") + "</div>";
    return d;
  };
  legend.addTo(map);
}

export function setNankaiVisible(on) {
  on ? nankaiLayer.addTo(map) : map.removeLayer(nankaiLayer);
}

export function drawHome(home) {
  homeLayer.clearLayers();
  const at = [home.lat, home.lon];
  L.circle(at, { radius: NEAR_KM * 1000, color: "#5d6b7a", weight: 1, dashArray: "3 5", fill: false, interactive: false }).addTo(homeLayer);
  L.marker(at, {
    icon: L.divIcon({ className: "", html: '<div class="home"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }),
    keyboard: false, title: home.name,
  }).addTo(homeLayer);
  L.marker(at, {
    icon: L.divIcon({ className: "home-label", html: esc(home.name), iconSize: [64, 16], iconAnchor: [-8, 8] }),
    interactive: false, keyboard: false,
  }).addTo(homeLayer);
}

/** Draw one circle per earthquake; `list` is newest first. */
export function drawQuakes(list, popupFor) {
  quakeLayer.clearLayers();
  markers.clear();
  // Strongest and newest on top.
  const drawOrder = [...list].sort((a, b) => rank(a.maxi) - rank(b.maxi) || a.time - b.time);
  for (const e of drawOrder) {
    const m = +e.mag;
    const radius = isNaN(m) ? 5 : Math.max(4, 3 + m * 2.4);
    const c = L.circleMarker([e.loc.lat, e.loc.lon], {
      radius, color: "#222", weight: 0.8, fillColor: COLOR[e.maxi] || UNKNOWN_COLOR, fillOpacity: 0.88,
    }).bindPopup(() => popupFor(e));
    c.addTo(quakeLayer);
    markers.set(e.eid, c);
  }
  if (list.length) {
    const latest = list[0];
    L.marker([latest.loc.lat, latest.loc.lon], {
      icon: L.divIcon({ className: "", html: '<div class="pulse"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false, keyboard: false,
    }).addTo(quakeLayer);
  }
}

export function focusQuake(e) {
  userMoved = true;
  map.flyTo([e.loc.lat, e.loc.lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
  const mk = markers.get(e.eid);
  if (mk) setTimeout(() => mk.openPopup(), 850);
}

export function flyToView(key, home) {
  userMoved = true;
  if (key === "home") map.flyTo([home.lat, home.lon], 8, { duration: 0.8 });
  else if (VIEWS[key]) map.flyToBounds(VIEWS[key].bounds, { duration: 0.8 });
}

export function setPickCursor(on) {
  map.getContainer().style.cursor = on ? "crosshair" : "";
}

export function onMapClick(fn) {
  map.on("click", (ev) => fn(ev.latlng.lat, ev.latlng.lng));
}
