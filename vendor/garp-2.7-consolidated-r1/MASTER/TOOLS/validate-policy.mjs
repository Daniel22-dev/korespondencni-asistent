#!/usr/bin/env node
import {readJson, parseArgs, nonEmptyObject, fail, pass, harnessError} from './lib.mjs';
try {
  const a=parseArgs(process.argv.slice(2)); const file=a._[0]; if(!file) throw new Error('usage: validate-policy.mjs POLICY.json --core CORE.json');
  const core=readJson(a.core); const x=readJson(file); const errors=[];
  if(x.schema!=='garp27-policy-v1') errors.push('schema');
  if(x.garpVersion!=='2.7') errors.push('garpVersion must be 2.7; legacy 2.5/2.6 requires explicit migration review');
  if(!x.appId || !x.appVersion) errors.push('app identity');
  for(const key of core.requiredPolicySections||[]) if(!nonEmptyObject(x[key])) errors.push(`${key}: required non-empty object`);
  const bad=(core.forbiddenPlaceholderValues||[]).map(v=>String(v).toLowerCase());
  const scan=(v,p='')=>{ if(typeof v==='string' && bad.includes(v.trim().toLowerCase())) errors.push(`${p}: placeholder`); else if(Array.isArray(v)) v.forEach((q,i)=>scan(q,`${p}[${i}]`)); else if(v&&typeof v==='object') for(const [k,q] of Object.entries(v)) scan(q,p?`${p}.${k}`:k); };
  scan(x);
  if(errors.length) fail('GARP 2.7 policy is not admissible',errors);
  pass({contract:'garp27-policy-v1',appId:x.appId,appVersion:x.appVersion});
} catch(e){ harnessError(e); }
