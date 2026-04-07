"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ViewerLoadingSkeleton } from "@/components/viewer-loading-skeleton";

const MapViewer = dynamic(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  {
    ssr: false,
    loading: () => <ViewerLoadingSkeleton />,
  }
);

export default function ViewerPage() {
  return (
    <Suspense fallback={<ViewerLoadingSkeleton />}>
      <MapViewer />
    </Suspense>
  );
}
