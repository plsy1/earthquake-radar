// Calculations on the loaded earthquakes: aftershocks of one event and depth profiles.
import { km } from "./util.js";

/**
 * Search radius for aftershocks. The aftershock zone grows with magnitude
 * (roughly 10^(0.5M − 1.8) km); double it and keep it between 20 and 300 km.
 */
export function aftershockRadiusKm(mag) {
  const m = isNaN(+mag) || mag === "" ? 5 : +mag;
  return Math.round(Math.min(300, Math.max(20, 2 * 10 ** (0.5 * m - 1.8))));
}

/** Earthquakes after `main` within its aftershock radius, oldest first. */
export function findAftershocks(main, events) {
  const radiusKm = aftershockRadiusKm(main.mag);
  const list = events
    .filter((e) => e.eid !== main.eid && e.time > main.time && km(main.loc, e.loc) <= radiusKm)
    .sort((a, b) => a.time - b.time);
  return { radiusKm, list };
}

// ---- depth profile along a line A → B ----
// Points are projected onto a flat plane centred on the line (good to a few km over ~1500 km).

function plane(A, B) {
  const lat0 = (A.lat + B.lat) / 2, lon0 = (A.lon + B.lon) / 2;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
  return {
    to: (p) => [(p.lon - lon0) * kx, (p.lat - lat0) * ky],
    from: ([x, y]) => ({ lat: y / ky + lat0, lon: x / kx + lon0 }),
  };
}

/** Hypocenters within `widthKm` either side of A→B, with their distance along the line. */
export function depthProfile(events, A, B, widthKm) {
  const pl = plane(A, B);
  const a = pl.to(A), b = pl.to(B);
  const lengthKm = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / lengthKm, uy = (b[1] - a[1]) / lengthKm;
  const points = [];
  for (const e of events) {
    if (e.loc.depth == null) continue;
    const [x, y] = pl.to(e.loc);
    const vx = x - a[0], vy = y - a[1];
    const along = vx * ux + vy * uy, across = -vx * uy + vy * ux;
    if (along >= 0 && along <= lengthKm && Math.abs(across) <= widthKm) points.push({ e, along, depth: e.loc.depth });
  }
  return { lengthKm, points };
}

/** Corners of the band searched by depthProfile, as [lat, lon] for drawing on the map. */
export function profileBand(A, B, widthKm) {
  const pl = plane(A, B);
  const a = pl.to(A), b = pl.to(B);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = (-(b[1] - a[1]) / len) * widthKm, ny = ((b[0] - a[0]) / len) * widthKm;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
    .map((p) => pl.from(p)).map((p) => [p.lat, p.lon]);
}

/** Ready-made lines across the main subduction zones (A on the ocean side). */
export const PROFILE_PRESETS = {
  tohoku: { A: { lat: 38.3, lon: 145.5 }, B: { lat: 41.5, lon: 130.5 } },
  kuril: { A: { lat: 41.0, lon: 147.8 }, B: { lat: 45.5, lon: 139.5 } },
  nankai: { A: { lat: 32.0, lon: 136.0 }, B: { lat: 37.5, lon: 135.2 } },
  izu: { A: { lat: 29.0, lon: 144.0 }, B: { lat: 29.0, lon: 135.5 } },
};
