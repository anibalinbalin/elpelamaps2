"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Raycaster,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import { useParcelData } from "@/lib/use-parcel-data";
import { PARCEL_COLORS } from "@/lib/constants";
import { useParcelSelection } from "@/lib/use-parcel-selection";
import { useDrawTool } from "@/lib/use-draw-tool";
import { centroid, degToRad } from "@/lib/geo-utils";
import type { ParcelFeature } from "@/lib/parcels";
import { projectCartographicToTerrainPoint } from "@/lib/project-cartographic-to-terrain";
import { getTerrainDisplacementY } from "@/lib/mapbox-displacement-plugin";

const DRAW_PREVIEW_COLORS = {
  fill: { color: "#00ffb4", opacity: 0.18 },
  stroke: { color: "#00ffb4", opacity: 1 },
  strokeWidth: 3,
  pointRadius: 7,
} as const;

const PARCEL_LIFT = 0.9;
const PREVIEW_LIFT = 1.4;
const PROJECTION_INTERVAL_SECONDS = 0.25;
const SIGNATURE_PRECISION = 10;
const EMPTY_PREVIEW: PreviewProjection = {
  polygon: null,
  linePoints: [],
  vertexPoints: [],
};

interface ParcelLayerProps {
  tilesRef: React.RefObject<any>;
}

interface RenderColor {
  color: string;
  opacity: number;
}

interface ProjectedParcel {
  id: string;
  fill: RenderColor;
  stroke: RenderColor;
  strokeWidth: number;
  fillPositions: number[];
  outlinePoints: [number, number, number][];
}

interface PreviewProjection {
  polygon: ProjectedParcel | null;
  linePoints: [number, number, number][];
  vertexPoints: [number, number, number][];
}

interface ProjectionState {
  parcels: ProjectedParcel[];
  preview: PreviewProjection;
}

export function ParcelLayer({ tilesRef }: ParcelLayerProps) {
  const parcels = useParcelData({ includeDraftParcels: true });
  const hoveredId = useParcelSelection((s) => s.hoveredId);
  const selectedId = useParcelSelection((s) => s.selectedId);
  const editingParcel = useDrawTool((s) => s.editingParcel);
  const vertices = useDrawTool((s) => s.vertices);
  const [projectionState, setProjectionState] = useState<ProjectionState>({
    parcels: [],
    preview: EMPTY_PREVIEW,
  });
  const lastUpdate = useRef(0);
  const lastSignature = useRef(0);

  const raycaster = useMemo(() => {
    const instance = new Raycaster();
    (instance as any).firstHitOnly = true;
    return instance;
  }, []);
  const localSurface = useMemo(() => new Vector3(), []);
  const localNormal = useMemo(() => new Vector3(), []);
  const rayOrigin = useMemo(() => new Vector3(), []);
  const rayDirection = useMemo(() => new Vector3(), []);
  const projectedPoint = useMemo(() => new Vector3(), []);
  const inverseMatrix = useMemo(() => new Matrix4(), []);
  const worldPoint = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdate.current < PROJECTION_INTERVAL_SECONDS) {
      return;
    }
    lastUpdate.current = now;

    const tiles = tilesRef.current;
    if (!tiles?.ellipsoid?.getCartographicToPosition || !tiles?.group) {
      return;
    }

    const visibleParcels = editingParcel
      ? parcels.features.filter(
          (feature) => feature.properties.id !== editingParcel.properties.id,
        )
      : parcels.features;

    const projectedParcels = visibleParcels
      .map((feature) =>
        projectParcelPolygon({
          feature,
          tiles,
          raycaster,
          hoveredId,
          selectedId,
          lift: PARCEL_LIFT,
          buffers: {
            localSurface,
            localNormal,
            rayOrigin,
            rayDirection,
            projectedPoint,
            inverseMatrix,
            worldPoint,
          },
        }),
      )
      .filter(Boolean) as ProjectedParcel[];

    const preview = projectPreview({
      tiles,
      vertices,
      editingParcel,
      raycaster,
      buffers: {
        localSurface,
        localNormal,
        rayOrigin,
        rayDirection,
        projectedPoint,
        inverseMatrix,
        worldPoint,
      },
    });

    const nextState = {
      parcels: projectedParcels,
      preview,
    };
    const signature = buildProjectionSignature(nextState);
    if (signature === lastSignature.current) {
      return;
    }

    lastSignature.current = signature;
    setProjectionState(nextState);
  });

  return (
    <group>
      {projectionState.parcels.map((parcel) => (
        <ProjectedParcelMesh key={parcel.id} parcel={parcel} />
      ))}
      {projectionState.preview.polygon ? (
        <ProjectedParcelMesh
          key={projectionState.preview.polygon.id}
          parcel={projectionState.preview.polygon}
        />
      ) : null}
      {projectionState.preview.linePoints.length >= 2 ? (
        <Line
          points={projectionState.preview.linePoints}
          color={DRAW_PREVIEW_COLORS.stroke.color}
          transparent
          opacity={DRAW_PREVIEW_COLORS.stroke.opacity}
          lineWidth={DRAW_PREVIEW_COLORS.strokeWidth}
          depthWrite={false}
          renderOrder={24}
        />
      ) : null}
      {projectionState.preview.vertexPoints.map((point, index) => (
        <mesh key={`preview-point-${index}`} position={point} renderOrder={25}>
          <sphereGeometry
            args={[
              DRAW_PREVIEW_COLORS.pointRadius,
              20,
              20,
            ]}
          />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ProjectedParcelMesh({ parcel }: { parcel: ProjectedParcel }) {
  const geometry = useMemo(() => {
    const bufferGeometry = new BufferGeometry();
    bufferGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(parcel.fillPositions, 3),
    );
    bufferGeometry.computeVertexNormals();
    return bufferGeometry;
  }, [parcel.fillPositions]);
  const outlinePoints = useMemo(() => {
    if (parcel.outlinePoints.length === 0) {
      return [];
    }

    return [...parcel.outlinePoints, parcel.outlinePoints[0]];
  }, [parcel.outlinePoints]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <>
      {parcel.fillPositions.length >= 9 ? (
        <mesh geometry={geometry} renderOrder={20}>
          <meshBasicMaterial
            color={parcel.fill.color}
            transparent
            opacity={parcel.fill.opacity}
            side={DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      {parcel.outlinePoints.length >= 2 ? (
        <Line
          points={outlinePoints}
          color={parcel.stroke.color}
          transparent
          opacity={parcel.stroke.opacity}
          lineWidth={parcel.strokeWidth}
          depthWrite={false}
          renderOrder={21}
        />
      ) : null}
    </>
  );
}

interface ProjectionBuffers {
  localSurface: Vector3;
  localNormal: Vector3;
  rayOrigin: Vector3;
  rayDirection: Vector3;
  projectedPoint: Vector3;
  inverseMatrix: Matrix4;
  worldPoint: Vector3;
}

function projectPreview({
  tiles,
  vertices,
  editingParcel,
  raycaster,
  buffers,
}: {
  tiles: any;
  vertices: [number, number][];
  editingParcel: ParcelFeature | null;
  raycaster: Raycaster;
  buffers: ProjectionBuffers;
}): PreviewProjection {
  if (vertices.length === 0) {
    return EMPTY_PREVIEW;
  }

  const vertexPoints = projectRingVertices(
    vertices,
    tiles,
    raycaster,
    PREVIEW_LIFT,
    buffers,
  );

  return {
    polygon:
      vertices.length >= 3
        ? buildProjectedParcel({
            id: editingParcel?.properties.id ?? "__draw-preview__",
            ring: vertices,
            fill: DRAW_PREVIEW_COLORS.fill,
            stroke: DRAW_PREVIEW_COLORS.stroke,
            strokeWidth: DRAW_PREVIEW_COLORS.strokeWidth,
            tiles,
            raycaster,
            lift: PREVIEW_LIFT,
            buffers,
          })
        : null,
    linePoints: vertexPoints,
    vertexPoints,
  };
}

function projectParcelPolygon({
  feature,
  tiles,
  raycaster,
  hoveredId,
  selectedId,
  lift,
  buffers,
}: {
  feature: ParcelFeature;
  tiles: any;
  raycaster: Raycaster;
  hoveredId: string | null;
  selectedId: string | null;
  lift: number;
  buffers: ProjectionBuffers;
}) {
  const id = feature.properties.id;
  const style = getParcelStyle({
    id,
    hoveredId,
    selectedId,
  });

  return buildProjectedParcel({
    id,
    ring: feature.geometry.coordinates[0] as [number, number][],
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    tiles,
    raycaster,
    lift,
    buffers,
  });
}

function buildProjectedParcel({
  id,
  ring,
  fill,
  stroke,
  strokeWidth,
  tiles,
  raycaster,
  lift,
  buffers,
}: {
  id: string;
  ring: [number, number][];
  fill: RenderColor;
  stroke: RenderColor;
  strokeWidth: number;
  tiles: any;
  raycaster: Raycaster;
  lift: number;
  buffers: ProjectionBuffers;
}): ProjectedParcel | null {
  const contour = getOpenRing(ring);
  if (contour.length < 3) {
    return null;
  }

  const outlinePoints = projectRingVertices(
    contour,
    tiles,
    raycaster,
    lift,
    buffers,
  );
  if (outlinePoints.length < 3) {
    return null;
  }

  // Use geodetic coordinates for triangulation — stable regardless of terrain
  // slope or elevation exaggeration. Only the triangle indices matter here;
  // actual 3D positions come from outlinePoints.
  const [cx, cy] = centroid(contour);
  const contour2D = contour.map(
    ([lon, lat]) => new Vector2(lon - cx, lat - cy),
  );
  const triangles = ShapeUtils.triangulateShape(contour2D, []);
  const fillPositions: number[] = [];

  for (const triangle of triangles) {
    for (const vertexIndex of triangle) {
      const point = outlinePoints[vertexIndex];
      fillPositions.push(point[0], point[1], point[2]);
    }
  }

  return {
    id,
    fill,
    stroke,
    strokeWidth,
    fillPositions,
    outlinePoints,
  };
}

function projectRingVertices(
  ring: [number, number][],
  tiles: any,
  raycaster: Raycaster,
  lift: number,
  buffers: ProjectionBuffers,
) {
  const points: [number, number, number][] = [];

  for (const [lon, lat] of ring) {
    projectCartographicToTerrainPoint({
      tiles,
      latRad: degToRad(lat),
      lonRad: degToRad(lon),
      raycaster,
      buffers: {
        localSurface: buffers.localSurface,
        localNormal: buffers.localNormal,
        rayOrigin: buffers.rayOrigin,
        rayDirection: buffers.rayDirection,
        inverseMatrix: buffers.inverseMatrix,
      },
      target: buffers.projectedPoint,
      outputSpace: "local",
    });

    // Match the GPU terrain displacement so parcels sit on the visual surface
    buffers.worldPoint
      .copy(buffers.projectedPoint)
      .applyMatrix4(tiles.group.matrixWorld);
    buffers.projectedPoint.y += getTerrainDisplacementY(
      buffers.worldPoint.x,
      buffers.worldPoint.z,
    );

    buffers.projectedPoint.addScaledVector(buffers.localNormal, lift);
    points.push([
      buffers.projectedPoint.x,
      buffers.projectedPoint.y,
      buffers.projectedPoint.z,
    ]);
  }

  return points;
}


function getOpenRing(ring: [number, number][]) {
  if (ring.length === 0) {
    return [];
  }

  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];
  if (firstLon === lastLon && firstLat === lastLat) {
    return ring.slice(0, -1);
  }

  return ring;
}

// Pre-parse constant colors once at module load instead of regex-parsing every 0.25s
const PARSED_STYLES = {
  default: {
    fill: parseRgbaColor(PARCEL_COLORS.fill),
    stroke: parseRgbaColor(PARCEL_COLORS.stroke),
    strokeWidth: PARCEL_COLORS.strokeWidth,
  },
  hovered: {
    fill: parseRgbaColor(PARCEL_COLORS.fillHover),
    stroke: parseRgbaColor(PARCEL_COLORS.strokeHover),
    strokeWidth: PARCEL_COLORS.strokeWidth,
  },
  selected: {
    fill: parseRgbaColor(PARCEL_COLORS.fillSelected),
    stroke: parseRgbaColor(PARCEL_COLORS.strokeSelected),
    strokeWidth: PARCEL_COLORS.strokeWidthSelected,
  },
} as const;

function getParcelStyle({
  id,
  hoveredId,
  selectedId,
}: {
  id: string;
  hoveredId: string | null;
  selectedId: string | null;
}) {
  if (id === selectedId) return PARSED_STYLES.selected;
  if (id === hoveredId) return PARSED_STYLES.hovered;
  return PARSED_STYLES.default;
}

function parseRgbaColor(value: string): RenderColor {
  const match = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );

  if (!match) {
    return { color: value, opacity: 1 };
  }

  const [, r, g, b, alpha] = match;
  const color =
    "#" +
    [r, g, b]
      .map((channel) =>
        Math.round(Number(channel)).toString(16).padStart(2, "0"),
      )
      .join("");

  return {
    color,
    opacity: alpha ? Number(alpha) : 1,
  };
}

/**
 * Fast numeric hash for change detection — replaces JSON.stringify which
 * was creating large intermediate strings + arrays every 0.25s.
 */
function buildProjectionSignature(state: ProjectionState) {
  let hash = 0;
  for (const parcel of state.parcels) {
    hash = hashParcel(hash, parcel);
  }
  if (state.preview.polygon) {
    hash = hashParcel(hash, state.preview.polygon);
  }
  for (const p of state.preview.linePoints) {
    hash = hashNumber(hashNumber(hashNumber(hash, p[0]), p[1]), p[2]);
  }
  return hash;
}

function hashParcel(hash: number, parcel: ProjectedParcel) {
  for (let i = 0; i < parcel.fillPositions.length; i++) {
    hash = hashNumber(hash, parcel.fillPositions[i]);
  }
  for (const p of parcel.outlinePoints) {
    hash = hashNumber(hashNumber(hashNumber(hash, p[0]), p[1]), p[2]);
  }
  return hash;
}

function hashNumber(hash: number, value: number) {
  const rounded = Math.round(value * SIGNATURE_PRECISION);
  // Simple integer hash (FNV-1a inspired)
  hash = (hash ^ rounded) | 0;
  hash = (hash + (hash << 3)) | 0;
  hash = (hash ^ (hash >> 7)) | 0;
  return hash;
}
