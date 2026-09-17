import { buildModel, marginOf } from '../src/three/heart/build.js'
const m = buildModel()
const CH = (await import('../src/data/anatomy.js')).CHAMBERS
for (const c of CH) {
  const part = m.parts.find(p=>p.id===c.id)
  const pos = part.geometry.attributes.position
  const v=[0,0,0]
  const margins = () => { let w=Infinity; for(let i=0;i<pos.count;i++){ v[0]=pos.getX(i)*k + c.pos[0]; v[1]=pos.getY(i)*k + c.pos[1]; v[2]=pos.getZ(i)*k + c.pos[2]; w=Math.min(w, marginOf(v)) } return w }
  let k=1
  for (let it=0; it<40; it++){ k = (margins()>0.06) ? k+ (it<1?0.02:-0.02) : k-0.02; if (it>3 && Math.abs(k-1)<1e-9) break; k=Math.min(1.6,Math.max(0.4,k)) }
  // simple search: largest k with margin>=0.06
  let lo=0.3, hi=1.6
  for (let it=0; it<26; it++){ const mid=(lo+hi)/2; k=mid; if (margins()>=0.06) lo=mid; else hi=mid }
  // and best center shift toward origin
  let best={d:0,s:1,m:-9}
  for (let d=0; d<=0.5; d+=0.02){
    k=lo
    let w=Infinity
    const L=Math.hypot(...c.pos)||1
    const sh=[c.pos[0]-c.pos[0]/L*d, c.pos[1]-c.pos[1]/L*d, c.pos[2]-c.pos[2]/L*d]
    for(let i=0;i<pos.count;i++){ v[0]=pos.getX(i)*k + sh[0]; v[1]=pos.getY(i)*k + sh[1]; v[2]=pos.getZ(i)*k + sh[2]; w=Math.min(w, marginOf(v)) }
    if (w>best.m) best={d:+d.toFixed(2),s:+k.toFixed(3),m:+w.toFixed(3),sh:sh.map(x=>+x.toFixed(2))}
  }
  console.log(c.id.padEnd(8), 'size', JSON.stringify(c.size), 'maxScale', lo.toFixed(3), '| shift', JSON.stringify(best))
}
