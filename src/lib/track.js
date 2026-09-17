import { clamp01, damp, fade, invLerp } from "./math.js"

/**
 * track.js — the mapping layer between scroll and scene state.
 *
 * A *track* is a named animation curve: a sorted list of keyframes plus an
 * easing name. Nothing in the 3D scene reads the scroll number directly; each
 * component reads one resolved track value per frame from the store. That is
 * what makes scrubbing feel continuous instead of steppy, and it puts the whole
 * choreography of the journey in one readable table (see src/data/journey.js).
 *
 * Keyframes are authored in chapter-local space:
 *
 *      at(1, 0.45, 1)        // value 1 when we are 45% through chapter 1
 *
 * …so the choreography survives any edit to chapter weights, viewport height,
 * or the length of the overlay copy.
 */

export function at(chapter, t = 1, value = 1) {
  return { chapter: chapter | 0, t: clamp01(t), value }
}

function absolute(kf, ranges) {
  const r = ranges[Math.max(0, Math.min(ranges.length - 1, kf.chapter))]
  if (!r) return 0
  return r.tStart + (r.tEnd - r.tStart) * clamp01(kf.t)
}

/** Chapter-local keyframes → absolute, ascending [scroll, value] frames. */
export function resolveTrack(keyframes, ranges) {
  return [...keyframes]
    .sort((a, b) => absolute(a, ranges) - absolute(b, ranges))
    .map((k) => [absolute(k, ranges), k.value])
}

export const EASE = {
  linear: (t) => t,
  /** cubic-in-out — the default; matches the "filmic" feel of the scene */
  smooth: (t) => t * t * (3 - 2 * t),
  /** quintic — even softer shoulders, used for camera-ish values */
  soft: fade,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  /** hold the old value, then cross over late — for discrete hops (focus part) */
  snap: (t) => (t < 0.6 ? 0 : fade((t - 0.6) / 0.4)),
}

export function sampleTrack(track, s) {
  const frames = track?.frames
  if (!frames || !frames.length) return 0
  if (s <= frames[0][0]) return frames[0][1]
  const last = frames[frames.length - 1]
  if (s >= last[0]) return last[1]
  for (let i = 1; i < frames.length; i++) {
    if (s <= frames[i][0]) {
      const raw = invLerp(frames[i - 1][0], frames[i][0], s)
      const ease = EASE[track.ease] || EASE.smooth
      return frames[i - 1][1] + (frames[i][1] - frames[i - 1][1]) * ease(raw)
    }
  }
  return last[1]
}

/** { name: [keyframes] | { at, ease } } → { name: { frames, ease } } */
export function buildTracks(defs, ranges) {
  const out = {}
  for (const [name, def] of Object.entries(defs || {})) {
    const keyframes = Array.isArray(def) ? def : def.at
    const ease = Array.isArray(def) ? "smooth" : def.ease || "smooth"
    out[name] = { frames: resolveTrack(keyframes || [], ranges), ease }
  }
  return out
}

/** Every track at once. Cheap: one pass, no allocation of closures. */
export function sampleTracks(tracks, s, into = {}) {
  for (const name in tracks) into[name] = sampleTrack(tracks[name], s)
  return into
}

/**
 * Per-frame smoothing. `lambda` is responsiveness per second — a value of 6
 * covers ~63% of the distance in 1/6 s. All scene values are damped twice:
 * scrub damping (responsive) then object damping (softer) so nothing snaps.
 */
export function dampTo(current, target, lambda, dt) {
  return damp(current, target, lambda, dt)
}
