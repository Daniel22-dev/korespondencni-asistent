#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
const ROOT=join(dirname(fileURLToPath(import.meta.url)),".."),BASE=join(ROOT,"dist");
const REPO="korespondencni-asistent",APP_ID="correspondence",FIELD_ID="my_raw",SUITE="openTestRunner(false); runKorespTests()",ITEM="#testOut .test-result",FAIL="#testOut .test-result.fail",CACHE_PREFIX="korespondencni-asistent-";
let failures=0;const ok=m=>console.log("  ✓ "+m),bad=m=>{console.error("  ✗ "+m);failures++};
if(!existsSync(join(BASE,"index.html"))){console.error("Chybí dist. Spusť nejdřív npm run build.");process.exit(1)}
function testHtml(raw){return raw.replace('type="application/ghrab-protected" data-ghrab-protected','type="text/javascript" data-ghrab-test-executable').replace(/<script type="module" data-ghrab-access-bootstrap>[\s\S]*?<\/script>/,'')}
async function boot(){const raw=readFileSync(join(BASE,"index.html"),"utf-8"),errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>{const m=String(e.message||e);if(!/scroll(IntoView|To)? is not a function/.test(m+String(e.detail||"")))errors.push(m.slice(0,300))});const dom=new JSDOM(testHtml(raw),{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:`https://daniel22-dev.github.io/${REPO}/?test=1`});const w=dom.window;w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));w.HTMLElement.prototype.scrollIntoView=w.HTMLElement.prototype.scrollIntoView||function(){};w.scrollTo=w.scrollTo||function(){};await new Promise(r=>setTimeout(r,800));return {dom,errors,raw}}
const {dom,errors,raw}=await boot(),doc=dom.window.document;
if(!raw.includes('data-ghrab-access-bootstrap')||!raw.includes('application/ghrab-protected')||!raw.includes('/AI-Studio-GHRAB/access/app-guard.js'))bad("chybí přístupová brána AI Studia");else ok("přístupová brána AI Studia");
if(/\b(?:prompt|confirm)\s*\(/.test(raw))bad("obsahuje nativní prompt/confirm");else ok("bez nativních blokujících dialogů");
if(errors.length)bad("runtime chyby: "+errors.join(" | "));else ok("start bez runtime chyb");
const ids=[...doc.querySelectorAll('[id]')].map(x=>x.id),dup=[...new Set(ids.filter((v,i,a)=>a.indexOf(v)!==i))];if(dup.length)bad("duplicitní ID: "+dup.join(", "));else ok("žádná duplicitní ID");
try{const r=dom.window.eval(SUITE);if(r&&typeof r.then==='function')await r}catch(e){bad("interní testy nešly spustit: "+e.message)}
await new Promise(r=>setTimeout(r,300));const items=doc.querySelectorAll(ITEM),fails=doc.querySelectorAll(FAIL);if(!items.length)bad("interní testy nic nevrátily");else if(fails.length){bad(`${fails.length}/${items.length} interních testů selhalo`);fails.forEach(x=>console.error("      "+x.textContent.replace(/\s+/g," ").slice(0,180)))}else ok(`${items.length}/${items.length} interních testů prošlo`);
const manifest=JSON.parse(readFileSync(join(BASE,"manifest.webmanifest"),"utf-8")),resolved=new URL(manifest.id,"https://daniel22-dev.github.io/").href,expected=`https://daniel22-dev.github.io/${REPO}/`;if(resolved!==expected)bad(`PWA id ${resolved}, očekáváno ${expected}`);else ok("jednoznačná PWA identita");
const sw=readFileSync(join(BASE,"sw.js"),"utf-8");if(!sw.includes(`key.startsWith("${CACHE_PREFIX}")`))bad("service worker nemá vlastní cache prefix");else ok("service worker spravuje jen vlastní cache");
const manual=join(BASE,"manual","index.html");if(!existsSync(manual))bad("chybí manuál");else{const m=readFileSync(manual,"utf-8");if(!m.includes(`const APP_ID="${APP_ID}"`)||!m.includes('data-ghrab-access-bootstrap'))bad("manuál nedědí oprávnění AI Studia");else ok("manuál dědí oprávnění AI Studia")}
dom.window.close();if(failures){console.error(`CELKEM: ${failures} problémů — release stopka.`);process.exit(1)}console.log("CELKEM: vše zelené — release gate OK.");
