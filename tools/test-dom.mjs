import { jsdomWindow } from "./_dom-globals.mjs"
import assert from "node:assert/strict"
import React from "react"

/**
 * test-dom.mjs — the HTML half, rendered for real.
 *
 *   npm run check:dom
 *
 * React 19's server renderer runs every component body against a jsdom DOM, so
 * this catches what a bundler cannot: a data field a panel asks for that the
 * dataset does not have, a chapter whose copy never reaches the reader edition,
 * a label layer that drops a definition, a hook that touches the DOM during
 * render. The WebGL canvas is deliberately not mounted here — the R3F tree is
 * exercised by test-scene.mjs instead, where it can be stepped frame by frame.
 */

const { motion } = await import("../src/lib/motion.js")
// pretend the context probe succeeded, or App short-circuits to the reader
motion.webgl = 2
motion.tier = "low"
motion.reduce = false

const { renderToStaticMarkup } = await import("react-dom/server")
const { CHAPTERS, TRACKS } = await import("../src/data/journey.js")
const anatomy = await import("../src/data/anatomy.js")
const store = await import("../src/lib/store.js")
const { labelDefs, registerLabelDef } = await import("../src/three/labels.js")
const { Overlay } = await import("../src/ui/Overlay.jsx")
const { Labels } = await import("../src/ui/Labels.jsx")
const { Nav } = await import("../src/ui/Nav.jsx")
const { Rail } = await import("../src/ui/Rail.jsx")
const { Loader } = await import("../src/ui/Loader.jsx")
const { Fallback } = await import("../src/ui/Fallback.jsx")
const { Reader } = await import("../src/ui/Reader.jsx")
const { Gauge } = await import("../src/ui/Gauge.jsx")
const { scrollToChapter, scrollToProgress } = await import("../src/hooks/useJourney.js")
const appModule = await import("../src/App.jsx")

const { createElement: h } = React
let pass = 0
const fails = []
function test(name, fn) {
  try {
    fn()
    pass++
    console.log(`  · ${name}`)
  } catch (e) {
    const detail = e?.errors?.length ? e.errors.map((x) => String(x?.stack || x?.message || x)).join("\n    ") : String(e?.stack || e?.message || e)
    const msg = `${name}\n    ${detail.split("\n").slice(0, 12).join("\n    ")}`
    fails.push(msg)
    console.error(`  ✗ ${msg}\n`)
  }
}
async function testAsync(name, fn) {
  try {
    await fn()
    pass++
    console.log(`  · ${name}`)
  } catch (e) {
    const detail = e?.errors?.length ? e.errors.map((x) => String(x?.stack || x?.message || x)).join("\n    ") : String(e?.stack || e?.message || e)
    const msg = `${name}\n    ${detail.split("\n").slice(0, 12).join("\n    ")}`
    fails.push(msg)
    console.error(`  ✗ ${msg}\n`)
  }
}
const render = (el) => renderToStaticMarkup(el)
/** strip tags to plain text, so assertions are about words, not markup */
const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")

store.configure({ chapters: CHAPTERS, tracks: TRACKS, viewport: 900, offset: 0 })

test("every chapter panel renders its copy", () => {
  const html = render(h(Overlay, { rootRef: { current: null }, small: false }))
  const t = text(html)
  for (const c of CHAPTERS) {
    for (const line of c.title.split("\n")) assert.ok(t.includes(line), `chapter ${c.id}: title line "${line}" missing`)
    assert.ok(t.includes(c.lede.slice(0, 40)), `chapter ${c.id}: lede missing`)
    assert.ok(t.includes(c.eyebrow), `chapter ${c.id}: eyebrow missing`)
    if (c.stats) for (const s of c.stats) assert.ok(t.includes(s.value), `chapter ${c.id}: stat ${s.value} missing`)
    for (const item of [...(c.list || []), ...(c.path || [])]) assert.ok(t.includes(item.term), `chapter ${c.id}: term "${item.term}" missing`)
    for (const q of c.questions || []) assert.ok(t.includes(q.q.slice(0, 30)), `chapter ${c.id}: question truncated`)
    for (const tr of c.traps || []) assert.ok(t.includes(tr.trap.slice(0, 24)), `chapter ${c.id}: trap missing`)
    for (const r of c.recap || []) assert.ok(t.includes(r.slice(0, 24)), `chapter ${c.id}: recap line missing`)
  }
  // and the scroll lengths that drive the whole map are on the wrappers
  for (const c of CHAPTERS) {
    const px = `${Math.round(c.weight * 10000) / 100}svh`
    assert.ok(html.includes(px), `chapter ${c.id}: wrapper height must be ${c.weight} viewports (looked for ${px})`)
  }
  assert.ok(html.includes("sticky"), "panels must be sticky inside their scroll length")
})

test("the anatomy panel's peel index and conduction copy all render", () => {
  const t = text(render(h(Overlay, { rootRef: { current: null }, small: false })))
  for (const l of anatomy.LAYERS) assert.ok(t.includes(l.name), `layer "${l.name}" never reaches the DOM (peel index)`)
  for (const n of Object.values(anatomy.NODES)) assert.ok(t.includes(n.name), `node "${n.id}" never reaches the DOM`)
})

test("every floating label is in the DOM layer, valves included", () => {
  const t = text(render(h(Labels)))
  for (const l of anatomy.LABELS) {
    assert.ok(t.includes(l.text), `label "${l.text}" was never rendered`)
    assert.ok(t.includes(l.sub), `label "${l.text}" lost its sub-line`)
  }
  const named = anatomy.LABELS.map((l) => l.text.toLowerCase())
  for (const v of anatomy.VALVES) {
    const key = v.name.split(" (")[0].toLowerCase().split(" ")[0]
    assert.ok(named.some((n) => n.includes(key)), `valve "${v.name}" has no floating label`)
  }
})

test("the reader edition carries the same facts as the 3D one", () => {
  const t = text(render(h(Reader, {})))
  for (const c of CHAPTERS) assert.ok(t.includes(c.title.split("\n")[0]), `reader lost chapter ${c.id}`)
  for (const f of anatomy.FLOW) {
    assert.ok(t.includes(f.name), `reader lost ${f.name}`)
    assert.ok(t.includes(`${f.pct}%`), `reader lost the ${f.name} share`)
  }
  for (const w of anatomy.ECG.waves) assert.ok(t.includes(w.meaning.slice(0, 24)), `reader lost the ${w.name} explanation`)
  for (const r of anatomy.RECAP) assert.ok(t.includes(r.slice(0, 24)), "reader lost a recap line")
  for (const [k, v] of Object.entries(anatomy.GLOSSARY)) assert.ok(t.includes(v.slice(0, 20)), `glossary "${k}" lost its definition`)
  for (const hItem of anatomy.HISTORY || []) void hItem
  assert.ok(t.includes("not a clinical") || t.includes("not clinical"), "the reader must carry the not-medical-advice line")
})

test("the label layer renders one node per registered definition", () => {
  const before = labelDefs().length
  assert.ok(before >= anatomy.LABELS.length, `only ${before} label defs — the anatomy labels never reached the projector`)
  const off = registerLabelDef({ id: "test:probe", target: "lv", text: "probe", sub: "x", from: 0, show: [0, 1] })
  const html = render(h(Labels))
  assert.ok(html.includes("probe"), "a registered label definition did not render")
  assert.equal((html.match(/class="label"/g) || []).length, labelDefs().length, "label node count != definition count")
  assert.ok(html.includes("--label-hue"), "labels must inherit their hue from the same palette the shaders use")
  assert.ok(!/aria-hidden="false"/.test(html))
  off()
  assert.ok(labelDefs().length === before, "unregistering a label def leaked it")
})

test("nav, rail and loader render their controls", () => {
  const nav = render(h(Nav, { onReader: () => {} }))
  assert.ok(nav.includes("PULSE"), "no brand")
  assert.ok(/motion (on|off)/.test(text(nav)), "the calm toggle is missing")
  const rail = render(h(Rail))
  assert.equal((rail.match(/<button/g) || []).length, CHAPTERS.length, "one rail button per chapter")
  for (const c of CHAPTERS) assert.ok(text(rail).includes(c.index), `rail lost chapter ${c.id}`)
  const loader = render(h(Loader, { progress: 0.5, ready: false }))
  assert.ok(loader.includes('role="status"'), "the loader must be announced")
  assert.ok(loader.includes("50%") || loader.includes("width:50%") || loader.includes("50.00000000000001%"), "the bar must reflect real progress")
  const fallback = render(h(Fallback, { reason: "no webgl", onReader: () => {} }))
  assert.ok(text(fallback).includes("WebGL"), "the fallback must say what happened")
  assert.ok(fallback.includes("retry 3D"), "the fallback must offer a retry (context loss is recoverable)")
})

test("the exertion gauge renders live cardiac numbers", () => {
  const html = render(h(Gauge, { label: "Simulate exertion" }))
  const t = text(html)
  assert.ok(/5\.[0-9]/.test(t), `resting cardiac output missing from the gauge: ${t.slice(0, 120)}`)
  assert.ok(html.includes('type="range"'), "the gauge must be a real range input (keyboard-operable)")
  assert.ok(html.includes('aria-label="Exertion level"'), "the slider needs a name")
})

test("no dynamic tailwind class names survive (JIT cannot see them)", () => {
  const html = render(h(Overlay, { rootRef: { current: null }, small: false }))
  const classes = new Set()
  for (const m of html.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c)
  const templatey = [...classes].filter((c) => /\$\{|undefined|NaN/.test(c))
  assert.deepEqual(templatey, [], `unresolved class names: ${templatey.join(", ")}`)
})

test("scroll helpers refuse to throw before the page has metrics", () => {
  assert.doesNotThrow(() => scrollToChapter(0))
  assert.doesNotThrow(() => scrollToChapter(CHAPTERS.length - 1))
  assert.doesNotThrow(() => scrollToChapter(99), "an out-of-range chapter must clamp")
  assert.doesNotThrow(() => scrollToProgress(0.5))
})

test("portrait layout puts the copy under the model, not over it", () => {
  const landscape = render(h(Overlay, { rootRef: { current: null }, small: false }))
  const portrait = render(h(Overlay, { rootRef: { current: null }, small: true }))
  assert.ok(landscape.includes("justify-end") || landscape.includes("justify-start"), "desktop panels must be pushed to one side")
  assert.ok(portrait.includes("items-end"), "on a phone the panel must sit at the bottom of the viewport")
  assert.ok(portrait.includes("pb-[8svh]"), "and leave breathing room so the model is not buried")
})

test("the app shell composes all three layers", () => {
  const { default: App } = appModule
  const html = render(h(App))
  const t = text(html)
  assert.ok(html.includes('id="scene"'), "the fixed canvas layer is missing")
  assert.ok(t.includes("Two pumps, folded into one."), "the hero headline never reached the page")
  assert.ok(t.includes("scroll"), "the scroll cue is missing")
  assert.ok(html.includes('class="label"'), "no label layer")
  assert.ok(html.includes("Chapters"), "no chapter rail")
  assert.ok(html.includes('role="status"'), "no loader while the first frame is being built")
  // brand sits in the nav, the loader and the fixed credit line — nowhere else
  assert.equal((html.match(/PULSE/g) || []).length, 3, `brand appeared ${html.match(/PULSE/g).length} times, expected 3`)
  assert.equal((html.match(/id="scene"/g) || []).length, 1, "exactly one canvas layer")
  assert.equal((html.match(/aria-hidden="true"/g) || []).length >= 2, true, "the decorative layers must be hidden from the screen reader")
})

test("the app falls back to the reader when WebGL is refused", () => {
  motion.webgl = 0
  try {
    const html = render(h(appModule.default))
    assert.ok(!html.includes('id="scene"'), "a canvas must not be mounted without WebGL")
    assert.ok(html.includes("retry 3D"), "the no-WebGL path must offer a retry (context loss is often transient)")
    assert.ok(text(html).includes("reader") || text(html).includes("Reference tables"), "the fallback must land on the written edition")
    assert.ok(text(html).includes("not clinical") || text(html).includes("not a clinical"), "the fallback must still carry the disclaimer")
  } finally {
    motion.webgl = 2
  }
})

/* ---- the parts SSR cannot reach: effects, listeners, the scroll machinery ---- */
const { createRoot } = await import("react-dom/client")
const { act } = await import("react")
const { Overlay: OverlayLive } = await import("../src/ui/Overlay.jsx")
const { useJourney } = await import("../src/hooks/useJourney.js")
const { getMetrics } = await import("../src/lib/store.js")

function Harness() {
  const rootRef = React.useRef(null)
  useJourney({ rootRef, chapters: CHAPTERS, tracks: TRACKS })
  return React.createElement(OverlayLive, { rootRef, small: false })
}

await testAsync("mounting the scroll layer wires ScrollTrigger, Lenis and the listeners", async () => {
  const host = document.createElement("div")
  document.body.appendChild(host)
  let root
  await act(async () => {
    root = createRoot(host)
    root.render(React.createElement(Harness))
  })
  try {
    const m = getMetrics()
    assert.ok(m.viewport > 0, `metrics viewport should be measured, got ${m.viewport}`)
    assert.ok(Number.isFinite(m.total), "total page height must be finite even at zero layout")
    assert.ok(host.querySelectorAll(".label, .panel, [data-chapter]").length > 0, "nothing mounted")
    // a real scroll event must move the store without throwing
    await act(async () => {
      Object.defineProperty(window, "scrollY", { value: 1200, configurable: true, writable: true })
      window.dispatchEvent(new jsdomWindow.Event("scroll"))
      window.dispatchEvent(new jsdomWindow.Event("resize"))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    assert.ok(Number.isFinite(store.state.scroll), "scroll position went non-finite")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

if (fails.length) {
  console.error(`\n✗ ${fails.length} of ${pass + fails.length} DOM checks failed`)
  process.exit(1)
}
console.log(`\n  ✓ ${pass} DOM checks passed`)
process.exit(0)
