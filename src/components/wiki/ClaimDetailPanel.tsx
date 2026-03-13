import s from "./Wiki.module.css";
import { dataStore } from "../../data/dataStore";
import { EntityLink } from "../shared/EntityLink";
import { EvidenceCard } from "../shared/EvidenceCard";
import { REVIEW_META } from "../../utils/entityListHelpers";
import { formatReviewDate } from "../../utils/formatYear";

interface ClaimDetailPanelProps {
  claimId: string;
  onSelectEntity: (kind: string, id: string) => void;
  onClose: () => void;
  focusKind?: string;
}

export function ClaimDetailPanel({ claimId, onSelectEntity, onClose, focusKind }: ClaimDetailPanelProps) {
  const claim = dataStore.claims.getById(claimId);
  if (!claim) return null;
  const evidence = dataStore.claimEvidence.getForClaim(claimId);
  const reviews  = dataStore.claimReviews.getForClaim(claimId);
  const fields: [string, string][] = [
    ["ID", claim.claim_id], ["Status", claim.claim_status], ["Predicate", claim.predicate_id],
    ["Subject", `${claim.subject_type}: ${claim.subject_id}`],
    ["Object mode", claim.object_mode],
  ];
  if (claim.object_mode === "entity") fields.push(["Object", `${claim.object_type}: ${claim.object_id}`]);
  else if (claim.value_text) fields.push(["Value (text)", claim.value_text]);
  else if (claim.value_year != null) fields.push(["Value (year)", String(claim.value_year)]);
  else if (claim.value_boolean != null) fields.push(["Value (bool)", String(claim.value_boolean)]);
  fields.push(["Certainty", claim.certainty]);
  if (claim.year_start != null) fields.push(["Year start", String(claim.year_start)]);
  if (claim.year_end != null) fields.push(["Year end", String(claim.year_end)]);
  if (claim.context_place_id) fields.push(["Context place", claim.context_place_id]);
  if (claim.created_by) fields.push(["Created by", claim.created_by]);
  if (claim.updated_at) fields.push(["Updated", claim.updated_at]);

  return (
    <div className={s.detailPanel}>
      <div className={s.detailHeader}>
        <span className={s.detailTitle}>🔗 Claim Detail</span>
        <button type="button" className={s.closeBtn} onClick={onClose}>✕</button>
      </div>
      <div className={s.detailBody}>
        <div className={s.detailSection}>
          <div className={s.detailSectionTitle}>Entities</div>
          <div className={s.detailEntityRow}>
            <EntityLink kind={claim.subject_type} id={claim.subject_id} onClick={() => onSelectEntity(claim.subject_type, claim.subject_id)} />
            <span className={s.arrowPred}>{claim.predicate_id.replace(/_/g, " ")}</span>
            {claim.object_mode === "entity" && claim.object_id ? (
              <EntityLink kind={claim.object_type} id={claim.object_id} onClick={() => onSelectEntity(claim.object_type, claim.object_id)} />
            ) : (
              <span className={s.claimValue}>{claim.value_text || claim.value_year || ""}</span>
            )}
          </div>
        </div>
        <div className={s.detailSection}>
          <div className={s.detailSectionTitle}>All fields</div>
          <div className={s.fieldsGrid}>
            {fields.map(([k, v]) => (
              <div key={k} className={s.fieldsRow}><span className={s.fieldKey}>{k}</span><span className={s.fieldVal}>{v}</span></div>
            ))}
          </div>
        </div>
        <div className={s.detailSection}>
          <div className={s.detailSectionTitle}>Evidence ({evidence.length})</div>
          {evidence.length === 0 ? <div className={s.emptySub}>⚠ No evidence linked.</div> : (
            <div className={s.flexCol8}>
              {evidence.map((ev) => (
                <EvidenceCard key={ev.passage_id} ev={ev} onSelectEntity={onSelectEntity} hideWorkLink={focusKind === "work"} />
              ))}
            </div>
          )}
        </div>
        <div className={s.detailSection}>
          <div className={s.detailSectionTitle}>Reviews ({reviews.length})</div>
          {reviews.length === 0 ? <div className={s.emptySub}>○ Not reviewed.</div> : (
            <div className={s.flexCol8}>
              {reviews.map((r, i) => {
                const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
                const timestamp = formatReviewDate(r.reviewed_at);
                return (
                  <div key={i} className={s.reviewDetail}>
                    <div className={s.reviewDetailHead}>
                      <span className={`${s.reviewBadge} ${s[m.cls] ?? ""}`}>{m.icon} {r.review_status}</span>
                      <span className={s.faint}>{r.confidence}</span>
                      {r.reviewer_id && <span className={s.faint}>by {r.reviewer_id}</span>}
                      {timestamp && <span className={s.faint}>{timestamp}</span>}
                    </div>
                    {r.note && <div className={s.reviewNote}>{r.note}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
