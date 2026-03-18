"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, DoubleSide } from "three";
import { cloudVertexShader, cloudFragmentShader } from "@/shaders/clouds";

export function CloudLayer() {
  const materialRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.35 },
    }),
    []
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  // In ECEF, Earth's radius is ~6,371,000m. Clouds at ~10km above surface.
  // This component should be placed INSIDE GoogleTilesLayer to inherit the Z-up to Y-up rotation.
  const EARTH_RADIUS = 6_371_000;
  const CLOUD_ALTITUDE = 10_000;
  const cloudRadius = EARTH_RADIUS + CLOUD_ALTITUDE;

  return (
    <mesh>
      <sphereGeometry args={[cloudRadius, 64, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={uniforms}
        transparent
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
