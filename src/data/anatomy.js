/**
 * anatomy.js — the model, as data.
 *
 * Every number here is a *deliberate* shape decision, not a physics result:
 * this is a stylised teaching heart (recognisable silhouette, correct
 * relationships) rather than a photogrammetry scan. The relationships a student
 * has to remember are the ones modelled exactly:
 *   • the left ventricular wall is ~3× the right (see SHELL_PROFILE thickness)
 *   • the atria sit behind and above, the apex points left-inferior-anterior
 *   • the pulmonary trunk leaves the RIGHT ventricle and crosses in front of
 *     the aorta (the detail that makes the "artery = away from heart" lesson)
 *   • the coronary arteries lie ON the myocardium, in the AV groove and the
 *     interventricular sulcus — so a clot there starves the wall itself
 *   • the SA node sits high in the right atrium where the vena cava arrives,
 *     the AV node sits at the floor of the atrium by the septum, and the fibrous
 *     skeleton makes the Bundle of His the only electrical route across
 */

/* ---------------------------------------------------------------- geometry */

/**
 * The wall, cut into flaps. Each entry is a box in the shape generator's
 * (theta, phi) parameter space, so adjacent flaps share an exact edge and
 * reassemble with no seam. `thickness` is the teaching point: 30 mm of left
 * ventricle against 12 mm of right, and ~6 mm of atrial wall.
 *   theta 0..pi/2 = left-front · pi/2..pi = right-front
 *   pi..3pi/2 = right-back · 3pi/2..2pi = left-back   (phi 0 = base, pi = apex)
 */
export const SHELL = {
  bands: [
    { id: "atrial", phi: [0.04, 1.05], thickness: 0.055, lift: 2.15, curl: 0.5 },
    { id: "ventricular", phi: [1.05, 2.42], thickness: null, lift: 2.6, curl: 0.34 },
    { id: "apical", phi: [2.42, Math.PI], thickness: 0.24, lift: 1.9, curl: 0.62 },
  ],
  quads: [
    { id: "lf", name: "Left anterior wall", theta: [0, Math.PI / 2], wall: 0.3, blood: "oxy" },
    { id: "rf", name: "Right anterior wall", theta: [Math.PI / 2, Math.PI], wall: 0.12, blood: "deoxy" },
    { id: "rb", name: "Right posterior wall", theta: [Math.PI, Math.PI * 1.5], wall: 0.13, blood: "deoxy" },
    { id: "lb", name: "Left posterior wall", theta: [Math.PI * 1.5, Math.PI * 2], wall: 0.28, blood: "oxy" },
  ],
  /** pericardial sac: the same surface, inflated, dissolving rather than cut */
  sac: { inflate: 1.13, thickness: 0.014, lift: [0.1, 2.9, -0.2] },
}

/** Chamber cavities. `blood` drives the colour, `inside` is the wall they hug. */
export const CHAMBERS = [
  {
    id: "ra",
    name: "Right atrium",
    role: "Collects from the venae cavae",
    blood: "deoxy",
    pos: [-0.94, 0.98, 0.02],
    size: [0.78, 0.72, 0.66],
    rot: [0.1, 0, 0.22],
    layer: 3,
    push: [-2.05, 0.5, 0.85],
    auricle: true,
  },
  {
    id: "la",
    name: "Left atrium",
    role: "Receives from the pulmonary veins",
    blood: "oxy",
    pos: [0.44, 1.12, -0.62],
    size: [0.74, 0.64, 0.6],
    rot: [-0.08, 0, -0.16],
    layer: 2,
    push: [1.95, 0.75, -1.5],
    auricle: true,
  },
  {
    id: "rv",
    name: "Right ventricle",
    role: "Pumps to the lungs — thin wall, low pressure",
    blood: "deoxy",
    pos: [-0.58, -0.72, 0.42],
    size: [0.72, 1.5, 0.6],
    rot: [0.06, 0, 0.2],
    taper: 0.62,
    crescent: true,
    layer: 4,
    push: [-1.15, -1.15, 2.15],
  },
  {
    id: "lv",
    name: "Left ventricle",
    role: "Pumps to the body — thick wall, high pressure",
    blood: "oxy",
    pos: [0.4, -1.02, -0.1],
    size: [0.8, 1.66, 0.76],
    rot: [0.04, 0, 0.24],
    taper: 0.68,
    layer: 5,
    push: [1.35, -1.25, -1.15],
  },
  {
    id: "septum",
    name: "Interventricular septum",
    role: "Shared wall; muscle of the left side",
    blood: "myo",
    pos: [-0.08, -0.86, 0.12],
    size: [0.3, 1.44, 0.46],
    rot: [0, 0, 0.24],
    taper: 0.5,
    layer: 4,
    push: [-0.25, -0.4, 1.15],
  },
]

/** Great vessels: variable-radius tubes swept along a Catmull–Rom spine. */
export const VESSELS = [
  {
    id: "aorta",
    name: "Aorta",
    blood: "oxy",
    layer: 2,
    push: [0.35, 3.4, -0.4],
    r0: 0.3,
    r1: 0.21,
    pts: [
      [0.5, 0.62, -0.16],
      [0.6, 1.55, -0.3],
      [0.74, 2.5, -0.55],
      [0.98, 3.1, -0.95],
      [0.86, 2.4, -1.35],
      [0.55, 1.35, -1.45],
      [0.42, 0.1, -1.42],
      [0.44, -1.2, -1.3],
      [0.5, -2.35, -1.22],
    ],
  },
  {
    id: "pa",
    name: "Pulmonary trunk",
    blood: "deoxy",
    layer: 2,
    push: [-0.5, 3.0, 0.9],
    r0: 0.28,
    r1: 0.19,
    pts: [
      [-0.42, 0.72, 0.5],
      [-0.5, 1.6, 0.42],
      [-0.32, 2.45, 0.1],
      [0.02, 3.02, -0.2],
    ],
  },
  {
    id: "lpa",
    name: "Left pulmonary artery",
    blood: "deoxy",
    layer: 2,
    push: [1.4, 3.5, 0.2],
    r0: 0.14,
    r1: 0.11,
    pts: [
      [0.02, 3.02, -0.2],
      [0.6, 3.1, -0.36],
      [1.15, 3.0, -0.6],
    ],
  },
  {
    id: "rpa",
    name: "Right pulmonary artery",
    blood: "deoxy",
    layer: 2,
    push: [-1.5, 3.5, 0.1],
    r0: 0.15,
    r1: 0.12,
    pts: [
      [0.02, 3.02, -0.2],
      [-0.6, 2.98, -0.5],
      [-1.35, 2.85, -0.68],
    ],
  },
  {
    id: "svc",
    name: "Superior vena cava",
    blood: "deoxy",
    layer: 3,
    push: [-1.6, 2.6, 0.5],
    r0: 0.19,
    r1: 0.17,
    pts: [
      [-1.62, 3.5, 0.05],
      [-1.55, 2.6, 0.12],
      [-1.42, 1.85, 0.16],
    ],
  },
  {
    id: "ivc",
    name: "Inferior vena cava",
    blood: "deoxy",
    layer: 3,
    push: [-1.7, -2.4, 0.6],
    r0: 0.2,
    r1: 0.18,
    pts: [
      [-1.5, -2.1, 0.2],
      [-1.45, -1.1, 0.14],
      [-1.3, -0.1, 0.1],
      [-1.18, 0.62, 0.06],
    ],
  },
  {
    id: "pv",
    name: "Pulmonary veins",
    blood: "oxy",
    layer: 3,
    push: [1.9, 1.2, -2.3],
    r0: 0.11,
    r1: 0.1,
    // four stubs, generated as one part so they explode together
    strands: [
      [
        [1.55, 1.5, -1.15],
        [1.05, 1.42, -0.98],
        [0.62, 1.35, -0.86],
      ],
      [
        [1.6, 1.05, -1.05],
        [1.1, 1.05, -0.92],
        [0.66, 1.02, -0.84],
      ],
      [
        [-0.75, 1.55, -1.25],
        [-0.25, 1.5, -1.1],
        [0.1, 1.42, -1.0],
      ],
      [
        [-0.8, 1.1, -1.2],
        [-0.3, 1.12, -1.06],
        [0.06, 1.1, -0.96],
      ],
    ],
  },
  /** the three arch branches — the "why your arm goes numb" detail */
  {
    id: "branches",
    name: "Arch branches",
    blood: "oxy",
    layer: 2,
    push: [0.2, 4.4, -0.3],
    r0: 0.085,
    r1: 0.07,
    strands: [
      [
        [0.8, 3.05, -0.78],
        [0.62, 3.75, -0.72],
        [0.5, 4.3, -0.66],
      ],
      [
        [0.98, 3.12, -1.0],
        [0.95, 3.85, -1.02],
        [0.92, 4.4, -1.04],
      ],
      [
        [0.94, 3.05, -1.22],
        [1.18, 3.7, -1.32],
        [1.3, 4.2, -1.4],
      ],
    ],
  },
]

/**
 * Valves. `cusps` is the count that matters in the exam: tricuspid = 3,
 * bicuspid/mitral = 2, both semilunar valves = 3 pocket-shaped cusps.
 * `plane` is [x, y, z] of the annulus; `axis` tilts it into the flow.
 */
export const VALVES = [
  {
    id: "tricuspid",
    name: "Tricuspid valve",
    role: "Right atrium → right ventricle",
    type: "av",
    cusps: 3,
    pos: [-0.6, 0.34, 0.3],
    r: 0.36,
    rot: [-0.95, 0.35, 0.28],
    layer: 3,
    push: [-2.2, 1.35, 2.4],
  },
  {
    id: "mitral",
    name: "Bicuspid (mitral) valve",
    role: "Left atrium → left ventricle",
    type: "av",
    cusps: 2,
    pos: [0.44, 0.48, -0.34],
    r: 0.31,
    rot: [-1.05, -0.3, -0.22],
    layer: 3,
    push: [2.15, 1.35, -1.9],
  },
  {
    id: "pulmonary",
    name: "Pulmonary valve",
    role: "Right ventricle → pulmonary trunk",
    type: "semilunar",
    cusps: 3,
    pos: [-0.42, 0.78, 0.52],
    r: 0.23,
    rot: [-0.12, 0, 0.1],
    layer: 2,
    push: [-0.9, 2.6, 1.5],
  },
  {
    id: "aortic",
    name: "Aortic valve",
    role: "Left ventricle → aorta",
    type: "semilunar",
    cusps: 3,
    pos: [0.5, 0.72, -0.16],
    r: 0.24,
    rot: [0.06, 0, -0.08],
    layer: 2,
    push: [0.6, 2.55, -0.55],
    note: "The coronary ostia sit just above this valve, in the two anterior sinuses.",
  },
]

/**
 * The electrical tree. Node positions are shared with the DOM overlay, the
 * camera keyframes and the spark particles, so all three point at one place.
 */
export const NODES = {
  sa: { id: "sa", name: "Sinoatrial node", sub: "the pacemaker", pos: [-1.42, 1.62, 0.34], rate: "60–100 bpm" },
  av: { id: "av", name: "Atrioventricular node", sub: "the only bridge", pos: [-0.3, 0.26, 0.16], rate: "40–60 bpm" },
  his: { id: "his", name: "Bundle of His", sub: "septal highway", pos: [-0.16, -0.12, 0.3], rate: "40–60 bpm" },
  pur: { id: "pur", name: "Purkinje fibres", sub: "apex first", pos: [0.5, -1.9, 0.35], rate: "20–40 bpm" },
}

export const WIRE = [
  { id: "internodal", r: 0.038, pts: [NODES.sa.pos, [-1.16, 1.2, 0.34], [-0.78, 0.72, 0.26], NODES.av.pos], lead: true },
  { id: "bachmann", r: 0.03, pts: [NODES.sa.pos, [-0.6, 1.72, 0.1], [0.1, 1.66, -0.3], [0.52, 1.4, -0.5]], lead: false },
  { id: "his", r: 0.042, pts: [NODES.av.pos, [-0.24, 0.02, 0.24], NODES.his.pos], lead: true },
  {
    id: "right",
    r: 0.036,
    pts: [NODES.his.pos, [-0.44, -0.52, 0.42], [-0.66, -1.12, 0.56], [-0.82, -1.66, 0.44]],
    lead: false,
    fan: { count: 7, spread: 0.55, from: [-0.82, -1.66, 0.44], dir: [-0.4, -0.5, 0.5] },
  },
  {
    id: "left",
    r: 0.036,
    pts: [NODES.his.pos, [0.06, -0.56, 0.3], [0.3, -1.1, 0.3], [0.44, -1.6, 0.4]],
    lead: true,
    fan: { count: 9, spread: 0.68, from: [0.44, -1.6, 0.4], dir: [0.5, -0.45, 0.45] },
  },
]

/** Surface arteries. These ride on the front shell half, so they hinge with it. */
export const CORONARIES = [
  {
    id: "lad",
    name: "Left anterior descending",
    r: 0.07,
    pts: [
      [0.06, 0.78, 1.36],
      [-0.1, 0.1, 1.56],
      [-0.02, -0.75, 1.5],
      [0.16, -1.6, 1.24],
      [0.3, -2.1, 0.92],
    ],
    branches: [
      { r: 0.045, pts: [[-0.1, 0.1, 1.56], [-0.72, -0.05, 1.4], [-1.05, -0.3, 1.1]] },
      { r: 0.04, pts: [[-0.02, -0.75, 1.5], [-0.5, -1.0, 1.32]] },
      { r: 0.04, pts: [[0.16, -1.6, 1.24], [0.62, -1.85, 1.05]] },
    ],
  },
  {
    id: "rca",
    name: "Right coronary",
    r: 0.066,
    pts: [
      [0.62, 0.86, 1.1],
      [0.05, 0.66, 1.5],
      [-0.85, 0.6, 1.3],
      [-1.4, 0.3, 0.75],
      [-1.5, -0.2, 0.2],
      [-1.1, -0.6, -0.15],
    ],
    branches: [{ r: 0.04, pts: [[-1.4, 0.3, 0.75], [-1.5, -0.55, 0.9], [-1.2, -1.3, 0.95]] }],
  },
  {
    id: "lcx",
    name: "Left circumflex",
    r: 0.055,
    pts: [
      [0.4, 0.9, 1.15],
      [0.95, 0.72, 0.9],
      [1.35, 0.5, 0.3],
      [1.4, 0.2, -0.45],
    ],
    branches: [],
  },
]

/** Epicardial fat — the reason real hearts are not the colour of a diagram. */
export const FAT = [
  { pos: [-0.4, 0.6, 1.34], size: [1.5, 0.3, 0.5], rot: [0.1, 0.2, 0.12] },
  { pos: [0.9, 0.55, 0.9], size: [0.9, 0.28, 0.55], rot: [0.1, -0.6, -0.2] },
  { pos: [-1.25, 0.3, 0.85], size: [0.6, 0.26, 0.5], rot: [0.2, 0.5, 0.3] },
  { pos: [0.36, -1.95, 0.72], size: [0.42, 0.4, 0.36], rot: [0, 0.3, 0.4] },
]

/**
 * Layer legend, in the order the exploded view reveals them. `stage` is where
 * in the chapter's 0..1 range that layer's labels light up.
 */
export const LAYERS = [
  { order: 0, id: "sac", name: "Pericardium", stage: 0.02, text: "Fibrous sac + fluid. Anchors the heart in the mediastinum; stops over-filling." },
  { order: 1, id: "shell", name: "Epicardium · myocardium · endocardium", stage: 0.2, text: "The three layers of wall. Cut here and you see the thickness difference." },
  { order: 2, id: "vessels", name: "Great vessels", stage: 0.4, text: "Aorta, pulmonary trunk, venae cavae, pulmonary veins — the four circuits." },
  { order: 3, id: "valves", name: "Valves", stage: 0.6, text: "Two AV, two semilunar. They work passively: pressure difference does the opening." },
  { order: 4, id: "chambers", name: "Chambers + septum", stage: 0.78, text: "Right heart to the lungs, left heart to the body, in series, never mixing." },
  { order: 5, id: "wire", name: "Conduction system", stage: 0.94, text: "SA → AV → His → bundle branches → Purkinje. Modified muscle, not nerve." },
]

/** Floating labels. `target` is a part id; position is read from the scene graph. */
export const LABELS = [
  { id: "ra", target: "ra", text: "Right atrium", sub: "deoxy blood arrives", hue: "deoxy", show: [0.24, 0.94], from: 1 },
  { id: "rv", target: "rv", text: "Right ventricle", sub: "thin wall → lungs", hue: "deoxy", show: [0.3, 0.96], from: 1 },
  { id: "la", target: "la", text: "Left atrium", sub: "from pulmonary veins", hue: "oxy", show: [0.36, 0.96], from: 1 },
  { id: "lv", target: "lv", text: "Left ventricle", sub: "wall ≈3× thicker", hue: "oxy", show: [0.42, 0.98], from: 1 },
  { id: "aorta", target: "aorta", text: "Aorta", sub: "to the body", hue: "oxy", show: [0.02, 0.92], from: 0 },
  { id: "pa", target: "pa", text: "Pulmonary trunk", sub: "to the lungs", hue: "deoxy", show: [0.06, 0.92], from: 0 },
  { id: "svc", target: "svc", text: "Vena cava", sub: "from the body", hue: "deoxy", show: [0.1, 0.8], from: 0 },
  { id: "septum", target: "septum", text: "Septum", sub: "no leaks, no mixing", hue: "myo", show: [0.5, 0.94], from: 1 },
  { id: "tricuspid", target: "tricuspid", text: "Tricuspid", sub: "3 cusps", hue: "valve", show: [0.55, 0.92], from: 1 },
  { id: "mitral", target: "mitral", text: "Bicuspid", sub: "2 cusps", hue: "valve", show: [0.58, 0.92], from: 1 },
  { id: "aortic", target: "aortic", text: "Aortic valve", sub: "coronary ostia above", hue: "valve", show: [0.62, 0.9], from: 1 },
  { id: "lad", target: "lad", text: "LAD", sub: "the widow-maker", hue: "oxy", show: [0.0, 0.5], from: 0 },
  { id: "sa", target: "sa", text: "SA node", sub: "pacemaker", hue: "wire", show: [0.0, 0.99], from: 2 },
  { id: "av", target: "av", text: "AV node", sub: "≈0.1 s delay", hue: "wire", show: [0.0, 0.99], from: 2 },
  { id: "his", target: "his", text: "Bundle of His", sub: "only route across", hue: "wire", show: [0.0, 0.99], from: 2 },
  { id: "pur", target: "pur", text: "Purkinje fibres", sub: "apex → base", hue: "wire", show: [0.0, 0.99], from: 2 },
  { id: "sac", target: "sac", text: "Pericardium", sub: "fluid-lined sac", hue: "sac", show: [0.05, 0.45], from: 1 },
]

/* ------------------------------------------------------------------- data */

/**
 * Organ blood flow at rest, as a share of a ≈5.2 L/min cardiac output.
 * Standard physiology teaching figures (Guyton-style); rounded, because the
 * precise split varies with body size and what you had for lunch.
 */
export const FLOW = [
  { id: "liver", name: "Liver & gut", pct: 25, litres: 1.3, note: "Hepatic portal system gets a double blood supply." },
  { id: "kidney", name: "Kidneys", pct: 21, litres: 1.1, note: "≈180 L filtered a day to make 1.5 L of urine." },
  { id: "muscle", name: "Skeletal muscle", pct: 21, litres: 1.1, note: "Can take 80%+ of output during maximal exercise." },
  { id: "brain", name: "Brain", pct: 14, litres: 0.73, note: "2% of body mass, 15% of the flow, 20% of the oxygen." },
  { id: "heart", name: "Heart muscle", pct: 5, litres: 0.26, note: "Via the coronaries you can see on the model." },
  { id: "skin", name: "Skin", pct: 7, litres: 0.36, note: "Mostly thermoregulation; rises hard when you overheat." },
  { id: "other", name: "Rest", pct: 7, litres: 0.36, note: "Lungs, bone, adipose, endocrine glands." },
]

/** Cardiac output response to effort — the second bar set (L/min). */
export const OUTPUT = [
  { id: "rest", name: "At rest", value: 5.2, hr: 72 },
  { id: "walk", name: "Walking", value: 8, hr: 95 },
  { id: "run", name: "Distance run", value: 16, hr: 140 },
  { id: "sprint", name: "Sprint", value: 22, hr: 180 },
  { id: "elite", name: "Elite, trained", value: 35, hr: 170 },
]

/** ECG lead II, normalised: 0..1 across one 0.8 s cycle. */
export const ECG = {
  cycle: 0.8,
  waves: [
    { id: "p", name: "P", at: 0.16, width: 0.055, amp: 0.22, meaning: "Atrial depolarisation — the atria contract." },
    { id: "q", name: "Q", at: 0.28, width: 0.014, amp: -0.1, meaning: "Septal depolarisation, left to right." },
    { id: "r", name: "R", at: 0.315, width: 0.02, amp: 1.0, meaning: "Ventricular depolarisation — the big spike." },
    { id: "s", name: "S", at: 0.35, width: 0.02, amp: -0.28, meaning: "Basal ventricles finishing." },
    { id: "t", name: "T", at: 0.56, width: 0.075, amp: 0.38, meaning: "Ventricular repolarisation — the muscle resetting." },
  ],
  segments: [
    { name: "PR interval", from: 0.16, to: 0.3, text: "0.12–0.20 s. The AV nodal delay lives here." },
    { name: "QT", from: 0.28, to: 0.68, text: "Depolarisation to repolarisation; shortens as rate rises." },
  ],
}

/** Timeline milestones for the 3D mesh, in the deep-dive chapter. */
export const TIMELINE = [
  { year: 150, label: "Galen", text: "Invisible pores in the septum", at: 0.06 },
  { year: 1242, label: "Ibn al-Nafis", text: "Pulmonary circulation", at: 0.3 },
  { year: 1628, label: "Harvey", text: "Blood circulates — by arithmetic", at: 0.5 },
  { year: 1903, label: "Einthoven", text: "The string galvanometer ECG", at: 0.72 },
  { year: 1967, label: "Barnard", text: "First human heart transplant", at: 0.88 },
  { year: 2022, label: "Xenograft", text: "Gene-edited pig heart, 60 days", at: 0.97 },
]

/** Hotspots: the deep dive walks the camera through these in order. */
export const HOTSPOTS = [NODES.sa, NODES.av, NODES.his, NODES.pur].map((n, i) => ({
  ...n,
  key: i,
  detail: [
    "Roughly 20 × 3 mm of spontaneously depolarising cells in the right atrial wall. Its own rate is the fastest in the heart, so it outruns every other pacemaker and the heart obeys it.",
    "Sits in the atrial septum just above the AV valves. The delay here lets the ventricles fill completely before they squeeze; without it, atrial and ventricular systole would overlap and waste the stroke volume.",
    "The impulse has no other way into the ventricles: the fibrous skeleton that anchors the valves is electrically insulating. Clinically, damage here = heart block, and the ventricles escape at their own slower rate.",
    "Conduction velocity up to ~4 m/s — the fastest in the heart — so the whole ventricular mass fires within about 0.1 s and ejects from the apex upward, like squeezing toothpaste from the closed end.",
  ][i],
}))

/** Study aids rendered in the last chapter. */
export const RECAP = [
  "Two pumps in series: right heart → lungs (pulmonary), left heart → body (systemic).",
  "Right atrium → tricuspid → right ventricle → pulmonary valve → lungs → pulmonary veins → left atrium → bicuspid → left ventricle → aortic valve → aorta.",
  "Artery = away from the heart. Vein = towards it. Oxygenation is a separate question.",
  "Systole ≈ 0.3 s, diastole ≈ 0.5 s. The heart spends more of its time filling than pumping.",
  "Myogenic rhythm, autonomic speed: sympathetic (adrenaline) up, vagus (acetylcholine) down.",
  "Cardiac output = stroke volume × heart rate. Both move during exercise; trained hearts mostly move the stroke volume.",
]

export const GLOSSARY = {
  systole: "Contraction phase — ventricles empty into the arteries.",
  diastole: "Relaxation/filling phase — the coronary arteries fill here, which is why a very fast rate can cause ischaemia.",
  "stroke volume": "Blood ejected per beat, ≈70 mL at rest.",
  "cardiac output": "Stroke volume × heart rate, ≈5 L/min at rest.",
  myogenic: "The muscle generates its own rhythm; nerves only modify it.",
  "ecg/eKG": "Surface record of the heart's summed electrical activity — not of the contraction itself.",
  ischaemia: "Inadequate blood supply to a tissue; in the myocardium, felt as angina.",
  infarction: "Death of tissue from blocked supply — a myocardial infarction is a heart attack.",
}
