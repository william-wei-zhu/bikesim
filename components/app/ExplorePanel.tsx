"use client";
import { useMemo } from "react";
import { ArrowLeft, Hammer } from "lucide-react";
import { edgeName, LTS_INFO, RIDERS, SRC_LABEL, type Block } from "@/lib/engine/net";
import { Btn, LtsChip, Card, fmt, pct, km } from "@/components/ui";
import type { AppCtx } from "./types";
import { cn } from "@/lib/utils";

export function ExplorePanel({ ctx }: { ctx: AppCtx }) {
  const { net, threshold } = ctx;
  const lenBy = useMemo(() => {
    const L = [0, 0, 0, 0, 0];
    for (let e = 0; e < net.nEdges; e++) L[net.elts[e]] += net.elen[e];
    return L;
  }, [net]);
  const total = lenBy.reduce((a, b) => a + b, 0);
  const tooStressful = lenBy.slice(threshold + 1).reduce((a, b) => a + b, 0) / total;

  if (ctx.selEdge !== null && ctx.selEdge >= 0 && ctx.selEdge < net.nEdges) return <WhyCard ctx={ctx} e={ctx.selEdge} />;

  return (
    <div>
      <h1 className="text-[1.45rem] font-bold">
        {pct(tooStressful)} of DC&apos;s bikeable streets are too stressful for a {RIDERS[ctx.rider].label.toLowerCase()} rider.
      </h1>
      <p className="mt-2 text-[0.85rem] text-ink-2">
        Each street is raised as a wall by its Level of Traffic Stress. Calm streets lie flat; hostile ones tower. Click any street or wall to see why it scored that way.
      </p>
      <ul className="mt-4 space-y-2">
        {[1, 2, 3, 4].map((l) => (
          <li key={l} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", l > threshold ? "border-line" : "border-line bg-surface")}>
            <span className="relative flex h-8 w-6 items-end justify-center" aria-hidden>
              <span className={cn("w-3 rounded-t-sm", ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"][l])} style={{ height: [0, 3, 8, 18, 30][l] }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.82rem] font-semibold leading-tight">{LTS_INFO[l]!.name}</p>
              <p className="text-[0.72rem] leading-snug text-ink-2">{LTS_INFO[l]!.who}</p>
            </div>
            <span className="font-mono text-[0.72rem]">{km(lenBy[l])}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Btn size="sm" variant={ctx.showCrashes ? "primary" : "outline"} aria-pressed={ctx.showCrashes} onClick={() => ctx.setShowCrashes(!ctx.showCrashes)}>
          {ctx.showCrashes ? "Hide" : "Show"} bike crashes{ctx.extras ? ` (${fmt(ctx.extras.crashes.length)})` : ""}
        </Btn>
        <Btn size="sm" variant="outline" onClick={() => ctx.setFlat(!ctx.flat)}>{ctx.flat ? "3D walls" : "Flat 2D map"}</Btn>
      </div>
      {ctx.showCrashes && (
        <p className="mt-2 text-[0.72rem] text-ink-2">Crashes that injured or killed a cyclist, last five years (DC Open Data). Dark red: fatal. Red: serious injury.</p>
      )}
    </div>
  );
}

function reasons(b: Block, lts: number) {
  const r: string[] = [];
  if (b.speed_limit) r.push(`${b.speed_limit} mph speed limit${b.speed_filled ? " (estimated, DDOT has none)" : ""}`);
  if (b.num_lanes) r.push(`${b.num_lanes} travel lane${b.num_lanes > 1 ? "s" : ""}`);
  r.push(b.bike_facility_type.toLowerCase());
  if (b.function && lts >= 3) r.push(`classified ${b.function.toLowerCase()}`);
  return r;
}

function WhyCard({ ctx, e }: { ctx: AppCtx; e: number }) {
  const { net } = ctx;
  const lts = net.elts[e];
  const src = net.src[net.esrc[e]];
  const b = net.eblock[e] >= 0 && ctx.extras ? ctx.extras.blocks[net.eblock[e]] : null;
  const tooMuch = lts > ctx.threshold && !ctx.fixed.has(e);
  return (
    <div>
      <button onClick={() => ctx.setSelEdge(null)} className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[0.75rem] font-semibold hover:border-ink cursor-pointer">
        <ArrowLeft className="size-3.5" /> All streets
      </button>
      <h2 className="text-[1.4rem] font-bold">{edgeName(net, e)}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <LtsChip lts={ctx.fixed.has(e) ? 1 : lts} label={ctx.fixed.has(e) ? "Fixed in your plan" : LTS_INFO[lts]!.name} />
        <span className="text-[0.75rem] text-ink-2">{km(net.elen[e])} segment · Ward {net.ward[net.eu[e]] || "n/a"}</span>
      </div>
      <p className="mt-3 text-[0.9rem] font-semibold">
        {tooMuch ? `Too stressful for a ${RIDERS[ctx.rider].label.toLowerCase()} rider.` : `Comfortable for a ${RIDERS[ctx.rider].label.toLowerCase()} rider.`}
      </p>
      {b && src === "ridescore_v1" ? (
        <Card className="mt-3">
          <p className="eyebrow mb-2">Why it scored LTS {lts}</p>
          <ul className="list-disc space-y-1 pl-5 text-[0.82rem]">
            {reasons(b, lts).map((x) => <li key={x}>{x[0].toUpperCase() + x.slice(1)}</li>)}
          </ul>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><dt className="eyebrow">Crashes</dt><dd className="font-display text-[1.2rem] font-bold">{b.crash_count_5yr}</dd></div>
            <div><dt className="eyebrow">Serious</dt><dd className="font-display text-[1.2rem] font-bold">{b.serious_injury_count_5yr}</dd></div>
            <div><dt className="eyebrow">Fatal</dt><dd className="font-display text-[1.2rem] font-bold">{b.fatal_count_5yr}</dd></div>
          </dl>
          <p className="mt-2 text-[0.7rem] text-ink-2">Cyclist crashes on this DDOT block, last five years. RideScore v1: {Math.round(b.ridescore_v1)} / 100.</p>
        </Card>
      ) : (
        <Card className="mt-3"><p className="text-[0.82rem]">{SRC_LABEL[src] ?? src}</p></Card>
      )}
      {b && src !== "ridescore_v1" && (
        <p className="mt-2 text-[0.72rem] text-ink-2">The street beside it scores LTS {b.lts_level} in RideScore DC ({b.route_name}).</p>
      )}
      <p className="mt-3 text-[0.72rem] text-ink-2">Source: {SRC_LABEL[src]}.</p>
      {tooMuch && (
        <Btn variant="primary" className="mt-4 w-full" onClick={() => { ctx.setMode("build"); ctx.toggleFix(e); }}>
          <Hammer className="size-4" /> Add a protected lane here
        </Btn>
      )}
    </div>
  );
}
