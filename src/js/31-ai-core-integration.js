/* ===================== GHRAB AI CORE 1.0.0 · DIFERENCIÁTOR P1 ===================== */
const DPL_AI_APP=Object.freeze({id:'differentiator',version:'1.3.12'});
const DPL_AI_SCHEMAS=Object.freeze({
  'differentiator.text.v1':{type:'object',required:['text'],properties:{text:{type:'string'}},additionalProperties:false},
  'differentiator.object.v1':{type:'object',additionalProperties:true}
});
const DPL_AI_OPERATIONS=Object.freeze({schema:'ghrab-ai-operations-v1',appId:DPL_AI_APP.id,operations:Object.freeze({
  'cefr-detection':{outputSchemaId:'differentiator.text.v1',defaultModelProfile:'economy',allowedModelProfiles:['economy','balanced'],inputTypes:['text'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:4096},
  'material-extraction':{outputSchemaId:'differentiator.text.v1',defaultModelProfile:'balanced',allowedModelProfiles:['balanced','quality'],inputTypes:['text','image','document'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
  'worksheet-generation':{outputSchemaId:'differentiator.object.v1',defaultModelProfile:'balanced',allowedModelProfiles:['balanced','quality'],inputTypes:['text','image','document'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
  'worksheet-structure-repair':{outputSchemaId:'differentiator.object.v1',defaultModelProfile:'economy',allowedModelProfiles:['economy','balanced'],inputTypes:['text'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
  'answer-key-generation':{outputSchemaId:'differentiator.text.v1',defaultModelProfile:'economy',allowedModelProfiles:['economy','balanced'],inputTypes:['text'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:16384},
  'worksheet-quality-audit':{outputSchemaId:'differentiator.text.v1',defaultModelProfile:'economy',allowedModelProfiles:['economy','balanced'],inputTypes:['text'],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:8192}
})});
function dplSchoolMode(){return window.GHRAB_PLATFORM?.isSchoolProfile?.()===true}
function dplModelProfile(operation){const registration=DPL_AI_OPERATIONS.operations[operation];return registration?.defaultModelProfile||'balanced'}
function dplCoreParts(parts){const out=[];for(const part of(Array.isArray(parts)?parts:[])){if(part&&typeof part.text==='string'){out.push({type:'text',text:part.text});continue}const inline=part?.inline_data||part?.inlineData;if(inline?.data){const mime=inline.mime_type||inline.mimeType||'application/octet-stream';out.push({type:String(mime).startsWith('image/')?'image':'document',mimeType:mime,name:inline.name||'material',source:{kind:'inline-base64',data:inline.data}})}}return out}
function dplPreflight(parts){const text=parts.filter(part=>part.type==='text').map(part=>part.text).join('\n');if(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)){const error=new Error('Materiál obsahuje e-mailovou adresu. Před odesláním do AI ji nahraď anonymním označením.');error.code='PREFLIGHT_BLOCKED';throw error}return true}
function dplEnsureAiCore(){
  if(!window.GHRAB_AI)throw makeAppError('Společná AI vrstva se nenačetla. Obnov stránku přes AI Studio.','CONFIGURATION_ERROR');
  const state=window.GHRAB_AI.getState?.();if(state?.configured&&state.app?.id===DPL_AI_APP.id)return;
  window.GHRAB_AI.configure({app:DPL_AI_APP,runtimeConfig:window.GHRAB_PLATFORM.createAiRuntimeConfig({timeoutMs:GEMINI_TIMEOUT_MS,maxRequestBytes:MAX_INLINE_REQUEST_BYTES,maxPartBytes:MAX_SINGLE_MEDIA_ORIGINAL_BYTES,models:{balanced:geminiModel,economy:FALLBACK_MODELS[0],quality:geminiModel}}),operations:DPL_AI_OPERATIONS,outputSchemas:DPL_AI_SCHEMAS,
    credentialProvider:async({mode})=>mode==='direct-gemini'?{apiKey:cleanKey(geminiApiKey),modelOverride:geminiModel}:null,
    authProvider:async()=>window.GHRAB_PLATFORM.authProvider(),
    telemetrySink:event=>window.GHRAB_PLATFORM.recordTelemetry({type:'ai-usage',appId:DPL_AI_APP.id,appVersion:DPL_AI_APP.version,...event})});
}
const dplLegacyCallGemini=callGemini;
callGemini=async function callGeminiThroughCore(parts,opts={}){
  if(window.__TEST_MOCK_GEMINI)return dplLegacyCallGemini(parts,opts);
  dplEnsureAiCore();const operation=opts.operation||(opts.json?'worksheet-generation':'material-extraction');const registration=DPL_AI_OPERATIONS.operations[operation];if(!registration)throw makeAppError('Neznámá AI operace: '+operation,'UNREGISTERED_OPERATION');
  const inputParts=dplCoreParts(parts);dplPreflight(inputParts);
  const plain=registration.outputSchemaId==='differentiator.text.v1';
  const instructions=plain?'Vrať pouze validní JSON objekt přesně ve tvaru {"text":"..."}. Hodnota text musí obsahovat pouze požadovanou odpověď bez markdownu.':'Vrať pouze validní JSON bez markdownu a dodrž strukturu požadovanou v zadání.';
  try{const response=await window.GHRAB_AI.generate({operation,modelProfile:dplModelProfile(operation),instructions,inputParts,outputSchemaId:registration.outputSchemaId,options:{reasoningHint:opts.thinking||THINKING_DEFAULT,maxOutputTokensHint:registration.maxOutputTokensHint},privacy:{clientAnonymized:false,preflightPassed:true},usageContext:{expectedOutputs:registration.expectedOutputs||1},workflowId:opts.workflowId||undefined});return plain?String(response.result.text||''):JSON.stringify(response.result)}catch(error){throw makeAppError(window.GHRAB_AI.formatUserError(error,'cs-CZ'),error.code||'AI_ERROR')}
};
function dplApplyServerKeyPolicy(){if(!dplSchoolMode())return;window.GHRAB_PLATFORM.enforceLocalKeyPolicy({localStorageKeys:[KEY_SK],sessionStorageKeys:[KEY_SESSION_SK],onRemoved:()=>{geminiApiKey='';geminiKeyScope='server';}});const panel=$('#apiPanel'),toggle=$('#apiToggle'),status=$('#keyStatus'),input=$('#keyInput');if(panel)panel.classList.remove('open');if(toggle){toggle.textContent='AI zajišťuje školní server';toggle.disabled=true}if(input){input.value='';input.disabled=true;input.placeholder='Klíč je bezpečně uložen na školním serveru'}for(const id of ['#btnSession','#btnPermanent','#btnClear']){const el=$(id);if(el)el.hidden=true}if(status){status.textContent='✓ Školní AI gateway';status.className='api-status ok'}setStatus('statusKey','školní server','ok')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',dplApplyServerKeyPolicy,{once:true});else dplApplyServerKeyPolicy();
