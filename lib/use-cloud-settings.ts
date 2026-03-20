"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CLOUD_DEFAULT_SETTINGS,
  CLOUD_PRESETS,
  cloneCloudSettings,
  sanitizeCloudSettings,
  type CloudLayerSettings,
  type CloudPresetId,
  type CloudQualityPreset,
  type CloudSettings,
} from "@/lib/cloud-settings";

type ScalarSettingKey = "qualityPreset" | "resolutionScale" | "coverage";
type TupleSettingKey =
  | "localWeatherRepeat"
  | "localWeatherVelocity"
  | "shapeVelocity"
  | "shapeDetailVelocity";
type LayerSettingKey = Exclude<keyof CloudLayerSettings, "channel">;

interface CloudSettingsState {
  settings: CloudSettings;
  setScalar: (key: ScalarSettingKey, value: number | CloudQualityPreset) => void;
  setTupleValue: (key: TupleSettingKey, index: number, value: number) => void;
  setLayerValue: (index: number, key: LayerSettingKey, value: number | boolean) => void;
  applyPreset: (presetId: CloudPresetId) => void;
  reset: () => void;
}

export const useCloudSettings = create<CloudSettingsState>()(
  persist(
    (set) => ({
      settings: cloneCloudSettings(),
      setScalar: (key, value) =>
        set((state) => ({
          settings: sanitizeCloudSettings({
            ...state.settings,
            [key]: value,
          }),
        })),
      setTupleValue: (key, index, value) =>
        set((state) => {
          const next = [...state.settings[key]];
          next[index] = value;
          return {
            settings: sanitizeCloudSettings({
              ...state.settings,
              [key]: next,
            }),
          };
        }),
      setLayerValue: (index, key, value) =>
        set((state) => ({
          settings: sanitizeCloudSettings({
            ...state.settings,
            layers: state.settings.layers.map((layer, layerIndex) =>
              layerIndex === index ? { ...layer, [key]: value } : layer,
            ),
          }),
        })),
      applyPreset: (presetId) =>
        set({
          settings: cloneCloudSettings(CLOUD_PRESETS[presetId]),
        }),
      reset: () => set({ settings: cloneCloudSettings(CLOUD_DEFAULT_SETTINGS) }),
    }),
    {
      name: "elpela-cloud-settings",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      migrate: (persistedState, version) => {
        if ((version ?? 0) < 2) {
          return {
            settings: cloneCloudSettings(CLOUD_DEFAULT_SETTINGS),
          };
        }
        const state = persistedState as { settings?: Partial<CloudSettings> } | undefined;
        return {
          settings: sanitizeCloudSettings(state?.settings),
        };
      },
    },
  ),
);
