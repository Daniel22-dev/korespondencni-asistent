import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserDownloadTimeline, consumeStream } from '../scripts/ci-playwright-bootstrap.mjs';
import { PassThrough } from 'node:stream';

test('timings for full Chromium, FFmpeg and headless-shell downloads', () => {
  const tracker = new BrowserDownloadTimeline();
  tracker.observe('Downloading Chrome for Testing 149 from https://example.test/chrome.zip', 20);
  tracker.observe('Chrome for Testing downloaded to /tmp/chromium', 1020);
  tracker.observe('Downloading FFmpeg from url', 1021);
  tracker.observe('FFmpeg downloaded to /tmp/ffmpeg', 1221);
  tracker.observe('Downloading Chrome Headless Shell 149 from url', 1222);
  tracker.observe('Chrome Headless Shell downloaded to /tmp/headless', 2522);
  assert.deepEqual(Object.values(tracker.result()).map(x => x.durationMs), [1000, 200, 1300]);
});

test('warm or already-present browser does not invent zero-second download events', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('browser is already installed', 10);
  for (const v of Object.values(t.result())) assert.deepEqual(v, { observed: false, complete: false, durationMs: null });
});

test('incomplete download is visible and never silently marked complete', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('Downloading Chrome for Testing 149', 10);
  assert.deepEqual(t.result().chromium, { observed: true, complete: false, durationMs: null });
});

test('out-of-order completed event cannot spoof a downloaded browser', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('Chrome for Testing downloaded to /tmp/evil', 10);
  assert.deepEqual(t.result().chromium, { observed: false, complete: false, durationMs: null });
});

test('duplicate events do not manipulate first observed completion time', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('Downloading FFmpeg', 50);
  t.observe('Downloading FFmpeg', 99);
  t.observe('FFmpeg downloaded to /tmp/path', 300);
  t.observe('FFmpeg downloaded to /tmp/path', 900);
  assert.equal(t.result().ffmpeg.durationMs, 250);
});

test('ANSI-prefixed Playwright events are recognized', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('\x1b[32mDownloading Chrome Headless Shell\x1b[0m', 5);
  t.observe('Chrome Headless Shell downloaded to /tmp/chrome', 85);
  assert.equal(t.result().headlessShell.durationMs, 80);
});

test('progress chunks with CR and newline are reconstructed safely', async () => {
  const stream = new PassThrough();
  const lines = [];
  consumeStream(stream, line => lines.push(line));
  stream.write('Downloading Chrom');
  stream.write('e for Testing\r20%\r');
  stream.end('Chrome for Testing downloaded to /tmp/chrome\n');
  await new Promise(resolve => stream.once('end', resolve));
  assert.deepEqual(lines, ['Downloading Chrome for Testing', '20%', 'Chrome for Testing downloaded to /tmp/chrome']);
});

test('zero-duration completed event can legitimately be recorded', () => {
  const t = new BrowserDownloadTimeline();
  t.observe('Downloading FFmpeg', 10);
  t.observe('FFmpeg downloaded to /tmp/ffmpeg', 10);
  assert.deepEqual(t.result().ffmpeg, { observed: true, complete: true, durationMs: 0 });
});
