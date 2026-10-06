"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LocateFixed } from "lucide-react";
import { LIVE_CITIES, type City } from "@/lib/cities";
import { Btn } from "@/components/ui";
import stats from "@/lib/city-stats.json";

type Stat = { km: number; calm: number; hostile: number };
const STATS = stats as Record<string, Stat>;

/** Every live city as a card with its stress map; DC (official city data) is featured. "Use my location" opens the nearest. */
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
    <section className="mt-14" aria-labelledby="cities">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cities" className="text-[1.6rem] font-bold">Choose a city</h2>
          <p className="mt-1 text-[0.95rem] text-ink-2">Every street colored by how stressful it is to ride.</p>
        </div>
        <Btn size="sm" onClick={locate}><LocateFixed className="size-4" aria-hidden /> Use my location</Btn>
      </div>
      {msg && <p role="status" className="mt-2 text-[0.9rem] text-ink-2">{msg}</p>}
      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LIVE_CITIES.map((c, i) => <CityCard key={c.slug} c={c} featured={i === 0} />)}
      </ul>
    </section>
  );
}

function CityCard({ c, featured }: { c: City; featured: boolean }) {
  const s = STATS[c.slug];
  return (
    <li className={featured ? "sm:col-span-2 sm:row-span-2" : undefined}>
      <Link href={`/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-paper transition-shadow hover:border-ink hover:shadow-panel focus-visible:outline-2 focus-visible:outline-accent">
        <span className={`relative block overflow-hidden bg-surface ${featured ? "aspect-[16/10] sm:aspect-auto sm:flex-1" : "aspect-[16/10]"}`}>
          <Image src={`/cities/${c.slug}.jpg`} alt="" fill sizes={featured ? "(min-width: 1024px) 560px, 100vw" : "(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          {featured && (
            <span className="absolute left-3 top-3 rounded-full bg-paper/95 px-3 py-1 text-[0.76rem] font-bold shadow-panel">Official city data · crash history</span>
          )}
        </span>
        <span className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className={`block font-display font-bold leading-tight ${featured ? "text-[1.4rem]" : "text-[1.1rem]"}`}>
              {c.name} <span className="font-mono text-[0.76rem] font-normal text-ink-2">{c.state}</span>
            </span>
            <span className="mt-0.5 block text-[0.8rem] text-ink-2">
              {s ? `${Math.round(s.km).toLocaleString("en-US")} km of streets scored` : `Stress from ${c.stress.name}`}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
