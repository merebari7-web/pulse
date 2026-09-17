import { quality, motion } from "./lib/motion.js"

/**
 * config.js — the dials a developer actually turns. Palette is shared with the
 * DOM (see src/styles.css `@theme`); keep the two in step or the overlay and the
 * model will look like they belong to different sites.
 */

/** Hex palette. "oxy" = oxygenated, "deoxy" = deoxygenated — the colours a
 *  textbook uses, for the same reason. */
export const PALETTE = {
  oxy: "#ff4d63",
  oxyDeep: "#7a0f26",
  deoxy: "#5f8dff",
  deoxyDeep: "#16306e",
  myo: "#a8323f",
  myoDeep: "#3d0f18",
  endo: "#f0d9c0",
  fat: "#e3b776",
  valve: "#f5ece0",
  wire: "#5ef2c0",
  wireHot: "#d8fff2",
  sac: "#8fb6d8",
  bg: "#06070a",
  key: "#ffd9c9",
  rim: "#5f8dff",
  fill: "#2a3550",
}

/** Physiological defaults. 74 bpm is the "textbook adult" resting rate. */
export const HEART = {
  bpm: 74,
  /** beats counted while the tab is open, for the HUD */
  strokeVolumeMl: 70,
  cardiacOutputRest: 5.2,
}

/**
 * Optional drop-in 3D model. `null` keeps the fully procedural geometry (works
 * offline, in any browser, zero requests). Point it at a .glb and the scene
 * swaps in your model — see public/models/README.md for the node-naming
 * convention the parts are matched with.
 */
export const MODEL = {
  url: null, // e.g. "./models/heart.glb"
  /**
   * Node names in *your* file → internal part ids. Matching is
   * case-insensitive substring, longest key wins, so `pulmonary_valve` beats
   * `valve`. Every value here is a real part id of the procedural model (asserted
   * in tools/test-logic.mjs), which is what lets a scanned heart reuse the
   * labels, the info cards and the camera keys instead of needing its own copy.
   */
  map: {
    right_atrium: "ra",
    left_atrium: "la",
    right_ventricle: "rv",
    left_ventricle: "lv",
    atrium_r: "ra",
    atrium_l: "la",
    ventricle_r: "rv",
    ventricle_l: "lv",
    ra_: "ra",
    la_: "la",
    rv_: "rv",
    lv_: "lv",
    interventricular_septum: "septum",
    septum: "septum",
    ascending_aorta: "aorta",
    aortic_arch: "aorta",
    aorta: "aorta",
    pulmonary_trunk: "pa",
    main_pulmonary: "pa",
    pulmonary_artery: "pa",
    left_pulmonary_artery: "lpa",
    right_pulmonary_artery: "rpa",
    pulmonary_vein: "pv",
    superior_vena_cava: "svc",
    inferior_vena_cava: "ivc",
    vena_cava: "svc",
    tricuspid: "tricuspid",
    mitral: "mitral",
    bicuspid: "mitral",
    pulmonary_valve: "pulmonary",
    aortic_valve: "aortic",
    left_anterior_descending: "lad",
    lad: "lad",
    right_coronary: "rca",
    rca: "rca",
    circumflex: "lcx",
    lcx: "lcx",
    sinoatrial: "sa",
    sa_node: "sa",
    atrioventricular_node: "av",
    av_node: "av",
    bundle_of_his: "his",
    his_bundle: "his",
    purkinje: "pur",
    pericardium: "sac",
    epicardium: "sac",
  },
  /** scale/position applied after loading, to land inside the camera path */
  fit: { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
  /** decoder path for Draco-compressed .glb files (leave null to skip it) */
  dracoPath: null,
  /** false keeps the model's own materials instead of the scene's tissue shader */
  replaceMaterials: true,
}

/** Global scene tuning: how the camera flies, how soft things feel. */
export const TUNE = {
  /** higher = snappier follow (scroll-scrubbed camera) */
  cameraLambda: 3.6,
  /** higher = objects respond faster to scene values */
  objectLambda: 4.2,
  /** pointer parallax: camera yaw/pitch in radians at full deflection */
  parallax: { yaw: 0.075, pitch: 0.05, model: 0.1 },
  /** idle orbit, radians/second at full `orbit` track value */
  idleOrbit: 0.1,
  /** how far the shell halves swing open, radians */
  hinge: 0.92,
  /** how far the layers separate, world units, at open = 1 */
  explode: 1,
  /** camera dolly multiplier on portrait screens so text clears the model */
  portraitPush: 1.24,
  /** FOV widening on small screens */
  fovWiden: 1.3,
  /** fog: near/far in world units */
  fog: { near: 9, far: 34, density: 0.018 },
  /** postprocessing overrides for weak GPUs (merged with the tier table) */
  effects: quality,
}

export const IS_TOUCH = motion.coarse
export const DPR = quality.dpr
