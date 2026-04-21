import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "cesium",
    "@cesium/engine",
    "@cesium/widgets",
    "three",
    "3d-tiles-renderer",
    "@takram/three-atmosphere",
    "@takram/three-geospatial",
    "@takram/three-geospatial-effects",
    "@takram/three-clouds",
    "postprocessing",
  ],
  async rewrites() {
    return [
      {
        source: "/joby",
        destination: "/joby/index.html",
      },
    ];
  },
};

export default nextConfig;
