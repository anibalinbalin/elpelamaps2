import type { FeatureCollection, Feature, Polygon, LineString, Point } from "geojson";
import parcelsData from "@/data/parcels.json";

export type FeatureType =
  | "parcel"
  | "road"
  | "amenity"
  | "water"
  | "greenspace"
  | "tree"
  | "building"
  | "sidewalk";

export interface ParcelProperties {
  id: string;
  name: string;
  areaSqMeters: number;
  featureType?: FeatureType;
  priceUSD?: number;
  zoning?: string;
  label?: string;
  status?: "for-sale" | "sold" | "reserved";
  description?: string;
  contactUrl?: string;
  color?: string;
  roadWidth?: number;
  smoothed?: boolean;
  originalCoords?: number[][][];
  canopyRadius?: number;
  height?: number;
  floors?: number;
}

export type ParcelFeature = Feature<Polygon | LineString | Point, ParcelProperties>;
export type ParcelCollection = FeatureCollection<Polygon | LineString | Point, ParcelProperties>;

export function getParcels(): ParcelCollection {
  return parcelsData as ParcelCollection;
}

export function mergeParcelCollections(
  ...collections: ParcelCollection[]
): ParcelCollection {
  const byId = new Map<string, ParcelFeature>();

  for (const collection of collections) {
    for (const feature of collection.features) {
      byId.set(feature.properties.id, feature);
    }
  }

  return {
    type: "FeatureCollection",
    features: Array.from(byId.values()),
  };
}
