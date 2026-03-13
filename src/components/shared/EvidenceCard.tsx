import type { ClaimEvidence } from "../../data/types";
import { dataStore } from "../../data/dataStore";
import { PassageReference } from "./PassageReference";
import { getSourceExternalUrl, getSourceAccessTitle } from "../../utils/sourceLinks";
import s from "./EvidenceCard.module.css";

const ROLE_CLS: Record<string, string> = {
  supports: s.roleSupports,
  opposes: s.roleOpposes,
  contextualizes: s.roleContextualizes,
  mentions: s.roleMentions,
};

interface EvidenceCardProps {
  ev: ClaimEvidence;
  onSelectEntity: (kind: string, id: string) => void;
  hideWorkLink?: boolean;
}

export function EvidenceCard({ ev, onSelectEntity, hideWorkLink }: EvidenceCardProps) {
  const passage = dataStore.passages.getById(ev.passage_id);
  const source = passage ? dataStore.sources.getById(passage.source_id) : null;
  const url = getSourceExternalUrl(source);

  return (
    <div className={s.card}>
      <div className={s.meta}>
        <span className={`${s.role} ${ROLE_CLS[ev.evidence_role] ?? ""}`}>{ev.evidence_role}</span>
        {ev.evidence_weight != null && (
          <span className={s.weight} title="Evidence weight">⚖ {ev.evidence_weight}</span>
        )}
      </div>
      {passage && <PassageReference passage={passage} source={source} />}
      {(ev.excerpt_override || passage?.excerpt) && (
        <div className={s.excerpt}>{ev.excerpt_override || passage?.excerpt}</div>
      )}
      {ev.notes && <div className={s.notes}>{ev.notes}</div>}
      <div className={s.links}>
        {source?.work_id && !hideWorkLink && (
          <button type="button" className={s.workLink} onClick={() => onSelectEntity("work", source.work_id)}>
            Open work
          </button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className={s.extLink} title={source ? getSourceAccessTitle(source) : ""}>
            {source?.title ?? "Source"} ↗
          </a>
        )}
      </div>
    </div>
  );
}
