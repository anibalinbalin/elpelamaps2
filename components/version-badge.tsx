"use client";

import packageJson from "@/package.json";

export function VersionBadge() {
  return (
    <div className="fixed bottom-3 left-3 z-[9999] pointer-events-none">
      <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-mono text-white/60 tracking-wide">
        v{packageJson.version}
      </span>
    </div>
  );
}
