// Perf harness: serve dist, stub AI Studio access gate, measure startup & script cost.
import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import path from 'node:path';
const dist = process.argv[2]; const runs = Number(process.argv[3]||7);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const guard=`export async function protectApp(appId){document.dispatchEvent(new CustomEvent('ghrab:app-access-granted',{detail:{permit:{role:'teacher'}}}));return true;}`;
const srv=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);
 if(u==='/AI-Studio-GHRAB/access/app-guard.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(guard);}
 if(u==='/AI-Studio-GHRAB/access/access-gate.css'){res.writeHead(200,{'content-type':'text/css'});return res.end('');}
 u=u.replace(/^\/app\//,'/'); let p=path.join(dist,u); if(existsSync(p)&&statSync(p).isDirectory())p=path.join(p,'index.html');
 if(!existsSync(p)){res.writeHead(404);return res.end();} res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'}); res.end(readFileSync(p));});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const results=[];
for(let i=0;i<runs;i++){
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
 await page.addInitScript(()=>{window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(e.duration)}).observe({type:'longtask',buffered:true})}catch{}
   const orig=Element.prototype.replaceWith; Element.prototype.replaceWith=function(...a){const t0=performance.now();const r=orig.apply(this,a);if(this.dataset&&this.hasAttribute('data-ghrab-protected'))window.__unlockMs=performance.now()-t0;return r;};});
 const cdp=await ctx.newCDPSession(page); await cdp.send('Performance.enable');
 await page.goto(`http://127.0.0.1:${port}/app/index.html`);
 await page.waitForFunction(()=>document.documentElement.dataset.ksAppReady==='true',null,{timeout:20000});
 const m=await page.evaluate(()=>({ready:performance.now(),unlock:window.__unlockMs,lt:window.__lt,nodes:document.getElementsByTagName('*').length,heap:performance.memory?.usedJSHeapSize}));
 await page.waitForTimeout(300);
 const pm=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
 m.lt=(await page.evaluate(()=>window.__lt)); m.scriptSec=pm.ScriptDuration; m.layoutSec=pm.LayoutDuration; m.recalcSec=pm.RecalcStyleDuration; m.errs=errs;
 results.push(m); await ctx.close();
}
await browser.close(); srv.close();
const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
console.log(JSON.stringify({runs,readyMs:med(results.map(r=>r.ready)).toFixed(0),unlockMs:med(results.map(r=>r.unlock)).toFixed(0),scriptMs:(med(results.map(r=>r.scriptSec))*1000).toFixed(0),layoutMs:(med(results.map(r=>r.layoutSec))*1000).toFixed(0),recalcMs:(med(results.map(r=>r.recalcSec))*1000).toFixed(0),longtasks:results[0].lt.map(x=>Math.round(x)),nodes:results[0].nodes,heapMB:(results[0].heap/1e6).toFixed(1),errors:results.flatMap(r=>r.errs).slice(0,3)},null,1));
