@AGENTS.md

# RideSim DC (ridesimdc.com)

"Feel it before you ride it." Pain point: people who want to bike in DC can't tell what a trip will feel like before they go; maps show a line, not that block 3 is a six-lane arterial. RideSim is one feature, a ride simulator: pick a trip, see the stress of every block (RideScore DC LTS), then ride it virtually through Google Street View photos (default) or in our 3D model. Built on RideScore DC data for the Civic Tech DC hackathon (Oct 3, 2026). UI/UX and build conventions follow William's Web App Building Standard: https://github.com/william-wei-zhu/web-app-building-standard

## Layout
- `app/` Next.js 16 App Router. `/` is the map app (client-only via `components/app/MapAppLoader.tsx`). `app/api/geocode` proxies Nominatim (DC-bounded, per-IP limit, 24h in-memory cache).
- `lib/engine/` framework-free TypeScript (no React imports):
  - `net.ts` loads `/data/network.json` into typed arrays + CSR adjacency + grid index; `COMMUTER_LTS = 3` is the only rider.
  - `graph.ts` Dijkstra routing (`routePair`: shortest + lowest-stress with a 25x penalty on LTS 4; leftover LTS 4 edges are the unavoidable hostile stretches) and `stretches()` (route split by stress + street).
  - `geom.ts` street lines built in the browser.
  - `map.ts` MapLibre layers: flat stress-colored streets, white 3D buildings, route with a stress `line-gradient`, Start/End pins.
  - `ride.ts` first-person fly-through; frames carry position + heading for the other views.
  - `streetview.ts` Google StreetViewPanorama that follows the rider (lazy).
- `app/about`, `app/privacy`, `app/settings` (theme + default ride view, saved via `lib/prefs.ts` in localStorage); content pages share `components/SiteFrame.tsx`.
- `components/app/`: `MapApp` (state, views), `TripPanel` (trip inputs, stress summary, hostile stretches, view choice), `RideHud` (stress meter, edge tint, view and speed switches).
- `public/data/`: `network.json`, `pois.json` (search suggestions), `meta.json` from `ridescoredc-models/notebooks/ridesim/prep.py`.
- Theme tokens derive from the logo: `../brand/THEME.md` is the source of truth; `app/globals.css` mirrors it.

## Decisions (with dates)
- 2026-10-01: Graph from the OSM snapshot (`osm_u`/`osm_v` node ids) joined to pipeline LTS by `dc_blockkey`, because DDOT blocks have no trails and no intersection ids. Separate cycle tracks that copied an arterial's LTS are set to LTS 1 (`track_rule`), unmatched trails LTS 1 (`trail_rule`).
- 2026-10-01: Population from 2020 Census blocks (TIGER tabblock20 POP20), because the ACS API now requires a key. 689,545 residents snapped to nearest street node (median 63 m).
- 2026-10-01: MapLibre v6 is ESM-only and loads its worker by URL; `scripts/copy-maplibre-worker.mjs` (postinstall) copies the worker + shared chunk to `public/maplibre/` and `createMap` calls `setWorkerUrl`. Do not delete.
- 2026-10-01: MapLibre CSS sets `position: relative` on the map container, so the container sits inside an `absolute inset-0` wrapper. Do not put `absolute` on the container itself (map collapses to 150 px).
- 2026-10-01: No deck.gl in the default view; ride trail and camera are MapLibre only. (Corrected same day: deck.gl is used only for the opt-in photoreal mode, see below.)
- 2026-10-01: shadcn removed after init (its base-nova button fought the 120% type scale); small primitives live in `components/ui.tsx`.
- 2026-10-01: 3D buildings are a `fill-extrusion` on OpenFreeMap's own `openmaptiles` `building` layer (`render_height`), styled as a white architect's model (Positron's flat `building` fill is hidden). DC's OSM buildings came from DC government data, so heights are real. Overture was measured (55% with height, 94% from OSM) and skipped. Buildings only carry heights from zoom 14, so the default view opens over downtown at zoom 13.4.
- 2026-10-01: Wall height is zoom-dependent (full at city scale, 26% from zoom 15) so walls sit between buildings instead of towering over DC's height-limited skyline.
- 2026-10-01: `preserveDrawingBuffer` is on in dev only, because headless screenshots of an idle WebGL canvas came back stale.
- 2026-10-01: Photoreal mode = Google Photorealistic 3D Tiles via deck.gl `Tile3DLayer` in a `MapboxOverlay` (overlaid, not interleaved, because Google's mesh covers the ground). `lib/engine/photoreal.ts` dynamic-imports deck.gl only when the user toggles it, so the default view never calls Google. Walls, route and rider are redrawn as deck layers with `_TerrainExtension` so they sit on the real terrain; MapLibre's own walls/buildings/route are hidden while it's on. Google logo + aggregated tile credits (`PhotorealCredits.tsx`) are required.
- 2026-10-01: GCP project `ridesimdc` (billing `william-1`), Map Tiles API only. Key `NEXT_PUBLIC_GOOGLE_TILES_KEY` (Vercel production + development, and `.env.local`) is restricted to ridesimdc.com, *.vercel.app and localhost:3311/3000 referrers and to tile.googleapis.com. Daily quota on `threedtiles_root_tileset` capped at 300 (first 1,000 sessions/month free, then $6 per 1,000). Preview env var not set (CLI refused); the toggle hides without a key.
- 2026-10-01 (later): Cut to one feature. Explore, Islands and Build modes, the rider picker (kid/casual/commuter), fixes, islands math, crashes/wards/blocks data were removed: "the highlight is simulation; less is more" (William). Default rider is a confident commuter (LTS 3). Stress levels stay (street colors, walls, route gradient, HUD meter).
- 2026-10-01: Street View ride uses the Maps JavaScript API `StreetViewPanorama` (one "Dynamic Street View" load per ride; `setPosition` hops every 18 m and at most ~3/s; ride speed capped at 22 m/s in this view). Same key, now also allowed for `maps-backend.googleapis.com`; daily `billable_default` quota capped at 300. Free 5,000 loads/month, then $14 per 1,000.
- 2026-10-01: Photoreal route is split into 4-point pieces with `TerrainExtension` "offset" (a single draped path did not render on the 3D tiles). Photoreal and Street View load only during a ride in that view.
- 2026-10-01 (latest): Photoreal removed at William's request; 3D model is the default ride view, Street View the alternative. deck.gl and the photoreal module were deleted, and the browser key now allows only `maps-backend.googleapis.com` (Map Tiles API no longer used). The env var keeps its old name `NEXT_PUBLIC_GOOGLE_TILES_KEY`; it now powers Street View only. The photoreal notes above are history.
- 2026-10-02: Street View is the default ride view (3D model second; 3D only if no Google key). The ride HUD sits top-left (top on phones) and collapses to a pill (play/pause, stress dot, street name, expand) for a near full-screen view.
- 2026-10-02: Start/End pins are DOM `maplibregl.Marker`s (`setEndpoints` in map.ts) so labels stay upright and use the brand font. The rider in 3D view is a procedural three.js bike + rider (`bike3d.ts`, MapLibre custom 3D layer, loaded only when a ride starts): navy frame, green accents, spinning wheels, pedaling legs, lean into turns, stress-tinted glow ring; scaled to ~150 px on screen at any zoom. Ride camera pads the top 45% so the bike sits in the lower third.
- 2026-10-02: 3D stress walls removed entirely ("unnecessary; they feel like walls" - William). Streets are flat lines colored by LTS; only buildings and the bike are 3D. Earlier notes about wall heights are history.
- 2026-10-02: Street View smoothing: two stacked panoramas (the hidden one preloads the photo 15 m ahead via setPosition, then a 450 ms crossfade) plus a forward zoom "dolly" between photos; the ride waits at a photo boundary (`Ride.limit`) until the next photo loads; Street View pace 10 m/s at 1x. Billing: 2 panorama loads per Street View session (Google bills per StreetViewPanorama instantiation, not per photo or distance), so a ride costs the same at 1 mile or 10.
- 2026-10-02: Route choice: "Shortest" (default since 2026-10-02, William) or "Lowest stress" (`route=calm` in the URL); stats, hostile stretches, map gradient and the ride follow the chosen route, the other is dotted.
- 2026-10-02: 3D ride camera orbit: drag turns/tilts around the rider, wheel zooms, double-click resets (`Ride.enableOrbit`, MapLibre's own handlers paused during a ride). The same three.js rider (`createBikeModel` in bike3d.ts) is drawn over Street View on a transparent canvas, camera behind the rider (`createBikeOverlay`).
- Standard deviations: full-screen map, so the header is part of a fixed layout (no page scroll); data is static JSON, not Firestore; Settings has theme + default ride view only (no accounts, so no notification/account rows).

## Scaling cliff
`network.json` is ~4 MB (~1.2 MB gzipped) and streets are one client-built GeoJSON source. Fine for one city at ~28k segments; past ~100k segments switch walls to PMTiles.

## Testing notes
Headless Playwright here runs at devicePixelRatio 0.5 with software WebGL: resize to half the target size, and wait for `window.__rsMap.loaded()` (dev only) before screenshots.
