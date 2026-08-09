/* AI Studio GHRAB — GHRAB Material v1 adapter (Diferenciátor 1.3.12, bridge 2.0) */
(function(){
  'use strict';
  const KEY='ghrab.handoff.v1',EVENTS='ghrab.pilot.events.v2',MAX_SOURCE=180000;
  function get(k){try{return localStorage.getItem(k)}catch(e){console.warn('AI Studio bridge: čtení úložiště selhalo',e);return null}}
  function parse(k,f){try{return JSON.parse(get(k)||JSON.stringify(f))}catch(_){return f}}
  function setLocal(k,v){try{localStorage.setItem(k,v);return true}catch(e){console.warn('AI Studio bridge: zápis do úložiště selhal',e);return false}}
  function remove(k){try{localStorage.removeItem(k)}catch(e){console.warn('AI Studio bridge: odstranění z úložiště selhalo',e)}}
  function onWindowLoaded(fn){if(document.readyState==='complete')fn();else window.addEventListener('load',fn,{once:true})}
  function taskList(m){return Array.isArray(m&&m.content&&m.content.tasks)?m.content.tasks:[]}
  function objectives(m){return Array.isArray(m&&m.objectives)?m.objectives:[]}
  function valid(m){
    if(!(m&&m.schema==='ghrab-material-v1'&&m.id&&m.title&&m.subject&&m.content&&typeof m.content==='object'&&!Array.isArray(m.content)))return false;
    const source=String(m.content.sourceText||'');
    return source.trim().length>0||taskList(m).length>0;
  }
  function studioUrl(p){
    const configured=window.__GHRAB_DEPLOYMENT_CONFIG__?.studioBaseUrl||window.__GHRAB_STUDIO_URL__||'/AI-Studio-GHRAB/';
    try{const u=new URL(p&&p.studioUrl||configured,location.href);if(/^https?:$/.test(u.protocol))return u.href}catch(_){}
    return new URL(configured,location.href).href;
  }
  function take(){
    const v2=window.GHRAB_PLATFORM?.bridge?.take?.({target:'differentiator',maxBytes:500000});if(v2)return v2;
    const p=parse(KEY,null),expires=p&&Date.parse(p.expiresAt||'');
    if(!p||p.schema!=='ghrab-handoff-v1'||p.target!=='differentiator'||!valid(p.material)||!Number.isFinite(expires)||expires<=Date.now()){if(p)remove(KEY);return null}
    remove(KEY);return p;
  }
  function setValue(id,v){const e=document.getElementById(id);if(!e)return;e.value=String(v??'').slice(0,MAX_SOURCE);e.dispatchEvent(new Event('input',{bubbles:true}))}
  function tasks(m){
    return taskList(m).slice(0,200).map((t,i)=>{
      t=(t&&typeof t==='object')?t:{};
      const options=Array.isArray(t.options)?t.options.slice(0,30).map(String):[];
      return `${i+1}. ${String(t.prompt||'')}${options.length?'\n   '+options.join(' | '):''}`;
    }).join('\n\n');
  }
  function record(m){const parsed=parse(EVENTS,[]),a=Array.isArray(parsed)?parsed:[];a.push({at:new Date().toISOString(),type:'handoff-consumed',appId:'differentiator',materialId:String(m.id),estimatedMinutes:5});setLocal(EVENTS,JSON.stringify(a.slice(-500)))}
  function banner(m,p){const b=document.createElement('div');b.className='studio-import-banner';const span=document.createElement('span'),strong=document.createElement('b'),small=document.createElement('small'),link=document.createElement('a'),close=document.createElement('button');strong.textContent='⇄ Materiál převzat z AI Studia';small.textContent=String(m.title||'Bez názvu');span.append(strong,small);link.href=studioUrl(p);link.textContent='Zpět do Studia';close.type='button';close.setAttribute('aria-label','Zavřít');close.textContent='×';close.onclick=()=>b.remove();b.append(span,link,close);(document.querySelector('.wrap')||document.body).prepend(b)}
  function apply(m,p){
    const source=[String(m.content&&m.content.sourceText||'').slice(0,MAX_SOURCE),tasks(m)].filter(Boolean).join('\n\nÚLOHY:\n').slice(0,MAX_SOURCE);
    setValue('pasteText',source);setValue('baseText',source);setValue('subject',m.subject);setValue('mSubject',m.subject);setValue('mTopic',m.title);setValue('mClass',[m.yearGroup,m.level].filter(Boolean).join(' · '));setValue('advTargetGroup',[m.yearGroup,m.level].filter(Boolean).join(' · '));setValue('advLearningGoal',objectives(m).map(String).join('; '));setValue('advTeacherInstruction','Zachovej společný výukový cíl a jasně popiš, jak se jednotlivé varianty liší mírou podpory a kognitivní náročností.');
    try{syncCefrHintFromSubject();hide($('#inputPanel'));show($('#configPanel'));setStatus('statusFlow','materiál převzat z AI Studia','ok')}catch(_){}
    banner(m,p);record(m);
  }
  onWindowLoaded(()=>{if(new URLSearchParams(location.search).get('studioHandoff')!=='1')return;const p=take();if(p)setTimeout(()=>apply(p.material,p),250)});
})();
