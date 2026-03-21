"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import { ImageOverlayPlugin, GeoJSONOverlay } from "3d-tiles-renderer/plugins";
import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import { useParcelData } from "@/lib/use-parcel-data";
import type { ParcelCollection, ParcelFeature, ParcelProperties } from "@/lib/parcels";
import { PARCEL_COLORS } from "@/lib/constants";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { useDrawTool } from "@/lib/use-draw-tool";
import { sphericalArea } from "@/lib/geo-area";

const DRAW_PREVIEW_COLORS = {
  fill: "rgba(0, 255, 180, 0.18)",
  stroke: "#00ffb4",
  strokeWidth: 4,
} as const;
const DRAW_HANDLE_STYLE = {
  fillStyle: "white",
  strokeStyle: "#00ffb4",
  strokeWidth: 3,
  pointRadius: 11,
} as const;

type OverlayGeometry = Polygon | LineString | Point;
type OverlayProperties = ParcelProperties & {
  fillStyle?: string;
  strokeStyle?: string;
  strokeWidth?: number;
  pointRadius?: number;
};
type OverlayFeature = Feature<OverlayGeometry, OverlayProperties>;
type OverlayCollection = FeatureCollection<OverlayGeometry, OverlayProperties>;

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
  const editingParcel = useDrawTool((s) => s.editingParcel);
  const vertices = useDrawTool((s) => s.vertices);
  const initDone = useRef(false);

  // Memoize args to prevent TilesPlugin from recreating the instance on re-render
  const pluginArgs = useMemo(() => [{ renderer: gl }], [gl]);
  const previewFeatures = useMemo(
    () => buildDrawPreviewFeatures(vertices, editingParcel),
    [vertices, editingParcel],
  );
  const styledGeoJSON = useMemo(() => {
    const features = editingParcel
      ? parcels.features.filter((f) => f.properties.id !== editingParcel.properties.id)
      : parcels.features;

    return applyFeatureStyles(
      {
        ...parcels,
        features: [...features, ...previewFeatures],
      },
      hoveredId,
      selectedId,
      editingParcel?.properties.id ?? (previewFeatures[0]?.properties.id ?? null),
    );
  }, [parcels, hoveredId, selectedId, editingParcel, previewFeatures]);

  // Create overlay once plugin is available — retry via useFrame-driven check
  // TilesPlugin sets pluginRef.current via useEffect, which may fire after our first useEffect
  useEffect(() => {
    if (initDone.current || overlayRef.current) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tryInit = () => {
      if (cancelled) return;

      const plugin = pluginRef.current;
      if (!plugin || !plugin.addOverlay) {
        // Plugin not ready yet, retry shortly
        timer = setTimeout(tryInit, 100);
        return;
      }

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
      plugin._markNeedsUpdate?.();
    };

    tryInit();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (overlayRef.current && pluginRef.current) {
        pluginRef.current.deleteOverlay(overlayRef.current);
        overlayRef.current = null;
        initDone.current = false;
      }
    };
  }, [gl]);

  // Update overlay when parcel geometry or styles change.
  useEffect(() => {
    const overlay = overlayRef.current;
    const plugin = pluginRef.current;
    if (!overlay) return;

    (overlay as any).geojson = styledGeoJSON; // eslint-disable-line @typescript-eslint/no-explicit-any
    (overlay as any).redraw(); // eslint-disable-line @typescript-eslint/no-explicit-any
    plugin?._markNeedsUpdate?.();
    plugin?.tiles?.dispatchEvent?.({ type: "needs-update" });
  }, [styledGeoJSON]);

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
  parcels: OverlayCollection,
  hoveredId: string | null,
  selectedId: string | null,
  previewId: string | null,
) {
  return {
    ...parcels,
    features: parcels.features.map((feature) => {
      if (feature.geometry.type !== "Polygon") {
        return feature;
      }

      const id = feature.properties.id;
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      const isPreview = id === previewId;

      let fillStyle = PARCEL_COLORS.fill;
      let strokeStyle = PARCEL_COLORS.stroke;
      let strokeWidth = PARCEL_COLORS.strokeWidth;

      if (isPreview) {
        fillStyle = DRAW_PREVIEW_COLORS.fill;
        strokeStyle = DRAW_PREVIEW_COLORS.stroke;
        strokeWidth = DRAW_PREVIEW_COLORS.strokeWidth;
      } else if (isSelected) {
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

function buildDrawPreviewFeatures(
  vertices: [number, number][],
  editingParcel: ParcelFeature | null,
): OverlayFeature[] {
  if (vertices.length === 0) {
    return [];
  }

  const baseProperties: OverlayProperties = {
    ...(editingParcel?.properties ?? {}),
    id: editingParcel?.properties.id ?? "__draw-preview__",
    name: editingParcel?.properties.name ?? "Preview Parcel",
    areaSqMeters:
      vertices.length >= 3
        ? Math.round(sphericalArea([...vertices, vertices[0]] as [number, number][]))
        : editingParcel?.properties.areaSqMeters ?? 0,
  };

  const features: OverlayFeature[] = vertices.map((vertex, index) => ({
    type: "Feature",
    properties: {
      ...baseProperties,
      id: `${baseProperties.id}__vertex_${index}`,
      ...DRAW_HANDLE_STYLE,
    },
    geometry: {
      type: "Point",
      coordinates: vertex,
    },
  }));

  if (vertices.length >= 2) {
    features.unshift({
      type: "Feature",
      properties: {
        ...baseProperties,
        id: `${baseProperties.id}__line`,
        fillStyle: "rgba(0, 0, 0, 0)",
        strokeStyle: DRAW_PREVIEW_COLORS.stroke,
        strokeWidth: 3,
      },
      geometry: {
        type: "LineString",
        coordinates: vertices,
      },
    });
  }

  if (vertices.length >= 3) {
    features.unshift({
      type: "Feature",
      properties: {
        ...baseProperties,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...vertices, vertices[0]]],
      },
    });
  }

  return features;
}
