import { clamp, lerp, smoothstep } from "../../lib/math.js"

/**
 * shape.js — the organ itself, as pure math.
 *
 * No `three` import in this file on purpose: the whole heart is a star-shaped
 * radial surface, so it can be generated, unit-tested and diffed as plain typed
 * arrays. `surfacePoint(theta, phi)` is the only definition of the silhouette;
 * every shell slab, the septum and the pericardium are sampled from it, which is
 * why the cut edges of an exploded wall line up exactly with each other.
 *
 *   dir   = ( sinφ·cosθ, cosφ, sinφ·sinθ )        φ = 0 at the base (atria),
 *   P     = dir · BASE · (1 + bumps(dir))          φ = π at the apex
 */

export const BASE = [1.22, 1.56, 1.12]

/** Positive = atrial/ventricular bulges, negative = the sulci (grooves). */
export const BUMPS = [
  { dir: [0.36, 0.62, -0.42], amp: 0.46, sig: 0.56, name: "left atrium" },
  { dir: [-0.66, 0.52, 0.3], amp: 0.44, sig: 0.54, name: "right atrium" },
  { dir: [0.46, -0.1, 0.6], amp: 0.15, sig: 0.44, name: "RV outflow" },
  { dir: [0.66, -0.04, -0.38], amp: 0.13, sig: 0.48, name: "LV wall" },
  { dir: [-0.66, -0.3, 0.42], amp: 0.1, sig: 0.42, name: "RV free wall" },
  { dir: [0.32, -0.88, 0.16], amp: 0.58, sig: 0.2, name: "apex" },
  { dir: [-0.1, -0.7, 0.5], amp: 0.1, sig: 0.34, name: "crux" },
]

/** The grooves a dissection actually shows. Negative amps, tight sigmas. */
export const GROOVES = [
  { dir: [-0.26, -0.6, 0.72], amp: -0.17, sig: 0.1, name: "anterior interventricular sulcus" },
  { dir: [0.1, 0.56, 0.78], amp: -0.1, sig: 0.15, name: "coronary sulcus (anterior)" },
  { dir: [-0.2, 0.62, -0.72], amp: -0.085, sig: 0.16, name: "coronary sulcus (posterior)" },
  { dir: [0.86, -0.4, -0.28], amp: -0.07, sig: 0.13, name: "posterior interventricular sulcus" },
]

/** Angular distance proxy: cheap, monotonic, no acos. */
function angdist(dir, axis) {
  const d = dir[0] * axis[0] + dir[1] * axis[1] + dir[2] * axis[2]
  return 1 - clamp(d, -1, 1)
}

/** Radial multiplier of the silhouette at a unit direction (not normalised). */
export function radial(dir) {
  let r = 1
  for (const b of BUMPS) r += b.amp * Math.exp(-angdist(dir, b.dir) / b.sig)
  for (const g of GROOVES) r += g.amp * Math.exp(-angdist(dir, g.dir) / g.sig)
  return r
}

/**
 * Point on the surface. `inflate` scales the whole thing (pericardium),
 * `hollow` pulls inward along the radial direction (inner wall of a slab).
 */
export function surfacePoint(theta, phi, { inflate = 1, hollow = 0 } = {}) {
  const sp = Math.sin(phi)
  const cp = Math.cos(phi)
  const dir = [sp * Math.cos(theta), cp, sp * Math.sin(theta)]
  const r = radial(dir)
  return [
    dir[0] * BASE[0] * r * inflate - dir[0] * hollow,
    dir[1] * BASE[1] * r * inflate - dir[1] * hollow,
    dir[2] * BASE[2] * r * inflate - dir[2] * hollow,
  ]
}

/** Finite-difference normal (robust where the analytic one gets messy). */
function normalAt(theta, phi, opts, eps = 1e-3) {
  const p = surfacePoint(theta, phi, opts)
  const pt = surfacePoint(theta + eps, phi, opts)
  const pp = surfacePoint(theta, phi + eps, opts)
  const a = [pt[0] - p[0], pt[1] - p[1], pt[2] - p[2]]
  const b = [pp[0] - p[0], pp[1] - p[1], pp[2] - p[2]]
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const len = Math.hypot(n[0], n[1], n[2]) || 1
  const s = n[0] * p[0] + n[1] * p[1] + n[2] * p[2] < 0 ? -1 : 1
  return [n[0] / len * s, n[1] / len * s, n[2] / len * s]
}

/**
 * A watertight slab of wall: outer surface, inner surface, four rim strips.
 * `theta`/`phi` are [from, to] parameter boxes. This is the whole trick behind
 * the exploded view — the pieces are literally slices of one continuous
 * surface, so they reassemble with no seam.
 */
export function makeSlab({
  theta = [0, Math.PI],
  phi = [0.2, 1.9],
  thickness = 0.1,
  inflate = 1,
  segTheta = 24,
  segPhi = 16,
  doubleSided = false,
} = {}) {
  const [t0, t1] = theta
  const [p0, p1] = phi
  const cols = segTheta + 1
  const rows = segPhi + 1
  const per = cols * rows
  const faceCount = doubleSided ? 1 : 2
  // rim loop = one vertex pair per boundary step of the parameter box
  const rimN = doubleSided ? 0 : (segTheta + segPhi) * 2
  const vCount = per * faceCount + rimN * 2
  const position = new Float32Array(vCount * 3)
  const normal = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  // Which side of the wall a vertex belongs to. The cut-away only reads as a
  // *cut* if the exposed edge is a different material to the outer surface, so
  // the shader gets 1 = epicardial face, 0 = endocardial face, 0.5 = cut rim.
  const face = new Float32Array(vCount)
  const index = []

  const put = (i, p, n, u, v, f = 1) => {
    position[i * 3] = p[0]
    position[i * 3 + 1] = p[1]
    position[i * 3 + 2] = p[2]
    normal[i * 3] = n[0]
    normal[i * 3 + 1] = n[1]
    normal[i * 3 + 2] = n[2]
    uv[i * 2] = u
    uv[i * 2 + 1] = v
    face[i] = f
  }

  // outer + inner shells
  for (let face = 0; face < faceCount; face++) {
    const outer = face === 0
    for (let j = 0; j < rows; j++) {
      const fv = j / segPhi
      const phi_ = lerp(p0, p1, outer ? fv : 1 - fv)
      for (let i = 0; i < cols; i++) {
        const fu = i / segTheta
        const theta_ = lerp(t0, t1, outer ? fu : 1 - fu)
        const opts = outer ? { inflate } : { inflate, hollow: thickness }
        const p = surfacePoint(theta_, phi_, opts)
        const n = normalAt(theta_, phi_, opts)
        put(face * per + j * cols + i, p, doubleSided ? n : outer ? n : [-n[0], -n[1], -n[2]], fu, fv, outer || doubleSided ? 1 : 0)
      }
    }
    for (let j = 0; j < segPhi; j++) {
      for (let i = 0; i < segTheta; i++) {
        const a = face * per + j * cols + i
        const b = a + 1
        const c = a + cols
        const d = c + 1
        if (outer) index.push(a, c, b, b, c, d)
        else index.push(a, b, c, b, d, c)
      }
    }
  }

  if (!doubleSided) {
    // rim: walk the boundary of the parameter box twice, connect with quads.
    const rim = []
    const push = (fu, fv) => rim.push([fu, fv])
    for (let i = 0; i < segTheta; i++) push(i / segTheta, 0)
    for (let i = 0; i < segPhi; i++) push(1, i / segPhi)
    for (let i = 0; i < segTheta; i++) push(1 - i / segTheta, 1)
    for (let i = 0; i < segPhi; i++) push(0, 1 - i / segPhi)
    const base = per * 2
    const n = rim.length
    for (let k = 0; k < n; k++) {
      const [fu, fv] = rim[k]
      const theta_ = lerp(t0, t1, fu)
      const phi_ = lerp(p0, p1, fv)
      const po = surfacePoint(theta_, phi_, { inflate })
      const pi = surfacePoint(theta_, phi_, { inflate, hollow: thickness })
      const no = normalAt(theta_, phi_, { inflate })
      put(base + k * 2, po, no, fu, fv, 0.5)
      put(base + k * 2 + 1, pi, [-no[0], -no[1], -no[2]], fu, fv, 0.5)
    }
    for (let k = 0; k < n; k++) {
      const a = base + k * 2
      const b = a + 1
      const c = base + ((k + 1) % n) * 2
      const d = c + 1
      index.push(a, b, c, b, d, c)
    }
  }

  let max = 0
  for (let i = 0; i < position.length; i += 3) max = Math.max(max, Math.hypot(position[i], position[i + 1], position[i + 2]))
  return { position, normal, uv, face, index: Uint32Array.from(index), vertexCount: vCount, radius: max }
}

/** Convenience: the full closed surface (no cut) — pericardium, ghost shells. */
export function makeWhole(opts = {}) {
  return makeSlab({ theta: [0, Math.PI * 2], phi: [1e-3, Math.PI - 1e-3], doubleSided: true, ...opts })
}

/** Quick silhouette sanity metrics, used by the test and by dev HUD. */
export function measure() {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const steps = 240
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps / 2; j++) {
      const p = surfacePoint((i / steps) * Math.PI * 2, (j / (steps / 2)) * Math.PI)
      minX = Math.min(minX, p[0])
      maxX = Math.max(maxX, p[0])
      minY = Math.min(minY, p[1])
      maxY = Math.max(maxY, p[1])
      minZ = Math.min(minZ, p[2])
      maxZ = Math.max(maxZ, p[2])
    }
  }
  return {
    width: +(maxX - minX).toFixed(3),
    height: +(maxY - minY).toFixed(3),
    depth: +(maxZ - minZ).toFixed(3),
    yRange: [+minY.toFixed(3), +maxY.toFixed(3)],
    apexBias: +((maxX - minX) / 2 + minX).toFixed(3),
  }
}

/** Where a direction lands on the surface — used to seat hotspots and labels. */
export function surfaceAt(theta, phi, inflate = 1) {
  return surfacePoint(theta, phi, { inflate })
}

/** φ for a given y on the long axis (rough, monotone enough for seating props). */
export function phiForY(y) {
  return smoothstep(-1.9, 1.4, y) * Math.PI * 0.92 + 0.04
}
