import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/settings"] }], sitemap: "https://bikesim.org/sitemap.xml" };
}
