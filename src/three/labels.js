import { useMemo } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { LABELS } from "../data/anatomy.js"
import { getAnchor } from "./registry.js"
import { resolveAt, scene } from "../lib/store.js"
import { clamp01, smoothstep } from "../lib/math.js"
import { modelCenter } from "./stage.js"

/**
 * labels.js — HTML labels pinned to 3D points, without React in the loop.
 *
 * The overlay renders one absolutely-positioned node per label and registers it
 * here by id. Each frame (priority -0.5, i.e. after the camera rig has moved and
 * before the composer renders) we project the anchor's world position into CSS
 * pixels and write `transform`/`opacity` straight to the element. That is ~34
 * style writes per frame instead of ~34 React renders, and it is what keeps the
 * type welded to the model while the camera flies.
 *
 * A label also fades when its anchor swings to the far side of the organ, which
 * is why the text never appears to float through the heart.
 */

const els = new Map()
const extraDefs = []
const defListeners = new Set()

/** The DOM layer re-renders when a component adds labels (the chart does). */
export function onDefsChange(fn) {
  defListeners.add(fn)
  return () => defListeners.delete(fn)
}
function emit() {
  for (const fn of defListeners) fn()
}

export function registerLabelEl(id, el) {
  if (!el) {
    els.delete(id)
    return
  }
  els.set(id, el)
}

/** Components can add labels for things they generate (chart bars, nodes…). */
export function registerLabelDef(def) {
  const i = extraDefs.findIndex((d) => d.id === def.id)
  if (i >= 0) extraDefs[i] = def
  else extraDefs.push(def)
  emit()
  return () => {
    const j = extraDefs.findIndex((d) => d.id === def.id)
    if (j >= 0) extraDefs.splice(j, 1)
    emit()
  }
}

export function labelDefs() {
  return LABELS.concat(extraDefs)
}

const _v = new THREE.Vector3()
const _d = new THREE.Vector3()
const ZERO = [0, 0, 0]

export function projectAll({ camera, width, height }) {
  const defs = labelDefs()
  let visible = 0
  for (const def of defs) {
    const el = els.get(def.id)
    if (!el) continue
    const obj = getAnchor(def.target)
    const t0 = resolveAt(def.from ?? 0, def.show?.[0] ?? 0)
    const t1 = resolveAt(def.from ?? 0, def.show?.[1] ?? 1)
    const gate = smoothstep(t0 - 0.015, t0 + 0.03, scene.scroll) * (1 - smoothstep(t1 - 0.03, t1 + 0.02, scene.scroll))
    if (!obj || gate <= 0.004 || !obj.visible) {
      if (el.style.opacity !== "0") el.style.opacity = "0"
      continue
    }
    obj.getWorldPosition(_v)
    const off = def.offset || ZERO
    _v.x += off[0]
    _v.y += off[1]
    _v.z += off[2]

    // far side of the organ → tuck it away rather than let it float over
    _d.copy(_v).sub(modelCenter)
    const radial = _d.lengthSq() > 1e-6 ? _d.normalize() : _d.set(0, 0, 1)
    _d.copy(camera.position).sub(modelCenter).normalize()
    const facing = clamp01((radial.dot(_d) + 0.35) / 1.05)

    _v.project(camera)
    const behind = _v.z > 1
    const x = (_v.x * 0.5 + 0.5) * width
    const y = (-_v.y * 0.5 + 0.5) * height
    const inside = x > -80 && x < width + 80 && y > -40 && y < height + 40
    const a = behind || !inside ? 0 : gate * (0.15 + facing * 0.85)
    if (a < 0.012) {
      if (el.style.opacity !== "0") el.style.opacity = "0"
      continue
    }
    visible++
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    el.style.opacity = a.toFixed(3)
    const flip = x > width * 0.62
    el.classList.toggle("label__body--flip", flip)
  }
  return visible
}

export function LabelDriver() {
  const size = useMemo(() => ({ w: 0, h: 0 }), [])
  useFrame((st) => {
    if (size.w === st.size.width && size.h === st.size.height) {
      projectAll({ camera: st.camera, width: st.size.width, height: st.size.height })
      return
    }
    size.w = st.size.width
    size.h = st.size.height
    projectAll({ camera: st.camera, width: size.w, height: size.h })
  }, -0.5)
  return null
}
