// Settings and constants shared by every module.

export const SRC = "https://www.jma.go.jp/bosai/quake/data/list.json";
// Each report in the list names a detail file under this folder.
export const DETAIL_BASE = "https://www.jma.go.jp/bosai/quake/data/";
export const REFRESH_MS = 60_000;
export const NEAR_KM = 100;
// In the detail panel, the closest station within this distance stands in for "my location".
export const NEARBY_STATION_KM = 40;

// "My location" is optional. A viewer can set it from the browser's location or
// by clicking the map; it is kept only in their browser.
export const HOME_KEY = "quake-radar.home";

// JMA seismic-intensity classes, weakest first.
export const ORDER = ["1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];
export const LABEL = { "1": "1", "2": "2", "3": "3", "4": "4", "5-": "5弱", "5+": "5强", "6-": "6弱", "6+": "6强", "7": "7" };
// JMA's standard seismic-intensity colors.
export const COLOR = { "1": "#F2F2FF", "2": "#00AAFF", "3": "#0041FF", "4": "#FAE696", "5-": "#FFE600", "5+": "#FF9900", "6-": "#FF2800", "6+": "#A50021", "7": "#B40068" };
export const UNKNOWN_COLOR = "#9aa5b1";
// Intensity colors light enough to need dark text on top.
export const DARKTEXT = new Set(["1", "4", "5-", "5+"]);

export const VIEWS = {
  jp: { bounds: [[30.0, 128.5], [45.6, 146.0]] },
  tokai: { bounds: [[31.0, 131.0], [36.3, 139.6]] },
};

export const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';
