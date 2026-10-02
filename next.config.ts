import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The street network is open data; other sites (RideScore DC's "Ride it" page) may load it directly.
  async headers() {
    return [{ source: "/data/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
