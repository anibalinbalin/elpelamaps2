/**
 * Default values for the Living World effects.
 * These are tuned via the living-world-tuner and baked here once dialed in.
 */

export interface LivingWorldParams {
  enabled: boolean;
  debugMask: boolean;
  waveSpeed: number;
  waveAmplitude: number;
  waveFrequency: number;
  swaySpeed: number;
  swayAmplitude: number;
  swayFrequency: number;
}

export const LIVING_WORLD_DEFAULTS: LivingWorldParams = {
  enabled: true,
  debugMask: false,
  waveSpeed: 1.0,
  waveAmplitude: 0.002,
  waveFrequency: 30.0,
  swaySpeed: 0.6,
  swayAmplitude: 0.001,
  swayFrequency: 15.0,
};

/** Uniform metadata for the tuner panel */
export const LIVING_WORLD_UNIFORMS = [
  {
    key: "waveSpeed",
    label: "Wave Speed",
    min: 0.1,
    max: 3.0,
    step: 0.05,
    group: "Wave",
  },
  {
    key: "waveAmplitude",
    label: "Wave Amplitude",
    min: 0.0,
    max: 0.008,
    step: 0.0001,
    group: "Wave",
  },
  {
    key: "waveFrequency",
    label: "Wave Frequency",
    min: 5.0,
    max: 80.0,
    step: 1.0,
    group: "Wave",
  },
  {
    key: "swaySpeed",
    label: "Sway Speed",
    min: 0.1,
    max: 2.0,
    step: 0.05,
    group: "Canopy",
  },
  {
    key: "swayAmplitude",
    label: "Sway Amplitude",
    min: 0.0,
    max: 0.005,
    step: 0.0001,
    group: "Canopy",
  },
  {
    key: "swayFrequency",
    label: "Sway Frequency",
    min: 3.0,
    max: 40.0,
    step: 0.5,
    group: "Canopy",
  },
] as const;
