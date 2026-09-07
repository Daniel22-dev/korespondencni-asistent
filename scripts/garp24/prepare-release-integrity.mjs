#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const deploymentDir = path.resolve(process.argv[2] || path.join(root, 'dist-school-server'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const deployment = JSON.parse(await readFile(path.join(root, 'src', 'config', 'deployment.school-server.json'), 'utf8'));
const appId = deployment.appId;
if (!appId) throw new Error('Chybí appId v school-server deployment kontraktu.');
const keyId = process.env.GHRAB_RELEASE_KEY_ID || `${appId}-release-key-1`;
const manifest = path.join(deploymentDir, 'release-integrity.json');
const env = {
  ...process.env,
  GHRAB_BUILD_ID: process.env.GHRAB_BUILD_ID || `${appId}-${pkg.version}-ri-prep`,
};

function run(script, args) {
  const res = spawnSync(process.execPath, [path.join(root, 'scripts', 'garp24', script), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.status !== 0) {
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.status ?? 1);
  }
}

run('scan-deployment-leaks.mjs', [deploymentDir]);
run('create-release-integrity.mjs', [deploymentDir, appId, pkg.version, keyId, manifest]);
run('verify-release-integrity.mjs', [deploymentDir, manifest]);

console.log(JSON.stringify({
  status: 'PASS',
  profile: 'RI-PREP',
  appId,
  version: pkg.version,
  deploymentDir,
  manifest,
  keyId,
  signature: 'PENDING_EXTERNAL_SIGNER',
}, null, 2));
