import { useEffect, useMemo, useState } from "react"
import { cardiacAt, maxHr } from "../lib/cardiac.js"
import { patch } from "../lib/store.js"

/**
 * Gauge — the one deliberately *interactive* number set in the journey.
 *
 * The bars are driven by scroll; this is driven by you. Drag it and the beat
 * envelope, the ECG sweep speed and the bloom all change with it, because
 * `state.exertion` feeds the same cardiac clock the scene reads. It is here to
 * make the point the exam question actually tests: CO = SV × HR, and stroke
 * volume stops rising long before heart rate does.
 */
export function Gauge({ label = "Simulate exertion" }) {
  const [ex, setEx] = useState(0)
  useEffect(() => patch({ exertion: ex }), [ex])
  // trained: 0 and age 17 → the textbook resting 74 bpm / 70 mL / 5.2 L/min
  // that every other number in the app quotes, so the gauge can disagree with nothing.
  const c = useMemo(() => cardiacAt(ex, { trained: 0, age: 17 }), [ex])

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ash/60">{c.zone}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric k="HR" v={c.hr} u="bpm" tone="text-oxy" />
        <Metric k="SV" v={c.sv} u="mL" tone="text-fat" />
        <Metric k="CO" v={c.co} u="L/min" tone="text-wire" />
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(ex * 100)}
        onChange={(e) => setEx(Number(e.target.value) / 100)}
        className="mt-4 h-1 w-full cursor-ew-resize appearance-none rounded-full bg-white/15 accent-oxy"
        aria-label="Exertion level"
      />
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[0.7rem] leading-snug text-bone/60">
          CO = SV × HR. Drag up: rate climbs toward {maxHr(17)} bpm, stroke volume plateaus near 118 mL — and diastole
          shrinks to <span className="font-mono text-fat">{Math.round(c.diastoleFrac * 100)}%</span> of the cycle, which is
          when the coronaries fill.
        </span>
      </div>
    </div>
  )
}

function Metric({ k, v, u, tone }) {
  return (
    <div className="rounded-xl border border-white/8 bg-void/40 px-2.5 py-2">
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ash/70">{k}</div>
      <div className={`font-mono text-[1.22rem] leading-tight ${tone}`}>
        {v}
        <span className="ml-1 text-[0.6rem] text-ash/70">{u}</span>
      </div>
    </div>
  )
}
