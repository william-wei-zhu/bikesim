"use client";
import { useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { edgeName, LTS_INFO, type Net } from "@/lib/engine/net";
import type { RideFrame } from "@/lib/engine/ride";
import { Segmented, km } from "@/components/ui";
import type { View } from "./types";
import { cn } from "@/lib/utils";

const COLORS = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];
const EDGE_TINT = ["", "rgb(28 174 109 / 0.35)", "rgb(155 214 90 / 0.3)", "rgb(245 165 36 / 0.4)", "rgb(229 72 77 / 0.55)"];

export function RideHud({ net, frame, playing, view, views, onView, onPlayPause, onSeek, onSpeed, onExit, noPhotos }: {
  net: Net; frame: RideFrame; playing: boolean; view: View; views: { value: View; label: string }[];
  onView: (v: View) => void; onPlayPause: () => void; onSeek: (f: number) => void; onSpeed: (s: number) => void; onExit: () => void;
  noPhotos: boolean;
}) {
  const [speed, setSpeed] = useState("1");
  const e = frame.edgeIdx;
  const lts = e >= 0 ? net.elts[e] : 1;
  return (
    <>
      {/* Screen edges take on the stress of the street you're on. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 transition-[box-shadow] duration-700"
        style={{ boxShadow: `inset 0 0 120px 30px ${EDGE_TINT[lts]}` }} />
      {noPhotos && view === "street" && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-primary px-5 py-2 text-[0.8rem] font-semibold text-primary-ink shadow-panel">
          No street photos on this stretch
        </div>
      )}
      <div className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-xl rounded-card border border-line bg-paper p-4 shadow-panel md:bottom-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.3rem] font-bold">{e >= 0 ? edgeName(net, e) : "Starting"}</p>
            <p className="text-[0.85rem] font-semibold" aria-live="polite">{LTS_INFO[lts]?.name} · {LTS_INFO[lts]?.who}</p>
          </div>
          <button onClick={onExit} aria-label="End ride" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
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
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Segmented<View> label="Ride view" value={view} onChange={onView} options={views} />
          <Segmented label="Speed" value={speed} onChange={(v) => { setSpeed(v); onSpeed(Number(v)); }}
            options={[{ value: "0.5", label: "Slow" }, { value: "1", label: "1x" }, { value: "2", label: "2x" }, { value: "4", label: "4x" }]} />
        </div>
      </div>
    </>
  );
}
