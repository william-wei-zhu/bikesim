// MapLibre setup: logo-colored basemap, RideSim layers, and state -> paint updates.
import * as maplibregl from "maplibre-gl";
import type { Net } from "./net";
import { streetLines, wallFootprints, EMPTY_FC, LTS_COLOR, LTS_HEIGHT } from "./geom";

// Opens over downtown and the Mall so the 3D city reads immediately (buildings appear from zoom 13).
export const DC_VIEW = { center: [-77.0275, 38.8975] as [number, number], zoom: 13.4, pitch: 58, bearing: -22 };
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

let workerSet = false;

export function createMap(container: HTMLElement, opts: { flat: boolean }) {
  if (!workerSet) { maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); workerSet = true; }
  const map = new maplibregl.Map({
    container, style: STYLE_URL, ...DC_VIEW, pitch: opts.flat ? 0 : DC_VIEW.pitch, maxPitch: 75,
    attributionControl: { compact: true }, maxBounds: [[-77.35, 38.70], [-76.75, 39.08]],
    // antialias smooths wall and building edges; preserveDrawingBuffer only in dev so headless screenshots are reliable.
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: process.env.NODE_ENV !== "production" },
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
  if (map.getLayer("rs-buildings")) {
    // Paper-white model; taller buildings pick up a hint of the logo's city-block blue.
    map.setPaintProperty("rs-buildings", "fill-extrusion-color", ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8],
      0, dark ? "#0f2747" : "#ffffff", 30, dark ? "#16345c" : "#eef3fb", 90, dark ? "#1f4675" : "#dce6f4"] as never);
  }
  map.setLight({ anchor: "map", position: [1.25, 210, 38], color: "#ffffff", intensity: dark ? 0.3 : 0.42 });
  map.setSky(dark
    ? { "sky-color": "#06182f", "horizon-color": "#123a63", "fog-color": "#06182f", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.4 }
    : { "sky-color": "#bfe3fb", "horizon-color": "#eef6fd", "fog-color": "#f6f9fd", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.5, "fog-ground-blend": 0.3 });
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
export function addLayers(map: maplibregl.Map, net: Net) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("rs-streets", { type: "geojson", data: streetLines(net) });
  map.addSource("rs-walls", { type: "geojson", data: wallFootprints(net) });
  map.addSource("rs-route-fast", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-route", { type: "geojson", data: EMPTY_FC, lineMetrics: true });
  map.addSource("rs-break", { type: "geojson", data: EMPTY_FC });

  const ltsColor = ["match", ["get", "lts"], 1, LTS_COLOR[1], 2, LTS_COLOR[2], 3, LTS_COLOR[3], 4, LTS_COLOR[4], "#999"];
  map.addLayer({
    id: "rs-streets", type: "line", source: "rs-streets", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ltsColor as never, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 2.2, 16, 5, 18, 9] },
  }, firstLabel);
  map.addLayer({ id: "rs-break", type: "line", source: "rs-break", layout: { "line-cap": "round" },
    paint: { "line-color": "#e5484d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 14], "line-opacity": 0.55, "line-blur": 2 } });
  // DC in 3D: OSM building footprints (from DC government data) with real heights, as a white scale model.
  if (map.getLayer("building")) map.setLayoutProperty("building", "visibility", "none");
  map.addLayer({
    id: "rs-buildings", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_height"], 8]],
      "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["coalesce", ["get", "render_min_height"], 0]],
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.92],
      "fill-extrusion-vertical-gradient": true,
    },
  });
  map.addLayer({
    id: "rs-walls", type: "fill-extrusion", source: "rs-walls",
    paint: { "fill-extrusion-base": 0, "fill-extrusion-color": ltsColor as never, "fill-extrusion-vertical-gradient": true },
  });
  map.addLayer({ id: "rs-route-fast", type: "line", source: "rs-route-fast", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1d3f68", "line-width": 3, "line-dasharray": [1, 2], "line-opacity": 0.75 } });
  map.addLayer({ id: "rs-route-casing", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 16] } });
  // The route is colored by stress along its length (line-gradient set per route in setRouteGradient).
  map.addLayer({ id: "rs-route", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1cae6d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 10] } });
}

/** Stress view of the whole city; when a route is shown, everything else steps back so the route reads first. */
export function applyPaint(map: maplibregl.Map, s: { wallScale: number; hasRoute: boolean }) {
  map.setPaintProperty("rs-streets", "line-opacity", s.hasRoute ? 0.45 : 1);
  map.setPaintProperty("rs-walls", "fill-extrusion-opacity", s.hasRoute ? 0.55 : 0.85);
  const h = ["match", ["get", "lts"], 2, LTS_HEIGHT[2], 3, LTS_HEIGHT[3], 4, LTS_HEIGHT[4], 0];
  // Tall at city scale (buildings hidden), about a quarter height at street level so walls sit
  // between DC's buildings (height limit keeps most under 40 m) instead of burying them.
  const wallH = ["*", h, s.wallScale];
  map.setPaintProperty("rs-walls", "fill-extrusion-height",
    ["interpolate", ["linear"], ["zoom"], 12.5, wallH, 15, ["*", wallH, 0.26]] as never);
}

/** Color the route line by the stress of each stretch, using line-progress stops. */
export function setRouteGradient(map: maplibregl.Map, stops: { at: number; lts: number }[]) {
  if (!map.getLayer("rs-route") || stops.length === 0) return;
  const expr: unknown[] = ["step", ["line-progress"], LTS_COLOR[stops[0].lts]];
  let last = 0;
  for (const s of stops.slice(1)) {
    if (s.at > last && s.at < 1) { expr.push(s.at, LTS_COLOR[s.lts]); last = s.at; }
  }
  if (expr.length === 3) expr.push(1, LTS_COLOR[stops[0].lts]); // "step" needs at least one stop
  map.setPaintProperty("rs-route", "line-gradient", expr as never);
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

// ---------- Start / End pins (DOM markers stay upright and crisp at any pitch) ----------
const pins = new WeakMap<maplibregl.Map, { start?: maplibregl.Marker; end?: maplibregl.Marker }>();

function pinElement(label: string, fill: string) {
  const el = document.createElement("div");
  el.setAttribute("aria-label", `${label} of the trip`);
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none;";
  const tag = document.createElement("div");
  tag.textContent = label;
  tag.style.cssText = `background:${fill};color:#fff;font:700 13px/1 var(--font-outfit),system-ui,sans-serif;letter-spacing:.02em;` +
    "padding:6px 11px;border-radius:999px;box-shadow:0 4px 14px rgb(8 43 84 / .3);border:2px solid #fff;";
  const stem = document.createElement("div");
  stem.style.cssText = `width:2px;height:10px;background:${fill};`;
  const dot = document.createElement("div");
  dot.style.cssText = `width:16px;height:16px;border-radius:999px;background:#fff;border:4px solid ${fill};box-shadow:0 2px 6px rgb(8 43 84 / .35);`;
  el.append(tag, stem, dot);
  return el;
}

/** Place or clear the Start and End pins. */
export function setEndpoints(map: maplibregl.Map, start: [number, number] | null, end: [number, number] | null) {
  const cur = pins.get(map) ?? {};
  for (const [key, pos, label, fill] of [["start", start, "Start", "#082b54"], ["end", end, "End", "#1cae6d"]] as const) {
    if (!pos) { cur[key]?.remove(); cur[key] = undefined; continue; }
    if (!cur[key]) cur[key] = new maplibregl.Marker({ element: pinElement(label, fill), anchor: "bottom", offset: [0, 8] }).setLngLat(pos).addTo(map);
    else cur[key]!.setLngLat(pos);
  }
  pins.set(map, cur);
}
