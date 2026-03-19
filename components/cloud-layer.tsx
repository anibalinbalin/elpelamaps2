"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, FrontSide } from "three";
import { cloudVertexShader, cloudFragmentShader } from "@/shaders/clouds";

export function CloudLayer() {
  const materialRef = useRef<ShaderMaterial>(null);
  const noRaycast = useCallback(() => {}, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.35 },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      position={[0, 1200, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={noRaycast}
    >
      <planeGeometry args={[50000, 50000, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={uniforms}
        transparent
        side={FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}
