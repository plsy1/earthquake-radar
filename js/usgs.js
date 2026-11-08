// USGS earthquake catalog for the area around Japan.
// Unlike JMA's list it includes unfelt and offshore earthquakes and can go back a year,
// but has no Japanese seismic intensities. Around Japan it is fairly complete from about M4.
import { USGS_BBOX, USGS_URL } from "./config.js";

/** Days of catalog to request for each period button. */
export const USGS_DAYS = { "24": 1, "168": 7, all: 30, year: 365 };

/** One GeoJSON feature -> the same shape the map and panel use for JMA events. */
function toEvent(f) {
  const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
  return {
    source: "usgs",
    eid: f.id,
    time: new Date(p.time),
    mag: p.mag == null ? "" : String(p.mag),
    magType: p.magType || "",
    maxi: "",
    anm: p.place || "",
    anmEn: p.place || "",
    loc: { lat, lon, depth: depth == null ? null : Math.round(depth * 10) / 10 },
    dist: 0,
    url: p.url || "",
    felt: p.felt || 0,
    tsunami: !!p.tsunami,
    alert: p.alert || "",
    status: p.status || "",
  };
}

export async function fetchUsgs({ days, minMag }) {
  const q = new URLSearchParams({
    format: "geojson",
    starttime: new Date(Date.now() - days * 86400e3).toISOString().slice(0, 19),
    minlatitude: USGS_BBOX.minLat, maxlatitude: USGS_BBOX.maxLat,
    minlongitude: USGS_BBOX.minLon, maxlongitude: USGS_BBOX.maxLon,
    minmagnitude: minMag,
    eventtype: "earthquake",
    orderby: "time",
    limit: 5000,
  });
  const res = await fetch(`${USGS_URL}?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return data.features.filter((f) => f.geometry?.coordinates?.length >= 2).map(toEvent);
}
