import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(root, 'scripts/verify-promotion-workflow-architecture.mjs');
const files = [
  '.github/workflows/p5-release-gate.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/safe-promotion.yml',
  'scripts/garp27/foundation-gate.mjs',
  'scripts/p5-evidence-gate.mjs',
];
function check(file, mutator) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2b-legacy-'));
  try {
    for (const rel of files) {
      const out = path.join(temp, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const old = fs.readFileSync(path.join(root, rel), 'utf8');
      fs.writeFileSync(out, file === rel ? mutator(old) : old);
    }
    return spawnSync(process.execPath, [verifier], { cwd: temp, encoding: 'utf8' });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function replace(needle, replacement) {
  return input => {
    assert.equal(input.split(needle).length, 2, 'fixture must match exactly once');
    return input.replace(needle, replacement);
  };
}
const p5 = '.github/workflows/p5-release-gate.yml';
const foundation = 'scripts/garp27/foundation-gate.mjs';
const evidence = 'scripts/p5-evidence-gate.mjs';
const legacy = "{id:'legacy-garp25-static',cmd:['npm','run','qa:garp25:static'],expected:0}";
test('existing P5 architecture remains GREEN', () => {
  const r = check('', x => x);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PROMOTION WORKFLOW ARCHITECTURE: PASS/);
});
test('second legacy GARP25 execution is rejected', () => {
  const r = check(p5, s => s + '\n      - name: Duplicate static check\n        run: npm run qa:garp25:static\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /qa:garp25:static/);
});
test('no legacy GARP25 foundation execution fails closed', () => {
  const r = check(foundation, replace(legacy, legacy.replace("'qa:garp25:static'", "'noop'")));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /foundation/);
});
test('legacy exit status may not be weakened', () => {
  const r = check(foundation, replace(legacy, legacy.replace('expected:0', 'expected:1')));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /foundation/);
});
test('foundation evidence validator is mandatory', () => {
  const r = check(evidence, replace('validateFoundation(upstreamFoundation);', 'void upstreamFoundation;'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /p5-evidence/);
});
test('P5 must still run GARP27 foundation', () => {
  const r = check(p5, replace('        run: npm run qa:garp27:foundation\n', '        run: echo disabled\n'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /p5/);
});
test('P5 evidence capture remains mandatory', () => {
  const r = check(p5, replace('        run: node scripts/p5-evidence-gate.mjs capture\n', '        run: echo disabled\n'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /p5/);
});
test('P5 must still seal evidence during release preparation', () => {
  const r = check(p5, replace('        run: npm run prepare:pages\n', '        run: echo disabled\n'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /p5/);
});
