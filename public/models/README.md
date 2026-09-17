# Dropping in a real scanned heart

The scene is **procedural by default** — every millimetre of the model in `src/three/heart/`
is built from maths at runtime, so the page renders with no network at all. This folder is
for the other half of the plan: if you want a scanned or authored heart instead, put the
file here and point one config value at it.

```js
// src/config.js
export const MODEL = {
  url: "./models/heart.glb",   // ← that is the whole switch
  fit: { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
  replaceMaterials: true,      // false keeps the file's own materials
  dracoPath: null,             // e.g. a self-hosted Draco decoder for compressed .glb
}
```

Nothing else changes: the camera path, the exploded view, the dimming, the beat and the
chapter copy are driven by the store, not by the geometry.

## What the loader expects of a file

Parts are matched by **node name**, case-insensitive, longest substring wins
(`MODEL.map` in `src/config.js`):

| Node name in your file                | Becomes    | And gets                                    |
| ------------------------------------- | ---------- | ------------------------------------------- |
| `left_ventricle`, `ventricle_l`, `lv_`| `lv`       | the oxy palette, a label, an explode rig    |
| `right_ventricle`, `rv_`              | `rv`       | deoxy palette, label, rig                   |
| `left_atrium` / `right_atrium`        | `la` / `ra`| label, rig                                  |
| `aorta`, `ascending_aorta`            | `aorta`    | vessel shader, flow pulse, rig              |
| `pulmonary_trunk`                     | `pa`       | vessel shader, rig                          |
| `mitral`, `bicuspid`                  | `mitral`   | cusp-flexing valve material                  |
| `sinoatrial`, `sa_node`               | `sa`       | node glow + the four hotspot rings          |
| `pericardium`                         | `sac`      | the dissolving fresnel shell                |

Any mesh whose name matches nothing is still rendered (with the tissue shader if
`replaceMaterials` is on) — it simply stays home during the exploded beat instead of
swinging out. A part's explode direction is derived from its own bounding-box centre
relative to the organ's, so you do not have to author any vectors.

Rules of thumb that keep a file usable:

- one node per anatomical part, named, not one merged soup;
- keep the origin at the centre of the organ and roughly real proportions — `fit.scale`
  is applied on top, but the camera path assumes about 3.4 units across;
- you do not need a `aAlong` attribute for the flow pulses: if the geometry has none, it is
  derived from the part's own longest axis (see `ensureFlowAxis` in
  `src/three/parts/ImportedHeart.jsx`), so blood still travels along each vessel instead of
  every surface reading as a cut rim.

## Where to get one

Search for "heart" on a museum open-access or research repository — the Wellcome Collection,
the Smithsonian 3D, NIH's 3D Print Exchange and the Visible Human Project all publish
anatomical heart scans, and Sketchfab has CC-BY heart models you can export as `.glb`.
Check the licence before shipping one anywhere public, and never present a scanned model as
diagnostic: this project's copy is a teaching text, not clinical advice.

## No network in the preview

The in-app preview has no internet, so a `.glb` referenced from a CDN will simply fail to
load and the error boundary will drop the page back to the reader edition. Files in this
folder are served by the dev server, which is why the switch lives in a path and not a URL.
