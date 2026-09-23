#!/usr/bin/env node
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const p5=read('.github/workflows/p5-release-gate.yml'),deploy=read('.github/workflows/deploy.yml'),promotion=read('.github/workflows/safe-promotion.yml');
const errors=[];const need=(s,n,l)=>{if(!s.includes(n))errors.push(`${l}: chybi ${n}`)},reject=(s,n,l)=>{if(s.includes(n))errors.push(`${l}: zakazany obsah ${n}`)};
need(p5,'branches: [candidate, main]','p5');need(p5,'pull_request:','p5');need(p5,'branches: [main]','p5');need(p5,'p5-release-gate:','p5');need(p5,'npm run qa:p5:ci','p5');need(p5,'npm run qa:garp27:foundation','p5');need(p5,'npm run qa:garp25:static','p5');need(p5,'npm run prepare:pages','p5');
need(promotion,'SAFE_PROMOTION_TOKEN','safe-promotion');need(promotion,"head_branch == 'candidate'",'safe-promotion');need(promotion,'p5-release-gate','safe-promotion');need(promotion,'candidate -> main','safe-promotion');reject(promotion,'git push origin HEAD:main','safe-promotion');
need(deploy,'workflow_run:','deploy');need(deploy,'P5 R2 pre-production release gate','deploy');need(deploy,"github.event.workflow_run.conclusion == 'success'",'deploy');need(deploy,"github.event.workflow_run.head_branch == 'main'",'deploy');need(deploy,'qa:promotion-origin','deploy');need(deploy,'qa:github-governance','deploy');need(deploy,'AI_STUDIO_DISPATCH_TOKEN','deploy');need(deploy,'verify:live-release','deploy');need(deploy,'notify-ai-studio:','deploy');reject(deploy,'branches: [candidate','deploy');reject(deploy,'repository_dispatch:','deploy');
if(errors.length){console.error('PROMOTION WORKFLOW ARCHITECTURE: FAIL\n'+errors.map(x=>'- '+x).join('\n'));process.exit(1)}
console.log('PROMOTION WORKFLOW ARCHITECTURE: PASS - candidate -> P5/GARP 2.7 + legacy regressions -> PR -> protected main -> verified deploy -> live verify -> app-updated.');
