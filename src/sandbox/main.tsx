import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import SandboxApp from "./sandboxApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SandboxApp />
  </StrictMode>,
);
