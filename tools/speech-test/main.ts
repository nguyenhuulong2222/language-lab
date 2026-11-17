/**
 * Language Lab — Speech Recognition Test Tool
 *
 * Standalone page. No imports from src/engine or src/ui.
 * Tests browser Web Speech API with 20 fictional English practice Q&A items.
 *
 * Audio playback preference order:
 *   1. Pre-generated MP3 from tools/speech-test/audio/ (gpt-4o-mini-tts, coral voice)
 *   2. Browser SpeechSynthesis fallback if MP3 fails to load
 *
 * Modes:
 *   practice — question shown, sample answer available before speaking
 *   check    — question shown, sample answer hidden until after speaking
 *
 * Vietnamese button labels are intentional and must not be changed by
 * machine translation. They are fixed UI strings for the target audience.
 *
 * DISCLAIMER: This is a practice tool only. Not affiliated with USCIS or any
 * government agency. Not legal advice.
 */

import { PRACTICE_ITEMS, type PracticeItem } from "./sentences.js";
import { wordAccuracy, overallAccuracy } from "./accuracy.js";
import type { WordAccuracyResult, OverallAccuracyResult } from "./accuracy.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TestMode = "practice" | "check";

type ItemStatus = "pending" | "attempted" | "skipped";

/** Sub-step within a single item's flow. */
type ItemStep =
  | "show-question"      // Question visible; user hasn't heard it yet
  | "show-answer"        // Sample answer visible (practice mode only); ready to speak
  | "speaking"           // Recognition active
  | "result";            // Result shown; user can retry or advance

export interface ItemResult {
  item: PracticeItem;
  status: ItemStatus;
  recognised: string;
  accuracy: WordAccuracyResult | null;
  /** How many times the user pressed "Nói lại" / retry after first attempt. */
  retryCount: number;
  /** Whether the user pressed "Nghe câu hỏi" at least once. */
  questionHeard: boolean;
  /** Whether the user pressed "Nghe câu mẫu" at least once. */
  sampleHeard: boolean;
}

interface AppState {
  phase: "pre-flight" | "mode-select" | "running" | "done";
  mode: TestMode;
  currentIndex: number;
  currentStep: ItemStep;
  results: ItemResult[];
  isSpeaking: boolean;    // TTS active (MP3 or SpeechSynthesis)
  isRecording: boolean;   // STT active
  /** "mp3" when the last audio came from a pre-generated file; "synthesis" for fallback. */
  lastAudioSource: "mp3" | "synthesis" | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Web Speech API globals
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
  }
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  return (window.SpeechRecognition ?? window.webkitSpeechRecognition) ?? null;
}

function hasSpeechSynthesis(): boolean {
  return "speechSynthesis" in window;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function makeResults(items: PracticeItem[]): ItemResult[] {
  return items.map((item) => ({
    item,
    status: "pending",
    recognised: "",
    accuracy: null,
    retryCount: 0,
    questionHeard: false,
    sampleHeard: false,
  }));
}

const state: AppState = {
  phase: "pre-flight",
  mode: "practice",
  currentIndex: 0,
  currentStep: "show-question",
  results: makeResults(PRACTICE_ITEMS),
  isSpeaking: false,
  isRecording: false,
  lastAudioSource: null,
  errorMessage: null,
};

let recognition: SpeechRecognition | null = null;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function qs<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function setVisible(el: HTMLElement, visible: boolean): void {
  el.hidden = !visible;
}

function pct(score: number): string {
  return Math.round(score * 100) + "%";
}

function categoryLabel(cat: PracticeItem["category"]): string {
  return { civics: "Civics", n400: "N-400 Practice", reading: "Reading" }[cat];
}

function scoreIcon(score: number): string {
  if (score >= 0.9) return "✅";
  if (score >= 0.6) return "🟡";
  return "🔴";
}

// ---------------------------------------------------------------------------
// Audio — MP3 (pre-generated) with SpeechSynthesis fallback
// ---------------------------------------------------------------------------

/**
 * Derive the URL for a pre-generated MP3 file.
 * Files live at tools/speech-test/audio/{id}-{slot}.mp3
 * and are served by Vite at /tools/speech-test/audio/{id}-{slot}.mp3.
 */
function audioUrl(itemId: string, slot: "question" | "answer"): string {
  return `/tools/speech-test/audio/${itemId}-${slot}.mp3`;
}

let currentAudioEl: HTMLAudioElement | null = null;

/**
 * Stop any currently playing audio (MP3 or nothing — SpeechSynthesis has its own cancel).
 */
function stopCurrentAudio(): void {
  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl.src = "";
    currentAudioEl = null;
  }
  if (hasSpeechSynthesis()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Play the pre-generated MP3 for the given URL.
 * Returns a promise that resolves when playback ends.
 * Rejects if the file cannot be loaded (404, network error, etc.).
 */
function playMp3(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stopCurrentAudio();
    const audio = new Audio(url);
    currentAudioEl = audio;

    audio.addEventListener("ended", () => {
      currentAudioEl = null;
      resolve();
    });
    audio.addEventListener("error", () => {
      currentAudioEl = null;
      reject(new Error(`Could not load audio: ${url}`));
    });

    audio.play().catch((err: unknown) => {
      currentAudioEl = null;
      reject(err);
    });
  });
}

/**
 * Speak via SpeechSynthesis (en-US, rate 0.8) as a fallback.
 * Must be called from a user gesture handler (required on iOS).
 */
function speakSynthesis(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!hasSpeechSynthesis()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const enUs =
      voices.find((v) => v.lang === "en-US") ??
      voices.find((v) => v.lang.startsWith("en"));
    if (enUs) utterance.voice = enUs;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Play audio for an item slot.
 * Tries MP3 first; falls back to SpeechSynthesis if the file cannot load.
 * Updates state.lastAudioSource and calls onEnd when done.
 * Must be called from a user gesture.
 */
function playAudio(
  itemId: string,
  slot: "question" | "answer",
  text: string,
  onEnd: () => void
): void {
  state.isSpeaking = true;
  state.lastAudioSource = null;
  renderMain();

  const url = audioUrl(itemId, slot);

  playMp3(url)
    .then(() => {
      state.isSpeaking = false;
      state.lastAudioSource = "mp3";
      onEnd();
    })
    .catch(() => {
      // MP3 unavailable — fall back to SpeechSynthesis
      state.lastAudioSource = "synthesis";
      speakSynthesis(text).then(() => {
        state.isSpeaking = false;
        onEnd();
      });
    });
}

// ---------------------------------------------------------------------------
// Speech recognition
// ---------------------------------------------------------------------------

function startRecognition(): void {
  const SpeechCtor = getSpeechRecognitionCtor();
  if (!SpeechCtor) {
    state.errorMessage = "Speech recognition is not available in this browser.";
    renderMain();
    return;
  }
  if (state.isSpeaking) {
    state.errorMessage = "Please wait for audio to finish before speaking.";
    renderMain();
    return;
  }

  state.errorMessage = null;
  state.currentStep = "speaking";

  recognition = new SpeechCtor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    state.isRecording = true;
    renderMain();
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
    const current = state.results[state.currentIndex]!;
    const isRetry = current.status === "attempted";

    current.recognised = transcript;
    current.accuracy = wordAccuracy(current.item.expectedAnswer, transcript);
    current.status = "attempted";
    if (isRetry) current.retryCount += 1;

    state.isRecording = false;
    state.currentStep = "result";
    renderMain();
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    state.isRecording = false;
    state.currentStep =
      state.results[state.currentIndex]!.status === "attempted"
        ? "result"
        : "show-answer";

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.errorMessage =
        "Microphone access was denied. Please allow microphone permission and try again.";
    } else if (event.error === "no-speech") {
      state.errorMessage = "No speech detected. Please try again.";
    } else if (event.error === "network") {
      state.errorMessage =
        "Network error. Speech recognition requires an internet connection in most browsers.";
    } else {
      state.errorMessage = `Speech recognition error: ${event.error}`;
    }
    renderMain();
  };

  recognition.onend = () => {
    if (state.isRecording) {
      state.isRecording = false;
      renderMain();
    }
  };

  try {
    recognition.start();
  } catch (err) {
    state.isRecording = false;
    state.currentStep = "show-answer";
    state.errorMessage =
      err instanceof Error ? err.message : "Could not start speech recognition.";
    renderMain();
  }
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function showOnly(id: string): void {
  for (const screenId of [
    "#pre-flight",
    "#mode-select",
    "#main",
    "#done",
  ]) {
    setVisible(qs<HTMLElement>(screenId), screenId === id);
  }
}

// ---------------------------------------------------------------------------
// renderPreFlight
// ---------------------------------------------------------------------------

function renderPreFlight(): void {
  showOnly("#pre-flight");

  const recognitionOk = getSpeechRecognitionCtor() !== null;

  const badge = qs<HTMLElement>("#support-badge");
  if (recognitionOk) {
    badge.textContent = "✓ Speech recognition available in this browser.";
    badge.className = "badge badge--ok";
  } else {
    badge.textContent =
      "✗ Speech recognition is not available in this browser. " +
      "Use Chrome or Edge on desktop, or Chrome on Android.";
    badge.className = "badge badge--error";
    qs<HTMLButtonElement>("#start-btn").disabled = true;
  }
}

// ---------------------------------------------------------------------------
// renderModeSelect
// ---------------------------------------------------------------------------

function renderModeSelect(): void {
  showOnly("#mode-select");
}

// ---------------------------------------------------------------------------
// renderMain
// ---------------------------------------------------------------------------

function renderMain(): void {
  showOnly("#main");

  const current = state.results[state.currentIndex]!;
  const total = state.results.length;
  const attempted = state.results.filter((r) => r.status === "attempted").length;
  const skipped = state.results.filter((r) => r.status === "skipped").length;

  // Progress
  qs<HTMLElement>("#progress-text").textContent =
    `Item ${state.currentIndex + 1} of ${total} · ${attempted} done · ${skipped} skipped`;
  qs<HTMLElement>("#progress-bar-fill").style.width =
    `${(state.currentIndex / total) * 100}%`;

  // Mode badge
  qs<HTMLElement>("#mode-badge").textContent =
    state.mode === "practice" ? "Practice" : "Check";

  // Category
  qs<HTMLElement>("#category-label").textContent =
    categoryLabel(current.item.category);

  // Question (always visible)
  qs<HTMLElement>("#question-text").textContent = current.item.questionText;

  // "Nghe câu hỏi" button — always enabled unless speaking/recording
  const hearQBtn = qs<HTMLButtonElement>("#hear-question-btn");
  hearQBtn.disabled = state.isSpeaking || state.isRecording;

  // ---- Sample answer section ----
  const sampleSection = qs<HTMLElement>("#sample-section");
  const sampleText = qs<HTMLElement>("#sample-answer-text");
  const hearSampleBtn = qs<HTMLButtonElement>("#hear-sample-btn");

  const inCheckBeforeResult =
    state.mode === "check" && state.currentStep !== "result";

  if (inCheckBeforeResult) {
    // Check mode, not yet spoken: hide answer text, show placeholder
    sampleText.textContent = "— hidden until after you speak —";
    sampleText.className = "sample-answer-text sample-answer-text--hidden";
    hearSampleBtn.disabled = true;
    setVisible(sampleSection, true);
  } else {
    // Practice mode, or check mode after result: show the answer
    sampleText.textContent = current.item.expectedAnswer;
    sampleText.className = "sample-answer-text";
    hearSampleBtn.disabled = state.isSpeaking || state.isRecording;
    setVisible(sampleSection, true);
  }

  // ---- Audio source notice ----
  const audioNoticeEl = qs<HTMLElement>("#audio-source-notice");
  if (state.lastAudioSource === "mp3") {
    audioNoticeEl.textContent = "Giọng đọc do AI tạo / AI-generated voice";
    audioNoticeEl.className = "audio-notice audio-notice--ai";
    setVisible(audioNoticeEl, true);
  } else if (state.lastAudioSource === "synthesis") {
    audioNoticeEl.textContent =
      "⚠ MP3 file not found — using browser voice as fallback";
    audioNoticeEl.className = "audio-notice audio-notice--fallback";
    setVisible(audioNoticeEl, true);
  } else {
    setVisible(audioNoticeEl, false);
  }

  // ---- Speak button ----
  const speakBtn = qs<HTMLButtonElement>("#speak-btn");
  const isBusy = state.isSpeaking || state.isRecording;

  if (state.isRecording) {
    speakBtn.textContent = "🔴 Đang nghe… / Listening…";
    speakBtn.setAttribute("aria-pressed", "true");
    speakBtn.disabled = true;
  } else if (state.isSpeaking) {
    speakBtn.textContent = "🔊 Đang phát… / Playing…";
    speakBtn.setAttribute("aria-pressed", "false");
    speakBtn.disabled = true;
  } else {
    speakBtn.textContent = "🎤 Bắt đầu nói / Start speaking";
    speakBtn.setAttribute("aria-pressed", "false");
    speakBtn.disabled = false;
  }

  // ---- Result section ----
  const resultSection = qs<HTMLElement>("#result-section");
  const recOutput = qs<HTMLElement>("#recognised-output");
  const accOutput = qs<HTMLElement>("#sentence-accuracy");

  if (state.currentStep === "result" && current.accuracy) {
    recOutput.textContent = current.recognised
      ? `"${current.recognised}"`
      : "(nothing recognised)";
    const a = current.accuracy;
    accOutput.textContent =
      `${pct(a.score)} · ${a.matchedWords.length} of ${a.expectedCount} words matched`;
    setVisible(resultSection, true);
  } else {
    setVisible(resultSection, false);
  }

  // ---- Retry / skip / next ----
  const replayBtn = qs<HTMLButtonElement>("#replay-btn");
  const skipBtn = qs<HTMLButtonElement>("#skip-btn");
  const nextBtn = qs<HTMLButtonElement>("#next-btn");

  replayBtn.disabled = isBusy || state.currentStep !== "result";
  skipBtn.disabled = isBusy;
  nextBtn.disabled = isBusy || current.status === "pending";

  // ---- Error ----
  const errEl = qs<HTMLElement>("#error-message");
  if (state.errorMessage) {
    errEl.textContent = state.errorMessage;
    setVisible(errEl, true);
  } else {
    setVisible(errEl, false);
  }

  // ---- History ----
  renderHistory();
}

function renderHistory(): void {
  const historyEl = qs<HTMLElement>("#history-list");
  const completed = state.results.filter(
    (r, i) => i < state.currentIndex && r.status !== "pending"
  );

  if (completed.length === 0) {
    historyEl.innerHTML =
      "<li class='history-empty'>No completed items yet.</li>";
    return;
  }

  historyEl.innerHTML = completed
    .map((r) => {
      const icon =
        r.status === "skipped"
          ? "⏭"
          : r.accuracy
          ? scoreIcon(r.accuracy.score)
          : "—";
      const acc = r.accuracy ? ` · ${pct(r.accuracy.score)}` : "";
      return `<li class="history-item history-item--${r.status}">
        <span class="history-icon">${icon}</span>
        <span class="history-text">${r.item.questionText}</span>
        ${r.status !== "skipped" ? `<span class="history-acc">${acc}</span>` : ""}
      </li>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// renderDone
// ---------------------------------------------------------------------------

function renderDone(overall: OverallAccuracyResult): void {
  showOnly("#done");

  qs<HTMLElement>("#overall-score").textContent = pct(overall.overallScore);
  qs<HTMLElement>("#overall-detail").textContent =
    `${overall.totalMatched} of ${overall.totalExpected} words matched across attempted items`;

  const breakdown = qs<HTMLElement>("#results-breakdown");
  breakdown.innerHTML = state.results
    .map((r) => {
      const icon =
        r.status === "skipped" ? "⏭" : scoreIcon(r.accuracy?.score ?? 0);
      const accText =
        r.status === "skipped"
          ? "skipped"
          : r.accuracy
          ? pct(r.accuracy.score)
          : "—";
      const recText = r.recognised ? `"${r.recognised}"` : "(no attempt)";
      return `<li class="result-item result-item--${r.status}">
        <span class="result-icon">${icon}</span>
        <div class="result-body">
          <div class="result-question">${r.item.questionText}</div>
          <div class="result-expected">${r.item.expectedAnswer}</div>
          <div class="result-recognised">${recText}</div>
        </div>
        <span class="result-acc">${accText}</span>
      </li>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Build the export payload.
 * Exported as a pure function so it can be unit-tested without DOM.
 */
export function buildExportPayload(
  results: ItemResult[],
  mode: TestMode
): object {
  const attempted = results.filter((r) => r.status === "attempted");
  const overall = overallAccuracy(
    attempted.map((r) => ({
      expected: r.item.expectedAnswer,
      recognised: r.recognised,
    }))
  );

  return {
    _note: "Language Lab speech test results — device-local only. No personal data.",
    exportedAt: new Date().toISOString(),
    mode,
    overall,
    items: results.map((r) => ({
      id: r.item.id,
      category: r.item.category,
      questionText: r.item.questionText,
      expectedAnswer: r.item.expectedAnswer,
      status: r.status,
      recognised: r.recognised,
      accuracyScore: r.accuracy?.score ?? null,
      matchedWords: r.accuracy?.matchedWords ?? [],
      // Required new fields
      mode,
      questionHeard: r.questionHeard,
      sampleHeard: r.sampleHeard,
      retryCount: r.retryCount,
    })),
  };
}

function handleExport(): void {
  const payload = buildExportPayload(state.results, state.mode);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `speech-test-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handleStart(): void {
  state.phase = "mode-select";
  renderModeSelect();
}

function handleSelectMode(mode: TestMode): void {
  state.mode = mode;
  state.phase = "running";
  state.currentIndex = 0;
  state.currentStep = "show-question";
  state.results = makeResults(PRACTICE_ITEMS);
  renderMain();
}

function handleHearQuestion(): void {
  const current = state.results[state.currentIndex]!;
  current.questionHeard = true;
  playAudio(current.item.id, "question", current.item.questionText, () => {
    renderMain();
  });
  renderMain(); // update button disabled state immediately
}

function handleHearSample(): void {
  const current = state.results[state.currentIndex]!;
  current.sampleHeard = true;
  // Advance to show-answer step if not yet there
  if (state.currentStep === "show-question") {
    state.currentStep = "show-answer";
  }
  playAudio(current.item.id, "answer", current.item.expectedAnswer, () => {
    renderMain();
  });
  renderMain();
}

function handleSpeak(): void {
  // Guard: don't start while TTS is running
  if (state.isSpeaking) return;
  // Advance step so sample answer becomes visible on result (check mode)
  state.currentStep = "speaking";
  startRecognition();
}

function handleReplay(): void {
  // "Nói lại" — reset this item's result, keep retryCount tracked inside recognition handler
  const current = state.results[state.currentIndex]!;
  current.recognised = "";
  current.accuracy = null;
  // Keep status as "attempted" so retryCount increments on next result
  state.currentStep = "show-answer";
  state.errorMessage = null;
  renderMain();
}

function handleSkip(): void {
  state.results[state.currentIndex]!.status = "skipped";
  state.errorMessage = null;
  advanceOrFinish();
}

function handleNext(): void {
  advanceOrFinish();
}

function advanceOrFinish(): void {
  if (state.currentIndex < state.results.length - 1) {
    state.currentIndex += 1;
    state.currentStep = "show-question";
    state.errorMessage = null;
    state.lastAudioSource = null;
    renderMain();
  } else {
    state.phase = "done";
    const overall = overallAccuracy(
      state.results
        .filter((r) => r.status === "attempted")
        .map((r) => ({
          expected: r.item.expectedAnswer,
          recognised: r.recognised,
        }))
    );
    renderDone(overall);
  }
}

function handleRestart(): void {
  state.phase = "pre-flight";
  state.currentIndex = 0;
  state.currentStep = "show-question";
  state.isRecording = false;
  state.isSpeaking = false;
  state.lastAudioSource = null;
  state.errorMessage = null;
  state.results = makeResults(PRACTICE_ITEMS);
  stopCurrentAudio();
  renderPreFlight();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  qs<HTMLButtonElement>("#start-btn").addEventListener("click", handleStart);

  qs<HTMLButtonElement>("#mode-practice-btn").addEventListener("click", () =>
    handleSelectMode("practice")
  );
  qs<HTMLButtonElement>("#mode-check-btn").addEventListener("click", () =>
    handleSelectMode("check")
  );

  qs<HTMLButtonElement>("#hear-question-btn").addEventListener(
    "click",
    handleHearQuestion
  );
  qs<HTMLButtonElement>("#hear-sample-btn").addEventListener(
    "click",
    handleHearSample
  );
  qs<HTMLButtonElement>("#speak-btn").addEventListener("click", handleSpeak);
  qs<HTMLButtonElement>("#replay-btn").addEventListener("click", handleReplay);
  qs<HTMLButtonElement>("#skip-btn").addEventListener("click", handleSkip);
  qs<HTMLButtonElement>("#next-btn").addEventListener("click", handleNext);
  qs<HTMLButtonElement>("#export-btn").addEventListener("click", handleExport);
  qs<HTMLButtonElement>("#restart-btn").addEventListener(
    "click",
    handleRestart
  );

  renderPreFlight();
}

// Guard: only register DOM listeners when running in a browser.
// This allows the module to be imported in Node (Vitest) without errors.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", bootstrap);
}
