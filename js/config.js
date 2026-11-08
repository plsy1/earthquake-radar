// Settings and constants shared by every module.

export const SRC = "https://www.jma.go.jp/bosai/quake/data/list.json";
// Each report in the list names a detail file under this folder.
export const DETAIL_BASE = "https://www.jma.go.jp/bosai/quake/data/";
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

export const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION_URL = "https://maps.gsi.go.jp/development/ichiran.html";
