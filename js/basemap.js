// Base map. The light and standard maps are GSI's optimized vector tiles, drawn by
// MapLibre inside Leaflet, so map features (place names, rivers, roads…) can be
// switched on and off. Aerial and terrain are raster tiles with the chosen vector
// features drawn on top. If WebGL or the vector style is unavailable, the page
// falls back to GSI's raster light/standard maps without feature switches.
import { BASEMAPS, VECTOR_STYLE_URL } from "./config.js";

const L = window.L;

/** Feature groups the viewer can switch, matched by vector tile layer. */
export const FEATURE_GROUPS = ["labels", "rivers", "roads", "rail", "boundaries", "buildings", "terrain"];
const GROUP_OF_SOURCE = {
  RvrCL: "rivers", WL: "rivers", WStrL: "rivers", WStrA: "rivers", WRltLine: "rivers",
  RdCL: "roads", RdCompt: "roads", RdEdg: "roads",
  RailCL: "rail", RailTrCL: "rail",
  AdmBdry: "boundaries",
  BldA: "buildings", StrctArea: "buildings", StrctLine: "buildings", PwrTrnsmL: "buildings",
  Cntr: "terrain", Isbt: "terrain", TpgphLine: "terrain", TpgphArea: "terrain",
};
function groupOf(layer) {
  const src = layer["source-layer"];
  if (src === "Anno") return layer.id === "注記道路番号" ? "roads" : "labels"; // route numbers go with roads
  return GROUP_OF_SOURCE[src] || "base"; // background, land, sea, coastline: always drawn
}

let map, glLayer = null, rasterLayer = null;
let lowZoom = false;        // vector tiles start at zoom 4, i.e. Leaflet zoom 5
const VECTOR_MIN_ZOOM = 5;
let baseStyle = null;       // GSI style as downloaded, each layer tagged with its group
let vectorFailed = false;
let current = "pale";
let features = {};          // group -> visible

// ---- light variant: desaturate and lighten the standard style's colors ----

const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
function soften(color, desat, light) {
  const m = RGBA.exec(color);
  if (!m) return color;
  const [r, g, b] = [+m[1], +m[2], +m[3]], a = m[4] ?? 1;
  const gray = 0.3 * r + 0.59 * g + 0.11 * b;
  const f = (c) => Math.round(c + (gray - c) * desat + (255 - (c + (gray - c) * desat)) * light);
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}
/** Walk a paint value (string or expression) and soften every color in it. */
function softenValue(v, desat, light) {
  if (typeof v === "string") return soften(v, desat, light);
  if (Array.isArray(v)) return v.map((x) => softenValue(x, desat, light));
  return v;
}
function lightPaint(paint, group) {
  const out = {};
  for (const [k, v] of Object.entries(paint || {})) {
    if (!/color/.test(k)) { out[k] = v; continue; }
    // Text stays readable; land and sea keep a hint of color; other lines and fills fade to gray.
    out[k] = k === "text-color" ? softenValue(v, 0.35, 0.12)
      : k === "text-halo-color" ? v
      : group === "base" ? softenValue(v, 0.35, 0.2)
      : softenValue(v, 0.6, 0.38);
  }
  return out;
}

/** Style for one base map: color variant, feature visibility, and overlay mode for raster bases. */
function buildStyle(key) {
  const overlay = !BASEMAPS[key].vector; // aerial / terrain: draw only lines and labels
  const light = key === "pale";
  return {
    ...baseStyle,
    layers: baseStyle.layers
      .filter((l) => !(overlay && (l.type === "background" || (l.type === "fill" && (l._group === "base" || l._group === "terrain")))))
      .map((l) => {
        const { _group, ...layer } = l;
        const on = _group === "base" ? true : !!features[_group];
        return {
          ...layer,
          paint: light ? lightPaint(layer.paint, _group) : (layer.paint || {}),
          layout: { ...(layer.layout || {}), visibility: on ? "visible" : "none" },
        };
      }),
  };
}

// ---- raster pieces ----

function rasterFor(key) {
  const def = BASEMAPS[key];
  // Vector bases use their raster twin when vector tiles are unavailable, or when zoomed
  // out past the vector tiles' first level.
  const layers = def.vector ? (vectorFailed || lowZoom ? def.fallback : []) : def.layers;
  if (!layers.length) return null;
  return L.layerGroup(layers.map((l) => L.tileLayer(l.url, {
    minZoom: 4, maxZoom: 18, maxNativeZoom: l.maxNativeZoom, minNativeZoom: l.minNativeZoom,
    opacity: l.opacity ?? 1, zIndex: 1,
  })));
}

function applyBase() {
  if (rasterLayer) map.removeLayer(rasterLayer);
  rasterLayer = rasterFor(current);
  if (rasterLayer) rasterLayer.addTo(map);
  if (glLayer) {
    glLayer.getMaplibreMap().setStyle(buildStyle(current));
    // Below the first vector level the vector canvas would only paint its background.
    glLayer.getContainer().style.visibility = lowZoom && BASEMAPS[current].vector ? "hidden" : "";
  }
  // Only flat maps are inverted for dark mode; photos and terrain keep their colors.
  map.getContainer().classList.toggle("basemap-invert", BASEMAPS[current].invertDark);
}

// ---- public ----

/** True when map features can be switched (vector tiles loaded). */
export const featuresAvailable = () => !!glLayer;

/**
 * Start with a raster placeholder, then load the vector style. Resolves true when
 * the vector map is in place, false when the page stays on raster tiles.
 */
export async function initBasemap(leafletMap, key, initialFeatures) {
  map = leafletMap;
  current = key;
  features = { ...initialFeatures };
  vectorFailed = true; // raster placeholder until the vector map is ready
  lowZoom = map.getZoom() < VECTOR_MIN_ZOOM;
  applyBase();
  map.on("zoomend", () => {
    const low = map.getZoom() < VECTOR_MIN_ZOOM;
    if (low !== lowZoom) { lowZoom = low; applyBase(); }
  });
  try {
    const gl = window.maplibregl, pm = window.pmtiles;
    if (!gl || !pm || !L.maplibreGL) throw new Error("vector libraries missing");
    if (typeof gl.supported === "function" && !gl.supported()) throw new Error("no WebGL");
    const protocol = new pm.Protocol();
    gl.addProtocol("pmtiles", protocol.tile);
    const res = await fetch(VECTOR_STYLE_URL);
    if (!res.ok) throw new Error("style HTTP " + res.status);
    const style = await res.json();
    style.layers = style.layers.map((l) => ({ ...l, _group: groupOf(l) }));
    baseStyle = style;
    vectorFailed = false;
    glLayer = L.maplibreGL({ style: buildStyle(current), interactive: false, attributionControl: false });
    glLayer.addTo(map);
    glLayer.getContainer().style.zIndex = 5; // above raster tiles, below everything else
    // Swap the placeholder out once the first vector frame is drawn.
    glLayer.getContainer().style.visibility = lowZoom && BASEMAPS[current].vector ? "hidden" : "";
    glLayer.getMaplibreMap().once("idle", () => {
      if (rasterLayer && BASEMAPS[current].vector && !lowZoom) { map.removeLayer(rasterLayer); rasterLayer = null; }
    });
    return true;
  } catch (err) {
    vectorFailed = true;
    glLayer = null;
    applyBase();
    return false;
  }
}

export function setBasemap(key) {
  if (!BASEMAPS[key]) return;
  current = key;
  applyBase();
}

export function setFeatureVisible(group, on) {
  features[group] = on;
  if (glLayer) glLayer.getMaplibreMap().setStyle(buildStyle(current));
}
