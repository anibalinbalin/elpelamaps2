"use client";

import { useCallback, useState } from "react";
import {
  LIVING_WORLD_UNIFORMS,
  type LivingWorldParams,
} from "@/lib/living-world-defaults";

interface LivingWorldTunerProps {
  params: LivingWorldParams;
  onChange: (params: LivingWorldParams) => void;
}

export function LivingWorldTuner({ params, onChange }: LivingWorldTunerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleSliderChange = useCallback(
    (key: string, value: number) => {
      onChange({ ...params, [key]: value });
    },
    [params, onChange],
  );

  const handleCopy = useCallback(() => {
    const lines = LIVING_WORLD_UNIFORMS.map(
      (u) =>
        `${u.key}: ${(params[u.key as keyof LivingWorldParams] as number)?.toFixed(4)}`,
    );
    navigator.clipboard.writeText(lines.join("\n"));
  }, [params]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-4 bottom-24 z-50 rounded-[18px] border border-white/10 bg-[rgba(19,24,30,0.88)] px-4 py-2 text-xs text-white/78 shadow-[0_18px_48px_rgba(3,10,16,0.34)] backdrop-blur-xl hover:text-white"
      >
        Living World
      </button>
    );
  }

  // Group uniforms
  const groups = new Map<
    string,
    (typeof LIVING_WORLD_UNIFORMS)[number][]
  >();
  for (const u of LIVING_WORLD_UNIFORMS) {
    if (!groups.has(u.group)) groups.set(u.group, []);
    groups.get(u.group)!.push(u);
  }

  return (
    <div className="fixed right-4 bottom-24 z-50 flex max-h-[70vh] w-64 flex-col rounded-[22px] border border-white/10 bg-[rgba(16,20,25,0.92)] text-white/90 shadow-[0_32px_90px_rgba(3,10,16,0.42)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/44">
          Living World
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => onChange({ ...params, debugMask: !params.debugMask })}
            className={`rounded px-2 py-0.5 text-[10px] ${params.debugMask ? "bg-red-500/30 text-red-300" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
            title="Toggle debug mask"
          >
            Mask
          </button>
          <button
            onClick={() => onChange({ ...params, enabled: !params.enabled })}
            className={`rounded px-2 py-0.5 text-[10px] ${params.enabled ? "bg-blue-500/30 text-blue-300" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
            title="Toggle effect"
          >
            {params.enabled ? "ON" : "OFF"}
          </button>
          <button
            onClick={handleCopy}
            className="rounded px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
            title="Copy values"
          >
            Copy
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
          >
            —
          </button>
        </div>
      </div>
      <div className="overflow-y-auto px-3 py-2">
        {[...groups.entries()].map(([group, uniforms]) => (
          <div key={group} className="mb-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
              {group}
            </div>
            {uniforms.map((u) => (
              <label key={u.key} className="mb-1.5 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-white/60">{u.label}</span>
                  <span className="font-mono text-white/40">
                    {(
                      params[u.key as keyof LivingWorldParams] as number
                    )?.toFixed(u.step < 0.001 ? 4 : 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={u.min}
                  max={u.max}
                  step={u.step}
                  value={
                    params[u.key as keyof LivingWorldParams] as number
                  }
                  onChange={(e) =>
                    handleSliderChange(u.key, parseFloat(e.target.value))
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-blue-400"
                />
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
