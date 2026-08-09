#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve('.');
const dist = path.join(root, 'dist');
const consumer = JSON.parse(await readFile(path.join(root, 'ghrab-platform.consumer.json'), 'utf8'));
const raw = await readFile(path.join(dist, 'index.html'), 'utf8');
const platformJs = (await readFile(path.join(dist, 'ghrab', 'ghrab-platform.js'), 'utf8'))
  .replace("new URL('./ghrab/ghrab-platform.js', location.href)", "new URL('https://example.test/app/ghrab/ghrab-platform.js')");

function chromiumPath() {
  for (const candidate of [
    process.env.CHROMIUM_PATH,
    '/usr/lib/chromium/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].filter(Boolean)) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chromium není dostupné pro regresní test klikacího UI.');
}

async function waitJson(url) {
  for (let i = 0; i < 180; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await sleep(50);
  }
  throw new Error('Chromium remote debugging timeout.');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.seq = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    };
  }
  async call(method, params = {}) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime evaluation failed');
    }
    return response.result?.value;
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

function prepareHtml(source) {
  const memory = `<script data-ks-ui-test-storage>(()=>{class M{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){k=String(k);return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}};try{Object.defineProperty(window,'localStorage',{value:new M(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new M(),configurable:true})}catch{}window.matchMedia=window.matchMedia||(()=>({matches:false,media:'',addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));})();<\/script>`;
  let html = source
     .replace(/(<html\b[^>]*\bdata-ghrab-access=)["']checking["']/i, '$1"granted"')
    .replace(/<meta\b[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*href=["']\/AI-Studio-GHRAB\/access\/access-gate\.css["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*data-ghrab-runtime-config[^>]*><\/script>/gi, '')
    .replace(/<script\b[^>]*data-ghrab-platform-loader[^>]*><\/script>/gi, '')
    .replace(/<script\b(?=[^>]*data-ghrab-access-bootstrap)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<head\b[^>]*>/i, match => `${match}\n${memory}`);
  return html;
}

const port = 9950 + (process.pid % 300);
const profile = `/tmp/ks-ui-click-${process.pid}`;
rmSync(profile, { recursive: true, force: true });
const chrome = spawn(chromiumPath(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore', detached: true });

let client;
const errors = [];
const checks = [];
const check = (id, ok, detail = '') => checks.push({ id, ok: Boolean(ok), detail });

async function elementPoint(id) {
  return client.eval(`(()=>{const el=document.getElementById(${JSON.stringify(id)});if(!el)return null;el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,topId:top?.id||'',topClass:String(top?.className||''),hit:Boolean(top&&(top===el||top.closest?.('#'+CSS.escape(${JSON.stringify(id)}))===el))};})()`);
}

async function clickReal(id) {
  const point = await elementPoint(id);
  if (!point) throw new Error(`Prvek #${id} nebyl nalezen.`);
  await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await sleep(80);
  return point;
}

try {
  await waitJson(`http://127.0.0.1:${port}/json/version`);
  const pages = await waitJson(`http://127.0.0.1:${port}/json`);
  client = new Cdp(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await client.call('Runtime.enable');
  await client.call('Page.enable');
  await client.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 900 });
  client.ws.addEventListener?.('message', event => {
    try {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'exception');
    } catch {}
  });
  const tree = await client.call('Page.getFrameTree');
  await client.call('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html: prepareHtml(raw) });
  await client.eval(`window.__KS_UI_TEST_ERRORS__=[];addEventListener('error',e=>window.__KS_UI_TEST_ERRORS__.push(String(e.error?.stack||e.message||e.error||'error')));addEventListener('unhandledrejection',e=>window.__KS_UI_TEST_ERRORS__.push(String(e.reason?.stack||e.reason||'rejection')));`);
  await client.eval(platformJs);
  const protectedBefore = await client.eval(`document.querySelectorAll('script[type="application/ghrab-protected"][data-ghrab-protected]').length`);
  check('protected-script.present-before-unlock', protectedBefore === 1, String(protectedBefore));
  const unlockCount = await client.eval(`window.GHRAB_PLATFORM?.unlockProtectedScripts?.() ?? -1`);
  check('protected-script.actual-platform-unlock', unlockCount === 1, String(unlockCount));

  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    ready = Boolean(await client.eval(`document.documentElement.dataset.ksShellReady==='true' && document.documentElement.dataset.ksAppReady==='true'`));
    if (ready) break;
    await sleep(25);
  }
  check('ui.runtime-ready', ready, String(ready));
  check('onboarding.not-auto-blocking', !(await client.eval(`Boolean(document.querySelector('.guide-overlay'))`)), 'automatic .guide-overlay');

  const darkBefore = await client.eval(`document.body.classList.contains('dark')`);
  const modePoint = await clickReal('btnMode');
  const darkAfter = await client.eval(`document.body.classList.contains('dark')`);
  check('click.theme.hit-target', modePoint.hit, `${modePoint.topId || modePoint.topClass}`);
  check('click.theme.changed', darkAfter !== darkBefore, `${darkBefore} -> ${darkAfter}`);

  await client.eval(`window.__KS_FS_CALLS__=0;Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:()=>{window.__KS_FS_CALLS__+=1;return Promise.resolve()}});`);
  const fsPoint = await clickReal('btnFs');
  const fsCalls = await client.eval(`window.__KS_FS_CALLS__`);
  check('click.fullscreen.hit-target', fsPoint.hit, `${fsPoint.topId || fsPoint.topClass}`);
  check('click.fullscreen.invoked', fsCalls === 1, String(fsCalls));

  const inPoint = await clickReal('tabIn');
  const inState = await client.eval(`({workspaceHidden:document.getElementById('workspaceShell')?.hidden,deskHidden:document.getElementById('teacherDesk')?.hidden,tabActive:document.getElementById('tabIn')?.classList.contains('active'),paneActive:document.getElementById('pane-in')?.classList.contains('active')})`);
  check('click.incoming.hit-target', inPoint.hit, `${inPoint.topId || inPoint.topClass}`);
  check('click.incoming.opens-workspace', inState.workspaceHidden === false && inState.deskHidden === true && inState.tabActive === true && inState.paneActive === true, JSON.stringify(inState));

  const backPoint = await clickReal('backToStart');
  const backState = await client.eval(`({workspaceHidden:document.getElementById('workspaceShell')?.hidden,deskHidden:document.getElementById('teacherDesk')?.hidden})`);
  check('click.back.hit-target', backPoint.hit, `${backPoint.topId || backPoint.topClass}`);
  check('click.back.restores-start', backState.workspaceHidden === true && backState.deskHidden === false, JSON.stringify(backState));

  const myPoint = await clickReal('tabMy');
  const myState = await client.eval(`({workspaceHidden:document.getElementById('workspaceShell')?.hidden,deskHidden:document.getElementById('teacherDesk')?.hidden,tabActive:document.getElementById('tabMy')?.classList.contains('active'),paneActive:document.getElementById('pane-my')?.classList.contains('active')})`);
  check('click.compose.hit-target', myPoint.hit, `${myPoint.topId || myPoint.topClass}`);
  check('click.compose.opens-workspace', myState.workspaceHidden === false && myState.deskHidden === true && myState.tabActive === true && myState.paneActive === true, JSON.stringify(myState));

  const tourTool = await client.eval(`Boolean([...document.querySelectorAll('button')].find(b=>/Prohlídka aplikace/i.test(b.textContent||b.getAttribute('title')||'')))`);
  check('onboarding.manual-entry-present', tourTool, String(tourTool));
  const runtimeErrors = await client.eval(`window.__KS_UI_TEST_ERRORS__||[]`);
  check('runtime.no-errors', runtimeErrors.length === 0 && errors.length === 0, JSON.stringify([...errors, ...runtimeErrors].slice(0, 5)));
} finally {
  client?.close();
  if (chrome.exitCode === null) { try { process.kill(-chrome.pid, 'SIGTERM'); } catch {} }
  await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), sleep(1200)]);
  if (chrome.exitCode === null) { try { process.kill(-chrome.pid, 'SIGKILL'); } catch {} }
  await sleep(80);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const failed = checks.filter(item => !item.ok);
const report = {
  schema: 'ks-ui-interaction-regression-v1',
  appId: consumer.appId,
  appVersion: consumer.appVersion,
  actualProtectedUnlock: true,
  trustedMouseClicks: true,
  checks,
  summary: { passed: checks.length - failed.length, failed: failed.length },
  status: failed.length ? 'failed' : 'passed',
};
await writeFile(path.join(dist, 'qa-p5-ui-interactions-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
