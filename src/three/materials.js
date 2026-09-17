import * as THREE from "three"
import { SHADERS } from "./glsl.js"
import { PALETTE, TUNE } from "../config.js"
import { scene } from "../lib/store.js"

/**
 * materials.js — the only place that constructs a THREE.Material.
 *
 * Two groups:
 *  1. Custom `ShaderMaterial`s (tissue / sac / wire / chart / ribbon / points).
 *     They share TWO uniform objects by reference — `G` (per-frame journey
 *     state) and `L` (the live light rig). One write per frame updates every
 *     material in the scene at once; there is no per-mesh uniform plumbing and
 *     no material recompile.
 *  2. `MeshPhysicalMaterial`s for the valve cusps and epicardial fat, which are
 *     the two things that really want three's real BRDF (clearcoat + a little
 *     iridescence on wet tissue). They read the actual scene lights, and the
 *     custom programs read the same numbers mirrored into `L`.
 */

export const G = {
  uTime: { value: 0 },
  uBeat: { value: 0 },
  uOpen: { value: 0 },
  uCut: { value: 0 },
  uDim: { value: 0 },
  uIsolate: { value: 0 },
  uHover: { value: 0 },
  uDust: { value: 1 },
  uBeatAmp: { value: 0.024 },
  uRumple: { value: 0.05 },
}

export const L = {
  uLightDir: { value: new THREE.Vector3(0.45, 0.72, 0.66).normalize() },
  uLightColor: { value: new THREE.Color(PALETTE.key) },
  uFillDir: { value: new THREE.Vector3(-0.6, -0.25, -0.75).normalize() },
  uRimColor: { value: new THREE.Color(PALETTE.rim) },
  uKey: { value: 1.15 },
  uFill: { value: 0.4 },
  uAmbient: { value: 0.16 },
  uRim: { value: 0.75 },
  uFogNear: { value: TUNE.fog.near },
  uFogFar: { value: TUNE.fog.far },
  uFogColor: { value: new THREE.Color(PALETTE.bg) },
}

const registry = new Set()

/** Linear colour from an sRGB hex string (three converts on the way in). */
export const col = (hex, mul = 1) => new THREE.Color(hex).multiplyScalar(mul)

export function makeShader(kind, { defines = {}, uniforms = {}, blending, depthWrite = true, depthTest = true, side = THREE.DoubleSide, toneMapped = true } = {}) {
  const src = SHADERS[kind]
  if (!src) throw new Error(`[materials] unknown shader "${kind}"`)
  const m = new THREE.ShaderMaterial({
    vertexShader: src.vertex,
    fragmentShader: src.fragment,
    defines,
    transparent: blending !== undefined || depthWrite === false || uniforms.uOpacity?.value < 1,
    depthWrite,
    depthTest,
    side,
    toneMapped,
    blending: blending ?? THREE.NormalBlending,
    uniforms: { ...G, ...L, ...uniforms },
  })
  // the shared uniform objects are *the same references*, so one write per
  // frame drives every material; registry lets us dispose deterministically.
  registry.add(m)
  return m
}

const add = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k)

/* --------------------------------------------------------------- programs */

/** Myocardium: the cuttable, striated, beating muscle shell. */
export function makeTissue({
  color = PALETTE.myo,
  color2 = PALETTE.myoDeep,
  emissive = PALETTE.oxyDeep,
  opacity = 1,
  stripes = 0.35,
  stripeScale = 9,
  transmit = 0.5,
  beat = true,
  striate = true,
  ember = 0.12,
  rumple = 0.05,
}) {
  return makeShader("tissue", {
    defines: {
      ...(beat ? { HAS_BEAT: 1 } : {}),
      ...(striate ? { HAS_STRIATE: 1 } : {}),
    },
    uniforms: {
      uColor: { value: add(color) },
      uColor2: { value: add(color2) },
      uEmissive: { value: add(emissive, 1.4) },
      uEdgeCol: { value: add(PALETTE.endo) },
      uHighlightCol: { value: add(PALETTE.ember, 1.6) },
      uOpacity: { value: opacity },
      uStripes: { value: stripes },
      uStripeScale: { value: stripeScale },
      uTransmit: { value: transmit },
      uFresnelPow: { value: 2.6 },
      uEdgeGlow: { value: 1.0 },
      uFlow: { value: 0 },
      uFlowSign: { value: 1 },
      uHighlight: { value: 0 },
      uEmber: { value: ember },
      /* uRumple also lives in the shared G block; passing our own object here
         shadows it *for this material only*. Never write to G's copy per part —
         that would move every surface in the scene. */
      uRumple: { value: rumple },
    },
  })
}

/** Chamber cavities — blood, lit from inside, dimmed when the wire is the focus. */
export function makeBlood({ oxy = true, opacity = 0.92 } = {}) {
  return makeShader("tissue", {
    defines: { HAS_BEAT: 1 },
    uniforms: {
      uColor: { value: add(oxy ? PALETTE.oxy : PALETTE.deoxy) },
      uColor2: { value: add(oxy ? PALETTE.oxyDeep : PALETTE.deoxyDeep) },
      uEmissive: { value: add(oxy ? PALETTE.oxy : PALETTE.deoxy, 0.85) },
      uEdgeCol: { value: add(PALETTE.endo) },
      uHighlightCol: { value: add(PALETTE.ember, 1.8) },
      uOpacity: { value: opacity },
      uStripes: { value: 0.18 },
      uStripeScale: { value: 16 },
      uTransmit: { value: 0.9 },
      uFresnelPow: { value: 3.2 },
      uEdgeGlow: { value: 0 },
      uFlow: { value: 0 },
      uFlowSign: { value: 1 },
      uHighlight: { value: 0 },
      uEmber: { value: 0.5 },
    },
  })
}

/** Great vessels: same surface as muscle, plus a sheen that travels with flow. */
export function makeVessel({ oxy = true, opacity = 1 } = {}) {
  const m = makeTissue({
    color: oxy ? PALETTE.oxy : PALETTE.deoxy,
    color2: oxy ? PALETTE.oxyDeep : PALETTE.deoxyDeep,
    emissive: oxy ? "#ff6a5a" : "#4a76ff",
    opacity,
    stripes: 0.22,
    stripeScale: 26,
    transmit: 0.35,
    ember: 0.16,
  })
  m.defines.HAS_FLOW = 1
  m.needsUpdate = true
  return m
}

/** The pericardial sac. */
export function makeSac(opacity = 0.5) {
  return makeShader("sac", {
    defines: { HAS_BEAT: 1 },
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: opacity }, uColor: { value: add(PALETTE.sac, 0.9) }, uDissolve: { value: 0 } },
  })
}

/** The conduction system. Additive, so it reads as light, not plastic. */
export function makeWire({ color = PALETTE.wire, hot = PALETTE.wireHot, width = 1, active = 1 } = {}) {
  return makeShader("wire", {
    defines: { HAS_BEAT: 1 },
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0.95 },
      uColor: { value: add(color, 1.1) },
      uHot: { value: add(hot, 2.2) },
      uFlow: { value: 0 },
      uWidth: { value: width },
      uActive: { value: active },
    },
  })
}

export function makeDustMaterial({ color = PALETTE.endo, color2 = PALETTE.rim } = {}) {
  return makeShader("points", {
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: add(color, 0.8) },
      uColor2: { value: add(color2, 0.8) },
      uOpacity: { value: 0.5 },
      uPixelRatio: { value: 1 },
      uDepth: { value: 320 },
    },
  })
}

export function makeSparks() {
  return makeShader("spark", {
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: add(PALETTE.wire, 1.2) }, uHot: { value: add(PALETTE.wireHot, 2.6) }, uOpacity: { value: 0.9 }, uPixelRatio: { value: 1 }, uDepth: { value: 260 } },
  })
}

export function makeChart() {
  return makeShader("chart", {
    uniforms: {
      uColor: { value: add(PALETTE.oxy, 1.1) },
      uHot: { value: add(PALETTE.ember, 2.0) },
      uBase: { value: add(PALETTE.deoxyDeep, 0.8) },
      uOpacity: { value: 0.94 },
      /* uGrowth is written per-frame by <DataViz/>; uTime/uBeat arrive from G */
      uGrowth: { value: 0 },
    },
  })
}

export function makeRibbon() {
  return makeShader("ribbon", {
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: add(PALETTE.surge, 1.1) }, uHot: { value: add(PALETTE.wireHot, 2.4) }, uReveal: { value: 0 }, uAmp: { value: 1 }, uOpacity: { value: 0.95 } },
  })
}

export function makeGround() {
  return makeShader("ground", {
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: add(PALETTE.oxyDeep, 1.3) }, uOpacity: { value: 0.5 } },
  })
}

/* --------------------------------------------------- real three materials */

/** Valve cusps: wet, pearly, slightly translucent at the free edge. */
export function makeValveMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PALETTE.valve),
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.35,
    sheen: 0.6,
    sheenColor: new THREE.Color(PALETTE.oxy),
    transmission: 0.12,
    thickness: 0.3,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.97,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
  })
  registry.add(m)
  return m
}

/** Epicardial fat: greasy, subsurface, matte. */
export function makeFatMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PALETTE.fat),
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.6,
    sheen: 0.4,
    sheenColor: new THREE.Color("#ffe6bd"),
    transmission: 0.08,
    thickness: 0.6,
  })
  registry.add(m)
  return m
}

/** Node spheres for the conduction system + hotspots. */
export function makeNodeMaterial(hot = PALETTE.wireHot) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hot), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  registry.add(m)
  return m
}

/** Mirror the live light rig into the custom programs. Called from <Lights/>. */
export function syncLightUniforms({ key, fill, ambient, rimColor, dir, fillDir, fog }) {
  if (key) {
    L.uLightColor.value.copy(key.color).multiplyScalar(1)
    L.uKey.value = key.intensity
  }
  if (fill) L.uFill.value = fill.intensity
  if (ambient) L.uAmbient.value = ambient.intensity
  if (rimColor) L.uRimColor.value.copy(rimColor)
  if (dir) L.uLightDir.value.copy(dir).normalize()
  if (fillDir) L.uFillDir.value.copy(fillDir).normalize()
  if (fog) {
    L.uFogNear.value = fog.near
    L.uFogFar.value = fog.far
    L.uFogColor.value.set(PALETTE.bg)
  }
}

/** Push the resolved scroll state into the shared uniforms. Once per frame. */
export function syncGlobals() {
  G.uOpen.value = scene.open ?? 0
  G.uCut.value = scene.cut ?? 0
  G.uDim.value = scene.dim ?? 0
  G.uIsolate.value = scene.isolate ?? 0
  G.uDust.value = scene.dust ?? 1
}

export function disposeAll() {
  for (const m of registry) m.dispose?.()
  registry.clear()
}
