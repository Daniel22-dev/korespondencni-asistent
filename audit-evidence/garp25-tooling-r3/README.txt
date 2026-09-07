GARP 2.5.1 Tooling R3 evidence
- N11 exact variants: w3 bracket addAll, w4 bound alias, w5 static string concat, w9 importScripts.
- Required result: no silent PASS. Actual: FAIL / FAIL / FAIL / AMBER.
- Both local and canonical selftests: 47/47 PASS.
- Canonical common TOOLS and KS scripts/garp25 copies: byte-identical.
- Frozen runtime comparison: dist and dist-school-server unchanged; frozen deployment diff is empty.
- N12 historical R2 evidence corrected transparently in audit-evidence/garp25-tooling-r2 with original inconsistent v6 preserved.
