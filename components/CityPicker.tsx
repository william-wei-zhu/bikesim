"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LocateFixed } from "lucide-react";
import { CITIES, LIVE_CITIES } from "@/lib/cities";
import { Btn } from "@/components/ui";

/** Live cities link to their map; the rest show as coming soon. "Use my location" opens the nearest live city. */
export function CityPicker() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) { setMsg("Your browser can't share a location. Pick a city below."); return; }
    setMsg("Finding you…");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { longitude: x, latitude: y } = pos.coords;
      const inside = LIVE_CITIES.find((c) => x >= c.box[0] - 0.3 && x <= c.box[2] + 0.3 && y >= c.box[1] - 0.3 && y <= c.box[3] + 0.3);
      if (inside) { router.push(`/${inside.slug}`); return; }
      setMsg("BikeSim doesn't cover your area yet. Pick a city below.");
    }, () => setMsg("Location is off. Pick a city below."), { timeout: 10_000, maximumAge: 600_000 });
  };

  return (
    <section className="mt-8" aria-labelledby="cities">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cities" className="text-[1.35rem] font-bold">Choose a city</h2>
        <Btn size="sm" onClick={locate}><LocateFixed className="size-4" aria-hidden /> Use my location</Btn>
      </div>
      {msg && <p role="status" className="mt-2 text-[0.85rem] text-ink-2">{msg}</p>}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c) => (
          <li key={c.slug}>
            {c.live ? (
              <Link href={`/${c.slug}`} className="group flex min-h-20 items-center gap-3 rounded-card border-2 border-ink bg-paper px-5 py-4 hover:bg-surface">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.15rem] font-bold">{c.name}</span>
                  <span className="block text-[0.8rem] text-accent-ink font-semibold">Ride now · stress from {c.stress.name}</span>
                </span>
                <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            ) : (
              <div className="flex min-h-20 items-center gap-3 rounded-card border border-line bg-surface px-5 py-4" aria-disabled="true">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.15rem] font-bold text-ink-2">{c.name}</span>
                  <span className="block text-[0.8rem] text-ink-2">Coming soon</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
