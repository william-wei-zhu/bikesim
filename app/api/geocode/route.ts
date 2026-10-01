// Address search, bounded to DC, via OpenStreetMap Nominatim.
// Server-side so we can send a proper User-Agent (Nominatim policy), cache, and rate-limit.
import type { NextRequest } from "next/server";

const DC_VIEWBOX = "-77.12,38.995,-76.909,38.79";
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
  if (q.length < 3) return Response.json({ results: [] });
  if (limited(clientIp(req))) return Response.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 86_400_000) return Response.json(hit.body);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: /washington|\bdc\b/i.test(q) ? q : `${q}, Washington, DC`,
    format: "jsonv2", limit: "6", viewbox: DC_VIEWBOX, bounded: "1", countrycodes: "us", addressdetails: "0",
  }).toString();
  try {
    const r = await fetch(url, { headers: { "User-Agent": "RideSimDC/1.0 (https://ridesimdc.com)", "Accept-Language": "en" } });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    const body = {
      results: data.map((d) => ({
        label: d.display_name.replace(/, (Washington|District of Columbia|United States).*$/, ""),
        x: Number(d.lon), y: Number(d.lat),
      })),
    };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch {
    return Response.json({ error: "Address search is unavailable right now. Pick a spot on the map instead." }, { status: 502 });
  }
}
