// "My location": optional, stored only in this browser's localStorage.
import { HOME_KEY } from "./config.js";

/** The saved location, or null when the viewer hasn't set one. */
export function loadHome() {
  try {
    const h = JSON.parse(localStorage.getItem(HOME_KEY) || "null");
    if (h && isFinite(h.lat) && isFinite(h.lon)) return makeHome(h.lat, h.lon);
  } catch (_) { /* storage blocked or corrupt: treat as not set */ }
  return null;
}

/** Save a location, or pass null to forget it. */
export function saveHome(home) {
  try {
    if (home) localStorage.setItem(HOME_KEY, JSON.stringify({ lat: home.lat, lon: home.lon }));
    else localStorage.removeItem(HOME_KEY);
  } catch (_) { /* storage unavailable: the choice lasts until reload */ }
}

/** Rounded to about 10 m; that is plenty for distances to epicenters. */
export const makeHome = (lat, lon) => ({ lat: +(+lat).toFixed(4), lon: +(+lon).toFixed(4), name: "我的位置" });

/**
 * Ask the browser for the current position. Resolves to a home, or rejects
 * with a message to show the viewer.
 */
export function locateBrowser() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject("这个浏览器不支持获取位置"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(makeHome(pos.coords.latitude, pos.coords.longitude)),
      (err) => reject(
        err.code === err.PERMISSION_DENIED ? "没有获得位置权限，可以改用「在地图上选择」"
          : err.code === err.TIMEOUT ? "获取位置超时，请再试一次"
          : "无法获取当前位置"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}
