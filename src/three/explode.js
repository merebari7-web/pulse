import * as THREE from "three"
import { TUNE } from "../config.js"
import { A, layerReveal } from "./anim.js"

/**
 * explode.js — how a part gets out of the way.
 *
 * Every piece of the model is described by a *rig*: resting transform, a push
 * vector, a layer stagger and an optional tilt about an axis through its own
 * centroid (so wall flaps curl away like petals instead of sliding like boxes).
 * One function applies the current eased journey state to it, allocation-free,
 * which is why 30-odd parts cost nothing per frame.
 */

const _axis = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q0 = new THREE.Quaternion()

export function makeRig({ pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, push = [0, 0, 0], stagger = 0.5, axis = null, angle = 0, explodeScale = 1 } = {}) {
  const rig = {
    pos: [...pos],
    rot: [...rot],
    scale: Array.isArray(scale) ? [...scale] : [scale, scale, scale],
    push: [...push],
    stagger,
    axis: axis ? [...axis] : null,
    angle,
    explodeScale,
  }
  if (rig.axis) {
    const l = Math.hypot(...rig.axis) || 1
    rig.axis = rig.axis.map((v) => v / l)
  }
  return rig
}

const EPS = 1e-6

/** Apply the eased state to one Object3D. Returns the reveal factor it used. */
export function applyRig(obj, rig, open = A.open) {
  const k = layerReveal(rig.stagger, open)
  const p = rig.push
  const e = TUNE.explode
  obj.position.set(rig.pos[0] + p[0] * k * e, rig.pos[1] + p[1] * k * e, rig.pos[2] + p[2] * k * e)

  if (rig.axis) {
    _q1.setFromAxisAngle(_axis.set(rig.axis[0], rig.axis[1], rig.axis[2]), rig.angle * k)
    _q0.setFromEuler(ROT.set(rig.rot[0], rig.rot[1], rig.rot[2], "XYZ"))
    obj.quaternion.copy(_q0.multiply(_q1))
  } else {
    obj.rotation.set(rig.rot[0], rig.rot[1] + rig.angle * k * 0.35, rig.rot[2])
  }

  // build.js writes rigs as plain literals ({ scale: 1 }) and model.js writes
  // them through makeRig ({ scale: [1,1,1] }, explodeScale set). Both are legal,
  // so normalise here — a bare `s[0]` on a number used to scale the whole model
  // to NaN, which is another way of saying "nothing renders".
  const s = rig.scale
  const sx = typeof s === "number" ? s : s[0]
  const sy = typeof s === "number" ? s : s[1]
  const sz = typeof s === "number" ? s : s[2]
  const g = 1 + ((rig.explodeScale ?? 1) - 1) * k
  obj.scale.set(sx * g, sy * g, sz * g)
  obj.userData.reveal = k
  return k
}

const ROT = new THREE.Euler()

/** Whole-organ placement: aside and smaller during the data chapter. */
export function applyStage(group, shrink = A.shrink, { at = [-2.6, 0.7, 0.4], scale = 0.5, tilt = 0.24 } = {}) {
  const s = 1 + (scale - 1) * shrink
  group.position.set(at[0] * shrink, at[1] * shrink, at[2] * shrink)
  group.scale.setScalar(s)
  group.rotation.z = tilt * shrink
  group.rotation.x = -tilt * 0.4 * shrink
  return s
}
