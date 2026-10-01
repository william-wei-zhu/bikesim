// Builds the map's GeoJSON from the network: flat street lines and wall footprints.
import type { Net } from "./net";

export const LTS_COLOR = ["#999", "#1cae6d", "#9bd65a", "#f5a524", "#e5484d"];
export const LTS_HEIGHT = [0, 0, 6, 30, 70]; // metres, before exaggeration
// Island palette from logo hues (greens, blues, slate): never reads as stress.
export const ISLAND_COLORS = ["#1cae6d", "#3eb3fe", "#082b54", "#71ca7d", "#8ea7c4", "#0a7f9e", "#5c4fc4", "#2f6e3f", "#c28a2c", "#b04f8f"];

const M_LAT = 110_540;
const M_LON = 111_320 * Math.cos((38.9 * Math.PI) / 180);

export function streetLines(net: Net): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = new Array(net.nEdges);
  for (let e = 0; e < net.nEdges; e++) {
    const c = net.ecoords[e];
    const coords: [number, number][] = [];
    for (let k = 0; k < c.length; k += 2) coords.push([c[k], c[k + 1]]);
    features[e] = { type: "Feature", id: e, properties: { lts: net.elts[e] }, geometry: { type: "LineString", coordinates: coords } };
  }
  return { type: "FeatureCollection", features };
}

/** Thin polygon footprint (flat caps) around each street, for fill-extrusion walls. */
export function wallFootprints(net: Net, halfWidthM = 3): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let e = 0; e < net.nEdges; e++) {
    if (net.elts[e] <= 1) continue; // calm streets never get a wall
    const c = net.ecoords[e];
    const n = c.length / 2;
    if (n < 2) continue;
    // local metric coords
    const xs = new Float64Array(n), ys = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs[i] = c[2 * i] * M_LON; ys[i] = c[2 * i + 1] * M_LAT; }
    const left: [number, number][] = [], right: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      // average of adjacent segment normals (simple miter, clamped)
      let nx = 0, ny = 0;
      for (const [a, b] of [[i - 1, i], [i, i + 1]]) {
        if (a < 0 || b >= n) continue;
        const dx = xs[b] - xs[a], dy = ys[b] - ys[a];
        const L = Math.hypot(dx, dy) || 1;
        nx += -dy / L; ny += dx / L;
      }
      const L = Math.hypot(nx, ny) || 1;
      nx /= L; ny /= L;
      const w = halfWidthM;
      left.push([(xs[i] + nx * w) / M_LON, (ys[i] + ny * w) / M_LAT]);
      right.push([(xs[i] - nx * w) / M_LON, (ys[i] - ny * w) / M_LAT]);
    }
    const ring = [...left, ...right.reverse(), left[0]];
    features.push({ type: "Feature", id: e, properties: { lts: net.elts[e] }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  return { type: "FeatureCollection", features };
}

export function pointsFC(pts: { x: number; y: number }[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pts.map((p, i) => ({ type: "Feature", id: i, properties: { ...p }, geometry: { type: "Point", coordinates: [p.x, p.y] } })),
  };
}

export function lineFC(coords: [number, number][], props: Record<string, unknown> = {}): GeoJSON.FeatureCollection {
  if (coords.length < 2) return { type: "FeatureCollection", features: [] };
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords } }] };
}

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
