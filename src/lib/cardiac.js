import { clamp01, lerp } from "./math.js"
import { HEART } from "../config.js"

/**
 * cardiac.js — the physiology behind the numbers the UI quotes.
 *
 * Cardiac output = stroke volume x heart rate. Both rise with exertion, but
 * stroke volume plateaus early (the ventricle is already nearly empty and the
 * filling time is collapsing) while rate keeps climbing — which is exactly why
 * a very fast rhythm can be *less* effective, and is a favourite exam twist.
 */

/**
 * 0 = sitting still, 1 = all-out. The resting rate is `HEART.bpm` — the same
 * constant the beat envelope uses, so the number in this panel is the number
 * the model is pulsing at.
 */
export function cardiacAt(exertion = 0, { trained = 0, age = 17 } = {}) {
  const e = clamp01(exertion)
  const max = maxHr(age)
  const hr = lerp(HEART.bpm - trained * 14, Math.min(max, 196), Math.pow(e, 0.82))
  const sv = lerp(70, 118 + trained * 22, clamp01(e * 2.1))
  const co = (hr * sv) / 1000
  return {
    hr: Math.round(hr),
    sv: Math.round(sv),
    co: +co.toFixed(1),
    maxHr: max,
    zone: zoneFor(hr, max),
    /** diastole shortens faster than systole as rate rises — coronaries fill in
        diastole, so this ratio is the reason rate is the enemy ischaemia */
    diastoleFrac: +diastoleFraction(60 / hr).toFixed(2),
  }
}

/** Tanaka formula: 208 - 0.7 x age. */
export function maxHr(age = 17) {
  return Math.round(208 - 0.7 * age)
}

export function zoneFor(hr, max) {
  const f = hr / max
  if (f < 0.6) return "resting"
  if (f < 0.7) return "fatigue-burning"
  if (f < 0.8) return "aerobic"
  if (f < 0.9) return "threshold"
  return "anaerobic"
}

/** Systole ~0.35 of a slow cycle, shrinking toward ~0.25 of a fast one. */
export function diastoleFraction(secondsPerBeat) {
  const s = Math.max(0.2, secondsPerBeat)
  const systole = Math.min(0.35, Math.max(0.2, 0.35 * Math.pow(s / 0.8, 0.35)))
  return 1 - systole / s
}

/** One cardiac cycle in seconds at a given rate. */
export const cycleAt = (hr) => 60 / Math.max(1, hr)

/** Ejection fraction, expressed the way an examiner wants it. */
export const ejectionFraction = (edv = 120, esv = 50) => Math.round(((edv - esv) / edv) * 100)
