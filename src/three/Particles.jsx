import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { makeDust, makeTrail, makeTube } from "./geometry.js"
import { makeDustMaterial, makeSparks } from "./materials.js"
import { WIRE } from "../data/anatomy.js"
import { A } from "./anim.js"
import { quality, motion } from "../lib/motion.js"
import { clamp01, lerp, smoothstep } from "../lib/math.js"
import { getAnchor } from "./registry.js"
import { state } from "../lib/store.js"

/**
 * Two particle systems, one purpose: make the volume of space around the organ
 * legible, and draw the eye to the hotspot.
 *
 *  • dust   — a hollow shell of drifting motes, displaced outward as the model
 *             explodes, brightened on every beat (a shared `uBeat` uniform, so
 *             6 000 points cost one uniform write).
 *  • trail  — sparks that converge on the currently isolated conduction node.
 *             Their target is read from the live scene graph, so the trail keeps
 *             pointing at the right place while the part flies apart.
 */

export function Particles({ count = quality.particles }) {
  const dustGeo = useMemo(() => makeDust({ count, inner: 3.4, outer: 16.5, band: 0.6 }), [count])
  const dustMat = useMemo(() => makeDustMaterial(), [])
  const dust = useRef()

  useFrame((st) => {
    dustMat.uniforms.uPixelRatio.value = st.viewport.dpr
    dustMat.uniforms.uOpacity.value = lerp(0.34, 0.6, A.open)
    if (dust.current) dust.current.rotation.y = st.clock.elapsedTime * 0.006
  })

  useEffect(
    () => () => {
      dustGeo.dispose()
      dustMat.dispose()
    },
    [dustGeo, dustMat],
  )

  if (!count) return null
  return <points ref={dust} geometry={dustGeo} material={dustMat} frustumCulled={false} renderOrder={-1} />
}

/**
 * The guiding trail. Curves are sampled once into flat lookup tables, then each
 * frame is a lerp and an array write — no spline evaluation, no allocation, and
 * it survives the model moving because the tip is taken from the anchor object.
 */
export function Trail({ count = quality.trails }) {
  const mat = useMemo(() => makeSparks(), [])
  const geo = useMemo(() => makeTrail({ count }), [count])
  const pts = useRef()
  const tables = useMemo(() => {
    const list = []
    for (const w of WIRE) {
      const g = makeTube({ pts: w.pts, r0: 0.02, r1: 0.02, seg: 120, radial: 3 })
      const src = g.attributes.position
      const tbl = new Float32Array(3 * (src.count + 1))
      for (let i = 0; i < src.count; i++) {
        tbl[i * 3] = src.getX(i)
        tbl[i * 3 + 1] = src.getY(i)
        tbl[i * 3 + 2] = src.getZ(i)
      }
      g.dispose()
      list.push(tbl)
    }
    return list
  }, [])

  useFrame((st) => {
    if (!pts.current || motion.reduce) return
    const pos = pts.current.geometry.attributes.position
    const meta = pts.current.geometry.attributes.aMeta
    const arr = pos.array
    const m = meta.array
    const t = st.clock.elapsedTime
    // the node the viewer is being walked toward, in world space, this frame
    const focusId = state.focused || state.hovered
    const target = focusId ? getAnchor(focusId) : null
    if (target) target.getWorldPosition(_aim)
    const pull = target ? 0.8 * clamp01(A.isolate + 0.25) : 0

    for (let i = 0; i < count; i++) {
      const curve = Math.min(m[i * 4] | 0, tables.length - 1)
      const tbl = tables[curve]
      const speed = m[i * 4 + 2]
      const u = (m[i * 4 + 1] + t * 0.09 * speed) % 1
      const n = tbl.length / 3 - 1
      const f = u * n
      const k = Math.min(n - 1, Math.floor(f))
      const r = f - k
      const i3 = i * 3
      const k3 = k * 3
      // late in its travel each spark is drawn off the wire toward the hotspot
      const w = pull * smoothstep(0.42, 1.0, u)
      arr[i3] = lerp(lerp(tbl[k3], tbl[k3 + 3], r), _aim.x, w)
      arr[i3 + 1] = lerp(lerp(tbl[k3 + 1], tbl[k3 + 4], r), _aim.y, w)
      arr[i3 + 2] = lerp(lerp(tbl[k3 + 2], tbl[k3 + 5], r), _aim.z, w)
    }
    pos.needsUpdate = true
    mat.uniforms.uOpacity.value = clamp01(0.2 + A.trail * 0.8) * (0.35 + A.isolate * 0.65)
    mat.uniforms.uPixelRatio.value = st.viewport.dpr
  })

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  if (!count || !quality.trails) return null
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />
}

const _aim = new THREE.Vector3(0, 0, 0)
