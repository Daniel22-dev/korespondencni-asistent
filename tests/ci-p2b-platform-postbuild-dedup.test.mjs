import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const pipeline=pkg.scripts['qa:p5:ci'];
const school=fs.readFileSync(path.join(root,'scripts/build-school-profile.mjs'),'utf8');
const building=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
test('P5 CI retains production npm build and postbuild platform admission',()=>{
 assert.ok(pipeline.includes('npm run build && npm run qa:school-profile && npm run qa:suite-session'));
 assert.equal(pkg.scripts.postbuild,'node scripts/ghrab-platform-conformance.mjs');
 assert.equal(pkg.scripts.build,'node scripts/build.mjs');
 assert.equal(pkg.scripts['verify:platform'],pkg.scripts.postbuild);
});
test('Only duplicate standalone platform verifier is absent from CI',()=>{
 assert.ok(!pipeline.includes('npm run verify:platform'));
 assert.ok(pkg.scripts['qa:p5'].includes('npm run verify:platform'));
});
test('school-server profile copies original dist and only alters target profile',()=>{
 assert.match(school,/fs\.cpSync\(sourceDist, targetDist, \{ recursive: true \}\)/);
 assert.match(school,/fs\.rmSync\(targetDist, \{ recursive: true, force: true \}\)/);
 assert.ok(!school.includes('fs.rmSync(sourceDist'));
});
test('build remains protected production-mode generation',()=>{
 assert.match(building,/rmSync\(DIST,\{recursive:true,force:true\}\)/);
 assert.match(building,/const TEST_HOOKS_BUILD=process\.argv\.includes\("--test-hooks"\)/);
});
test('quality, browser, ui, axe and release admission are all preserved',()=>{
 for(const cmd of ['qa:quality','qa:browser','qa:runtime','qa:ui','qa:xss','qa:axe','qa-p5-release.mjs','qa-p5-acceptance.mjs']){
 assert.ok(pipeline.includes(cmd),cmd);
 }
});
