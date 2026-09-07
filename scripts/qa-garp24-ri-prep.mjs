#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist-school-server');
const evidenceDir = path.join(root, 'audit-evidence', 'garp24-ri-prep');
const keyId = `correspondence-garp24-migration-test-${pkg.version}`;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'ks-garp24-ri-'));
process.on('exit', () => { try { rmSync(tmp, {recursive:true, force:true}); } catch {} });
const results = [];
const now = new Date().toISOString();

function exec(script, args, options={}) {
  const res = spawnSync(process.execPath, [path.join(root, 'scripts', 'garp24', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env, ...(options.env || {})},
  });
  return {status: res.status ?? 1, stdout: res.stdout || '', stderr: res.stderr || ''};
}
function expectPass(id, res, detail='') {
  const pass = res.status === 0;
  results.push({id,status:pass?'PASS':'FAIL',detail:detail || (res.stdout+res.stderr).trim().slice(0,1200)});
  if (!pass) throw new Error(`${id} expected PASS`);
}
function expectFail(id, res, detail='') {
  const pass = res.status !== 0;
  results.push({id,status:pass?'PASS':'FAIL',detail:detail || (res.stdout+res.stderr).trim().slice(0,1200)});
  if (!pass) throw new Error(`${id} expected FAIL`);
}
function clone(name) {
  const target = path.join(tmp, name);
  cpSync(dist, target, {recursive:true});
  return target;
}

rmSync(evidenceDir, {recursive:true, force:true});
await import('node:fs/promises').then(({mkdir}) => mkdir(evidenceDir,{recursive:true}));

const {publicKey, privateKey} = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {type:'spki', format:'pem'},
  privateKeyEncoding: {type:'pkcs8', format:'pem'},
});
const {publicKey:wrongPublicKey} = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {type:'spki', format:'pem'},
  privateKeyEncoding: {type:'pkcs8', format:'pem'},
});
const privatePath = path.join(tmp, 'migration-test-private.pem');
const publicPath = path.join(evidenceDir, 'migration-test-public.pem');
const wrongPublicPath = path.join(tmp, 'wrong-public.pem');
writeFileSync(privatePath, privateKey, {mode:0o600});
writeFileSync(publicPath, publicKey);
writeFileSync(wrongPublicPath, wrongPublicKey);

const prep = spawnSync(process.execPath, [path.join(root,'scripts','garp24','prepare-release-integrity.mjs'), dist], {
  cwd: root, encoding:'utf8', env:{...process.env, GHRAB_RELEASE_KEY_ID:keyId, GHRAB_BUILD_ID:`correspondence-${pkg.version}-garp24-ri-prep`}
});
expectPass('RI-PREP-MANIFEST-AND-LEAK-SCAN', {status:prep.status,stdout:prep.stdout,stderr:prep.stderr});

const manifestPath = path.join(dist, 'release-integrity.json');
const sigPath = path.join(dist, 'release-integrity.sig');
const signRes = exec('sign-release-integrity.mjs', [manifestPath, privatePath, sigPath]);
expectPass('RI-05-DETACHED-SIGNATURE', signRes);
const verifyRes = exec('verify-release-bundle.mjs', [dist, publicPath, keyId]);
expectPass('RI-03-04-05-06-CLEAN-VERIFY', verifyRes);

const tamper = clone('risim-01');
const tamperPath = path.join(tamper,'index.html');
const tamperBytes = readFileSync(tamperPath);
const tamperOffset = Math.min(128, Math.max(0, tamperBytes.length - 1));
tamperBytes[tamperOffset] ^= 0x01;
writeFileSync(tamperPath, tamperBytes);
const tamperRes = exec('verify-release-integrity.mjs',[tamper,path.join(tamper,'release-integrity.json')]);
expectFail('RISIM-01-ONE-BYTE-TAMPER', tamperRes, `single byte flipped at index.html offset ${tamperOffset}; verifier=${(tamperRes.stdout+tamperRes.stderr).trim().slice(0,900)}`);

const manifestTamper = clone('risim-02');
const mtPath = path.join(manifestTamper,'release-integrity.json');
const mt = JSON.parse(readFileSync(mtPath,'utf8')); mt.buildId += '-tampered'; writeFileSync(mtPath, JSON.stringify(mt,null,2)+'\n');
expectFail('RISIM-02-MANIFEST-SIGNATURE-SUBSTITUTION', exec('verify-release-signature.mjs',[mtPath,path.join(manifestTamper,'release-integrity.sig'),publicPath]));

expectFail('RISIM-04-WRONG-TRUST-ROOT', exec('verify-release-bundle.mjs',[dist,wrongPublicPath,keyId]));

const missing = clone('risim-05');
rmSync(path.join(missing,'release-integrity.sig'));
expectFail('RISIM-05-MISSING-SIGNATURE', exec('verify-release-bundle.mjs',[missing,publicPath,keyId]));

const mixed = clone('risim-06');
writeFileSync(path.join(mixed,'unexpected-old-release.js'),'// synthetic mixed deployment marker\n');
expectFail('RISIM-06-PARTIAL-MIXED-DEPLOYMENT', exec('verify-release-integrity.mjs',[mixed,path.join(mixed,'release-integrity.json')]));

const leak = clone('risim-10');
writeFileSync(path.join(leak,'synthetic-debug.js.map'),'{}\n');
expectFail('RISIM-10-SOURCE-DEVELOPMENT-LEAK-NEGATIVE-CONTROL', exec('scan-deployment-leaks.mjs',[leak]));
expectPass('RISIM-10-CLEAN-DEPLOYMENT-REPASS', exec('scan-deployment-leaks.mjs',[dist]));
expectPass('NEGATIVE-CONTROL-CLEAN-VERIFY-REPASS', exec('verify-release-bundle.mjs',[dist,publicPath,keyId]));

const manifest = JSON.parse(readFileSync(manifestPath,'utf8'));
writeFileSync(path.join(evidenceDir,'ri-prep-results.json'), JSON.stringify({
  schema:'ghrab-garp24-ri-prep-evidence-v1',
  appId:'correspondence',
  version:pkg.version,
  generatedAt:now,
  provenance:{
    inputSourcePackageSha256: process.env.GHRAB_INPUT_SOURCE_PACKAGE_SHA256 || null,
    garp24PackageSha256: process.env.GHRAB_GARP_PACKAGE_SHA256 || null,
    sourceCommit: manifest.sourceCommit,
    deploymentPackageSha256: manifest.deploymentPackageSha256,
  },
  testKey:{keyId,algorithm:'Ed25519',purpose:'GARP 2.4 migration verification only; not production trust root',privateKeyIncluded:false},
  artifactDigest:manifest.artifactDigest,
  files:manifest.files.length,
  results,
},null,2)+'\n');
writeFileSync(path.join(evidenceDir,'key-custody-attestation.txt'), `GARP 2.4 – KEY CUSTODY ATTESTATION (BEZ SECRETU)\n\nRelease signer role: production release signer – NOT YET PROVISIONED\nkeyId: production keyId – NOT TESTED\nAlgorithm: Ed25519\nPrimary storage class (bez cesty/hesla): NOT TESTED\nPrivate key present on school server: NE – technický návrh/policy\nPrivate key present in repo/build/logs: NE – ověřeno scanem kandidáta\nRecovery backup exists: NOT TESTED\nRecovery storage class (bez detailu secretu): NOT TESTED\nRotation procedure documented: ANO – GARP 2.4 policy\nRevocation procedure documented: ANO – GARP 2.4 policy\nRecovery/rotation drill date: NOT TESTED\nRelease account strong MFA/passkey/hardware key: NOT TESTED\nEvidence type: technický RI-PREP test s dočasným Ed25519 klíčem mimo repo; test private key nebyl uložen do evidence ani deploymentu.\nPoznámky: testovací keyId ${keyId} není produkční trust root.\n`);
writeFileSync(path.join(evidenceDir,'source-deployment-separation.txt'), `SOURCE PACKAGE != DEPLOYMENT PACKAGE\n\nSource root: repository snapshot (src/, scripts/, tests/audit evidence, vendor).\nDeployment root: dist-school-server/\nDeployment forbidden by policy: .git, .github, audit-evidence, test-results, node_modules, *.map, *.pem, *.key, *.p12, *.pfx.\nLeak scan clean deployment: PASS.\nRISIM-10 injected synthetic .map: expected FAIL -> PASS negative control.\nBrowser JavaScript remains inspectable by design; separation minimizes disclosure but is not source secrecy.\n`);
console.log(JSON.stringify({status:'PASS',version:pkg.version,artifactDigest:manifest.artifactDigest,results:results.length,evidenceDir},null,2));
