"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const NightEditorViewer = dynamic(
  () =>
    import("@/components/night-editor-viewer").then(
      (mod) => mod.NightEditorViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white/50">
        Loading Night Editor...
      </div>
    ),
  },
);

export default function NightEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-black text-white/50">
          Loading Night Editor...
        </div>
      }
    >
      <NightEditorViewer />
    </Suspense>
  );
}
