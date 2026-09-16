#!/usr/bin/env node
// GARP 2.5.1 GHRAB - scan-deployment-leaks
// Kumulativni N5 hardening pro KS:
//  - zachovava blokove cteni velkych souboru a vsechny dosavadni kontroly;
//  - doplnuje private JWK a PGP private-key material;
//  - encrypted/private PEM nadale pokryva obecny PRIVATE KEY pattern.
import { readdir, lstat, open } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const forbiddenDirs = new Set([
  '.git', '.github', '.svn', '.hg', '.vscode', '.idea', 'test', 'tests', '__tests__',
  'test-results', 'coverage', 'audit-evidence', 'PROMPTY', 'node_modules', '.claude'
]);
const forbiddenNames = new Set([
  'SHA256SUMS.private', 'private-key.pem', 'id_rsa', 'id_ed25519', '.npmrc', '.netrc', '.DS_Store'
]);
const forbiddenExt = new Set(['.map', '.pem', '.key', '.p12', '.pfx', '.p8', '.jks', '.keystore', '.kdb', '.ppk', '.asc', '.gpg', '.bak', '.orig']);
const secretPatterns = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private-key-block'],
  [/-----BEGIN PGP PRIVATE KEY BLOCK-----/, 'pgp-private-key'],
  [/\bAIza[A-Za-z0-9_-]{20,}\b/, 'google-api-key'],
  [/\bghp_[A-Za-z0-9]{20,}\b/, 'github-token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, 'github-fine-grained-pat'],
  [/\bgho_[A-Za-z0-9]{20,}\b/, 'github-oauth-token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'aws-access-key-id'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'openai-style-key'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}\b/, 'anthropic-key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'slack-token'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, 'jwt'],
  [/(?:api[_-]?key|secret|passwd|password|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i, 'assigned-secret-literal'],
  [/GHRAB_CANARY_[A-Z0-9_]+/, 'garp-canary']
];
const CHUNK = 1 << 20, OVERLAP = 4096;
const errors = [];

function containsPrivateJwk(text) {
  const variants = [text, text.replace(/\\(["'])/g, '$1')];
  for (const value of variants) {
    const kty = /(?:["']?kty["']?)\s*:\s*["'](?:EC|OKP|RSA)["']/i;
    const d = /(?:["']?d["']?)\s*:\s*["'][A-Za-z0-9_-]{20,}["']/i;
    const km = kty.exec(value);
    const dm = d.exec(value);
    if (km && dm && Math.abs(km.index - dm.index) <= 4096) return true;
  }
  return false;
}

async function scanFile(abs, rel, size) {
  const fh = await open(abs, 'r');
  try {
    let pos = 0, tail = '', binary = false;
    const buf = Buffer.alloc(CHUNK);
    while (pos < size) {
      const { bytesRead } = await fh.read(buf, 0, CHUNK, pos);
      if (!bytesRead) break;
      const slice = buf.subarray(0, bytesRead);
      if (pos === 0 && slice.subarray(0, Math.min(8192, bytesRead)).includes(0)) { binary = true; break; }
      const text = tail + slice.toString('utf8');
      for (const [re, label] of secretPatterns) if (re.test(text)) errors.push(`secret-pattern:${rel}:${label}`);
      if (containsPrivateJwk(text)) errors.push(`secret-pattern:${rel}:jwk-private-key`);
      tail = text.slice(-OVERLAP);
      pos += bytesRead;
    }
    if (binary) errors.push(`INFO-binary-not-scanned:${rel}`);
  } finally { await fh.close(); }
}

async function walk(dir, base = '') {
  for (const name of (await readdir(dir)).sort()) {
    const abs = path.join(dir, name), rel = path.posix.join(base, name);
    const st = await lstat(abs);
    if (st.isSymbolicLink()) { errors.push(`symlink:${rel}`); continue; }
    if (st.isDirectory()) {
      if (forbiddenDirs.has(name)) errors.push(`forbidden-dir:${rel}`);
      else await walk(abs, rel);
      continue;
    }
    if (!st.isFile()) { errors.push(`irregular-file:${rel}`); continue; }
    if (forbiddenNames.has(name)) errors.push(`forbidden-name:${rel}`);
    if (name === '.env' || name.startsWith('.env.')) errors.push(`forbidden-env-file:${rel}`);
    if (forbiddenExt.has(path.extname(name).toLowerCase())) errors.push(`forbidden-ext:${rel}`);
    await scanFile(abs, rel, st.size);
  }
}
await walk(root);

const hard = [...new Set(errors)].filter(e => !e.startsWith('INFO-'));
const info = [...new Set(errors)].filter(e => e.startsWith('INFO-'));
if (hard.length) { console.error(JSON.stringify({ status: 'FAIL', errors: hard, info }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ status: 'PASS', root, info }, null, 2));
