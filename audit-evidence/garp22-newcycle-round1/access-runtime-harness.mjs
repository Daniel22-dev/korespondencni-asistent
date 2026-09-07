import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const central = path.join(path.dirname(new URL(import.meta.url).pathname), 'central-access-snapshot');
const work = path.join(path.dirname(new URL(import.meta.url).pathname), '.access-harness-work');
fs.rmSync(work,{recursive:true,force:true});
fs.mkdirSync(path.join(work,'access'),{recursive:true});
fs.mkdirSync(path.join(work,'config'),{recursive:true});
fs.copyFileSync(path.join(central,'config','deployment-baked.js'),path.join(work,'config','deployment-baked.js'));

function b64urlBytes(buf){ return Buffer.from(buf).toString('base64url'); }
function b64urlJson(obj){ return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function canonicalJson(value){
  if(Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function genPair(kid){
  const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const priv=await webcrypto.subtle.exportKey('jwk',pair.privateKey);
  const pub=await webcrypto.subtle.exportKey('jwk',pair.publicKey);
  Object.assign(priv,{kid,use:'sig',alg:'ES256'}); Object.assign(pub,{kid,use:'sig',alg:'ES256'});
  return {pair,priv,pub};
}
async function signBytes(privateKey, bytes){
  return b64urlBytes(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,new TextEncoder().encode(bytes)));
}
async function signBundle(bundle,keyPair,keyId){
  return {schema:'ghrab-access-config-signature-v1',algorithm:'ES256',keyId,bundleVersion:bundle.version,signature:await signBytes(keyPair.privateKey,canonicalJson(bundle))};
}
async function signPermit(payload,keyPair){
  const body=b64urlJson(payload); return `ghrab1.${body}.${await signBytes(keyPair.privateKey,body)}`;
}
class MemStorage{
  constructor(){this.m=new Map();}
  get length(){return this.m.size;} key(i){return [...this.m.keys()][i]??null;}
  getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null;}
  setItem(k,v){this.m.set(String(k),String(v));} removeItem(k){this.m.delete(String(k));} clear(){this.m.clear();}
}
const cfgKey=await genPair('garp-synth-config-key');
const permitKey=await genPair('garp-synth-permit-key');
let source=fs.readFileSync(path.join(central,'access','access-control.js'),'utf8');
source=source.replace(/const ACCESS_BUNDLE_VERIFY_KEY = Object\.freeze\(\{[\s\S]*?\}\);/,`const ACCESS_BUNDLE_VERIFY_KEY = Object.freeze(${JSON.stringify(cfgKey.pub)});`);
fs.writeFileSync(path.join(work,'access','access-control.mjs'),source);

const now=Math.floor(Date.now()/1000);
const policy={
  schema:'ghrab-access-policy-v1',issuer:'ai-studio-ghrab',audience:'ai-studio-ghrab',defaultState:'locked',clockSkewSeconds:0,maximumPermitDays:90,maximumPermitDaysEnforcedAfter:'2026-08-22T00:00:00.000Z',administratorRoles:['admin'],operatorRoles:['operator'],operatorPages:['automation','report'],applications:{
    generator:{trainingRequired:true,trainingCode:'GEN-01',trainingVersion:'2026-09'},
    correspondence:{trainingRequired:true,trainingCode:'KOR-01',trainingVersion:'2026-09'}
  }
};
let version='garp-synth-access-v1';
let revoked=[];
function makeBundle(){return {schema:'ghrab-access-config-bundle-v1',version,issuedAt:new Date().toISOString(),generatedAt:new Date().toISOString(),maxOfflineAgeHours:24,maxSignedBundleAgeDays:30,policy,revocations:{schema:'ghrab-access-revocation-list-v1',updatedAt:new Date().toISOString(),revokedBefore:null,revokedJti:[...revoked]},accessPublicKey:{schema:'ghrab-access-public-key-v1',keyId:'garp-synth-permit-key',algorithm:'ES256',publicKey:permitKey.pub,activeKeyId:'garp-synth-permit-key',keys:[{keyId:'garp-synth-permit-key',algorithm:'ES256',publicKey:permitKey.pub}]}};}
let bundle=makeBundle(); let sig=await signBundle(bundle,cfgKey.pair,'garp-synth-config-key');
const ls=new MemStorage(); const ss=new MemStorage();
Object.defineProperties(globalThis,{
  crypto:{value:webcrypto,configurable:true},
  localStorage:{value:ls,configurable:true},sessionStorage:{value:ss,configurable:true},
  location:{value:new URL('https://synthetic.example.invalid/AI-Studio-GHRAB/'),configurable:true},
  navigator:{value:{onLine:true},configurable:true},
  document:{value:{documentElement:{classList:{toggle(){}},dataset:{}},dispatchEvent(){}},configurable:true},
  CustomEvent:{value:class{constructor(type,opts={}){this.type=type;this.detail=opts.detail;}},configurable:true}
});
globalThis.__GHRAB_DEPLOYMENT_CONFIG__={profile:'garp-synthetic',authMode:'signed-permit',sharedAccessVersion:version,access:{maxOfflineAgeHours:24,maxSignedBundleAgeDays:30,failClosedWhenStale:true},features:{allowLocalProviderKeys:false},studioBaseUrl:'/AI-Studio-GHRAB/',apiBaseUrl:''};
globalThis.fetch=async input=>{
  const u=String(input);
  if(u.includes('access-config-bundle.sig.json')) return new Response(JSON.stringify(sig),{status:200,headers:{'content-type':'application/json'}});
  if(u.includes('access-config-bundle.json')) return new Response(JSON.stringify(bundle),{status:200,headers:{'content-type':'application/json'}});
  throw new Error(`unexpected fetch ${u}`);
};
const ac=await import(`${pathToFileURL(path.join(work,'access','access-control.mjs')).href}?${Date.now()}`);
const results=[]; const check=(id,cond,detail)=>{results.push({id,ok:!!cond,detail}); if(!cond) throw new Error(`${id}: ${detail}`);};
const initial=await ac.initialiseAccess({timeoutMs:1000});
check('RT01-no-permit-failclosed',initial.valid===false && ac.hasAppAccess('generator').enabled===false,JSON.stringify({valid:initial.valid,reason:initial.reason,access:ac.hasAppAccess('generator')}));
function base(over={}){return {schema:'ghrab-access-permit-v1',iss:'ai-studio-ghrab',aud:'ai-studio-ghrab',sub:'synthetic-teacher',jti:'garp-synth-jti-main',kid:'garp-synth-permit-key',role:'teacher',apps:['generator'],training:{generator:{code:'GEN-01',version:'2026-09'}},iat:now-30,exp:now+3600,...over};}
const tamperedBody=b64urlJson(base({jti:'garp-synth-tampered'}));
ls.setItem('ghrab.access.permit.v2',`ghrab1.${tamperedBody}.c3ludGhldGljLWludmFsaWQtc2lnbmF0dXJl`);
const tamperedSnap=await ac.initialiseAccess({timeoutMs:1000});
check('RT02-storage-tamper-does-not-authorize',tamperedSnap.valid===false && ac.hasAppAccess('generator').enabled===false,JSON.stringify({valid:tamperedSnap.valid,reason:tamperedSnap.reason,access:ac.hasAppAccess('generator')}));
ls.removeItem('ghrab.access.permit.v2');
const valid=await signPermit(base(),permitKey.pair);
let r=await ac.inspectPermitToken(valid); check('SIM01-valid-signed-permit',r.valid===true,r.reason);
r=await ac.setPermitToken(valid); check('RT01-set-valid-permit',r.ok===true,r.reason);
check('SIM01-app-A-allowed',ac.hasAppAccess('generator').enabled===true,ac.hasAppAccess('generator').reason);
check('SIM01-app-B-denied',ac.hasAppAccess('correspondence').enabled===false && ac.hasAppAccess('correspondence').reason==='app-not-permitted',JSON.stringify(ac.hasAppAccess('correspondence')));
check('SIM01-app-B-no-training-policy-denied',ac.hasAppAccess('ludus').enabled===false && ac.hasAppAccess('ludus').reason==='app-not-permitted',JSON.stringify(ac.hasAppAccess('ludus')));
check('RT11-teacher-not-admin',ac.isAdmin()===false && ac.canAccessAdminPage('issuer')===false,'teacher unexpectedly admin');
for(const [id,payload,expected] of [
  ['SIM01-wrong-audience',base({aud:'other-app'}),'invalid-audience'],
  ['RT11-invalid-role',base({role:'superadmin'}),'invalid-role'],
  ['RT04-expired',base({exp:now-600}),'expired'],
  ['RT04-too-long',base({exp:now+91*86400}),'validity-too-long'],
]){
  const tok=await signPermit(payload,permitKey.pair); const out=await ac.inspectPermitToken(tok); check(id,out.valid===false && out.reason===expected,JSON.stringify(out));
}
const revokedPayload=base({jti:'garp-synth-revoked'}); revoked=['garp-synth-revoked']; version='garp-synth-access-v2'; bundle=makeBundle(); sig=await signBundle(bundle,cfgKey.pair,'garp-synth-config-key'); globalThis.__GHRAB_DEPLOYMENT_CONFIG__={...globalThis.__GHRAB_DEPLOYMENT_CONFIG__,sharedAccessVersion:version};
const revokedToken=await signPermit(revokedPayload,permitKey.pair); ls.setItem('ghrab.access.permit.v2',revokedToken); const snap2=await ac.initialiseAccess({timeoutMs:1000});
check('SIM02-online-revocation-propagates',snap2.valid===false && snap2.reason==='revoked',JSON.stringify({valid:snap2.valid,reason:snap2.reason,version:snap2.sharedAccessVersion}));
// Now force offline; latest signed LKG must still carry the revocation.
globalThis.fetch=async()=>{throw new TypeError('synthetic offline');};
const snap3=await ac.initialiseAccess({timeoutMs:500});
check('SIM02-offline-LKG-keeps-revocation',snap3.connectionState==='offline-fresh' && snap3.valid===false && snap3.reason==='revoked',JSON.stringify({connectionState:snap3.connectionState,valid:snap3.valid,reason:snap3.reason}));
// Shared access version mismatch must fail closed.
globalThis.__GHRAB_DEPLOYMENT_CONFIG__={...globalThis.__GHRAB_DEPLOYMENT_CONFIG__,sharedAccessVersion:'garp-synth-rollback-mismatch'};
const snap4=await ac.initialiseAccess({timeoutMs:500});
check('RT05-sharedAccessVersion-mismatch-failclosed',snap4.valid===false && ['configuration-unavailable','configuration-stale'].includes(snap4.reason),JSON.stringify({valid:snap4.valid,reason:snap4.reason,connection:snap4.connectionState}));

const output={schema:'garp22-access-runtime-harness-v1',generatedAt:new Date().toISOString(),syntheticOnly:true,sourceArtifact:'AI-Studio-GHRAB GitHub Pages artifact 328701510c0cad4005d935a95b8c28c04255fe71',tests:results,status:results.every(x=>x.ok)?'passed':'failed'};
console.log(JSON.stringify(output,null,2));
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'access-runtime.json'),JSON.stringify(output,null,2)+'\n');
