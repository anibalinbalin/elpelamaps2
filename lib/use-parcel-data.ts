import { useEffect, useMemo, useState } from "react";
import {
  getParcels,
  mergeParcelCollections,
  type ParcelFeature,
  type ParcelCollection,
} from "./parcels";
import { useDrawTool } from "./use-draw-tool";

interface UseParcelDataOptions {
  includeDraftParcels?: boolean;
}

const EMPTY_DRAWN_PARCELS: ParcelFeature[] = [];
const selectDrawnParcels = (state: { drawnParcels: ParcelFeature[] }) => state.drawnParcels;
const selectNoDrawnParcels = () => EMPTY_DRAWN_PARCELS;

export function useParcelData({
  includeDraftParcels = false,
}: UseParcelDataOptions = {}): ParcelCollection {
  const drawnParcels = useDrawTool(
    includeDraftParcels ? selectDrawnParcels : selectNoDrawnParcels,
  );
  const [parcels, setParcels] = useState<ParcelCollection>(() => getParcels());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch("/api/parcels", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Parcel refresh failed with ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (!cancelled) setParcels(data as ParcelCollection);
      })
      .catch((error) => {
        if ((error as { name?: string } | null)?.name === "AbortError") {
          return;
        }

        console.error("[useParcelData] Failed to refresh parcels from /api/parcels", error);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return useMemo(() => {
    if (!includeDraftParcels || drawnParcels.length === 0) {
      return parcels;
    }

    return mergeParcelCollections(parcels, {
      type: "FeatureCollection",
      features: drawnParcels,
    });
  }, [includeDraftParcels, parcels, drawnParcels]);
}
