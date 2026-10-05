"use client";
import dynamic from "next/dynamic";
import { getCity } from "@/lib/cities";

// The map needs WebGL and window; render it only in the browser.
const MapApp = dynamic(() => import("./MapApp"), { ssr: false });

/** Takes the slug (not the City object) so the server page passes plain props. */
export function MapAppLoader({ slug }: { slug: string }) {
  const city = getCity(slug);
  return city ? <MapApp city={city} /> : null;
}
