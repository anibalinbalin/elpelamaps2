"use client";

import dynamic from "next/dynamic";
import { ViewerLoadingSkeleton } from "@/components/viewer-loading-skeleton";

const EditorV2 = dynamic(
  () => import("@/components/editor-v2").then((mod) => mod.EditorV2),
  {
    ssr: false,
    loading: () => <ViewerLoadingSkeleton />,
  },
);

export default function EditorV2Page() {
  return <EditorV2 />;
}
