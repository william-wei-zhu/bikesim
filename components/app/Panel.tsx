"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RIDERS, type Rider } from "@/lib/engine/net";
import { Segmented } from "@/components/ui";
import type { AppCtx, Routes } from "./types";
import { ExplorePanel } from "./ExplorePanel";
import { IslandsPanel } from "./IslandsPanel";
import { BuildPanel } from "./BuildPanel";
import { RidePanel } from "./RidePanel";
import { cn } from "@/lib/utils";

export function Panel({ ctx, setRider, routes }: { ctx: AppCtx; setRider: (r: Rider) => void; routes: Routes }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      aria-label="RideSim panel"
      className={cn(
        "absolute z-10 flex flex-col overflow-hidden border border-line bg-paper shadow-panel",
        "inset-x-0 bottom-0 max-h-[52%] rounded-t-3xl",
        "md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:rounded-card",
      )}
    >
      <button onClick={() => setCollapsed((c) => !c)} className="flex items-center justify-center gap-2 py-1.5 text-[0.72rem] font-semibold md:hidden cursor-pointer"
        aria-expanded={!collapsed}>
        <span className="h-1.5 w-10 rounded-full bg-line" />
        {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        <span className="sr-only">{collapsed ? "Show panel" : "Hide panel"}</span>
      </button>
      <div className={cn("overflow-y-auto px-5 pb-5 md:pt-5", collapsed && "hidden md:block")}>
        <div className="mb-4">
          <p className="eyebrow mb-2">Riding as</p>
          <Segmented<Rider> label="Rider" value={ctx.rider} onChange={setRider}
            options={(Object.keys(RIDERS) as Rider[]).map((r) => ({ value: r, label: RIDERS[r].label, title: RIDERS[r].blurb }))} />
          <p className="mt-2 text-[0.78rem] leading-snug text-ink-2">{RIDERS[ctx.rider].blurb}</p>
        </div>
        <div className="border-t border-line pt-4">
          {ctx.mode === "explore" && <ExplorePanel ctx={ctx} />}
          {ctx.mode === "islands" && <IslandsPanel ctx={ctx} />}
          {ctx.mode === "build" && <BuildPanel ctx={ctx} />}
          {ctx.mode === "ride" && <RidePanel ctx={ctx} routes={routes} />}
        </div>
        <footer className="mt-6 border-t border-line pt-3 text-[0.7rem] leading-relaxed text-ink-2">
          Built by <a className="underline underline-offset-2" href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noreferrer">William Zhu</a>
          {" · "}Built on <a className="underline underline-offset-2" href="https://ridescoredc.com" target="_blank" rel="noreferrer">RideScore DC</a> by Civic Tech DC
          {" · "}<a className="underline underline-offset-2" href="/privacy">Privacy</a>
        </footer>
      </div>
    </aside>
  );
}
