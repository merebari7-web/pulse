import * as THREE from "three"
import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { MODEL } from "../../config.js"
import { deriveParts } from "../model.js"
import { applyRig } from "../explode.js"
import { A } from "../anim.js"
import { makeTissue, makeValveMaterial } from "../materials.js"
import { registerAnchor } from "../registry.js"
import { smoothstep } from "../../lib/math.js"

/**
 * ImportedHeart — the other half of the "hybrid" brief.
 *
 * If `MODEL.url` points at a .glb, this replaces <Heart/> and does three things
 * automatically: fits the model to the camera path's scale, overrides its
 * materials with the scene's tissue shader (so the cutaway lighting, the beat and
 * the layer dimming all still apply), and derives an explode rig for every node
 * whose name matches `MODEL.map`. A scanned heart from a public repository gets
 * the same choreography as the procedural one without any authoring.
 */
export function ImportedHeart({ onReady }) {
  const url = MODEL.url
  const gltf = useLoader(GLTFLoader, url, extend)
  const root = gltf.scene
  const built = useMemo(() => deriveParts(root, { fitScale: MODEL.fit?.scale ?? 3.4, lift: MODEL.fit?.lift ?? 1.6 }), [root])
  const nodes = useRef(new Map())
  const override = useMemo(() => (MODEL.replaceMaterials === false ? null : makeTissue({ opacity: 1, stripes: 0.42, transmit: 0.5 })), [])
  const valveMat = useMemo(() => (MODEL.replaceMaterials === false ? null : makeValveMaterial()), [])
  const wrap = useRef()

  function extend(loader) {
    if (MODEL.dracoPath) {
      const draco = new DRACOLoader()
      draco.setDecoderPath(MODEL.dracoPath)
      loader.setDRACOLoader(draco)
    }
    loader.setCrossOrigin("anonymous")
  }

  useLayoutEffect(() => {
    if (!root) return
    root.scale.setScalar(built.scale)
    root.position.fromArray(MODEL.fit?.pos || [0, 0, 0])
    if (override) {
      root.traverse((o) => {
        if (!o.isMesh) return
        const isValve = /valve|cusp|leaflet/i.test(o.name || "")
        o.material = isValve ? valveMat : override
        o.castShadow = false
        o.receiveShadow = false
        if (!isValve) ensureFlowAxis(o.geometry)
      })
    }
    for (const p of built.parts) {
      p.builtBase = { pos: p.object.position.clone(), quat: p.object.quaternion.clone() }
      registerAnchor(p.id, p.object)
    }
    onReady?.({ parts: built.parts.length, tris: countTris(root) })
  }, [root, built, override, valveMat, onReady])

  useEffect(
    () => () => {
      override?.dispose()
      valveMat?.dispose()
    },
    [override, valveMat],
  )

  useFrame(() => {
    const open = A.open
    for (const p of built.parts) {
      if (!p.builtBase) continue
      p.object.position.copy(p.builtBase.pos)
      p.object.quaternion.copy(p.builtBase.quat)
      applyRig(p.object, p.rig, open)
    }
    if (override?.uniforms) {
      override.uniforms.uDim.value = A.dim
      override.uniforms.uIsolate.value = A.isolate * 0.6
      override.uniforms.uOpacity.value = 1 - smoothstep(0, 1, A.isolate) * 0.8
    }
  })

  return (
    <group ref={wrap} name="imported-heart" rotation={MODEL.fit?.rot || [0, 0, 0]}>
      <primitive object={root} />
    </group>
  )
}

/**
 * The tissue shader rides its flow pulse and its wall-thickness term on a
 * per-vertex `aAlong` (0 at the base, 1 at the apex of each part). A scanned mesh
 * will not have one, and an unbound attribute would read as a flat 0 — every
 * surface looking like a cut rim. So derive it: the coordinate along whichever
 * axis the part is longest along. Cheap, and it means the effect survives the
 * swap from procedural geometry to somebody else's model.
 */
export function ensureFlowAxis(geometry) {
  if (!geometry?.attributes?.position || geometry.attributes.aAlong) return
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox
  if (!bb) return
  const size = bb.getSize(new THREE.Vector3())
  const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z"
  const from = bb.min[axis]
  const span = Math.max(1e-4, bb.max[axis] - from)
  const pos = geometry.attributes.position
  const along = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) along[i] = (pos.getComponent(i, axis === "x" ? 0 : axis === "y" ? 1 : 2) - from) / span
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1))
}

function countTris(root) {
  let n = 0
  root.traverse((o) => {
    const g = o.geometry
    if (g?.index) n += g.index.count / 3
    else if (g?.attributes?.position) n += g.attributes.position.count / 3
  })
  return Math.round(n)
}
