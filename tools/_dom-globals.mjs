/**
 * A browser-shaped environment for the node test runners, imported first so it
 * is in place before any module that touches `window` initialises.
 *
 * `getContext("webgl")` answers (but not `webgl2`) on purpose: the app's own
 * probe then classifies this as the **low** tier, which is the configuration
 * that still builds particles and trails while skipping the render-target
 * features (AO, the environment probe) a software GL cannot stand in for.
 */
import { JSDOM } from "jsdom"

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  url: "http://localhost/",
  // rAF + matchMedia only exist with this on, and GSAP's ScrollTrigger and Lenis
  // both want them. Every runner ends with an explicit process.exit, so the
  // animation loop cannot keep the process alive.
  pretendToBeVisual: true,
})
const w = dom.window

for (const k of ["window", "document", "navigator", "HTMLElement", "HTMLCanvasElement", "Element", "Node", "Event", "CustomEvent", "MouseEvent", "PointerEvent", "WheelEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "getComputedStyle", "DOMRect", "Window", "Document", "DocumentFragment", "ShadowRoot", "MutationObserver", "Image", "CSS", "NodeList"]) {
  if (globalThis[k] === undefined && w[k] !== undefined) globalThis[k] = w[k]
}
globalThis.window ||= w
globalThis.IS_REACT_ACT_ENVIRONMENT = true
if (typeof w.matchMedia !== "function") {
  w.matchMedia = (media) => ({
    media,
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
globalThis.matchMedia = w.matchMedia.bind(w)

/* jsdom without pretendToBeVisual has no rAF; GSAP's ScrollTrigger wants one */
if (typeof globalThis.requestAnimationFrame !== "function") {
  const raf = (cb) => setTimeout(() => cb(Number(process.hrtime.bigint() / 1000n) / 1000), 16)
  globalThis.requestAnimationFrame = raf
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
  w.requestAnimationFrame = raf
  w.cancelAnimationFrame = globalThis.cancelAnimationFrame
}
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
w.ResizeObserver ||= globalThis.ResizeObserver

const fakeGL = {
  getParameter: () => 0,
  getExtension: () => null,
  getSupportedExtensions: () => [],
  getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
  canvas: null,
}
const proto = w.HTMLCanvasElement?.prototype
if (proto) {
  const real = proto.getContext
  proto.getContext = function (id, attrs) {
    if (typeof id === "string" && id === "webgl") return fakeGL
    if (typeof id === "string" && id === "experimental-webgl") return fakeGL
    if (typeof real === "function") return real.apply(this, arguments)
    return null
  }
}

export const jsdomWindow = w
export const teardown = () => w.close()
