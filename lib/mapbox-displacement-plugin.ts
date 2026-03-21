/**
 * MapboxDisplacementPlugin
 *
 * A 3d-tiles-renderer plugin that displaces Google tile vertices
 * using Mapbox terrain-RGB elevation data.
 *
 * How it works:
 * 1. On init, fetches a Mapbox terrain-RGB tile covering the area
 * 2. Uploads the decoded elevation as a DataTexture
 * 3. On each tile load, wraps the material's vertex shader to sample
 *    the elevation texture and displace vertices vertically
 */

import {
  DataTexture,
  FloatType,
  RedFormat,
  LinearFilter,
  ClampToEdgeWrapping,
} from "three";
import type { Object3D, Mesh, Material } from "three";

const WRAPPED = Symbol("mapboxDisplacement");

interface DisplacementConfig {
  token: string;
  centerLat: number;
  centerLon: number;
  /** Elevation multiplier (default 3) */
  scale?: number;
  /** Mapbox tile zoom level (default 12) */
  zoom?: number;
}

interface WrappedMaterial extends Material {
  [WRAPPED]?: boolean;
  onBeforeCompile: (shader: any, renderer: any) => void;
}

interface UniformRef<T> {
  value: T;
}

const UNIFORM_MARKER = "MAPBOX_DISPLACEMENT_UNIFORMS";
const PROJECT_MARKER = "MAPBOX_DISPLACEMENT_PROJECT";

// Module-level elevation state for CPU-side sampling.
// The GPU vertex shader displaces terrain but the CPU geometry is untouched,
// so raycasts hit the original mesh. This function lets callers (parcel-layer,
// draw-overlay, screen-projector) apply the same displacement on the CPU.
let _moduleElevations: Float32Array | null = null;
let _moduleBoundsMinX = 0;
let _moduleBoundsMaxX = 0;
let _moduleBoundsMinZ = 0;
let _moduleBoundsMaxZ = 0;
let _moduleSize = 0;
let _moduleScale = 0;

/**
 * Sample the terrain displacement at a world-space XZ position.
 * Returns the Y offset (elevation * scale) that the vertex shader applies,
 * so callers can match their geometry to the visual terrain surface.
 * Uses bilinear interpolation to match GPU LinearFilter sampling.
 */
export function getTerrainDisplacementY(worldX: number, worldZ: number): number {
  if (!_moduleElevations) return 0;

  const u = (worldX - _moduleBoundsMinX) / (_moduleBoundsMaxX - _moduleBoundsMinX);
  const v = (worldZ - _moduleBoundsMinZ) / (_moduleBoundsMaxZ - _moduleBoundsMinZ);
  const cu = Math.max(0, Math.min(1, u));
  const cv = Math.max(0, Math.min(1, v));

  const fx = cu * (_moduleSize - 1);
  const fy = cv * (_moduleSize - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, _moduleSize - 1);
  const y1 = Math.min(y0 + 1, _moduleSize - 1);
  const dx = fx - x0;
  const dy = fy - y0;

  const e00 = _moduleElevations[y0 * _moduleSize + x0];
  const e10 = _moduleElevations[y0 * _moduleSize + x1];
  const e01 = _moduleElevations[y1 * _moduleSize + x0];
  const e11 = _moduleElevations[y1 * _moduleSize + x1];
  const elevation =
    e00 * (1 - dx) * (1 - dy) +
    e10 * dx * (1 - dy) +
    e01 * (1 - dx) * dy +
    e11 * dx * dy;

  return elevation * _moduleScale;
}

/** Decode Mapbox terrain-RGB pixel to elevation in meters */
function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function tileBounds(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latMaxRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latMinRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return {
    latMin: (latMinRad * 180) / Math.PI,
    latMax: (latMaxRad * 180) / Math.PI,
    lonMin,
    lonMax,
  };
}

function metersPerDegree(lat: number) {
  const latRad = (lat * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * latRad),
    lon: 111412.84 * Math.cos(latRad),
  };
}

async function fetchElevationTexture(
  config: DisplacementConfig
): Promise<{
  texture: DataTexture;
  elevations: Float32Array;
  bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  size: number;
} | null> {
  const zoom = config.zoom ?? 12;
  const tile = latLonToTile(config.centerLat, config.centerLon, zoom);
  const bounds = tileBounds(tile.x, tile.y, zoom);
  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tile.x}/${tile.y}@2x.pngraw?access_token=${config.token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const size = bitmap.width; // 512 for @2x

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const elevations = new Float32Array(size * size);
    for (let i = 0; i < size * size; i++) {
      const idx = i * 4;
      elevations[i] = decodeElevation(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
    }

    const texture = new DataTexture(elevations, size, size, RedFormat, FloatType);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return { texture, elevations, bounds, size };
  } catch {
    return null;
  }
}

function wrapMaterial(
  material: WrappedMaterial,
  texture: DataTexture,
  bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  centerLat: number,
  centerLon: number,
  scale: number,
  scaleUniforms: Set<UniformRef<number>>,
) {
  if (material[WRAPPED]) return;
  material[WRAPPED] = true;

  const prev = material.onBeforeCompile?.bind(material);
  const meters = metersPerDegree(centerLat);
  const elevationScaleUniform: UniformRef<number> = { value: scale };
  scaleUniforms.add(elevationScaleUniform);

  // Precompute bounds in local meters (relative to center)
  const localMinX = (bounds.lonMin - centerLon) * meters.lon;
  const localMaxX = (bounds.lonMax - centerLon) * meters.lon;
  const localMinZ = -(bounds.latMax - centerLat) * meters.lat; // Z = -North
  const localMaxZ = -(bounds.latMin - centerLat) * meters.lat;

  material.onBeforeCompile = (shader: any, renderer: any) => {
    if (prev) prev(shader, renderer);

    shader.uniforms.elevationMap = { value: texture };
    shader.uniforms.elevationScale = elevationScaleUniform;
    shader.uniforms.elevationBoundsMin = { value: [localMinX, localMinZ] };
    shader.uniforms.elevationBoundsMax = { value: [localMaxX, localMaxZ] };

    if (!shader.vertexShader.includes(UNIFORM_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        /void main\(\)\s*\{/,
        `// ${UNIFORM_MARKER}
uniform sampler2D elevationMap;
uniform float elevationScale;
uniform vec2 elevationBoundsMin;
uniform vec2 elevationBoundsMax;
void main() {`
      );
    }

    if (!shader.vertexShader.includes(PROJECT_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        /#include <project_vertex>/,
        `// ${PROJECT_MARKER}
// Compute world position from the current local vertex
vec4 dispWorldPos = modelMatrix * vec4(transformed, 1.0);

// Map world XZ to elevation texture UV
vec2 elevUV = (dispWorldPos.xz - elevationBoundsMin) / (elevationBoundsMax - elevationBoundsMin);

// Sample elevation — clamp UV so tiles outside coverage get edge values
// (no edge fade = same world position always gets same displacement = no seam morphing)
float elevation = texture2D(elevationMap, clamp(elevUV, 0.0, 1.0)).r;
transformed.y += elevation * elevationScale;

#include <project_vertex>`
      );
    }
  };

  material.needsUpdate = true;
}

function traverseAndWrap(
  scene: Object3D,
  texture: DataTexture,
  bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  centerLat: number,
  centerLon: number,
  scale: number,
  scaleUniforms: Set<UniformRef<number>>,
) {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) =>
        wrapMaterial(
          m as WrappedMaterial,
          texture,
          bounds,
          centerLat,
          centerLon,
          scale,
          scaleUniforms,
        )
      );
    } else {
      wrapMaterial(
        mesh.material as WrappedMaterial,
        texture,
        bounds,
        centerLat,
        centerLon,
        scale,
        scaleUniforms,
      );
    }
  });
}

export class MapboxDisplacementPlugin {
  name = "MapboxDisplacementPlugin";

  private _config: DisplacementConfig;
  private _onLoadModel: ((event: any) => void) | null = null;
  private _tiles: any = null;
  private _texture: DataTexture | null = null;
  private _bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null = null;
  private _ready = false;
  private _scaleUniforms = new Set<UniformRef<number>>();
  private _scale = 3;

  constructor(config: DisplacementConfig) {
    this._config = config;
    this.scale = config.scale ?? 3;
  }

  get scale() {
    return this._scale;
  }

  set scale(value: number) {
    this._scale = value;
    _moduleScale = value;
    for (const uniform of this._scaleUniforms) {
      uniform.value = value;
    }
  }

  init(tiles: any) {
    this._tiles = tiles;

    // Fetch elevation data
    fetchElevationTexture(this._config).then((result) => {
      if (!result) {
        console.warn("[MapboxDisplacement] Failed to fetch elevation data");
        return;
      }
      this._texture = result.texture;
      this._bounds = result.bounds;
      this._ready = true;

      // Populate module-level state for CPU-side elevation sampling
      const meters = metersPerDegree(this._config.centerLat);
      _moduleBoundsMinX = (result.bounds.lonMin - this._config.centerLon) * meters.lon;
      _moduleBoundsMaxX = (result.bounds.lonMax - this._config.centerLon) * meters.lon;
      _moduleBoundsMinZ = -(result.bounds.latMax - this._config.centerLat) * meters.lat;
      _moduleBoundsMaxZ = -(result.bounds.latMin - this._config.centerLat) * meters.lat;
      _moduleElevations = result.elevations;
      _moduleSize = result.size;
      _moduleScale = this._scale;

      tiles.traverse((tile: any) => {
        if (tile.engineData?.scene) {
          traverseAndWrap(
            tile.engineData.scene,
            this._texture!,
            this._bounds!,
            this._config.centerLat,
            this._config.centerLon,
            this.scale,
            this._scaleUniforms,
          );
        }
      }, null, false);

    });

    this._onLoadModel = ({ scene }: { scene: Object3D }) => {
      if (this._ready && this._texture && this._bounds) {
        traverseAndWrap(
          scene,
          this._texture,
          this._bounds,
          this._config.centerLat,
          this._config.centerLon,
          this.scale,
          this._scaleUniforms,
        );
      }
    };
    tiles.addEventListener("load-model", this._onLoadModel);
  }

  dispose() {
    if (this._tiles && this._onLoadModel) {
      this._tiles.removeEventListener("load-model", this._onLoadModel);
    }
    this._texture?.dispose();
    this._scaleUniforms.clear();
    this._tiles = null;
    this._onLoadModel = null;
    this._texture = null;
    _moduleElevations = null;
  }
}
