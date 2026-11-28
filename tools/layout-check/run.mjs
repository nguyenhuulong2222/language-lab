#!/usr/bin/env node
/**
 * tools/layout-check/run.mjs
 *
 * Drives the real app in headless Google Chrome at a phone width (390px) and checks every screen
 * of the practice flow for: horizontal scroll, elements that run off the screen, clipped text,
 * touch targets smaller than 56px, rendered text below 16px, a missing "Back to Home" in the first
 * viewport on any screen but Home, and exactly one filled primary button
 * (.btn--primary) per screen state, at least 64px high. It clicks through the whole flow like a
 * user, so it also works as a smoke test.
 *
 *   node tools/layout-check/run.mjs                       all configurations
 *   node tools/layout-check/run.mjs --size=extra-large    one text size (normal, large, extra-large)
 *   node tools/layout-check/run.mjs --lang=vi             one interface language (any of the 14 codes)
 *   node tools/layout-check/run.mjs --shots               also save a screenshot of every screen
 *   node tools/layout-check/run.mjs --width=320           phone width in CSS px (default 390; 320 is the WCAG reflow width)
 *   node tools/layout-check/run.mjs --filed=before        file before the boundary date, so the full interview
 *                                                         uses the 2008 test (default: on or after, 2025 test)
 *   node tools/layout-check/run.mjs --browser-lang=vi     Chrome set to that language: Home must open in it
 *   node tools/layout-check/run.mjs --prod                the production build (what Cloudflare serves), with the
 *                                                         headers of public/_headers, and a check that the page
 *                                                         raises no Content-Security-Policy violation
 *
 * --prod builds to a temporary folder and serves it itself. Four languages are hidden there
 * (src/i18n/languages.ts, IN_REVIEW_LANGUAGES), so they are skipped. If the production home screen
 * offers no full interview (an answer key still marked for review), only the parts it offers are checked.
 * Every run also checks that Study first shows a picture that has loaded, and that the report is reached.
 *
 * Needs Google Chrome (set CHROME_PATH if it is not in the default macOS place) and starts its
 * own dev server on port 5198. Screenshots go to the system temp folder, not into the repository.
 * This is a developer tool: it is not part of `npm test`.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { LANGUAGES, IN_REVIEW_LANGUAGES } from "../../src/i18n/languages.ts";
import { isLegalKey } from "../../src/i18n/legal-keys.ts";
import { isReviewed } from "../../src/i18n/locale-checks.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_PORT = 5198;
const CDP_PORT = 9333;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS_DIR = path.join(os.tmpdir(), "language-lab-layout");
const MIN_TARGET = 56;
const WIDTH = Number((process.argv.slice(2).find((a) => a.startsWith("--width=")) ?? "--width=390").slice(8));
const PROD = process.argv.includes("--prod");
/** --browser-lang=vi: start Chrome with that interface language (navigator.languages) and check Home opens in it. */
const BROWSER_LANG = (process.argv.slice(2).find((a) => a.startsWith("--browser-lang=")) ?? "").slice(15) || null;
const FILED_BEFORE = process.argv.includes("--filed=before");
const PROD_DIR = path.join(os.tmpdir(), "language-lab-layout-dist");
const HEIGHT = 844;

const args = process.argv.slice(2);
const argValue = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const sizes = argValue("size") ? [argValue("size")] : ["normal", "extra-large"];
const langs = (argValue("lang") ? argValue("lang").split(",") : LANGUAGES.map((l) => l.code)).filter(
  (code) => !(PROD && IN_REVIEW_LANGUAGES.includes(code))
);
const wantShots = args.includes("--shots");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const locales = Object.fromEntries(
  LANGUAGES.map((l) => l.code).map((code) => {
    const file = path.join(ROOT, `src/i18n/locales/${code}.json`);
    return [code, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}];
  })
);

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

const children = [];
function run(command, argv, options = {}) {
  const child = spawn(command, argv, { stdio: "ignore", ...options });
  children.push(child);
  return child;
}
function cleanup() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

async function waitFor(check, what, timeout = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      // not ready yet
    }
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${what}`);
    await sleep(150);
  }
}

// ---------------------------------------------------------------------------
// Production build, served with the headers of public/_headers
// ---------------------------------------------------------------------------
/** The headers of the `/*` block of public/_headers. */
function siteHeaders() {
  const lines = fs.readFileSync(path.join(ROOT, "public/_headers"), "utf8").split("\n");
  const headers = {};
  let inAll = false;
  for (const line of lines) {
    if (/^\S/.test(line)) inAll = line.trim() === "/*";
    else if (inAll && line.includes(":")) {
      const at = line.indexOf(":");
      headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
    }
  }
  return headers;
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain" };
async function serveProduction() {
  fs.rmSync(PROD_DIR, { recursive: true, force: true });
  await new Promise((resolve, reject) => {
    const build = spawn("npx", ["vite", "build", "--outDir", PROD_DIR, "--emptyOutDir"], { cwd: ROOT, stdio: "ignore" });
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("The production build failed."))));
  });
  const headers = siteHeaders();
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    let file = path.join(PROD_DIR, pathname);
    if (!file.startsWith(PROD_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PROD_DIR, "index.html");
    res.writeHead(200, { ...headers, "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(APP_PORT, resolve));
  children.push({ kill: () => server.close() });
  return headers["content-security-policy"];
}
// ---------------------------------------------------------------------------
// Chrome DevTools protocol, minimal
// ---------------------------------------------------------------------------

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiting = this.pending.get(message.id);
      if (waiting) {
        this.pending.delete(message.id);
        message.error ? waiting.reject(new Error(message.error.message)) : waiting.resolve(message.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
    return result.result.value;
  }
}

// ---------------------------------------------------------------------------
// In-page helpers
// ---------------------------------------------------------------------------

const PAGE_HELPERS = `
window.__lab = (() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return false;
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden") return false;
    }
    return true;
  };
  const skip = (el) => el.closest(".ll-sr-only, .ll-skip-link") !== null;
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const describe = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).join(".") : "") + " \\"" + textOf(el).slice(0, 40) + "\\"";

  const measure = (min) => {
    const vw = window.innerWidth;
    const out = { rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize), scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, offscreen: [], clipped: [], smallTargets: [] };
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || skip(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) out.offscreen.push(describe(el));
      const s = getComputedStyle(el);
      const clipsX = s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1;
      const clipsY = s.overflowY !== "visible" && s.overflowY !== "auto" && s.overflowY !== "scroll" && el.scrollHeight > el.clientHeight + 1;
      if ((clipsX || clipsY) && textOf(el).length > 0) out.clipped.push(describe(el));
      if (s.textOverflow === "ellipsis") out.clipped.push("ellipsis " + describe(el));
    }
    const targets = document.body.querySelectorAll("button, a[href], summary, select, textarea, input");
    for (const el of targets) {
      if (!visible(el) || skip(el)) continue;
      const box = el.matches('input[type="radio"], input[type="checkbox"]') ? (el.closest("label") || el) : el;
      const r = box.getBoundingClientRect();
      if (r.height < min - 0.5 || (r.width < min - 0.5)) out.smallTargets.push(describe(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
    }
    // Senior step 7: no rendered text below 16px (any element that holds visible text itself).
    out.smallText = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || skip(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "");
      if (!own) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 15.95) out.smallText.push(describe(el) + " " + px + "px");
    }
    // Exactly one filled primary button per screen state, at least 64px high on a phone. With a
    // modal dialog open (the full-screen picture), the state is the dialog: the page behind is inert.
    const modal = document.querySelector("dialog[open]");
    const primaries = [...(modal ?? document.body).querySelectorAll(".btn--primary")].filter((el) => visible(el) && !skip(el));
    out.primaryCount = primaries.length;
    out.primaryNames = primaries.map((el) => textOf(el).slice(0, 40));
    // A choice between equal options (the AI coach yes/no, the 2008/2025 study test) is made with
    // option cards and has no filled button, so the screen does not push one answer.
    out.optionCards = [...document.body.querySelectorAll("main .action-card")].filter(visible).length;
    out.shortPrimary = primaries.filter((el) => el.getBoundingClientRect().height < 63.5).map((el) => describe(el) + " " + Math.round(el.getBoundingClientRect().height) + "px high");
    // Q1: every screen except Home (and the picture credits, which have their own way back) shows
    // "Back to Home" in the first viewport, measured from the top of the page.
    const homeGrid = document.getElementById("home-language");
    const onHome = homeGrid !== null && visible(homeGrid);
    // The picture credits hide the practice column (the first one) and show their own.
    const creditsOpen = document.querySelector("main > .ll-container")?.hidden === true;
    const bar = [...document.querySelectorAll("main .back-home__button")].find(visible);
    out.backHome = { needed: !onHome && !creditsOpen && modal === null, top: bar ? Math.round(bar.getBoundingClientRect().top + window.scrollY) : null, viewport: window.innerHeight };
    // Q2: the header rows (the logo and the buttons, grouped by their vertical centre).
    const headerItems = [...document.querySelectorAll("header .header__brand, header .header__button")].filter(visible);
    const centres = headerItems.map((el) => { const b = el.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b);
    out.headerRows = centres.reduce((rows, c, i) => (i > 0 && c - centres[i - 1] < 20 ? rows : rows + 1), 0);
    out.horizontalScroll = out.scrollWidth > vw + 1;
    return out;
  };

  const buttons = () => [...document.querySelectorAll("button, summary, label")].filter(visible);
  // The words a person reads as the control's name: decoration marked aria-hidden (the "Aa" on the
  // text size choices) is left out.
  const nameOf = (el) => {
    if (!el.querySelector('[aria-hidden="true"]')) return textOf(el);
    const copy = el.cloneNode(true);
    for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    return (copy.textContent || "").replace(/\\s+/g, " ").trim();
  };
  const find = (text) => buttons().find((el) => nameOf(el) === text) || buttons().find((el) => nameOf(el).startsWith(text)) || null;
  return {
    measure,
    has: (text) => find(text) !== null,
    click: (text) => { const el = find(text); if (!el) throw new Error("No button: " + text); el.click(); return true; },
    clickInput: (text) => { const el = find(text); if (!el) throw new Error("No choice: " + text); const input = el.querySelector("input"); (input || el).click(); return true; },
    type: (value) => {
      const box = [...document.querySelectorAll("textarea")].find(visible);
      if (!box) throw new Error("No text box");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(box, value);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    heading: () => { const h = document.querySelector("h1"); return h ? textOf(h) : ""; },
    bodyText: () => textOf(document.body),
  };
})();
`;

// ---------------------------------------------------------------------------
// One configuration: a text size and a language
// ---------------------------------------------------------------------------

async function checkConfiguration(cdp, size, lang) {
  // As the app: a legal key shows in English until the language has a named reviewer.
  const L = (key) => {
    const englishOnly = lang !== "en" && isLegalKey(key) && !isReviewed(locales[lang]?._meta);
    const text = (englishOnly ? undefined : locales[lang]?.[key]) ?? locales.en[key];
    if (text === undefined) throw new Error(`No text for key ${key}`);
    return text;
  };
  const results = [];
  const lab = (expr) => cdp.evaluate(`window.__lab.${expr}`);
  const js = (value) => JSON.stringify(value);
  const click = async (text) => {
    await waitFor(() => lab(`has(${js(text)})`), `button "${text}"`);
    await lab(`click(${js(text)})`);
    await sleep(120);
  };
  const choose = async (text) => {
    await waitFor(() => lab(`has(${js(text)})`), `choice "${text}"`);
    await lab(`clickInput(${js(text)})`);
    await sleep(80);
  };
  const type = async (value) => {
    await lab(`type(${js(value)})`);
    await sleep(60);
  };
  // The full-screen picture: it opens from the picture, has one primary button (Close), and closes
  // with Close, Esc and Back. Focus comes back to the picture, Study stays open, and no extra
  // history entry is left (the section entry stays the current one).
  const checkPictureDialog = async () => {
    const isOpen = () => cdp.evaluate(`!!document.querySelector("dialog.picture-dialog[open]")`);
    const open = async () => {
      await cdp.evaluate(`document.querySelector(".question-picture__button").click()`);
      await waitFor(isOpen, "the picture dialog");
      await waitFor(() => cdp.evaluate(`(() => { const i = document.querySelector("dialog[open] img"); return !!i && i.complete && i.naturalWidth > 0; })()`), "the picture in the dialog");
    };
    const closed = async (how) => {
      await waitFor(async () => !(await isOpen()), `the picture dialog to close with ${how}`);
      await sleep(150);
      const state = await cdp.evaluate(`({ focus: !!(document.activeElement && document.activeElement.matches(".question-picture__button")), picture: !!(history.state && history.state.languageLabPicture), section: !!(history.state && history.state.languageLabSection), study: !!document.querySelector(".question-picture__button"), locked: document.documentElement.classList.contains("ll-picture-open") })`);
      if (!state.focus) throw new Error(`${how}: focus did not go back to the picture`);
      if (state.picture || !state.section) throw new Error(`${how}: the history is not back on the section entry`);
      if (!state.study) throw new Error(`${how}: Study first did not stay open`);
      if (state.locked) throw new Error(`${how}: the page is still locked`);
    };
    const historyBefore = await cdp.evaluate("history.length");
    await open();
    if (!(await cdp.evaluate(`document.activeElement && document.activeElement.matches("dialog[open] .picture-dialog__close")`))) throw new Error("the picture dialog did not focus Close");
    await sleep(200);
    await record("picture-dialog");
    await cdp.evaluate(`document.querySelector("dialog[open] .picture-dialog__close").click()`);
    await closed("Close");
    await open();
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await closed("Esc");
    await open();
    await cdp.evaluate("history.back()");
    await closed("Back");
    const historyAfter = await cdp.evaluate("history.length");
    if (historyAfter > historyBefore + 1) throw new Error(`the picture left ${historyAfter - historyBefore} history entries (at most one, reused)`);
  };
  const record = async (name) => {
    const m = await lab("measure(" + MIN_TARGET + ")");
    m.cspViolations = await cdp.evaluate("window.__csp || []");
    // Result screens (audit F-07): the prominent disclaimer is there, under the result, and the
    // result heading is fully in view where the app leaves the page (it focuses the result, which
    // scrolls it into view), so the disclaimer never hides the result.
    if (/-feedback$|^n400-done$/.test(name)) {
      m.resultCheck = await cdp.evaluate(`(() => {
        const disclaimer = document.querySelector("main .disclaimer--prominent");
        const heading = document.querySelector("main .screen__body .panel .result-headline") || document.querySelector("main h1");
        const box = heading ? heading.getBoundingClientRect() : null;
        return { disclaimer: !!disclaimer, headingTop: box ? Math.round(box.top) : null, headingBottom: box ? Math.round(box.bottom) : null, viewport: window.innerHeight,
          order: !!(disclaimer && heading && (heading.compareDocumentPosition(disclaimer) & Node.DOCUMENT_POSITION_FOLLOWING)) };
      })()`);
    }
    results.push({ name, size, lang, ...m });
    if (wantShots) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      // A modal dialog covers the viewport only: capture what the phone shows, not a stretched page.
      const modalOpen = await cdp.evaluate(`!!document.querySelector("dialog[open]")`);
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !modalOpen });
      fs.writeFileSync(path.join(SHOTS_DIR, `${lang}-${size}-${name}.png`), Buffer.from(shot.data, "base64"));
    }
  };

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));`,
  });
  await cdp.send("Page.navigate", { url: `http://localhost:${APP_PORT}/` });
  await waitFor(async () => (await cdp.evaluate("document.readyState")) === "complete" && (await cdp.evaluate("!!document.querySelector('h1')")), "the page");
  await cdp.evaluate(PAGE_HELPERS);
  // --browser-lang: Chrome runs with that language, so Home must open in it, without a tap.
  if (BROWSER_LANG !== null) {
    const expected = LANGUAGES.find((l) => l.code === BROWSER_LANG);
    const htmlLang = await cdp.evaluate("document.documentElement.lang");
    const title = await cdp.evaluate("document.querySelector('main h1').textContent.trim()");
    if (htmlLang !== expected.htmlLang || title !== locales[BROWSER_LANG]["home.title"]) {
      throw new Error(`Chrome in ${BROWSER_LANG}: Home opened as lang="${htmlLang}" with "${title}"`);
    }
    console.log(`Chrome in ${BROWSER_LANG}: Home opened in ${BROWSER_LANG} ("${title}").`);
  }
  // Language first (the grid at the top of Home; the header button goes there), then the settings,
  // so every screen is checked with both.
  const info = LANGUAGES.find((l) => l.code === lang);
  await cdp.evaluate("document.querySelector('.header__lang').click()");
  await waitFor(() => cdp.evaluate(`document.activeElement && document.activeElement.matches('#home-language .language-menu__option')`), "the language grid on Home (focused from the header button)");
  if ((await cdp.evaluate("document.documentElement.lang")) !== info.htmlLang) {
    await cdp.evaluate(`document.querySelector('#home-language .language-menu__option[lang="${info.htmlLang}"]').click()`);
    await waitFor(async () => (await cdp.evaluate("document.documentElement.lang")) === info.htmlLang, `the page language ${lang}`);
    await sleep(150);
  }
  await click(L("header.settings"));
  await choose(L(size === "normal" ? "settings.textSize.normal" : size === "large" ? "settings.textSize.large" : "settings.textSize.extraLarge"));
  await sleep(150);
  await record("settings-open");
  await click(L("settings.close"));
  await click(L("header.about"));
  await record("about-open");
  await click(L("header.about"));
  await record("home");
  // The header language button on Home scrolls to the language grid at the top.
  await cdp.evaluate("document.querySelector('.header__lang').click()");
  await sleep(120);
  await record("home-language");
  await cdp.evaluate("window.scrollTo(0, 0)");

  // Study first and the picture credits
  if (await cdp.evaluate(`window.__lab.has(${js(L("home.study.title"))})`)) {
    await click(L("home.study.title"));
    await record("study-choose");
    await click(L("study.version.2008"));
    // The answer key is fetched first: make sure a question is really on screen.
    await waitFor(() => lab(`has(${js(L("civics.next"))})`), "a Study first question");
    await record("study-question");
    // Study first must show pictures: step through the questions until one is on screen and has loaded.
    let picture = false;
    for (let step = 0; step < 40 && !picture; step++) {
      picture = await cdp.evaluate(`(() => { const img = document.querySelector(".question-picture__image"); return !!img && img.complete && img.naturalWidth > 0; })()`);
      if (!picture) {
        await click(L("civics.next"));
        await sleep(250);
      }
    }
    if (!picture) throw new Error("Study first showed no loaded picture in the first 40 questions");
    await record("study-picture");
    await checkPictureDialog();
    await click(L("report.home"));
  }
  await click(L("footer.credits"));
  await record("credits");
  await click(L("credits.back"));
  // Production with reviewed keys: the home screen must offer every card.
  if (PROD && (await cdp.evaluate(`window.__lab.has(${js(L("home.full.title"))})`))) {
    for (const key of ["home.study.title", "home.part.civics.title", "home.part.n400.title", "home.part.reading.title", "home.part.writing.title"]) {
      if (!(await cdp.evaluate(`window.__lab.has(${js(L(key))})`))) throw new Error(`the production home screen has no "${L(key)}" card`);
    }
  }
  if (PROD && !(await cdp.evaluate(`window.__lab.has(${js(L("home.full.title"))})`))) {
    return await productionParts(cdp, results, { L, lab, js, click, choose, type, record });
  }
  // Full interview
  await click(L("home.full.title"));
  await record("setup");
  // The first fictional profile (a name is not repeated here, so renaming a profile does not break the check).
  await cdp.evaluate(`document.querySelector('input[name="profile"]').click()`);
  // Format the date in the browser itself: its ICU data is the one the app uses (Node's can differ).
  const wantedDate = LANGUAGES.find((l) => l.code === lang).dateLocale;
  const boundary = await cdp.evaluate(
    `new Intl.DateTimeFormat((Intl.DateTimeFormat.supportedLocalesOf([${js(wantedDate)}]).length ? ${js(wantedDate)} : "en-US") + "-u-ca-gregory-nu-latn", { dateStyle: "long", timeZone: "UTC" }).format(new Date("2025-10-20"))`
  );
  await choose(L(FILED_BEFORE ? "intro.filed.before" : "intro.filed.onOrAfter").replace("{date}", boundary));
  await click(L("intro.start"));

  // The choice before the first N-400 question: record it, then practise without AI.
  await waitFor(() => lab(`has(${js(L("coach.choice.no"))})`), "the AI coach choice");
  await record("coach-choice");
  await click(L("coach.choice.no"));
  await waitFor(() => lab(`has(${js(L("n400.save"))})`), "the N-400 question");
  await record("n400-question");
  // The AI coach switch and its notice (opened and cancelled, so nothing is sent).
  await cdp.evaluate(`document.querySelector('section.coach .coach__switch').click()`);
  await waitFor(() => lab(`has(${js(L("coach.notice.cancel"))})`), "the AI coach notice");
  await record("coach-notice");
  await click(L("coach.notice.cancel"));
  for (let i = 0; i < 7; i++) {
    await waitFor(() => lab(`has(${js(L("n400.save"))})`), "an N-400 question");
    await type("My answer is short.");
    await click(L("n400.save"));
    await sleep(150);
  }
  await waitFor(() => lab(`has(${js(L("n400.done.next"))})`), "the N-400 summary");
  await record("n400-done");
  await click(L("n400.done.next"));

  for (const part of ["reading", "writing"]) {
    await waitFor(() => lab(`has(${js(L("voice.skip"))})`), `the ${part} screen`);
    await record(`${part}-question`);
    let first = true;
    for (;;) {
      await type("wrong words here");
      await click(L(part === "reading" ? "reading.submit" : "writing.submit"));
      if (first) await record(`${part}-feedback`);
      first = false;
      const next = await cdp.evaluate(`window.__lab.has(${js(L(part === "reading" ? "reading.next" : "writing.next"))})`);
      if (next) {
        await click(L(part === "reading" ? "reading.next" : "writing.next"));
        continue;
      }
      await click(L(part === "reading" ? "reading.toWriting" : "writing.toCivics"));
      break;
    }
  }

  await waitFor(() => lab(`has(${js(L("civics.submit"))})`), "the civics screen");
  await record("civics-question");
  let first = true;
  for (let guard = 0; guard < 30; guard++) {
    await type("zzz");
    await click(L("civics.submit"));
    if (first) await record("civics-feedback");
    first = false;
    if (await cdp.evaluate(`window.__lab.has(${js(L("civics.finish"))})`)) {
      await record("civics-done");
      await click(L("civics.finish"));
      break;
    }
    await click(L("civics.next"));
  }
  await waitFor(() => lab(`has(${js(L("report.again"))})`), "the report");
  await record("report");
  // The report names the test version the filing choice leads to.
  const version = FILED_BEFORE ? "2008" : "2025";
  if (!(await lab("bodyText()")).includes(version)) throw new Error(`the report does not name the ${version} test`);
  await click(L("report.again"));

  // One part: reading, to its own report
  await click(L("home.part.reading.title"));
  for (;;) {
    await waitFor(() => lab(`has(${js(L("reading.submit"))})`), "a reading sentence");
    await type("wrong words here");
    await click(L("reading.submit"));
    if (await cdp.evaluate(`window.__lab.has(${js(L("report.see"))})`)) {
      await click(L("report.see"));
      break;
    }
    await click(L("reading.next"));
  }
  await waitFor(() => lab(`has(${js(L("report.home"))})`), "the part report");
  await record("part-report");
  await click(L("report.home"));
  await specialPass({ cdp, lab, js, click, record, L });
  await homeCoachPass({ cdp, lab, js, click, record, L });
  return results;
}

/**
 * The 65/20 practice (spec release-finish REQ-S05, S06): the home card, the setup with the choice
 * ticked and the interpreter line, and the first civics question with the 65/20 note. Then Home.
 */
async function specialPass({ cdp, lab, js, click, record, L }) {
  // "Who is practicing?" → 65/20, then the civics part: setup starts with 65/20 ticked.
  if (!(await cdp.evaluate(`!!document.querySelector('input[name="who"][value="65/20"]')`))) throw new Error("the home screen has no 65/20 choice");
  await cdp.evaluate(`document.querySelector('input[name="who"][value="65/20"]').click()`);
  await sleep(120);
  await record("home-special");
  await click(L("home.part.civics.title"));
  // The label is a legal key (English until reviewed), so wait for the checkbox itself.
  await waitFor(() => cdp.evaluate(`!!document.querySelector('input[name="exception"][value="65/20"]')`), "the 65/20 choice on setup");
  if (!(await cdp.evaluate(`document.querySelector('input[name="exception"][value="65/20"]').checked`))) throw new Error("the 65/20 card did not tick the choice");
  await record("setup-special");
  await cdp.evaluate(`document.querySelector('input[name="filed"][value="on_or_after"]').click()`);
  await click(L("intro.start"));
  await waitFor(() => lab(`has(${js(L("civics.submit"))})`), "the first 65/20 civics question");
  await record("civics-special");
  await cdp.evaluate("document.querySelector('main .back-home__button').click()");
  await click(L("header.homeConfirm.yes"));
  await waitFor(() => cdp.evaluate(`!!document.querySelector('input[name="who"]')`), "home after the 65/20 practice");
  await cdp.evaluate(`document.querySelector('input[name="who"][value="none"]').click()`);
}

/**
 * The home card "Practice the N-400 interview with an AI coach": the consent notice must be open at
 * once when the N-400 stage starts. It is cancelled (back to the choice screen), then "No", so
 * nothing is ever sent. Runs last: the next configuration reloads the page.
 */
async function homeCoachPass({ cdp, lab, js, click, record, L }) {
  await click(L("home.coach.title"));
  await record("setup-coach");
  await cdp.evaluate(`document.querySelector('input[name="profile"]').click()`);
  await click(L("intro.start"));
  await waitFor(() => lab(`has(${js(L("coach.notice.cancel"))})`), "the AI coach notice opened from home");
  if (await lab(`has(${js(L("coach.choice.no"))})`)) throw new Error("the home coach card showed the choice screen, not the notice");
  await record("coach-notice-home");
  await click(L("coach.notice.cancel"));
  await waitFor(() => lab(`has(${js(L("coach.choice.no"))})`), "the AI coach choice after Cancel");
  await click(L("coach.choice.no"));
  await waitFor(() => lab(`has(${js(L("n400.save"))})`), "the N-400 question after No");
}

/** What the production build offers while civics is locked: the N-400 part, reading and writing, each to its report. */
async function productionParts(cdp, results, { L, lab, js, click, choose, type, record }) {
  // N-400 conversation (needs a fictional profile)
  await click(L("home.part.n400.title"));
  await record("setup");
  await cdp.evaluate(`document.querySelector('input[name="profile"]').click()`);
  await click(L("intro.start"));
  await waitFor(() => lab(`has(${js(L("coach.choice.no"))})`), "the AI coach choice");
  await record("coach-choice");
  await click(L("coach.choice.no"));
  await waitFor(() => lab(`has(${js(L("n400.save"))})`), "the N-400 question");
  await record("n400-question");
  // One part: the summary ends with "See report" (report.see), not "Go to reading".
  for (let i = 0; i < 12; i++) {
    await waitFor(() => lab(`has(${js(L("n400.save"))})`).then((q) => q || lab(`has(${js(L("report.see"))})`)), "an N-400 question");
    if (await cdp.evaluate(`window.__lab.has(${js(L("report.see"))})`)) break;
    await type("My answer is short.");
    await click(L("n400.save"));
    await sleep(150);
  }
  await waitFor(() => lab(`has(${js(L("report.see"))})`), "the N-400 summary");
  await record("n400-done");
  await click(L("report.see"));
  await waitFor(() => lab(`has(${js(L("report.home"))})`), "the N-400 report");
  await record("part-report-n400");
  await click(L("report.home"));
  for (const part of ["reading", "writing"]) {
    await click(L(`home.part.${part}.title`));
    let first = true;
    for (;;) {
      await waitFor(() => lab(`has(${js(L(`${part}.submit`))})`), `a ${part} sentence`);
      if (first) await record(`${part}-question`);
      await type("wrong words here");
      await click(L(`${part}.submit`));
      if (first) await record(`${part}-feedback`);
      first = false;
      if (await cdp.evaluate(`window.__lab.has(${js(L("report.see"))})`)) {
        await click(L("report.see"));
        break;
      }
      await click(L(`${part}.next`));
    }
    await waitFor(() => lab(`has(${js(L("report.home"))})`), `the ${part} report`);
    await record(`part-report-${part}`);
    await click(L("report.home"));
  }
  await specialPass({ cdp, lab, js, click, record, L });
  await homeCoachPass({ cdp, lab, js, click, record, L });
  return results;
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (PROD) {
    const csp = await serveProduction();
    if (!csp) throw new Error("public/_headers has no Content-Security-Policy for /*.");
    console.log(`Production build served from ${PROD_DIR} with the CSP of public/_headers.`);
  } else {
    run("npx", ["vite", "--port", String(APP_PORT), "--strictPort"], { cwd: ROOT });
  }
  await waitFor(async () => (await fetch(`http://localhost:${APP_PORT}/`)).ok, "the app server");

  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "language-lab-chrome-"));
  run(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    ...(BROWSER_LANG === null ? [] : [`--lang=${BROWSER_LANG}`, `--accept-lang=${BROWSER_LANG}`]),
    "--disable-gpu",
    `--window-size=${WIDTH},${HEIGHT}`,
    "about:blank",
  ]);
  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    return list.find((t) => t.type === "page");
  }, "Chrome");

  const all = [];
  let failures = 0;
  for (const lang of langs) {
    for (const size of sizes) {
      const cdp = new Cdp(target.webSocketDebuggerUrl);
      await cdp.ready;
      await cdp.send("Page.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
      let results;
      try {
        results = await checkConfiguration(cdp, size, lang);
      } catch (error) {
        console.error(`\n[${lang}, ${size}] the flow stopped: ${error.message}`);
        console.error(`  on screen: "${await cdp.evaluate("window.__lab ? window.__lab.heading() : document.title")}"`);
        failures++;
        cdp.ws.close();
        continue;
      }
      cdp.ws.close();
      all.push(...results);
    }
  }

  console.log(`\nLayout check at ${WIDTH}px${PROD ? " (production build)" : ""}: ${all.length} screens\n`);
  for (const r of all) {
    const problems = [];
    if (r.horizontalScroll) problems.push(`horizontal scroll (page ${r.scrollWidth}px wide)`);
    for (const x of r.offscreen) problems.push(`off screen: ${x}`);
    for (const x of r.clipped) problems.push(`clipped: ${x}`);
    for (const x of r.smallTargets) problems.push(`small target: ${x}`);
    for (const x of r.smallText ?? []) problems.push(`text below 16px: ${x}`);
    if (r.size === "normal" && r.headerRows > 1) problems.push(`the header is ${r.headerRows} rows at normal size (expected one)`);
    if (r.backHome?.needed && (r.backHome.top === null || r.backHome.top + 1 > r.backHome.viewport)) problems.push(r.backHome.top === null ? "no visible Back to Home" : `Back to Home is below the first viewport (top ${r.backHome.top}px)`);
    for (const x of r.shortPrimary ?? []) problems.push(`primary button below 64px: ${x}`);
    if (r.primaryCount !== undefined && r.primaryCount !== 1 && !(r.primaryCount === 0 && r.optionCards > 1)) problems.push(`${r.primaryCount} primary buttons (expected exactly one)${r.primaryCount > 1 ? ": " + r.primaryNames.join(" / ") : ""}`);
    for (const x of r.cspViolations ?? []) problems.push(`CSP violation: ${x}`);
    if (r.resultCheck) {
      const c = r.resultCheck;
      if (!c.disclaimer) problems.push("no prominent disclaimer on a result screen");
      else if (!c.order) problems.push("the prominent disclaimer is above the result");
      if (c.headingTop === null || c.headingTop < 0 || c.headingBottom > c.viewport) problems.push(`the result is not in view (top ${c.headingTop}px, bottom ${c.headingBottom}px, viewport ${c.viewport}px)`);
    }
    const expectedRoot = { normal: 18, large: 21, "extra-large": 24 }[r.size];
    if (r.rootPx !== expectedRoot) problems.push(`text size not applied: root font is ${r.rootPx}px, expected ${expectedRoot}px`);
    const status = problems.length === 0 ? "ok  " : "FAIL";
    console.log(`${status} ${r.lang} ${r.size.padEnd(11)} ${r.name} (root ${r.rootPx}px)`);
    for (const p of problems) console.log(`       ${p}`);
    if (problems.length > 0) failures++;
  }
  console.log(`\n${failures === 0 ? "All screens pass." : `${failures} problem(s).`}${wantShots ? `\nScreenshots: ${SHOTS_DIR}` : ""}`);
  cleanup();
  if (PROD) fs.rmSync(PROD_DIR, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  cleanup();
  process.exit(1);
});
