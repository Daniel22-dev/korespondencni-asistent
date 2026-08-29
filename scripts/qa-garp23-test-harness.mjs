#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {evidenceRoot}=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR||'garp23-release-gate');
const source=fs.readFileSync(path.join(root,'scripts','test.mjs'),'utf8');
function inspect(text){
  const jsdomUrl=/url:`http:\/\/127\.0\.0\.1\/\$\{REPO\}\/`/.test(text);
  const autoQuery=/JSDOM[\s\S]{0,1600}\?test=1/.test(text);
  const manualSuite=text.includes('SUITE="__GHRAB_KORESP_TESTS__.open(false); __GHRAB_KORESP_TESTS__.run()"');
  return {jsdomUrl,autoQuery,manualSuite,passed:jsdomUrl&&!autoQuery&&manualSuite};
}
const clean=inspect(source);
const mutated=inspect(source.replace('url:`http://127.0.0.1/${REPO}/`','url:`http://127.0.0.1/${REPO}/?test=1`'));
const result={schema:'garp23-test-harness-gate-v1',generatedAt:new Date().toISOString(),clean,negativeControl:{mutation:'restore ?test=1 on JSDOM URL',expected:'FAIL',observed:mutated.passed?'PASS':'FAIL'},status:clean.passed&&!mutated.passed?'passed':'failed'};
fs.mkdirSync(evidenceRoot,{recursive:true});fs.writeFileSync(path.join(evidenceRoot,'test-harness-gate.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.status!=='passed')process.exit(1);
