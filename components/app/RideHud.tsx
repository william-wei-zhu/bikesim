"use client";
import { useState } from "react";
import { Maximize2, Minimize2, Pause, Play, X } from "lucide-react";
import { edgeName, LTS_INFO, type Net } from "@/lib/engine/net";
import type { RideFrame } from "@/lib/engine/ride";
import { Segmented, km } from "@/components/ui";
import type { View } from "./types";
import { cn } from "@/lib/utils";

const COLORS = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];

export function RideHud({ net, frame, playing, view, views, onView, onPlayPause, onSeek, onSpeed, onExit, noPhotos }: {
  net: Net; frame: RideFrame; playing: boolean; view: View; views: { value: View; label: string }[];
  onView: (v: View) => void; onPlayPause: () => void; onSeek: (f: number) => void; onSpeed: (s: number) => void; onExit: () => void;
  noPhotos: boolean;
}) {
  const [speed, setSpeed] = useState("1");
  const [collapsed, setCollapsed] = useState(true); // start compact so the view is nearly full screen
  const e = frame.edgeIdx;
  const lts = e >= 0 ? net.elts[e] : 1;
  return (
    <>
      {noPhotos && view === "street" && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-primary px-5 py-2 text-[0.8rem] font-semibold text-primary-ink shadow-panel">
          No street photos on this stretch
        </div>
      )}
      {collapsed && (
        // Minimal pill so the view is almost full screen; tap expand to bring the controls back.
        <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-2 pr-1.5 shadow-panel md:left-4 md:top-4">
          <button onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-ink cursor-pointer">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <span className={cn("size-3 shrink-0 rounded-full", COLORS[lts])} aria-hidden />
          <span className="truncate text-[0.85rem] font-semibold">{e >= 0 ? edgeName(net, e) : "Starting"}</span>
          <button onClick={() => setCollapsed(false)} aria-label="Show ride controls" title="Show ride controls"
            className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <Maximize2 className="size-4" />
          </button>
          <button onClick={onExit} aria-label="End ride" title="End ride"
            className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className={cn("absolute inset-x-3 top-3 z-20 rounded-card border border-line bg-paper p-4 shadow-panel md:inset-x-auto md:left-4 md:top-4 md:w-[400px]", collapsed && "hidden")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.3rem] font-bold">{e >= 0 ? edgeName(net, e) : "Starting"}</p>
            <p className="text-[0.85rem] font-semibold" aria-live="polite">{LTS_INFO[lts]?.name} · {LTS_INFO[lts]?.who}</p>
          </div>
          <button onClick={() => setCollapsed(true)} aria-label="Hide ride controls" title="Hide ride controls (full screen view)"
            className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <Minimize2 className="size-4" />
          </button>
          <button onClick={onExit} aria-label="End ride" title="End ride" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-1" aria-label={`Stress meter: level ${lts} of 4`}>
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className={cn("h-3 flex-1 rounded-full transition-colors", k <= lts ? COLORS[lts] : "border border-line bg-surface")} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-ink cursor-pointer">
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <input type="range" min={0} max={1000} value={Math.round((frame.distM / frame.totalM) * 1000)}
            onChange={(ev) => onSeek(Number(ev.target.value) / 1000)} aria-label="Ride progress"
            className="h-2 flex-1 cursor-pointer accent-[var(--accent)]" />
          <span className="w-24 text-right font-mono text-[0.75rem]">{km(frame.distM)} / {km(frame.totalM)}</span>
        </div>
        <p className="mt-2 text-center text-[0.75rem] text-ink-2">Drag to look around the rider · double-click to reset</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Segmented<View> label="Ride view" value={view} onChange={onView} options={views} />
          <Segmented label="Speed" value={speed} onChange={(v) => { setSpeed(v); onSpeed(Number(v)); }}
            options={[{ value: "0.5", label: "0.5x" }, { value: "1", label: "1x" }, { value: "2", label: "2x" }, { value: "4", label: "4x" }]} />
        </div>
      </div>
    </>
  );
}
