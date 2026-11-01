import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main>
      <h1>Language Lab</h1>
      <p>
        Free, voice-first practice for the U.S. naturalization interview.
      </p>
      <p>
        <small>
          Independent practice tool. Not affiliated with USCIS or any
          government agency. Not legal advice.
        </small>
      </p>
    </main>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
