// MapLibre setup: logo-colored basemap, RideSim layers, and state -> paint updates.
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { EMPTY_FC, LTS_COLOR } from "./geom";
import { cityMaxBounds, cityDataBase, type City } from "../cities";

/** Opening tilt: enough for the 3D buildings to read, north up (bearing 0). */
export const HOME_PITCH = 58;
export const cityView = (c: City) => ({ center: c.center, zoom: c.zoom, pitch: HOME_PITCH, bearing: 0 });
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

let workerSet = false;
let pmtilesSet = false;

export function createMap(container: HTMLElement, city: City, opts: { flat: boolean }) {
  if (!workerSet) { maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); workerSet = true; }
  // Streets come as one PMTiles archive per city (range requests to the data bucket), not a GeoJSON of every street.
  if (!pmtilesSet) { maplibregl.addProtocol("pmtiles", new Protocol().tile); pmtilesSet = true; }
  const map = new maplibregl.Map({
    container, style: STYLE_URL, ...cityView(city), pitch: opts.flat ? 0 : HOME_PITCH, maxPitch: 75,
    attributionControl: { compact: true }, maxBounds: cityMaxBounds(city),
    // antialias smooths building edges; preserveDrawingBuffer only in dev so headless screenshots are reliable.
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: process.env.NODE_ENV !== "production" },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  // On phones the trip sheet covers the bottom corner, so the photo button moves to the top, under the step prompt.
  if (city.aerial) map.addControl(new ImageryControl(), window.matchMedia("(max-width: 767px)").matches ? "top-right" : "bottom-right");
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
  // Route outline follows the theme: white on the light map, deep navy on the dark one.
  set("rs-route-casing", "line-color", dark ? "#06182f" : "#ffffff");
  set("rs-route-glow", "line-color", dark ? "#1cae6d" : "#082b54");
  set("rs-route-glow", "line-opacity", dark ? 0.18 : 0.22);
  set("rs-route-fast", "line-color", dark ? "#9fb7d6" : "#1d3f68");
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

// Aerial photos come from a city's own free tile service (City.aerial); cities without one get no photo button.
const AERIAL_KEY = "rs-aerial";
const readAerial = () => { try { return localStorage.getItem(AERIAL_KEY) === "1"; } catch { return false; } };

// Rides always use the plain white city model; the photos (and their button) come back when the ride ends.
let imageryPaused = false;
export function pauseImagery(map: maplibregl.Map, paused: boolean) {
  imageryPaused = paused;
  map.getContainer().classList.toggle("rs-aerial-paused", paused);
  setImagery(map, readAerial());
}

/** Show or hide the aerial photos. The white 3D buildings turn see-through so the roofs in the photo still show. */
export function setImagery(map: maplibregl.Map, want: boolean) {
  if (!map.getLayer("rs-aerial")) return;
  const on = want && !imageryPaused;
  map.setLayoutProperty("rs-aerial", "visibility", on ? "visible" : "none");
  if (map.getLayer("rs-buildings")) map.setPaintProperty("rs-buildings", "fill-extrusion-opacity",
    ["interpolate", ["linear"], ["zoom"], 13, 0, 14, on ? 0.45 : 0.92] as never);
}

/** Map button that toggles the aerial photos; the choice is remembered on this device. */
class ImageryControl implements maplibregl.IControl {
  private el?: HTMLDivElement;
  onAdd(map: maplibregl.Map) {
    const el = document.createElement("div");
    el.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rs-aerial-btn";
    btn.title = "Aerial photos";
    btn.setAttribute("aria-label", "Show aerial photos");
    // Lucide "image" icon: a photo frame with a sun and hills.
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';
    const sync = (on: boolean) => { btn.classList.toggle("is-on", on); btn.setAttribute("aria-pressed", String(on)); };
    sync(readAerial());
    btn.addEventListener("click", () => {
      const on = !readAerial();
      try { localStorage.setItem(AERIAL_KEY, on ? "1" : "0"); } catch { /* storage blocked: toggle still works this visit */ }
      sync(on);
      setImagery(map, on);
    });
    el.appendChild(btn);
    this.el = el;
    return el;
  }
  onRemove() { this.el?.remove(); }
}

/** Add all RideSim sources and layers. Call once after the style loads. */
export function addLayers(map: maplibregl.Map, city: City) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("rs-streets", { type: "vector", url: `pmtiles://${cityDataBase(city)}/streets.pmtiles`,
    attribution: `Street stress: ${city.stress.name}` });
  map.addSource("rs-route-fast", { type: "geojson", data: EMPTY_FC });
  map.addSource("rs-route", { type: "geojson", data: EMPTY_FC, lineMetrics: true });
  map.addSource("rs-break", { type: "geojson", data: EMPTY_FC });

  // Aerial photos sit above the basemap's fills and roads, below the stress lines and the labels.
  if (city.aerial) {
    map.addSource("rs-aerial", { type: "raster", tiles: [city.aerial.tiles], tileSize: 256, maxzoom: 20,
      bounds: city.aerial.bounds, attribution: city.aerial.attribution });
    map.addLayer({ id: "rs-aerial", type: "raster", source: "rs-aerial", layout: { visibility: "none" } }, firstLabel);
  }

  const ltsColor = ["match", ["get", "lts"], 1, LTS_COLOR[1], 2, LTS_COLOR[2], 3, LTS_COLOR[3], 4, LTS_COLOR[4], "#999"];
  map.addLayer({
    id: "rs-streets", type: "line", source: "rs-streets", "source-layer": "streets", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ltsColor as never, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 2.2, 16, 5, 18, 9] },
  }, firstLabel);
  map.addLayer({ id: "rs-break", type: "line", source: "rs-break", layout: { "line-cap": "round" },
    paint: { "line-color": "#e5484d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 14], "line-opacity": 0.55, "line-blur": 2 } });
  // The city in 3D: OSM building footprints with real heights (DC's came from DC government data), as a white scale model.
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
  map.addLayer({ id: "rs-route-fast", type: "line", source: "rs-route-fast", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1d3f68", "line-width": 3, "line-dasharray": [1, 2], "line-opacity": 0.75 } });
  // A soft shadow under the route lifts it off the map so it reads first.
  map.addLayer({ id: "rs-route-glow", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#082b54", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 14, 16, 28], "line-blur": ["interpolate", ["linear"], ["zoom"], 11, 6, 16, 12], "line-opacity": 0.22, "line-translate": [0, 2] } });
  map.addLayer({ id: "rs-route-casing", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 16] } });
  // The route is colored by stress along its length (line-gradient set per route in setRouteGradient).
  map.addLayer({ id: "rs-route", type: "line", source: "rs-route", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1cae6d", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 16, 10] } });
  setImagery(map, readAerial());
}

/** Stress view of the whole city; when a route is shown, the other streets step back so the route reads first. */
export function applyPaint(map: maplibregl.Map, s: { hasRoute: boolean }) {
  map.setPaintProperty("rs-streets", "line-opacity", s.hasRoute ? 0.3 : 0.9);
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

// ---------- Start / End pins (DOM markers stay upright and crisp at any pitch) ----------
const pins = new WeakMap<maplibregl.Map, { start?: maplibregl.Marker; end?: maplibregl.Marker }>();

function pinElement(label: string, kind: "start" | "end") {
  // Colors come from CSS variables (globals.css) so the pins follow the light/dark theme.
  const el = document.createElement("div");
  el.className = `rs-pin rs-pin-${kind}`;
  el.setAttribute("aria-label", `${label} of the trip`);
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none;";
  const tag = document.createElement("div");
  tag.textContent = label;
  tag.style.cssText = "background:var(--pin-bg);color:var(--pin-fg);font:700 13px/1 var(--font-outfit),system-ui,sans-serif;letter-spacing:.02em;" +
    "padding:6px 11px;border-radius:999px;box-shadow:0 4px 14px rgb(8 43 84 / .3);border:2px solid var(--pin-ring);";
  const stem = document.createElement("div");
  stem.style.cssText = "width:2px;height:10px;background:var(--pin-bg);";
  const dot = document.createElement("div");
  dot.style.cssText = "width:16px;height:16px;border-radius:999px;background:var(--pin-ring);border:4px solid var(--pin-bg);box-shadow:0 2px 6px rgb(8 43 84 / .35);";
  el.append(tag, stem, dot);
  return el;
}

/** Place or clear the Start and End pins. */
export function setEndpoints(map: maplibregl.Map, start: [number, number] | null, end: [number, number] | null) {
  const cur = pins.get(map) ?? {};
  for (const [key, pos, label] of [["start", start, "Start"], ["end", end, "End"]] as const) {
    if (!pos) { cur[key]?.remove(); cur[key] = undefined; continue; }
    if (!cur[key]) cur[key] = new maplibregl.Marker({ element: pinElement(label, key), anchor: "bottom", offset: [0, 8] }).setLngLat(pos).addTo(map);
    else cur[key]!.setLngLat(pos);
  }
  pins.set(map, cur);
}

// ---------- Ghost pin: a see-through Start/End pin that follows the cursor while we wait for a click ----------
const ghosts = new WeakMap<maplibregl.Map, { marker: maplibregl.Marker; kind: "start" | "end" }>();

/** Show (or move) the ghost pin at lngLat, or hide it with kind = null. */
export function setGhostPin(map: maplibregl.Map, kind: "start" | "end" | null, lngLat?: [number, number]) {
  const cur = ghosts.get(map);
  if (!kind || !lngLat) { cur?.marker.remove(); ghosts.delete(map); return; }
  if (cur && cur.kind === kind) { cur.marker.setLngLat(lngLat); return; }
  cur?.marker.remove();
  const el = pinElement(kind === "start" ? "Start" : "End", kind);
  el.style.opacity = "0.6";
  el.removeAttribute("aria-label");
  el.setAttribute("aria-hidden", "true");
  const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, 8] }).setLngLat(lngLat).addTo(map);
  ghosts.set(map, { marker, kind });
}
