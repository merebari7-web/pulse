import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { buildModel } from "./heart/build.js"
import { applyRig, applyStage } from "./explode.js"
import { A, flowAt } from "./anim.js"
import { createPartMaterial, applyPartMaterial, isInteractive } from "./partMaterial.js"
import { Valves } from "./parts/Valves.jsx"
import { registerAnchor } from "./registry.js"
import { set as setState, state } from "../lib/store.js"
import { clamp01, lerp } from "../lib/math.js"

/**
 * Heart — the model root.
 *
 * One `useFrame` walks 37 part descriptors and does three things to each: the
 * exploded transform, the material state, and (for the conduction nodes) the
 * arrival flash. That is the whole animation system for the organ: no per-part
 * React components subscribing to the render loop, no per-part state, and one
 * place to read when something moves.
 *
 * Hover works through R3F's event list, which only contains meshes that declare
 * handlers, so the raycast stays small; the first-person views are gated to the
 * chapters where a part can actually be pointed at.
 */

/** When, in the cycle, each node is reached by the wavefront. */
const ARRIVAL = { sa: 0.02, av: 0.3, his: 0.44, pur: 0.62 }

export function Heart({ onReady, interactive = true }) {
  const model = useMemo(() => buildModel(), [])
  const mats = useMemo(
    () =>
      model.parts.map((p) => {
        const m = createPartMaterial(p)
        if (m.uniforms?.uFlowSign) m.uniforms.uFlowSign.value = p.flow || 1
        return m
      }),
    [model],
  )

  const root = useRef(null)
  const nodes = useRef([])

  useLayoutEffect(() => {
    const offs = model.parts.map((p, i) => registerAnchor(p.id, nodes.current[i]))
    onReady?.(model)
    return () => offs.forEach((off) => off && off())
  }, [model, onReady])

  // explicit GPU cleanup: R3F disposes what it created in the graph, and these
  // are built by hand from data
  useEffect(
    () => () => {
      for (const g of model.parts) g.geometry.dispose?.()
      for (const m of mats) m.dispose?.()
    },
    [model, mats],
  )

  useFrame((st, dt) => {
    const g = root.current
    if (!g) return
    const S = {
      open: A.open,
      cut: A.cut,
      dim: A.dim,
      isolate: A.isolate,
      chart: A.chart,
      shrink: A.shrink,
      sac: A.sac,
    }
    const focus = state.hovered || state.focused
    const flow = flowAt()

    for (let i = 0; i < model.parts.length; i++) {
      const part = model.parts[i]
      const node = nodes.current[i]
      if (!node) continue
      part.reveal = applyRig(node, part.rig, S.open)
      const mat = mats[i]
      applyPartMaterial(part, mat, S, focus, dt)
      /* Shader uniforms only: the fat pad and the valve leaflets are lit with a
         standard material and have no uniform block at all, which used to throw
         here on the first frame. One `u` guard, every branch. */
      const u = mat?.uniforms

      if (u && (part.group === "wire" || part.mat === "wire")) {
        if (u.uFlow) u.uFlow.value = flow
        if (u.uActive) u.uActive.value = clamp01(0.3 + S.isolate * 0.85 + (S.chart > 0.4 ? 0.3 : 0))
      }
      if (part.group === "node") {
        const when = ARRIVAL[part.id] ?? 0.5
        const hit = clamp01((flow - when) / 0.05) * (1 - smoothTail(flow, when))
        const s = 1 + hit * 0.9 + A.beat * 0.06
        node.scale.multiplyScalar(s)
        if (u?.uOpacity) u.uOpacity.value = lerp(0.35, 1, hit) * (0.4 + S.isolate * 0.6)
      }
      if (u && (part.group === "vessel" || part.group === "coronary")) {
        if (u.uFlow) u.uFlow.value = (st.clock.elapsedTime * 0.05) % 1
      }
    }

    applyStage(g, A.shrink)
    // the whole organ is the subject: keep it out of the fog the far field uses
    g.visible = true
  })

  return (
    <group ref={root} name="heart">
      {model.parts.map((p, i) => (
        <group key={p.id} ref={(el) => (nodes.current[i] = el)}>
          <mesh
            geometry={p.geometry}
            material={mats[i]}
            onPointerOver={
              interactive && isInteractive(p)
                ? (e) => {
                    e.stopPropagation()
                    if (state.hovered !== p.id) setState("hovered", p.id)
                    document.body.style.cursor = p.hotspot ? "pointer" : "crosshair"
                  }
                : undefined
            }
            onPointerOut={
              interactive && isInteractive(p)
                ? () => {
                    if (state.hovered === p.id) setState("hovered", null)
                    document.body.style.cursor = ""
                  }
                : undefined
            }
            onClick={
              p.hotspot
                ? (e) => {
                    e.stopPropagation()
                    setState("focused", state.focused === p.id ? null : p.id)
                  }
                : undefined
            }
          />
        </group>
      ))}
      <Valves />
    </group>
  )
}

function smoothTail(flow, when) {
  const end = 0.92
  if (flow < end) return 0
  return clamp01((flow - end) / 0.08)
}
