import { useEffect, useRef } from "react"
import { useStore } from "../hooks/useStore.js"
import { scrollToChapter } from "../hooks/useJourney.js"
import { CHAPTERS } from "../data/journey.js"
import { state } from "../lib/store.js"

/**
 * Rail — the chapter spine on the right. Its fill is driven by a passive scroll
 * listener writing one CSS custom property, so the progress line is smooth at
 * native scroll rate while React only re-renders when the chapter changes.
 */
export function Rail() {
  const chapter = useStore((s) => s.chapter)
  const fill = useRef(null)
  const pct = useRef(null)

  useEffect(() => {
    let raf = 0
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      if (fill.current) fill.current.style.transform = `scaleY(${p.toFixed(4)})`
      if (pct.current) pct.current.textContent = String(Math.round(p * 100)).padStart(3, "0")
      raf = 0
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <nav className="no-print fixed right-0 top-0 z-30 hidden h-[100svh] w-[6.6rem] flex-col items-end justify-center gap-4 pr-5 md:flex" aria-label="Chapters">
      <span ref={pct} className="font-mono text-[0.66rem] tracking-[0.2em] text-ash/70">000</span>
      <div className="relative h-[46svh] w-px bg-white/12">
        <div ref={fill} className="absolute inset-0 origin-top bg-gradient-to-b from-oxy via-fat to-wire" style={{ transform: "scaleY(0)" }} />
      </div>
      <ul className="flex flex-col items-end gap-2.5">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button
              onClick={() => scrollToChapter(i)}
              className={`group flex items-center justify-end gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition ${
                chapter === i ? "text-bone" : "text-ash/45 hover:text-bone/80"
              }`}
              aria-current={chapter === i ? "true" : undefined}
            >
              <span className="transition group-hover:translate-x-[-2px]">{c.index}</span>
              <span className={`h-[6px] w-[6px] rounded-full transition ${chapter === i ? "bg-oxy shadow-glow" : "bg-white/20 group-hover:bg-white/50"}`} />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
