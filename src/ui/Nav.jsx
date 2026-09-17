import { useEffect, useState } from "react"
import { useStore } from "../hooks/useStore.js"
import { CHAPTERS } from "../data/journey.js"
import { scrollToChapter } from "../hooks/useJourney.js"
import { isCalm, onCalmChange, setCalm } from "../lib/motion.js"
import { state } from "../lib/store.js"

/**
 * Nav — brand, chapter jumps, the motion toggle and a live read-out of the
 * simulation (rate + frame time). The toggle is not decoration: `calm` turns off
 * the beat, the idle orbit, the particles' self-motion and Lenis, while keeping
 * the scroll→scene mapping, which is the whole point of the page.
 */
export function Nav() {
  const chapter = useStore((s) => s.chapter)
  const [calm, setLocalCalm] = useState(isCalm())
  const [bpm, setBpm] = useState(74)
  const [fps, setFps] = useState(60)

  useEffect(() => onCalmChange(setLocalCalm), [])
  useEffect(() => {
    let id = 0
    const tick = () => {
      // read the live simulation without subscribing React to the frame loop
      setBpm(Math.round(state.bpmDisplay || 74))
      setFps(state.fps)
      id = requestAnimationFrame(tick)
    }
    if (typeof document !== "undefined" && !document.hidden) id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <header className="no-print fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
      <a href="#top" className="group flex items-baseline gap-2.5" onClick={(e) => { e.preventDefault(); scrollToChapter(0) }}>
        <span className="font-display text-[1.02rem] tracking-[0.2em] text-bone">PULSE</span>
        <span className="hidden font-mono text-[0.6rem] uppercase tracking-[0.22em] text-ash/70 transition group-hover:text-oxy sm:inline">
          the heart · interactive field guide
        </span>
      </a>

      <div className="flex items-center gap-2.5">
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-ink/50 px-2.5 py-1 font-mono text-[0.6rem] tracking-wider text-ash sm:flex">
          <span className="relative flex h-[6px] w-[6px]">
            <span className={calm ? "absolute inset-0 rounded-full bg-ash" : "absolute inline-flex h-full w-full animate-ping rounded-full bg-oxy/70"} />
            <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-oxy" />
          </span>
          {bpm} bpm
          <span className="text-ash/40">·</span>
          <span className={fps < 45 ? "text-fat" : "text-wire/80"}>{fps}fps</span>
        </span>
        <button
          onClick={() => setCalm(!calm)}
          className="rounded-full border border-white/12 bg-ink/50 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-oxy/50 hover:text-bone"
          aria-pressed={calm}
          title="Toggle all self-running motion (reduced motion)"
        >
          {calm ? "motion off" : "motion on"}
        </button>
      </div>
    </header>
  )
}
