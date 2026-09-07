# KS 5.10.25 – GARP 2.5.1 assurance crosswalk

Tento crosswalk je mapování kontrol, **nikoli certifikace** podle externího standardu.

| GARP oblast | Interní důkaz | Externí referenční rodina |
|---|---|---|
| Threat model / attack surface | `SECURITY-THREAT-MODEL.md`, `SECURITY-ATTACK-SURFACE.md` | NIST SSDF 1.1, OWASP ASVS 5.0.0 |
| Secure build / pinned inputs | package-lock, SHA-pinned GitHub Actions, provenance | NIST SSDF PS/PO, SLSA 1.2 concepts |
| SBOM / dependency inventory | `ks-5.10.25.cdx.json` | CycloneDX 1.7 |
| XSS / browser boundary | XSS sink QA, CSP config, SW controls | OWASP ASVS 5.0.0 |
| AI prompt/data boundary | GARP AIR evidence + 8 operation registry | OWASP GenAI LLM Top 10 2026 |
| Agentic controls | `AGENTIC=NO` call-graph evidence | OWASP Agentic Top 10 2026 – N/A where no agent capability exists |
| Release integrity | RI v2 manifest/signature/trust root/registry | SSDF/SLSA supply-chain concepts |
| Runtime server design | `DEPLOYMENT-SECURITY.md`, resource budget | NIST SSDF 1.1 / SP 800-218A concepts |
| Evidence integrity | evidence manifest | GARP 2.5.1 SH-DET controls |

Pinned source list for interpretation is `33-REFERENCES-OFFICIAL-PINNED.txt` from GARP 2.5.1. No claim of ASVS/SLSA/NIST certification or maturity level is made.

Cross-repo byte-identita sdíleného error reporteru není tímto repozitářem prokázána; ověřena je pouze shoda source → dist → dist-school-server uvnitř KS.
