// Audit probe (kept in /tmp, not in the repository): serves the production build, drives headless Chrome over CDP,
// and records console messages, every network request, transfer sizes and paint timings.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const DIST = "/tmp/ll-dist";
const PORT = 5199;
const CDP_PORT = 9444;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mode = process.argv[2] ?? "plain"; // plain | csp | slow
const CSP = process.env.CSP ?? "";
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  const ext = path.extname(file);
  const body = fs.readFileSync(file);
  const headers = { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "public, max-age=0" };
  if (CSP) headers["content-security-policy"] = CSP;
  const accepts = String(req.headers["accept-encoding"] ?? "");
  if ([".html", ".js", ".css", ".json"].includes(ext) && accepts.includes("gzip")) {
    const z = zlib.gzipSync(body, { level: 6 });
    headers["content-encoding"] = "gzip";
    headers["content-length"] = z.length;
    res.writeHead(200, headers);
    res.end(z);
  } else {
    headers["content-length"] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  }
});
await new Promise((r) => server.listen(PORT, r));

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, "--no-first-run", "--disable-gpu", "--user-data-dir=/tmp/ll-chrome-probe", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
    if (targets.some((t) => t.type === "page")) break;
  } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 1;
const pending = new Map();
const events = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const w = pending.get(m.id);
    pending.delete(m.id);
    m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
  } else if (m.method) events.push(m);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = id++;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.value;
};
await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
if (mode === "slow") {
  // "Slow 4G" like profile of a weak connection: 400 kbps down, 150 kbps up, 400 ms latency; 4x CPU slowdown
  await send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (150 * 1024) / 8 });
  await send("Emulation.setCPUThrottlingRate", { rate: 4 });
}
const t0 = Date.now();
await send("Page.navigate", { url: `http://localhost:${PORT}/` });
const waitFor = async (check, what, timeout = 120000) => {
  const s = Date.now();
  for (;;) {
    try { if (await check()) return Date.now() - s; } catch {}
    if (Date.now() - s > timeout) throw new Error("timeout " + what);
    await sleep(100);
  }
};
await waitFor(() => evaluate("document.readyState === 'complete' && !!document.querySelector('h1')"), "page");
const loadMs = Date.now() - t0;
const paints = await evaluate(`JSON.stringify(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]))`);
const nav = await evaluate(`JSON.stringify((() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize }; })())`);
const lcp = await evaluate(`new Promise(r => { let v = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) v = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => r(v), 300); })`);

// Click through: language menu, Study first, credits, reading
const click = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
const steps = [];
if (mode !== "slow") {
  for (const label of ["English", "Study first", "2008 civics test", "Back to home", "Picture credits", "Back to the practice", "Reading"]) {
    const ok = await click(label);
    steps.push([label, ok]);
    await sleep(500);
  }
}
await sleep(800);
const enforced = await evaluate(`(() => { const s=document.createElement("script"); s.textContent="window.__x=1"; document.head.appendChild(s); return window.__x === undefined; })()`);
console.error("CSP enforced (inline script blocked):", enforced);

const reqs = new Map();
const consoleMsgs = [];
for (const e of events) {
  const p = e.params;
  if (e.method === "Network.requestWillBeSent") reqs.set(p.requestId, { url: p.request.url, type: p.type, method: p.request.method, initiator: p.initiator?.type });
  else if (e.method === "Network.responseReceived") Object.assign(reqs.get(p.requestId) ?? {}, { status: p.response.status, mime: p.response.mimeType, remote: p.response.remoteIPAddress ?? null, headers: p.response.headers });
  else if (e.method === "Network.loadingFinished") Object.assign(reqs.get(p.requestId) ?? {}, { encoded: p.encodedDataLength });
  else if (e.method === "Network.loadingFailed") Object.assign(reqs.get(p.requestId) ?? {}, { failed: p.errorText, blocked: p.blockedReason });
  else if (e.method === "Runtime.consoleAPICalled") consoleMsgs.push(["console." + p.type, p.args.map((a) => a.value ?? a.description).join(" ")]);
  else if (e.method === "Runtime.exceptionThrown") consoleMsgs.push(["exception", p.exceptionDetails.exception?.description ?? p.exceptionDetails.text]);
  else if (e.method === "Log.entryAdded") consoleMsgs.push(["log." + p.entry.level, p.entry.text + (p.entry.url ? " " + p.entry.url : "")]);
}
const list = [...reqs.values()];
const total = list.reduce((n, r) => n + (r.encoded ?? 0), 0);
const origins = {};
for (const r of list) {
  const o = new URL(r.url).origin;
  origins[o] = origins[o] ?? { n: 0, bytes: 0 };
  origins[o].n++;
  origins[o].bytes += r.encoded ?? 0;
}
const html = list.find((r) => r.type === "Document");
console.log(JSON.stringify({ mode, csp: CSP || null, loadMs, paints: JSON.parse(paints), nav: JSON.parse(nav), lcp, steps, totalBytes: total, origins, responseHeadersOfDocument: html?.headers, requests: list.map((r) => ({ url: r.url.replace(`http://localhost:${PORT}`, ""), type: r.type, status: r.status, bytes: r.encoded, failed: r.failed, blocked: r.blocked })), console: consoleMsgs }, null, 1));
chrome.kill("SIGTERM");
server.close();
process.exit(0);
