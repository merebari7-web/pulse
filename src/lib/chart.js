import { clamp01 } from "./math.js"

/**
 * chart.js — the data-viz layout, shared by the GPU and the DOM.
 *
 * The bar shader grows each bar with `mix(0.004, height, smoothstep(k))` where
 * k is offset by the bar index, which is what makes the chart "grow in
 * sequence" as the section scrolls in. The DOM has to put a label on top of a
 * bar that is mid-growth, so the same three lines of maths live here, exported,
 * and are asserted in tools/test-logic.mjs rather than eyeballed.
 */

export const BAR = { w: 0.52, d: 0.52, gap: 0.9, maxH: 2.7, floor: -2.45, arc: 0.14 }

/** Reveal factor of bar `i` given the section's 0..1 growth value. */
export function barGrow(i, growth) {
  const k = clamp01(growth * 1.45 - i * 0.1)
  return k * k * (3 - 2 * k)
}

/** World-space height of bar i. Mirrors `mix(0.004, aTarget, k)` in the GLSL. */
export function barTop(height, i, growth) {
  return 0.004 + (height - 0.004) * barGrow(i, growth)
}

/**
 * World-space Y of a bar top, inside the <DataViz/> group. The mesh is drawn
 * from `BAR.floor` and grows upward, so anything pinned to a bar top has to add
 * the floor back — the bug this helper exists to prevent.
 */
export function barTopWorld(height, i, growth) {
  return BAR.floor + barTop(height, i, growth)
}

/** x/z slot for bar i of n, gently arced so the row faces the camera. */
export function barSlot(i, n, { gap = BAR.gap, arc = BAR.arc } = {}) {
  const mid = (n - 1) / 2
  const o = i - mid
  return { x: o * gap, z: -Math.abs(o) * arc }
}

/** Normalise a dataset into bar heights. */
export function layoutBars(items, { key = "pct", maxH = BAR.maxH, maxValue } = {}) {
  const n = items.length
  const top = maxValue ?? Math.max(...items.map((d) => d[key]), 1)
  return items.map((d, i) => ({
    ...d,
    index: i,
    height: (d[key] / top) * maxH,
    ...barSlot(i, n),
  }))
}
