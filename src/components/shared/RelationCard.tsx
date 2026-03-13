import { useState } from "react";
import type { Claim } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { getPredicateLabel } from "../../domain/relationLabels";
import { kindIcon } from "./entityConstants";
import { CertaintyBadge } from "./CertaintyBadge";
import { EvidenceCard } from "./EvidenceCard";
import { EntityLink } from "./EntityLink";
import rc from "./RelationCard.module.css";

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
    <div className={rc.card}>
      <div className={rc.main} onClick={() => othId && onSelectEntity(othKind, othId)}>
        <span className={rc.icon}>{kindIcon(othKind)}</span>
        <div className={rc.body}>
          <div className={rc.name}>{othLabel}</div>
          <div className={rc.rel}>
            {predLabel}
            {yearRange && <span className={rc.year}>{yearRange}</span>}
          </div>
        </div>
        <div className={rc.badges}>
          <CertaintyBadge value={certainty} />
          {hasMeta && (
            <button type="button" className={rc.expandBtn}
              onClick={(e) => { e.stopPropagation(); setShowEvidence((v) => !v); }}
              title={showEvidence ? "Hide evidence" : "Show evidence"}>
              {showEvidence ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>
      {showEvidence && (
        <div className={rc.evidence}>
          {claim.context_place_id && (
            <div className={`${rc.stackSm} ${rc.contextPad}`}>
              <span className={rc.textMuted}>context</span>
              <EntityLink kind="place" id={claim.context_place_id} label={contextPlaceLabel}
                onClick={() => onSelectEntity("place", claim.context_place_id)} />
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

