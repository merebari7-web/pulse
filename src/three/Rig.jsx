import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { CAMERA_KEYS } from "../data/journey.js"
import { A } from "./anim.js"
import { TUNE } from "../config.js"
import { clamp01, damp, lerp, smoothstep } from "../lib/math.js"
import { resolveAt, state } from "../lib/store.js"
import { lookTarget, setLookTarget } from "./stage.js"

/**
 * Rig — the camera flight.
 *
 * Position and aim are two Catmull–Rom splines through the chapter keyframes,
 * sampled at a `u` derived from scroll, so the fly-through is one continuous
 * curve (no seams between sections) yet every keyframe lands exactly where the
 * overlay copy says it should. On top of that:
 *   • damped follow, so a hard scroll stop reads as weight, not a jump
 *   • azimuth-following key light direction handed to <Lights/> via stage.js
 *   • pointer parallax of a fraction of a degree, on position *and* roll
 *   • portrait: dolly out along the view vector and widen FOV, so the model
 *     never sits behind the headline on a phone
 */

const KEYS = CAMERA_KEYS
const N = KEYS.length - 1

export function Rig({ enabled = true }) {
  const rollRef = useRef(0)
  const splines = useMemo(() => {
    const pos = new THREE.CatmullRomCurve3(
      KEYS.map((k) => new THREE.Vector3(...k.pos)),
      false,
      "catmullrom",
      0.42,
    )
    const look = new THREE.CatmullRomCurve3(
      KEYS.map((k) => new THREE.Vector3(...k.look)),
      false,
      "catmullrom",
      0.42,
    )
    return { pos, look }
  }, [])

  const tmp = useMemo(
    () => ({
      p: new THREE.Vector3(),
      l: new THREE.Vector3(),
      v: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      q: new THREE.Quaternion(),
    }),
    [],
  )

  useFrame((st, dt) => {
    const cam = st.camera
    if (!enabled) return
    const d = Math.min(0.05, Math.max(0.0005, dt))

    // ---- scroll → spline parameter, chapter-aligned ------------------------
    const s = A.scroll
    let seg = 0
    for (let i = 1; i < N + 1; i++) {
      if (s <= resolveAt(KEYS[i].at.chapter, KEYS[i].at.t)) {
        seg = i - 1
        break
      }
      seg = N - 1
    }
    const a0 = resolveAt(KEYS[seg].at.chapter, KEYS[seg].at.t)
    const a1 = resolveAt(KEYS[seg + 1].at.chapter, KEYS[seg + 1].at.t)
    const local = clamp01((s - a0) / (a1 - a0 || 1))
    const u = clamp01((seg + smoothstep(0, 1, local)) / N)

    splines.pos.getPoint(u, tmp.p)
    splines.look.getPoint(u, tmp.l)

    // ---- framing per viewport shape --------------------------------------
    const aspect = st.size.width / Math.max(1, st.size.height)
    const portrait = clamp01((1.15 - aspect) / 0.9)
    if (portrait > 0.001) {
      tmp.v.copy(tmp.p).sub(tmp.l)
      tmp.v.multiplyScalar(1 + portrait * (TUNE.portraitPush - 1))
      tmp.p.copy(tmp.l).add(tmp.v)
      tmp.p.y += portrait * 0.5
    }

    // ---- idle orbit so the shot is never dead -----------------------------
    const spin = state.reduced ? 0 : A.time * TUNE.idleOrbit * (A.orbit ?? 0.5)
    tmp.v.copy(tmp.p).sub(tmp.l)
    const radius = tmp.v.length()
    const theta = Math.atan2(tmp.v.x, tmp.v.z) + spin
    const phi = Math.acos(clamp01(tmp.v.y / (radius || 1)))
    tmp.p.set(
      tmp.l.x + Math.sin(theta) * Math.sin(phi) * radius,
      tmp.l.y + Math.cos(phi) * radius + Math.sin(A.time * 0.31) * 0.06,
      tmp.l.z + Math.cos(theta) * Math.sin(phi) * radius,
    )

    // ---- pointer parallax (fractions of a degree, on purpose) -------------
    const par = TUNE.parallax
    tmp.p.x += A.parallax.x * par.yaw * radius * 0.35
    tmp.p.y += -A.parallax.y * par.pitch * radius * 0.35

    // ---- damped follow ----------------------------------------------------
    cam.position.set(
      damp(cam.position.x, tmp.p.x, TUNE.cameraLambda, d),
      damp(cam.position.y, tmp.p.y, TUNE.cameraLambda, d),
      damp(cam.position.z, tmp.p.z, TUNE.cameraLambda, d),
    )
    const lx = damp(lookTarget.x, tmp.l.x, TUNE.cameraLambda * 1.15, d)
    const ly = damp(lookTarget.y, tmp.l.y, TUNE.cameraLambda * 1.15, d)
    const lz = damp(lookTarget.z, tmp.l.z, TUNE.cameraLambda * 1.15, d)
    setLookTarget(lx, ly, lz)
    cam.lookAt(lx, ly, lz)

    // roll is applied after lookAt, so it is a *local* Z rotation — a camera
    // roll, not a world tilt. Damped separately because lookAt rewrites the
    // quaternion every frame and cam.rotation.z is therefore never a residue.
    const roll = lerp(KEYS[seg].roll ?? 0, KEYS[seg + 1].roll ?? 0, smoothstep(0, 1, local)) + A.parallax.x * 0.014
    rollRef.current = damp(rollRef.current, roll, 2.4, d)
    cam.rotateZ(rollRef.current)

    // ---- FOV: closes for the deep dive, widens on phones ------------------
    const baseFov = lerp(KEYS[seg].fov, KEYS[seg + 1].fov, smoothstep(0, 1, local))
    const target = baseFov * (1 + portrait * (TUNE.fovWiden - 1)) + A.beat * 0.22
    if (cam.isPerspectiveCamera && Math.abs(cam.fov - target) > 0.02) {
      cam.fov = damp(cam.fov, target, 2.6, d)
      cam.updateProjectionMatrix()
    }
  }, -1)

  return null
}
