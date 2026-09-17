import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { ECG, FLOW, TIMELINE } from "../data/anatomy.js"
import { BAR, barGrow, barTopWorld, layoutBars } from "../lib/chart.js"
import { makeChart, makeGround, makeNodeMaterial, makeRibbon } from "./materials.js"
import { A } from "./anim.js"
import { ecgAt } from "./geometry.js"
import { registerAnchor } from "./registry.js"
import { registerLabelDef } from "./labels.js"
import { clamp01, lerp, smoothstep } from "../lib/math.js"

/**
 * DataViz — the 3D chart. One merged BufferGeometry for all seven bars, so the
 * whole "sequential growth" is a vertex-shader multiply driven by the scroll
 * track (see src/lib/chart.js for the shared maths). Under it, the ECG of one
 * cycle drawn as a ribbon and revealed left-to-right off the same chapter, so
 * the waveform and the haemodynamic numbers arrive together.
 */

const FACES = [
  { n: [0, 0, 1], v: [[-1, 0, 1], [1, 0, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, -1], [-1, 0, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, 0, -1], [-1, 0, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]] },
]

/** 24 verts per bar: unit box (base on y=0), carrying aTarget + aIndex. */
function buildBars(bars) {
  const perBar = FACES.length * 4
  const count = bars.length * perBar
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  const target = new Float32Array(count)
  const index = new Float32Array(count)
  const tri = []
  let p = 0
  for (let b = 0; b < bars.length; b++) {
    const bar = bars[b]
    const hw = BAR.w / 2
    const hd = BAR.d / 2
    for (const f of FACES) {
      for (const v of f.v) {
        position[p * 3] = v[0] * hw + bar.x
        position[p * 3 + 1] = v[1]
        position[p * 3 + 2] = v[2] * hd + bar.z
        normal[p * 3] = f.n[0]
        normal[p * 3 + 1] = f.n[1]
        normal[p * 3 + 2] = f.n[2]
        target[p] = bar.height
        index[p] = bar.index
        p++
      }
    }
    const base = b * perBar
    for (let i = 0; i < FACES.length; i++) {
      const a = base + i * 4
      tri.push(a, a + 1, a + 2, a, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(position, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3))
  g.setAttribute("aTarget", new THREE.BufferAttribute(target, 1))
  g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1))
  g.setIndex(tri)
  g.computeBoundingSphere()
  return g
}

/** Milestone rail: the history of the heart, drawn as a glowing 3D timeline. */
function buildTimeline(items, { len = 7.4, y = 0, z = 0 } = {}) {
  const pts = []
  for (const m of items) pts.push({ x: -len / 2 + m.at * len, y, z, ...m })
  const rail = new THREE.BoxGeometry(len, 0.014, 0.014).translate(0, y, z)
  return { rail, nodes: pts }
}

export function DataViz() {
  const bars = useMemo(() => layoutBars(FLOW, { key: "pct" }), [])
  const geo = useMemo(() => buildBars(bars), [bars])
  const chartMat = useMemo(() => makeChart(), [])
  const ribbonMat = useMemo(() => makeRibbon(), [])
  const ribbonGeo = useMemo(() => ribbonGeometry(), [])
  const { rail, nodes } = useMemo(() => buildTimeline(TIMELINE, { y: BAR.floor - 0.55, z: 1.5 }), [])
  const railMat = useMemo(() => makeGround(), [])
  const nodeMat = useMemo(() => makeNodeMaterial("#d8fff2"), [])

  const root = useRef()
  const anchors = useRef([])
  const pips = useRef([])

  // Labels for the bars live in the DOM; their anchors and their definitions are
  // registered here so the chart can add them without touching anatomy.js.
  useLayoutEffect(() => {
    const offs = bars.map((b, i) => registerAnchor(`bar:${b.id}`, anchors.current[i]))
    const defs = bars.map((b) =>
      registerLabelDef({ id: `bar-${b.id}`, target: `bar:${b.id}`, text: `${b.pct}%`, sub: b.name, hue: "oxy", from: 3, show: [0.3, 0.98] }),
    )
    defs.push(
      registerLabelDef({ id: "ecg-p", target: "ecg:p", text: "P", sub: "atrial depolarisation", hue: "wire", from: 3, show: [0.5, 0.98] }),
      registerLabelDef({ id: "ecg-qrs", target: "ecg:qrs", text: "QRS", sub: "ventricular depolarisation", hue: "wire", from: 3, show: [0.55, 0.98] }),
      registerLabelDef({ id: "ecg-t", target: "ecg:t", text: "T", sub: "repolarisation", hue: "wire", from: 3, show: [0.6, 0.98] }),
    )
    const cleanups = offs.concat(defs).filter(Boolean)
    return () => cleanups.forEach((f) => f())
  }, [bars])

  useEffect(
    () => () => {
      geo.dispose()
      ribbonGeo.dispose()
      rail.dispose()
      PIP.dispose()
      chartMat.dispose()
      ribbonMat.dispose()
      railMat.dispose()
      nodeMat.dispose()
    },
    [geo, ribbonGeo, rail, chartMat, ribbonMat, railMat, nodeMat],
  )

  useFrame(() => {
    const growth = A.chart
    chartMat.uniforms.uGrowth.value = growth
    ribbonMat.uniforms.uReveal.value = A.ribbon
    ribbonMat.uniforms.uAmp.value = 0.55 + A.beat * 0.12
    const vis = clamp01(growth * 1.2)
    if (root.current) {
      root.current.visible = vis > 0.002 || A.ribbon > 0.002
      root.current.position.y = lerp(-0.5, 0, smoothstep(0, 1, Math.max(growth, A.ribbon)))
    }
    for (let i = 0; i < bars.length; i++) {
      const a = anchors.current[i]
      const pip = pips.current[i]
      const b = bars[i]
      const h = barTopWorld(b.height, i, growth)
      if (a) a.position.set(b.x, h + BAR_LABEL_PAD, b.z)
      if (pip) {
        const k = barGrow(i, growth)
        pip.scale.setScalar(0.4 + k * 0.85)
        pip.material.opacity = 0.25 + k * 0.7
      }
    }
    railMat.uniforms.uOpacity.value = 0.42 * clamp01(growth * 1.6)
  })

  return (
    <group ref={root} name="dataviz" position={[2.15, 0, 0.4]} rotation={[0, -0.2, 0]}>
      <mesh geometry={geo} material={chartMat} position={[0, BAR.floor, 0]} />
      {bars.map((b) => (
        <group key={`a-${b.id}`} ref={(el) => (anchors.current[b.index] = el)} position={[b.x, 0, b.z]} />
      ))}
      {nodes.map((n, i) => (
        <mesh key={`n${i}`} ref={(el) => (pips.current[i] = el)} geometry={PIP} material={nodeMat} position={[n.x, n.y, n.z]} />
      ))}
      <mesh geometry={rail} material={railMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, BAR.floor - 0.62, 0]} />
      <group position={[0, -0.35, -2.15]}>
        <mesh geometry={ribbonGeo} material={ribbonMat} />
        <WaveMarkers />
      </group>
    </group>
  )
}

/** How far above a bar top its DOM label floats. Exported so the test can assert
    the anchor lands exactly where the mirror in lib/chart.js says it should. */
export const BAR_LABEL_PAD = 0.16

const PIP = new THREE.SphereGeometry(0.055, 12, 8)

function ribbonGeometry() {
  const seg = 420
  const len = 9.4
  const amp = 0.95
  const cols = 2
  const rowN = seg + 1
  const position = new Float32Array(rowN * cols * 3)
  const uv = new Float32Array(rowN * cols * 2)
  const along = new Float32Array(rowN * cols)
  const tri = []
  for (let i = 0; i < rowN; i++) {
    const u = i / seg
    const x = -len / 2 + u * len
    const y = ecgAt(u, ECG.waves) * amp
    for (let c = 0; c < cols; c++) {
      const n = i * cols + c
      position[n * 3] = x
      position[n * 3 + 1] = y + (c === 0 ? 0.035 : -0.035)
      position[n * 3 + 2] = c === 0 ? 0.02 : -0.02
      uv[n * 2] = u
      uv[n * 2 + 1] = c
      along[n] = u
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * cols
    tri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(position, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("aAlong", new THREE.BufferAttribute(along, 1))
  g.setIndex(tri)
  g.computeBoundingSphere()
  return g
}

/** Three floating markers that sit on the trace and own its label anchors. */
const MARKERS = ECG.waves.filter((w) => ["p", "r", "t"].includes(w.id))

function WaveMarkers() {
  const refs = useRef([])
  useLayoutEffect(() => {
    const offs = MARKERS.map((w, i) => registerAnchor(`ecg:${w.id === "r" ? "qrs" : w.id}`, refs.current[i])).filter(Boolean)
    return () => offs.forEach((f) => f())
  }, [])
  const len = 9.4
  return (
    <>
      {MARKERS.map((w, i) => (
        <group
          key={w.id}
          ref={(el) => (refs.current[i] = el)}
          position={[-len / 2 + w.at * len, ecgAt(w.at, ECG.waves) * 0.95 + 0.14, 0.05]}
        />
      ))}
    </>
  )
}
