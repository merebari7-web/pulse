import { Component, lazy, Suspense, useCallback, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { AdaptiveDpr, PerformanceMonitor, Preload } from "@react-three/drei"
import * as THREE from "three"

import { Driver } from "./Driver.jsx"
import { Rig } from "./Rig.jsx"
import { Lights } from "./Lights.jsx"
import { Heart } from "./Heart.jsx"
import { Ground } from "./Ground.jsx"
import { Particles, Trail } from "./Particles.jsx"
import { Hotspots } from "./Hotspot.jsx"
import { DataViz } from "./DataViz.jsx"
import { Effects } from "./Effects.jsx"
import { LabelDriver } from "./labels.js"
import { MODEL, PALETTE, TUNE, DPR } from "../config.js"
import { motion, quality } from "../lib/motion.js"
import { patch, state } from "../lib/store.js"
/* Only fetched when MODEL.url is set: the GLTF + Draco loaders are ~150 kB of
   code the procedural build has no use for, so they stay out of the entry chunk. */
const ImportedHeart = MODEL.url ? lazy(() => import("./parts/ImportedHeart.jsx")) : null

/**
 * Scene3D — the sticky canvas layer.
 *
 * It is `position: fixed`, pointer-events only where the model is, and it never
 * scrolls itself: the HTML overlay scrolls over it and the ScrollTrigger in
 * useJourney turns that scroll into the one number every subsystem reads.
 *
 * Degradation ladder, in order:
 *   no WebGL            → the canvas is not mounted, <Fallback/> renders
 *   context lost        → the canvas is unmounted, same fallback, retry button
 *   sustained < 45 fps  → PerformanceMonitor flips us to the low tier
 *                         (fewer particles, no AO, DPR 1) without a reload
 *   reduced motion      → the composer stays, nothing self-animates
 */

class SceneBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    patch({ failed: true, importError: String(err?.message || err) })
  }
  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

export function Scene3D({ boot }) {
  const [lowTier, setLowTier] = useState(quality.tier === "low")
  /* Boot protocol: 'context' when the canvas exists, 'geometry' when the model
     is built and its anchors registered, 'frame' on the next paint after that —
     so the loader covers exactly the time something could go wrong, and a GLB
     (Suspense) holds 'geometry' until it has actually arrived. */
  const onReady = useCallback(
    (info) => {
      boot?.mark("geometry")
      if (info) patch({ tris: info.tris, parts: info.parts })
      requestAnimationFrame(() => boot?.mark("frame"))
    },
    [boot],
  )

  const created = useCallback(({ gl }) => {
    gl.setClearColor(new THREE.Color(PALETTE.bg), 1)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.05
    gl.outputColorSpace = THREE.SRGBColorSpace
    const el = gl.domElement
    const lost = (e) => {
      e.preventDefault()
      patch({ failed: true, lost: true })
    }
    const ok = () => patch({ failed: false, lost: false })
    el.addEventListener("webglcontextlost", lost, false)
    el.addEventListener("webglcontextrestored", ok, false)
    boot?.mark("context")
    return () => {
      el.removeEventListener("webglcontextlost", lost)
      el.removeEventListener("webglcontextrestored", ok)
    }
  }, [boot])

  const HeartPart = MODEL.url ? ImportedHeart : Heart
  if (MODEL.url && !ImportedHeart) return null

  return (
    <div className="fixed inset-0 z-0" id="scene" aria-hidden="true">
      <Canvas
        dpr={lowTier ? [1, 1] : DPR}
        shadows={false}
        flat={false}
        frameloop="always"
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        camera={{ fov: 26, near: 0.3, far: 90, position: [1.6, 3.4, 17.5] }}
        onCreated={created}
        className="h-full w-full"
      >
        <color attach="background" args={[PALETTE.bg]} />
        <fog attach="fog" args={[PALETTE.bg, TUNE.fog.near + 4, TUNE.fog.far + 6]} />
        <SceneBoundary>
          <Suspense fallback={null}>
            <Driver />
            <Rig />
            <Lights />
            <HeartPart onReady={onReady} />
            <Ground />
            <Particles count={lowTier ? Math.round(quality.particles * 0.3) : quality.particles} />
            <Trail count={lowTier ? 0 : quality.trails} />
            <Hotspots />
            <DataViz />
            <LabelDriver />
            {!lowTier && !motion.reduce ? <Effects /> : null}
            <Preload all />
          </Suspense>
          <AdaptiveDpr />
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setLowTier(true)}
            onFallback={() => setLowTier(true)}
          />
        </SceneBoundary>
      </Canvas>
    </div>
  )
}

export { SceneBoundary }
