/**
 * Motion policy — one place that decides how much movement this device gets.
 *
 * Read at import time (before React mounts) so the first paint already obeys it:
 *   - `reduce`  : prefers-reduced-motion → no beat, no idle orbit, no smoothing,
 *                 scroll still *maps* to the scene (that is the whole point of the
 *                 page) but nothing animates on its own.
 *   - `tier`    : crude device tier from DPR + cores + memory, used for particle
 *                 counts, AO samples and the antialias toggle.
 *   - `coarse`  : touch/pointer; switches on tap-target sizing and label flipping.
 *   - `webgl`   : 2 / 1 / 0 — 0 means we render the text edition instead of the canvas.
 */

const mq = (q) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches

export function probeWebGL() {
  if (typeof document === "undefined") return 0
  try {
    const c = document.createElement("canvas")
    if (c.getContext("webgl2")) return 2
    if (c.getContext("webgl") || c.getContext("experimental-webgl")) return 1
    return 0
  } catch {
    return 0
  }
}

function deviceTier(webgl) {
  if (!webgl) return "off"
  const nav = typeof navigator !== "undefined" ? navigator : {}
  const dpr = globalThis.window?.devicePixelRatio || 1
  const cores = nav.hardwareConcurrency || 4
  const mem = nav.deviceMemory || 4
  const w = globalThis.window || {}
  const pixels = (w.innerWidth || 1200) * (w.innerHeight || 800) * dpr * dpr
  if (webgl < 2) return "low"
  if (cores >= 8 && mem >= 4 && pixels < 5.2e6) return "high"
  if (cores >= 4) return "mid"
  return "low"
}

const reduce = mq("(prefers-reduced-motion: reduce)")
const webgl = probeWebGL()

export const motion = {
  reduce,
  coarse: mq("(pointer: coarse)"),
  touch: typeof window !== "undefined" ? "ontouchstart" in window : false,
  webgl,
  tier: deviceTier(webgl),
  dpr: Math.min(globalThis.window?.devicePixelRatio || 1, 2),
}

/** Quality knobs the scene reads once. Lower tier → fewer particles, no AO, DPR 1. */
export const QUALITY = {
  high: { particles: 6000, trails: 1400, ao: true, dpr: [1, 2], bloom: 0.85, multisampling: 4 },
  mid: { particles: 3200, trails: 800, ao: true, dpr: [1, 1.75], bloom: 0.8, multisampling: 2 },
  low: { particles: 1400, trails: 400, ao: false, dpr: [1, 1.25], bloom: 0.7, multisampling: 0 },
  off: { particles: 0, trails: 0, ao: false, dpr: [1, 1], bloom: 0, multisampling: 0 },
}

export const quality = QUALITY[motion.tier] || QUALITY.low

/* ---- `calm` is a user-facing toggle that layers on top of the OS setting ---- */

const listeners = new Set()
let calm = reduce

function paint() {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("calm", calm)
  document.documentElement.dataset.motion = calm ? "calm" : "full"
}
paint()

export function setCalm(on) {
  calm = !!on
  motion.reduce = calm
  paint()
  listeners.forEach((f) => f(calm))
  return calm
}

export function toggleCalm() {
  return setCalm(!calm)
}

export function isCalm() {
  return calm
}

export function onCalmChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
