import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'; import path from 'node:path';
import { EMAILS, DICTS } from './corpus.mjs';
const dist=process.argv[2], out=process.argv[3];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const srv=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);
 if(u==='/AI-Studio-GHRAB/access/app-guard.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end('export async function protectApp(){return true;}');}
 if(u.startsWith('/AI-Studio-GHRAB/')){res.writeHead(200,{'content-type':'text/css'});return res.end('');}
 u=u.replace(/^\/app\//,'/');let p=path.join(dist,u);if(existsSync(p)&&statSync(p).isDirectory())p=path.join(p,'index.html');
 if(!existsSync(p)){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});res.end(readFileSync(p));});
await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const results=[];const errs=[];
for(const [di,dict] of [[9,[]]]){
 const ctx=await browser.newContext({serviceWorkers:'block'});const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e)));
 await page.addInitScript(d=>{if(d.length)localStorage.setItem('rozbor_dict',JSON.stringify(d));},dict);
 await page.goto(`http://127.0.0.1:${port}/app/index.html`);await page.waitForFunction(()=>document.documentElement.dataset.ksAppReady==='true');
 for(const [ei,text] of EMAILS.entries()){
  for(const p of ["in"]){ for(const phase of [0,1,2]){ await page.evaluate(ph=>{if(ph===1)localStorage.setItem("rozbor_dict",JSON.stringify([{real:"Petr Novák"},{real:"Kateřina Horáková"},{real:"Šárka Novotná"}]));if(ph===2)localStorage.removeItem("rozbor_dict");},phase);
  const r=await page.evaluate(({text,p})=>{
   const rep=(k,v)=>v instanceof Set?{$set:[...v]}:v instanceof Map?{$map:[...v]}:v;
   const J=x=>JSON.parse(JSON.stringify(x,rep));const o={};const t0=performance.now();
   ST[p].km=[];ST[p].clean='';ST[p].reviewedSuggestions={};clearAnalysisCache();
   const raw=E(p,'raw');raw.value=text;raw.dispatchEvent(new Event('input',{bubbles:true}));
   o.sugLoose=J(computeSuggestionData(p,text,{includeReviewed:false,includeSentenceStart:false}));
   o.sugStrict=J(computeSuggestionData(p,text,{includeReviewed:true,includeSentenceStart:true}));
   o.strong=J(strongPersonalNameCandidates(text,p));o.strict=J(strictPersonalNameCandidates(text,p));o.untrusted=J(untrustedPersonalNameCandidates(text,p));
   o.sens=[hasSensitiveSchoolTerms(text),hasBlockingSensitiveSchoolData(text)];
   doAnon(p);o.km1=J(ST[p].km);o.clean1=ST[p].clean;
   const phrases=(o.sugStrict.suggestions||[]).filter(s=>s.kind!=='institution').map(s=>s.phrase);
   for(const ph of phrases){try{addPhraseAs(p,ph,'person');}catch(e){o['addErr_'+ph]=String(e);}}
   o.km2=J(ST[p].km);o.clean2=ST[p].clean;
   o.pre=J(preflightIssues(ST[p].clean,p));o.audit=J(safetyAudit(ST[p].clean,p));o.preRaw=J(preflightIssues(text,p));
   o.keyHtml=E(p,'keyBody').innerHTML;o.view=(E(p,'view')||{}).innerHTML||'';
   const words=(text.match(/[\p{L}]+/gu)||[]);o.kcp=words.map(w=>knownCanonicalPerson(w)?1:0).join('');
   o.kcp2=[...new Set(phrases)].map(ph=>[ph,knownCanonicalPerson(ph)]);
   o.norm=words.map(normName).join(' ');
   o.gate=[...document.querySelectorAll('button')].filter(b=>b.id.startsWith(p+'_')).map(b=>b.id+':'+b.disabled).join(',');
   o.ms=performance.now()-t0;return o;},{text,p});
  results.push({di,ei,p,phase,...r});}
  }}
 await ctx.close();
}
await browser.close();srv.close();
const ms=results.reduce((a,r)=>a+r.ms,0);results.forEach(r=>delete r.ms);
writeFileSync(out,JSON.stringify({results,errs},null,1));
console.log(JSON.stringify({cases:results.length,totalMs:Math.round(ms),errs:errs.length,withKm2:results.filter(r=>r.km2.length).length,persons:results.reduce((a,r)=>a+r.km2.filter(k=>/^osoba/.test(k.token||'')).length,0)}));
