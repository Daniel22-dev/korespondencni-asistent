#!/usr/bin/env node
// GARP 2.5.1 GHRAB - selftest
// Rozsiruje selftest 2.5 o negativni kontroly, ktere v nem chybely: determinismus
// artifactDigest, vazba keyId na trust root, revokovany klic, anti-rollback,
// neznamy release, prisna provenance, .env rodina, secret ve velkem souboru,
// vendorovany drift, zmrazeni brany v SW a fail-closed chovani release gate.
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const passed = [];
const run = (s, a) => spawnSync(process.execPath, [path.join(here, s), ...a], { encoding: 'utf8' });
const expect = (name, cond) => { if (cond) passed.push(name); else errors.push(name); };

const t = await mkdtemp(path.join(tmpdir(), 'garp251-'));
try {
  // --- fixture: deployment, ktery drive rozbijel poradi (adresar 'a' vedle souboru 'a.js')
  const deploy = path.join(t, 'dist');
  await mkdir(path.join(deploy, 'a'), { recursive: true });
  await writeFile(path.join(deploy, 'index.html'), '<h1>synthetic</h1>\n');
  await writeFile(path.join(deploy, 'a.js'), 'console.log("a")\n');
  await writeFile(path.join(deploy, 'a', 'z.js'), 'console.log("z")\n');
  await writeFile(path.join(deploy, 'ch.js'), 'console.log("ch")\n');
  await writeFile(path.join(deploy, 'h.js'), 'console.log("h")\n');

  let r = run('create-release-integrity.mjs', [deploy, 'synthetic-app', '1.2.0', 'ghrab-key-2026-A', path.join(t, 'ri.json')]);
  expect('create-ri', r.status === 0);
  const digest1 = JSON.parse(r.stdout || '{}').artifactDigest;

  // NC-1 determinismus: druhy beh musi dat stejny digest
  r = run('create-release-integrity.mjs', [deploy, 'synthetic-app', '1.2.0', 'ghrab-key-2026-A', path.join(t, 'ri2.json')]);
  expect('digest-deterministic', JSON.parse(r.stdout || '{}').artifactDigest === digest1);

  await copyFile(path.join(t, 'ri.json'), path.join(deploy, 'release-integrity.json'));
  r = run('verify-release-integrity.mjs', [deploy, path.join(deploy, 'release-integrity.json')]);
  expect('verify-ri-clean-with-dir-file-collision', r.status === 0);

  // NC-2 byte tamper
  await writeFile(path.join(deploy, 'a.js'), 'console.log("tampered")\n');
  r = run('verify-release-integrity.mjs', [deploy, path.join(deploy, 'release-integrity.json')]);
  expect('NC-ri-byte-tamper-fails', r.status !== 0);
  await writeFile(path.join(deploy, 'a.js'), 'console.log("a")\n');

  // NC-3 pridany soubor
  await writeFile(path.join(deploy, 'extra.js'), 'x\n');
  r = run('verify-release-integrity.mjs', [deploy, path.join(deploy, 'release-integrity.json')]);
  expect('NC-ri-extra-file-fails', r.status !== 0);
  await rm(path.join(deploy, 'extra.js'));

  // NC-4 legacy v1 manifest musi byt odmitnut
  const legacy = JSON.parse(await readFile(path.join(t, 'ri.json'), 'utf8'));
  legacy.schema = 'ghrab-release-integrity-v1';
  await writeFile(path.join(t, 'legacy.json'), JSON.stringify(legacy));
  r = run('verify-release-integrity.mjs', [deploy, path.join(t, 'legacy.json')]);
  expect('NC-legacy-v1-rejected', r.status !== 0);

  // --- podpis a trust root
  const A = generateKeyPairSync('ed25519'), B = generateKeyPairSync('ed25519');
  const pem = k => k.export({ type: 'spki', format: 'pem' });
  await writeFile(path.join(t, 'A.priv'), A.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  await writeFile(path.join(t, 'B.priv'), B.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const trust = {
    schema: 'ghrab-trust-root-v1',
    keys: [
      { keyId: 'ghrab-key-2026-A', algorithm: 'Ed25519', status: 'active', publicKeyPem: pem(A.publicKey) },
      { keyId: 'ghrab-key-2025-OLD', algorithm: 'Ed25519', status: 'revoked', publicKeyPem: pem(B.publicKey) }
    ]
  };
  await writeFile(path.join(t, 'trust-root.json'), JSON.stringify(trust, null, 2));

  r = run('sign-release-integrity.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'A.priv'), path.join(deploy, 'release-integrity.sig')]);
  expect('sign', r.status === 0);
  r = run('verify-release-signature.mjs', [path.join(deploy, 'release-integrity.json'), path.join(deploy, 'release-integrity.sig'), path.join(t, 'trust-root.json')]);
  expect('verify-signature-clean', r.status === 0);

  // NC-5 podpis cizim klicem pri deklarovanem keyId A
  r = run('sign-release-integrity.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'B.priv'), path.join(t, 'wrong.sig')]);
  r = run('verify-release-signature.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'wrong.sig'), path.join(t, 'trust-root.json')]);
  expect('NC-wrong-key-for-declared-keyId-denied', r.status !== 0);

  // NC-6 revokovany klic
  const revoked = JSON.parse(await readFile(path.join(t, 'ri.json'), 'utf8'));
  revoked.signature.keyId = 'ghrab-key-2025-OLD';
  await writeFile(path.join(t, 'revoked.json'), JSON.stringify(revoked, null, 2) + '\n');
  run('sign-release-integrity.mjs', [path.join(t, 'revoked.json'), path.join(t, 'B.priv'), path.join(t, 'revoked.sig')]);
  r = run('verify-release-signature.mjs', [path.join(t, 'revoked.json'), path.join(t, 'revoked.sig'), path.join(t, 'trust-root.json')]);
  expect('NC-revoked-key-denied', r.status !== 0);

  // NC-7 neznamy keyId
  const unknown = JSON.parse(await readFile(path.join(t, 'ri.json'), 'utf8'));
  unknown.signature.keyId = 'attacker-key';
  await writeFile(path.join(t, 'unknown.json'), JSON.stringify(unknown, null, 2) + '\n');
  run('sign-release-integrity.mjs', [path.join(t, 'unknown.json'), path.join(t, 'B.priv'), path.join(t, 'unknown.sig')]);
  r = run('verify-release-signature.mjs', [path.join(t, 'unknown.json'), path.join(t, 'unknown.sig'), path.join(t, 'trust-root.json')]);
  expect('NC-unknown-keyId-denied', r.status !== 0);

  // --- registry / anti-rollback
  const registry = {
    schema: 'ghrab-release-registry-v1', updatedAt: new Date().toISOString(),
    apps: [{ appId: 'synthetic-app', approvedVersion: '1.2.0', artifactDigest: digest1, keyId: 'ghrab-key-2026-A', approvedAt: new Date().toISOString(), status: 'approved', history: [{ version: '1.1.0' }] }]
  };
  await writeFile(path.join(t, 'registry.json'), JSON.stringify(registry, null, 2));
  r = run('verify-release-registry.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'registry.json')]);
  expect('registry-clean', r.status === 0);

  // NC-8 validne podepsany starsi release
  const old = { ...registry, apps: [{ ...registry.apps[0], approvedVersion: '1.3.0', history: [{ version: '1.2.0' }] }] };
  await writeFile(path.join(t, 'registry-newer.json'), JSON.stringify(old, null, 2));
  r = run('verify-release-registry.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'registry-newer.json')]);
  expect('NC-signed-rollback-denied', r.status !== 0);

  // NC-9 neznama aplikace
  const foreign = { ...registry, apps: [{ ...registry.apps[0], appId: 'jina-app' }] };
  await writeFile(path.join(t, 'registry-foreign.json'), JSON.stringify(foreign, null, 2));
  r = run('verify-release-registry.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'registry-foreign.json')]);
  expect('NC-unknown-release-denied', r.status !== 0);

  // --- provenance
  const artifact = path.join(t, 'build.zip');
  await writeFile(artifact, 'synthetic-artifact');
  run('create-build-provenance.mjs', [artifact, path.join(t, 'prov-local.json')]);
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov-local.json')]);
  expect('NC-untrusted-local-builder-rejected', r.status !== 0);
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov-local.json'), '--allow-local-builder']);
  expect('NC-local-builder-without-source-identity-still-rejected', r.status !== 0);

  const localWithSource = JSON.parse(await readFile(path.join(t, 'prov-local.json'), 'utf8'));
  localWithSource.source.revision = 'b'.repeat(40);
  await writeFile(path.join(t, 'prov-local2.json'), JSON.stringify(localWithSource, null, 2));
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov-local2.json')]);
  expect('NC-school-profile-rejects-local-builder', r.status !== 0);
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov-local2.json'), '--allow-local-builder']);
  expect('prep-allows-local-builder-explicitly', r.status === 0);

  const good = JSON.parse(await readFile(path.join(t, 'prov-local.json'), 'utf8'));
  good.source.revision = 'a'.repeat(40);
  good.builder.id = 'github-actions://Daniel22-dev/ai-studio-ghrab';
  await writeFile(path.join(t, 'prov.json'), JSON.stringify(good, null, 2));
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov.json')]);
  expect('provenance-clean', r.status === 0);
  await writeFile(artifact, 'tampered-artifact');
  r = run('verify-build-provenance.mjs', [artifact, path.join(t, 'prov.json')]);
  expect('NC-provenance-artifact-tamper-fails', r.status !== 0);
  await writeFile(artifact, 'synthetic-artifact');

  // --- leak scanner
  const leak = path.join(t, 'leak'); await mkdir(leak);
  await writeFile(path.join(leak, 'index.html'), 'ok');
  r = run('scan-deployment-leaks.mjs', [leak]);
  expect('leak-clean', r.status === 0);
  await writeFile(path.join(leak, '.env.production'), 'SESSION_SECRET=7f3a9c1e5b2d8046af11c3e7b9d05a62\n');
  r = run('scan-deployment-leaks.mjs', [leak]);
  expect('NC-env-production-detected', r.status !== 0);
  await rm(path.join(leak, '.env.production'));
  await writeFile(path.join(leak, 'bundle.js'), '// b\n' + 'a'.repeat(2_100_000) + '\nconst K="AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKE00";\n');
  r = run('scan-deployment-leaks.mjs', [leak]);
  expect('NC-secret-in-large-bundle-detected', r.status !== 0);
  await rm(path.join(leak, 'bundle.js'));
  await writeFile(path.join(leak, 'app.js.map'), '{}');
  r = run('scan-deployment-leaks.mjs', [leak]);
  expect('NC-sourcemap-detected', r.status !== 0);
  await rm(path.join(leak, 'app.js.map'));

  // --- evidence
  const ev = path.join(t, 'evidence'); await mkdir(ev);
  await writeFile(path.join(ev, 'result.txt'), 'PASS synthetic\n');
  run('create-evidence-manifest.mjs', [ev, path.join(t, 'evidence.json')]);
  r = run('verify-evidence-manifest.mjs', [ev, path.join(t, 'evidence.json')]);
  expect('evidence-clean', r.status === 0);
  await writeFile(path.join(ev, 'result.txt'), 'TAMPER\n');
  r = run('verify-evidence-manifest.mjs', [ev, path.join(t, 'evidence.json')]);
  expect('NC-evidence-tamper-fails', r.status !== 0);
  await writeFile(path.join(ev, 'result.txt'), 'PASS synthetic\n');

  // --- vendorovana konzistence
  const eco = path.join(t, 'eco');
  await mkdir(path.join(eco, 'studio', 'src'), { recursive: true });
  await mkdir(path.join(eco, 'ks', 'src', 'vendor'), { recursive: true });
  await mkdir(path.join(eco, 'sortio', 'src', 'vendor'), { recursive: true });
  await writeFile(path.join(eco, 'studio', 'src', 'platform.js'), 'export const V="1.1.0"\n');
  await writeFile(path.join(eco, 'ks', 'src', 'vendor', 'platform.js'), 'export const V="1.1.0"\n');
  await writeFile(path.join(eco, 'sortio', 'src', 'vendor', 'platform.js'), 'export const V="1.0.9"\n');
  const cfg = {
    schema: 'ghrab-vendored-consistency-v1', canonicalRoot: 'studio',
    components: [{ id: 'platform', canonical: 'src/platform.js', severity: 'CRITICAL' }],
    consumers: [
      { appId: 'ks', root: 'ks', copies: { platform: ['src/vendor/platform.js'] } },
      { appId: 'sortio', root: 'sortio', copies: { platform: ['src/vendor/platform.js'] } }
    ]
  };
  await writeFile(path.join(eco, 'cfg.json'), JSON.stringify(cfg, null, 2));
  r = run('check-vendored-consistency.mjs', [path.join(eco, 'cfg.json')]);
  expect('NC-vendored-drift-detected', r.status !== 0 && r.stderr.includes('DRIFT'));
  await writeFile(path.join(eco, 'sortio', 'src', 'vendor', 'platform.js'), 'export const V="1.1.0"\n');
  r = run('check-vendored-consistency.mjs', [path.join(eco, 'cfg.json')]);
  expect('vendored-consistent-after-fix', r.status === 0);

  // --- service worker freeze
  const swDir = path.join(t, 'swapp'); await mkdir(swDir, { recursive: true });
  await writeFile(path.join(swDir, 'app-guard.js'), '// guard\n');
  await writeFile(path.join(swDir, 'revoked-access.json'), '[]\n');
  await writeFile(path.join(swDir, 'index.html'), 'ok');
  const badSw = `const PRECACHE=['/index.html','/app-guard.js','/revoked-access.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});`;
  await writeFile(path.join(t, 'sw-bad.js'), badSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-bad.js'), swDir]);
  expect('NC-sw-freezes-guard-detected', r.status !== 0);

  // GH-02 hotfix regression: variable name must not hide an array-driven cache.add path.
  const blindSpotSw = `const RANDOM_CACHE_LIST=['/index.html','/app-guard.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>Promise.all(RANDOM_CACHE_LIST.map(asset=>cache.add(asset))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.includes('app-guard')){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}e.respondWith(fetch(e.request));});`;
  await writeFile(path.join(t, 'sw-blindspot.js'), blindSpotSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-blindspot.js'), swDir]);
  expect('NC-sw-arbitrary-array-name-cannot-hide-critical-precache', r.status !== 0 && (r.stderr.includes('CRITICAL') || r.stdout.includes('CRITICAL')));
  const goodSw = `const PRECACHE=['/index.html'];
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
if(u.pathname.includes('app-guard')||u.pathname.includes('revoked-access.json')){
  e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});`;
  await writeFile(path.join(t, 'sw-good.js'), goodSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-good.js'), swDir]);
  expect('sw-network-first-for-guard-passes', r.status === 0);

  // N7 hardening: alternate Cache API write paths must never be silent PASS.
  const criticalListPath = path.join(t, 'critical-list.json');
  await writeFile(criticalListPath, JSON.stringify(['app-guard.js'], null, 2));
  const swVariants = [
    ['property-array-addAll', `self.EXTRA_ASSETS=['/app-guard.js'];\nself.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.addAll(self.EXTRA_ASSETS))));`],
    ['cache-put-literal', `self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.put('/app-guard.js',new Response('x')))));`],
    ['cache-add-new-request', `self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.add(new Request('/app-guard.js')))));`],
    ['concat-addAll', `const BASE=['/index.html'];const X=BASE.concat(['/app-guard.js']);\nself.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.addAll(X))));`],
    ['split-addAll', `const X='/index.html,/app-guard.js'.split(',');\nself.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.addAll(X))));`],
    ['object-values-forof-add', `const MAP={a:'/index.html',b:'/app-guard.js'};\nself.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open('x');for(const asset of Object.values(MAP)){await cache.add(asset)}})()));`]
  ];
  for (const [id, code] of swVariants) {
    const f = path.join(t, `sw-${id}.js`); await writeFile(f, code);
    r = run('check-sw-security-freeze.mjs', [f, swDir, criticalListPath]);
    expect(`NC-sw-${id}-not-silent-pass`, r.status !== 0);
  }
  // N11 hardening: additional syntactic/indirect write paths must never be silent PASS.
  const n11Variants = [
    ['bracket-addAll', `const L=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>c['addAll'](L))));`],
    ['bound-alias-addAll', `const L=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>{const f=c.addAll.bind(c);return f(L)})));`],
    ['static-string-concat-add', `self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>c.add('/app-'+'guard.js'))));`],
    ['importScripts-external-sw-surface', `importScripts('./extra-precache.js');`]
  ];
  for (const [id, code] of n11Variants) {
    const f = path.join(t, `sw-n11-${id}.js`); await writeFile(f, code);
    r = run('check-sw-security-freeze.mjs', [f, swDir, criticalListPath]);
    expect(`NC-sw-n11-${id}-not-silent-pass`, r.status !== 0);
  }

  // N15 hardening: a computed Cache method name must be unresolved/AMBER, never silent PASS.
  const computedMethodSw = `const L=['/app-guard.js'];const M='add'+'All';self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>c[M](L))));`;
  await writeFile(path.join(t, 'sw-n15-computed-method.js'), computedMethodSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-n15-computed-method.js'), swDir, criticalListPath]);
  expect('NC-sw-n15-computed-cache-method-not-silent-pass', r.status !== 0 && (r.stderr.includes('AMBER') || r.stdout.includes('AMBER') || r.stderr.includes('FAIL') || r.stdout.includes('FAIL')));

  // N17 hardening: methods detached from a demonstrated Cache object must remain inside the
  // fail-closed envelope. Full JavaScript evaluation is unnecessary; AMBER is sufficient.
  const n17Variants = [
    ['reflect-get-detached', `const Y1=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>Reflect.get(c,'addAll').call(c,Y1))));`],
    ['destructure-detached', `const Y2=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>{const {addAll}=c;return addAll.call(c,Y2)})));`],
    ['comma-operator-detached', `const Y3=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>(0,c.addAll)(Y3))));`]
  ];
  for (const [id, code] of n17Variants) {
    const f = path.join(t, `sw-n17-${id}.js`); await writeFile(f, code);
    r = run('check-sw-security-freeze.mjs', [f, swDir, criticalListPath]);
    expect(`NC-sw-n17-${id}-amber-not-pass`, r.status === 2 && (r.stderr.includes('unresolved-cache-write') || r.stdout.includes('unresolved-cache-write')));
  }
  // Regression: the older bind-alias fixture must remain a blocking FAIL, not merely AMBER.
  const bindRegression = path.join(t, 'sw-n17-bind-regression.js');
  await writeFile(bindRegression, `const L=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>{const f=c.addAll.bind(c);return f(L)})));`);
  r = run('check-sw-security-freeze.mjs', [bindRegression, swDir, criticalListPath]);
  expect('NC-sw-n17-bind-regression-stays-fail', r.status === 1);

  // Final closeout (N18 LOW): prototype-level Cache method extraction is outside the normal
  // receiver analysis, but must still be fail-closed (AMBER), never silent PASS.
  const n18Variants = [
    ['prototype-call', `const Z4=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>Cache.prototype.addAll.call(c,Z4))));`],
    ['descriptor-prototype-call', `const Z3=['/app-guard.js'];self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(c=>Object.getOwnPropertyDescriptor(Cache.prototype,'addAll').value.call(c,Z3))));`]
  ];
  for (const [id, code] of n18Variants) {
    const f = path.join(t, `sw-n18-${id}.js`); await writeFile(f, code);
    r = run('check-sw-security-freeze.mjs', [f, swDir, criticalListPath]);
    expect(`NC-sw-n18-${id}-amber-not-pass`, r.status === 2 && (r.stderr.includes('unresolved-cache-write') || r.stdout.includes('unresolved-cache-write')));
  }

  const unresolvedSw = `let dynamicPath;self.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.add(dynamicPath))));`;
  await writeFile(path.join(t, 'sw-unresolved.js'), unresolvedSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-unresolved.js'), swDir, criticalListPath]);
  expect('NC-sw-unresolved-cache-write-amber-or-fail', r.status !== 0 && (r.stderr.includes('AMBER') || r.stdout.includes('AMBER') || r.stderr.includes('FAIL') || r.stdout.includes('FAIL')));

  // N8 hardening: comments/text proximity cannot create a network-only exemption.
  await writeFile(path.join(swDir, 'data-manifest.json'), '{}\n');
  const dataCritical = path.join(t, 'critical-data.json');
  await writeFile(dataCritical, JSON.stringify(['data-manifest.json'], null, 2));
  const commentBypassSw = `const CORE=['/index.html'];\nself.addEventListener('install',e=>e.waitUntil(caches.open('x').then(cache=>cache.addAll(CORE))));\nasync function networkFirst(request){ // data-manifest.json network later\n const cache=await caches.open('x');try{return await fetch(request)}catch(e){return cache.match(request)}}\nasync function cacheFirst(request){const cache=await caches.open('x');const c=await cache.match(request);if(c)return c;const rr=await fetch(request);if(rr.ok)await cache.put(request,rr.clone());return rr}\nself.addEventListener('fetch',e=>e.respondWith(cacheFirst(e.request)));`;
  await writeFile(path.join(t, 'sw-comment-bypass.js'), commentBypassSw);
  r = run('check-sw-security-freeze.mjs', [path.join(t, 'sw-comment-bypass.js'), swDir, dataCritical]);
  expect('NC-sw-comment-cannot-create-exemption', r.status !== 0);

  // N6 hardening: release gate itself must enforce the authoritative list and propagate SW failure.
  r = run('release-gate.mjs', [
    '--profile', 'prep', '--deploy', deploy, '--manifest', path.join(deploy, 'release-integrity.json'),
    '--signature', path.join(deploy, 'release-integrity.sig'), '--trust-root', path.join(t, 'trust-root.json'),
    '--sw', path.join(t, 'sw-blindspot.js'), '--critical-list', criticalListPath
  ]);
  expect('NC-gate-propagates-sw-critical-failure', r.status !== 0 && (r.stderr.includes('sw-security-freeze') || r.stdout.includes('sw-security-freeze')));

  r = run('release-gate.mjs', [
    '--profile', 'prep', '--deploy', deploy, '--manifest', path.join(deploy, 'release-integrity.json'),
    '--signature', path.join(deploy, 'release-integrity.sig'), '--trust-root', path.join(t, 'trust-root.json'),
    '--sw', path.join(t, 'sw-good.js')
  ]);
  expect('NC-gate-missing-critical-list-fails-closed', r.status !== 0 && (r.stderr.includes('critical-asset-list-missing') || r.stdout.includes('critical-asset-list-missing')));

  // N14 hardening: signed assurance links are a mandatory gate step when declared.
  const shaFile = async p => createHash('sha256').update(await readFile(p)).digest('hex');
  const sourcePkg = path.join(t, 'source-package.zip'); await writeFile(sourcePkg, 'source-package');
  const deployPkg = path.join(t, 'deployment-payload.zip'); await writeFile(deployPkg, 'deployment-payload');
  const sbom = path.join(t, 'sbom.json'); await writeFile(sbom, '{"bomFormat":"CycloneDX"}\n');
  const linked = JSON.parse(await readFile(path.join(t, 'ri.json'), 'utf8'));
  linked.sourcePackageSha256 = await shaFile(sourcePkg);
  linked.deploymentPackageSha256 = await shaFile(deployPkg);
  linked.buildProvenanceSha256 = await shaFile(path.join(t, 'prov.json'));
  linked.sbomSha256 = await shaFile(sbom);
  linked.evidenceManifestSha256 = await shaFile(path.join(t, 'evidence.json'));
  const linkedManifest = path.join(t, 'linked-ri.json');
  await writeFile(linkedManifest, JSON.stringify(linked, null, 2) + '\n');
  const linkedSig = path.join(t, 'linked-ri.sig');
  run('sign-release-integrity.mjs', [linkedManifest, path.join(t, 'A.priv'), linkedSig]);

  r = run('verify-assurance-links.mjs', [
    '--manifest', linkedManifest, '--source-package', sourcePkg, '--deployment-package', deployPkg,
    '--provenance', path.join(t, 'prov.json'), '--sbom', sbom, '--evidence-manifest', path.join(t, 'evidence.json')
  ]);
  expect('assurance-links-clean', r.status === 0);

  const altProv = JSON.parse(await readFile(path.join(t, 'prov.json'), 'utf8'));
  altProv.source.revision = 'c'.repeat(40); // still valid provenance for the same artifact, but not the signed hash link
  const altProvPath = path.join(t, 'prov-alt.json'); await writeFile(altProvPath, JSON.stringify(altProv, null, 2));
  r = run('release-gate.mjs', [
    '--profile', 'prep', '--deploy', deploy, '--manifest', linkedManifest, '--signature', linkedSig,
    '--trust-root', path.join(t, 'trust-root.json'), '--source-package', sourcePkg,
    '--deployment-package', deployPkg, '--provenance', altProvPath, '--sbom', sbom,
    '--evidence-manifest', path.join(t, 'evidence.json')
  ]);
  expect('NC-gate-assurance-provenance-substitution-red', r.status !== 0 && (r.stderr.includes('assurance-links') || r.stdout.includes('assurance-links')));

  // Copy only the gate itself: with declared signed links and no verifier beside it, it must fail before orchestration.
  const noVerifierDir = path.join(t, 'no-verifier-tools'); await mkdir(noVerifierDir);
  const noVerifierGate = path.join(noVerifierDir, 'release-gate.mjs');
  await copyFile(path.join(here, 'release-gate.mjs'), noVerifierGate);
  let miss = spawnSync(process.execPath, [noVerifierGate,
    '--profile', 'prep', '--deploy', deploy, '--manifest', linkedManifest, '--signature', linkedSig,
    '--trust-root', path.join(t, 'trust-root.json'), '--source-package', sourcePkg,
    '--deployment-package', deployPkg, '--provenance', path.join(t, 'prov.json'), '--sbom', sbom,
    '--evidence-manifest', path.join(t, 'evidence.json')
  ], { encoding:'utf8' });
  expect('NC-gate-missing-assurance-verifier-red', miss.status !== 0 && (miss.stderr.includes('assurance-links-verifier-missing') || miss.stdout.includes('assurance-links-verifier-missing')));

  // --- release gate fail-closed
  r = run('release-gate.mjs', ['--profile', 'school', '--deploy', deploy, '--manifest', path.join(deploy, 'release-integrity.json')]);
  expect('NC-gate-missing-inputs-fails-closed', r.status !== 0 && r.stderr.includes('required-input-missing'));

  await writeFile(path.join(deploy, 'release-integrity.json'), await readFile(path.join(t, 'ri.json')));
  run('sign-release-integrity.mjs', [path.join(deploy, 'release-integrity.json'), path.join(t, 'A.priv'), path.join(deploy, 'release-integrity.sig')]);
  r = run('release-gate.mjs', [
    '--profile', 'school', '--deploy', deploy, '--manifest', path.join(deploy, 'release-integrity.json'),
    '--signature', path.join(deploy, 'release-integrity.sig'), '--trust-root', path.join(t, 'trust-root.json'),
    '--registry', path.join(t, 'registry.json'), '--artifact', artifact, '--provenance', path.join(t, 'prov.json'),
    '--evidence-dir', ev, '--evidence-manifest', path.join(t, 'evidence.json')
  ]);
  expect('gate-full-chain-green', r.status === 0);
} finally { await rm(t, { recursive: true, force: true }); }

const out = { status: errors.length ? 'FAIL' : 'PASS', checks: passed.length + errors.length, passed: passed.length, failed: errors };
console[errors.length ? 'error' : 'log'](JSON.stringify(out, null, 2));
process.exit(errors.length ? 1 : 0);
