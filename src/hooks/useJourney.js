import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"
import { applyScroll, configure, getMetrics, setScrollVelocity } from "../lib/store.js"
import { clamp01 } from "../lib/math.js"
import { prime } from "../three/anim.js"
import { motion } from "../lib/motion.js"

/**
 * useJourney — the only glue between the scrollbar and everything else.
 *
 *  1. buildMetrics/configure the store from the real viewport height (svh, so
 *     the mobile URL bar collapsing does not desync the map — and it is re-run
 *     on resize and on `visualViewport` change);
 *  2. Lenis for the smoothing, driven by GSAP's ticker so there is exactly one
 *     rAF loop in the app;
 *  3. ONE ScrollTrigger for the whole container, whose `progress` becomes the
 *     store's scroll number. Every section's own ScrollTrigger is only used to
 *     fade its copy in and out.
 *
 * On `prefers-reduced-motion` (or the calm toggle) Lenis is not created at all:
 * native scroll, scrubbing still mapped, nothing animating by itself.
 */

let registered = false
function register() {
  if (registered) return
  gsap.registerPlugin(ScrollTrigger)
  registered = true
}

let controller = null

/**
 * Scroll to a global journey position. ScrollTrigger's range is
 * `containerHeight - viewportHeight`, so that is the denominator here too —
 * anything else and the nav lands a screen short on the last chapter.
 */
export function scrollToProgress(t, { immediate = false } = {}) {
  const m = getMetrics()
  const px = Math.max(0, Math.round(clamp01(t) * Math.max(1, m.total - window.innerHeight)) + (m.offset || 0))
  if (controller && !immediate) controller.scrollTo(px, { offset: 0 })
  else if (controller) controller.scrollTo(px, { immediate: true })
  else window.scrollTo({ top: px, behavior: immediate ? "auto" : "smooth" })
}


export function scrollToChapter(i, opts) {
  const m = getMetrics()
  const r = m.ranges[Math.max(0, Math.min(m.ranges.length - 1, i))]
  if (r) scrollToProgress(r.tStart + 0.004, opts)
}

export function useJourney({ rootRef, chapters, tracks }) {
  const [smooth, setSmooth] = useState(false)
  const lenisRef = useRef(null)

  // ---- layout: metrics first, before the first paint -----------------------
  useLayoutEffect(() => {
    const totalWeight = chapters.reduce((s, c) => s + (c.weight || 1), 0)
    /**
     * Derive "one viewport" from the DOM rather than from a CSS unit: the
     * sections are laid out in svh, and svh / innerHeight / visualViewport all
     * disagree on mobile while the address bar is animating. Measuring the real
     * container height means the scene map and the laid-out sections can never
     * drift apart.
     */
    const measure = () => {
      const px = rootRef.current?.getBoundingClientRect?.().height || window.innerHeight * totalWeight
      const vh = px / Math.max(1, totalWeight)
      return configure({ chapters, tracks, viewport: vh, offset: 0, calm: motion.reduce, reduced: motion.reduce })
    }
    measure()
    prime()
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        measure()
        ScrollTrigger.refresh()
      })
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    window.visualViewport?.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
      window.visualViewport?.removeEventListener("resize", onResize)
    }
  }, [chapters, tracks])

  // ---- the scroll engine ----------------------------------------------------
  useEffect(() => {
    register()
    const root = rootRef.current
    if (!root) return

    const wantSmooth = !motion.reduce && !document.documentElement.classList.contains("calm")
    let lenis = null
    let tickerFn = null
    if (wantSmooth) {
      /* A smoothing library is a luxury, never a dependency: if Lenis cannot
         start (an unusual DOM, a stripped-down browser), the page keeps native
         scroll and the scene map survives, because ScrollTrigger reads the
         scrollbar itself — not Lenis. So: try, and fall through if it throws. */
      try {
        lenis = new Lenis({
          duration: 1.08,
          easing: (t) => 1 - Math.pow(1 - t, 3.4),
          smoothWheel: true,
          wheelMultiplier: 1,
          touchMultiplier: 1.5,
          autoRaf: false, // GSAP's ticker drives it below: one rAF loop in the app
          anchors: false,
        })
      } catch (err) {
        console.warn("[pulse] smooth scroll unavailable, using native scroll:", err)
        lenis = null
      }
      if (lenis) {
        controller = lenis
        lenisRef.current = lenis
        setSmooth(true)
        tickerFn = (time) => lenis.raf(time * 1000)
        gsap.ticker.add(tickerFn)
        gsap.ticker.lagSmoothing(0)
        lenis.on("scroll", ScrollTrigger.update)
      }
    }

    let last = 0
    /* One trigger for the whole page. `onUpdate` is enough on its own — there is
       no tween to scrub, the scrubbing *is* the store. */
    const st = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        applyScroll(self.progress)
        const v = self.progress - last
        last = self.progress
        setScrollVelocity(v * 180)
      },
    })

    // a mid-page reload restores scrollTop without an event, so prime it
    applyScroll(
      st.progress ||
        window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
    )
    const onNativeScroll = () => {
      if (!lenis) applyScroll(st.progress)
    }
    if (!lenis) window.addEventListener("scroll", onNativeScroll, { passive: true })

    return () => {
      if (!lenis) window.removeEventListener("scroll", onNativeScroll)
      st.kill()
      if (lenis) {
        lenis.destroy()
        controller = null
        lenisRef.current = null
        if (tickerFn) gsap.ticker.remove(tickerFn)
        setSmooth(false)
      }
    }
  }, [rootRef, chapters, tracks])

  const refresh = useCallback(() => ScrollTrigger.refresh(), [])
  return { lenis: lenisRef, smooth, refresh }
}

/**
 * Per-section copy reveal, scrubbed against that section's own progress, so the
 * text is welded to the scroll rather than played on a timer.
 */
export function useScrubbedPanel(ref, { enter = 0.14, holdEnd = 0.84, exit = 0.97 } = {}) {
  useLayoutEffect(() => {
    // registering ScrollTrigger is a side effect — it installs a rAF loop, so it
    // belongs in an effect, not in the render path (StrictMode double-renders)
    register()
    const el = ref.current
    const wrap = el?.parentElement?.parentElement
    if (!el || !wrap) return
    if (motion.reduce) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: wrap, start: "top bottom", end: "bottom top", scrub: 0.55, invalidateOnRefresh: true },
    })
    // one timeline unit == one pass of the section through the viewport
    tl.fromTo(el, { autoAlpha: 0, yPercent: 8, filter: "blur(7px)" }, { autoAlpha: 1, yPercent: 0, filter: "blur(0px)", duration: enter }, 0)
      .to(el, { autoAlpha: 1, duration: Math.max(0.01, holdEnd - enter) }, enter)
      .to(el, { autoAlpha: 0, yPercent: -6, filter: "blur(5px)", duration: Math.max(0.01, exit - holdEnd) }, holdEnd)
    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [ref, enter, holdEnd, exit])
}
