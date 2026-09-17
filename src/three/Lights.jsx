import { useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Environment, Lightformer } from "@react-three/drei"
import { L } from "./materials.js"
import { A } from "./anim.js"
import { PALETTE, TUNE } from "../config.js"
import { lookTarget } from "./stage.js"
import { quality } from "../lib/motion.js"
import { lerp } from "../lib/math.js"

/**
 * Lights — the "responsive" part of the lighting brief.
 *
 * The key light is parented to nothing: each frame it is placed at a fixed
 * bearing *relative to the camera's azimuth*, so the model is always lit from
 * the upper-left of frame no matter where the scroll has flown the camera. That
 * keeps the grade consistent across the whole journey, which is the difference
 * between "cinematic" and "a 3D demo".
 *
 * The same numbers are mirrored into the custom shader programs (L), so the
 * hand-written tissue and the real MeshPhysicalMaterial valves are lit by one
 * rig, and the two point lights inside the chambers pulse on the beat — the
 * ventricles genuinely brighten during systole.
 */
export function Lights() {
  const key = useRef()
  const fill = useRef()
  const rim = useRef()
  const ambient = useRef()
  const innerL = useRef()
  const innerR = useRef()
  const v = new THREE.Vector3()

  useFrame(() => {
    const az = Math.atan2(lookTarget.x, lookTarget.z)
    const k = 0.72
    if (key.current) {
      v.set(Math.sin(az + k) * 7.4, 6.2, Math.cos(az + k) * 7.4)
      key.current.position.copy(v).add(lookTarget)
      key.current.target.position.copy(lookTarget)
      key.current.intensity = lerp(2.1, 3.4, A.beat)
      L.uLightDir.value.copy(v).normalize()
      L.uKey.value = key.current.intensity * 0.4
    }
    if (fill.current) {
      const f = v.set(Math.sin(az - 2.3) * 6.5, -2.4, Math.cos(az - 2.3) * 6.5)
      fill.current.position.copy(f).add(lookTarget)
      L.uFillDir.value.copy(f).normalize()
      L.uFill.value = 0.55
    }
    if (rim.current) rim.current.intensity = 1.6 + A.isolate * 2.2
    if (ambient.current) ambient.current.intensity = 0.1 + A.dim * 0.05
    if (innerL.current) innerL.current.intensity = 2.2 + A.beat * 16
    if (innerR.current) innerR.current.intensity = 1.4 + A.beat * 7 * (1 - A.beat * 0.3)
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.12} color={PALETTE.fill} />
      <hemisphereLight intensity={0.24} color={PALETTE.key} groundColor={"#1a0d14"} />
      <directionalLight ref={key} intensity={2.6} color={PALETTE.key} />
      <directionalLight ref={fill} intensity={0.9} color={PALETTE.rim} />
      <directionalLight ref={rim} position={[-3.5, 2.2, -6.5]} intensity={1.7} color={PALETTE.deoxy} />
      {/* inside the chambers: the wall glows from within on the beat */}
      <pointLight ref={innerL} position={[0.42, -0.9, -0.1]} color={PALETTE.oxy} intensity={4} distance={6.5} decay={2} />
      <pointLight ref={innerR} position={[-0.66, -0.6, 0.44]} color={PALETTE.deoxy} intensity={3} distance={6} decay={2} />
      <directionalLight position={[0, -6, 2]} intensity={0.35} color={PALETTE.ember} />

      {quality.ao && (
        /* Image-based lighting built from three emissive planes — no HDR file,
           no network, and the specular on the wet tissue still reads. */
        <Environment resolution={128} frames={1} background={false} blur={0.6}>
          <Lightformer intensity={2.2} color={PALETTE.key} position={[0, 5, -3]} scale={[9, 3, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="circle" intensity={1.6} color={PALETTE.oxy} position={[-5, 0.5, 2]} scale={[3, 3, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="ring" intensity={1.1} color={PALETTE.rim} position={[5, -1, -2]} scale={[4, 4, 1]} rotation-y={-Math.PI / 2} />
        </Environment>
      )}
    </>
  )
}
