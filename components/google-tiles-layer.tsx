"use client";

import { forwardRef } from "react";
import { Euler } from "three";
import { TilesRenderer, TilesPlugin, GlobeControls, TilesAttributionOverlay, CompassGizmo } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin, TilesFadePlugin, UpdateOnChangePlugin, TileCompressionPlugin } from "3d-tiles-renderer/plugins";

interface GoogleTilesLayerProps {
  apiToken: string;
  children?: React.ReactNode;
}

// rotation to convert from Z-up (ECEF) to Y-up (Three.js)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ECEF_ROTATION: any = { rotation: new Euler(-Math.PI / 2, 0, 0) };

export const GoogleTilesLayer = forwardRef<any, GoogleTilesLayerProps>(
  function GoogleTilesLayer({ apiToken, children }, ref) {
    return (
      <TilesRenderer ref={ref} group={ECEF_ROTATION}>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken }]} />
        <TilesPlugin plugin={TilesFadePlugin} args={[{ fadeDuration: 300 }]} />
        <TilesPlugin plugin={UpdateOnChangePlugin} />
        <TilesPlugin plugin={TileCompressionPlugin} />

        <GlobeControls enableDamping />

        <TilesAttributionOverlay />
        <CompassGizmo />

        {children}
      </TilesRenderer>
    );
  }
);
