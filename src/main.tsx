import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import { App } from "./ui/App";
import { mockSession } from "./ui/session-fixture";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found.");

createRoot(container).render(
  <StrictMode>
    <App session={mockSession} />
  </StrictMode>
);
