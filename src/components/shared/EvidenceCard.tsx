/**
 * Unified evidence card — used everywhere evidence is displayed.
 * Full width of parent, consistent background, single internal link + single external link.
 */
import type { ClaimEvidence } from "../../data/types";
import { dataStore } from "../../data/dataStore";
import { PassageReference } from "./PassageReference";
import { getSourceExternalUrl, getSourceAccessTitle } from "../../utils/sourceLinks";

interface EvidenceCardProps {
  ev: ClaimEvidence;
  onSelectEntity: (kind: string, id: string) => void;
}

export function EvidenceCard({ ev, onSelectEntity }: EvidenceCardProps) {
  const passage = dataStore.passages.getById(ev.passage_id);
  const source = passage ? dataStore.sources.getById(passage.source_id) : null;
  const url = getSourceExternalUrl(source);

  return (
    <div className="ev-card">
      <div className="ev-card-meta">
        <span className={`ev-card-role ev-card-role--${ev.evidence_role}`}>{ev.evidence_role}</span>
        {ev.evidence_weight != null && (
          <span className="ev-card-weight" title="Evidence weight">⚖ {ev.evidence_weight}</span>
        )}
      </div>
      {passage && <PassageReference passage={passage} source={source} />}
      {(ev.excerpt_override || passage?.excerpt) && (
        <div className="ev-card-excerpt">{ev.excerpt_override || passage?.excerpt}</div>
      )}
      {ev.notes && <div className="ev-card-notes faint">{ev.notes}</div>}
      <div className="ev-card-links">
        {source?.work_id && (
          <button type="button" className="mention-link" onClick={() => onSelectEntity("work", source.work_id)}>
            Open work
          </button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="ev-card-ext-link" title={source ? getSourceAccessTitle(source) : ""}>
            {source?.title ?? "Source"} ↗
          </a>
        )}
      </div>
    </div>
  );
}
