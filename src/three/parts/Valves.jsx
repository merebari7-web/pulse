import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { VALVES } from "../../data/anatomy.js"
import { makeValveMaterial } from "../materials.js"
import { makeRig, applyRig } from "../explode.js"
import { valveLayout, makeTube } from "../geometry.js"
import { A } from "../anim.js"
import { clamp01, lerp, smoothstep } from "../../lib/math.js"
import { state } from "../../lib/store.js"
import { STAGGER } from "../heart/build.js"

/**
 * The four valves — and the reason they are worth modelling at all: they open
 * on a pressure difference, not on a command.
 *   • AV valves (tricuspid, bicuspid) are sealed across systole, tethered by
 *     chordae tendineae to the papillary muscles so they cannot invert.
 *   • Semilunar valves (pulmonary, aortic) are open across ejection.
 * Their two closures are S1 and S2, so the cusps are animated off the same beat
 * envelope the myocardium uses — sound and motion from one clock.
 */

const AV = { open: 0.62, shut: -0.1, len: 1.45 }
const SL = { open: 0.8, shut: -0.05, len: 0.72 }

/** 1 inside [from,to] of the cardiac cycle, 0 outside, with soft shoulders. */
function window01(phase, from, to) {
  const a = smoothstep(from, from + 0.05, phase)
  const b = 1 - smoothstep(to - 0.05, to, phase)
  return clamp01(Math.min(a, b))
}

export function Valves({ revealShift = 0 }) {
  const nodes = useRef([])
  const cuspRefs = useRef([])
  const mat = useMemo(() => makeValveMaterial(), [])

  const build = useMemo(
    () =>
      VALVES.map((v) => {
        const av = v.type === "av"
        const K = av ? AV : SL
        const ring = new THREE.TorusGeometry(v.r, v.r * 0.16, 10, 32).rotateX(Math.PI / 2)
        const cuspGeo = av
          ? new THREE.ConeGeometry(v.r * 0.7, v.r * K.len, 16, 1, true).rotateX(Math.PI)
          : new THREE.SphereGeometry(v.r * 0.66, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.66, 1)
        const papillaryGeo = av ? new THREE.ConeGeometry(v.r * 0.3, v.r * 1.5, 12, 1).rotateX(Math.PI) : null

        const cords = []
        if (av) {
          for (let s = 0; s < 2; s++) {
            const side = s === 0 ? 1 : -1
            const tip = [side * v.r * 0.5, -v.r * 1.5, side * v.r * 0.18]
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 + s * 0.9
              const rim = [Math.cos(a) * v.r * 0.86, -v.r * 0.1, Math.sin(a) * v.r * 0.86]
              const mid = [(rim[0] + tip[0]) * 0.5, -v.r * 0.85, (rim[2] + tip[2]) * 0.5]
              cords.push({ kind: "chord", pts: [rim, mid, tip], r0: v.r * 0.05, r1: v.r * 0.032 })
            }
            cords.push({ kind: "pap", pos: tip })
          }
        }

        return {
          v,
          av,
          K,
          ring,
          cuspGeo,
          papillaryGeo,
          layout: valveLayout({ cusps: v.cusps, r: v.r, type: v.type }),
          cords: cords.map((c) => (c.kind === "chord" ? { ...c, geo: makeTube({ pts: c.pts, r0: c.r0, r1: c.r1, seg: 8, radial: 5 }) } : c)),
          rig: makeRig({ pos: v.pos, rot: v.rot, push: v.push, stagger: STAGGER.valve + revealShift }),
        }
      }),
    [revealShift],
  )

  useFrame(() => {
    const ph = A.beatPhase
    const calm = state.reduced || A.cycle > 8
    const avShut = calm ? 0.25 : window01(ph, 0.03, 0.44)
    const slShut = calm ? 0.2 : 1 - window01(ph, 0.08, 0.42)

    for (let i = 0; i < build.length; i++) {
      const node = nodes.current[i]
      if (!node) continue
      const b = build[i]
      applyRig(node, b.rig)
      const shut = b.av ? avShut : slShut
      const list = cuspRefs.current[i] || []
      for (let c = 0; c < list.length; c++) {
        const m = list[c]
        if (!m) continue
        const base = b.layout[c]
        const tilt = lerp(b.K.open, b.K.shut, shut)
        m.rotation.x = base.rot[0] + tilt
        m.rotation.z = base.rot[2] - tilt * 0.4
      }
      // the annulus itself contracts ~10% in systole — real, and it reads
      node.children[0]?.children[0]?.scale.setScalar(1 - shut * 0.1)
    }
  })

  return (
    <group name="valves">
      {build.map((b, i) => (
        <group
          key={b.v.id}
          ref={(el) => {
            nodes.current[i] = el
          }}
        >
          <group>
            <mesh geometry={b.ring} material={mat} />
            {b.layout.map((c, k) => (
              <mesh
                key={c.key}
                ref={(el) => {
                  ;(cuspRefs.current[i] ||= [])[k] = el
                }}
                geometry={b.cuspGeo}
                material={mat}
                position={c.pos}
                rotation={[c.rot[0], c.rot[1], c.rot[2]]}
              />
            ))}
            {b.cords.map((c, k) =>
              c.kind === "chord" ? (
                <mesh key={`c${k}`} geometry={c.geo} material={mat} />
              ) : (
                <mesh key={`p${k}`} geometry={b.papillaryGeo} material={mat} position={c.pos} />
              ),
            )}
          </group>
        </group>
      ))}
    </group>
  )
}
