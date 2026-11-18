import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/scripts.css";
import "./ui/styles/controls.css";
import { AppProviders } from "./ui/AppProviders";
import { PracticeApp } from "./ui/PracticeApp";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found.");

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <PracticeApp />
    </AppProviders>
  </StrictMode>
);
