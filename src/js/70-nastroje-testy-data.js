/* ===================== NÁSTROJE + CHANGELOG ===================== */
const toolsActions=[];
function footBtn(label, icon, title, fn){ toolsActions.push({label,icon,title,fn}); }
function buildFooterTools(){
  const foot=document.querySelector(".foot"); if(!foot) return;
  foot.innerHTML="";

  const panel=document.createElement("div"); panel.className="footer-tools-panel";
  const meta=document.createElement("span"); meta.className="app-meta";
  meta.textContent='Korespondenční asistent · v'+RELEASE.version;

  const row=document.createElement("div"); row.className="footer-tools-row";
  const title=document.createElement("span"); title.className="footer-tools-title"; title.textContent="Další možnosti";
  const wrap=document.createElement("span"); wrap.className="tools-wrap";
  const btn=document.createElement("button"); btn.id="footerToolsToggle"; btn.className="tools-btn"; btn.type="button"; btn.textContent="Otevřít nabídku ▴"; btn.title="Profil, uložené výstupy, šablony a správa dat"; btn.setAttribute("aria-expanded","false");
  const menu=document.createElement("div"); menu.className="tools-menu"; menu.setAttribute("role","menu");
  toolsActions.forEach(a=>{ const b=document.createElement("button"); b.type="button"; b.dataset.footerTool=a.label; b.title=a.title||a.label; b.innerHTML='<span class="action-icon">'+esc(a.icon||"•")+'</span><span><b>'+esc(a.label)+'</b><small>'+esc(a.title||"")+'</small></span>'; b.onclick=()=>{ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); a.fn&&a.fn(); }; menu.appendChild(b); });
  btn.onclick=(e)=>{ e.stopPropagation(); const open=!menu.classList.contains("open"); menu.classList.toggle("open",open); btn.setAttribute("aria-expanded",open?"true":"false"); };
  document.addEventListener("click",(e)=>{ if(!wrap.contains(e.target)){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  wrap.appendChild(btn); wrap.appendChild(menu);
  row.appendChild(title); row.appendChild(wrap);

  panel.appendChild(meta); panel.appendChild(row);
  foot.appendChild(panel);

  const divider=document.createElement("div"); divider.className="legal-divider"; divider.setAttribute("aria-hidden","true"); foot.appendChild(divider);
  foot.insertAdjacentHTML("beforeend",'<span class="owner-lines"><span class="owner-main"><strong>Vlastník aplikace:</strong> Daniel Baláž · Gymnázium, Ostrava-Hrabůvka</span><br><span class="copyright">© 2026 Daniel Baláž. Všechna práva vyhrazena.</span></span>');
}
function openChangelog(){
  const last10=RELEASE.changes.slice(0,10);
  openModal("Co je nového",
    '<ul style="margin:0;padding-left:18px;color:var(--ink-soft);font-size:13px;line-height:1.55">'+
      last10.map(c=>"<li style='margin:6px 0'>"+esc(c)+"</li>").join("")+
    '</ul>', {label:"Co je nového"});
}

/* ===================== DEBUG PROMPT + AUTOMATICKÉ TESTY ===================== */
function openLastPromptDebug(){
  const rec=loadLastPromptDebug();
  const body=rec?('<p class="hint">Uloženo lokálně: '+esc(new Date(rec.d).toLocaleString("cs-CZ"))+' · model '+esc(rec.model)+' · schéma '+esc(rec.schema)+'</p><textarea class="mono" style="width:100%;min-height:280px" readonly>'+esc("SYSTEM:\n"+rec.system+"\n\nPROMPT:\n"+rec.prompt)+'</textarea>'):'<p class="empty">Zatím není uložený žádný anonymizovaný prompt.</p>';
  const m=openModal("Debug prompt", body+'<div class="row"><button class="btn ghost small" id="dbgClear">Smazat debug prompt</button></div>', {label:"Debug prompt"});
  const clr=m.body.querySelector("#dbgClear"); if(clr) clr.onclick=()=>{ try{sessionStorage.removeItem(LAST_PROMPT_SK);localStorage.removeItem(LAST_PROMPT_SK);}catch(_){} m.close(); toast("Debug prompt smazán"); };
}
function openTestRunner(auto){
  const html='<p class="hint">Testy běží lokálně a používají mock Gemini odpovědí; nic se neposílá do API. Během testu se dočasně mění pracovní vstupy i lokální data aplikace — původní stav se po dokončení obnoví.</p>'+
    '<div class="row"><button class="btn" id="runTestsNow">Spustit testy</button></div>'+
    '<div class="test-progress-panel" id="testProgressPanel" role="status" aria-live="polite" hidden><div class="test-progress-head"><b id="testProgressTitle">Testy běží…</b><span id="testProgressCount">0 dokončeno</span></div><div class="test-progress-track" aria-hidden="true"><span></span></div><small id="testProgressCurrent">Připravuji bezpečnou testovací kopii stavu aplikace…</small></div>'+
    '<div id="testOut" style="margin-top:12px"></div>';
  const m=openModal("Automatické testy", html, {label:"Automatické testy"});
  const run=m.body.querySelector("#runTestsNow"); if(run) run.onclick=()=>runKorespTests();
  if(auto) setTimeout(runKorespTests,80);
  return m;
}
function waitFor(cond, ms=1800){ return new Promise((resolve,reject)=>{ const start=Date.now(); const tick=()=>{ try{ if(cond()) return resolve(true); }catch(_){} if(Date.now()-start>ms) return reject(new Error("timeout")); setTimeout(tick,30); }; tick(); }); }
function assertTest(cond, msg){ if(!cond) throw new Error(msg||"assert failed"); }
function snapshotAppStorage(){
  const snap={local:{},session:{}};
  const grab=(store,bucket)=>{ appStorageKeys(store).forEach(k=>{try{bucket[k]=store.getItem(k);}catch(_){}}); };
  grab(localStorage,snap.local); grab(sessionStorage,snap.session); return snap;
}
function restoreAppStorage(snap){
  const put=(store,bucket)=>{ appStorageKeys(store).forEach(k=>{try{store.removeItem(k);}catch(_){}}); try{Object.keys(bucket||{}).forEach(k=>{try{store.setItem(k,bucket[k]);}catch(_){}});}catch(_){} };
  put(localStorage,snap&&snap.local); put(sessionStorage,snap&&snap.session);
}
function snapshotTestUiState(){
  const fields={},chips={},details={};
  document.querySelectorAll("input[id],textarea[id],select[id]").forEach(el=>{
    if(el.type==="file"||el.closest("#testProgressPanel"))return;
    fields[el.id]={value:el.value,checked:"checked" in el?!!el.checked:undefined};
  });
  document.querySelectorAll(".chips[data-group]").forEach(group=>{
    const selected=group.querySelector(".chip.on[data-v]");
    if(selected)chips[group.dataset.group]=selected.dataset.v;
  });
  document.querySelectorAll("details[id]").forEach(el=>{details[el.id]=!!el.open;});
  return {fields,chips,details,workspaceOpen:document.body.classList.contains("workspace-open"),pane:activePane()};
}
function closeTestSideEffects(){
  const runnerOverlay=$("testOut")?.closest(".modal-overlay")||null;
  [...document.querySelectorAll(".modal-overlay.open")].forEach(overlay=>{
    if(overlay===runnerOverlay)return;
    const close=overlay.querySelector(".modal-close");
    if(close)close.click();else overlay.classList.remove("open");
  });
  [...document.querySelectorAll(".guide-overlay")].forEach(overlay=>{
    const close=overlay.querySelector(".tour-skip,.tour-close,[aria-label='Zavřít']");
    if(close)close.click();else overlay.remove();
  });
}
function snapshotTestState(){ return {storage:snapshotAppStorage(),st:JSON.parse(JSON.stringify(ST)),inRaw:E("in","raw").value,myRaw:E("my","raw").value,key:geminiApiKey,scope:geminiKeyScope,model:geminiModel,mock:window.__TEST_MOCK_GEMINI,gatewayMock:window.__TEST_MOCK_GATEWAY,runtime:GHRABRuntime.getConfig(),ui:snapshotTestUiState()}; }
function restoreTestState(snap){
  restoreAppStorage(snap.storage);
  ST.in=snap.st.in; ST.my=snap.st.my; E("in","raw").value=snap.inRaw; E("my","raw").value=snap.myRaw; geminiApiKey=snap.key; geminiKeyScope=snap.scope; geminiModel=snap.model; window.__TEST_MOCK_GEMINI=snap.mock; window.__TEST_MOCK_GATEWAY=snap.gatewayMock; GHRABRuntime.replaceForTesting(snap.runtime);
  publishActiveKeyReals("in"); publishActiveKeyReals("my");
  closeTestSideEffects();
  try{
    renderView("in");renderView("my");renderKeyTable("in");renderKeyTable("my");renderPreview("in");renderPreview("my");renderTemplates();renderMyProfileContext();renderWritingStyleControls();refreshDeskStatus();applyAiRuntimeUi();updateKeyStatus();updateModelUI();
    Object.entries(snap.ui?.fields||{}).forEach(([id,state])=>{const el=$(id);if(!el||el.type==="file")return;el.value=state.value;if(state.checked!==undefined)el.checked=state.checked;});
    Object.entries(snap.ui?.chips||{}).forEach(([group,value])=>setChip(group,value));
    Object.entries(snap.ui?.details||{}).forEach(([id,open])=>{const el=$(id);if(el)el.open=open;});
    setUiMode(localStorage.getItem(UI_MODE_SK)||"simple");updateCustomSubjectUi();updateMyMode();
    if(snap.ui?.workspaceOpen)switchTab(snap.ui.pane||"in");else showStartScreen();
  }catch(_){}
}
let korespTestsRunning=false;
async function runKorespTests(){
  if(korespTestsRunning)return window.__LAST_KORESP_TEST_RESULTS__||[];
  korespTestsRunning=true;
  const out=$("testOut"); if(out) out.innerHTML='<div class="loading"><span class="spin"></span>Spouštím testy…</div>';
  const runBtn=$("runTestsNow"),progress=$("testProgressPanel"),progressCount=$("testProgressCount"),progressCurrent=$("testProgressCurrent");
  if(runBtn){runBtn.disabled=true;runBtn.setAttribute("aria-busy","true");runBtn.dataset.prevText=runBtn.textContent;runBtn.textContent="Testy běží…";}
  if(progress)progress.hidden=false;
  const markerKey="rozbor_test_marker",markerValue="test-"+Date.now();
  let oldMarker=null; try{oldMarker=localStorage.getItem(markerKey);localStorage.setItem(markerKey,markerValue);}catch(_){}
  const snap=snapshotTestState(); const results=[];
  window.__setTestRunActive(true); document.body.classList.add("ks-tests-running");
  const test=async(name, fn)=>{
    if(progressCurrent)progressCurrent.textContent="Právě probíhá: "+name;
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const t0=performance.now();
    try{ await fn(); results.push({name,ok:true,ms:Math.round(performance.now()-t0)}); }
    catch(e){ results.push({name,ok:false,msg:e.message||String(e),ms:Math.round(performance.now()-t0)}); }
    if(progressCount)progressCount.textContent=results.length+" dokončeno";
  };
  try{
    await test("Server-ready runtime má bezpečný výchozí režim", async()=>{
      const cfg=GHRABRuntime.getConfig();
      assertTest(cfg.schema==="ghrab-runtime-config-v1"&&cfg.ai.mode==="direct-gemini","výchozí runtime není direct-gemini");
      assertTest(cfg.ai.allowDirectFallback===false,"skrytý fallback není zakázaný");
      assertTest(cfg.ai.directGemini.useResponseSchema===false,"serverless režim nemá zachovat kompatibilní Gemini payload");
    });
    await test("Společný AI klient registruje oba transporty", async()=>{
      const modes=GHRAB_AI.getState().transports;
      assertTest(GHRAB_AI.requestSchema==="ghrab-ai-request-v1"&&GHRAB_AI.responseSchema==="ghrab-ai-response-v1","chybí jednotný AI kontrakt");
      assertTest(modes.includes("direct-gemini")&&modes.includes("school-gateway"),"chybí Direct Gemini nebo School Gateway adaptér: "+modes.join(", "));
    });
    await test("Direct Gemini adaptér měří operaci a provider request", async()=>{
      const previous=GHRABRuntime.getConfig(),oldMock=window.__TEST_MOCK_GEMINI;let captured=null;
      try{
        GHRABRuntime.replaceForTesting(Object.assign({},previous,{ai:Object.assign({},previous.ai,{mode:"direct-gemini"})}));
        window.__TEST_MOCK_GEMINI=async input=>{captured=input;return {text:"Hotovo",synonyma:{}};};
        ST.in.km=[];publishActiveKeyReals("in");
        const result=await callGemini("Bezpečný text.","Vrať JSON {\"text\":\"…\"}.","text",{pane:"in",texts:["Bezpečný text."]},{operation:"outgoing-proofread",modelProfile:"balanced"});
        const usage=GHRAB_AI.getLastUsage();
        assertTest(result.text==="Hotovo"&&captured.operation==="outgoing-proofread"&&captured.modelProfile==="balanced","operace nebo profil se nepropsaly do adaptéru");
        assertTest(usage&&usage.providerRequests===1&&usage.operation==="outgoing-proofread","provider request se neměří odděleně");
      }finally{window.__TEST_MOCK_GEMINI=oldMock;GHRABRuntime.replaceForTesting(previous);}
    });
    await test("School Gateway používá neutrální kontrakt bez API klíče", async()=>{
      const previous=GHRABRuntime.getConfig(),oldGateway=window.__TEST_MOCK_GATEWAY;let captured=null;
      try{
        GHRABRuntime.replaceForTesting(Object.assign({},previous,{ai:Object.assign({},previous.ai,{mode:"school-gateway",allowDirectFallback:false})}));
        window.__TEST_MOCK_GATEWAY=async payload=>{captured=payload;return {schema:"ghrab-ai-response-v1",requestId:"srv-1",clientRequestId:payload.clientRequestId,result:{text:"Ze serveru",synonyma:{}},usage:{providerRequests:2,retryRequests:1,inputTokens:25,outputTokens:8,totalTokens:33},meta:{provider:"openai",modelProfile:payload.modelProfile,latencyMs:12,attempts:2}};};
        ST.in.km=[];publishActiveKeyReals("in");
        const result=await callGemini("Bezpečný text.","Vrať JSON {\"text\":\"…\"}.","text",{pane:"in",texts:["Bezpečný text."]},{operation:"outgoing-proofread",modelProfile:"balanced"});
        const serialized=JSON.stringify(captured),usage=GHRAB_AI.getLastUsage();
        assertTest(result.text==="Ze serveru"&&captured.schema==="ghrab-ai-request-v1"&&captured.operation==="outgoing-proofread","gateway nedostal jednotný požadavek");
        assertTest(!serialized.includes("localContext")&&!serialized.includes("requestedGeminiModel")&&!serialized.includes(geminiApiKey||"__never__"),"gateway payload obsahuje lokální kontext nebo API klíč");
        assertTest($("directGeminiSettings").hidden&&!$("schoolGatewayStatus").hidden,"UI se nepřepnulo do školního režimu");
        assertTest(usage.providerRequests===2&&usage.retryRequests===1&&usage.totalTokens===33,"serverová usage metadata se nepropsala");
      }finally{window.__TEST_MOCK_GATEWAY=oldGateway;GHRABRuntime.replaceForTesting(previous);}
    });
    await test("Nedostupný School Gateway se skrytě nepřepne na Gemini", async()=>{
      const previous=GHRABRuntime.getConfig(),oldGateway=window.__TEST_MOCK_GATEWAY,oldGemini=window.__TEST_MOCK_GEMINI;let geminiCalls=0,code="";
      try{
        GHRABRuntime.replaceForTesting(Object.assign({},previous,{ai:Object.assign({},previous.ai,{mode:"school-gateway",allowDirectFallback:false})}));
        window.__TEST_MOCK_GATEWAY=async()=>{throw GHRAB_AI.createError("SERVER_UNAVAILABLE",{providerRequests:0});};
        window.__TEST_MOCK_GEMINI=async()=>{geminiCalls++;return {};};
        ST.in.km=[];publishActiveKeyReals("in");
        try{await callGemini("Bezpečný text.","Vrať JSON {\"text\":\"…\"}.","text",{pane:"in",texts:["Bezpečný text."]},{operation:"outgoing-proofread",modelProfile:"balanced"});}catch(e){code=e.code;}
        assertTest(code==="SERVER_UNAVAILABLE"&&geminiCalls===0,"gateway chyba spustila skrytý Gemini fallback");
      }finally{window.__TEST_MOCK_GATEWAY=oldGateway;window.__TEST_MOCK_GEMINI=oldGemini;GHRABRuntime.replaceForTesting(previous);}
    });
    await test("Úvodní obrazovka nabízí dvě hlavní pracovní cesty", async()=>{
      const choices=[...document.querySelectorAll('#teacherDesk [data-start]')];
      assertTest(choices.length===2,"úvodní obrazovka nemá přesně dvě hlavní volby");
      const labels=choices.map(x=>x.textContent.replace(/\s+/g," ").trim()).join(" | ");
      assertTest(labels.includes("Analýza příchozího e-mailu")&&labels.includes("Sestavení vlastního e-mailu")&&!labels.includes("Rychlá školní situace"),"hlavní cesty nejsou správně: "+labels);
      assertTest($("my_startScenario")&&$("my_startOwn"),"školní situace není vložená uvnitř sestavení vlastního e-mailu");
      assertTest($("workspaceShell").hidden===true,"pracovní plocha má být při startu skrytá");
      assertTest(!document.querySelector('.tabs'),"zůstal duplicitní horní přepínač režimů");
    });
    await test("Profil a nápovědy jsou vidět už u konceptu", async()=>{
      const profile=$("my_profileContext"),step=profile&&profile.closest(".card");
      assertTest(profile&&step&&step.querySelector("#my_raw"),"pracovní profil není v prvním kroku u konceptu");
      assertTest(document.querySelectorAll(".help-tip[data-tip]").length>=7,"chybí kontextové tooltipy u nejasných voleb");
    });
    await test("Pracovní plocha má jeden ukazatel a správnou navigaci", async()=>{
      try{
        switchTab("my");
        assertTest(document.body.classList.contains("workspace-open"),"pracovní plocha neaktivovala vlastní stav stránky");
        assertTest(getComputedStyle($("appProgress")).display==="none","v pracovní ploše zůstalo duplicitní horní číslování");
        const labels=[...document.querySelectorAll("#workspaceNav button")].map(x=>x.textContent.replace(/\s+/g," ").trim()).join(" | ");
        assertTest(labels.includes("Zdroj")&&labels.includes("Anonymizace")&&labels.includes("Text")&&labels.includes("Kontrola")&&!labels.includes("Rozbor"),"navigace Můj e-mail obsahuje nesprávné kroky: "+labels);
      }finally{ showStartScreen(); }
      assertTest(!document.body.classList.contains("workspace-open")&&$("workspaceShell").hidden===true,"návrat na úvod neobnovil stav rozhraní");
    });
    await test("Tooltipy předávají vysvětlení i čtečkám", async()=>{
      initAccessibleTooltips();
      [...document.querySelectorAll(".help-tip[data-tip]")].forEach(btn=>{
        const id=btn.getAttribute("aria-describedby"),node=id&&document.getElementById(id);
        assertTest(node&&node.textContent===btn.dataset.tip,"tooltip nemá dostupný vysvětlující text");
      });
    });
    await test("Unit anonymizace telefonu/e-mailu", async()=>{
      E("in","raw").value="Kontakt: jana@example.cz, tel. +420 777-123-456 a také 777 123 456."; doAnon("in");
      assertTest(ST.in.clean.includes("[e-mail 1]"),"e-mail nebyl nahrazen");
      assertTest(ST.in.clean.includes("[telefon 1]"),"telefon nebyl nahrazen");
      assertTest(!/777[\s.-]*123[\s.-]*456/.test(stripSafeTokens(ST.in.clean)),"v textu zůstal telefon");
      assertTest(!/jana@example\.cz/.test(ST.in.clean),"v textu zůstal e-mail");
    });
    await test("Automatika neschovává jména bez potvrzení", async()=>{
      E("in","raw").value="Daniel Baláž píše Šárce. Kontakt daniel@example.cz, tel. 777 123 456."; doAnon("in");
      assertTest(ST.in.clean.includes("Daniel Baláž")&&ST.in.clean.includes("Šárce"),"jméno bylo automaticky skryto bez potvrzení člověkem");
      assertTest(ST.in.clean.includes("[e-mail 1]")&&ST.in.clean.includes("[telefon 1]"),"jednoznačné kontakty nebyly skryty automaticky");
    });
    await test("Unit rekompozice značek", async()=>{
      ST.in.km=[{real:"Anna Nováková",token:"osoba A"},{real:"jana@example.cz",token:"[e-mail 1]"},{real:"777 123 456",token:"[telefon 1]"}];
      const r=recompose("in","Dobrý den, osoba A, kontakt [e-mail 1], [telefon 1].");
      assertTest(r.includes("Dobrý den, Anno"),"osoba se nevrátila ve správném oslovení");
      assertTest(r.includes("jana@example.cz"),"e-mail se nevrátil");
      assertTest(r.includes("777 123 456"),"telefon se nevrátil");
    });
    await test("České oslovení při vrácení jména", async()=>{
      ST.in.km=[{real:"Dan",token:"osoba A",auto:false},{real:"Šárka",token:"osoba B",auto:false},{real:"Daniel",token:"osoba C",auto:false}];
      const r=recompose("in","Ahoj osoba A,\nMilá osoba B,\nDobrý den, osoba C,\n[podpis]");
      assertTest(r.includes("Ahoj Dane"),"jméno Dan se nevrátilo ve vokativu: "+r);
      assertTest(r.includes("Milá Šárko"),"jméno Šárka se nevrátilo ve vokativu: "+r);
      assertTest(r.includes("Dobrý den, Danieli"),"jméno Daniel se nevrátilo ve vokativu: "+r);
      assertTest(!r.includes("(učitel)"),"zůstal nevyplněný zástupný podpis");
    });
    await test("Kolega se osloví pouze křestním jménem", async()=>{
      ST.in.km=[{real:"Pavla Tlolková",token:"osoba A",auto:false}];ST.in.replyAddressingMode="tykani";
      const r=recompose("in","Ahoj osoba A,\n\nkdybych se nemohl zúčastnit, dám osobě A včas vědět.\n\n[podpis]");
      assertTest(r.includes("Ahoj Pavlo,")&&!r.includes("Ahoj Pavlo Tlolková"),"neformální oslovení stále obsahuje příjmení: "+r);
      assertTest(r.includes("dám ti včas vědět")&&!r.includes("dám Pavle Tlolkové"),"adresát zůstal v těle třetí osobou: "+r);
    });
    await test("Formální oslovení používá pane nebo paní a příjmení", async()=>{
      ST.in.km=[{real:"Pavla Tlolková",token:"osoba A",auto:false},{real:"Daniel Baláž",token:"osoba B",auto:false}];
      const r=recompose("in","Vážená paní osoba A,\nVážený pane osoba B,\n[podpis]");
      assertTest(r.includes("Vážená paní Tlolková,")&&!r.includes("paní Pavlo Tlolková"),"ženské formální oslovení je chybné: "+r);
      assertTest(r.includes("Vážený pane Baláži,")&&!r.includes("pane Danieli Baláži"),"mužské formální oslovení je chybné: "+r);
    });
    await test("Prompt chápe adresáta jako druhou osobu", async()=>{
      const informal=recipientAddressingPrompt("kolega","tykani"),formal=recipientAddressingPrompt("jiny","vykani");
      assertTest(informal.includes("2. osobě")&&informal.includes("pouze křestní jméno")&&informal.includes("dám ti vědět"),"pravidlo pro kolegu není úplné: "+informal);
      assertTest(formal.includes("Vážený pane + příjmení")&&formal.includes("Vážený pane Danieli Baláži"),"formální pravidlo není úplné: "+formal);
    });
    await test("Hlášení chyby nepoužívá paralelní KS enhancer", async()=>{
      assertTest(typeof globalThis.enhanceGhrabErrorReporter==="undefined","stará kompatibilitní funkce je stále globálně dostupná");
      assertTest(!document.querySelector(".ghrab-ks-capture-bar")&&!document.querySelector("[data-ks-capture-snap]"),"v aplikaci zůstal starý paralelní panel snímání");
    });
    await test("Systémová matice českého 5. pádu", async()=>{
      const rows=[["Daniel","Danieli"],["Viktor","Viktore"],["Igor","Igore"],["Alois","Aloisi"],["Klaus","Klausi"],["Asterix","Asterixi"],["Petr","Petře"],["Marek","Marku"]];
      rows.forEach(([name,expected])=>{const forms=generatedPersonForms(name);assertTest(forms[5]===expected&&!forms.requiresReview,name+" má chybný nebo nejistý vokativ: "+JSON.stringify(forms));});
    });
    await test("Vokativ používá jediný gramatický engine", async()=>{
      ["Daniel","Viktor","Igor","Alois","Klaus","Asterix","Petr","Marek"].forEach(name=>{
        const context={gender:"male",role:"given"},word=declineNameWord(name,context),person=generatedPersonForms(name);
        assertTest(czechVocativeWord(name,context)===word[5]&&word[5]===person[5],name+" se rozchází mezi cestami skloňování");
      });
    });
    await test("Ženská jména na souhlásku zůstávají nesklonná", async()=>{
      ["Karin","Ingrid","Dagmar"].forEach(name=>{const forms=generatedPersonForms(name);for(let c=1;c<=7;c++)assertTest(forms[c]===name,name+" se chybně skloňuje v "+c+". pádě: "+JSON.stringify(forms));assertTest(!forms.requiresReview,name+" se zbytečně blokuje");});
    });
    await test("Rod celého jména řídí paradigma a konflikt se zastaví", async()=>{
      const rows=[
        ["Andrea Nováková","female",{3:"Andree Novákové",5:"Andreo Nováková"}],
        ["Nikola Novotný","male",{3:"Nikolovi Novotnému",5:"Nikolo Novotný"}],
        ["Lucie Krejčí","female",{3:"Lucii Krejčí",5:"Lucie Krejčí"}],
        ["Marek Krejčí","male",{3:"Markovi Krejčímu",5:"Marku Krejčí"}]
      ];
      rows.forEach(([name,gender,expected])=>{const forms=generatedPersonForms(name);assertTest(forms.gender===gender&&!forms.requiresReview,name+" má chybný rod nebo zbytečnou blokaci: "+JSON.stringify(forms));Object.entries(expected).forEach(([c,value])=>assertTest(forms[c]===value,name+" má chybný "+c+". pád: "+JSON.stringify(forms)));});
      const conflict=generatedPersonForms("Petr Nováková");
      assertTest(conflict.requiresReview&&conflict.reviewReasons.some(x=>/odporuje/.test(x)),"konfliktní rod prošel bez kontroly: "+JSON.stringify(conflict));
    });
    await test("Mužská jména na -a a -o mají vlastní paradigma", async()=>{
      const rows=[
        ["Honza",{2:"Honzy",3:"Honzovi",5:"Honzo",7:"Honzou"}],
        ["Ondra",{2:"Ondry",3:"Ondrovi",5:"Ondro",7:"Ondrou"}],
        ["Ivo",{2:"Iva",3:"Ivovi",5:"Ivo",7:"Ivem"}],
        ["Oto",{2:"Ota",3:"Otovi",5:"Oto",7:"Otem"}],
        ["Mario",{2:"Maria",3:"Mariovi",5:"Mario",7:"Mariem"}]
      ];
      rows.forEach(([name,expected])=>{const forms=generatedPersonForms(name);assertTest(!forms.requiresReview,name+" se zbytečně blokuje");Object.entries(expected).forEach(([c,value])=>assertTest(forms[c]===value,name+" má chybný "+c+". pád: "+JSON.stringify(forms)));});
    });
    await test("Složený, apostrofovaný a vnitřně verzálkový zápis se nehádané", async()=>{
      ["Jean-Paul","O'Connor","O’Connor"].forEach(name=>{const forms=generatedPersonForms(name);assertTest(forms.requiresReview&&forms.reviewReasons.length,name+" prošlo bez kontroly");for(let c=1;c<=7;c++)assertTest(forms[c]===name,name+" se před potvrzením změnilo v "+c+". pádě: "+JSON.stringify(forms));});
      const mixed=generatedPersonForms("Petr McDonald");
      assertTest(mixed.requiresReview&&mixed[1]==="Petr McDonald"&&mixed[5]==="Petře McDonald"&&mixed[5].includes("McDonald"),"vnitřní verzála se ztratila nebo jméno prošlo bez kontroly: "+JSON.stringify(mixed));
    });
    await test("Výslovnostně citlivá ženská jména vyžadují potvrzení", async()=>{
      ["Mia","Maya","Mia Nováková","Maya Nováková"].forEach(name=>{const forms=generatedPersonForms(name);assertTest(forms.requiresReview&&forms.reviewReasons.some(x=>/výslovnosti|úzu/.test(x)),name+" prošlo bez kontroly: "+JSON.stringify(forms));const first=name.split(/\s+/)[0];for(let c=1;c<=7;c++)assertTest(forms[c].split(/\s+/)[0]===first,name+" dostalo před potvrzením domnělý tvar: "+JSON.stringify(forms));});
    });
    await test("Kanonizace využívá rod a paradigma celého jména", async()=>{
      const rows=[
        ["Napsal jsem Andree Novákové.","Andree Novákové","Andrea Nováková",3],
        ["Mluvil jsem s Andreou Novákovou.","Andreou Novákovou","Andrea Nováková",7],
        ["Napsal jsem Nikolovi Novotnému.","Nikolovi Novotnému","Nikola Novotný",3],
        ["Mluvil jsem s Nikolou Novotným.","Nikolou Novotným","Nikola Novotný",7],
        ["Mluvil jsem s Ivem Novákem.","Ivem Novákem","Ivo Novák",7],
        ["Píšu Ivovi Novákovi.","Ivovi Novákovi","Ivo Novák",3]
      ];
      rows.forEach(([raw,phrase,base,caseNo])=>{const result=canonicalizePersonPhrase(raw,phrase);assertTest(result.real===base&&result.caseNo===caseNo&&result.confidence!=="unresolved",phrase+" → "+JSON.stringify(result));});
      const ambiguous=canonicalizePersonPhrase("Mluvil jsem s Markem Krejčím.","Markem Krejčím");
      assertTest(ambiguous.real==="Marek Krejčí"&&ambiguous.confidence==="unresolved"&&ambiguous.alternatives&&ambiguous.alternatives.includes("Marko Krejčí"),"nejednoznačný základ byl přijat potichu: "+JSON.stringify(ambiguous));
    });
    await test("Plná jména se skloňují po částech v jednom kontextu", async()=>{
      const rows=[
        ["Daniel Baláž",{3:"Danielovi Balážovi",5:"Danieli Baláži",7:"Danielem Balážem"}],
        ["Viktor Novák",{3:"Viktorovi Novákovi",5:"Viktore Nováku",7:"Viktorem Novákem"}],
        ["Petr Svoboda",{3:"Petrovi Svobodovi",5:"Petře Svobodo",7:"Petrem Svobodou"}]
      ];
      rows.forEach(([name,expected])=>{const forms=generatedPersonForms(name);Object.entries(expected).forEach(([c,value])=>assertTest(forms[c]===value,name+" má chybný "+c+". pád: "+JSON.stringify(forms)));assertTest(!forms.requiresReview,name+" se zbytečně blokuje");});
    });
    await test("Daniel má správné úplné paradigma", async()=>{
      const forms=generatedPersonForms("Daniel"),expected={1:"Daniel",2:"Daniela",3:"Danielovi",4:"Daniela",5:"Danieli",6:"Danielovi",7:"Danielem"};
      for(let c=1;c<=7;c++)assertTest(forms[c]===expected[c],"Daniel má chybný "+c+". pád: "+JSON.stringify(forms));
    });
    await test("Mužské příjmení na -a se vrací ze skloňovaného tvaru", async()=>{
      const forms=generatedPersonForms("Petr Svoboda"),expected={1:"Petr Svoboda",2:"Petra Svobody",3:"Petrovi Svobodovi",4:"Petra Svobodu",5:"Petře Svobodo",6:"Petrovi Svobodovi",7:"Petrem Svobodou"};
      for(let c=1;c<=7;c++)assertTest(forms[c]===expected[c],"Petr Svoboda má chybný "+c+". pád: "+JSON.stringify(forms));
      const normalized=canonicalizePersonPhrase("Píšu Petrovi Svobodovi.","Petrovi Svobodovi");
      assertTest(normalized.real==="Petr Svoboda"&&normalized.caseNo===3&&normalized.confidence!=="unresolved","dativ se nevrátil do základního tvaru: "+JSON.stringify(normalized));
    });
    await test("Výslovnostní a rodinné varianty vyžadují kontrolu", async()=>{
      ["Michael","Julius","Petr Švec","Petr Němec","Derek Smith"].forEach(name=>{const forms=generatedPersonForms(name);assertTest(forms.requiresReview&&forms.reviewReasons.length,name+" prošel bez lidské kontroly: "+JSON.stringify(forms));});
    });
    await test("Cizí jméno se nepřepisuje domnělým nominativem", async()=>{
      const foreign=normalizePersonSelection("Prosím vyřiďte to Xiu.","Xiu");
      assertTest(foreign.real==="Xiu"&&foreign.confidence==="unresolved"&&foreign.reviewReasons.length,"cizí jméno bylo potichu změněno nebo přijato: "+JSON.stringify(foreign));
    });
    await test("Nové položky klíče vždy převezmou stav kontroly pádů", async()=>{
      let old=null;try{old=localStorage.getItem("rozbor_dict");localStorage.setItem("rozbor_dict","[]");}catch(_){}
      try{
        const uncertain={km:[],raw:"Michael Smith píše.",emailN:0,phoneN:0};buildKey(uncertain,["Michael Smith"]);
        assertTest(uncertain.km.length===1&&uncertain.km[0].caseUnresolved&&uncertain.km[0].reviewReasons.length,"nejisté jméno v klíči nemá stopku: "+JSON.stringify(uncertain.km));
        const common={km:[],raw:"Daniel píše.",emailN:0,phoneN:0};buildKey(common,["Daniel"]);
        assertTest(common.km.length===1&&!common.km[0].caseUnresolved,"běžné jméno se zbytečně blokuje: "+JSON.stringify(common.km));
      }finally{try{if(old===null)localStorage.removeItem("rozbor_dict");else localStorage.setItem("rozbor_dict",old);}catch(_){}}
    });
    await test("Nejisté pády blokují preflight, potvrzené jej odblokují", async()=>{
      const entry={real:"Michael",token:"osoba A",auto:false};applyGeneratedCaseReview(entry);ST.in.raw="Michael píše.";ST.in.clean="osoba A píše.";ST.in.km=[entry];publishActiveKeyReals("in");clearAnalysisCache();
      assertTest(preflightIssues(ST.in.clean,"in").danger.some(x=>/nezkontrolované skloňování/.test(x)),"nejisté skloňování nevyvolalo stopku");
      entry.forms={1:"Michael",2:"Michaela",3:"Michaelovi",4:"Michaela",5:"Michaele",6:"Michaelovi",7:"Michaelem"};applyGeneratedCaseReview(entry);clearAnalysisCache();
      assertTest(!entry.caseUnresolved&&!preflightIssues(ST.in.clean,"in").danger.some(x=>/nezkontrolované skloňování/.test(x)),"ručně potvrzené tvary zůstaly blokované");
    });
    await test("Ručně potvrzený vokativ má přednost při lokálním vrácení", async()=>{
      const entry={real:"Michael",token:"osoba A",auto:false,forms:{1:"Michael",2:"Michaela",3:"Michaelovi",4:"Michaela",5:"Michaele",6:"Michaelovi",7:"Michaelem"}};applyGeneratedCaseReview(entry);ST.in.km=[entry];
      const result=recompose("in","Dobrý den, osoba A,");
      assertTest(result.includes("Dobrý den, Michaele")&&!result.includes("osoba A"),"potvrzený vokativ se nepoužil: "+result);
    });
    await test("Slovník ukládá sedm potvrzených tvarů, nikoli značku", async()=>{
      let old=null;try{old=localStorage.getItem("rozbor_dict");localStorage.setItem("rozbor_dict","[]");}catch(_){}
      try{
        const forms={1:"Michael",2:"Michaela",3:"Michaelovi",4:"Michaela",5:"Michaele",6:"Michaelovi",7:"Michaelem"};saveDict([{real:"Michael",token:"osoba Z",forms,caseUnresolved:false,reviewReasons:["test"]}]);
        const loaded=loadDict();assertTest(loaded.length===1&&loaded[0].forms&&loaded[0].forms[5]==="Michaele"&&!loaded[0].token&&!loaded[0].caseUnresolved,"slovník neuchoval čisté potvrzené tvary: "+JSON.stringify(loaded));
      }finally{try{if(old===null)localStorage.removeItem("rozbor_dict");else localStorage.setItem("rozbor_dict",old);}catch(_){}}
    });
    await test("Kontrola konceptu posuzuje finální text, ne bezpečné značky", async()=>{
      ST.in.km=[{real:"Jan Novák",token:"osoba A",auto:false}];
      const good=evaluateDraftReadiness("in","Dobrý den, osoba A,\n\nděkuji za zprávu a potvrzuji další postup.\n\nS pozdravem\nDaniel","",{});
      const goodToken=good.items.find(x=>x.label==="Nezůstala nevyplněná anonymizační značka");
      assertTest(goodToken&&goodToken.ok,"známá značka byla chybně vyhodnocena jako nevyplněná");
      const bad=evaluateDraftReadiness("in","Dobrý den, osoba B,\n\nděkuji za zprávu a potvrzuji další postup.\n\nS pozdravem\nDaniel","",{});
      const badToken=bad.items.find(x=>x.label==="Nezůstala nevyplněná anonymizační značka");
      assertTest(badToken&&!badToken.ok&&badToken.level==="danger","neznámá značka se neměla považovat za vyplněnou");
    });
    await test("Varovné položky kontroly nemají kolizi se stylem upozornění", async()=>{
      const card=draftCard("in",{text:"Dobrý den,\n\nděkuji za zprávu.\n\n[podpis]",cover:{pokryva:[],vynechava:["Doplnit termín"]},sourceText:"Prosím doplňte termín.",deferActive:true});
      document.body.appendChild(card);
      const item=card.querySelector(".check-item.check-warn");
      assertTest(!!item,"varovná položka nemá oddělenou třídu check-warn");
      assertTest(!item.classList.contains("warn"),"varovná položka znovu používá obecnou třídu warn");
      assertTest(item.children.length===2,"varovná položka má neočekávanou strukturu");
      card.remove();
    });
    await test("Emoji se do odpovědi nepřenášejí bez výslovného požadavku", async()=>{
      const cleaned=stripReplyEmoji("Děkuji 😊👍.\nHezký den 🙂");
      assertTest(cleaned==="Děkuji.\nHezký den","emoji nebyla bezpečně odstraněna: "+cleaned);
      assertTest(!replyAllowsEmoji("Napiš běžnou odpověď"),"emoji se povolila bez požadavku");
      assertTest(replyAllowsEmoji("Použij jeden decentní smajlík"),"výslovný požadavek na emoji nebyl rozpoznán");
      assertTest(!replyAllowsEmoji("Prosím bez smajlíků"),"zákaz smajlíků byl chybně vyhodnocen jako povolení");
      assertTest(SYS_REPLY.includes("Emoji, emotikony"),"systémový prompt neobsahuje zákaz automatického přebírání emoji");
    });
    await test("Přirozený styl je součástí generování, ne prosté korektury", async()=>{
      assertTest(NATURAL_STYLE_RULE.includes("univerzální šablona")&&NATURAL_STYLE_RULE.includes("nic si nevymýšlej"),"pravidlo přirozeného stylu není dostatečně konkrétní");
      assertTest([SYS_REPLY,SYS_PREPIS,SYS_REFINE,SYS_COMPOSE].every(x=>x.includes(NATURAL_STYLE_RULE)),"pravidlo přirozeného stylu chybí v některém generativním promptu");
      assertTest(!SYS_KOREKTURA.includes(NATURAL_STYLE_RULE),"prostá korektura nesmí automaticky přepisovat osobní styl");
    });
    await test("Kontrola zachytí šablonovitý obrat, ale ne běžné poděkování", async()=>{
      const generic=evaluateDraftReadiness("in","Dobrý den,\n\nrád bych Vás touto cestou informoval, že termín platí.\n\n[podpis]","",{});
      const genericItem=generic.items.find(x=>x.label==="Text nepůsobí zbytečně šablonovitě");
      assertTest(genericItem&&!genericItem.ok&&genericItem.level==="warn"&&genericItem.detail.includes("touto cestou"),"šablonovitý obrat nebyl označen jako neblokující varování");
      const natural=evaluateDraftReadiness("in","Dobrý den,\n\nDěkuji za zprávu. Termín ve čtvrtek platí.\n\n[podpis]","",{});
      const naturalItem=natural.items.find(x=>x.label==="Text nepůsobí zbytečně šablonovitě");
      assertTest(naturalItem&&naturalItem.ok,"běžné funkční poděkování bylo chybně označeno jako šablonovité");
    });
    await test("Editor nabízí cílenou úpravu Přirozeněji", async()=>{
      const card=draftCard("in",{text:"Dobrý den,\n\nDěkuji za zprávu.\n\n[podpis]",deferActive:true});
      document.body.appendChild(card);
      const btn=[...card.querySelectorAll(".act-quick")].find(x=>x.textContent.trim()==="Přirozeněji");
      assertTest(btn&&btn.dataset.ins.includes("univerzální šablona")&&btn.dataset.ins.includes("Nic nového si nevymýšlej"),"tlačítko Přirozeněji nebo jeho bezpečný pokyn chybí");
      card.remove();
    });
    await test("Podpis se nedubluje", async()=>{
      const a=ensureSignaturePlaceholder("Přeji hezký den.\n\nS pozdravem\n\n[podpis]");
      assertTest((a.match(/s pozdravem/gi)||[]).length===0,"rozloučení zůstalo před lokálním podpisem: "+a);
      assertTest((a.match(/\[podpis\]/gi)||[]).length===1,"značka podpisu není právě jednou: "+a);
      const b=ensureSignaturePlaceholder("Přeji hezký den.\n\nS pozdravem\nS pozdravem");
      assertTest((b.match(/\[podpis\]/gi)||[]).length===1 && !(b.match(/s pozdravem/gi)||[]).length,"opakované rozloučení se nevyčistilo: "+b);
    });
    await test("Perspektiva jednotlivce je v promptu i kontrole", async()=>{
      assertTest(senderPerspectivePrompt("jednotlivec").includes("1. osobu jednotného čísla")&&senderPerspectivePrompt("jednotlivec").includes("projednám s kolegy"),"prompt jednotlivce není dostatečně jednoznačný");
      ST.in.replySenderMode="jednotlivec";
      const bad=evaluateDraftReadiness("in","Dobrý den,\n\nděkujeme a budeme Vás kontaktovat.\n\n[podpis]","",{});
      const item=bad.items.find(x=>x.label.includes("1. osobě jednotného čísla"));
      assertTest(item&&!item.ok&&item.level==="warn","množné číslo u jednotlivce nemá být tvrdá stopka");
      const good=evaluateDraftReadiness("in","Dobrý den,\n\nděkuji a budu Vás kontaktovat.\n\n[podpis]","",{});
      const okItem=good.items.find(x=>x.label.includes("1. osobě jednotného čísla"));
      assertTest(okItem&&okItem.ok,"jednotné číslo nebylo přijato");
    });
    await test("České pády krátkých jmen", async()=>{
      const cases=[
        ["Petr","Petrovi zavolám. Petra jsem viděl. S Petrem mluvím.",["Petrovi","Petra","Petrem"]],
        ["Eva","Evě jsem psal. Evu jsem viděl. S Evou mluvím.",["Evě","Evu","Evou"]],
        ["Hana","Haně jsem psal. Hanu jsem viděl.",["Haně","Hanu"]],
        ["Adam","Adamovi jsem psal. Adama jsem viděl.",["Adamovi","Adama"]],
        ["Olga","Olze jsem psal. Olgu jsem viděl.",["Olze","Olgu"]],
        ["Tomáš","Tomášovi jsem psal. Tomáše jsem viděl.",["Tomášovi","Tomáše"]],
        ["Novák","Novákovi jsem psal. Nováka jsem viděl.",["Novákovi","Nováka"]],
        ["Anna","Anně jsem psal. Annu jsem viděl.",["Anně","Annu"]]
      ];
      cases.forEach(([name,text,forms])=>{
        ST.in.raw=text; ST.in.km=[{real:name,token:"osoba A",auto:false}]; publishActiveKeyReals("in");
        const c=cleanFromKey("in");
        const left=forms.filter(f=>new RegExp("(^|[^\\p{L}])"+escRe(f)+"(?=$|[^\\p{L}])","u").test(c));
        assertTest(!left.length,name+" — zůstaly tvary: "+left.join(", ")+" | "+c);
      });
    });
    await test("Ženský 3. a 6. pád používá existující české tvary", async()=>{
      const rows=[["Tereza","Tereze"],["Petra","Petře"],["Pavla","Pavle"],["Barbora","Barboře"],["Jana","Janě"],["Eva","Evě"],["Šárka","Šárce"],["Olga","Olze"],["Alena","Aleně"],["Denisa","Denise"]];
      rows.forEach(([name,expected])=>{const forms=generatedPersonForms(name);assertTest(forms[3]===expected&&forms[6]===expected,name+" má chybný dativ/lokál: "+JSON.stringify(forms));});
    });
    await test("České pády celého jména", async()=>{
      ST.in.raw="Anna Nováková psala. Anně Novákové odpovím. Annu Novákovou pozvu."; ST.in.km=[{real:"Anna Nováková",token:"osoba A",auto:false}]; publishActiveKeyReals("in");
      const c=cleanFromKey("in");
      assertTest((c.match(/osoba A/g)||[]).length===3,"nebyly skryty všechny tvary: "+c);
      assertTest(!/Novákov/.test(c),"zůstal tvar příjmení: "+c);
    });
    await test("Jedna osoba = jedna značka", async()=>{
      ST.in.raw="Petr Malý chybí. Petrovi jsem psal. S Petrem mluvím."; ST.in.km=[];
      addWord("in","Petr"); addWord("in","Petrovi"); addWord("in","Petrem");
      assertTest(ST.in.km.length===1&&ST.in.km[0].real==="Petr","skloňované tvary se nesloučily do základního tvaru: "+JSON.stringify(ST.in.km));
      assertTest(ST.in.km[0].token==="osoba A","tvary jedné osoby dostaly různé značky");
      assertTest(!/Petr(?:ovi|em)?/.test(ST.in.clean),"v anonymizovaném textu zůstal tvar Petra: "+ST.in.clean);
    });
    await test("Spojovací slova se nepřipojí ke jménu", async()=>{
      ST.in.raw="Mimochodem Kamča odpověděla. Podle Adély je vše hotové."; ST.in.km=[]; ST.in.reviewedSuggestions={}; clearAnalysisCache();
      const phrases=suggestionData("in").suggestions.map(x=>x.phrase);
      assertTest(!phrases.includes("Mimochodem Kamča")&&!phrases.includes("Podle Adély"),"spojovací slovo bylo připojeno ke jménu: "+phrases.join(" | "));
      assertTest(phrases.includes("Kamča")&&phrases.includes("Adély"),"samotné jméno se přestalo nabízet: "+phrases.join(" | "));
    });
    await test("Skloňovaný výběr se uloží v základním tvaru", async()=>{
      const a=canonicalizePersonPhrase("Mluvil jsem s Adélou Kulovou.","Adélou Kulovou");
      const b=canonicalizePersonPhrase("Podle Adély je vše hotové.","Adély");
      assertTest(a.real==="Adéla Kulová"&&a.caseNo===7,"instrumentál celého jména nebyl převeden: "+JSON.stringify(a));
      assertTest(b.real==="Adéla"&&b.caseNo===2,"genitiv jména nebyl převeden: "+JSON.stringify(b));
    });
    await test("Tabulka kanonizace českých pádů jmen", async()=>{
      const rows=[
        ["Petr Novák dnes chyběl.","Petr Novák","Petr Novák","Petr Novák","Petře Nováku"],
        ["Mluvil jsem s Petrem Novákem.","Petrem Novákem","Petr Novák","Petr Novák","Petře Nováku"],
        ["Napsal jsem Petrovi.","Petrovi","Petr","Petr","Petře"],
        ["Mluvil jsem s Adélou Kulovou.","Adélou Kulovou","Adéla Kulová","Adéla Kulová","Adélo Kulová"],
        ["Odpověděl jsem Evě Svobodové.","Evě Svobodové","Eva Svobodová","Eva Svobodová","Evo Svobodová"],
        ["Psal jsem Tomášovi Dvořákovi.","Tomášovi Dvořákovi","Tomáš Dvořák","Tomáš Dvořák","Tomáši Dvořáku"],
        ["Ptal jsem se Petra Nováka.","Petra Nováka","Petr Novák","Petr Novák","Petře Nováku"],
        ["Omlouvám se za Petra Nováka.","Petra Nováka","Petr Novák","Petr Novák","Petře Nováku"],
        ["Napsal jsem Petru Novákovi.","Petru Novákovi","Petr Novák","Petr Novák","Petře Nováku"],
        ["Pozval jsem Janu Novákovou.","Janu Novákovou","Jana Nováková","Jana Nováková","Jano Nováková"],
        ["Týká se to Jany Novákové.","Jany Novákové","Jana Nováková","Jana Nováková","Jano Nováková"],
        ["Viděl jsem Tomáše Dvořáka.","Tomáše Dvořáka","Tomáš Dvořák","Tomáš Dvořák","Tomáši Dvořáku"],
        ["Ptal jsem se Marka Krejčího.","Marka Krejčího","Marek Krejčí","Marek Krejčí","Marku Krejčí"],
        ["Napsal jsem Lucii Malé.","Lucii Malé","Lucie Malá","Lucie Malá","Lucie Malá"],
        ["Kvůli Ondřeji Vaňkovi.","Ondřeji Vaňkovi","Ondřej Vaněk","Ondřej Vaněk","Ondřeji Vaňku"],
        ["Podle Adély je vše hotové.","Adély","Adéla","Adéla","Adélo"]
      ];
      rows.forEach(([raw,phrase,base,nominative,vocative])=>{
        const r=canonicalizePersonPhrase(raw,phrase),forms=generatedPersonForms(r.real);
        assertTest(r.real===base&&r.confidence!=="unresolved",phrase+" → "+JSON.stringify(r));
        assertTest(forms[1]===nominative&&forms[5]===vocative,base+" má chybné pády: "+JSON.stringify(forms));
      });
    });
    await test("Zpětná palatalizace vrací skutečný základ jména", async()=>{
      const rows=[["Děkuji Šárce.","Šárce","Šárka",3],["Píšu Monice.","Monice","Monika",3],["Píšu Lence.","Lence","Lenka",3],["Píšu Radce.","Radce","Radka",3],["Píšu Olze.","Olze","Olga",3],["Píšu Jitce.","Jitce","Jitka",3]];
      rows.forEach(([raw,phrase,base,caseNo])=>{const r=canonicalizePersonPhrase(raw,phrase);assertTest(r.real===base&&r.caseNo===caseNo,phrase+" → "+JSON.stringify(r));});
    });
    await test("Pohyblivé e u jmen na -el se vrací jen tam, kam patří", async()=>{
      const rows=[["Píšu Pavlu.","Pavlu","Pavel",3],["Píšu Pavlovi.","Pavlovi","Pavel",3],["Píšu Karlu.","Karlu","Karel",3],["Mluvil jsem s Karlem.","Karlem","Karel",7],["Mluvil jsem s Havlem.","Havlem","Havel",7],["Píšu Danielovi.","Danielovi","Daniel",3]];
      rows.forEach(([raw,phrase,base,caseNo])=>{const r=canonicalizePersonPhrase(raw,phrase);assertTest(r.real===base&&r.caseNo===caseNo,phrase+" → "+JSON.stringify(r));});
    });
    await test("Neznámý cizí tvar vyžádá kontrolu skloňování", async()=>{
      const foreign=normalizePersonSelection("Prosím vyřiďte to Xiu.","Xiu");
      assertTest(foreign.real==="Xiu"&&foreign.confidence==="unresolved","Cizí jméno se nemá potichu přepisovat ani přijmout bez kontroly: "+JSON.stringify(foreign));
      const known=normalizePersonSelection("Bez Marka to nezvládneme.","Marka");
      assertTest(known.real==="Marek"&&known.confidence!=="unresolved","známý tvar s předložkou se zbytečně zablokoval: "+JSON.stringify(known));
      const czech=normalizePersonSelection("Děkuji Šárce.","Šárce");
      assertTest(czech.real==="Šárka"&&czech.confidence!=="unresolved","známé české jméno se zbytečně zablokovalo: "+JSON.stringify(czech));
    });
    await test("Mužský a ženský nominativ nejsou jedna osoba", async()=>{
      ST.in.raw="Petra Nováková je matka žáka. Petr je její syn.";ST.in.km=[];ST.in.reviewedSuggestions={};
      addPhraseAs("in","Petra Nováková","person");addPhraseAs("in","Petr","person");
      assertTest(ST.in.km.length===2&&ST.in.km[0].token!==ST.in.km[1].token,"Petra a Petr se sloučili: "+JSON.stringify(ST.in.km));
      ST.in.raw="Petr nepřijde. Petrovi to předejte.";ST.in.km=[];ST.in.reviewedSuggestions={};
      addPhraseAs("in","Petr","person");addPhraseAs("in","Petrovi","person");
      assertTest(ST.in.km.length===1&&ST.in.km[0].real==="Petr","Petr a Petrovi se rozdělili: "+JSON.stringify(ST.in.km));
      ST.in.raw="Petra nepřijde. Petrovi to předejte.";ST.in.km=[];ST.in.reviewedSuggestions={};
      addPhraseAs("in","Petra","person");
      assertTest(/Petrovi/.test(cleanFromKey("in")),"ženská Petra automaticky skryla mužský tvar Petrovi");
      addPhraseAs("in","Petrovi","person");
      assertTest(ST.in.km.length===2&&ST.in.km[0].token!==ST.in.km[1].token,"Petra a mužský tvar Petrovi se sloučily: "+JSON.stringify(ST.in.km));
      ST.in.raw="Vidím Petra. Petrovi odpovím.";ST.in.km=[{real:"Petr",token:"osoba A",auto:false,aliases:["Petra"]}];ST.in.reviewedSuggestions={};
      assertTest((cleanFromKey("in").match(/osoba A/g)||[]).length===2,"mužský Petr přestal skrývat vlastní pádové tvary a přesný alias");
      ST.in.raw="Jana Malá přišla. Jan přišel také.";ST.in.km=[];ST.in.reviewedSuggestions={};
      addPhraseAs("in","Jana Malá","person");addPhraseAs("in","Jan","person");
      assertTest(ST.in.km.length===2&&ST.in.km[0].token!==ST.in.km[1].token,"Jana a Jan se sloučili: "+JSON.stringify(ST.in.km));
    });
    await test("Část víceslovného jména se skryje stejnou značkou", async()=>{
      ST.in.raw="Petr Novák nepřijde. Pane Nováku, děkujeme.";ST.in.km=[{real:"Petr Novák",token:"osoba A",auto:false}];publishActiveKeyReals("in");clearAnalysisCache();
      ST.in.clean=cleanFromKey("in");
      assertTest(!/Novák/u.test(ST.in.clean)&&(ST.in.clean.match(/osoba A/g)||[]).length===2,"samostatné příjmení zůstalo odkryté: "+ST.in.clean);
      assertTest(!preflightIssues(ST.in.clean,"in").danger.some(x=>/nezakrytý tvar/.test(x)),"samostatný vokativ vyvolal stopku");
    });
    await test("Různé pády téže osoby vytvoří jednu značku", async()=>{
      ST.in.raw="Týká se to Jany Novákové. Mluvil jsem s Janou Novákovou. Janě Novákové jsem psal.";ST.in.km=[];ST.in.reviewedSuggestions={};
      addPhraseAs("in","Jany Novákové","person");addPhraseAs("in","Janou Novákovou","person");addPhraseAs("in","Janě Novákové","person");
      assertTest(ST.in.km.length===1&&ST.in.km[0].real==="Jana Nováková","jedna osoba se rozpadla: "+JSON.stringify(ST.in.km));
      assertTest((ST.in.clean.match(/osoba A/g)||[]).length===3&&!/Jan(?:y|ou|ě)|Novákov/.test(ST.in.clean),"nezakryly se všechny pády: "+ST.in.clean);
    });
    await test("Poznámka skryje skloňované celé jméno", async()=>{
      ST.in.km=[{real:"Adéla Kulová",token:"osoba A",auto:false}]; publishActiveKeyReals("in");
      const safe=safeAuxiliaryText("in","Mluvil jsem s Adélou Kulovou.",null,"Poznámka");
      assertTest(safe&&safe.includes("osoba A")&&!safe.includes("Adél")&&!safe.includes("Kulov"),"poznámka nebyla bezpečně anonymizována: "+safe);
    });
    await test("Prázdný profil není anonymizační chyba", async()=>{
      const keys=["rozbor_profile","ks5_signatures","ks5_selected_signature"],old={};
      try{keys.forEach(k=>{old[k]=localStorage.getItem(k);localStorage.removeItem(k);});}catch(_){}
      try{
        ST.in.km=[{real:"Jan Novák",token:"osoba A",auto:false}]; publishActiveKeyReals("in");
        const r=evaluateDraftReadiness("in","Dobrý den, osoba A,\n\npotvrzuji termín ve čtvrtek.\n\n[podpis]","",{});
        const token=r.items.find(x=>x.label==="Nezůstala nevyplněná anonymizační značka");
        const sign=r.items.find(x=>x.label==="Podpis je vyplněný v profilu odesílatele");
        assertTest(token&&token.ok,"prázdný profil byl zaměněn za anonymizační chybu");
        assertTest(sign&&!sign.ok&&sign.level==="warn"&&r.level!=="danger","prázdný podpis nemá být červená stopka");
      }finally{try{keys.forEach(k=>{if(old[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,old[k]);});}catch(_){}}
    });
    await test("Krátké jméno nespolkne cizí jména", async()=>{
      ST.in.raw="Jan Novák psal. Jana Nováková také. Janák přišel. Janoušek odešel.";
      ST.in.km=[{real:"Jan",token:"osoba A",auto:false}]; publishActiveKeyReals("in");
      const c=cleanFromKey("in");
      assertTest(c.includes("Jana Nováková")&&c.includes("Janák")&&c.includes("Janoušek"),"shoda skryla cizí jméno: "+c);
      assertTest(c.startsWith("osoba A Novák"),"přesný tvar Jan se neskryl: "+c);
    });
    await test("Rychlé rozpoznání odliší hromadný e-mail kolegům", async()=>{
      const r=inferQuickComposeSettings("Rád bych všechny kolegy pozval na školení k AI.",false);
      assertTest(r.adresat==="kolega"&&r.scope==="group"&&r.ucel==="pozvanka","rychlý režim nerozpoznal kolegy jako skupinu: "+JSON.stringify(r));
    });
    await test("Profil posílá pracovní kontext bez jména", async()=>{
      const old=localStorage.getItem("rozbor_profile");
      try{
        localStorage.setItem("rozbor_profile",JSON.stringify({name:"Daniel Baláž",role:"středoškolský učitel",subjects:"angličtina a španělština",school:"Gymnázium Test"}));
        const line=profileLine();
        assertTest(line.includes("středoškolský učitel")&&line.includes("angličtina a španělština")&&line.includes("Gymnázium Test"),"pracovní kontext není úplný: "+line);
        assertTest(!line.includes("Daniel Baláž"),"jméno se propsalo do promptu: "+line);
      }finally{if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);}
    });
    await test("Osobní způsob psaní je oddělený od tónu zprávy", async()=>{
      const old=localStorage.getItem("rozbor_profile"),oldMode=readChip("my_mode"),oldFix=readChip("my_fix");
      try{
        localStorage.setItem("rozbor_profile",JSON.stringify({writingStyle:"usporny",styleAvoid:"touto cestou; věřím, že společně",styleCustom:"začni rovnou věcí a používej kratší odstavce"}));
        renderWritingStyleControls();
        const cb=$("my_useWritingStyle"),ctx=buildPersonalWritingStyleContext("my",null,true);
        assertTest(cb&&!cb.disabled&&cb.checked,"nastavený osobní styl není v konkrétní zprávě aktivní");
        assertTest($("my_writingStyleLabel").textContent.includes("Úsporný a přímý"),"rozhraní neukazuje zvolený osobní styl");
        assertTest(ctx&&ctx.line.includes("Piš úsporně a přímo")&&ctx.line.includes("touto cestou")&&ctx.line.includes("kratší odstavce"),"osobní styl se nepropsal do kontextu: "+JSON.stringify(ctx));
        assertTest(ctx.line.includes("tón, délka")&&ctx.line.includes("mají vždy přednost"),"prompt nevymezuje přednost nastavení konkrétní zprávy");
        cb.checked=false;
        assertTest(!isPersonalWritingStyleEnabled("my"),"vypnutí osobního stylu pro jednu zprávu se nerespektuje");
        assertTest(buildPersonalWritingStyleContext("my",null,false).line==="","vypnutý styl se stále přidává do promptu");
        setChip("my_mode","opravit");setChip("my_fix","chyby");cb.checked=true;
        assertTest(!isPersonalWritingStyleEnabled("my"),"prostá pravopisná oprava nesmí měnit text podle osobního stylu");
        setChip("my_fix","sloh");
        assertTest(isPersonalWritingStyleEnabled("my"),"stylistická oprava má osobní styl povolit");
      }finally{
        if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);
        setChip("my_mode",oldMode||"opravit");setChip("my_fix",oldFix||"chyby");renderWritingStyleControls();updateMyMode();
      }
    });
    await test("Profil ukládá volbu a vlastní preference způsobu psaní", async()=>{
      const old=localStorage.getItem("rozbor_profile");
      try{
        localStorage.setItem("rozbor_profile",JSON.stringify({name:"Test",gender:"neutral",sign:"jmeno"}));
        window.__openProfile();
        document.querySelector('.chips[data-group="pf_wstyle"] .chip[data-v="vysvetlujici"]').click();
        document.querySelector("#pf_styleAvoid").value="dovolte mi, abych";
        document.querySelector("#pf_styleCustom").value="uveď nezbytný kontext a jasný další krok";
        document.querySelector("#pf_save").click();
        const p=loadProfile();
        assertTest(p.writingStyle==="vysvetlujici","profil neuložil zvolený způsob psaní");
        assertTest(p.styleAvoid.includes("dovolte mi")&&p.styleCustom.includes("jasný další krok"),"profil neuložil vlastní stylistické preference");
        assertTest($("my_profileContextText").textContent.includes("Vysvětlující a přehledný"),"souhrn profilu neukazuje uložený způsob psaní");
      }finally{
        if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);
        renderMyProfileContext();
      }
    });
    await test("Profil řídí gramatický rod pisatele", async()=>{
      const old=localStorage.getItem("rozbor_profile"),oldMode=ST.in.replySenderMode;
      try{
        ST.in.replySenderMode="jednotlivec";
        localStorage.setItem("rozbor_profile",JSON.stringify({gender:"female"}));
        window.__openProfile();
        const femaleChip=document.querySelector('.chips[data-group="pf_gender"] .chip[data-v="female"]');
        assertTest(femaleChip&&femaleChip.classList.contains("on"),"uložený ženský rod se neoznačil v profilu");
        document.querySelector('.chips[data-group="pf_gender"] .chip[data-v="male"]').click();
        document.querySelector("#pf_save").click();
        assertTest(loadProfile().gender==="male","volba gramatického rodu se neuložila z profilu");
        localStorage.setItem("rozbor_profile",JSON.stringify({gender:"female"}));
        const fp=senderPerspectivePrompt("jednotlivec");
        assertTest(fp.includes("ŽENSKÝ")&&fp.includes("předala jsem"),"ženský rod se nepropsal do promptu: "+fp);
        const bad=evaluateDraftReadiness("in","Dobrý den,\n\nmusel jsem návrh upravit.\n\n[podpis]","",{});
        const badItem=bad.items.find(x=>x.label==="Gramatický rod pisatele odpovídá profilu");
        assertTest(badItem&&!badItem.ok&&badItem.level==="warn","nesoulad rodu má být neblokující varování: "+JSON.stringify(badItem));
        const good=evaluateDraftReadiness("in","Dobrý den,\n\nmusela jsem návrh upravit.\n\n[podpis]","",{});
        const goodItem=good.items.find(x=>x.label==="Gramatický rod pisatele odpovídá profilu");
        assertTest(goodItem&&goodItem.ok,"správný ženský tvar nebyl přijat: "+JSON.stringify(goodItem));
        localStorage.setItem("rozbor_profile",JSON.stringify({gender:"male"}));
        const mp=senderPerspectivePrompt("jednotlivec");
        assertTest(mp.includes("MUŽSKÝ")&&mp.includes("předal jsem"),"mužský rod se nepropsal do promptu: "+mp);
        localStorage.setItem("rozbor_profile",JSON.stringify({gender:"neutral"}));
        const np=senderPerspectivePrompt("jednotlivec");
        assertTest(np.includes("rodově neutrální"),"bezrodová varianta se nepropsala do promptu: "+np);
        const neutralBad=evaluateDraftReadiness("in","Dobrý den,\n\nmusela jsem návrh upravit.\n\n[podpis]","",{});
        const neutralItem=neutralBad.items.find(x=>x.label==="Gramatický rod pisatele odpovídá profilu");
        assertTest(neutralItem&&!neutralItem.ok&&neutralItem.level==="warn","rodový tvar u neutrálního profilu má být neblokující varování: "+JSON.stringify(neutralItem));
      }finally{
        ST.in.replySenderMode=oldMode;
        if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);
      }
    });
    await test("Školní scénáře používají existující hodnoty", async()=>{
      Object.entries(SCHOOL_SCENARIOS).forEach(([key,sc])=>{
        if(!sc.vals)return;
        Object.entries(sc.vals).forEach(([g,v])=>{
          const grp=document.querySelector('.chips[data-group="'+g+'"]');
          assertTest(grp&&grp.querySelector('.chip[data-v="'+v+'"]'),"scénář "+key+" → "+g+" nezná "+v);
        });
      });
    });
    await test("Telefonní čísla a čísla dokladů se nerozcházejí", async()=>{
      const rows=[
        ["Kontakt +420 777 123 456.",true],["Kontakt 00420 777/123/456.",true],["Kontakt 777123456.",true],
        ["Kontakt 602.123.456.",true],["Pevná linka 234 567 890.",true],
        ["VS 202600123456.",false],["Variabilní symbol platby je 202600123456.",false],
        ["Číslo objednávky 987654321.",false],["Číslo faktury 123456789.",false],["ISBN 9788024635279.",false],
        ["IČO 00842745, DIČ CZ00842745.",false],["Účet 123456789/0800.",false]
      ];
      rows.forEach(([text,isPhone])=>{
        const issue=preflightIssues(text).danger.some(x=>/telefon/.test(x)),detected=autoDetect(text).some(x=>rePhone("u").test(x));
        assertTest(issue===isPhone,text+" preflight telefon="+issue);
        assertTest(detected===isPhone,text+" autodetekce telefon="+detected+" / "+JSON.stringify(autoDetect(text)));
      });
    });
    await test("Telefon se nehlásí zároveň jako rodné číslo a doklad má ústupovou akci", async()=>{
      const phone=preflightIssues("Kontakt 775123456.").danger;
      assertTest(phone.includes("telefon")&&!phone.some(x=>/rodné číslo/.test(x)),"mobil má dvojí hlášku: "+phone.join(" | "));
      const rc=preflightIssues("Rodné číslo žáka je 105512/1234.").danger;
      assertTest(rc.some(x=>/rodné číslo/.test(x)),"rodné číslo s lomítkem přestalo blokovat: "+rc.join(" | "));
      ST.in.raw="Rodné číslo žáka je 105512/1234.";ST.in.clean=ST.in.raw;ST.in.km=[];clearAnalysisCache();
      renderSafeFallback("in",safetyAudit(ST.in.clean,"in"));
      assertTest(!E("in","safeFallback").querySelector("[data-docnum]"),"výslovné rodné číslo nabízí nebezpečné překlasifikování na doklad");
      ST.in.raw="Do systému zadejte kód 2151234567.";ST.in.clean=ST.in.raw;ST.in.km=[];clearAnalysisCache();
      renderSafeFallback("in",safetyAudit(ST.in.clean,"in"));
      const btn=E("in","safeFallback").querySelector("[data-docnum]");
      assertTest(!!btn,"u neoznačeného desetimístného čísla chybí akce číslo dokladu");
      btn.click();
      assertTest(ST.in.km.some(x=>/^\[číslo dokladu /.test(x.token||"")),"číslo se nepřevedlo na bezpečnou značku dokladu");
    });
    await test("Citlivé termíny jsou kalibrované kontextem", async()=>{
      const safe=[
        "V učebně chemie je porouchaný rozvod vody.","Odjezd bude v závislosti na počasí posunut.","Prosím o zprávu z poradny ohledně objednávky učebnic.",
        "Soutěž pořádá poradna pro volbu povolání.","Prosím o organizační opatření k výletu.","Žák byl omluven z důvodu nemoci.",
        "Chemický pokus s alkoholem v laboratoři.","Rozvod elektřiny bude odstaven.","Rozvod plynu je po kontrole v pořádku.",
        "V závislosti na dopravě dorazíme později.","Téma hodiny je illness and health.","Ve španělštině probíráme terapii jako slovní zásobu.",
        "Poradna zaslala ceník učebnic.","Sociální pracovník vystoupí na kariérním dni.","Rozvodovka vody je opravená.",
        "Zpráva z poradny se týká objednávky.","Internetový rozvod ve škole nefunguje.","Závislost výsledku na počasí je vysoká.",
        "Incident s tiskárnou byl vyřešen.","Soudní síň je tématem exkurze."
      ];
      const sensitive=[
        "Ve třídě došlo k šikaně.","Žák má podpůrné opatření.","Lékařská zpráva potvrzuje omezení.","Zdravotní stav žáka se zhoršil.",
        "Rodinné poměry dítěte jsou složité.","Rodiče jsou po rozvodu.","Žák má závislost na alkoholu.","OSPOD požádal školu o součinnost.",
        "Zpráva z poradny doporučuje podpůrná opatření pro žáka.","Došlo k sebepoškozování."
      ];
      const falsePos=safe.filter(hasSensitiveSchoolTerms),falseNeg=sensitive.filter(x=>!hasSensitiveSchoolTerms(x));
      assertTest(!falsePos.length,"falešně citlivé: "+falsePos.join(" | "));
      assertTest(!falseNeg.length,"neodhalené citlivé: "+falseNeg.join(" | "));
    });
    await test("Přísný režim nebere provozní slova za citlivé údaje", async()=>{
      const safe=["Zítra spustíme přihlašování na kroužky.","Spuštění nového rozvrhu proběhne v pondělí.","Prosím spusťte prezentaci.","Barvy koupíme v drogerii u školy.","Objednávka pro drogerii Teta je připravena.","Seminář z psychologie se příští týden ruší.","Maturitní otázky z psychologie pošlu zítra.","Po rozvodu vody v suterénu bude učebna přístupná.","V závislosti na počasí pojedeme ven."];
      const sensitive=["Žák má SPU a IVP.","Psycholožka doporučila podpůrná opatření.","Vyšetření u psychologa proběhne v PPP.","Rodiče jsou po rozvodu.","Řešíme závislost na hazardu u syna.","V závislosti na počasí pojedeme ven. Řešíme také závislost na hazardu u našeho syna.","Ve třídě se objevily drogy."];
      const falsePos=safe.filter(hasSensitiveSchoolTerms),falseNeg=sensitive.filter(x=>!hasSensitiveSchoolTerms(x));
      assertTest(!falsePos.length,"provozní věty spustily přísný režim: "+falsePos.join(" | "));
      assertTest(!falseNeg.length,"citlivé věty přestaly blokovat: "+falseNeg.join(" | "));
    });
    await test("Běžné školní věty neaktivují stopku", async()=>{
      const safe=["Prosím o zaslání organizačního opatření k výletu.","Žák byl omluven z důvodu nemoci.","Soutěž pořádá poradna pro volbu povolání.","Prosím o vyjádření k incidentu na chodbě.","Chemický pokus s alkoholem v laboratoři."];
      const blocked=safe.filter(x=>safetyAudit(x).level==="nosend");
      assertTest(!blocked.length,"falešná stopka: "+blocked.join(" | "));
      assertTest(safetyAudit("Ve třídě došlo k šikaně.").level==="nosend","skutečně citlivé téma přestalo být blokované");
      assertTest(safetyAudit("Žák má podpůrné opatření.").level==="nosend","podpůrné opatření přestalo být blokované");
    });
    await test("Tři varianty odpovědi se neopakují", async()=>{
      const navrhy=[{typ:"standardni",text:"A"},{typ:"standardni",text:"B"},{typ:"standardni",text:"C"}];
      const types=["strucna","standardni","diplomaticka"],pouzite=new Set();
      const vybrane=types.map(type=>{let i=navrhy.findIndex((n,j)=>n&&n.typ===type&&!pouzite.has(j));if(i<0)i=navrhy.findIndex((n,j)=>n&&!pouzite.has(j));if(i<0)return null;pouzite.add(i);return navrhy[i];}).filter(Boolean);
      assertTest(new Set(vybrane.map(n=>n.text)).size===3,"varianty se opakují: "+vybrane.map(n=>n.text).join(","));
    });
    await test("Preflight citlivých údajů", async()=>{
      const iss=preflightIssues("Pište na x@y.cz, 777 123 456, 1.A, diagnóza PPP, nar. 1. 2. 2010, adresa ul. Testovací 1.");
      assertTest(iss.danger.length>=4,"preflight nenašel dost rizik: "+iss.danger.join(","));
      assertTest(iss.warn.some(x=>/třída/.test(x)) && iss.warn.some(x=>/adres/.test(x)),"běžná třída nebo adresní výraz nemají být kontrolní upozornění");
      assertTest(safetyAudit("Jan Novák, diagnóza PPP").action.includes("Neodesílat"),"semafor nevrací akční pokyn");
      ST.in.clean="Jan Novák, diagnóza PPP"; renderSafety("in");
      assertTest($("in_safeFallback").textContent.includes("Vytvořit bezpečnou obecnou verzi"),"chybí lokální bezpečná obecná verze při Raději neposílat");
      showSafeFallback("in");
      assertTest($("in_safeFallback").textContent.includes("Lokální šablona") && $("in_safeFallback").textContent.includes("osobní setkání"),"bezpečná šablona se nevygenerovala lokálně");
    });
    await test("Regrese citlivých českých tvarů", async()=>{
      const forms=["šikana","šikaně","agresivní chování","sebepoškozování","lékařská zpráva","zdravotní stav","sociální situace","napomenutí","podpůrné opatření","alkohol požitý žákem","drogami"];
      const missed=forms.filter(x=>!hasSensitiveSchoolTerms(x));
      assertTest(!missed.length,"neodhalené citlivé tvary: "+missed.join(", "));
      assertTest(preflightIssues("Ve třídě došlo k šikaně.").danger.some(x=>/citlivé/.test(x)),"šikana neaktivovala stopku preflightu");
      assertTest(preflightIssues("Žák 2.Č odevzdal práci.").warn.some(x=>/třída/.test(x)),"třída s českým písmenem nebyla rozpoznána");
    });
    await test("E-mail v lomených závorkách", async()=>{
      ST.in.raw="Od: Jan Novák <jan.novak@skola.cz>"; ST.in.km=[]; ST.in.emailN=0; ST.in.phoneN=0;
      buildKey(ST.in,autoDetect(ST.in.raw));
      const c=cleanFromKey("in");
      assertTest(c.includes("<[e-mail 1]>") && !c.includes("jan.novak@skola.cz"),"e-mail v <…> nebyl nahrazen: "+c);
    });
    await test("Kliknutí na část jména spojí celé jméno", async()=>{
      const parsed=wordObjs("Jan Novák napsal zprávu.");
      assertTest(clickedNamePhrase(parsed.words,0)==="Jan Novák","kliknutí na křestní jméno nespojilo celé jméno");
      assertTest(clickedNamePhrase(parsed.words,1)==="Jan Novák","kliknutí na příjmení nespojilo celé jméno");
    });
    await test("Jméno se nespojí s nadpisem na dalším řádku", async()=>{
      ST.in.raw="Pavla Tlolková\nDůležité informace:"; ST.in.km=[]; ST.in.reviewedSuggestions={}; clearAnalysisCache();
      const phrases=suggestionData("in").suggestions.map(x=>x.phrase);
      assertTest(phrases.includes("Pavla Tlolková"),"celé jméno se přestalo nabízet: "+phrases.join(" | "));
      assertTest(!phrases.some(x=>/Tlolková Důležité/.test(x)),"návrh překročil konec řádku: "+phrases.join(" | "));
    });
    await test("Název školy za štítkem se vybírá celý", async()=>{
      ST.in.raw="School ID: 6H1M5HU4\nSchool name: Gymnázium, Ostrava-Hrabůvka, p.o."; ST.in.km=[]; ST.in.reviewedSuggestions={}; clearAnalysisCache();
      const item=suggestionData("in").suggestions.find(x=>x.phrase==="Gymnázium, Ostrava-Hrabůvka, p.o.");
      assertTest(item&&item.kind==="institution","celý název školy není jeden návrh: "+suggestionData("in").suggestions.map(x=>x.phrase).join(" | "));
      addPhraseAs("in",item.phrase,"institution");
      assertTest(ST.in.clean.includes("School name: [instituce 1]")&&!ST.in.clean.includes("Ostrava-Hrabůvka"),"celý název školy nebyl skryt: "+ST.in.clean);
    });
    await test("Podpis Petr H. se skryje jako jedna osoba bez slova Mává", async()=>{
      const parsed=wordObjs("Mává Petr H.");
      assertTest(clickedNamePhrase(parsed.words,1)==="Petr H","kliknutí na Petr nespojilo iniciálu: "+clickedNamePhrase(parsed.words,1));
      assertTest(clickedNamePhrase(parsed.words,2)==="Petr H","kliknutí na iniciálu nespojilo celé jméno");
      const parsedNoDot=wordObjs("Mává Petr H");
      assertTest(clickedNamePhrase(parsedNoDot.words,1)==="Petr H","iniciála bez tečky se nepřipojila ke jménu");
      assertTest(clickedNamePhrase(parsedNoDot.words,2)==="Petr H","kliknutí na iniciálu bez tečky nespojilo celé jméno");
      ST.in.raw="Mává Petr H."; ST.in.km=[]; ST.in.reviewedSuggestions={}; addPhraseAs("in","Petr H","person");
      assertTest(ST.in.clean==="Mává osoba A.","podpis se anonymizoval chybně: "+ST.in.clean);
    });
    await test("Postupné označení Petr a H. se sloučí do stejné osoby", async()=>{
      ST.in.raw="Mává Petr H."; ST.in.km=[]; ST.in.reviewedSuggestions={};
      addWord("in","Petr");
      assertTest(ST.in.km.length===1&&ST.in.km[0].token==="osoba A","první část jména nedostala osobu A");
      addWord("in","H");
      assertTest(ST.in.km.length===1,"sousední iniciála vytvořila další osobu");
      assertTest(ST.in.km[0].real==="Petr H"&&ST.in.km[0].token==="osoba A","části jména se nesloučily: "+JSON.stringify(ST.in.km));
      assertTest(ST.in.clean==="Mává osoba A.","po postupném označení zůstal rozbitý výsledek: "+ST.in.clean);
    });
    await test("Našeptávač musí být vyřešen před potvrzením", async()=>{
      E("in","raw").value="Petr píše zprávu."; doAnon("in");
      const items=suggestionData("in").suggestions;
      assertTest(items.some(x=>x.phrase==="Petr"),"našeptávač neoznačil jméno Petr");
      assertTest(E("in","reviewOk").disabled,"potvrzení je dostupné i s nevyřešeným návrhem");
      keepSuggestion("in","Petr");
      assertTest(!E("in","reviewOk").disabled,"po vědomém ponechání se potvrzení neodemklo");
    });
    await test("Zbývající návrhy lze po přečtení ponechat hromadně", async()=>{
      E("in","raw").value="Petr poslal zprávu. Ostrava je uvedena v záhlaví."; doAnon("in");
      const items=suggestionData("in").suggestions;
      assertTest(items.length>=2,"testovací text nevytvořil více návrhů");
      assertTest(!!E("in","suggestionPanel").querySelector("[data-keep-all-suggestions]"),"v panelu chybí hromadná volba");
      const kept=keepSuggestionRows("in",items);
      assertTest(kept===items.length,"hromadná volba nevyřešila všechny návrhy");
      assertTest(suggestionData("in").suggestions.length===0,"po hromadném ponechání zůstaly nevyřešené návrhy");
      assertTest(!E("in","reviewOk").disabled,"hromadné ponechání neodemklo závěrečnou kontrolu");
    });
    await test("Kliknutí v textu otevře kategorie v pravém panelu", async()=>{
      E("in","raw").value="Petr doporučil knihu Saturnin."; doAnon("in");
      const word=[...E("in","view").querySelectorAll(".w")].find(x=>x.textContent==="Saturnin");
      assertTest(!!word,"slovo Saturnin se v hlavním textu nezobrazilo");
      word.click();
      const panel=E("in","suggestionPanel");
      assertTest(ST.in.selectedPhrase==="Saturnin","kliknutí v textu nevybralo výraz");
      assertTest(!ST.in.km.some(x=>x.real==="Saturnin"),"kliknutí slovo rovnou chybně anonymizovalo jako osobu");
      assertTest(panel.textContent.includes("Saturnin")&&panel.textContent.includes("Název / dílo")&&panel.textContent.includes("Jiný citlivý údaj"),"pravý panel neobsahuje úplný výběr kategorií");
      clearSelectedPhrase("in");
    });
    await test("Nové anonymizační kategorie vytvářejí bezpečné značky", async()=>{
      ST.in.raw="Saturnin, Teams a interní kód X9."; ST.in.km=[]; ST.in.reviewedSuggestions={}; ST.in.selectedPhrase="";
      addPhraseAs("in","Saturnin","title");
      addPhraseAs("in","Teams","contact");
      addPhraseAs("in","X9","sensitive");
      assertTest(ST.in.km.some(x=>x.token==="[název 1]"),"chybí značka názvu / díla");
      assertTest(ST.in.km.some(x=>x.token==="[kontakt 1]"),"chybí značka kontaktu");
      assertTest(ST.in.km.some(x=>x.token==="[citlivý údaj 1]"),"chybí značka jiného citlivého údaje");
      assertTest(preflightIssues(ST.in.clean,"in").danger.length===0,"nové bezpečné značky vyvolaly blokující preflight");
    });
    await test("Finální kontrola jasně ukazuje blokující krok", async()=>{
      E("in","raw").value="Petr píše zprávu."; doAnon("in");
      assertTest(E("in","previewSummary").textContent.includes("Návrhy k posouzení")&&E("in","previewSummary").textContent.includes("Zbývá rozhodnout"),"finální kontrola neukazuje chybějící krok");
      assertTest(!!E("in","previewSummary").querySelector("[data-review-keep-all]"),"u finální kontroly chybí hromadná akce");
      keepSuggestionRows("in",suggestionData("in").suggestions);
      assertTest(!E("in","reviewOk").disabled,"po vyřešení návrhů zůstal checkbox zamčený");
      assertTest(E("in","gateReason").textContent.includes("zaškrtni"),"brána neříká jasně poslední chybějící krok");
    });
    await test("Adresát Jiný zobrazí vlastní popis", async()=>{
      setChip("my_adresat","jiny");
      const input=$("my_adresatJiny"); input.value="nakladatelství"; input.dispatchEvent(new Event("input",{bubbles:true})); syncCustomRecipient("my");
      assertTest(!$("my_adresatJinyWrap").hidden,"pole pro jiného adresáta se nezobrazilo");
      assertTest(recipientLabel("my")==="Jiný – nakladatelství","vlastní adresát se nepropsal do popisu");
      setChip("my_adresat","rodic"); syncCustomRecipient("my");
    });
    await test("Podpis z profilu se zobrazí lokálně, ale do zdroje se nepropíše", async()=>{
      const old=localStorage.getItem("rozbor_profile");
      try{
        localStorage.setItem("rozbor_profile",JSON.stringify({name:"Daniel Baláž",sign:"pozdrav"}));
        const card=draftCard("in",{text:"Dobrý den,\n\nděkuji za zprávu."}); document.body.appendChild(card);
        assertTest(card.querySelector(".visible-signature").textContent.includes("Daniel Baláž"),"profilové jméno není v návrhu vidět");
        const src=card.__getSrc();
        assertTest(src.includes("[podpis]")&&!src.includes("Daniel Baláž"),"profilové jméno se propsalo do anonymního zdroje: "+src);
        card.remove();
      }finally{if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);}
    });
    await test("Dvě podobná jména zůstávají dvě osoby", async()=>{
      ST.in.raw="Jan Novák a Jana Nováková se dostavili.";
      ST.in.km=[{real:"Jan Novák",token:"osoba A",auto:false},{real:"Jana Nováková",token:"osoba B",auto:false}];
      const c=cleanFromKey("in");
      assertTest(c.includes("osoba A a osoba B"),"podobná jména se sloučila: "+c);
    });
    await test("Značka osoby se po smazání nerecykluje", async()=>{
      const km=[{real:"Petr",token:"osoba A"},{real:"Marie",token:"osoba B"}];
      km.shift();
      assertTest(nextPersonToken(km)==="osoba C","další osoba nedostala novou značku: "+nextPersonToken(km));
    });
    await test("Centrální preflight je povinný", async()=>{
      const oldMock=window.__TEST_MOCK_GEMINI; window.__TEST_MOCK_GEMINI=async()=>({}); geminiApiKey="";
      let required=false,blocked=false;
      try{await callGemini("x","{}","object");}catch(e){required=e.code==="PREFLIGHT_REQUIRED";}
      try{await callGemini("x","{}","object",{pane:"in",texts:["Ve třídě došlo k šikaně."]});}catch(e){blocked=e.code==="PREFLIGHT_BLOCKED";}
      window.__TEST_MOCK_GEMINI=oldMock;
      assertTest(required&&blocked,"callGemini nevyžaduje nebo nevynucuje centrální preflight");
    });
    await test("Zbylý tvar skrytého jména je stopka", async()=>{
      const text="Dobrý den, osoba A. Petrovi jsem to předal.";
      ST.in.km=[{real:"Petr",token:"osoba A",auto:false}]; ST.in.clean=text; publishActiveKeyReals("in"); E("in","reviewOk").checked=true; updateSendGate("in");
      const iss=preflightIssues(text,"in");
      assertTest(iss.danger.some(x=>/nezakrytý tvar/.test(x)),"zbylý pád jména není v danger: "+iss.danger.join(", "));
      assertTest($("in_analyzeBtn").disabled,"zbylý pád jména nezablokoval rozbor");
      ST.my.km=[{real:"Petr",token:"osoba A",auto:false}]; ST.my.clean=text; publishActiveKeyReals("my"); E("my","reviewOk").checked=true; updateSendGate("my");
      assertTest($("my_goBtn").disabled,"zbylý pád jména nezablokoval vytvoření e-mailu");
    });
    await test("Mock funguje bez ?test=1", async()=>{
      const old=window.__TEST_MOCK_GEMINI; window.__TEST_MOCK_GEMINI=async()=>({});
      assertTest(TEST_RUN_ACTIVE&&testMockAvailable(),"mock není aktivní při ručním běhu testů");
      window.__TEST_MOCK_GEMINI=old;
    });
    await test("Kontrola tónu přes mock", async()=>{
      const old=window.__TEST_MOCK_GEMINI,oldKey=geminiApiKey; geminiApiKey="";
      window.__TEST_MOCK_GEMINI=async({schema,thinking})=>{assertTest(schema==="tone"&&thinking==="minimal","kontrola tónu nepoužila levné uvažování");return {naladeni:{stupen:"neutral",popis:"věcné"},prirozenost:{stupen:"mirne_sablonovity",popis:"jeden obecný obrat"},rizika:["Příliš stručné"],sablonoviteObraty:["touto cestou"],navrh:"Doplnit konkrétní další krok"};};
      ST.in.km=[]; publishActiveKeyReals("in");
      const wrap=document.createElement("div"),btn=document.createElement("button");
      await toneCheck("in","Děkuji za zprávu.",wrap,btn);
      assertTest(!!wrap.querySelector(".tonecard")&&wrap.textContent.includes("Příliš stručné")&&wrap.textContent.includes("Mírně šablonovité")&&wrap.textContent.includes("touto cestou"),"rozšířená karta hodnocení textu se nevykreslila");
      ST.in.clean="Dobrý den, potvrzuji domluvenou konzultaci.";E("in","reviewOk").checked=true;clearAnalysisCache();
      const generated=document.createElement("div");
      await toneCheck("in","Předmět: Konzultace\n\nDobrý den,\n\nkázeňskou situaci probereme osobně.\n\n[podpis]",generated,btn,{trustedGenerated:true});
      assertTest(!!generated.querySelector(".tonecard"),"bezpečný nedotčený návrh vrátila kontrola tónu chybně k anonymizaci");
      window.__TEST_MOCK_GEMINI=old; geminiApiKey=oldKey;
    });
    await test("Import cizího souboru je odmítnut", async()=>{
      let rejected=false; try{applyImportedSettings({_app:"jina-aplikace",profil:{name:"Cizí"}});}catch(e){rejected=/není nastavení/.test(e.message);}
      assertTest(rejected,"cizí aplikační formát nebyl odmítnut");
    });
    await test("Konfigurace Gemini používá doložené limity", async()=>{
      assertTest(GEMINI_MAX_OUTPUT_TOKENS>=32768,"výstupní limit Gemini je příliš nízký");
      assertTest(!String(callGemini).includes('thinkingLevel:'+JSON.stringify('low')),"zdroj stále používá nedoložené thinkingLevel low");
    });
    await test("Chybný JSON a validace schématu", async()=>{
      let bad=false; try{ parseModelJson("Jasně, tady je odpověď bez JSON."); }catch(e){ bad=e.code==="BAD_JSON"; }
      assertTest(bad,"chybný JSON nebyl odmítnut");
      let schema=false; try{ validateModelJson({foo:"bar"},"analyze"); }catch(e){ schema=e.code==="BAD_SCHEMA"; }
      assertTest(schema,"špatné schéma nebylo odmítnuto");
    });
    await test("Chybějící API klíč", async()=>{
      window.__TEST_MOCK_GEMINI=null; geminiApiKey=""; let ok=false;
      try{ await callGemini("x","{}","object"); }catch(e){ ok=e.code==="API_KEY_MISSING"; }
      assertTest(ok,"chybějící klíč nebyl zachycen");
    });
    await test("Slovník jmen bez kolizí značek", async()=>{
      let old="[]"; try{ old=localStorage.getItem("rozbor_dict")||"[]"; }catch(_){}
      saveDict([{real:"Anna Nováková",token:"osoba A"},{real:"Petr Svoboda",token:"osoba A"}]);
      ST.in.raw="Anně Novákové odpoví Petr Svoboda."; ST.in.km=[]; ST.in.emailN=0; ST.in.phoneN=0;
      buildKey(ST.in,[]);
      assertTest(ST.in.km.length===2,"víceslovná nebo skloňovaná jména ze slovníku nebyla nalezena");
      assertTest(new Set(ST.in.km.map(k=>k.token)).size===2,"slovník vytvořil kolizi značek osob");
      assertTest(!loadDict().some(x=>x.token),"slovník stále ukládá relaci závislé značky");
      try{ localStorage.setItem("rozbor_dict",old); }catch(_){}
    });
    await test("Změna anonymizačního klíče ruší potvrzení", async()=>{
      E("in","raw").value="Anna přijde zítra."; doAnon("in"); addWord("in","Anna");
      E("in","reviewOk").checked=true; updateSendGate("in"); renderKeyTable("in");
      const inp=E("in","keyBody").querySelector('input[data-f="token"]'); inp.value="osoba B"; inp.dispatchEvent(new Event("input",{bubbles:true}));
      assertTest(!E("in","reviewOk").checked,"potvrzení zůstalo aktivní po změně klíče");
    });
    await test("Kontrola konceptu blokuje jen nevratné chyby", async()=>{
      const old=localStorage.getItem("rozbor_profile"),mode=ST.in.replySenderMode;ST.in.replySenderMode="jednotlivec";
      try{
        localStorage.removeItem("rozbor_profile");
        const rows=[
          ["Dobrý den,\n\npotvrzuji termín.\n\n[podpis]","",false],
          ["Dobrý den,\n\nrád bych Vás informoval.\n\n[podpis]","",false],
          ["Dobrý den,\n\nMáme ve škole pravidlo, že omluvenky chodí do tří dnů.\n\n[podpis]","",false],
          ["Dobrý den,\n\nJsme domluveni na čtvrtku.\n\n[podpis]","",false],
          ["Dobrý den,\n\nDošlo k technickému selhání systému Bakaláři.\n\n[podpis]","",false],
          ["Dobrý den,\n\nTermín potvrzuji.\n\n[podpis]","Sejdeme se v pondělí v 10:00?",false],
          ["Dobrý den,\n\nPondělní termín mi nevychází.\n\n[podpis]","Sejdeme se v pondělí?",false],
          ["", "", true]
        ];
        rows.forEach(([text,source,danger])=>assertTest((evaluateDraftReadiness("in",text,source,{}).level==="danger")===danger,"neočekávaná úroveň: "+JSON.stringify({text,source,result:evaluateDraftReadiness("in",text,source,{})})));
        const leftover=evaluateDraftReadiness("in","Dobrý den,\n\nProsím kontaktujte [e-mail 1].\n\n[podpis]","",{});
        assertTest(leftover.level==="danger","nevyplněná značka musí zůstat stopkou");
      }finally{ST.in.replySenderMode=mode;if(old===null)localStorage.removeItem("rozbor_profile");else localStorage.setItem("rozbor_profile",old);}
    });
    await test("Unicode hranice fungují pro česká slova a adresy", async()=>{
      ["věřím, že společně","v dnešní době"].forEach(x=>assertTest(findTemplatePhrases(x).length,x+" nebyl rozpoznán"));
      ["náměstí","nábřeží","čp. 12","Čajkovského 12","Šeříková 3"].forEach(x=>assertTest(preflightIssues(x).warn.some(w=>/adres/.test(w)),x+" neaktivoval adresní upozornění"));
      const d=window.extractDraftDates("V úterý a ve čtvrtek, případně pondělní nebo čtvrteční termín.");
      ["úterý","čtvrtek","pondělí"].forEach(x=>assertTest(d.includes(x),x+" chybí v "+d.join(",")));
    });
    await test("Preflight jmen používá stejné návrhy jako panel", async()=>{
      ["Volejte na [telefon 1].","Schůzka proběhne zítra.","Tereza mluvila s Janou Novákovou."].forEach(text=>{
        ST.in.raw=text;ST.in.km=[];ST.in.reviewedSuggestions={};clearAnalysisCache();
        const suggestions=suggestionData("in").suggestions.map(x=>x.phrase),names=preflightIssues(text,"in").names;
        assertTest(names.every(x=>suggestions.includes(x)),text+" má rozporné seznamy: "+JSON.stringify({names,suggestions}));
      });
    });
    await test("Oranžové upozornění neblokuje generování", async()=>{
      ST.in.clean="Žák 1.A odevzdal práci."; ST.in.raw=ST.in.clean; ST.in.reviewedSuggestions={}; clearAnalysisCache();
      E("in","reviewOk").checked=true;
      updateSendGate("in");
      assertTest(safetyAudit(ST.in.clean).level==="warn","testovací text nevyvolal oranžové upozornění");
      assertTest(!$("in_analyzeBtn").disabled,"oranžové upozornění zablokovalo generování");
    });
    await test("Doplňující pokyny se anonymizují a hlídají", async()=>{
      ST.in.km=[{real:"Anna",token:"osoba A",auto:false},{real:"Karel",token:"osoba B",auto:false}]; ST.in.clean="Bezpečný text.";
      assertTest(safeAuxiliaryText("in","pracoval jsem s Annou",null,"Poznámka").includes("osoba A"),"známé jméno v poznámce nebylo anonymizováno");
      assertTest(safeAuxiliaryText("in","Vyřiď Karlovi, aby odpověděl.",null,"Poznámka").includes("osoba B"),"skloňované jméno v poznámce nebylo anonymizováno");
      assertTest(safeAuxiliaryText("in","pracoval jsem s Klárou",null,"Poznámka")===null,"neznámé možné jméno v poznámce musí odeslání zastavit");
    });
    await test("Cizí jména -ia a -ie mají lokální pádové tvary", async()=>{
      const c=generatedPersonForms("Cecilia"),j=generatedPersonForms("Julie");
      assertTest(c[2]==="Cecilie"&&c[4]==="Cecilii"&&c[7]==="Cecilií","Cecilia se skloňuje chybně: "+JSON.stringify(c));
      assertTest(j[4]==="Julii"&&j[7]==="Julií","Julie se skloňuje chybně: "+JSON.stringify(j));
    });
    await test("Poznámka skryje tvar Cecilii bez databáze jednotlivých jmen", async()=>{
      ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];publishActiveKeyReals("in");clearAnalysisCache();
      const safe=safeAuxiliaryText("in","Nemůžu odpovědět, protože Cecilii vůbec neučím.",null,"Poznámka");
      assertTest(safe&&safe.includes("osoba B")&&!/Cecili/i.test(safe),"tvar Cecilii unikl do poznámky: "+safe);
    });
    await test("Technická značka nese pád a lokálně vrátí Cecilii", async()=>{
      ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];publishActiveKeyReals("in");
      const prompt=toModelPersonTokens("Nemohu odpovědět osobě B.");
      assertTest(prompt.includes("[[PERSON_B]]")&&!prompt.includes("Cecilia"),"prompt neobsahuje bezpečnou technickou značku: "+prompt);
      const anonymous=fromModelPersonTokens("Cecilii neučím: [[PERSON_B|4]].");
      assertTest(anonymous.includes("osobu B"),"výstupní pád se nepřevedl na anonymní tvar: "+anonymous);
      const final=recompose("in","Nemohu odpovědět, protože osobu B vůbec neučím.");
      assertTest(final.includes("Cecilii")&&!final.includes("osobu B"),"lokální návrat jména nemá správný pád: "+final);
    });
    await test("Výstupní pojistka znovu skryje skutečné jméno modelu", async()=>{
      ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];publishActiveKeyReals("in");clearAnalysisCache();
      const safe=secureModelResult({text:"Cecilia se nemůže účastnit."},"text","in");
      assertTest(safe.text.includes("osoba B")&&!safe.text.includes("Cecilia"),"skutečné jméno zůstalo ve výstupu: "+safe.text);
    });
    await test("Výstupní pojistka zachová pád uniklého jména", async()=>{
      ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];publishActiveKeyReals("in");clearAnalysisCache();
      const safe=secureModelResult({text:"Cecilii vůbec neučím."},"text","in");
      assertTest(safe.text.includes("osob")&&!safe.text.includes("Cecili"),"uniklý pád nebyl skryt: "+safe.text);
      const final=recompose("in",safe.text);assertTest(final.includes("Cecilii"),"po lokálním návratu se ztratil pád: "+final);
    });
    await test("Cizojazyčný systém vyžaduje základní tvar osoby", async()=>{
      const old=readChip;let selected="en";window.readChip=(id)=>id==="outlang"?selected:old(id);
      const en=langSystem();selected="es";const es=langSystem();window.readChip=old;
      assertTest(en.includes("[[PERSON_A|1]]")&&es.includes("[[PERSON_A|1]]"),"angličtina nebo španělština nevyžaduje základní tvar značky");
    });
    await test("Preflight kontroluje skutečný finální prompt", async()=>{
      ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];publishActiveKeyReals("in");clearAnalysisCache();
      const old=window.__TEST_MOCK_GEMINI;window.__TEST_MOCK_GEMINI=async()=>({text:"ok"});let blocked=false;
      try{await callGemini("Instrukce obsahuje Cecilia.",SYS_PREPIS,"text",{pane:"in",texts:["bezpečný text"]});}catch(e){blocked=e.code==="PREFLIGHT_BLOCKED";}
      window.__TEST_MOCK_GEMINI=old;assertTest(blocked,"skutečné jméno v kompletním promptu nevyvolalo stopku");
    });
    await test("Místní štítky ukazují osobu, ale vkládají jen značku", async()=>{
      ST.my.km=[{real:"Cecilia",token:"osoba B",auto:false}];renderPersonReferenceChips("my");
      const box=$("my_personRefs"),input=$("my_note");input.value="";
      assertTest(box&&box.textContent.includes("osoba B")&&box.textContent.includes("Cecilia"),"místní štítek není srozumitelný");
      box.querySelector("button").click();assertTest(input.value.includes("osoba B")&&!input.value.includes("Cecilia"),"štítek vložil skutečné jméno do poznámky");
    });
    await test("Rozpracovaná anonymizace se ukládá jen do relace", async()=>{
      E("in","raw").value="Cecilia píše.";ST.in.raw=E("in","raw").value;ST.in.clean="osoba B píše.";ST.in.km=[{real:"Cecilia",token:"osoba B",auto:false}];saveWorkingSessionNow();
      const rec=JSON.parse(sessionStorage.getItem(WORK_SESSION_KEY)||"null");
      assertTest(rec&&rec.format===2&&rec.in.state.km[0].real==="Cecilia"&&localStorage.getItem(WORK_SESSION_KEY)===null,"rozpracovaný stav není správně omezen na sessionStorage");
    });
    await test("Import EML: vnořené MIME a kódované hlavičky", async()=>{
      const eml='From: =?UTF-8?Q?Petr_Nov=C3=A1k?= <petr@example.cz>\nSubject: =?UTF-8?Q?P=C5=99edm=C4=9Bt_test?=\nContent-Type: multipart/mixed; boundary="outer"\n\n--outer\nContent-Type: multipart/alternative; boundary="inner"\n\n--inner\nContent-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: quoted-printable\n\nDobr=C3=BD den.\n--inner--\n--outer--';
      const parsed=parseEml(eml);
      assertTest(parsed.includes("Petr Novák") && parsed.includes("Předmět test") && parsed.includes("Dobrý den."),"EML se nerozbalil nebo nedekódoval správně: "+parsed);
    });
    await test("E2E Příchozí přes mock", async()=>{
      window.__TEST_MOCK_GEMINI=async()=>({shrnuti:"Rodič žádá o konzultaci.",naladeni:{stupen:"neutral",popis:"věcné"},pozadavky:["Domluvit termín"],upozorneni:[],doporucenyZamer:"schuzka"});
      E("in","raw").value="Dobrý den, prosím o konzultaci. Tel. 777 123 456."; doAnon("in"); E("in","reviewOk").checked=true; updateSendGate("in");
      assertTest($("in_previewSummary").textContent.includes("Co je skryto") && $("in_previewSummary").textContent.includes("Co je rizikové") && $("in_previewSummary").textContent.includes("Co odejde modelu") && $("in_previewSummary").textContent.includes("telefon"),"kompaktní souhrn po anonymizaci se nezobrazil");
      const safetyAction=$("in_safety").querySelector(".safety-action");
      assertTest(!!safetyAction && safetyAction.textContent.trim().length>0,"bezpečnostní kontrola nezobrazuje akční text");
      await $("in_analyzeBtn").onclick();
      await waitFor(()=>$("in_results").textContent.includes("Rodič žádá"));
    });
    await test("Výběr jedné ze tří variant vyčistí pracovní plochu", async()=>{
      ST.in.clean="Bezpečný anonymizovaný text."; ST.in.pozadavky=["Potvrdit termín"];
      renderAnalysis({shrnuti:"Test",naladeni:{stupen:"neutral",popis:""},pozadavky:ST.in.pozadavky,upozorneni:[],doporucenyZamer:"informovat"});
      E("in","reviewOk").checked=true; geminiApiKey="test";
      window.__TEST_MOCK_GEMINI=async()=>({navrhy:[
        {typ:"strucna",styl:"Stručná",text:"Stručná odpověď. [podpis]"},
        {typ:"standardni",styl:"Standardní",text:"Standardní odpověď. [podpis]"},
        {typ:"diplomaticka",styl:"Diplomatická",text:"Diplomatická odpověď. [podpis]"}
      ]});
      await genReplies();
      const cards=[...document.querySelectorAll('#in_replies .variant-choice-card')];
      assertTest(cards.length===3,"nevznikly tři varianty");
      assertTest(document.querySelectorAll('#in_replies .act-pick-variant').length===3,"každá varianta nemá jasnou volbu");
      assertTest(!document.querySelector('#in_replies #compareVariants')&&!document.querySelector('#in_replies .variant-tabs'),"zůstalo duplicitní přepínání nebo porovnání");
      cards[1].querySelector('.act-pick-variant').click();
      assertTest(cards[1].classList.contains('selected-variant')&&!cards[1].hidden,"vybraná varianta není aktivní");
      assertTest(cards[0].hidden&&cards[2].hidden,"nevybrané varianty se neschovaly");
      assertTest(getComputedStyle(cards[0]).display==="none"&&getComputedStyle(cards[2]).display==="none","nevybrané varianty zůstaly vizuálně zobrazené");
      const actions=cards[1].querySelector('.actions');
      assertTest(actions&&!actions.hidden,"finální akce se po výběru nezobrazily");
      document.querySelector('#backToVariants').click();
    });
    await test("Odškrtnutí všech požadavků se nevrátí k původním", async()=>{
      ST.in.clean="Bezpečný anonymizovaný text."; ST.in.pozadavky=["První bod","Druhý bod"];
      renderAnalysis({shrnuti:"Test",naladeni:{stupen:"neutral",popis:""},pozadavky:ST.in.pozadavky,upozorneni:[],doporucenyZamer:"informovat"});
      document.querySelectorAll('#in_asks input[data-ask]').forEach(x=>x.checked=false);
      E("in","reviewOk").checked=true; let calls=0; window.__TEST_MOCK_GEMINI=async()=>{calls++;return {navrhy:[]};}; geminiApiKey="test";
      await genReplies();
      assertTest(calls===0 && $("in_replyState").textContent.includes("Není vybrán žádný požadavek"),"prázdný výběr tiše obnovil všechny požadavky");
    });
    await test("E2E Můj e-mail přes mock", async()=>{
      window.__TEST_MOCK_GEMINI=async()=>({text:"Dobrý den,\nopraveno.\n[podpis]",zmeny:["Oprava formulace"],synonyma:{}});
      E("my","raw").value="Dobry den, posilam informaci."; doAnon("my"); E("my","reviewOk").checked=true; updateSendGate("my");
      await $("my_goBtn").onclick();
      await waitFor(()=>$("my_results").textContent.includes("opraveno"));
    });
    await test("Změna vstupu zneplatní navazující kroky", async()=>{
      E("my","raw").value="Původní text"; doAnon("my"); E("my","reviewOk").checked=true; ST.my.outputReady=true;
      $("my_results").innerHTML="<div>starý výsledek</div>"; updateProgress("my");
      E("my","raw").value="Upravený text"; E("my","raw").dispatchEvent(new Event("input",{bubbles:true}));
      assertTest(ST.my.clean==="" && ST.my.outputReady===false,"stará anonymizace nebo výsledek zůstaly aktivní");
      assertTest(!E("my","reviewOk").checked,"potvrzení náhledu nebylo zrušeno");
      assertTest($("my_results").textContent.trim()==="","starý výsledek nebyl odstraněn");
      assertTest(E("my","step2").hidden===true,"stará anonymizační část zůstala otevřená");
    });
    await test("Připojení a modely mají správné režimy", async()=>{
      assertTest(!!$("qmLite")&&!!$("qmStrong")&&!!$("qmQuality"),"serverless režim nemá tři modelové volby");
      assertTest($("qmLite").textContent.includes("◇")&&!$("qmLite").textContent.includes("🪶"),"úsporný model má rozbitý symbol");
      const css=[...document.querySelectorAll("style")].map(x=>x.textContent).join("\n");
      assertTest(css.includes('.school-ai-status[hidden],#directGeminiSettings[hidden]'),"hidden atribut režimů může být přebit CSS");
      assertTest($("schoolGatewayStatus").textContent.includes("Režim školní AI služby")&&!$("schoolGatewayStatus").textContent.includes("Připojeno"),"školní režim nepravdivě tvrdí aktivní připojení");
    });
    await test("Rozsah odpovědi je předvybraný a poznámka je nahoře", async()=>{
      ST.in.pozadavky=["Potvrdit termín","Zkontrolovat zařízení"];
      renderAnalysis({shrnuti:"Test",naladeni:{stupen:"neutral",popis:""},pozadavky:ST.in.pozadavky,upozorneni:[],doporucenyZamer:"potvrdit"});
      const scope=$("in_scopeDetails"),note=$("in_note"),recipient=document.querySelector('.chips[data-group="in_adresat"]');
      assertTest(scope&&scope.open&&scope.textContent.includes("Nemusíš nic měnit"),"rozsah odpovědi není volitelně a srozumitelně předvybraný");
      assertTest([...scope.querySelectorAll('input[data-ask]')].every(x=>x.checked),"některý bod není výchozí zaškrtnutý");
      assertTest(note&&note.closest(".note-field")&&!note.closest(".advanced-only"),"poznámka není dostupná v jednoduchém režimu");
      assertTest(note.compareDocumentPosition(recipient)&Node.DOCUMENT_POSITION_FOLLOWING,"poznámka není před nastavením adresáta");
    });
    await test("Mobilní zobrazení a jednoduchý průvodce", async()=>{
      const css=[...document.querySelectorAll("style")].map(x=>x.textContent).join("\n");
      assertTest(css.includes("@media (max-width:640px)"),"chybí mobilní media query");
      assertTest(css.includes(".actsticky"),"chybí sticky mobilní akce");
      assertTest(!!document.querySelector(".tools-btn"),"chybí menu Nástroje");
      assertTest(!!document.querySelector(".footer-tools-panel") && !!document.querySelector(".legal-divider") && !!document.querySelector(".owner-lines"),"patička není rozdělena na funkční a právní část");
      setUiMode("simple");
      assertTest(!document.querySelector("#safetyGuideInline"),"duplicitní bezpečný postup zůstal v záhlaví");
      const flow=document.querySelector("#appProgress");
      assertTest(!!flow,"chybí hlavní čtyřkrokový průběh");
      assertTest(flow.textContent.includes("Vložit text") && flow.textContent.includes("Anonymizovat") && flow.textContent.includes("Ověřit náhled") && flow.textContent.includes("Vytvořit výstup"),"hlavní průběh neobsahuje úplný čtyřkrokový tok");
      const modeExplain=document.querySelector("#uiModeExplain");
      assertTest(!!modeExplain && modeExplain.textContent.includes("Jednoduchý") && modeExplain.textContent.includes("Pokročilý") && modeExplain.textContent.includes("tón"),"chybí vysvětlení jednoduchého a pokročilého režimu");
      assertTest(getComputedStyle(flow).display!=="none","hlavní průběh se v jednoduchém režimu nesmí skrýt");
      const hidden=getComputedStyle(document.querySelector("#my_choiceSummary")).display==="none";
      assertTest(hidden,"souhrn pokročilých voleb se v jednoduchém režimu nezakryl");
    });
    await test("Můj e-mail - jazykové režimy", async()=>{
      setChip("my_lang","en"); assertTest(/ANGLIČTINĚ/.test(myLangLine()+myLangSystem()),"angličtina není v promptu");
      setChip("my_lang","es"); assertTest(/ŠPANĚLŠTINĚ/.test(myLangLine()+myLangSystem()),"španělština není v promptu");
      setChip("my_lang","keep"); assertTest(/Zachovej jazyk/.test(myLangSystem()),"zachování jazyka není v promptu");
    });
    await test("Školní scénáře a přísný režim", async()=>{
      try{localStorage.removeItem(NO_HISTORY_SK); sessionStorage.setItem(LAST_PROMPT_SK,"x");}catch(_){}
      applySchoolScenario("discipline");
      assertTest(readChip("my_adresat")==="rodic","scénář nenastavil adresáta");
      assertTest(readChip("my_cdelka")==="strucna","citlivý scénář nenastavil kratší délku");
      assertTest($("my_scenarioHint").textContent.includes("Citlivý"),"chybí citlivé upozornění");
      assertTest($("my_scenarioHint").textContent.includes("Přísný režim"),"chybí upozornění na přísný režim");
      assertTest(isNoHistory(),"citlivý scénář nevypnul historii");
      saveLastPromptDebug("tajný prompt","sys","model","text");
      assertTest(!loadLastPromptDebug(),"debug prompt se uložil v přísném režimu");
      assertTest(strictScenarioPrompt().includes("PŘÍSNÝ ŠKOLNÍ REŽIM"),"přísný režim není v promptu");
      applySchoolScenario("health_ppp");
      assertTest(readChip("my_scenario")==="health_ppp" && isStrictScenarioActive(),"scénář zdraví/PPP nespustil přísný režim");
      applySchoolScenario("ospod_family");
      assertTest(readChip("my_scenario")==="ospod_family" && strictScenarioPrompt().includes("OSPOD"),"scénář OSPOD/rodina není v přísném promptu");
      setChip("my_scenario","none");
      try{ localStorage.removeItem(NO_HISTORY_SK); sessionStorage.setItem(LAST_PROMPT_SK,"x"); }catch(_){}
      E("my","raw").value="PPP, OSPOD a rodinné poměry žáka"; doAnon("my");
      assertTest(isNoHistory(),"citlivý obsah automaticky nevypnul historii");
      assertTest(!loadLastPromptDebug(),"citlivý obsah nesmazal debug prompt");
    });
    await test("Přísný režim odstraní a potlačí pracovní relaci", async()=>{
      resumeWorkingSession();E("my","raw").value="Rozpracovaný text se skutečným jménem Jan Novák";ST.my.raw=E("my","raw").value;saveWorkingSessionNow();
      assertTest(!!sessionStorage.getItem(WORK_SESSION_KEY),"pracovní relace se před testem neuložila");
      activateSensitiveMode("test");saveWorkingSessionNow();
      assertTest(!sessionStorage.getItem(WORK_SESSION_KEY),"přísný režim ponechal pracovní relaci se skutečnými údaji");
      resumeWorkingSession();clearWorkingSession();
    });
    await test("Citlivý rozepsaný text se do pracovní relace vůbec neuloží", async()=>{
      resumeWorkingSession();clearWorkingSession();
      E("in","raw").value="Žák má SPU a doporučení z PPP.";ST.in.raw=E("in","raw").value;
      saveWorkingSessionNow();
      assertTest(!sessionStorage.getItem(WORK_SESSION_KEY),"citlivý rozepsaný text zůstal v sessionStorage");
      E("in","raw").value="Běžná organizační zpráva.";ST.in.raw=E("in","raw").value;
      saveWorkingSessionNow();
      assertTest(!!sessionStorage.getItem(WORK_SESSION_KEY),"nezávadný rozepsaný text se přestal ukládat");
      clearWorkingSession();
    });
    await test("Škodlivý/importovaný vstup a escapování", async()=>{
      E("in","raw").value='Dobrý den, <scr'+'ipt>alert(1)</scr'+'ipt> píše VelmiDlouhéJménoSloženéNováková-Králová 😀, tel. +420 777/123/456, třídy 1.A a 2.B, nar. 1. 2. 2010, OSPOD PPP. Podpis: Mgr. Testovací <b>učitel</b>.';
      doAnon("in");
      assertTest(!E('in','view').querySelector('script'),"script tag se propsal do hlavního náhledu jako prvek");
      const iss=preflightIssues(ST.in.clean+" 1.A 2.B nar. 1. 2. 2010 OSPOD PPP +420 777/123/456");
      assertTest(iss.danger.some(x=>/telefon/.test(x)),"netypický telefon nebyl zachycen");
      assertTest(iss.warn.some(x=>/třída/.test(x)),"více tříd nebylo zachyceno jako upozornění");
      assertTest(iss.danger.some(x=>/citlivé/.test(x)),"citlivý importovaný obsah nebyl zachycen");
      applyImportedSettings({profil:{name:'Učitel "autofocus" <img src=x alt=x onerror=alert(1)>',role:'<b>role</b>',school:'Gymnázium & test'},slovnikJmen:[{real:'Žák <scr'+'ipt>',token:'osoba ZZ'}],sablony:[{name:'<b>šablona</b>',text:'text'}],neukladatHistorii:true});
      window.__openProfile();
      assertTest(!document.querySelector('#profOverlay img'),"importovaný HTML tag se vykreslil v profilu");
      assertTest(document.querySelector('#pf_name').value.includes('autofocus'),"uvozovky/importovaný profil nejsou uložené jako text");
      document.querySelector('#profClose').click();
    });
    await test("Prompt-injection obrana", async()=>{
      assertTest(SYS_ANALYZE.includes("nedůvěryhodný obsah") && SYS_REPLY.includes("ignoruj předchozí pokyny"),"systémové prompty neobsahují prompt-injection obranu");
    });
    await test("Vývojářské nástroje a technický log bez textů", async()=>{
      clearOpsLog();
      logOp("test","ok",{prompt:"tajný text",text:"hotový e-mail",schema:"text",code:"OK"});
      const log=loadOpsLog();
      assertTest(log.length===1,"technický log se neuložil");
      const dump=JSON.stringify(log);
      assertTest(!dump.includes("tajný text") && !dump.includes("hotový e-mail"),"technický log obsahuje text/prompt");
      assertTest(typeof openDeveloperTools==="function" && typeof openOpsLog==="function","chybí vývojářské nástroje nebo technický log");
      const labels=toolsActions.map(a=>a.label).join("|");
      assertTest(!labels.includes("Debug prompt") && !labels.includes("Spustit testy"),"debug nebo testy zůstaly jako samostatné položky");
      assertTest(DEV_MODE?labels.includes("Vývojářské nástroje"):!labels.includes("Vývojářské nástroje"),"viditelnost vývojářských nástrojů neodpovídá roli správce nebo testovacímu režimu");
    });

    await test("Historie ukládá jen anonymizovanou verzi", async()=>{
      try{localStorage.removeItem("rozbor_history");}catch(_){} setNoHistory(false);
      ST.my.km=[{real:"Jan Novák",token:"osoba A",auto:false}];
      saveHistory("my","Test","Dobrý den, Jan Novák. Kontakt: osoba A.");
      const dump=JSON.stringify(loadHistory());
      assertTest(!dump.includes("Jan Novák"),"historie obsahuje skutečné jméno");
      assertTest(dump.includes("osoba A") || loadHistory().length===0,"historie neobsahuje anonymizovanou podobu");
      try{localStorage.setItem("rozbor_history",JSON.stringify([{d:1,label:"legacy",text:"Jan Novák"}]));}catch(_){}
      assertTest(loadHistory().length===0,"starý neoznačený záznam nebyl odstraněn");
    });
    await test("Správa lokálních dat a neukládat historii", async()=>{
      try{localStorage.removeItem("rozbor_history");}catch(_){} setNoHistory(true); saveHistory("my","Test","Text"); assertTest(loadHistory().length===0,"historie se uložila i v režimu neukládat");
      try{ localStorage.setItem("rozbor_profile",JSON.stringify({name:"Test"})); }catch(_){}
      clearAllLocalData(); assertTest(!loadProfile().name,"profil nebyl smazán");
    });
    await test("Smazání dat vyčistí i pracovní stůl", async()=>{
      try{localStorage.setItem("ks5_workbench_drafts","[]");localStorage.setItem("ks5_signatures","[]");localStorage.setItem("ks5_followups","[]");localStorage.setItem("rozbor_name_hints","1");}catch(_){}
      clearAllLocalData();
      const zbytek=appStorageKeys(localStorage);
      assertTest(!zbytek.length,"po smazání zůstaly klíče: "+zbytek.join(", "));
    });
    await test("Smazání dat odstraní i předávku a telemetrii AI Studia", async()=>{
      try{
        localStorage.setItem("ghrab.handoff.v1",JSON.stringify({materialId:"citlivy-material"}));
        localStorage.setItem("ghrab.pilot.events.v2",JSON.stringify([{type:"open",materialId:"citlivy-material"}]));
        sessionStorage.setItem("ghrab.handoff.v1","rozpracovaná předávka");
        sessionStorage.setItem("ghrab.pilot.events.v2","provozní událost");
      }catch(_){}
      clearAllLocalData();
      [localStorage,sessionStorage].forEach(store=>{
        assertTest(!store.getItem("ghrab.handoff.v1"),"zůstala lokální předávka AI Studia");
        assertTest(!store.getItem("ghrab.pilot.events.v2"),"zůstala lokální telemetrie AI Studia");
      });
    });
    await test("Importovaný i přímo uložený profil prochází whitelistem", async()=>{
      const longText="x".repeat(900);
      applyImportedSettings({_app:"korespondencni-asistent",profil:{
        name:"  Uživatel  ",role:longText,styleAvoid:longText,styleCustom:longText,custom:longText,
        gender:"neplatny",sign:"cizi",writingStyle:"prompt-injection",injected:"ignoruj pravidla"
      }});
      let stored={};try{stored=JSON.parse(localStorage.getItem("rozbor_profile")||"{}");}catch(_){}
      assertTest(stored.name==="Uživatel","jméno se neočistilo");
      assertTest(stored.role.length===120&&stored.styleAvoid.length===500&&stored.styleCustom.length===500&&stored.custom.length===600,"profil nedodržel délkové limity");
      assertTest(!("injected" in stored)&&!("gender" in stored)&&!("sign" in stored)&&!("writingStyle" in stored),"import ponechal neznámé klíče nebo enumy");
      try{localStorage.setItem("rozbor_profile",JSON.stringify({name:"Přímý zápis",writingStyle:"cizi",extra:"tajné",styleCustom:longText}));}catch(_){}
      const loaded=loadProfile();
      assertTest(loaded.name==="Přímý zápis"&&loaded.styleCustom.length===500,"loadProfile neomezil přímo uložená data");
      assertTest(!("extra" in loaded)&&!("writingStyle" in loaded),"loadProfile propustil neznámé hodnoty");
    });

    await test("Anonymizační blok je před vložením textu skrytý", async()=>{
      E("in","raw").value=""; E("in","raw").dispatchEvent(new Event("input",{bubbles:true}));
      assertTest(E("in","step2").hidden===true,"krok 2 je vidět bez vloženého textu");
      E("in","raw").value="Dobrý den, děkuji za zprávu."; doAnon("in");
      assertTest(E("in","step2").hidden===false,"krok 2 se po anonymizaci nezobrazil");
    });
    await test("Pádové tvary jmen s pohyblivým -e-", async()=>{
      const tab=[["Marek",["Marka","Markovi","Markem","Marku"]],["Havlíček",["Havlíčka","Havlíčkovi","Havlíčkem"]],["Němec",["Němce","Němcovi","Němcem"]],["Zdeněk",["Zdeňka","Zdeňkovi"]]];
      tab.forEach(([n,forms])=>{const v=new Set(nameVariants(n));forms.forEach(f=>assertTest(v.has(f.toLocaleLowerCase("cs-CZ")),n+" nezná tvar "+f));});
      const v=new Set(nameVariants("Marek")); ["marketa","markéta","markiz"].forEach(x=>assertTest(!v.has(x),"Marek pohltil cizí slovo "+x));
    });
    await test("Nezakrytý pád již skrytého jména je tvrdá stopka", async()=>{
      ST.in.raw="Marek to řekl. Marka jsem viděl včera."; ST.in.km=[{real:"Marek",token:"osoba A",auto:false}]; ST.in.clean=cleanFromKey("in"); publishActiveKeyReals("in"); clearAnalysisCache();
      assertTest(!/Marka/.test(ST.in.clean)||preflightIssues(ST.in.clean,"in").danger.length,"tvar Marka prošel bez stopky");
    });
    await test("Anonymizovaný výstup se ukládá do historie", async()=>{
      setNoHistory(false); try{localStorage.setItem("rozbor_history","[]");}catch(_){}
      ST.in.km=[{real:"Jana Nováková",token:"osoba A",auto:false}];
      saveHistory("in","Standardní","Dobrý den, osoba A,\n\nděkuji. Termín posouvám na pátek.\n\n[podpis]");
      assertTest(loadHistory().length===1,"nezávadný výstup se neuložil do historie");
      saveHistory("in","Standardní","Dobrý den, ozvi se na 777 123 456.");
      assertTest(!loadHistory().some(x=>/777/.test(x.text)),"do historie se dostal kontakt");
    });
    await test("Školní scénář dá zpětnou vazbu i v jednoduchém režimu", async()=>{
      setUiMode("simple"); syncSchoolScenario("grade_parent",true); const box=$("my_scenarioApplied");
      assertTest(box&&!box.hidden,"potvrzení scénáře není v jednoduchém režimu vidět"); assertTest(/Rodič/.test(box.textContent),"potvrzení nevypisuje změněné parametry");
    });
    await test("Vokativ po Dobrý den", async()=>{
      ST.in.km=[{real:"Petr Novák",token:"osoba A",auto:false}]; const r=recompose("in","Dobrý den, osoba A,\n\nděkuji.\n\n[podpis]");
      assertTest(!/Dobrý den, Petr Novák/.test(r),"jméno zůstalo v 1. pádu: "+r);
    });
    await test("Návrhy nešumí běžnými slovy na začátku vět", async()=>{
      E("in","raw").value="Dobrý den,\n\nmoje dcera Tereza byla nemocná. Zítra jdeme na kontrolu. Můžete mi napsat termín? Volat můžete odpoledne.\n\nJana Nováková"; doAnon("in");
      const f=suggestionData("in").suggestions.map(x=>x.phrase); ["Zítra","Můžete","Volat"].forEach(x=>assertTest(!f.includes(x),"falešný návrh: "+x));
      assertTest(f.includes("Tereza")&&f.includes("Jana Nováková"),"skutečná jména zmizela z návrhů: "+f.join(", "));
    });
    await test("Píšu jako funguje i v režimu Můj e-mail", async()=>{
      assertTest(document.querySelector('.chips[data-group="my_pisujako"]'),"chybí volba Píšu jako v Můj e-mail"); ST.my.replySenderMode="jednotlivec";
      const r=evaluateDraftReadiness("my","Dobrý den,\n\nprojednáme to na komisi a ozveme se.\n\n[podpis]","",{});
      assertTest(r.items.some(x=>!x.ok&&/jednotlivce/.test(x.label)),"množné tvary neprošly kontrolou");
    });
    await test("Předmět se pozná i v angličtině a španělštině", async()=>{
      assertTest(splitSubject("Subject: Missing homework\n\nDear parents,").subject==="Missing homework","EN předmět");
      assertTest(splitSubject("Asunto: Tarea pendiente\n\nEstimados padres,").subject==="Tarea pendiente","ES předmět");
      assertTest(splitSubject("Předmět: Chybějící úkol\n\nDobrý den,").subject==="Chybějící úkol","CS předmět");
    });
    await test("Vlastní předmět lze napsat ručně a zůstává lokální", async()=>{
      const chip=document.querySelector('.chips[data-group="my_subj"] .chip[data-v="vlastni"]'),input=$("my_customSubject"),wrap=$("my_customSubjectWrap");
      assertTest(!!chip&&!!input&&!!wrap&&input.maxLength===60,"chybí volba nebo limit vlastního předmětu");
      setChip("my_subj","vlastni");updateCustomSubjectUi();input.value="Konzultace ve čtvrtek";input.dispatchEvent(new Event("input",{bubbles:true}));
      assertTest(!wrap.hidden&&!input.disabled,"pole vlastního předmětu se nezobrazilo");
      const output=applyCustomSubjectToOutput("Předmět: Návrh modelu\n\nDobrý den,\n\nděkuji.\n\n[podpis]",input.value,"Předmět");
      const parsed=splitSubject(output);
      assertTest(parsed.subject==="Konzultace ve čtvrtek"&&!output.includes("Návrh modelu")&&parsed.body.includes("děkuji"),"vlastní předmět nebyl lokálně použit přesně");
    });
    await test("Překreslení dlouhého e-mailu je v rozumném čase", async()=>{
      E("in","raw").value="Dobrý den, potvrzuji termín odevzdání. ".repeat(600); const t0=performance.now(); doAnon("in"); const ms=performance.now()-t0;
      assertTest(ms<2500,"anonymizace 22 tisíc znaků trvala "+Math.round(ms)+" ms");
    });
  } finally {
    restoreTestState(snap); window.__setTestRunActive(false); document.body.classList.remove("ks-tests-running");
    const markerOk=(()=>{try{return localStorage.getItem(markerKey)===markerValue;}catch(_){return false;}})();
    results.push({name:"Testy neztratí lokální data",ok:markerOk,msg:markerOk?"":"značkovací hodnota se neobnovila",ms:0});
    try{if(oldMarker===null)localStorage.removeItem(markerKey);else localStorage.setItem(markerKey,oldMarker);}catch(_){}
  }
  const pass=results.filter(r=>r.ok).length, fail=results.length-pass;
  if(out){ out.innerHTML='<div class="res-card"><h3>Výsledek</h3><p class="summary">'+pass+'/'+results.length+' testů prošlo'+(fail?' · '+fail+' selhalo':'')+'</p></div>'+results.map(r=>'<div class="test-result '+(r.ok?'ok':'fail')+'"><b>'+(r.ok?'✓ ':'✗ ')+esc(r.name)+'</b><small>'+r.ms+' ms'+(r.msg?' · '+esc(r.msg):'')+'</small></div>').join(""); }
  window.__LAST_KORESP_TEST_RESULTS__=results;
  if(progress)progress.hidden=true;
  if(runBtn){runBtn.disabled=false;runBtn.removeAttribute("aria-busy");runBtn.textContent=runBtn.dataset.prevText||"Spustit testy";delete runBtn.dataset.prevText;}
  korespTestsRunning=false;
  console.table(results);
  return results;
}
window.runKorespTests=runKorespTests;


/* ===================== SPRÁVA LOKÁLNÍCH DAT ===================== */

const UI_MODE_SK="rozbor_ui_mode";
const APP_STORAGE_KEY_RE=/^(?:rozbor_|ks5_|ghrab\.correspondence\.)|^ghrab\.(?:handoff\.v1|pilot\.events\.v2)$/;
function storageKeyList(store){
  const keys=[];
  try{
    for(let i=0;i<Number(store&&store.length||0);i+=1){
      const key=store.key(i); if(key!==null&&key!==undefined&&!keys.includes(String(key)))keys.push(String(key));
    }
  }catch(_){}
  // Fallback pro testovací nebo spravované implementace Storage.
  try{Object.keys(store||{}).forEach(key=>{if(!keys.includes(key))keys.push(key);});}catch(_){}
  return keys;
}
function isOwnedAppStorageKey(key){return APP_STORAGE_KEY_RE.test(String(key||""));}
function appStorageKeys(store){return storageKeyList(store).filter(isOwnedAppStorageKey);}
function setUiMode(mode){
  mode = (mode === "advanced") ? "advanced" : "simple";
  document.body.classList.toggle("ui-simple", mode === "simple");
  document.body.classList.toggle("ui-advanced", mode === "advanced");
  const simple=$("uiSimple"), advanced=$("uiAdvanced");
  if(simple){ simple.classList.toggle("on", mode === "simple"); simple.setAttribute("aria-pressed",mode==="simple"?"true":"false"); }
  if(advanced){ advanced.classList.toggle("on", mode === "advanced"); advanced.setAttribute("aria-pressed",mode==="advanced"?"true":"false"); }
  const guide=$("safetyGuideInline"); if(guide) guide.open=mode==="advanced";
  try{ localStorage.setItem(UI_MODE_SK, mode); }catch(_){}
  renderChoiceSummary("in");
  renderChoiceSummary("my");
}
function initUiMode(){
  let mode="simple";
  try{ mode=localStorage.getItem(UI_MODE_SK)||"simple"; }catch(_){}
  document.querySelectorAll(".ui-mode-btn[data-ui-mode]").forEach(btn=>{
    btn.addEventListener("click", ()=>setUiMode(btn.dataset.uiMode));
  });
  setUiMode(mode);
}

function clearAllLocalData(){
  // Maž legacy i kanonické klíče. Po migraci GHRAB Platform jsou fyzicky uložené
  // pod ghrab.correspondence.*, i když aplikace dál používá kompatibilní aliasy.
  [localStorage,sessionStorage].forEach(store=>{
    appStorageKeys(store).forEach(k=>{ try{ store.removeItem(k); }catch(_){} });
  });
  geminiApiKey=""; geminiKeyScope=""; geminiModel=MODEL_DEFAULT;
  try{ $("keyInput").value=""; $("modelInput").value=MODEL_DEFAULT; }catch(_){}
  updateKeyStatus(); updateModelUI(); renderTemplates();
  try{renderMyProfileContext();renderWritingStyleControls();}catch(_){}
  toast("Lokální data smazána ✓");
}
function collectSettings(){
  return {
    _app:"korespondencni-asistent", _verze:RELEASE.version, _exportovano:new Date().toISOString(),
    profil: loadProfile(),
    slovnikJmen: loadDict(),
    sablony: loadTpls(),
    model: geminiModel,
    rezimUI: (function(){ try{ return localStorage.getItem(UI_MODE_SK)||"simple"; }catch(_){ return "simple"; } })(),
    neukladatHistorii: isNoHistory()
    // ZÁMĚRNĚ neexportujeme API klíč ani historii e-mailů (citlivé)
  };
}
async function exportSettings(){
  try{
    const payload=collectSettings();
    if(window.GHRABArtifact?.download){
      await window.GHRABArtifact.download({appId:"correspondence",appVersion:RELEASE.version,artifactType:"correspondence-settings",sensitivity:"restricted",contentManifest:[{kind:"settings",schema:"korespondencni-asistent-settings-v1"}],payload,filename:"korespondencni-asistent-nastaveni.ghrab.json"});
    }else{
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);a.download="korespondencni-asistent-nastaveni.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    }
    toast("Nastavení exportováno ✓");
  }catch(e){ toast("Export se nepovedl."); }
}
function applyImportedSettings(obj){
  if(!obj || typeof obj!=="object") throw new Error("neplatný soubor");
  if(obj._app && obj._app!=="korespondencni-asistent") throw new Error("soubor není nastavení Korespondenčního asistenta");
  if(obj.profil && typeof obj.profil==="object"){ try{ localStorage.setItem("rozbor_profile", JSON.stringify(typeof sanitizeProfile==="function"?sanitizeProfile(obj.profil):{})); }catch(_){} }
  if(Array.isArray(obj.slovnikJmen)){ try{ localStorage.setItem("rozbor_dict", JSON.stringify(obj.slovnikJmen)); }catch(_){} }
  if(Array.isArray(obj.sablony)){ try{ localStorage.setItem("rozbor_templates", JSON.stringify(obj.sablony)); }catch(_){} }
  if(obj.model && isValidModel(obj.model)){ try{ setModel(obj.model); }catch(_){} }
  if(obj.rezimUI){ try{ setUiMode(obj.rezimUI); }catch(_){} }
  try{ setNoHistory(!!obj.neukladatHistorii); }catch(_){}
  try{ renderTemplates(); }catch(_){}
  try{ if(typeof renderMyProfileContext==="function")renderMyProfileContext(); }catch(_){}
  try{ if(typeof renderWritingStyleControls==="function")renderWritingStyleControls(); }catch(_){}
}
function importSettings(file){
  if(!file) return;
  const r=new FileReader();
  r.onload=async()=>{ try{
    const raw=String(r.result||"{}");
    const parsed=window.GHRABArtifact?.unwrapMaybe?await window.GHRABArtifact.unwrapMaybe(raw,{allowLegacy:true,expectedAppId:"correspondence",verifyChecksum:true}):{payload:JSON.parse(raw)};
    const obj=parsed.payload;
    const apply=()=>{try{applyImportedSettings(obj);toast("Nastavení importováno ✓");}catch(e){toast("Import se nepovedl: "+(e.message||"neplatný soubor"));}};
    if(!obj._app && (obj.profil||obj.slovnikJmen)){
      const parts=[]; if(obj.profil)parts.push("profil odesílatele"); if(obj.slovnikJmen)parts.push("slovník skutečných jmen");
      confirmActionModal({title:"Starší soubor nastavení",message:"Soubor nemá identifikaci aplikace. Pokračováním se přepíše "+parts.join(" a ")+". Importovat?",confirmText:"Importovat",onConfirm:apply});
    }else apply();
  }catch(e){toast("Import se nepovedl: "+(e.message||"neplatný soubor"));} };
  r.onerror=()=>toast("Soubor se nepovedlo načíst.");
  r.readAsText(file,"utf-8");
}
function openDataManager(){
  const noHist=isNoHistory();
  const html='<p class="hint">Všechno níže zůstává jen v tomto prohlížeči. Na sdíleném školním počítači je bezpečnější po práci data smazat.</p>'+
    '<label class="data-switch"><input type="checkbox" id="dmNoHistory" '+(noHist?'checked':'')+'><span><b>Neukládat historii výstupů</b><br><span class="hint">Bezpečná výchozí volba. Po vypnutí se může uložit jen anonymizovaná verze se značkami, nikdy text se skutečnými jmény.</span></span></label>'+
    '<div class="data-switch"><span>↔</span><span><b>Přenos mezi zařízeními</b><br><span class="hint">Exportuje profil, slovník jmen, šablony, model a nastavení do souboru. <b>Soubor může obsahovat skutečná jména ze slovníku; chraň ho jako citlivý. API klíč ani historii e-mailů neobsahuje.</b></span></span></div>'+
    '<div class="row"><button class="btn ghost small" id="dmExport">Exportovat nastavení</button><button class="btn ghost small" id="dmImport">Importovat ze souboru</button><input type="file" id="dmImportFile" accept="application/json,.json" style="display:none"></div>'+
    '<div class="data-switch data-danger"><span>⚠️</span><span><b>Smazat všechna lokální data</b><br>API klíč, historii, profil, slovník jmen, šablony, model, debug prompt, technický log, nastavení bezpečnostního průvodce a také uložené koncepty, vlastní textové bloky, podpisy a připomínky z pracovního stolu.</span></div>'+
    '<div class="row"><button class="btn ghost" id="dmSave">Uložit nastavení</button><button class="btn danger" id="dmClear"><span class="action-icon" data-ic="warn"></span>Smazat všechna lokální data</button></div>';
  const m=openModal("Správa lokálních dat", html, {label:"Správa lokálních dat"});
  m.body.querySelector("#dmSave").onclick=()=>{ setNoHistory(m.body.querySelector("#dmNoHistory").checked); m.close(); toast("Nastavení uloženo ✓"); };
  m.body.querySelector("#dmExport").onclick=exportSettings;
  const fileInp=m.body.querySelector("#dmImportFile");
  m.body.querySelector("#dmImport").onclick=()=>fileInp.click();
  fileInp.onchange=()=>{ if(fileInp.files&&fileInp.files[0]){ importSettings(fileInp.files[0]); fileInp.value=""; } };
  m.body.querySelector("#dmClear").onclick=()=>{ confirmActionModal({title:"Smazat všechna lokální data",message:"Opravdu smazat API klíč, anonymizovanou historii, profil, slovník jmen, šablony, model, debug data a technický log z tohoto prohlížeče? Tuto akci nelze vrátit.",confirmText:"Smazat data",danger:true,onConfirm(){clearAllLocalData();m.close();}}); };
}


function openAiRuntimeDiagnostics(){
  const config=GHRABRuntime.getConfig(),usage=GHRAB_AI.getLastUsage();
  const safe={schema:config.schema,app:config.app,ai:{mode:config.ai.mode,gatewayUrl:config.ai.gatewayUrl,healthUrl:config.ai.healthUrl,allowDirectMode:config.ai.allowDirectMode,allowDirectFallback:config.ai.allowDirectFallback,defaultModelProfile:config.ai.defaultModelProfile,requestTimeoutMs:config.ai.requestTimeoutMs,directGemini:config.ai.directGemini},transports:GHRAB_AI.getState().transports,lastUsage:usage||null};
  return openModal("Diagnostika AI připojení",'<p class="hint">Zobrazuje pouze veřejnou konfiguraci a provozní metadata. API klíče, prompty ani odpovědi se zde nevypisují.</p><pre class="mono" style="white-space:pre-wrap;max-height:420px;overflow:auto">'+esc(JSON.stringify(safe,null,2))+'</pre>',{label:"Diagnostika AI připojení"});
}
function openOpsLog(){
  const rows=loadOpsLog();
  const list=rows.length?rows.map(r=>{
    const when=new Date(r.d||Date.now()).toLocaleString("cs-CZ");
    return '<div class="ops-row"><b>'+esc(r.type||"akce")+' · '+esc(r.status||"ok")+'</b><div class="ops-meta">'+esc(when)+' · model: '+esc(r.model||"—")+'</div><pre>'+esc(JSON.stringify(r.meta||{},null,2))+'</pre></div>';
  }).join(""):'<p class="empty">Technický log je prázdný.</p>';
  const html='<p class="hint">Log ukládá pouze technické stavy aplikace: čas, typ akce, model, výsledek, kód chyby nebo timeout. <b>Neukládá texty e-mailů, prompty ani hotové odpovědi.</b></p><div class="ops-log">'+list+'</div><div class="row"><button class="btn ghost small" id="opsClear">Smazat technický log</button></div>';
  const m=openModal("Technický provozní log", html, {label:"Technický provozní log"});
  const clr=m.body.querySelector("#opsClear"); if(clr) clr.onclick=()=>{ clearOpsLog(); m.close(); toast("Technický log smazán"); };
  return m;
}
function openDeveloperTools(){
  const html='<p class="hint">Tyto nástroje jsou určené pro správu a ladění aplikace. Běžný učitel je při práci s e-mailem nepotřebuje.</p>'+
    '<div class="dev-tools-grid">'+
    '<button class="dev-tool-card" id="devTests"><b>Automatické testy</b><span>Lokální smoke testy bez volání API.</span></button>'+
    '<button class="dev-tool-card" id="devDebug"><b>Debug prompt</b><span>Poslední anonymizovaný prompt, pokud není vypnutý citlivým režimem.</span></button>'+
    '<button class="dev-tool-card" id="devOps"><b>Technický log</b><span>Stavy, chyby a timeouty bez textů e-mailů.</span></button>'+    '<button class="dev-tool-card" id="devAiRuntime"><b>AI runtime</b><span>Aktivní transport, kontrakt, adaptéry a poslední usage metadata.</span></button>'+
    '</div>';
  const m=openModal("Vývojářské nástroje", html, {label:"Vývojářské nástroje"});
  m.body.querySelector("#devTests").onclick=()=>{ m.close(); openTestRunner(false); };
  m.body.querySelector("#devDebug").onclick=()=>{ m.close(); openLastPromptDebug(); };
  m.body.querySelector("#devOps").onclick=()=>{ m.close(); openOpsLog(); };
  m.body.querySelector("#devAiRuntime").onclick=()=>{ m.close(); openAiRuntimeDiagnostics(); };
  return m;
}
function makeParamFold(title, nodes, openByDefault, tip){
  const usable=nodes.filter(Boolean);
  if(!usable.length) return null;
  const d=document.createElement("details"); d.className="param-fold simple-hide"; if(openByDefault) d.open=true;
  const sum=document.createElement("summary"); sum.textContent=title;
  if(tip){ const b=document.createElement("button"); b.type="button"; b.className="help-tip"; b.setAttribute("aria-label","Nápověda k "+title); b.dataset.tip=tip; b.textContent="i"; b.onclick=e=>e.preventDefault(); sum.append(" ",b); }
  d.appendChild(sum);
  const body=document.createElement("div"); body.className="param-fold-body"; d.appendChild(body);
  usable.forEach(n=>body.appendChild(n));
  return d;
}
function compactAdvancedParams(){
  const card=document.querySelector("#pane-my .params");
  if(!card || card.dataset.compactParams==="1") return;
  const grp=(data)=>{ const ch=card.querySelector('.chips[data-group="'+data+'"]'); return ch ? ch.closest(".pgroup") : null; };
  const byId=(id)=>$(id);
  const tpl=byId("my_tplGroup");
  const before=card.querySelector(".simple-action-note") || card.querySelector(".choice-summary") || card.querySelector(".row.actsticky");
  const audienceFold=makeParamFold("Komu píšu", [grp("my_adresat"), byId("my_scopeGroup"), byId("my_senderGroup"), grp("my_oslov")], true);
  const scenarioFold=makeParamFold("Volitelný školní scénář", [byId("my_scenarioGroup")], false, "Scénář není nový režim ani pevná šablona. Pouze přednastaví typ práce, adresáta, počet adresátů, oslovení, účel, tón, délku a někdy bezpečnostní režim. Změny se zobrazí i v jednoduchém režimu.");
  const actionFold=makeParamFold("Podrobnosti zvolené práce", [byId("my_fixGroup"), byId("my_styleGroup"), byId("my_ucelGroup"), grp("my_lang")], false);
  const resultFold=makeParamFold("Podoba výsledku", [byId("my_toneGroup"), byId("my_lenGroup"), byId("my_writingStyleGroup"), byId("my_subjGroup")], false);
  if(audienceFold) audienceFold.id="my_audienceFold";
  if(scenarioFold) scenarioFold.id="my_scenarioFold";
  if(actionFold) actionFold.id="my_actionFold";
  if(resultFold) resultFold.id="my_resultFold";
  const folds=[audienceFold,scenarioFold,actionFold,resultFold].filter(Boolean);
  folds.forEach(f=>card.insertBefore(f,before));
  if(tpl) card.insertBefore(tpl, folds[0] || before);
  card.dataset.compactParams="1";
  if(typeof initAccessibleTooltips==="function") initAccessibleTooltips(card);
  if(typeof updateMyMode==="function") updateMyMode();
}




function initAccessibleTooltips(root=document){
  root.querySelectorAll('.help-tip[data-tip]').forEach((btn,i)=>{
    if(btn.dataset.a11yTip)return; btn.dataset.a11yTip="1";
    const span=document.createElement("span"); span.className="sr-only"; span.id="helpTipText"+(i+1)+"_"+Math.random().toString(36).slice(2,7); span.textContent=btn.dataset.tip;
    btn.after(span); btn.setAttribute("aria-describedby",span.id);
  });
}
