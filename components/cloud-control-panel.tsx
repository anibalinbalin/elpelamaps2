"use client";

import { useId, useState } from "react";
import {
  CLOUD_PRESETS,
  type CloudLayerSettings,
  type CloudPresetId,
  type CloudQualityPreset,
} from "@/lib/cloud-settings";
import { useCloudSettings } from "@/lib/use-cloud-settings";

const PRESET_LABELS: Record<CloudPresetId, string> = {
  subtle: "Subtle",
  cinematic: "Cinematic",
  dramatic: "Dramatic",
};

interface SliderFieldProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function formatValue(value: number, step: number): string {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  if (step >= 0.01) return value.toFixed(2);
  return value.toFixed(4);
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: SliderFieldProps) {
  const id = useId();
  const inputName = label.toLowerCase().replaceAll(" ", "-");

  function handleValue(nextValue: string): void {
    const parsed = Number(nextValue);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-white/72">
        <label htmlFor={id} className="text-white/82">
          {label}
        </label>
        <span className="tabular-nums text-white/58">
          {formatValue(value, step)}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_5.5rem] items-center gap-2">
        <input
          id={id}
          type="range"
          name={`${inputName}-range`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => handleValue(event.target.value)}
          className="accent-cyan-400"
        />
        <input
          type="number"
          name={`${inputName}-number`}
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          value={value}
          onChange={(event) => handleValue(event.target.value)}
          className="w-full rounded-md border border-white/12 bg-black/35 px-2 py-1 text-xs tabular-nums text-white outline-none ring-0"
        />
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/4 px-3 py-2 text-sm text-white/82"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        name={label.toLowerCase().replaceAll(" ", "-")}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-cyan-400"
      />
    </label>
  );
}

function LayerControls({
  index,
  layer,
  defaultOpen = false,
}: {
  index: number;
  layer: CloudLayerSettings;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const setLayerValue = useCloudSettings((state) => state.setLayerValue);

  return (
    <div className="rounded-xl border border-white/10 bg-white/4 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-white"
      >
        <span>Layer {layer.channel.toUpperCase()}</span>
        <span className="text-xs text-white/54">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="mt-3 grid gap-3">
        <SliderField
          label="Altitude"
          min={0}
          max={6000}
          step={10}
          value={layer.altitude}
          onChange={(value) => setLayerValue(index, "altitude", value)}
        />
        <SliderField
          label="Height"
          min={0}
          max={3000}
          step={10}
          value={layer.height}
          onChange={(value) => setLayerValue(index, "height", value)}
        />
        <SliderField
          label="Density"
          min={0}
          max={0.4}
          step={0.005}
          value={layer.densityScale}
          onChange={(value) => setLayerValue(index, "densityScale", value)}
        />
        <SliderField
          label="Shape"
          min={0}
          max={1}
          step={0.01}
          value={layer.shapeAmount}
          onChange={(value) => setLayerValue(index, "shapeAmount", value)}
        />
        <SliderField
          label="Detail"
          min={0}
          max={1}
          step={0.01}
          value={layer.shapeDetailAmount}
          onChange={(value) => setLayerValue(index, "shapeDetailAmount", value)}
        />
        <SliderField
          label="Weather Exponent"
          min={0.2}
          max={2}
          step={0.01}
          value={layer.weatherExponent}
          onChange={(value) => setLayerValue(index, "weatherExponent", value)}
        />
        <SliderField
          label="Coverage Filter"
          min={0}
          max={1}
          step={0.01}
          value={layer.coverageFilterWidth}
          onChange={(value) => setLayerValue(index, "coverageFilterWidth", value)}
        />
        <ToggleField
          label="Cast Shadows"
          checked={layer.shadow}
          onChange={(checked) => setLayerValue(index, "shadow", checked)}
        />
      </div>}
    </div>
  );
}

export function CloudControlPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const settings = useCloudSettings((state) => state.settings);
  const setScalar = useCloudSettings((state) => state.setScalar);
  const setTupleValue = useCloudSettings((state) => state.setTupleValue);
  const applyPreset = useCloudSettings((state) => state.applyPreset);
  const reset = useCloudSettings((state) => state.reset);

  const panelAnchorStyle = {
    left: "max(1rem, env(safe-area-inset-left))",
    bottom: "max(1rem, env(safe-area-inset-bottom))",
  } as const;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed z-20 rounded-full border border-white/12 bg-black/72 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm"
        style={panelAnchorStyle}
      >
        Cloud Tuner
      </button>
    );
  }

  return (
    <section
      className="fixed z-20 w-[min(24rem,calc(100vw-2rem))] max-h-[min(72dvh,44rem)] overflow-y-auto rounded-2xl border border-white/12 bg-black/78 p-4 text-white shadow-lg backdrop-blur-sm"
      style={panelAnchorStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white text-balance">
            Cloud Tuner
          </h2>
          <p className="mt-1 text-sm text-white/58 text-pretty">
            Changes apply live and persist in your browser. If clouds disappear,
            hit Cinematic or Reset.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-white/12 px-3 py-1.5 text-xs font-medium text-white/78 transition-colors hover:bg-white/8"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-md border border-white/12 px-3 py-1.5 text-xs font-medium text-white/78 transition-colors hover:bg-white/8"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-medium tracking-[0.16em] text-white/42 uppercase">
          Presets
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(CLOUD_PRESETS) as CloudPresetId[]).map((presetId) => (
            <button
              key={presetId}
              type="button"
              onClick={() => applyPreset(presetId)}
              className="rounded-full border border-white/12 bg-white/4 px-3 py-1.5 text-xs font-medium text-white/78 transition-colors hover:bg-white/10"
            >
              {PRESET_LABELS[presetId]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-sm text-white/82">
          <span id="cloud-quality-label">Quality</span>
          <select
            id="cloud-quality"
            name="cloud-quality"
            aria-labelledby="cloud-quality-label"
            value={settings.qualityPreset}
            onChange={(event) =>
              setScalar("qualityPreset", event.target.value as CloudQualityPreset)
            }
            className="rounded-md border border-white/12 bg-black/35 px-3 py-2 text-sm text-white outline-none"
          >
            {(["low", "medium", "high", "ultra"] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <SliderField
          label="Coverage"
          min={0}
          max={1}
          step={0.01}
          value={settings.coverage}
          onChange={(value) => setScalar("coverage", value)}
        />
        <SliderField
          label="Resolution Scale"
          min={0.5}
          max={1}
          step={0.05}
          value={settings.resolutionScale}
          onChange={(value) => setScalar("resolutionScale", value)}
        />
        <SliderField
          label="Weather Repeat X"
          min={1}
          max={20}
          step={0.1}
          value={settings.localWeatherRepeat[0]}
          onChange={(value) => setTupleValue("localWeatherRepeat", 0, value)}
        />
        <SliderField
          label="Weather Repeat Y"
          min={1}
          max={20}
          step={0.1}
          value={settings.localWeatherRepeat[1]}
          onChange={(value) => setTupleValue("localWeatherRepeat", 1, value)}
        />
        <SliderField
          label="Weather Velocity X"
          min={-0.01}
          max={0.01}
          step={0.0001}
          value={settings.localWeatherVelocity[0]}
          onChange={(value) => setTupleValue("localWeatherVelocity", 0, value)}
        />
        <SliderField
          label="Weather Velocity Y"
          min={-0.01}
          max={0.01}
          step={0.0001}
          value={settings.localWeatherVelocity[1]}
          onChange={(value) => setTupleValue("localWeatherVelocity", 1, value)}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {settings.layers.map((layer, index) => (
          <LayerControls
            key={layer.channel}
            index={index}
            layer={layer}
            defaultOpen={index === 0}
          />
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/8 p-3 text-sm text-cyan-50/90">
        <div className="font-medium">Good first moves</div>
        <p className="mt-1 text-pretty text-cyan-50/70">
          For bigger, more sale-friendly cloud forms, raise coverage and lower
          weather repeat. For softer clouds, reduce detail and density.
        </p>
      </div>
    </section>
  );
}
