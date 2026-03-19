/**
 * TerrainExaggerationPlugin
 *
 * A 3d-tiles-renderer plugin that amplifies terrain relief by displacing
 * vertices radially outward from Earth's center.
 *
 * Works with MeshBasicMaterial (which Google 3D Tiles use) by injecting
 * displacement before the projection step in the vertex shader.
 *
 * This does NOT scale the group transform (which breaks GlobeControls).
 */

import type { Object3D, Material, Mesh } from "three";

const WRAPPED = Symbol("terrainExaggeration");

interface WrappedMaterial extends Material {
  [WRAPPED]?: boolean;
  onBeforeCompile: (shader: any, renderer: any) => void;
}

function wrapMaterial(material: WrappedMaterial, amount: number) {
  if (material[WRAPPED]) return;
  material[WRAPPED] = true;

  const prev = material.onBeforeCompile?.bind(material);

  material.onBeforeCompile = (shader: any, renderer: any) => {
    if (prev) prev(shader, renderer);

    shader.uniforms.terrainExaggeration = { value: amount };

    // Inject uniform before main()
    shader.vertexShader = shader.vertexShader.replace(
      /void main\(\)\s*\{/,
      `uniform float terrainExaggeration;
void main() {`
    );

    // After the model-view transform, displace along the radial direction
    // For globe tiles, the world-space position direction IS the surface normal
    shader.vertexShader = shader.vertexShader.replace(
      /#include <project_vertex>/,
      `// Compute world position for radial direction
vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
vec3 radialDir = normalize(worldPos.xyz);
worldPos.xyz += radialDir * terrainExaggeration;
// Project the displaced position
vec4 mvPosition = viewMatrix * worldPos;
gl_Position = projectionMatrix * mvPosition;`
    );
  };

  material.needsUpdate = true;
}

function traverseAndWrap(scene: Object3D, amount: number) {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => wrapMaterial(m as WrappedMaterial, amount));
    } else {
      wrapMaterial(mesh.material as WrappedMaterial, amount);
    }
  });
}

export class TerrainExaggerationPlugin {
  name = "TerrainExaggerationPlugin";
  amount: number;

  private _onLoadModel: ((event: any) => void) | null = null;
  private _tiles: any = null;

  constructor({ amount = 100 }: { amount?: number } = {}) {
    this.amount = amount;
  }

  init(tiles: any) {
    this._tiles = tiles;
    this._onLoadModel = ({ scene }: { scene: Object3D }) => {
      traverseAndWrap(scene, this.amount);
    };
    tiles.addEventListener("load-model", this._onLoadModel);
  }

  dispose() {
    if (this._tiles && this._onLoadModel) {
      this._tiles.removeEventListener("load-model", this._onLoadModel);
    }
    this._tiles = null;
    this._onLoadModel = null;
  }
}
