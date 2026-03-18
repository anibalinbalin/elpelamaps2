import type { FeatureCollection, Feature, Polygon } from "geojson";
import parcelsData from "@/data/parcels.json";

export interface ParcelProperties {
  id: string;
  name: string;
  areaSqMeters: number;
  priceUSD: number;
  zoning: string;
  description?: string;
  contactUrl: string;
  color?: string;
}

export type ParcelFeature = Feature<Polygon, ParcelProperties>;
export type ParcelCollection = FeatureCollection<Polygon, ParcelProperties>;

export function getParcels(): ParcelCollection {
  return parcelsData as ParcelCollection;
}
