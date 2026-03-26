"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomShader,
  CustomShaderMode,
  LightingModel,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TextureUniform,
  UniformType,
  Viewer,
  createGooglePhotorealistic3DTileset,
  defined,
  type Cesium3DTileset,
} from "cesium";
import { GOOGLE_MAPS_API_KEY, JOSE_IGNACIO_CENTER } from "@/lib/constants";
import { MASK_BOUNDS_LON_LAT, MASK_SIZE } from "@/lib/night-mode";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

type BrushType = "wave" | "canopy";

const BRUSH_COLORS: Record<BrushType, string> = {
  wave: "rgb(255, 0, 0)",
  canopy: "rgb(0, 255, 0)",
};

const BRUSH_UI_COLORS: Record<BrushType, { bg: string; border: string; text: string }> = {
  wave: { bg: "bg-blue-500/20", border: "border-blue-400/40", text: "text-blue-300" },
  canopy: { bg: "bg-emerald-500/20", border: "border-emerald-400/40", text: "text-emerald-300" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function worldToMaskUV(
  cartesian: Cartesian3,
): { u: number; v: number } | null {
  const carto = Cartographic.fromCartesian(cartesian);
  const lon = CesiumMath.toDegrees(carto.longitude);
  const lat = CesiumMath.toDegrees(carto.latitude);

  const u =
    (lon - MASK_BOUNDS_LON_LAT.sw[0]) /
    (MASK_BOUNDS_LON_LAT.ne[0] - MASK_BOUNDS_LON_LAT.sw[0]);
  const v =
    (lat - MASK_BOUNDS_LON_LAT.sw[1]) /
    (MASK_BOUNDS_LON_LAT.ne[1] - MASK_BOUNDS_LON_LAT.sw[1]);

  if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) return null;
  return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LivingWorldEditorViewer() {
  const googleApiKey = GOOGLE_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Mask canvas
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const overlayShaderRef = useRef<CustomShader | null>(null);
  const overlayUpdateRef = useRef<number | null>(null);

  // Brush cursor overlay
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Brush state
  const brushTypeRef = useRef<BrushType>("wave");
  const brushSizeRef = useRef(30);
  const eraseModeRef = useRef(false);
  const isPaintingRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const [brushType, setBrushType] = useState<BrushType>("wave");
  const [brushSize, setBrushSize] = useState(30);
  const [eraseMode, setEraseMode] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Keep refs in sync with state
  useEffect(() => { brushTypeRef.current = brushType; }, [brushType]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { eraseModeRef.current = eraseMode; }, [eraseMode]);

  // -----------------------------------------------------------------------
  // Update preview canvas
  // -----------------------------------------------------------------------

  // Last known mask UV for preview cursor
  const lastMaskUVRef = useRef<{ u: number; v: number } | null>(null);

  const updatePreview = useCallback(() => {
    const src = maskCanvasRef.current;
    const dst = previewCanvasRef.current;
    if (!src || !dst) return;
    const ctx = dst.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, 0, 0, dst.width, dst.height);

    // Draw brush radius indicator on preview
    const uv = lastMaskUVRef.current;
    if (uv) {
      const scale = dst.width / MASK_SIZE;
      const cx = uv.u * dst.width;
      const cy = (1 - uv.v) * dst.height; // Y-flip
      const r = brushSizeRef.current * scale;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = eraseModeRef.current
        ? "rgba(255, 200, 100, 0.9)"
        : brushTypeRef.current === "wave"
          ? "rgba(100, 180, 255, 0.9)"
          : "rgba(100, 230, 150, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Crosshair at center
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, []);

  // -----------------------------------------------------------------------
  // Update overlay shader on tiles (shows painted mask on terrain)
  // -----------------------------------------------------------------------

  const syncOverlayToTerrain = useCallback(() => {
    if (overlayUpdateRef.current != null) {
      cancelAnimationFrame(overlayUpdateRef.current);
    }
    overlayUpdateRef.current = requestAnimationFrame(() => {
      overlayUpdateRef.current = null;
      const canvas = maskCanvasRef.current;
      const tileset = tilesetRef.current;
      if (!canvas || !tileset) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
      const rgba = new Uint8Array(imageData.data);

      // Recreate shader with updated mask baked in (same pattern as night shader)
      const DEG2RAD = Math.PI / 180;
      const shader = new CustomShader({
        mode: CustomShaderMode.MODIFY_MATERIAL,
        lightingModel: LightingModel.UNLIT,
        uniforms: {
          u_maskTex: {
            type: UniformType.SAMPLER_2D,
            value: new TextureUniform({
              typedArray: rgba,
              width: MASK_SIZE,
              height: MASK_SIZE,
            }),
          },
          u_boundsMinLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[0] * DEG2RAD },
          u_boundsMinLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.sw[1] * DEG2RAD },
          u_boundsMaxLon: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[0] * DEG2RAD },
          u_boundsMaxLat: { type: UniformType.FLOAT, value: MASK_BOUNDS_LON_LAT.ne[1] * DEG2RAD },
        },
        fragmentShaderText: /* glsl */ `
          void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            vec3 pos = fsInput.attributes.positionWC;
            float lon = atan(pos.y, pos.x);
            float p = sqrt(pos.x * pos.x + pos.y * pos.y);
            float lat = atan(pos.z, p * (1.0 - 0.00669438));

            vec2 maskUV = vec2(
              (lon - u_boundsMinLon) / (u_boundsMaxLon - u_boundsMinLon),
              (lat - u_boundsMinLat) / (u_boundsMaxLat - u_boundsMinLat)
            );
            maskUV.y = 1.0 - maskUV.y;
            maskUV = clamp(maskUV, 0.0, 1.0);

            vec4 mask = texture(u_maskTex, maskUV);
            float waveMask = mask.r;
            float canopyMask = mask.g;

            // Keep original tile colors visible, overlay semi-transparent tint
            vec3 original = material.diffuse;

            // Blue tint for wave zones — strong enough to clearly see
            if (waveMask > 0.1) {
              material.diffuse = mix(original, vec3(0.2, 0.45, 1.0), waveMask * 0.5);
            }
            // Green tint for canopy zones
            if (canopyMask > 0.1) {
              material.diffuse = mix(original, vec3(0.2, 0.85, 0.35), canopyMask * 0.5);
            }
          }
        `,
      });

      tileset.customShader = shader;
      overlayShaderRef.current = shader;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Save mask to API (debounced)
  // -----------------------------------------------------------------------

  const saveMask = useCallback(() => {
    if (saveTimeoutRef.current != null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;

      setSaveState("saving");
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw new Error("Failed to create PNG blob");

        const response = await fetch("/api/living-world-mask", {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
        if (!response.ok) throw new Error("Save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
  }, []);

  // -----------------------------------------------------------------------
  // Paint at screen position
  // -----------------------------------------------------------------------

  const paintAt = useCallback(
    (screenPos: Cartesian2) => {
      const viewer = viewerRef.current;
      const ctx = maskCtxRef.current;
      if (!viewer || !ctx) return;

      const cartesian = viewer.scene.pickPosition(screenPos);
      if (!cartesian || !defined(cartesian) || isNaN(cartesian.x)) return;

      const uv = worldToMaskUV(cartesian);
      if (!uv) return;

      lastMaskUVRef.current = uv;
      const cx = uv.u * MASK_SIZE;
      const cy = (1 - uv.v) * MASK_SIZE; // Y-flip: canvas row 0 = north

      const r = brushSizeRef.current;

      if (eraseModeRef.current) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = BRUSH_COLORS[brushTypeRef.current];
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over";

      updatePreview();
      syncOverlayToTerrain();
    },
    [updatePreview, syncOverlayToTerrain],
  );

  // -----------------------------------------------------------------------
  // Load existing mask from API
  // -----------------------------------------------------------------------

  const loadMask = useCallback(async () => {
    const canvas = maskCanvasRef.current;
    const ctx = maskCtxRef.current;
    if (!canvas || !ctx) return;

    try {
      const response = await fetch("/api/living-world-mask", { cache: "no-store" });
      if (!response.ok) return;

      const blob = await response.blob();
      if (blob.size < 100) return; // Skip tiny placeholder

      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load mask image"));
      });

      ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
      ctx.drawImage(img, 0, 0, MASK_SIZE, MASK_SIZE);
      URL.revokeObjectURL(img.src);
      updatePreview();
      syncOverlayToTerrain();
    } catch {
      // No existing mask — start fresh
    }
  }, [updatePreview]);

  // -----------------------------------------------------------------------
  // Clear all
  // -----------------------------------------------------------------------

  const clearAll = useCallback(() => {
    const ctx = maskCtxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    updatePreview();
    syncOverlayToTerrain();
    saveMask();
  }, [updatePreview, syncOverlayToTerrain, saveMask]);

  // -----------------------------------------------------------------------
  // Cesium viewer init
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!googleApiKey || !containerRef.current || viewerRef.current) return;

    // Create mask canvas
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = MASK_SIZE;
    maskCanvas.height = MASK_SIZE;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;
    maskCanvasRef.current = maskCanvas;
    maskCtxRef.current = maskCtx;

    window.CESIUM_BASE_URL = "/Cesium/";
    let disposed = false;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      vrButton: false,
      requestRenderMode: false,
      shadows: false,
    });

    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.baseColor = Color.TRANSPARENT;
    viewer.scene.globe.imageryLayers.removeAll();
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    viewer.postProcessStages.fxaa.enabled = true;

    // Lock to top-down: pan + zoom only
    const controller = viewer.scene.screenSpaceCameraController;
    controller.maximumZoomDistance = 6000;
    controller.minimumZoomDistance = 200;
    controller.enableTilt = false;
    controller.enableLook = false;

    // Disable default double-click behavior
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );

    viewerRef.current = viewer;

    // Set initial top-down view
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        JOSE_IGNACIO_CENTER.lon,
        JOSE_IGNACIO_CENTER.lat,
        3000,
      ),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
    });

    // --- Input handler for brush painting ---
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { position: Cartesian2 }) => {
      isPaintingRef.current = true;
      viewer.scene.screenSpaceCameraController.enableInputs = false;
      paintAt(movement.position);
    }, ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction(() => {
      if (isPaintingRef.current) {
        isPaintingRef.current = false;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
        saveMask();
      }
    }, ScreenSpaceEventType.LEFT_UP);

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      if (isPaintingRef.current) {
        paintAt(movement.endPosition);
      } else {
        // Update preview cursor position even when not painting
        const cartesian = viewer.scene.pickPosition(movement.endPosition);
        if (cartesian && defined(cartesian) && !isNaN(cartesian.x)) {
          const uv = worldToMaskUV(cartesian);
          if (uv) {
            lastMaskUVRef.current = uv;
            updatePreview();
          }
        }
      }
      // Track cursor position for brush circle
      const rect = (viewer.container as HTMLElement).getBoundingClientRect();
      setCursorPos({
        x: movement.endPosition.x + rect.left,
        y: movement.endPosition.y + rect.top,
      });
      // Hide default cursor — we show our own brush circle
      (viewer.container as HTMLElement).style.cursor = "none";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handlerRef.current = handler;

    // --- Load Google 3D Tiles (no night shader — daytime view for painting) ---
    void (async () => {
      try {
        const tileset = await createGooglePhotorealistic3DTileset({
          key: googleApiKey,
          onlyUsingWithGoogleGeocoder: true,
        });
        if (disposed) return;

        tilesetRef.current = tileset;
        viewer.scene.primitives.add(tileset);

        tileset.initialTilesLoaded.addEventListener(() => {
          if (!disposed) {
            setIsSceneReady(true);
            syncOverlayToTerrain();
          }
        });
        if (tileset.tilesLoaded) {
          setIsSceneReady(true);
          syncOverlayToTerrain();
        }
      } catch (loadError) {
        if (disposed) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load Google Photorealistic 3D Tiles.",
        );
      }
    })();

    // Load existing mask
    void loadMask();

    // Keyboard shortcuts: [ ] for brush size, e for erase toggle
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[") {
        const newSize = Math.max(5, brushSizeRef.current - 5);
        brushSizeRef.current = newSize;
        setBrushSize(newSize);
      } else if (e.key === "]") {
        const newSize = Math.min(100, brushSizeRef.current + 5);
        brushSizeRef.current = newSize;
        setBrushSize(newSize);
      } else if (e.key === "e" || e.key === "E") {
        eraseModeRef.current = !eraseModeRef.current;
        setEraseMode(eraseModeRef.current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      disposed = true;
      if (saveTimeoutRef.current != null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      handlerRef.current?.destroy();
      handlerRef.current = null;
      if (overlayUpdateRef.current != null) {
        cancelAnimationFrame(overlayUpdateRef.current);
      }
      viewerRef.current?.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
      overlayShaderRef.current = null;
      maskCanvasRef.current = null;
      maskCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleApiKey]);

  // -----------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------

  const headerStatus =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed"
        : saveState === "saved"
          ? "Saved"
          : "Ready";

  if (!googleApiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/50">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
      </div>
    );
  }

  const brushCursorColor = eraseMode
    ? "rgba(255, 200, 100, 0.6)"
    : brushType === "wave"
      ? "rgba(60, 140, 255, 0.6)"
      : "rgba(60, 220, 120, 0.6)";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111417] text-white">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Brush cursor circle */}
      {cursorPos && (
        <div
          className="pointer-events-none fixed z-30 rounded-full border-2"
          style={{
            left: cursorPos.x - brushSize,
            top: cursorPos.y - brushSize,
            width: brushSize * 2,
            height: brushSize * 2,
            borderColor: brushCursorColor,
            backgroundColor: eraseMode ? "transparent" : brushCursorColor.replace("0.6", "0.08"),
          }}
        />
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-[#0b1015]/74 via-[#0b1015]/28 to-transparent px-5 py-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-[26px] border border-white/10 bg-[rgba(19,24,30,0.88)] px-4 py-3 shadow-[0_18px_48px_rgba(3,10,16,0.34)] backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/44">
              Living World
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white">
              Zone Painter
            </div>
          </div>
          <div className="mx-1 h-9 w-px bg-white/10" />
          <a
            href="/viewer"
            className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
          >
            3D Viewer
          </a>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-[999px] border border-white/10 bg-[rgba(19,24,30,0.84)] px-3 py-2 text-[11px] text-white/72 shadow-[0_18px_48px_rgba(3,10,16,0.28)] backdrop-blur-xl">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              brushType === "wave" ? "bg-blue-400" : "bg-emerald-400"
            }`}
          />
          <span>{brushType === "wave" ? "Wave" : "Canopy"}</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{eraseMode ? "Erasing" : "Painting"}</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{headerStatus}</span>
        </div>
      </div>

      {/* Toolbar — floating left */}
      <div className="pointer-events-auto absolute left-4 top-[88px] z-20 flex w-48 flex-col gap-2 rounded-[22px] border border-white/10 bg-[rgba(16,20,25,0.92)] p-3 shadow-[0_32px_90px_rgba(3,10,16,0.42)] backdrop-blur-xl">
        {/* Brush type */}
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          Brush Type
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setBrushType("wave")}
            className={`flex-1 rounded-[14px] px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${
              brushType === "wave"
                ? `${BRUSH_UI_COLORS.wave.bg} ${BRUSH_UI_COLORS.wave.border} border ${BRUSH_UI_COLORS.wave.text}`
                : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            Wave
          </button>
          <button
            type="button"
            onClick={() => setBrushType("canopy")}
            className={`flex-1 rounded-[14px] px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${
              brushType === "canopy"
                ? `${BRUSH_UI_COLORS.canopy.bg} ${BRUSH_UI_COLORS.canopy.border} border ${BRUSH_UI_COLORS.canopy.text}`
                : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
            }`}
          >
            Canopy
          </button>
        </div>

        <div className="h-px bg-white/8" />

        {/* Erase toggle */}
        <button
          type="button"
          onClick={() => setEraseMode(!eraseMode)}
          className={`rounded-[14px] px-3 py-2 text-[12px] font-semibold transition-colors duration-200 ${
            eraseMode
              ? "border border-amber-400/30 bg-amber-500/15 text-amber-300"
              : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          {eraseMode ? "Erasing" : "Erase Mode"}
        </button>

        <div className="h-px bg-white/8" />

        {/* Brush size */}
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          Brush Size
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-blue-400"
          />
          <span className="w-8 text-right font-mono text-[10px] text-white/40">
            {brushSize}
          </span>
        </div>

        <div className="h-px bg-white/8" />

        {/* Clear */}
        <button
          type="button"
          onClick={clearAll}
          className="rounded-[14px] border border-red-400/20 bg-red-500/8 px-3 py-2 text-[12px] font-semibold text-red-300/70 transition-colors duration-200 hover:bg-red-500/15 hover:text-red-300"
        >
          Clear All
        </button>

        {/* Preview */}
        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
          Mask Preview
        </div>
        <canvas
          ref={previewCanvasRef}
          width={128}
          height={128}
          className="w-full rounded-lg border border-white/10 bg-black/40"
        />
      </div>

      {/* Instructions */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-[18px] border border-white/10 bg-[rgba(16,20,25,0.88)] px-5 py-3 text-[12px] text-white/60 shadow-lg backdrop-blur-xl">
        Click and drag to paint &middot; Right-click to pan &middot; Scroll to zoom &middot;
        <span className="font-mono text-white/40"> [ ] </span> brush size &middot;
        <span className="font-mono text-white/40"> E </span> erase toggle
      </div>

      {/* Error */}
      {error && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[420px] rounded-[18px] border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-[12px] text-red-200 shadow-lg backdrop-blur-md">
          {error}
        </div>
      )}

      {!isSceneReady && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white/50">
          Loading scene...
        </div>
      )}
    </div>
  );
}
