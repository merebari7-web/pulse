/**
 * test-logic.mjs — the contracts the scene is built on.
 *
 *   node tools/test-logic.mjs        (or: npm run check:logic)
 *
 * Everything asserted here is data or maths that the DOM layer and the GPU layer
 * both read, so a drift between them is invisible until you look: the scroll →
 * track map, the journey data, the bar-grow easing the HTML labels sit on, the
 * cardiac model behind every number, the explode rig, the GLTF part matcher, the
 * per-material uniform ownership rule, and every material factory constructed
 * for real. No browser, no renderer — but the same code paths.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/* ---- a browser-shaped global set, so module init that touches window survives ---- */
const { JSDOM } = await import("jsdom")
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "http://localhost/" })
for (const k of ["window", "document", "navigator", "HTMLCanvasElement", "Element", "Event", "CustomEvent", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "getComputedStyle"]) {
  if (globalThis[k] === undefined && dom.window[k] !== undefined) globalThis[k] = dom.window[k]
}
globalThis.window ||= dom.window
const RO = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ||= RO
dom.window.ResizeObserver ||= RO

const THREE = await import("three")
const { CHAPTERS, TRACKS, CAMERA_KEYS } = await import("../src/data/journey.js")
const anatomy = await import("../src/data/anatomy.js")
const scroll = await import("../src/lib/scroll.js")
const track = await import("../src/lib/track.js")
const store = await import("../src/lib/store.js")
const cardiac = await import("../src/lib/cardiac.js")
const chart = await import("../src/lib/chart.js")
const math = await import("../src/lib/math.js")
const anim = await import("../src/three/anim.js")
const explode = await import("../src/three/explode.js")
const build = await import("../src/three/heart/build.js")
const geo = await import("../src/three/geometry.js")
const materials = await import("../src/three/materials.js")
const model = await import("../src/three/model.js")
const partMat = await import("../src/three/partMaterial.js")
const motionModule = await import("../src/lib/motion.js")
const { MODEL, PALETTE, TUNE } = await import("../src/config.js")

const verbose = process.env.QUIET !== "1"
let pass = 0
const fails = []
function test(name, fn) {
  try {
    fn()
    pass++
    if (verbose) console.log(`  · ${name}`)
  } catch (e) {
    const msg = `${name}\n    ${String(e?.message || e).split("\n").join("\n    ")}`
    fails.push(msg)
    console.error(`  ✗ ${msg}\n`)
  }
}
const near = (a, b, eps = 1e-6, msg = "") => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= eps, `${msg} expected ${b} ±${eps}, got ${a}`)
async function testAsync(name, fn) {
  try {
    await fn()
    pass++
    if (verbose) console.log(`  · ${name}`)
  } catch (e) {
    const msg = `${name}\n    ${String(e?.message || e).split("\n").join("\n    ")}`
    fails.push(msg)
    console.error(`  ✗ ${msg}\n`)
  }
}

const metrics = scroll.buildMetrics(CHAPTERS, 800, 0)
const built = track.buildTracks(TRACKS, metrics.ranges)

/* ------------------------------------------------------------------ journey data */
test("validateJourney accepts the shipped journey", () => {
  assert.deepEqual(scroll.validateJourney(CHAPTERS, built), [], "journey problems")
  assert.ok(Object.keys(built).length === Object.keys(TRACKS).length, "a track failed to build")
})

test("every chapter carries the copy its panel renders", () => {
  for (const c of CHAPTERS) {
    assert.ok(c.id && c.index && c.title && c.lede && c.eyebrow, `${c.id}: missing header copy`)
    assert.ok(c.weight >= 0.6 && c.weight <= 3, `${c.id}: weight ${c.weight} is a strange amount of scroll`)
    assert.ok([undefined, "left", "right", "center"].includes(c.panel), `${c.id}: unknown panel side`)
  }
  assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, CHAPTERS.length, "duplicate chapter id")
})

test("track names are a closed set the scene actually reads", () => {
  store.configure({ chapters: CHAPTERS, tracks: TRACKS, viewport: 800, offset: 0 })
  const sceneKeys = new Set(Object.keys(store.scene))
  for (const name of Object.keys(TRACKS)) {
    assert.ok(sceneKeys.has(name), `track "${name}" is not a field of scene — anim would ignore it`)
    assert.ok(Number.isFinite(store.scene[name]), `scene.${name} is not a number before the first scroll: ${store.scene[name]}`)
  }
  const eased = new Set(Object.keys(anim.A))
  for (const name of Object.keys(TRACKS)) assert.ok(eased.has(name), `scene.${name} is never eased into A — nothing will move`)
})

test("camera keys are sorted, complete and cover the whole scroll", () => {
  let prev = -1
  for (const k of CAMERA_KEYS) {
    const s = k.at.chapter + (k.at.t ?? 0) * 0.999
    assert.ok(s >= prev - 1e-9, "CAMERA_KEYS must be authored in ascending scroll order")
    prev = s
    for (const v of k.pos) assert.ok(Number.isFinite(v), "camera position has NaN")
    for (const v of k.look) assert.ok(Number.isFinite(v), "camera look target has NaN")
    assert.ok(k.fov >= 12 && k.fov <= 80, `fov ${k.fov} is outside a usable range`)
    assert.ok(Math.abs(k.roll || 0) < 0.2, "camera roll past 0.2 rad reads as a mistake, not cinema")
  }
  assert.equal(CAMERA_KEYS[0].at.chapter, 0, "the journey must start at chapter 0")
  assert.ok(CAMERA_KEYS[CAMERA_KEYS.length - 1].at.chapter >= CHAPTERS.length - 1, "the last chapter has no camera key")
})

/* ---------------------------------------------------------------------- scroll map */
test("buildMetrics covers 0..1 with contiguous chapter windows", () => {
  near(metrics.ranges[0].tStart, 0, 1e-9, "first window must start at 0")
  near(metrics.ranges.at(-1).tEnd, 1, 1e-6, "last window must end at 1")
  for (let i = 1; i < metrics.ranges.length; i++) near(metrics.ranges[i].tStart, metrics.ranges[i - 1].tEnd, 1e-9, `gap between chapters ${i - 1}/${i}`)
  near(metrics.total, 800 * CHAPTERS.reduce((s, c) => s + c.weight, 0), 1e-6, "page height")
})

test("chapterAt agrees with the windows on both sides of every boundary", () => {
  for (let i = 0; i < metrics.ranges.length; i++) {
    assert.equal(scroll.chapterAt(metrics, metrics.ranges[i].tStart + 1e-6).index, i, `just inside chapter ${i}`)
    assert.equal(scroll.chapterAt(metrics, metrics.ranges[i].tEnd - 1e-6).index, i, `just before boundary ${i}`)
  }
  assert.equal(scroll.chapterAt(metrics, 1.4).index, metrics.ranges.length - 1, "overscroll must clamp to the last chapter")
  assert.equal(scroll.chapterAt(metrics, -2).index, 0, "underscroll must clamp to the first")
})

test("resolved tracks are ascending and hit their authored endpoints", () => {
  for (const [name, t] of Object.entries(built)) {
    assert.ok(t.frames.length >= 2, `${name}: needs at least two frames`)
    let prevS = -1
    for (const [s, v] of t.frames) {
      assert.ok(s >= prevS - 1e-9, `${name}: frames out of order`)
      assert.ok(Number.isFinite(v), `${name}: NaN frame value`)
      prevS = s
    }
    const def = Array.isArray(TRACKS[name]) ? TRACKS[name] : TRACKS[name].at
    near(t.frames[0][1], def[0].value, 1e-6, `${name} first value`)
    near(t.frames.at(-1)[1], def.at(-1).value, 1e-6, `${name} last value`)
    for (const [sv] of t.frames) assert.ok(sv >= 0 && sv <= 1, `${name}: frame outside 0..1 (${sv})`)
  }
})

test("the store maps scroll onto scene values the way the tracks say", () => {
  store.configure({ chapters: CHAPTERS, tracks: TRACKS, viewport: 800, offset: 0 })
  store.applyScroll(0)
  const atTop = { ...store.scene }
  store.applyScroll(1)
  const atEnd = { ...store.scene }
  assert.ok(atTop.open < 0.05, `the shell must be shut at the top of the page, open=${atTop.open}`)
  assert.ok(atEnd.open > 0.6, `the shell must still be open at the end, open=${atEnd.open}`)
  for (const k of Object.keys(atEnd)) assert.ok(Number.isFinite(atEnd[k]), `scene.${k} went non-finite at scroll 1`)
  // the data chapter is where the chart is up
  const dataIdx = CHAPTERS.findIndex((c) => c.id === "data")
  store.applyScroll((metrics.ranges[dataIdx].tStart + metrics.ranges[dataIdx].tEnd) / 2)
  assert.ok(store.scene.chart > 0.75, `chart should be near full height in its own chapter, got ${store.scene.chart}`)
  store.applyScroll(0)
  assert.ok(store.scene.chart < 0.02, "chart must be away before its chapter")
})

test("resolveAt maps chapter space onto absolute scroll", () => {
  const r = metrics.ranges[1]
  near(store.resolveAt(1, 0), r.tStart, 1e-9, "chapter 1 start")
  near(store.resolveAt(1, 1), r.tEnd, 1e-9, "chapter 1 end")
  near(store.resolveAt(1, 0.5), (r.tStart + r.tEnd) / 2, 1e-9, "mid chapter 1")
})

await testAsync("the store batches notifications and skips no-ops", async () => {
  let n = 0
  const off = store.subscribe(() => n++)
  store.applyScroll(0.31)
  store.applyScroll(0.311)
  store.applyScroll(0.312)
  await Promise.resolve()
  assert.ok(n <= 1, `scroll micro-changes re-rendered ${n} times — the overlay would jitter at 120 Hz`)
  const before = n
  store.set("hovered", "lv")
  store.set("hovered", "lv")
  await Promise.resolve()
  assert.equal(n, before + 1, "hover must notify exactly once")
  assert.equal(store.getSnapshot().hovered, "lv", "snapshot must carry the new value")
  store.set("hovered", null)
  off()
})

/* ---------------------------------------------------------------- the DOM/GPU mirror */
test("bar-grow easing matches the chart vertex shader, line for line", () => {
  const glsl = readFileSync(new URL("../src/three/glsl.js", import.meta.url), "utf8")
  const vs = glsl.slice(glsl.indexOf("CHART_VERT"), glsl.indexOf("CHART_FRAG"))
  // these three patterns ARE the contract: lib/chart.js may not drift from the shader
  assert.match(vs, /uGrowth\s*\*\s*1\.45\s*-\s*aIndex\s*\*\s*0\.1/, "shader no longer uses the 1.45 / 0.1 stagger the DOM mirrors")
  assert.match(vs, /k\s*=\s*k\s*\*\s*k\s*\*\s*\(3\.0\s*-\s*2\.0\s*\*\s*k\)/, "shader no longer uses the smoothstep the DOM mirrors")
  assert.match(vs, /mix\(\s*0\.004\s*,\s*aTarget\s*,\s*k\s*\)/, "shader no longer mixes from the 0.004 floor the DOM mirrors")

  const { BAR, barGrow, barTop, barTopWorld } = chart
  for (const growth of [0, 0.17, 0.62, 1]) {
    for (let i = 0; i < anatomy.FLOW.length; i++) {
      const k = Math.min(1, Math.max(0, growth * 1.45 - i * 0.1))
      const s = k * k * (3 - 2 * k)
      const h = 1.9
      near(barGrow(i, growth), s, 1e-12, `barGrow(${i}) @${growth}`)
      near(barTop(h, i, growth), 0.004 + (h - 0.004) * s, 1e-12, `barTop(${i})`)
      near(barTopWorld(h, i, growth), BAR.floor + 0.004 + (h - 0.004) * s, 1e-12, `barTopWorld(${i}) must include the bar group's floor`)
    }
  }
  for (let i = 1; i < 8; i++) assert.ok(barGrow(i - 1, 0.5) >= barGrow(i, 0.5) - 1e-12, `bar ${i} finished before bar ${i - 1}`)
  near(barTop(2, 0, 1), 2, 1e-9, "a fully grown bar must reach its target")
  near(barTop(2, 0, 0), 0.004, 1e-9, "an un-grown bar stays a hair tall (zero-height quads break normals)")
})

test("layoutBars normalises, centres and arcs the row", () => {
  const bars = chart.layoutBars([{ pct: 25 }, { pct: 50 }, { pct: 100 }])
  near(bars[2].height, chart.BAR.maxH, 1e-9, "tallest bar fills the span")
  near(bars[0].height, chart.BAR.maxH * 0.25, 1e-9, "quarter value, quarter height")
  near(bars[0].x + bars[2].x, 0, 1e-9, "the row must be centred on the group")
  assert.ok(bars[1].z > bars[0].z, "the arc should pull the ends back, not the middle")
})

test("stat pins land on top of the bars they describe, in world space", () => {
  // DataViz puts the label anchors at BAR.floor + grow; the projection uses the
  // same anchor objects, so if the two ever disagree the labels float.
  const { BAR, barTopWorld, barTop } = chart
  for (const h of [0.5, BAR.maxH, 1.2]) {
    near(barTopWorld(h, 0, 1), BAR.floor + h, 1e-9, "a grown bar's top is its height above the group floor")
    near(barTopWorld(h, 0, 0), BAR.floor + 0.004, 1e-9, "an un-grown bar sits on the floor")
  }
  assert.ok(BAR.floor < 0, "the bars are based below the model's middle on purpose")
  assert.ok(Math.abs(barTopWorld(BAR.maxH, 0, 1)) < 0.5, "a full chart must stay near the model's own height")
})

/* ---------------------------------------------------------------------- cardiac model */
test("cardiacAt is physiological and internally consistent", () => {
  const rest = cardiac.cardiacAt(0)
  const max = cardiac.cardiacAt(1)
  assert.ok(rest.hr >= 58 && rest.hr <= 82, `resting rate should be the textbook 60–80, got ${rest.hr}`)
  assert.ok(max.hr > rest.hr + 60, "maximal exertion must move the rate a lot")
  assert.ok(max.sv <= cardiac.cardiacAt(0.55).sv + 1e-6, "stroke volume must plateau, not keep climbing")
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const c = cardiac.cardiacAt(t)
    near(c.co, (c.hr * c.sv) / 1000, 0.15, `CO = SV × HR at exertion ${t}`)
    assert.ok(c.diastoleFrac > 0.12 && c.diastoleFrac < 1, "diastole must shrink but never vanish")
    const cyc = cardiac.cycleAt(c.hr)
    assert.ok(cyc > 0 && cyc < 1.4, `cycle at ${c.hr} bpm should be ${(60 / c.hr).toFixed(2)} s, got ${cyc}`)
    near(cyc, 60 / c.hr, 0.02, "cycle length is 60 / rate")
    assert.ok(cardiac.maxHr(40) < cardiac.maxHr(17), "max HR must fall with age")
  }
  assert.ok(max.co / rest.co > 3.4, `peak output should be several times rest, got ${(max.co / rest.co).toFixed(2)}×`)
  // teaching numbers quoted in the copy must match the model
  near(rest.co, 5.2, 0.6, "the hero copy says ~5 L/min at rest")
})

test("perfusion shares sum to the whole output", () => {
  near(anatomy.FLOW.reduce((s, f) => s + f.pct, 0), 100, 0.001, "resting perfusion shares must total 100%")
  near(anatomy.FLOW.reduce((s, f) => s + f.litres, 0), 5.2, 0.6, "and to the resting cardiac output")
})

test("anatomy data is consistent with labels, hotspots and valve facts", () => {
  const ids = new Set(anatomy.LABELS.map((l) => l.id))
  assert.equal(ids.size, anatomy.LABELS.length, "duplicate label id")
  for (const l of anatomy.LABELS) {
    assert.ok(l.show && l.show[0] < l.show[1], `${l.id}: label reveal window is empty`)
    assert.ok(l.show[0] >= 0 && l.show[1] <= 1, `${l.id}: window outside 0..1`)
  }
  for (const h of anatomy.HOTSPOTS) assert.ok(ids.has(h.id), `hotspot ${h.id} has no label to project`)
  for (const n of Object.values(anatomy.NODES)) assert.ok(ids.has(n.id), `node ${n.id} has no label`)
  assert.equal(anatomy.VALVES.map((v) => `${v.id}:${v.cusps}`).join(" "), "tricuspid:3 mitral:2 pulmonary:3 aortic:3", "valve cusp counts are exam answers, they do not change")
  const cavities = anatomy.CHAMBERS.filter((c) => c.blood !== "myo")
  assert.equal(cavities.length, 4, "four chambers, always (plus the septum as muscle)")
  assert.equal(cavities.filter((c) => c.blood === "deoxy").length, 2, "two right-sided deoxy chambers")
  assert.equal(cavities.filter((c) => c.blood === "oxy").length, 2, "two left-sided oxy chambers")
})

/* --------------------------------------------------------------------- explode + rig */
test("applyRig is identity at rest and exact at full open", () => {
  const rig = explode.makeRig({ pos: [1, 2, 3], rot: [0.1, 0.2, 0.3], push: [0, 2, 0], stagger: 0 })
  const o = new THREE.Object3D()
  explode.applyRig(o, rig, 0)
  near(o.position.x, 1, 1e-9, "rest x")
  near(o.position.y, 2, 1e-9, "rest y")
  explode.applyRig(o, rig, 1)
  near(o.position.y, 4, 1e-9, "the full push must be applied at open = 1")
})

test("stagger delays the deep parts without ever overflowing", () => {
  const early = explode.makeRig({ pos: [0, 0, 0], push: [0, 0, 1], stagger: build.STAGGER.flap })
  const late = explode.makeRig({ pos: [0, 0, 0], push: [0, 0, 1], stagger: build.STAGGER.wire })
  const a = new THREE.Object3D()
  const b = new THREE.Object3D()
  explode.applyRig(a, early, 0.25)
  explode.applyRig(b, late, 0.25)
  assert.ok(a.position.z > 0, "the shell flaps must already be moving at 25% open")
  near(b.position.z, 0, 1e-6, "the conduction wire must still be home at 25% open")
  for (let open = 0; open <= 1.0001; open += 0.02) {
    explode.applyRig(b, late, open)
    assert.ok(Number.isFinite(b.position.z) && b.position.z >= 0 && b.position.z <= 1.001, `wire push left [0,1] at open=${open.toFixed(2)}: ${b.position.z}`)
    assert.ok(b.userData.reveal >= 0 && b.userData.reveal <= 1, "reveal must stay normalised")
  }
})

test("applyStage pulls the model aside for the data chapter without NaNs", () => {
  const g = new THREE.Group()
  for (const shrink of [0, 0.5, 1]) {
    const s = explode.applyStage(g, shrink)
    const p = g.position
    assert.ok([p.x, p.y, p.z, g.scale.x].every(Number.isFinite), `stage transform went NaN at shrink=${shrink}`)
    near(g.scale.x, s, 1e-9, "applyStage returns the scale it used")
    assert.ok(g.scale.x > 0.25 && g.scale.x <= 1.0001, `the model must shrink aside, not vanish (scale ${g.scale.x})`)
    if (shrink === 0) {
      near(p.x, 0, 1e-9, "at rest the organ sits at the origin")
      near(g.scale.x, 1, 1e-9, "at rest the organ is full size")
    }
  }
})

/* ---------------------------------------------------------------------- GLTF matcher */
test("matchPart maps the names real files use to internal part ids", () => {
  const cases = {
    ventricle_l: "lv",
    LV_wall_01: "lv",
    Left_Ventricle: "lv",
    rv: undefined, // a bare "rv" with no separator is deliberately not matched
    "Aorta": "aorta",
    aortic_valve_leaflet: "aortic",
    valve_mitral: "mitral",
    bicuspid_cusp: "mitral",
    pulmonary_trunk: "pa",
    left_pulmonary_artery: "lpa",
    inferior_vena_cava: "ivc",
    purkinje_fibres: "pur",
    some_decorative_mesh: null,
  }
  for (const [name, want] of Object.entries(cases)) {
    if (want === undefined) continue
    assert.equal(model.matchPart(name), want, `matchPart("${name}")`)
  }
})

test("every MODEL.map value is a part id the scene can render and label", () => {
  const ids = new Set([...build.buildModel({ fit: false }).ids, ...anatomy.VALVES.map((v) => v.id)])
  const orphans = Object.entries(MODEL.map).filter(([, v]) => !ids.has(v))
  assert.deepEqual(orphans, [], "an imported model would be given an id nothing renders or labels")
  const labels = new Set(anatomy.LABELS.map((l) => l.target))
  const unlabelled = Object.entries(MODEL.map).filter(([, v]) => !labels.has(v))
  assert.ok(unlabelled.length <= 10, `too many mapped parts have no floating label: ${unlabelled.map(([k]) => k).join(", ")}`)
})

test("deriveParts finds meshes anywhere in the graph and rigs them sensibly", () => {
  const root = new THREE.Group()
  const mk = (name, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8))
    m.name = name
    m.position.set(x, y, z)
    root.add(m)
    return m
  }
  const lv = mk("ventricle_l", 0.6, -1, 0)
  const rv = mk("ventricle_r", -0.6, -1, 0)
  const ao = mk("aorta", 0, 1.4, 0)
  mk("eyebrow_nope", 2, 2, 2)
  const nested = new THREE.Group()
  nested.position.set(0, -2, 0)
  const la = mk("left_atrium", 0.3, 0.4, -0.2)
  nested.add(la)
  root.add(nested)

  const { parts, scale } = model.deriveParts(root, { fitScale: 3.4 })
  assert.deepEqual(parts.map((p) => p.id).sort(), ["aorta", "la", "lv", "rv"])
  assert.ok(scale > 0 && Number.isFinite(scale), "fit scale must be finite and positive")
  for (const p of parts) {
    assert.ok(p.rig.push.every(Number.isFinite), `${p.id}: NaN push ${JSON.stringify(p.rig.push)}`)
    assert.ok(Math.hypot(...p.rig.push) > 1e-4, `${p.id}: a zero push would leave it stuck in the middle`)
  }
  const a = parts.find((p) => p.id === "lv").rig.push
  const b = parts.find((p) => p.id === "rv").rig.push
  assert.ok(Math.sign(a.x) !== Math.sign(b.x), "left and right ventricles exploded the same way")
  assert.ok(ao.position.y > lv.position.y, "the aorta should be above the ventricle in this fixture")
  root.traverse((o) => o.geometry?.dispose?.())
})

/* --------------------------------------------------------------------- model build */
const MODEL_BUILT = build.buildModel({ fit: true })
test("buildModel returns a finite, attributed model of a sane size", () => {
  const { parts, tris, ids } = MODEL_BUILT
  assert.ok(parts.length >= 30, `only ${parts.length} parts`)
  assert.equal(new Set(ids).size, ids.length, "duplicate part id — anchors would overwrite each other")
  for (const p of parts) {
    assert.ok(p.id && p.geometry, "part missing id/geometry")
    const g = p.geometry
    assert.ok(geo.isFiniteGeometry(g), `${p.id}: non-finite vertex data`)
    assert.ok(g.attributes.normal?.count === g.attributes.position.count, `${p.id}: normal/position count mismatch`)
    if (p.mat === "tissue" || p.mat === "blood" || p.mat === "vessel") {
      assert.ok(g.attributes.aAlong, `${p.id}: no aAlong, so flow pulses cannot ride it`)
      assert.ok(g.attributes.aFace, `${p.id}: no aFace, so cut rims cannot be coloured`)
    }
    for (const arr of Object.values(g.attributes)) {
      for (let i = 0; i < arr.count * arr.itemSize; i++) assert.ok(Number.isFinite(arr.array[i]), `${p.id}: NaN in ${arr.name || "attribute"}`)
    }
    if (p.rig) for (const k of ["pos", "rot", "push"]) assert.ok(p.rig[k].every(Number.isFinite), `${p.id}: rig.${k} has NaN`)
  }
  assert.ok(tris > 20000 && tris < 400000, `triangle count looks wrong: ${tris}`)
})

test("no chamber pokes through the myocardium", () => {
  // buildModel's auto-fit reports the clearance it settled on, in BASE-relative
  // units; a negative number means muscle inside the wall, which reads as a bug
  // in a silhouette before it reads as anything else.
  for (const f of MODEL_BUILT.fitted) {
    assert.ok(f.margin > 0, `${f.id}: margin ${f.margin.toFixed(4)} — it breaches the epicardium`)
    assert.ok(f.scale > 0.3 && f.scale <= 1.0001, `${f.id}: fit scale ${f.scale} (only shrinking is allowed)`)
  }
  // and the measure is a real function on real vertices, not just a stored number
  const lv = MODEL_BUILT.parts.find((p) => p.id === "lv")
  const pos = lv.geometry.attributes.position
  let worst = Infinity
  for (let i = 0; i < pos.count; i += 7) {
    const p = [pos.getX(i) + lv.centroid[0], pos.getY(i) + lv.centroid[1], pos.getZ(i) + lv.centroid[2]]
    worst = Math.min(worst, build.marginOf(p))
  }
  assert.ok(worst > -0.01, `sampled LV vertices breach the wall by ${worst.toFixed(3)}`)
})

test("the wall is asymmetric on purpose: left ventricle much thicker than right", () => {
  const quads = anatomy.SHELL.quads
  const th = (side) => Math.max(...quads.filter((q) => q.id === side).map((q) => q.wall))
  assert.ok(th("lf") > th("rf") * 2, `LV wall ${th("lf")} should be at least twice the RV wall ${th("rf")}`)
  assert.ok(th("lb") > th("rb") * 2, "and on the back, too")
  // atrial band x 4 quads, ventricular band x 4 quads, one apical cap
  assert.equal(MODEL_BUILT.parts.filter((p) => p.group === "flap").length, quads.length * 2 + 1, "wall flaps: 4 atrial + 4 ventricular + apical cap")
})

test("exploding moves every part outward from the organ centre", () => {
  let checked = 0
  for (const p of MODEL_BUILT.parts) {
    if (!p.rig || !p.centroid) continue
    const c = p.centroid
    const len = Math.hypot(...c)
    if (len < 1e-3) continue // geometry re-centred on itself (flaps) — no meaningful centre
    const before = new THREE.Vector3(...c)
    const o = new THREE.Object3D()
    explode.applyRig(o, p.rig, 1)
    const after = before.clone().add(o.position)
    assert.ok(after.length() >= len - 1e-6, `${p.id} moved inward when exploded`)
    checked++
  }
  assert.ok(checked > 12, `only ${checked} parts had an outward test — rig data changed shape?`)
})

test("at full open the shell really has come apart", () => {
  // pairwise bbox separation of the six wall flaps: the brief's "physically
  // disassembles" beat, checked as geometry rather than as a screenshot.
  const flaps = MODEL_BUILT.parts.filter((p) => p.group === "flap")
  const boxes = flaps.map((p) => {
    const o = new THREE.Object3D()
    const g = p.geometry.clone()
    const mesh = new THREE.Mesh(g)
    mesh.position.fromArray(p.rig.pos)
    explode.applyRig(mesh, p.rig, 1)
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh)
    g.dispose()
    return { id: p.id, box }
  })
  let overlaps = 0
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].box.intersectsBox(boxes[j].box)) overlaps++
    }
  }
  assert.equal(overlaps, 0, `${overlaps} flap pairs still intersect at open = 1`)
  const all = new THREE.Box3()
  for (const b of boxes) all.union(b.box)
  const size = all.getSize(new THREE.Vector3())
  assert.ok(size.x > 4 || size.z > 4, `exploded span ${size.toArray().map((v) => v.toFixed(2))} is not much wider than the heart itself`)
})

test("every geometry helper still produces finite buffers", () => {
  assert.ok(geo.isFiniteGeometry(geo.makeBlob({ rows: 20, radial: 24 })), "blob")
  const tube = geo.makeTube({ pts: [[0, 0, 0], [1, 1, 0], [2, 0.2, 1], [3, 1, 0]], r0: 0.2, r1: 0.12, seg: 32, radial: 10 })
  assert.ok(geo.isFiniteGeometry(tube) && tube.attributes.aAlong, "tube")
  assert.ok(tube.attributes.position.count % 1 === 0, "tube vertex count must be integral")
  assert.ok(geo.isFiniteGeometry(geo.makeDust({ count: 400 })), "dust")
  assert.ok(geo.isFiniteGeometry(geo.makeTrail({ count: 120, curves: [] })), "trail")
  const strands = geo.makeFan({ from: [0, 0, 0], count: 6, spread: 0.6, dir: [0, -1, 0] })
  assert.equal(strands.length, 6, "fan strands")
  assert.ok(geo.isFiniteGeometry(geo.makeTubeSet(strands, { pts: undefined, r0: 0.05, seg: 12, radial: 6 })), "fan tubes")
  assert.ok(geo.isFiniteGeometry(geo.makeRibbon({ len: 8, amp: 0.8, seg: 120, waves: anatomy.ECG.waves })), "ribbon")
})

/* ---------------------------------------------------------------------- materials */
test("no PALETTE key is undefined (a typo here would crash the first frame)", () => {
  for (const [k, v] of Object.entries(PALETTE)) assert.ok(/^#[0-9a-f]{6}$/i.test(v), `PALETTE.${k} = ${v} is not a hex colour`)
  for (const [k, v] of Object.entries(anatomy.LABELS)) assert.ok(PALETTE[v.hue] !== undefined, `LABELS[${k}] uses hue "${v.hue}" which is not in PALETTE`)
})

const FACTORIES = {
  tissue: () => materials.makeTissue({}),
  blood: () => materials.makeBlood({}),
  vessel: () => materials.makeVessel({}),
  sac: () => materials.makeSac(0.4),
  wire: () => materials.makeWire({}),
  dust: () => materials.makeDustMaterial({}),
  sparks: () => materials.makeSparks(),
  chart: () => materials.makeChart(),
  ribbon: () => materials.makeRibbon(),
  ground: () => materials.makeGround(),
  valve: () => materials.makeValveMaterial(),
  fat: () => materials.makeFatMaterial(),
  node: () => materials.makeNodeMaterial(),
}

test("every material factory builds, and its uniforms cover its declarations", () => {
  for (const [name, make] of Object.entries(FACTORIES)) {
    const mat = make()
    assert.ok(mat, `${name}: factory returned nothing`)
    if (!mat.uniforms) continue // standard lit materials (valve, fat)
    const decl = new Set()
    for (const src of [mat.vertexShader, mat.fragmentShader]) {
      for (const m of String(src).matchAll(/^\s*uniform\s+\w+\s+([A-Za-z_]\w*)\s*(\[\s*\])?\s*;/gm)) decl.add(m[1])
    }
    const missing = [...decl].filter((u) => !(u in mat.uniforms))
    assert.deepEqual(missing, [], `${name}: shader declares ${missing.join(", ")} with no uniform value supplied (three feeds 0 and the surface goes black)`)
    for (const [u, v] of Object.entries(mat.uniforms)) {
      assert.ok(v && "value" in v, `${name}.${u}: not a { value } pair`)
      if (typeof v.value === "number") assert.ok(Number.isFinite(v.value), `${name}.${u}: NaN`)
      if (v.value?.isColor) assert.ok(Number.isFinite(v.value.r) && Number.isFinite(v.value.g), `${name}.${u}: NaN colour (bad PALETTE key?)`)
      if (v.value?.isVector3) assert.ok(Number.isFinite(v.value.x + v.value.y + v.value.z), `${name}.${u}: NaN vector`)
    }
    for (const src of [mat.vertexShader, mat.fragmentShader]) {
      assert.ok(src.includes("void main"), `${name}: shader truncated`)
      const depth = (src.match(/\{/g) || []).length - (src.match(/\}/g) || []).length
      assert.equal(depth, 0, `${name}: unbalanced braces in shader`)
    }
    mat.dispose()
  }
})

test("per-part uniforms are owned by the material, not shared by reference", () => {
  // Heart.jsx and partMaterial.js write these per part every frame. If a factory
  // handed out the shared G/L object instead of a fresh one, the last part to
  // write would set the value for the whole scene.
  const MUTABLE = ["uOpacity", "uEmber", "uHighlight", "uDissolve", "uFlowSign", "uGrowth", "uReveal", "uAmp", "uActive", "uPixelRatio"]
  for (const [name, make] of Object.entries(FACTORIES)) {
    const mat = make()
    for (const u of MUTABLE) {
      if (!mat.uniforms?.[u]) continue
      const shared = materials.G[u] || materials.L[u]
      assert.notEqual(mat.uniforms[u], shared, `${name}: ${u} is the shared global — writing it per part leaks to every material`)
    }
    mat.dispose()
  }
  const a = materials.makeTissue({ rumple: 0.5 })
  const b = materials.makeTissue({})
  assert.notEqual(a.uniforms.uRumple, b.uniforms.uRumple, "two tissues must not share one uRumple object")
  near(a.uniforms.uRumple.value, 0.5, 1e-9, "makeTissue({rumple}) must reach the shader")
  assert.equal(a.uniforms.uTime, b.uniforms.uTime, "but frame-driven globals stay shared (that is the design)")
  a.dispose()
  b.dispose()
})

test("createPartMaterial covers every mat the builder can emit", () => {
  const mats = new Set(MODEL_BUILT.parts.map((p) => p.mat))
  for (const m of mats) {
    const part = MODEL_BUILT.parts.find((p) => p.mat === m)
    const mat = partMat.createPartMaterial(part)
    assert.ok(mat, `createPartMaterial("${m}") returned nothing`)
    mat.dispose()
  }
})

test("applyPartMaterial keeps opacity in range for every part and stage", () => {
  for (const p of MODEL_BUILT.parts) {
    const mat = partMat.createPartMaterial(p)
    for (const S of [
      { open: 0, cut: 0, dim: 0, isolate: 0, chart: 0, shrink: 0, sac: 1, reveal: 1 },
      { open: 1, cut: 0.7, dim: 1, isolate: 1, chart: 0.5, shrink: 1, sac: 0, reveal: 0.5 },
    ]) {
      partMat.applyPartMaterial(p, mat, S, null, 0.016)
      const u = mat.uniforms
      if (u?.uOpacity) {
        assert.ok(u.uOpacity.value >= 0 && u.uOpacity.value <= 1.0001, `${p.id}: opacity ${u.uOpacity.value} out of range`)
      }
    }
    mat.dispose()
  }
})

test("stepAnim advances the beat and never produces NaN in A", () => {
  anim.prime()
  const beats = new Set()
  const before = anim.A.beatPhase
  for (let i = 0; i < 240; i++) {
    anim.stepAnim(1 / 60)
    beats.add(Number(anim.A.beat.toFixed(3)))
  }
  assert.notEqual(anim.A.beatPhase, before, "the beat clock did not advance")
  assert.ok(beats.size > 6, `A.beat only ever took ${beats.size} values in 4 s — the envelope is flat`)
  assert.ok(Math.max(...beats) > 0.5, `systolic peak only reached ${Math.max(...beats)}`)
  for (const [k, v] of Object.entries(anim.A)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `A.${k} became ${v}`)
  }
  assert.ok(anim.A.beatPhase >= 0 && anim.A.beatPhase <= 1, "beat phase must stay normalised")
  near(anim.A.cycle, 60 / anim.A.bpm, 1e-6, "cycle must be 60/bpm")
})

test("reduced motion flattens the beat but keeps the scroll map", () => {
  store.patch({ reduced: true })
  const beats = new Set()
  for (let i = 0; i < 90; i++) {
    anim.stepAnim(1 / 60)
    beats.add(Number(anim.A.beat.toFixed(4)))
  }
  assert.equal(beats.size, 1, `A.beat should be flat when reduced, saw ${[...beats].join(",")}`)
  store.applyScroll(0.5)
  assert.ok(Number.isFinite(store.scene.open), "scroll mapping must survive reduced motion")
  store.patch({ reduced: false })
})

test("damping is frame-rate independent and never overshoots", () => {
  for (const dt of [1 / 240, 1 / 144, 1 / 60, 1 / 30, 1 / 12]) {
    let v = 0
    const steps = Math.max(1, Math.round(0.5 / dt))
    for (let i = 0; i < steps; i++) v = math.damp(v, 1, 8, dt)
    assert.ok(v > 0.9 && v <= 1.000001, `damp settled at ${v} for dt=${dt.toFixed(4)}`)
  }
  // and it must not stutter backwards on a frame spike
  let v = 0.5
  const a = math.damp(v, 1, 6, 1 / 60)
  const b = math.damp(v, 1, 6, 0.4)
  assert.ok(a > v && b > a, "damp must always move toward the target")
})

test("angle damping takes the short way round", () => {
  const from = Math.PI - 0.1
  const to = -Math.PI + 0.1
  const out = math.dampAngle(from, to, 8, 1 / 60)
  const delta = Math.abs(Math.atan2(Math.sin(out - to), Math.cos(out - to)))
  assert.ok(delta < Math.abs(from - to), "dampAngle went the long way around the circle")
})

/* ---------------------------------------------------------------------- config */
test("tuning constants are inside the ranges the code assumes", () => {
  assert.ok(TUNE.cameraLambda > 1 && TUNE.cameraLambda < 30, "camera damping lambda")
  assert.ok(TUNE.objectLambda > 1 && TUNE.objectLambda < 30, "object damping lambda")
  assert.ok(TUNE.parallax.yaw > 0 && TUNE.parallax.yaw < 0.3, `parallax yaw ${TUNE.parallax.yaw} rad is more than a nudge`)
  assert.ok(TUNE.parallax.pitch >= 0 && TUNE.parallax.pitch < 0.3, "parallax pitch")
  assert.ok(TUNE.portraitPush > 1 && TUNE.portraitPush < 2.2, "portrait dolly must push back, not sideways")
  assert.ok(TUNE.fovWiden >= 1 && TUNE.fovWiden < 1.9, "portrait FOV widening past 1.9× is a fish-eye")
  assert.ok(TUNE.fog.near > 0 && TUNE.fog.far > TUNE.fog.near, "fog must be a real range")
  assert.ok(MODEL.url === null || typeof MODEL.url === "string", "MODEL.url must be null or a path")
  assert.ok(Object.keys(MODEL.map).length > 10, "MODEL.map needs node-name aliases to be useful")
  for (const [k, v] of Object.entries(MODEL.fit.pos.concat(MODEL.fit.rot))) void v
})

test("motion probing degrades safely with no canvas support (this environment)", () => {
  // jsdom has no WebGL, so this is exactly the "GPU refused" path: it must land
  // on a usable tier instead of throwing at import time.
  const { motion: mo, quality, QUALITY } = motionModule
  assert.ok([0, 1, 2].includes(mo.webgl), "webgl probe must return a tier number, not throw")
  assert.ok(Object.keys(QUALITY).includes(mo.tier), `unknown quality tier "${mo.tier}"`)
  assert.equal(quality, QUALITY[mo.tier], "quality must be the tier's row")
  if (mo.webgl === 0) {
    assert.equal(mo.tier, "off", "no WebGL must land on the off tier")
    assert.equal(quality.particles, 0, "the off tier must not build particles")
  } else {
    assert.ok(quality.particles > 0, "any live tier needs some atmosphere")
  }
  assert.ok(quality.multisampling >= 0, "multisampling must be a number")
  assert.equal(typeof motionModule.motion.reduce, "boolean", "prefers-reduced-motion must resolve to a boolean")
})

/* ---------------------------------------------------------------------- report */
if (fails.length) {
  console.error(`\n✗ ${fails.length} of ${pass + fails.length} checks failed`)
  process.exit(1)
}
console.log(`\n  ✓ ${pass} logic checks passed`)
dom.window.close()
process.exit(0)
