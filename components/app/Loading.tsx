"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Btn } from "@/components/ui";

const PHASES = ["Loading 28,121 DC street segments…", "Joining RideScore DC stress scores…", "Placing 689,545 residents…", "Raising the walls…"];

export function Loading({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (error) return;
    const id = setInterval(() => setI((x) => Math.min(x + 1, PHASES.length - 1)), 900);
    return () => clearInterval(id);
  }, [error]);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-paper/90 p-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-paper p-6 text-center shadow-panel">
        <Image src="/brand/logo-mark-512.png" alt="" width={88} height={88} className="mx-auto size-22 rounded-2xl" priority />
        {error ? (
          <>
            <h2 className="mt-4 text-[1.2rem] font-bold">The map data did not load.</h2>
            <p className="mt-2 text-[0.85rem] text-ink-2">Check your connection and try again. ({error})</p>
            <Btn variant="primary" className="mt-4" onClick={onRetry}>Try again</Btn>
          </>
        ) : (
          <>
            <p className="mt-4 font-display text-[1.1rem] font-semibold" aria-live="polite">{PHASES[i]}</p>
            <div className="mx-auto mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${((i + 1) / PHASES.length) * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
