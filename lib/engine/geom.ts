// Builds the map's GeoJSON from the network: street lines colored by stress.
import type { Net } from "./net";

export const LTS_COLOR = ["#999", "#1cae6d", "#9bd65a", "#f5a524", "#e5484d"];


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
