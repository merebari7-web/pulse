import {
  makeBlood,
  makeFatMaterial,
  makeNodeMaterial,
  makeSac,
  makeTissue,
  makeVessel,
  makeWire,
} from "./materials.js"
import { PALETTE } from "../config.js"
import { clamp01, lerp, smoothstep } from "../lib/math.js"

/**
 * partMaterial.js — one material per part, one factory.
 *
 * Every part gets its OWN ShaderMaterial instance so it can have its own
 * opacity and highlight. That is cheap here: three caches the compiled program
 * by shader+define key, so 40 instances of the tissue program still share one
 * program on the GPU. The *frame-driven* uniforms (uTime, uBeat, uOpen, uDim…)
 * stay shared by reference inside each instance, so nothing needs per-material
 * plumbing in the render loop.
 */

/** Stripe frequency by part: ventricle muscle is coarse, atrial wall is fine. */
function tissueSpec(part) {
  const atrial = part.band === "atrial"
  const apical = part.band === "apical"
  const thick = part.side === "lf" || part.side === "lb" || apical
  return {
    color: PALETTE.myo,
    color2: PALETTE.myoDeep,
    emissive: PALETTE.oxyDeep,
    stripes: thick ? 0.5 : 0.3,
    stripeScale: thick ? 7.5 : 15,
    transmit: atrial ? 1.25 : 0.4,
    rumple: thick ? 0.055 : 0.03,
    ember: 0.1,
    opacity: 1,
  }
}

export function createPartMaterial(part) {
  switch (part.mat) {
    case "tissue":
      if (part.blood === "myo") return makeTissue(tissueSpec(part))
      return makeTissue({ ...tissueSpec(part), opacity: 0.995 })
    case "blood":
      return makeBlood({ oxy: part.blood === "oxy", opacity: 0.9 })
    case "vessel":
    case "coronary":
      return makeVessel({ oxy: part.blood === "oxy", opacity: part.mat === "coronary" ? 0.98 : 1 })
    case "fat":
      return makeFatMaterial()
    case "wire":
      return makeWire({ width: 1 })
    case "node":
      return makeNodeMaterial()
    case "sac":
      return makeSac(0.4)
    default:
      return makeTissue({})
  }
}

/**
 * Per-frame appearance. Pure so the "which layer fades when" logic is a test,
 * not a screenshot.
 *
 * @param part   descriptor from build.js
 * @param mat    its material
 * @param S      { open, cut, dim, isolate, chart, shrink, sac, reveal }
 * @param focus  id of the hovered/focused part, or null
 */
export function applyPartMaterial(part, mat, S, focus, dt = 0.016) {
  const u = mat.uniforms
  if (!u) return
  const revealed = part.reveal ?? 1
  const isFocus = focus === part.id
  const target = TARGETS[part.group] || TARGETS.default

  let opacity = target.opacity
  let ember = target.ember
  let dimK = 1
  let pulse = 1

  switch (part.group) {
    case "flap": {
      // as the wire becomes the subject, the walls turn to glass
      opacity = lerp(1, 0.12, smoothstep(0, 1, S.isolate) * 0.9)
      if (S.chart > 0.001) opacity *= lerp(1, 0.42, S.chart)
      ember = 0.1 + S.cut * 0.2
      break
    }
    case "chamber": {
      opacity = lerp(0.9, 0.3, S.isolate * 0.7)
      ember = 0.42 + 0.3 * S.open
      break
    }
    case "vessel": {
      opacity = lerp(1, 0.34, S.isolate * 0.6)
      if (S.chart > 0.001) opacity *= lerp(1, 0.5, S.chart)
      break
    }
    case "coronary": {
      opacity = lerp(0.96, 0.2, S.isolate * 0.5)
      ember = 0.22 + (isFocus ? 0.6 : 0)
      break
    }
    case "valve": {
      opacity = lerp(0.97, 0.34, S.isolate * 0.5)
      break
    }
    case "wire":
    case "node": {
      opacity = lerp(0.42, 1, Math.max(S.isolate, S.chart > 0.5 ? 0.4 : 0))
      pulse = 1
      break
    }
    case "sac": {
      opacity = clamp01(S.sac) * 0.42 * (1 - S.shrink * 0.5)
      break
    }
    default:
      break
  }

  // everything that is not the focus recedes; nothing goes flat black
  dimK = lerp(1, 0.34, S.dim * (part.group === "wire" || part.group === "node" ? 0 : 1))

  if (u.uOpacity) u.uOpacity.value = opacity * dimK
  if (u.uEmber) u.uEmber.value = ember * pulse
  if (u.uHighlight) u.uHighlight.value = lerp(u.uHighlight.value, isFocus ? 1 : 0, Math.min(1, dt * 9))
  if (u.uDissolve) u.uDissolve.value = clamp01(S.open * 0.9)
}

const TARGETS = {
  default: { opacity: 1, ember: 0.12 },
  flap: { opacity: 1, ember: 0.1 },
  chamber: { opacity: 0.9, ember: 0.4 },
  vessel: { opacity: 1, ember: 0.16 },
  coronary: { opacity: 0.96, ember: 0.2 },
  valve: { opacity: 0.97, ember: 0.1 },
  wire: { opacity: 0.85, ember: 0 },
  node: { opacity: 0.9, ember: 0 },
  sac: { opacity: 0.4, ember: 0 },
}

/** Does this part want pointer events? (keeps R3F's raycast list tiny) */
export function isInteractive(part) {
  return part.group === "chamber" || part.group === "flap" || part.group === "vessel" || part.group === "coronary" || part.group === "valve" || part.group === "node"
}
