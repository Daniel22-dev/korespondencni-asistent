#!/usr/bin/env node
// GARP 2.5.1 GHRAB - service-worker security freeze checker, tooling hardening R5.
// Goal: fail closed against security-critical assets entering Cache API write paths.
// This is intentionally conservative static analysis. Unknown install/precache writes are AMBER,
// never silent PASS. Runtime cache writes are accepted only when structurally behind the
// isSecurityCriticalRequest -> networkOnlyNoStore early-return boundary.
import { readFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

const [swPath, deployDirArg, listArg] = process.argv.slice(2);
if (!swPath || !deployDirArg) {
  console.error('Usage: node check-sw-security-freeze.mjs <sw.js> <deployment-dir> [security-critical-list.json]');
  process.exit(2);
}

const DEFAULT_CRITICAL = [
  'app-guard', 'access-control', 'platform-runtime', 'revoked-access.json',
  'release-integrity.json', 'release-integrity.sig', 'integrity-status', 'runtime-config'
];
let critical = DEFAULT_CRITICAL;
if (listArg) {
  try {
    const parsed = JSON.parse(await readFile(listArg, 'utf8'));
    if (!Array.isArray(parsed) || !parsed.length || parsed.some(x => typeof x !== 'string' || !x.trim())) {
      throw new Error('critical list must be a non-empty JSON array of strings');
    }
    critical = parsed;
  } catch (e) {
    console.error(JSON.stringify({ status: 'ERROR', error: 'critical-asset-list-invalid', detail: String(e) }, null, 2));
    process.exit(2);
  }
}

const rawSw = await readFile(swPath, 'utf8');
const sw = stripComments(rawSw);
const deployRoot = path.resolve(deployDirArg);
const findings = [];
const unresolvedCacheWrites = [];

const norm = value => String(value || '').replace(/^\.\//, '').replace(/^\//, '');
const matchesCritical = value => { const v=norm(value); if (!v) return false; return critical.some(c => { const cc=norm(c); return cc && (v.includes(cc) || cc.includes(v)); }); };

async function walk(dir, base = '') {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    const abs = path.join(dir, name), rel = path.posix.join(base, name);
    const st = await lstat(abs);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...await walk(abs, rel));
    else if (st.isFile()) out.push(rel);
  }
  return out;
}
let files;
try { files = await walk(deployRoot); }
catch (e) { console.error(JSON.stringify({ status: 'ERROR', error: String(e) })); process.exit(2); }

const criticalFiles = files.filter(f => matchesCritical(f));
if (!criticalFiles.length) {
  findings.push({ severity: 'INFO', issue: 'zadny security-critical asset nenalezen - overit seznam rucne', detail: critical.join(',') });
}

function stripComments(text) {
  let out = '', i = 0, quote = null;
  while (i < text.length) {
    const ch = text[i], next = text[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') { if (i + 1 < text.length) out += text[++i]; }
      else if (ch === quote) quote = null;
      i++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; i++; continue; }
    if (ch === '/' && next === '/') {
      out += '  '; i += 2;
      while (i < text.length && text[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < text.length) { out += '  '; i += 2; }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

function scanBalanced(text, openIndex, openChar = '(', closeChar = ')') {
  let depth = 0, quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(text, sep = ',') {
  const out = []; let start = 0, round = 0, square = 0, curly = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(') round++; else if (ch === ')') round--;
    else if (ch === '[') square++; else if (ch === ']') square--;
    else if (ch === '{') curly++; else if (ch === '}') curly--;
    else if (ch === sep && round === 0 && square === 0 && curly === 0) {
      out.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function splitTopLevelPlus(text) {
  const out = []; let start = 0, round = 0, square = 0, curly = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(') round++; else if (ch === ')') round--;
    else if (ch === '[') square++; else if (ch === ']') square--;
    else if (ch === '{') curly++; else if (ch === '}') curly--;
    else if (ch === '+' && round === 0 && square === 0 && curly === 0) {
      out.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function decodeString(expr) {
  const t = expr.trim();
  if (t.length < 2 || !['"', "'", '`'].includes(t[0]) || t[t.length - 1] !== t[0]) return null;
  if (t[0] === '`' && t.includes('${')) return null;
  try {
    if (t[0] === '"') return JSON.parse(t);
    const q = t[0];
    const raw = t.slice(1, -1);
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\') { i++; continue; }
      if (raw[i] === q) return null;
    }
    const inner = raw.replace(/\\([\\'"`])/g, '$1');
    return inner;
  } catch { return null; }
}

const env = new Map();
function captureStaticAssignments(text) {
  const starts = [
    ...text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g),
    ...text.matchAll(/\b(self\.[A-Za-z_$][\w$]*)\s*=\s*/g)
  ].sort((a,b) => a.index - b.index);
  for (const m of starts) {
    const name = m[1], start = m.index + m[0].length;
    let round=0, square=0, curly=0, quote=null, end=start;
    for (let i=start; i<text.length; i++) {
      const ch=text[i];
      if (quote) { if (ch==='\\') i++; else if (ch===quote) quote=null; end=i+1; continue; }
      if (ch==='\"'||ch==="'"||ch==='`') { quote=ch; end=i+1; continue; }
      if (ch==='(') round++; else if (ch===')') round--;
      else if (ch==='[') square++; else if (ch===']') square--;
      else if (ch==='{') curly++; else if (ch==='}') curly--;
      if ((ch===';' || ch==='\n') && round===0 && square===0 && curly===0) { end=i; break; }
      end=i+1;
    }
    const expr=text.slice(start,end).trim();
    if (expr) env.set(name, expr);
  }
}
captureStaticAssignments(sw);

function resolveObjectValues(expr, seen, depth) {
  const m = expr.match(/^Object\.values\s*\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\)$/);
  if (!m) return null;
  const raw = env.get(m[1]);
  if (!raw || !raw.trim().startsWith('{') || !raw.trim().endsWith('}')) return null;
  const body = raw.trim().slice(1, -1);
  const vals = [];
  for (const part of splitTopLevel(body)) {
    const idx = part.indexOf(':'); if (idx < 0) return null;
    const r = resolveExpr(part.slice(idx + 1), seen, depth + 1); if (!r) return null;
    vals.push(...r);
  }
  return vals;
}

function resolveExpr(expr, seen = new Set(), depth = 0) {
  if (depth > 12) return null;
  let t = String(expr || '').trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    const end = scanBalanced(t, 0); if (end !== t.length - 1) break; t = t.slice(1, -1).trim();
  }
  const lit = decodeString(t); if (lit !== null) return [lit];
  // Static string concatenation is safe to resolve; non-static operands remain unresolved.
  const plusParts = splitTopLevelPlus(t);
  if (plusParts.length > 1) {
    let joined = '';
    for (const part of plusParts) {
      const r = resolveExpr(part, seen, depth + 1);
      if (!r || r.length !== 1) return null;
      joined += r[0];
    }
    return [joined];
  }
  if (/^new\s+Request\s*\(/.test(t)) {
    const open = t.indexOf('('), end = scanBalanced(t, open); if (end < 0) return null;
    const first = splitTopLevel(t.slice(open + 1, end))[0]; return resolveExpr(first, seen, depth + 1);
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    const vals = [];
    for (const part of splitTopLevel(t.slice(1, -1))) {
      if (part.startsWith('...')) { const r = resolveExpr(part.slice(3), seen, depth + 1); if (!r) return null; vals.push(...r); }
      else { const r = resolveExpr(part, seen, depth + 1); if (!r) return null; vals.push(...r); }
    }
    return vals;
  }
  const concat = t.match(/^(.+?)\.concat\s*\((.*)\)$/s);
  if (concat) {
    const base = resolveExpr(concat[1], seen, depth + 1); if (!base) return null;
    const vals = [...base];
    for (const arg of splitTopLevel(concat[2])) { const r = resolveExpr(arg, seen, depth + 1); if (!r) return null; vals.push(...r); }
    return vals;
  }
  const split = t.match(/^(.+?)\.split\s*\((.*)\)$/s);
  if (split) {
    const base = resolveExpr(split[1], seen, depth + 1), sep = resolveExpr(split[2], seen, depth + 1);
    if (!base || base.length !== 1 || !sep || sep.length !== 1) return null;
    return base[0].split(sep[0]);
  }
  const ov = resolveObjectValues(t, seen, depth); if (ov) return ov;
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(t)) {
    if (seen.has(t)) return null;
    const raw = env.get(t); if (!raw) return null;
    const nextSeen = new Set(seen); nextSeen.add(t);
    return resolveExpr(raw, nextSeen, depth + 1);
  }
  return null;
}

function enclosingFunctionName(pos) {
  const prefix = sw.slice(0, pos);
  const matches = [...prefix.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i], open = m.index + m[0].lastIndexOf('{');
    const end = scanBalanced(sw, open, '{', '}');
    if (end >= pos) return m[1];
  }
  return null;
}

function installRanges() {
  const ranges = [];
  for (const m of sw.matchAll(/addEventListener\s*\(\s*['"]install['"]\s*,/g)) {
    const start = m.index, open = sw.indexOf('(', start), end = scanBalanced(sw, open);
    if (end > start) ranges.push([start, end]);
  }
  return ranges;
}
const installs = installRanges();
const isInstallPos = pos => installs.some(([a,b]) => pos >= a && pos <= b);

const precached = new Set();
const precacheSources = [];
function addResolved(values, source) {
  const uniq = [...new Set((values || []).filter(Boolean))];
  for (const v of uniq) precached.add(v);
  if (uniq.length) precacheSources.push({ source, entries: uniq });
}
function noteUnresolved(pos, method, expr, source) {
  unresolvedCacheWrites.push({ method, expression: expr.slice(0, 180), source, installOrPrecache: isInstallPos(pos), function: enclosingFunctionName(pos) });
}

const iteratorAddVars = new Set();
for (const m of sw.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([^)]*)\)\s*\{/g)) {
  const openBrace = m.index + m[0].lastIndexOf('{'), endBrace = scanBalanced(sw, openBrace, '{', '}');
  if (endBrace < 0) continue;
  const body = sw.slice(openBrace + 1, endBrace);
  if (new RegExp(`\\.\\s*add\\s*\\(\\s*${m[1]}\\s*\\)`).test(body)) iteratorAddVars.add(m[1]);
}
for (const m of sw.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+Object\.values\s*\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\)\s*\)\s*\{/g)) {
  const openBrace = m.index + m[0].lastIndexOf('{'), endBrace = scanBalanced(sw, openBrace, '{', '}');
  if (endBrace < 0) continue;
  const body = sw.slice(openBrace + 1, endBrace);
  if (new RegExp(`\\.\\s*add\\s*\\(\\s*${m[1]}\\s*\\)`).test(body)) iteratorAddVars.add(m[1]);
}
for (const m of sw.matchAll(/(?:([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)|Object\.values\s*\([^)]*\))\.(?:map|forEach)\s*\(\s*([A-Za-z_$][\w$]*)\s*=>[\s\S]{0,260}?\.\s*add\s*\(\s*\2\s*\)/g)) iteratorAddVars.add(m[2]);

// Direct Cache API writes. Parse the first argument, not the variable name.
for (const m of sw.matchAll(/\.\s*(addAll|add|put)\s*\(/g)) {
  const method = m[1], open = m.index + m[0].lastIndexOf('('), close = scanBalanced(sw, open);
  if (close < 0) { noteUnresolved(m.index, method, '<unbalanced>', 'direct-call'); continue; }
  const args = splitTopLevel(sw.slice(open + 1, close));
  const first = args[0] || '';
  const values = resolveExpr(first);
  if (values) addResolved(values, `${method}:expression`);
  else {
    const fn = enclosingFunctionName(m.index);
    // Dynamic request cache writes are structurally safe only if they live in runtime helpers
    // whose callers sit behind the security-critical early return. Verified below.
    const idOnly = /^[A-Za-z_$][\w$]*$/.test(first.trim());
    if (method === 'add' && idOnly && iteratorAddVars.has(first.trim())) {
      // resolved by the iterator pass below
    } else if (!(method === 'put' && first.trim() === 'request' && ['networkFirst','cacheFirst'].includes(fn))) {
      noteUnresolved(m.index, method, first, 'direct-call');
    }
  }
}

// Discover identifiers that are demonstrably Cache objects from caches.open(...).
const cacheLikeNames = new Set(['cache']);
for (const m of sw.matchAll(/\bcaches\.open\s*\([^)]*\)\s*\.then\s*\(\s*([A-Za-z_$][\w$]*)\s*=>/g)) cacheLikeNames.add(m[1]);
for (const m of sw.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+caches\.open\s*\(/g)) cacheLikeNames.add(m[1]);
for (const m of sw.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*caches\.open\s*\([^)]*\)/g)) cacheLikeNames.add(m[1]);

// Bracket-notation Cache API writes: cache['add'](...), cache["addAll"](...), cache['put'](...).
for (const m of sw.matchAll(/\[\s*(['"])(addAll|add|put)\1\s*\]\s*\(/g)) {
  const method = m[2], open = m.index + m[0].lastIndexOf('('), close = scanBalanced(sw, open);
  if (close < 0) { noteUnresolved(m.index, method, '<unbalanced>', 'bracket-call'); continue; }
  const args = splitTopLevel(sw.slice(open + 1, close));
  const first = args[0] || '';
  const values = resolveExpr(first);
  if (values) addResolved(values, `${method}:bracket-expression`);
  else noteUnresolved(m.index, method, first, 'bracket-call');
}

// Non-literal computed member calls on a demonstrable Cache object cannot be proven safe statically.
// Example: const M='add'+'All'; caches.open('x').then(c => c[M](L)).
// We do not pretend to evaluate arbitrary JavaScript here: such a call is AMBER, never silent PASS.
for (const receiver of cacheLikeNames) {
  const re = new RegExp(`\\b${receiver}\\s*\\[\\s*([^\\]\\n]+?)\\s*\\]\\s*\\(`, 'g');
  for (const m of sw.matchAll(re)) {
    const keyExpr = (m[1] || '').trim();
    if (/^(['"])(addAll|add|put)\\1$/.test(keyExpr)) continue; // handled above
    noteUnresolved(m.index, '[computed-cache-method]', keyExpr, `computed-cache-member:${receiver}`);
  }
}

// Method aliases/bind indirection. Resolve the call argument where possible; otherwise AMBER.
const cacheMethodAliases = new Map();
for (const m of sw.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]{0,180}?(?:\.\s*(addAll|add|put)|\[\s*['"](addAll|add|put)['"]\s*\])\s*\.\s*bind\s*\([^)]*\)\s*;?/g)) {
  cacheMethodAliases.set(m[1], m[2] || m[3]);
}
for (const m of sw.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]{0,180}?(?:\.\s*(addAll|add|put)|\[\s*['"](addAll|add|put)['"]\s*\])\s*;?/g)) {
  if (!cacheMethodAliases.has(m[1])) cacheMethodAliases.set(m[1], m[2] || m[3]);
}
for (const [alias, method] of cacheMethodAliases) {
  const re = new RegExp(`\\b${alias}\\s*\\(`, 'g');
  for (const m of sw.matchAll(re)) {
    // Skip the occurrence inside the alias declaration itself when present.
    const prefix = sw.slice(Math.max(0, m.index - 220), m.index);
    if (new RegExp(`(?:const|let|var)\\s+${alias}\\s*=`).test(prefix) && !prefix.includes(';')) continue;
    const open = m.index + m[0].lastIndexOf('('), close = scanBalanced(sw, open);
    if (close < 0) { noteUnresolved(m.index, method, '<unbalanced>', `alias:${alias}`); continue; }
    const args = splitTopLevel(sw.slice(open + 1, close));
    const first = args[0] || '';
    const values = resolveExpr(first);
    if (values) addResolved(values, `${method}:alias:${alias}`);
    else noteUnresolved(m.index, method, first, `alias:${alias}`);
  }
}

// N17 hardening: detached Cache methods must never disappear from the analysis envelope.
// We intentionally classify these forms as unresolved/AMBER instead of trying to emulate
// arbitrary JavaScript binding semantics. This covers destructuring, Reflect.get and the
// comma-operator form commonly emitted by transpilers/bundlers.
const detachedCacheMethodAliases = new Map();
for (const receiver of cacheLikeNames) {
  const re = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${receiver}\\b`, 'g');
  for (const m of sw.matchAll(re)) {
    for (const part of splitTopLevel(m[1])) {
      const bits = part.trim().match(/^(addAll|add|put)\s*(?::\s*([A-Za-z_$][\w$]*))?$/);
      if (!bits) continue;
      detachedCacheMethodAliases.set(bits[2] || bits[1], { method: bits[1], receiver, declPos: m.index });
    }
  }
}
for (const [alias, meta] of detachedCacheMethodAliases) {
  const re = new RegExp(`\\b${alias}\\s*(?:\\.\\s*call\\s*)?\\(`, 'g');
  for (const m of sw.matchAll(re)) {
    if (m.index <= meta.declPos) continue;
    noteUnresolved(m.index, meta.method, alias, `detached-destructure-cache-method:${meta.receiver}:${alias}`);
  }
}

for (const receiver of cacheLikeNames) {
  const reflectRe = new RegExp(`\\bReflect\\.get\\s*\\(\\s*${receiver}\\s*,\\s*(['\"])(addAll|add|put)\\1\\s*\\)`, 'g');
  for (const m of sw.matchAll(reflectRe)) {
    noteUnresolved(m.index, m[2], m[0], `detached-reflect-cache-method:${receiver}`);
  }

  const commaRe = new RegExp(`\\(\\s*0\\s*,\\s*${receiver}\\s*(?:\\.\\s*(addAll|add|put)|\\[\\s*(['\"])(addAll|add|put)\\2\\s*\\])\\s*\\)\\s*\\(`, 'g');
  for (const m of sw.matchAll(commaRe)) {
    noteUnresolved(m.index, m[1] || m[3] || '[detached-cache-method]', m[0], `detached-comma-cache-method:${receiver}`);
  }
}

// N18 closeout backstop: deliberate prototype-level extraction of Cache write methods is
// outside the normal receiver/alias analysis. Keep it fail-closed instead of allowing silent PASS.
// This is intentionally token-level and conservative; comments have already been stripped.
for (const m of sw.matchAll(/\bCache\s*\.\s*prototype\b/g)) {
  noteUnresolved(m.index, '[prototype-cache-method]', m[0], 'cache-prototype-method-not-statically-analyzed');
}

// Service-worker imports extend the executable/cache-write surface beyond this file.
// Until imported scripts are recursively parsed, any importScripts() is AMBER, never silent PASS.
for (const m of sw.matchAll(/\bimportScripts\s*\(/g)) {
  const open = m.index + m[0].lastIndexOf('('), close = scanBalanced(sw, open);
  const expr = close >= 0 ? sw.slice(open + 1, close) : '<unbalanced>';
  unresolvedCacheWrites.push({
    method: 'importScripts', expression: expr.slice(0, 180), source: 'sw-imports-external-script-not-analyzed',
    installOrPrecache: isInstallPos(m.index), function: enclosingFunctionName(m.index)
  });
}

// Iterated add paths where the cache.add argument is a loop variable.
for (const m of sw.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+Object\.values\s*\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\)\s*\)\s*\{/g)) {
  const openBrace = m.index + m[0].lastIndexOf('{'), endBrace = scanBalanced(sw, openBrace, '{', '}');
  if (endBrace < 0) continue;
  const body = sw.slice(openBrace + 1, endBrace), varName = m[1];
  if (new RegExp(`\\.\\s*add\\s*\\(\\s*${varName}\\s*\\)`).test(body)) {
    const expr = `Object.values(${m[2]})`, values = resolveExpr(expr);
    if (values) addResolved(values, `for-of-add:${expr}`); else noteUnresolved(m.index, 'add', expr, 'for-of');
  }
}
for (const m of sw.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([^)]*)\)\s*\{/g)) {
  const openBrace = m.index + m[0].lastIndexOf('{'), endBrace = scanBalanced(sw, openBrace, '{', '}');
  if (endBrace < 0) continue;
  const body = sw.slice(openBrace + 1, endBrace);
  const varName = m[1];
  if (new RegExp(`\\.\\s*add\\s*\\(\\s*${varName}\\s*\\)`).test(body)) {
    const values = resolveExpr(m[2]);
    if (values) addResolved(values, `for-of-add:${m[2].trim()}`);
    else noteUnresolved(m.index, 'add', m[2], 'for-of');
  }
}

// map/forEach receiver paths. Resolve the receiver expression, including Object.values(...).
for (const m of sw.matchAll(/((?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)|(?:Object\.values\s*\([^)]*\)))\.(map|forEach)\s*\(\s*([A-Za-z_$][\w$]*)\s*=>[\s\S]{0,260}?\.\s*add\s*\(\s*\3\s*\)/g)) {
  const receiver = m[1].trim();
  const values = resolveExpr(receiver);
  if (values) addResolved(values, `${m[2]}-add:${receiver}`);
  else noteUnresolved(m.index, 'add', receiver, `${m[2]}-receiver`);
}

for (const p of precached) {
  for (const c of critical) {
    const pp=norm(p), cc=norm(c);
    if (pp && cc && (pp.includes(cc) || cc.includes(pp))) {
      findings.push({ severity: 'CRITICAL', issue: 'security-critical asset je v Cache API write/precache ceste', detail: `${p} (vzor: ${c})` });
    }
  }
}

// Structural exemption only. Comments/proximity never count.
function extractFunction(name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(sw); if (!m) return '';
  const open = m.index + m[0].lastIndexOf('{'), end = scanBalanced(sw, open, '{', '}');
  return end > open ? sw.slice(open + 1, end) : '';
}
const securityCriticalFn = extractFunction('isSecurityCriticalRequest');
const fetchMatch = /addEventListener\s*\(\s*['"]fetch['"]\s*,/.exec(sw);
let fetchBody = '';
if (fetchMatch) {
  const open = sw.indexOf('(', fetchMatch.index), end = scanBalanced(sw, open);
  fetchBody = end > open ? sw.slice(open + 1, end) : '';
}
const guardIdx = fetchBody.indexOf('isSecurityCriticalRequest');
const networkOnlyIdx = guardIdx >= 0 ? fetchBody.indexOf('networkOnlyNoStore', guardIdx) : -1;
const cacheFirstIdx = fetchBody.indexOf('cacheFirst');
const structuralNetworkOnlyGuard = guardIdx >= 0 && networkOnlyIdx > guardIdx && (cacheFirstIdx < 0 || networkOnlyIdx < cacheFirstIdx);
const criticalLiterals = [...securityCriticalFn.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)]
  .filter(m => !(m[1] === '`' && m[2].includes('${'))).map(m => norm(m[2]));
const structurallyExempt = file => structuralNetworkOnlyGuard && criticalLiterals.some(l => norm(file).includes(l) || l.includes(norm(file)));

const hasCacheFirst = /\bcacheFirst\s*\(/.test(sw)
  || /CacheFirst|StaleWhileRevalidate|staleWhileRevalidate/.test(sw)
  || /const\s+cached\s*=\s*await\s+cache(?:s)?\.match[\s\S]{0,240}if\s*\(\s*cached\s*\)\s*return\s+cached/.test(sw);
if (hasCacheFirst) {
  for (const f of criticalFiles) {
    if (!structurallyExempt(f)) findings.push({
      severity: 'HIGH', issue: 'security-critical asset nema strukturani isSecurityCriticalRequest -> networkOnlyNoStore vyjimku pred cache-first', detail: f
    });
  }
}

// Dynamic request writes in cacheFirst/networkFirst are accepted only with the proven early-return guard.
if (!structuralNetworkOnlyGuard) {
  for (const m of sw.matchAll(/\.\s*put\s*\(\s*request\s*,/g)) {
    const fn = enclosingFunctionName(m.index);
    if (['networkFirst','cacheFirst'].includes(fn)) noteUnresolved(m.index, 'put', 'request', 'unguarded-runtime-helper');
  }
}

// Any unresolved install/precache write is AMBER, never silent PASS. Unknown writes elsewhere are also
// AMBER unless explicitly recognized as the guarded runtime-request pattern above.
for (const u of unresolvedCacheWrites) findings.push({ severity: 'MEDIUM', issue: 'unresolved-cache-write', detail: u });

for (const p of precached) if (/release-integrity\.(json|sig)$/.test(p))
  findings.push({ severity: 'CRITICAL', issue: 'integritni artefakt je precachovan - integrity check by overoval zmrazenou verzi', detail: p });

const blocking = findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
const amber = findings.filter(f => f.severity === 'MEDIUM');
const status = blocking.length ? 'FAIL' : (amber.length ? 'AMBER' : 'PASS');
const out = {
  status,
  serviceWorker: swPath,
  criticalListSource: listArg || 'DEFAULT_CRITICAL(ad-hoc only; release gate must supply authoritative list)',
  precachedEntries: precached.size,
  precacheSources,
  unresolvedCacheWrites,
  cacheFirstDetected: hasCacheFirst,
  structuralNetworkOnlyGuard,
  criticalAssetsInDeployment: criticalFiles,
  findings,
  checkerRevision: 'garp-2.5.1-r5-detached-cache-method-fail-closed',
  note: 'Static bounded analysis. PASS means no critical asset was found in the explicitly recognized Cache API write envelope; recognized writes were resolved/guarded; importScripts is absent; and deployed critical assets have structural isSecurityCriticalRequest -> networkOnlyNoStore routing. Unknown/dynamic recognized writes, including non-literal computed Cache member calls and detached Cache-method calls, are AMBER. This is not a proof for arbitrary JavaScript and does not replace SIM-07 or behavioral revocation tests.'
};
console[status === 'PASS' ? 'log' : 'error'](JSON.stringify(out, null, 2));
process.exit(status === 'PASS' ? 0 : (status === 'AMBER' ? 2 : 1));
