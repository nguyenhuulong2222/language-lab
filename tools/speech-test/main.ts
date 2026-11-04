/**
 * Language Lab — Speech Recognition Test Tool
 *
 * Standalone page. No imports from src/engine or src/ui.
 * Tests browser Web Speech API with 20 fictional English practice sentences.
 *
 * DISCLAIMER: This is a practice tool only. Not affiliated with USCIS or any
 * government agency. Not legal advice.
 */

import { PRACTICE_SENTENCES, type PracticeSentence } from "./sentences.js";
import { wordAccuracy, overallAccuracy } from "./accuracy.js";
import type { WordAccuracyResult, OverallAccuracyResult } from "./accuracy.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SentenceStatus = "pending" | "attempted" | "skipped";

interface SentenceResult {
  sentence: PracticeSentence;
  status: SentenceStatus;
  recognised: string;
  accuracy: WordAccuracyResult | null;
  attempts: number;
}

interface AppState {
  phase: "pre-flight" | "running" | "done";
  currentIndex: number;
  results: SentenceResult[];
  isRecording: boolean;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Web Speech API — type narrowing
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition | undefined;
    webkitSpeechRecognition: typeof SpeechRecognition | undefined;
  }
}

function getSpeechRecognitionConstructor():
  | (new () => SpeechRecognition)
  | null {
  return (
    (window.SpeechRecognition ?? window.webkitSpeechRecognition) || null
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state: AppState = {
  phase: "pre-flight",
  currentIndex: 0,
  results: PRACTICE_SENTENCES.map((s) => ({
    sentence: s,
    status: "pending",
    recognised: "",
    accuracy: null,
    attempts: 0,
  })),
  isRecording: false,
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

function categoryLabel(cat: PracticeSentence["category"]): string {
  return { civics: "Civics", n400: "N-400 Practice", reading: "Reading" }[cat];
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderPreFlight(): void {
  const SpeechCtor = getSpeechRecognitionConstructor();
  const supported = SpeechCtor !== null;

  const preFlightEl = qs<HTMLElement>("#pre-flight");
  const mainEl = qs<HTMLElement>("#main");
  const doneEl = qs<HTMLElement>("#done");

  setVisible(preFlightEl, true);
  setVisible(mainEl, false);
  setVisible(doneEl, false);

  const supportBadge = qs<HTMLElement>("#support-badge");
  if (supported) {
    supportBadge.textContent = "✓ Speech recognition is available in this browser.";
    supportBadge.className = "badge badge--ok";
  } else {
    supportBadge.textContent =
      "✗ Speech recognition is not available in this browser. " +
      "Use Chrome or Edge on desktop, or Chrome on Android.";
    supportBadge.className = "badge badge--error";
    qs<HTMLButtonElement>("#start-btn").disabled = true;
  }
}

function renderMain(): void {
  const preFlightEl = qs<HTMLElement>("#pre-flight");
  const mainEl = qs<HTMLElement>("#main");
  const doneEl = qs<HTMLElement>("#done");

  setVisible(preFlightEl, false);
  setVisible(mainEl, true);
  setVisible(doneEl, false);

  const current = state.results[state.currentIndex]!;
  const total = state.results.length;
  const attempted = state.results.filter(
    (r) => r.status === "attempted"
  ).length;
  const skipped = state.results.filter((r) => r.status === "skipped").length;

  // Progress
  qs<HTMLElement>("#progress-text").textContent =
    `Sentence ${state.currentIndex + 1} of ${total} · ${attempted} done · ${skipped} skipped`;
  const bar = qs<HTMLElement>("#progress-bar-fill");
  bar.style.width = `${((state.currentIndex) / total) * 100}%`;

  // Sentence card
  qs<HTMLElement>("#category-label").textContent = categoryLabel(
    current.sentence.category
  );
  qs<HTMLElement>("#expected-text").textContent = current.sentence.text;

  // Attempts
  qs<HTMLElement>("#attempt-count").textContent =
    current.attempts > 0
      ? `Attempt ${current.attempts + 1}`
      : "First attempt";

  // Recognised output
  const recEl = qs<HTMLElement>("#recognised-output");
  const recWrap = qs<HTMLElement>("#recognised-wrap");
  if (current.recognised) {
    recEl.textContent = `"${current.recognised}"`;
    setVisible(recWrap, true);
  } else {
    setVisible(recWrap, false);
  }

  // Per-sentence accuracy
  const accEl = qs<HTMLElement>("#sentence-accuracy");
  const accWrap = qs<HTMLElement>("#accuracy-wrap");
  if (current.accuracy) {
    const a = current.accuracy;
    accEl.textContent =
      `${pct(a.score)} · ${a.matchedWords.length} of ${a.expectedCount} words matched`;
    setVisible(accWrap, true);
  } else {
    setVisible(accWrap, false);
  }

  // Error
  const errEl = qs<HTMLElement>("#error-message");
  if (state.errorMessage) {
    errEl.textContent = state.errorMessage;
    setVisible(errEl, true);
  } else {
    setVisible(errEl, false);
  }

  // Buttons
  const recordBtn = qs<HTMLButtonElement>("#record-btn");
  const retryBtn = qs<HTMLButtonElement>("#retry-btn");
  const skipBtn = qs<HTMLButtonElement>("#skip-btn");
  const nextBtn = qs<HTMLButtonElement>("#next-btn");

  recordBtn.disabled = state.isRecording;
  recordBtn.textContent = state.isRecording ? "🔴 Listening…" : "🎤 Speak";
  recordBtn.setAttribute("aria-pressed", String(state.isRecording));

  retryBtn.disabled = state.isRecording || current.attempts === 0;
  skipBtn.disabled = state.isRecording;
  nextBtn.disabled =
    state.isRecording || current.status === "pending";

  // Show/hide results history
  renderHistory();
}

function renderHistory(): void {
  const historyEl = qs<HTMLElement>("#history-list");
  const completed = state.results.filter(
    (r, i) => i < state.currentIndex && r.status !== "pending"
  );

  if (completed.length === 0) {
    historyEl.innerHTML = "<li class='history-empty'>No completed sentences yet.</li>";
    return;
  }

  historyEl.innerHTML = completed
    .map((r) => {
      const icon = r.status === "skipped" ? "⏭" : r.accuracy ? scoreIcon(r.accuracy.score) : "—";
      const acc = r.accuracy ? ` · ${pct(r.accuracy.score)}` : "";
      return `<li class="history-item history-item--${r.status}">
        <span class="history-icon">${icon}</span>
        <span class="history-text">${r.sentence.text}</span>
        ${r.status !== "skipped" ? `<span class="history-acc">${acc}</span>` : ""}
      </li>`;
    })
    .join("");
}

function renderDone(overall: OverallAccuracyResult): void {
  const preFlightEl = qs<HTMLElement>("#pre-flight");
  const mainEl = qs<HTMLElement>("#main");
  const doneEl = qs<HTMLElement>("#done");

  setVisible(preFlightEl, false);
  setVisible(mainEl, false);
  setVisible(doneEl, true);

  qs<HTMLElement>("#overall-score").textContent = pct(overall.overallScore);
  qs<HTMLElement>("#overall-detail").textContent =
    `${overall.totalMatched} of ${overall.totalExpected} words matched across attempted sentences`;

  const breakdown = qs<HTMLElement>("#results-breakdown");
  breakdown.innerHTML = state.results
    .map((r) => {
      const icon = r.status === "skipped" ? "⏭" : scoreIcon(r.accuracy?.score ?? 0);
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
          <div class="result-expected">${r.sentence.text}</div>
          <div class="result-recognised">${recText}</div>
        </div>
        <span class="result-acc">${accText}</span>
      </li>`;
    })
    .join("");
}

function scoreIcon(score: number): string {
  if (score >= 0.9) return "✅";
  if (score >= 0.6) return "🟡";
  return "🔴";
}

// ---------------------------------------------------------------------------
// Speech recognition
// ---------------------------------------------------------------------------

function startRecognition(): void {
  const SpeechCtor = getSpeechRecognitionConstructor();
  if (!SpeechCtor) {
    state.errorMessage =
      "Speech recognition is not available in this browser.";
    renderMain();
    return;
  }

  state.errorMessage = null;

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
    const transcript =
      event.results[0]?.[0]?.transcript?.trim() ?? "";
    const current = state.results[state.currentIndex]!;

    current.recognised = transcript;
    current.accuracy = wordAccuracy(current.sentence.text, transcript);
    current.status = "attempted";
    current.attempts += 1;

    state.isRecording = false;
    renderMain();
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    state.isRecording = false;

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
    state.isRecording = false;
    renderMain();
  };

  try {
    recognition.start();
  } catch (err) {
    state.isRecording = false;
    state.errorMessage =
      err instanceof Error ? err.message : "Could not start speech recognition.";
    renderMain();
  }
}

function stopRecognition(): void {
  recognition?.stop();
  state.isRecording = false;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function handleStart(): void {
  state.phase = "running";
  renderMain();
}

function handleRecord(): void {
  if (state.isRecording) {
    stopRecognition();
  } else {
    startRecognition();
  }
}

function handleRetry(): void {
  const current = state.results[state.currentIndex]!;
  current.recognised = "";
  current.accuracy = null;
  current.status = "pending";
  state.errorMessage = null;
  renderMain();
}

function handleSkip(): void {
  const current = state.results[state.currentIndex]!;
  current.status = "skipped";
  state.errorMessage = null;
  advanceOrFinish();
}

function handleNext(): void {
  advanceOrFinish();
}

function advanceOrFinish(): void {
  if (state.currentIndex < state.results.length - 1) {
    state.currentIndex += 1;
    state.errorMessage = null;
    renderMain();
  } else {
    state.phase = "done";
    const overall = overallAccuracy(
      state.results
        .filter((r) => r.status === "attempted")
        .map((r) => ({
          expected: r.sentence.text,
          recognised: r.recognised,
        }))
    );
    renderDone(overall);
  }
}

function handleExport(): void {
  const payload = {
    _note: "Language Lab speech test results — device-local only. No personal data.",
    exportedAt: new Date().toISOString(),
    overall: overallAccuracy(
      state.results
        .filter((r) => r.status === "attempted")
        .map((r) => ({
          expected: r.sentence.text,
          recognised: r.recognised,
        }))
    ),
    sentences: state.results.map((r) => ({
      id: r.sentence.id,
      category: r.sentence.category,
      expected: r.sentence.text,
      status: r.status,
      recognised: r.recognised,
      attempts: r.attempts,
      accuracyScore: r.accuracy?.score ?? null,
      matchedWords: r.accuracy?.matchedWords ?? [],
    })),
  };

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

function handleRestart(): void {
  state.phase = "pre-flight";
  state.currentIndex = 0;
  state.isRecording = false;
  state.errorMessage = null;
  state.results = PRACTICE_SENTENCES.map((s) => ({
    sentence: s,
    status: "pending",
    recognised: "",
    accuracy: null,
    attempts: 0,
  }));
  renderPreFlight();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  // Wire buttons
  qs<HTMLButtonElement>("#start-btn").addEventListener("click", handleStart);
  qs<HTMLButtonElement>("#record-btn").addEventListener("click", handleRecord);
  qs<HTMLButtonElement>("#retry-btn").addEventListener("click", handleRetry);
  qs<HTMLButtonElement>("#skip-btn").addEventListener("click", handleSkip);
  qs<HTMLButtonElement>("#next-btn").addEventListener("click", handleNext);
  qs<HTMLButtonElement>("#export-btn").addEventListener("click", handleExport);
  qs<HTMLButtonElement>("#restart-btn").addEventListener("click", handleRestart);

  renderPreFlight();
}

document.addEventListener("DOMContentLoaded", bootstrap);
