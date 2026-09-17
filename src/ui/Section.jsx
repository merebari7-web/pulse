import { useRef } from "react"
import { useScrubbedPanel } from "../hooks/useJourney.js"
import { Gauge } from "./Gauge.jsx"
import { LayerLegend } from "./InfoCard.jsx"

/**
 * Section — one chapter of the journey, as HTML over the canvas.
 *
 * The wrapper carries the chapter's *scroll length* (weight × 100svh); inside
 * it, a sticky full-height panel holds the copy, so the text stays composed
 * while the camera flies and then leaves with its chapter. Every block type
 * (lede, layer list, hotspot path, history, callouts, exam questions) is a
 * variant here and in the data file — nothing is hand-placed in pixels.
 */
export function Section({ chapter, i, long }) {
  const inner = useRef(null)
  useScrubbedPanel(inner)
  const portrait = !long

  return (
    <div
      className="relative"
      style={{ height: `${+(chapter.weight * 100).toFixed(2)}svh` }}
      data-chapter={chapter.id}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <article ref={inner} className={`panel-wrap h-full w-full ${align(chapter.panel, portrait)}`}>
          <div className="panel glass max-w-[34rem] rounded-[26px] border border-white/10 bg-ink/45 p-6 backdrop-blur-[10px] sm:p-8">
            <header className="mb-5 flex items-baseline gap-3">
              <span className="font-mono text-[0.68rem] tracking-[0.3em] text-oxy">{chapter.index}</span>
              <span className="eyebrow">{chapter.eyebrow}</span>
            </header>

            <Title tag={i === 0 ? "h1" : "h2"} text={chapter.title} first={i === 0} />
            <p className="mt-4 text-[0.98rem] leading-[1.65] text-bone/78 sm:text-[1.06rem]">{chapter.lede}</p>

            {chapter.stats && <Stats items={chapter.stats} />}
            {chapter.list && <Terms items={chapter.list} accent="endo" />}
            {chapter.path && <Terms items={chapter.path} accent="wire" numbered />}
            {chapter.history && <History items={chapter.history} />}
            {chapter.callouts && <Callouts items={chapter.callouts} />}
            {chapter.chartTitle && <Gauge label={chapter.chartTitle} />}
            {chapter.legend && <LayerLegend />}
            {chapter.questions && <Questions items={chapter.questions} />}
            {chapter.traps && <Traps items={chapter.traps} />}
            {chapter.recap && <Recap items={chapter.recap} />}
            {chapter.hint && (
              <p className="mt-6 border-t border-white/10 pt-3 font-mono text-[0.66rem] leading-relaxed tracking-wide text-ash/80">
                {chapter.hint}
              </p>
            )}
          </div>
          {i === 0 && <ScrollCue />}
        </article>
      </div>
    </div>
  )
}

function align(panel, portrait) {
  if (portrait) return "flex items-end justify-center px-4 pb-[8svh]"
  switch (panel) {
    case "left":
      return "flex items-center justify-start px-[4vw]"
    case "center":
      return "flex items-center justify-center px-[4vw] text-center"
    default:
      return "flex items-center justify-end px-[4vw]"
  }
}

function Title({ tag: Tag, text, first }) {
  return (
    <Tag
      className={
        first
          ? "text-shadow-cinema text-[clamp(2.6rem,7.6vw,5.4rem)] leading-[0.94]"
          : "text-shadow-cinema text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.02]"
      }
    >
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </Tag>
  )
}

function Stats({ items }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
      {items.map((s) => (
        <div key={s.label} className="border-l border-oxy/40 pl-3">
          <dt className="font-mono text-[1.02rem] leading-tight text-bone">{s.value}</dt>
          <dd className="mt-1 text-[0.74rem] leading-snug text-ash">{s.label}</dd>
        </div>
      ))}
    </dl>
  )
}

const ACCENT = {
  endo: { dot: "bg-endo", num: "text-endo/70" },
  wire: { dot: "bg-wire", num: "text-wire/70" },
  oxy: { dot: "bg-oxy", num: "text-oxy/70" },
  fat: { dot: "bg-fat", num: "text-fat/70" },
}

function Terms({ items, accent = "endo", numbered }) {
  const a = ACCENT[accent] || ACCENT.endo
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t, i) => (
        <li key={t.term} className="grid grid-cols-[auto_1fr] gap-x-3">
          {numbered ? (
            <span className={`mt-[0.28rem] font-mono text-[0.66rem] tracking-widest ${a.num}`}>{String(i + 1).padStart(2, "0")}</span>
          ) : (
            <span className={`mt-[0.6rem] h-[6px] w-[6px] shrink-0 rounded-full ${a.dot}`} />
          )}
          <span>
            <span className="block text-[0.95rem] font-medium tracking-tight text-bone">{t.term}</span>
            {t.sub && <span className="block font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ash/70">{t.sub}</span>}
            <span className="mt-1 block text-[0.86rem] leading-relaxed text-bone/62">{t.text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function History({ items }) {
  return (
    <ol className="no-print mt-6 space-y-2 border-l border-white/10 pl-4">
      {items.map((h) => (
        <li key={h.year} className="grid grid-cols-[5.4rem_1fr] gap-x-3 text-[0.8rem] leading-relaxed">
          <span className="font-mono text-[0.68rem] text-wire/80">{h.year}</span>
          <span className="text-bone/62">{h.text}</span>
        </li>
      ))}
    </ol>
  )
}

function Callouts({ items }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      {items.map((c) => (
        <div key={c.value} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="font-mono text-[1.15rem] text-fat">{c.value}</div>
          <div className="mt-1 text-[0.72rem] leading-snug text-ash">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

function Questions({ items }) {
  return (
    <div className="mt-6 space-y-2">
      {items.map((q, i) => (
        <details key={q.q} className="group rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 open:bg-white/[0.05]">
          <summary className="flex cursor-pointer list-none items-start gap-2.5 text-[0.86rem] leading-snug text-bone/90">
            <span className="mt-[0.15rem] font-mono text-[0.62rem] text-ash">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1">{q.q}</span>
            <span className="mt-[0.1rem] text-ash transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 border-t border-white/10 pt-2 text-[0.82rem] leading-relaxed text-bone/65">{q.a}</p>
        </details>
      ))}
    </div>
  )
}

function Traps({ items }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((t) => (
        <li key={t.trap} className="rounded-xl border border-oxy/30 bg-oxy/[0.07] p-3">
          <div className="text-[0.86rem] font-medium text-oxy">{t.trap}</div>
          <div className="mt-1 text-[0.8rem] leading-relaxed text-bone/70">{t.fix}</div>
        </li>
      ))}
    </ul>
  )
}

function Recap({ items }) {
  return (
    <ul className="mt-5 space-y-1.5 text-[0.82rem] leading-relaxed text-bone/70">
      {items.map((r) => (
        <li key={r} className="flex gap-2">
          <span className="text-wire">▸</span>
          <span>{r}</span>
        </li>
      ))}
    </ul>
  )
}

function ScrollCue() {
  return (
    <div className="motion-only pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-ash">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.3em]">scroll</span>
      <span className="relative block h-10 w-px overflow-hidden bg-white/15">
        <span className="absolute inset-x-0 top-0 h-4 animate-[cue_1.9s_ease-in-out_infinite] bg-oxy" />
      </span>
      <style>{`@keyframes cue { 0%{transform:translateY(-100%)} 60%,100%{transform:translateY(300%)} }`}</style>
    </div>
  )
}
