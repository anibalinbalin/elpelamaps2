"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DataTexture,
  Group,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

type Vec3 = [number, number, number];
type Vec2 = [number, number];
export type CloudMotionPreset = "subtle" | "cinematic";

interface CloudSpriteSpec {
  offset: Vec3;
  scale: Vec2;
  opacity: number;
}

interface CloudBankSpec {
  position: Vec3;
  drift: Vec2;
  bob: number;
  pulse: number;
  speed: number;
  phase: number;
  sprites: CloudSpriteSpec[];
}

const ignoreRaycast = () => {};

const CLOUD_MOTION_PRESETS: Record<
  CloudMotionPreset,
  { drift: number; bob: number; pulse: number; speed: number }
> = {
  subtle: {
    drift: 0.55,
    bob: 0.6,
    pulse: 0.55,
    speed: 0.65,
  },
  cinematic: {
    drift: 1.3,
    bob: 1.35,
    pulse: 1.2,
    speed: 1.4,
  },
};

const CLOUD_BANKS: CloudBankSpec[] = [
  {
    position: [-260, 900, -340],
    drift: [90, 55],
    bob: 20,
    pulse: 0.05,
    speed: 0.045,
    phase: 0.2,
    sprites: [
      { offset: [0, 0, 0], scale: [1380, 740], opacity: 0.28 },
      { offset: [-280, -40, 90], scale: [920, 540], opacity: 0.21 },
      { offset: [260, 50, -120], scale: [1020, 560], opacity: 0.19 },
      { offset: [70, 120, 120], scale: [760, 440], opacity: 0.16 },
    ],
  },
  {
    position: [360, 860, 180],
    drift: [70, 95],
    bob: 18,
    pulse: 0.04,
    speed: 0.037,
    phase: 1.1,
    sprites: [
      { offset: [0, 0, 0], scale: [1160, 640], opacity: 0.24 },
      { offset: [-240, 40, -100], scale: [820, 470], opacity: 0.18 },
      { offset: [280, -60, 120], scale: [940, 540], opacity: 0.19 },
      { offset: [120, 110, -80], scale: [660, 380], opacity: 0.14 },
    ],
  },
  {
    position: [980, 960, -520],
    drift: [110, 70],
    bob: 22,
    pulse: 0.06,
    speed: 0.032,
    phase: 2.4,
    sprites: [
      { offset: [0, 0, 0], scale: [1420, 760], opacity: 0.25 },
      { offset: [-340, 60, 120], scale: [940, 530], opacity: 0.18 },
      { offset: [310, -20, -90], scale: [1020, 560], opacity: 0.19 },
      { offset: [90, 130, 110], scale: [780, 430], opacity: 0.14 },
    ],
  },
  {
    position: [-1080, 830, 620],
    drift: [60, 90],
    bob: 16,
    pulse: 0.04,
    speed: 0.041,
    phase: 3.3,
    sprites: [
      { offset: [0, 0, 0], scale: [1100, 620], opacity: 0.22 },
      { offset: [240, 40, -110], scale: [820, 450], opacity: 0.16 },
      { offset: [-260, -30, 90], scale: [780, 440], opacity: 0.16 },
      { offset: [40, 110, 130], scale: [600, 350], opacity: 0.12 },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(min: number, max: number, value: number) {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildCloudTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const lobes = [
    { x: 0.26, y: 0.56, radiusX: 0.21, radiusY: 0.18, weight: 0.95 },
    { x: 0.44, y: 0.46, radiusX: 0.24, radiusY: 0.2, weight: 1.2 },
    { x: 0.62, y: 0.5, radiusX: 0.23, radiusY: 0.18, weight: 1.05 },
    { x: 0.78, y: 0.58, radiusX: 0.18, radiusY: 0.16, weight: 0.82 },
    { x: 0.5, y: 0.67, radiusX: 0.26, radiusY: 0.14, weight: 0.6 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      let density = 0;

      for (const lobe of lobes) {
        const dx = (u - lobe.x) / lobe.radiusX;
        const dy = (v - lobe.y) / lobe.radiusY;
        density += Math.exp(-(dx * dx + dy * dy) * 1.6) * lobe.weight;
      }

      density = clamp((density - 0.22) / 1.35, 0, 1);

      const sideFade =
        smoothstep(0.02, 0.24, u) * smoothstep(0.02, 0.24, 1 - u);
      const topFade = smoothstep(0.02, 0.18, v);
      const bottomFade = smoothstep(0.01, 0.42, 1 - v);
      const alpha = density * sideFade * topFade * bottomFade;

      const highlight = 0.84 + density * 0.18 + v * 0.04;
      const r = Math.round(clamp(244 * highlight, 0, 255));
      const g = Math.round(clamp(240 * highlight, 0, 255));
      const b = Math.round(clamp(232 * highlight, 0, 255));
      const index = (y * size + x) * 4;

      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = Math.round(clamp(alpha, 0, 1) * 255);
    }
  }

  const texture = new DataTexture(
    data,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

interface DecorativeCloudLayerProps {
  motionPreset?: CloudMotionPreset;
  swooshTick?: number;
}

export function DecorativeCloudLayer({
  motionPreset = "cinematic",
  swooshTick = 0,
}: DecorativeCloudLayerProps) {
  const texture = useMemo(buildCloudTexture, []);
  const bankRefs = useRef<Array<Group | null>>([]);
  const lastSwooshTickRef = useRef(swooshTick);
  const swooshStartedAtRef = useRef<number | null>(null);
  const motion = CLOUD_MOTION_PRESETS[motionPreset];

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    const heightFade = 1 - smoothstep(1180, 1720, camera.position.y);

    if (lastSwooshTickRef.current !== swooshTick) {
      lastSwooshTickRef.current = swooshTick;
      swooshStartedAtRef.current = time;
    }

    const swooshElapsed =
      swooshStartedAtRef.current == null ? Number.POSITIVE_INFINITY : time - swooshStartedAtRef.current;
    const swooshStrength =
      smoothstep(0, 0.35, swooshElapsed) *
      (1 - smoothstep(1.1, 5.4, swooshElapsed));
    const motionBoost = 1 + swooshStrength * 1.9;
    const speedBoost = 1 + swooshStrength * 2.6;
    const sweepOffset = swooshStrength * 180;

    CLOUD_BANKS.forEach((bank, index) => {
      const group = bankRefs.current[index];
      if (!group) return;

      const driftPhase = time * bank.speed * motion.speed * speedBoost + bank.phase;
      const pulse =
        1 + Math.sin(driftPhase * 1.4) * bank.pulse * motion.pulse * (1 + swooshStrength * 0.35);
      const directionalSweep = sweepOffset * (0.7 + index * 0.18);
      const crossSweep = swooshStrength * 68 * (index % 2 === 0 ? -1 : 1);

      group.position.set(
        bank.position[0] +
          Math.sin(driftPhase) * bank.drift[0] * motion.drift * motionBoost +
          directionalSweep,
        bank.position[1] +
          Math.sin(driftPhase * 1.6) * bank.bob * motion.bob * (1 + swooshStrength * 0.5),
        bank.position[2] +
          Math.cos(driftPhase * 0.9) * bank.drift[1] * motion.drift * motionBoost +
          crossSweep,
      );
      group.scale.setScalar(pulse * (1 + swooshStrength * 0.08));
      group.visible = heightFade > 0.02;

      bank.sprites.forEach((sprite, spriteIndex) => {
        const cloudSprite = group.children[spriteIndex];
        const material = cloudSprite?.type === "Sprite"
          ? (cloudSprite as { material?: { opacity?: number } }).material
          : undefined;

        if (material?.opacity != null) {
          material.opacity = sprite.opacity * heightFade * (1 + swooshStrength * 0.08);
        }
      });
    });
  });

  return (
    <>
      {CLOUD_BANKS.map((bank, bankIndex) => (
        <group
          key={`${bank.position.join(":")}:${bank.phase}`}
          position={bank.position}
          ref={(node) => {
            bankRefs.current[bankIndex] = node;
          }}
        >
          {bank.sprites.map((sprite, spriteIndex) => (
            <sprite
              key={spriteIndex}
              position={sprite.offset}
              scale={[sprite.scale[0], sprite.scale[1], 1]}
              raycast={ignoreRaycast}
              renderOrder={4}
            >
              <spriteMaterial
                map={texture}
                transparent
                opacity={sprite.opacity}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          ))}
        </group>
      ))}
    </>
  );
}
