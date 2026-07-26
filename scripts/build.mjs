#!/usr/bin/env node
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const SRC=join(ROOT,"src"), DIST=join(ROOT,"dist");
const APP_NAME="Korespondenční asistent";
const TOKENS={css:"/*==SEM_BUILD_VLOZI_STYLES_CSS==*/",body:"<!--==SEM_BUILD_VLOZI_BODY_HTML==-->",js:"/*==SEM_BUILD_VLOZI_JS==*/"};
const log=m=>console.log("[build] "+m);const fail=m=>{console.error("[build] CHYBA: "+m);process.exit(1)};

rmSync(DIST,{recursive:true,force:true});mkdirSync(DIST,{recursive:true});cpSync(SRC,DIST,{recursive:true});
const tplPath=join(DIST,"index.template.html");if(!existsSync(tplPath))fail("chybí src/index.template.html");
let tpl=readFileSync(tplPath,"utf-8");for(const [name,token] of Object.entries(TOKENS))if(!tpl.includes(token))fail("šablona neobsahuje token "+name);
const css=readFileSync(join(DIST,"styles.css"),"utf-8"),body=readFileSync(join(DIST,"body.html"),"utf-8"),jsDir=join(DIST,"js");
const jsFiles=readdirSync(jsDir).filter(f=>f.endsWith(".js")).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(!jsFiles.length)fail("složka js je prázdná");
const js=jsFiles.map(f=>readFileSync(join(jsDir,f),"utf-8")).join("\n;\n");
const out=tpl.split(TOKENS.css).join(css).split(TOKENS.body).join(body).split(TOKENS.js).join(js);if(out.includes("==SEM_BUILD_VLOZI_"))fail("ve výstupu zůstal build token");
writeFileSync(join(DIST,"index.html"),out);rmSync(tplPath);rmSync(join(DIST,"styles.css"));rmSync(join(DIST,"body.html"));rmSync(jsDir,{recursive:true});rmSync(join(DIST,"README_PWA.md"),{force:true});
let hash="";try{hash=execSync("git rev-parse --short HEAD",{cwd:ROOT,stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{}
function* htmlFiles(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())yield* htmlFiles(p);else if(n.endsWith(".html"))yield p}}
if(hash){const re=/(build:\s*)(['"])__BUILD__\2/g;for(const f of htmlFiles(DIST)){const x=readFileSync(f,"utf-8");if(re.test(x)){re.lastIndex=0;writeFileSync(f,x.replace(re,`$1$2${hash}$2`))}}}
const html=readFileSync(join(DIST,"index.html"),"utf-8"),sw=readFileSync(join(DIST,"sw.js"),"utf-8");
const rel=html.match(/version:\s*['"]([\d.]+)['"]/),swm=sw.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);if(!rel||!swm)fail("nelze načíst verzi");if(rel[1]!==swm[1])fail(`RELEASE ${rel[1]} nesedí s APP_VERSION ${swm[1]}`);
const changes=html.indexOf("changes:");if(changes<0||!html.slice(changes,changes+4000).includes(rel[1]))fail("první část changelogu neobsahuje aktuální verzi");
const smt=join(DIST,"studio-manifest.template.json");if(existsSync(smt)){const text=readFileSync(smt,"utf-8").replaceAll("__APP_VERSION__",rel[1]).replaceAll("__BUILD_TIME__",new Date().toISOString());JSON.parse(text);writeFileSync(join(DIST,"studio-manifest.json"),text);rmSync(smt)}
writeFileSync(join(DIST,".nojekyll"),"");log(`${APP_NAME}: verze ${rel[1]} · ${jsFiles.length} JS modulů · dist připraven`);
