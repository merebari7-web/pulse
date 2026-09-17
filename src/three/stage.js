/**
 * stage.js — three numbers the whole scene shares that are not worth a store.
 * The camera aim point (used by the light rig and the ground disc) and the
 * model root transform, published by <Heart/> so <DataViz/> can place the chart
 * relative to wherever the heart actually ended up this frame.
 */
import * as THREE from "three"

export const lookTarget = new THREE.Vector3(0, 0.2, 0)
export const modelCenter = new THREE.Vector3(0, 0, 0)
export const modelScale = { value: 1 }

export function setLookTarget(x, y, z) {
  lookTarget.set(x, y, z)
}
