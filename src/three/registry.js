/**
 * registry.js — a Map of Object3D anchors, written by the scene, read by the
 * DOM label projector. Deliberately not React state: it changes every frame.
 */
const anchors = new Map()

export function registerAnchor(id, obj) {
  if (!obj) return () => anchors.delete(id)
  anchors.set(id, obj)
  return () => {
    if (anchors.get(id) === obj) anchors.delete(id)
  }
}

export function getAnchor(id) {
  return anchors.get(id)
}

export function clearAnchors() {
  anchors.clear()
}
