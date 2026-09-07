#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root=process.cwd();
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const out=process.argv[2]||path.join(root,'security',`ks-${pkg.version}.cdx.json`);
const buildTime=process.env.GHRAB_BUILD_TIME||new Date().toISOString();
function purl(name,version){return `pkg:npm/${encodeURIComponent(name).replace('%40','@')}@${version}`;}
function sha512Hex(integrity){
  const m=String(integrity||'').match(/^sha512-(.+)$/); if(!m)return null;
  try{return Buffer.from(m[1],'base64').toString('hex');}catch{return null;}
}
const components=[];
for(const [rel,meta] of Object.entries(lock.packages||{})){
  if(!rel||!meta?.version) continue;
  const name=meta.name || rel.split('node_modules/').at(-1);
  if(!name) continue;
  const hashes=[]; const h=sha512Hex(meta.integrity); if(h) hashes.push({alg:'SHA-512',content:h});
  components.push({type:'library',name,version:meta.version,'bom-ref':purl(name,meta.version),purl:purl(name,meta.version),scope:meta.dev?'optional':'required',...(hashes.length?{hashes}:{})});
}
components.sort((a,b)=>Buffer.compare(Buffer.from(a['bom-ref']),Buffer.from(b['bom-ref'])));
const direct=[...Object.entries(pkg.dependencies||{}),...Object.entries(pkg.devDependencies||{})]
  .map(([name])=>components.find(c=>c.name===name)?.['bom-ref']).filter(Boolean).sort();
const bom={
  '$schema':'https://cyclonedx.org/schema/bom-1.7.schema.json',bomFormat:'CycloneDX',specVersion:'1.7',serialNumber:`urn:uuid:${crypto.randomUUID()}`,version:1,
  metadata:{timestamp:buildTime,tools:{components:[{type:'application',name:'GARP app-local package-lock SBOM generator',version:'1'}]},component:{type:'application',name:pkg.name,version:pkg.version,'bom-ref':`pkg:npm/${pkg.name}@${pkg.version}`,purl:`pkg:npm/${pkg.name}@${pkg.version}`}},
  components,
  dependencies:[{ref:`pkg:npm/${pkg.name}@${pkg.version}`,dependsOn:direct},...components.map(c=>({ref:c['bom-ref'],dependsOn:[]}))]
};
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(bom,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',specVersion:'1.7',components:components.length,output:out},null,2));
