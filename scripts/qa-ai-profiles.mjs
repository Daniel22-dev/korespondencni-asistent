#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const expected = ['economy', 'balanced', 'quality'];
const checks = [];
const check = (id, ok, detail='') => checks.push({id, ok:Boolean(ok), detail:String(detail||'')});

function runtimeConfig(rel){
  const sandbox={window:{}};
  vm.runInNewContext(read(rel), sandbox, {filename:rel});
  return sandbox.window.__GHRAB_RUNTIME_CONFIG__;
}

const body=read('src/body.html');
const state=read('src/js/27-ai-runtime-state.js');
const integration=read('src/js/28-ai-integration.js');
const api=read('src/js/30-api-gemini.js');
const promptFlow=read('src/js/50-koncept-a-prompty.js');
const mailFlow=read('src/js/60-prichozi-a-muj-email.js');
const operations=JSON.parse(read('src/ai-operations.json'));
const direct=runtimeConfig('src/runtime-config.js');
const school=runtimeConfig('src/runtime-config.school-server.js');

const uiProfiles=[...body.matchAll(/data-model-profile="([^"]+)"/g)].map(m=>m[1]);
check('ui.exact-three-profiles', JSON.stringify(uiProfiles)===JSON.stringify(expected), uiProfiles.join(','));
check('ui.provider-neutral', !/gemini-[0-9]|modelOverride|id="modelInput"/i.test(body), 'no provider model IDs/free model input');
check('state.profile-only', state.includes('selectedModelProfile')&&state.includes('MODEL_PROFILE_DEFAULT="balanced"')&&!/const MODEL_DEFAULT=|QUALITY_MODEL|FALLBACK_MODELS/.test(state), 'provider-neutral state');
check('integration.no-model-override', !integration.includes('modelOverride')&&!/gemini-[0-9]/i.test(integration), 'Core chooses model from runtime profile map');
check('flows.no-hardcoded-profile', !/modelProfile\s*:\s*"(?:economy|balanced|quality)"/.test(promptFlow+mailFlow), 'user-selected profile remains authoritative');
check('api.request-uses-selected-profile', api.includes('opts.modelProfile||selectedModelProfile'), 'callGemini resolves selectedModelProfile');
check('api.legacy-migration-only', api.includes('migrateStoredModelProfile')&&api.includes('flash-lite')&&api.includes('return "quality"'), 'legacy provider IDs migrate to profiles');

const badOps=[];
for(const op of operations.operations||[]){
  const profiles=op.allowedModelProfiles||[];
  if(JSON.stringify(profiles)!==JSON.stringify(expected)) badOps.push(`${op.operation}:${profiles.join(',')}`);
}
check('operations.all-three-allowed', badOps.length===0, badOps.join(' | ')||`${operations.operations?.length||0} operations`);

const directAi=direct?.ai||{}, map=directAi.directGemini?.profileModels||{};
check('direct.mode', directAi.defaultMode==='direct-gemini'&&Array.isArray(directAi.allowedModes)&&directAi.allowedModes.length===1&&directAi.allowedModes[0]==='direct-gemini', directAi.defaultMode||'');
check('direct.profile-keys', JSON.stringify(Object.keys(map))===JSON.stringify(expected), Object.keys(map).join(','));
check('direct.profile-models-distinct', new Set(expected.map(k=>map[k]).filter(Boolean)).size===3, expected.map(k=>`${k}=${map[k]||''}`).join(' | '));
check('direct.provider-is-runtime-only', expected.every(k=>/^gemini-[a-z0-9.-]+$/i.test(String(map[k]||''))), 'direct runtime owns Gemini IDs');

const schoolAi=school?.ai||{};
check('school.mode', schoolAi.defaultMode==='school-gateway'&&schoolAi.selectedMode==='school-gateway'&&JSON.stringify(schoolAi.allowedModes)===JSON.stringify(['school-gateway']), schoolAi.defaultMode||'');
check('school.provider-neutral', !/gemini-|openai|anthropic|modelOverride/i.test(read('src/runtime-config.school-server.js')), 'no provider/model in school runtime');
check('school.same-profile-contract', integration.includes('modelProfiles:GHRAB_AI.modelProfiles')&&integration.includes('modelProfile'), 'same Core profile contract');

const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({schema:'ghrab-ai-profile-gate-v1',appId:'correspondence',appVersion:operations.appVersion,expectedProfiles:expected,checks,summary:{passed:checks.length-failed.length,failed:failed.length},status:failed.length?'failed':'passed'},null,2));
if(failed.length) process.exit(1);
