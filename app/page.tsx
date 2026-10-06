import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LIVE_CITIES } from "@/lib/cities";

// No landing page: bikesim.org opens straight into the map of the city nearest the visitor
// (Vercel's IP location headers; DC when unknown). The city button in the header switches cities.
export default async function Home() {
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude")), lon = Number(h.get("x-vercel-ip-longitude"));
  let city = LIVE_CITIES[0];
  if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) {
    const k = Math.cos((lat * Math.PI) / 180);
    const d = (c: (typeof LIVE_CITIES)[number]) => ((c.center[0] - lon) * k) ** 2 + (c.center[1] - lat) ** 2;
    city = LIVE_CITIES.reduce((a, b) => (d(b) < d(a) ? b : a));
  }
  redirect(`/${city.slug}`);
}
