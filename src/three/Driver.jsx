import { useFrame } from "@react-three/fiber"
import { A, stepAnim } from "./anim.js"
import { G, syncGlobals } from "./materials.js"
import { addBeat, tickFrame } from "../lib/store.js"

/**
 * Driver — the heartbeat of the frame loop, at priority -2 so it runs before
 * every other useFrame in the scene. Four jobs, in order:
 *   1. advance time and ease the scroll tracks into `A`
 *   2. advance the cardiac cycle (phase, envelope, beat count)
 *   3. publish the shared uniforms (one write drives every custom material)
 *   4. sample frame timing for the HUD
 * Nothing here touches React state.
 */
export function Driver() {
  let lastBeats = 0

  useFrame((_, dt) => {
    stepAnim(dt)

    const beats = A.beatCount || 0
    if (beats !== lastBeats) {
      addBeat(beats - lastBeats)
      lastBeats = beats
    }

    G.uTime.value = A.time
    G.uBeat.value = A.beat
    G.uHover.value = A.hover
    syncGlobals()
    tickFrame(dt)
  }, -2)

  return null
}
