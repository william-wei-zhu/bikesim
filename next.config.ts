import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The street network is open data; other sites (RideScore DC's "Ride it" page) may load it directly.
  async headers() {
    return [{ source: "/data/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
  async redirects() {
    return [
      // Trip links from before cities (ridesimdc.com/?from=...&to=...) were all DC; the query string carries over.
      { source: "/", has: [{ type: "query", key: "from" }], destination: "/dc", permanent: true },
      { source: "/", has: [{ type: "query", key: "to" }], destination: "/dc", permanent: true },
      // ridesimdc.com stays the DC front door.
      { source: "/", has: [{ type: "host", value: "(www\\.)?ridesimdc\\.com" }], destination: "/dc", permanent: false },
    ];
  },
  async rewrites() {
    // DC's data moved to /data/dc/; the old paths keep working for pages that load them directly.
    return [{ source: "/data/:file(network|pois|blocks|meta).json", destination: "/data/dc/:file.json" }];
  },
};

export default nextConfig;
