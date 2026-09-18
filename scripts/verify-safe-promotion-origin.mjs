#!/usr/bin/env node
const isActions=process.env.GITHUB_ACTIONS==='true';
if(!isActions){console.log('SAFE PROMOTION ORIGIN SKIP: mimo GitHub Actions');process.exit(0)}
const repo=String(process.env.GITHUB_REPOSITORY||'').trim(),ref=String(process.env.GITHUB_REF_NAME||'').trim(),sha=String(process.env.GITHUB_SHA||'').trim(),token=String(process.env.GITHUB_TOKEN||'').trim();
if(!repo||!ref||!sha||!token){console.error('SAFE PROMOTION ORIGIN FAIL: chybi GITHUB_REPOSITORY/GITHUB_REF_NAME/GITHUB_SHA/GITHUB_TOKEN');process.exit(1)}
if(ref!=='main'){console.error('SAFE PROMOTION ORIGIN FAIL: produkcni deploy je povolen pouze z main');process.exit(1)}
const response=await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(sha)}/pulls`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},redirect:'error'});
if(!response.ok){console.error(`SAFE PROMOTION ORIGIN FAIL: associated PR metadata HTTP ${response.status}`);process.exit(1)}
const prs=await response.json();const promotion=Array.isArray(prs)?prs.find(pr=>pr?.state==='closed'&&Boolean(pr?.merged_at)&&pr?.base?.ref==='main'&&pr?.head?.ref==='candidate'):null;
if(!promotion){console.error('SAFE PROMOTION ORIGIN FAIL: current main SHA neni dolozen jako merged candidate -> main PR');process.exit(1)}
console.log(`SAFE PROMOTION ORIGIN PASS: main SHA ${sha} pochazi z merged PR #${promotion.number} candidate -> main`);
