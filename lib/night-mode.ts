import {
  Cartesian3,
  Cesium3DTileStyle,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  PolygonHierarchy,
  type Viewer,
} from "cesium";
import buildings from "./jose-ignacio-buildings.json";

/** Night tint applied to the 3D tileset via Cesium3DTileStyle */
const NIGHT_STYLE = new Cesium3DTileStyle({
  color: "color('#1e2d4a', 0.62)",
});

/** Warm glow colors for building footprints */
const BUILDING_GLOW = Color.fromCssColorString("rgba(255, 200, 90, 0.75)");
const BUILDING_GLOW_BRIGHT = Color.fromCssColorString("rgba(255, 225, 140, 0.9)");

/**
 * Apply night mode to a Cesium viewer:
 * 1. Darken/tint the 3D tileset via Cesium3DTileStyle
 * 2. Hide sky atmosphere
 * 3. Add pre-fetched OSM building footprints as glowing polygons
 *
 * Returns a cleanup function to restore day mode.
 */
export function applyNightMode(
  viewer: Viewer,
  tilesetRef: { current: { style: Cesium3DTileStyle | undefined } | null },
): () => void {
  if (viewer.isDestroyed()) return () => {};

  // 1. Darken tileset
  const tileset = tilesetRef.current;
  const prevStyle = tileset?.style;
  if (tileset) {
    tileset.style = NIGHT_STYLE;
  }

  // 2. Hide daytime atmosphere
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = false;
  }
  viewer.scene.backgroundColor = Color.BLACK;

  // 3. Add building footprints as glowing extruded polygons
  const buildingEntities: Entity[] = [];

  for (const building of buildings) {
    const positions = Cartesian3.fromDegreesArray(
      building.coords.flatMap((c) => [c[0], c[1]]),
    );

    // Vary glow intensity per building for realism
    const hash = Math.abs(building.coords[0][0] * 1000 + building.coords[0][1] * 1000);
    const bright = hash % 3 < 1;
    const height = Math.max(3, building.levels * 3);

    const entity = viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: new ColorMaterialProperty(
          bright ? BUILDING_GLOW_BRIGHT : BUILDING_GLOW,
        ),
        extrudedHeight: new ConstantProperty(height),
        height: new ConstantProperty(0),
        outline: false,
      },
    });

    buildingEntities.push(entity);
  }

  // Return cleanup function
  return () => {
    if (viewer.isDestroyed()) return;

    // Restore tileset style
    if (tileset) {
      tileset.style = prevStyle;
    }

    // Restore atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // Remove building entities
    for (const entity of buildingEntities) {
      viewer.entities.remove(entity);
    }
  };
}
