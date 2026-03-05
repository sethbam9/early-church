import { useState } from "react";
import type { Relation } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { getRelationLabel } from "../../domain/relationLabels";
import { kindIcon } from "./entityConstants";
import { NoteCard } from "./NoteCard";

interface RelationCardProps {
  relation: Relation;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
  searchQuery?: string;
}

const WEIGHT_LABEL = ["", "Very low", "Low", "Medium", "High", "Very high"];

const CERTAINTY_COLORS: Record<string, string> = {
  attested:  "var(--attested)",
  probable:  "var(--probable)",
  possible:  "#8e8070",
  uncertain: "#c0392b",
};

const POLARITY_META: Record<string, { icon: string; cls: string }> = {
  supports: { icon: "✓", cls: "rel-polarity--supports" },
  opposes:  { icon: "✗", cls: "rel-polarity--opposes"  },
  neutral:  { icon: "~", cls: "rel-polarity--neutral"  },
};

export function RelationCard({ relation, entityId, entityType, onSelectEntity, searchQuery = "" }: RelationCardProps) {
  const [showEvidence, setShowEvidence] = useState(false);

  const isOut   = relation.source_id === entityId && relation.source_type === entityType;
  const othId   = isOut ? relation.target_id   : relation.source_id;
  const othKind = isOut ? relation.target_type : relation.source_type;
  const relLabel = getRelationLabel(relation.relation_type, isOut);
  const othLabel = getEntityLabel(othKind, othId);

  const weight    = relation.weight ?? 0;
  const certainty = relation.certainty || "";
  const polarity  = relation.polarity  || "";
  const pol       = POLARITY_META[polarity];

  const evidenceNote = relation.evidence_note_id
    ? dataStore.notes.getAll().find((n) => n.note_id === relation.evidence_note_id)
    : null;
  const hasMeta = evidenceNote != null || relation.citations.length > 0;
  const yearRange = relation.year_start
    ? `AD ${relation.year_start}${relation.year_end && relation.year_end !== relation.year_start ? `–${relation.year_end}` : ""}`
    : "";

  return (
    <div className="rel-card">
      <div className="rel-card-main" onClick={() => onSelectEntity(othKind, othId)}>
        <span className="rel-card-icon">{kindIcon(othKind)}</span>
        <div className="rel-card-body">
          <div className="rel-card-name">{othLabel}</div>
          <div className="rel-card-rel">
            {relLabel}
            {yearRange && <span className="rel-card-year">{yearRange}</span>}
          </div>
        </div>
        <div className="rel-card-badges">
          {pol && (
            <span className={`rel-polarity ${pol.cls}`} title={polarity}>
              {pol.icon}
            </span>
          )}
          {weight > 0 && (
            <span className="rel-weight" title={WEIGHT_LABEL[weight] ?? ""}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`rel-dot${i < weight ? " rel-dot--filled" : ""}`} />
              ))}
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
          {evidenceNote && (
            <NoteCard
              note={evidenceNote}
              onSelectEntity={onSelectEntity}
              searchQuery={searchQuery}
            />
          )}
          {relation.citations.length > 0 && (
            <div className="rel-citations">
              {relation.citations.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
