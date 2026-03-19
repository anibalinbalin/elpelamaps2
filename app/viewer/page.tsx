"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MapViewer = dynamic<{ drawMode?: boolean }>(
  () => import("@/components/map-viewer").then((mod) => mod.MapViewer),
  { ssr: false }
);

function ViewerContent() {
  const searchParams = useSearchParams();
  const drawMode = searchParams.get("draw") === "true";
  return <MapViewer drawMode={drawMode} />;
}

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerContent />
    </Suspense>
  );
}
