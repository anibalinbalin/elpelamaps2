"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  Viewer,
  createGooglePhotorealistic3DTileset,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TextureUniform,
  Math as CesiumMath,
  type Cesium3DTileset,
} from "cesium";
import {
  NIGHT_SHADER,
  MASK_BOUNDS_SW,
  MASK_BOUNDS_NE,
  MASK_SIZE,
  applyNightMode,
} from "@/lib/night-mode";
import { NightTuner } from "./night-tuner";
import { GOOGLE_MAPS_API_KEY, JOSE_IGNACIO_CENTER } from "@/lib/constants";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

/** Convert a Cartesian3 world position to mask canvas pixel coordinates */
function worldToMaskUV(pos: Cartesian3): { u: number; v: number } | null {
  const u = (pos.x - MASK_BOUNDS_SW.x) / (MASK_BOUNDS_NE.x - MASK_BOUNDS_SW.x);
  const v = (pos.y - MASK_BOUNDS_SW.y) / (MASK_BOUNDS_NE.y - MASK_BOUNDS_SW.y);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

export function NightEditorViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tilesetRef = useRef<Cesium3DTileset | null>(null);
  const nightCleanupRef = useRef<(() => void) | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Mask canvas (offscreen)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const uploadPendingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [paintMode, setPaintMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [isPainting, setIsPainting] = useState(false);

  const paintModeRef = useRef(false);
  const eraseModeRef = useRef(false);
  const brushSizeRef = useRef(30);
  const isPaintingRef = useRef(false);

  // Keep refs in sync
  paintModeRef.current = paintMode;
  eraseModeRef.current = eraseMode;
  brushSizeRef.current = brushSize;
  isPaintingRef.current = isPainting;

  // Initialize mask canvas
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    }
    maskCanvasRef.current = canvas;
    maskCtxRef.current = ctx;
  }, []);

  /** Schedule a debounced texture upload (once per animation frame) */
  const scheduleUpload = useCallback(() => {
    if (uploadPendingRef.current) return;
    uploadPendingRef.current = true;

    rafIdRef.current = requestAnimationFrame(() => {
      uploadPendingRef.current = false;
      const ctx = maskCtxRef.current;
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
      const rgba = new Uint8Array(imageData.data.buffer);

      NIGHT_SHADER.setUniform(
        "u_maskTex",
        new TextureUniform({
          typedArray: rgba,
          width: MASK_SIZE,
          height: MASK_SIZE,
        }),
      );
    });
  }, []);

  /** Paint or erase at a screen position */
  const paintAt = useCallback(
    (screenPos: Cartesian2) => {
      const viewer = viewerRef.current;
      const ctx = maskCtxRef.current;
      if (!viewer || viewer.isDestroyed() || !ctx) return;

      const worldPos = viewer.scene.pickPosition(screenPos);
      if (!worldPos) return;

      const uv = worldToMaskUV(worldPos);
      if (!uv) return;

      // Canvas Y is flipped relative to UV v
      const cx = uv.u * MASK_SIZE;
      const cy = (1 - uv.v) * MASK_SIZE;
      const r = brushSizeRef.current;

      if (eraseModeRef.current) {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 0, 0, 1)";
      ctx.fill();

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over";

      scheduleUpload();
    },
    [scheduleUpload],
  );

  const clearMask = useCallback(() => {
    const ctx = maskCtxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    scheduleUpload();
  }, [scheduleUpload]);

  // Initialize Cesium
  useEffect(() => {
    if (!containerRef.current) return;

    const googleApiKey = GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      setError("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local");
      return;
    }

    window.CESIUM_BASE_URL = "/Cesium/";
    let disposed = false;
    let loadTilesetFrameId: number | null = null;

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
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.imageryLayers.removeAll();
    viewer.postProcessStages.fxaa.enabled = true;

    const controller = viewer.scene.screenSpaceCameraController;
    controller.maximumZoomDistance = 10000;
    controller.minimumZoomDistance = 50;
    controller.enableCollisionDetection = true;

    viewerRef.current = viewer;

    // Fly to Jose Ignacio area
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        JOSE_IGNACIO_CENTER.lon,
        JOSE_IGNACIO_CENTER.lat,
        1500,
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
      duration: 0,
    });

    // Load tileset
    loadTilesetFrameId = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const tileset = await createGooglePhotorealistic3DTileset({
            key: googleApiKey,
            onlyUsingWithGoogleGeocoder: true,
          });
          if (disposed) return;

          tilesetRef.current = tileset;
          viewer.scene.primitives.add(tileset);

          // Apply night mode immediately
          nightCleanupRef.current = applyNightMode(viewer, tilesetRef);

          tileset.initialTilesLoaded.addEventListener(() => {
            if (!disposed) setIsReady(true);
          });
          if (tileset.tilesLoaded) setIsReady(true);
        } catch (loadError) {
          if (!disposed) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load Google Photorealistic 3D Tiles.",
            );
          }
        }
      })();
    });

    return () => {
      disposed = true;
      nightCleanupRef.current?.();
      nightCleanupRef.current = null;
      if (loadTilesetFrameId != null) {
        window.cancelAnimationFrame(loadTilesetFrameId);
      }
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      handlerRef.current?.destroy();
      handlerRef.current = null;
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      tilesetRef.current = null;
    };
  }, []);

  // Paint handler — click-drag to paint exclusion areas
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous handler
    if (handlerRef.current && !handlerRef.current.isDestroyed()) {
      handlerRef.current.destroy();
    }

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // LEFT_DOWN — start painting
    handler.setInputAction(
      (event: { position: Cartesian2 }) => {
        if (!paintModeRef.current) return;
        isPaintingRef.current = true;
        setIsPainting(true);

        // Disable camera controls while painting
        const ctrl = viewer.scene.screenSpaceCameraController;
        ctrl.enableRotate = false;
        ctrl.enableTranslate = false;
        ctrl.enableZoom = false;
        ctrl.enableTilt = false;
        ctrl.enableLook = false;

        paintAt(event.position);
      },
      ScreenSpaceEventType.LEFT_DOWN,
    );

    // MOUSE_MOVE — continue painting while dragging
    handler.setInputAction(
      (event: { endPosition: Cartesian2 }) => {
        if (!isPaintingRef.current) return;
        paintAt(event.endPosition);
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    );

    // LEFT_UP — stop painting
    handler.setInputAction(() => {
      if (isPaintingRef.current) {
        isPaintingRef.current = false;
        setIsPainting(false);

        // Re-enable camera controls
        const ctrl = viewer.scene.screenSpaceCameraController;
        ctrl.enableRotate = true;
        ctrl.enableTranslate = true;
        ctrl.enableZoom = true;
        ctrl.enableTilt = true;
        ctrl.enableLook = true;
      }
    }, ScreenSpaceEventType.LEFT_UP);

    return () => {
      if (!handler.isDestroyed()) {
        handler.destroy();
      }
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, [paintAt, isReady]);

  return (
    <div className="relative h-screen w-screen bg-black">
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-red-400">
          {error}
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />

      {!isReady && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white/50">
          Loading 3D tiles...
        </div>
      )}

      {/* Night Tuner panel */}
      <NightTuner />

      {/* Editor toolbar */}
      <div className="fixed right-3 top-20 z-50 flex w-56 flex-col gap-2 rounded-xl border border-white/10 bg-black/85 p-3 text-white/90 shadow-2xl backdrop-blur-md">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Exclusion Brush
        </div>

        {/* Paint mode toggle */}
        <button
          onClick={() => {
            setPaintMode(!paintMode);
            if (paintMode) setEraseMode(false);
          }}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            paintMode
              ? "bg-red-500/80 text-white"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          {paintMode ? "Exit Paint Mode" : "Paint Mode"}
        </button>

        {paintMode && (
          <>
            {/* Erase toggle */}
            <button
              onClick={() => setEraseMode(!eraseMode)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                eraseMode
                  ? "bg-blue-500/80 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {eraseMode ? "Erasing" : "Erase Mode"}
            </button>

            <div className="text-[10px] text-white/40">
              {eraseMode
                ? "Click-drag to erase exclusion areas."
                : "Click-drag on the map to paint exclusion areas."}
            </div>

            {isPainting && (
              <div className="text-[10px] font-medium text-red-400">
                Painting...
              </div>
            )}
          </>
        )}

        {/* Brush size slider */}
        <label className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-white/60">Brush Size</span>
            <span className="font-mono text-white/40">{brushSize}px</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-red-400"
          />
        </label>

        {/* Clear mask */}
        <button
          onClick={clearMask}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/70"
        >
          Clear All
        </button>

        {/* Mask preview */}
        <div className="mt-1 overflow-hidden rounded border border-white/10">
          <canvas
            ref={(el) => {
              // Mirror mask canvas into this visible preview
              if (!el || !maskCanvasRef.current) return;
              el.width = 128;
              el.height = 128;
              const previewCtx = el.getContext("2d");
              if (previewCtx) {
                const draw = () => {
                  previewCtx.clearRect(0, 0, 128, 128);
                  previewCtx.drawImage(maskCanvasRef.current!, 0, 0, 128, 128);
                  requestAnimationFrame(draw);
                };
                draw();
              }
            }}
            className="h-32 w-full bg-black/50"
          />
          <div className="px-1.5 py-0.5 text-center text-[9px] text-white/30">
            Mask Preview
          </div>
        </div>
      </div>
    </div>
  );
}
