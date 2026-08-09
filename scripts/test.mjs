#!/usr/bin/env node
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),".."),BASE=join(ROOT,"dist");
const REPO="diferenciator",APP_ID="differentiator",APP_VERSION="1.3.12",CACHE_PREFIX="ghrab-differentiator-v";
let failures=0;const ok=m=>console.log("  ✓ "+m),bad=m=>{console.error("  ✗ "+m);failures++};
if(!existsSync(join(BASE,"index.html"))){console.error("Chybí dist. Spusť nejdřív npm run build.");process.exit(1)}
function testHtml(raw){return raw.replace('type="application/ghrab-protected" data-ghrab-protected','type="text/javascript" data-ghrab-test-executable').replace(/<script type="module" data-ghrab-access-bootstrap>[\s\S]*?<\/script>/,'')}
function findChromium(){for(const p of [process.env.CHROMIUM_PATH,process.env.CHROME_PATH,"/usr/bin/chromium","/usr/bin/google-chrome","/usr/bin/google-chrome-stable"].filter(Boolean))if(existsSync(p))return p;throw new Error("Chromium není dostupné")}
async function waitJson(url){for(let i=0;i<150;i++){try{const r=await fetch(url);if(r.ok)return await r.json()}catch{}await sleep(100)}throw new Error("Chromium remote debugging se nespustil")}
async function runBrowser(raw){
  const port=9450+(process.pid%300),profile=join("/tmp",`diferenciator-test-${process.pid}`),chrome=spawn(findChromium(),["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--disable-default-apps","--no-first-run",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","ignore"]});
  let ws;
  try{
    await waitJson(`http://127.0.0.1:${port}/json/version`);const pages=await waitJson(`http://127.0.0.1:${port}/json`),page=pages.find(x=>x.type==="page");
    ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});let seq=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}};
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
    await call("Runtime.enable");await call("Page.enable");const tree=await call("Page.getFrameTree");
    let html=testHtml(raw).replace("</body>",`<script>window.__testRuntimeErrors=[];window.addEventListener("error",e=>window.__testRuntimeErrors.push(String(e.message||e.error||e)));window.addEventListener("unhandledrejection",e=>window.__testRuntimeErrors.push(String(e.reason||e)));setTimeout(async()=>{let report={};try{const r=TestSystem.runAll();if(r&&typeof r.then==="function")await r;await new Promise(x=>setTimeout(x,250));const ids=[...document.querySelectorAll("[id]")].map(x=>x.id),dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))],items=[...document.querySelectorAll("#testResults .test-item")],fails=[...document.querySelectorAll("#testResults .test-item.fail")];report={errors:window.__testRuntimeErrors,dup,count:items.length,fails:fails.map(x=>x.textContent.replace(/\\s+/g," ").slice(0,180))};}catch(e){report={fatal:String(e&&e.stack||e),errors:window.__testRuntimeErrors};}const pre=document.createElement("pre");pre.id="__TEST_REPORT__";pre.textContent=JSON.stringify(report);document.body.appendChild(pre);},600);<\/script></body>`);
    await call("Page.setDocumentContent",{frameId:tree.frameTree.frame.id,html});let report="";
    for(let i=0;i<250;i++){const r=await call("Runtime.evaluate",{expression:'document.querySelector("#__TEST_REPORT__")?.textContent||""',returnByValue:true});report=r.result?.value||"";if(report)break;await sleep(100)}
    if(!report)throw new Error("Chromium test report timeout");return JSON.parse(report);
  }finally{try{ws?.close()}catch{}chrome.kill("SIGKILL");await sleep(200);rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
}

const raw=readFileSync(join(BASE,"index.html"),"utf-8"),runtime=await runBrowser(raw);
if(!raw.includes('data-ghrab-access-bootstrap')||!raw.includes('application/ghrab-protected')||!raw.includes('deployment-config.js')||!raw.includes('urls.guardUrl'))bad("chybí konfigurovatelná přístupová brána AI Studia");else ok("konfigurovatelná přístupová brána AI Studia");
if(/\b(?:prompt|confirm)\s*\(/.test(raw))bad("obsahuje nativní prompt/confirm");else ok("bez nativních blokujících dialogů");
if(runtime.fatal)bad("interní testy nešly spustit: "+runtime.fatal);else if(runtime.errors?.length)bad("runtime chyby: "+runtime.errors.join(" | "));else ok("start bez runtime chyb");
if(runtime.dup?.length)bad("duplicitní ID: "+runtime.dup.join(", "));else ok("žádná duplicitní ID");
if(!runtime.count)bad("interní testy nic nevrátily");else if(runtime.fails?.length){bad(`${runtime.fails.length}/${runtime.count} interních testů selhalo`);runtime.fails.forEach(x=>console.error("      "+x))}else ok(`${runtime.count}/${runtime.count} interních testů prošlo`);
const manifest=JSON.parse(readFileSync(join(BASE,"manifest.webmanifest"),"utf-8")),resolved=new URL(manifest.id,"https://daniel22-dev.github.io/").href,expected=`https://daniel22-dev.github.io/${REPO}/`;if(resolved!==expected||manifest.version!==APP_VERSION)bad(`PWA identita/verze není správná: ${resolved}, ${manifest.version}`);else ok("jednoznačná PWA identita a verze");
const sw=readFileSync(join(BASE,"sw.js"),"utf-8");if(!sw.includes(`"${CACHE_PREFIX}"`)||!sw.includes("CACHE_PREFIXES.some"))bad("service worker nemá kanonický vlastní cache prefix");else ok("service worker spravuje jen vlastní a historické cache");
if(!sw.includes("error-reporter.js")||!sw.includes("error-reporter.css")||!sw.includes("error-reporter-adapter.js"))bad("service worker necachuje reportér");else ok("service worker cachuje reportér");
const manual=join(BASE,"manual","index.html");if(!existsSync(manual))bad("chybí manuál");else{const m=readFileSync(manual,"utf-8");if(!new RegExp(`const APP_ID=['\"]${APP_ID}['\"]`).test(m)||!m.includes('data-ghrab-access-bootstrap')||!m.includes('deployment-config.js'))bad("manuál nedědí konfigurovatelné oprávnění AI Studia");else if(!m.includes('class="chipbtn manual-back"'))bad("manuálu chybí návrat do aplikace");else if(!m.includes("errorReporter:false")||m.includes("error-reporter-adapter.js")||!m.includes("Jak poslat správci srozumitelné hlášení bez focení monitoru"))bad("manuál vytváří druhý reportér nebo neodkazuje na centrální návod");else ok("manuál dědí oprávnění, má návrat a centrální návod")}
if(failures){console.error(`CELKEM: ${failures} problémů — release stopka.`);process.exit(1)}console.log("CELKEM: vše zelené — release gate OK.");
