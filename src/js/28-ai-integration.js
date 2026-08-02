/* ===================== INTEGRACE KS DO GHRAB AI CORE 1.0.0 ===================== */
const KS_AI_SCHEMA_IDS=Object.freeze({
  object:"correspondence.object.v1",
  synonyms:"correspondence.synonyms.v1",
  text:"correspondence.text.v1",
  tone:"correspondence.tone.v1",
  reply:"correspondence.reply.v1",
  analyze:"correspondence.analysis.v1"
});
const KS_AI_OUTPUT_SCHEMAS=Object.freeze({
  "correspondence.object.v1":{type:"object"},
  "correspondence.synonyms.v1":{type:"object",required:["synonyma"],properties:{synonyma:{type:"array",items:{type:"string"}}}},
  "correspondence.text.v1":{type:"object",required:["text"],properties:{text:{type:"string"},zmeny:{type:"array",items:{type:"string"}},synonyma:{type:"object"}}},
  "correspondence.tone.v1":{type:"object",required:["naladeni"],properties:{naladeni:{type:"object"},prirozenost:{type:"object"},rizika:{type:"array",items:{type:"string"}},sablonoviteObraty:{type:"array",items:{type:"string"}},navrh:{type:"string"}}},
  "correspondence.reply.v1":{type:"object",required:["navrhy"],properties:{navrhy:{type:"array",items:{type:"object",required:["text"],properties:{typ:{type:"string"},styl:{type:"string"},text:{type:"string"},pokryti:{type:"object"}}}},synonyma:{type:"object"}}},
  "correspondence.analysis.v1":{type:"object",required:["shrnuti","pozadavky"],properties:{shrnuti:{type:"string"},naladeni:{type:"object"},pozadavky:{type:"array",items:{type:"string"}},upozorneni:{type:"array",items:{type:"string"}},terminy:{type:"array",items:{type:"string"}},dohodnuto:{type:"array",items:{type:"string"}},nezodpovezene:{type:"array",items:{type:"string"}},odesilatelRole:{type:"string"},priorita:{type:"string"},nalehavost:{type:"string"},konflikt:{type:"boolean"},dalsiKrok:{type:"string"},vlakno:{type:"object"}}}
});
const KS_AI_OPERATIONS=Object.freeze({
  schema:"ghrab-ai-operations-v1",
  appId:"correspondence",
  operations:Object.freeze({
    "incoming-analysis":{outputSchemaId:KS_AI_SCHEMA_IDS.analyze,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
    "reply-draft":{outputSchemaId:KS_AI_SCHEMA_IDS.reply,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:3,maxOutputTokensHint:32768},
    "outgoing-rewrite":{outputSchemaId:KS_AI_SCHEMA_IDS.text,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
    "outgoing-compose":{outputSchemaId:KS_AI_SCHEMA_IDS.text,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
    "outgoing-proofread":{outputSchemaId:KS_AI_SCHEMA_IDS.text,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
    "draft-refinement":{outputSchemaId:KS_AI_SCHEMA_IDS.text,defaultModelProfile:"balanced",allowedModelProfiles:["balanced","quality"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:32768},
    "tone-check":{outputSchemaId:KS_AI_SCHEMA_IDS.tone,defaultModelProfile:"economy",allowedModelProfiles:["economy","balanced"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:8192},
    "synonym-suggestions":{outputSchemaId:KS_AI_SCHEMA_IDS.synonyms,defaultModelProfile:"economy",allowedModelProfiles:["economy","balanced"],inputTypes:["text"],streaming:false,requiredCapabilities:[],expectedOutputs:1,maxOutputTokensHint:4096}
  })
});
function ksCoreTestModeFor(mode){
  const active=(typeof IS_TEST_MODE!=="undefined"&&IS_TEST_MODE)||(typeof TEST_RUN_ACTIVE!=="undefined"&&TEST_RUN_ACTIVE);
  if(!active)return false;
  return mode==="school-gateway"?typeof window.__TEST_MOCK_GATEWAY==="function":typeof window.__TEST_MOCK_GEMINI==="function";
}
function ksSchemaAliasFromId(schemaId){
  for(const [alias,id] of Object.entries(KS_AI_SCHEMA_IDS))if(id===schemaId)return alias;
  return "object";
}
function ksServerAuthContext(){
  if(window.GHRABServerAuth&&typeof window.GHRABServerAuth.getContext==="function")return window.GHRABServerAuth.getContext();
  if(typeof window.getServerAuthContext==="function")return window.getServerAuthContext();
  return null;
}
GHRAB_AI.configure({
  app:{id:"correspondence",version:(typeof RELEASE!=="undefined"&&RELEASE.version)||"0.0.0"},
  runtimeConfig:window.__GHRAB_RUNTIME_CONFIG__,
  operations:KS_AI_OPERATIONS,
  outputSchemas:KS_AI_OUTPUT_SCHEMAS,
  credentialProvider:async({mode})=>mode==="direct-gemini"?{apiKey:(typeof geminiApiKey!=="undefined"?geminiApiKey:""),modelOverride:(typeof geminiModel!=="undefined"?geminiModel:"")}:null,
  authProvider:async()=>await ksServerAuthContext(),
  telemetrySink:event=>{try{window.GHRABTelemetry?.recordAiUsage?.(event);}catch(_){}},
  providerEventSink:event=>{try{if(typeof logOp==="function")logOp("api",event.type,event);}catch(_){}},
  testHooks:{
    isEnabled:()=>ksCoreTestModeFor(GHRAB_AI.getState().activeMode),
    directGemini:async({request,reasoningHint,operation,modelProfile})=>{
      const alias=ksSchemaAliasFromId(request.output.schemaId);
      const prompt=request.input.parts.filter(part=>part.type==="text").map(part=>part.text).join("\n");
      return await window.__TEST_MOCK_GEMINI({prompt,system:request.instructions,schema:alias,schemaId:request.output.schemaId,thinking:reasoningHint,operation,modelProfile});
    },
    schoolGateway:async payload=>await window.__TEST_MOCK_GATEWAY(payload),
    health:async()=>typeof window.__TEST_MOCK_GATEWAY_HEALTH==="function"?await window.__TEST_MOCK_GATEWAY_HEALTH():{schema:"ghrab-ai-health-v1",status:"ok",supportedRequestSchemas:["ghrab-ai-request-v1"],supportedResponseSchemas:["ghrab-ai-response-v1"],supportedCoreVersions:[">=1.0.0 <2.0.0"],modelProfiles:["economy","balanced","quality"],capabilities:{streaming:false,inputTypes:["text"]},limits:{maxRequestBytes:10485760}}
  }
});

/* Dočasná kompatibilní fasáda pro starší moduly KS. Logiku runtime vlastní Core. */
window.GHRABRuntime=Object.freeze({
  schema:"ghrab-runtime-config-v1",
  modes:GHRAB_AI.modes,
  modelProfiles:GHRAB_AI.modelProfiles,
  getConfig:()=>{
    const state=GHRAB_AI.getState(),cfg=state.runtimeConfig;
    return Object.freeze({
      schema:cfg.schema,
      app:Object.freeze({id:state.app.id,version:state.app.version}),
      ai:Object.freeze({
        mode:state.activeMode,
        defaultMode:cfg.ai.defaultMode,
        selectedMode:state.activeMode,
        allowedModes:Object.freeze(cfg.ai.allowedModes.slice()),
        allowUserModeSelection:cfg.ai.allowUserModeSelection,
        automaticFallback:false,
        gatewayUrl:cfg.ai.gatewayUrl,
        healthUrl:cfg.ai.healthUrl,
        allowDirectMode:cfg.ai.allowedModes.includes("direct-gemini"),
        allowDirectFallback:false,
        defaultModelProfile:"balanced",
        requestTimeoutMs:cfg.ai.requestTimeoutMs,
        directGemini:Object.freeze({useModelProfiles:true,useResponseSchema:cfg.ai.directGemini.useResponseSchema})
      }),
      telemetry:Object.freeze({enabled:cfg.telemetry.enabled,recordProviderRequests:true,recordTokenUsage:true,recordLatency:true})
    });
  },
  getMode:()=>GHRAB_AI.getState().activeMode,
  getAiConfig:()=>window.GHRABRuntime.getConfig().ai,
  getTelemetryConfig:()=>window.GHRABRuntime.getConfig().telemetry,
  getDefaultModelProfile:()=>"balanced",
  isSchoolGateway:()=>GHRAB_AI.getState().activeMode==="school-gateway",
  replaceForTesting:raw=>{
    const current=GHRAB_AI.getState().runtimeConfig,src=raw&&raw.ai||{},mode=src.mode||src.selectedMode||src.defaultMode||current.ai.defaultMode;
    const allowed=Array.isArray(src.allowedModes)?src.allowedModes.slice():current.ai.allowedModes.slice();
    if(!allowed.includes(mode))allowed.push(mode);
    const next={schema:"ghrab-runtime-config-v1",ai:{
      defaultMode:mode,selectedMode:mode,allowedModes:allowed,allowUserModeSelection:true,automaticFallback:false,
      gatewayUrl:src.gatewayUrl||current.ai.gatewayUrl,healthUrl:src.healthUrl||current.ai.healthUrl,
      requestTimeoutMs:src.requestTimeoutMs||current.ai.requestTimeoutMs,gatewayMaxRetries:Number.isFinite(src.gatewayMaxRetries)?src.gatewayMaxRetries:current.ai.gatewayMaxRetries,
      maxRequestBytes:src.maxRequestBytes||current.ai.maxRequestBytes,maxPartBytes:src.maxPartBytes||current.ai.maxPartBytes,
      directGemini:Object.assign({},current.ai.directGemini,src.directGemini||{})
    },telemetry:Object.assign({},current.telemetry,raw&&raw.telemetry||{})};
    return GHRAB_AI.__testing.replaceRuntimeConfig(next);
  }
});
