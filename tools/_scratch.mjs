import * as THREE from 'three'
import { makeShellHalf, makeBlob, makeTube, makeTubeSet, mergeGeometries, profileAt, isFiniteGeometry, ecgAt, makeRibbon, makeDust, makeFan, valveLayout } from '../src/three/geometry.js'
import { SHELL_PROFILE, SHELL_DEFORM, CHAMBERS, VESSELS, VALVES, WIRE, CORONARIES, ECG, FAT } from '../src/data/anatomy.js'

let fails = 0
const ok = (c, m) => { if (!c) { console.log('FAIL', m); fails++ } else console.log('ok  ', m) }

const shell = makeShellHalf({ profile: SHELL_PROFILE, deform: SHELL_DEFORM, side: 1, rows: 52, radial: 46 })
ok(isFiniteGeometry(shell), 'shell finite')
shell.computeBoundingBox()
const bb = shell.boundingBox
console.log('   shell bbox', bb.min.toArray().map(n=>+n.toFixed(2)), bb.max.toArray().map(n=>+n.toFixed(2)))
ok(shell.attributes.aAlong.count === shell.attributes.position.count, 'shell aAlong length')
ok(shell.index.count > 1000, 'shell indexed ' + shell.index.count)

// profile monotonic radius growth in the ventricle
const p1 = profileAt(SHELL_PROFILE, -2.4), p2 = profileAt(SHELL_PROFILE, 0.3), p3 = profileAt(SHELL_PROFILE, 2.35)
console.log('   profile @apex', p1.map(n=>+n.toFixed(3)), '@waist', p2.map(n=>+n.toFixed(3)), '@base', p3.map(n=>+n.toFixed(3)))
ok(p1[0] < p2[0], 'radius grows from apex')

for (const c of CHAMBERS) {
  const g = makeBlob({ size: c.size, taper: c.taper || 0.2, noise: 0.12, crescent: c.crescent ? 0.42 : 0 })
  ok(isFiniteGeometry(g), 'blob ' + c.id)
  g.computeBoundingBox(); const b = g.boundingBox
  const ext = [b.max.x-b.min.x, b.max.y-b.min.y, b.max.z-b.min.z].map(n=>+n.toFixed(2))
  console.log('   blob', c.id, 'extents', ext)
  ok(ext.every(n => n > 0.2 && n < 5), 'blob ' + c.id + ' sane extents')
}

let vcount = 0
for (const v of VESSELS) {
  const strands = v.strands ? v.strands.map(p=>({pts:p, r0:v.r0, r1:v.r1})) : [v]
  const g = makeTubeSet(strands, { seg: 40, radial: 14 })
  ok(isFiniteGeometry(g), 'vessel ' + v.id)
  vcount += g.index.count
  // outward normal check: take one vertex, compare normal to (pos - nearest curve point)
  const basePts = v.pts || v.strands[0]
  const curve = new THREE.CatmullRomCurve3(basePts.map(p=>new THREE.Vector3(...p)), false, 'catmullrom', .5)
  const P = curve.getPoint(0.5), N = new THREE.Vector3()
  let best = 1e9, bv = null, bn = new THREE.Vector3()
  const pos = g.attributes.position, nor = g.attributes.normal
  for (let i=0;i<pos.count;i++){
    const v3 = new THREE.Vector3().fromBufferAttribute(pos,i)
    const d = v3.distanceTo(P)
    if (d<best && d>0.01){ best=d; bv=v3; bn.fromBufferAttribute(nor,i) }
  }
  const dir = bv.clone().sub(P).normalize()
  ok(dir.dot(bn) > 0.2, 'vessel ' + v.id + ' normals outward (' + dir.dot(bn).toFixed(2) + ')')
}
console.log('   vessel tris', vcount)

for (const c of CORONARIES) {
  const g = makeTubeSet([{pts:c.pts, r0:c.r, r1:c.r*0.72}, ...c.branches.map(b=>({pts:b.pts,r0:b.r,r1:b.r*0.7}))], { seg: 26, radial: 8 })
  ok(isFiniteGeometry(g), 'coronary ' + c.id)
}
const fans = makeFan({ from: [0.44,-1.6,0.4], count: 9, spread: 0.68, dir: [0.5,-0.45,0.45] })
ok(fans.length===9 && isFiniteGeometry(makeTubeSet(fans)), 'purkinje fan')
const wire = makeTubeSet(WIRE.map(w=>({pts:w.pts, r0:w.r, r1:w.r*0.7, seg:26, radial:8})))
ok(isFiniteGeometry(wire), 'conduction wire')
for (const v of VALVES) { const l = valveLayout({cusps:v.cusps, r:v.r, type:v.type}); ok(l.length===v.cusps && l.every(o=>o.pos.every(Number.isFinite)), 'valve layout '+v.id) }
const ribbon = makeRibbon({ len: 9, amp: 0.9, seg: 300, waves: ECG.waves })
ok(isFiniteGeometry(ribbon), 'ecg ribbon finite')
const peak = Math.max(...Array.from({length:301},(_,i)=>ecgAt(i/300, ECG.waves)))
const trough = Math.min(...Array.from({length:301},(_,i)=>ecgAt(i/300, ECG.waves)))
console.log('   ecg peak', peak.toFixed(3), 'trough', trough.toFixed(3))
ok(peak > 0.8 && peak < 1.15 && trough > -0.5, 'ecg amplitudes sane')
const dust = makeDust({count:2000})
ok(dust.attributes.position.count===2000, 'dust count')
console.log(fails ? `\n${fails} FAILURES` : '\nALL GEOMETRY CHECKS PASSED')
process.exit(fails?1:0)
