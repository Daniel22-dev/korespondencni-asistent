/* ===================== PWA INSTALACE ===================== */
/* Viditelné oznámení nové verze: dřív šla informace jen do konzole, kde ji učitel nikdy neuvidí.
   Proužek dole nabídne okamžité načtení nové verze, nebo jde zavřít a nová verze se načte při příštím otevření. */
function showUpdateNotice(){
  if($('#updateNotice'))return;
  const bar=document.createElement('div');
  bar.id='updateNotice';bar.className='update-notice';bar.setAttribute('role','status');
  bar.innerHTML='<span>Je připravená nová verze aplikace.</span><button class="btn small" type="button" id="updateReload">Načíst novou verzi</button><button class="update-close" type="button" id="updateClose" aria-label="Zavřít oznámení">✕</button>';
  document.body.appendChild(bar);
  $('#updateReload').addEventListener('click',()=>location.reload());
  $('#updateClose').addEventListener('click',()=>bar.remove());
}
function runWhenWindowLoaded(fn){
  if(document.readyState==="complete") fn();
  else window.addEventListener("load",fn,{once:true});
}
function registerPwa(){
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  runWhenWindowLoaded(() => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        try { reg.update(); } catch (_) {}
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateNotice();
            }
          });
        });
      })
      .catch((err) => console.warn('PWA registrace selhala:', err));
  });
}
registerPwa();

TestSystem.init();

const TIER_ORDER=['support','core','extend'];
function insertSheetInTierOrder(results,sheet){
  const wanted=TIER_ORDER.indexOf(sheet._tierKey);
  const before=[...results.children].find(node=>TIER_ORDER.indexOf(node._tierKey)>wanted);
  if(before)results.insertBefore(sheet,before);else results.appendChild(sheet);
}
async function generateVersions(keys,triggerBtn){
  clearErr($('#configErr'));
  const base=$('#baseText').value.trim();
  try{assertTextLength(base,'Načtené zadání')}catch(err){errBox($('#configErr'),friendlyApiMessage(err));return}
  if(!base){errBox($('#configErr'),'Zadání je prázdné – nejdřív ho načti.');return}
  if(!requireApiKeyForAction(keys.length>1?'vytvoření celé sady':'vytvoření verze')){errBox($('#configErr'),'Bez API klíče se generování nespustí. Vlož klíč nahoře a použij ho pro relaci.');return}
  if(!$('#mSubject').value.trim())$('#mSubject').value=$('#subject').value.trim();
  const buttons=[$('#genBtn'),$('#genAllBtn')].filter(Boolean),labels=buttons.map(b=>b.innerHTML);
  buttons.forEach(b=>b.disabled=true);triggerBtn.innerHTML='<span class="mini"></span> Vytvářím…';
  const results=$('#results'),successful=[],failures=[],previous=new Map(),working=new Map();
  try{
    setProgress(keys.length>1?'Připravuji celou sadu…':'Připravuji verzi…',true);
    show($('#resultsPanel'));
    for(const key of keys){
      const old=[...results.children].find(node=>node._tierKey===key);
      const sheet=makeSheet(key,true);working.set(key,sheet);
      if(old){previous.set(key,old);old.replaceWith(sheet)}else insertSheetInTierOrder(results,sheet);
    }
    $('#resultsPanel').scrollIntoView({behavior:'smooth',block:'start'});
    for(let i=0;i<keys.length;i++){
      const key=keys[i],sheet=working.get(key);
      try{await generateIntoSheet(sheet,key,base,i,keys.length);successful.push(sheet)}
      catch(err){
        failures.push((TIERS[key]&&TIERS[key].name||key)+': '+friendlyApiMessage(err));
        const old=previous.get(key);if(old)sheet.replaceWith(old);else sheet.remove();
      }
    }
    recordDifferentiatorTelemetry(keys.length,successful.length,failures.length);
    if(successful.length){
      setResultSummary(results.children.length);
      setProgress(failures.length?'Hotovo částečně. Neúspěšné stupně zůstaly v původní podobě.':'Hotovo. Zkontroluj vytvořené verze.',false);
      if(failures.length)errBox($('#configErr'),'Část sady se nepodařila vytvořit: '+failures.join(' | '));
    }else{
      setProgress('Generování se nepodařilo. Předchozí výstupy zůstaly zachovány.',false);
      errBox($('#configErr'),failures.join(' | ')||'Generování se nepodařilo.');
      if(!results.children.length)hide($('#resultsPanel'));
    }
  }catch(err){
    working.forEach((sheet,key)=>{if(!sheet||!sheet.isConnected)return;const old=previous.get(key);if(old)sheet.replaceWith(old);else sheet.remove()});
    setProgress('Generování se nepodařilo. Předchozí výstupy zůstaly zachovány.',false);
    errBox($('#configErr'),friendlyApiMessage(err));
    if(!results.children.length)hide($('#resultsPanel'));
  }finally{
    buttons.forEach((b,i)=>{b.disabled=false;b.innerHTML=labels[i]});
  }
}
$('#genBtn').addEventListener('click',()=>{
  const sel=document.querySelector('#tiers input:checked');if(!sel){errBox($('#configErr'),'Vyber úroveň nové verze.');return}
  generateVersions([sel.dataset.tier],$('#genBtn'));
});
$('#genAllBtn').addEventListener('click',()=>generateVersions(['support','core','extend'],$('#genAllBtn')));

function initAccessibleModals(){
  const overlays=[...document.querySelectorAll('.overlay')],openStack=[],focusOrigins=new WeakMap(),openStates=new WeakMap();
  overlays.forEach((ov,i)=>{const modal=ov.querySelector('.modal'),heading=modal&&modal.querySelector('h2'),open=ov.classList.contains('show');openStates.set(ov,open);ov.setAttribute('aria-hidden',open?'false':'true');if(open)openStack.push(ov);if(modal){modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;if(heading){if(!heading.id)heading.id='dialogTitle'+i;modal.setAttribute('aria-labelledby',heading.id)}}});
  const focusTop=ov=>setTimeout(()=>{const focusable=ov&&ov.querySelector('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');(focusable||(ov&&ov.querySelector('.modal')))?.focus()},0);
  const observer=new MutationObserver(records=>records.forEach(r=>{const ov=r.target;if(!ov.classList.contains('overlay'))return;const open=ov.classList.contains('show'),wasOpen=!!openStates.get(ov);ov.setAttribute('aria-hidden',open?'false':'true');if(open===wasOpen)return;openStates.set(ov,open);const idx=openStack.indexOf(ov);if(open){focusOrigins.set(ov,document.activeElement);if(idx>=0)openStack.splice(idx,1);openStack.push(ov);focusTop(ov)}else{if(idx>=0)openStack.splice(idx,1);const origin=focusOrigins.get(ov);focusOrigins.delete(ov);const top=openStack[openStack.length-1];if(top)focusTop(top);else if(origin&&document.contains(origin))origin.focus()}document.body.classList.toggle('modal-open',openStack.length>0)}));
  overlays.forEach(ov=>observer.observe(ov,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',e=>{const ov=openStack[openStack.length-1];if(!ov)return;if(e.key==='Escape'){e.preventDefault();if(ov.id==='pdfCheckOverlay')closePdfCheck();else{const close=ov.querySelector('[id$="Close"],#permanentCancel,#printCancel,#restartCancel');if(close)close.click();else ov.classList.remove('show')}return}if(e.key!=='Tab')return;const nodes=[...ov.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
}
initAccessibleModals();

function doRestart(){
  uploaded=null;fileInput.value='';$('#filechip').classList.remove('show');$('#thumb').classList.remove('show');
  $('#pasteText').value='';$('#baseText').value='';$('#subject').value='';
  $('#mSubject').value='';$('#mTopic').value='';$('#mClass').value='';$('#mDate').value='';
  resetAdvancedSettings();
  if($('#cefr')){$('#cefr').checked=false;saveCefrPreference(false)}setCefrNote('CEFR je vypnutý. U nejazykových předmětů aplikace používá jen úrovně obtížnosti.');
  setUploadInfo('');setStatus('statusFlow','připraveno','ok');if($('#progressStrip'))$('#progressStrip').classList.remove('show');if($('#resultBanner'))$('#resultBanner').classList.remove('show');
  $('#results').innerHTML='';
  document.querySelectorAll('#tiers input').forEach(i=>{i.checked=(i.dataset.tier==='core');i.dispatchEvent(new Event('change'))});
  const lvl=$('#levelDetect'); if(lvl)lvl.classList.remove('show');
  applyCefrLevels(null);
  hide($('#resultsPanel'));hide($('#configPanel'));show($('#inputPanel'));
  window.scrollTo({top:0,behavior:'smooth'});
}
let pendingDestructiveAction='restart';
function closeRestartDialog(){const ov=$('#restartOverlay');if(ov)ov.classList.remove('show')}
function openRestartDialog(mode){
  pendingDestructiveAction=mode==='clearWork'?'clearWork':'restart';
  const isClear=pendingDestructiveAction==='clearWork';
  $('#restartTitle').textContent=isClear?'Opravdu vyčistit rozpracovanou práci?':'Opravdu začít znovu?';
  $('#restartText').textContent=isClear
    ?'Aktuální zadání a hotové verze budou smazány z této stránky. Pokud si je chceš nechat, použij nejdřív Exportovat projekt.'
    :'V seznamu jsou hotové verze, které vznikly voláním API. Nové zadání je smaže. Pokud si je chceš nechat, použij nejdřív Nástroje a nápověda → Exportovat projekt.';
  $('#restartConfirm').textContent=isClear?'Vyčistit pracovní data':'Smazat a začít znovu';
  $('#restartOverlay').classList.add('show');
}
function hasWorkingData(){
  return !!($('#results').children.length||$('#baseText').value.trim()||$('#pasteText').value.trim()||uploaded);
}
$('#restartBtn').addEventListener('click',()=>{
  if(!$('#results').children.length){doRestart();return}
  openRestartDialog('restart');
});
$('#dataClearWork').addEventListener('click',()=>{
  if(!hasWorkingData()){clearWorkingData();return}
  closeDataManagement();openRestartDialog('clearWork');
});
$('#restartCancel').addEventListener('click',closeRestartDialog);
$('#restartExport').addEventListener('click',exportProject);
$('#restartConfirm').addEventListener('click',()=>{
  const action=pendingDestructiveAction;closeRestartDialog();
  if(action==='clearWork')clearWorkingData();else doRestart();
});
$('#restartOverlay').addEventListener('click',e=>{if(e.target.id==='restartOverlay')closeRestartDialog()});
