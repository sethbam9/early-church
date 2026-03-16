import type { DerivedEdge } from "../../data/types";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { kindIcon } from "./entityConstants";
import { getPredicateLabel } from "../../domain/relationLabels";
import s from "./DerivationChain.module.css";

interface DerivationChainProps {
  edgeId: string;
  onSelectEntity?: (kind: string, id: string) => void;
  compact?: boolean;
}

function StepLink({ type, id, onSelect }: { type: string; id: string; onSelect?: (k: string, i: string) => void }) {
  const label = getEntityLabel(type, id);
  if (onSelect) {
    return (
      <button type="button" className={s.stepLink} onClick={(e) => { e.stopPropagation(); onSelect(type, id); }}>
        {kindIcon(type)} {label}
      </button>
    );
  }
  return <span className={s.step}>{kindIcon(type)} {label}</span>;
}

export function DerivationChain({ edgeId, onSelectEntity, compact }: DerivationChainProps) {
  const edge = dataStore.derivedEdges.getById(edgeId);
  if (!edge) return <span className={s.empty}>unknown edge</span>;

  if (compact) {
    return <span className={s.compact}>{edge.path_text}</span>;
  }

  return (
    <div className={s.chain}>
      {/* Header line: directness + rule + certainty */}
      <div className={s.header}>
        <span className={`${s.badge} ${edge.directness === "direct" ? s.badgeDirect : s.badgeDerived}`}>
          {edge.directness}
        </span>
        <span className={s.rule}>{edge.rule_id.replace(/_/g, " ")}</span>
        <span className={s.cert}>{edge.certainty}</span>
      </div>

      {/* Summary: from → to */}
      <div className={s.summary}>
        <StepLink type={edge.from_type} id={edge.from_id} onSelect={onSelectEntity} />
        <span className={s.arrow}>→</span>
        <StepLink type={edge.to_type} id={edge.to_id} onSelect={onSelectEntity} />
      </div>

      {/* Supporting claim steps — each as a numbered mini-row */}
      {edge.supporting_claim_ids.length > 0 && (
        <div className={s.claimList}>
          {edge.supporting_claim_ids.map((cid, i) => {
            const claim = dataStore.claims.getById(cid);
            if (!claim) return <div key={cid} className={s.claimStep}><span className={s.stepNum}>{i + 1}</span><span className={s.faint}>{cid}</span></div>;
            const predLabel = getPredicateLabel(claim.predicate_id, true);
            const subLabel = getEntityLabel(claim.subject_type, claim.subject_id);
            const objLabel = claim.object_mode === "entity" && claim.object_id
              ? getEntityLabel(claim.object_type, claim.object_id)
              : (claim.value_text || claim.value_year?.toString() || "");
            return (
              <div key={cid} className={s.claimStep}>
                <span className={s.stepNum}>{i + 1}</span>
                <span className={s.stepEntity}>
                  {kindIcon(claim.subject_type)} {subLabel}
                </span>
                <span className={s.stepPred}>{predLabel}</span>
                <span className={s.stepEntity}>
                  {claim.object_type && kindIcon(claim.object_type)} {objLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DerivationChainInline({ edge }: { edge: DerivedEdge }) {
  return <span className={s.compact}>{edge.path_text}</span>;
}
