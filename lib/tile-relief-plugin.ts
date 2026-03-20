import { Vector3 } from "three";
import type { Material, Mesh, Object3D } from "three";

const WRAPPED = Symbol("tileReliefWrapped");
const RELIEF_DECLARATION_MARKER = "TILE_RELIEF_DECLARATIONS";
const RELIEF_VERTEX_MARKER = "TILE_RELIEF_VERTEX";
const RELIEF_FRAGMENT_MARKER = "TILE_RELIEF_FRAGMENT";

interface WrappedMaterial extends Material {
  [WRAPPED]?: boolean;
  onBeforeCompile: (shader: any, renderer: any) => void;
}

interface TileReliefConfig {
  lightDirection?: [number, number, number];
  ambient?: number;
  wrap?: number;
  directionalStrength?: number;
  shadowStrength?: number;
  topLight?: number;
  curvatureStrength?: number;
  curvatureScale?: number;
  rimStrength?: number;
}

function applyTileRelief(material: WrappedMaterial, plugin: TileReliefPlugin) {
  if (material[WRAPPED]) return;
  material[WRAPPED] = true;

  const prev = material.onBeforeCompile?.bind(material);

  material.onBeforeCompile = (shader: any, renderer: any) => {
    if (prev) prev(shader, renderer);

    shader.uniforms.tileReliefLightDirection =
      plugin.uniforms.tileReliefLightDirection;
    shader.uniforms.tileReliefAmbient = plugin.uniforms.tileReliefAmbient;
    shader.uniforms.tileReliefWrap = plugin.uniforms.tileReliefWrap;
    shader.uniforms.tileReliefDirectionalStrength =
      plugin.uniforms.tileReliefDirectionalStrength;
    shader.uniforms.tileReliefShadowStrength =
      plugin.uniforms.tileReliefShadowStrength;
    shader.uniforms.tileReliefTopLight = plugin.uniforms.tileReliefTopLight;
    shader.uniforms.tileReliefCurvatureStrength =
      plugin.uniforms.tileReliefCurvatureStrength;
    shader.uniforms.tileReliefCurvatureScale =
      plugin.uniforms.tileReliefCurvatureScale;
    shader.uniforms.tileReliefRimStrength =
      plugin.uniforms.tileReliefRimStrength;

    if (!shader.vertexShader.includes(RELIEF_DECLARATION_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        /void main\(\)\s*\{/,
        `// ${RELIEF_DECLARATION_MARKER}
varying vec3 vTileReliefWorldNormal;
varying vec3 vTileReliefWorldPosition;
void main() {`,
      );
    }

    if (!shader.vertexShader.includes(RELIEF_VERTEX_MARKER)) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
// ${RELIEF_VERTEX_MARKER}
vTileReliefWorldNormal = normalize(mat3(modelMatrix) * normal);
vTileReliefWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    }

    if (!shader.fragmentShader.includes(RELIEF_DECLARATION_MARKER)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
// ${RELIEF_DECLARATION_MARKER}
varying vec3 vTileReliefWorldNormal;
varying vec3 vTileReliefWorldPosition;
uniform vec3 tileReliefLightDirection;
uniform float tileReliefAmbient;
uniform float tileReliefWrap;
uniform float tileReliefDirectionalStrength;
uniform float tileReliefShadowStrength;
uniform float tileReliefTopLight;
uniform float tileReliefCurvatureStrength;
uniform float tileReliefCurvatureScale;
uniform float tileReliefRimStrength;`,
      );
    }

    if (!shader.fragmentShader.includes(RELIEF_FRAGMENT_MARKER)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <tonemapping_fragment>",
        `// ${RELIEF_FRAGMENT_MARKER}
vec3 tileReliefNormal = normalize(vTileReliefWorldNormal);
vec3 tileReliefLight = normalize(tileReliefLightDirection);
vec3 tileReliefViewDirection = normalize(cameraPosition - vTileReliefWorldPosition);
float tileReliefUp = clamp(dot(tileReliefNormal, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
float tileReliefSteepness = 1.0 - tileReliefUp;
float tileReliefWrapped = clamp(
  (dot(tileReliefNormal, tileReliefLight) + tileReliefWrap) / (1.0 + tileReliefWrap),
  0.0,
  1.0
);
float tileReliefDirectional = mix(
  tileReliefAmbient,
  1.0 + tileReliefDirectionalStrength,
  tileReliefWrapped
);
float tileReliefCurvature = clamp(
  length(fwidth(tileReliefNormal)) * tileReliefCurvatureScale,
  0.0,
  1.0
);
float tileReliefShadow = (1.0 - tileReliefWrapped) * tileReliefShadowStrength * mix(0.55, 1.0, tileReliefSteepness);
float tileReliefEdgeShade = tileReliefCurvature * tileReliefCurvatureStrength * mix(0.7, 1.0, tileReliefSteepness);
float tileReliefRimShade = pow(
  1.0 - clamp(dot(tileReliefNormal, tileReliefViewDirection), 0.0, 1.0),
  2.0
) * tileReliefRimStrength * mix(0.7, 1.0, tileReliefSteepness);
float tileReliefTopBoost = tileReliefUp * tileReliefTopLight;
gl_FragColor.rgb *= tileReliefDirectional;
gl_FragColor.rgb *= 1.0 - tileReliefShadow;
gl_FragColor.rgb *= 1.0 - tileReliefEdgeShade;
gl_FragColor.rgb *= 1.0 - tileReliefRimShade;
gl_FragColor.rgb += vec3(tileReliefTopBoost);
#include <tonemapping_fragment>`,
      );
    }
  };

  material.needsUpdate = true;
}

function traverseAndApply(scene: Object3D, plugin: TileReliefPlugin) {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) =>
        applyTileRelief(material as WrappedMaterial, plugin),
      );
      return;
    }

    applyTileRelief(mesh.material as WrappedMaterial, plugin);
  });
}

export class TileReliefPlugin {
  name = "TileReliefPlugin";

  uniforms = {
    tileReliefLightDirection: { value: new Vector3(0.54, 0.78, -0.31).normalize() },
    tileReliefAmbient: { value: 0.97 },
    tileReliefWrap: { value: 0.48 },
    tileReliefDirectionalStrength: { value: 0.08 },
    tileReliefShadowStrength: { value: 0.14 },
    tileReliefTopLight: { value: 0.014 },
    tileReliefCurvatureStrength: { value: 0.08 },
    tileReliefCurvatureScale: { value: 3.6 },
    tileReliefRimStrength: { value: 0.04 },
  };

  private _onLoadModel: ((event: any) => void) | null = null;
  private _tiles: any = null;

  constructor(config: TileReliefConfig = {}) {
    if (config.lightDirection) {
      this.lightDirection = config.lightDirection;
    }
    if (config.ambient != null) {
      this.ambient = config.ambient;
    }
    if (config.wrap != null) {
      this.wrap = config.wrap;
    }
    if (config.directionalStrength != null) {
      this.directionalStrength = config.directionalStrength;
    }
    if (config.shadowStrength != null) {
      this.shadowStrength = config.shadowStrength;
    }
    if (config.topLight != null) {
      this.topLight = config.topLight;
    }
    if (config.curvatureStrength != null) {
      this.curvatureStrength = config.curvatureStrength;
    }
    if (config.curvatureScale != null) {
      this.curvatureScale = config.curvatureScale;
    }
    if (config.rimStrength != null) {
      this.rimStrength = config.rimStrength;
    }
  }

  get lightDirection(): [number, number, number] {
    const { x, y, z } = this.uniforms.tileReliefLightDirection.value;
    return [x, y, z];
  }

  set lightDirection(value: [number, number, number]) {
    this.uniforms.tileReliefLightDirection.value.set(...value).normalize();
  }

  get ambient() {
    return this.uniforms.tileReliefAmbient.value;
  }

  set ambient(value: number) {
    this.uniforms.tileReliefAmbient.value = value;
  }

  get wrap() {
    return this.uniforms.tileReliefWrap.value;
  }

  set wrap(value: number) {
    this.uniforms.tileReliefWrap.value = value;
  }

  get directionalStrength() {
    return this.uniforms.tileReliefDirectionalStrength.value;
  }

  set directionalStrength(value: number) {
    this.uniforms.tileReliefDirectionalStrength.value = value;
  }

  get shadowStrength() {
    return this.uniforms.tileReliefShadowStrength.value;
  }

  set shadowStrength(value: number) {
    this.uniforms.tileReliefShadowStrength.value = value;
  }

  get topLight() {
    return this.uniforms.tileReliefTopLight.value;
  }

  set topLight(value: number) {
    this.uniforms.tileReliefTopLight.value = value;
  }

  get curvatureStrength() {
    return this.uniforms.tileReliefCurvatureStrength.value;
  }

  set curvatureStrength(value: number) {
    this.uniforms.tileReliefCurvatureStrength.value = value;
  }

  get curvatureScale() {
    return this.uniforms.tileReliefCurvatureScale.value;
  }

  set curvatureScale(value: number) {
    this.uniforms.tileReliefCurvatureScale.value = value;
  }

  get rimStrength() {
    return this.uniforms.tileReliefRimStrength.value;
  }

  set rimStrength(value: number) {
    this.uniforms.tileReliefRimStrength.value = value;
  }

  init(tiles: any) {
    this._tiles = tiles;

    tiles.traverse((tile: any) => {
      if (tile.engineData?.scene) {
        traverseAndApply(tile.engineData.scene, this);
      }
    }, null, false);

    this._onLoadModel = ({ scene }: { scene: Object3D }) => {
      traverseAndApply(scene, this);
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
