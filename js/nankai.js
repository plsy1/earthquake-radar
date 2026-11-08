// Approximate outline of the Nankai Trough assumed source region
// (Cabinet Office, 2012), traced by hand. For illustration only.
export const NANKAI = [
  [31.60, 131.45], [32.40, 131.70], [33.00, 132.00], [33.30, 132.40], [33.60, 132.80],
  [33.90, 133.40], [34.05, 134.20], [34.00, 134.80], [33.95, 135.10], [34.30, 135.60],
  [34.60, 136.10], [34.90, 136.50], [35.20, 136.80], [35.30, 137.30], [35.38, 137.90],
  [35.40, 138.40], [35.20, 138.65], [34.70, 138.65], [34.40, 138.55], [33.90, 138.20],
  [33.50, 137.50], [33.10, 136.60], [32.85, 135.80], [32.60, 135.00], [32.20, 134.20],
  [31.60, 133.30], [31.10, 132.90], [31.00, 132.40], [31.30, 131.80],
];

// The traditional segments, split at Cape Shionomisaki and Lake Hamana.
// 1707 broke all of them; 1854 and 1944/46 broke them in two halves; Tokai has not broken since 1854.
export const NANKAI_SEGMENTS = [
  { key: "segNankai", minLon: -Infinity, maxLon: 135.76, color: "#3b6fb6", label: [32.7, 133.5] },
  { key: "segTonankai", minLon: 135.76, maxLon: 137.6, color: "#d08a1e", label: [32.75, 136.25] },
  { key: "segTokai", minLon: 137.6, maxLon: Infinity, color: "#8e44ad", label: [33.75, 137.95] },
];

/** Clip a [lat, lon] polygon to minLon <= lon <= maxLon (Sutherland–Hodgman). */
export function clipLon(poly, minLon, maxLon) {
  const clip = (pts, inside, cross) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push(cross(a, b));
    }
    return out;
  };
  const at = (lon) => (a, b) => [a[0] + (b[0] - a[0]) * (lon - a[1]) / (b[1] - a[1]), lon];
  let pts = poly;
  if (isFinite(minLon)) pts = clip(pts, (p) => p[1] >= minLon, at(minLon));
  if (isFinite(maxLon)) pts = clip(pts, (p) => p[1] <= maxLon, at(maxLon));
  return pts;
}
