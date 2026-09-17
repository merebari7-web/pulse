import "./_dom-globals.mjs"
import assert from "node:assert/strict"
import React from "react"
import * as THREE from "three"
import RTTR from "@react-three/test-renderer"
import { useThree } from "@react-three/fiber"

/**
 * test-scene.mjs — the whole 3D tree, run for real, without a GPU.
 *
 * @react-three/test-renderer boots react-three-fiber against a mock WebGL
 * context, so every component body, every useMemo build and every useFrame
 * callback in this project actually executes. That is what makes the assertions
 * below worth anything: they are not a re-implementation of the scene, they are
 * the scene, stepped frame by frame and measured in its own scene graph.
 *
 *   npm run check:scene      (esbuild bundles this file, node runs it)
 */

const { CHAPTERS, TRACKS } = await import("../src/data/journey.js")
const anatomy = await import("../src/data/anatomy.js")
const store = await import("../src/lib/store.js")
const anim = await import("../src/three/anim.js")
const { quality, motion } = await import("../src/lib/motion.js")
const { getAnchor } = await import("../src/three/registry.js")
const { labelDefs } = await import("../src/three/labels.js")
const { BAR, barTopWorld } = await import("../src/lib/chart.js")
const { makeRig } = await import("../src/three/explode.js")
const { Driver } = await import("../src/three/Driver.jsx")
const { Rig } = await import("../src/three/Rig.jsx")
const { Lights } = await import("../src/three/Lights.jsx")
const { Heart } = await import("../src/three/Heart.jsx")
const { Ground } = await import("../src/three/Ground.jsx")
const { Particles, Trail } = await import("../src/three/Particles.jsx")
const { Hotspots } = await import("../src/three/Hotspot.jsx")
const { DataViz, BAR_LABEL_PAD } = await import("../src/three/DataViz.jsx")
const { LabelDriver } = await import("../src/three/labels.js")

let pass = 0
const fails = []
async function check(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  · ${name}`)
  } catch (e) {
    fails.push(`${name}\n    ${String(e?.message || e).split("\n").join("\n    ")}`)
    console.error(`  ✗ ${name}\n    ${String(e?.message || e).split("\n").join("\n    ")}`)
  }
}
const near = (a, b, eps, msg) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= eps, `${msg} expected ${b} ±${eps}, got ${a}`)

const probe = {}
function Probe() {
  const { scene, camera, gl, size } = useThree()
  Object.assign(probe, { scene, camera, gl, size })
  return null
}
const h = React.createElement
const Tree = () =>
  h(
    React.Fragment,
    null,
    h(Probe),
    h(Driver),
    h(Rig),
    h(Lights),
    h(Heart),
    h(Ground),
    h(Particles),
    h(Trail),
    h(Hotspots),
    h(DataViz),
    h(LabelDriver),
  )

/* dispose counters, installed before anything is built */
let geoDisposed = 0
let matDisposed = 0
const realGeoDispose = THREE.BufferGeometry.prototype.dispose
const realMatDispose = THREE.Material.prototype.dispose
THREE.BufferGeometry.prototype.dispose = function (...a) {
  geoDisposed++
  return realGeoDispose.apply(this, a)
}
THREE.Material.prototype.dispose = function (...a) {
  matDisposed++
  return realMatDispose.apply(this, a)
}

store.configure({ chapters: CHAPTERS, tracks: TRACKS, viewport: 900, offset: 0 })
anim.prime()

const renderer = await RTTR.create(h(Tree), { width: 1280, height: 800 })
const settle = async (scroll, frames = 90) => {
  await RTTR.act(async () => {
    store.applyScroll(scroll)
    renderer.advanceFrames(frames, 1 / 60)
  })
}

await check("the scene builds without throwing, in every chapter", async () => {
  assert.ok(probe.scene, "no scene handle")
  assert.equal(motion.tier, "low", `expected the software-GL fallback tier, got ${motion.tier}`)
  assert.equal(quality.ao, false, "the low tier must skip AO")
  const roots = probe.scene.children.length
  assert.ok(roots >= 8, `only ${roots} root nodes — most of the scene did not mount`)
})

await check("no transform goes non-finite anywhere in the graph", async () => {
  for (const [label, t] of [["top", 0], ["exploded", 0.3], ["focus", 0.52], ["data", 0.78], ["exam", 0.97]]) {
    await settle(t, 110)
    let bad = null
    probe.scene.traverse((o) => {
      if (bad) return
      const p = o.position
      const s = o.scale
      const r = o.rotation
      if (![p.x, p.y, p.z, s.x, s.y, s.z, r.x, r.y, r.z].every(Number.isFinite)) bad = `${o.name || o.type} at ${label}`
      o.updateMatrixWorld(true)
      const e = o.matrixWorld.elements
      if (!e.every(Number.isFinite)) bad = `${o.name || o.type} world matrix at ${label}`
    })
    assert.equal(bad, null, bad || "")
  }
})

await check("scroll opens the shell: every wall flap actually leaves home", async () => {
  await settle(0, 140)
  const closed = new Map()
  for (const id of ["ventricular-lf", "ventricular-rf", "atrial-lf", "apical-ap"]) {
    const a = getAnchor(id)
    assert.ok(a, `anchor "${id}" was never registered`)
    closed.set(id, a.getWorldPosition(new THREE.Vector3()).clone())
  }
  await settle(0.3, 140)
  let moved = 0
  for (const [id, before] of closed) {
    const after = getAnchor(id).getWorldPosition(new THREE.Vector3())
    const d = after.distanceTo(before)
    if (d > 0.8) moved++
    assert.ok(d > 0.5, `${id} moved only ${d.toFixed(2)} units when the shell opened`)
  }
  assert.equal(moved, closed.size, "some flaps stayed put")
})

await check("the data chapter hands over: organ shrinks, bars grow, labels sit on top", async () => {
  await settle(0.78, 160)
  assert.ok(anim.A.chart > 0.8, `A.chart only reached ${anim.A.chart.toFixed(2)} in the data chapter`)
  const flow = anatomy.FLOW
  let matched = 0
  for (const b of flow) {
    const a = getAnchor(`bar:${b.id}`)
    if (!a) continue
    const height = (b.pct / Math.max(...flow.map((x) => x.pct))) * BAR.maxH
    const want = barTopWorld(height, b.index ?? flow.indexOf(b), anim.A.chart)
    near(a.position.y, want + BAR_LABEL_PAD, 1e-6, `bar label "${b.id}" is not on top of its bar`)
    assert.ok(a.position.y > want, `label ${b.id} must float above the bar, not inside it`)
    matched++
  }
  assert.equal(matched, flow.length, "some perfusion bars have no anchor to hang a label on")
  const defs = labelDefs()
  for (const b of flow) assert.ok(defs.some((d) => d.target === `bar:${b.id}`), `no label definition for ${b.id}`)
  assert.ok(defs.some((d) => d.target === "ecg:qrs"), "the ECG wave labels were not registered")
})

await check("focus drives the conduction nodes and the hotspots stay addressable", async () => {
  await settle(0.52, 120)
  for (const n of Object.values(anatomy.NODES)) {
    const a = getAnchor(n.id)
    assert.ok(a, `node ${n.id} is not anchored`)
    assert.ok(a.scale.x > 0 && Number.isFinite(a.scale.x), `node ${n.id} has a dead scale (${a.scale.x})`)
  }
  store.set("focused", "av")
  await settle(0.52, 40)
  const av = getAnchor("av")
  assert.ok(av.scale.x > 0, "the focused node vanished")
  store.set("focused", null)
})

await check("lights stay normalised and mirrored into the shader globals", async () => {
  await settle(0.5, 60)
  const { L } = await import("../src/three/materials.js")
  near(L.uLightDir.value.length(), 1, 1e-3, "key light direction must stay a unit vector")
  assert.ok(L.uKey.value > 0, "the key light must not go dark")
  assert.ok(Number.isFinite(probe.camera.fov) && probe.camera.fov > 12 && probe.camera.fov < 85, `camera fov ${probe.camera.fov} left the usable band`)
  assert.ok(probe.camera.position.length() > 2, "the camera flew into the model")
})

await check("the camera answers the scroll: wide at the top, tight at the sulcus", async () => {
  await settle(0, 150)
  const wide = probe.camera.position.length()
  const fovWide = probe.camera.fov
  await settle(0.16, 150)
  const tight = probe.camera.position.length()
  assert.ok(tight < wide, `the hero never closed in (${wide.toFixed(1)} → ${tight.toFixed(1)})`)
  assert.ok(fovWide >= 20 && fovWide <= 40, "hero FOV should read as a long lens")
})

await check("hover state reaches the materials without a render-loop leak", async () => {
  const before = anim.A.hover
  store.set("hovered", "lv")
  await settle(0.3, 60)
  assert.notEqual(anim.A.hover, before, "A.hover never followed the store")
  store.set("hovered", null)
  await settle(0.3, 60)
})

await check("an imported mesh gets a flow axis derived from its own shape", async () => {
  const { ensureFlowAxis } = await import("../src/three/parts/ImportedHeart.jsx")
  const g = new THREE.BoxGeometry(2, 0.4, 0.4, 8, 2, 2) // longest along x
  ensureFlowAxis(g)
  const a = g.attributes.aAlong
  assert.ok(a, "no aAlong built")
  assert.equal(a.count, g.attributes.position.count, "aAlong must cover every vertex")
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < a.count; i++) {
    const v = a.getX(i)
    assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= 1 + 1e-6, `aAlong ${v} outside 0..1`)
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  near(min, 0, 1e-6, "aAlong should start at the base")
  near(max, 1, 1e-6, "and end at the far end")
  const twice = g.clone()
  ensureFlowAxis(twice)
  assert.equal(twice.attributes.aAlong.array[0], a.array[0], "running it twice must not re-derive or corrupt")
  g.dispose()
  twice.dispose()
})

await check("unmounting releases the geometry and materials", async () => {
  const g0 = geoDisposed
  const m0 = matDisposed
  await renderer.unmount()
  assert.ok(geoDisposed > g0 + 20, `only ${geoDisposed - g0} geometries disposed for a 37-part model`)
  assert.ok(matDisposed > m0 + 20, `only ${matDisposed - m0} materials disposed`)
})

THREE.BufferGeometry.prototype.dispose = realGeoDispose
THREE.Material.prototype.dispose = realMatDispose

if (fails.length) {
  console.error(`\n✗ ${fails.length} of ${pass + fails.length} scene checks failed`)
  process.exit(1)
}
console.log(`\n  ✓ ${pass} scene checks passed`)
process.exit(0)
