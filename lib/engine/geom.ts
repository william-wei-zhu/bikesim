// Builds the map's GeoJSON from the network: street lines colored by stress.

export const LTS_COLOR = ["#999", "#1cae6d", "#9bd65a", "#f5a524", "#e5484d"];


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
