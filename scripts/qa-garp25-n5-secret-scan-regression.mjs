#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanner = path.join(root, 'scripts', 'garp25', 'scan-deployment-leaks.mjs');
const t = await mkdtemp(path.join(tmpdir(), 'ks-n5-secret-scan-'));
const failures = [];

function runScanner(dir) {
  return spawnSync(process.execPath, [scanner, dir], { encoding: 'utf8' });
}
function expectBlocked(name, content) {
  return (async () => {
    const dir = path.join(t, name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'fixture.txt'), content);
    const r = runScanner(dir);
    if (r.status === 0) failures.push(`${name}: scanner fixture propustil`);
  })();
}

try {
  const clean = path.join(t, 'clean');
  await mkdir(clean, { recursive: true });
  await writeFile(path.join(clean, 'index.txt'), 'synthetic clean fixture\n');
  const cleanRun = runScanner(clean);
  if (cleanRun.status !== 0) failures.push('clean: false positive');

  await expectBlocked('private-jwk', JSON.stringify({
    kty: 'EC',
    crv: 'P-256',
    x: 'A'.repeat(43),
    y: 'B'.repeat(43),
    d: 'C'.repeat(43),
  }));

  await expectBlocked(
    'encrypted-private-pem',
    `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END ENCRYPTED PRIVATE KEY-----\n`,
  );

  await expectBlocked(
    'pgp-private-key',
    `-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: synthetic\n\n${'A'.repeat(64)}\n-----END PGP PRIVATE KEY BLOCK-----\n`,
  );

  if (failures.length) {
    console.error(JSON.stringify({ status: 'FAIL', failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: 'PASS',
    tests: ['clean', 'private-jwk', 'encrypted-private-pem', 'pgp-private-key'],
  }, null, 2));
} finally {
  await rm(t, { recursive: true, force: true });
}
