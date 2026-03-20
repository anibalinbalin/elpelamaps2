import type { FeatureCollection, Feature, Polygon } from "geojson";
import parcelsData from "@/data/parcels.json";

export interface ParcelProperties {
  id: string;
  name: string;
  areaSqMeters: number;
  priceUSD?: number;
  zoning?: string;
  status?: "for-sale" | "sold" | "reserved";
  description?: string;
  contactUrl?: string;
  color?: string;
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>;
export type ParcelCollection = FeatureCollection<Polygon, ParcelProperties>;

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
