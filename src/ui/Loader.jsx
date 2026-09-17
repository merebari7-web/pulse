import { useEffect, useState } from "react"

/**
 * Loader — covers the first paint until the scene has actually drawn.
 * Steps are reported by the components that do the work (canvas created →
 * geometry built → first frame), and a stalled boot releases the page after
 * 9 s instead of hanging on it.
 */
export function Loader({ progress = 0, ready, failed, onSkip }) {
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready && !failed) return
    const t = setTimeout(() => setGone(true), 420)
    return () => clearTimeout(t)
  }, [ready, failed])
  if (gone) return null

  const p = failed ? 1 : Math.max(0.06, Math.min(1, progress))
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-void transition-opacity duration-500"
      style={{ opacity: ready && !failed ? 0 : 1, pointerEvents: ready && !failed ? "none" : "auto" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[1.3rem] tracking-[0.3em] text-bone">PULSE</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ash/70">building the heart</span>
      </div>
      <div className="relative h-px w-[min(22rem,70vw)] overflow-hidden bg-white/12">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-oxy to-fat transition-[width] duration-300" style={{ width: `${p * 100}%` }} />
      </div>
      <p className="max-w-[24rem] px-6 text-center text-[0.72rem] leading-relaxed text-ash/70">
        {failed ? "WebGL could not start on this device — the written edition has everything the 3D one shows." : "Procedural geometry, one shader per tissue, no downloads."}
      </p>
      {onSkip && (
        <button onClick={onSkip} className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ash/60 underline-offset-4 hover:text-bone hover:underline">
          skip to text
        </button>
      )}
    </div>
  )
}
