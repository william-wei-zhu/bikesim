// MapLibre setup: logo-colored basemap, RideSim layers, and state -> paint updates.
import * as maplibregl from "maplibre-gl";
import type { Net, Extras, Poi } from "./net";
import { streetLines, wallFootprints, pointsFC, EMPTY_FC, LTS_COLOR, LTS_HEIGHT, ISLAND_COLORS } from "./geom";
import type { Islands } from "./graph";

export type Mode = "explore" | "islands" | "build" | "ride";
export const DC_VIEW = { center: [-77.0214, 38.8985] as [number, number], zoom: 12.1, pitch: 52, bearing: -18 };
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

let workerSet = false;

export function createMap(container: HTMLElement, opts: { flat: boolean }) {
  if (!workerSet) { maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); workerSet = true; }
  const map = new maplibregl.Map({
    container, style: STYLE_URL, ...DC_VIEW, pitch: opts.flat ? 0 : DC_VIEW.pitch, maxPitch: 75,
    attributionControl: { compact: true }, maxBounds: [[-77.35, 38.70], [-76.75, 39.08]],
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  if (process.env.NODE_ENV !== "production") (window as unknown as { __rsMap: maplibregl.Map }).__rsMap = map;
  return map;
}

const PALETTE = {
  light: { bg: "#f6f9fd", park: "#d9f0dc", wood: "#d2ecd6", water: "#b9e3fb", res: "#f1f5fb", building: "#e8eef7", minor: "#ffffff", major: "#ffffff", casing: "#d7e1f1", label: "#1d3f68", halo: "#ffffff", rail: "#d7e1f1" },
  dark: { bg: "#06182f", park: "#0f3326", wood: "#0f3326", water: "#0d3a5c", res: "#081d38", building: "#0b2445", minor: "#123056", major: "#1b3d68", casing: "#1d3f68", label: "#d7e1f1", halo: "#06182f", rail: "#1d3f68" },
};

/** Recolor OpenFreeMap Positron to the RideSim palette. */
export function applyBasemapTheme(map: maplibregl.Map, dark: boolean) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  const set = (id: string, prop: string, val: unknown) => {
    if (!map.getLayer(id)) return;
    try { map.setPaintProperty(id, prop as never, val as never); } catch { /* property not used by this layer */ }
  };
  for (const l of map.getStyle().layers) {
    const id = l.id;
    if (id.startsWith("rs-")) continue;
    if (l.type === "background") set(id, "background-color", p.bg);
    else if (id === "park") set(id, "fill-color", p.park);
    else if (id === "landcover_wood") set(id, "fill-color", p.wood);
    else if (id === "water") set(id, "fill-color", p.water);
    else if (id === "waterway") set(id, "line-color", p.water);
    else if (id === "landuse_residential") set(id, "fill-color", p.res);
    else if (id === "building") { set(id, "fill-color", p.building); set(id, "fill-outline-color", p.casing); }
    else if (id.includes("casing")) set(id, "line-color", p.casing);
    else if (id.startsWith("highway_minor") || id === "highway_path") set(id, "line-color", p.minor);
    else if (id.includes("inner") || id.includes("subtle")) set(id, "line-color", p.major);
    else if (id.startsWith("railway")) set(id, "line-color", p.rail);
    else if (id.startsWith("road_") || id === "aeroway-area") set(id, l.type === "fill" ? "fill-color" : "line-color", p.bg);
    else if (l.type === "symbol") { set(id, "text-color", p.label); set(id, "text-halo-color", p.halo); }
  }
}

/** Add all RideSim sources and layers. Call once after the style loads. */
export function addLayers(map: maplibregl.Map, net: Net, extras: Extras | null) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("rs-streets", { type: "geojson", data: streetLines(net) });
  map.addSource("rs-walls", { type: "geojson", data: wallFootprints(net) });
  map.addSource("rs-route-fast", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-route", { type: "geojson", data: EMPTY_FC, lineMetrics: true });
  map.addSource("rs-break", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-ends", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-crashes", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-pois", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-wards", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-rider", { type: "geojson", data: EMPTY_FC });

  map.addLayer({ id: "rs-wards", type: "line", source: "rs-wards", paint: { "line-color": "#8ea7c4", "line-width": 1.2, "line-dasharray": [3, 3] } }, firstLabel);
  map.addLayer({
    id: "rs-streets", type: "line", source: "rs-streets", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 2.2, 16, 5, 18, 9] },
  }, firstLabel);
  map.addLayer({ id: "rs-break", type: "line", source: "rs-break", layout: { "line-cap": "round" },
    paint: { "line-color": "#e5484d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 14], "line-opacity": 0.55, "line-blur": 2 } });
  map.addLayer({
    id: "rs-walls", type: "fill-extrusion", source: "rs-walls",
    paint: { "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.88, "fill-extrusion-vertical-gradient": true },
  });
  map.addLayer({ id: "rs-route-fast", type: "line", source: "rs-route-fast", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1d3f68", "line-width": 3, "line-dasharray": [1, 2], "line-opacity": 0.75 } });
  map.addLayer({ id: "rs-route-casing", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 7, 16, 14] } });
  map.addLayer({ id: "rs-route", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1cae6d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 9] } });
  map.addLayer({ id: "rs-crashes", type: "circle", source: "rs-crashes",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["match", ["get", "s"], 2, 6, 1, 4, 2.5], 16, ["match", ["get", "s"], 2, 12, 1, 8, 5]],
      "circle-color": ["match", ["get", "s"], 2, "#7a0f1c", 1, "#e5484d", "#f5a524"],
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1,
    } });
  map.addLayer({ id: "rs-pois", type: "circle", source: "rs-pois", minzoom: 11,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 16, 8],
      "circle-color": ["case", ["boolean", ["get", "on"], false], "#082b54", "#8ea7c4"],
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
    } });
  map.addLayer({ id: "rs-ends", type: "circle", source: "rs-ends",
    paint: { "circle-radius": 9, "circle-color": "#ffffff", "circle-stroke-color": "#1cae6d", "circle-stroke-width": 5 } });
  map.addLayer({ id: "rs-rider", type: "circle", source: "rs-rider",
    paint: { "circle-radius": 10, "circle-color": "#082b54", "circle-stroke-color": "#ffffff", "circle-stroke-width": 4 } });

  if (extras) setExtras(map, extras);
}

export function setExtras(map: maplibregl.Map, extras: Extras) {
  (map.getSource("rs-crashes") as maplibregl.GeoJSONSource).setData(pointsFC(extras.crashes.map(([x, y, s, yr]) => ({ x, y, s, yr }))));
  (map.getSource("rs-wards") as maplibregl.GeoJSONSource).setData(extras.wards);
}

export function setPois(map: maplibregl.Map, pois: Poi[], onIsland: (p: Poi) => boolean) {
  (map.getSource("rs-pois") as maplibregl.GeoJSONSource | undefined)?.setData(pointsFC(pois.map((p) => ({ ...p, on: onIsland(p) }))));
}

export interface PaintState { mode: Mode; threshold: number; wallScale: number; dark: boolean; focusRoot: number | null }

/** Paint expressions for the current mode/rider. Cheap: no data reload. */
export function applyPaint(map: maplibregl.Map, s: PaintState) {
  const fixed = ["boolean", ["feature-state", "fixed"], false];
  const ltsColor = ["match", ["get", "lts"], 1, LTS_COLOR[1], 2, LTS_COLOR[2], 3, LTS_COLOR[3], 4, LTS_COLOR[4], "#999"];
  const rideable = ["any", ["<=", ["get", "lts"], s.threshold], fixed];
  const islandColor = ["match", ["number", ["feature-state", "isl"], -1],
    ...ISLAND_COLORS.flatMap((c, i) => [i, c]), s.dark ? "#3a5a80" : "#a9b9cf"];
  const selected = ["boolean", ["feature-state", "sel"], false];

  const streetColor = s.mode === "explore"
    ? ["case", selected, "#082b54", fixed, LTS_COLOR[1], ltsColor]
    : ["case", selected, "#082b54", rideable, islandColor, s.dark ? "#2b4a70" : "#c9d5e6"];
  map.setPaintProperty("rs-streets", "line-color", streetColor as never);
  const dimmed = s.focusRoot !== null && s.mode !== "explore"
    ? ["case", ["==", ["number", ["feature-state", "root"], -1], s.focusRoot], 1, 0.25]
    : 1;
  map.setPaintProperty("rs-streets", "line-opacity", dimmed as never);

  // Rideable streets (islands) get thicker lines outside Explore so the islands read clearly.
  const zw = (calm: number[], other: number[]) => ["interpolate", ["linear"], ["zoom"],
    10, ["case", rideable, calm[0], other[0]], 13, ["case", rideable, calm[1], other[1]],
    16, ["case", rideable, calm[2], other[2]], 18, ["case", rideable, calm[3], other[3]]];
  map.setPaintProperty("rs-streets", "line-width", (s.mode === "explore"
    ? ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 2.2, 16, 5, 18, 9]
    : zw([1.6, 3.6, 7, 12], [0.6, 1.4, 3, 5])) as never);

  // Walls dominate in Explore; elsewhere they recede behind the islands / route.
  const modeScale = s.mode === "explore" ? 1 : s.mode === "build" ? 0.7 : 0.45;
  map.setPaintProperty("rs-walls", "fill-extrusion-opacity", s.mode === "explore" ? 0.85 : s.mode === "build" ? 0.7 : 0.5);
  const h = ["match", ["get", "lts"], 2, LTS_HEIGHT[2] * modeScale, 3, LTS_HEIGHT[3] * modeScale, 4, LTS_HEIGHT[4] * modeScale, 0];
  const show = s.mode === "explore" ? true : [">", ["get", "lts"], s.threshold];
  map.setPaintProperty("rs-walls", "fill-extrusion-height",
    ["case", fixed, 0, show as never, ["*", h, s.wallScale], 0] as never);
  map.setPaintProperty("rs-walls", "fill-extrusion-color", ["case", selected, "#082b54", ltsColor] as never);
}

/** Write per-edge feature state: island index for coloring, root for focus dimming, fixed flag. */
export function applyIslands(map: maplibregl.Map, net: Net, is: Islands, threshold: number, fixed: Set<number>) {
  for (let e = 0; e < net.nEdges; e++) {
    const root = is.comp[net.eu[e]];
    const rank = is.rankOf.get(root);
    const ride = net.elts[e] <= threshold || fixed.has(e);
    const isl = ride && rank !== undefined && rank < ISLAND_COLORS.length && (is.compPop.get(root) || 0) > 300 ? rank : -1;
    const st = { isl, root: ride ? root : -2, fixed: fixed.has(e) };
    map.setFeatureState({ source: "rs-streets", id: e }, st);
    if (net.elts[e] > 1) map.setFeatureState({ source: "rs-walls", id: e }, { fixed: st.fixed });
  }
}

export function setSelected(map: maplibregl.Map, prev: number | null, next: number | null) {
  for (const [id, v] of [[prev, false], [next, true]] as const) {
    if (id === null || id < 0) continue;
    map.setFeatureState({ source: "rs-streets", id }, { sel: v });
    map.setFeatureState({ source: "rs-walls", id }, { sel: v });
  }
}

export function setVisible(map: maplibregl.Map, id: string, on: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

export function setData(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
}

/** Raise walls from 0 once (skipped when the user prefers reduced motion). */
export function riseWalls(onFrame: (scale: number) => void, ms = 1600) {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onFrame(1); return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    onFrame(1 - Math.pow(1 - k, 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
