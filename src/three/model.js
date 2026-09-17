import * as THREE from "three"
import { MODEL } from "../config.js"
import { makeRig } from "./explode.js"

/**
 * model.js — the drop-in path for a real scanned modelled heart.
 *
 * The procedural scene is the default; if `MODEL.url` is set in src/config.js,
 * whatever you load is matched to the internal part ids by node name and given a
 * rig *derived from its own bounding box* — so an exploded view of a model you
 * downloaded works with zero extra authoring, as long as its parts are separate
 * nodes named like `ventricle_l`, `aorta`, `valve_mitral`…
 *
 * Pure-ish (three math only, no renderer), so the matching is unit-tested.
 */

/** Case-insensitive substring match against the configured map. */
export function matchPart(name, map = MODEL.map) {
  if (!name) return null
  const n = String(name).toLowerCase()
  let best = null
  let bestLen = 0
  for (const [key, id] of Object.entries(map)) {
    const k = key.toLowerCase()
    if (n.includes(k) && k.length > bestLen) {
      best = id
      bestLen = k.length
    }
  }
  return best
}

/** Push direction for a part: straight out from the organ's centre, scaled. */
export function deriveRig(box, center, obj, { lift = 1.5, stagger = 0.5 } = {}) {
  const c = box.getCenter(new THREE.Vector3())
  const dir = c.sub(center)
  if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0)
  dir.normalize()
  const radius = Math.max(0.4, box.getSize(new THREE.Vector3()).length() * 0.4)
  return makeRig({
    // the rig owns the object's *own* local transform as its resting pose, so
    // the same applyRig() that drives the procedural model drives this one
    pos: obj ? [obj.position.x, obj.position.y, obj.position.z] : [0, 0, 0],
    rot: obj ? [obj.rotation.x, obj.rotation.y, obj.rotation.z] : [0, 0, 0],
    push: [dir.x * lift * radius * 0.55, dir.y * lift * radius * 0.5 + lift * 0.15, dir.z * lift * radius * 0.55],
    stagger,
    axis: [dir.z, 0, -dir.x],
    angle: 0.32 * lift,
  })
}

/**
 * Walk a loaded model and return one entry per recognised part, plus a
 * `geometry`-free handle (we animate the objects themselves).
 */
export function deriveParts(root, opts = {}) {
  const { map = MODEL.map, lift = 1.5, keepMaterials = MODEL.replaceMaterials === false } = opts
  const bounds = new THREE.Box3().setFromObject(root)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = Math.max(1e-3, bounds.getSize(new THREE.Vector3()).length())
  const scale = (opts.fitScale ?? 3.4) / size
  const parts = []
  const seen = new Set()
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (!obj.isMesh || seen.has(obj)) return
    const id = matchPart(obj.name, map)
    if (!id || seen.has(id)) return
    seen.add(id)
    const box = new THREE.Box3().setFromObject(obj)
    parts.push({
      id,
      label: id,
      object: obj,
      box,
      rig: deriveRig(box, center, obj, { lift }),
      keepMaterials,
    })
  })
  return { parts, scale, center: center.toArray() }
}
