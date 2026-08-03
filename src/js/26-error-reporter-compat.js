/* ===================== HLÁŠENÍ CHYBY: APP-SPECIFICKÉ UX ===================== */
// Centrální reportér dodává AI Studio. KS pouze doplňuje workflow, které dovolí
// během aktivního sdílení opustit dialog, pořídit až pět snímků a vrátit se bez
// ztráty rozepsaného hlášení. Bez centrálního reportéru se modul tiše neaktivuje.
const KS_REPORTER_MAX_SCREENSHOTS=5;
function reporterButtonByText(root,pattern){
  return [...root.querySelectorAll("button")].find(btn=>pattern.test(String(btn.textContent||"").trim()))||null;
}
function reporterScreenshotCount(root){
  return root.querySelectorAll(".ghrab-screenshot-card").length;
}
function enhanceGhrabErrorReporter(root){
  if(!root||root.dataset.ksWorkflowEnhanced==="1")return false;
  const backdrop=root.querySelector(".ghrab-report-backdrop");
  const captureSection=root.querySelector(".ghrab-report-section");
  const shareButton=reporterButtonByText(root,/Povolit snímání|Allow screen capture/i);
  const snapButton=reporterButtonByText(root,/^Pořídit snímek$|^Capture screenshot$/i);
  const stopButton=reporterButtonByText(root,/^Ukončit snímání$|^Stop capture$/i);
  const closeButton=root.querySelector(".ghrab-report-header .ghrab-report-button.icon");
  const footerClose=reporterButtonByText(root,/^Zavřít$|^Close$/i);
  const screenshotList=root.querySelector(".ghrab-screenshot-list");
  if(!backdrop||!captureSection||!shareButton||!snapButton||!stopButton||!screenshotList)return false;
  root.dataset.ksWorkflowEnhanced="1";

  const captureActions=captureSection.querySelector(".ghrab-report-actions");
  const leaveButton=document.createElement("button");
  leaveButton.type="button";
  leaveButton.className="ghrab-report-button secondary ghrab-ks-leave-report";
  leaveButton.textContent="Přejít do aplikace";
  leaveButton.disabled=true;
  if(captureActions)captureActions.insertBefore(leaveButton,stopButton);

  const bar=document.createElement("div");
  bar.className="ghrab-ks-capture-bar";
  bar.hidden=true;
  bar.setAttribute("role","region");
  bar.setAttribute("aria-label","Ovládání snímání obrazovky");
  bar.innerHTML='<span class="ghrab-ks-capture-state"><strong>Snímání obrazovky</strong><small data-ks-shot-count>0 / 5 snímků</small></span>'+
    '<button type="button" class="ghrab-report-button primary" data-ks-capture-snap>Pořídit snímek</button>'+
    '<button type="button" class="ghrab-report-button secondary" data-ks-capture-back>Zpět k hlášení</button>'+
    '<button type="button" class="ghrab-report-button ghost" data-ks-capture-stop>Ukončit snímání</button>';
  root.append(bar);
  const floatSnap=bar.querySelector("[data-ks-capture-snap]");
  const floatBack=bar.querySelector("[data-ks-capture-back]");
  const floatStop=bar.querySelector("[data-ks-capture-stop]");
  const shotCount=bar.querySelector("[data-ks-shot-count]");

  const isCaptureActive=()=>!snapButton.disabled&&!stopButton.disabled;
  const sync=()=>{
    const active=isCaptureActive(),count=reporterScreenshotCount(root),countText=count+" / "+KS_REPORTER_MAX_SCREENSHOTS+" snímků";
    if(leaveButton.disabled===active)leaveButton.disabled=!active;
    const snapDisabled=!active||count>=KS_REPORTER_MAX_SCREENSHOTS;
    if(floatSnap.disabled!==snapDisabled)floatSnap.disabled=snapDisabled;
    if(floatStop.disabled===active)floatStop.disabled=!active;
    if(shotCount.textContent!==countText)shotCount.textContent=countText;
    if(!active&&root.classList.contains("ghrab-ks-capture-mode"))showReport();
  };
  const hideForCapture=()=>{
    if(!isCaptureActive())return;
    backdrop.hidden=true;
    document.documentElement.classList.remove("ghrab-report-open");
    root.classList.add("ghrab-ks-capture-mode");
    bar.hidden=false;
    sync();
    floatSnap.focus({preventScroll:true});
  };
  const showReport=()=>{
    root.classList.remove("ghrab-ks-capture-mode");
    bar.hidden=true;
    backdrop.hidden=false;
    document.documentElement.classList.add("ghrab-report-open");
    sync();
    leaveButton.focus({preventScroll:true});
  };

  leaveButton.addEventListener("click",hideForCapture);
  floatSnap.addEventListener("click",()=>{if(!floatSnap.disabled)snapButton.click();});
  floatBack.addEventListener("click",showReport);
  floatStop.addEventListener("click",()=>{if(!stopButton.disabled)stopButton.click();showReport();});

  const interceptClose=event=>{
    if(!isCaptureActive())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hideForCapture();
  };
  closeButton?.addEventListener("click",interceptClose,true);
  footerClose?.addEventListener("click",interceptClose,true);
  backdrop.addEventListener("click",event=>{if(event.target===backdrop)interceptClose(event);},true);
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!backdrop.hidden&&isCaptureActive())interceptClose(event);
  },true);

  let wasActive=isCaptureActive();
  const observer=new MutationObserver(()=>{
    const active=isCaptureActive();
    sync();
    // Po výběru karty/okna se uživatel automaticky vrátí do aplikace.
    if(active&&!wasActive&&!backdrop.hidden)hideForCapture();
    wasActive=active;
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["disabled","hidden"]});
  sync();
  return true;
}
function initGhrabErrorReporterEnhancement(){
  const existing=document.getElementById("ghrab-error-reporter");
  if(existing)enhanceGhrabErrorReporter(existing);
  const host=document.body||document.documentElement;
  if(!host)return;
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.id==="ghrab-error-reporter")enhanceGhrabErrorReporter(node);
        else node.querySelector&&enhanceGhrabErrorReporter(node.querySelector("#ghrab-error-reporter"));
      }
    }
  });
  observer.observe(host,{childList:true,subtree:true});
}
initGhrabErrorReporterEnhancement();
