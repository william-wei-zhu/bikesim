@AGENTS.md

# RideSim DC (ridesimdc.com)

"Break the walls, ride the city." A 3D map of where DC streets become walls for people on bikes, which residents are cut off, and which single fixes would connect them. Built on RideScore DC data for the Civic Tech DC hackathon (Oct 3, 2026). UI/UX and build conventions follow William's Web App Building Standard: https://github.com/william-wei-zhu/web-app-building-standard

## Layout
- `app/` Next.js 16 App Router. `/` is the map app (client-only via `components/app/MapAppLoader.tsx`). `app/api/geocode` proxies Nominatim (DC-bounded, per-IP limit, 24h in-memory cache).
- `lib/engine/` framework-free TypeScript (no React imports) so it can be ported to the RideScore no-build page:
  - `net.ts` loads `/data/network.json` into typed arrays + CSR adjacency + grid index.
  - `graph.ts` union-find islands, Dijkstra routing (`routePair`: fastest + calm with a 25x penalty on over-threshold edges; leftover over-threshold edges are the "breaking" blocks), reach stats, plan impact.
  - `geom.ts` builds street lines and wall footprints (3 m half-width polygons) in the browser, so only one network file ships.
  - `map.ts` MapLibre layers; rider/fix/island changes only touch paint expressions and feature-state, never reload data.
  - `ride.ts` first-person fly-through (jumpTo per frame, smoothed bearing).
- `components/app/` panels per mode (Explore, Islands, Build, Ride), header, ride HUD.
- `public/data/` static outputs of `ridescoredc-models/notebooks/ridesim/prep.py` (see that README). Re-run prep and copy `data/out/*` here to refresh.
- Theme tokens derive from the logo: `../brand/THEME.md` is the source of truth; `app/globals.css` mirrors it.

## Decisions (with dates)
- 2026-10-01: Graph from the OSM snapshot (`osm_u`/`osm_v` node ids) joined to pipeline LTS by `dc_blockkey`, because DDOT blocks have no trails and no intersection ids. Separate cycle tracks that copied an arterial's LTS are set to LTS 1 (`track_rule`), unmatched trails LTS 1 (`trail_rule`).
- 2026-10-01: Population from 2020 Census blocks (TIGER tabblock20 POP20), because the ACS API now requires a key. 689,545 residents snapped to nearest street node (median 63 m).
- 2026-10-01: MapLibre v6 is ESM-only and loads its worker by URL; `scripts/copy-maplibre-worker.mjs` (postinstall) copies the worker + shared chunk to `public/maplibre/` and `createMap` calls `setWorkerUrl`. Do not delete.
- 2026-10-01: MapLibre CSS sets `position: relative` on the map container, so the container sits inside an `absolute inset-0` wrapper. Do not put `absolute` on the container itself (map collapses to 150 px).
- 2026-10-01: No deck.gl; ride trail and camera are MapLibre only.
- 2026-10-01: shadcn removed after init (its base-nova button fought the 120% type scale); small primitives live in `components/ui.tsx`.
- 2026-10-01: `react-hooks/refs` disabled in `MapApp.tsx` only (false positive on the ctx object; refs are read in effects/handlers).
- 2026-10-01: 3D buildings are a `fill-extrusion` on OpenFreeMap's own `openmaptiles` `building` layer (`render_height`), styled as a white architect's model (Positron's flat `building` fill is hidden). DC's OSM buildings came from DC government data, so heights are real. Overture was measured (55% with height, 94% from OSM) and skipped. Buildings only carry heights from zoom 14, so the default view opens over downtown at zoom 13.4.
- 2026-10-01: Wall height is zoom-dependent (full at city scale, 26% from zoom 15) so walls sit between buildings instead of towering over DC's height-limited skyline.
- 2026-10-01: `preserveDrawingBuffer` is on in dev only, because headless screenshots of an idle WebGL canvas came back stale.
- Standard deviations: full-screen map, so the header is part of a fixed layout (no page scroll); data is static JSON, not Firestore; Settings has theme + tour only (no accounts).

## Scaling cliff
`network.json` is ~4 MB (~1.2 MB gzipped) and every wall is a client-built GeoJSON polygon. Fine for one city at ~28k segments; past ~100k segments switch walls to PMTiles.

## Testing notes
Headless Playwright here runs at devicePixelRatio 0.5 with software WebGL: resize to half the target size, and wait for `window.__rsMap.loaded()` (dev only) before screenshots.
