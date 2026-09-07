import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const TRUSTED_ORIGIN = process.env.TRUSTED_STUDIO_ORIGIN || 'https://daniel22-dev.github.io';
const TRUSTED_PREFIX = process.env.TRUSTED_MANIFEST_PREFIX || '/AI-Studio-GHRAB/ai-core/releases/';
const manifestFile = path.resolve(process.argv[2] || '');
const manifestUrlRaw = process.env.MANIFEST_URL || '';
if (!manifestFile || !fs.existsSync(manifestFile)) throw new Error('Usage: node scripts/sync-ghrab-ai-core.mjs <manifest.json>');
if (!manifestUrlRaw) throw new Error('MANIFEST_URL is required.');
const manifestUrl = new URL(manifestUrlRaw);
if (manifestUrl.protocol !== 'https:' || manifestUrl.origin !== TRUSTED_ORIGIN || !manifestUrl.pathname.startsWith(TRUSTED_PREFIX)) {
  throw new Error('Untrusted GHRAB AI Core manifest URL.');
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const configFile = path.join(ROOT, 'ghrab-ai-core.consumer.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
if (manifest.schema !== 'ghrab-ai-core-release-v1') throw new Error('Unexpected release manifest schema.');
if (!/^\d+\.\d+\.\d+$/.test(manifest.coreVersion || '')) throw new Error('Invalid coreVersion.');
if (!/^\d+$/.test(String(manifest.contractVersion || ''))) throw new Error('Invalid contractVersion.');
if (!/^[a-z0-9._-]+$/i.test(manifest.buildId || '')) throw new Error('Invalid buildId.');
for (const key of ['CORE_VERSION', 'CONTRACT_VERSION', 'BUILD_ID']) {
  const expected = process.env[key];
  const actual = key === 'CORE_VERSION' ? manifest.coreVersion : key === 'CONTRACT_VERSION' ? String(manifest.contractVersion) : manifest.buildId;
  if (expected && expected !== actual) throw new Error(`${key} mismatch.`);
}
const expectedName = `ghrab-ai-core-manifest-${manifest.coreVersion}.json`;
if (!manifestUrl.pathname.endsWith(`/${expectedName}`)) throw new Error('Manifest filename does not match coreVersion.');

const artifacts = Object.entries(manifest.artifacts || {});
if (!artifacts.length) throw new Error('Release manifest contains no artifacts.');
for (const [name, item] of artifacts) {
  if (!/^[a-z0-9._-]+$/i.test(name) || !/^[a-f0-9]{64}$/i.test(item?.sha256 || '')) throw new Error(`Invalid artifact metadata: ${name}`);
}
const required = [`ghrab-ai-core-${manifest.coreVersion}.js`, `ghrab-ai-conformance-${manifest.coreVersion}.js`];
for (const name of required) if (!manifest.artifacts[name]) throw new Error(`Required artifact missing: ${name}`);

const vendorRoot = path.join(ROOT, 'vendor');
const currentDir = path.join(vendorRoot, `ghrab-ai-core-${config.coreVersion}`);
const targetDir = path.join(vendorRoot, `ghrab-ai-core-${manifest.coreVersion}`);
const tempDir = path.join(vendorRoot, `.ghrab-ai-core-${manifest.coreVersion}-${process.pid}.tmp`);
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
const releaseBase = new URL('./', manifestUrl);
for (const [name, item] of artifacts) {
  const artifactUrl = new URL(name, releaseBase);
  if (artifactUrl.origin !== manifestUrl.origin || path.posix.dirname(artifactUrl.pathname) !== path.posix.dirname(manifestUrl.pathname)) {
    throw new Error(`Artifact escaped trusted release directory: ${name}`);
  }
  const response = await fetch(artifactUrl, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${name}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 5 * 1024 * 1024) throw new Error(`Artifact too large: ${name}`);
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  if (actual !== item.sha256) throw new Error(`SHA-256 mismatch: ${name}`);
  fs.writeFileSync(path.join(tempDir, name), data);
}
fs.writeFileSync(path.join(tempDir, expectedName), JSON.stringify(manifest, null, 2) + '\n');

const contractName = `ghrab-ai-contract-v${manifest.contractVersion}.0.0.md`;
if (!fs.existsSync(path.join(tempDir, contractName))) {
  if (String(config.contractVersion) !== String(manifest.contractVersion)) {
    throw new Error(`Contract ${manifest.contractVersion} is not a signed manifest artifact.`);
  }
  const existingContract = path.join(currentDir, contractName);
  if (!fs.existsSync(existingContract)) throw new Error(`Existing contract missing: ${contractName}`);
  fs.copyFileSync(existingContract, path.join(tempDir, contractName));
}

const oldVersion = config.coreVersion;
const oldContract = String(config.contractVersion);
const oldBuildId = config.buildId;
for (const relative of config.versionFiles || []) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) throw new Error(`Configured version file missing: ${relative}`);
  let text = fs.readFileSync(file, 'utf8');
  text = text.split(oldVersion).join(manifest.coreVersion);
  text = text.split(oldBuildId).join(manifest.buildId);
  if (oldContract !== String(manifest.contractVersion)) {
    text = text.replace(/("contractVersion"\s*:\s*")\d+("|\.)/g, `$1${manifest.contractVersion}$2`);
  }
  fs.writeFileSync(file, text);
}
config.coreVersion = manifest.coreVersion;
config.contractVersion = String(manifest.contractVersion);
config.buildId = manifest.buildId;
config.lastSynchronizedAt = new Date().toISOString();
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
fs.rmSync(targetDir, { recursive: true, force: true });
fs.renameSync(tempDir, targetDir);
if (oldVersion !== manifest.coreVersion && fs.existsSync(currentDir)) fs.rmSync(currentDir, { recursive: true, force: true });
console.log(`Synchronized GHRAB AI Core ${manifest.coreVersion} for ${config.appId}.`);
