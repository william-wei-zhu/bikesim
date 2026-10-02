"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpDown, Bike, ChevronDown, ChevronRight, ChevronUp, MapPin, Share2 } from "lucide-react";
import { LTS_INFO, type Poi } from "@/lib/engine/net";
import type { Stretch, StretchWhy } from "@/lib/engine/graph";
import { SearchBox, type Place } from "@/components/SearchBox";
import { Btn, Card, Segmented, km } from "@/components/ui";
import type { Routes, RouteKind } from "./types";
import { cn } from "@/lib/utils";

const EXAMPLES: { label: string; from: Place; to: Place }[] = [
  { label: "Petworth to the Wharf", from: { label: "Petworth", x: -77.0247, y: 38.9413 }, to: { label: "The Wharf", x: -77.0236, y: 38.8786 } },
  { label: "Anacostia to Eastern Market", from: { label: "Anacostia", x: -76.9952, y: 38.8625 }, to: { label: "Eastern Market", x: -76.9963, y: 38.8862 } },
  { label: "Georgetown to Union Station", from: { label: "Georgetown", x: -77.0628, y: 38.9055 }, to: { label: "Union Station", x: -77.0063, y: 38.8973 } },
];
const BAR = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];

export function TripPanel(p: {
  pois: Poi[]; routes: Routes; kind: RouteKind; setKind: (k: RouteKind) => void; stretches: Stretch[];
  from: Place | null; to: Place | null; setFrom: (x: Place | null) => void; setTo: (x: Place | null) => void;
  setPick: (k: "from" | "to") => void; awaiting: "from" | "to" | null;
  onRide: () => void; onFlyTo: (s: Stretch) => void; onShare: () => void; explain: (s: Stretch) => Promise<StretchWhy>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Which hostile stretch is open, and its RideScore DC facts once loaded.
  const [open, setOpen] = useState<number | null>(null);
  const [why, setWhy] = useState<Record<number, StretchWhy | "error">>({});
  const toggleWhy = (s: Stretch) => {
    p.onFlyTo(s);
    if (open === s.startM) { setOpen(null); return; }
    setOpen(s.startM);
    if (!why[s.startM]) p.explain(s).then((w) => setWhy((m) => ({ ...m, [s.startM]: w }))).catch(() => setWhy((m) => ({ ...m, [s.startM]: "error" })));
  };
  // The "3 · Ride" prompt on the map reopens a collapsed panel and scrolls Start the ride into view.
  useEffect(() => {
    const show = () => {
      setCollapsed(false);
      window.setTimeout(() => document.querySelector(".rs-ride-cta")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    };
    window.addEventListener("rs-show-trip", show);
    return () => window.removeEventListener("rs-show-trip", show);
  }, []);
  const ok = p.routes && "calm" in p.routes ? p.routes : null;
  const hostile = p.stretches.filter((s) => s.lts === 4);
  const chosen = ok ? (p.kind === "short" ? ok.fastest : ok.calm) : null;

  return (
    <aside aria-label="Trip" className={cn(
      "absolute z-10 flex flex-col overflow-hidden border border-line bg-paper shadow-panel",
      "inset-x-0 bottom-0 max-h-[50%] rounded-t-3xl",
      "md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:rounded-card",
    )}>
      {/* Phones: the handle collapses the whole sheet to a slim bar so the full map shows. */}
      <button onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}
        className={cn("flex items-center justify-center gap-2 md:hidden cursor-pointer", collapsed ? "min-h-12 py-2" : "py-1.5")}>
        <span className="h-1.5 w-10 rounded-full bg-line" />
        {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        {collapsed
          ? <span className="text-[0.85rem] font-semibold">Show trip</span>
          : <span className="sr-only">Hide trip and show the full map</span>}
      </button>
      <div className={cn("overflow-y-auto overflow-x-hidden px-5 pb-5 md:block md:pt-5", collapsed && "hidden")}>
        {!ok && <h2 className="text-[1.5rem] font-bold">Feel it before you ride it.</h2>}
        {!ok && (
          <p className="mt-2 text-[0.85rem] text-ink-2">
            Pick a start and end spot, then ride it virtually.
          </p>
        )}

        <div className={cn(!ok && "mt-4", "space-y-2")}>
          <div className={cn("flex items-center gap-2 rounded-full", p.awaiting === "from" && "ring-2 ring-accent ring-offset-2 ring-offset-paper")}>
            <div className="flex-1"><SearchBox placeholder="Start: search, or click the map" pois={p.pois} value={p.from} onPick={p.setFrom} onClear={() => p.setFrom(null)} /></div>
            {!p.from && <PickBtn on={() => p.setPick("from")} />}
          </div>
          <div className={cn("flex items-center gap-2 rounded-full", p.awaiting === "to" && "ring-2 ring-accent ring-offset-2 ring-offset-paper")}>
            <div className="flex-1"><SearchBox placeholder="End: search, or click the map" pois={p.pois} value={p.to} onPick={p.setTo} onClear={() => p.setTo(null)} /></div>
            {!p.to && <PickBtn on={() => p.setPick("to")} />}
          </div>
          {p.from && p.to && (
            <div className="flex gap-2">
              <Btn size="sm" variant="quiet" onClick={() => { const f = p.from; p.setFrom(p.to); p.setTo(f); }}>
                <ArrowUpDown className="size-3.5" /> Swap
              </Btn>
              {ok && (
                <Btn size="sm" variant="quiet" onClick={p.onShare}>
                  <Share2 className="size-3.5" /> Share
                </Btn>
              )}
            </div>
          )}
        </div>

        {!p.from && !p.to && (
          <div className="mt-4">
            <p className="eyebrow mb-2">Try a trip</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Btn key={ex.label} size="sm" variant="quiet" onClick={() => { p.setFrom(ex.from); p.setTo(ex.to); }}>{ex.label}</Btn>
              ))}
            </div>
            
          </div>
        )}

        {p.routes && "error" in p.routes && (
          <Card className="mt-4">
            <p className="text-[0.85rem] font-semibold">
              {p.routes.error === "far" ? "One of those points is outside DC's street network. Pick a spot inside DC."
                : p.routes.error === "same" ? "Start and destination are the same spot. Move one of them."
                : "These two points are not connected by any street in our data. Try a nearby spot."}
            </p>
          </Card>
        )}

        {ok && (
          <>
            {/* The call to action once a trip is set: route green, larger, and it keeps nudging until clicked. */}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[0.85rem] font-bold text-accent-ink">
              Next step <ArrowDown className="rs-nudge-down size-4" aria-hidden />
            </p>
            <button key={`${ok.a}-${ok.b}`} onClick={p.onRide}
              className="rs-ride-cta group mt-1.5 flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full text-[1.05rem] font-bold text-white">
              <Bike className="size-5" aria-hidden /> Start the ride
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </button>
            <div className="mt-4">
              <p className="eyebrow mb-2">Route</p>
              <Segmented<RouteKind> stretch label="Route" value={p.kind} onChange={p.setKind}
                options={[{ value: "short", label: "Shortest", sub: km(ok.fastest.lengthM) }, { value: "calm", label: "Lowest stress", sub: km(ok.calm.lengthM) }]} />
            </div>

            <div className="mt-4">
              <div className="flex h-3.5 overflow-hidden rounded-full" aria-label="Distance by stress level">
                {[1, 2, 3, 4].map((l) => chosen!.byLts[l] > 0 && (
                  <div key={l} className={BAR[l]} style={{ width: `${(chosen!.byLts[l] / chosen!.lengthM) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {[1, 2, 3, 4].map((l) => (
                  <li key={l} className="flex items-center gap-2 whitespace-nowrap text-[0.82rem]">
                    <span className={cn("size-3 shrink-0 rounded-full", BAR[l])} aria-hidden />
                    <span className="flex-1">{LTS_INFO[l]!.name}</span>
                    <span className="font-mono text-[0.78rem]">{km(chosen!.byLts[l])}</span>
                  </li>
                ))}
              </ul>
            </div>

            {hostile.length > 0 && (
              <div className="mt-4">
                <p className="eyebrow mb-2">{p.kind === "calm" ? "Hostile stretches you can't avoid" : "Hostile stretches on this route"}</p>
                <ul className="space-y-2">
                  {hostile.slice(0, 6).map((s) => {
                    const isOpen = open === s.startM, w = why[s.startM];
                    return (
                      <li key={s.startM} className={cn("rounded-2xl border bg-paper transition-colors", isOpen ? "border-ink" : "border-line")}>
                        <button onClick={() => toggleWhy(s)} aria-expanded={isOpen}
                          className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2 text-left hover:bg-surface">
                          <span className="size-3 shrink-0 rounded-full bg-lts4" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.88rem] font-semibold">{s.name}</span>
                            <span className="block text-[0.78rem] text-ink-2">{km(s.lengthM)} · {isOpen ? "Hide details" : "Why is it hostile?"}</span>
                          </span>
                          <ChevronRight className={cn("size-4 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} aria-hidden />
                        </button>
                        {isOpen && (
                          <div className="px-3.5 pb-3 animate-in fade-in duration-200">
                            {!w && <p className="text-[0.82rem] text-ink-2">Loading RideScore DC street data…</p>}
                            {w === "error" && <p className="text-[0.82rem] text-ink-2">Could not load the street details. Try again.</p>}
                            {w && w !== "error" && (
                              <>
                                <ul className="flex flex-wrap gap-1.5">
                                  {w.reasons.map((r) => (
                                    <li key={r} className="rounded-full bg-surface px-2.5 py-1 text-[0.8rem] font-semibold">{r}</li>
                                  ))}
                                </ul>
                                {w.source === "ridescore" && (
                                  <p className="mt-2 text-[0.8rem] text-ink-2">
                                    {w.crashes > 0
                                      ? <>{w.crashes} reported crash{w.crashes > 1 ? "es" : ""} on these blocks in 5 years{w.serious + w.fatal > 0 ? `, ${w.serious + w.fatal} serious or fatal` : ""}.</>
                                      : "No reported crashes on these blocks in 5 years."}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}


          </>
        )}

        <footer className="mt-6 border-t border-line pt-3 text-[0.78rem] leading-relaxed text-ink-2">
          Built by <a className="underline underline-offset-2" href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noreferrer">William Zhu</a>
          {" · "}Stress scores from <a className="underline underline-offset-2" href="https://ridescoredc.com" target="_blank" rel="noreferrer">RideScore DC</a> by Civic Tech DC
          {" · "}<a className="underline underline-offset-2" href="/privacy">Privacy</a>
        </footer>
      </div>
    </aside>
  );
}

function PickBtn({ on }: { on: () => void }) {
  return (
    <button onClick={on} aria-label="Pick on map" title="Pick on map" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
      <MapPin className="size-4" />
    </button>
  );
}
