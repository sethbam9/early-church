import { useState } from "react";
import s from "./Wiki.module.css";
import { dataStore } from "../../data/dataStore";
import type { Claim } from "../../data/types";
import { getPredicateLabel } from "../../domain/relationLabels";
import { EntityLink } from "../shared/EntityLink";
import { EvidenceCard } from "../shared/EvidenceCard";
import { getClaimAuditStatus, getClaimBorderClass } from "../../utils/claimAudit";
import { REVIEW_META } from "../../utils/entityListHelpers";
import { formatYearRange, formatReviewDate } from "../../utils/formatYear";
import { CertaintyBadge } from "../shared/CertaintyBadge";

interface ClaimRowProps {
  claim: Claim;
  focusKind: string;
  focusId: string;
  onSelectEntity: (kind: string, id: string) => void;
  onSelectClaim: (claimId: string) => void;
  isSelected: boolean;
  roleFilter?: string | null;
}

export function ClaimRow({ claim, focusKind, focusId, onSelectEntity, onSelectClaim, isSelected, roleFilter }: ClaimRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isSubject  = claim.subject_type === focusKind && claim.subject_id === focusId;
  const othKind    = isSubject ? claim.object_type  : claim.subject_type;
  const othId      = isSubject ? claim.object_id    : claim.subject_id;
  const predLabel  = getPredicateLabel(claim.predicate_id, isSubject);
  const auditStatus = getClaimAuditStatus(claim);
  const borderCls   = getClaimBorderClass(auditStatus);
  const evidence    = dataStore.claimEvidence.getForClaim(claim.claim_id);
  const reviews     = dataStore.claimReviews.getForClaim(claim.claim_id);

  const yearRange = formatYearRange(claim.year_start, claim.year_end);

  return (
    <div className={`${s.claimRow} ${s[borderCls] ?? ""}${isSelected ? ` ${s.claimRowSelected}` : ""}`}>
      <div className={s.claimMain} onClick={() => onSelectClaim(claim.claim_id)}>
        <div className={s.claimLeft}>
          <span className={s.predLabel}>{predLabel}</span>
          {othId && claim.object_mode === "entity" ? (
            <EntityLink kind={othKind} id={othId} onClick={() => onSelectEntity(othKind, othId)} />
          ) : (
            <span className={s.claimValue}>
              {claim.value_text || (claim.value_year != null ? `${claim.value_year}` : "") || (claim.value_boolean != null ? String(claim.value_boolean) : "")}
            </span>
          )}
          {claim.context_place_id && (
            <span className={s.contextPlace}>
              <span className={s.faint}>@ </span>
              <EntityLink kind="place" id={claim.context_place_id} onClick={() => onSelectEntity("place", claim.context_place_id)} />
            </span>
          )}
        </div>
        <div className={s.claimRight}>
          {yearRange && <span className={s.year}>{yearRange}</span>}
          <CertaintyBadge value={claim.certainty ?? ""} />
          {reviews.map((r, i) => {
            const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
            const timestamp = formatReviewDate(r.reviewed_at);
            return <span key={i} className={`${s.reviewBadge} ${s[m.cls] ?? ""}`} title={`${r.review_status} · ${r.confidence} · ${r.reviewer_id}${timestamp ? ` · ${timestamp}` : ''}`}>{m.icon}</span>;
          })}
          <span className={s.evCount} title={`${evidence.length} evidence link(s)`}>
            {evidence.length}ev
          </span>
          <button type="button" className={s.expandBtn} onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className={s.claimEvidence}>
          {evidence.length === 0 && <div className={s.emptySub}>No evidence linked.</div>}
          {evidence
            .filter((ev) => !roleFilter || roleFilter === "all" || ev.evidence_role === roleFilter)
            .map((ev) => <EvidenceCard key={ev.passage_id} ev={ev} onSelectEntity={onSelectEntity} hideWorkLink={focusKind === "work"} />)}
          {reviews.length > 0 && (
            <div className={s.claimReviewsInline}>
              {reviews.map((r, i) => {
                const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
                const timestamp = formatReviewDate(r.reviewed_at);
                return (
                  <div key={i} className={s.reviewInline}>
                    <span className={`${s.reviewBadge} ${s[m.cls] ?? ""}`}>{m.icon} {r.review_status}</span>
                    <span className={s.faint}>{r.confidence}</span>
                    {r.reviewer_id && <span className={s.faint}>by {r.reviewer_id}</span>}
                    {timestamp && <span className={s.faint}>{timestamp}</span>}
                    {r.note && <span className={s.reviewNoteInline}>{r.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
