import { useMemo } from "react";
import {
  getParcels,
  mergeParcelCollections,
  type ParcelCollection,
} from "./parcels";
import { useDrawTool } from "./use-draw-tool";

export function useParcelData(): ParcelCollection {
  const drawnParcels = useDrawTool((s) => s.drawnParcels);
  const staticParcels = useMemo(() => getParcels(), []);

  return useMemo(() => {
    if (drawnParcels.length === 0) return staticParcels;
    return mergeParcelCollections(staticParcels, {
      type: "FeatureCollection",
      features: drawnParcels,
    });
  }, [staticParcels, drawnParcels]);
}
