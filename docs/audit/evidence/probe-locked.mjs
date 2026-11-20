// Audit probe: what a visitor to the production build sees for civics, Study first and the full interview.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const DIST = "/tmp/ll-dist", PORT = 5210, CDP = 9466;
const server = http.createServer((req, res) => {
  let f = path.join(DIST, new URL(req.url, "http://x").pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json" };
  res.writeHead(200, { "content-type": types[path.extname(f)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${CDP}`, "--no-first-run", "--disable-gpu", "--user-data-dir=/tmp/ll-chrome-lock", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); if (t.some((x) => x.type === "page")) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 1; const pend = new Map(); const logs = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } else if (m.method === "Runtime.consoleAPICalled" || m.method === "Runtime.exceptionThrown") logs.push(JSON.stringify(m.params).slice(0, 300)); });
const send = (method, params = {}) => new Promise((r) => { const i = id++; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: `http://localhost:${PORT}/` });
await sleep(1200);
const text = () => ev("document.querySelector('main').innerText.replace(/\\s+/g,' ').slice(0,700)");
const clickText = (s) => ev(`(() => { const b=[...document.querySelectorAll('button,label')].find(x=>x.innerText.trim().startsWith(${JSON.stringify(s)})); if(!b){return false} (b.querySelector('input')||b).click(); return true; })()`);
const out = {};
out.home = await text();
// Study first
await clickText("Study first"); await sleep(300); await clickText("2008 civics test"); await sleep(400);
out.studyFirst = await text();
await clickText("Back to home"); await sleep(300);
// Civics part
await clickText("Civics"); await sleep(400);
out.civicsSetup = await text();
await clickText("Aurora Vance"); await clickText("Before"); await sleep(200);
await clickText("Start practice"); await sleep(500);
out.civicsScreen = await text();
await clickText("Start over"); await sleep(300);
// Full interview to the report
await clickText("Full practice interview"); await sleep(300);
await clickText("Aurora Vance"); await clickText("Before"); await sleep(200);
await clickText("Start practice"); await sleep(600);
out.fullFirst = (await text()).slice(0, 200);
out.console = logs;
console.log(JSON.stringify(out, null, 1));
chrome.kill(); server.close(); process.exit(0);
