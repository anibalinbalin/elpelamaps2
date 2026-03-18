"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { TilesPlugin } from "3d-tiles-renderer/r3f";
import { ImageOverlayPlugin, GeoJSONOverlay } from "3d-tiles-renderer/plugins";
import { getParcels } from "@/lib/parcels";
import { PARCEL_COLORS } from "@/lib/constants";

export function ParcelLayer() {
  const gl = useThree((state) => state.gl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginRef = useRef<any>(null);

  useEffect(() => {
    const plugin = pluginRef.current as InstanceType<typeof ImageOverlayPlugin> | null;
    if (!plugin) return;

    const parcels = getParcels();
    const overlay = new GeoJSONOverlay({
      geojson: parcels,
      fillStyle: PARCEL_COLORS.fill,
      strokeStyle: PARCEL_COLORS.stroke,
      strokeWidth: PARCEL_COLORS.strokeWidth,
    });
    plugin.addOverlay(overlay);

    return () => {
      plugin.deleteOverlay(overlay);
    };
  }, []);

  return (
    <TilesPlugin
      plugin={ImageOverlayPlugin}
      args={[{ renderer: gl }]}
      ref={pluginRef}
    />
  );
}
