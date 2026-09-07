/* GHRAB Platform 1.1.2 — suite-session lifecycle integration (ghrab-suite-session-v1) */
(function(){
  'use strict';
  const platform=window.GHRAB_PLATFORM;
  const privacy=window.GHRABCorrespondencePrivacy;
  const CONTRACT='ghrab-suite-session-v1';
  const RECEIVED_KEY='ghrab.correspondence.suite-session-received.v1';
  const CLEANUP_KEY='ghrab.correspondence.suite-session-cleanup.v1';
  const TAB_SEEN_KEY='ghrab.correspondence.suite-session-tab-seen.v1';
  function isHistoryTraversalBoot(){
    try{
      const entries=typeof performance!=='undefined'&&typeof performance.getEntriesByType==='function'?performance.getEntriesByType('navigation'):[];
      if(Array.from(entries||[]).some(entry=>String(entry&&entry.type||'')==='back_forward'))return true;
    }catch(_){}
    try{return typeof performance!=='undefined'&&Number(performance.navigation&&performance.navigation.type)===2;}catch(_){return false;}
  }
  let scheduledReloadGeneration='';
  let handlingGeneration='';
  let historyRestorePending=isHistoryTraversalBoot();
  let historyRestoreSnapshot=null;
  let deferredSuiteDetail=null;
  let historyRestoreTimer=0;

  function setLifecycleState(state){
    try{
      if(state)document.documentElement.dataset.ghrabSuiteSession=String(state);
      else delete document.documentElement.dataset.ghrabSuiteSession;
    }catch(_){}
  }
  function failClosed(reason,error){
    setLifecycleState('blocked');
    try{console.error('GHRAB suite-session cleanup selhal:',reason,error||'');}catch(_){}
    try{if(typeof toast==='function')toast('Společnou relaci se nepodařilo bezpečně ukončit. Zavři tuto kartu a informuj správce.',{persistent:true});}catch(_){}
    return Object.freeze({ok:false,reason:String(reason||'suite-cleanup-failed')});
  }
  function markerGeneration(store,key){
    try{
      const raw=store.getItem(key);if(!raw)return '';
      try{const parsed=JSON.parse(raw);return String(parsed&&parsed.generation||'');}catch(_){return String(raw||'');}
    }catch(_){return '';}
  }
  function writeMarker(store,key,generation,extra){
    try{
      const value=JSON.stringify(Object.assign({schema:'ghrab-suite-session-child-state-v1',appId:'correspondence',generation:String(generation),at:new Date().toISOString()},extra||{}));
      store.setItem(key,value);
      return markerGeneration(store,key)===String(generation);
    }catch(_){return false;}
  }
  function scheduleCleanReload(generation){
    if(scheduledReloadGeneration===generation)return;
    scheduledReloadGeneration=generation;
    setTimeout(()=>{try{location.reload();}catch(_){}},750);
  }
  function localTabHandled(generation){return markerGeneration(sessionStorage,TAB_SEEN_KEY)===String(generation);}
  function clearForGeneration(detail,options){
    const opts=options&&typeof options==='object'?options:{};
    const generation=String(detail&&detail.generation||'');
    if(!generation||detail&&detail.schema&&detail.schema!==CONTRACT)return failClosed('invalid-suite-signal');
    if(handlingGeneration===generation)return Object.freeze({ok:true,generation,reentrant:true});
    handlingGeneration=generation;
    try{
      if(!privacy||typeof privacy.endWork!=='function'||typeof privacy.verifyClearOnEndStorage!=='function'||typeof privacy.engageLifecycleLock!=='function')return failClosed('privacy-api-unavailable');
      privacy.engageLifecycleLock();
      const receivedOk=writeMarker(localStorage,RECEIVED_KEY,generation,{phase:'signal-received',reason:String(detail&&detail.reason||'suite-end'),replay:!!(detail&&detail.replay),historyRestore:opts.forceLocalCleanup===true});
      const tabWasHandled=localTabHandled(generation);
      let cleanupOk=false;
      // A BFCache/history restore can resurrect form/DOM state even after an earlier cleanup
      // attempt in the frozen page. In that case force the full in-memory + storage cleanup
      // again after the page has actually been restored, before acknowledgement is allowed.
      if(tabWasHandled&&opts.forceLocalCleanup!==true){
        const prior=privacy.verifyClearOnEndStorage();
        cleanupOk=prior&&prior.ok===true;
      }
      if(!cleanupOk)cleanupOk=privacy.endWork({reload:false,lifecycleLock:true,silent:true})===true;
      const verified=privacy.verifyClearOnEndStorage();
      if(!cleanupOk||!verified||verified.ok!==true)return failClosed('local-cleanup-verification',verified);
      const cleanupMarkerOk=writeMarker(localStorage,CLEANUP_KEY,generation,{phase:'cleanup-completed',historyRestore:opts.forceLocalCleanup===true});
      const tabMarkerOk=writeMarker(sessionStorage,TAB_SEEN_KEY,generation,{phase:'tab-cleanup-completed',historyRestore:opts.forceLocalCleanup===true});
      if(!receivedOk||!cleanupMarkerOk||!tabMarkerOk)return failClosed('lifecycle-marker-write');
      // F-02: acknowledgement is deliberately last. No acknowledgement is attempted
      // until owned storage + in-memory state are cleared and both completion markers verify.
      const ackOk=platform.session.acknowledge(generation)===true;
      if(!ackOk)return failClosed('suite-acknowledgement-write');
      setLifecycleState('clean');
      try{if(typeof toast==='function')toast('Společná relace ukončena a data této aplikace smazána ✓');}catch(_){}
      scheduleCleanReload(generation);
      return Object.freeze({ok:true,generation,tabWasHandled,forced:opts.forceLocalCleanup===true});
    }catch(error){
      return failClosed('suite-cleanup-exception',error);
    }finally{
      handlingGeneration='';
    }
  }
  function currentGeneration(){try{return String(platform.session.generation()||'');}catch(_){return '';}}
  function guardCurrentTab(reason,options){
    const opts=options&&typeof options==='object'?options:{};
    if(historyRestorePending&&opts.allowHistoryRestore!==true)return false;
    const generation=currentGeneration();
    if(!generation||localTabHandled(generation))return true;
    const result=clearForGeneration({schema:CONTRACT,generation,reason:String(reason||'tab-guard'),clearApplicationData:true,replay:true},opts.forceLocalCleanup===true?{forceLocalCleanup:true}:undefined);
    return result&&result.ok===true;
  }
  function deferSuiteDetail(detail){
    if(!detail||!detail.generation)return false;
    deferredSuiteDetail=Object.freeze({schema:CONTRACT,generation:String(detail.generation),reason:String(detail.reason||'history-deferred-suite-end'),clearApplicationData:detail.clearApplicationData!==false,replay:!!detail.replay});
    return true;
  }
  function beginHistoryFreeze(event){
    if(!event||event.persisted!==true)return;
    historyRestorePending=true;
    const generation=currentGeneration();
    historyRestoreSnapshot=Object.freeze({generation,tabSeen:generation?markerGeneration(sessionStorage,TAB_SEEN_KEY):''});
    setLifecycleState('restoring');
  }
  function finishHistoryRestore(){
    historyRestoreTimer=0;
    const generation=currentGeneration();
    const snap=historyRestoreSnapshot;
    const deferred=deferredSuiteDetail&&String(deferredSuiteDetail.generation||'')===generation?deferredSuiteDetail:null;
    const pendingAtHide=!!(generation&&snap&&snap.generation===generation&&snap.tabSeen!==generation);
    const generationChangedWhileHidden=!!(generation&&(!snap||snap.generation!==generation));
    const mustCleanup=!!(generation&&(deferred||pendingAtHide||generationChangedWhileHidden));
    let ok=true;
    if(mustCleanup){
      const detail=deferred||Object.freeze({schema:CONTRACT,generation,reason:'history-restore-pending-suite-end',clearApplicationData:true,replay:true});
      const result=clearForGeneration(detail,{forceLocalCleanup:true});
      ok=!!(result&&result.ok===true);
    }
    deferredSuiteDetail=null;
    historyRestoreSnapshot=null;
    historyRestorePending=false;
    if(ok){
      if(mustCleanup)setLifecycleState('clean');
      else setLifecycleState('');
    }
  }
  function scheduleHistoryRestoreFinish(){
    historyRestorePending=true;
    setLifecycleState('restoring');
    try{clearTimeout(historyRestoreTimer);}catch(_){}
    const schedule=()=>{historyRestoreTimer=setTimeout(finishHistoryRestore,0);};
    try{requestAnimationFrame(schedule);}catch(_){schedule();}
  }
  function handlePageShow(event){
    // History traversal can be restored either from BFCache (persisted=true) or by a
    // fresh back_forward navigation. In the latter case Platform replay can fire while
    // the new document is still loading, before Chromium restores form-control values.
    // Keep replay deferred until after pageshow in both history paths.
    if(event&&event.persisted===true){scheduleHistoryRestoreFinish();return;}
    if(historyRestorePending){scheduleHistoryRestoreFinish();return;}
    historyRestoreSnapshot=null;
    deferredSuiteDetail=null;
    guardCurrentTab('pageshow');
  }

  if(!platform||platform.version!=='1.1.2'||platform.session?.contract!==CONTRACT||typeof platform.session.onEnd!=='function'||typeof platform.session.acknowledge!=='function'){
    failClosed('platform-1.1.2-suite-contract-unavailable');
    return;
  }

  if(historyRestorePending)setLifecycleState('restoring');

  function registerSuiteSessionLifecycle(){
    platform.session.onEnd((detail)=>{
      // A page parked in BFCache must not acknowledge from its frozen snapshot. Defer
      // the signal and process it only after pageshow has restored the actual DOM/state.
      if(historyRestorePending){deferSuiteDetail(detail);return Object.freeze({ok:false,deferred:true,generation:String(detail&&detail.generation||'')});}
      return clearForGeneration(detail);
    },{replay:true});

    // Independent per-tab guard. Platform 1.1.2 uses an app-wide acknowledgement key,
    // so one tab can acknowledge before another tab processes its sessionStorage. This
    // child-side guard keys local completion in sessionStorage and does not trust the
    // shared app-wide acknowledgement as proof that this tab has cleaned itself.
    window.addEventListener('storage',(event)=>{
      if(event.key!==platform.session.generationKey||!event.newValue||localTabHandled(String(event.newValue)))return;
      if(historyRestorePending){deferSuiteDetail({schema:CONTRACT,generation:String(event.newValue),reason:'child-storage-guard-deferred',clearApplicationData:true});return;}
      clearForGeneration({schema:CONTRACT,generation:String(event.newValue),reason:'child-storage-guard',clearApplicationData:true});
    });
    window.addEventListener('pagehide',beginHistoryFreeze);
    window.addEventListener('pageshow',handlePageShow);
    window.addEventListener('focus',()=>{guardCurrentTab('focus');});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')guardCurrentTab('visible');});
    // Handles a tab opened after another tab already wrote the app-wide platform acknowledgement.
    setTimeout(()=>{guardCurrentTab('startup');},0);
  }

  /* GHRAB_SUITE_SESSION_REGISTRATION */ registerSuiteSessionLifecycle();
  window.GHRABCorrespondenceSuiteSession=Object.freeze({contract:CONTRACT,guardCurrentTab,status:()=>({generation:currentGeneration(),tabSeen:markerGeneration(sessionStorage,TAB_SEEN_KEY),received:markerGeneration(localStorage,RECEIVED_KEY),cleanup:markerGeneration(localStorage,CLEANUP_KEY),platformSeen:String(platform.session.seen()||''),historyRestorePending})});
})();
