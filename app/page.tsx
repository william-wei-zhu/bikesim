import Image from "next/image";
import { SiteFrame } from "@/components/SiteFrame";
import { CityPicker } from "@/components/CityPicker";
import { LIVE_CITIES } from "@/lib/cities";

export default function Home() {
  return (
    <SiteFrame wide="xl">
      <section className="grid items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-12">
        <div>
          <p className="eyebrow">Bike trip simulator · {LIVE_CITIES.length} US cities</p>
          <h1 className="mt-3 text-[2.4rem] font-bold leading-[1.05] tracking-tight text-balance md:text-[3.4rem]">Feel it before you ride it.</h1>
          <p className="mt-5 max-w-xl text-[1.12rem] leading-[1.7] text-ink-2">
            A normal map draws a line. BikeSim shows how stressful every block of your trip will be, finds the calmer way,
            and lets you ride it first, through real street photos or a 3D model of the city.
          </p>
          <ol className="mt-6 hidden max-w-xl grid-cols-3 gap-3 text-[0.85rem] sm:grid">
            {[["1", "Pick a trip", "Any start and end in the city"], ["2", "See the stress", "Every block, calm to hostile"], ["3", "Ride it", "Street View or 3D"]].map(([n, t, d]) => (
              <li key={n} className="rounded-card border border-line bg-surface p-3">
                <span className="grid size-7 place-items-center rounded-full bg-primary font-mono text-[0.78rem] font-bold text-primary-ink">{n}</span>
                <span className="mt-2 block font-display text-[1rem] font-bold leading-tight">{t}</span>
                <span className="mt-0.5 block leading-snug text-ink-2">{d}</span>
              </li>
            ))}
          </ol>
        </div>
        <figure className="relative">
          <Image src="/home/hero.jpg" alt="A BikeSim ride in Georgetown, DC: a 3D rider on a calm green street, the route turning orange and red ahead"
            width={1600} height={1114} priority className="aspect-[1600/1114] w-full rounded-card border border-line object-cover shadow-panel" />
          <figcaption className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-paper/95 px-3 py-1.5 text-[0.78rem] font-semibold shadow-panel">
            <span className="flex h-2 w-14 overflow-hidden rounded-full" aria-hidden>
              <span className="flex-1 bg-lts1" /><span className="flex-1 bg-lts2" /><span className="flex-1 bg-lts3" /><span className="flex-1 bg-lts4" />
            </span>
            Calm to hostile
          </figcaption>
        </figure>
      </section>
      <CityPicker />
    </SiteFrame>
  );
}
