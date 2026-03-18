import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Claim, ClaimEvidence } from "../data/types";

export type ClaimAuditStatus = "no-evidence" | "unreviewed" | "disputed" | "needs-revision" | "approved" | "ok";

export function getSourceTier(sourceKind: string): "tier_1" | "tier_2" | "tier_3" {
  if (["primary_text", "inscription"].includes(sourceKind)) return "tier_1";
  if (["modern_book", "journal_article", "reference_work"].includes(sourceKind)) return "tier_2";
  return "tier_3";
}

export function computeAvgWeight(evidence: ClaimEvidence[]): number | null {
  const scored = evidence.filter((e) => e.evidence_role === "supports" && e.evidence_weight != null);
  if (scored.length === 0) return null;
  return scored.reduce((s, e) => s + (e.evidence_weight ?? 0), 0) / scored.length;
}

export const COMPUTED_FLAG_INFO: Record<string, { label: string; severity: "red" | "orange" | "yellow" }> = {
  PARAPHRASE_RISK: { label: "Paraphrase risk", severity: "orange" },
  UNSCORED_WEIGHT: { label: "Unscored weight", severity: "yellow" },
  TERTIARY_ONLY:   { label: "Tertiary sources only", severity: "orange" },
  WEIGHT_TENSION:  { label: "Weight vs certainty tension", severity: "red" },
  NO_SUPPORTS:     { label: "No supports evidence", severity: "red" },
};

export function getComputedFlags(claim: Claim, evidence: ClaimEvidence[]): string[] {
  const flags: string[] = [];
  const supports = evidence.filter((e) => e.evidence_role === "supports");
  if (evidence.length === 0) return flags;
  if (supports.length === 0) { flags.push("NO_SUPPORTS"); return flags; }
  if (supports.some((e) => e.evidence_weight == null)) flags.push("UNSCORED_WEIGHT");
  for (const ev of supports) {
    const passage = dataStore.passages.getById(ev.passage_id);
    if (passage?.excerpt?.startsWith("Paraphrase:") && ev.support_aspect === "whole_claim" && ev.assertion_mode === "explicit") {
      flags.push("PARAPHRASE_RISK");
      break;
    }
  }
  if (supports.length > 0) {
    const allTertiary = supports.every((ev) => {
      const passage = dataStore.passages.getById(ev.passage_id);
      const source = passage ? dataStore.sources.getById(passage.source_id) : null;
      return !source || getSourceTier(source.source_kind) === "tier_3";
    });
    if (allTertiary) flags.push("TERTIARY_ONLY");
  }
  const avg = computeAvgWeight(evidence);
  if (avg !== null) {
    if (avg < 0.5 && claim.certainty === "attested") flags.push("WEIGHT_TENSION");
    else if (avg >= 0.9 && claim.certainty === "possible") flags.push("WEIGHT_TENSION");
  }
  return flags;
}

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
    case "no-evidence":    return "borderRed";
    case "unreviewed":
    case "needs-revision": return "borderOrange";
    case "disputed":       return "borderRed";
    case "approved":       return "borderGreen";
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
  yearLabel: string;
  yearSort: number | null;
  latestReviewAt: string;
  avgWeight: number | null;
  hasUnscoredSupports: boolean;
  computedFlags: string[];
}

let _auditCache: ClaimAuditRow[] | null = null;

export function getAuditRows(): ClaimAuditRow[] {
  if (_auditCache) return _auditCache;
  const all = dataStore.claims
    .getAll()
    .filter((c) => c.claim_status === "active");
  const dupeMap = new Map<string, number>();
  for (const c of all) {
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    dupeMap.set(key, (dupeMap.get(key) ?? 0) + 1);
  }
  _auditCache = all.map((c) => {
    const ev = dataStore.claimEvidence.getForClaim(c.claim_id);
    const rv = dataStore.claimReviews.getForClaim(c.claim_id);
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    const ys = c.year_start;
    const ye = c.year_end;
    const vy = c.value_year;
    let yearLabel = "";
    let yearSort: number | null = null;
    if (vy != null) { yearLabel = String(vy); yearSort = vy; }
    else if (ys != null) { yearLabel = ye != null && ye !== ys ? `${ys}–${ye}` : String(ys); yearSort = ys; }
    const latestReviewAt = rv.length > 0
      ? rv.reduce((best, r) => r.reviewed_at > best ? r.reviewed_at : best, "")
      : "";
    const supportEvidence = ev.filter((e) => e.evidence_role === "supports");
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
      yearLabel,
      yearSort,
      latestReviewAt,
      avgWeight: computeAvgWeight(ev),
      hasUnscoredSupports: supportEvidence.some((e) => e.evidence_weight == null),
      computedFlags: getComputedFlags(c, ev),
    };
  });
  return _auditCache;
}
