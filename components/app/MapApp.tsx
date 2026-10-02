"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type * as maplibregl from "maplibre-gl";
import { loadNet, loadPois, nearestNode, edgeName, edgeMid, COMMUTER_LTS, type Net, type Poi } from "@/lib/engine/net";
import { routePair, routeLine, stretches as toStretches, type Stretch } from "@/lib/engine/graph";
import { createMap, addLayers, applyBasemapTheme, applyPaint, setRouteGradient, setData, setEndpoints, DC_VIEW } from "@/lib/engine/map";
import type { BikeLayer, BikeOverlay } from "@/lib/engine/bike3d";
import { lineFC, EMPTY_FC } from "@/lib/engine/geom";
import { createStreetView, type StreetViewHandle } from "@/lib/engine/streetview";
import { Ride, type RideFrame } from "@/lib/engine/ride";
import type { Place } from "@/components/SearchBox";
import type { Routes, View, RouteKind } from "./types";
import { Header } from "./Header";
import { TripPanel } from "./TripPanel";
import { RideHud } from "./RideHud";
import { Loading } from "./Loading";
import { readDefaultView } from "@/lib/prefs";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY || "";
const VIEWS: { value: View; label: string }[] = GOOGLE_KEY
  ? [{ value: "street", label: "Street View" }, { value: "model", label: "3D model" }]
  : [{ value: "model", label: "3D model" }];
const STREET_MAX_MPS = 10; // Street View pace at 1x (about 36 km/h, twice a typical ride) so photos can keep up

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const place = (k: string): Place | null => {
    const v = p.get(k); if (!v) return null;
    const [x, y, ...rest] = v.split(",");
    const X = Number(x), Y = Number(y);
    return Number.isFinite(X) && Number.isFinite(Y) ? { x: X, y: Y, label: rest.join(",") || "Dropped pin" } : null;
  };
  return { from: place("from"), to: place("to"), kind: (p.get("route") === "calm" ? "calm" : "short") as RouteKind };
}

export default function MapApp() {
  const mapEl = useRef<HTMLDivElement>(null);
  const streetEl = useRef<HTMLDivElement>(null);
  const overlayEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [net, setNet] = useState<Net | null>(null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const [init] = useState(() => (typeof window === "undefined" ? null : readUrl()));
  const [from, setFrom] = useState<Place | null>(init?.from ?? null);
  const [to, setTo] = useState<Place | null>(init?.to ?? null);
  const [pick, setPick] = useState<"from" | "to" | null>(null);
  const [kind, setKind] = useState<RouteKind>(init?.kind ?? "short");
  const [view, setView] = useState<View>(() => (GOOGLE_KEY && typeof window !== "undefined" ? readDefaultView() : "model"));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [rideFrame, setRideFrame] = useState<RideFrame | null>(null);
  const [ridePlaying, setRidePlaying] = useState(false);
  const [riding, setRiding] = useState(false);
  const [noPhotos, setNoPhotos] = useState(false);
  const rideRef = useRef<Ride | null>(null);
  const streetRef = useRef<StreetViewHandle | null>(null);
  const bikeRef = useRef<BikeLayer | null>(null);
  const overlayRef = useRef<BikeOverlay | null>(null);
  const layersAdded = useRef(false);

  const toast = useCallback((m: string) => { setToastMsg(m); window.setTimeout(() => setToastMsg((c) => (c === m ? null : c)), 3500); }, []);

  // ---------- data + map ----------
  useEffect(() => {
    let live = true;
    loadNet().then((n) => live && setNet(n)).catch((e) => live && setLoadError(String(e.message || e)));
    loadPois().then((x) => live && setPois(x)).catch(() => { /* search still works through the geocoder */ });
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = createMap(mapEl.current, { flat: window.matchMedia("(max-width: 767px)").matches });
    mapRef.current = map;
    map.on("load", () => setMapReady(true));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ---------- route ----------
  const routes: Routes = useMemo(() => {
    if (!net || !from || !to) return null;
    const a = nearestNode(net, from.x, from.y, 800), b = nearestNode(net, to.x, to.y, 800);
    if (a < 0 || b < 0) return { error: "far" };
    if (a === b) return { error: "same" };
    const pair = routePair(net, a, b, COMMUTER_LTS);
    if (!pair.calm || !pair.fastest) return { error: "none" };
    return { a, b, calm: pair.calm, fastest: pair.fastest };
  }, [net, from, to]);
  const ok = routes && "calm" in routes ? routes : null;
  // The route being ridden, and the other one (shown dotted for comparison).
  const chosen = ok ? (kind === "short" ? ok.fastest : ok.calm) : null;
  const other = ok ? (kind === "short" ? ok.calm : ok.fastest) : null;
  const stretches = useMemo(() => (net && chosen ? toStretches(net, chosen, (e) => edgeName(net, e)) : []), [net, chosen]);
  const line = useMemo(() => (net && chosen ? routeLine(net, chosen) : null), [net, chosen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !net || layersAdded.current) return;
    addLayers(map, net);
    layersAdded.current = true;
    applyBasemapTheme(map, dark);
    applyPaint(map, { hasRoute: false });
  }, [mapReady, net, dark]);
  useEffect(() => { if (layersAdded.current && mapRef.current) applyBasemapTheme(mapRef.current, dark); }, [dark]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !layersAdded.current || !net) return;
    applyPaint(map, { hasRoute: !!ok });
    setEndpoints(map, from ? [from.x, from.y] : null, to ? [to.x, to.y] : null);
    if (chosen && other && line) {
      setData(map, "rs-route", lineFC(line.coords));
      setRouteGradient(map, stretches.map((s) => ({ at: s.startM / chosen.lengthM, lts: s.lts })));
      const same = other.edges.join() === chosen.edges.join();
      setData(map, "rs-route-fast", same ? EMPTY_FC : lineFC(routeLine(net, other).coords));
      setData(map, "rs-break", { type: "FeatureCollection", features: stretches.filter((s) => s.lts === 4).flatMap((s) => s.edges).map((e) => {
        const c = net.ecoords[e]; const coords: [number, number][] = [];
        for (let k = 0; k < c.length; k += 2) coords.push([c[k], c[k + 1]]);
        return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
      }) });
    } else {
      for (const id of ["rs-route", "rs-route-fast", "rs-break"]) setData(map, id, EMPTY_FC);
    }
  }, [ok, chosen, other, line, stretches, from, to, net, mapReady]);

  const routeKey = ok ? `${ok.a}-${ok.b}` : "";
  useEffect(() => {
    const map = mapRef.current; if (!map || !routeKey || !from || !to || rideRef.current) return;
    map.fitBounds([[Math.min(from.x, to.x), Math.min(from.y, to.y)], [Math.max(from.x, to.x), Math.max(from.y, to.y)]],
      { padding: window.innerWidth < 768 ? { top: 60, bottom: window.innerHeight * 0.5, left: 40, right: 40 } : { top: 80, bottom: 80, left: 480, right: 80 }, duration: 900, maxZoom: 15.5 });
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new URLSearchParams();
    const enc = (pl: Place) => `${pl.x.toFixed(5)},${pl.y.toFixed(5)},${pl.label}`;
    if (from) p.set("from", enc(from));
    if (to) p.set("to", enc(to));
    if (kind === "calm") p.set("route", "calm");
    const q = p.toString();
    window.history.replaceState(null, "", q ? `${window.location.pathname}?${q}` : window.location.pathname);
  }, [from, to, kind]);

  // ---------- ride views ----------
  // Street View: real photos, two panorama loads per ride, crossfaded photo to photo along the route.
  useEffect(() => {
    const el = streetEl.current;
    const r = rideRef.current;
    if (!el || !riding || view !== "street" || !GOOGLE_KEY || !line || !r) return;
    let cancelled = false;
    const f = r.current;
    createStreetView(el, GOOGLE_KEY, (d) => r.positionAt(d), f?.distM ?? 0, f?.heading ?? 0, (has) => setNoPhotos(!has))
      .then((h) => {
        if (cancelled) { h.destroy(); return; }
        streetRef.current = h;
        r.limit = () => h.maxDistance();
      })
      .catch(() => { toast("Street View could not load. Showing the 3D model."); setView("model"); });
    r.maxMps = STREET_MAX_MPS;
    // The same 3D rider, drawn over the photos from behind (three.js loads with the first ride).
    const ov = overlayEl.current;
    if (ov) import("@/lib/engine/bike3d").then(({ createBikeOverlay }) => {
      if (cancelled) return;
      overlayRef.current = createBikeOverlay(ov);
      overlayRef.current.setState(f && f.edgeIdx >= 0 ? net!.elts[f.edgeIdx] : 1, false, f?.heading ?? 0);
    }).catch(() => { /* photos still work without the rider */ });
    return () => {
      cancelled = true;
      overlayRef.current?.destroy(); overlayRef.current = null;
      streetRef.current?.destroy(); streetRef.current = null;
      r.limit = null; r.maxMps = Infinity;
      setNoPhotos(false);
    };
  }, [riding, view, line, toast, net]);

  const stopRide = useCallback(() => {
    rideRef.current?.stop(); rideRef.current = null;
    setRideFrame(null); setRidePlaying(false); setRiding(false);
    const map = mapRef.current;
    if (map?.getLayer("rs-bike")) map.removeLayer("rs-bike");
    bikeRef.current = null;
    if (map && from && to) map.fitBounds([[Math.min(from.x, to.x), Math.min(from.y, to.y)], [Math.max(from.x, to.x), Math.max(from.y, to.y)]], { padding: 100, pitch: DC_VIEW.pitch, duration: 1000 });
  }, [from, to]);

  const startRide = useCallback(() => {
    const map = mapRef.current;
    if (!map || !line) return;
    rideRef.current?.stop();
    const r = new Ride(map, line.coords, line.segEdge, (f) => {
      setRideFrame(f);
      streetRef.current?.follow(f.distM, f.heading);
      const lts = f.edgeIdx >= 0 ? net!.elts[f.edgeIdx] : 1;
      bikeRef.current?.setPose(f.pos, f.heading, lts, true);
      overlayRef.current?.setState(lts, true, f.heading);
    }, () => setRidePlaying(false));
    if (view === "street") r.maxMps = STREET_MAX_MPS;
    rideRef.current = r;
    r.enableOrbit(); // drag to look around the rider in the 3D view
    setRiding(true); setRidePlaying(true);
    // The 3D bike (three.js) loads only when a ride starts.
    import("@/lib/engine/bike3d").then(({ createBikeLayer }) => {
      if (rideRef.current !== r || map.getLayer("rs-bike")) return;
      const bike = createBikeLayer(map);
      map.addLayer(bike);
      bikeRef.current = bike;
      bike.setPose(line.coords[0], 0, 1, false);
    }).catch(() => { /* the ride still works without the bike model */ });
    map.flyTo({ center: line.coords[0], zoom: 17.8, pitch: 74, duration: 1500 });
    window.setTimeout(() => { if (rideRef.current === r) r.play(); }, 1550);
  }, [line, view, net]);

  const flyToStretch = useCallback((s: Stretch) => {
    if (!net) return;
    const [x, y] = edgeMid(net, s.edges[Math.floor(s.edges.length / 2)]);
    mapRef.current?.flyTo({ center: [x, y], zoom: 16.5, pitch: 62, duration: 1200,
      padding: window.innerWidth < 768 ? { bottom: window.innerHeight * 0.45, top: 0, left: 0, right: 0 } : { left: 440, top: 0, right: 0, bottom: 0 } });
  }, [net]);

  // ---------- map clicks: first click sets the start, second the destination ----------
  const clickRef = useRef<(e: maplibregl.MapMouseEvent) => void>(() => {});
  useEffect(() => {
    clickRef.current = (ev) => {
      if (rideRef.current) return;
      const pin: Place = { x: ev.lngLat.lng, y: ev.lngLat.lat, label: "Dropped pin" };
      if (pick === "from" || (!pick && !from)) { setFrom(pin); setPick(null); return; }
      if (pick === "to" || (!pick && !to)) { setTo(pin); setPick(null); }
    };
  });
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return;
    const onClick = (e: maplibregl.MapMouseEvent) => clickRef.current(e);
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [mapReady]);

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <Header />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0"><div ref={mapEl} className="h-full w-full" aria-label="3D map of Washington, DC streets colored by bike stress" role="region" /></div>
        <div ref={streetEl} className={riding && view === "street" ? "absolute inset-0 z-[5]" : "hidden"} aria-label="Street View along the route" />
        <div ref={overlayEl} className={riding && view === "street" ? "pointer-events-none absolute inset-0 z-[6]" : "hidden"} />
        {!net && <Loading error={loadError} onRetry={() => { setLoadError(null); setAttempt((a) => a + 1); }} />}
        {net && !riding && (
          <TripPanel pois={pois} routes={routes} kind={kind} setKind={setKind} stretches={stretches} from={from} to={to} setFrom={setFrom} setTo={setTo}
            setPick={setPick} view={view} setView={setView} views={VIEWS} onRide={startRide} onFlyTo={flyToStretch} />
        )}
        {net && riding && rideFrame && (
          <RideHud net={net} frame={rideFrame} playing={ridePlaying} view={view} views={VIEWS} onView={setView} noPhotos={noPhotos}
            onPlayPause={() => { const r = rideRef.current; if (!r) return; if (r.playing) { r.pause(); setRidePlaying(false); } else { r.play(); setRidePlaying(true); } }}
            onSeek={(f) => rideRef.current?.seek(f)}
            onSpeed={(s) => { if (rideRef.current) rideRef.current.speed = s; }}
            onExit={stopRide} />
        )}
        {pick && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-primary px-5 py-2 text-[0.85rem] font-semibold text-primary-ink shadow-panel">
            {pick === "from" ? "Click the map to set your start" : "Click the map to set your destination"}
          </div>
        )}
        {toastMsg && (
          <div role="status" className="absolute bottom-6 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-[0.85rem] font-semibold text-primary-ink shadow-panel md:bottom-8">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
