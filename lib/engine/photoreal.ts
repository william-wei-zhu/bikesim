// Google Photorealistic 3D Tiles on top of the MapLibre map, via deck.gl (loaded only when switched on).
// Billing: one root-tileset request per session (3 h of tiles). Never loaded in the default view.
import type * as maplibregl from "maplibre-gl";
import type { Layer } from "@deck.gl/core";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";
// Wall heights on the photoreal surface: barriers between real buildings, not towers.
const WALL_M = [0, 0, 3, 9, 18];
const WALL_RGBA: Record<number, [number, number, number, number]> = {
  2: [155, 214, 90, 200], 3: [245, 165, 36, 215], 4: [229, 72, 77, 225],
};

export interface PhotorealHandle {
  setRoute(coords: [number, number][] | null): void;
  setRider(p: [number, number] | null): void;
  setWalls(fc: GeoJSON.FeatureCollection | null): void;
  destroy(): void;
}

export async function enablePhotoreal(
  map: maplibregl.Map,
  apiKey: string,
  onCredits: (credits: string) => void,
  onError: (message: string) => void,
): Promise<PhotorealHandle> {
  const [{ MapboxOverlay }, { Tile3DLayer }, { PathLayer, ScatterplotLayer, PolygonLayer }, { _TerrainExtension: TerrainExtension }] =
    await Promise.all([
      import("@deck.gl/mapbox"), import("@deck.gl/geo-layers"), import("@deck.gl/layers"), import("@deck.gl/extensions"),
    ]);

  const state: { route: [number, number][] | null; rider: [number, number] | null; walls: GeoJSON.FeatureCollection | null } =
    { route: null, rider: null, walls: null };
  let failed = false;
  const terrainOffset = new TerrainExtension();

  const tiles = new Tile3DLayer({
    id: "google-3d",
    data: TILESET_URL,
    loadOptions: {
      fetch: { headers: { "X-GOOG-API-KEY": apiKey } },
      tileset: { maximumScreenSpaceError: 18, memoryAdjustedScreenSpaceError: true },
    },
    operation: "terrain+draw",
    onTilesetLoad: (tileset3d) => {
      // Google requires the aggregated data credits of visible tiles, most frequent first.
      tileset3d.options.onTraversalComplete = (selected) => {
        const count = new Map<string, number>();
        for (const tile of selected) {
          const c: string | undefined = (tile.content as { gltf?: { asset?: { copyright?: string } } })?.gltf?.asset?.copyright;
          c?.split(";").map((x) => x.trim()).filter(Boolean).forEach((x) => count.set(x, (count.get(x) || 0) + 1));
        }
        onCredits([...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).join("; "));
        return selected;
      };
    },
    onTileError: (_tile, _url, message) => {
      if (failed) return;
      failed = true;
      onError(/403|429|quota/i.test(message) ? "The photoreal view hit today's limit. Showing the standard map." : "The photoreal view could not load. Showing the standard map.");
    },
  });

  const layers = (): Layer[] => {
    const out: Layer[] = [tiles];
    if (state.walls) {
      out.push(new PolygonLayer({
        id: "pr-walls", data: state.walls.features, extruded: true, stroked: false,
        getPolygon: (f: GeoJSON.Feature) => (f.geometry as GeoJSON.Polygon).coordinates,
        getElevation: (f: GeoJSON.Feature) => WALL_M[(f.properties as { lts: number }).lts] ?? 0,
        getFillColor: (f: GeoJSON.Feature) => WALL_RGBA[(f.properties as { lts: number }).lts] ?? [200, 200, 200, 180],
        material: { ambient: 0.6, diffuse: 0.5, shininess: 8 },
        extensions: [terrainOffset], terrainDrawMode: "offset",
      } as never));
    }
    if (state.route && state.route.length > 1) {
      // Split the route into short pieces: "offset" lifts each piece by the terrain height under it,
      // so the line follows DC's hills (draping a single long path did not render on the 3D tiles).
      const pieces: { path: number[][] }[] = [];
      for (let i = 0; i < state.route.length - 1; i += 3) {
        pieces.push({ path: state.route.slice(i, Math.min(i + 4, state.route.length)).map(([x, y]) => [x, y, 2.5]) });
      }
      const common = { data: pieces, getPath: (d: { path: number[][] }) => d.path, widthUnits: "pixels", capRounded: true, jointRounded: true,
        extensions: [terrainOffset], terrainDrawMode: "offset" };
      out.push(new PathLayer({ id: "pr-route-casing", ...common, getColor: [255, 255, 255, 255], getWidth: 14 } as never));
      out.push(new PathLayer({ id: "pr-route", ...common, getColor: [28, 174, 109, 255], getWidth: 8 } as never));
    }
    if (state.rider) {
      out.push(new ScatterplotLayer({ id: "pr-rider", data: [state.rider], getPosition: (d: [number, number]) => [d[0], d[1], 2],
        getRadius: 9, radiusUnits: "pixels", getFillColor: [8, 43, 84, 255], stroked: true, getLineColor: [255, 255, 255, 255],
        lineWidthUnits: "pixels", getLineWidth: 4, billboard: true, extensions: [terrainOffset], terrainDrawMode: "offset" } as never));
    }
    return out;
  };

  // Overlaid (not interleaved): Google's mesh covers the ground, so deck draws its own depth-consistent scene on top.
  const overlay = new MapboxOverlay({ interleaved: false, layers: layers() });
  map.addControl(overlay as unknown as maplibregl.IControl);
  const refresh = () => overlay.setProps({ layers: layers() });

  return {
    setRoute(c) { state.route = c; refresh(); },
    setRider(p) { state.rider = p; refresh(); },
    setWalls(fc) { state.walls = fc; refresh(); },
    destroy() {
      try { map.removeControl(overlay as unknown as maplibregl.IControl); } catch { /* already removed */ }
      overlay.finalize();
    },
  };
}
