#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
const root=path.resolve('.');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR);
const out=path.join(evidenceRoot,'static-surface-assertions.json');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const walk=(dir)=>{const result=[];if(!fs.existsSync(dir))return result;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...walk(p));else result.push(p);}return result;};
const checks=[];const check=(id,ok,detail={})=>checks.push({id,ok:!!ok,detail});

// Supply chain / RT-16.
const workflows=walk(path.join(root,'.github','workflows')).filter(x=>/\.ya?ml$/i.test(x));
const uses=[];for(const f of workflows){const txt=fs.readFileSync(f,'utf8');for(const m of txt.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm))uses.push({file:path.relative(root,f),value:m[1]});}
const unpinned=uses.filter(x=>!x.value.startsWith('./')&&!/@[0-9a-f]{40}$/i.test(x.value));
check('supply-chain.actions-pinned',unpinned.length===0,{count:uses.length,unpinned});
const lock=JSON.parse(read('package-lock.json'));const lockEntries=Object.entries(lock.packages||{}).filter(([k,v])=>k&&v&&v.resolved);const missingIntegrity=lockEntries.filter(([,v])=>!v.integrity).map(([k])=>k);const offRegistry=lockEntries.filter(([,v])=>!String(v.resolved).startsWith('https://registry.npmjs.org/')).map(([k,v])=>({path:k,resolved:v.resolved}));
check('supply-chain.lock-integrity',missingIntegrity.length===0&&offRegistry.length===0,{resolved:lockEntries.length,missingIntegrity,offRegistry});
const deployWorkflow=read('.github/workflows/deploy.yml');
check('release-integrity.deploy-removes-qa-metadata',deployWorkflow.includes('rm -f dist/quality-report.json')&&deployWorkflow.includes('rm -f dist/qa-*-report.json')&&deployWorkflow.includes('rm -f dist/config/quality-manifest.json'));

const sourceFiles=walk(path.join(root,'src')).filter(f=>/\.(?:js|html)$/i.test(f));const source=sourceFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const jsSource=walk(path.join(root,'src','js')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const sw=read('src/sw.js');
const dist=read('dist/index.html');
const security=JSON.parse(read('src/config/security-headers.json'));
const manifest=JSON.parse(read('src/config/data-manifest.json'));
const reporter=read('src/access/error-reporter.js');
const gitignore=read('.gitignore');
const build=read('scripts/build.mjs');

// RT-12 / RT-13 browser boundary.
check('rt12.no-window-postmessage',!/\bwindow\.postMessage\s*\(/.test(source));
check('rt12.no-iframes',!/<iframe\b/i.test(source));
const blankTags=[...source.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].map(m=>m[0]);
check('rt12.target-blank-noopener',blankTags.every(x=>/rel=["'][^"']*noopener/i.test(x)),{links:blankTags.length});
check('rt12.window-open-noopener',!/window\.open\s*\([^\n;]*?\)(?![\s\S]{0,160}noopener)/.test(reporter),{note:'Reporter uses explicit noreferrer/noopener open helper; static heuristic guards regression.'});
check('rt13.no-unsafe-eval',!security.staticProfile.contentSecurityPolicy.includes("'unsafe-eval'"));
check('rt13.no-eval',!/(^|[^.\w])eval\s*\(/m.test(jsSource));
check('rt13.no-new-function',!/new\s+Function\s*\(/.test(jsSource));
const metaCsp=(dist.match(/<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content="([^"]*)"/i)||[])[1]||'';
check('rt13.csp-single-source-parity',metaCsp===security.staticProfile.contentSecurityPolicy,{metaCsp,configured:security.staticProfile.contentSecurityPolicy});
check('rt13.csp-build-source-of-truth',build.includes('__GHRAB_STATIC_CSP__')&&build.includes('security-headers.json'));

// C-03: production bundle may contain test support code but compile-time gate must be OFF.
const prodFlag=/const TEST_HOOKS_BUILD_ENABLED="0"==="1";/.test(dist);
const testFlagOn=/const TEST_HOOKS_BUILD_ENABLED="1"==="1";/.test(dist);
check('rt09.production-ai-test-hooks-disabled',prodFlag&&!testFlagOn,{prodFlag,testFlagOn});
check('rt09.production-core-testing-api-not-exported',!/__testing:\s*testing/.test(dist),{note:'The vendor Core keeps its internal testing object lexically private; production build strips the public __testing export.'});
check('rt09.runtime-replace-for-testing-gated',jsSource.includes('if(!TEST_HOOKS_BUILD_ENABLED||!isTrustedLocalTestOrigin())return false;'));
check('rt09.test-hooks-local-origin-gated',jsSource.includes('isTrustedLocalTestOrigin()')&&jsSource.includes('TEST_HOOKS_BUILD_ENABLED&&isTrustedLocalTestOrigin()'));

// PC-01 egress/import surfaces.
const aiCalls=[...jsSource.matchAll(/\bGHRAB_AI\.generate\s*\(/g)];
check('rt19.single-production-egress',aiCalls.length===1,{count:aiCalls.length});
const fileReaders=[...jsSource.matchAll(/new\s+FileReader\s*\(/g)];
check('pc01.three-app-file-reader-paths',fileReaders.length===3,{count:fileReaders.length,note:'Counts application src/js only; the reporter screenshot reader is inventoried separately in RT-00.'});
check('rt20.sw-bypasses-non-get',/request\.method\s*!==\s*["']GET["']/.test(sw));
check('rt20.no-indexeddb-path',!/\bindexedDB\b/i.test(source));

// C-01/C-04/C-05/C-06 truth and fail-safe support.
check('rt20.endwork-verifies-deletion',jsSource.includes('remainingOwnedKeys')&&jsSource.includes('removeFailures')&&jsSource.includes('return ok&&reloadOk'));
check('rt20.reporter-clear-draft-public',reporter.includes('clearDraft: () => { resetDraft(); return true; }')&&jsSource.includes('GHRABErrorReporter.clearDraft'));
const hasPromptStore=manifest.stores.some(s=>Array.isArray(s.patterns)&&s.patterns.includes('rozbor_last_prompt_debug'));
const hasBridgeStore=manifest.stores.some(s=>Array.isArray(s.patterns)&&s.patterns.includes('ghrab.handoff.v1')&&s.patterns.includes('ghrab.pilot.events.v2'));
const hasFetchFlow=Array.isArray(manifest.dataFlows)&&manifest.dataFlows.some(f=>f.id==='error-reporter-fetch-wrapper'&&Array.isArray(f.doesNotRecord)&&f.doesNotRecord.includes('request body')&&f.doesNotRecord.includes('request headers'));
check('rt00.manifest-prompt-debug-declared',hasPromptStore);
check('rt00.manifest-studio-bridge-declared',hasBridgeStore);
check('rt00.manifest-fetch-wrapper-declared',hasFetchFlow);
check('evidence.audit-logs-trackable',gitignore.includes('!audit-evidence/**/*.log'));

const warnings=[];
if(security.staticProfile.contentSecurityPolicy.includes("'unsafe-inline'"))warnings.push({id:'rt13.csp-unsafe-inline',detail:'Known compatibility debt; still present and tracked. Production test hooks are separately build-disabled.'});

check('rt09.production-test-runner-not-window-exported',!jsSource.includes('window.runKorespTests=')&&!jsSource.includes('window.openTestRunner='),{note:'The destructive in-app runner is not exported on window.'});
check('rt09.test-runner-build-and-origin-gated',jsSource.includes('function testRunnerAvailable(){return TEST_HOOKS_BUILD_ENABLED&&isTrustedLocalTestOrigin();}')&&jsSource.includes('if(!testRunnerAvailable())throw new Error("TEST_RUNNER_DISABLED")'),{note:'Even lexical access fails closed outside a local test build.'});
check('rt09.production-test-runner-payload-stripped',dist.includes('TEST_RUNNER_NOT_INCLUDED_IN_PRODUCTION')&&!dist.includes('__GHRAB_KORESP_TESTS__=Object.freeze')&&!dist.includes('AI-RED tone-check výstup zůstává při refinementu nedůvěryhodný')&&build.includes('TEST_RUNNER_START')&&build.includes('TEST_RUNNER_END'),{note:'Production ships only fail-closed runner stubs; full internal runner remains test-build only.'});
check('rt20.fixed-canary-values-not-bundled',!jsSource.includes('GARP-STUDENT-CANARY-ENDWORK-A')&&!jsSource.includes('GARP-STUDENT-CANARY-ENDWORK-B'),{note:'End-work regression canaries are generated at runtime.'});

const failed=checks.filter(x=>!x.ok);
const result={schema:'garp22-static-assertions-v2',generatedAt:new Date().toISOString(),checks,warnings,summary:{passed:checks.length-failed.length,failed:failed.length,total:checks.length,status:failed.length?'failed':'passed'}};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(failed.length)process.exit(1);
