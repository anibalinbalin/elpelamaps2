import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "three",
    "3d-tiles-renderer",
    "@takram/three-atmosphere",
    "@takram/three-clouds",
    "@takram/three-geospatial",
    "@takram/three-geospatial-effects",
    "postprocessing",
  ],
};

export default nextConfig;
