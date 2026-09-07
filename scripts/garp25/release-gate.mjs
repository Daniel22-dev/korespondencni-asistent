#!/usr/bin/env node
// GARP 2.5.1 GHRAB - release gate, tooling hardening R4.
// Fail-closed orchestration. A security step must never disappear silently.
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const profile = opt('profile') || 'school';
const deployArg = opt('deploy');

const REQUIRED = {
  school: ['deploy', 'manifest', 'signature', 'trust-root', 'registry', 'artifact', 'provenance', 'evidence-dir', 'evidence-manifest'],
  prep: ['deploy', 'manifest', 'signature', 'trust-root']
};
if (!REQUIRED[profile]) {
  console.error(JSON.stringify({ status: 'FAIL', errors: [`unknown-profile:${profile}`] }, null, 2));
  process.exit(2);
}

const steps = [];
const skippedSteps = [];
const missing = [];
for (const k of REQUIRED[profile]) {
  const v = opt(k);
  if (!v) { missing.push(k); continue; }
  try { await access(v); } catch { missing.push(`${k}:${v}:unreadable`); }
}
if (missing.length) failEarly('required-input-missing', { missing });

let manifestDoc;
try { manifestDoc = JSON.parse(await readFile(opt('manifest'), 'utf8')); }
catch (e) { failEarly('release-manifest-unreadable-or-invalid', { detail: String(e) }); }

const deployRoot = path.resolve(deployArg);
const explicitSw = opt('sw');
const detectedSw = path.join(deployRoot, 'sw.js');
let swPath = null;
if (explicitSw) {
  try { await access(explicitSw); swPath = path.resolve(explicitSw); }
  catch { failEarly('service-worker-unreadable', { sw: explicitSw }); }
} else if (existsSync(detectedSw)) {
  swPath = detectedSw;
}

let criticalList = null;
if (swPath) {
  const candidates = [
    opt('critical-list'),
    path.join(path.dirname(deployRoot), 'security', 'security-critical-assets.json')
  ].filter(Boolean);
  for (const c of candidates) {
    try { await access(c); criticalList = path.resolve(c); break; } catch {}
  }
  if (!criticalList) failEarly('critical-asset-list-missing', {
    sw: swPath,
    searched: candidates.length ? candidates : ['--critical-list', '<project-root>/security/security-critical-assets.json']
  });
}

const assuranceLinks = [
  ['sourcePackageSha256', 'source-package'],
  ['deploymentPackageSha256', 'deployment-package'],
  ['buildProvenanceSha256', 'provenance'],
  ['sbomSha256', 'sbom'],
  ['evidenceManifestSha256', 'evidence-manifest'],
];
const declaredAssurance = assuranceLinks.filter(([field]) => manifestDoc[field] !== null && manifestDoc[field] !== undefined);
const assuranceVerifier = opt('assurance-verifier') ? path.resolve(opt('assurance-verifier')) : path.join(here, 'verify-assurance-links.mjs');
if (declaredAssurance.length) {
  if (!existsSync(assuranceVerifier)) failEarly('assurance-links-verifier-missing', {
    verifier: assuranceVerifier,
    declaredLinks: declaredAssurance.map(([field]) => field)
  });
  const missingLinks = [];
  for (const [field, arg] of declaredAssurance) {
    const p = opt(arg);
    if (!p) { missingLinks.push(`${field}:--${arg}`); continue; }
    try { await access(p); } catch { missingLinks.push(`${field}:--${arg}:${p}:unreadable`); }
  }
  if (missingLinks.length) failEarly('assurance-link-input-missing', { missing: missingLinks });
} else {
  skippedSteps.push({ step: 'assurance-links', reason: 'manifest-declares-no-non-null-assurance-hash-links' });
}

run('deployment-leaks', 'scan-deployment-leaks.mjs', [deployArg]);
run('release-integrity', 'verify-release-integrity.mjs', [deployArg, opt('manifest')]);
run('release-signature', 'verify-release-signature.mjs', [opt('manifest'), opt('signature'), opt('trust-root')]);
if (opt('registry')) run('release-registry', 'verify-release-registry.mjs', [opt('manifest'), opt('registry')]);
else skippedSteps.push({ step:'release-registry', reason:'input-not-supplied-and-not-required-by-profile' });
if (opt('artifact') && opt('provenance'))
  run('build-provenance', 'verify-build-provenance.mjs',
    [opt('artifact'), opt('provenance'), ...(profile === 'prep' ? ['--allow-local-builder'] : [])]);
else skippedSteps.push({ step:'build-provenance', reason:'artifact-or-provenance-not-supplied-and-not-required-by-profile' });
if (opt('evidence-dir') && opt('evidence-manifest'))
  run('evidence-manifest', 'verify-evidence-manifest.mjs', [opt('evidence-dir'), opt('evidence-manifest')]);
else skippedSteps.push({ step:'evidence-manifest', reason:'evidence-dir-or-evidence-manifest-not-supplied-and-not-required-by-profile' });

if (declaredAssurance.length) {
  runPath('assurance-links', assuranceVerifier, [
    '--manifest', opt('manifest'),
    ...(opt('source-package') ? ['--source-package', opt('source-package')] : []),
    ...(opt('provenance') ? ['--provenance', opt('provenance')] : []),
    ...(opt('evidence-manifest') ? ['--evidence-manifest', opt('evidence-manifest')] : []),
    ...(opt('sbom') ? ['--sbom', opt('sbom')] : []),
    ...(opt('deployment-package') ? ['--deployment-package', opt('deployment-package')] : []),
  ]);
}
if (swPath) run('sw-security-freeze', 'check-sw-security-freeze.mjs', [swPath, deployArg, criticalList]);
else skippedSteps.push({ step:'sw-security-freeze', reason:'deployment-has-no-service-worker-and-no---sw-was-supplied' });
if (opt('vendored-config')) run('vendored-consistency', 'check-vendored-consistency.mjs', [opt('vendored-config')]);
else skippedSteps.push({ step:'vendored-consistency', reason:'vendored-config-not-supplied-and-not-required-by-profile' });

const failed = steps.filter(s => s.status !== 'PASS');
const verdict = {
  gate: 'GARP-2.5.1-RELEASE-GATE-R4',
  profile,
  status: failed.length ? 'RED' : 'GREEN',
  serviceWorker: swPath,
  criticalAssetList: criticalList,
  assuranceVerifier: declaredAssurance.length ? assuranceVerifier : null,
  declaredAssuranceLinks: declaredAssurance.map(([field]) => field),
  steps,
  skippedSteps,
  note: profile === 'prep'
    ? 'PREP profil muze pouzit lokalni builder. Bezpecnostni kroky deklarovane manifestem se nesmi tise preskocit; chybejici verifier nebo odpovidajici assurance vstup je RED. Neni to school-server LIVE GREEN.'
    : 'School profil je fail-closed. Kazdy bezpecnostni krok deklarovany manifestem musi byt proveden; kazde povolene preskoceni je explicitne uvedeno v skippedSteps.'
};
console[failed.length ? 'error' : 'log'](JSON.stringify(verdict, null, 2));
process.exit(failed.length ? 1 : 0);

function run(name, script, args) { return runPath(name, path.join(here, script), args, script); }
function runPath(name, scriptPath, args, scriptLabel = path.basename(scriptPath)) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
  const text = (r.status === 0 ? r.stdout : (r.stderr || r.stdout)).trim();
  const reportedAmber = /"status"\s*:\s*"AMBER"/.test(text);
  steps.push({
    step: name,
    script: scriptLabel,
    status: r.status === 0 ? 'PASS' : (reportedAmber ? 'AMBER' : 'FAIL'),
    exitCode: r.status,
    detail: text.slice(0, 1200)
  });
}
function failEarly(reason, extra = {}) {
  console.error(JSON.stringify({ gate: 'GARP-2.5.1-RELEASE-GATE-R4', status: 'RED', profile, errors: [reason], steps, skippedSteps, ...extra }, null, 2));
  process.exit(1);
}
