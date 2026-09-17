import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.jsx"
import "./styles.css"

/**
 * One mount, in StrictMode. The scene is written to survive the double-invoked
 * effects deliberately (geometry/materials are disposed and re-created, the
 * frame loop resubscribes), because that is exactly the path a hot reload takes.
 */
const el = document.getElementById("root")
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
