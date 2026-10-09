import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const out = path.resolve("qa-results/manual-browser");
await mkdir(out,{recursive:true});
const server=createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/AI-Studio-GHRAB/manualy/viewer.html") {
      res.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});
      res.end('<!doctype html><html><body><iframe id="manual-frame" title="Manuál" src="/manual/index.html?from=studio" style="width:100%;height:900px"></iframe></body></html>');
      return;
    }
    let rel=decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if(!rel || rel.endsWith("/"))rel+="index.html";
    const filename=path.resolve(baseDir,rel);
    if(!filename.startsWith(baseDir+path.sep))throw Error("Invalid path");
    const data=await readFile(filename);
    const ext=path.extname(filename);
    const mime={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"text/javascript;charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".json":"application/json"};
    res.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream"});res.end(data);
  }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const pageErrors=[];
  page.on("pageerror",err=>pageErrors.push(String(err)));
  await page.goto(origin+"/manual/index.html?from=studio");
  await page.waitForFunction(()=>document.documentElement.dataset.ghrabAccess==="granted");
  await page.locator("#ghrab-manual-navigation a").first().waitFor({state:"visible"});
  let links=await page.locator("#ghrab-manual-navigation a").allTextContents();
  assert.deepEqual(links,["← Zpět na manuály","AI Studio"]);
  assert.equal(await page.locator(".manual-back").isVisible(),false);
  assert.equal(await page.locator("#ghrab-manual-pdf").count(),0,"Unreviewed PDF must not be marketed as approved");
  const colorCheck=await page.locator("#ghrab-manual-navigation a").first().evaluate(e=>{
    const css=getComputedStyle(e),fg=css.color,bg=css.backgroundColor;
    function rgb(s){const a=s.match(/[\d.]+/g).slice(0,3).map(Number);return a.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});}
    const a=rgb(fg),b=rgb(bg),lum=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
    const x=lum(a),y=lum(b);return{contrast:(Math.max(x,y)+.05)/(Math.min(x,y)+.05),fg,bg};
  });
  assert(colorCheck.contrast>=4.5,"Dark mode return-link contrast too low: "+JSON.stringify(colorCheck));
  await page.screenshot({path:path.join(out,"ka-studio-dark.png"),fullPage:false});
  await page.locator("#themeBtn").click();
  await page.screenshot({path:path.join(out,"ka-studio-light.png"),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,"ka-studio-mobile.png"),fullPage:false});
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert(horizontalOverflow<=2,"Manual overflows narrow viewport by "+horizontalOverflow+"px");
  await page.goto(origin+"/manual/index.html?from=app");
  await page.waitForFunction(()=>document.documentElement.dataset.ghrabAccess==="granted");
  await page.locator("#ghrab-manual-navigation a").first().waitFor({state:"visible"});
  links=await page.locator("#ghrab-manual-navigation a").allTextContents();
  assert.deepEqual(links,["← Zpět do aplikace","AI Studio"]);
  await page.goto(origin+"/AI-Studio-GHRAB/manualy/viewer.html");
  const nested=page.frameLocator("#manual-frame");
  await nested.locator("html[data-ghrab-access='granted']").waitFor();
  assert.equal(await nested.locator("#ghrab-manual-navigation").count(),0,"Embedded duplicate navigation");
  assert.equal(await nested.locator("#ghrab-manual-pdf").count(),0,"Embedded duplicate PDF");
  assert.equal(await nested.locator(".manual-back").isVisible(),false);
  if(pageErrors.length)throw Error("Runtime errors: "+pageErrors.join(" | "));
  console.log(JSON.stringify({ok:true,app:"korespondencni-asistent",darkContrast:colorCheck.contrast,overflow:horizontalOverflow,contexts:3,screenshots:3}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
