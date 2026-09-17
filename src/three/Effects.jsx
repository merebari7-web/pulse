import { useRef } from "react"
import { Bloom, EffectComposer, Noise, N8AO, Vignette } from "@react-three/postprocessing"
import { useFrame } from "@react-three/fiber"
import { quality } from "../lib/motion.js"
import { A } from "./anim.js"
import { TUNE } from "../config.js"
import { motion } from "../lib/motion.js"

/**
 * Post chain: ambient occlusion (N8AO), then a mipmap bloom whose strength is
 * driven by the journey — it lifts for the deep dive, drops back for the chart
 * — then vignette and a whisper of grain.
 *
 * Every effect is optional by device tier, and the whole composer is skipped on
 * the lowest tier so an old integrated GPU still draws the scene at speed.
 */
export function Effects() {
  const bloom = useRef()
  const useAO = quality.ao
  const ms = TUNE.effects.multisampling

  useFrame(() => {
    if (bloom.current) {
      const b = A.bloom ?? 0.8
      bloom.current.intensity = 0.45 + b * 0.95 + A.beat * 0.22
      bloom.current.luminanceThreshold = 0.3 - b * 0.08
    }
  })

  if (ms === 0 && !useAO) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.26} luminanceSmoothing={0.22} radius={0.72} intensity={1.1} />
        <Vignette offset={0.28} darkness={0.72} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={ms} enableNormalPass={false}>
      <N8AO
        intensity={1.15}
        aoRadius={1.35}
        distanceFalloff={1}
        quality={motion.tier === "high" ? "high" : "medium"}
        halfRes={!motion.reduce}
        color="#12060a"
      />
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.28} luminanceSmoothing={0.25} radius={0.7} intensity={1.05} />
      <Vignette offset={0.26} darkness={0.74} />
      <Noise opacity={0.022} />
    </EffectComposer>
  )
}
