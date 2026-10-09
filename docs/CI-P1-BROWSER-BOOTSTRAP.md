# CI/CD P1 - browser bootstrap instrumentation

Scope: measuring the cost of Playwright/Chromium bootstrap in the independent P5 and axe jobs. No caching, no test removal, no change to release admission.

## Historical baseline: five successful P5 jobs

Date: 2026-10-09. Values below are measured from GitHub Actions step timestamps; they measure job **execution**, not queue time. These are five successful but not identical revisions, so treat the sample as a baseline distribution rather than a controlled A/B experiment.

| GitHub job ID | Job total (s) | Chromium `--with-deps` (s) | npm ci (s) | P5 QA (s) |
|---|---:|---:|---:|---:|
| 113712966763 | 72.8 | 19.4 | 0.9 | 36.3 |
| 113711911573 | 85.2 | 23.1 | 1.5 | 39.2 |
| 113711310673 | 83.2 | 24.3 | 1.2 | 36.9 |
| 113701999877 | 85.2 | 22.9 | 1.4 | 39.1 |
| 113704166559 | 103.0 | 34.3 | 2.6 | 40.7 |
| **Median** | **85.2** | **23.1** | **1.4** | **39.1** |

Independent axe baseline on the successful main-release job 113712966733: job 35.9 s, Playwright bootstrap 23.3 s, axe execution 7.2 s. Axe runs in parallel and is not the critical path for this sample.

## Instrumentation

- P5 and axe continue to install exact pinned Playwright 1.61.1 and full Chromium for CDP-based browser tests.
- Split the original `playwright install --with-deps chromium` into the equivalent two explicit commands: `playwright install-deps chromium` and `playwright install chromium`. Their timings are recorded separately in JSON as OS dependencies and browser installation.
- Log-derived durations for Chrome for Testing, FFmpeg and headless shell are present only when download-start and download-complete events were observed. A cache hit or absent event is **not** represented as zero seconds.
- Verify that the full Chromium executable exists and responds to `--version` before exporting `CHROMIUM_PATH`.
- Upload **separate, private GitHub Actions artifacts** for timing JSON from both independent jobs. These files never enter `dist`, the Pages deployment or the P5/GARP evidence manifest.
- Browser installation failure remains blocking. No cache or download suppression is introduced.

## Post-change measurements

Collect at least five successful main/candidate/PR runs with the same Playwright version and Ubuntu runner image. Compare the new `osDependencies`, `browserInstall`, `executableVerification` and job total to the baseline above. Record P5 and axe independently and distinguish workflow/job queue delay (`created_at`, `run_started_at`, job start) from execution. Run the P2 experiment separately and only after P1 proves trustworthy data capture.

## Rollback

Restore the original two-line `npx playwright install --with-deps chromium` plus `CHROMIUM_PATH` export in each workflow, remove the new bootstrap script, its unit tests and timing-only uploads. P5, GARP, axe, Safe Promotion and release identity must remain unchanged.
