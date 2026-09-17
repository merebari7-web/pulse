import * as THREE from "three"
import { makeSlab, makeWhole, radial, BASE } from "./shape.js"
import { makeBlob, makeTube, makeTubeSet } from "../geometry.js"
import { CHAMBERS, CORONARIES, FAT, SHELL, VESSELS, WIRE, NODES } from "../../data/anatomy.js"
import { makeFan } from "../geometry.js"


/**
 * build.js — turns the tables in src/data/anatomy.js into geometry.
 *
 * Runs once (memoised by React) and returns plain descriptors:
 *   { id, group, geometry, rig, mat, label, layer }
 * <Heart/> decides which mesh and which material each one becomes, so the same
 * part list also drives the hotspot raycasting, the DOM labels and the layer
 * legend without a second source of truth.
 */

/** slab output (typed arrays) or BufferGeometry → one normalised BufferGeometry */
export function prep(src, { center = null } = {}) {
  const g = src.isBufferGeometry ? src.clone() : toGeometry(src)
  if (center) g.translate(-center[0], -center[1], -center[2])
  const n = g.attributes.position.count
  if (!g.attributes.aAlong) {
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) a[i] = g.attributes.uv ? g.attributes.uv.getY(i) : i / n
    g.setAttribute("aAlong", new THREE.BufferAttribute(a, 1))
  }
  if (!g.attributes.aFace) {
    const a = new Float32Array(n).fill(1)
    g.setAttribute("aFace", new THREE.BufferAttribute(a, 1))
  }
  g.computeBoundingSphere()
  return g
}

function toGeometry({ position, normal, uv, face, index }) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(position, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setAttribute("aAlong", new THREE.BufferAttribute(Float32Array.from(uv.filter((_, i) => i % 2 === 1)), 1))
  if (face) g.setAttribute("aFace", new THREE.BufferAttribute(face, 1))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  return g
}

function centroidOf(geo) {
  geo.computeBoundingBox()
  const b = geo.boundingBox
  return new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5)
}

/** stagger per layer: 0 = comes off first (outermost), 1 = last (deepest). */
export const STAGGER = { sac: 0.02, flap: 0.22, coronary: 0.14, vessel: 0.42, chamber: 0.62, valve: 0.74, wire: 0.9 }

/**
 * The six wall flaps + apical cap. Left ventricle 0.30, right 0.12, atria
 * 0.055 — the asymmetry is the lesson, so it is authored, not averaged.
 */
function buildFlaps(parts) {
  const quads = SHELL.quads
  for (const band of SHELL.bands) {
    const isRing = band.id === "apical"
    const loop = isRing ? [{ id: "ap", theta: [0, Math.PI * 2], wall: band.thickness }] : quads
    for (const q of loop) {
      const slab = makeSlab({
        theta: q.theta,
        phi: band.phi,
        thickness: (band.thickness ?? q.wall) * 1.0,
        segTheta: isRing ? 56 : 22,
        segPhi: band.id === "apical" ? 10 : 20,
      })
      const geo = toGeometry(slab)
      const c = centroidOf(geo)
      const dir = c.clone().normalize()
      // curl about the horizontal tangent at the flap's own centroid
      const axis = new THREE.Vector3(dir.z, 0, -dir.x)
      if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0)
      geo.translate(-c.x, -c.y, -c.z)
      parts.push({
        id: `${band.id}-${q.id}`,
        group: "flap",
        band: band.id,
        side: q.id,
        label: q.name || `${band.id} cap`,
        geometry: geo,
        mat: "tissue",
        blood: q.blood || "myo",
        rig: {
          pos: [c.x, c.y, c.z],
          rot: [0, 0, 0],
          scale: 1,
          push: [dir.x * band.lift, dir.y * band.lift * 0.62 + (band.id === "atrial" ? 0.5 : 0), dir.z * band.lift],
          stagger: STAGGER.flap + (band.id === "atrial" ? -0.08 : band.id === "apical" ? 0.1 : 0),
          axis: [axis.x, axis.y, axis.z],
          angle: band.curl,
        },
        hi: { theta: (q.theta[0] + q.theta[1]) / 2, phi: (band.phi[0] + band.phi[1]) / 2 },
      })
    }
  }
}

function buildChambers(parts) {
  for (const c of CHAMBERS) {
    const geo = prep(makeBlob({ size: c.size, taper: c.taper || 0.18, noise: 0.1, crescent: c.crescent ? 0.4 : 0, rows: 30, radial: 38 }))
    parts.push({
      id: c.id,
      group: "chamber",
      label: c.name,
      sub: c.role,
      geometry: geo,
      mat: c.blood === "myo" ? "tissue" : "blood",
      blood: c.blood,
      rig: { pos: c.pos, rot: c.rot || [0, 0, 0], scale: 1, push: c.push, stagger: STAGGER.chamber + (c.layer - 3) * 0.03, axis: null, angle: 0 },
      layer: c.layer,
    })
    if (c.auricle) {
      const a = makeBlob({ size: [c.size[0] * 0.42, c.size[1] * 0.5, c.size[2] * 0.4], taper: 0.4, noise: 0.16, rows: 16, radial: 18 })
      const off = c.pos[0] < 0 ? [-0.42, 0.34, 0.34] : [0.36, 0.3, -0.1]
      parts.push({
        id: `${c.id}-auricle`,
        group: "chamber",
        label: `${c.name} auricle`,
        geometry: prep(a, { center: [0, 0, 0] }),
        mat: "tissue",
        blood: c.blood,
        parentOffset: off,
        rig: { pos: [c.pos[0] + off[0], c.pos[1] + off[1], c.pos[2] + off[2]], rot: [0.3, 0, off[0] > 0 ? -0.4 : 0.4], scale: 1, push: c.push, stagger: STAGGER.chamber, axis: null, angle: 0 },
        hideLabel: true,
      })
    }
  }
}

function tubeGeo(v) {
  const strands = v.strands ? v.strands.map((p) => ({ pts: p, r0: v.r0, r1: v.r1 })) : [{ pts: v.pts, r0: v.r0, r1: v.r1 }]
  return makeTubeSet(strands, { seg: v.strands ? 22 : 54, radial: 16 })
}

function buildVessels(parts) {
  for (const v of VESSELS) {
    parts.push({
      id: v.id,
      group: "vessel",
      label: v.name,
      geometry: prep(tubeGeo(v)),
      mat: "vessel",
      blood: v.blood,
      flow: v.blood === "oxy" ? 1 : -1,
      rig: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, push: v.push, stagger: STAGGER.vessel + (v.layer - 2) * 0.04, axis: null, angle: 0 },
    })
  }
}

function buildCoronaries(parts) {
  for (const c of CORONARIES) {
    const strands = [{ pts: c.pts, r0: c.r, r1: c.r * 0.62 }, ...c.branches.map((b) => ({ pts: b.pts, r0: b.r, r1: b.r * 0.6 }))]
    parts.push({
      id: c.id,
      group: "coronary",
      label: c.name,
      geometry: prep(makeTubeSet(strands, { seg: 34, radial: 10 })),
      mat: "coronary",
      blood: "oxy",
      flow: 1,
      rig: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, push: [0.15, 0.9, 2.5], stagger: STAGGER.coronary, axis: null, angle: 0 },
    })
  }
  for (let i = 0; i < FAT.length; i++) {
    const f = FAT[i]
    parts.push({
      id: `fat-${i}`,
      group: "coronary",
      label: "Epicardial fat",
      hideLabel: true,
      geometry: prep(makeBlob({ size: f.size, noise: 0.24, taper: 0.1, rows: 16, radial: 20 })),
      mat: "fat",
      rig: { pos: f.pos, rot: f.rot, scale: 1, push: [f.pos[0] * 0.5, 1.1, f.pos[2] * 0.9 + 1.4], stagger: STAGGER.coronary - 0.04, axis: null, angle: 0 },
    })
  }
}

function buildWire(parts) {
  const strands = WIRE.map((w) => ({ pts: w.pts, r0: w.r, r1: w.r * 0.72 }))
  for (const w of WIRE) {
    if (!w.fan) continue
    strands.push(...makeFan({ ...w.fan, seed: w.id === "left" ? 3 : 1 }).map((f) => ({ ...f, seg: 14, radial: 6 })))
  }
  parts.push({
    id: "wire",
    group: "wire",
    label: "Conduction system",
    geometry: prep(makeTubeSet(strands, { seg: 26, radial: 8 })),
    mat: "wire",
    rig: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, push: [0.05, -0.35, 2.35], stagger: STAGGER.wire, axis: null, angle: 0 },
  })
  for (const n of Object.values(NODES)) {
    parts.push({
      id: n.id,
      group: "node",
      label: n.name,
      sub: n.sub,
      hotspot: true,
      geometry: prep(new THREE.SphereGeometry(0.085, 18, 14)),
      mat: "node",
      rig: { pos: n.pos, rot: [0, 0, 0], scale: 1, push: [0.05, -0.35, 2.35], stagger: STAGGER.wire, axis: null, angle: 0 },
    })
  }
}

/** The pericardial sac, plus the septum slice that the cut exposes. */
function buildExtras(parts) {
  const whole = makeWhole({ inflate: SHELL.sac.inflate, thickness: SHELL.sac.thickness, segTheta: 74, segPhi: 44 })
  parts.push({
    id: "sac",
    group: "sac",
    label: "Pericardium",
    sub: "fibrous sac",
    geometry: prep(whole),
    mat: "sac",
    rig: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, push: SHELL.sac.lift, stagger: STAGGER.sac, axis: null, angle: 0 },
  })
}

/** Worst containment margin of a part at a given uniform scale about its own centre. */
function worstMargin(verts, count, c, k, stride = 1) {
  let worst = Infinity
  for (let i = 0; i < count; i += stride) {
    const m = marginOf([verts[i * 3] * k + c[0], verts[i * 3 + 1] * k + c[1], verts[i * 3 + 2] * k + c[2]])
    if (m < worst) worst = m
  }
  return worst
}

/**
 * Guarantee, not hand-tuning: nested parts are scaled (and, if that is not
 * enough, eased toward the interior) until they sit inside the wall with a
 * 50 mm-of-model clearance. Runs on ~700 sampled vertices per part, a few
 * milliseconds once, and reports how much it had to change things so the data
 * file can be corrected instead of quietly compensated for.
 */
function autoFit(parts, clearance = 0.05) {
  const report = []
  for (const part of parts) {
    if (part.group !== "chamber" && part.group !== "vessel") continue
    if (part.group === "vessel") continue // vessels are meant to break the surface
    const attr = part.geometry.attributes.position
    const verts = attr.array
    const n = attr.count
    const c = [...part.rig.pos]
    let k = 1
    let shift = 0
    for (let iter = 0; iter < 9; iter++) {
      const m = worstMargin(verts, n, c, k, 3)
      if (m >= clearance) break
      if (k > 0.82) k *= 1 - Math.min(0.2, (clearance - m) * 0.5)
      else {
        shift = Math.min(0.34, shift + 0.05)
        const L = Math.hypot(c[0], c[1], c[2]) || 1
        c[0] = part.rig.pos[0] * (1 - shift)
        c[1] = part.rig.pos[1] * (1 - shift)
        c[2] = part.rig.pos[2] * (1 - shift)
      }
    }
    if (k !== 1 || shift !== 0) {
      part.geometry.scale(k, k, k)
      part.rig.pos = [c[0], c[1], c[2]]
      part.geometry.computeBoundingSphere()
    }
    report.push({ id: part.id, scale: +k.toFixed(3), inward: +shift.toFixed(2), margin: +worstMargin(verts, n, c, 1, 3).toFixed(3) })
  }
  return report
}

/**
 * Put every part's geometry at the origin of its own group, with the group
 * sitting on the part's centroid. One convention for the whole model means the
 * hinge, the push and the DOM label anchor are all "the same point", and no
 * part needs a bespoke transform.
 */
function centerAll(parts) {
  for (const p of parts) {
    p.geometry.computeBoundingBox()
    const c = centroidOf(p.geometry)
    p.geometry.translate(-c.x, -c.y, -c.z)
    p.rig.pos = [c.x + p.rig.pos[0], c.y + p.rig.pos[1], c.z + p.rig.pos[2]]
    p.centroid = [c.x, c.y, c.z]
  }
}

export function buildModel({ fit = true } = {}) {
  const parts = []
  buildFlaps(parts)
  buildChambers(parts)
  buildVessels(parts)
  buildCoronaries(parts)
  buildWire(parts)
  buildExtras(parts)
  centerAll(parts)
  const fitted = fit ? autoFit(parts) : []
  const tris = parts.reduce((s, p) => s + (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3, 0)
  return { parts, tris, fitted, ids: parts.map((p) => p.id) }
}

/**
 * Does any chamber poke through the muscle?
 *
 * The silhouette is star-shaped about the origin once you divide out BASE, so
 * containment is exact rather than an approximation: normalise the point into
 * parametrised space, read the radial multiplier there, compare magnitudes.
 * `margin > 0` means the vertex is inside the outer surface by that much.
 */
export function marginOf(p, inflate = 1) {
  const q = [p[0] / BASE[0], p[1] / BASE[1], p[2] / BASE[2]]
  const u = Math.hypot(q[0], q[1], q[2])
  if (u < 1e-6) return 1e3
  const dir = [q[0] / u, q[1] / u, q[2] / u]
  return radial(dir) * inflate - u
}

export function penetration(parts, chamberIds = CHAMBERS.map((c) => c.id), opts = {}) {
  const out = []
  for (const id of chamberIds) {
    const part = parts.find((p) => p.id === id)
    if (!part) continue
    const pos = part.geometry.attributes.position
    const c = part.rig.pos
    let worst = Infinity
    let at = 0
    const v = [0, 0, 0]
    for (let i = 0; i < pos.count; i += 1) {
      v[0] = pos.getX(i) + c[0]
      v[1] = pos.getY(i) + c[1]
      v[2] = pos.getZ(i) + c[2]
      const m = marginOf(v, opts.inflate)
      if (m < worst) {
        worst = m
        at = i
      }
    }
    out.push({ id, margin: +worst.toFixed(3), vertex: at })
  }
  return out
}
