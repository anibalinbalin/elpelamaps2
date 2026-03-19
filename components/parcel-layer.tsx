"use client";

import { useEffect, useRef, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import { ImageOverlayPlugin, GeoJSONOverlay } from "3d-tiles-renderer/plugins";
import { useParcelData } from "@/lib/use-parcel-data";
import type { ParcelCollection } from "@/lib/parcels";
import { PARCEL_COLORS } from "@/lib/constants";
import { useParcelSelection } from "@/lib/use-parcel-selection";

/**
 * Renders parcel boundaries via ImageOverlayPlugin on top of 3D tiles.
 * Dynamically updates per-feature styles for hover and selection states.
 */
export function ParcelLayer() {
  const gl = useThree((state) => state.gl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginRef = useRef<any>(null);
  const overlayRef = useRef<InstanceType<typeof GeoJSONOverlay> | null>(null);
  const hoveredId = useParcelSelection((s) => s.hoveredId);
  const selectedId = useParcelSelection((s) => s.selectedId);
  const parcels = useParcelData();
  const initDone = useRef(false);

  // Memoize args to prevent TilesPlugin from recreating the instance on re-render
  const pluginArgs = useMemo(() => [{ renderer: gl }], [gl]);

  // Create overlay once plugin is available — retry via useFrame-driven check
  // TilesPlugin sets pluginRef.current via useEffect, which may fire after our first useEffect
  useEffect(() => {
    if (initDone.current) return;

    const tryInit = () => {
      const plugin = pluginRef.current;
      if (!plugin || !plugin.addOverlay) {
        // Plugin not ready yet, retry shortly
        const timer = setTimeout(tryInit, 100);
        return () => clearTimeout(timer);
      }

      const styledGeoJSON = applyFeatureStyles(parcels, null, null);

      const overlay = new GeoJSONOverlay({
        geojson: styledGeoJSON,
        tileDimension: 512,
        fillStyle: PARCEL_COLORS.fill,
        strokeStyle: PARCEL_COLORS.stroke,
        strokeWidth: PARCEL_COLORS.strokeWidth,
      });
      plugin.addOverlay(overlay);
      overlayRef.current = overlay;
      initDone.current = true;
    };

    const cleanup = tryInit();
    return () => {
      if (typeof cleanup === "function") cleanup();
      if (overlayRef.current && pluginRef.current) {
        pluginRef.current.deleteOverlay(overlayRef.current);
        overlayRef.current = null;
        initDone.current = false;
      }
    };
  }, []);

  // Update overlay when parcels data changes (e.g. drawn parcels added)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const styledGeoJSON = applyFeatureStyles(parcels, hoveredId, selectedId);
    (overlay as any).geojson = styledGeoJSON; // eslint-disable-line @typescript-eslint/no-explicit-any
    (overlay as any).redraw(); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [parcels.features.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update styles when hover or selection changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const styledGeoJSON = applyFeatureStyles(parcels, hoveredId, selectedId);
    // Type defs are incomplete — geojson setter and redraw() exist at runtime
    (overlay as any).geojson = styledGeoJSON; // eslint-disable-line @typescript-eslint/no-explicit-any
    (overlay as any).redraw(); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, [hoveredId, selectedId]);

  return (
    <TilesPlugin
      plugin={ImageOverlayPlugin}
      args={pluginArgs}
      ref={pluginRef}
    />
  );
}

/**
 * Returns a copy of the GeoJSON with per-feature strokeStyle/fillStyle
 * based on hover and selection state.
 */
function applyFeatureStyles(
  parcels: ParcelCollection,
  hoveredId: string | null,
  selectedId: string | null,
) {
  return {
    ...parcels,
    features: parcels.features.map((feature) => {
      const id = feature.properties.id;
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;

      let fillStyle = PARCEL_COLORS.fill;
      let strokeStyle = PARCEL_COLORS.stroke;
      let strokeWidth = PARCEL_COLORS.strokeWidth;

      if (isSelected) {
        fillStyle = PARCEL_COLORS.fillSelected;
        strokeStyle = PARCEL_COLORS.strokeSelected;
        strokeWidth = PARCEL_COLORS.strokeWidthSelected;
      } else if (isHovered) {
        fillStyle = PARCEL_COLORS.fillHover;
        strokeStyle = PARCEL_COLORS.strokeHover;
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          fillStyle,
          strokeStyle,
          strokeWidth,
        },
      };
    }),
  };
}
