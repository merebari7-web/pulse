import { at } from "../lib/track.js"
import { RECAP } from "./anatomy.js"

/**
 * journey.js — the entire scroll narrative in one editable table.
 *
 * `CHAPTERS` drives the DOM overlay *and* the page height (weights × 100svh).
 * `TRACKS` drives the scene. They share chapter indices, so moving a chapter's
 * weight automatically moves every animation authored against it.
 * `CAMERA_KEYS` are the camera's keyframes on the same chapter clock.
 */

export const CHAPTERS = [
  {
    id: "hero",
    index: "01",
    eyebrow: "The human heart · an interactive field guide",
    weight: 1.15,
    panel: "right",
    title: "Two pumps,\nfolded into one.",
    lede:
      "The heart is not one pump but two, sitting side by side and fired by the same wire. The right half pushes used blood to the lungs; the left half pushes fresh blood to everything else. Scroll to fly in — the model is live, and every part of it is named.",
    stats: [
      { value: "≈100 000", label: "beats a day" },
      { value: "7 570 L", label: "of blood moved a day" },
      { value: "250–350 g", label: "about the size of your fist" },
      { value: "0.8 s", label: "one full cardiac cycle" },
    ],
    hint: "Fly-in target: the anterior interventricular sulcus, where the left coronary artery runs.",
  },
  {
    id: "layers",
    index: "02",
    eyebrow: "Exploded view · structure",
    weight: 1.7,
    panel: "left",
    /** the peel-order chips, driven by the same LAYERS table the rig staggers on */
    legend: true,
    title: "Peel it open.",
    lede:
      "The wall is three layers thick. The shell hinges open on a cut plane instead of vanishing, because the way a structure is held together is the thing worth remembering.",
    list: [
      {
        term: "Pericardium",
        text: "A double-walled sac with a film of fluid in it. It stops the heart rubbing against the chest wall and stops it over-filling.",
      },
      {
        term: "Epicardium + coronary vessels",
        text: "The outer skin. The coronary arteries lie in it — which is why a clot here starves the muscle itself, not a chamber.",
      },
      {
        term: "Myocardium",
        text: "Cardiac muscle. The left ventricular wall is roughly three times thicker than the right: body-wide circuit versus lungs only.",
      },
      {
        term: "Endocardium, chambers, valves",
        text: "Smooth inner lining, four chambers, four valves. AV valves shut at the start of systole (S1); semilunar valves shut at the end (S2).",
      },
    ],
    hint: "Every layer moves on its own vector — the labels are projected from the 3D scene, not positioned by hand.",
  },
  {
    id: "spark",
    index: "03",
    eyebrow: "Deep dive · the conduction system",
    weight: 1.5,
    panel: "right",
    title: "It beats\nby itself.",
    lede:
      "Nothing outside the heart tells it to contract. A patch of cells in the right atrial wall leaks charge until it fires; the signal sweeps the atria, queues briefly at the atrioventricular node, then drops into the ventricles and fans out so the whole chamber squeezes as one instead of wrinkling.",
    path: [
      {
        term: "Sinoatrial node",
        sub: "right atrium, near the vena cava entrance",
        text: "The pacemaker. Fires 60–100 times a minute on its own, on a trickle of sodium that never quite stops.",
      },
      {
        term: "Atrioventricular node",
        sub: "floor of the right atrium, at the septum",
        text: "Delays the impulse ≈0.1 s. That pause is not a fault: it is the time the atria need to finish emptying before the ventricles start.",
      },
      {
        term: "Bundle of His → bundle branches",
        sub: "down the interventricular septum",
        text: "The only electrical bridge between atria and ventricles — the fibrous skeleton insulates everything else.",
      },
      {
        term: "Purkinje fibres",
        sub: "endocardium of both ventricles",
        text: "Fastest conduction in the heart. They deliver the signal apex-first, so blood is milked upward toward the great vessels.",
      },
    ],
    history: [
      { year: "c. 1550 BCE", text: "The Ebers Papyrus lists vessels from the heart to nearly every limb — the first written map of the plumbing." },
      { year: "c. 300 BCE", text: "Erasistratus distinguishes arteries from veins and describes heart valves stopping backflow." },
      { year: "c. 150 CE", text: "Galen claims blood seeps through invisible pores in the septum. It is believed for 1 400 years." },
      { year: "1242", text: "Ibn al-Nafis in Damascus publishes the pulmonary circulation, refuting Galen's pores 300 years early." },
      { year: "1628", text: "William Harvey does the arithmetic — stroke volume × rate exceeds the body's whole blood mass within the hour — so blood must circulate." },
      { year: "1887 / 1903", text: "Waller records the first human ECG; Einthoven's string galvanometer makes it clinical (Nobel, 1924)." },
      { year: "1967", text: "Christiaan Barnard transplants a human heart in Cape Town. Open-heart surgery is only 14 years old." },
      { year: "2022–23", text: "Gene-edited pig hearts run in two patients at Baltimore for 47 and 40 days — the first cardiac xenografts in living people." },
    ],
    hint: "Click a glowing node to isolate it. The pulse you see travelling is the wavefront, not a decoration.",
  },
  {
    id: "data",
    index: "04",
    eyebrow: "Data · haemodynamics",
    weight: 1.5,
    panel: "left",
    title: "Five litres,\ndivided.",
    lede:
      "A resting heart moves about 5 L a minute — roughly 70 mL per beat at 72 beats a minute. Here is where that 5 L goes, and what running does to it. The bars are the numbers; the ribbon under them is one beat, drawn to scale.",
    chartTitle: "Share of cardiac output at rest",
    chartUnit: "% of ≈5.2 L/min",
    callouts: [
      { value: "×4–5", label: "cardiac output during hard exercise (5 → 20–25 L/min)" },
      { value: "55%", label: "ejection fraction — the fraction of EDV actually pumped out" },
      { value: "5%", label: "goes to the heart muscle itself, through the coronaries" },
      { value: "9.0 M", label: "deaths a year from ischaemic heart disease — the world's leading killer (WHO, 2021)" },
    ],
    hint: "Bars grow in sequence off scroll position, not off a timed animation.",
  },
  {
    id: "exam",
    index: "05",
    eyebrow: "Exam focus · WAEC · NECO · JAMB",
    weight: 1.0,
    panel: "center",
    title: "What the examiners ask.",
    lede:
      "This maps to NERDC Biology SS3 — circulation — and it recurs every season in one form or another. The six questions below cover most of the marks; the two traps cover most of the losses.",
    questions: [
      { q: "Why is the wall of the left ventricle thicker than the right?", a: "It pumps oxygenated blood to the whole body — a long circuit needing high pressure. The right ventricle only pumps to the lungs, a short low-resistance circuit." },
      { q: "Name the artery that carries deoxygenated blood.", a: "The pulmonary artery. Also accept: the umbilical artery in the fetus." },
      { q: "Trace the blood through the heart, naming each valve in order.", a: "Vena cava → right atrium → tricuspid valve → right ventricle → pulmonary valve → lungs → pulmonary vein → left atrium → bicuspid/mitral valve → left ventricle → aortic valve → aorta." },
      { q: "What is the pacemaker, and where is it?", a: "The sinoatrial (SA) node, in the wall of the right atrium near the opening of the vena cava. It sets the rate at 60–100 bpm." },
      { q: "Why does a blocked coronary artery cause a heart attack?", a: "The myocardium feeds from the coronary arteries, not from the blood inside its own chambers. No oxygen → the muscle cells die and are replaced by non-contractile scar." },
      { q: "How are valves adapted to their function?", a: "Thin cusps with a tough fibrous core, pocket-shaped so backflow fills and closes them; attached to chordae tendineae and papillary muscles so AV valves cannot invert under pressure." },
    ],
    recap: RECAP,
    traps: [
      { trap: "“Arteries carry oxygenated blood.”", fix: "Definition of an artery is the vessel that leaves the heart — direction, not colour. The pulmonary artery carries deoxygenated blood." },
      { trap: "“The heart beats because the brain tells it to.”", fix: "It is myogenic. The autonomic nerves only change the rate (sympathetic up, vagus down); the beat starts in the SA node." },
    ],
  },
]

/**
 * Scene state per chapter. Values are damped twice before they reach a
 * material, so even a violent flick of the wheel resolves smoothly.
 */
export const TRACKS = {
  /** how far the shell halves have swung open, and the layers separated */
  open: [at(1, 0.05, 0), at(1, 0.55, 1), at(2, 0.0, 1), at(2, 0.5, 0.4), at(3, 0.1, 0.34), at(4, 0.3, 0.78), at(4, 1, 0.95)],
  /** cut plane sweeping through the front of the myocardium */
  cut: [at(1, 0.1, 0), at(1, 0.7, 0.68), at(2, 0.2, 0.6), at(3, 0.5, 0.5), at(4, 0.5, 0.72)],
  /** pericardial sac visibility */
  sac: [at(0, 0, 0.42), at(1, 0.5, 1), at(2, 0.18, 0), at(4, 0.6, 0.22)],
  /** how much everything except the focus part is dimmed */
  dim: [at(1, 0.85, 0), at(2, 0.22, 1), at(2, 0.86, 1), at(3, 0.06, 0.2), at(4, 0.4, 0.55)],
  /** conduction system emphasis (opacity + glow of the wire) */
  isolate: [at(1, 0.8, 0), at(2, 0.18, 1), at(2, 0.88, 1), at(3, 0.3, 0.6), at(4, 1, 0.2)],
  /** which hotspot the camera isolates: 0..3 → SA, AV, His, Purkinje */
  focus: { at: [at(2, 0.06, 0), at(2, 0.3, 1), at(2, 0.58, 2), at(2, 0.84, 3), at(3, 0.25, 3)], ease: "snap" },
  /** heart shrinks and slides aside for the data chapter */
  shrink: [at(3, 0.02, 0), at(3, 0.34, 1), at(4, 0.62, 1), at(4, 0.98, 0.3)],
  /** 3D bar chart growth */
  chart: [at(3, 0.06, 0), at(3, 0.58, 1), at(4, 0.55, 1), at(4, 0.92, 0)],
  /** ECG ribbon reveal + sweep */
  ribbon: [at(3, 0.26, 0), at(3, 0.82, 1), at(4, 0.7, 1), at(4, 1, 0)],
  /** timeline mesh glow (deep dive) */
  trail: [at(2, 0.0, 0.25), at(2, 0.5, 1), at(3, 0.2, 0.45), at(4, 1, 0.6)],
  /** idle orbit speed multiplier — slows when we want the model to hold still */
  orbit: [at(1, 0.0, 0.8), at(1, 0.5, 0.32), at(2, 0.2, 0.55), at(2, 0.9, 0.2), at(3, 0.4, 0.5), at(4, 0.2, 0.8)],
  /** particle field density/opacity */
  dust: [at(0, 0.1, 0.45), at(1, 0.5, 1), at(2, 0.5, 0.72), at(3, 0.5, 0.9), at(4, 0.5, 1)],
  /** bloom strength, per chapter */
  bloom: [at(0, 0, 0.5), at(1, 0.55, 0.8), at(2, 0.3, 1.15), at(3, 0.45, 0.78), at(4, 0.15, 0.9)],
}

/**
 * Camera keyframes. `pos`/`look` are world-space; FOV widens for the wide
 * "epic" setups and closes for the deep dive. `roll` adds the cinematic tilt.
 */
export const CAMERA_KEYS = [
  { at: at(0, 0.0), pos: [1.6, 3.4, 17.5], look: [0, 0.2, 0], fov: 26, roll: 0.035 },
  { at: at(0, 0.62), pos: [0.55, 0.1, 8.2], look: [0.05, -0.1, 0.9], fov: 30, roll: -0.02 },
  { at: at(1, 0.06), pos: [-2.4, 2.6, 11.4], look: [0, 0.3, 0.1], fov: 32, roll: 0.02 },
  { at: at(1, 0.5), pos: [-7.6, 1.1, 6.6], look: [-0.5, 0, 0.3], fov: 34, roll: -0.045 },
  { at: at(1, 0.94), pos: [-4.2, -1.6, 7.4], look: [-0.2, -0.2, 0.2], fov: 33, roll: 0.03 },
  { at: at(2, 0.22), pos: [3.1, 2.1, 4.4], look: [1.15, 1.05, 0.45], fov: 27, roll: -0.05 },
  { at: at(2, 0.66), pos: [1.55, -0.05, 3.9], look: [0.1, -0.5, 0.5], fov: 25, roll: 0.02 },
  { at: at(3, 0.24), pos: [0.9, 2.2, 12.4], look: [-1.6, 0.5, 0], fov: 38, roll: 0.015 },
  { at: at(3, 0.78), pos: [1.7, 1.3, 9.6], look: [0.3, 0.9, 0], fov: 34, roll: -0.02 },
  { at: at(4, 0.4), pos: [-0.4, 3.2, 14.5], look: [0, 0.5, 0], fov: 30, roll: 0.05 },
  { at: at(4, 1.0), pos: [0.3, 4.4, 19.5], look: [0, 0.8, 0], fov: 26, roll: 0.0 },
]
