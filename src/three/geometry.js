import * as THREE from "three"
import { clamp01, fade, lerp, smoothstep } from "../lib/math.js"

/**
 * geometry.js — procedural builders. No files downloaded, no UV unwrap, no
 * normals baked by an export preset: every surface is generated from the data
 * in src/data/anatomy.js, so the model is exactly as accurate as its tables and
 * can be re-derived in a unit test (see tools/test-logic.mjs).
 *
 * Conventions
 *  • Y up, base of the heart at +Y, apex at -Y. +X is the patient's left.
 *  • Everything returns BufferGeometry with position / normal / uv and, where a
 *    shader needs it, `aAlong` (0..1 along a swept tube) so flow can be animated
 *    without a second geometry.
 *  • Winding is not load-bearing: all scene materials are DoubleSide and flip
 *    their normal by gl_FrontFacing.
 */

/** Tapered, slightly lumpy ellipsoid — chamber cavities, fat, auricles. */
export function makeBlob({ size = [1, 1, 1], taper = 0, lean = 0, noise = 0, rows = 28, radial = 34, crescent = 0 }) {
  const cols = radial + 1
  const rowN = rows + 1
  const pos = new Float32Array(rowN * cols * 3)
  const uv = new Float32Array(rowN * cols * 2)
  const along = new Float32Array(rowN * cols)
  const idx = []
  for (let j = 0; j < rowN; j++) {
    const v = j / rows
    const phi = v * Math.PI
    const sy = Math.cos(phi) // +1 at top
    const t = clamp01((1 - sy) * 0.5) // 0 top → 1 bottom
    const shrink = lerp(1, 1 - taper, t * t)
    for (let i = 0; i < cols; i++) {
      const u = i / radial
      const th = u * Math.PI * 2
      let rr = 0.5 * shrink * (1 + noise * Math.sin(phi * 3.1 + th * 2.0) * 0.5)
      if (crescent) {
        // carve the septal side so the RV wraps the LV, like a crescent moon
        const facing = Math.max(0, Math.cos(th))
        rr *= 1 - crescent * facing * t
      }
      const n = j * cols + i
      pos[n * 3] = Math.cos(th) * rr * size[0] + lean * t * t
      // `size` is the full extent of the ellipsoid (radius 0.5 base ×2 × size/2)
      pos[n * 3 + 1] = sy * 0.5 * size[1]
      pos[n * 3 + 2] = Math.sin(th) * rr * size[2]
      uv[n * 2] = u
      uv[n * 2 + 1] = v
      along[n] = t
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * cols + i
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("aAlong", new THREE.BufferAttribute(along, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * Variable-radius tube swept along a spline. (THREE.TubeGeometry cannot taper,
 * and every vessel in the heart tapers, so this is ~40 lines better spent.)
 */
export function makeTube({ pts, r0 = 0.2, r1 = 0.15, seg = 48, radial = 16, oval = 1, wobble = 0, seed = 0 }, curve) {
  const path =
    curve ||
    new THREE.CatmullRomCurve3(
      (pts || []).map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      "catmullrom",
      0.5,
    )
  const frames = path.computeFrenetFrames(Math.max(2, seg | 0), false)
  const cols = radial + 1
  const rowN = seg + 1
  const pos = new Float32Array(rowN * cols * 3)
  const nor = new Float32Array(rowN * cols * 3)
  const uv = new Float32Array(rowN * cols * 2)
  const along = new Float32Array(rowN * cols)
  const idx = []
  const P = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()

  for (let i = 0; i < rowN; i++) {
    const u = i / seg
    path.getPoint(u, P)
    N.copy(frames.normals[Math.min(i, frames.normals.length - 1)])
    B.copy(frames.binormals[Math.min(i, frames.binormals.length - 1)])
    const r = lerp(r0, r1, u) * (1 + (wobble ? Math.sin(u * 9 + seed) * wobble : 0))
    for (let j = 0; j < cols; j++) {
      const v = (j / radial) * Math.PI * 2
      const cx = Math.cos(v)
      const cy = Math.sin(v) * oval
      const nx = N.x * cx + B.x * cy * oval
      const ny = N.y * cx + B.y * cy * oval
      const nz = N.z * cx + B.z * cy * oval
      const len = Math.hypot(nx, ny, nz) || 1
      const n = i * cols + j
      pos[n * 3] = P.x + (nx / len) * r
      pos[n * 3 + 1] = P.y + (ny / len) * r
      pos[n * 3 + 2] = P.z + (nz / len) * r
      nor[n * 3] = nx / len
      nor[n * 3 + 1] = ny / len
      nor[n * 3 + 2] = nz / len
      uv[n * 2] = j / radial
      uv[n * 2 + 1] = u
      along[n] = u
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * cols + j
      const b = (i + 1) * cols + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("aAlong", new THREE.BufferAttribute(along, 1))
  g.setIndex(idx)
  return g
}

/** Several tubes merged into one geometry (branches, chordae, Purkinje fans). */
export function makeTubeSet(strands, opts = {}) {
  const geos = strands.map((s, i) => makeTube({ ...opts, ...s, seed: i * 3.3 }))
  return mergeGeometries(geos)
}

/**
 * Minimal geometry merger — avoids a dependency on three's BufferGeometryUtils
 * for exactly the case we need (indexed, position + normal + uv + aAlong).
 */
export function mergeGeometries(geos) {
  const keys = ["position", "normal", "uv", "aAlong"]
  const attrs = {}
  let vCount = 0
  let iCount = 0
  for (const g of geos) {
    vCount += g.attributes.position.count
    iCount += g.index ? g.index.count : g.attributes.position.count
  }
  for (const k of keys) {
    const itemSize = k === "position" || k === "normal" ? 3 : k === "uv" ? 2 : 1
    attrs[k] = { array: new Float32Array(vCount * itemSize), itemSize, n: 0 }
  }
  const index = new Uint32Array(iCount)
  let vOff = 0
  let iOff = 0
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals()
    for (const k of keys) {
      const src = g.attributes[k]
      const dst = attrs[k]
      if (src) {
        dst.array.set(src.array, dst.n * dst.itemSize)
        dst.n += src.count
      } else {
        // synthesise the missing attribute so lengths stay in step
        dst.n += g.attributes.position.count
      }
    }
    const gi = g.index
    if (gi) {
      for (let i = 0; i < gi.count; i++) index[iOff + i] = gi.getX(i) + vOff
      iOff += gi.count
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) index[iOff + i] = i + vOff
      iOff += g.attributes.position.count
    }
    vOff += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry()
  for (const k of keys) out.setAttribute(k, new THREE.BufferAttribute(attrs[k].array, attrs[k].itemSize))
  out.setIndex(new THREE.BufferAttribute(index, 1))
  out.computeBoundingSphere()
  return out
}

/**
 * Per-part cusp layout for a valve. Returned as transforms so the component can
 * animate them (AV valves snap shut on the S1 thump, semilunar on S2).
 */
export function valveLayout({ cusps = 3, r = 0.3, type = "semilunar" }) {
  const out = []
  for (let i = 0; i < cusps; i++) {
    const a = (i / cusps) * Math.PI * 2 + (type === "av" ? Math.PI / 2 : 0)
    const spread = type === "av" ? 0.34 : 0.5
    out.push({
      key: i,
      pos: [Math.cos(a) * r * spread, 0, Math.sin(a) * r * spread],
      rot: [Math.cos(a) * (type === "av" ? 0.5 : 0.82), -a, Math.sin(a) * (type === "av" ? -0.5 : -0.82)],
      scale: [r * (type === "av" ? 1.15 : 1.0), r * (type === "av" ? 1.7 : 0.72), r * (type === "av" ? 0.7 : 1.0)],
      open: type === "av" ? -0.95 : 0.62,
      closed: type === "av" ? 0.12 : -0.1,
    })
  }
  return out
}

/* ------------------------------------------------------------- data-viz gen */

/** Normalised ECG amplitude at phase u (0..1 of one cycle). */
export function ecgAt(u, waves) {
  let y = 0
  const p = u - Math.floor(u)
  for (const w of waves) {
    const d = (p - w.at) / w.width
    y += w.amp * Math.exp(-0.5 * d * d)
  }
  return y
}

/**
 * A flat ribbon following the ECG curve — the "3D chart" of the data chapter.
 * Grows along its length via aAlong in the shader, so scroll drives the draw.
 */
export function makeRibbon({ len = 9, amp = 0.9, seg = 340, thick = 0.055, waves, tilt = 0 }) {
  const cols = 2
  const rowN = seg + 1
  const pos = new Float32Array(rowN * cols * 3)
  const uv = new Float32Array(rowN * cols * 2)
  const along = new Float32Array(rowN * cols)
  const idx = []
  for (let i = 0; i < rowN; i++) {
    const u = i / seg
    const x = -len / 2 + u * len
    const y = ecgAt(u, waves) * amp
    const z = u * u * tilt
    const a = y - (ecgAt(u + 1 / seg, waves) - ecgAt(u - 1 / seg, waves)) * amp * 6
    for (let c = 0; c < cols; c++) {
      const n = i * cols + c
      pos[n * 3] = x
      pos[n * 3 + 1] = y + (c === 0 ? thick : -thick) * Math.cos(a)
      pos[n * 3 + 2] = z + (c === 0 ? thick : -thick)
      uv[n * 2] = u
      uv[n * 2 + 1] = c
      along[n] = u
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * cols
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("aAlong", new THREE.BufferAttribute(along, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Ambient particle field, distributed in a hollow sphere with per-point seeds. */
export function makeDust({ count = 4000, inner = 3.2, outer = 15, band = 0.55 } = {}) {
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // uniform direction, radius biased to the shell so the model stays clear
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = inner + Math.pow(Math.random(), 0.65) * (outer - inner)
    pos[i * 3] = Math.cos(th) * s * r
    pos[i * 3 + 1] = u * r * band + (Math.random() - 0.5) * 2
    pos[i * 3 + 2] = Math.sin(th) * s * r
    seed[i * 3] = Math.random()
    seed[i * 3 + 1] = Math.random()
    seed[i * 3 + 2] = Math.random()
    size[i] = 0.35 + Math.random() * Math.random() * 2.4
    phase[i] = Math.random()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3))
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1))
  g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outer + 2)
  return g
}

/** Spark particles that ride the conduction curves; `aAlong` picks the curve slot. */
export function makeTrail({ count = 900, curves = [] } = {}) {
  const pos = new Float32Array(count * 3)
  const meta = new Float32Array(count * 4) // curveIndex, offset, speed, size
  for (let i = 0; i < count; i++) {
    const c = i % Math.max(1, curves.length)
    pos[i * 3] = 0
    pos[i * 3 + 1] = 0
    pos[i * 3 + 2] = 0
    meta[i * 4] = c
    meta[i * 4 + 1] = Math.random()
    meta[i * 4 + 2] = 0.55 + Math.random() * 0.9
    meta[i * 4 + 3] = 0.5 + Math.random() * 1.6
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("aMeta", new THREE.BufferAttribute(meta, 4))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8)
  return g
}

/** Guard used by the builders' unit test. */
export function isFiniteGeometry(g) {
  const p = g?.attributes?.position?.array
  if (!p || !p.length) return false
  for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) return false
  return true
}

/** Deterministic pseudo-random fan of Purkinje strands from a branch tip. */
export function makeFan({ from, count = 8, spread = 0.6, dir = [0, -1, 0], seed = 1 }) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + seed
    const r = 0.35 + ((i * 37) % 11) / 18
    const pts = [
      [from[0], from[1], from[2]],
      [from[0] + dir[0] * r * 0.6 + Math.cos(a) * spread * 0.5, from[1] + dir[1] * r * 0.7, from[2] + dir[2] * r * 0.6 + Math.sin(a) * spread * 0.5],
      [from[0] + dir[0] * r * 1.5 + Math.cos(a + 0.7) * spread, from[1] + dir[1] * r * 1.7, from[2] + dir[2] * r * 1.5 + Math.sin(a + 0.7) * spread],
    ]
    out.push({ pts, r0: 0.028, r1: 0.012, seg: 12, radial: 6 })
  }
  return out
}
