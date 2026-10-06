// Address search, bounded to one city, via OpenStreetMap Nominatim.
// Server-side so we can send a proper User-Agent (Nominatim policy), cache, and rate-limit.
import type { NextRequest } from "next/server";
import { getCity } from "@/lib/cities";
const cache = new Map<string, { at: number; body: unknown }>();
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest) {
  // Trusted platform header first; never the client-controlled leftmost X-Forwarded-For hop.
  const real = req.headers.get("x-real-ip") || req.headers.get("x-vercel-forwarded-for");
  if (real) return real.split(",")[0].trim();
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",").pop()!.trim() : "local";
}

function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30; // 30 lookups per minute per IP
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 120);
  // Old clients (before cities) send no city: they were DC.
  const city = getCity(req.nextUrl.searchParams.get("city") || "dc");
  if (!city) return Response.json({ error: "Unknown city." }, { status: 400 });
  if (q.length < 3) return Response.json({ results: [] });
  if (limited(clientIp(req))) return Response.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });

  const key = `${city.slug}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 86_400_000) return Response.json(hit.body);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: namesCity(q, city.searchWords) ? q : `${q}${city.searchHint}`,
    format: "jsonv2", limit: "6", viewbox: city.box.join(","), bounded: "1", countrycodes: "us", addressdetails: "0",
  }).toString();
  try {
    const r = await fetch(url, { headers: { "User-Agent": "BikeSim/1.0 (https://bikesim.org)", "Accept-Language": "en" } });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    const body = {
      results: data.map((d) => ({
        label: shortLabel(d.display_name, city.searchHint.split(",")[1].trim()),
        x: Number(d.lon), y: Number(d.lat),
      })),
    };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch {
    return Response.json({ error: "Address search is unavailable right now. Pick a spot on the map instead." }, { status: 502 });
  }
}

/** True when the search already names the city ("Pike Place, Seattle"), so no hint is appended. */
function namesCity(q: string, words: string[]) {
  const t = ` ${q.toLowerCase().replace(/[^a-z ]/g, " ")} `;
  return words.some((w) => t.includes(` ${w} `));
}

const STATES = new Set(["District of Columbia", "Washington", "Oregon", "California", "Illinois", "Massachusetts", "New York",
  "Pennsylvania", "Minnesota", "Colorado", "Texas", "United States"]);

/** Keep the useful head of Nominatim's name: drop the city, counties, state, ZIP code and country; at most three parts.
 *  "Prospect Park, Brooklyn, Kings County, New York, 11225, United States" -> "Prospect Park, Brooklyn". */
function shortLabel(name: string, cityName: string) {
  const [head, ...rest] = name.split(", ");
  const keep = rest.filter((x) => x !== cityName && !STATES.has(x) && !/ County$/.test(x) && !/^\d{5}(-\d{4})?$/.test(x));
  return [head, ...keep].slice(0, 3).join(", ");
}
