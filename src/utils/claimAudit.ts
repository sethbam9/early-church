import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Claim } from "../data/types";

export type ClaimAuditStatus = "no-evidence" | "unreviewed" | "disputed" | "needs-revision" | "approved" | "ok";

export function getClaimAuditStatus(claim: Claim): ClaimAuditStatus {
  const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
  if (evidence.length === 0) return "no-evidence";
  const reviews = dataStore.claimReviews.getForClaim(claim.claim_id);
  if (reviews.length === 0) return "unreviewed";
  if (reviews.some((r) => r.review_status === "disputed")) return "disputed";
  if (reviews.some((r) => r.review_status === "needs_revision")) return "needs-revision";
  if (reviews.every((r) => r.review_status === "approved")) return "approved";
  return "ok";
}

export function getClaimBorderClass(status: ClaimAuditStatus): string {
  switch (status) {
    case "no-evidence":    return "wiki-border--red";
    case "unreviewed":
    case "needs-revision": return "wiki-border--orange";
    case "disputed":       return "wiki-border--red";
    case "approved":       return "wiki-border--green";
    default:               return "";
  }
}

export interface ClaimAuditRow {
  claim: Claim;
  status: ClaimAuditStatus;
  evidenceCount: number;
  reviewCount: number;
  subjectLabel: string;
  objectLabel: string;
  isDuplicate: boolean;
}

let _auditCache: ClaimAuditRow[] | null = null;

export function getAuditRows(): ClaimAuditRow[] {
  if (_auditCache) return _auditCache;
  const all = dataStore.claims
    .getAll()
    .filter((c) => c.claim_status === "active" && !dataStore.claims.isInfraPredicate(c.predicate_id));
  const dupeMap = new Map<string, number>();
  for (const c of all) {
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    dupeMap.set(key, (dupeMap.get(key) ?? 0) + 1);
  }
  _auditCache = all.map((c) => {
    const ev = dataStore.claimEvidence.getForClaim(c.claim_id);
    const rv = dataStore.claimReviews.getForClaim(c.claim_id);
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    return {
      claim: c,
      status: getClaimAuditStatus(c),
      evidenceCount: ev.length,
      reviewCount: rv.length,
      subjectLabel: getEntityLabel(c.subject_type, c.subject_id),
      objectLabel:
        c.object_mode === "entity" && c.object_id
          ? getEntityLabel(c.object_type, c.object_id)
          : c.value_text || (c.value_year != null ? String(c.value_year) : "") || "",
      isDuplicate: (dupeMap.get(key) ?? 0) > 1,
    };
  });
  return _auditCache;
}
