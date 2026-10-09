# P2B stage 4: Eliminate only the redundant early CI GARP27 static pass

## What changes

For the **CI-only** `qa:p5:ci` command, remove a redundant **early** invocation of `qa:garp27:static`. This re-ran five security commands (contracts, architecture, policy mutations, mutation tests, and auto-patch synthetic admission) already required later within the independent, trusted, digest-pinned GARP27 Foundation.

Do not change local `qa:p5` fail-fast behavior, the GARP Foundation source or pin, the five required late GARP commands, the 10 hashed Foundation stages, P5 8 required reports, axe, P5 evidence capture, protected-main promotion, release build, or live verification.

## Observed basis (five production-tree samples)

Five independent P5 runs (PR #36, candidate, PR #37, main and synced candidate) each reported `PRODUCTION_TREE_IDENTICAL` for **all 40** production files between early browser-tested build and late Foundation rebuild; nine generated P5-only QA report files were separately inventoried. No changed, lost or added production assets in any sample. Each audit bound exact source SHA, run ID, attempt and one build timestamp.

Importantly, the original early GARP27 static **precedes** QA quality/browser report generation, and thus operated on the same 40-file production tree, not the later QA-enriched temporary tree. This corrects an earlier unverified hypothesis.

For the production main run 37918677375 (job 113781028396), the early CI log and SHA-256-sealed Foundation JSON logs were compared:

| GARP27 control | Early pass | Trusted Foundation pass |
| --- | ---: | ---: |
| Contracts | 6 PASS | 6 PASS |
| Architecture | 48 PASS | 48 PASS |
| Policy synthetic mutations | 6 PASS | 6 PASS |
| Architecture mutation tests | 10 PASS | 10 PASS |
| Auto-patch synthetic tests | 6 PASS | 6 PASS |

Check IDs were identical. Both architecture reports saw exactly 40 built files, 106 source files, 15 resolved imports, source identity SHA-1 `66a7f1ab1572fae69905e2e77bdbe3e8f4e24862`, and reported zero failing checks.

## Remaining differences

Early static regression failures will now be detected later by the mandatory Foundation gate, after browser tests have executed. No release can pass if Foundation or signed P5/GARP evidence fails. This shifts **failure discovery order**, not required final release admission. Extra browser runtime in a failing security case is accepted; this is a performance optimization of successful builds.

This is not a claim that local `qa:p5` checks are redundant; local mode remains unchanged. The independent blocking axe job is not altered.

## Baseline and acceptance

Historical stage duration: 1.80, 2.03, 2.26, 2.64, 2.79 seconds, median **2.26 seconds**. These are expected eliminated compute stages, not guaranteed end-to-end speedups.

The change adds nine executable CI regression tests that:
- enforce absence of this command from CI-specific `qa:p5:ci`,
- retain the local fail-fast version and all five GARP27 static definitions,
- enforce five mandatory exact late Foundation commands with expected exit 0,
- reject mutated/omitted required Foundation steps,
- enforce SHA-bound P5 evidence, ten hashed Foundation steps, independent axe and release pipeline ordering.

Certify exact PR SHA → candidate push → protected Safe Promotion PR with P5+axe → main exact SHA P5/axe → Pages deploy and live verification. Reinspect 8/8 P5 and 10/10 Foundation artifacts. On any evidence regression, revert and fail closed.
