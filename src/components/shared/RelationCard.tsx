import { useState } from "react";
import type { Claim } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { getPredicateLabel } from "../../domain/relationLabels";
import { kindIcon, CERTAINTY_COLORS } from "./entityConstants";
import { EvidenceCard } from "./EvidenceCard";

interface ClaimCardProps {
  claim: Claim;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
  searchQuery?: string;
}

export function ClaimCard({ claim, entityId, entityType, onSelectEntity, searchQuery = "" }: ClaimCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  const isSubject = claim.subject_type === entityType && claim.subject_id === entityId;
  const othKind   = isSubject ? claim.object_type : claim.subject_type;
  const othId     = isSubject ? claim.object_id   : claim.subject_id;
  const predLabel = getPredicateLabel(claim.predicate_id, isSubject);
  const othLabel  = othId ? getEntityLabel(othKind, othId) : (claim.value_text || claim.value_year?.toString() || "");

  const certainty = claim.certainty || "";

  const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
  const hasMeta  = evidence.length > 0;

  const yearRange = claim.year_start
    ? `AD ${claim.year_start}${claim.year_end && claim.year_end !== claim.year_start ? `–${claim.year_end}` : ""}`
    : "";
  const contextPlaceLabel = claim.context_place_id ? getEntityLabel("place", claim.context_place_id) : "";

  return (
    <div className="rel-card">
      <div className="rel-card-main" onClick={() => othId && onSelectEntity(othKind, othId)}>
        <span className="rel-card-icon">{kindIcon(othKind)}</span>
        <div className="rel-card-body">
          <div className="rel-card-name">{othLabel}</div>
          <div className="rel-card-rel">
            {predLabel}
            {yearRange && <span className="rel-card-year">{yearRange}</span>}
          </div>
        </div>
        <div className="rel-card-badges">
          {certainty && certainty !== "attested" && (
            <span
              className="rel-certainty"
              style={{ color: CERTAINTY_COLORS[certainty] ?? "var(--text-faint)" }}
              title={certainty}
            >
              {certainty}
            </span>
          )}
          {hasMeta && (
            <button
              type="button"
              className="rel-expand-btn"
              onClick={(e) => { e.stopPropagation(); setShowEvidence((s) => !s); }}
              title={showEvidence ? "Hide evidence" : "Show evidence"}
            >
              {showEvidence ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {showEvidence && (
        <div className="rel-card-evidence">
          {claim.context_place_id && (
            <div className="ev-card" style={{ padding: "4px 8px" }}>
              <span className="faint">context</span>
              <button type="button" className="mention-link"
                onClick={() => onSelectEntity("place", claim.context_place_id)}>
                {contextPlaceLabel}
              </button>
            </div>
          )}
          {evidence.map((ev) => (
            <EvidenceCard key={`${ev.claim_id}-${ev.passage_id}`} ev={ev} onSelectEntity={onSelectEntity} />
          ))}
        </div>
      )}

    </div>
  );
}

