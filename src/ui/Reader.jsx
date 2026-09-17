import { CHAPTERS } from "../data/journey.js"
import { CHAMBERS, ECG, FLOW, GLOSSARY, HOTSPOTS, LAYERS, OUTPUT, RECAP, TIMELINE, VALVES, VESSELS } from "../data/anatomy.js"
import { cardiacAt } from "../lib/cardiac.js"
import { motion } from "../lib/motion.js"

/**
 * Reader — the same journey as a document.
 *
 * It is not a degraded mode: it is the print edition, the accessible edition and
 * the no-WebGL edition in one component, built from exactly the data the 3D
 * scene consumes, so the words and the model can never disagree.
 */
export function Reader({ onExit, reason }) {
  const at = cardiacAt(0)
  return (
    <main className="grain relative z-10 mx-auto max-w-[52rem] px-6 pb-28 pt-16 sm:px-10">
      <header className="mb-14 border-b border-white/10 pb-8">
        <p className="eyebrow">Interactive field guide · reader edition</p>
        <h1 className="mt-3 font-display text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.02]">
          Two pumps, folded into one.
        </h1>
        <p className="mt-4 max-w-[44rem] text-[1rem] leading-relaxed text-bone/72">
          {reason ? `Shown as text because ${reason}. ` : ""}
          The heart is not one pump but two, sitting side by side and fired by the same wire. The right half pushes
          used blood to the lungs; the left half pushes fresh blood to everything else — about {at.co} L/min of it
          while you are sitting down.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {!motion.webgl && <span className="rounded-full border border-white/12 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ash">no webgl detected</span>}
          <button onClick={onExit} className="rounded-full border border-oxy/45 bg-oxy/10 px-3.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-bone transition hover:bg-oxy/20">
            ← back to the 3D journey
          </button>
          <button onClick={() => window.print?.()} className="rounded-full border border-white/12 px-3.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-bone/75 transition hover:border-white/30">
            print these notes
          </button>
        </div>
      </header>

      {CHAPTERS.map((c) => (
        <section key={c.id} className="chapter mb-16">
          <p className="eyebrow">{c.index} · {c.eyebrow}</p>
          <h2 className="mt-2 font-display text-[clamp(1.7rem,4vw,2.5rem)] leading-tight">{c.title.replace(/\n/g, " ")}</h2>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-bone/75">{c.lede}</p>
          {c.stats && (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {c.stats.map((s) => (
                <li key={s.label} className="rounded-xl border border-white/10 p-3">
                  <div className="font-mono text-[1rem] text-oxy">{s.value}</div>
                  <div className="mt-1 text-[0.72rem] text-ash">{s.label}</div>
                </li>
              ))}
            </ul>
          )}
          {(c.list || c.path) && <Terms items={c.list || c.path} />}
          {c.history && <Rows items={c.history.map((h) => [h.year, h.text])} head={["Year", "What changed"]} />}
          {c.callouts && <Rows items={c.callouts.map((x) => [x.value, x.label])} head={["Number", "Meaning"]} />}
          {c.questions && (
            <ol className="mt-6 space-y-4">
              {c.questions.map((q) => (
                <li key={q.q}>
                  <p className="text-[0.92rem] font-medium text-bone">{q.q}</p>
                  <p className="mt-1 text-[0.88rem] leading-relaxed text-bone/65">{q.a}</p>
                </li>
              ))}
            </ol>
          )}
          {c.traps && (
            <ul className="mt-5 space-y-2">
              {c.traps.map((t) => (
                <li key={t.trap} className="rounded-xl border border-oxy/25 bg-oxy/[0.06] p-3 text-[0.86rem] leading-relaxed">
                  <span className="text-oxy">{t.trap}</span> <span className="text-bone/70">{t.fix}</span>
                </li>
              ))}
            </ul>
          )}
          {c.recap && (
            <ul className="mt-5 space-y-1.5 text-[0.88rem] leading-relaxed text-bone/72">
              {c.recap.map((r) => (
                <li key={r}>▸ {r}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="chapter mb-16">
        <h2 className="font-display text-[1.6rem]">Reference tables</h2>
        <h3 className="mt-6 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Layers, outside in</h3>
        <Rows items={LAYERS.map((l) => [String(l.order), `${l.name} — ${l.text}`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Chambers</h3>
        <Rows items={CHAMBERS.map((c) => [c.name, `${c.role} · blood: ${c.blood === "myo" ? "muscle wall" : c.blood}`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Valves</h3>
        <Rows items={VALVES.map((v) => [v.name, `${v.cusps} cusps · ${v.role}${v.note ? " · " + v.note : ""}`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Great vessels</h3>
        <Rows items={VESSELS.map((v) => [v.name, v.blood === "oxy" ? "oxygenated" : "deoxygenated"])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Where the blood goes at rest</h3>
        <Rows head={["Organ", "Share of output"]} items={FLOW.map((f) => [f.name, `${f.pct}% · ≈${f.litres} L/min — ${f.note}`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Cardiac output with effort</h3>
        <Rows head={["State", "Output"]} items={OUTPUT.map((o) => [o.name, `${o.value} L/min at ${o.hr} bpm`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">The ECG, wave by wave</h3>
        <Rows items={ECG.waves.map((w) => [w.name, w.meaning])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Conduction hotspots</h3>
        <Rows items={HOTSPOTS.map((h) => [`${h.name} (${h.rate})`, h.detail])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Timeline</h3>
        <Rows head={["Year", "Event"]} items={TIMELINE.map((t) => [String(t.year), `${t.label} — ${t.text}`])} />
        <h3 className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash">Glossary</h3>
        <Rows items={Object.entries(GLOSSARY).map(([k, v]) => [k, v])} />
      </section>

      <footer className="border-t border-white/10 pt-6 font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.16em] text-ash/60">
        PULSE — interactive field guide to the human heart. Original teaching model and original questions;
        stylised anatomy, not clinical advice. Figures are standard physiology teaching values, rounded.
      </footer>
    </main>
  )
}

function Terms({ items }) {
  return (
    <dl className="mt-5 space-y-3">
      {items.map((t) => (
        <div key={t.term} className="grid gap-1 border-l border-white/12 pl-3 sm:grid-cols-[11rem_1fr] sm:gap-3">
          <dt className="text-[0.9rem] text-bone">
            {t.term}
            {t.sub && <span className="block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ash/70">{t.sub}</span>}
          </dt>
          <dd className="text-[0.88rem] leading-relaxed text-bone/65">{t.text}</dd>
        </div>
      ))}
    </dl>
  )
}

function Rows({ items, head }) {
  return (
    <table className="mt-3 w-full border-collapse text-left text-[0.86rem]">
      {head && (
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-white/12 py-1.5 pr-3 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ash/70">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {items.map(([k, v], i) => (
          <tr key={i} className="align-top">
            <td className="w-[11rem] border-b border-white/6 py-2 pr-3 text-bone/85">{k}</td>
            <td className="border-b border-white/6 py-2 text-bone/60">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
