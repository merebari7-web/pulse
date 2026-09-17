import { useMemo } from "react"
import { CHAMBERS, CORONARIES, HOTSPOTS, LAYERS, VALVES, VESSELS } from "../data/anatomy.js"
import { useStore } from "../hooks/useStore.js"
import { set as setState } from "../lib/store.js"

/**
 * InfoCard — the hover pay-off. Point at a part of the model and it is named
 * here, with the one line worth knowing. It is also the keyboard/touch path to
 * the same information, since the 3D labels are decorative and aria-hidden.
 */
export function InfoCard() {
  const id = useStore((s) => s.focused || s.hovered)
  const map = useMemo(() => {
    const m = new Map()
    for (const c of CHAMBERS) m.set(c.id, { title: c.name, sub: c.blood === "oxy" ? "oxygenated" : "deoxygenated", text: c.role })
    for (const v of VESSELS) m.set(v.id, { title: v.name, sub: v.blood === "oxy" ? "oxygenated" : "deoxygenated", text: v.blood === "oxy" ? "Carries blood under systemic pressure." : "Returns blood to the heart at low pressure." })
    for (const v of VALVES) m.set(v.id, { title: v.name, sub: `${v.cusps} cusp${v.cusps > 2 ? "s" : ""}`, text: v.role + (v.note ? ` ${v.note}` : "") })
    for (const c of CORONARIES) m.set(c.id, { title: c.name, sub: "coronary vessel", text: "Supplies the heart wall itself — it is on the outside, not inside the chambers." })
    for (const h of HOTSPOTS) m.set(h.id, { title: h.name, sub: h.sub + " · " + h.rate, text: h.detail })
    for (const f of m.keys()) void f
    return m
  }, [])

  const info = id ? map.get(id) : null
  if (!info) return null
  return (
    <aside className="no-print fixed bottom-5 left-4 z-30 max-w-[19rem] sm:left-6 md:bottom-8">
      <div className="panel glass rounded-2xl border border-white/10 bg-ink/60 p-4 backdrop-blur-[10px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[1.05rem] leading-tight text-bone">{info.title}</h3>
            <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-oxy/85">{info.sub}</p>
          </div>
          <button
            onClick={() => setState("focused", null)}
            className="-mt-1 -mr-1 rounded-full p-1 text-ash transition hover:text-bone"
            aria-label="Dismiss"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-bone/68">{info.text}</p>
      </div>
    </aside>
  )
}

/**
 * The peel index: the order the shell comes off, which is also the order the
 * scroll reveals them. Kept beside the teaching copy because it maps to the
 * model, not to the syllabus — `stage` is literally when each group lifts.
 */
export function LayerLegend({ active = -1 }) {
  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <p className="eyebrow mb-2.5">peel order</p>
      <ol className="flex flex-wrap gap-1.5">
        {LAYERS.map((l, i) => (
          <li
            key={l.id}
            className={`flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] leading-none transition ${
              i === active ? "border-oxy/60 bg-oxy/12 text-bone" : "border-white/10 text-ash/85"
            }`}
          >
            <span className="font-mono text-[0.56rem] opacity-70">{l.order}</span>
            {l.name}
          </li>
        ))}
      </ol>
    </div>
  )
}
