import { useCallback, useEffect, useRef, useState } from "react"
import { CHAPTERS, TRACKS } from "./data/journey.js"
import { scrollToChapter, useJourney } from "./hooks/useJourney.js"
import { usePointer, useViewportFlags } from "./hooks/usePointer.js"
import { useBoot, STEPS } from "./hooks/useBoot.js"
import { useStore } from "./hooks/useStore.js"
import { motion } from "./lib/motion.js"
import { state } from "./lib/store.js"
import { Scene3D } from "./three/Scene3D.jsx"
import { Overlay } from "./ui/Overlay.jsx"
import { Labels } from "./ui/Labels.jsx"
import { Rail } from "./ui/Rail.jsx"
import { Nav } from "./ui/Nav.jsx"
import { Loader } from "./ui/Loader.jsx"
import { Fallback } from "./ui/Fallback.jsx"
import { Reader } from "./ui/Reader.jsx"

/**
 * App — three layers, in this order:
 *   1. <Scene3D/>  fixed, behind everything, one canvas for the whole journey
 *   2. <Overlay/>  the scrolling HTML that both drives the scene and carries
 *                  the readable copy
 *   3. <Labels/> <Rail/> <Nav/>  the frame: 3D-pinned labels, chapter spine,
 *                  controls
 *
 * Two exit paths are first-class, not error text: no WebGL (or a lost context)
 * renders <Reader/> instead, and the Reader is also one key away (R) for anyone
 * who would rather just read. `Escape` leaves the journey at any time.
 */
export default function App() {
  const rootRef = useRef(null)
  const boot = useBoot({ total: STEPS.length })
  const flags = useViewportFlags()
  const failed = useStore((s) => s.failed)
  const [reader, setReader] = useState(false)
  const noGL = motion.webgl === 0

  usePointer({ enabled: !noGL && !failed })
  useJourney({ rootRef, chapters: CHAPTERS, tracks: TRACKS })

  const onReady = useCallback((info) => boot.mark(info), [boot])

  /* The degraded branch is not an error page: the explanation and retry sit on
     top of the full written edition, and the banner is dismissible because the
     reader is where someone with no GPU was always going to end up. */
  if (reader || noGL || failed) {
    const forced = (noGL || failed) && !reader
    return (
      <main className="relative">
        {forced ? (
          <Fallback
            reason={failed ? (state.lost ? "the WebGL context was lost" : "the scene reported a failure") : "this browser refused a WebGL context"}
            onReader={() => setReader(true)}
          />
        ) : null}
        <Reader
          onExit={forced ? undefined : () => setReader(false)}
          reason={failed ? "the 3D scene could not run" : noGL ? "there is no 3D context here" : undefined}
        />
      </main>
    )
  }

  return (
    <main className="relative">
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm"
        onClick={(e) => {
          e.preventDefault()
          setReader(true)
        }}
      >
        Read instead of scroll
      </a>
      <Scene3D boot={boot} onReady={onReady} />
      <Overlay rootRef={rootRef} small={flags.small} />
      <Labels />
      <Rail />
      <Nav onReader={() => setReader(true)} />
      <Loader progress={boot.progress} ready={boot.ready} failed={noGL || failed} onSkip={() => setReader(true)} />
      <KeyboardShortcuts onReader={() => setReader(true)} />
    </main>
  )
}

function KeyboardShortcuts({ onReader }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = Number(e.key)
      if (n >= 1 && n <= CHAPTERS.length) {
        e.preventDefault()
        scrollToChapter(n - 1)
      } else if (e.key.toLowerCase() === "r") onReader()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onReader])
  return null
}
