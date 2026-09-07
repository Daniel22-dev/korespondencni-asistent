# GARP 2.5.1 – upstream errata N17 / Tooling R5

Independent R4 verification identified one remaining silent-PASS class in `check-sw-security-freeze.mjs`: Cache write methods detached from a demonstrated Cache object before invocation.

R5 policy:
- `Reflect.get(cache, "addAll")...` -> unresolved / AMBER unless the write can be proven;
- destructured Cache methods -> unresolved / AMBER when invoked;
- comma-operator detached member calls `(0, cache.addAll)(...)` -> unresolved / AMBER;
- existing bind alias resolution remains active and a resolvable security-critical write remains FAIL.

The purpose is not to emulate arbitrary JavaScript. The invariant is narrower and fail-closed: a recognized detached Cache-method surface must never disappear into a silent PASS.
