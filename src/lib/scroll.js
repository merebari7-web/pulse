import { clamp01, invLerp, isAscending } from "./math.js"

/**
 * scroll.js — turns a document scroll position into chapter geometry.
 *
 * The page is `sum(chapter.weights) x viewport-height` of plain HTML; a single
 * GSAP ScrollTrigger on that container publishes one number (0..1). This module
 * owns the mapping from that number to "which chapter am I in, how far through
 * it am I", which every other system (3D tracks, nav rail, captions, the
 * per-chapter text) reads from the same store. One source of truth, so the
 * overlay copy and the camera can never drift out of sync.
 */

/**
 * Layout metrics for a journey.
 * @param chapters [{ id, weight, ... }]
 * @param viewport pixel height of one chapter (100svh)
 * @param offset   document offset of the scroll container
 */
export function buildMetrics(chapters, viewport = 800, offset = 0) {
  const list = Array.isArray(chapters) ? chapters : []
  const totalWeight = list.reduce((s, c) => s + (c.weight > 0 ? c.weight : 1), 0)
  const docSpan = totalWeight * viewport || 1
  let acc = 0
  const ranges = list.map((c) => {
    const h = (c.weight > 0 ? c.weight : 1) * viewport
    const startPx = offset + acc
    acc += h
    return {
      id: c.id,
      startPx,
      endPx: startPx + h,
      height: h,
      tStart: clamp01((startPx - offset) / docSpan),
      tEnd: clamp01((startPx + h - offset) / docSpan),
    }
  })
  return {
    viewport,
    offset,
    total: acc,
    totalWeight,
    ranges,
    starts: ranges.map((r) => r.tStart),
    spans: ranges.map((r) => r.tEnd - r.tStart),
  }
}

/** Which chapter owns scroll position t (0..1), and how far through it we are. */
export function chapterAt(metrics, t) {
  const ranges = metrics?.ranges || []
  if (!ranges.length) return { index: 0, id: null, local: 0 }
  const s = clamp01(t)
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]
    if (s <= r.tEnd) return { index: i, id: r.id, local: clamp01(invLerp(r.tStart, r.tEnd, s)) }
  }
  const last = ranges[ranges.length - 1]
  return { index: ranges.length - 1, id: last.id, local: 1 }
}

/** Distance from `t` to a chapter boundary, in scroll units (for magnetic snapping). */
export function distToBoundary(metrics, t) {
  const edges = [0, ...(metrics?.ranges || []).flatMap((r) => [r.tStart, r.tEnd]), 1]
  let best = 1
  for (const e of edges) best = Math.min(best, Math.abs(clamp01(t) - e))
  return best
}

/** Import-time sanity check for hand-authored journey data (dev only). */
export function validateJourney(chapters, tracks = {}) {
  const problems = []
  if (!Array.isArray(chapters) || !chapters.length) problems.push("no chapters")
  ;(chapters || []).forEach((c, i) => {
    if (!c.id) problems.push(`chapter ${i} has no id`)
    if (!(c.weight > 0)) problems.push(`chapter ${c.id || i} has a non-positive weight`)
    if (typeof c.viewport === "number" && !Number.isFinite(c.viewport)) problems.push(`chapter ${c.id} viewport is not finite`)
  })
  for (const [name, def] of Object.entries(tracks)) {
    const frames = def?.frames
    if (!frames?.length) problems.push(`track ${name} is empty`)
    else {
      if (!isAscending(frames.map((f) => f[0]))) problems.push(`track ${name} keyframes are not ascending`)
      if (frames.some((f) => !Number.isFinite(f[0]) || !Number.isFinite(f[1]))) problems.push(`track ${name} has a non-finite keyframe`)
    }
  }
  return problems
}
