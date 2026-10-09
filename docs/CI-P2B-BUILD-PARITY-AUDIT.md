# P2B phase 2 — build and GARP27 repeated-work audit

Status: AUDIT ONLY. This change removes no build, browser, security or release check.

## Measured baseline (2026-10-09)

Five successful P5 GitHub job logs with timestamped stage boundaries:

| Job ID | Entire job (s) | P5 QA (s) | First GARP27 static (s) | Foundation (s) | Extra platform rerun (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 113756420171 | 85.167 | 38.759 | 2.643 | 7.943 | 0.172 |
| 113754266698 | 73.211 | 35.174 | 1.801 | 6.151 | 0.114 |
| 113712966763 | 72.799 | 36.257 | 2.034 | 8.538 | 0.109 |
| 113711911573 | 85.220 | 39.229 | 2.793 | 12.506 | 0.215 |
| 113711310673 | 83.167 | 36.869 | 2.264 | 10.760 | 0.133 |
| Median | 83.167 | 36.869 | 2.264 | 8.538 | 0.133 |

These are separate successful runner executions, not a controlled A/B experiment. Foundation stage spans include job transition overhead.

## Dependency map and security boundaries

| Stage | Producer / consumer and assurance purpose | Safe to remove now? |
| --- | --- | --- |
| P5 QA production build | Produces dist and automatically runs postbuild platform check; prerequisite for school profile and browser QA | NO |
| P5 school profile | Derives dist-school-server from dist; required for legacy GARP25 school boundaries | NO |
| P5 extra verify:platform | Reruns platform check after postbuild; about 0.13 seconds median | Investigate |
| P5 first GARP27 static | Five contracts/architecture/mutation/auto-patch scripts examine source AND current dist; early failure before browser QA | NO without parity proof |
| P5 browser and acceptance | Produces eight required P5 QA reports | NO |
| P5 evidence capture | Preserves all eight reports and hashes tested dist/index.html plus dist/studio-manifest.json before subsequent rebuild | NO |
| Digest-pinned GARP27 Foundation build-production | Deletes/rebuilds dist, produces a required hashed proof log | NO |
| Foundation contracts/architecture/mutations/auto-patch | Ten required GARP proofs overall; checks active built dist | NO |
| Foundation legacy GARP25, promotion/dispatch, assurance | Dist-school-server and policy admission with hashed evidence | NO |
| prepare:pages | Seals complete P5/GARP evidence, removes QA from public build, generates release identity | NO |
| Production deploy pre-Foundation build | Necessary for school profile, deploy provenance and protected-SHA checks | NO without workflow migration |
| Production Foundation and seal | Independent release admission on exact main SHA | NO |

## Direct build-reuse blocker

scripts/build.mjs embeds GHRAB_BUILD_TIME or the current ISO timestamp, creating potentially different manifest bytes on each build even with identical source SHA. scripts/garp27/architecture-integrity.mjs reads built dist bytes and enforces production test-hook status; scripts/garp27/auto-patch-contract.mjs hashes dist/index.html. The two security passes therefore do not automatically inspect the same bytes.

Never remove the earlier build or security static suite solely because command names look redundant.

## New audit-only instrumentation

After P5 report capture and independently successful digest-pinned GARP Foundation, but before release preparation, scripts/ci-p2b-build-parity.mjs:
- reads the source-SHA-bound P5 evidence receipt
- compares exact SHA-256 and sizes of dist/index.html and dist/studio-manifest.json against the Foundation rebuild
- reports BYTE_IDENTICAL only if both match; otherwise reports BYTE_DRIFT
- treats any stale source SHA, missing file, malformed receipt or forged digest as an error, never as a positive result
- writes only under RUNNER_TEMP/ci-metrics, outside both public dist and signed P5 evidence
- uploads a separate GitHub Actions artifact not used for release admission

Ten negative/positive tests exercise true matches, both drift scenarios and evidence/identity failures. The report is diagnostic, not a replacement for P5, GARP Foundation, axe, Safe Promotion or live verification.

## Next decision

Inspect a real P2B Actions artifact and collect five or more successful independent CI observations. If rebuild bytes differ, do not deduplicate the build or pre-Foundation GARP suite without a separate deterministic-build and trust-equivalence specification, signed-off negative tests and safe protected release. No GARP trusted source or pinned digest is changed here.
