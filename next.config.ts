import type { NextConfig } from "next";

const OLD_HOST = [{ type: "host" as const, value: "(www\\.)?ridesimdc\\.com" }];

const nextConfig: NextConfig = {
  // The street network is open data; other sites (RideScore DC's "Ride it" page) may load it directly.
  async headers() {
    return [{ source: "/data/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
  async redirects() {
    return [
      // ridesimdc.com is now bikesim.org. Its home (with or without a trip in the query) was DC; every other
      // page keeps its path. /data stays put so RideScore DC's "Ride it" page keeps loading DC's network.
      { source: "/", has: OLD_HOST, destination: "https://bikesim.org/dc", permanent: true },
      { source: "/:path((?!data/|__/).*)", has: OLD_HOST, destination: "https://bikesim.org/:path", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "www\\.bikesim\\.org" }], destination: "https://bikesim.org/:path*", permanent: true },
      // Trip links from before cities (/?from=...&to=...) were all DC; the query string carries over.
      { source: "/", has: [{ type: "query", key: "from" }], destination: "/dc", permanent: true },
      { source: "/", has: [{ type: "query", key: "to" }], destination: "/dc", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // DC's data moved to /data/dc/; the old paths keep working for pages that load them directly.
      { source: "/data/:file(network|pois|blocks|meta).json", destination: "/data/dc/:file.json" },
      // Firebase's sign-in handler, served from our own domain so Google's sign-in window shows bikesim.org.
      { source: "/__/auth/:path*", destination: "https://ridesimdc.firebaseapp.com/__/auth/:path*" },
      { source: "/__/firebase/:path*", destination: "https://ridesimdc.firebaseapp.com/__/firebase/:path*" },
    ];
  },
};

export default nextConfig;
