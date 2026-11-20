/**
 * Vitest setup (vite.config.ts, test.setupFiles). The app fetches each locale, each answer key and
 * the official answer text only when they are needed; the tests render any language and call the
 * engine synchronously, so everything is loaded before each test file.
 */
import { preloadAllLocales } from "./i18n";
import { preloadAnswerKey } from "./engine/civics-answer-key";
import { preloadOfficialAnswerText } from "./engine/official-answer-text";
await Promise.all([
  preloadAllLocales(),
  preloadAnswerKey("2008"),
  preloadAnswerKey("2025"),
  preloadOfficialAnswerText("2008"),
  preloadOfficialAnswerText("2025"),
]);
