import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { EntityPlaceFootprint } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { KindIcon } from "./entityConstants";
import { EvidenceCard } from "./EvidenceCard";
import { DerivationChain } from "./DerivationChain";
import { InfoIcon } from "./InfoIcon";
import { DerivationIcon } from "./DerivationIcon";
import { getPredicateLabel } from "../../domain/relationLabels";
import ehc from "./EntityHoverCard.module.css";
import { ChevronUp, ChevronDown } from "lucide-react";
import fc from "./FootprintCard.module.css";

function claimLine(c: { subject_type: string; subject_id: string; predicate_id: string; object_mode: string; object_type: string; object_id: string; value_text?: string; value_year?: number | null; claim_id: string }) {
  const subLabel = getEntityLabel(c.subject_type, c.subject_id);
  const predLabel = getPredicateLabel(c.predicate_id, true);
  const objLabel = c.object_mode === "entity" && c.object_id
    ? getEntityLabel(c.object_type, c.object_id)
    : (c.value_text || c.value_year?.toString() || "");
  return (
    <div key={c.claim_id} className={`${fc.textMuted} ${fc.claimLine}`}>
      <KindIcon kind={c.subject_type} size={12} /> <strong>{subLabel}</strong>
      <span className={fc.textMuted}> {predLabel} </span>
      <KindIcon kind={c.object_type || ""} size={12} /> <strong>{objLabel}</strong>
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
    let left = rect.right + 8;
    if (left + 320 > window.innerWidth) left = rect.left - 328;
    // Show above if we're in the bottom half of the viewport
    const estimatedHeight = 200;
    let top: number;
    if (rect.bottom + estimatedHeight > window.innerHeight) {
      top = rect.top - estimatedHeight - 4;
      if (top < 4) top = 4;
    } else {
      top = rect.top - 4;
    }
    setPos({ top, left });
  }, [anchorRef]);

  const edgeId = footprint.derived_edge_id;
  const edge = edgeId ? dataStore.derivedEdges.getById(edgeId) : undefined;

  // Fall back to legacy trace when no derived_edge_id
  const trace = !edge ? dataStore.claims.getTraceForFootprint(footprint) : null;
  const hasContent = edge
    ? true
    : trace
      ? (trace.mode === "direct" ? trace.claims.length > 0 : trace.paths.length > 0)
      : false;

  if (!pos || !hasContent) return null;
  return createPortal(
    <div className={ehc.tooltip} style={{ top: pos.top, left: pos.left, pointerEvents: "none" }}>
      <div className={ehc.kind}>Derivation trail</div>
      <div className={`${fc.stackSm} ${fc.stackSmTop}`}>
        {edge ? (
          <DerivationChain edgeId={edge.edge_id} compact={false} />
        ) : trace?.mode === "direct" ? (
          trace.claims.map((c) => claimLine(c))
        ) : trace?.mode === "derived_proposition_presence" ? (
          trace.paths.map((p, i) => (
            <div key={i} className={fc.tracePath}>
              {claimLine(p.propositionClaim)}
              {claimLine(p.placeClaim)}
            </div>
          ))
        ) : null}
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
  const primaryKind = showPlace ? "place" : f.entity_type;

  const backingClaims = dataStore.claims.getBackingForFootprint(f);
  const hasEvidence = backingClaims.some((c) => dataStore.claimEvidence.getForClaim(c.claim_id).length > 0);
  const firstClaimId = backingClaims[0]?.claim_id;

  // Show DerivationIcon for derived edges, InfoIcon for direct claims — never both
  const derivedEdge = f.derived_edge_id ? dataStore.derivedEdges.getById(f.derived_edge_id) : undefined;
  const isDerived = derivedEdge?.directness === "derived";

  return (
    <div className={fc.card} ref={cardRef}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && !hasEvidence && <DerivationTooltip anchorRef={cardRef} footprint={f} />}
      <div className={fc.row} onClick={() => onSelectEntity(clickTarget.kind, clickTarget.id)}>
        <span className={fc.icon}><KindIcon kind={primaryKind} size={15} /></span>
        <div className={fc.body}>
          <div className={fc.name}>{primaryLabel}</div>
          <div className={fc.rel}>
            {showPlace ? f.entity_type : "place"} · {f.reason_predicate_id.replace(/_/g, " ")}
            {f.year_start ? ` · AD ${f.year_start}` : ""}
            {f.year_end && f.year_end !== f.year_start ? `–${f.year_end}` : ""}
            {f.stance ? ` · ${f.stance}` : ""}
          </div>
        </div>
        {isDerived && f.derived_edge_id ? (
          <DerivationIcon edgeId={f.derived_edge_id} />
        ) : firstClaimId ? (
          <InfoIcon claimId={firstClaimId} />
        ) : null}
        {hasEvidence && (
          <button type="button" className={fc.expandBtn}
            onClick={(e) => { e.stopPropagation(); setExpanded((s) => !s); }}
            title={expanded ? "Hide evidence" : "Show evidence"}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && (
        <div className={fc.evidence}>
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
