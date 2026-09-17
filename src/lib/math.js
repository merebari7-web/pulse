/**
 * math.js — tiny pure helpers shared by the scroll mapper and the shaders.
 * Everything here runs in node too (tools/test-logic.mjs asserts it), which is
 * how a "looks right in the browser" scene becomes a tested system.
 */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a))
export const mix = lerp

/** Frame-rate independent exponential smoothing. `lambda` ≈ responsiveness. */
export const damp = (current, target, lambda, dt) => lerp(target, current, Math.exp(-lambda * dt))

/** Hermite smoothstep, then clamped. Used to make scroll ranges feel organic. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp01(invLerp(edge0, edge1, x))
  return t * t * (3 - 2 * t)
}

/** Ken Perlin's quintic — C2 continuous, no visible seam at the ends. */
export function fade(t) {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Map a value through a list of stops: mapRange(0.5, [0, 0.25, 1], [0, 1, 0]).
 * Stops must be ascending. Out-of-range values clamp to the end values.
 */
export function mapRange(x, stops, values) {
  const n = stops.length
  if (n === 0) return 0
  if (x <= stops[0]) return values[0]
  if (x >= stops[n - 1]) return values[n - 1]
  for (let i = 1; i < n; i++) {
    if (x <= stops[i]) {
      const t = invLerp(stops[i - 1], stops[i], x)
      return lerp(values[i - 1], values[i], t)
    }
  }
  return values[n - 1]
}

/** Ascending check used by the chapter mapper — cheap insurance on data files. */
export function isAscending(list) {
  for (let i = 1; i < list.length; i++) if (list[i] < list[i - 1] - 1e-9) return false
  return true
}

/** Gaussian bump. The heartbeat is two of these (S1 then S2) minus a recoil. */
export function gauss(x, mu, sigma, amp = 1) {
  const d = (x - mu) / (sigma || 1e-6)
  return amp * Math.exp(-0.5 * d * d)
}

/**
 * Cardiac-cycle envelope in [0,1] for phase 0..1 of one beat.
 * Two thumps: ventricular contraction (fat, early) then the semilunar valves
 * closing (shorter, later), with a small negative recoil in between.
 */
export function beatEnvelope(phase, { s1 = 0.1, s1w = 0.085, s2 = 0.33, s2w = 0.055 } = {}) {
  const p = phase - Math.floor(phase)
  const thump = gauss(p, s1, s1w, 1) + gauss(p, s2, s2w, 0.52) - gauss(p, 0.55, 0.16, 0.1)
  return Math.max(0, Math.min(1.25, thump))
}

/** Deterministic hash-based noise so geometry looks organic but is reproducible. */
export function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}

export function wave(t, freq = 1, phase = 0) {
  return Math.sin(t * freq * Math.PI * 2 + phase)
}

/** Wrap to [0,1) */
export const frac = (v) => v - Math.floor(v)

/** Shortest-path angle lerp (radians) — used by the hinging shell halves. */
export function dampAngle(current, target, lambda, dt) {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

/** 60 BPM-style counter used by the HUD: "beats this visit". */
export function formatInt(n) {
  return Math.round(n).toLocaleString("en-US")
}

export function formatSeconds(s) {
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`
}
