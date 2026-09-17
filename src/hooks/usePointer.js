import { useEffect, useMemo, useState } from "react"
import { state } from "../lib/store.js"
import { motion } from "../lib/motion.js"

/**
 * Pointer + viewport telemetry.
 *
 * The raw position is written to the store as normalised -1..1 and damped
 * inside the frame loop, not here: this handler fires far more often than a
 * frame, so it does two divisions and nothing else. `useViewportFlags` is a
 * separate, React-level signal because the *layout* (which side the copy sits
 * on, label flipping) genuinely wants a re-render.
 */
export function usePointer({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || motion.coarse) return
    let last = 0
    const onMove = (e) => {
      const now = e.timeStamp || performance.now()
      if (now - last < 8) return
      last = now
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      state.pointer.x = x
      state.pointer.y = y
    }
    const onLeave = () => {
      state.pointer.x = 0
      state.pointer.y = 0
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("blur", onLeave)
    document.addEventListener("pointerleave", onLeave)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("blur", onLeave)
      document.removeEventListener("pointerleave", onLeave)
    }
  }, [enabled])
}

export function useViewportFlags() {
  const read = () => ({
    portrait: window.innerHeight > window.innerWidth * 1.08,
    small: window.innerWidth < 880,
    tiny: window.innerWidth < 460,
    vh: window.innerHeight,
  })
  const [flags, setFlags] = useState(read)
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setFlags(read()))
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
    }
  }, [])
  return useMemo(() => flags, [flags])
}
