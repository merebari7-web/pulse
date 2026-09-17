/**
 * glsl.js — hand-written GLSL1 programs for every surface in the scene.
 *
 * Shared conventions
 *  - Lighting is authored in linear space and closed with three's own
 *    <tonemapping_fragment> + <colorspace_fragment> includes, so these
 *    programs grade exactly like MeshStandardMaterial and sit correctly in the
 *    postprocessing chain. That is also why the palette in config.js is handed
 *    to THREE.Color, which converts sRGB hex into linear on the way in.
 *  - Every lit program takes the same uLight* uniform block, refreshed once per
 *    frame from <Lights/>: the key light swings with the camera rig and the
 *    whole scene brightens on the S1 thump, so the lighting is genuinely
 *    responsive rather than baked.
 *  - Normals are flipped with gl_FrontFacing, which is why the procedural
 *    geometry never has to be careful about winding order.
 */

export const COMMON = /* glsl */ `
#define PI 3.141592653589793

float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

/* Gradient noise. Not Perlin, but ~8 ALU ops and invisible on organic skin. */
float vnoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, f.x);
  float x10 = mix(n010, n110, f.x);
  float x01 = mix(n001, n101, f.x);
  float x11 = mix(n011, n111, f.x);
  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z) * 0.5 + 0.5;
}

float fbm3(vec3 p){
  return vnoise(p) * 0.55 + vnoise(p * 2.03) * 0.28 + vnoise(p * 4.07) * 0.17;
}

/* Soft elliptical distance: signed and cheap, with no branches to go NaN.
   Good enough to punch an anti-aliased window through a wall. */
float band(float x, float width){
  return smoothstep(width, 0.0, abs(x));
}

vec3 paletteMix(vec3 a, vec3 b, float t){
  return mix(a, b, clamp(t, 0.0, 1.0));
}
`

export const LIGHT_UNIFORMS = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uFillDir;
uniform vec3 uRimColor;
uniform float uKey;
uniform float uFill;
uniform float uAmbient;
uniform float uRim;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;
`

export const GLOBAL_UNIFORM_DECL = /* glsl */ `
uniform float uTime;
uniform float uBeat;
uniform float uOpen;
uniform float uCut;
uniform float uDim;
uniform float uIsolate;
uniform float uHover;
uniform float uDust;
uniform float uBeatAmp;
uniform float uRumple;
`

export const FOG_FN = /* glsl */ `
float fogAmount(vec3 worldPos){
  float d = length(cameraPosition - worldPos);
  return smoothstep(uFogNear, uFogFar, d);
}
`

/* ------------------------------------------------------------------ tissue
   Myocardium, chamber cavities, septum, fat, vessels. One program, several
   define combinations, so there is exactly one place to fix the shading.     */

export const TISSUE_VERT = /* glsl */ `
attribute float aAlong;
attribute float aFace;
${COMMON}
${GLOBAL_UNIFORM_DECL}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vAlong;
varying float vThick;
varying float vFace;

void main(){
  vLocal = position;
  vAlong = aAlong;
  vFace = aFace;
  vec3 p = position;

  #ifdef HAS_BEAT
    /* the wall thickens toward systole and the whole organ shortens a touch */
    p += normal * uBeat * uBeatAmp;
    p.y += uBeat * 0.045;
  #endif

  #ifdef HAS_STRIATE
    /* low-frequency rumple so silhouettes are never perfectly lathed */
    float n = fbm3(position * 3.1 + vec3(0.0, uTime * 0.015, 0.0)) - 0.5;
    p += normal * n * uRumple;
  #endif

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vThick = 1.0 - clamp(aAlong, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const TISSUE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uEmissive;
uniform vec3 uEdgeCol;
uniform vec3 uHighlightCol;
uniform float uOpacity;
uniform float uStripes;
uniform float uStripeScale;
uniform float uTransmit;
uniform float uFresnelPow;
uniform float uEdgeGlow;
uniform float uFlow;
uniform float uFlowSign;
uniform float uHighlight;
uniform float uEmber;
${COMMON}
${LIGHT_UNIFORMS}
${GLOBAL_UNIFORM_DECL}
${FOG_FN}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vAlong;
varying float vThick;
varying float vFace;

void main(){
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uLightDir);

  float ndl = dot(N, L);
  float wrap = clamp((ndl + 0.42) / 1.42, 0.0, 1.0);
  float key = pow(wrap, 1.3) * uKey;
  float fill = clamp(dot(N, normalize(uFillDir)) * 0.5 + 0.5, 0.0, 1.0) * uFill;
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPow);
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 42.0) * 0.3;

  float stripes = 0.0;
  #ifdef HAS_STRIATE
    float wob = fbm3(vLocal * 1.7) * 2.4;
    stripes = sin(vLocal.y * uStripeScale + wob + vAlong * 6.0) * 0.5 + 0.5;
    stripes = pow(stripes, 1.7) * uStripes;
  #endif

  // 1 = outer (epicardial) face, 0 = inner (endocardial) face, 0.5 = cut rim
  float faceOuter = clamp(vFace, 0.0, 1.0);
  float rim = step(0.25, vFace) * (1.0 - step(0.75, vFace));
  vec3 base = paletteMix(uColor2, uColor, faceOuter * 0.85 + 0.15);
  base = mix(base, uColor, stripes * 0.5);
  float trans = pow(clamp(-ndl * 0.5 + 0.5, 0.0, 1.0), 2.6) * uTransmit * (1.0 - vThick * 0.4);
  float pulse = uBeat * (0.5 + 0.5 * fres);

  vec3 col = base * (uAmbient + key * uLightColor + fill * vec3(0.42, 0.52, 0.86));
  col += uRimColor * fres * uRim * (0.7 + pulse * 0.9);
  col += uEmissive * (uEmber + pulse * 1.35);
  col += base * trans * vec3(1.0, 0.4, 0.32) * 1.4;
  col += vec3(spec) * uLightColor;

  #ifdef HAS_FLOW
    /* intraluminal sheen. The sign is the direction of blood flow, which is a
       fact about the vessel, not a decoration. */
    float f = fract(vAlong * 3.0 - uTime * 0.13 * uFlowSign + uFlow);
    col += uEmissive * smoothstep(0.88, 1.0, f) * 0.6;
  #endif

  // the cut edge catches light like fresh tissue does
  col += uEdgeCol * rim * (0.28 + uBeat * 0.5) * uEdgeGlow;
  float edge = rim;

  col = mix(col, uHighlightCol * (0.6 + pulse), uHighlight * 0.5);
  col *= mix(1.0, 0.3, uDim);

  float alpha = uOpacity * (1.0 - edge * 0.45);
  alpha *= mix(1.0, 0.5, uDim * (1.0 - uIsolate));
  col = mix(col, uFogColor, fogAmount(vWorld) * 0.8);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ----------------------------------------------------------- pericardial sac
   Wet membrane: invisible head-on, bright at grazing angles, dissolving.    */

export const SAC_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform float uDissolve;
${COMMON}
${LIGHT_UNIFORMS}
${GLOBAL_UNIFORM_DECL}
${FOG_FN}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vAlong;
varying float vThick;
varying float vFace;

void main(){
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  float streak = fbm3(vLocal * vec3(1.7, 0.45, 1.7) + vec3(0.0, uTime * 0.05, 0.0));
  float a = (fres * 0.9 + streak * 0.14) * uOpacity;
  if (uDissolve > 0.0 && smoothstep(0.12, 0.9, streak) < uDissolve) discard;
  vec3 col = uColor * (0.32 + fres * 1.5 + uBeat * 0.3);
  col += uRimColor * fres * 0.5;
  gl_FragColor = vec4(col, a * (1.0 - uDim * 0.55));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* -------------------------------------------------------------------- wire
   The conduction system: a wavefront that runs 0 to 1 along each strand.     */

export const WIRE_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uFlow;
uniform float uWidth;
uniform float uActive;
${COMMON}
${LIGHT_UNIFORMS}
${GLOBAL_UNIFORM_DECL}
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vAlong;
varying float vThick;

void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 1.4);
  float after = (1.0 - smoothstep(0.0, 0.4, uFlow - vAlong)) * step(vAlong, uFlow);
  float head = band(uFlow - vAlong, 0.055);
  float rest = 0.14 + 0.09 * sin(vAlong * 52.0 - uTime * 1.7);
  float glow = rest + after * 0.6 + head * 2.4;
  vec3 col = mix(uColor, uHot, clamp(head * 1.5 + after * 0.45, 0.0, 1.0));
  col *= (0.55 + rim * 0.9) * uWidth;
  col += uHot * head * 1.8;
  float a = clamp(glow, 0.0, 1.5) * uOpacity * uActive;
  gl_FragColor = vec4(col * (0.7 + uBeat * 0.9), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ----------------------------------------------------------------- points */

export const POINTS_VERT = /* glsl */ `
attribute vec3 aSeed;
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uBeat;
uniform float uOpen;
uniform float uDust;
uniform float uPixelRatio;
uniform float uDepth;
varying float vFade;
varying float vSeed;

void main(){
  vec3 p = position;
  float t = uTime * (0.02 + aSeed.x * 0.05);
  p += vec3(sin(t + aPhase * 6.283), cos(t * 0.83 + aPhase * 4.1), sin(t * 0.61 - aPhase * 2.7)) * (0.35 + aSeed.y * 0.7);
  p += normalize(p + vec3(1e-3)) * (uOpen * 0.85 + uBeat * 0.4) * (0.35 + aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * (1.0 + uBeat * 0.45) * max(uDust, 0.0);
  gl_PointSize = min(size * uPixelRatio * (uDepth / max(0.001, -mv.z)), 28.0);
  vFade = clamp(1.0 - (-mv.z) / 46.0, 0.0, 1.0) * (0.2 + aSeed.x * 0.8) * uDust;
  vSeed = aPhase;
  gl_Position = projectionMatrix * mv;
}
`

export const POINTS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
varying float vFade;
varying float vSeed;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.02, d);
  float halo = smoothstep(0.5, 0.16, d) * 0.3;
  vec3 col = mix(uColor, uColor2, fract(vSeed * 7.13));
  gl_FragColor = vec4(col, (core + halo) * vFade * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const SPARK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uOpacity;
varying float vFade;
varying float vSeed;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  vec3 col = mix(uColor, uHot, core);
  gl_FragColor = vec4(col, core * vFade * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ------------------------------------------------------------------ chart */

/* The bar geometry is authored as a unit-tall box with its base on y = 0, and
   each vertex carries the height it should reach (aTarget) plus its index for
   the sequential reveal. So "grow the chart" is one multiply, in the vertex
   stage, driven by the scroll track — no per-frame buffer uploads. */
export const CHART_VERT = /* glsl */ `
attribute float aTarget;
attribute float aIndex;
uniform float uGrowth;
uniform float uTime;
uniform float uBeat;
varying float vH;
varying float vY;
varying vec3 vLocal;
varying float vIdx;

void main(){
  float k = clamp(uGrowth * 1.45 - aIndex * 0.1, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  float grow = mix(0.004, aTarget, k);
  vec3 p = position;
  p.y *= grow;
  p.xz *= mix(0.78, 1.0, k);
  vH = grow;
  vY = clamp(position.y * 2.0, 0.0, 1.0);
  vLocal = p;
  vIdx = aIndex;
  p.y += sin(uTime * 0.9 + aIndex * 1.7) * 0.007 * (0.5 + uBeat);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const CHART_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform vec3 uBase;
uniform float uOpacity;
uniform float uGrowth;
uniform float uBeat;
${COMMON}
varying float vH;
varying float vY;
varying vec3 vLocal;
varying float vIdx;

void main(){
  float cap = smoothstep(0.9, 0.99, vY);
  vec3 col = mix(uBase, uColor, vY * vY);
  col = mix(col, uHot, cap * 0.85);
  float ticks = smoothstep(0.88, 1.0, fract(vY * 10.0)) * 0.22;
  col += uHot * ticks;
  float a = uOpacity * (0.8 + cap * 0.2) * smoothstep(0.0, 0.06, uGrowth * 1.45 - vIdx * 0.1);
  col *= 0.75 + cap * 1.8 + uBeat * 0.2;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* ----------------------------------------------------------------- ribbon */

export const RIBBON_VERT = /* glsl */ `
attribute float aAlong;
uniform float uAmp;
varying float vAlong;
varying vec2 vUv;
void main(){
  vAlong = aAlong;
  vUv = uv;
  vec3 p = position;
  p.y *= uAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const RIBBON_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uReveal;
uniform float uBeat;
uniform float uTime;
uniform float uOpacity;
${COMMON}
varying float vAlong;
varying vec2 vUv;
void main(){
  float k = smoothstep(vAlong - 0.04, vAlong + 0.015, uReveal);
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float body = smoothstep(0.0, 0.6, across);
  float head = band(uReveal - vAlong, 0.05);
  vec3 col = mix(uColor, uHot, head * 0.85 + body * 0.15);
  float a = (body * 0.7 + head * 1.15) * uOpacity * k;
  col *= 1.0 + head * 2.1 + uBeat * 0.25;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/* -------------------------------------------------------------- pedestal */

export const GROUND_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const GROUND_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uBeat;
uniform float uOpen;
${COMMON}
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float halo = pow(1.0 - clamp(r, 0.0, 1.0), 3.2);
  float ring = smoothstep(0.02, 0.0, band(r - 0.82, 0.006));
  float grid = smoothstep(0.9, 1.0, max(sin(p.x * 24.0), sin(p.y * 24.0))) * 0.1;
  float shock = band(r - fract(uTime * 0.2) * 1.5, 0.05) * uBeat * 0.55;
  float a = (halo * 0.8 + ring * 0.22 + grid + shock) * uOpacity * (1.0 - uOpen * 0.3);
  gl_FragColor = vec4(uColor * (halo * 1.5 + ring * 0.6 + 0.2), a * 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** name → program, for the material factory. */
export const SHADERS = {
  tissue: { vertex: TISSUE_VERT, fragment: TISSUE_FRAG },
  sac: { vertex: TISSUE_VERT, fragment: SAC_FRAG },
  wire: { vertex: TISSUE_VERT, fragment: WIRE_FRAG },
  points: { vertex: POINTS_VERT, fragment: POINTS_FRAG },
  spark: { vertex: POINTS_VERT, fragment: SPARK_FRAG },
  chart: { vertex: CHART_VERT, fragment: CHART_FRAG },
  ribbon: { vertex: RIBBON_VERT, fragment: RIBBON_FRAG },
  ground: { vertex: GROUND_VERT, fragment: GROUND_FRAG },
}
