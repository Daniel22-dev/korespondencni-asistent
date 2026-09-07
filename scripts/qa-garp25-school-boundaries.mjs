#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root=process.cwd(); const failures=[]; const checks=[];
function check(id,ok,detail=''){checks.push({id,status:ok?'PASS':'FAIL',detail}); if(!ok)failures.push(id);}
const deploy=JSON.parse(fs.readFileSync(path.join(root,'src/config/deployment.school-server.json'),'utf8'));
check('GH05-profile',deploy.profile==='school-server'&&deploy.authMode==='server-session'&&deploy.aiTransport==='school-gateway',JSON.stringify({profile:deploy.profile,authMode:deploy.authMode,aiTransport:deploy.aiTransport}));
check('GH05-local-provider-config',deploy.features?.allowLocalProviderKeys===false,'features.allowLocalProviderKeys='+deploy.features?.allowLocalProviderKeys);

const runtimeSource=fs.readFileSync(path.join(root,'src/runtime-config.school-server.js'),'utf8');
const runtimeCtx={window:{}}; vm.runInNewContext(runtimeSource,runtimeCtx,{filename:'runtime-config.school-server.js'});
const runtime=runtimeCtx.window.__GHRAB_RUNTIME_CONFIG__;
check('GH05-runtime-allowlist',runtime.ai.defaultMode==='school-gateway'&&runtime.ai.allowedModes.length===1&&runtime.ai.allowedModes[0]==='school-gateway'&&runtime.ai.allowUserModeSelection===false,JSON.stringify(runtime.ai));
check('GH05-provider-neutral-runtime',!/gemini-|openai|anthropic|generativelanguage\.googleapis\.com/i.test(runtimeSource),'school runtime has no provider/model literal');

// GHNC-05: configure the real Core under school runtime while a synthetic local-key provider exists,
// then attempt to switch to direct-gemini. The mode switch must fail before credentials can be used.
const coreSource=fs.readFileSync(path.join(root,'vendor/ghrab-ai-core-1.0.0/ghrab-ai-core-1.0.0.js'),'utf8');
let credentialCalls=0;
class CustomEvent { constructor(type,init={}){this.type=type;this.detail=init.detail;} }
const win={crypto:globalThis.crypto,TextEncoder,TextDecoder,AbortController,CustomEvent,dispatchEvent(){},document:{documentElement:{lang:'cs-CZ'}}}; win.window=win;
const context={window:win,CustomEvent,TextEncoder,TextDecoder,AbortController,console,URL,fetch:async()=>{throw new Error('NETWORK_MUST_NOT_BE_USED');},setTimeout,clearTimeout};
vm.runInNewContext(coreSource,context,{filename:'ghrab-ai-core-1.0.0.js'});
const ai=context.window.GHRAB_AI;
ai.configure({
  app:{id:'correspondence',version:'5.10.25'},runtimeConfig:runtime,
  operations:{schema:'ghrab-ai-operations-v1',appId:'correspondence',operations:{probe:{outputSchemaId:'correspondence.probe.v1',defaultModelProfile:'balanced',allowedModelProfiles:['balanced'],inputTypes:['text'],streaming:false,expectedOutputs:1,maxOutputTokensHint:256}}},
  outputSchemas:{'correspondence.probe.v1':{type:'object'}},
  credentialProvider:async()=>{credentialCalls++;return {apiKey:'SYNTHETIC-GHNC05-KEY-NOT-REAL'};},
  authProvider:async()=>({authenticated:true})
});
let switchDenied=false, switchCode='';
try{ai.setMode('direct-gemini');}catch(e){switchDenied=true;switchCode=String(e?.code||e?.message||'');}
check('GHNC-05-direct-mode-runtime-denied',switchDenied&&ai.getState().activeMode==='school-gateway',`active=${ai.getState().activeMode}; error=${switchCode}`);
check('GHNC-05-local-key-not-consumed',credentialCalls===0,'credentialCalls='+credentialCalls);

// SHNC-07 client-side resource abuse: actual Core must reject an oversized text part
// before auth/credential/network work. This is PREP coverage only; school-server rate/concurrency
// enforcement remains SHIELD-LIVE NOT TESTED.
let oversizeDenied=false, oversizeCode='';
try{
  await ai.generate({operation:'probe',modelProfile:'balanced',outputSchemaId:'correspondence.probe.v1',inputParts:[{type:'text',text:'x'.repeat(runtime.ai.maxPartBytes+1)}]});
}catch(e){oversizeDenied=true;oversizeCode=String(e?.code||e?.message||'');}
check('SHNC-07-client-oversize-bounded-deny',oversizeDenied&&oversizeCode.includes('PAYLOAD_TOO_LARGE')&&credentialCalls===0,`error=${oversizeCode}; credentialCalls=${credentialCalls}; maxPartBytes=${runtime.ai.maxPartBytes}`);

const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.webmanifest'),'utf8'));
const schoolManifest=JSON.parse(fs.readFileSync(path.join(root,'dist-school-server/manifest.webmanifest'),'utf8'));
check('GH08-PWA-stable-id',!String(manifest.id).includes('5.10.')&&manifest.start_url==='./'&&manifest.scope==='./'&&schoolManifest.id==='./'&&schoolManifest.start_url==='./'&&schoolManifest.scope==='./',JSON.stringify({sourceId:manifest.id,schoolId:schoolManifest.id,start_url:manifest.start_url,scope:manifest.scope}));

const jsFiles=[]; function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.js'))jsFiles.push(p);}} walk(path.join(root,'src','js'));
const appCode=jsFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const agentPatterns=[/\bMCP\b/i,/\btool[_-]?calls?\b/i,/\bfunction[_-]?calls?\b/i,/from\s+['\"]node:child_process['\"]/i,/require\(['\"]child_process['\"]\)/i,/\bDeno\.(?:run|Command)\b/,/\bBun\.spawn\b/,/requiredCapabilities\s*:\s*\[(?!\s*\])/];
const agentHits=agentPatterns.filter(r=>r.test(appCode)).map(String);
const generateCalls=(appCode.match(/GHRAB_AI\.generate\s*\(/g)||[]).length;
check('GH14-agentic-no',agentHits.length===0&&generateCalls>0,`GHRAB_AI.generate=${generateCalls}; agentHits=${agentHits.join(',')||'none'}`);

const out={schema:'ghrab-ks-garp25-school-boundaries-v1',appId:'correspondence',version:'5.10.25',syntheticOnly:true,checks,summary:{total:checks.length,passed:checks.length-failures.length,failed:failures.length,status:failures.length?'FAIL':'PASS'}};
const outPath=path.join(root,'audit-evidence/garp25-shield-prep/school-boundaries.json');fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));process.exit(failures.length?1:0);
