import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/p5-release-gate.yml'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
const foundation=fs.readFileSync(path.join(root,'scripts/garp27/foundation-gate.mjs'),'utf8');
const marker='echo "GHRAB_BUILD_TIME=$stamp" >> "$GITHUB_ENV"';

test('explicit build time is established before any P5 build or Foundation',()=>{
 const set=workflow.indexOf(marker),p5=workflow.indexOf('run: npm run qa:p5:ci');
 const garp=workflow.indexOf('run: npm run qa:garp27:foundation');
 assert.ok(set>0 && p5>set && garp>p5);
});
test('GitHub environment file receives a single timestamp value',()=>{
 assert.equal(workflow.split(marker).length-1,1);
 assert.match(workflow,/stamp="\$\(node -e 'process\.stdout\.write\(new Date\(\)\.toISOString\(\)\)'\)"/);
});
test('timestamp format validation is explicit, with fail-closed shell setup',()=>{
 assert.match(workflow,/set -euo pipefail/);
 assert.match(workflow,/\[0-9\]\{3\}Z\$/);
 assert.match(workflow,/\]\] \|\| exit 1/);
});
test('builder interpolates supplied GHRAB_BUILD_TIME in studio manifest',()=>{
 assert.match(builder,/process\.env\.GHRAB_BUILD_TIME \|\| new Date\(\)\.toISOString\(\)/);
 assert.match(builder,/replaceAll\("__BUILD_TIME__",BUILD_TIME\)/);
});
test('GARP Foundation uses inherited environment, not an isolated new build timestamp',()=>{
 assert.match(foundation,/env:process\.env/);
 assert.match(foundation,/\{id:'build-production',cmd:\['npm','run','build'\],expected:0\}/);
});
test('no mandatory P5 or release evidence step was removed',()=>{
 for(const token of [
   'run: npm run qa:p5:ci',
   'run: node scripts/p5-evidence-gate.mjs capture',
   'run: npm run qa:garp27:foundation',
   'run: node scripts/ci-p2b-build-parity.mjs',
   'run: npm run prepare:pages'
 ]) assert.ok(workflow.includes(token),token);
});
