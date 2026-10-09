import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const deploy=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');
const p5=fs.readFileSync(path.join(root,'.github/workflows/p5-release-gate.yml'),'utf8');
const script=fs.readFileSync(path.join(root,'scripts/ci-p2b-release-drift-guard.mjs'),'utf8');
function ordered(...parts){const at=parts.map(p=>deploy.indexOf(p));assert.ok(at.every(i=>i>=0));assert.deepEqual(at,[...at].sort((a,b)=>a-b))}
test('deployment only from successful exact main P5 push',()=>{assert.doesNotMatch(deploy,/^\s+workflow_dispatch:/m);assert.match(deploy,/workflow_run\.conclusion == 'success'/);assert.match(deploy,/workflow_run\.head_branch == 'main'/)});
test('restore same-run P5 inventory before independent rebuild',()=>{ordered('Restore current P5 evidence from the triggering run','Restore complete P5 tested-tree inventory','Rebuild verified commit','Prepare canonical Pages artifact and exact release identity');assert.match(deploy,/p2b-full-dist-parity-\$\{SOURCE_SHA\}/);assert.match(deploy,/sha256sum/);assert.match(deploy,/P2B_SOURCE_TREE:/)});
test('guard and GARP evidence archive block Pages deployment',()=>{ordered('Guard independent release build against cross-run drift','Archive separate release GARP proof outside Pages','actions/upload-pages-artifact@');assert.match(deploy,/if-no-files-found: error/);assert.match(deploy,/retention-days: 30/);assert.match(deploy,/node scripts\/p5-evidence-gate\.mjs verify/)});
test('trusted Foundation, P5, axe and live verification retained',()=>{assert.match(deploy,/npm run qa:garp27:foundation/);assert.match(deploy,/npm run prepare:pages/);assert.match(deploy,/Verify the live release before notifying AI Studio/);assert.match(p5,/npm run qa:p5:ci/);assert.match(p5,/npm run qa:garp27:foundation/);assert.match(p5,/p2b-full-dist-parity/);});
test('guard rejects unreviewed file drift and unsafe QA disclosure',()=>{assert.match(script,/Application byte drift:/);assert.match(script,/Unreviewed semantic\/byte drift:/);assert.match(script,/QA report published:/);assert.match(script,/Symlink or special file/);assert.match(script,/artifact digest mismatch/);assert.match(script,/NOT_PRESENT/);});
