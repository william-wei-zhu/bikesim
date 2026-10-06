"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowDown, ArrowLeft } from "lucide-react";
import type * as maplibregl from "maplibre-gl";
import { loadNet, loadPois, loadBlocks, distM, nearestNode, edgeName, edgeMid, COMMUTER_LTS, type Net, type Poi, type BlockInfo } from "@/lib/engine/net";
import { routePair, routeLine, stretches as toStretches, explainStretch, type Stretch, type StretchWhy } from "@/lib/engine/graph";
import { createMap, addLayers, applyBasemapTheme, pauseImagery, applyPaint, setRouteGradient, setData, setEndpoints, setGhostPin, cityView, HOME_PITCH } from "@/lib/engine/map";
import { cityDataBase, type City } from "@/lib/cities";
import type { BikeLayer, BikeOverlay } from "@/lib/engine/bike3d";
import { lineFC, EMPTY_FC } from "@/lib/engine/geom";
import { createStreetView, streetViewZoom, streetViewHfov, STREETVIEW_BASE_PITCH, type StreetViewHandle } from "@/lib/engine/streetview";
import { Ride, type RideFrame } from "@/lib/engine/ride";
import type { Place } from "@/components/SearchBox";
import type { Routes, View, RouteKind } from "./types";
import { Header } from "./Header";
import { TripPanel } from "./TripPanel";
import { RideHud } from "./RideHud";
import { Loading } from "./Loading";
import { FinishCard } from "./FinishCard";
import { readDefaultView, readRider } from "@/lib/prefs";
import { authConfigured, getAccount, claimStreetViewRide, freeStreetViewUsed, markFreeStreetViewUsed, completeEmailLink, isEmailLinkReturn, DAILY_STREETVIEW_RIDES } from "@/lib/auth";
import { AuthSheet } from "@/components/AuthSheet";
import { track } from "@/lib/analytics";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY || "";
const VIEWS: { value: View; label: string }[] = GOOGLE_KEY
  ? [{ value: "street", label: "Street View" }, { value: "model", label: "3D model" }]
  : [{ value: "model", label: "3D model" }];
const STREET_MPS = 5;   // Street View pace at 1x (about 18 km/h, a real riding pace) so photos can keep up
const MODEL_MPS = 15;   // 3D model pace at 1x

function readUrl(city: City) {
  const p = new URLSearchParams(window.location.search);
  const [w, s, e, n] = city.box;
  const place = (k: string): Place | null => {
    const v = p.get(k); if (!v) return null;
    const [x, y, ...rest] = v.split(",");
    const X = Number(x), Y = Number(y);
    // A point from another city (an old link, a switch) is ignored rather than routed across the country.
    if (!(X >= w - 0.1 && X <= e + 0.1 && Y >= s - 0.1 && Y <= n + 0.1)) return null;
    return { x: X, y: Y, label: rest.join(",") || "Dropped pin" };
  };
  return { from: place("from"), to: place("to"), kind: (p.get("route") === "short" ? "short" : "calm") as RouteKind };
}

export default function MapApp({ city }: { city: City }) {
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

  const [init] = useState(() => (typeof window === "undefined" ? null : readUrl(city)));
  const [from, setFrom] = useState<Place | null>(init?.from ?? null);
  const [to, setTo] = useState<Place | null>(init?.to ?? null);
  const [pick, setPick] = useState<"from" | "to" | null>(null);
  const [kind, setKind] = useState<RouteKind>(init?.kind ?? "calm");
  const [view, setView] = useState<View>(() => (GOOGLE_KEY && typeof window !== "undefined" ? readDefaultView() : "model"));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [rideFrame, setRideFrame] = useState<RideFrame | null>(null);
  const [ridePlaying, setRidePlaying] = useState(false);
  const [riding, setRiding] = useState(false);
  const [noPhotos, setNoPhotos] = useState(false);
  // Set when a ride reaches the end: shows the finish card over the whole route.
  const [finished, setFinished] = useState<RouteKind | null>(null);
  // Title card shown while the camera flies down to street level.
  const [intro, setIntro] = useState<{ street: string; km: string } | null>(null);
  const rideRef = useRef<Ride | null>(null);
  const streetRef = useRef<StreetViewHandle | null>(null);
  const bikeRef = useRef<BikeLayer | null>(null);
  const overlayRef = useRef<BikeOverlay | null>(null);
  const layersAdded = useRef(false);
  // Street View costs real money: one free ride per device, then sign in (see lib/auth.ts).
  const [gate, setGate] = useState<((v: View | null) => void) | null>(null);
  const [confirmLink, setConfirmLink] = useState(false);
  const svGranted = useRef(false);

  const toast = useCallback((m: string) => { setToastMsg(m); window.setTimeout(() => setToastMsg((c) => (c === m ? null : c)), 3500); }, []);

  // ---------- data + map ----------
  useEffect(() => {
    let live = true;
    const base = cityDataBase(city);
    loadNet(base, "bin").then((n) => live && setNet(n)).catch((e) => live && setLoadError(String(e.message || e)));
    loadPois(base).then((x) => live && setPois(x)).catch(() => { /* search still works through the geocoder */ });
    return () => { live = false; };
  }, [attempt, city]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = createMap(mapEl.current, city, { flat: window.matchMedia("(max-width: 767px)").matches });
    mapRef.current = map;
    map.on("load", () => setMapReady(true));
    return () => { map.remove(); mapRef.current = null; };
  }, [city]);

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
  useEffect(() => {
    if (!routes) return;
    if ("error" in routes) { track("route_failed", { city: city.slug, reason: routes.error }); return; }
    track("route_planned", { city: city.slug, km: Math.round(routes.fastest.lengthM / 100) / 10,
      hostile_km: Math.round(routes.fastest.byLts[4] / 100) / 10, calm_route_km: Math.round(routes.calm.lengthM / 100) / 10 });
  }, [routes, city]);
  const ok = routes && "calm" in routes ? routes : null;
  // The route being ridden, and the other one (shown dotted for comparison).
  const chosen = ok ? (kind === "short" ? ok.fastest : ok.calm) : null;
  const other = ok ? (kind === "short" ? ok.calm : ok.fastest) : null;
  const stretches = useMemo(() => (net && chosen ? toStretches(net, chosen, (e) => edgeName(net, e)) : []), [net, chosen]);
  const line = useMemo(() => (net && chosen ? routeLine(net, chosen) : null), [net, chosen]);

  useEffect(() => {
    const map = mapRef.current;
    // Streets stream in as tiles, so they draw while the routing network is still downloading.
    if (!map || !mapReady || layersAdded.current) return;
    addLayers(map, city);
    layersAdded.current = true;
    applyBasemapTheme(map, dark);
    applyPaint(map, { hasRoute: false });
  }, [mapReady, dark, city]);
  useEffect(() => { if (layersAdded.current && mapRef.current) applyBasemapTheme(mapRef.current, dark); }, [dark]);
  useEffect(() => { if (layersAdded.current && mapRef.current) pauseImagery(mapRef.current, riding); }, [riding]);

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
      { padding: window.innerWidth < 768 ? { top: 60, bottom: window.innerHeight * 0.5, left: 40, right: 40 } : { top: 80, bottom: 80, left: 480, right: 80 }, duration: 900, maxZoom: 15.5, bearing: 0 });
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new URLSearchParams();
    const enc = (pl: Place) => `${pl.x.toFixed(5)},${pl.y.toFixed(5)},${pl.label}`;
    if (from) p.set("from", enc(from));
    if (to) p.set("to", enc(to));
    if (kind === "short") p.set("route", "short");
    const q = p.toString();
    // Only this city's own page carries its trip (a city switch must not drag the old trip along).
    const path = `/${city.slug}`;
    if (window.location.pathname !== path) return;
    window.history.replaceState(window.history.state, "", q ? `${path}?${q}` : path);
  }, [from, to, kind, city.slug]);

  // ---------- ride views ----------
  // Street View: real photos, two panorama loads per ride, crossfaded photo to photo along the route.
  useEffect(() => {
    const el = streetEl.current;
    const r = rideRef.current;
    if (!el || !riding || view !== "street" || !GOOGLE_KEY || !line || !r) return;
    let cancelled = false;
    const f = r.current;
    // Phones (portrait) zoom the panorama in and bring the rider closer, so neither looks tiny.
    const narrow = el.clientWidth < el.clientHeight || el.clientWidth < 768;
    createStreetView(el, GOOGLE_KEY, (d) => r.positionAt(d), f?.distM ?? 0, f?.heading ?? 0, (has) => setNoPhotos(!has),
      (look) => overlayRef.current?.setLook(look.yaw, look.pitch), streetViewZoom(narrow))
      .then((h) => {
        if (cancelled) { h.destroy(); return; }
        streetRef.current = h;
        r.limit = () => h.maxDistance();
      })
      .catch(() => { toast("Street View could not load. Showing the 3D model."); setView("model"); });
    r.baseMps = STREET_MPS;
    // The same 3D rider, drawn over the photos from behind (three.js loads with the first ride).
    const ov = overlayEl.current;
    if (ov) import("@/lib/engine/bike3d").then(({ createBikeOverlay }) => {
      if (cancelled) return;
      overlayRef.current = createBikeOverlay(ov, readRider(), streetViewHfov(narrow), STREETVIEW_BASE_PITCH, narrow ? 4.5 : 6);
      overlayRef.current.setState(f && f.edgeIdx >= 0 ? net!.elts[f.edgeIdx] : 1, false, f?.heading ?? 0);
    }).catch(() => { /* photos still work without the rider */ });
    return () => {
      cancelled = true;
      overlayRef.current?.destroy(); overlayRef.current = null;
      streetRef.current?.destroy(); streetRef.current = null;
      r.limit = null; r.baseMps = MODEL_MPS;
      setNoPhotos(false);
    };
  }, [riding, view, line, toast, net]);

  const stopRide = useCallback(() => {
    rideRef.current?.stop(); rideRef.current = null;
    setRideFrame(null); setRidePlaying(false); setRiding(false);
    const map = mapRef.current;
    if (map?.getLayer("rs-bike")) map.removeLayer("rs-bike");
    bikeRef.current = null;
    if (map && from && to) map.fitBounds([[Math.min(from.x, to.x), Math.min(from.y, to.y)], [Math.max(from.x, to.x), Math.max(from.y, to.y)]], { padding: 100, pitch: HOME_PITCH, bearing: 0, duration: 1000 });
  }, [from, to]);

  // Reached the end: back to the whole route (the camera pulls out), then the finish card.
  const endRef = useRef<() => void>(() => {});
  useEffect(() => { endRef.current = () => {
    stopRide(); setFinished(kind);
    track("ride_finished", { city: city.slug, route: kind });
    const map = mapRef.current;
    if (map && line) {
      const xs = line.coords.map((c) => c[0]), ys = line.coords.map((c) => c[1]);
      const narrow = window.innerWidth < 768;
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], {
        padding: narrow ? { top: 30, bottom: window.innerHeight * 0.66, left: 30, right: 30 } : { top: 60, bottom: 60, left: 480, right: 60 },
        pitch: 45, bearing: 0, duration: 1600, maxZoom: 16 });
    }
  }; });

  // ln: ride a specific route line (the finish card switches routes and starts at once).
  const startRide = useCallback((ln?: typeof line, startView: View = "model") => {
    setFinished(null);
    const map = mapRef.current;
    const line_ = ln ?? line;
    if (!map || !line_) return;
    rideRef.current?.stop();
    setView(startView);
    const r = new Ride(map, line_.coords, line_.segEdge, (f) => {
      setRideFrame(f);
      streetRef.current?.follow(f.distM, f.heading);
      const lts = f.edgeIdx >= 0 ? net!.elts[f.edgeIdx] : 1;
      bikeRef.current?.setPose(f.pos, f.heading, lts, true);
      overlayRef.current?.setState(lts, true, f.heading);
    }, () => { setRidePlaying(false); window.setTimeout(() => endRef.current(), 600); });
    r.baseMps = startView === "street" ? STREET_MPS : MODEL_MPS;
    rideRef.current = r;
    r.enableOrbit(); // drag to look around the rider in the 3D view
    setRiding(true); setRidePlaying(true);
    // The 3D bike (three.js) loads only when a ride starts.
    import("@/lib/engine/bike3d").then(({ createBikeLayer }) => {
      if (rideRef.current !== r || map.getLayer("rs-bike")) return;
      const bike = createBikeLayer(map, readRider());
      map.addLayer(bike);
      bikeRef.current = bike;
      bike.setPose(line_.coords[0], 0, 1, false);
    }).catch(() => { /* the ride still works without the bike model */ });
    const first = line_.segEdge.find((e) => e >= 0) ?? -1;
    const total = line_.coords.reduce((m, c, i) => (i ? m + distM(line_.coords[i - 1][0], line_.coords[i - 1][1], c[0], c[1]) : 0), 0);
    setIntro({ street: first >= 0 ? edgeName(net!, first) : "your route", km: (total / 1000).toFixed(1) });
    window.setTimeout(() => setIntro(null), 1900);
    map.flyTo({ center: line_.coords[0], zoom: 17.8, pitch: 74, duration: 1500 });
    window.setTimeout(() => { if (rideRef.current === r) r.play(); }, 1550);
  }, [line, net]);

  /** May this ride use Street View? Resolves to the view to ride in, or null if the rider closed the sign-in sheet. */
  const askStreetView = useCallback(async (): Promise<View | null> => {
    if (!authConfigured || svGranted.current) return "street";
    const claim = async (): Promise<View> => {
      try {
        if (!(await claimStreetViewRide())) {
          toast(`That's today's ${DAILY_STREETVIEW_RIDES} Street View rides. Riding in 3D; Street View is back tomorrow.`);
          return "model";
        }
      } catch { /* allowance check failed (offline): don't punish the rider */ }
      svGranted.current = true;
      return "street";
    };
    if (getAccount()) return claim();
    if (!freeStreetViewUsed()) { markFreeStreetViewUsed(); svGranted.current = true; return "street"; }
    track("streetview_gate_shown", { city: city.slug });
    const v = await new Promise<View | null>((resolve) => setGate(() => resolve));
    setGate(null);
    track("streetview_gate_result", { city: city.slug, result: v ?? "closed" });
    return v === "street" ? claim() : v;
  }, [toast, city]);

  // Each ride starts in the view chosen in Settings (switchable during the ride).
  const beginRide = useCallback(async (ln?: typeof line) => {
    svGranted.current = false;
    let v: View | null = GOOGLE_KEY ? readDefaultView() : "model";
    if (v === "street") v = await askStreetView();
    if (v) {
      startRide(ln, v);
      const c = (ln ?? line)?.coords ?? [];
      const m = c.reduce((t, p, i) => (i ? t + distM(c[i - 1][0], c[i - 1][1], p[0], p[1]) : 0), 0);
      track("ride_started", { city: city.slug, view: v, km: Math.round(m / 100) / 10 });
    }
  }, [askStreetView, startRide, city, line]);

  const switchView = useCallback(async (v: View) => {
    if (v === "street") {
      rideRef.current?.pause(); setRidePlaying(false);
      const ok = (await askStreetView()) === "street";
      rideRef.current?.play(); setRidePlaying(true);
      if (!ok) return;
    }
    setView(v);
  }, [askStreetView]);

  // Google refused the key (quota used up, or a site that isn't allowed): finish the ride in 3D.
  useEffect(() => {
    const fail = () => { toast("Street View is unavailable right now. Riding in 3D."); setView("model"); };
    window.addEventListener("bs-streetview-failed", fail);
    return () => window.removeEventListener("bs-streetview-failed", fail);
  }, [toast]);

  // Opened from an emailed sign-in link on a device that didn't ask for it: ask which email it was.
  useEffect(() => {
    if (!authConfigured || !isEmailLinkReturn()) return;
    completeEmailLink().then((done) => { if (!done) setConfirmLink(true); }).catch(() => setConfirmLink(true));
  }, []);

  const shareRide = useCallback(async () => {
    const url = window.location.href;
    try {
      track("trip_shared", { city: city.slug });
      if (navigator.share) { await navigator.share({ title: `BikeSim ${city.short}`, text: `Feel this ${city.short} bike trip before you ride it`, url }); return; }
      await navigator.clipboard.writeText(url);
      toast("Link copied. Anyone who opens it gets this exact trip.");
    } catch { /* share sheet dismissed */ }
  }, [toast, city]);

  // "Why is this stretch hostile?": the city's block facts, loaded on the first tap.
  const blocksRef = useRef<Promise<BlockInfo[]> | null>(null);
  const explain = useCallback(async (s: Stretch): Promise<StretchWhy> => {
    if (!net) throw new Error("no network");
    blocksRef.current ??= loadBlocks(cityDataBase(city)).catch((e) => { blocksRef.current = null; throw e; });
    return explainStretch(net, s, await blocksRef.current, city.records);
  }, [net, city]);

  const flyToStretch = useCallback((s: Stretch) => {
    if (!net) return;
    const [x, y] = edgeMid(net, s.edges[Math.floor(s.edges.length / 2)]);
    mapRef.current?.flyTo({ center: [x, y], zoom: 16.5, pitch: 62, duration: 1200,
      padding: window.innerWidth < 768 ? { bottom: window.innerHeight * 0.45, top: 0, left: 0, right: 0 } : { left: 440, top: 0, right: 0, bottom: 0 } });
  }, [net]);

  // Logo click: back to the start screen (no trip, north-up city view), even when already on this city's page.
  const goHome = useCallback(() => {
    stopRide(); setFinished(null);
    setFrom(null); setTo(null); setPick(null); setKind("calm");
    const map = mapRef.current;
    if (map) {
      setGhostPin(map, null);
      map.flyTo({ ...cityView(city), pitch: window.matchMedia("(max-width: 767px)").matches ? 0 : HOME_PITCH, duration: 1200 });
    }
  }, [stopRide, city]);
  useEffect(() => {
    window.addEventListener("rs-home", goHome);
    return () => window.removeEventListener("rs-home", goHome);
  }, [goHome]);

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
  // Which pin the next map click sets: guides first-time users step by step (Start, then End).
  const awaiting: "from" | "to" | null = riding ? null : pick ?? (!from ? "from" : !to ? "to" : null);
  const awaitingRef = useRef(awaiting);
  useEffect(() => {
    awaitingRef.current = awaiting;
    const map = mapRef.current; if (!map) return;
    map.getCanvas().style.cursor = awaiting ? "crosshair" : "";
    if (!awaiting) setGhostPin(map, null);
  }, [awaiting]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return;
    // Desktop: a see-through Start/End pin follows the cursor, showing exactly what a click will do.
    const onMove = (e: maplibregl.MapMouseEvent) => {
      const k = awaitingRef.current;
      if (!k || (e.originalEvent as PointerEvent).pointerType === "touch") return;
      setGhostPin(map, k === "from" ? "start" : "end", [e.lngLat.lng, e.lngLat.lat]);
    };
    const onLeave = () => setGhostPin(map, null);
    map.on("mousemove", onMove);
    map.getCanvasContainer().addEventListener("mouseleave", onLeave);
    return () => { map.off("mousemove", onMove); map.getCanvasContainer().removeEventListener("mouseleave", onLeave); };
  }, [mapReady]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return;
    const onClick = (e: maplibregl.MapMouseEvent) => clickRef.current(e);
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [mapReady]);

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <Header city={city} />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0"><div ref={mapEl} className="h-full w-full" aria-label={`3D map of ${city.name} streets colored by bike stress`} role="region" /></div>
        {/* During the intro card the map's fly-down shows; the photos fade in once it ends (they load meanwhile). */}
        <div ref={streetEl} className={riding && view === "street" ? `absolute inset-0 z-[5] transition-opacity duration-500 ${intro ? "opacity-0" : "opacity-100"}` : "hidden"} aria-label="Street View along the route" />
        <div ref={overlayEl} className={riding && view === "street" ? `pointer-events-none absolute inset-0 z-[6] transition-opacity duration-500 ${intro ? "opacity-0" : "opacity-100"}` : "hidden"} />
        {!net && <Loading city={city} error={loadError} onRetry={() => { setLoadError(null); setAttempt((a) => a + 1); }} />}
        {net && !riding && !finished && (
          <TripPanel city={city} pois={pois} routes={routes} kind={kind} setKind={setKind} stretches={stretches} from={from} to={to} setFrom={setFrom} setTo={setTo}
            setPick={setPick} awaiting={awaiting} onRide={() => beginRide()} onFlyTo={flyToStretch} onShare={shareRide} explain={explain} />
        )}
        {net && riding && rideFrame && (
          <RideHud net={net} frame={rideFrame} playing={ridePlaying} view={view} views={VIEWS} onView={switchView} noPhotos={noPhotos}
            onPlayPause={() => { const r = rideRef.current; if (!r) return; if (r.playing) { r.pause(); setRidePlaying(false); } else { r.play(); setRidePlaying(true); } }}
            onSeek={(f) => rideRef.current?.seek(f)}
            onSpeed={(s) => { if (rideRef.current) rideRef.current.speed = s; }}
            onExit={stopRide} />
        )}
        {net && !riding && finished && ok && (
          <FinishCard kind={finished} ridden={finished === "short" ? ok.fastest : ok.calm} other={finished === "short" ? ok.calm : ok.fastest}
            onRideOther={() => { const k: RouteKind = finished === "short" ? "calm" : "short"; setKind(k); beginRide(routeLine(net, k === "short" ? ok.fastest : ok.calm)); }}
            onRideAgain={() => beginRide()} onShare={shareRide} onClose={() => setFinished(null)} />
        )}
        {net && !awaiting && ok && !riding && !finished && (
          // Step 3: the route is ready; point at the Start the ride button. Tapping it reopens the trip panel
          // (on phones the panel may be collapsed) and brings the button into view.
          <button type="button" role="status" onClick={() => window.dispatchEvent(new Event("rs-show-trip"))}
            className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full bg-primary py-2 pl-2 pr-5 text-[0.9rem] font-semibold text-primary-ink shadow-panel animate-in fade-in slide-in-from-top-3 duration-500 md:left-[calc(50%+220px)]">
            <ArrowLeft className="rs-nudge-left hidden size-5 md:block" aria-hidden />
            <span className="rounded-full bg-[#0f8a55] px-2.5 py-1 text-[0.78rem] font-bold text-white">3 · Ride</span>
            <span className="hidden md:inline">Your route is ready. Click Start the ride</span>
            <span className="md:hidden">Route ready. Tap Start the ride</span>
            <ArrowDown className="rs-nudge-down size-5 md:hidden" aria-hidden />
          </button>
        )}
        {net && awaiting && (
          // Step prompt on the map itself; one-shot bounce on first appearance, no looping motion.
          <div key={awaiting} role="status"
            className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-primary py-2 pl-2 pr-5 text-[0.9rem] font-semibold text-primary-ink shadow-panel animate-in fade-in slide-in-from-top-3 duration-500 md:left-[calc(50%+220px)]">
            <span className={`rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${awaiting === "from" ? "bg-paper text-ink" : "bg-accent text-white"}`}>
              {awaiting === "from" ? "1 · Start" : "2 · End"}
            </span>
            <span className="md:hidden">Tap the map to set your {awaiting === "from" ? "start" : "end"}</span>
            <span className="hidden md:inline">Click the map to set your {awaiting === "from" ? "start" : "end"}</span>
          </div>
        )}
        {intro && (
          <div role="status" className="pointer-events-none absolute inset-x-0 top-[12%] z-30 flex justify-center p-6">
            <div className="rounded-card bg-primary px-7 py-5 text-center text-primary-ink shadow-panel animate-in fade-in zoom-in-95 duration-500">
              <p className="eyebrow !text-primary-ink/70">Starting on</p>
              <p className="mt-1 font-display text-[1.6rem] font-bold leading-tight">{intro.street}</p>
              <p className="mt-1 font-mono text-[0.85rem] opacity-80">{intro.km} km ahead</p>
            </div>
          </div>
        )}
        {gate && (
          <AuthSheet reason="streetview" onDone={() => gate("street")} onRide3D={() => gate("model")} onClose={() => gate(null)} />
        )}
        {confirmLink && <AuthSheet reason="confirm" onDone={() => setConfirmLink(false)} onClose={() => setConfirmLink(false)} />}
        {toastMsg && (
          <div role="status" className="absolute bottom-6 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-[0.85rem] font-semibold text-primary-ink shadow-panel md:bottom-8">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
