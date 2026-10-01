"use client";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { RIDERS, type PoiType } from "@/lib/engine/net";
import { reach, stranded, wardShares } from "@/lib/engine/graph";
import { ISLAND_COLORS } from "@/lib/engine/geom";
import { SearchBox } from "@/components/SearchBox";
import { Btn, Card, Stat, fmt, pct } from "@/components/ui";
import type { AppCtx } from "./types";

const POI_NAMES: Record<PoiType, string> = { school: "Schools", library: "Libraries", metro: "Metro entrances", rec: "Rec centers" };

export function IslandsPanel({ ctx }: { ctx: AppCtx }) {
  const { net, is } = ctx;
  const share = is.largestPop / is.totalPop;
  const wards = useMemo(() => wardShares(net, is), [net, is]);
  const bigIslands = is.ranked.filter((r) => (is.compPop.get(r) || 0) > 300).length;
  const r = ctx.focusNode >= 0 && ctx.extras ? reach(net, is, ctx.focusNode, ctx.extras.pois) : null;
  const riderWord = RIDERS[ctx.rider].label.toLowerCase();

  return (
    <div>
      <h1 className="text-[1.45rem] font-bold">
        Only {pct(share)} of DC residents can reach each other on streets a {riderWord} rider finds calm.
      </h1>
      <p className="mt-2 text-[0.85rem] text-ink-2">
        {fmt(stranded(is))} residents live on {fmt(Math.max(0, bigIslands - 1))} smaller islands, cut off by stressful streets. Each color is one island.
      </p>

      <div className="mt-4">
        <p className="eyebrow mb-2">Where can I go?</p>
        <SearchBox placeholder="Your address or a DC place" pois={ctx.extras?.pois ?? []} value={ctx.focus}
          onPick={(p) => { ctx.setFocus(p); ctx.flyTo(p.x, p.y, 13.5); }} onClear={() => ctx.setFocus(null)} />
        {!ctx.focus && (
          <Btn size="sm" variant="quiet" className="mt-2" onClick={() => ctx.setPick("focus")}>
            <MapPin className="size-3.5" /> Or click a spot on the map
          </Btn>
        )}
        {ctx.focus && ctx.focusNode < 0 && (
          <p className="mt-2 text-[0.8rem] font-semibold">That spot is too far from any DC street in our data. Try a DC address.</p>
        )}
        {r && (
          <Card className="mt-3">
            <p className="text-[0.88rem] font-semibold">
              From here, a {riderWord} rider can reach {fmt(r.residents)} neighbors without riding a stressful street.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(Object.keys(POI_NAMES) as PoiType[]).map((t) => <Stat key={t} value={fmt(r.counts[t])} label={POI_NAMES[t]} />)}
            </div>
            {r.names.school.length > 0 && (
              <p className="mt-3 text-[0.72rem] leading-snug text-ink-2">
                Schools in reach: {r.names.school.slice(0, 6).join(", ")}{r.names.school.length > 6 ? `, and ${r.counts.school - 6} more` : ""}.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" variant="primary" onClick={() => ctx.setMode("build")}>Open it up in Build</Btn>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">Largest islands</p>
        <ul className="space-y-1.5">
          {is.ranked.slice(0, 5).map((root, i) => (
            <li key={root} className="flex items-center gap-3 text-[0.8rem]">
              <span className="size-3.5 shrink-0 rounded-full" style={{ background: ISLAND_COLORS[i] }} aria-hidden />
              <span className="flex-1">Island {i + 1}</span>
              <span className="font-mono text-[0.72rem]">{fmt(is.compPop.get(root) || 0)} residents</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">Residents on the main island, by ward</p>
        <ul className="space-y-1.5">
          {wards.map((w) => (
            <li key={w.ward} className="grid grid-cols-[4.2rem_1fr_2.8rem] items-center gap-2 text-[0.78rem]">
              <span className="font-semibold">Ward {w.ward}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-surface border border-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${w.share * 100}%` }} />
              </span>
              <span className="text-right font-mono text-[0.72rem]">{pct(w.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
