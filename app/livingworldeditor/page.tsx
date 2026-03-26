"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LivingWorldEditorViewer = dynamic(
  () =>
    import("@/components/living-world-editor-viewer").then(
      (mod) => mod.LivingWorldEditorViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white/50">
        Loading Living World Editor...
      </div>
    ),
  },
);

export default function LivingWorldEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-black text-white/50">
          Loading Living World Editor...
        </div>
      }
    >
      <LivingWorldEditorViewer />
    </Suspense>
  );
}
