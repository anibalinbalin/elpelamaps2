import {
  Cartesian3,
  Cesium3DTileStyle,
  ClassificationType,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  PolygonHierarchy,
  type Viewer,
} from "cesium";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

/** Night tint applied to the 3D tileset via Cesium3DTileStyle */
const NIGHT_STYLE = new Cesium3DTileStyle({
  color: "color('#1a2540', 0.82)",
});

/** Warm glow color for building footprints */
const BUILDING_GLOW = Color.fromCssColorString("rgba(255, 195, 80, 0.55)");
const BUILDING_GLOW_BRIGHT = Color.fromCssColorString("rgba(255, 210, 120, 0.7)");

interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay;

/**
 * Fetch building footprints from OpenStreetMap Overpass API
 * for a given center point and radius.
 */
async function fetchOsmBuildings(
  lat: number,
  lon: number,
  radiusMeters = 3000,
): Promise<Array<{ coords: [number, number][]; tags: Record<string, string> }>> {
  const query = `[out:json][timeout:25];(way["building"](around:${radiusMeters},${lat},${lon}););out body;>;out skel qt;`;

  const response = await fetch(OVERPASS_API, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const elements: OsmElement[] = data.elements ?? [];

  const nodes = new Map<number, OsmNode>();
  const ways: OsmWay[] = [];

  for (const el of elements) {
    if (el.type === "node") nodes.set(el.id, el);
    else if (el.type === "way") ways.push(el);
  }

  return ways
    .map((way) => {
      const coords: [number, number][] = [];
      for (const nodeId of way.nodes) {
        const node = nodes.get(nodeId);
        if (node) coords.push([node.lon, node.lat]);
      }
      return { coords, tags: way.tags ?? {} };
    })
    .filter((b) => b.coords.length >= 3);
}

/**
 * Apply night mode to a Cesium viewer:
 * 1. Darken/tint the 3D tileset via Cesium3DTileStyle
 * 2. Hide sky atmosphere
 * 3. Add OSM building footprints as glowing polygons
 *
 * Returns a cleanup function to restore day mode.
 */
export async function applyNightMode(
  viewer: Viewer,
  tilesetRef: { current: { style: Cesium3DTileStyle | undefined } | null },
  center: { lat: number; lon: number },
): Promise<() => void> {
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

  // 3. Fetch and render OSM buildings as glowing footprints
  const buildingEntities: Entity[] = [];

  try {
    const buildings = await fetchOsmBuildings(center.lat, center.lon);

    for (const building of buildings) {
      const positions = Cartesian3.fromDegreesArray(
        building.coords.flatMap(([lon, lat]) => [lon, lat]),
      );

      // Vary glow intensity slightly per building for realism
      const hash = building.coords[0][0] * 1000 + building.coords[0][1] * 1000;
      const bright = Math.abs(hash % 3) === 0;

      const entity = viewer.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: new ColorMaterialProperty(
            bright ? BUILDING_GLOW_BRIGHT : BUILDING_GLOW,
          ),
          classificationType: new ConstantProperty(
            ClassificationType.CESIUM_3D_TILE,
          ),
          zIndex: new ConstantProperty(10),
        },
      });

      buildingEntities.push(entity);
    }
  } catch (_) {
    // OSM fetch failed — night mode still works, just without building glow
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
