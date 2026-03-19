import { useMemo } from "react";
import {
  getParcels,
  type ParcelCollection,
  type ParcelFeature,
} from "./parcels";
import { useDrawTool } from "./use-draw-tool";

export function useParcelData(): ParcelCollection {
  const drawnParcels = useDrawTool((s) => s.drawnParcels);
  const staticParcels = useMemo(() => getParcels(), []);

  return useMemo(() => {
    if (drawnParcels.length === 0) return staticParcels;
    return {
      type: "FeatureCollection" as const,
      features: [
        ...staticParcels.features,
        ...drawnParcels,
      ] as ParcelFeature[],
    };
  }, [staticParcels, drawnParcels]);
}
