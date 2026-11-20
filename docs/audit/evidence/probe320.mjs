// Audit probe: reflow at 320 CSS px (WCAG 1.4.10) on the production build, extra-large text, a few languages.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const DIST = "/tmp/ll-dist", PORT = 5198 + 7, CDP = 9455;
const server = http.createServer((req, res) => {
  let p = new URL(req.url, "http://x").pathname;
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json" };
  res.writeHead(200, { "content-type": types[path.extname(f)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${CDP}`, "--no-first-run", "--disable-gpu", "--user-data-dir=/tmp/ll-chrome-320", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); if (t.some((x) => x.type === "page")) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 1; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = id++; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable");
const out = [];
for (const width of [320]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 700, deviceScaleFactor: 2, mobile: true });
  for (const lang of ["en", "vi", "th", "my", "ru", "hmn"]) {
    for (const size of ["normal", "extra-large"]) {
      await send("Page.navigate", { url: `http://localhost:${PORT}/` });
      await sleep(900);
      const click = (text) => ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(text)})); if(!b) return false; b.click(); return true; })()`);
      // language
      await ev(`document.querySelector('.header__lang').click()`);
      await sleep(150);
      await ev(`(() => { const names = {en:'English',vi:'Tiếng Việt',th:'ภาษาไทย',my:'မြန်မာ',ru:'Русский',hmn:'Hmoob'}; const b=[...document.querySelectorAll('.language-menu__option')].find(x=>x.innerText.trim().startsWith(names['${lang}'])); b && b.click(); })()`);
      await sleep(250);
      await ev(`document.documentElement.setAttribute('data-text-size','${size}')`);
      await sleep(150);
      const screens = [["home", null], ["menu", () => ev(`document.querySelector('.header__lang').click()`)], ["settings", async () => { await ev(`document.querySelector('.header__lang').click()`); const b = [...document.querySelectorAll('.header__button')]; }]];
      const measure = () => ev(`(() => { const vw=window.innerWidth; const over=[]; for (const el of document.body.querySelectorAll('*')) { const r=el.getBoundingClientRect(); if (r.width>0 && (r.right>vw+1||r.left<-1) && !el.closest('.ll-sr-only,.ll-skip-link')) over.push(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]); } return { scrollW: document.documentElement.scrollWidth, vw, over: over.slice(0,5), lang: document.documentElement.lang }; })()`);
      out.push({ width, lang, size, screen: "home", ...(await measure()) });
      // study first
      await click(String(await ev(`(document.querySelector('.option-card:not(.option-card--primary)')?.querySelector('.option-card__title')?.innerText)||''`)) || "x");
      for (const idx of [0, 1, 2, 3, 4]) {
        await send("Page.navigate", { url: `http://localhost:${PORT}/` });
        await sleep(600);
        await ev(`document.querySelector('.header__lang').click()`); await sleep(100);
        await ev(`(() => { const names = {en:'English',vi:'Tiếng Việt',th:'ภาษาไทย',my:'မြန်မာ',ru:'Русский',hmn:'Hmoob'}; [...document.querySelectorAll('.language-menu__option')].find(x=>x.innerText.trim().startsWith(names['${lang}']))?.click(); document.documentElement.setAttribute('data-text-size','${size}'); })()`);
        await sleep(300);
        const label = ["part:n400", "part:reading", "part:writing", "study", "credits"][idx];
        if (idx <= 2) await ev(`(() => { const cards=[...document.querySelectorAll('.option-grid .option-card')]; cards[${idx}]?.click(); })()`);
        if (idx === 3) await ev(`(() => { const cards=[...document.querySelectorAll('.option-card')]; cards.find(c=>c.classList.contains('option-card--primary'))?.nextElementSibling?.click(); })()`);
        if (idx === 4) await ev(`document.querySelector('.footer__link')?.click()`);
        await sleep(400);
        out.push({ width, lang, size, screen: label, ...(await measure()) });
      }
    }
  }
}
console.log(JSON.stringify(out.filter((o) => o.scrollW > o.vw + 1 || o.over.length), null, 1));
console.log("checked", out.length, "configurations; overflowing:", out.filter((o) => o.scrollW > o.vw + 1 || o.over.length).length);
chrome.kill(); server.close(); process.exit(0);
