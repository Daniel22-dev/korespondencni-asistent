import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const foundation=fs.readFileSync(path.join(root,'scripts/garp27/foundation-gate.mjs'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github/workflows/p5-release-gate.yml'),'utf8');
const evidence=fs.readFileSync(path.join(root,'scripts/p5-evidence-gate.mjs'),'utf8');
const foundationChecks=[
 ['garp27-contracts','qa:garp27:contracts'],
 ['garp27-architecture','qa:garp27:architecture'],
 ['garp27-policy-mutations','qa:garp27:policy-mutations'],
 ['garp27-mutations','qa:garp27:mutations'],
 ['garp27-auto-patch','qa:garp27:auto-patch']
];
function requireTrustedStaticGate(text){
 for(const [id,command] of foundationChecks){
  const block="{id:'"+id+"',cmd:['npm','run','"+command+"'],expected:0}";
  assert.ok(text.includes(block),'Missing mandatory late check '+id);
 }
}
test('CI no longer repeats five pre-Foundation GARP27 stages',()=>{
 const s=pkg.scripts['qa:p5:ci'];
 assert.ok(s.includes('npm run qa:garp:bootstrap'));
 assert.ok(s.includes('npm run qa:quality'));
 assert.ok(!s.includes('npm run qa:garp27:static'));
});
test('local interactive QA retains its original early fail-fast GARP static check',()=>{
 assert.ok(pkg.scripts['qa:p5'].includes('npm run qa:garp27:static'));
});
test('GARP27 static definition still contains all five required checks',()=>{
 const s=pkg.scripts['qa:garp27:static'];
 for(const [,command] of foundationChecks) assert.ok(s.includes('npm run '+command));
});
test('trusted, digest-pinned Foundation still executes all five late GARP checks',()=>requireTrustedStaticGate(foundation));
test('weakened or missing mandatory GARP check is rejected by regression',()=>{
 const [id,command]=foundationChecks[0];
 const removed=foundation.replace("{id:'"+id+"',cmd:['npm','run','"+command+"'],expected:0}",'');
 assert.throws(()=>requireTrustedStaticGate(removed),/Missing mandatory/);
});
test('nonzero expected failure may not silently replace a required success check',()=>{
 const [id,command]=foundationChecks[1];
 const changed=foundation.replace("{id:'"+id+"',cmd:['npm','run','"+command+"'],expected:0}",
  "{id:'"+id+"',cmd:['npm','run','"+command+"'],expected:1}");
 assert.throws(()=>requireTrustedStaticGate(changed),/Missing mandatory/);
});
test('exact-source P5 capture precedes mandatory Foundation and release sealing',()=>{
 const a=wf.indexOf('run: node scripts/p5-evidence-gate.mjs capture');
 const b=wf.indexOf('run: npm run qa:garp27:foundation');
 const c=wf.indexOf('run: npm run prepare:pages');
 assert.ok(a>0&&b>a&&c>b);
});
test('Foundation results remain bound to exact source SHA and all 10 validated stages',()=>{
 assert.match(evidence,/validateFoundation\(upstreamFoundation\)/);
 assert.match(evidence,/summary\.steps\.length !== 10/);
 assert.match(evidence,/summary\.sourceIdentity\.value\.toLowerCase\(\) !== sourceCommit/);
 assert.match(evidence,/step\.evidence\?\.sha256 !== sha256\(file\)/);
});
test('browser QA, P5 reports and independent axe are still required',()=>{
 for(const s of ['qa:quality','qa:browser','qa:runtime','qa:ui','qa:xss','qa:axe']){
  assert.ok(pkg.scripts['qa:p5:ci'].includes('npm run '+s),'Required QA missing '+s);
 }
 assert.match(wf,/node scripts\/p5-evidence-gate\.mjs capture/);
 assert.match(evidence,/qa-p5-axe-runtime-report\.json/);
});
