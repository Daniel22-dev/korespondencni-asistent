import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const out = path.resolve("qa-results/manual-browser");
await mkdir(out,{recursive:true});
const server=createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/manualy/pdf-export.js"){
      res.writeHead(200,{"Content-Type":"text/javascript;charset=utf-8"});
      res.end(await readFile(path.join(out,"shared-pdf-export.js")));
      return;
    }
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
  // CI-only full-content export. UI remains fail-closed while reviewStatus != verified.
  const editorial = await page.evaluate(() => ({
    contract: window.GHRAB_MANUAL_DOC_INFO?.pdfContentContract || "",
    headings: (window.GHRAB_MANUAL_EXPORT || [])
      .filter(x => x && x.type === "h3" && typeof x.text === "string")
      .map(x => x.text.trim()).filter(Boolean)
  }));
  if (editorial.contract === "map-tour-v1")
    assert(editorial.headings.length >= 5, "Map/tour is incomplete in runtime export");
  const pdfDownload = page.waitForEvent("download", {timeout: 120000});
  await page.evaluate(async () => {
    const {downloadManualPdf} = await import("/manualy/pdf-export.js");
    await downloadManualPdf(document, {
      title: document.title,
      filename: "manual-content-qa.pdf",
      extras: Array.isArray(window.GHRAB_MANUAL_EXPORT) ? window.GHRAB_MANUAL_EXPORT : []
    });
  });
  const pdfFile = await (await pdfDownload).path();
  const qaApp = process.env.MANUAL_APP_NAME || "korespondencni-asistent";
  const actualPdf = path.join(out, qaApp + "-full-manual.pdf");
  await import("node:fs/promises").then(fs => fs.copyFile(pdfFile, actualPdf));
  const pdfBuffer = await readFile(actualPdf);
  assert(pdfBuffer.toString("latin1", 0, 8).startsWith("%PDF-1."), "PDF signature invalid");
  const pdfText = execFileSync("pdftotext", ["-layout", actualPdf, "-"],
    {encoding: "utf8", timeout: 50000});
  const norm = t => t.replace(/\s+/g, " ").trim();
  const flatPdf = norm(pdfText);
  const expectedParts = [...editorial.headings.slice(0, 4), ...editorial.headings.slice(-4)]
    .filter(s => s.length < 75);
  for (const phrase of new Set(expectedParts))
    assert(flatPdf.includes(norm(phrase)), "PDF lost a map/tour heading: " + phrase);
  assert(!flatPdf.includes("Ověřuji přístup k manuálu"), "Access gate leaked into PDF");
  execFileSync("pdftoppm", ["-f", "1", "-l", "1", "-r", "140", "-png",
    "-singlefile", actualPdf, path.join(out, qaApp + "-pdf-first-page")],
    {timeout: 50000});
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
