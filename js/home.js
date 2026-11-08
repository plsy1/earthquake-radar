// "My location": stored only in this browser's localStorage.
import { DEFAULT_HOME, HOME_KEY } from "./config.js";

export const defaultHome = () => ({ ...DEFAULT_HOME });

export function loadHome() {
  try {
    const h = JSON.parse(localStorage.getItem(HOME_KEY) || "null");
    if (h && isFinite(h.lat) && isFinite(h.lon)) return { lat: +h.lat, lon: +h.lon, name: "我的位置" };
  } catch (_) { /* storage blocked or corrupt: fall back to default */ }
  return defaultHome();
}

/** Save a picked point, or pass null to forget it. */
export function saveHome(home) {
  try {
    if (home) localStorage.setItem(HOME_KEY, JSON.stringify({ lat: home.lat, lon: home.lon }));
    else localStorage.removeItem(HOME_KEY);
  } catch (_) { /* storage unavailable: the choice lasts until reload */ }
}

export const pickedHome = (lat, lon) => ({ lat: +lat.toFixed(4), lon: +lon.toFixed(4), name: "我的位置" });
