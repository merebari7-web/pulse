import { CHAPTERS } from "../data/journey.js"
import { Section } from "./Section.jsx"
import { InfoCard } from "./InfoCard.jsx"
import { scrollToProgress } from "../hooks/useJourney.js"
import { useStore } from "../hooks/useStore.js"

/**
 * The HTML scroll layer. It contains *only* the chapter wrappers, so the
 * container height and the ScrollTrigger range are the same number — that is
 * what lets every track in journey.js be authored in chapter space and still
 * land exactly.
 */
export function Overlay({ rootRef, small }) {
  const chapter = useStore((s) => s.chapter)
  return (
    <div ref={rootRef} className="relative z-10" id="top">
      {CHAPTERS.map((c, i) => (
        <Section key={c.id} chapter={c} i={i} long={!small} />
      ))}
      <InfoCard />
      {chapter > 0 && (
        <button
          onClick={() => scrollToProgress(0)}
          className="no-print fixed bottom-6 right-5 z-30 rounded-full border border-white/12 bg-ink/60 px-3.5 py-2 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-bone/70 backdrop-blur-sm transition hover:border-oxy/45 hover:text-bone md:right-[7.6rem]"
        >
          ↑ back to the whole heart
        </button>
      )}
      <footer className="pointer-events-none fixed bottom-0 left-0 z-30 hidden px-6 pb-2 font-mono text-[0.56rem] uppercase tracking-[0.2em] text-ash/35 lg:block">
        PULSE · original teaching model, procedural geometry · stylised anatomy, not a clinical device
      </footer>
    </div>
  )
}
