"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import {
  Geoman,
  SOURCES,
  type FeatureData,
  type GeoJsonImportFeatureCollection,
  type GeoJsonShapeFeature,
  type GmOptionsPartial,
} from "@geoman-io/maplibre-geoman-free";
import type {
  FeatureCollection,
  Geometry,
  LineString,
  Point,
  Polygon,
} from "geojson";

import { EditorAccessDialog } from "@/components/editor-access-dialog";
import { hasEditorAccess, grantEditorAccess } from "@/lib/editor-access";
import { sphericalArea } from "@/lib/geo-area";
import { formatAreaCompact, distanceMeters } from "@/lib/geo-utils";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";
import type { FeatureType, ParcelCollection, ParcelFeature } from "@/lib/parcels";
import {
  geomanCollectionToParcels,
  parcelCollectionToGeoman,
} from "@/lib/parcel-serialization";
import { Input, Button } from "@/components/ui";

type ParcelStatus = "for-sale" | "reserved" | "sold";
type SaveState = "idle" | "saving" | "saved" | "error" | "unsaved";

interface FeatureMeta {
  id: string;
  parcelId: string;
  name: string;
  featureType: FeatureType;
  geometryType: "Polygon" | "LineString" | "Point";
  areaSqMeters: number;
  readout: string;
  status?: ParcelStatus;
  priceUSD?: number;
  zoning?: string;
  label?: string;
  contactUrl?: string;
  description?: string;
  roadWidth?: number;
  smoothed?: boolean;
  originalCoords?: number[][][];
  canopyRadius?: number;
  height?: number;
  floors?: number;
}

interface OverlayTransform {
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  visible: boolean;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const OVERLAY_STORAGE_KEY = "parcelpin:masterplan-overlay";

const SELECTION_FILL_LAYER = "parcelpin-selection-fill";
const SELECTION_LINE_LAYER = "parcelpin-selection-line";
const SELECTION_CIRCLE_LAYER = "parcelpin-selection-circle";
const SELECTION_NONE_FILTER: ["==", string, string] = ["==", "id", ""];

const DEFAULT_OVERLAY: OverlayTransform = {
  opacity: 0.55,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  visible: true,
};

const FEATURE_STYLES: Record<FeatureType, { fill: string; stroke: string; opacity: number }> = {
  parcel: { fill: "#fff7d8", stroke: "#fff7d8", opacity: 0.14 },
  road: { fill: "#d8c194", stroke: "#e0c994", opacity: 0.18 },
  amenity: { fill: "#8bcf92", stroke: "#8bcf92", opacity: 0.22 },
  water: { fill: "#2f9bea", stroke: "#5bb6ff", opacity: 0.28 },
  greenspace: { fill: "#58b86b", stroke: "#7edc8d", opacity: 0.2 },
  tree: { fill: "#2f8b43", stroke: "#8ee09b", opacity: 0.78 },
  building: { fill: "#b8b8b8", stroke: "#eeeeee", opacity: 0.22 },
  sidewalk: { fill: "#ddd2bd", stroke: "#f0dfbf", opacity: 0.2 },
};

const FEATURE_TYPE_DEFAULTS: Record<FeatureType, Partial<FeatureMeta>> = {
  parcel: { status: "for-sale" },
  road: { roadWidth: 6 },
  amenity: {},
  water: {},
  greenspace: {},
  tree: { canopyRadius: 4, height: 6 },
  building: { height: 6, floors: 1 },
  sidewalk: { roadWidth: 1.5 },
};

const FEATURE_TYPE_OPTIONS: FeatureType[] = [
  "parcel",
  "road",
  "water",
  "greenspace",
  "sidewalk",
  "tree",
  "building",
  "amenity",
];

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  parcel: "lots",
  road: "roads",
  amenity: "amenities",
  water: "water",
  greenspace: "green space",
  tree: "trees",
  building: "buildings",
  sidewalk: "sidewalks",
};

const STATUS_STYLES = {
  reserved: { fill: "#fbbf24", stroke: "#fbbf24", opacity: 0.22 },
  sold: { fill: "#60a5fa", stroke: "#60a5fa", opacity: 0.16 },
  clubhouse: { fill: "#c084fc", stroke: "#c084fc", opacity: 0.22 },
};

const isClubhouse = ["any",
  ["==", ["get", "label"], "CH"],
  ["in", "Club", ["get", "name"]],
];

const FEATURE_COLOR = [
  "case",
  isClubhouse, STATUS_STYLES.clubhouse.stroke,
  ["==", ["get", "status"], "reserved"], STATUS_STYLES.reserved.stroke,
  ["==", ["get", "status"], "sold"], STATUS_STYLES.sold.stroke,
  ["match", ["get", "featureType"],
    "parcel", FEATURE_STYLES.parcel.stroke,
    "road", FEATURE_STYLES.road.stroke,
    "amenity", FEATURE_STYLES.amenity.stroke,
    "water", FEATURE_STYLES.water.stroke,
    "greenspace", FEATURE_STYLES.greenspace.stroke,
    "tree", FEATURE_STYLES.tree.stroke,
    "building", FEATURE_STYLES.building.stroke,
    "sidewalk", FEATURE_STYLES.sidewalk.stroke,
    "#ffffff",
  ],
] as unknown as string;

const FEATURE_FILL = [
  "case",
  isClubhouse, STATUS_STYLES.clubhouse.fill,
  ["==", ["get", "status"], "reserved"], STATUS_STYLES.reserved.fill,
  ["==", ["get", "status"], "sold"], STATUS_STYLES.sold.fill,
  ["match", ["get", "featureType"],
    "parcel", FEATURE_STYLES.parcel.fill,
    "road", FEATURE_STYLES.road.fill,
    "amenity", FEATURE_STYLES.amenity.fill,
    "water", FEATURE_STYLES.water.fill,
    "greenspace", FEATURE_STYLES.greenspace.fill,
    "tree", FEATURE_STYLES.tree.fill,
    "building", FEATURE_STYLES.building.fill,
    "sidewalk", FEATURE_STYLES.sidewalk.fill,
    "#ffffff",
  ],
] as unknown as string;

const FEATURE_FILL_OPACITY = [
  "case",
  isClubhouse, STATUS_STYLES.clubhouse.opacity,
  ["==", ["get", "status"], "reserved"], STATUS_STYLES.reserved.opacity,
  ["==", ["get", "status"], "sold"], STATUS_STYLES.sold.opacity,
  ["match", ["get", "featureType"],
    "parcel", FEATURE_STYLES.parcel.opacity,
    "amenity", FEATURE_STYLES.amenity.opacity,
    "water", FEATURE_STYLES.water.opacity,
    "greenspace", FEATURE_STYLES.greenspace.opacity,
    "building", FEATURE_STYLES.building.opacity,
    0.16,
  ],
] as unknown as number;

const GEOMAN_LAYER_STYLES: GmOptionsPartial["layerStyles"] = {
  polygon: {
    [SOURCES.main]: [
      { type: "fill", paint: { "fill-color": FEATURE_FILL, "fill-opacity": FEATURE_FILL_OPACITY } },
      { type: "line", paint: { "line-color": FEATURE_COLOR, "line-opacity": 0.95, "line-width": 2 } },
    ],
    [SOURCES.temporary]: [
      { type: "fill", paint: { "fill-color": FEATURE_FILL, "fill-opacity": 0.22 } },
      { type: "line", paint: { "line-color": "#ffffff", "line-opacity": 0.95, "line-width": 2.5 } },
    ],
    [SOURCES.internal]: [],
  },
  line: {
    [SOURCES.main]: [
      {
        type: "line",
        paint: {
          "line-color": FEATURE_COLOR,
          "line-opacity": 0.9,
          "line-width": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "roadWidth"]], 4],
            1, 2,
            6, 5,
            12, 9,
          ],
        },
      },
    ],
    [SOURCES.temporary]: [
      { type: "line", paint: { "line-color": "#ffffff", "line-opacity": 0.95, "line-width": 4 } },
    ],
    [SOURCES.internal]: [],
  },
  marker: {
    [SOURCES.main]: [
      {
        type: "circle",
        paint: {
          "circle-color": FEATURE_FILL,
          "circle-opacity": 0.72,
          "circle-stroke-color": FEATURE_COLOR,
          "circle-stroke-width": 1.5,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "canopyRadius"]], 4],
            1, 5,
            4, 9,
            12, 18,
          ],
        },
      },
    ],
    [SOURCES.temporary]: [
      { type: "circle", paint: { "circle-color": "#ffffff", "circle-radius": 7, "circle-opacity": 0.9 } },
    ],
    [SOURCES.internal]: [],
  },
};

function createMapStyle(): StyleSpecification {
  const source = MAPBOX_TOKEN
    ? {
        type: "raster" as const,
        tiles: [
          `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
        ],
        tileSize: 512,
        maxzoom: 20,
        attribution: "Mapbox",
      }
    : {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Esri",
      };

  return {
    version: 8,
    sources: { satellite: source },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  };
}

function loadOverlayTransform(): OverlayTransform {
  if (typeof window === "undefined") return DEFAULT_OVERLAY;
  try {
    const raw = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
    return raw ? { ...DEFAULT_OVERLAY, ...JSON.parse(raw) } : DEFAULT_OVERLAY;
  } catch {
    return DEFAULT_OVERLAY;
  }
}

function polygonArea(geometry: Geometry): number {
  if (geometry.type === "Polygon") {
    const ring = (geometry as Polygon).coordinates[0] as [number, number][] | undefined;
    return ring ? sphericalArea(ring) : 0;
  }
  if (geometry.type === "MultiPolygon") {
    const coords = (geometry as { coordinates: number[][][][] }).coordinates;
    if (coords.length === 1) {
      const ring = coords[0][0] as [number, number][] | undefined;
      return ring ? sphericalArea(ring) : 0;
    }
  }
  return 0;
}

function lineLength(geometry: Geometry): number {
  if (geometry.type !== "LineString") return 0;
  const coords = (geometry as LineString).coordinates as [number, number][];
  let meters = 0;
  for (let i = 1; i < coords.length; i++) {
    meters += distanceMeters(coords[i - 1], coords[i]);
  }
  return meters;
}

function featureReadout(feature: ParcelFeature): string {
  if (feature.geometry.type === "LineString") {
    return `${Math.round(lineLength(feature.geometry)).toLocaleString("en-US")} m`;
  }
  if (feature.geometry.type === "Point") {
    const coords = (feature.geometry as Point).coordinates;
    return `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
  }
  return formatAreaCompact(feature.properties.areaSqMeters);
}

function featureToMeta(feature: ParcelFeature): FeatureMeta {
  return {
    id: feature.properties.id,
    parcelId: feature.properties.id,
    name: feature.properties.name,
    featureType: feature.properties.featureType ?? "parcel",
    geometryType: feature.geometry.type,
    areaSqMeters: feature.properties.areaSqMeters,
    readout: featureReadout(feature),
    status: feature.properties.status,
    priceUSD: feature.properties.priceUSD,
    zoning: feature.properties.zoning,
    label: feature.properties.label,
    contactUrl: feature.properties.contactUrl,
    description: feature.properties.description,
    roadWidth: feature.properties.roadWidth,
    smoothed: feature.properties.smoothed,
    originalCoords: feature.properties.originalCoords,
    canopyRadius: feature.properties.canopyRadius,
    height: feature.properties.height,
    floors: feature.properties.floors,
  };
}

function geomanFeatureId(feature: GeoJsonShapeFeature): string {
  return String(feature.id ?? feature.properties?.__gm_id ?? feature.properties?.id);
}

function geomanFeatureToMeta(feature: GeoJsonShapeFeature): FeatureMeta | null {
  const collection = geomanCollectionToParcels({
    type: "FeatureCollection",
    features: [feature],
  } as FeatureCollection<Geometry>);
  const parcel = collection.features[0];
  if (!parcel) return null;
  return {
    ...featureToMeta(parcel),
    id: geomanFeatureId(feature),
    parcelId: parcel.properties.id,
  };
}

function chaikinSmooth(coords: number[][], iterations = 3): number[][] {
  let points = coords;
  for (let i = 0; i < iterations; i++) {
    const next: number[][] = [];
    for (let j = 0; j < points.length - 1; j++) {
      const p0 = points[j];
      const p1 = points[j + 1];
      next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    points = next;
  }
  return points;
}

function smoothPolygonCoords(rings: number[][][]): number[][][] {
  return rings.map((ring) => {
    const open = ring.slice(0, -1);
    const smoothed = chaikinSmooth(open);
    smoothed.push(smoothed[0]);
    return smoothed;
  });
}

function syncFeatureAreaPatch(geometry: Geometry): Record<string, unknown> {
  return {
    areaSqMeters: polygonArea(geometry),
    smoothed: false,
    originalCoords: undefined,
  };
}

function defaultFeatureTypeForGeometry(geometry: Geometry): FeatureType {
  if (geometry.type === "LineString") return "road";
  if (geometry.type === "Point") return "tree";
  return "parcel";
}

function isFeatureType(value: unknown): value is FeatureType {
  return typeof value === "string" && FEATURE_TYPE_OPTIONS.includes(value as FeatureType);
}

function prefixForFeatureType(featureType: FeatureType): string {
  if (featureType === "parcel") return "Lot";
  if (featureType === "greenspace") return "Green Space";
  return FEATURE_TYPE_LABELS[featureType].replace(/s$/, "").replace(/^\w/, (c) => c.toUpperCase());
}

function nextNameForFeatureType(featureType: FeatureType, existingNames: string[]): string {
  const prefix = prefixForFeatureType(featureType);
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`, "i");
  let max = 0;
  for (const name of existingNames) {
    const m = name.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix} ${max + 1}`;
}

function featureTypeOptionsForGeometry(geometryType: FeatureMeta["geometryType"]): FeatureType[] {
  if (geometryType === "LineString") return ["road", "sidewalk"];
  if (geometryType === "Point") return ["tree"];
  return ["parcel", "water", "greenspace", "building", "amenity"];
}

export function EditorV2() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geomanRef = useRef<Geoman | null>(null);
  const createCountRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const syncFeaturesRef = useRef<() => void>(() => {});
  const markDirtyRef = useRef<() => void>(() => {});
  const syncEditabilityRef = useRef<(activeId: string | null) => void>(() => {});

  const [access, setAccess] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureMeta[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [overlay, setOverlay] = useState<OverlayTransform>(() => DEFAULT_OVERLAY);

  useEffect(() => {
    setAccess(hasEditorAccess());
    setOverlay(loadOverlayTransform());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
    }
  }, [overlay]);

  const normalizeFeatureData = useCallback(
    async (feature: FeatureData, existingNames: string[]) => {
      const geoJson = feature.getGeoJson();
      const props = geoJson.properties ?? {};
      const id = String(props.id ?? feature.id);
      const featureType = isFeatureType(props.featureType)
        ? props.featureType
        : defaultFeatureTypeForGeometry(geoJson.geometry);
      const defaults = FEATURE_TYPE_DEFAULTS[featureType];
      const name = typeof props.name === "string" && props.name.trim()
        ? props.name
        : nextNameForFeatureType(featureType, existingNames);

      const safeDefaults: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(defaults)) {
        if (props[k] === undefined || props[k] === null) safeDefaults[k] = v;
      }
      await feature.updateProperties({
        ...safeDefaults,
        id,
        name,
        featureType,
        areaSqMeters: polygonArea(geoJson.geometry),
      });
    },
    [],
  );

  const normalizeAllFeatures = useCallback(async () => {
    const geoman = geomanRef.current;
    if (!geoman) return;
    const collection = geoman.features.exportGeoJson() as FeatureCollection<Geometry>;
    const allNames = collection.features
      .map((f) => (f.properties as Record<string, unknown>)?.name)
      .filter((n): n is string => typeof n === "string");
    for (const item of collection.features) {
      const feature = geoman.features.get(SOURCES.main, geomanFeatureId(item as GeoJsonShapeFeature));
      if (!feature) continue;
      await normalizeFeatureData(feature, allNames);
    }
    await geoman.features.updateManager.waitForPendingUpdates(SOURCES.main);
  }, [normalizeFeatureData]);

  const exportParcels = useCallback(async (): Promise<ParcelCollection> => {
    const geoman = geomanRef.current;
    if (!geoman) return { type: "FeatureCollection", features: [] };
    await normalizeAllFeatures();
    const exported = geoman.features.exportGeoJson() as FeatureCollection<Geometry>;
    return geomanCollectionToParcels(exported);
  }, [normalizeAllFeatures]);

  const exportGeomanCollection = useCallback((): FeatureCollection<Geometry> => {
    const geoman = geomanRef.current;
    if (!geoman) return { type: "FeatureCollection", features: [] };
    return geoman.features.exportGeoJson() as FeatureCollection<Geometry>;
  }, []);

  const syncFeatures = useCallback(() => {
    const collection = exportGeomanCollection();
    const metas = collection.features
      .map((feature) => geomanFeatureToMeta(feature as GeoJsonShapeFeature))
      .filter((feature): feature is FeatureMeta => Boolean(feature));
    setFeatures(metas);
    setSelectedId((current) => {
      if (!current) return current;
      return metas.some((feature) => feature.id === current) ? current : null;
    });
  }, [exportGeomanCollection]);

  const save = useCallback(async () => {
    savingRef.current = true;
    setSaveState("saving");
    try {
      const collection = await exportParcels();
      const res = await fetch("/api/parcels?mode=replace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collection),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) window.setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 2000);
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }, [exportParcels]);

  const markDirty = useCallback(() => {
    if (savingRef.current) return;
    setSaveState("unsaved");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void save(), 800);
  }, [save]);

  const syncEditability = useCallback(async (activeId: string | null) => {
    const geoman = geomanRef.current;
    if (!geoman) return;
    const collection = geoman.features.exportGeoJson() as FeatureCollection<Geometry>;
    for (const item of collection.features) {
      const id = geomanFeatureId(item as GeoJsonShapeFeature);
      const feature = geoman.features.get(SOURCES.main, id);
      if (feature) {
        await feature.setShapeProperty("disableEdit", id !== activeId);
      }
    }
    await geoman.disableGlobalEditMode();
    await geoman.enableGlobalEditMode();
  }, []);

  syncFeaturesRef.current = syncFeatures;
  markDirtyRef.current = markDirty;
  syncEditabilityRef.current = syncEditability;

  const selectFeatureById = useCallback(async (id: string) => {
    const geoman = geomanRef.current;
    const map = mapRef.current;
    if (!geoman) return;
    geoman.features.setSelection([id]);
    setSelectedId(id);
    syncEditability(id);
    const geomanFeature = exportGeomanCollection().features.find(
      (item) => geomanFeatureId(item as GeoJsonShapeFeature) === id,
    );
    const feature = geomanFeature
      ? geomanCollectionToParcels({
          type: "FeatureCollection",
          features: [geomanFeature],
        } as FeatureCollection<Geometry>).features[0]
      : null;
    if (!feature || feature.geometry.type === "Point" || !map) return;
    const coords =
      feature.geometry.type === "LineString"
        ? feature.geometry.coordinates
        : feature.geometry.coordinates[0];
    const bounds = coords.reduce(
      (lngLatBounds, coord) => lngLatBounds.extend(coord as [number, number]),
      new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
    );
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 80, maxZoom: 18, duration: 400 });
  }, [exportGeomanCollection, syncEditability]);

  const updateFeatureProps = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const feature = geomanRef.current?.features.get(SOURCES.main, id);
      if (!feature) return;
      await feature.updateProperties(patch);
      syncFeatures();
      markDirty();
    },
    [syncFeatures, markDirty],
  );

  const deleteFeature = useCallback(
    async (id: string) => {
      await geomanRef.current?.features.delete(id);
      setSelectedId(null);
      syncFeatures();
      markDirty();
    },
    [syncFeatures, markDirty],
  );

  const toggleSmooth = useCallback(
    async (id: string) => {
      const feature = geomanRef.current?.features.get(SOURCES.main, id);
      if (!feature) return;
      const geoJson = feature.getGeoJson();
      const props = geoJson.properties ?? {};
      const geometry = geoJson.geometry;

      if (geometry.type !== "Polygon" && geometry.type !== "LineString") return;

      if (props.smoothed && Array.isArray(props.originalCoords)) {
        const coordinates =
          geometry.type === "Polygon"
            ? props.originalCoords
            : (props.originalCoords[0] as number[][]);
        await feature.updateGeometry({ ...geometry, coordinates });
        await feature.updateProperties({
          ...syncFeatureAreaPatch({ ...geometry, coordinates } as Geometry),
        });
      } else if (geometry.type === "Polygon") {
        const originalCoords = (geometry as Polygon).coordinates as number[][][];
        const coordinates = smoothPolygonCoords(originalCoords);
        await feature.updateGeometry({ ...geometry, coordinates });
        await feature.updateProperties({
          areaSqMeters: polygonArea({ ...geometry, coordinates } as Polygon),
          smoothed: true,
          originalCoords,
        });
      } else {
        const originalCoords = [(geometry as LineString).coordinates as number[][]];
        const coordinates = chaikinSmooth(originalCoords[0]);
        await feature.updateGeometry({ ...geometry, coordinates });
        await feature.updateProperties({ smoothed: true, originalCoords });
      }
      syncFeatures();
      markDirty();
    },
    [syncFeatures, markDirty],
  );

  useEffect(() => {
    if (!access || !mapDivRef.current) return;

    let cancelled = false;
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: createMapStyle(),
      center: [JOSE_IGNACIO_CENTER.lon, JOSE_IGNACIO_CENTER.lat],
      zoom: 15,
      minZoom: 12,
      maxZoom: 20,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.once("load", async () => {
      if (cancelled) return;

      const geoman = new Geoman(map, {
        settings: {
          useControlsUi: true,
          controlsUiEnabledByDefault: true,
          controlsPosition: "top-left",
          awaitDataUpdatesOnEvents: true,
          idGenerator: (shapeGeoJson) => {
            createCountRef.current += 1;
            return `${defaultFeatureTypeForGeometry(shapeGeoJson.geometry)}-${Date.now()}-${createCountRef.current}`;
          },
        },
        layerStyles: GEOMAN_LAYER_STYLES,
      });
      geomanRef.current = geoman;
      await geoman.waitForGeomanLoaded();
      if (cancelled) return;

      try {
        const response = await fetch("/api/parcels", { cache: "no-store" });
        const data = (await response.json()) as ParcelCollection;
        await geoman.features.importGeoJson(parcelCollectionToGeoman(data) as GeoJsonImportFeatureCollection, {
          idPropertyName: "id",
          overwrite: true,
        });
        syncFeatures();
      } catch {
        syncFeatures();
      }

      const allFeatures = geoman.features.exportGeoJson() as FeatureCollection<Geometry>;
      for (const item of allFeatures.features) {
        const fid = geomanFeatureId(item as GeoJsonShapeFeature);
        const fd = geoman.features.get(SOURCES.main, fid);
        if (fd) await fd.setShapeProperty("disableEdit", true);
      }
      await geoman.enableGlobalEditMode();

      map.addLayer({
        id: SELECTION_FILL_LAYER,
        type: "fill",
        source: SOURCES.main,
        filter: SELECTION_NONE_FILTER,
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: SELECTION_LINE_LAYER,
        type: "line",
        source: SOURCES.main,
        filter: SELECTION_NONE_FILTER,
        paint: { "line-color": "#ffffff", "line-opacity": 1, "line-width": 3 },
      });
      map.addLayer({
        id: SELECTION_CIRCLE_LAYER,
        type: "circle",
        source: SOURCES.main,
        filter: SELECTION_NONE_FILTER,
        paint: {
          "circle-color": "#ffffff",
          "circle-opacity": 0.45,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
          "circle-radius": 10,
        },
      });

      geoman.setGlobalEventsListener((event) => {
        const action = (event as { action?: string }).action;

        if (action === "feature_created") {
          const e = event as { featureData?: FeatureData; feature?: FeatureData };
          const featureData = e.featureData ?? e.feature;
          if (!featureData) return;
          const id = String(featureData.id);
          syncFeaturesRef.current();
          setSelectedId(id);
          syncEditabilityRef.current(id);
          markDirtyRef.current();
          void (async () => {
            try {
              const allNames = (geoman.features.exportGeoJson() as FeatureCollection<Geometry>).features
                .map((f) => (f.properties as Record<string, unknown>)?.name)
                .filter((n): n is string => typeof n === "string");
              await normalizeFeatureData(featureData, allNames);
              await geoman.features.updateManager.waitForPendingUpdates(SOURCES.main);
              geoman.features.setSelection([id]);
            } catch { /* normalization is best-effort */ }
            setSelectedId(id);
            syncEditabilityRef.current(id);
            syncFeaturesRef.current();
            markDirtyRef.current();
          })();
          return;
        }

        if (action === "feature_removed") {
          setSelectedId(null);
          syncFeaturesRef.current();
          markDirtyRef.current();
          return;
        }

        if (action === "feature_updated") {
          syncFeaturesRef.current();
          markDirtyRef.current();
          return;
        }

        if (action === "feature_edit_end") {
          const feature = (event as { feature?: FeatureData }).feature;
          if (feature) {
            void feature.updateProperties(syncFeatureAreaPatch(feature.getGeoJson().geometry));
          }
          syncFeaturesRef.current();
          markDirtyRef.current();
          return;
        }

        if (action === "selection_change") {
          const selection = (event as { selection?: Array<string | number> }).selection ?? [];
          const newId = selection.length ? String(selection[0]) : null;
          setSelectedId(newId);
          syncEditabilityRef.current(newId);
        }
      });

      map.on("click", (event) => {
        if (geoman.getActiveDrawModes().length > 0) return;
        const point = event.point;
        const rendered = map
          .queryRenderedFeatures([
            [point.x - 6, point.y - 6],
            [point.x + 6, point.y + 6],
          ])
          .find((item) => item.source === SOURCES.main && (item.properties?.id || item.properties?.__gm_id));
        const id = rendered?.properties?.__gm_id ?? rendered?.properties?.id;
        if (id) {
          const featureId = String(id);
          geoman.features.setSelection([featureId]);
          setSelectedId(featureId);
          syncEditabilityRef.current(featureId);
        }
      });

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          void geoman.disableAllModes().then(() => {
            geoman.enableGlobalEditMode();
            syncEditabilityRef.current(null);
          });
        }
      };
      window.addEventListener("keydown", handleEscape);

      map.once("remove", () => {
        window.removeEventListener("keydown", handleEscape);
      });
    });

    return () => {
      cancelled = true;
      geomanRef.current?.destroy({ removeSources: true }).catch(() => {});
      geomanRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const filter: ["==", string, string] = selectedId
      ? ["==", "id", selectedId]
      : SELECTION_NONE_FILTER;
    for (const layer of [SELECTION_FILL_LAYER, SELECTION_LINE_LAYER, SELECTION_CIRCLE_LAYER]) {
      if (map.getLayer(layer)) map.setFilter(layer, filter);
    }
  }, [selectedId]);

  const selected = useMemo(
    () => features.find((feature) => feature.id === selectedId) ?? null,
    [features, selectedId],
  );

  const featuresByType = useMemo(() => {
    const groups: Partial<Record<FeatureType, FeatureMeta[]>> = {};
    for (const feature of features) {
      (groups[feature.featureType] ??= []).push(feature);
    }
    return groups;
  }, [features]);

  if (!access) {
    return (
      <div className="relative flex h-screen items-center justify-center bg-[#0a0f14]">
        <div
          className="absolute inset-0 bg-cover bg-center blur-[20px] saturate-[0.3] scale-110"
          style={{ backgroundImage: "url(/masterplan.png)" }}
        />
        <div className="absolute inset-0 bg-black/60" />
        <EditorAccessDialog
          onSuccess={() => {
            grantEditorAccess();
            setAccess(true);
          }}
          onCancel={() => {
            window.location.href = "/viewer";
          }}
        />
      </div>
    );
  }

  const saveLabel =
    saveState === "saving" ? "saving..." :
    saveState === "saved" ? "saved" :
    saveState === "error" ? "error - retry" :
    saveState === "unsaved" ? "unsaved" :
    "";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-ink)] max-md:flex-col">
      <div ref={mapDivRef} className="min-h-0 flex-1" />

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-[var(--color-hairline-dark)] bg-[var(--color-ink-pane)] max-md:h-[46vh] max-md:w-full max-md:border-l-0 max-md:border-t">
        <div className="border-b border-[var(--color-hairline-dark)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
              editor
            </span>
            {saveLabel && (
              <button
                type="button"
                onClick={saveState === "error" ? () => void save() : undefined}
                className={`text-[10px] uppercase tracking-[0.12em] ${
                  saveState === "error" ? "cursor-pointer text-red-300 hover:text-red-200" :
                  saveState === "unsaved" ? "text-amber-300/70" :
                  saveState === "saving" ? "text-white/40" :
                  "text-white/30"
                }`}
              >
                {saveLabel}
              </button>
            )}
          </div>
          <div className="mt-2 text-[11px] leading-4 text-white/38">
            Use the toolbar on the map to draw and edit. Changes auto-save.
          </div>
        </div>

        {/* masterplan trace controls hidden for now */}

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {features.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-white/25">
              no features - draw to add
            </div>
          ) : (
            (Object.keys(FEATURE_TYPE_LABELS) as FeatureType[]).map((featureType) => {
              const items = featuresByType[featureType];
              if (!items?.length) return null;
              return (
                <FeatureGroup
                  key={featureType}
                  label={FEATURE_TYPE_LABELS[featureType]}
                  items={items}
                  selectedId={selectedId}
                  onSelect={selectFeatureById}
                  onDelete={deleteFeature}
                />
              );
            })
          )}
        </div>

        {selected && (
          <Inspector
            feature={selected}
            onChange={(patch) => updateFeatureProps(selected.id, patch)}
            onSmooth={() => toggleSmooth(selected.id)}
            onDelete={() => deleteFeature(selected.id)}
          />
        )}

        <div className="flex items-center justify-between border-t border-[var(--color-hairline-dark)] px-4 py-3">
          <a href="/viewer" className="text-[11px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white">
            viewer
          </a>
          <Button variant="primary" size="sm" onClick={save} disabled={saveState === "saving"}>
            save
          </Button>
        </div>
      </aside>
    </div>
  );
}


function Inspector({
  feature,
  onChange,
  onSmooth,
  onDelete,
}: {
  feature: FeatureMeta;
  onChange: (patch: Record<string, unknown>) => void;
  onSmooth: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-t border-[var(--color-hairline-dark)] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">inspector</span>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
          style={{ color: FEATURE_STYLES[feature.featureType].stroke, background: `${FEATURE_STYLES[feature.featureType].fill}22` }}
        >
          {feature.featureType}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">name</span>
          <Input type="text" value={feature.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>

        <div className="col-span-2">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">type</span>
          <div className="flex gap-1">
            {featureTypeOptionsForGeometry(feature.geometryType).map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => onChange({ ...FEATURE_TYPE_DEFAULTS[ft], featureType: ft })}
                className={`flex-1 rounded-[var(--radius-md)] border py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
                  feature.featureType === ft
                    ? "border-white/25 bg-white/12 text-white"
                    : "border-transparent text-white/30 hover:bg-white/[0.06] hover:text-white/60"
                }`}
              >
                {ft === "parcel" ? "lot" : ft === "greenspace" ? "green" : ft}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">measure</span>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-white/70">
            {feature.readout}
          </div>
        </div>

        {feature.featureType === "parcel" && (
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">price usd</span>
            <Input
              type="number"
              mono
              value={feature.priceUSD ?? ""}
              onChange={(event) => onChange({ priceUSD: event.target.value ? Number(event.target.value) : undefined })}
              placeholder="-"
            />
          </label>
        )}

        {feature.featureType === "parcel" && (
          <div className="col-span-2">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">status</span>
            <div className="flex gap-1.5">
              {(["for-sale", "reserved", "sold"] as ParcelStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onChange({ status })}
                  className={`flex-1 rounded-[var(--radius-md)] border py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                    feature.status === status
                      ? "border-[var(--color-hairline-strong)] bg-white/12 text-white"
                      : "border-[var(--color-hairline-dark)] text-white/45 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  {status === "for-sale" ? "sale" : status}
                </button>
              ))}
            </div>
          </div>
        )}

        {(feature.featureType === "road" || feature.featureType === "sidewalk") && (
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">width m</span>
            <Input
              type="number"
              mono
              value={feature.roadWidth ?? (feature.featureType === "sidewalk" ? 1.5 : 6)}
              onChange={(event) => onChange({ roadWidth: event.target.value ? Number(event.target.value) : undefined })}
            />
          </label>
        )}

        {feature.featureType === "tree" && (
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">canopy m</span>
            <Input
              type="number"
              mono
              value={feature.canopyRadius ?? 4}
              onChange={(event) => onChange({ canopyRadius: event.target.value ? Number(event.target.value) : undefined })}
            />
          </label>
        )}

        {feature.featureType === "building" && (
          <>
            <label>
              <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">height m</span>
              <Input
                type="number"
                mono
                value={feature.height ?? 6}
                onChange={(event) => onChange({ height: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">floors</span>
              <Input
                type="number"
                mono
                value={feature.floors ?? 1}
                onChange={(event) => onChange({ floors: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
          </>
        )}

        <label className="col-span-2">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">description</span>
          <textarea
            value={feature.description ?? ""}
            onChange={(event) => onChange({ description: event.target.value || undefined })}
            rows={2}
            placeholder="Notes..."
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-white/30 focus:border-white/25 focus:bg-white/10"
          />
        </label>

        {feature.geometryType !== "Point" && (
          <button
            type="button"
            onClick={onSmooth}
            className={`col-span-2 rounded-[var(--radius-md)] border py-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${
              feature.smoothed
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-[var(--color-hairline-dark)] text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            {feature.smoothed ? "smoothed - undo" : "smooth edges"}
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          className="col-span-2 rounded-[var(--radius-md)] border border-red-400/25 py-2 text-[10px] uppercase tracking-[0.12em] text-red-200/70 transition-colors hover:bg-red-500/10 hover:text-red-100"
        >
          delete selected
        </button>
      </div>
    </div>
  );
}

function FeatureGroup({
  label,
  items,
  selectedId,
  onSelect,
  onDelete,
}: {
  label: string;
  items: FeatureMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 pb-1 pt-3 text-[9px] uppercase tracking-[0.2em] text-white/30">
        {label}
      </div>
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <div
            key={item.id}
            className={`group flex w-full items-center transition-colors ${
              isSelected ? "bg-[var(--color-ink-inset)]" : "hover:bg-[var(--color-ink-inset)]/60"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex min-w-0 flex-1 flex-col items-start px-4 py-2.5 text-left ${
                isSelected ? "text-white" : "text-white/55 group-hover:text-white/85"
              }`}
            >
              <div className="w-full truncate text-[12px] font-medium">{item.name || item.id}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40" style={{ fontVariantNumeric: "tabular-nums" }}>
                {item.readout}
                {item.smoothed ? " - curved" : ""}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              aria-label="Delete feature"
              className="invisible mr-2 shrink-0 rounded px-1.5 py-0.5 text-[12px] leading-none text-white/30 transition-colors hover:bg-white/10 hover:text-white group-hover:visible"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
