"use client";

import { forwardRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Texture, Uniform } from "three";
import { Effect, EffectAttribute } from "postprocessing";
import { livingWorldFragmentShader } from "@/shaders/ocean-ripple";
import { MASK_BOUNDS_LON_LAT } from "@/lib/night-mode";
import {
  LIVING_WORLD_DEFAULTS,
  type LivingWorldParams,
} from "@/lib/living-world-defaults";

const DEG2RAD = Math.PI / 180;

class LivingWorldEffectImpl extends Effect {
  constructor(
    params: LivingWorldParams,
    maskTexture: Texture | null,
  ) {
    super("LivingWorldEffect", livingWorldFragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ["u_maskTex", new Uniform(maskTexture)],
        ["u_projMatrix", new Uniform(new Matrix4())],
        ["u_projMatrixInverse", new Uniform(new Matrix4())],
        ["u_inverseViewMatrix", new Uniform(new Matrix4())],
        ["u_worldToECEFMatrix", new Uniform(new Matrix4())],
        ["u_boundsMinLon", new Uniform(MASK_BOUNDS_LON_LAT.sw[0] * DEG2RAD)],
        ["u_boundsMinLat", new Uniform(MASK_BOUNDS_LON_LAT.sw[1] * DEG2RAD)],
        ["u_boundsMaxLon", new Uniform(MASK_BOUNDS_LON_LAT.ne[0] * DEG2RAD)],
        ["u_boundsMaxLat", new Uniform(MASK_BOUNDS_LON_LAT.ne[1] * DEG2RAD)],
        ["u_waveSpeed", new Uniform(params.waveSpeed)],
        ["u_waveAmplitude", new Uniform(params.waveAmplitude)],
        ["u_waveFrequency", new Uniform(params.waveFrequency)],
        ["u_swaySpeed", new Uniform(params.swaySpeed)],
        ["u_swayAmplitude", new Uniform(params.swayAmplitude)],
        ["u_swayFrequency", new Uniform(params.swayFrequency)],
        ["u_cameraAltitude", new Uniform(1000.0)],
        ["u_enabled", new Uniform(params.enabled ? 1 : 0)],
        ["u_debugMask", new Uniform(params.debugMask ? 1 : 0)],
      ]),
    });
  }
}

interface LivingWorldEffectProps extends Partial<LivingWorldParams> {
  maskTexture?: Texture | null;
  /** Ref to the tiles-to-ECEF matrix (inverse of tiles group world matrix) */
  worldToECEFMatrix?: Matrix4;
}

export const OceanRipple = forwardRef<Effect, LivingWorldEffectProps>(
  function OceanRipple(props, ref) {
    const params = { ...LIVING_WORLD_DEFAULTS, ...props };
    const maskTexture = props.maskTexture ?? null;
    const worldToECEFMatrix = props.worldToECEFMatrix;

    const effect = useMemo(
      () => new LivingWorldEffectImpl(params, maskTexture),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const camera = useThree((s) => s.camera);

    // Sync animation uniforms when props change
    useEffect(() => {
      effect.uniforms.get("u_waveSpeed")!.value = params.waveSpeed;
      effect.uniforms.get("u_waveAmplitude")!.value = params.waveAmplitude;
      effect.uniforms.get("u_waveFrequency")!.value = params.waveFrequency;
      effect.uniforms.get("u_swaySpeed")!.value = params.swaySpeed;
      effect.uniforms.get("u_swayAmplitude")!.value = params.swayAmplitude;
      effect.uniforms.get("u_swayFrequency")!.value = params.swayFrequency;
      effect.uniforms.get("u_enabled")!.value = params.enabled ? 1 : 0;
      effect.uniforms.get("u_debugMask")!.value = params.debugMask ? 1 : 0;
    }, [effect, params.waveSpeed, params.waveAmplitude, params.waveFrequency, params.swaySpeed, params.swayAmplitude, params.swayFrequency, params.enabled, params.debugMask]);

    // Update mask texture when it changes
    useEffect(() => {
      effect.uniforms.get("u_maskTex")!.value = maskTexture;
    }, [effect, maskTexture]);

    // Per-frame updates: camera matrix + altitude + ECEF matrix
    useFrame(() => {
      // Projection matrices (not available in Effect scope — must pass ourselves)
      effect.uniforms.get("u_projMatrix")!.value.copy(camera.projectionMatrix);
      effect.uniforms.get("u_projMatrixInverse")!.value.copy(camera.projectionMatrixInverse);

      // Camera inverse view matrix (matrixWorld = inverse of viewMatrix)
      effect.uniforms.get("u_inverseViewMatrix")!.value.copy(camera.matrixWorld);

      // Camera altitude (approximate from position length in tiles space)
      effect.uniforms.get("u_cameraAltitude")!.value = camera.position.length();

      // World-to-ECEF matrix
      if (worldToECEFMatrix) {
        effect.uniforms.get("u_worldToECEFMatrix")!.value.copy(worldToECEFMatrix);
      }
    });

    return <primitive ref={ref} object={effect} dispose={null} />;
  },
);
