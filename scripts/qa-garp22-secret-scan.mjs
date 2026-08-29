#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveGarpEvidenceDir } from './lib/garp-evidence-path.mjs';
import crypto from 'node:crypto';
const root=path.resolve('.');
const { evidenceDir, evidenceRoot }=resolveGarpEvidenceDir(root,process.env.GARP_EVIDENCE_DIR||'garp23-release-gate');
const out=path.join(evidenceRoot,'secret-scan.json');
const roots=['src','scripts','.github','dist','dist-school-server'].filter(p=>fs.existsSync(path.join(root,p)));
const skip=new Set(['node_modules','.git','audit-evidence']);
const textExt=new Set(['.js','.mjs','.cjs','.json','.html','.css','.md','.txt','.yml','.yaml','.webmanifest','.xml','.toml']);
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
 ['google-api-key',/\bAIza[0-9A-Za-z_-]{35}\b/g],
 ['github-token',/\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g],
 ['openai-like-key',/\bsk-[A-Za-z0-9_-]{20,}\b/g],
 ['jwt-like',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g]
];
const findings=[];let files=0,bytes=0;
function walk(abs,rel){for(const e of fs.readdirSync(abs,{withFileTypes:true})){if(skip.has(e.name))continue;const a=path.join(abs,e.name),r=path.join(rel,e.name);if(e.isDirectory())walk(a,r);else if(e.isFile()){const ext=path.extname(e.name).toLowerCase();if(!textExt.has(ext))continue;const st=fs.statSync(a);if(st.size>8_000_000)continue;files++;bytes+=st.size;let s;try{s=fs.readFileSync(a,'utf8')}catch{continue}for(const [type,re] of patterns){re.lastIndex=0;let n=0;while(re.exec(s)){n++;if(n>20)break}if(n)findings.push({type,path:r,count:n});}}}}
for(const rr of roots)walk(path.join(root,rr),rr);
const riskyNames=[];function names(abs,rel){for(const e of fs.readdirSync(abs,{withFileTypes:true})){if(skip.has(e.name))continue;const a=path.join(abs,e.name),r=path.join(rel,e.name);if(e.isDirectory())names(a,r);else if(/(?:^|\/)(?:\.env(?:\.|$)|id_rsa$|id_ed25519$|.*\.(?:pem|p12|pfx|key))$/i.test(r))riskyNames.push(r);}}
for(const rr of roots)names(path.join(root,rr),rr);
const result={schema:'garp22-secret-scan-v1',generatedAt:new Date().toISOString(),scope:roots,filesScanned:files,bytesScanned:bytes,findings,riskyFilenames:riskyNames,status:findings.length||riskyNames.length?'failed':'passed',scanScriptSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex')};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,filesScanned:files,findings:findings.map(x=>({type:x.type,path:x.path,count:x.count})),riskyFilenames:riskyNames},null,2));
if(result.status!=='passed')process.exit(1);
