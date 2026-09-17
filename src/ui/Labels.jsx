import { useSyncExternalStore } from "react"
import { labelDefs, onDefsChange, registerLabelEl } from "../three/labels.js"

/**
 * The label layer: one absolutely positioned node per 3D anchor, in a fixed
 * overlay that never intercepts the pointer. Their transforms are written by
 * LabelDriver inside the render loop; React only renders the list, which changes
 * when a component registers new definitions (the chart does that on mount).
 */
export function Labels() {
  const defs = useSyncExternalStore(onDefsChange, labelDefs, labelDefs)
  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden="true">
      {defs.map((d) => (
        <div key={d.id} className="label" style={{ "--label-hue": `var(--color-${d.hue || "oxy"})` }} ref={(el) => registerLabelEl(d.id, el)}>
          <span className="label__dot" />
          <span className="label__body">
            <i className="label__rule" />
            <span className="label__text">
              {d.text}
              {d.sub && <span className="label__sub">{d.sub}</span>}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
