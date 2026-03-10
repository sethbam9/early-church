import { useState } from "react";
import type { Claim } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { getPredicateLabel } from "../../domain/relationLabels";
import { kindIcon } from "./entityConstants";
import { PassageReference } from "./PassageReference";

interface ClaimCardProps {
  claim: Claim;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
  searchQuery?: string;
}

const CERTAINTY_COLORS: Record<string, string> = {
  attested:  "var(--attested)",
  probable:  "var(--probable)",
  possible:  "#8e8070",
  uncertain: "#c0392b",
};

const POLARITY_META: Record<string, { icon: string; cls: string }> = {
  supports:        { icon: "✓", cls: "rel-polarity--supports" },
  opposes:         { icon: "✗", cls: "rel-polarity--opposes"  },
  not_applicable:  { icon: "~", cls: "rel-polarity--neutral"  },
};

export function ClaimCard({ claim, entityId, entityType, onSelectEntity, searchQuery = "" }: ClaimCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  const isSubject = claim.subject_type === entityType && claim.subject_id === entityId;
  const othKind   = isSubject ? claim.object_type : claim.subject_type;
  const othId     = isSubject ? claim.object_id   : claim.subject_id;
  const predLabel = getPredicateLabel(claim.predicate_id, isSubject);
  const othLabel  = othId ? getEntityLabel(othKind, othId) : (claim.value_text || claim.value_year?.toString() || "");

  const certainty = claim.certainty || "";
  const polarity  = claim.polarity  || "";
  const pol       = POLARITY_META[polarity];

  const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
  const hasMeta  = evidence.length > 0;

  const yearRange = claim.year_start
    ? `AD ${claim.year_start}${claim.year_end && claim.year_end !== claim.year_start ? `–${claim.year_end}` : ""}`
    : "";

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
          {pol && polarity !== "not_applicable" && (
            <span className={`rel-polarity ${pol.cls}`} title={polarity}>
              {pol.icon}
            </span>
          )}
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
          {evidence.map((ev) => {
            const passage = dataStore.passages.getById(ev.passage_id);
            const source  = passage ? dataStore.sources.getById(passage.source_id) : null;
            return (
              <div key={`${ev.claim_id}-${ev.passage_id}`} className="evidence-item">
                <span className="faint">{ev.evidence_role}</span>
                {passage && <PassageReference passage={passage} source={source} />}
                {passage?.excerpt && <div className="evidence-excerpt">{passage.excerpt}</div>}
                {source?.url && (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="citation-link evidence-source">
                    {source.title}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

