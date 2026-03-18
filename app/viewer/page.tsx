"use client";

import dynamic from "next/dynamic";

const MapViewer = dynamic(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white/50 text-sm">
        Loading 3D viewer...
      </div>
    ),
  }
);

export default function ViewerPage() {
  return <MapViewer />;
}
