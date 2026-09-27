import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import path from 'node:path';
const dist=process.argv[2];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const guard=`export async function protectApp(){return true;}`;
const srv=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);
 if(u==='/AI-Studio-GHRAB/access/app-guard.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(guard);}
 if(u.startsWith('/AI-Studio-GHRAB/')){res.writeHead(200,{'content-type':'text/css'});return res.end('');}
 u=u.replace(/^\/app\//,'/');let p=path.join(dist,u);if(existsSync(p)&&statSync(p).isDirectory())p=path.join(p,'index.html');
 if(!existsSync(p)){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});res.end(readFileSync(p));});
await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const ctx=await browser.newContext({serviceWorkers:'block'});const page=await ctx.newPage();const errs=[];if(process.env.THROTTLE){const c=await ctx.newCDPSession(page);await c.send("Emulation.setCPUThrottlingRate",{rate:Number(process.env.THROTTLE)});}page.on('pageerror',e=>errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/app/index.html`);await page.waitForFunction(()=>document.documentElement.dataset.ksAppReady==='true');
const para=`Dobrý den, pane Nováku,\nobracím se na Vás ohledně Vašeho syna Petra Nováka ze třídy 3.B. Paní učitelka Jana Svobodová mi sdělila, že Petr v posledních týdnech nestihl odevzdat dva referáty z angličtiny. Rád bych s Vámi domluvil konzultaci ve čtvrtek 14. října od 15:00 v kabinetu 214. Kontaktovat mě můžete na tel. 604 123 456 nebo e-mailem jan.dvorak@example.cz. Pokud Vám termín nevyhovuje, navrhněte prosím jiný. Tereza Malá z 2.A se také ptala na exkurzi do Olomouce.\n`;
const text=para.repeat(6)+'S pozdravem\nJan Dvořák';
const r=await page.evaluate(async(text)=>{
 const out={len:text.length};const raw=document.getElementById('in_raw');
 // keystroke cost: append a char and dispatch input, synchronous handler time
 raw.value=text;raw.dispatchEvent(new Event('input',{bubbles:true}));
 const ks=[];for(let i=0;i<60;i++){raw.value+= 'x';const t=performance.now();raw.dispatchEvent(new Event('input',{bubbles:true}));ks.push(performance.now()-t);} ks.sort((a,b)=>a-b);out.keystrokeMedianMs=ks[30];out.keystrokeP95=ks[57];
 raw.value=text;raw.dispatchEvent(new Event('input',{bubbles:true}));
 await new Promise(r=>setTimeout(r,300));
 const an=[];for(let i=0;i<5;i++){const t=performance.now();doAnon('in');an.push(performance.now()-t);await new Promise(r=>setTimeout(r,50));} an.sort((a,b)=>a-b);out.doAnonMedianMs=an[2];out.doAnonFirst=an;
 out.tokens=ST.in.km.length;
 // keystroke in key-table token field
 const inp=document.querySelector('#in_keyBody input[data-f="real"]');if(inp){const k=[];for(let i=0;i<20;i++){inp.value+='a';const t=performance.now();inp.dispatchEvent(new Event('input',{bubbles:true}));k.push(performance.now()-t);}k.sort((a,b)=>a-b);out.keyTableKeystrokeMs=k[10];}
 // note field keystroke
 const note=document.getElementById('in_note');if(note){const k=[];for(let i=0;i<20;i++){note.value+='a';const t=performance.now();note.dispatchEvent(new Event('input',{bubbles:true}));k.push(performance.now()-t);}k.sort((a,b)=>a-b);out.noteKeystrokeMs=k[10];}
 out.cleanLen=(ST.in.clean||'').length; out.cleanHash=[...String(ST.in.clean)].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0); out.km=JSON.stringify(ST.in.km.map(k=>[k.real,k.token]));
 return out;},text);
r.errors=errs;console.log(JSON.stringify(r,null,1));await browser.close();srv.close();
