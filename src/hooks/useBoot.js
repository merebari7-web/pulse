import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * useBoot — an honest loader.
 *
 * Not a fake 1.4 s spinner: each step is work the scene really does before it
 * can show anything, reported by the component that does it — `context` when
 * the renderer exists, `geometry` when the model (procedural or a loaded GLB)
 * is built and anchored, `frame` on the paint after that. The bar is the count.
 * A 9 s watchdog releases the page rather than trapping it behind a loader that
 * is waiting on a GPU that will never answer.
 */
export const STEPS = ["context", "geometry", "frame"]

export function useBoot({ total = STEPS.length, timeout = 9000 } = {}) {
  const [done, setDone] = useState([])
  const [extra, setExtra] = useState(null)
  const [forced, setForced] = useState(false)
  const seen = useRef(new Set())

  const mark = useCallback((name, value = 1) => {
    if (seen.current.has(name)) {
      // a second report of the same step is progress inside it (a download)
      if (typeof value === "number" && value < 1) setExtra({ name, value })
      return
    }
    seen.current.add(name)
    setExtra(null)
    setDone((d) => (d.includes(name) ? d : [...d, name]))
  }, [])

  useEffect(() => {
    if (total <= 0) return
    const t = setTimeout(() => setForced(true), timeout)
    return () => clearTimeout(t)
  }, [timeout, total])

  const progress = Math.min(1, (done.length + (extra ? extra.value * 0.6 : 0)) / total)
  const ready = forced || done.length >= total

  return useMemo(
    () => ({
      mark,
      done,
      progress,
      ready,
      forced,
      step: done[done.length - 1] || STEPS[0],
      total,
    }),
    [mark, done, progress, ready, forced, extra, total],
  )
}
