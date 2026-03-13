import { useState, useMemo } from "react";
import { Claim, dataStore } from "../data/dataStore";
import { getClaimAuditStatus } from "../utils/claimAudit";
import { getEntityAllClaims, EVIDENCE_ROLES, EvidenceRoleFilter } from "../utils/claimHelpers";

export { EVIDENCE_ROLES, getEntityAllClaims };
export type { EvidenceRoleFilter } from "../utils/claimHelpers";

export function useClaimsData(kind: string, id: string) {
  const [roleFilter, setRoleFilter] = useState<EvidenceRoleFilter>("all");
  const [certFilter, setCertFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [predSearch, setPredSearch] = useState("");

  const claims = useMemo(() => getEntityAllClaims(kind, id), [kind, id]);

  const filteredClaims = useMemo(() => {
    let rows = claims;
    if (roleFilter !== "all") {
      rows = rows.filter((c) => {
        const ev = dataStore.claimEvidence.getForClaim(c.claim_id);
        return ev.some((e) => e.evidence_role === roleFilter);
      });
    }
    if (certFilter !== "all") rows = rows.filter((c) => c.certainty === certFilter);
    if (reviewFilter !== "all") {
      rows = rows.filter((c) => {
        const reviews = dataStore.claimReviews.getForClaim(c.claim_id);
        if (reviewFilter === "unreviewed") return reviews.length === 0;
        if (reviewFilter === "reviewed") return reviews.length > 0;
        return reviews.some((r) => r.review_status === reviewFilter);
      });
    }
    if (predSearch) {
      const pq = predSearch.toLowerCase();
      rows = rows.filter((c) => c.predicate_id.includes(pq));
    }
    return rows;
  }, [claims, roleFilter, certFilter, reviewFilter, predSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, Claim[]>();
    for (const c of filteredClaims) {
      const b = map.get(c.predicate_id) ?? [];
      b.push(c);
      map.set(c.predicate_id, b);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredClaims]);

  const stats = useMemo(() => {
    let noEv = 0, unrev = 0, disp = 0, appr = 0;
    for (const c of claims) {
      const s = getClaimAuditStatus(c);
      if (s === "no-evidence") noEv++;
      if (s === "unreviewed") unrev++;
      if (s === "disputed") disp++;
      if (s === "approved") appr++;
    }
    return { total: claims.length, noEv, unrev, disp, appr };
  }, [claims]);

  const editorNotes = useMemo(() => dataStore.editorNotes.getForEntity(kind, id), [kind, id]);

  return {
    // Filters
    roleFilter, setRoleFilter,
    certFilter, setCertFilter,
    reviewFilter, setReviewFilter,
    predSearch, setPredSearch,
    // Data
    claims, filteredClaims, grouped, stats, editorNotes,
  };
}
