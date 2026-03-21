import { Matrix4, Raycaster, Vector3 } from "three";

export interface TerrainProjectionBuffers {
  localSurface: Vector3;
  localNormal: Vector3;
  rayOrigin: Vector3;
  rayDirection: Vector3;
  inverseMatrix: Matrix4;
}

interface ProjectCartographicToTerrainPointOptions {
  tiles: any;
  latRad: number;
  lonRad: number;
  raycaster: Raycaster;
  buffers: TerrainProjectionBuffers;
  target: Vector3;
  outputSpace?: "world" | "local";
  surfaceHeight?: number;
  rayHeight?: number;
  rayDistance?: number;
}

/**
 * Projects a lat/lon point onto the currently loaded terrain tiles by raycasting
 * down from above the ellipsoid surface along the local normal.
 */
export function projectCartographicToTerrainPoint({
  tiles,
  latRad,
  lonRad,
  raycaster,
  buffers,
  target,
  outputSpace = "world",
  surfaceHeight = 0,
  rayHeight = 10_000,
  rayDistance = 20_000,
}: ProjectCartographicToTerrainPointOptions) {
  const {
    localSurface,
    localNormal,
    rayOrigin,
    rayDirection,
    inverseMatrix,
  } = buffers;

  tiles.ellipsoid.getCartographicToPosition(
    latRad,
    lonRad,
    surfaceHeight,
    localSurface,
  );
  tiles.ellipsoid.getCartographicToNormal(latRad, lonRad, localNormal);

  rayOrigin.copy(localSurface).addScaledVector(localNormal, rayHeight);
  rayOrigin.applyMatrix4(tiles.group.matrixWorld);
  rayDirection
    .copy(localNormal)
    .transformDirection(tiles.group.matrixWorld)
    .multiplyScalar(-1);

  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);
  raycaster.near = 0;
  raycaster.far = rayDistance;

  const hit = raycaster.intersectObject(tiles.group, true)[0];
  if (hit?.point) {
    if (outputSpace === "local") {
      inverseMatrix.copy(tiles.group.matrixWorld).invert();
      target.copy(hit.point).applyMatrix4(inverseMatrix);
    } else {
      target.copy(hit.point);
    }
    return;
  }

  if (outputSpace === "local") {
    target.copy(localSurface);
  } else {
    target.copy(localSurface).applyMatrix4(tiles.group.matrixWorld);
  }
}
