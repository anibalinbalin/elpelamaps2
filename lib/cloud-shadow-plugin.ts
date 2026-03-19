/**
 * CloudShadowPlugin
 *
 * Injects the same FBM simplex noise used by the cloud shader into
 * Google tile fragment shaders, darkening the terrain under clouds.
 */

import type { Object3D, Mesh, Material } from "three";

const WRAPPED = Symbol("cloudShadow");

interface WrappedMaterial extends Material {
  [WRAPPED]?: boolean;
  onBeforeCompile: (shader: any, renderer: any) => void;
}

interface CloudShadowConfig {
  intensity?: number;
  cloudSize?: number;
}

const sharedTime = { value: 0 };

// The noise GLSL (prefixed to avoid collisions)
const NOISE_GLSL = /* glsl */ `
vec3 csmod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 csmod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 cspermute(vec4 x){return csmod289(((x*34.0)+10.0)*x);}
vec4 cstaylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float cssnoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=csmod289(i);
  vec4 p=cspermute(cspermute(cspermute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=cstaylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float csfbm(vec3 p){
  float v=0.0;float a=0.5;
  for(int i=0;i<5;i++){v+=a*cssnoise(p);p*=2.0;a*=0.5;}
  return v;
}
`;

function wrapMaterial(material: WrappedMaterial, config: CloudShadowConfig) {
  if (material[WRAPPED]) return;
  material[WRAPPED] = true;

  const prev = material.onBeforeCompile?.bind(material);
  const intensity = config.intensity ?? 0.3;
  const cloudSize = config.cloudSize ?? 50000;

  material.onBeforeCompile = (shader: any, renderer: any) => {
    if (prev) prev(shader, renderer);

    shader.uniforms.csTime = sharedTime;
    shader.uniforms.csShadowIntensity = { value: intensity };
    shader.uniforms.csCloudSize = { value: cloudSize };

    // VERTEX: add varying for world position
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vCsWorldPos;`
    );
    // Inject after project_vertex — always runs, even for MeshBasicMaterial
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
vCsWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
    );

    // FRAGMENT: add noise functions, uniforms, varying
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vCsWorldPos;
uniform float csTime;
uniform float csShadowIntensity;
uniform float csCloudSize;
${NOISE_GLSL}`
    );

    // FRAGMENT: inject shadow after dithering (last include before closing brace)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
vec2 csUV = vCsWorldPos.xz / csCloudSize + 0.5;
vec3 csNoiseCoord = vec3(csUV * 3.0, csTime * 0.02);
csNoiseCoord.x += csTime * 0.01;
float csDensity = csfbm(csNoiseCoord);
float csShadow = smoothstep(0.1, 0.6, csDensity);
gl_FragColor.rgb *= 1.0 - csShadow * csShadowIntensity;`
    );
  };

  material.needsUpdate = true;
}

function traverseAndWrap(scene: Object3D, config: CloudShadowConfig) {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => wrapMaterial(m as WrappedMaterial, config));
    } else {
      wrapMaterial(mesh.material as WrappedMaterial, config);
    }
  });
}

export class CloudShadowPlugin {
  name = "CloudShadowPlugin";
  private _config: CloudShadowConfig;
  private _onLoadModel: ((event: any) => void) | null = null;
  private _onUpdateAfter: (() => void) | null = null;
  private _tiles: any = null;
  private _lastTime = 0;

  constructor(config: CloudShadowConfig = {}) {
    this._config = config;
  }

  init(tiles: any) {
    this._tiles = tiles;
    this._onLoadModel = ({ scene }: { scene: Object3D }) => {
      traverseAndWrap(scene, this._config);
    };
    tiles.addEventListener("load-model", this._onLoadModel);

    this._lastTime = performance.now() / 1000;
    this._onUpdateAfter = () => {
      const now = performance.now() / 1000;
      sharedTime.value += now - this._lastTime;
      this._lastTime = now;
    };
    tiles.addEventListener("update-after", this._onUpdateAfter);
  }

  dispose() {
    if (this._tiles) {
      if (this._onLoadModel) this._tiles.removeEventListener("load-model", this._onLoadModel);
      if (this._onUpdateAfter) this._tiles.removeEventListener("update-after", this._onUpdateAfter);
    }
    this._tiles = null;
    this._onLoadModel = null;
    this._onUpdateAfter = null;
  }
}
