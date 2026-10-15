"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, MapPin } from "lucide-react";
import type * as maplibregl from "maplibre-gl";
import { createMap, addLayers, applyBasemapTheme, applyPaint, setGhostPin } from "@/lib/engine/map";
import { LIVE_CITIES, cityInk, type City } from "@/lib/cities";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Header, CityIcon } from "./Header";

/** Home page: the nearest city's live stress map, with every city as a button to pick from. */
export default function HomeApp({ nearest }: { nearest: City }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const router = useRouter();

  // Streets only: no routing network or places, so the home map stays light.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = createMap(mapEl.current, nearest, { flat: window.matchMedia("(max-width: 767px)").matches });
    mapRef.current = map;
    // Downtown sits beside the city panel on desktop, above the sheet on phones.
    map.jumpTo({ padding: window.innerWidth < 768 ? { bottom: window.innerHeight * 0.45, top: 0, left: 0, right: 0 } : { left: 440, top: 0, right: 0, bottom: 0 } });
    map.on("load", () => {
      addLayers(map, nearest);
      applyPaint(map, { hasRoute: false });
      setMapReady(true);
    });
    // Step 1 of a trip right here: a click sets the start and hands off to the city's map for the end.
    map.getCanvas().style.cursor = "crosshair";
    map.on("mousemove", (e) => {
      if ((e.originalEvent as PointerEvent).pointerType === "touch") return;
      setGhostPin(map, "start", [e.lngLat.lng, e.lngLat.lat]);
    });
    const onLeave = () => setGhostPin(map, null);
    map.getCanvasContainer().addEventListener("mouseleave", onLeave);
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setGhostPin(map, "start", [lng, lat]);
      track("home_map_start", { city: nearest.slug });
      router.push(`/${nearest.slug}?from=${lng.toFixed(5)},${lat.toFixed(5)},Dropped pin`);
    });
    return () => { setGhostPin(map, null); map.remove(); mapRef.current = null; };
  }, [nearest, router]);
  useEffect(() => { if (mapReady && mapRef.current) applyBasemapTheme(mapRef.current, dark); }, [mapReady, dark]);

  // The nearest city leads the list, matching the map behind the panel.
  const cities = [nearest, ...LIVE_CITIES.filter((c) => c.slug !== nearest.slug)];

  return (
    <div className="fixed inset-0 flex flex-col bg-paper">
      <Header />
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0"><div ref={mapEl} className="h-full w-full" aria-label={`3D map of ${nearest.name} streets colored by bike stress`} role="region" /></div>
        {/* Same step prompt as the city map, so the flow reads as one: start here, end on the next screen. */}
        <div role="status"
          className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-primary py-2 pl-2 pr-5 text-[0.9rem] font-semibold text-primary-ink shadow-panel animate-in fade-in slide-in-from-top-3 duration-500 md:left-[calc(50%+220px)]">
          <span className="rounded-full bg-paper px-2.5 py-1 text-[0.78rem] font-bold text-ink">1 · Start</span>
          <span className="md:hidden">Tap the map to set your start</span>
          <span className="hidden md:inline">Click the map to set your start</span>
        </div>
        <aside aria-label="Cities" className={cn(
          "absolute z-10 flex flex-col overflow-hidden border border-line bg-paper shadow-panel",
          "inset-x-0 bottom-0 max-h-[55%] rounded-t-3xl",
          "md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:rounded-card",
        )}>
          <div className="overflow-y-auto overflow-x-hidden px-5 pb-5 pt-5">
            <h2 className="text-[1.5rem] font-bold leading-tight">Feel it before you ride it.</h2>
            <p className="mt-2 text-[0.85rem] text-ink-2">
              <span className="md:hidden">Tap</span><span className="hidden md:inline">Click</span> the map to start a trip in {nearest.name}, or pick another city.
              See the stress of every block, then ride it virtually.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {cities.map((c) => {
                const near = c.slug === nearest.slug;
                return (
                  <li key={c.slug} className={near ? "col-span-2" : undefined}>
                    <Link href={`/${c.slug}`} onClick={() => track("city_picked", { city: c.slug, nearest: near, from: "home" })}
                      style={{ "--c": c.color, "--c-ink": cityInk(c), borderColor: `${c.color}66`, background: `${c.color}14` } as React.CSSProperties}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-2xl border-2 px-2 transition hover:-translate-y-0.5 hover:shadow-panel",
                        "hover:![background:var(--c)] hover:[color:var(--c-ink)] focus-visible:![background:var(--c)] focus-visible:[color:var(--c-ink)]",
                        near ? "min-h-16 py-2" : "min-h-14 py-1.5 pr-2.5",
                      )}>
                      <CityIcon city={c} className={cn("rounded-full bg-white/95 p-0.5", near ? "size-11" : "size-8")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-bold leading-tight [overflow-wrap:anywhere]", near ? "text-[1.05rem]" : "text-[0.8rem] sm:text-[0.88rem]")}>{c.name}</span>
                        <span className="flex items-center gap-1.5 font-mono text-[0.76rem]">
                          <span className="opacity-75">{c.state}</span>
                          {near &&<span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-px font-sans text-[0.72rem] font-semibold text-primary-ink"><MapPin className="size-3" aria-hidden />Near you</span>}
                        </span>
                      </span>
                      {near && <ChevronRight className="size-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
