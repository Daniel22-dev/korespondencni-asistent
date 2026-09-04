/* GHRAB Platform 1.1.2 — suite-session lifecycle integration (ghrab-suite-session-v1) */
(function(){
  'use strict';
  const platform=window.GHRAB_PLATFORM;
  const privacy=window.GHRABCorrespondencePrivacy;
  const CONTRACT='ghrab-suite-session-v1';
  const RECEIVED_KEY='ghrab.correspondence.suite-session-received.v1';
  const CLEANUP_KEY='ghrab.correspondence.suite-session-cleanup.v1';
  const TAB_SEEN_KEY='ghrab.correspondence.suite-session-tab-seen.v1';
  let scheduledReloadGeneration='';
  let handlingGeneration='';

  function failClosed(reason,error){
    try{document.documentElement.dataset.ghrabSuiteSession='blocked';}catch(_){}
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
  function clearForGeneration(detail){
    const generation=String(detail&&detail.generation||'');
    if(!generation||detail&&detail.schema&&detail.schema!==CONTRACT)return failClosed('invalid-suite-signal');
    if(handlingGeneration===generation)return Object.freeze({ok:true,generation,reentrant:true});
    handlingGeneration=generation;
    try{
      if(!privacy||typeof privacy.endWork!=='function'||typeof privacy.verifyClearOnEndStorage!=='function'||typeof privacy.engageLifecycleLock!=='function')return failClosed('privacy-api-unavailable');
      privacy.engageLifecycleLock();
      const receivedOk=writeMarker(localStorage,RECEIVED_KEY,generation,{phase:'signal-received',reason:String(detail&&detail.reason||'suite-end'),replay:!!(detail&&detail.replay)});
      const tabWasHandled=localTabHandled(generation);
      let cleanupOk=false;
      if(tabWasHandled){
        const prior=privacy.verifyClearOnEndStorage();
        cleanupOk=prior&&prior.ok===true;
      }
      if(!cleanupOk)cleanupOk=privacy.endWork({reload:false,lifecycleLock:true,silent:true})===true;
      const verified=privacy.verifyClearOnEndStorage();
      if(!cleanupOk||!verified||verified.ok!==true)return failClosed('local-cleanup-verification',verified);
      const cleanupMarkerOk=writeMarker(localStorage,CLEANUP_KEY,generation,{phase:'cleanup-completed'});
      const tabMarkerOk=writeMarker(sessionStorage,TAB_SEEN_KEY,generation,{phase:'tab-cleanup-completed'});
      if(!receivedOk||!cleanupMarkerOk||!tabMarkerOk)return failClosed('lifecycle-marker-write');
      // F-02: acknowledgement is deliberately last. No acknowledgement is attempted
      // until owned storage + in-memory state are cleared and both completion markers verify.
      const ackOk=platform.session.acknowledge(generation)===true;
      if(!ackOk)return failClosed('suite-acknowledgement-write');
      try{document.documentElement.dataset.ghrabSuiteSession='clean';}catch(_){}
      try{if(typeof toast==='function')toast('Společná relace ukončena a data této aplikace smazána ✓');}catch(_){}
      scheduleCleanReload(generation);
      return Object.freeze({ok:true,generation,tabWasHandled});
    }catch(error){
      return failClosed('suite-cleanup-exception',error);
    }finally{
      handlingGeneration='';
    }
  }
  function currentGeneration(){try{return String(platform.session.generation()||'');}catch(_){return '';}}
  function guardCurrentTab(reason){
    const generation=currentGeneration();
    if(!generation||localTabHandled(generation))return true;
    const result=clearForGeneration({schema:CONTRACT,generation,reason:String(reason||'tab-guard'),clearApplicationData:true,replay:true});
    return result&&result.ok===true;
  }

  if(!platform||platform.version!=='1.1.2'||platform.session?.contract!==CONTRACT||typeof platform.session.onEnd!=='function'||typeof platform.session.acknowledge!=='function'){
    failClosed('platform-1.1.2-suite-contract-unavailable');
    return;
  }

  function registerSuiteSessionLifecycle(){
    platform.session.onEnd((detail)=>clearForGeneration(detail),{replay:true});

    // Independent per-tab guard. Platform 1.1.2 uses an app-wide acknowledgement key,
    // so one tab can acknowledge before another tab processes its sessionStorage. This
    // child-side guard keys local completion in sessionStorage and does not trust the
    // shared app-wide acknowledgement as proof that this tab has cleaned itself.
    window.addEventListener('storage',(event)=>{
      if(event.key===platform.session.generationKey&&event.newValue&&!localTabHandled(String(event.newValue))){
        clearForGeneration({schema:CONTRACT,generation:String(event.newValue),reason:'child-storage-guard',clearApplicationData:true});
      }
    });
    window.addEventListener('pageshow',()=>{guardCurrentTab('pageshow');});
    window.addEventListener('focus',()=>{guardCurrentTab('focus');});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')guardCurrentTab('visible');});
    // Handles a tab opened after another tab already wrote the app-wide platform acknowledgement.
    setTimeout(()=>{guardCurrentTab('startup');},0);
  }

  /* GHRAB_SUITE_SESSION_REGISTRATION */ registerSuiteSessionLifecycle();
  window.GHRABCorrespondenceSuiteSession=Object.freeze({contract:CONTRACT,guardCurrentTab,status:()=>({generation:currentGeneration(),tabSeen:markerGeneration(sessionStorage,TAB_SEEN_KEY),received:markerGeneration(localStorage,RECEIVED_KEY),cleanup:markerGeneration(localStorage,CLEANUP_KEY),platformSeen:String(platform.session.seen()||'')})});
})();
