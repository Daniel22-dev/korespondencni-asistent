#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'garp-evidence-path-'));
const checks = [];
const check = (id, ok, detail = '') => checks.push({ id, ok: Boolean(ok), detail });

try {
  const good = resolveGarpEvidenceDir(root, 'garp22-final-close');
  check('valid-name-inside-audit-evidence', good.evidenceRoot.startsWith(path.join(root, 'audit-evidence') + path.sep), good.evidenceRoot);

  for (const bad of ['.', '..', '../../src', 'evil/../../etc', 'a/b', '', '../x']) {
    if (bad === '') continue; // empty intentionally maps to the safe default
    let rejected = false;
    try { resolveGarpEvidenceDir(root, bad); } catch { rejected = true; }
    check(`reject-${JSON.stringify(bad)}`, rejected);
  }

  const auditRoot = path.join(root, 'audit-evidence');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside, { recursive: true });
  const link = path.join(auditRoot, 'symlink-out');
  let symlinkSupported = true;
  try { fs.symlinkSync(outside, link, 'dir'); } catch { symlinkSupported = false; }
  if (symlinkSupported) {
    let rejected = false;
    try { resolveGarpEvidenceDir(root, 'symlink-out'); } catch { rejected = true; }
    check('reject-symlink-outside-audit-evidence', rejected);
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(JSON.stringify({ schema: 'garp22-evidence-path-selftest-v1', checks, status: failed.length ? 'failed' : 'passed' }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
