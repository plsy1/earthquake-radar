// Settings and constants shared by every module.

export const SRC = "https://www.jma.go.jp/bosai/quake/data/list.json";
// Each report in the list names a detail file under this folder.
export const DETAIL_BASE = "https://www.jma.go.jp/bosai/quake/data/";
// Long-period ground motion reports (only quakes with class 1 or more appear).
export const LP_LIST = "https://www.jma.go.jp/bosai/ltpgm/data/list.json";
export const LP_BASE = "https://www.jma.go.jp/bosai/ltpgm/data/";
export const LP_PAGE = "https://www.data.jma.go.jp/eew/data/ltpgm/event.php?eventId=";
// Tsunami reports and the coastline segments of JMA's tsunami forecast areas.
export const TSUNAMI_LIST = "https://www.jma.go.jp/bosai/tsunami/data/list.json";
export const TSUNAMI_BASE = "https://www.jma.go.jp/bosai/tsunami/data/";
export const TSUNAMI_AREAS = "https://www.jma.go.jp/bosai/common/const/geojson/tsunami.json";
export const TSUNAMI_PAGE = "https://www.jma.go.jp/bosai/map.html#contents=tsunami";
// Nankai Trough notices come through JMA's long XML feed (about a week of entries).
export const NANKAI_FEED = "https://www.data.jma.go.jp/developer/xml/feed/eqvol_l.xml";
export const NANKAI_PAGE = "https://www.jma.go.jp/jma/kishou/know/jishin/nteq/index.html";
export const ALERTS_REFRESH_MS = 60_000;

// Earthquake Early Warnings (緊急地震速報), relayed live by two free, unofficial services.
// P2P地震情報 pushes warnings (警報) only; Wolfx pushes every forecast (予報) and warning.
export const EEW_P2P_WS = "wss://api.p2pquake.net/v2/ws";
export const EEW_P2P_LAST = "https://api.p2pquake.net/v2/history?codes=556&limit=1";
export const EEW_WOLFX_WS = "wss://ws-api.wolfx.jp/jma_eew";
export const EEW_WOLFX_LAST = "https://api.wolfx.jp/jma_eew.json";
export const EEW_ALERT_KEY = "quake-radar.eewAlert";
// Typical P and S wave speeds near Japan (km/s), for wave fronts and arrival estimates.
export const VP = 7, VS = 4;
export const NANKAI_REFRESH_MS = 5 * 60_000;
// Designated emergency evacuation sites (GSI). One GeoJSON file per hazard type, only at zoom 10.
export const SHELTER_URL = "https://cyberjapandata.gsi.go.jp/xyz/skhb{type}/10/{x}/{y}.geojson";
export const SHELTER_TYPES = { quake: "04", tsunami: "05", fire: "06", flood: "01" };
export const SHELTER_MIN_ZOOM = 12; // below this a view would need too many ~350 KB tiles
export const SHELTER_ATTRIBUTION = '<a href="https://www.gsi.go.jp/bousaichiri/hinanbasho.html" target="_blank" rel="noopener">指定緊急避難場所：国土地理院</a>';
// Tsunami inundation scenarios from the hazard map portal (prefecture data; some prefectures missing).
export const INUNDATION_URL = "https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png";
export const INUNDATION_ATTRIBUTION = '<a href="https://disaportal.gsi.go.jp/" target="_blank" rel="noopener">出典：ハザードマップポータルサイト</a>';
// National unified legend for tsunami inundation depth (m), checked against the tiles' colors.
export const INUNDATION_LEGEND = [
  { label: "<0.3", color: "#ffffb3" }, { label: "0.3–1", color: "#f7f5a9" }, { label: "1–2", color: "#f8e1a6" },
  { label: "2–3", color: "#ffd8c0" }, { label: "3–5", color: "#ffb7b7" }, { label: "5–10", color: "#ff9191" },
  { label: "10–20", color: "#f285c9" }, { label: "20+", color: "#dc7adc" },
];
// Colors for long-period classes 1–4.
export const LP_COLOR = { "1": "#3aa6b9", "2": "#f2b134", "3": "#e8590c", "4": "#a61e4d" };
export const REFRESH_MS = 60_000;

// USGS catalog (FDSN event service), limited to the area around Japan.
export const USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query";
export const USGS_BBOX = { minLat: 20, maxLat: 50, minLon: 120, maxLon: 156 };
// A year of data is large; refresh it less often.
export const USGS_YEAR_REFRESH_MS = 10 * 60_000;

// USGS view colors circles by hypocenter depth (km), shallow = warm.
export const DEPTH_BANDS = [
  { max: 30, label: "<30", color: "#d7301f", dark: false },
  { max: 70, label: "30–70", color: "#fc8d59", dark: true },
  { max: 150, label: "70–150", color: "#fee08b", dark: true },
  { max: 300, label: "150–300", color: "#91cf60", dark: true },
  { max: Infinity, label: "300+", color: "#4575b4", dark: false },
];
export const depthBand = (d) => DEPTH_BANDS.find((b) => (d ?? 0) < b.max) || DEPTH_BANDS[0];
export const NEAR_KM = 100;
// In the detail panel, the closest station within this distance stands in for "my location".
export const NEARBY_STATION_KM = 40;

// "My location" is optional. A viewer can set it from the browser's location or
// by clicking the map; it is kept only in their browser.
export const HOME_KEY = "quake-radar.home";

// JMA seismic-intensity classes, weakest first.
export const ORDER = ["1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];
// JMA's standard seismic-intensity colors.
export const COLOR = { "1": "#F2F2FF", "2": "#00AAFF", "3": "#0041FF", "4": "#FAE696", "5-": "#FFE600", "5+": "#FF9900", "6-": "#FF2800", "6+": "#A50021", "7": "#B40068" };
export const UNKNOWN_COLOR = "#9aa5b1";
// Intensity colors light enough to need dark text on top.
export const DARKTEXT = new Set(["1", "4", "5-", "5+"]);

export const VIEWS = {
  jp: { bounds: [[30.0, 128.5], [45.6, 146.0]] },
  tokai: { bounds: [[31.0, 131.0], [36.3, 139.6]] },
};

// Plate boundary overlay (PB2002, clipped to Japan in data/plates.json) and its labels.
export const PLATES_URL = "data/plates.json";
export const PLATE_LABELS = [
  { key: "plPA", lat: 36.5, lon: 151.0 },
  { key: "plPS", lat: 26.5, lon: 134.5 },
  { key: "plOK", lat: 47.5, lon: 146.0 },
  { key: "plAM", lat: 41.5, lon: 129.5 },
  { key: "plON", lat: 27.8, lon: 125.6 },
];
export const TRENCH_LABELS = [
  { key: "trKuril", lat: 42.4, lon: 147.6 },
  { key: "trJapan", lat: 38.3, lon: 144.6 },
  { key: "trIzu", lat: 30.0, lon: 143.0 },
  { key: "trNankai", lat: 32.3, lon: 135.6 },
  { key: "trRyukyu", lat: 25.6, lon: 129.4 },
];

// GSI base maps. Light and standard are vector maps (GSI optimized vector tiles) with raster
// fallbacks; aerial and terrain are raster with vector features drawn on top.
// Flat maps are inverted in dark mode; photos and terrain are not.
// Terrain (colored elevation) has no sea tiles and starts at zoom 5, so it sits on the light map.
const GSI = "https://cyberjapandata.gsi.go.jp/xyz/";
export const VECTOR_STYLE_URL = "https://gsi-cyberjapan.github.io/optimal_bvmap/style/std.json";
// Vector map libraries, loaded after the page is up (MapLibre first: the others build on it).
export const VECTOR_LIBS = {
  css: "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css",
  maplibre: "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js",
  pmtiles: "https://cdn.jsdelivr.net/npm/pmtiles@3.2.1/dist/pmtiles.js",
  bridge: "https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js",
};
export const BASEMAPS = {
  pale: { vector: true, invertDark: true, fallback: [{ url: GSI + "pale/{z}/{x}/{y}.png", maxNativeZoom: 18 }] },
  std: { vector: true, invertDark: true, fallback: [{ url: GSI + "std/{z}/{x}/{y}.png", maxNativeZoom: 18 }] },
  photo: { layers: [{ url: GSI + "seamlessphoto/{z}/{x}/{y}.jpg", maxNativeZoom: 18 }], invertDark: false },
  relief: {
    layers: [
      { url: GSI + "pale/{z}/{x}/{y}.png", maxNativeZoom: 18 },
      { url: GSI + "relief/{z}/{x}/{y}.png", minNativeZoom: 5, maxNativeZoom: 15, opacity: 0.85 },
    ],
    invertDark: false,
  },
};

// Historic earthquakes (static file) and the heatmap plugin, both loaded on first use.
export const HISTORIC_URL = "data/historic.json";
export const HEAT_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js";
export const TILE_ATTRIBUTION_URL = "https://maps.gsi.go.jp/development/ichiran.html";
