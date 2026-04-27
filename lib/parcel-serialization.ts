import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";

import { sphericalArea } from "@/lib/geo-area";
import type {
  FeatureType,
  ParcelCollection,
  ParcelFeature,
  ParcelProperties,
} from "@/lib/parcels";

type EditableGeometry = Polygon | LineString | Point;
type GeomanShape = "polygon" | "line" | "marker";

const FEATURE_TYPES = new Set<FeatureType>([
  "parcel",
  "road",
  "amenity",
  "water",
  "greenspace",
  "tree",
  "building",
  "sidewalk",
]);

const OPTIONAL_PROPERTY_KEYS = [
  "priceUSD",
  "zoning",
  "label",
  "status",
  "description",
  "contactUrl",
  "color",
  "roadWidth",
  "smoothed",
  "originalCoords",
  "canopyRadius",
  "height",
  "floors",
] as const satisfies readonly (keyof ParcelProperties)[];

function flattenGeometry(geometry: Geometry | null): Geometry | null {
  if (geometry?.type === "MultiPolygon") {
    const mp = geometry as MultiPolygon;
    if (mp.coordinates.length === 1) {
      return { type: "Polygon", coordinates: mp.coordinates[0] } as Polygon;
    }
  }
  if (geometry?.type === "MultiLineString") {
    const ml = geometry as MultiLineString;
    if (ml.coordinates.length === 1) {
      return { type: "LineString", coordinates: ml.coordinates[0] } as LineString;
    }
  }
  return geometry;
}

function isEditableGeometry(geometry: Geometry | null): geometry is EditableGeometry {
  return (
    geometry?.type === "Polygon" ||
    geometry?.type === "LineString" ||
    geometry?.type === "Point"
  );
}

function shapeForGeometry(geometry: EditableGeometry): GeomanShape {
  if (geometry.type === "LineString") return "line";
  if (geometry.type === "Point") return "marker";
  return "polygon";
}

function defaultFeatureType(geometry: EditableGeometry): FeatureType {
  if (geometry.type === "LineString") return "road";
  if (geometry.type === "Point") return "tree";
  return "parcel";
}

function readFeatureType(value: unknown, geometry: EditableGeometry): FeatureType {
  return typeof value === "string" && FEATURE_TYPES.has(value as FeatureType)
    ? (value as FeatureType)
    : defaultFeatureType(geometry);
}

function computedArea(geometry: EditableGeometry, existing: unknown): number {
  if (geometry.type !== "Polygon") {
    return typeof existing === "number" && Number.isFinite(existing) ? existing : 0;
  }

  const ring = geometry.coordinates[0] as [number, number][] | undefined;
  if (!ring || ring.length < 3) return 0;
  return sphericalArea(ring);
}

export function parcelCollectionToGeoman(
  collection: ParcelCollection,
): FeatureCollection<EditableGeometry> {
  return {
    type: "FeatureCollection",
    features: collection.features
      .filter((feature): feature is ParcelFeature => isEditableGeometry(feature.geometry))
      .map((feature) => ({
        ...feature,
        id: feature.properties.id,
        properties: {
          ...feature.properties,
          featureType: feature.properties.featureType ?? defaultFeatureType(feature.geometry),
          shape: shapeForGeometry(feature.geometry),
        },
      })),
  };
}

export function geomanCollectionToParcels(
  collection: FeatureCollection<Geometry>,
): ParcelCollection {
  const features: ParcelFeature[] = [];

  for (const feature of collection.features) {
    const geometry = flattenGeometry(feature.geometry);
    if (!isEditableGeometry(geometry)) continue;

    const rawProps = (feature.properties ?? {}) as Record<string, unknown>;
    const id = String(rawProps.id ?? feature.id ?? `feature-${features.length + 1}`);
    const featureType = readFeatureType(rawProps.featureType, geometry);
    const properties: ParcelProperties = {
      id,
      name: String(rawProps.name ?? id),
      areaSqMeters: computedArea(geometry, rawProps.areaSqMeters),
      featureType,
    };

    for (const key of OPTIONAL_PROPERTY_KEYS) {
      const value = rawProps[key];
      if (value !== undefined && value !== null && value !== "") {
        (properties as unknown as Record<string, unknown>)[key] = value;
      }
    }

    features.push({
      type: "Feature",
      geometry,
      properties,
    } satisfies Feature<EditableGeometry, ParcelProperties>);
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
