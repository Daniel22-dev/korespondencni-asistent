#!/usr/bin/env node
// Instrument pinned Chromium installation without caching or changing browser tests.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const monotonic = () => Number(process.hrtime.bigint() / 1000000n);

export class BrowserDownloadTimeline {
  constructor() {
    this.phases = {
      chromium: { startedMs: null, completedMs: null },
      ffmpeg: { startedMs: null, completedMs: null },
      headlessShell: { startedMs: null, completedMs: null },
    };
  }

  observe(raw, elapsedMs) {
    const line = String(raw).replace(/\x1b\[[0-9;]*m/g, '').trim();
    const patterns = [
      ['chromium', /Downloading (?:Chrome for Testing|Chromium)(?! Headless Shell)/i, /(?:Chrome for Testing|Chromium)(?! Headless Shell).*downloaded to/i],
      ['ffmpeg', /Downloading FFmpeg/i, /FFmpeg.*downloaded to/i],
      ['headlessShell', /Downloading (?:Chrome|Chromium) Headless Shell/i, /(?:Chrome|Chromium) Headless Shell.*downloaded to/i],
    ];
    for (const [name, start, end] of patterns) {
      const p = this.phases[name];
      if (start.test(line) && p.startedMs === null) p.startedMs = elapsedMs;
      if (end.test(line) && p.startedMs !== null && p.completedMs === null) p.completedMs = elapsedMs;
    }
  }

  result() {
    return Object.fromEntries(Object.entries(this.phases).map(([name, p]) => [name, {
      observed: p.startedMs !== null,
      complete: p.completedMs !== null,
      durationMs: p.completedMs !== null ? Math.max(0, p.completedMs - p.startedMs) : null,
    }]));
  }
}

// Static compatibility assurance for the existing P5 browser-install gate.
// The direct-command branch keeps previous workflow configurations valid.
export function hasGuaranteedChromiumBootstrap(workflow, bootstrapSource) {
  if (/playwright install --with-deps chromium/.test(workflow)) return true;
  const checks = [
    /run:\s*node scripts\/ci-playwright-bootstrap\.mjs/,
    /CI_BOOTSTRAP_METRICS_PATH:/,
  ];
  if (!checks.every(pattern => pattern.test(workflow))) return false;
  const required = [
    /await runCommand\(argv,\s*\['--no-install',\s*'playwright',\s*'install-deps',\s*'chromium'\]/,
    /await runCommand\(argv,\s*\['--no-install',\s*'playwright',\s*'install',\s*'chromium'\]/,
    /if\s*\(info\.playwrightVersion\s*!==\s*'1\.61\.1'\)/,
    /fs\.accessSync\(chromiumPath,\s*fs\.constants\.X_OK\)/,
    /await runCommand\(chromiumPath,\s*\['--version'\]/,
    /fs\.appendFileSync\(process\.env\.GITHUB_ENV,\s*`CHROMIUM_PATH=/,
    /if\s*\(info\.status\s*!==\s*'PASS'\)\s*process\.exitCode\s*=\s*1/,
  ];
  return required.every(pattern => pattern.test(bootstrapSource));
}

// Split newline and carriage-return-based progress logs safely across stream chunks.
export function consumeStream(stream, handleLine) {
  let buffered = '';
  stream.on('data', chunk => {
    buffered += chunk.toString('utf8');
    const lines = buffered.split(/\r\n|\n|\r/g);
    buffered = lines.pop();
    for (const line of lines) handleLine(line);
    if (buffered.length > 65536) buffered = buffered.slice(-4096);
  });
  stream.on('end', () => { if (buffered) handleLine(buffered); });
}

async function runCommand(command, args, timeline, origin) {
  const start = monotonic();
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    child.on('error', reject);
    for (const [input, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      input.on('data', chunk => output.write(chunk));
      consumeStream(input, line => timeline?.observe(line, monotonic() - origin));
    }
    child.on('close', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed: ${signal || `exit ${code}`}`)));
  });
  return monotonic() - start;
}

export async function runBootstrap() {
  const job = process.env.CI_BOOTSTRAP_JOB || 'local';
  const output = process.env.CI_BOOTSTRAP_METRICS_PATH;
  if (!output) throw new Error('CI_BOOTSTRAP_METRICS_PATH must be set (private runner temp path).');
  const start = monotonic();
  const browser = new BrowserDownloadTimeline();
  const info = {
    schema: 'ghrab-ci-chromium-bootstrap-v1',
    job,
    sourceCommit: process.env.GITHUB_SHA || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    nodeVersion: process.version,
    playwrightVersion: require('playwright/package.json').version,
    startedAt: new Date().toISOString(),
    status: 'FAIL',
    timingsMs: { osDependencies: null, browserInstall: null, executableVerification: null, total: null },
    downloads: null,
  };
  const argv = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  try {
    if (info.playwrightVersion !== '1.61.1') throw new Error(`Unexpected Playwright version ${info.playwrightVersion}`);
    console.log('::group::Chromium OS dependencies (timed)');
    try { info.timingsMs.osDependencies = await runCommand(argv, ['--no-install', 'playwright', 'install-deps', 'chromium'], null, start); }
    finally { console.log('::endgroup::'); }
    console.log('::group::Pinned Chromium browser download/install (timed)');
    try { info.timingsMs.browserInstall = await runCommand(argv, ['--no-install', 'playwright', 'install', 'chromium'], browser, start); }
    finally { console.log('::endgroup::'); }
    const verifyStart = monotonic();
    const chromiumPath = require('playwright').chromium.executablePath();
    fs.accessSync(chromiumPath, fs.constants.X_OK);
    await runCommand(chromiumPath, ['--version'], null, start);
    info.timingsMs.executableVerification = monotonic() - verifyStart;
    if (/\r|\n/.test(chromiumPath)) throw new Error('Invalid Chromium executable path.');
    if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `CHROMIUM_PATH=${chromiumPath}\n`);
    info.status = 'PASS';
    console.log(`Pinned Chromium executable verified at ${chromiumPath}`);
  } catch (error) {
    info.failureStage = info.timingsMs.osDependencies === null ? 'osDependencies' : info.timingsMs.browserInstall === null ? 'browserInstall' : 'executableVerification';
    info.error = String(error?.message || error);
    console.error(`Chromium bootstrap FAIL: ${info.error}`);
  } finally {
    info.timingsMs.total = monotonic() - start;
    info.downloads = browser.result();
    info.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(info, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) {
      const t = info.timingsMs;
      const summary = `### ${job} Chromium bootstrap: ${info.status}\n\n` +
        '| Phase | Duration (s) |\n|---|---:|\n' +
        `| OS packages | ${format(t.osDependencies)} |\n| Browser install | ${format(t.browserInstall)} |\n` +
        `| Binary verification | ${format(t.executableVerification)} |\n| Total | ${format(t.total)} |\n\n` +
        '> Download subphases are observed from Playwright log events; absent events are recorded as unknown/not observed, not as zero.\n\n';
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
    }
  }
  if (info.status !== 'PASS') process.exitCode = 1;
}

function format(ms) { return ms === null ? 'n/a' : (ms / 1000).toFixed(3); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBootstrap().catch(error => { console.error(error); process.exitCode = 1; });
}
