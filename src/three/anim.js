import { clamp01, damp, beatEnvelope, frac } from "../lib/math.js"
import { scene, state } from "../lib/store.js"
import { HEART } from "../config.js"

/**
 * anim.js — the eased half of the frame loop.
 *
 * `scene` holds what the scroll says. `A` holds what the objects actually do:
 * the same numbers, low-pass filtered, so a flick of the wheel becomes a glide
 * and a hard stop never snaps a hinge. Everything in the scene reads `A`,
 * nothing reads `scene` directly.
 */

/** Keys copied from the store, in order of how softly they should follow. */
const SOFT = {
  open: 3.4,
  cut: 3.0,
  dim: 5.0,
  isolate: 3.6,
  chart: 4.2,
  ribbon: 4.6,
  dust: 2.2,
  bloom: 2.6,
  shrink: 3.0,
  orbit: 1.6,
  trail: 2.4,
  sac: 2.8,
  focus: 2.0,
}

export const A = {
  time: 0,
  dt: 0,
  /* beat */
  beatPhase: 0,
  beat: 0,
  bpm: HEART.bpm,
  cycle: 60 / HEART.bpm,
  /* journey */
  scroll: 0,
  velocity: 0,
  /* eased tracks */
  ...Object.fromEntries(Object.keys(SOFT).map((k) => [k, 0])),
  /* interaction */
  hover: 0,
  hoverTarget: null,
  parallax: { x: 0, y: 0 },
  /* runtime */
  quality: 1,
}

/** Initialise from the store so a mid-page reload (scroll restoration) is correct. */
export function prime() {
  for (const k in SOFT) A[k] = scene[k] ?? 0
  A.scroll = scene.scroll ?? 0
  A.time = 0
}

export function stepAnim(dt) {
  const clamped = Math.min(0.05, Math.max(0.0005, dt))
  A.dt = clamped
  A.time += clamped
  A.scroll = clamp01(scene.scroll ?? 0)
  A.velocity = damp(A.velocity, clamp01(Math.abs(state.velocity || 0)) * (state.velocity < 0 ? -1 : 1), 3.2, clamped)

  for (const k in SOFT) A[k] = damp(A[k], scene[k] ?? 0, SOFT[k], clamped)

  /* ---- heart rate: resting 74 bpm, climbing with scroll speed and with the
     exertion slider in the data chapter. This is the number that drives the
     beat envelope, the ribbon sweep and the HUD, so one source, many effects. */
  const ex = clamp01(state.exertion ?? 0)
  const exBpm = 64 + ex * 126
  const rush = Math.min(1, Math.abs(A.velocity) * 1.4)
  const target = state.reduced ? HEART.bpm : ex > 0.001 ? exBpm + rush * 18 : HEART.bpm + rush * 34
  A.bpm = damp(A.bpm, target, 1.5, clamped)
  A.cycle = 60 / A.bpm

  const prev = A.beatPhase
  A.beatPhase = frac(A.beatPhase + clamped / A.cycle)
  if (A.beatPhase < prev) A.beatCount = (A.beatCount || 0) + 1
  A.beat = state.reduced ? 0.16 : beatEnvelope(A.beatPhase)

  A.hover = damp(A.hover, state.hovered ? 1 : 0, 6, clamped)
  const px = state.pointer?.x ?? 0
  const py = state.pointer?.y ?? 0
  A.parallax.x = damp(A.parallax.x, px, 3.4, clamped)
  A.parallax.y = damp(A.parallax.y, py, 3.4, clamped)
}

/** 0..1 how far the depolarisation wavefront has travelled this cycle. */
export function flowAt(start = 0.06) {
  const p = clamp01((A.beatPhase - start) / 0.34)
  return p
}

/**
 * Layer reveal for the exploded view, shared by every part so the peel reads as
 * one continuous gesture: layer `stagger` (0..1) starts after `stagger*0.55` of
 * the track and finishes 0.5 later, smoothstepped.
 */
function smooth(stagger, open) {
  const a = stagger * 0.55
  const t = clamp01((open - a) / 0.5)
  return t * t * (3 - 2 * t)
}

export { smooth as layerReveal }
