#!/usr/bin/env node
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=join(dirname(fileURLToPath(import.meta.url)),"..");
const SRC=join(ROOT,"src"), DIST=join(ROOT,"dist");
const CORE_VERSION="1.0.0",CORE_DIR=join(ROOT,"vendor",`ghrab-ai-core-${CORE_VERSION}`);
const CORE_FILE=`ghrab-ai-core-${CORE_VERSION}.js`,CONFORMANCE_FILE=`ghrab-ai-conformance-${CORE_VERSION}.js`,CORE_MANIFEST=`ghrab-ai-core-manifest-${CORE_VERSION}.json`;
const APP_NAME="Korespondenční asistent";
const TOKENS={css:"/*==SEM_BUILD_VLOZI_STYLES_CSS==*/",body:"<!--==SEM_BUILD_VLOZI_BODY_HTML==-->",js:"/*==SEM_BUILD_VLOZI_JS==*/"};
const log=m=>console.log("[build] "+m);const fail=m=>{console.error("[build] CHYBA: "+m);process.exit(1)};
const sha=file=>createHash("sha256").update(readFileSync(file)).digest("hex");

for(const required of [CORE_FILE,CONFORMANCE_FILE,CORE_MANIFEST])if(!existsSync(join(CORE_DIR,required)))fail("chybí vydaný Core artefakt "+required);
let coreManifest;try{coreManifest=JSON.parse(readFileSync(join(CORE_DIR,CORE_MANIFEST),"utf-8"));}catch{fail("Core manifest není platný JSON");}
if(coreManifest.schema!=="ghrab-ai-core-release-v1"||coreManifest.coreVersion!==CORE_VERSION)fail("neplatný GHRAB AI Core manifest");
for(const file of [CORE_FILE,CONFORMANCE_FILE]){
  const expected=coreManifest.artifacts?.[file]?.sha256,actual=sha(join(CORE_DIR,file));
  if(!expected||actual!==expected)fail("SHA-256 nesouhlasí pro "+file);
}

rmSync(DIST,{recursive:true,force:true});mkdirSync(DIST,{recursive:true});cpSync(SRC,DIST,{recursive:true});
const tplPath=join(DIST,"index.template.html");if(!existsSync(tplPath))fail("chybí src/index.template.html");
let tpl=readFileSync(tplPath,"utf-8");for(const [name,token] of Object.entries(TOKENS))if(!tpl.includes(token))fail("šablona neobsahuje token "+name);
const css=readFileSync(join(DIST,"styles.css"),"utf-8"),body=readFileSync(join(DIST,"body.html"),"utf-8"),jsDir=join(DIST,"js");
const jsFiles=readdirSync(jsDir).filter(f=>f.endsWith(".js")).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(!jsFiles.length)fail("složka js je prázdná");
const appJs=jsFiles.map(f=>readFileSync(join(jsDir,f),"utf-8")).join("\n;\n");
if(/(?:window|globalThis)\.GHRAB_AI\s*=|registerAdapter\s*\(/.test(appJs))fail("aplikační kód obsahuje vlastní implementaci GHRAB_AI nebo adaptéru");
const coreJs=readFileSync(join(CORE_DIR,CORE_FILE),"utf-8");
const js=coreJs+"\n;\n"+appJs;
const out=tpl.split(TOKENS.css).join(css).split(TOKENS.body).join(body).split(TOKENS.js).join(js);if(out.includes("==SEM_BUILD_VLOZI_"))fail("ve výstupu zůstal build token");
writeFileSync(join(DIST,"index.html"),out);rmSync(tplPath);rmSync(join(DIST,"styles.css"));rmSync(join(DIST,"body.html"));rmSync(jsDir,{recursive:true});rmSync(join(DIST,"README_PWA.md"),{force:true});
let hash="";try{hash=execSync("git rev-parse --short HEAD",{cwd:ROOT,stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{}
function* htmlFiles(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())yield* htmlFiles(p);else if(n.endsWith(".html"))yield p}}
if(hash){const re=/(build:\s*)(['"])__BUILD__\2/g;for(const f of htmlFiles(DIST)){const x=readFileSync(f,"utf-8");if(re.test(x)){re.lastIndex=0;writeFileSync(f,x.replace(re,`$1$2${hash}$2`))}}}
const html=readFileSync(join(DIST,"index.html"),"utf-8"),sw=readFileSync(join(DIST,"sw.js"),"utf-8");
const rel=html.match(/version:\s*['"]([\d.]+)['"]/),swm=sw.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);if(!rel||!swm)fail("nelze načíst verzi");if(rel[1]!==swm[1])fail(`RELEASE ${rel[1]} nesedí s APP_VERSION ${swm[1]}`);
const changes=html.indexOf("changes:");if(changes<0||!html.slice(changes,changes+5000).includes(rel[1]))fail("první část changelogu neobsahuje aktuální verzi");
const smt=join(DIST,"studio-manifest.template.json");if(existsSync(smt)){const text=readFileSync(smt,"utf-8").replaceAll("__APP_VERSION__",rel[1]).replaceAll("__BUILD_TIME__",new Date().toISOString());JSON.parse(text);writeFileSync(join(DIST,"studio-manifest.json"),text);rmSync(smt)}
writeFileSync(join(DIST,".nojekyll"),"");log(`${APP_NAME}: verze ${rel[1]} · Core ${CORE_VERSION} ověřen SHA-256 · ${jsFiles.length} aplikačních JS modulů · dist připraven`);
