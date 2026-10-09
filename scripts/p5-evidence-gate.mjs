#!/usr/bin/env node
// Preserve and verify the independent P5 and GARP 2.7 evidence before public release packaging.
// No QA output is copied to dist/ or to the public Pages artifact.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const rootIndex = process.argv.indexOf('--root');
if (!['capture', 'seal', 'verify'].includes(mode) || (rootIndex >= 0 && !process.argv[rootIndex + 1])) {
  console.error('Usage: node scripts/p5-evidence-gate.mjs <capture|seal|verify> [--root <test-dir>]');
  process.exit(2);
}
const root = path.resolve(rootIndex >= 0 ? process.argv[rootIndex + 1] : '.');
const evidenceRoot = path.join(root, 'qa-results', 'current');
const p5Root = path.join(evidenceRoot, 'p5');
const foundationRoot = path.join(evidenceRoot, 'garp27');
const upstreamFoundation = path.join(root, 'audit-evidence', 'garp27-current');
const APP_ID = 'correspondence';
const requiredReports = Object.freeze([
  'quality-report.json',
  'qa-p3-browser-report.json',
  'qa-p5-runtime-report.json',
  'qa-p5-ui-interactions-report.json',
  'qa-p5-xss-sinks-report.json',
  'qa-p5-axe-runtime-report.json',
  'qa-p5-release-report.json',
  'qa-p5-acceptance-report.json',
]);
const fail = message => { throw new Error(`P5 evidence FAIL: ${message}`); };
const regularFile = file => {
  let s;
  try { s = fs.lstatSync(file); } catch { fail(`Missing evidence: ${path.relative(root, file)}`); }
  if (!s.isFile() || s.size === 0) fail(`Not a nonempty regular file: ${path.relative(root, file)}`);
  return s;
};
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = file => {
  regularFile(file);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { fail(`Invalid JSON: ${path.relative(root, file)}`); }
};
const version = json(path.join(root, 'package.json')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail('Invalid package version.');
const shaRegex = /^[a-f0-9]{40}$/i;
const rawSha = String(process.env.GHRAB_SOURCE_COMMIT || process.env.GITHUB_SHA || '').trim();
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const gitSha = git.status === 0 ? String(git.stdout || '').trim().toLowerCase() : '';
const sourceCommit = (rawSha || gitSha).toLowerCase();
if (!shaRegex.test(sourceCommit)) fail('A valid exact 40-character source commit is required.');
if (shaRegex.test(gitSha) && gitSha !== sourceCommit) fail(`Checked-out HEAD ${gitSha} is not source commit ${sourceCommit}.`);
const runId = String(process.env.GITHUB_RUN_ID || 'local').trim();
const expectedP5RunId = String(process.env.GHRAB_P5_RUN_ID || '').trim();

function validateReport(name, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.schema !== 'string') fail(`${name}: missing report schema.`);
  if (data.appId !== APP_ID) fail(`${name}: appId mismatch.`);
  if (data.appVersion != null && data.appVersion !== version) fail(`${name}: version mismatch.`);
  if (name === 'quality-report.json') {
    if (!data.summary || !Number.isInteger(data.summary.failed) || data.summary.failed !== 0) fail(`${name}: quality failures or missing summary.`);
  } else if (data.status !== 'passed' && data.status !== 'pass') {
    fail(`${name}: status is not passed.`);
  }
  for (const field of ['failed', 'blockers']) {
    if (data.summary?.[field] != null && (!Number.isInteger(data.summary[field]) || data.summary[field] !== 0)) fail(`${name}: ${field} is not zero.`);
  }
  if (name === 'qa-p5-release-report.json') {
    if (data.axeRequired !== true || !Array.isArray(data.checks) || data.checks.length === 0 || data.checks.some(c => c.ok !== true)) fail('P5 release checks or mandatory axe incomplete.');
  }
  if (name === 'qa-p5-acceptance-report.json' && (!Array.isArray(data.passed) || data.passed.length === 0)) fail('P5 acceptance evidence is empty.');
  if (name === 'qa-p5-runtime-report.json' || name === 'qa-p5-axe-runtime-report.json') {
    if (data.scriptsExecuted !== true || data.transport !== 'local-http') fail(`${name}: actual browser execution missing.`);
  }
  if (name === 'qa-p5-ui-interactions-report.json' && (data.actualProtectedUnlock !== true || data.trustedMouseClicks !== true)) fail('P5 UI interactions were not exercised as expected.');
}

function verifyP5() {
  const receipt = json(path.join(p5Root, 'p5-evidence-receipt.json'));
  if (receipt.schema !== 'ghrab-p5-evidence-receipt-v1' || receipt.appId !== APP_ID || receipt.appVersion !== version || receipt.sourceCommit !== sourceCommit) fail('P5 evidence receipt source identity mismatch.');
  if (!/^\d+$/.test(receipt.runId) && receipt.runId !== 'local') fail('P5 receipt has invalid run ID.');
  if (expectedP5RunId && receipt.runId !== expectedP5RunId) fail(`P5 evidence came from run ${receipt.runId}, expected ${expectedP5RunId}.`);
  const expected = requiredReports.map(name => `p5/${name}`);
  const actual = Array.isArray(receipt.reports) ? receipt.reports.map(r => r.path) : [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('P5 evidence receipt does not list all required reports in canonical order.');
  const allowed = new Set([...requiredReports, 'p5-evidence-receipt.json']);
  if (JSON.stringify(fs.readdirSync(p5Root).sort()) !== JSON.stringify([...allowed].sort())) fail('Unexpected or missing P5 evidence file.');
  for (let i = 0; i < requiredReports.length; i++) {
    const name = requiredReports[i];
    const file = path.join(p5Root, name);
    const entry = receipt.reports[i];
    const stat = regularFile(file);
    if (stat.size !== entry.size || sha256(file) !== entry.sha256) fail(`${name}: P5 report digest mismatch.`);
    validateReport(name, json(file));
  }
  if (!Array.isArray(receipt.testedBuild) || receipt.testedBuild.map(x => x.path).join(',') !== 'dist/index.html,dist/studio-manifest.json') fail('Tested build identity missing from receipt.');
  for (const item of receipt.testedBuild) if (!/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isInteger(item.size) || item.size < 1) fail('Tested build digest invalid.');
  return receipt;
}

function validateFoundation(directory) {
  const summary = json(path.join(directory, 'foundation-summary.json'));
  if (summary.schema !== 'garp27-foundation-summary-v1' || summary.appId !== APP_ID || summary.appVersion !== version || summary.status !== 'FOUNDATION_PASS_LIVE_NOT_TESTED') fail('GARP foundation did not complete successfully.');
  if (summary.sourceIdentity?.kind !== 'git-commit' || summary.sourceIdentity.value.toLowerCase() !== sourceCommit) fail('GARP foundation was not certified on the exact source SHA.');
  if (!Array.isArray(summary.steps) || summary.steps.length !== 10 || summary.steps.some(s => s.pass !== true || s.actualExit !== 0)) fail('GARP foundation has missing or failed steps.');
  if (summary.summary?.failed !== 0 || summary.summary?.passed !== 10) fail('GARP foundation summary contains failures.');
  const stepIds = new Set(['build-production', 'garp27-contracts', 'garp27-architecture', 'garp27-policy-mutations', 'garp27-mutations', 'garp27-auto-patch', 'legacy-garp25-static', 'promotion-architecture', 'studio-dispatch-contract', 'assurance-admission']);
  if (new Set(summary.steps.map(s => s.id)).size !== 10 || summary.steps.some(s => !stepIds.has(s.id))) fail('GARP foundation step inventory mismatch.');
  const allowedFiles = new Set([
    'foundation-summary.json', 'resolved-migration-profile.json', 'assurance-status.json',
    ...[...stepIds].map(id => id === 'assurance-admission' ? 'assurance-validation.log' : `${id}.log`),
  ]);
  if (JSON.stringify(fs.readdirSync(directory).sort()) !== JSON.stringify([...allowedFiles].sort())) fail('Unexpected or missing GARP foundation evidence file.');
  for (const step of summary.steps) {
    const file = path.join(directory, step.id === 'assurance-admission' ? 'assurance-validation.log' : `${step.id}.log`);
    regularFile(file);
    if (step.evidence?.sha256 !== sha256(file)) fail(`GARP foundation log checksum mismatch: ${step.id}.`);
  }
  const profile = json(path.join(directory, 'resolved-migration-profile.json'));
  const status = json(path.join(directory, 'assurance-status.json'));
  if (profile.releaseIdentity?.sourceCommit !== sourceCommit || status.releaseIdentity?.sourceCommit !== sourceCommit) fail('GARP foundation profile/assurance source SHA mismatch.');
  if (profile.releaseIdentity?.appVersion !== version || status.releaseIdentity?.appVersion !== version) fail('GARP foundation profile/assurance version mismatch.');
  return summary;
}

function replaceDirectory(target, populate) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  fs.rmSync(temporary, { recursive: true, force: true });
  try {
    fs.mkdirSync(temporary, { recursive: true });
    populate(temporary);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(temporary, target);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

try {
  if (mode === 'capture') {
    const dist = path.join(root, 'dist');
    const manifest = json(path.join(dist, 'studio-manifest.json'));
    if (manifest.id !== APP_ID || manifest.version !== version) fail('Tested build manifest mismatch.');
    const reports = requiredReports.map(name => {
      const file = path.join(dist, name);
      const stat = regularFile(file);
      validateReport(name, json(file));
      return { path: `p5/${name}`, size: stat.size, sha256: sha256(file) };
    });
    const testedBuild = ['index.html', 'studio-manifest.json'].map(name => {
      const file = path.join(dist, name);
      return { path: `dist/${name}`, size: regularFile(file).size, sha256: sha256(file) };
    });
    replaceDirectory(p5Root, tmp => {
      for (const name of requiredReports) fs.copyFileSync(path.join(dist, name), path.join(tmp, name), fs.constants.COPYFILE_EXCL);
      const receipt = { schema: 'ghrab-p5-evidence-receipt-v1', appId: APP_ID, appVersion: version, sourceCommit, runId, runAttempt: String(process.env.GITHUB_RUN_ATTEMPT || '1'), capturedAt: new Date().toISOString(), testedBuild, reports };
      fs.writeFileSync(path.join(tmp, 'p5-evidence-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    });
    verifyP5();
    console.log(`P5 evidence PASS: captured ${reports.length} required reports for SHA ${sourceCommit} before foundation rebuild.`);
  } else if (mode === 'seal') {
    verifyP5();
    validateFoundation(upstreamFoundation);
    replaceDirectory(foundationRoot, tmp => {
      for (const name of fs.readdirSync(upstreamFoundation)) {
        const input = path.join(upstreamFoundation, name);
        regularFile(input);
        fs.copyFileSync(input, path.join(tmp, name), fs.constants.COPYFILE_EXCL);
      }
    });
    validateFoundation(foundationRoot);
    console.log(`P5 + GARP evidence PASS: ${requiredReports.length} P5 reports and foundation proof bound to SHA ${sourceCommit}.`);
  } else {
    verifyP5();
    validateFoundation(foundationRoot);
    console.log(`P5 + GARP evidence PASS: sealed reports verify for ${sourceCommit}.`);
  }
} catch (error) {
  console.error(String(error?.stack || error));
  process.exit(1);
}
