import fs from 'node:fs';
import path from 'node:path';

export function resolveGarpEvidenceDir(root, requested = '') {
  const evidenceDir = String(requested || 'garp22-current');
  if (!/^[A-Za-z0-9._-]+$/.test(evidenceDir) || evidenceDir === '.' || evidenceDir === '..') {
    throw new Error('Invalid GARP_EVIDENCE_DIR');
  }

  const auditRoot = path.resolve(root, 'audit-evidence');
  fs.mkdirSync(auditRoot, { recursive: true });
  const evidenceRoot = path.resolve(auditRoot, evidenceDir);
  if (evidenceRoot === auditRoot || !evidenceRoot.startsWith(`${auditRoot}${path.sep}`)) {
    throw new Error('Invalid GARP_EVIDENCE_DIR');
  }

  fs.mkdirSync(evidenceRoot, { recursive: true });
  const realAuditRoot = fs.realpathSync(auditRoot);
  const realEvidenceRoot = fs.realpathSync(evidenceRoot);
  if (realEvidenceRoot === realAuditRoot || !realEvidenceRoot.startsWith(`${realAuditRoot}${path.sep}`)) {
    throw new Error('Invalid GARP_EVIDENCE_DIR');
  }

  return Object.freeze({ evidenceDir, evidenceRoot, auditRoot });
}
