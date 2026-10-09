import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'p5-evidence-gate.mjs');
const SHA = 'a'.repeat(40);
const VERSION = '5.10.34';
const REPORTS = [
  'quality-report.json', 'qa-p3-browser-report.json', 'qa-p5-runtime-report.json',
  'qa-p5-ui-interactions-report.json', 'qa-p5-xss-sinks-report.json',
  'qa-p5-axe-runtime-report.json', 'qa-p5-release-report.json', 'qa-p5-acceptance-report.json',
];
const IDS = ['build-production', 'garp27-contracts', 'garp27-architecture', 'garp27-policy-mutations', 'garp27-mutations', 'garp27-auto-patch', 'legacy-garp25-static', 'promotion-architecture', 'studio-dispatch-contract', 'assurance-admission'];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const mkdir = file => fs.mkdirSync(path.dirname(file), { recursive: true });
function write(file, content) { mkdir(file); fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n'); }
function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-p5-evidence-'));
  write(path.join(root, 'package.json'), { version: VERSION });
  write(path.join(root, 'dist', 'index.html'), '<!doctype html><title>Tested build</title>');
  write(path.join(root, 'dist', 'studio-manifest.json'), { id: 'correspondence', version: VERSION });
  for (const name of REPORTS) {
    const data = { schema: 'fixture-v1', appId: 'correspondence', appVersion: VERSION, status: 'passed', summary: { total: 5, failed: 0 } };
    if (name === 'quality-report.json') delete data.status;
    if (name === 'qa-p5-release-report.json') Object.assign(data, { axeRequired: true, checks: [{ id: 'axe', ok: true }] });
    if (name === 'qa-p5-acceptance-report.json') Object.assign(data, { passed: [{ id: 'acceptance' }] });
    if (name === 'qa-p5-ui-interactions-report.json') Object.assign(data, { actualProtectedUnlock: true, trustedMouseClicks: true });
    if (['qa-p5-runtime-report.json', 'qa-p5-axe-runtime-report.json'].includes(name)) Object.assign(data, { scriptsExecuted: true, transport: 'local-http', summary: { failed: 0, blockers: 0 } });
    write(path.join(root, 'dist', name), data);
  }
  const foundation = path.join(root, 'audit-evidence', 'garp27-current');
  const steps = IDS.map(id => {
    const log = path.join(foundation, id === 'assurance-admission' ? 'assurance-validation.log' : `${id}.log`);
    write(log, `Run ${id} PASS\n`);
    return { id, pass: true, actualExit: 0, evidence: { id, sha256: digest(log) } };
  });
  const identity = { appId: 'correspondence', appVersion: VERSION, sourceCommit: SHA };
  write(path.join(foundation, 'foundation-summary.json'), { schema: 'garp27-foundation-summary-v1', appId: 'correspondence', appVersion: VERSION, status: 'FOUNDATION_PASS_LIVE_NOT_TESTED', sourceIdentity: { kind: 'git-commit', value: SHA }, steps, summary: { failed: 0, passed: steps.length } });
  write(path.join(foundation, 'resolved-migration-profile.json'), { releaseIdentity: identity });
  write(path.join(foundation, 'assurance-status.json'), { releaseIdentity: identity });
  return root;
}
function run(root, mode, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, mode, '--root', root], { encoding: 'utf8', env: { ...process.env, GHRAB_SOURCE_COMMIT: SHA, GITHUB_SHA: '', GITHUB_RUN_ID: '12345', GHRAB_P5_RUN_ID: '', ...env } });
}
function pass(output) { assert.equal(output.status, 0, `stderr: ${output.stderr}\nstdout: ${output.stdout}`); }
function rejected(output, reason) { assert.notEqual(output.status, 0, `should fail closed: ${reason}`); assert.match(output.stderr, /P5 evidence FAIL/); }
async function fixtureCase(t, fn) {
  const root = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await fn(root);
}

test('captures 8 complete P5 reports, survives rebuild and seals GARP evidence', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'qa-results/current/p5/p5-evidence-receipt.json'), 'utf8'));
  assert.equal(receipt.sourceCommit, SHA);
  assert.equal(receipt.reports.length, REPORTS.length);
  assert.equal(receipt.testedBuild.length, 2);
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  write(path.join(root, 'dist/studio-manifest.json'), { id: 'correspondence', version: VERSION });
  pass(run(root, 'seal'));
  pass(run(root, 'verify'));
  assert.ok(fs.existsSync(path.join(root, 'qa-results/current/garp27/foundation-summary.json')));
  assert.ok(!fs.existsSync(path.join(root, 'dist/qa-p5-runtime-report.json')));
}));

test('missing P5 runtime report is fail-closed', t => fixtureCase(t, root => {
  fs.rmSync(path.join(root, 'dist/qa-p5-runtime-report.json'));
  rejected(run(root, 'capture'), 'missing runtime');
}));

test('failed P5 report is fail-closed', t => fixtureCase(t, root => {
  const file = path.join(root, 'dist/qa-p5-release-report.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.status = 'failed';
  write(file, data);
  rejected(run(root, 'capture'), 'failed P5');
}));

test('missing required axe signal is fail-closed', t => fixtureCase(t, root => {
  const file = path.join(root, 'dist/qa-p5-release-report.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.axeRequired = false;
  write(file, data);
  rejected(run(root, 'capture'), 'axe not required');
}));

test('wrong source SHA cannot reuse captured evidence', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  rejected(run(root, 'seal', { GHRAB_SOURCE_COMMIT: 'b'.repeat(40) }), 'wrong SHA');
}));

test('wrong origin workflow run ID cannot reuse captured evidence', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  rejected(run(root, 'seal', { GHRAB_P5_RUN_ID: '99999' }), 'wrong origin run');
}));

test('P5 evidence tampering is fail-closed', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  fs.appendFileSync(path.join(root, 'qa-results/current/p5/qa-p5-runtime-report.json'), ' ');
  rejected(run(root, 'seal'), 'tampered report');
}));

test('foundation summary without required step is fail-closed', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  const file = path.join(root, 'audit-evidence/garp27-current/foundation-summary.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.steps.pop();
  write(file, data);
  rejected(run(root, 'seal'), 'missing GARP foundation step');
}));

test('foundation with wrong SHA is fail-closed', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  const file = path.join(root, 'audit-evidence/garp27-current/foundation-summary.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.sourceIdentity.value = 'b'.repeat(40);
  write(file, data);
  rejected(run(root, 'seal'), 'GARP foundation SHA drift');
}));

test('foundation log digest mismatch is fail-closed', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  fs.appendFileSync(path.join(root, 'audit-evidence/garp27-current/garp27-contracts.log'), 'tamper');
  rejected(run(root, 'seal'), 'GARP log tampered');
}));

test('sealed foundation tampering is fail-closed', t => fixtureCase(t, root => {
  pass(run(root, 'capture'));
  pass(run(root, 'seal'));
  fs.appendFileSync(path.join(root, 'qa-results/current/garp27/garp27-contracts.log'), 'tamper');
  rejected(run(root, 'verify'), 'sealed foundation tampered');
}));
