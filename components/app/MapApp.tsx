"use client";
/* eslint-disable react-hooks/refs -- map/ride refs are only read in effects and event handlers; the rule flags the ctx object passed to children (false positive, 2026-10-01). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type * as maplibregl from "maplibre-gl";
import { loadNet, loadExtras, nearestNode, edgeMid, RIDERS, type Net, type Extras, type Rider } from "@/lib/engine/net";
import { islands, routePair, routeLine, rideable } from "@/lib/engine/graph";
import {
  createMap, addLayers, applyBasemapTheme, applyPaint, applyIslands, setExtras as mapSetExtras, setPois, setSelected,
  setVisible, setData, riseWalls, DC_VIEW, type Mode,
} from "@/lib/engine/map";
import { lineFC, pointsFC, EMPTY_FC } from "@/lib/engine/geom";
import { Ride, type RideFrame } from "@/lib/engine/ride";
import type { Place } from "@/components/SearchBox";
import type { AppCtx } from "./types";
import { Header } from "./Header";
import { Panel } from "./Panel";
import { RideHud } from "./RideHud";
import { Loading } from "./Loading";

const MODES: Mode[] = ["explore", "islands", "build", "ride"];
const RIDER_KEYS = Object.keys(RIDERS) as Rider[];

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const place = (k: string): Place | null => {
    const v = p.get(k); if (!v) return null;
    const [x, y, ...rest] = v.split(",");
    const X = Number(x), Y = Number(y);
    return Number.isFinite(X) && Number.isFinite(Y) ? { x: X, y: Y, label: rest.join(",") || "Dropped pin" } : null;
  };
  const mode = p.get("mode") as Mode; const rider = p.get("rider") as Rider;
  return {
    mode: MODES.includes(mode) ? mode : "explore",
    rider: RIDER_KEYS.includes(rider) ? rider : "casual",
    fixed: new Set((p.get("fix") || "").split(",").filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0)),
    sel: p.get("b") !== null && p.get("b") !== "" ? Number(p.get("b")) : null,
    from: place("from"), to: place("to"), focus: place("at"),
  };
}

export default function MapApp() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [net, setNet] = useState<Net | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const [init] = useState(() => (typeof window === "undefined" ? null : readUrl()));
  const [mode, setModeRaw] = useState<Mode>(init?.mode ?? "explore");
  const [rider, setRider] = useState<Rider>(init?.rider ?? "casual");
  const [fixed, setFixed] = useState<Set<number>>(init?.fixed ?? new Set());
  const [selEdge, setSelEdge] = useState<number | null>(init?.sel ?? null);
  const [flat, setFlat] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [showCrashes, setShowCrashes] = useState(false);
  const [focus, setFocus] = useState<Place | null>(init?.focus ?? null);
  const [from, setFrom] = useState<Place | null>(init?.from ?? null);
  const [to, setTo] = useState<Place | null>(init?.to ?? null);
  const [pick, setPick] = useState<AppCtx["pick"]>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [rideFrame, setRideFrame] = useState<RideFrame | null>(null);
  const [ridePlaying, setRidePlaying] = useState(false);
  const [riding, setRiding] = useState(false);
  const rideRef = useRef<Ride | null>(null);
  const wallScale = useRef(0);
  const layersAdded = useRef(false);
  const prevSel = useRef<number | null>(null);

  const threshold = RIDERS[rider].lts;
  const toast = useCallback((m: string) => { setToastMsg(m); window.setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 3500); }, []);

  // ---------- data ----------
  useEffect(() => {
    let live = true;
    loadNet().then((n) => live && setNet(n)).catch((e) => live && setLoadError(String(e.message || e)));
    loadExtras().then((x) => live && setExtras(x)).catch(() => live && toast("Some details (crashes, schools) failed to load. The map still works."));
    return () => { live = false; };
  }, [attempt, toast]);

  // ---------- map ----------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = createMap(mapEl.current, { flat: window.matchMedia("(max-width: 767px)").matches });
    mapRef.current = map;
    map.on("load", () => setMapReady(true));
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const is = useMemo(() => (net ? islands(net, threshold, fixed) : null), [net, threshold, fixed]);
  const focusNode = useMemo(() => (net && focus ? nearestNode(net, focus.x, focus.y, 800) : -1), [net, focus]);

  const paint = useCallback(() => {
    const map = mapRef.current;
    if (!map || !layersAdded.current || !is) return;
    const focusRoot = mode === "islands" && focusNode >= 0 ? is.comp[focusNode] : null;
    applyPaint(map, { mode, threshold, wallScale: wallScale.current, dark, focusRoot });
  }, [mode, threshold, dark, is, focusNode]);

  // layers once map + network are ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !net || !is || layersAdded.current) return;
    addLayers(map, net, null);
    layersAdded.current = true;
    applyBasemapTheme(map, dark);
    applyIslands(map, net, is, threshold, fixed);
    riseWalls((k) => {
      wallScale.current = k;
      applyPaint(map, { mode, threshold, wallScale: k, dark, focusRoot: null });
    });
  }, [mapReady, net, is, dark, mode, threshold, fixed]);

  useEffect(() => { if (layersAdded.current && mapRef.current) applyBasemapTheme(mapRef.current, dark); }, [dark]);
  useEffect(() => { paint(); }, [paint]);
  useEffect(() => {
    if (layersAdded.current && mapRef.current && net && is) applyIslands(mapRef.current, net, is, threshold, fixed);
  }, [is, net, threshold, fixed]);
  useEffect(() => { if (layersAdded.current && mapRef.current && extras) mapSetExtras(mapRef.current, extras); }, [extras, mapReady, net]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !layersAdded.current) return;
    setVisible(map, "rs-crashes", showCrashes);
    setVisible(map, "rs-wards", mode === "islands");
    setVisible(map, "rs-pois", mode === "islands" || mode === "ride");
  }, [showCrashes, mode, mapReady, net]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !layersAdded.current || !extras || !is) return;
    const root = focusNode >= 0 ? is.comp[focusNode] : is.ranked[0];
    setPois(map, extras.pois, (p) => is.comp[p.node] === root);
  }, [extras, is, focusNode, mapReady, net]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !layersAdded.current) return;
    setSelected(map, prevSel.current, selEdge);
    prevSel.current = selEdge;
  }, [selEdge, mapReady, net]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return;
    map.easeTo({ pitch: flat ? 0 : DC_VIEW.pitch, duration: 700 });
  }, [flat, mapReady]);

  // ---------- routes ----------
  const routes = useMemo(() => {
    if (!net || !from || !to) return null;
    const a = nearestNode(net, from.x, from.y, 800), b = nearestNode(net, to.x, to.y, 800);
    if (a < 0 || b < 0) return { error: "far" as const };
    if (a === b) return { error: "same" as const };
    const pair = routePair(net, a, b, threshold, fixed);
    if (!pair.calm || !pair.fastest) return { error: "none" as const };
    return { a, b, ...pair, calm: pair.calm, fastest: pair.fastest };
  }, [net, from, to, threshold, fixed]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !layersAdded.current || !net) return;
    const show = mode === "ride";
    const ends = [from, to].filter(Boolean) as Place[];
    setData(map, "rs-ends", show ? pointsFC(ends) : EMPTY_FC);
    if (show && routes && "calm" in routes) {
      setData(map, "rs-route", lineFC(routeLine(net, routes.calm).coords));
      const sameAsCalm = routes.fastest.edges.join() === routes.calm.edges.join();
      setData(map, "rs-route-fast", sameAsCalm ? EMPTY_FC : lineFC(routeLine(net, routes.fastest).coords));
      setData(map, "rs-break", {
        type: "FeatureCollection",
        features: routes.calm.breaking.map((e) => {
          const c = net.ecoords[e]; const coords: [number, number][] = [];
          for (let k = 0; k < c.length; k += 2) coords.push([c[k], c[k + 1]]);
          return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
        }),
      });
    } else {
      for (const id of ["rs-route", "rs-route-fast", "rs-break"]) setData(map, id, EMPTY_FC);
    }
  }, [routes, mode, from, to, net, mapReady]);

  // fit both ends when a new trip is set
  const routeKey = routes && "calm" in routes ? `${routes.a}-${routes.b}` : "";
  useEffect(() => {
    const map = mapRef.current; if (!map || !net || !routeKey || !from || !to || rideRef.current) return;
    map.fitBounds([[Math.min(from.x, to.x), Math.min(from.y, to.y)], [Math.max(from.x, to.x), Math.max(from.y, to.y)]],
      { padding: window.innerWidth < 768 ? { top: 80, bottom: window.innerHeight * 0.5, left: 40, right: 40 } : { top: 80, bottom: 80, left: 480, right: 80 }, duration: 900, maxZoom: 15 });
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- URL state ----------
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("mode", mode); p.set("rider", rider);
    if (fixed.size) p.set("fix", [...fixed].join(","));
    if (selEdge !== null && mode === "explore") p.set("b", String(selEdge));
    const enc = (pl: Place) => `${pl.x.toFixed(5)},${pl.y.toFixed(5)},${pl.label}`;
    if (focus && mode === "islands") p.set("at", enc(focus));
    if (from && mode === "ride") p.set("from", enc(from));
    if (to && mode === "ride") p.set("to", enc(to));
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, [mode, rider, fixed, selEdge, focus, from, to]);

  // ---------- actions ----------
  const flyTo = useCallback((x: number, y: number, zoom = 15) => {
    const narrow = window.innerWidth < 768;
    mapRef.current?.flyTo({ center: [x, y], zoom, pitch: flat ? 0 : 55, padding: narrow ? { bottom: window.innerHeight * 0.45, top: 0, left: 0, right: 0 } : { left: 440, top: 0, right: 0, bottom: 0 }, duration: 1200 });
  }, [flat]);
  const flyToEdge = useCallback((e: number) => { if (net) { const [x, y] = edgeMid(net, e); flyTo(x, y, 16); } }, [net, flyTo]);

  const toggleFix = useCallback((e: number) => {
    setFixed((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n; });
  }, []);
  const addFixes = useCallback((es: number[]) => setFixed((s) => new Set([...s, ...es])), []);
  const clearFixes = useCallback(() => setFixed(new Set()), []);

  const setMode = useCallback((m: Mode) => {
    setModeRaw(m); setPick(null);
    if (m !== "explore") setSelEdge(null);
  }, []);

  const stopRide = useCallback(() => {
    rideRef.current?.stop(); rideRef.current = null; setRideFrame(null); setRidePlaying(false); setRiding(false);
    const map = mapRef.current;
    if (map && from && to) map.fitBounds([[Math.min(from.x, to.x), Math.min(from.y, to.y)], [Math.max(from.x, to.x), Math.max(from.y, to.y)]], { padding: 100, pitch: flat ? 0 : DC_VIEW.pitch, duration: 1000 });
  }, [from, to, flat]);

  const startRide = useCallback(() => {
    const map = mapRef.current;
    if (!map || !net || !routes || !("calm" in routes)) return;
    const { coords, segEdge } = routeLine(net, routes.calm);
    rideRef.current?.stop();
    const r = new Ride(map, coords, segEdge, (f) => setRideFrame(f), () => setRidePlaying(false));
    rideRef.current = r;
    setRiding(true);
    setRidePlaying(true);
    map.flyTo({ center: coords[0], zoom: 17.2, pitch: 70, duration: 1500 });
    window.setTimeout(() => { if (rideRef.current === r) r.play(); }, 1550);
  }, [net, routes]);

  // ---------- map clicks ----------
  const clickRef = useRef<(e: maplibregl.MapMouseEvent) => void>(() => {});
  const pickRefMode = useRef(false);
  const handleClick = (ev: maplibregl.MapMouseEvent) => {
    const map = mapRef.current; if (!map || !net || rideRef.current) return;
    const { lng: x, lat: y } = ev.lngLat;
    const pinLabel = "Dropped pin";
    if (pick === "from" || (mode === "ride" && !pick && !from)) { setFrom({ x, y, label: pinLabel }); setPick(pick === "from" && !to ? "to" : null); return; }
    if (pick === "to" || (mode === "ride" && !pick && !to)) { setTo({ x, y, label: pinLabel }); setPick(null); return; }
    if (pick === "focus" || mode === "islands") { setFocus({ x, y, label: pinLabel }); setPick(null); return; }
    const p = ev.point;
    const feats = map.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], { layers: ["rs-walls", "rs-streets"] });
    const e = feats.length ? Number(feats[0].id) : -1;
    if (mode === "explore") { setSelEdge(e >= 0 ? e : null); return; }
    if (mode === "build" && e >= 0) {
      if (net.elts[e] <= threshold && !fixed.has(e)) { toast(`That street is already comfortable for a ${RIDERS[rider].label.toLowerCase()} rider.`); return; }
      toggleFix(e);
    }
  };
  useEffect(() => {
    clickRef.current = handleClick;
    pickRefMode.current = !!pick || mode === "ride" || mode === "islands";
  });
  useEffect(() => {
    const map = mapRef.current; if (!map || !mapReady) return;
    const onClick = (e: maplibregl.MapMouseEvent) => clickRef.current(e);
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!layersAdded.current) return;
      const f = map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ["rs-walls", "rs-streets"] });
      map.getCanvas().style.cursor = f.length || pickRefMode.current ? "pointer" : "";
    };
    map.on("click", onClick); map.on("mousemove", onMove);
    return () => { map.off("click", onClick); map.off("mousemove", onMove); };
  }, [mapReady]);

  const ctx = useMemo<AppCtx | null>(() => (net && is ? {
    net, extras, mode, setMode, rider, threshold, fixed, toggleFix, addFixes, clearFixes, is,
    selEdge, setSelEdge, flat, setFlat, showCrashes, setShowCrashes,
    focus, setFocus, focusNode, from, to, setFrom, setTo, pick, setPick, flyTo, flyToEdge, startRide, toast,
  } : null), [net, extras, mode, setMode, rider, threshold, fixed, toggleFix, addFixes, clearFixes, is, selEdge, flat, showCrashes,
    focus, focusNode, from, to, pick, flyTo, flyToEdge, startRide, toast]);

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <Header mode={mode} setMode={setMode} />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0"><div ref={mapEl} className="h-full w-full" aria-label="Map of Washington, DC streets colored by bike stress" role="region" /></div>
        {!ctx && <Loading error={loadError} onRetry={() => { setLoadError(null); setAttempt((a) => a + 1); }} />}
        {ctx && !rideFrame && (
          <Panel ctx={ctx} setRider={setRider} routes={routes} />
        )}
        {ctx && rideFrame && riding && (
          <RideHud net={ctx.net} frame={rideFrame} playing={ridePlaying} rider={rider} fixed={fixed}
            onPlayPause={() => { const r = rideRef.current; if (!r) return; if (r.playing) { r.pause(); setRidePlaying(false); } else { r.play(); setRidePlaying(true); } }}
            onSeek={(f) => rideRef.current?.seek(f)}
            onSpeed={(s) => { if (rideRef.current) rideRef.current.speed = s; }}
            onExit={stopRide}
            isRideable={(e) => rideable(ctx.net, e, threshold, fixed)} />
        )}
        {pick && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-primary px-5 py-2 text-[0.8rem] font-semibold text-primary-ink shadow-panel">
            {pick === "from" ? "Click the map to set your start" : pick === "to" ? "Click the map to set your destination" : "Click the map to pick a home"}
          </div>
        )}
        {toastMsg && (
          <div role="status" className="absolute bottom-6 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-[0.8rem] font-semibold text-primary-ink shadow-panel md:bottom-8">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
