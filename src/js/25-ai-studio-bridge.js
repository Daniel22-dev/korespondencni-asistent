/* AI Studio GHRAB — GHRAB Material v1 adapter (Korespondenční asistent 5.7.0, bridge 2.0) */
(function(){
  'use strict';
  const KEY='ghrab.handoff.v1',EVENTS='ghrab.pilot.events.v2',MAX_SOURCE=180000;
  function get(k){try{return localStorage.getItem(k)}catch(e){console.warn('AI Studio bridge: čtení úložiště selhalo',e);return null}}
  function parse(k,f){try{return JSON.parse(get(k)||JSON.stringify(f))}catch(_){return f}}
  function setLocal(k,v){try{localStorage.setItem(k,v);return true}catch(e){console.warn('AI Studio bridge: zápis do úložiště selhal',e);return false}}
  function remove(k){try{localStorage.removeItem(k)}catch(e){console.warn('AI Studio bridge: odstranění z úložiště selhalo',e)}}
  function onWindowLoaded(fn){if(document.readyState==='complete')fn();else window.addEventListener('load',fn,{once:true})}
  function valid(m){return !!(m&&m.schema==='ghrab-material-v1'&&m.id&&m.title&&m.subject&&m.content&&typeof m.content==='object'&&!Array.isArray(m.content))}
  function studioUrl(p){try{const u=new URL(p&&p.studioUrl||'/AI-Studio-GHRAB/',location.origin);if(u.origin===location.origin&&u.pathname.startsWith('/AI-Studio-GHRAB/'))return u.href}catch(_){}return location.origin+'/AI-Studio-GHRAB/'}
  function parseRaw(raw){try{return JSON.parse(String(raw))}catch(_){return null}}
  function handoffTarget(packet,key){if(!packet||typeof packet!=='object')return '';return key==='ghrab.platform.handoff.v2'?String(packet.target&&packet.target.appId||''):String(packet.target||'')}
  function platformTakePreflight(){
    const bridge=window.GHRAB_PLATFORM?.bridge;if(!bridge?.take)return false;
    for(const key of [String(bridge.key||'ghrab.platform.handoff.v2'),String(bridge.legacyKey||KEY)]){
      const raw=get(key);if(raw===null)continue;const packet=parseRaw(raw);
      // Platform 1.1.2 peek/take odstraňuje neplatný nebo target-mismatch shared packet.
      // Child proto volá take pouze tehdy, když všechny přítomné handoff kopie patří jemu.
      if(!packet||handoffTarget(packet,key)!=='correspondence')return false;
    }
    return true;
  }
  function take(){
    const bridge=window.GHRAB_PLATFORM?.bridge;
    if(bridge?.take&&platformTakePreflight()){const v2=bridge.take({target:'correspondence',maxBytes:500000});if(v2)return v2;}
    const raw=get(KEY);if(raw===null)return null;const p=parseRaw(raw);
    if(!p||p.schema!=='ghrab-handoff-v1'||p.target!=='correspondence')return null;
    const expires=Date.parse(p.expiresAt||'');
    if(!valid(p.material)||!Number.isFinite(expires)||expires<=Date.now()){remove(KEY);return null}
    remove(KEY);return p;
  }
  function record(m){const parsed=parse(EVENTS,[]),a=Array.isArray(parsed)?parsed:[];a.push({at:new Date().toISOString(),type:'handoff-consumed',appId:'correspondence',materialId:String(m.id),estimatedMinutes:5});setLocal(EVENTS,JSON.stringify(a.slice(-500)))}
  function banner(m,p){const b=document.createElement('div');b.className='studio-import-banner';const span=document.createElement('span'),strong=document.createElement('b'),small=document.createElement('small'),link=document.createElement('a'),close=document.createElement('button');strong.textContent='⇄ Podklad převzat z AI Studia';small.textContent=String(m.title||'Bez názvu');span.append(strong,small);link.href=studioUrl(p);link.textContent='Zpět do Studia';close.type='button';close.setAttribute('aria-label','Zavřít');close.textContent='×';close.onclick=()=>b.remove();b.append(span,link,close);(document.querySelector('.wrap')||document.body).prepend(b)}
  function apply(m,p){const objectives=Array.isArray(m.objectives)?m.objectives:[];const goals=objectives.slice(0,100).map(x=>'• '+String(x)).join('\n');const source=String(m.content&&m.content.sourceText||'').slice(0,MAX_SOURCE);const text=[`Téma / materiál: ${String(m.title||'')}`,`Předmět: ${String(m.subject||'')}`,[m.yearGroup,m.level].filter(Boolean).length?`Skupina: ${[m.yearGroup,m.level].filter(Boolean).join(' · ')}`:'',goals?`Cíle:\n${goals}`:'',source?`Podklad:\n${source}`:'','Úkol: připrav profesionální školní sdělení vycházející z tohoto podkladu. Před odesláním zkontroluj adresáta, účel, termíny a anonymizaci.'].filter(Boolean).join('\n\n').slice(0,MAX_SOURCE);const el=document.getElementById('my_raw');if(el){el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))}try{switchTab('my')}catch(_){}banner(m,p);record(m)}
  onWindowLoaded(()=>{if(new URLSearchParams(location.search).get('studioHandoff')!=='1')return;const p=take();if(p)setTimeout(()=>apply(p.material,p),250)});
})();
