/**
 * Fallback — what renders instead of the canvas: no WebGL, a lost context, or a
 * scene that threw. It is a real page, not an apology: the same copy, the same
 * numbers, plus a reload for the transient context-loss case (very common after
 * a laptop wakes from sleep).
 */
export function Fallback({ reason, onReader }) {
  return (
    <section className="relative z-10 mx-auto flex min-h-[60svh] max-w-[46rem] flex-col justify-center gap-4 px-6 py-24">
      <p className="eyebrow">WebGL unavailable</p>
      <h1 className="font-display text-[clamp(1.9rem,5vw,3rem)] leading-tight">
        The 3D heart could not start{reason ? ` — ${reason}` : ""}.
      </h1>
      <p className="text-[0.95rem] leading-relaxed text-bone/70">
        PULSE renders the organ in real time with WebGL. This browser or GPU refused a context, so the model is
        replaced by the written field guide: the same four chambers, the same conduction sequence, the same numbers
        and the same exam questions.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded-full border border-oxy/50 bg-oxy/10 px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone transition hover:bg-oxy/20"
        >
          retry 3D
        </button>
        <button
          onClick={onReader}
          className="rounded-full border border-white/12 px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone/80 transition hover:border-white/30"
        >
          open the reader
        </button>
      </div>
    </section>
  )
}
