import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const workflow = fs.readFileSync('.github/workflows/safe-promotion.yml', 'utf8');
const block = workflow.match(/# BEGIN_PROMOTION_CHECK_READINESS([\s\S]*?)# END_PROMOTION_CHECK_READINESS/);
assert.ok(block, 'Privileged workflow must expose auditable poll block');
const extracted = block[1].match(/readiness="\$\(jq -r --arg run "\$TRIGGER_RUN_ID" '([\s\S]*?)' <<<"\$checks_json"\)"/);
assert.ok(extracted, 'Exact runtime jq predicate must be regression-tested');
const predicate = extracted[1];
function check(name, run='112233', status='completed', conclusion='success', startedAt='2026-10-09T08:00:00Z') {
  return { name, status, conclusion, started_at: startedAt, app: {slug:'github-actions'},
    details_url: `https://github.com/example/example/actions/runs/${run}/job/1` };
}
function observe(checks, run='112233') {
  const r = spawnSync('jq', ['-r','--arg','run',run, predicate], {
    input: JSON.stringify({check_runs:checks}), encoding:'utf8'
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
const healthy=[check('p5-release-gate'),check('build-test'),check('axe','445566')];
test('all exact SHA contexts completed and GREEN',()=>assert.equal(observe(healthy),'READY'));
test('a race with P5 job still in progress is PENDING',()=>assert.equal(observe([check('p5-release-gate','112233','in_progress',null),...healthy.slice(1)]),'PENDING'));
test('late build-test check is PENDING',()=>assert.equal(observe([healthy[0],healthy[2]]),'PENDING'));
test('axe pending remains PENDING',()=>assert.equal(observe([healthy[0],healthy[1],check('axe','445566','in_progress',null)]),'PENDING'));
test('missing triggering P5 run cannot borrow an earlier GREEN',()=>assert.equal(observe([check('p5-release-gate','000000'),healthy[1],healthy[2]]),'PENDING'));
test('failing P5 is a blocking FAIL',()=>assert.equal(observe([check('p5-release-gate','112233','completed','failure'),...healthy.slice(1)]),'FAIL'));
test('failing axe is a blocking FAIL',()=>assert.equal(observe([healthy[0],healthy[1],check('axe','445566','completed','failure')]),'FAIL'));
test('latest axe check controls independent audit',()=>assert.equal(observe([...healthy,check('axe','445566','in_progress',null,'2026-10-09T08:05:00Z')]),'PENDING'));
test('branch and source revalidation cannot be removed',()=>{
  assert.match(block[1], /current_pr=.*gh api/);
  assert.match(block[1], /remote_candidate=.*gh api/);
  assert.match(block[1], /head\.sha == \$sha/);
  assert.match(block[1], /mergeable_state.*clean/);
  assert.match(block[1], /sleep 5/);
  assert.match(block[1], /promotion_ready.*true/);
  assert.match(workflow,/TRIGGER_RUN_ID: \$\{\{ github\.event\.workflow_run\.id \}\}/);
});
