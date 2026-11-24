#!/usr/bin/env node
/**
 * tools/layout-check/run.mjs
 *
 * Drives the real app in headless Google Chrome at a phone width (390px) and checks every screen
 * of the practice flow for: horizontal scroll, elements that run off the screen, clipped text,
 * and touch targets smaller than 48px. It clicks through the whole flow like a user, so it also
 * works as a smoke test.
 *
 *   node tools/layout-check/run.mjs                       all configurations
 *   node tools/layout-check/run.mjs --size=extra-large    one text size (normal, large, extra-large)
 *   node tools/layout-check/run.mjs --lang=vi             one interface language (any of the 14 codes)
 *   node tools/layout-check/run.mjs --shots               also save a screenshot of every screen
 *   node tools/layout-check/run.mjs --width=320           phone width in CSS px (default 390; 320 is the WCAG reflow width)
 *   node tools/layout-check/run.mjs --filed=before        file before the boundary date, so the full interview
 *                                                         uses the 2008 test (default: on or after, 2025 test)
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_PORT = 5198;
const CDP_PORT = 9333;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS_DIR = path.join(os.tmpdir(), "language-lab-layout");
const MIN_TARGET = 48;
const WIDTH = Number((process.argv.slice(2).find((a) => a.startsWith("--width=")) ?? "--width=390").slice(8));
const PROD = process.argv.includes("--prod");
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
    out.horizontalScroll = out.scrollWidth > vw + 1;
    return out;
  };

  const buttons = () => [...document.querySelectorAll("button, summary, label")].filter(visible);
  const find = (text) => buttons().find((el) => textOf(el) === text) || buttons().find((el) => textOf(el).startsWith(text)) || null;
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
  const L = (key) => {
    const text = locales[lang]?.[key] ?? locales.en[key];
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
  const record = async (name) => {
    const m = await lab("measure(" + MIN_TARGET + ")");
    m.cspViolations = await cdp.evaluate("window.__csp || []");
    results.push({ name, size, lang, ...m });
    if (wantShots) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      fs.writeFileSync(path.join(SHOTS_DIR, `${lang}-${size}-${name}.png`), Buffer.from(shot.data, "base64"));
    }
  };

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));`,
  });
  await cdp.send("Page.navigate", { url: `http://localhost:${APP_PORT}/` });
  await waitFor(async () => (await cdp.evaluate("document.readyState")) === "complete" && (await cdp.evaluate("!!document.querySelector('h1')")), "the page");
  await cdp.evaluate(PAGE_HELPERS);

  // Language first (the button in the header), then the settings, so every screen is checked with both.
  if (lang !== "en") {
    const info = LANGUAGES.find((l) => l.code === lang);
    await cdp.evaluate("document.querySelector('.header__lang').click()");
    await waitFor(() => cdp.evaluate(`!!document.querySelector('.language-menu__option[lang="${info.htmlLang}"]')`), "the language menu");
    await cdp.evaluate(`document.querySelector('.language-menu__option[lang="${info.htmlLang}"]').click()`);
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
  await cdp.evaluate(`document.querySelector('.coach__switch').click()`);
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
  if (!(await lab(`has(${js(L("home.special.title"))})`))) throw new Error("the home screen has no 65/20 card");
  await click(L("home.special.title"));
  // The label is a legal key (English until reviewed), so wait for the checkbox itself.
  await waitFor(() => cdp.evaluate(`!!document.querySelector('input[name="special"]')`), "the 65/20 choice on setup");
  if (!(await cdp.evaluate(`document.querySelector('input[name="special"]').checked`))) throw new Error("the 65/20 card did not tick the choice");
  await record("setup-special");
  await cdp.evaluate(`document.querySelector('input[name="filed"][value="on_or_after"]').click()`);
  await click(L("intro.start"));
  await waitFor(() => lab(`has(${js(L("civics.submit"))})`), "the first 65/20 civics question");
  await record("civics-special");
  await click(L("header.home"));
  await click(L("header.homeConfirm.yes"));
  await waitFor(() => lab(`has(${js(L("home.special.title"))})`), "home after the 65/20 practice");
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
    for (const x of r.cspViolations ?? []) problems.push(`CSP violation: ${x}`);
    const expectedRoot = { normal: 16, large: 18, "extra-large": 20 }[r.size];
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
