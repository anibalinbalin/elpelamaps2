"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ViewerLoadingSkeleton } from "@/components/viewer-loading-skeleton";

const ViewerV2 = dynamic(
  () => import("@/components/viewer-v2").then((mod) => mod.ViewerV2),
  {
    ssr: false,
    loading: () => <ViewerLoadingSkeleton />,
  }
);

export default function ViewerV2Page() {
  return (
    <Suspense fallback={<ViewerLoadingSkeleton />}>
      <ViewerV2 />
    </Suspense>
  );
}
