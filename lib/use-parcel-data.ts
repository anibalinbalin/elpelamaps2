import { useEffect, useMemo, useState } from "react";
import {
  getParcels,
  mergeParcelCollections,
  type ParcelCollection,
} from "./parcels";
import { useDrawTool } from "./use-draw-tool";

export function useParcelData(): ParcelCollection {
  const drawnParcels = useDrawTool((s) => s.drawnParcels);
  const [parcels, setParcels] = useState<ParcelCollection>(() => getParcels());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/parcels")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setParcels(data as ParcelCollection);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (drawnParcels.length === 0) return parcels;
    return mergeParcelCollections(parcels, {
      type: "FeatureCollection",
      features: drawnParcels,
    });
  }, [parcels, drawnParcels]);
}
