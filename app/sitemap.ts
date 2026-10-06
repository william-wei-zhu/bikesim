import type { MetadataRoute } from "next";
import { LIVE_CITIES } from "@/lib/cities";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://bikesim.org";
  return [
    ...LIVE_CITIES.map((c) => ({ url: `${base}/${c.slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
