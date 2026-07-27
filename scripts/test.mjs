#!/usr/bin/env node
import {readFileSync,existsSync,rmSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawn,execSync} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
const ROOT=join(dirname(fileURLToPath(import.meta.url)),".."),BASE=join(ROOT,"dist");
const REPO="korespondencni-asistent",APP_ID="correspondence",SUITE="openTestRunner(false); runKorespTests()",ITEM="#testOut .test-result",FAIL="#testOut .test-result.fail",CACHE_PREFIX="korespondencni-asistent-";
let failures=0;const ok=m=>console.log("  ✓ "+m),bad=m=>{console.error("  ✗ "+m);failures++};
if(!existsSync(join(BASE,"index.html"))){console.error("Chybí dist. Spusť nejdřív npm run build.");process.exit(1)}
function testHtml(raw){return raw.replace('type="application/ghrab-protected" data-ghrab-protected','type="text/javascript" data-ghrab-test-executable').replace(/<script type="module" data-ghrab-access-bootstrap>[\s\S]*?<\/script>/,'')}
async function runWithJsdom(raw){
  const {JSDOM,VirtualConsole}=await import("jsdom"),errors=[],vc=new VirtualConsole();
  vc.on("jsdomError",e=>{const m=String(e.message||e);if(!/scroll(IntoView|To)? is not a function/.test(m+String(e.detail||"")))errors.push(m.slice(0,300))});
  const dom=new JSDOM(testHtml(raw),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:`https://daniel22-dev.github.io/${REPO}/`});
  const w=dom.window;w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));w.HTMLElement.prototype.scrollIntoView=w.HTMLElement.prototype.scrollIntoView||function(){};w.scrollTo=w.scrollTo||function(){};
  await sleep(800);const doc=w.document;
  let fatal="";try{const r=w.eval(SUITE);if(r&&typeof r.then==="function")await r}catch(e){fatal=e.message||String(e)}
  await sleep(300);
  const ids=[...doc.querySelectorAll('[id]')].map(x=>x.id),dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))];
  const items=[...doc.querySelectorAll(ITEM)],fails=[...doc.querySelectorAll(FAIL)];
  const result={errors,dup,fatal,count:items.length,fails:fails.map(x=>x.textContent.replace(/\s+/g," ").slice(0,180))};dom.window.close();return result;
}
function storageShim(){return `<script>(function(){function makeStore(){const m=new Map(),api={get length(){return m.size},key(i){return [...m.keys()][i]??null},getItem(k){k=String(k);return m.has(k)?m.get(k):null},setItem(k,v){m.set(String(k),String(v))},removeItem(k){m.delete(String(k))},clear(){m.clear()}};return new Proxy(api,{ownKeys(){return [...m.keys()]},getOwnPropertyDescriptor(t,k){if(m.has(String(k)))return {enumerable:true,configurable:true};return Object.getOwnPropertyDescriptor(t,k)},get(t,k,r){if(typeof k==="string"&&m.has(k))return m.get(k);return Reflect.get(t,k,r)}})}try{Object.defineProperty(window,"localStorage",{value:makeStore(),configurable:true});Object.defineProperty(window,"sessionStorage",{value:makeStore(),configurable:true});}catch(e){window.__storageShimError=String(e)}})();<\/script>`}
async function runWithChromium(raw){
  const chromePath=process.env.CHROMIUM_PATH||"/usr/bin/chromium";if(!existsSync(chromePath))throw new Error("jsdom není nainstalován a Chromium není dostupné");
  let html=testHtml(raw).replace("<head>","<head>"+storageShim());
  const inject=`<script>window.__testRuntimeErrors=[];window.addEventListener("error",e=>window.__testRuntimeErrors.push(String(e.message||e.error||e)));setTimeout(async()=>{let report={};try{openTestRunner(false);const results=await runKorespTests();const ids=[...document.querySelectorAll("[id]")].map(x=>x.id),dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))];report={results,dup,errors:window.__testRuntimeErrors};}catch(e){report={fatal:String(e&&e.stack||e),errors:window.__testRuntimeErrors};}const pre=document.createElement("pre");pre.id="__TEST_REPORT__";pre.textContent=JSON.stringify(report);document.body.appendChild(pre);},500);<\/script>`;
  html=html.replace("</body>",inject+"</body>");
  const port=9300+(process.pid%500),profile=join("/tmp","ks-chromium-"+process.pid);
  const chrome=spawn(chromePath,["--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","ignore"]});
  const waitJson=async url=>{for(let i=0;i<120;i++){try{const r=await fetch(url);if(r.ok)return await r.json()}catch{}await sleep(100)}throw new Error("Chromium remote debugging se nespustil")};
  try{
    await waitJson(`http://127.0.0.1:${port}/json/version`);const pages=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json()),page=pages[0];
    const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});let seq=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const x=pending.get(m.id);pending.delete(m.id);m.error?x.reject(new Error(JSON.stringify(m.error))):x.resolve(m.result)}};
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
    await call("Runtime.enable");await call("Page.enable");const tree=await call("Page.getFrameTree");await call("Page.setDocumentContent",{frameId:tree.frameTree.frame.id,html});
    let report="";for(let i=0;i<300;i++){const r=await call("Runtime.evaluate",{expression:'document.querySelector("#__TEST_REPORT__")?.textContent||""',returnByValue:true});report=r.result?.value||"";if(report)break;await sleep(100)}ws.close();if(!report)throw new Error("Chromium test report timeout");
    const parsed=JSON.parse(report),results=parsed.results||[];return {errors:parsed.errors||[],dup:parsed.dup||[],fatal:parsed.fatal||"",count:results.length,fails:results.filter(x=>!x.ok).map(x=>`${x.name} · ${x.msg||"selhalo"}`)};
  }finally{chrome.kill("SIGKILL");try{rmSync(profile,{recursive:true,force:true})}catch(_){}}
}
const raw=readFileSync(join(BASE,"index.html"),"utf-8");
const manualPath=join(BASE,"manual","index.html");
const manualHtml=existsSync(manualPath)?readFileSync(manualPath,"utf-8"):"";
const readme=readFileSync(join(ROOT,"README.md"),"utf-8");
let runtime;try{runtime=await runWithJsdom(raw)}catch(e){if(e&&e.code!=="ERR_MODULE_NOT_FOUND")throw e;console.log("  ℹ jsdom není lokálně dostupný, používám hermetický Chromium fallback");runtime=await runWithChromium(raw)}
if(!raw.includes('data-ghrab-access-bootstrap')||!raw.includes('application/ghrab-protected')||!raw.includes('/AI-Studio-GHRAB/access/app-guard.js'))bad("chybí přístupová brána AI Studia");else ok("přístupová brána AI Studia");
if(/\b(?:prompt|confirm)\s*\(/.test(raw))bad("obsahuje nativní prompt/confirm");else ok("bez nativních blokujících dialogů");
if(runtime.errors.length)bad("runtime chyby: "+runtime.errors.join(" | "));else ok("start bez runtime chyb");
if(runtime.dup.length)bad("duplicitní ID: "+runtime.dup.join(", "));else ok("žádná duplicitní ID");
if(runtime.fatal)bad("interní testy nešly spustit: "+runtime.fatal);else if(!runtime.count)bad("interní testy nic nevrátily");else if(runtime.fails.length){bad(`${runtime.fails.length}/${runtime.count} interních testů selhalo`);runtime.fails.forEach(x=>console.error("      "+x))}else ok(`${runtime.count}/${runtime.count} interních testů prošlo`);
if(raw.includes('thinkingLevel:"low"'))bad("Gemini stále používá thinkingLevel low");else ok("Gemini nepoužívá thinkingLevel low");
if(!raw.includes("GEMINI_MAX_OUTPUT_TOKENS=32768"))bad("Gemini nemá výstupní limit 32768");else ok("Gemini má výstupní limit 32768");
const manifest=JSON.parse(readFileSync(join(BASE,"manifest.webmanifest"),"utf-8")),resolved=new URL(manifest.id,"https://daniel22-dev.github.io/").href,expected=`https://daniel22-dev.github.io/${REPO}/`;if(resolved!==expected)bad(`PWA id ${resolved}, očekáváno ${expected}`);else ok("jednoznačná PWA identita");
const sw=readFileSync(join(BASE,"sw.js"),"utf-8");if(!sw.includes(`key.startsWith("${CACHE_PREFIX}")`))bad("service worker nemá vlastní cache prefix");else ok("service worker spravuje jen vlastní cache");
if(!manualHtml)bad("chybí manuál");else{if(!manualHtml.includes(`const APP_ID="${APP_ID}"`)||!manualHtml.includes('data-ghrab-access-bootstrap'))bad("manuál nedědí oprávnění AI Studia");else ok("manuál dědí oprávnění AI Studia");if(!manualHtml.includes('class="chipbtn manual-back"'))bad("manuál nemá návrat do aplikace");else ok("manuál má návrat do aplikace")}

// Statické regresní pojistky nad skutečně nasazovanými artefakty.
if(/\.privacy-stage\{[^}]*display\s*:\s*block\s*!important/.test(raw))bad("privacy-stage přebíjí skrývání kroku 2");else ok("privacy-stage neruší skrývání kroku 2");
if(/\bopenSchoolGuide\b/.test(raw))bad("v sestavené aplikaci zůstal nepřístupný školní návod");else ok("starý nepřístupný školní návod není v sestavené aplikaci");
const deadCss=(raw.match(/\.(?:school-guide-[\w-]+|safety-guide|guide-bigline|guide-quick(?:-card)?)(?=[\s>{:.,])/g)||[]);if(deadCss.length)bad("v sestavené aplikaci zůstaly osiřelé styly: "+[...new Set(deadCss)].join(", "));else ok("bez osiřelých stylů po odstraněných průvodcích");
const deepLinks=(raw.match(/href="\.\/manual\/#bezpecnost"/g)||[]).length;if(deepLinks<2)bad("obě pracovní cesty nemají odkaz na bezpečnostní kapitolu");else ok("obě pracovní cesty odkazují na bezpečnostní kapitolu");
if(manualHtml){
  const manualVersion=(manualHtml.match(/data-manual-version="([\d.]+)"/)||[])[1];
  const manualAppVersion=(manualHtml.match(/data-app-version="([\d.]+)"/)||[])[1];
  const appVersion=(raw.match(/version:\s*["']([\d.]+)["']/)||[])[1];
  if(!manualVersion||!manualAppVersion||!appVersion||manualAppVersion!==appVersion||!readme.includes(`manuál ${manualVersion}`))bad("verze manuálu, aplikace a README nejsou sjednocené");else ok("verze manuálu, aplikace a README jsou sjednocené");
  const safetySection=(manualHtml.match(/<section id="bezpecnost">[\s\S]*?<\/section>/)||[])[0]||"";
  const safetyNavCount=(manualHtml.match(/href="#bezpecnost"/g)||[]).length;
  const safetyItems=(safetySection.match(/class="safety-item\b/g)||[]).length;
  if(!safetySection||safetyNavCount<2||!safetySection.includes('class="safety-list"')||safetyItems<3)bad("bezpečnostní kapitola nemá požadované ID, navigaci nebo strukturu");else ok("bezpečnostní kapitola má stabilní ID, navigaci a strukturu");
}
const gitignore=readFileSync(join(ROOT,".gitignore"),"utf-8");if(!/^dist\/$/m.test(gitignore))bad("generované dist není v .gitignore");else ok("generované dist je v .gitignore");
if(existsSync(join(ROOT,".git"))){let tracked="";try{tracked=execSync("git ls-files dist",{cwd:ROOT,stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{}if(tracked)bad("dist je stále verzované v Git repozitáři; před vydáním ho odstraň");else ok("dist není verzované v Git repozitáři")}

if(failures){console.error(`CELKEM: ${failures} problémů — release stopka.`);process.exit(1)}
console.log("CELKEM: vše zelené — release gate OK.");
