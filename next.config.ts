import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  },
  transpilePackages: [
    "cesium",
    "@cesium/engine",
    "@cesium/widgets",
    "three",
    "3d-tiles-renderer",
    "@takram/three-atmosphere",
    "@takram/three-geospatial",
    "@takram/three-geospatial-effects",
    "postprocessing",
  ],
};

export default nextConfig;
