import { useRef, useSyncExternalStore } from "react"
import { getSnapshot, subscribe } from "../lib/store.js"

/**
 * React binding for the store. Only the handful of scalar things the DOM needs
 * (active chapter, hovered part, fps) come through here — the scene numbers stay
 * in `scene`/`A` and are read imperatively in useFrame.
 *
 * `sel` must return a primitive or a stable reference; the cached comparison
 * below is what stops a 120 Hz scroll from turning into a 120 Hz re-render.
 */
export function useStore(sel = (s) => s) {
  const last = useRef()
  const get = () => {
    const v = sel(getSnapshot())
    if (!Object.is(v, last.current)) last.current = v
    return last.current
  }
  return useSyncExternalStore(subscribe, get, get)
}
