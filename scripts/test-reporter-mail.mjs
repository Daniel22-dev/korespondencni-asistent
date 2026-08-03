#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
if (!existsSync(chromePath)) {
  console.log("SKIP: Chromium is not available");
  process.exit(0);
}
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
let reporter = readFileSync(join(ROOT, "dist", "access", "error-reporter-ks.js"), "utf8");
reporter = reporter
  .replace(
    'const LOCAL_REPORTER_STYLE_URL = new URL("./error-reporter-ks.css", import.meta.url);',
    'const LOCAL_REPORTER_STYLE_URL = { href: "data:text/css," };',
  )
  .replace("export function setupErrorReporter", "function setupErrorReporter");
const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"></head><body><main><h1>Harness</h1></main><script type="module">${reporter}\nsetupErrorReporter({appId:"correspondence",appName:"Korespondencni asistent",appVersion:"${packageJson.version}",studioUrl:"https://invalid.local/",supportEmail:"balaz@ghrabuvka.cz"});<\/script></body></html>`;
const port = 9700 + (process.pid % 200);
const profile = join("/tmp", `ks-reporter-mail-${process.pid}`);
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-default-apps",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore"] },
);
async function waitJson(url) {
  for (let i = 0; i < 160; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error("Chromium remote debugging timeout");
}
try {
  await waitJson(`http://127.0.0.1:${port}/json/version`);
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const page = pages.find((item) => item.type === "page");
  if (!page) throw new Error("No Chromium page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("DOM.enable");
  const tree = await call("Page.getFrameTree");
  await call("Page.setDocumentContent", {
    frameId: tree.frameTree.frame.id,
    html,
  });
  let ready = false;
  for (let i = 0; i < 160; i += 1) {
    ready = await evaluate('document.querySelector("#ghrab-error-reporter .launcher") !== null');
    if (ready) break;
    await sleep(50);
  }
  if (!ready) throw new Error("Reporter did not initialise");
  await evaluate(
    'document.querySelector("#ghrab-error-reporter .launcher").click();' +
      'const area=document.querySelector("#ghrab-error-reporter textarea");' +
      'area.value="Testovaci technicka chyba";' +
      'area.dispatchEvent(new Event("input",{bubbles:true}));true',
  );
  const box = await evaluate(
    '(()=>{const a=document.querySelector("#ghrab-error-reporter a.ghrab-report-button.primary");' +
      'a.scrollIntoView({block:"center"});const r=a.getBoundingClientRect();' +
      'return {x:r.x+r.width/2,y:r.y+r.height/2,tag:a.tagName,target:a.target,href:a.href};})()',
  );
  if (box.tag !== "A" || box.target !== "_blank") {
    throw new Error("Primary Gmail action is not a native target=_blank link");
  }
  await call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await sleep(1000);
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const gmail = targets.find(
    (item) => item.type === "page" && item.url.startsWith("https://mail.google.com/mail/"),
  );
  ws.close();
  if (!gmail) throw new Error("A real user click did not create a Gmail tab");
  if (!gmail.url.includes("to=balaz%40ghrabuvka.cz")) {
    throw new Error("Gmail draft does not contain the support recipient");
  }
  console.log("PASS: native Gmail link opened a new Chromium target");
} finally {
  chrome.kill("SIGKILL");
  await sleep(250);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}
