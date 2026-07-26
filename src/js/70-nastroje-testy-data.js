/* ===================== NÁSTROJE + CHANGELOG ===================== */
const toolsActions=[];
function footBtn(label, icon, title, fn){ toolsActions.push({label,icon,title,fn}); }
function buildFooterTools(){
  const foot=document.querySelector(".foot"); if(!foot) return;
  foot.innerHTML="";

  const panel=document.createElement("div"); panel.className="footer-tools-panel";
  const meta=document.createElement("span"); meta.className="app-meta";
  const buildTag=(RELEASE.build&&RELEASE.build!=="__BUILD__")?(' · build '+esc(RELEASE.build)):'';
  meta.innerHTML='Korespondenční asistent · v'+esc(RELEASE.version)+buildTag+' <span class="desktop-foot-extra">· dvojklik na slovo = synonyma</span>';

  const row=document.createElement("div"); row.className="footer-tools-row";
  const title=document.createElement("span"); title.className="footer-tools-title"; title.textContent="Nástroje a nápověda";
  const wrap=document.createElement("span"); wrap.className="tools-wrap";
  const btn=document.createElement("button"); btn.className="tools-btn"; btn.type="button"; btn.textContent="Otevřít nástroje ▴"; btn.title="Profil, historie, změny, bezpečný začátek a testy"; btn.setAttribute("aria-expanded","false");
  const menu=document.createElement("div"); menu.className="tools-menu"; menu.setAttribute("role","menu");
  toolsActions.forEach(a=>{ const b=document.createElement("button"); b.type="button"; b.title=a.title||a.label; b.innerHTML='<span class="action-icon">'+esc(a.icon||"•")+'</span><span>'+esc(a.label)+'</span>'; b.onclick=()=>{ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); a.fn&&a.fn(); }; menu.appendChild(b); });
  btn.onclick=(e)=>{ e.stopPropagation(); const open=!menu.classList.contains("open"); menu.classList.toggle("open",open); btn.setAttribute("aria-expanded",open?"true":"false"); };
  document.addEventListener("click",(e)=>{ if(!wrap.contains(e.target)){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ menu.classList.remove("open"); btn.setAttribute("aria-expanded","false"); } });
  wrap.appendChild(btn); wrap.appendChild(menu);
  row.appendChild(title); row.appendChild(wrap);

  const hint=document.createElement("span"); hint.className="tools-hint"; hint.textContent="Profil, historie, změny, správa dat a testy jsou dostupné v samostatném pracovním bloku.";
  panel.appendChild(meta); panel.appendChild(row); panel.appendChild(hint);
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
  const grab=(store,bucket)=>{ try{Object.keys(store).filter(k=>/^(rozbor_|ks5_)/.test(k)).forEach(k=>{bucket[k]=store.getItem(k);});}catch(_){} };
  grab(localStorage,snap.local); grab(sessionStorage,snap.session); return snap;
}
function restoreAppStorage(snap){
  const put=(store,bucket)=>{ try{Object.keys(store).filter(k=>/^(rozbor_|ks5_)/.test(k)).forEach(k=>{try{store.removeItem(k);}catch(_){}});}catch(_){} try{Object.keys(bucket||{}).forEach(k=>{try{store.setItem(k,bucket[k]);}catch(_){}});}catch(_){} };
  put(localStorage,snap&&snap.local); put(sessionStorage,snap&&snap.session);
}
function snapshotTestState(){ return {storage:snapshotAppStorage(),st:JSON.parse(JSON.stringify(ST)),inRaw:E("in","raw").value,myRaw:E("my","raw").value,key:geminiApiKey,scope:geminiKeyScope,model:geminiModel,mock:window.__TEST_MOCK_GEMINI}; }
function restoreTestState(snap){
  restoreAppStorage(snap.storage);
  ST.in=snap.st.in; ST.my=snap.st.my; E("in","raw").value=snap.inRaw; E("my","raw").value=snap.myRaw; geminiApiKey=snap.key; geminiKeyScope=snap.scope; geminiModel=snap.model; window.__TEST_MOCK_GEMINI=snap.mock;
  publishActiveKeyReals("in"); publishActiveKeyReals("my");
  try{renderView("in");renderView("my");renderKeyTable("in");renderKeyTable("my");renderPreview("in");renderPreview("my");renderTemplates();refreshDeskStatus();updateKeyStatus();updateModelUI();}catch(_){}
}
async function runKorespTests(){
  const out=$("testOut"); if(out) out.innerHTML='<div class="loading"><span class="spin"></span>Spouštím testy…</div>';
  const markerKey="rozbor_test_marker",markerValue="test-"+Date.now();
  let oldMarker=null; try{oldMarker=localStorage.getItem(markerKey);localStorage.setItem(markerKey,markerValue);}catch(_){}
  const snap=snapshotTestState(); const results=[];
  window.__setTestRunActive(true);
  const test=async(name, fn)=>{ const t0=performance.now(); try{ await fn(); results.push({name,ok:true,ms:Math.round(performance.now()-t0)}); }catch(e){ results.push({name,ok:false,msg:e.message||String(e),ms:Math.round(performance.now()-t0)}); } };
  try{
    await test("Unit anonymizace telefonu/e-mailu", async()=>{
      E("in","raw").value="Kontakt: jana@example.cz, tel. +420 777-123-456 a také 777 123 456."; doAnon("in");
      assertTest(ST.in.clean.includes("[e-mail 1]"),"e-mail nebyl nahrazen");
      assertTest(ST.in.clean.includes("[telefon 1]"),"telefon nebyl nahrazen");
      assertTest(!/777[\s.-]*123[\s.-]*456/.test(stripSafeTokens(ST.in.clean)),"v textu zůstal telefon");
      assertTest(!/jana@example\.cz/.test(ST.in.clean),"v textu zůstal e-mail");
    });
    await test("Unit rekompozice značek", async()=>{
      ST.in.km=[{real:"Anna Nováková",token:"osoba A"},{real:"jana@example.cz",token:"[e-mail 1]"},{real:"777 123 456",token:"[telefon 1]"}];
      const r=recompose("in","Dobrý den, osoba A, kontakt [e-mail 1], [telefon 1].");
      assertTest(r.includes("Anna Nováková"),"osoba se nevrátila");
      assertTest(r.includes("jana@example.cz"),"e-mail se nevrátil");
      assertTest(r.includes("777 123 456"),"telefon se nevrátil");
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
    await test("České pády celého jména", async()=>{
      ST.in.raw="Anna Nováková psala. Anně Novákové odpovím. Annu Novákovou pozvu."; ST.in.km=[{real:"Anna Nováková",token:"osoba A",auto:false}]; publishActiveKeyReals("in");
      const c=cleanFromKey("in");
      assertTest((c.match(/osoba A/g)||[]).length===3,"nebyly skryty všechny tvary: "+c);
      assertTest(!/Novákov/.test(c),"zůstal tvar příjmení: "+c);
    });
    await test("Jedna osoba = jedna značka", async()=>{
      ST.in.raw="Petr Malý chybí. Petrovi jsem psal. S Petrem mluvím."; ST.in.km=[];
      addWord("in","Petr"); addWord("in","Petrovi"); addWord("in","Petrem");
      assertTest(ST.in.km.length===3,"doťukané tvary nebyly přidány samostatně do klíče");
      assertTest(new Set(ST.in.km.map(k=>k.token)).size===1&&ST.in.km[0].token==="osoba A","tvary jedné osoby dostaly různé značky");
      assertTest(!/Petr(?:ovi|em)?/.test(ST.in.clean),"v anonymizovaném textu zůstal tvar Petra: "+ST.in.clean);
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
    await test("Školní scénáře používají existující hodnoty", async()=>{
      Object.entries(SCHOOL_SCENARIOS).forEach(([key,sc])=>{
        if(!sc.vals)return;
        Object.entries(sc.vals).forEach(([g,v])=>{
          const grp=document.querySelector('.chips[data-group="'+g+'"]');
          assertTest(grp&&grp.querySelector('.chip[data-v="'+v+'"]'),"scénář "+key+" → "+g+" nezná "+v);
        });
      });
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
      window.__TEST_MOCK_GEMINI=async({schema,thinking})=>{assertTest(schema==="tone"&&thinking==="minimal","kontrola tónu nepoužila levné uvažování");return {naladeni:{stupen:"neutral",popis:"věcné"},rizika:["Příliš stručné"],navrh:"Doplnit poděkování"};};
      ST.in.km=[]; publishActiveKeyReals("in");
      const wrap=document.createElement("div"),btn=document.createElement("button");
      await toneCheck("in","Děkuji za zprávu.",wrap,btn);
      assertTest(!!wrap.querySelector(".tonecard")&&wrap.textContent.includes("Příliš stručné"),"karta kontroly tónu se nevykreslila");
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
      try{ await callGemini("x","{}","object"); }catch(e){ ok=e.code==="MISSING_KEY"; }
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
    await test("Oranžové upozornění neblokuje generování", async()=>{
      ST.in.clean="Projekt pokračuje podle plánu.";
      E("in","reviewOk").checked=true;
      updateSendGate("in");
      assertTest(safetyAudit(ST.in.clean).level==="warn","testovací text nevyvolal oranžové upozornění");
      assertTest(!$("in_analyzeBtn").disabled,"oranžové upozornění zablokovalo generování");
    });
    await test("Doplňující pokyny se anonymizují a hlídají", async()=>{
      ST.in.km=[{real:"Anna",token:"osoba A",auto:false}]; ST.in.clean="Bezpečný text.";
      assertTest(safeAuxiliaryText("in","pracoval jsem s Annou",null,"Poznámka").includes("osoba A"),"známé jméno v poznámce nebylo anonymizováno");
      assertTest(safeAuxiliaryText("in","pracoval jsem s Klárou",null,"Poznámka")!==null,"oranžová heuristika v poznámce nesmí blokovat odeslání");
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
      assertTest($("in_safety").textContent.includes("Pokračuj") || $("in_safety").textContent.includes("Zkontroluj") || $("in_safety").textContent.includes("Neodesílat"),"semafor nezobrazuje akční text");
      await $("in_analyzeBtn").onclick();
      await waitFor(()=>$("in_results").textContent.includes("Rodič žádá"));
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
      assertTest(E("my","step2").style.display==="none","stará anonymizační část zůstala otevřená");
    });
    await test("Mobilní zobrazení a jednoduchý průvodce", async()=>{
      const css=[...document.querySelectorAll("style")].map(x=>x.textContent).join("\n");
      assertTest(css.includes("@media (max-width:640px)"),"chybí mobilní media query");
      assertTest(css.includes(".actsticky"),"chybí sticky mobilní akce");
      assertTest(!!document.querySelector(".tools-btn"),"chybí menu Nástroje");
      assertTest(!!document.querySelector(".footer-tools-panel") && !!document.querySelector(".legal-divider") && !!document.querySelector(".owner-lines"),"patička není rozdělena na funkční a právní část");
      setUiMode("simple");
      const flow=document.querySelector("#safetyGuideInline");
      assertTest(!!flow,"chybí jednotný bezpečný průvodce");
      assertTest(flow.textContent.includes("Vlož text") && flow.textContent.includes("Anonymizuj") && flow.textContent.includes("Ověř náhled") && flow.textContent.includes("Vytvoř výstup"),"průvodce neobsahuje úplný čtyřkrokový tok");
      const modeExplain=document.querySelector("#uiModeExplain");
      assertTest(!!modeExplain && modeExplain.textContent.includes("Jednoduchý") && modeExplain.textContent.includes("Pokročilý") && modeExplain.textContent.includes("tón"),"chybí vysvětlení jednoduchého a pokročilého režimu");
      assertTest(getComputedStyle(flow).display!=="none","bezpečný průvodce se v jednoduchém režimu nesmí skrýt");
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
    await test("Škodlivý/importovaný vstup a escapování", async()=>{
      E("in","raw").value='Dobrý den, <scr'+'ipt>alert(1)</scr'+'ipt> píše VelmiDlouhéJménoSloženéNováková-Králová 😀, tel. +420 777/123/456, třídy 1.A a 2.B, nar. 1. 2. 2010, OSPOD PPP. Podpis: Mgr. Testovací <b>učitel</b>.';
      doAnon("in");
      assertTest(!$('in_preview').querySelector('script'),"script tag se propsal do náhledu jako prvek");
      const iss=preflightIssues(ST.in.clean+" 1.A 2.B nar. 1. 2. 2010 OSPOD PPP +420 777/123/456");
      assertTest(iss.danger.some(x=>/telefon/.test(x)),"netypický telefon nebyl zachycen");
      assertTest(iss.warn.some(x=>/třída/.test(x)),"více tříd nebylo zachyceno jako upozornění");
      assertTest(iss.danger.some(x=>/citlivé/.test(x)),"citlivý importovaný obsah nebyl zachycen");
      applyImportedSettings({profil:{name:'Učitel "autofocus" <img src=x onerror=alert(1)>',role:'<b>role</b>',school:'Gymnázium & test'},slovnikJmen:[{real:'Žák <scr'+'ipt>',token:'osoba ZZ'}],sablony:[{name:'<b>šablona</b>',text:'text'}],neukladatHistorii:true});
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
      assertTest(!labels.includes("Debug prompt") && !labels.includes("Spustit testy") && labels.includes("Vývojářské nástroje"),"debug/testy nejsou oddělené do Vývojářských nástrojů");
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
      const zbytek=Object.keys(localStorage).filter(k=>/^(rozbor_|ks5_)/.test(k));
      assertTest(!zbytek.length,"po smazání zůstaly klíče: "+zbytek.join(", "));
    });
  } finally {
    restoreTestState(snap); window.__setTestRunActive(false);
    const markerOk=(()=>{try{return localStorage.getItem(markerKey)===markerValue;}catch(_){return false;}})();
    results.push({name:"Testy neztratí lokální data",ok:markerOk,msg:markerOk?"":"značkovací hodnota se neobnovila",ms:0});
    try{if(oldMarker===null)localStorage.removeItem(markerKey);else localStorage.setItem(markerKey,oldMarker);}catch(_){}
  }
  const pass=results.filter(r=>r.ok).length, fail=results.length-pass;
  if(out){ out.innerHTML='<div class="res-card"><h3>Výsledek</h3><p class="summary">'+pass+'/'+results.length+' testů prošlo'+(fail?' · '+fail+' selhalo':'')+'</p></div>'+results.map(r=>'<div class="test-result '+(r.ok?'ok':'fail')+'"><b>'+(r.ok?'✓ ':'✗ ')+esc(r.name)+'</b><small>'+r.ms+' ms'+(r.msg?' · '+esc(r.msg):'')+'</small></div>').join(""); }
  console.table(results);
  return results;
}
window.runKorespTests=runKorespTests;


/* ===================== SPRÁVA LOKÁLNÍCH DAT ===================== */

const UI_MODE_SK="rozbor_ui_mode";
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
  // Maž podle jmenného prostoru aplikace, ne podle ručního výčtu, který nové funkce snadno minou.
  const prefixes=/^(rozbor_|ks5_)/;
  [localStorage,sessionStorage].forEach(store=>{
    try{ Object.keys(store).filter(k=>prefixes.test(k)).forEach(k=>{ try{ store.removeItem(k); }catch(_){} }); }catch(_){}
  });
  geminiApiKey=""; geminiKeyScope=""; geminiModel=MODEL_DEFAULT;
  try{ $("keyInput").value=""; $("modelInput").value=MODEL_DEFAULT; }catch(_){}
  updateKeyStatus(); updateModelUI(); renderTemplates(); toast("Lokální data smazána ✓");
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
function exportSettings(){
  try{
    const blob=new Blob([JSON.stringify(collectSettings(),null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="korespondencni-asistent-nastaveni.json"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500); toast("Nastavení exportováno ✓");
  }catch(e){ toast("Export se nepovedl."); }
}
function applyImportedSettings(obj){
  if(!obj || typeof obj!=="object") throw new Error("neplatný soubor");
  if(obj._app && obj._app!=="korespondencni-asistent") throw new Error("soubor není nastavení Korespondenčního asistenta");
  if(obj.profil && typeof obj.profil==="object"){ try{ localStorage.setItem("rozbor_profile", JSON.stringify(obj.profil)); }catch(_){} }
  if(Array.isArray(obj.slovnikJmen)){ try{ localStorage.setItem("rozbor_dict", JSON.stringify(obj.slovnikJmen)); }catch(_){} }
  if(Array.isArray(obj.sablony)){ try{ localStorage.setItem("rozbor_templates", JSON.stringify(obj.sablony)); }catch(_){} }
  if(obj.model && isValidModel(obj.model)){ try{ setModel(obj.model); }catch(_){} }
  if(obj.rezimUI){ try{ setUiMode(obj.rezimUI); }catch(_){} }
  try{ setNoHistory(!!obj.neukladatHistorii); }catch(_){}
  try{ renderTemplates(); }catch(_){}
}
function importSettings(file){
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{ try{
    const obj=JSON.parse(String(r.result||"{}"));
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
    '<button class="dev-tool-card" id="devOps"><b>Technický log</b><span>Stavy, chyby a timeouty bez textů e-mailů.</span></button>'+ 
    '</div>';
  const m=openModal("Vývojářské nástroje", html, {label:"Vývojářské nástroje"});
  m.body.querySelector("#devTests").onclick=()=>{ m.close(); openTestRunner(true); };
  m.body.querySelector("#devDebug").onclick=()=>{ m.close(); openLastPromptDebug(); };
  m.body.querySelector("#devOps").onclick=()=>{ m.close(); openOpsLog(); };
  return m;
}
function openSchoolGuide(){
  const html='<div class="school-guide-onepage">'+
    '<p class="guide-lead"><b>Bez anonymizace neposílej studentské údaje.</b> Aplikace pomáhá připravit zdvořilý školní e-mail, ale odpovědnost za obsah a ochranu údajů zůstává na učiteli.</p>'+ 
    '<div class="guide-section"><h3>Co aplikace dělá</h3><p>Pomůže shrnout přijatý e-mail, připravit odpověď nebo přeformulovat vlastní text. Před odesláním vždy čti hotový návrh.</p></div>'+ 
    '<div class="guide-section"><h3>Co neposílat</h3><p>Nevkládej skutečná jména žáků, kontakty, adresy, rodná čísla, data narození, zdravotní údaje, PPP/IVP, OSPOD, rodinné poměry ani podrobnosti kázeňských případů. <strong>Podmínky práce s daty se liší podle regionu a fakturace.</strong> Mimo EHP, Švýcarsko a Spojené království může Google u neplacené služby odeslaný obsah a odpovědi použít ke zlepšování produktů a mohou je kontrolovat lidští hodnotitelé. V uvedených evropských regionech platí podle aktuálních podmínek pravidla placených služeb i pro neplacenou kvótu a veřejně zpřístupněná aplikace má používat projekt s aktivní fakturací. Vždy posílej výhradně ručně zkontrolovaný anonymizovaný náhled.</p></div>'+ 
    '<div class="guide-section"><h3>3 zakázané příklady</h3>'+
      '<div class="school-guide-examples">'+
        '<div class="school-guide-example bad"><b>Neposílat do AI</b><p>„Jan Novák má PPP a problém v 1.A.“</p></div>'+
        '<div class="school-guide-example safe"><b>Bezpečně zobecnit</b><p>„Žák má citlivou školní situaci. Potřebuji připravit neutrální a věcnou odpověď rodiči bez osobních údajů.“</p></div>'+
        '<div class="school-guide-example offline"><b>Raději mimo AI</b><p>Zdravotní údaje, OSPOD, rodinné poměry, sebepoškozování a závažné kázeňské detaily řeš podle školních pravidel bez vkládání do modelu.</p></div>'+
      '</div>'+
    '</div>'+
    '<div class="guide-section"><h3>Jak anonymizovat</h3><p>Po vložení textu klikni na anonymizaci, zkontroluj náhled a ručně skryj vše, co může žáka, rodiče nebo kolegu identifikovat.</p></div>'+ 
    '<div class="guide-section"><h3>Sdílený počítač</h3><p>Nepoužívej trvalé uložení API klíče. Po práci otevři Správu dat a smaž lokální data.</p></div>'+ 
    '<div class="guide-section"><h3>Kdy raději bez AI</h3><p>U právně citlivých věcí, konfliktů, zdravotních informací, OSPOD, sebepoškozování nebo závažné kázně piš jen obecně a finální formulaci konzultuj podle školních pravidel.</p></div>'+ 
    '</div>';
  return openModal("Školní návod pro kolegy", html, {label:"Školní návod pro kolegy"});
}


function makeParamFold(title, nodes, openByDefault){
  const usable=nodes.filter(Boolean);
  if(!usable.length) return null;
  const d=document.createElement("details"); d.className="param-fold simple-hide"; if(openByDefault) d.open=true;
  const sum=document.createElement("summary"); sum.textContent=title; d.appendChild(sum);
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
  const folds=[
    makeParamFold("Komu píšu", [grp("my_adresat"), grp("my_oslov"), grp("my_scenario")], true),
    makeParamFold("Co má aplikace udělat", [byId("my_fixGroup"), byId("my_styleGroup"), byId("my_ucelGroup"), grp("my_lang")], false),
    makeParamFold("Jakým tónem a jak dlouze", [byId("my_toneGroup"), byId("my_lenGroup"), byId("my_subjGroup"), card.querySelector("#my_note") ? card.querySelector("#my_note").closest(".pgroup") : null], false)
  ].filter(Boolean);
  folds.forEach(f=>card.insertBefore(f,before));
  if(tpl) card.insertBefore(tpl, folds[0] || before);
  card.dataset.compactParams="1";
}


