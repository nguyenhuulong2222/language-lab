import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/controls.css";
import { PracticeApp } from "./ui/PracticeApp";
import { VoiceProvider } from "./ui/voice/VoiceProvider";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found.");

createRoot(container).render(
  <StrictMode>
    <VoiceProvider>
      <PracticeApp />
    </VoiceProvider>
  </StrictMode>
);
