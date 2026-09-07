#!/usr/bin/env node
// GARP 2.5.1 GHRAB - verify signed assurance links (Tooling R4).
// Generic verifier for hash links declared by ghrab-release-integrity-v2.
// If a manifest declares a non-null link, the corresponding artifact is mandatory.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const manifestPath = opt('manifest');
if (!manifestPath) {
  console.error('Usage: node verify-assurance-links.mjs --manifest release-integrity.json [--source-package file] [--provenance file] [--evidence-manifest file] [--sbom file] [--deployment-package file]');
  process.exit(2);
}

let manifest;
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch (e) {
  console.error(JSON.stringify({ schema:'ghrab-assurance-links-verification-v1', status:'FAIL', errors:['manifest-unreadable-or-invalid'], detail:String(e) }, null, 2));
  process.exit(1);
}

const links = [
  ['sourcePackageSha256', 'source-package'],
  ['deploymentPackageSha256', 'deployment-package'],
  ['buildProvenanceSha256', 'provenance'],
  ['sbomSha256', 'sbom'],
  ['evidenceManifestSha256', 'evidence-manifest'],
];
const errors = [];
const observed = [];
const sha = async p => createHash('sha256').update(await readFile(p)).digest('hex');

for (const [field, arg] of links) {
  const expected = manifest[field] ?? null;
  const file = opt(arg);
  if (expected === null) {
    observed.push({ field, status: 'N/A', expected: null, file: file || null });
    continue;
  }
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    errors.push(`${field}:invalid-manifest-hash`);
    observed.push({ field, status:'FAIL', expected, file:file || null });
    continue;
  }
  if (!file) {
    errors.push(`${field}:required-linked-artifact-missing`);
    observed.push({ field, status:'FAIL', expected, file:null });
    continue;
  }
  try {
    const actual = await sha(file);
    observed.push({ field, status: actual === expected ? 'PASS' : 'FAIL', expected, actual, file });
    if (actual !== expected) errors.push(`${field}:hash-mismatch`);
  } catch {
    errors.push(`${field}:unreadable:${file}`);
    observed.push({ field, status:'FAIL', expected, file });
  }
}

const out = {
  schema: 'ghrab-assurance-links-verification-v1',
  status: errors.length ? 'FAIL' : 'PASS',
  manifest: manifestPath,
  observed,
  errors,
  note: 'All non-null signed assurance hash links are mandatory. deploymentPackageSha256 may refer to a deterministic pre-sign deployment payload package; the final signed bundle remains externally hashed because embedding its own final hash would be self-referential.'
};
console[errors.length ? 'error' : 'log'](JSON.stringify(out, null, 2));
process.exit(errors.length ? 1 : 0);
