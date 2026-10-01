"use client";
import { Pause, Play, X } from "lucide-react";
import { edgeName, LTS_INFO, RIDERS, type Net, type Rider } from "@/lib/engine/net";
import type { RideFrame } from "@/lib/engine/ride";
import { Segmented, km } from "@/components/ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["", "bg-lts1", "bg-lts2", "bg-lts3", "bg-lts4"];

export function RideHud({ net, frame, playing, rider, fixed, onPlayPause, onSeek, onSpeed, onExit, isRideable }: {
  net: Net; frame: RideFrame; playing: boolean; rider: Rider; fixed: Set<number>;
  onPlayPause: () => void; onSeek: (f: number) => void; onSpeed: (s: number) => void; onExit: () => void; isRideable: (e: number) => boolean;
}) {
  const [speed, setSpeed] = useState("1");
  const e = frame.edgeIdx;
  const lts = e >= 0 ? (fixed.has(e) ? 1 : net.elts[e]) : 1;
  const ok = e < 0 || isRideable(e);
  return (
    <div className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-xl rounded-card border border-line bg-paper p-4 shadow-panel md:bottom-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Riding as {RIDERS[rider].label}</p>
          <p className="truncate font-display text-[1.25rem] font-bold">{e >= 0 ? edgeName(net, e) : "Starting"}</p>
          <p className="text-[0.8rem] font-semibold" aria-live="polite">
            {fixed.has(e) ? "Your new protected lane" : LTS_INFO[lts]?.name}
            {!ok && ` · too stressful for a ${RIDERS[rider].label.toLowerCase()} rider`}
          </p>
        </div>
        <button onClick={onExit} aria-label="Exit ride" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-surface cursor-pointer">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-1" aria-label={`Stress meter: level ${lts} of 4`}>
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className={cn("h-3 flex-1 rounded-full transition-colors", k <= lts ? COLORS[lts] : "bg-surface border border-line")} />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-ink cursor-pointer">
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <input type="range" min={0} max={1000} value={Math.round((frame.distM / frame.totalM) * 1000)}
          onChange={(ev) => onSeek(Number(ev.target.value) / 1000)} aria-label="Ride progress"
          className="h-2 flex-1 cursor-pointer accent-[var(--accent)]" />
        <span className="w-24 text-right font-mono text-[0.72rem]">{km(frame.distM)} / {km(frame.totalM)}</span>
      </div>
      <div className="mt-3 flex justify-center">
        <Segmented label="Speed" value={speed} onChange={(v) => { setSpeed(v); onSpeed(Number(v)); }}
          options={[{ value: "0.5", label: "Slow" }, { value: "1", label: "1x" }, { value: "2", label: "2x" }, { value: "4", label: "4x" }]} />
      </div>
    </div>
  );
}
