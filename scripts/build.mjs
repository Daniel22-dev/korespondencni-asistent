#!/usr/bin/env node
import {cpSync,rmSync,mkdirSync,readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..'),SRC=join(ROOT,'src'),DIST=join(ROOT,'dist');
const APP_NAME='Diferenciátor pracovních listů a testů',APP_ID='differentiator',CORE_VERSION='1.0.0';
const CORE_DIR=join(ROOT,'vendor',`ghrab-ai-core-${CORE_VERSION}`),CORE_FILE=`ghrab-ai-core-${CORE_VERSION}.js`,CORE_MANIFEST=`ghrab-ai-core-manifest-${CORE_VERSION}.json`;
const TOKENS={css:'/*==SEM_BUILD_VLOZI_STYLES_CSS==*/',body:'<!--==SEM_BUILD_VLOZI_BODY_HTML==-->',js:'/*==SEM_BUILD_VLOZI_JS==*/'};
const log=m=>console.log('[build] '+m),fail=m=>{console.error('[build] CHYBA: '+m);process.exit(1)},sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
for(const f of [CORE_FILE,CORE_MANIFEST])if(!existsSync(join(CORE_DIR,f)))fail('chybí Core artefakt '+f);
const coreManifest=JSON.parse(readFileSync(join(CORE_DIR,CORE_MANIFEST),'utf8'));if(coreManifest.coreVersion!==CORE_VERSION||coreManifest.artifacts?.[CORE_FILE]?.sha256!==sha(join(CORE_DIR,CORE_FILE)))fail('GHRAB AI Core neprošel SHA-256 kontrolou');
rmSync(DIST,{recursive:true,force:true});mkdirSync(DIST,{recursive:true});cpSync(SRC,DIST,{recursive:true});
const tplPath=join(DIST,'index.template.html');let tpl=readFileSync(tplPath,'utf8');for(const token of Object.values(TOKENS))if(!tpl.includes(token))fail('šablona neobsahuje token');
const css=readFileSync(join(DIST,'styles.css'),'utf8'),body=readFileSync(join(DIST,'body.html'),'utf8'),jsDir=join(DIST,'js');
const jsFiles=readdirSync(jsDir).filter(f=>f.endsWith('.js')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const appJs=jsFiles.map(f=>readFileSync(join(jsDir,f),'utf8')).join('\n;\n');
if(/(?:window|globalThis)\.GHRAB_AI\s*=|registerAdapter\s*\(/.test(appJs))fail('aplikační kód obsahuje vlastní implementaci GHRAB_AI');
const js=readFileSync(join(CORE_DIR,CORE_FILE),'utf8')+'\n;\n'+appJs;
const out=tpl.split(TOKENS.css).join(css).split(TOKENS.body).join(body).split(TOKENS.js).join(js);if(out.includes('==SEM_BUILD_VLOZI_'))fail('ve výstupu zůstal build token');
writeFileSync(join(DIST,'index.html'),out);rmSync(tplPath);rmSync(join(DIST,'styles.css'));rmSync(join(DIST,'body.html'));rmSync(jsDir,{recursive:true});rmSync(join(DIST,'README_PWA.md'),{force:true});
let hash='';try{hash=execSync('git rev-parse --short HEAD',{cwd:ROOT,stdio:['ignore','pipe','ignore']}).toString().trim()}catch{}
function* htmlFiles(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())yield* htmlFiles(p);else if(n.endsWith('.html'))yield p}}
if(hash){const re=/(build:\s*)(['"])__BUILD__\2/g;for(const f of htmlFiles(DIST)){const x=readFileSync(f,'utf8');writeFileSync(f,x.replace(re,`$1$2${hash}$2`))}}
const html=readFileSync(join(DIST,'index.html'),'utf8'),sw=readFileSync(join(DIST,'sw.js'),'utf8');const rel=html.match(/version:\s*['"]([\d.]+)['"]/),swm=sw.match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);if(!rel||!swm||rel[1]!==swm[1])fail('nesouhlasí verze RELEASE a service workeru');
const operations=JSON.parse(readFileSync(join(DIST,'ai-operations.json'),'utf8'));if(operations.appId!==APP_ID||operations.appVersion!==rel[1]||operations.coreVersion!==CORE_VERSION||operations.operations.length!==6)fail('neplatný ai-operations.json');for(const op of operations.operations)if(!appJs.includes(`'${op.operation}'`)&&!appJs.includes(`"${op.operation}"`))fail('integrace neobsahuje operaci '+op.operation);
const smt=join(DIST,'studio-manifest.template.json');if(existsSync(smt)){const text=readFileSync(smt,'utf8').replaceAll('__APP_VERSION__',rel[1]).replaceAll('__BUILD_TIME__',new Date().toISOString());const manifest=JSON.parse(text);if(manifest.aiCore?.coreVersion!==CORE_VERSION||manifest.aiCore?.serverReady!==true||manifest.aiCore?.conformancePassed!==true)fail('studio-manifest nemá P1 AI Core metadata');writeFileSync(join(DIST,'studio-manifest.json'),text);rmSync(smt)}
writeFileSync(join(DIST,'.nojekyll'),'');log(`${APP_NAME}: verze ${rel[1]} · Core ${CORE_VERSION} SHA-256 OK · ${operations.operations.length} operací · ${jsFiles.length} modulů`);

// P2: canonical cross-application platform post-processing.
await import("./apply-ghrab-platform.mjs");
