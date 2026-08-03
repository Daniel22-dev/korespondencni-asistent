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
let reporter = readFileSync(join(ROOT, "src", "access", "error-reporter-ks.js"), "utf8");
reporter = reporter
  .replace(
    'const LOCAL_REPORTER_STYLE_URL = new URL("./error-reporter-ks.css", import.meta.url);',
    'const LOCAL_REPORTER_STYLE_URL = { href: "data:text/css," };',
  )
  .replace("export function setupErrorReporter", "function setupErrorReporter");
const compatibility = readFileSync(
  join(ROOT, "src", "js", "26-error-reporter-compat.js"),
  "utf8",
);
const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"></head><body><main><h1>Harness</h1></main><script>${compatibility}<\/script><script type="module">${reporter}\nsetupErrorReporter({appId:"correspondence",appName:"Korespondenční asistent",appVersion:"${packageJson.version}",studioUrl:"https://invalid.local/",supportEmail:"balaz@ghrabuvka.cz"});<\/script></body></html>`;
const port = 10100 + (process.pid % 300);
const profile = join("/tmp", `ks-reporter-draft-${process.pid}`);
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
  const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) =>
    response.json(),
  );
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
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    }
    return result.result.value;
  };

  await call("Runtime.enable");
  await call("Page.enable");
  const tree = await call("Page.getFrameTree");
  await call("Page.setDocumentContent", {
    frameId: tree.frameTree.frame.id,
    html,
  });
  let ready = false;
  for (let i = 0; i < 160; i += 1) {
    ready = await evaluate(
      'document.querySelector("#ghrab-error-reporter .launcher") !== null && document.querySelector("#ghrab-error-reporter").dataset.ksWorkflowEnhanced === "1"',
    );
    if (ready) break;
    await sleep(50);
  }
  if (!ready) throw new Error("Reporter enhancement did not initialise");

  const result = await evaluate(`(async()=>{
    const root=document.querySelector('#ghrab-error-reporter');
    const byText=(text)=>[...root.querySelectorAll('button')].find((button)=>button.textContent.trim()===text);
    const launcher=root.querySelector('.launcher');
    const close=root.querySelector('.ghrab-report-header button');
    const comment=root.querySelector('textarea');
    const upload=root.querySelector('input[type=file]');
    const snap=byText('Pořídit snímek');
    const stop=byText('Ukončit snímání');
    const wait=(ms=80)=>new Promise((resolve)=>setTimeout(resolve,ms));

    launcher.click();
    comment.value='Koncept, který se má smazat';
    comment.dispatchEvent(new Event('input',{bubbles:true}));
    const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;
    const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/png'));
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'test.png',{type:'image/png'}));
    upload.files=transfer.files;upload.dispatchEvent(new Event('change',{bubbles:true}));
    for(let i=0;i<40&&!root.querySelector('.ghrab-screenshot-card');i++)await wait(25);
    if(!root.querySelector('.ghrab-screenshot-card'))throw new Error('Screenshot fixture was not added');

    // Simulace aktivního sdílení. Kompatibilní vrstva dialog automaticky skryje,
    // poté se uživatel vrátí tlačítkem Zpět k hlášení.
    snap.disabled=false;stop.disabled=false;await wait();
    root.querySelector('[data-ks-capture-back]').click();await wait();
    close.click();await wait();
    const promptOnClose=!root.querySelector('.ghrab-discard-backdrop').hidden;
    const captureModeAfterClose=root.classList.contains('ghrab-ks-capture-mode');
    byText('Smazat hlášení a zavřít').click();await wait();
    launcher.click();await wait();
    const deleted={
      comment:comment.value,
      screenshots:root.querySelectorAll('.ghrab-screenshot-card').length,
      finalHidden:root.querySelector('.ghrab-report-final').hidden,
    };

    comment.value='Koncept, který má zůstat';
    comment.dispatchEvent(new Event('input',{bubbles:true}));
    close.click();await wait();
    const promptForKeep=!root.querySelector('.ghrab-discard-backdrop').hidden;
    byText('Ponechat rozepsané a zavřít').click();await wait();
    launcher.click();await wait();
    const kept=comment.value;

    return {promptOnClose,captureModeAfterClose,deleted,promptForKeep,kept};
  })()`);
  ws.close();

  if (!result.promptOnClose)
    throw new Error("Close during capture did not open the keep/delete prompt");
  if (result.captureModeAfterClose)
    throw new Error("Close was still mistaken for switching back to the app");
  if (
    result.deleted.comment !== "" ||
    result.deleted.screenshots !== 0 ||
    result.deleted.finalHidden !== true
  )
    throw new Error(`Deleted draft returned after reopening: ${JSON.stringify(result.deleted)}`);
  if (!result.promptForKeep || result.kept !== "Koncept, který má zůstat")
    throw new Error("Keep draft choice did not preserve the report");

  console.log(
    `PASS: active-capture close offers keep/delete and draft lifecycle works in ${packageJson.version}`,
  );
} finally {
  chrome.kill("SIGKILL");
  await sleep(250);
  try {
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  } catch {}
}
