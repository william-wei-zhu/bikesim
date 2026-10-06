import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCity, LIVE_CITIES } from "@/lib/cities";

export const alt = "BikeSim: every street in the city colored by bike stress";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export function generateStaticParams() {
  return LIVE_CITIES.map((c) => ({ city: c.slug }));
}

const dataUrl = async (path: string, type: string) => {
  try { return `data:${type};base64,${(await readFile(join(process.cwd(), "public", path))).toString("base64")}`; } catch { return null; }
};

/** Share card per city: the city's stress map on the right, name and tagline on the left. */
export default async function Image({ params }: { params: Promise<{ city: string }> }) {
  const city = getCity((await params).city)!;
  const [map, logo] = await Promise.all([dataUrl(`cities/${city.slug}.jpg`, "image/jpeg"), dataUrl("brand/bikesim-mark-512.png", "image/png")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", color: "#082b54" }}>
        <div style={{ width: 560, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {logo && <img src={logo} width={84} height={84} style={{ borderRadius: 20 }} alt="" />}
            <span style={{ fontSize: 44, fontWeight: 700 }}>BikeSim</span>
          </div>
          <div style={{ fontSize: 66, fontWeight: 700, marginTop: 34, lineHeight: 1.05 }}>{city.name}</div>
          <div style={{ fontSize: 30, marginTop: 18, color: "#1d3f68" }}>Feel it before you ride it.</div>
          <div style={{ display: "flex", marginTop: 30, height: 12, width: 260, borderRadius: 6, overflow: "hidden" }}>
            {["#1cae6d", "#9bd65a", "#f5a524", "#e5484d"].map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
          </div>
        </div>
        {map
          ? <img src={map} width={640} height={630} style={{ objectFit: "cover" }} alt="" />
          : <div style={{ width: 640, height: 630, background: "#eef3fb" }} />}
      </div>
    ),
    size,
  );
}
