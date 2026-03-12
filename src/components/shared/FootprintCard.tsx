import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { EntityPlaceFootprint } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { kindIcon } from "./entityConstants";
import { EvidenceCard } from "./EvidenceCard";
import { getPredicateLabel } from "../../domain/relationLabels";

function claimLine(c: { subject_type: string; subject_id: string; predicate_id: string; object_mode: string; object_type: string; object_id: string; value_text?: string; value_year?: number | null; claim_id: string }) {
  const subLabel = getEntityLabel(c.subject_type, c.subject_id);
  const predLabel = getPredicateLabel(c.predicate_id, true);
  const objLabel = c.object_mode === "entity" && c.object_id
    ? getEntityLabel(c.object_type, c.object_id)
    : (c.value_text || c.value_year?.toString() || "");
  return (
    <div key={c.claim_id} style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
      {kindIcon(c.subject_type)} <strong>{subLabel}</strong>
      <span style={{ color: "var(--text-faint)" }}> {predLabel} </span>
      {kindIcon(c.object_type || "")} <strong>{objLabel}</strong>
    </div>
  );
}

function DerivationTooltip({ anchorRef, footprint }: {
  anchorRef: React.RefObject<HTMLElement | null>;
  footprint: EntityPlaceFootprint;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.top - 4;
    let left = rect.right + 8;
    if (left + 280 > window.innerWidth) left = rect.left - 288;
    if (top + 160 > window.innerHeight) top = window.innerHeight - 168;
    if (top < 4) top = 4;
    setPos({ top, left });
  }, [anchorRef]);

  const trace = dataStore.claims.getTraceForFootprint(footprint);
  const hasContent = trace.mode === "direct" ? trace.claims.length > 0
    : trace.paths.length > 0;

  if (!pos || !hasContent) return null;
  return createPortal(
    <div className="entity-hover-card" style={{ top: pos.top, left: pos.left, pointerEvents: "none" }}>
      <div className="entity-hover-card-kind">Derivation trail</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
        {trace.mode === "direct" ? (
          trace.claims.map((c) => claimLine(c))
        ) : (
          trace.paths.map((p, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, borderBottom: i < trace.paths.length - 1 ? "1px solid var(--border-subtle)" : undefined, paddingBottom: 3 }}>
              {claimLine(p.propositionClaim)}
              {claimLine(p.placeClaim)}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

interface FootprintCardProps {
  footprint: EntityPlaceFootprint;
  showEntity?: boolean;
  showPlace?: boolean;
  onSelectEntity: (kind: string, id: string) => void;
}

export function FootprintCard({ footprint: f, showEntity = true, showPlace = false, onSelectEntity }: FootprintCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const clickTarget = showPlace ? { kind: "place", id: f.place_id } : { kind: f.entity_type, id: f.entity_id };
  const primaryLabel = showPlace
    ? getEntityLabel("place", f.place_id)
    : getEntityLabel(f.entity_type, f.entity_id);
  const primaryIcon = showPlace ? kindIcon("place") : kindIcon(f.entity_type);

  const backingClaims = dataStore.claims.getBackingForFootprint(f);
  const hasEvidence = backingClaims.some((c) => dataStore.claimEvidence.getForClaim(c.claim_id).length > 0);

  return (
    <div className="conn-card conn-card--col" ref={cardRef}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && <DerivationTooltip anchorRef={cardRef} footprint={f} />}
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
        <div className="rel-card-evidence">
          {backingClaims.map((claim) => {
            const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
            if (evidence.length === 0) return null;
            return evidence.map((ev) => (
              <EvidenceCard key={`${ev.claim_id}-${ev.passage_id}`} ev={ev} onSelectEntity={onSelectEntity} />
            ));
          })}
        </div>
      )}
    </div>
  );
}
