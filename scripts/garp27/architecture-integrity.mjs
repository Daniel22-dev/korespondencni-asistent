#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const sha256Buffer = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = file => sha256Buffer(fs.readFileSync(file));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const posix = p => p.split(path.sep).join('/');

function walkFiles(root, rel = '') {
  const base = path.join(root, rel);
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const childRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) out.push(...walkFiles(root, childRel));
    else if (entry.isFile()) out.push(posix(childRel));
  }
  return out.sort();
}

function treeDigest(root, rel) {
  const files = walkFiles(root, rel);
  const h = crypto.createHash('sha256');
  for (const file of files) {
    const abs = path.join(root, file);
    const nested = posix(path.relative(path.join(root, rel), abs));
    h.update(nested); h.update('\0'); h.update(sha256File(abs)); h.update('\n');
  }
  return { digest: h.digest('hex'), files: files.length };
}

function resolveRelativeImport(root, fromRel, spec) {
  const fromDir = path.dirname(path.join(root, fromRel));
  const base = path.resolve(fromDir, spec);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.js'), path.join(base, 'index.mjs')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return posix(path.relative(root, candidate));
  }
  return null;
}

function isCodePosition(text, index) {
  let quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = 0; i < index; i++) {
    const ch = text[i], next = text[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
  }
  return !quote && !lineComment && !blockComment;
}

function extractImports(text) {
  const out = [];
  const patterns = [
    /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m; while ((m = re.exec(text))) if (isCodePosition(text, m.index)) out.push(m[1]);
  }
  return [...new Set(out)];
}

function candidateSourceIdentity(root) {
  const include = ['src', 'scripts', 'security/garp27', 'package.json', 'package-lock.json', '.github/workflows'];
  const files = [];
  for (const rel of include) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isFile()) files.push(posix(rel));
    else files.push(...walkFiles(root, rel));
  }
  const h = crypto.createHash('sha1');
  for (const rel of [...new Set(files)].sort()) {
    h.update(rel); h.update('\0'); h.update(fs.readFileSync(path.join(root, rel))); h.update('\n');
  }
  return { sha1: h.digest('hex'), files: files.length };
}

export function evaluateArchitecture(root = DEFAULT_ROOT, options = {}) {
  const checks = [];
  const findings = [];
  const check = (id, ok, detail = '', severity = 'HIGH') => {
    checks.push({ id, pass: Boolean(ok), detail });
    if (!ok) findings.push({ id, severity, detail });
  };
  const safeJson = rel => {
    const abs = path.join(root, rel);
    try { return readJson(abs); }
    catch (error) { findings.push({ id: `json:${rel}`, severity: 'HIGH', detail: String(error.message || error) }); return null; }
  };

  const policy = safeJson('security/garp27/architecture-policy.json');
  const inventory = safeJson('security/garp27/capability-inventory.json');
  const garpPolicy = safeJson('security/garp27/garp-policy.json');
  const trust = safeJson('security/garp27/trust-anchor.json');
  const packageJson = safeJson('package.json');

  check('G27-AR04.policy-present', Boolean(policy), 'architecture policy must parse');
  check('G27-AR03.inventory-present', Boolean(inventory), 'capability inventory must parse');
  check('G27-AUTH.policy-2.7', garpPolicy?.garpVersion === '2.7' && garpPolicy?.appId === 'correspondence', 'active policy must be GARP 2.7');
  check('G27-AUTH.architecture-2.7', policy?.garpVersion === '2.7' && policy?.singleAuthority === 'GARP-2.7', 'architecture authority must be GARP 2.7');
  check('G27-AUTH.inventory-2.7', inventory?.garpVersion === '2.7', 'inventory must be GARP 2.7');
  check('G27-VERSION.package', packageJson?.version === '5.10.28', `package version=${packageJson?.version ?? 'missing'}`);
  check('G27-VERSION.policy', garpPolicy?.appVersion === packageJson?.version && policy?.appVersion === packageJson?.version && inventory?.appVersion === packageJson?.version, 'GARP adapter versions must match package');

  for (const rel of policy?.requiredFiles || []) check(`G27-AR04.required:${rel}`, fs.existsSync(path.join(root, rel)), rel);

  if (trust && policy && inventory) {
    check('G27-AR04.policy-digest', sha256File(path.join(root, 'security/garp27/architecture-policy.json')) === trust.architecturePolicySha256, 'policy digest must match trust anchor');
    check('G27-AR04.inventory-digest', sha256File(path.join(root, 'security/garp27/capability-inventory.json')) === trust.capabilityInventorySha256, 'inventory digest must match trust anchor');
    check('G27-AR04.garp-policy-digest', sha256File(path.join(root, 'security/garp27/garp-policy.json')) === trust.garpPolicySha256, 'GARP policy digest must match trust anchor');
    const vendor = treeDigest(root, 'vendor/garp-2.7-consolidated-r1');
    check('G27-AR05.vendor-master-digest', vendor.digest === trust.garp27VendorTreeSha256, `${vendor.files} files; ${vendor.digest}`);
    const adapterTools = trust.adapterToolSha256s || {};
    for (const [rel, expected] of Object.entries(adapterTools)) {
      const abs = path.join(root, rel);
      check(`G27-AR04.tool-digest:${rel}`, fs.existsSync(abs) && /^[a-f0-9]{64}$/i.test(String(expected || '')) && sha256File(abs) === String(expected).toLowerCase(), `${rel} must match the trusted adapter-tool digest`, 'CRITICAL');
    }
    check('G27-AR04.tool-scope', Object.keys(adapterTools).length >= 5, `${Object.keys(adapterTools).length} application-specific GARP 2.7 tools bound`, 'CRITICAL');
    const anchorSha = sha256File(path.join(root, 'security/garp27/trust-anchor.json'));
    const external = process.env.GARP27_EXTERNAL_TRUST_SHA256 || options.externalTrustSha256 || '';
    if (process.env.CI === 'true' || options.requireExternalTrust) {
      const externalOk = /^[a-f0-9]{64}$/i.test(external) && external.toLowerCase() === anchorSha.toLowerCase();
      check('G27-AR04.external-ci-trust', externalOk, externalOk ? 'protected CI trust digest matched' : (external ? 'protected CI trust digest mismatch' : 'protected CI trust digest missing'), 'CRITICAL');
    } else {
      check('G27-AR04.local-trust-pin', Boolean(anchorSha), `local review pin ${anchorSha}`);
    }
  } else {
    check('G27-AR04.trust-anchor-present', false, 'trust anchor must parse', 'CRITICAL');
  }

  const sourceFiles = [];
  for (const scope of policy?.sourceScopes || []) {
    for (const rel of walkFiles(root, scope)) if (/\.(?:js|mjs)$/i.test(rel)) sourceFiles.push(rel);
  }
  check('G27-AR04.nonempty-source-scope', sourceFiles.length >= Number(policy?.minimumCheckedSourceFiles || 1), `${sourceFiles.length} JS/MJS files checked`, 'CRITICAL');

  let resolvedImports = 0;
  let unresolvedRelative = 0;
  let forbiddenEdges = 0;
  for (const rel of sourceFiles) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const spec of extractImports(text)) {
      if (!spec.startsWith('.')) continue;
      const target = resolveRelativeImport(root, rel, spec);
      if (!target) { unresolvedRelative++; findings.push({ id: 'G27-AR01.unresolved-import', severity: 'HIGH', detail: `${rel} -> ${spec}` }); continue; }
      resolvedImports++;
      for (const edge of policy?.forbiddenSourceEdges || []) {
        if (rel.startsWith(edge.fromPrefix) && target.startsWith(edge.toPrefix)) {
          forbiddenEdges++; findings.push({ id: 'G27-AR01.forbidden-edge', severity: 'CRITICAL', detail: `${rel} -> ${target}` });
        }
      }
    }
  }
  check('G27-AR01.resolver', unresolvedRelative === 0, `${resolvedImports} relative imports resolved; ${unresolvedRelative} unresolved`, unresolvedRelative ? 'HIGH' : 'LOW');
  check('G27-AR01.forbidden-edges', forbiddenEdges === 0, `${forbiddenEdges} forbidden dependency edges`);

  const distDir = path.join(root, 'dist');
  const artifactFiles = walkFiles(root, 'dist');
  check('G27-AR02.artifact-present', fs.existsSync(distDir) && artifactFiles.length > 0, `${artifactFiles.length} files in dist`, 'CRITICAL');
  let forbiddenArtifactPaths = 0;
  for (const rel of artifactFiles) {
    const inside = rel.slice('dist/'.length);
    if ((policy?.forbiddenArtifactPathPrefixes || []).some(prefix => inside.startsWith(prefix))) {
      forbiddenArtifactPaths++; findings.push({ id: 'G27-AR02.forbidden-artifact-path', severity: 'CRITICAL', detail: rel });
    }
  }
  check('G27-AR02.no-test-security-paths', forbiddenArtifactPaths === 0, `${forbiddenArtifactPaths} forbidden artifact paths`);

  let fragmentHits = 0;
  for (const rel of artifactFiles) {
    if (!/\.(?:html|js|mjs|json|txt|map)$/i.test(rel)) continue;
    let text; try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    for (const fragment of policy?.forbiddenArtifactFragments || []) if (text.includes(fragment)) {
      fragmentHits++; findings.push({ id: 'G27-AR02.forbidden-artifact-fragment', severity: 'CRITICAL', detail: `${rel}: ${fragment}` });
    }
  }
  check('G27-AR02.no-production-bypass', fragmentHits === 0, `${fragmentHits} forbidden production fragments`);
  const distIndex = fs.existsSync(path.join(root, 'dist/index.html')) ? fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8') : '';
  check('G27-AR02.test-hooks-disabled', /const TEST_HOOKS_BUILD_ENABLED=\"0\"===\"1\";/.test(distIndex), 'production build must compile test hooks to disabled state', 'CRITICAL');

  const operations = safeJson('src/ai-operations.json');
  const observedOps = (operations?.operations || []).map(x => x?.operation).filter(Boolean);
  const expectedOps = inventory?.aiOperations || [];
  check('G27-AR03.ai-operation-inventory', JSON.stringify(observedOps) === JSON.stringify(expectedOps), `observed=${observedOps.length}, expected=${expectedOps.length}`, 'CRITICAL');
  check('G27-AR03.agentic-none', inventory?.agentic === false && Array.isArray(inventory?.autonomousToolCapabilities) && inventory.autonomousToolCapabilities.length === 0, 'agentic/tool capability inventory must remain empty');

  const standalone = safeJson('src/config/deployment.json');
  const school = safeJson('src/config/deployment.school-server.json');
  const runtimeStandaloneText = fs.existsSync(path.join(root, 'src/runtime-config.js')) ? fs.readFileSync(path.join(root, 'src/runtime-config.js'), 'utf8') : '';
  const runtimeSchoolText = fs.existsSync(path.join(root, 'src/runtime-config.school-server.js')) ? fs.readFileSync(path.join(root, 'src/runtime-config.school-server.js'), 'utf8') : '';
  check('G27-AR03.standalone-egress-mode', standalone?.aiTransport === 'direct-gemini' && standalone?.features?.allowLocalProviderKeys === true, 'standalone must stay explicit direct-gemini');
  check('G27-AR03.school-egress-mode', school?.aiTransport === 'school-gateway' && school?.features?.allowLocalProviderKeys === false, 'school profile must be provider-neutral and forbid local provider keys', 'CRITICAL');
  check('G27-LIVE.validation-required-standalone-config', standalone?.features?.liveServerValidationRequired === true, 'server LIVE validation must remain required before server claims');
  check('G27-LIVE.validation-required-school-config', school?.features?.liveServerValidationRequired === true, 'server LIVE validation must remain required before server claims');
  check('G27-AR03.no-automatic-fallback', /automaticFallback:\s*false/.test(runtimeStandaloneText) && /automaticFallback:\s*false/.test(runtimeSchoolText), 'both runtime profiles must remain explicit/fail-closed');
  check('G27-AR03.school-runtime-only-gateway', /allowedModes:\s*\["school-gateway"\]/.test(runtimeSchoolText) && /allowUserModeSelection:\s*false/.test(runtimeSchoolText), 'school runtime exposes only school-gateway');

  const activeGarpFiles = walkFiles(root, 'security/garp27').filter(x => /\.json$/.test(x));
  let conflictingAuthority = 0;
  for (const rel of activeGarpFiles) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (/"garpVersion"\s*:\s*"(?:2\.5|2\.6)"/.test(text)) {
      conflictingAuthority++; findings.push({ id: 'G27-AR05.conflicting-authority', severity: 'CRITICAL', detail: rel });
    }
  }
  check('G27-AR05.single-active-authority', conflictingAuthority === 0, `${conflictingAuthority} conflicting active GARP versions`);

  const sourceIdentity = candidateSourceIdentity(root);
  const critical = findings.filter(x => x.severity === 'CRITICAL').length;
  const high = findings.filter(x => x.severity === 'HIGH').length;
  const status = critical || high ? 'FAIL' : 'PASS';
  return {
    classification: 'FOUNDATION_ARCHITECTURE_INTEGRITY',
    schema: 'garp27-architecture-integrity-report-v1',
    garpVersion: '2.7',
    appId: 'correspondence',
    appVersion: packageJson?.version || null,
    status,
    trustMode: (process.env.CI === 'true' || options.requireExternalTrust) ? 'EXTERNAL_CI_PIN' : 'LOCAL_PIN',
    candidateSourceIdentity: sourceIdentity,
    scope: { sourceFiles: sourceFiles.length, artifactFiles: artifactFiles.length, resolvedRelativeImports: resolvedImports },
    checks,
    findings,
    summary: { total: checks.length, passed: checks.filter(x => x.pass).length, failed: checks.filter(x => !x.pass).length, critical, high }
  };
}

function cli() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--root');
  const outIdx = args.indexOf('--out');
  const root = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : DEFAULT_ROOT;
  try {
    const report = evaluateArchitecture(root, { requireExternalTrust: args.includes('--require-external-trust') });
    const text = JSON.stringify(report, null, 2) + '\n';
    if (outIdx >= 0) { const out = path.resolve(args[outIdx + 1]); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); }
    process.stdout.write(text);
    process.exit(report.status === 'PASS' ? 0 : 1);
  } catch (error) {
    process.stderr.write(JSON.stringify({ classification: 'HARNESS_ERROR', status: 'HARNESS_ERROR', message: String(error?.stack || error) }, null, 2) + '\n');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) cli();
