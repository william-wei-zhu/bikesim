"use client";
import { ArrowUpDown, Bike, Hammer, MapPin } from "lucide-react";
import { edgeName, RIDERS } from "@/lib/engine/net";
import { SearchBox, type Place } from "@/components/SearchBox";
import { Btn, Card, TextLink, km } from "@/components/ui";
import type { AppCtx, Routes } from "./types";

const EXAMPLES: { label: string; from: Place; to: Place }[] = [
  { label: "Petworth to the Wharf", from: { label: "Petworth", x: -77.0247, y: 38.9413 }, to: { label: "The Wharf", x: -77.0236, y: 38.8786 } },
  { label: "Anacostia to Eastern Market", from: { label: "Anacostia", x: -76.9952, y: 38.8625 }, to: { label: "Eastern Market", x: -76.9963, y: 38.8862 } },
  { label: "Georgetown to Union Station", from: { label: "Georgetown", x: -77.0628, y: 38.9055 }, to: { label: "Union Station", x: -77.0063, y: 38.8973 } },
];

const BAR = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];

export function RidePanel({ ctx, routes }: { ctx: AppCtx; routes: Routes }) {
  const pois = ctx.extras?.pois ?? [];
  const riderWord = RIDERS[ctx.rider].label.toLowerCase();
  const ok = routes && "calm" in routes ? routes : null;
  const breaking = ok ? [...new Set(ok.calm.breaking)] : [];
  const breakNames = [...new Set(breaking.map((e) => edgeName(ctx.net, e)))];
  const extra = ok ? ok.calm.lengthM - ok.fastest.lengthM : 0;

  return (
    <div>
      <h1 className="text-[1.45rem] font-bold">
        {!ok ? "Plan a ride and see if it stays calm." : breaking.length === 0
          ? extra < 50 ? `Calm the whole way. The fastest route is already comfortable.` : `Calm the whole way, for ${km(extra)} of detour.`
          : `No fully calm route for a ${riderWord} rider. ${breaking.length} block${breaking.length > 1 ? "s" : ""} break${breaking.length > 1 ? "" : "s"} it.`}
      </h1>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1"><SearchBox placeholder="Start: address or place" pois={pois} value={ctx.from} onPick={ctx.setFrom} onClear={() => ctx.setFrom(null)} /></div>
          {!ctx.from && <PickBtn on={() => ctx.setPick("from")} />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1"><SearchBox placeholder="Destination" pois={pois} value={ctx.to} onPick={ctx.setTo} onClear={() => ctx.setTo(null)} /></div>
          {!ctx.to && <PickBtn on={() => ctx.setPick("to")} />}
        </div>
        {ctx.from && ctx.to && (
          <Btn size="sm" variant="quiet" onClick={() => { const f = ctx.from; ctx.setFrom(ctx.to); ctx.setTo(f); }}>
            <ArrowUpDown className="size-3.5" /> Swap
          </Btn>
        )}
      </div>

      {!ctx.from && !ctx.to && (
        <div className="mt-4">
          <p className="eyebrow mb-2">Try a trip</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <Btn key={ex.label} size="sm" variant="quiet" onClick={() => { ctx.setFrom(ex.from); ctx.setTo(ex.to); }}>{ex.label}</Btn>
            ))}
          </div>
          <p className="mt-3 text-[0.75rem] text-ink-2">Or click the map twice: first your start, then your destination.</p>
        </div>
      )}

      {routes && "error" in routes && (
        <Card className="mt-4">
          <p className="text-[0.85rem] font-semibold">
            {routes.error === "far" ? "One of those points is outside DC's street network. Pick a spot inside DC."
              : routes.error === "same" ? "Start and destination are the same spot. Move one of them."
              : "These two points are not connected by any street in our data. Try a nearby spot."}
          </p>
        </Card>
      )}

      {ok && (
        <>
          <Card className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-[1.6rem] font-bold">{km(ok.calm.lengthM)}</p>
              <p className="text-[0.75rem] text-ink-2">fastest route {km(ok.fastest.lengthM)} (dotted)</p>
            </div>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full" aria-label="Distance by stress level">
              {[1, 2, 3, 4].map((l) => ok.calm.byLts[l] > 0 && (
                <div key={l} className={BAR[l]} style={{ width: `${(ok.calm.byLts[l] / ok.calm.lengthM) * 100}%` }} title={`LTS ${l}: ${km(ok.calm.byLts[l])}`} />
              ))}
            </div>
            <p className="mt-2 text-[0.72rem] text-ink-2">
              {[1, 2, 3, 4].filter((l) => ok.calm.byLts[l] > 0).map((l) => `LTS ${l}: ${km(ok.calm.byLts[l])}`).join(" · ")}
            </p>
          </Card>

          {breaking.length > 0 && (
            <Card className="mt-3">
              <p className="text-[0.82rem] font-semibold">The route has to use these streets (glowing red on the map):</p>
              <p className="mt-1 text-[0.78rem]">{breakNames.slice(0, 6).join(", ")}{breakNames.length > 6 ? `, and ${breakNames.length - 6} more` : ""}.</p>
              <Btn size="sm" variant="outline" className="mt-3" onClick={() => { ctx.addFixes(breaking); ctx.toast(`Added ${breaking.length} protected block${breaking.length > 1 ? "s" : ""} to your plan.`); }}>
                <Hammer className="size-3.5" /> Fix {breaking.length > 1 ? `these ${breaking.length} blocks` : "this block"}
              </Btn>
            </Card>
          )}

          <Btn variant="primary" className="mt-4 w-full" onClick={ctx.startRide}><Bike className="size-4" /> Ride it</Btn>
          <p className="mt-3 text-[0.75rem] text-ink-2">
            Ridden it for real? <TextLink href="https://ridescoredc.com/survey/" external>Tell RideScore DC how it felt</TextLink>.
          </p>
        </>
      )}
    </div>
  );
}

function PickBtn({ on }: { on: () => void }) {
  return (
    <button onClick={on} aria-label="Pick on map" title="Pick on map" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
      <MapPin className="size-4" />
    </button>
  );
}
