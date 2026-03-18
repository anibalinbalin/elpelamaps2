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
      uOpacity: { value: 0.4 },
    }),
    []
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  // With ReorientationPlugin, José Ignacio is at origin.
  // Place cloud plane at ~2km altitude, covering ~20km area
  return (
    <mesh position={[0, 1500, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30000, 30000, 1, 1]} />
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
