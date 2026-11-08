// "My location": optional, stored only in this browser's localStorage.
import { HOME_KEY } from "./config.js";

/** The saved location, or null when the viewer hasn't set one. */
export function loadHome() {
  try {
    const h = JSON.parse(localStorage.getItem(HOME_KEY) || "null");
    if (h && isFinite(h.lat) && isFinite(h.lon)) return makeHome(h.lat, h.lon, h.via);
  } catch (_) { /* storage blocked or corrupt: treat as not set */ }
  return null;
}

/** Save a location, or pass null to forget it. */
export function saveHome(home) {
  try {
    if (home) localStorage.setItem(HOME_KEY, JSON.stringify({ lat: home.lat, lon: home.lon, via: home.via }));
    else localStorage.removeItem(HOME_KEY);
  } catch (_) { /* storage unavailable: the choice lasts until reload */ }
}

/**
 * Rounded to about 10 m; that is plenty for distances to epicenters.
 * `via` records how it was set: "gps" (browser location) or "map" (picked on the map).
 */
export const makeHome = (lat, lon, via) => ({ lat: +(+lat).toFixed(4), lon: +(+lon).toFixed(4), via: via || null });

/**
 * Ask the browser for the current position. Resolves to a home, or rejects
 * with an i18n key describing why it failed.
 */
export function locateBrowser() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject("geoUnsupported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(makeHome(pos.coords.latitude, pos.coords.longitude, "gps")),
      (err) => reject(
        err.code === err.PERMISSION_DENIED ? "geoDenied" : err.code === err.TIMEOUT ? "geoTimeout" : "geoFailed"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}
