import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFrame, Section } from "@/components/SiteFrame";

export const metadata: Metadata = {
  title: "About",
  description: "How BikeSim works: stress scores for every street, a lowest-stress route, and a virtual ride in Street View or 3D.",
};

const LEVELS = [
  { n: 1, name: "Calm", cls: "bg-lts1", who: "Trails, protected bike lanes and the quietest streets. Comfortable for almost everyone, including kids." },
  { n: 2, name: "Low stress", cls: "bg-lts2", who: "Quiet streets and bike lanes on slower roads. Comfortable for most adults." },
  { n: 3, name: "Stressful", cls: "bg-lts3", who: "More traffic or faster speeds. Only for confident riders." },
  { n: 4, name: "Hostile", cls: "bg-lts4", who: "Fast, wide, busy roads with no real separation. Only the most experienced riders." },
];

const ext = "underline underline-offset-2 decoration-2 decoration-accent";

export default function AboutPage() {
  return (
    <SiteFrame>
      <Image src="/brand/bikesim-mark-512.png" alt="BikeSim logo" width={160} height={160} className="size-32 rounded-[28px] md:size-40" priority />
      <h1 className="mt-6 text-[2rem] font-bold md:text-[2.6rem]">Feel it before you ride it.</h1>
      <p className="mt-4 text-[1.1rem] leading-[1.7]">
        BikeSim lets you ride a city bike trip before you get on a bike. Pick a city, a start and a destination,
        see how stressful every block will be, then ride it virtually through real street photos or a 3D model of the city.
        It started as RideSim DC, for Washington, DC, and now covers 13 US cities.
      </p>

      <Section title="Most people never find out which streets would feel fine">
        <p>
          Many people would bike more if they knew a trip would feel safe. A normal map shows a line from A to B. It does
          not tell you that the third block is a six-lane road with no bike lane, or that a calm trail runs one street over.
          So people guess, have one bad ride, and stop. BikeSim shows you the ride first, block by block.
        </p>
      </Section>

      <Section title="Every street has a stress level from 1 to 4">
        <p>
          BikeSim uses Level of Traffic Stress (LTS), a widely used method that rates how stressful a street feels on a bike
          based on speed limits, number of lanes, and the kind of bike lane, if any. In DC the scores come from{" "}
          <a className={ext} href="https://ridescoredc.com" target="_blank" rel="noreferrer">RideScore DC</a>, an open project by Civic Tech DC.
        </p>
        <ul className="mt-2 space-y-2">
          {LEVELS.map((l) => (
            <li key={l.n} className="flex gap-3 rounded-card border border-line bg-surface p-3">
              <span className={`mt-1.5 size-4 shrink-0 rounded-full ${l.cls}`} aria-hidden />
              <span><span className="font-semibold">LTS {l.n}, {l.name}.</span> {l.who}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="stress" title="How stress is scored outside DC">
        <p>
          For every other city, BikeSim scores each block itself from OpenStreetMap, using the Level of Traffic Stress criteria of
          Furth, Mekuria and Nixon (2017), the version most US cities use. It reads four things about each block: the kind of bike
          facility, the speed limit, the number of lanes, and the type of road. OpenStreetMap has no traffic counts, so the type of road
          stands in for traffic: a residential street is treated as quiet, an arterial as busy.
        </p>
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[34rem] text-left text-[0.9rem]">
            <thead className="bg-surface text-[0.8rem] text-ink-2">
              <tr><th className="px-3 py-2 font-semibold">Street</th><th className="px-3 py-2 font-semibold">Calm (1)</th><th className="px-3 py-2 font-semibold">Low (2)</th><th className="px-3 py-2 font-semibold">Stressful (3)</th><th className="px-3 py-2 font-semibold">Hostile (4)</th></tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              <tr><td className="px-3 py-2">Trail, protected bike lane</td><td className="px-3 py-2">always</td><td /><td /><td /></tr>
              <tr><td className="px-3 py-2">Residential street</td><td className="px-3 py-2">25 mph or less</td><td className="px-3 py-2">30 to 35 mph</td><td className="px-3 py-2">40 mph+</td><td /></tr>
              <tr><td className="px-3 py-2">Painted bike lane, 1 lane each way</td><td className="px-3 py-2">25 mph or less</td><td className="px-3 py-2">30 to 35 mph</td><td className="px-3 py-2">40 to 45 mph</td><td className="px-3 py-2">50 mph+</td></tr>
              <tr><td className="px-3 py-2">Collector, no bike lane</td><td /><td className="px-3 py-2">20 mph</td><td className="px-3 py-2">25 to 30 mph</td><td className="px-3 py-2">35 mph+</td></tr>
              <tr><td className="px-3 py-2">Arterial, no bike lane</td><td /><td /><td className="px-3 py-2">25 mph, 1 lane each way</td><td className="px-3 py-2">faster, or wider</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[0.9rem] text-ink-2">
          A buffer beside a painted lane earns one level back up to 35 mph. Where OpenStreetMap has no speed limit, BikeSim uses the
          city&apos;s legal default (20 mph on Seattle, Portland, Minneapolis and Denver side streets, 25 mph in most others, 30 in Chicago).
          In Chicago, Boston and Philadelphia the official stress maps take priority wherever they cover a street (Cook County&apos;s LTS 2023,
          Boston&apos;s BLTS 2024 and DVRPC&apos;s LTS network); BikeSim&apos;s model fills the gaps.
          On DC&apos;s own streets this model agrees with RideScore DC within one level on 85% of the length; it rates quiet 20 mph side
          streets one level calmer than RideScore does.
        </p>
      </Section>

      <Section title="Pick the shortest route, or the one that avoids hostile streets">
        <p>
          By default BikeSim shows the shortest route, so you can see exactly how stressful the direct ride would be.
          Switch to <span className="font-semibold">Lowest stress</span> and it finds the route that keeps you off hostile LTS 4 streets,
          even if that means riding farther. The other route stays on the map as a dotted line for comparison. Hostile stretches on your route are listed by name and length.
        </p>
      </Section>

      <Section title="Ride it in Street View or 3D">
        <p>
          <span className="font-semibold">Street View</span> follows your route through Google&apos;s real street photos, facing the way you ride.
          <span className="font-semibold"> 3D model</span> flies a rider through a white 3D model of the city, with buildings at their real height where OpenStreetMap records it.
          In both, the stress meter shows how stressful the street under you is as you ride.
        </p>
      </Section>

      <Section title="Where the data comes from">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>DC stress scores: RideScore DC scoring pipeline (DDOT roadway data on Open Data DC).</li>
          <li>DC street network and trails: OpenStreetMap, as prepared in the RideScore DC basemap snapshot (September 29, 2026).</li>
          <li>Other cities: street network and stress inputs (speed limits, lanes, bike lanes) from OpenStreetMap via Geofabrik extracts (October 5, 2026), scored by BikeSim as described above.</li>
          <li>Aerial photos: DC government 2025 orthophotos in DC; USGS The National Map elsewhere.</li>
          <li>3D buildings and basemap: OpenStreetMap contributors via OpenFreeMap. DC&apos;s building heights in OpenStreetMap come from DC government data.</li>
          <li>Street photos: Google Street View.</li>
          <li>Address search: OpenStreetMap Nominatim.</li>
        </ul>
      </Section>

      <Section title="What it cannot tell you">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Intersections are not scored. Crossing a busy road at a light counts the same as riding a quiet block.</li>
          <li>One-way streets are treated as two-way. Check the direction before you ride.</li>
          <li>Separately drawn bike paths and trails are treated as calm, even where they run beside a busy road.</li>
          <li>Outside DC, scores are only as good as OpenStreetMap: a missing speed limit or bike lane changes the score. You can fix the map at openstreetmap.org and BikeSim picks it up on the next rebuild.</li>
          <li>Some underlying traffic data dates from 2020, and street photos can be several years old.</li>
          <li>Construction, weather, lighting, potholes and driver behavior change from day to day and are not in the data.</li>
        </ul>
        <p>BikeSim is a planning aid, not safety advice. Always ride with care and check conditions yourself.</p>
      </Section>

      <Section title="Made in DC, now national, in the open">
        <p>
          BikeSim began as RideSim DC, built for the Civic Tech DC hackathon (October 3, 2026) on top of RideScore DC.
          The code is open on <a className={ext} href="https://github.com/william-wei-zhu/bikesim" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
        <p>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 font-semibold text-primary-ink hover:opacity-90">
            Plan a ride
          </Link>
        </p>
      </Section>
    </SiteFrame>
  );
}
