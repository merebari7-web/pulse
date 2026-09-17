# PULSE — the human heart, an interactive 3D field guide

A scroll-driven WebGL experience that turns a standard educational page into a
**cinematic anatomy field guide**: one sticky Three.js canvas behind a scrolling HTML
overlay, with the scrollbar itself flying the camera, peeling the heart open, isolating its
electrical system and re-forming the organ as a live data chart.

Subject: the human heart — four chambers, four valves, one wire — written so that every
claim maps onto a WAEC/NECO/JAMB Biology syllabus point.

Live: **https://merebari7-web.github.io/pulse/**

```
npm install                      # .npmrc already sets legacy-peer-deps (fiber 9 peer range vs React 19)
npm run dev                      # http://localhost:5173  (binds 0.0.0.0)
npm run build && npm run preview # production bundle + preview server
npm run check                    # logic + shaders + build + scene + DOM (see “Verification”)
```

React Three Fiber · three 0.186 · GSAP ScrollTrigger · Lenis · Tailwind v4 · hand-written GLSL.
**No network requests at runtime**: the model, the materials, the fonts and the icons are all
generated or system-native, so the page renders identically offline.

---

## The four beats (five chapters, one scroll)

| # | Chapter            | Scroll does                                                                 | Scene state                                                                                     |
| - | ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 01 | `hero` **Two pumps** | camera flies 17.5 → 8.2 units, wide lens tightening, slow idle orbit         | whole model rotates, sac shimmers in, beat runs at 74 bpm                                        |
| 02 | `layers` **Peel it open** | the shell unzips along its own axis, layer by layer, per-piece displacement vectors lerped | 9 myocardial flaps curl outward on a staggered hinge; chambers, valves, vessels lift behind them |
| 03 | `spark` **The wire**     | camera dives into the septum, everything else turns to glass                | conduction system lights SA → AV (≈0.1 s delay) → His → Purkinje; sparks trail the wavefront; four hotspots cycle |
| 04 | `data` **The numbers**   | the organ shrinks aside and re-forms as a chart                             | perfusion bars grow 0 → value sequentially on an arced row, ECG ribbon reveals, timeline rail lights up |
| 05 | `exam` **Held in mind**  | the model settles back, copy takes the frame                                | six exam questions, two classic traps, the recap list, print/replay                             |

Each chapter owns a *weight* (`1.15 / 1.7 / 1.5 / 1.5 / 1.0`), so the page is `6.85 × 100svh`
of real HTML; the canvas is `position: fixed` behind it. Scroll position is mapped once, by a
single ScrollTrigger, into a number in `0..1`.

## The scroll contract

This is the one idea the whole project hangs on: **nothing reads the scrollbar.**

```
wheel / touch / keyboard
   └─ Lenis (smoothed native scroll, skipped under reduced motion)
        └─ one ScrollTrigger  ──►  store.applyScroll(t)      // t in 0..1
             └─ buildTracks(TRACKS, metrics.ranges)          // chapter space → absolute scroll
                  └─ store.scene  {open, cut, sac, dim, isolate, focus,
                                    shrink, chart, ribbon, trail, orbit, dust, bloom}
                       └─ anim.stepAnim(dt) → A   (damped twice: scrub, then object)
                            ├─ Driver writes G.uTime/uBeat/uOpen/uCut/uDim/… once per frame
                            ├─ Heart: applyRig(node, rig, A.open) + applyStage(group, A.shrink)
                            ├─ Rig: interpolates CAMERA_KEYS (pos, look, fov, roll) + pointer parallax
                            ├─ Particles / Trail / Hotspots / DataViz / Ground / Lights / Effects
                            └─ labels.projectAll(): DOM label nodes pinned to 3D anchors
```

Because the tracks are authored in **chapter space** (`at(2, 0.5, 0.4)` = chapter 03, halfway
through, value 0.4) and re-resolved whenever the viewport changes, re-ordering or re-weighting
a chapter never desynchronises the animation from the scroll — `validateJourney` asserts it.

`src/data/journey.js` is therefore the only file you need to touch to re-choreograph the piece:
chapters, the 13 tracks, and the 11 camera keys. Adding a chapter means adding an entry, giving
each track one more keyframe, and pointing a panel at it; `npm run check` then tells you if any
chapter ended up with no camera, or a track with a NaN.

## Layout of the code

```
src/
  config.js              PALETTE · HEART · MODEL (the GLB switch) · TUNE · DPR · tiers
  data/
    journey.js           CHAPTERS · TRACKS · CAMERA_KEYS — the narrative, as data
    anatomy.js           shell bands + quads, chambers, vessels, valves, nodes, wire,
                         coronaries, layers, 17 labels, perfusion table, ECG, timeline,
                         hotspots, recap, glossary — every number the copy quotes
  lib/
    scroll.js            buildMetrics · chapterAt · validateJourney
    track.js             keyframes → frames → sampled value; dampTo
    store.js             the only mutable state in the app: `scene` (scroll says),
                         `state` (UI says), microtask-batched notify, resolveAt
    anim.js              A: the eased half of everything, plus the beat envelope
    motion.js            prefers-reduced-motion · pointer type · WebGL probe · quality tiers
    chart.js             bar layout, mirrored from the chart shader so DOM labels land on tops
    cardiac.js           HR / SV / CO model — one source for every physiological number
    math.js              clamp01 · damp · dampAngle · smoothstep · beatEnvelope
  three/
    Scene3D.jsx          the Canvas, the degradation ladder, the error boundary
    glsl.js              8 programs sharing COMMON/LIGHT_UNIFORMS/FOG_FN
    materials.js         shared G/L uniform objects + 13 factories (never material.clone())
    geometry.js          blob / slab-tube / fan / ribbon / dust / trail, finite-checked
    heart/shape.js       the radial silhouette, and the slab cutter that turns it into walls
    heart/build.js       37-part descriptor builder + auto-fit + penetration margins
    Heart.jsx            one useFrame over all parts: rig → material → node arrival
    explode.js          makeRig / applyRig (staggered reveal, petal curl) / applyStage
    Rig.jsx              camera interpolation + pointer parallax + idle orbit
    Driver.jsx           one frame at priority −2: stepAnim + globals + fps telemetry
    Lights.jsx           camera-relative key, cyan rim, chamber point lights on the beat,
                         and a Lightformer environment when the tier can afford it
    Effects.jsx          N8AO + Bloom + vignette + grain, with a thin 2-effect fallback
    Particles.jsx        dust field; sparks converging on the focused node from a curve table
    DataViz.jsx          the bar chart, the timeline rail, the ECG ribbon and its wave markers
    Hotspot.jsx          billboarded halo + expanding ring + hit sphere per conduction node
    labels.js            3D→DOM projector (never drei <Html> for text: one transform per frame)
    registry.js          part id → Object3D, so any layer can find any other layer's node
    parts/Valves.jsx     torus annulus + cusps that lerp shut on the beat (that is S1)
    parts/ImportedHeart.jsx  the GLB path: name-matched parts, derived rigs, derived aAlong
  hooks/
    useJourney.js        measure → configure → one ScrollTrigger → applyScroll; Lenis; scrollToChapter
    useBoot.js           the loader, driven by the steps that actually happen
    useStore.js          useSyncExternalStore, cached so scroll ≠ re-render
    usePointer.js        parallax telemetry, viewport flags
  ui/
    Overlay.jsx · Section.jsx  the scroll layer: sticky panels per chapter
    Nav.jsx · Rail.jsx         brand, chapter jumps, calm toggle, live bpm/fps, progress spine
    Labels.jsx · InfoCard.jsx  the projected labels; the hover pay-off card; the peel index
    Gauge.jsx                  drag exertion → HR/SV/CO, which also drives the beat and the bloom
    Loader.jsx · Fallback.jsx · Reader.jsx  first paint, no-WebGL, and the print edition
tools/                     the check suite (see below) + two geometry harnesses
public/models/README.md  how to drop in a scanned heart
```

## The heart is geometry, not an asset

`heart/shape.js` defines the organ as a **radial function over the sphere** — a base radius
`BASE = [1.22, 1.56, 1.12]` modulated by seven gaussian "bumps" for the ventricular bulge, the
auricles, the great-vessel shoulders and the apex. `makeSlab({theta, phi, thickness})` cuts a
**watertight** patch out of that surface (outer wall + inner wall + rim), which is what makes the
exploded view read as *cut muscle* rather than as a hollow shell: every flap has a real thickness
of its own — 0.055 for the atria, 0.28–0.30 for the left ventricle, 0.12–0.13 for the right,
0.24 for the apical cap — and the cut rims come out ivory because the vertex carries which face
it belongs to (`aFace`).

37 parts, 66 248 triangles, built in ~250 ms, no texture files.

Containment is exact rather than eyeballed: divide a vertex by `BASE`, compare its magnitude
against `radial(direction)`, and you know whether a chamber pokes through the epicardium.
`build.js` iterates that to an auto-fit (`fitted: [{id, scale, inward, margin}…]`) and
`tools/test-logic.mjs` fails the build if any margin goes negative — which is how "it looked
fine in the editor" stops being a release blocker.

## Shaders: two rules that matter

1. **Shared uniform blocks.** `materials.js` owns two objects, `G` (time, beat, open, cut, dim,
   isolate, hover, dust, fog) and `L` (light dirs, colours, key/fill/ambient/rim). Every program
   spreads them, so one write per frame drives every material. `makeShader` builds
   `{...G, ...L, ...mine}` — that ordering is what lets a per-material key (`uRumple`,
   `uOpacity`) shadow a global one.
2. **Never `material.clone()`.** `ShaderMaterial.clone()` deep-clones the uniforms map and severs
   the shared references: half the scene would freeze in time. `createPartMaterial` calls the
   factory again per part instead — cheap, because three caches the compiled program by
   shader+define key, so ~40 tissue instances are still one program.

Both rules are enforced by a test, because both fail silently (a NaN scale, a static shell) rather
than loudly.

## Responsive, calm, and honest about failure

- **Mobile / portrait**: FOV widens (`TUNE.fovWiden`), the camera dollies back
  (`portraitPush`), panels switch from side-anchored to bottom-anchored with `8svh` of clearance
  so the type never sits on the organ, labels flip when they crowd the right edge, and
  `pointer: coarse` swaps hover for tap.
- **DPR & effects** come from a device tier (`high / mid / low / off`), `PerformanceMonitor`
  drops a sustained sub-45 fps session to the low tier without a reload, and `AdaptiveDpr`
  absorbs spikes.
- **Reduced motion is a first-class mode**, not a bug: `prefers-reduced-motion` *and* the
  in-page “motion off” toggle kill the beat, the idle orbit, the particles and Lenis, while
  keeping scroll → scene mapping readable. The composer is skipped, panels appear without fades.
- **No WebGL, a lost context, or a thrown scene** all land on `<Reader/>`: the same copy, the
  same numbers and the same questions as a document (it is also the print stylesheet target).
  `Escape`-free: press `R` any time, or use the “Read instead of scroll” link, which is the
  first thing a keyboard gets.
- The loader reports the steps that actually happen (`context → geometry → frame`) with a 9 s
  watchdog, and the error boundary says which shader or asset failed rather than going black.

## Tuning

```js
TUNE = {
  cameraLambda: 3.6,  objectLambda: 4.2,      // follow tightness
  parallax: { yaw: 0.075, pitch: 0.05, model: 0.1 },  // radians, at full pointer deflection
  idleOrbit: 0.1,     hinge: 0.92, explode: 1,
  portraitPush: 1.24, fovWiden: 1.3,
  fog: { near: 9, far: 34, density: 0.018 },
}
```

`HEART.bpm` changes the resting rate everywhere at once — beat envelope, ECG sweep speed, bloom
pulse, the HUD, and the chapter copy that quotes it (`lib/cardiac.js` reads the same constant).
`PALETTE` is mirrored into `@theme` in `styles.css`, so a DOM class and a shader colour come from
one place; the DOM test fails if a label asks for a hue that isn't in the palette.

## Verification

`npm run check` runs, in order:

1. **`check:logic` — 39 assertions**, in node: `validateJourney`, chapter/track/camera-data
   integrity, the scroll→scene map (including “the chart is up in its own chapter and away
   before it”), the bar-grow mirror against the GLSL text it mirrors, cardiac consistency,
   perfusion shares summing to 100 %, valve cusp counts, explode rig identity/stagger/overflow,
   the GLTF name matcher, `buildModel` finiteness + containment margins + wall asymmetry, every
   material factory (declared uniforms all supplied, no NaN colours), the shared-uniform ownership
   rule, and frame-rate-independent damping.
2. **`check:shaders`** — all 8 programs assembled the way `WebGLProgram` assembles them
   (`#include <…>` resolved from `THREE.ShaderChunk`), parsed with a real GLSL parser: syntax,
   undeclared functions/types, ESSL1-only discipline, `gl_FragColor`, varyings declared *and*
   assigned across stages, attributes that some geometry actually produces.
3. **`npm run build`** — Vite 8 + Tailwind v4, 630 modules, `dist/` written.
4. **`check:scene` — 10 assertions** with `@react-three/test-renderer`: the entire R3F tree
   (Driver, Rig, Lights, Heart, Ground, Particles, Trail, Hotspots, DataViz, LabelDriver) is
   mounted against a mock WebGL context and stepped ~100 frames at a time at five scroll
   positions, asserting that no transform in the graph goes non-finite, that every wall flap
   really leaves home when the shell opens, that the DOM label anchors sit exactly on the animated
   bar tops (`BAR.floor + barTopWorld(...) + pad`), that the camera closes in and stays out of the
   model, that hover reaches the materials, and that unmounting disposes the geometry and materials.
5. **`check:dom` — 13 assertions** rendering the real UI with React 19's server renderer: every
   chapter's copy reaching the DOM, the peel index, the label layer, the gauge's numbers, the
   rail/nav/loader, and the app's no-WebGL path landing on the reader.

These checks found four real defects while the project was being written — a `rig.scale` shape
mismatch that scaled the entire model to NaN (black canvas, no error), a per-part uniform write
that would have leaked across every material, an undefined `THREE` in the GLB path, and per-frame
uniform writes to standard materials that have no uniform block. That is the value; screenshots
would not have caught any of them.

The same `npm run check` is the deploy gate: `.github/workflows/pages.yml` runs it on a clean
`npm ci` before it publishes, so a regression cannot reach the live site. The first run of that
workflow on GitHub completed `success` with all seven build steps green, and the deployed
`index.html` is byte-identical to the local `dist/` built from the same commit.

**Not verified here, and worth a look on a real machine:** actual GLSL compilation and lighting
(a GPU is the only judge of the grade), the Bloom/AO look, ScrollTrigger's feel against a physical
mouse wheel, and the GLB path with a real scanned file (its matching, rig derivation and
`aAlong` derivation *are* unit-tested against synthetic meshes, but nothing in this sandbox
downloads).

## Content and its sources

Physiology values are the standard teaching numbers, rounded: stroke volume ≈70 mL, cardiac
output ≈5.2 L/min at rest rising 4–5× with effort, ≈100 000 beats and ≈7 570 L a day, heart mass
250–350 g, LV wall ≈3× RV, EF ≈55 %, SA 60–100 → AV 40–60 → Purkinje 20–40 bpm, AV delay ≈0.1 s.
The impact figures are public epidemiology: ischaemic heart disease as the world's leading cause
of death at ≈9.0 M deaths in 2021 (WHO Global Health Estimates), cardiovascular deaths rising from
12.4 M in 1990 to 19.8 M in 2022 (IHME), and the xenograft timeline entries as reported through
2026 (2022 Baltimore: organ 47 days, patient 60 days; 2023: 40 and 40).

Everything is a **stylised teaching model** — geometry, colours and proportions serve the lesson,
not the atlas. It is not a medical device, not a diagnostic aid, and the answers in `exam` are
study answers, not clinical advice.

## Publishing on GitHub (Pages)

**Deployed:** https://merebari7-web.github.io/pulse/ — every push to `main` redeploys it.

`dist/` is built with `base: './'`, so **every** asset URL in `index.html` is relative — verified
by serving `dist/` under a `/pulse/` subpath and fetching all six generated assets: 200 across the
board. That is what makes it work at `https://<user>.github.io/<repo>/` with no config change.

```bash
gh repo create pulse --public --source=. --push          # if you have the gh CLI
# …or by hand:
git remote add origin git@github.com:<user>/pulse.git
git push -u origin main
```

Then **Settings → Pages → Build and deployment → Source: “GitHub Actions”** (already set on the
deployed repo). From then on every push to `main` runs `.github/workflows/pages.yml`, which does
`npm ci && npm run check && vite build` and publishes `dist/` — so a commit whose 62 assertions
fail never deploys, and the Pages build is the same build the checks validated. (Prefer the older
branch-based flow instead? `npm run build` then push `dist/` to a `gh-pages` branch — nothing in the
app reads a path, so either works.)

`tools/gh-publish.sh` automates all of the above from a machine that has no git credential, using a
token you export yourself:

```bash
GH_TOKEN=github_pat_… ./tools/gh-publish.sh <owner>      # add --check to dry-run
```

It creates the repo only if missing, never force-pushes, hands the token to git through a throwaway
askpass file that is deleted on exit (so it never reaches `.git/config` or a credential store),
flips Pages to `build_type: workflow`, and polls until the site is built. Pass `GIT_AUTHOR_NAME` /
`GIT_AUTHOR_EMAIL` to re-author the history as yourself before publishing.

Fonts, model geometry, shaders and icons are all local or generated, so Pages needs no CDN, no
environment variables and no build secrets.

## Extending it

- **Re-choreograph** → `src/data/journey.js`. Add a chapter, give every track a keyframe in it,
  add two camera keys, run `npm run check`.
- **Change the organ** → `src/data/anatomy.js`. `build.js` reads it; the labels, the InfoCard, the
  peel index and the reader edition all follow automatically because they read the same tables.
- **Swap in a scanned heart** → `public/models/README.md`.
- **New post-processing look** → `Effects.jsx` + `TUNE.effects`, keeping the `multisampling === 0`
  thin-composer branch intact so low-end devices still get one pass, not five.
