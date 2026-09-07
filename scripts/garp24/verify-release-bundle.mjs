#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const [dirArg, publicKeyArg, expectedKeyIdArg] = process.argv.slice(2);
if (!dirArg || !publicKeyArg || !expectedKeyIdArg) {
  console.error('Usage: node verify-release-bundle.mjs <deployment-dir> <public-key.pem> <expected-key-id>');
  process.exit(2);
}
const root = process.cwd();
const dir = path.resolve(dirArg);
const manifestPath = path.join(dir, 'release-integrity.json');
const sigPath = path.join(dir, 'release-integrity.sig');
try { await access(manifestPath); } catch { console.error(JSON.stringify({status:'UNVERIFIED',reason:'MISSING_MANIFEST'}, null, 2)); process.exit(1); }
try { await access(sigPath); } catch { console.error(JSON.stringify({status:'UNVERIFIED',reason:'MISSING_SIGNATURE'}, null, 2)); process.exit(1); }
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const errors = [];
if (manifest.schema !== 'ghrab-release-integrity-v1') errors.push('schema');
if (manifest.hashAlgorithm !== 'SHA-256') errors.push('hashAlgorithm');
if (manifest.signature?.algorithm !== 'Ed25519') errors.push('signature.algorithm');
if (manifest.signature?.keyId !== expectedKeyIdArg) errors.push(`keyId:${manifest.signature?.keyId || 'missing'}`);
if (errors.length) {
  console.error(JSON.stringify({status:'UNVERIFIED',reason:'TRUST_METADATA_MISMATCH',errors}, null, 2));
  process.exit(1);
}
function run(script, args) {
  const res = spawnSync(process.execPath, [path.join(root, 'scripts', 'garp24', script), ...args], {cwd: root, encoding:'utf8'});
  if (res.status !== 0) {
    if (res.stdout) process.stderr.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.status ?? 1);
  }
  if (res.stdout) process.stdout.write(res.stdout);
}
run('verify-release-integrity.mjs', [dir, manifestPath]);
run('verify-release-signature.mjs', [manifestPath, sigPath, path.resolve(publicKeyArg)]);
console.log(JSON.stringify({status:'VERIFIED',keyId:expectedKeyIdArg,appId:manifest.appId,version:manifest.version,artifactDigest:manifest.artifactDigest}, null, 2));
