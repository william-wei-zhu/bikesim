"use client";
import { useState } from "react";
import { ArrowUpDown, Bike, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { LTS_INFO, type Poi } from "@/lib/engine/net";
import type { Stretch } from "@/lib/engine/graph";
import { SearchBox, type Place } from "@/components/SearchBox";
import { Btn, Card, Segmented, km } from "@/components/ui";
import type { Routes, View, RouteKind } from "./types";
import { cn } from "@/lib/utils";

const EXAMPLES: { label: string; from: Place; to: Place }[] = [
  { label: "Petworth to the Wharf", from: { label: "Petworth", x: -77.0247, y: 38.9413 }, to: { label: "The Wharf", x: -77.0236, y: 38.8786 } },
  { label: "Anacostia to Eastern Market", from: { label: "Anacostia", x: -76.9952, y: 38.8625 }, to: { label: "Eastern Market", x: -76.9963, y: 38.8862 } },
  { label: "Georgetown to Union Station", from: { label: "Georgetown", x: -77.0628, y: 38.9055 }, to: { label: "Union Station", x: -77.0063, y: 38.8973 } },
];
const BAR = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];
const SPEED_KMH = 16; // typical everyday cycling pace, for the time estimate

export function TripPanel(p: {
  pois: Poi[]; routes: Routes; kind: RouteKind; setKind: (k: RouteKind) => void; stretches: Stretch[];
  from: Place | null; to: Place | null; setFrom: (x: Place | null) => void; setTo: (x: Place | null) => void;
  setPick: (k: "from" | "to") => void; view: View; setView: (v: View) => void; views: { value: View; label: string }[];
  onRide: () => void; onFlyTo: (s: Stretch) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const ok = p.routes && "calm" in p.routes ? p.routes : null;
  const hostile = p.stretches.filter((s) => s.lts === 4);
  const hostileM = hostile.reduce((a, s) => a + s.lengthM, 0);
  const chosen = ok ? (p.kind === "short" ? ok.fastest : ok.calm) : null;
  const minutes = chosen ? Math.max(1, Math.round((chosen.lengthM / 1000 / SPEED_KMH) * 60)) : 0;
  const same = ok ? ok.calm.edges.join() === ok.fastest.edges.join() : false;
  const extra = ok ? ok.calm.lengthM - ok.fastest.lengthM : 0;
  const hostileDiff = ok ? ok.fastest.byLts[4] - ok.calm.byLts[4] : 0;
  const compare = !ok ? "" : same || (extra < 50 && hostileDiff < 10)
    ? "The lowest-stress route is also the shortest."
    : p.kind === "calm"
      ? `${km(extra)} longer than the shortest route (dotted), with ${km(Math.max(0, hostileDiff))} less hostile riding.`
      : `${km(extra)} shorter than the lowest-stress route (dotted), with ${km(Math.max(0, hostileDiff))} more hostile riding.`;

  return (
    <aside aria-label="Trip" className={cn(
      "absolute z-10 flex flex-col overflow-hidden border border-line bg-paper shadow-panel",
      "inset-x-0 bottom-0 max-h-[50%] rounded-t-3xl",
      "md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:rounded-card",
    )}>
      <button onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}
        className="flex items-center justify-center gap-2 py-1.5 md:hidden cursor-pointer">
        <span className="h-1.5 w-10 rounded-full bg-line" />
        {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        <span className="sr-only">{collapsed ? "Show trip" : "Hide trip"}</span>
      </button>
      <div className="overflow-y-auto px-5 pb-5 md:pt-5">
        {!ok && <h2 className="text-[1.5rem] font-bold">Feel it before you ride it.</h2>}
        {!ok && (
          <p className="mt-2 text-[0.85rem] text-ink-2">
            Pick a DC trip, see its stress, then ride it virtually.
          </p>
        )}

        <div className={cn(!ok && "mt-4", "space-y-2", collapsed && "hidden md:block")}>
          <div className="flex items-center gap-2">
            <div className="flex-1"><SearchBox placeholder="Start: address or place" pois={p.pois} value={p.from} onPick={p.setFrom} onClear={() => p.setFrom(null)} /></div>
            {!p.from && <PickBtn on={() => p.setPick("from")} />}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1"><SearchBox placeholder="Destination" pois={p.pois} value={p.to} onPick={p.setTo} onClear={() => p.setTo(null)} /></div>
            {!p.to && <PickBtn on={() => p.setPick("to")} />}
          </div>
          {p.from && p.to && (
            <Btn size="sm" variant="quiet" onClick={() => { const f = p.from; p.setFrom(p.to); p.setTo(f); }}>
              <ArrowUpDown className="size-3.5" /> Swap
            </Btn>
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
            <p className="mt-3 text-[0.8rem] text-ink-2">Or click the map twice: first your start, then your destination.</p>
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
            <div className="mt-4">
              <p className="eyebrow mb-2">Route</p>
              <Segmented<RouteKind> stretch label="Route" value={p.kind} onChange={p.setKind}
                options={[{ value: "short", label: `Shortest · ${km(ok.fastest.lengthM)}` }, { value: "calm", label: `Lowest stress · ${km(ok.calm.lengthM)}` }]} />
            </div>
            <div className="mt-4">
              <p className="eyebrow mb-2">Ride it in</p>
              <Segmented<View> stretch label="Ride view" value={p.view} onChange={p.setView} options={p.views} />
            </div>
            <Btn variant="primary" className="mt-3 w-full" onClick={p.onRide}><Bike className="size-4" /> Start the ride</Btn>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <div><p className="font-display text-[1.5rem] font-bold leading-tight">{km(chosen!.lengthM)}</p><p className="eyebrow mt-1">Distance</p></div>
              <div><p className="font-display text-[1.5rem] font-bold leading-tight">{minutes} min</p><p className="eyebrow mt-1">At {SPEED_KMH} km/h</p></div>
              <div><p className="font-display text-[1.5rem] font-bold leading-tight">{km(hostileM)}</p><p className="eyebrow mt-1">Hostile</p></div>
            </div>

            <div className="mt-4">
              <div className="flex h-3.5 overflow-hidden rounded-full" aria-label="Distance by stress level">
                {[1, 2, 3, 4].map((l) => chosen!.byLts[l] > 0 && (
                  <div key={l} className={BAR[l]} style={{ width: `${(chosen!.byLts[l] / chosen!.lengthM) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {[1, 2, 3, 4].map((l) => (
                  <li key={l} className="flex items-center gap-2 text-[0.8rem]">
                    <span className={cn("size-3 shrink-0 rounded-full", BAR[l])} aria-hidden />
                    <span className="flex-1">{LTS_INFO[l]!.name}</span>
                    <span className="font-mono text-[0.75rem]">{km(chosen!.byLts[l])}</span>
                  </li>
                ))}
              </ul>
            </div>

            {hostile.length > 0 && (
              <div className="mt-4">
                <p className="eyebrow mb-2">{p.kind === "calm" ? "Hostile stretches you can't avoid" : "Hostile stretches on this route"}</p>
                <ul className="space-y-1.5">
                  {hostile.slice(0, 6).map((s) => (
                    <li key={s.startM}>
                      <button onClick={() => p.onFlyTo(s)} className="flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2 text-left hover:border-ink cursor-pointer">
                        <span className="size-3 shrink-0 rounded-full bg-lts4" aria-hidden />
                        <span className="flex-1 truncate text-[0.82rem] font-semibold underline underline-offset-2">{s.name}</span>
                        <span className="font-mono text-[0.75rem]">{km(s.lengthM)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-[0.8rem] text-ink-2">{compare}</p>

          </>
        )}

        <footer className="mt-6 border-t border-line pt-3 text-[0.75rem] leading-relaxed text-ink-2">
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
