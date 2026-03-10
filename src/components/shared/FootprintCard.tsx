import { useState } from "react";
import type { EntityPlaceFootprint } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { kindIcon } from "./entityConstants";
import { BibleOverlay } from "./BibleOverlay";
import { locatorToDisplay } from "../../utils/bibleApi";

interface FootprintCardProps {
  footprint: EntityPlaceFootprint;
  showEntity?: boolean;
  showPlace?: boolean;
  onSelectEntity: (kind: string, id: string) => void;
}

export function FootprintCard({ footprint: f, showEntity = true, showPlace = false, onSelectEntity }: FootprintCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [bibleLocator, setBibleLocator] = useState<string | null>(null);

  const clickTarget = showPlace ? { kind: "place", id: f.place_id } : { kind: f.entity_type, id: f.entity_id };
  const primaryLabel = showPlace
    ? getEntityLabel("place", f.place_id)
    : getEntityLabel(f.entity_type, f.entity_id);
  const primaryIcon = showPlace ? kindIcon("place") : kindIcon(f.entity_type);

  const backingClaims = dataStore.claims.getBackingForFootprint(f);
  const hasEvidence = backingClaims.some((c) => dataStore.claimEvidence.getForClaim(c.claim_id).length > 0);

  return (
    <div className="conn-card conn-card--col">
      <div className="conn-card-row" onClick={() => onSelectEntity(clickTarget.kind, clickTarget.id)}>
        <span className="conn-icon">{primaryIcon}</span>
        <div className="conn-card-body">
          <div className="conn-name">{primaryLabel}</div>
          <div className="conn-rel">
            {showPlace ? f.entity_type : "place"} · {f.reason_predicate_id.replace(/_/g, " ")}
            {f.year_start ? ` · AD ${f.year_start}` : ""}
            {f.year_end && f.year_end !== f.year_start ? `–${f.year_end}` : ""}
            {f.stance ? ` · ${f.stance}` : ""}
          </div>
        </div>
        {hasEvidence && (
          <button
            type="button"
            className="rel-expand-btn"
            onClick={(e) => { e.stopPropagation(); setExpanded((s) => !s); }}
            title={expanded ? "Hide evidence" : "Show evidence"}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="evidence-detail">
          {backingClaims.map((claim) => {
            const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
            if (evidence.length === 0) return null;
            return evidence.map((ev) => {
              const passage = dataStore.passages.getById(ev.passage_id);
              const source = passage ? dataStore.sources.getById(passage.source_id) : null;
              return (
                <div key={`${ev.claim_id}-${ev.passage_id}`} className="evidence-item">
                  <span className="faint">{ev.evidence_role}</span>
                  {passage && (
                    <button
                      type="button"
                      className="bible-ref-btn evidence-locator"
                      onClick={(e) => { e.stopPropagation(); setBibleLocator(passage.locator); }}
                      title={`Look up ${locatorToDisplay(passage.locator)}`}
                    >
                      {locatorToDisplay(passage.locator)}
                    </button>
                  )}
                  {passage?.excerpt && <div className="evidence-excerpt">{passage.excerpt}</div>}
                  {source?.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="citation-link evidence-source">
                      {source.title}
                    </a>
                  )}
                </div>
              );
            });
          })}
        </div>
      )}

      {bibleLocator && (
        <BibleOverlay locator={bibleLocator} onClose={() => setBibleLocator(null)} />
      )}
    </div>
  );
}
