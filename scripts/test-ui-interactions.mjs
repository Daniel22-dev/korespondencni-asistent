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
const runtimeConfigJs = await readFile(path.join(dist, 'runtime-config.js'), 'utf8');
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

async function findPageTarget(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const targets = await response.json();
    return targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl) || null;
  } catch {
    return null;
  }
}

async function waitPageTarget(listUrl, browserWebSocketDebuggerUrl) {
  const deadline = Date.now() + 12000;
  let createAttempts = 0;
  let nextCreateAt = 0;

  while (Date.now() < deadline) {
    const page = await findPageTarget(listUrl);
    if (page) return page;

    // GitHub Actions can expose /json/version a little earlier than the first
    // page target. If the launch target still has not appeared, create one via
    // the browser-level CDP endpoint instead of dereferencing undefined. The
    // create request is retryable too, because the browser WebSocket can itself
    // become ready a few milliseconds after /json/version.
    if (browserWebSocketDebuggerUrl && createAttempts < 4 && Date.now() >= nextCreateAt) {
      createAttempts += 1;
      nextCreateAt = Date.now() + 500;
      let browserClient;
      try {
        browserClient = new Cdp(browserWebSocketDebuggerUrl);
        await browserClient.call('Target.createTarget', { url: 'about:blank' });
      } catch {} finally {
        browserClient?.close();
      }
    }

    await sleep(75);
  }

  throw new Error(`Chromium started, but no page CDP target became available within 12 s (create attempts: ${createAttempts}).`);
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
  const memory = `<script data-ks-ui-test-storage>(()=>{class M{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){k=String(k);return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}};try{Object.defineProperty(window,'Storage',{value:M,configurable:true});Object.defineProperty(window,'localStorage',{value:new M(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new M(),configurable:true})}catch{}window.matchMedia=window.matchMedia||(()=>({matches:false,media:'',addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));})();<\/script>`;
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
let inAppTestApiAvailable = false;
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

async function elementPointSelector(selector) {
  return client.eval(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,topId:top?.id||'',topClass:String(top?.className||''),hit:Boolean(top&&(top===el||el.contains(top)))};})()`);
}

async function clickRealSelector(selector) {
  const point = await elementPointSelector(selector);
  if (!point) throw new Error(`Prvek ${selector} nebyl nalezen.`);
  await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await sleep(80);
  return point;
}

async function replaceText(selector, value) {
  await clickRealSelector(selector);
  await client.eval(`document.querySelector(${JSON.stringify(selector)})?.select?.()`);
  await client.call('Input.insertText', { text: String(value) });
  await client.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await client.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  await sleep(50);
}

async function openFooterTool(label) {
  await clickReal('footerToolsToggle');
  return clickRealSelector(`[data-footer-tool="${String(label).replace(/"/g, '\\"')}"]`);
}

async function exerciseFooterModal(label, expectedTitle, checkId) {
  await openFooterTool(label);
  const state = await client.eval(`(()=>{const overlay=[...document.querySelectorAll('.modal-overlay.open')].at(-1);return {open:Boolean(overlay),title:overlay?.querySelector('.modal-head b')?.textContent?.trim()||''};})()`);
  check(checkId, state.open && expectedTitle.test(state.title), JSON.stringify(state));
  if (state.open) await clickRealSelector('.modal-overlay.open .modal-close');
}

try {
  const version = await waitJson(`http://127.0.0.1:${port}/json/version`);
  const page = await waitPageTarget(`http://127.0.0.1:${port}/json`, version.webSocketDebuggerUrl);
  client = new Cdp(page.webSocketDebuggerUrl);
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
  await client.eval(runtimeConfigJs);
  await client.eval(platformJs);
  await client.eval(`window.__GHRAB_STUDIO_ACCESS__={permit:{role:'admin'}}`);
  // Runtime konfigurace je samostatný veřejný kontrakt aplikace; GHRAB Platform
  // už do výběru konkrétního modelu nevstupuje.
  check('studio-runtime.provider-neutral-before-unlock', typeof await client.eval(`window.__GHRAB_RUNTIME_CONFIG__?.ai?.directGemini?.profileModels?.balanced`) === 'string', 'runtime profile map');
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

  await client.eval(`localStorage.setItem('rozbor_profile',JSON.stringify({name:'Profil před testy',role:'učitel',gender:'male',subjects:'angličtina',school:'Testovací škola',writingStyle:'civilni',sign:'pozdrav'}))`);
  inAppTestApiAvailable = Boolean(await client.eval(`typeof window.__GHRAB_KORESP_TESTS__?.run==='function'`));
  if (inAppTestApiAvailable) {
    const inAppResults = await client.eval(`window.__GHRAB_KORESP_TESTS__.run()`);
    const inAppFailures = Array.isArray(inAppResults) ? inAppResults.filter(item => !item.ok) : [];
    check('in-app-tests.completed', Array.isArray(inAppResults) && inAppResults.length > 0, String(inAppResults?.length || 0));
    check('in-app-tests.passed', inAppFailures.length === 0, JSON.stringify(inAppFailures));
    const profileAfterTests = await client.eval(`JSON.parse(localStorage.getItem('rozbor_profile')||'{}')`);
    check('in-app-tests.profile-preserved', profileAfterTests.name === 'Profil před testy' && profileAfterTests.school === 'Testovací škola', JSON.stringify(profileAfterTests));
    check('in-app-tests.no-toast-noise', await client.eval(`document.getElementById('toasts')?.childElementCount===0`), 'temporary toast count');
  } else {
    const productionBoundary = await client.eval(`({namespaceType:typeof window.__GHRAB_KORESP_TESTS__,available:testRunnerAvailable(),openResult:openTestRunner(false)})`);
    check('in-app-tests.production-runner-stripped', productionBoundary.namespaceType === 'undefined' && productionBoundary.available === false && productionBoundary.openResult === false, JSON.stringify(productionBoundary));
    const profileAfterBoundary = await client.eval(`JSON.parse(localStorage.getItem('rozbor_profile')||'{}')`);
    check('in-app-tests.production-boundary-profile-preserved', profileAfterBoundary.name === 'Profil před testy' && profileAfterBoundary.school === 'Testovací škola', JSON.stringify(profileAfterBoundary));
  }

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

  await replaceText('#my_raw', 'Dobrý den, prosím o potvrzení termínu schůzky ve čtvrtek.');
  const anonPoint = await clickReal('my_anonBtn');
  check('click.compose-anonymize.hit-target', anonPoint.hit, `${anonPoint.topId || anonPoint.topClass}`);
  const composePrivacyReady = await client.eval(`document.getElementById('my_step2')?.hidden===false`);
  check('click.compose-anonymize.opens-settings', composePrivacyReady, String(composePrivacyReady));
  await sleep(450); // doAnon uses smooth scroll; let geometry settle before the next trusted click.

  const advancedPoint = await clickReal('uiAdvanced');
  check('click.advanced-mode.hit-target', advancedPoint.hit, `${advancedPoint.topId || advancedPoint.topClass}`);
  check('click.advanced-mode.enabled', await client.eval(`document.body.classList.contains('ui-advanced')`), 'body.ui-advanced');
  await sleep(80);
  const composeModePoint = await clickRealSelector('.chips[data-group="my_mode"] .chip[data-v="sestavit"]');
  check('click.compose-mode.hit-target', composeModePoint.hit, `${composeModePoint.topId || composeModePoint.topClass}`);
  check('click.compose-mode.selected', await client.eval(`document.querySelector('.chips[data-group="my_mode"] .chip[data-v="sestavit"]')?.classList.contains('on')`), 'my_mode=sestavit');
  const resultFoldState = await client.eval(`({hidden:document.getElementById('my_resultFold')?.hidden,open:document.getElementById('my_resultFold')?.open})`);
  if (!resultFoldState.hidden && !resultFoldState.open) await clickRealSelector('#my_resultFold > summary');
  const subjectPoint = await clickRealSelector('.chips[data-group="my_subj"] .chip[data-v="vlastni"]');
  check('click.custom-subject.hit-target', subjectPoint.hit, `${subjectPoint.topId || subjectPoint.topClass}`);
  check('click.custom-subject.selected', await client.eval(`document.querySelector('.chips[data-group="my_subj"] .chip[data-v="vlastni"]')?.classList.contains('on')`), 'my_subj=vlastni');
  await replaceText('#my_customSubject', 'Konzultace ve čtvrtek');
  const subjectState = await client.eval(`({visible:document.getElementById('my_customSubject')?.offsetParent!==null,value:document.getElementById('my_customSubject')?.value,count:document.getElementById('my_customSubjectCount')?.textContent,max:document.getElementById('my_customSubject')?.maxLength})`);
  check('click.custom-subject.available', subjectState.visible && subjectState.value === 'Konzultace ve čtvrtek' && subjectState.max === 60, JSON.stringify(subjectState));

  const footerLabels = await client.eval(`[...document.querySelectorAll('[data-footer-tool]')].map(button=>button.dataset.footerTool)`);
  const expectedFooterLabels = ['Uložené koncepty','Formulace a podpisy','Scénáře školní komunikace','Čekám na odpověď','Školní balíček šablon','Profil odesílatele','Poslední výstupy','Přehled změn','Prohlídka aplikace','Správa dat','Vývojářské nástroje'];
  check('footer.menu.complete', expectedFooterLabels.every(label=>footerLabels.includes(label)) && footerLabels.length===expectedFooterLabels.length, JSON.stringify(footerLabels));
  await exerciseFooterModal('Uložené koncepty', /^Rozpracované koncepty$/, 'footer.saved-drafts.opens');
  await exerciseFooterModal('Formulace a podpisy', /^(?:Formulace a podpisy|Podpisy)$/, 'footer.blocks-signatures.opens');
  await exerciseFooterModal('Scénáře školní komunikace', /^Scénáře školní komunikace$/, 'footer.scenarios.opens');
  await exerciseFooterModal('Čekám na odpověď', /^Připomínky a čekání na odpověď$/, 'footer.followups.opens');
  await exerciseFooterModal('Školní balíček šablon', /^Sdílená školní knihovna$/, 'footer.school-library.opens');

  await openFooterTool('Profil odesílatele');
  check('footer.profile.opens', await client.eval(`document.getElementById('profOverlay')?.classList.contains('open')`), 'profile overlay');
  await replaceText('#pf_name', 'Profil po uložení');
  check('footer.profile.stays-open-while-editing', await client.eval(`document.getElementById('profOverlay')?.classList.contains('open')`), 'editing');
  await clickReal('pf_save');
  const savedProfile = await client.eval(`JSON.parse(localStorage.getItem('rozbor_profile')||'{}')`);
  check('footer.profile.saves', savedProfile.name === 'Profil po uložení' && !(await client.eval(`document.getElementById('profOverlay')?.classList.contains('open')`)), JSON.stringify(savedProfile));
  await openFooterTool('Profil odesílatele');
  check('footer.profile.reopens-persisted', await client.eval(`document.getElementById('pf_name')?.value==='Profil po uložení'`), 'persisted profile');
  await clickReal('profClose');

  await openFooterTool('Poslední výstupy');
  check('footer.history.opens', await client.eval(`document.getElementById('histOverlay')?.classList.contains('open')`), 'history overlay');
  await clickReal('histClose');

  await openFooterTool('Přehled změn');
  check('footer.changelog.opens', await client.eval(`Boolean(document.querySelector('.modal-overlay.open [aria-label="Co je nového"]'))`), 'changelog modal');
  await clickRealSelector('.modal-overlay.open .modal-close');

  await openFooterTool('Prohlídka aplikace');
  check('footer.tour.opens', await client.eval(`Boolean(document.querySelector('.guide-overlay .tour-card'))`), 'tour overlay');
  await clickRealSelector('.guide-overlay .tour-skip');

  await openFooterTool('Správa dat');
  check('footer.data-manager.opens', await client.eval(`Boolean(document.querySelector('.modal-overlay.open [aria-label="Správa lokálních dat"]'))`), 'data manager modal');
  await clickRealSelector('.modal-overlay.open .modal-close');

  const devVisible = await client.eval(`Boolean(document.querySelector('[data-footer-tool="Vývojářské nástroje"]'))`);
  check('footer.developer-tools.admin-visible', devVisible, String(devVisible));
  if (devVisible) {
    await openFooterTool('Vývojářské nástroje');
    const devToolState = await client.eval(`({count:document.querySelectorAll('.modal-overlay.open .dev-tool-card').length,hasTests:Boolean(document.getElementById('devTests'))})`);
    const expectedDevToolCount = inAppTestApiAvailable ? 4 : 3;
    check('developer.menu.complete', devToolState.count === expectedDevToolCount, JSON.stringify({ ...devToolState, expectedDevToolCount }));
    check('developer.tests.matches-build-boundary', devToolState.hasTests === inAppTestApiAvailable, JSON.stringify({ ...devToolState, inAppTestApiAvailable }));
    if (inAppTestApiAvailable) {
      await clickReal('devTests');
      const runnerIdle = await client.eval(`({open:Boolean(document.querySelector('.modal-overlay.open [aria-label="Automatické testy"]')),enabled:!document.getElementById('runTestsNow')?.disabled,empty:!(document.getElementById('testOut')?.textContent||'').trim()})`);
      check('developer.tests.wait-for-explicit-start', runnerIdle.open && runnerIdle.enabled && runnerIdle.empty, JSON.stringify(runnerIdle));
      await clickRealSelector('.modal-overlay.open .modal-close');
      await openFooterTool('Vývojářské nástroje');
    }
    await clickReal('devDebug');
    check('developer.debug.opens', await client.eval(`Boolean(document.querySelector('.modal-overlay.open [aria-label="Debug prompt"]'))`), 'debug prompt');
    await clickRealSelector('.modal-overlay.open .modal-close');

    await openFooterTool('Vývojářské nástroje'); await clickReal('devOps');
    check('developer.ops.opens', await client.eval(`Boolean(document.querySelector('.modal-overlay.open [aria-label="Technický provozní log"]'))`), 'ops log');
    await clickRealSelector('.modal-overlay.open .modal-close');

    await openFooterTool('Vývojářské nástroje'); await clickReal('devAiRuntime');
    check('developer.runtime.opens', await client.eval(`Boolean(document.querySelector('.modal-overlay.open [aria-label="Diagnostika AI připojení"]'))`), 'runtime diagnostics');
    await clickRealSelector('.modal-overlay.open .modal-close');
  }

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
