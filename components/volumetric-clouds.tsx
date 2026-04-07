"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import type { CloudsEffect } from "@takram/three-clouds";
import { Clouds } from "@takram/three-clouds/r3f";
import { LensFlare } from "@takram/three-geospatial-effects/r3f";

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

const SLIDERS: SliderDef[] = [
  { key: "coverage", label: "Coverage", min: 0, max: 1, step: 0.01, initial: 0.25 },
  { key: "resolutionScale", label: "Resolution", min: 0.25, max: 1, step: 0.05, initial: 0.5 },
  { key: "shadowCascadeCount", label: "Shadow Cascades", min: 1, max: 4, step: 1, initial: 2 },
  { key: "shadowFarScale", label: "Shadow Far Scale", min: 0.05, max: 1, step: 0.05, initial: 0.25 },
  { key: "shadowMaxFar", label: "Shadow Max Far", min: 1e4, max: 5e5, step: 1e4, initial: 1e5 },
  { key: "scatterAnisotropy1", label: "Scatter Aniso 1", min: 0, max: 1, step: 0.01, initial: 0.7 },
  { key: "scatterAnisotropy2", label: "Scatter Aniso 2", min: -1, max: 0, step: 0.01, initial: -0.3 },
  { key: "scatterAnisotropyMix", label: "Scatter Mix", min: 0, max: 1, step: 0.01, initial: 0.5 },
  { key: "skyLightScale", label: "Sky Light", min: 0, max: 5, step: 0.1, initial: 1 },
  { key: "groundBounceScale", label: "Ground Bounce", min: 0, max: 3, step: 0.1, initial: 1 },
  { key: "powderScale", label: "Powder", min: 0, max: 2, step: 0.05, initial: 1 },
  { key: "powderExponent", label: "Powder Exp", min: 0, max: 5, step: 0.1, initial: 1 },
];

type SliderValues = Record<string, number>;

function buildInitialValues(): SliderValues {
  const values: SliderValues = {};
  for (const s of SLIDERS) {
    values[s.key] = s.initial;
  }
  return values;
}

/**
 * Debug slider panel for tuning volumetric cloud parameters.
 * Only rendered in development.
 */
function CloudTuningPanel({
  values,
  enabled,
  lensFlare,
  onToggle,
  onToggleLensFlare,
  onChange,
}: {
  values: SliderValues;
  enabled: boolean;
  lensFlare: boolean;
  onToggle: () => void;
  onToggleLensFlare: () => void;
  onChange: (key: string, value: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="fixed top-16 left-3 z-50 select-none font-mono text-[11px]">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="rounded bg-black/80 px-2.5 py-1 text-white/80 backdrop-blur hover:bg-black/90"
      >
        {collapsed ? "Clouds" : "Clouds [-]"}
      </button>
      {!collapsed && (
        <div className="mt-1 flex w-56 flex-col gap-1.5 rounded bg-black/85 p-2.5 text-white/80 backdrop-blur">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={onToggle}
              className="accent-sky-400"
            />
            Volumetric Clouds
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lensFlare}
              onChange={onToggleLensFlare}
              className="accent-sky-400"
            />
            Lens Flare
          </label>
          {enabled &&
            SLIDERS.map((s) => (
              <label key={s.key} className="flex flex-col gap-0.5">
                <span className="flex justify-between">
                  <span>{s.label}</span>
                  <span className="text-white/50">{values[s.key]}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={values[s.key]}
                  onChange={(e) => onChange(s.key, parseFloat(e.target.value))}
                  className="h-1.5 w-full accent-sky-400"
                />
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Volumetric cloud effects to be placed inside <EffectComposer>.
 * Returns the effect components (Clouds, LensFlare) and an optional
 * debug panel that renders as an HTML overlay.
 */
export function useVolumetricClouds() {
  const [values, setValues] = useState(buildInitialValues);
  const [enabled, setEnabled] = useState(true);
  const [lensFlare, setLensFlare] = useState(true);
  const cloudsRef = useRef<CloudsEffect | null>(null);

  const setCloudsRef = useCallback((effect: CloudsEffect | null) => {
    cloudsRef.current = effect;
  }, []);

  const handleChange = useCallback((key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const effects = enabled ? (
    <Fragment key={`clouds-${values.shadowCascadeCount}`}>
      <Clouds
        ref={setCloudsRef}
        coverage={values.coverage}
        resolutionScale={values.resolutionScale}
        scatterAnisotropy1={values.scatterAnisotropy1}
        scatterAnisotropy2={values.scatterAnisotropy2}
        scatterAnisotropyMix={values.scatterAnisotropyMix}
        skyLightScale={values.skyLightScale}
        groundBounceScale={values.groundBounceScale}
        powderScale={values.powderScale}
        powderExponent={values.powderExponent}
        shadow-farScale={values.shadowFarScale}
        shadow-maxFar={values.shadowMaxFar}
        shadow-cascadeCount={values.shadowCascadeCount}
        shadow-mapSize={[512, 512]}
        shadow-splitMode="practical"
        shadow-splitLambda={0.71}
      />
    </Fragment>
  ) : (
    <Fragment />
  );

  const lensFlareEffect = lensFlare ? <LensFlare /> : <Fragment />;

  const panel =
    process.env.NODE_ENV === "development" ? (
      <CloudTuningPanel
        values={values}
        enabled={enabled}
        lensFlare={lensFlare}
        onToggle={() => setEnabled((v) => !v)}
        onToggleLensFlare={() => setLensFlare((v) => !v)}
        onChange={handleChange}
      />
    ) : null;

  return { effects, lensFlareEffect, panel, enabled, lensFlare };
}
