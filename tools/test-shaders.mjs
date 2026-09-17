/**
 * test-shaders.mjs — compile-time checks for the hand-written GLSL.
 *
 *   node tools/test-shaders.mjs        (or: npm run check:shaders)
 *
 * There is no GPU in CI, so these are the failures that would otherwise only
 * show up as a black canvas in front of a user:
 *   • a shader that does not parse (typo, unbalanced brace, stray `in`/`out`)
 *   • a `#include <chunk>` that three does not ship
 *   • a uniform the shader declares but the material never supplies (three feeds
 *     it 0, and the surface silently goes black or unlit)
 *   • a varying read in the fragment stage that the vertex stage never declares
 *     or never writes
 *   • an attribute the geometry never builds
 *   • an undeclared function or type (the parser knows the GLSL ES builtins, so
 *     a misspelt `refract`/`texture2D` is a hit)
 */
import assert from "node:assert/strict"
import * as THREE from "three"
import parse from "@shaderfrog/glsl-parser/parser/index.js"

const { SHADERS } = await import("../src/three/glsl.js")
const materials = await import("../src/three/materials.js")
const build = await import("../src/three/heart/build.js")
const geo = await import("../src/three/geometry.js")
const anatomy = await import("../src/data/anatomy.js")
const { BAR } = await import("../src/lib/chart.js")

const out = []
const log = (...a) => {
  out.push(a.join(" "))
  console.log(...a)
}

/** three's WebGLProgram.resolveIncludes, so the source we check is the source it builds. */
function resolveIncludes(source) {
  return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (match, name) => {
    const chunk = THREE.ShaderChunk[name]
    if (chunk === undefined) throw new Error(`unknown #include <${name}>`)
    return chunk
  })
}

/* A prefix that declares what three gives every ShaderMaterial, so the parser is
   not told that `position` and `projectionMatrix` are undeclared. */
const PREFIX_VERTEX = /* glsl */ `
precision highp float;
precision highp int;
#define SHADER_TYPE ShaderMaterial
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
`
// three generates these two wrappers into prefixFragment (toneMapping from the
// tonemapping chunk, linearToOutputTexel from the colour-space one), so a stub
// with the same signature is what the real program will see.
const PREFIX_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
#define SHADER_TYPE ShaderMaterial
#define TONE_MAPPING
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
vec4 toneMapping(vec4 color) { return color; }
vec4 linearToOutputTexel(vec4 color) { return color; }
`

/** every material in the scene, so the declared-vs-supplied check covers all of them */
const MATERIALS = {
  tissue: materials.makeTissue({}),
  blood: materials.makeBlood({}),
  vessel: materials.makeVessel({}),
  sac: materials.makeSac(0.4),
  wire: materials.makeWire({}),
  dust: materials.makeDustMaterial({}),
  sparks: materials.makeSparks(),
  chart: materials.makeChart(),
  ribbon: materials.makeRibbon(),
  ground: materials.makeGround(),
  node: materials.makeNodeMaterial(),
}

/* attributes the geometry pipeline really produces */
const ATTRIBUTES = new Set(["position", "normal", "uv"])
{
  const model = build.buildModel({ fit: true })
  for (const p of model.parts) for (const name of Object.keys(p.geometry.attributes)) ATTRIBUTES.add(name)
  const extra = [
    geo.makeDust({ count: 24 }),
    geo.makeTrail({ count: 24, curves: [] }),
    geo.makeBlob({ rows: 8, radial: 8 }),
    geo.makeRibbon({ len: 4, seg: 8, waves: anatomy.ECG.waves }),
  ]
  for (const g of extra) for (const name of Object.keys(g.attributes)) ATTRIBUTES.add(name)
  // the chart bars are merged by hand in DataViz.jsx
  for (const n of ["aTarget", "aIndex"]) ATTRIBUTES.add(n)
}

const BUILTIN_OK = new Set(["gl_Position", "gl_PointSize", "gl_PointCoord", "gl_FragCoord", "gl_FragColor", "gl_FrontFacing"])
let problems = 0
const fail = (msg) => {
  problems++
  console.error(`  ✗ ${msg}`)
  out.push(`FAIL ${msg}`)
}

for (const [name, src] of Object.entries(SHADERS)) {
  const vert = src.vertex
  const frag = src.fragment
  const stages = { vertex: vert, fragment: frag }

  /* ---- 1. includes resolve (a bad chunk name is a hard three error) ---- */
  let v, f
  try {
    v = resolveIncludes(vert)
    f = resolveIncludes(frag)
  } catch (e) {
    fail(`${name}: ${e.message}`)
    continue
  }

  /* ---- 2. GLSL ES 1.00 only: three feeds these to a GLSL1 program ---- */
  for (const [stage, code] of [
    ["vertex", v],
    ["fragment", f],
  ]) {
    if (/\battribute\b/.test(code) && stage === "fragment") fail(`${name}: attribute in a fragment shader`)
    if (/^\s*(in|out)\s+\w/m.test(code)) fail(`${name}: GLSL3 in/out syntax in an ESSL1 shader`)
    if (/\bvtxPosition\b/.test(code)) fail(`${name}: stray identifier`)
  }
  if (!/gl_FragColor/.test(f)) fail(`${name}: fragment shader never writes gl_FragColor`)
  if (/\btexture\s*\(/.test(v + f) && !/#include/.test(v + f)) fail(`${name}: texture() is GLSL3; use texture2D`)

  /* ---- 3. parse both stages, and let the parser's GLSL knowledge judge them ---- */
  const warns = []
  const realWarn = console.warn
  console.warn = (...a) => warns.push(a.join(" "))
  let vErr = null
  let fErr = null
  try {
    parse(PREFIX_VERTEX + v, { quiet: false, noErr: false })
  } catch (e) {
    vErr = e
  }
  try {
    parse(PREFIX_FRAGMENT + f, { quiet: false, noErr: false })
  } catch (e) {
    fErr = e
  }
  console.warn = realWarn
  if (vErr) fail(`${name} vertex: parse error — ${String(vErr.message).split("\n")[0]}`)
  if (fErr) fail(`${name} fragment: parse error — ${String(fErr.message).split("\n")[0]}`)
  for (const w of warns) {
    const m = /undeclared (function|type): "?([\w]+)/i.exec(w)
    if (m && !BUILTIN_OK.has(m[2])) fail(`${name}: undeclared ${m[1]} "${m[2]}"`)
  }

  /* ---- 4. declarations: uniforms, varyings, attributes ---- */
  const decl = (code, kind) => {
    const re = new RegExp(`^\\s*${kind}\\s+(\\w+)\\s+([A-Za-z_]\\w*)\\s*(\\[\\s*\\w*\\s*\\])?\\s*;`, "gm")
    const map = new Map()
    for (const mm of code.matchAll(re)) map.set(mm[2], mm[1])
    return map
  }
  const uV = decl(v, "uniform")
  const uF = decl(f, "uniform")
  const gV = decl(v, "varying")
  const gF = decl(f, "varying")
  const aV = decl(v, "attribute")

  // every uniform the shader wants must be supplied by the material that uses it
  const owner = Object.entries(MATERIALS).find(([, m]) => m.vertexShader === vert && m.fragmentShader === frag)
  if (owner) {
    const [, mat] = owner
    const declared = new Set([...uV.keys(), ...uF.keys()])
    for (const u of declared) {
      if (u in mat.uniforms) continue
      if (/^(modelMatrix|modelViewMatrix|projectionMatrix|viewMatrix|normalMatrix|cameraPosition|isOrthographic)$/.test(u)) continue
      fail(`${name}: shader declares uniform ${u} but ${owner[0]} never supplies one (three will feed 0)`)
    }
  } else {
    // shared vertex shaders (the tissue program drives sac/wire/etc.) — check against the union
    const all = new Set()
    for (const m of Object.values(MATERIALS)) for (const u of Object.keys(m.uniforms || {})) all.add(u)
    for (const u of [...uV.keys(), ...uF.keys()]) {
      if (!all.has(u) && !/^(modelMatrix|modelViewMatrix|projectionMatrix|viewMatrix|normalMatrix|cameraPosition|isOrthographic)$/.test(u)) {
        fail(`${name}: uniform ${u} is not supplied by any material in the scene`)
      }
    }
  }

  // varyings: declared in both stages with the same type, and written in the vertex stage
  for (const [g, type] of gF) {
    if (!gV.has(g)) {
      fail(`${name}: fragment reads varying ${g} (${type}) that the vertex shader never declares`)
      continue
    }
    if (gV.get(g) !== type) fail(`${name}: varying ${g} is ${gV.get(g)} in the vertex stage but ${type} in the fragment stage`)
    const written = new RegExp(`\\b${g}\\s*(\\.\\w+)?\\s*[-+*/]?=`, "").test(v)
    if (!written) fail(`${name}: varying ${g} is declared in the vertex shader but never assigned`)
  }
  for (const g of gV.keys()) {
    if (!gF.has(g)) log(`  · ${name}: varying ${g} written in the vertex stage and unused in the fragment stage`)
  }

  // attributes must exist on the geometry
  for (const a of aV.keys()) {
    if (!ATTRIBUTES.has(a) && !["uv1", "uv2", "color", "tangent"].includes(a)) fail(`${name}: attribute ${a} is built by no geometry in the project`)
  }
}

/* ---- 5. the chart layout constants the DOM mirror uses must be in the shader's reach ---- */
{
  const chartMat = MATERIALS.chart
  const glsl = SHADERS.chart.vertex
  assert.ok(/uGrowth/.test(glsl), "chart vertex must be driven by uGrowth")
  assert.ok("uGrowth" in chartMat.uniforms, "the chart material must own uGrowth")
  assert.ok(BAR.maxH > 0 && BAR.floor < 0, "bar layout constants look wrong")
}

for (const m of Object.values(MATERIALS)) m.dispose?.()

if (problems) {
  console.error(`\n✗ ${problems} shader problem(s)`)
  process.exit(1)
}
console.log(`\n  ✓ ${Object.keys(SHADERS).length} shader programs, ${Object.keys(MATERIALS).length} materials: all contracts hold`)
