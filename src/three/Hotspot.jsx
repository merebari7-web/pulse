import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { HOTSPOTS } from "../data/anatomy.js"
import { makeGround, makeNodeMaterial } from "./materials.js"
import { getAnchor } from "./registry.js"
import { set as setState, state } from "../lib/store.js"
import { A } from "./anim.js"
import { clamp01, lerp, smoothstep } from "../lib/math.js"

/**
 * Hotspots — the clickable, glowing nodes of the deep dive.
 *
 * Each one is a billboarded halo (the same additive radial program the pedestal
 * uses, on a small disc) plus a hit sphere, so clicking the *light* is clicking
 * the node. They are positioned by reading their anatomy part's live world
 * transform, which means they stay glued to the node while the whole layer is
 * flying apart during the explode — no second set of coordinates to maintain.
 */

const HALO = new THREE.CircleGeometry(0.36, 40)
const HIT = new THREE.SphereGeometry(0.3, 14, 10)
const RING = new THREE.TorusGeometry(0.2, 0.008, 6, 40)

export function Hotspots({ visible = true }) {
  const groups = useRef([])
  const halos = useRef([])
  const rings = useRef([])
  const haloMat = useMemo(() => makeGround(), [])
  const nodeMat = useMemo(() => makeNodeMaterial(), [])
  const ringMat = useMemo(() => makeNodeMaterial("#ffffff"), [])

  useFrame((st) => {
    const k = clamp01(Math.max(A.isolate, state.focused ? 0.65 : 0) + A.trail * 0.2)
    haloMat.uniforms.uOpacity.value = 0.55 * k
    for (let i = 0; i < HOTSPOTS.length; i++) {
      const g = groups.current[i]
      if (!g) continue
      const anchor = getAnchor(HOTSPOTS[i].id)
      if (anchor) g.position.copy(anchor.position)
      g.visible = visible && k > 0.02
      const halo = halos.current[i]
      if (halo) {
        halo.quaternion.copy(st.camera.quaternion)
        const bump = 1 + A.beat * 0.16
        halo.scale.setScalar(bump * (0.9 + k * 0.5))
      }
      const ring = rings.current[i]
      if (ring) {
        const active = state.focused === HOTSPOTS[i].id
        ring.rotation.z += 0.004 + (active ? 0.01 : 0)
        const t = (st.clock.elapsedTime * 0.55 + i * 0.23) % 1
        ring.scale.setScalar(lerp(0.7, 1.7, t) * (active ? 1.15 : 1))
        ring.material.opacity = (1 - t) * (active ? 0.9 : 0.34) * k
        ring.visible = true
      }
    }
  })

  return (
    <group name="hotspots">
      {HOTSPOTS.map((h, i) => (
        <group key={h.id} ref={(el) => (groups.current[i] = el)}>
          <mesh ref={(el) => (halos.current[i] = el)} geometry={HALO} material={haloMat} renderOrder={4} />
          <mesh ref={(el) => (rings.current[i] = el)} geometry={RING} material={ringMat} renderOrder={5} />
          <mesh
            geometry={HIT}
            material={nodeMat}
            onPointerOver={(e) => {
              e.stopPropagation()
              setState("hovered", h.id)
              document.body.style.cursor = "pointer"
            }}
            onPointerOut={() => {
              if (state.hovered === h.id) setState("hovered", null)
              document.body.style.cursor = ""
            }}
            onClick={(e) => {
              e.stopPropagation()
              setState("focused", state.focused === h.id ? null : h.id)
            }}
          />
        </group>
      ))}
    </group>
  )
}

/** How far the wavefront has reached each hotspot, for the DOM panel to quote. */
export function activation(phase) {
  return HOTSPOTS.map((h, i) => {
    const when = [0.02, 0.3, 0.44, 0.62][i]
    return { id: h.id, on: smoothstep(when, when + 0.08, phase) }
  })
}
