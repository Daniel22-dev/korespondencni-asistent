# P2B phase 3 — complete production-dist tree parity

This diagnostic extends the **already-certified two-file byte-parity proof** to the complete application output tree within one P5 CI runner.

## Motivation
The P5 browser and static QA phases write temporary test reports into `dist/`. The separately trusted GARP 2.7 Foundation rebuild deletes and recreates `dist/`; missing QA reports are expected, but **missing or changed production files are not**.

## How it works
The `capture` stage runs after successful P5 evidence capture and immediately before the trusted Foundation gate. It inventories **every regular file** under `dist/`, including zero-byte files, with its relative path, size and SHA-256. It rejects symlinks, missing/non-regular files, wrong P5 source SHA, wrong P5 run ID, or discrepancies in the two files already hashed in the P5 receipt.

The `compare` stage runs directly after the independent Foundation rebuild. It fingerprints every file in the rebuilt `dist/` and compares names, sizes and SHA-256 to the earlier inventory. It reports four separate classes:

- `matched`: unchanged production files present in both stages.
- `byteDrift`: same path but different size and/or SHA-256.
- `afterOnly`: new Foundation build files that were absent in P5.
- `expectedQaOnly`: P5-only known transient `qa-*.json`, `quality-report.json` and `config/quality-manifest.json` files.
- `unexplainedBeforeOnly`: P5-only files not classified as known QA outputs.

Only when no drift, unexpected new files or unexplained lost files exist does the diagnostic say `PRODUCTION_TREE_IDENTICAL`. The full before/after summaries and complete QA-only names remain visible for human audit. A mismatch is **diagnostic**, not an independent release authorization decision.

Both JSON outputs live in runner-temp `ci-metrics`, uploaded as a **separate Actions-only artifact**, never into public Pages assets or P5/GARP signed evidence.

## Trust boundaries
Exact checked source SHA, run ID, run attempt, and shared ISO-8601 build timestamp must match between capture and compare. The code rejects output paths inside the entire repository, including `dist` and `qa-results`.

Existing P5, GARP 2.7 trusted Foundation (10/10 SHA256 logs), GARP 2.5.1 legacy, independent axe, Safe Promotion, deploy and live verification remain **unchanged**. No tests or builds are removed. No GARP trust hash or protected source is modified.

## Acceptance
1. 13 synthetic positive/negative tests pass, including source/run/time drift, altered/nested/removed/added files and symlink/diagnostic path defenses.
2. Run P5 and independent axe on real PR SHA, inspect downloaded full-tree diagnostic artifact, then candidate and protected main certification.
3. Gather 5+ independent CI examples before deciding whether early GARP static and Foundation security contexts could safely be consolidated.
4. Never equate within-run tree equivalence with equivalent **security test semantics** or with cross-run production deployment parity. No performance speedup is claimed by this audit.
