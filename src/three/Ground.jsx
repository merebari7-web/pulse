import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { makeGround } from "./materials.js"
import { A } from "./anim.js"
import { lookTarget } from "./stage.js"

/**
 * The pedestal: an additive disc under the heart that carries a shock ring out
 * on every beat. It anchors a floating organ in space and gives the bloom
 * something to sit on. It follows the model when the model slides aside for the
 * chart, so the composition never loses its floor.
 */
export function Ground() {
  const mesh = useRef()
  const mat = useMemo(() => makeGround(), [])
  const geo = useMemo(() => new THREE.CircleGeometry(7.2, 96), [])

  useFrame(() => {
    if (!mesh.current) return
    mesh.current.position.set(lookTarget.x * 0.22, -3.5 + A.shrink * 0.25, lookTarget.z * 0.1)
    mesh.current.rotation.x = -Math.PI / 2 + A.open * 0.05
    mat.uniforms.uOpacity.value = 0.6 * (1 - A.shrink * 0.2) * (1 - A.isolate * 0.45)
  })

  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-2} />
}
