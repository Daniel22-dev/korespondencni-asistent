# KS 5.10.25 – build profile attestation

- appId: `correspondence`
- build profile under audit: `school-server`
- auth mode: `server-session`
- AI transport: `school-gateway`
- allowed local provider keys: `false`
- browser provider origin in school CSP: forbidden
- app base / Studio base: same-origin absolute paths from active deployment contract
- deterministic audit build time: provided via `GHRAB_BUILD_TIME`; default developer builds retain current-time behavior
- production private signing key: not present

The school build still contains the common GHRAB AI Core implementation, including its direct adapter, but the active runtime allowlist contains only `school-gateway`; explicit runtime mode-switch negative control must reject `direct-gemini`.
