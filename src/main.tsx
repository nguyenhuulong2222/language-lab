import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles/fonts.css";
import "./ui/styles/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/scripts.css";
import "./ui/styles/controls.css";
import { DEFAULT_LANGUAGE, languageInfo, loadLocale } from "./i18n";
import { AppProviders } from "./ui/AppProviders";
import { PracticeApp } from "./ui/PracticeApp";
import { startupLanguage } from "./ui/settings";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found.");
const root = container;

// Start in the phone's language when this build offers it. Its text is loaded first, so the first
// screen is already in that language. If the file does not load or fails its checks: English.
const wanted = startupLanguage();
void loadLocale(wanted)
  .catch(() => false)
  .then((ok) => {
    const language = ok ? wanted : DEFAULT_LANGUAGE;
    const info = languageInfo(language);
    document.documentElement.lang = info.htmlLang;
    document.documentElement.dir = info.dir;
    createRoot(root).render(
      <StrictMode>
        <AppProviders initialLanguage={language}>
          <PracticeApp />
        </AppProviders>
      </StrictMode>
    );
  });
