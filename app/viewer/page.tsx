"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ViewerLoadingSkeleton } from "@/components/viewer-loading-skeleton";

const MapViewer = dynamic<{ drawMode?: boolean }>(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  {
    ssr: false,
    loading: () => <ViewerLoadingSkeleton />,
  }
);

function ViewerContent() {
  const searchParams = useSearchParams();
  const drawMode = searchParams.get("draw") === "true";
  return <MapViewer drawMode={drawMode} />;
}

export default function ViewerPage() {
  return (
    <Suspense fallback={<ViewerLoadingSkeleton />}>
      <ViewerContent />
    </Suspense>
  );
}
