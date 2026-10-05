"use client";
import Link from "next/link";
import Image from "next/image";
import { Settings, Info, MapPin } from "lucide-react";
import type { City } from "@/lib/cities";

/** Site header. On a city's map, the logo resets that map and a city chip leads to the city picker. */
export function Header({ city }: { city?: City }) {
  return (
    <header className="relative z-20 border-b border-line bg-paper">
      <div className="flex h-16 items-center gap-3 px-3 md:px-5">
        <Link href={city ? `/${city.slug}` : "/"} className="flex shrink-0 items-center gap-2.5" aria-label={city ? `BikeSim ${city.short} home` : "BikeSim home"}
          // Already on the map: Next keeps the page mounted, so tell it to reset to the start screen.
          onClick={() => window.dispatchEvent(new Event("rs-home"))}>
          <Image src="/brand/logo-mark-512.png" alt="" width={40} height={40} className="size-10 rounded-[10px]" priority />
          <span className="hidden font-display text-[1.25rem] font-bold tracking-tight sm:inline">BikeSim</span>
        </Link>
        {city && (
          <Link href="/" aria-label={`${city.name}. Change city`} title="Change city"
            className="inline-flex min-h-10 min-w-0 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[0.82rem] font-semibold hover:bg-line">
            <MapPin className="size-4 shrink-0" aria-hidden /> <span className="truncate">{city.short}</span>
          </Link>
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
    </header>
  );
}
