"use client";
import Link from "next/link";
import Image from "next/image";
import { Settings, Info } from "lucide-react";
import type { Mode } from "@/lib/engine/map";
import { cn } from "@/lib/utils";

export const MODE_LABEL: Record<Mode, { label: string; hint: string }> = {
  explore: { label: "Explore", hint: "Streets as walls, by stress" },
  islands: { label: "Islands", hint: "Who can reach whom on calm streets" },
  build: { label: "Build", hint: "Add protected lanes, merge islands" },
  ride: { label: "Ride", hint: "Plan and fly a calm route" },
};

export function Header({ mode, setMode }: { mode?: Mode; setMode?: (m: Mode) => void }) {
  return (
    <header className="relative z-20 border-b border-line bg-paper">
      <div className="flex h-16 items-center gap-3 px-3 md:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="RideSim DC home">
          <Image src="/brand/logo-mark-512.png" alt="" width={40} height={40} className="size-10 rounded-[10px]" priority />
          <span className="hidden font-display text-[1.25rem] font-bold tracking-tight sm:inline">RideSim DC</span>
        </Link>
        {mode && setMode && (
          <nav aria-label="Modes" className="mx-auto hidden md:block">
            <ModeTabs mode={mode} setMode={setMode} />
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/about" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-ink px-4 text-[0.78rem] font-semibold hover:bg-surface">
            <Info className="size-4" aria-hidden /> About
          </Link>
          <Link href="/settings" aria-label="Settings" className="grid size-10 place-items-center rounded-full border-2 border-ink hover:bg-surface">
            <Settings className="size-4" />
          </Link>
        </div>
      </div>
      {mode && setMode && (
        <nav aria-label="Modes" className="border-t border-line px-3 py-2 md:hidden">
          <ModeTabs mode={mode} setMode={setMode} full />
        </nav>
      )}
    </header>
  );
}

function ModeTabs({ mode, setMode, full }: { mode: Mode; setMode: (m: Mode) => void; full?: boolean }) {
  return (
    <div role="tablist" className={cn("flex rounded-full border border-line bg-surface p-1", full && "w-full")}>
      {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
        <button key={m} role="tab" aria-selected={mode === m} title={MODE_LABEL[m].hint} onClick={() => setMode(m)}
          className={cn("min-h-9 rounded-full px-4 text-[0.82rem] font-semibold transition-colors cursor-pointer", full && "flex-1 px-2",
            mode === m ? "bg-primary text-primary-ink shadow-sm" : "text-ink hover:bg-paper")}>
          {MODE_LABEL[m].label}
        </button>
      ))}
    </div>
  );
}
