import { buildMetrics, chapterAt, validateJourney } from "./scroll.js"
import { buildTracks, sampleTracks } from "./track.js"

/**
 * store.js — one store, two halves, deliberately different transport.
 *
 *  • `scene`   flat bag of numbers written on every scroll tick and read inside
 *              `useFrame`. It is *not* React state: a trackpad can fire 120
 *              scroll events a second and the scene must not re-render React on
 *              any of them.
 *  • `state`   the few things the DOM genuinely cares about (active chapter,
 *              hovered part, fps, calm mode). Published through
 *              useSyncExternalStore with a memoised snapshot, so React only
 *              re-renders when a value actually changed.
 */

export const scene = {
  scroll: 0,
  /** resolved track values land here: open, cut, isolate, chart, … */
}

export const state = {
  scroll: 0,
  velocity: 0,
  chapter: -1,
  chapterId: null,
  local: 0,
  ready: false,
  fps: 60,
  ms: 16.7,
  hovered: null,
  focused: null,
  exertion: 0,
  pointer: { x: 0, y: 0 },
  beats: 0,
  seconds: 0,
  calm: false,
  reduced: false,
  failed: false,
  lost: false,
  chapters: [],
}

const listeners = new Set()
let snapshot = { ...state }
let queued = false

function flush() {
  queued = false
  snapshot = { ...state }
  for (const fn of listeners) fn(snapshot)
}

function notify() {
  if (queued) return
  queued = true
  if (typeof queueMicrotask === "function") queueMicrotask(flush)
  else Promise.resolve().then(flush)
}

let cfg = { chapters: [], defs: {}, built: {}, metrics: buildMetrics([{ id: "boot", weight: 1 }]) }

/**
 * Wire the journey data to the store. Called once on mount and again on resize
 * (viewport height changes with mobile URL bars, so the map must be rebuilt).
 */
export function configure({ chapters, tracks, viewport = 800, offset = 0, calm = false, reduced = false } = {}) {
  const metrics = buildMetrics(chapters, viewport, offset)
  const built = buildTracks(tracks, metrics.ranges)
  // Seed every track name with its first authored value: components read
  // `scene.chart` inside useFrame, and a `undefined * 2` there is a NaN that
  // takes the object out of the frame silently.
  for (const name of Object.keys(built)) {
    if (typeof scene[name] !== "number") scene[name] = built[name].frames?.[0]?.[1] ?? 0
  }
  if (import.meta.env?.DEV) {
    const problems = validateJourney(chapters, built)
    if (problems.length) console.warn("[pulse] journey problems:", problems.join("; "))
  }
  cfg = { chapters: chapters || [], defs: tracks || {}, built, metrics }
  state.chapters = cfg.chapters
  state.calm = calm
  state.reduced = reduced
  applyScroll(state.scroll)
  notify()
  return metrics
}

/** Rebuild the scroll → scene map (resize / font-load / layout shift). */
export function remap(viewport, offset = 0) {
  return configure({
    chapters: cfg.chapters,
    tracks: cfg.defs,
    viewport,
    offset,
    calm: state.calm,
    reduced: state.reduced,
  })
}

/** Chapter-local position → absolute scroll, for anything outside the store. */
export function resolveAt(chapter, t = 0) {
  const r = cfg.metrics.ranges[chapter]
  if (!r) return 0
  const k = Math.max(0, Math.min(1, t))
  return r.tStart + (r.tEnd - r.tStart) * k
}

export function getMetrics() {
  return cfg.metrics
}

/** Map a global 0..1 scroll position onto every track. */
export function applyScroll(t) {
  const s = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
  sampleTracks(cfg.built, s, scene)
  scene.scroll = s
  const at = chapterAt(cfg.metrics, s)
  state.scroll = s
  if (at.index !== state.chapter || Math.abs(at.local - state.local) > 0.02) {
    state.chapter = at.index
    state.chapterId = at.id
    state.local = at.local
    notify()
  }
}

export function setScrollVelocity(v) {
  const n = Math.max(-1, Math.min(1, v || 0))
  if (Math.abs(n - state.velocity) > 0.02) {
    state.velocity = n
    notify()
  }
}

export function set(key, value) {
  if (state[key] === value) return
  state[key] = value
  notify()
}

export function patch(obj) {
  let changed = false
  for (const k in obj) {
    if (state[k] !== obj[k]) {
      state[k] = obj[k]
      changed = true
    }
  }
  if (changed) notify()
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSnapshot() {
  return snapshot
}

/** Heartbeat counter: float here, integers to the DOM (throttled by tickFrame). */
let beatsExact = 0
export function addBeat(n = 1) {
  beatsExact += n
}

let frames = 0
let frameTime = 0
export function tickFrame(dt) {
  if (Math.floor(beatsExact) !== state.beats) state.beats = Math.floor(beatsExact)
  frames += 1
  frameTime += dt
  if (frameTime >= 0.5) {
    patch({ fps: Math.round(frames / frameTime), ms: +((frameTime / frames) * 1000).toFixed(1) })
    frames = 0
    frameTime = 0
  }
}

/** Debug/inspection helper — also used by the DOM smoke test. */
export function dump() {
  return { state: { ...state }, scene: { ...scene } }
}
