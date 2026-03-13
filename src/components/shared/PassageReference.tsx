import { useState } from "react";
import type { Passage, SourceRecord } from "../../data/types";
import { BibleOverlay } from "./BibleOverlay";
import { formatPassageLocator, getPassageUrl, isBiblePassage } from "../../utils/passageReferences";
import { getSourceAccessLabel } from "../../utils/sourceLinks";
import { ExternalLink } from "./ExternalLink";
import s from "./PassageReference.module.css";

interface PassageReferenceProps {
  passage: Passage;
  source?: SourceRecord | null;
}

export function PassageReference({ passage, source = null }: PassageReferenceProps) {
  const [showBibleOverlay, setShowBibleOverlay] = useState(false);

  const label = formatPassageLocator(passage);
  const url = getPassageUrl(passage, source);
  const accessLabel = getSourceAccessLabel(source);

  if (isBiblePassage(passage)) {
    return (
      <span className={s.wrap}>
        <button type="button" className={s.bibleBtn}
          onClick={(e) => { e.stopPropagation(); setShowBibleOverlay(true); }}
          title={`Look up ${label}`}>
          {label}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className={s.extLink}
            onClick={(e) => e.stopPropagation()} title={accessLabel || `Open ${label}`}>↗</a>
        )}
        {showBibleOverlay && (
          <BibleOverlay locator={passage.locator} onClose={() => setShowBibleOverlay(false)} />
        )}
      </span>
    );
  }

  if (url) {
    return (
      <ExternalLink href={url} className={s.extLink}
        onClick={(e) => e.stopPropagation()} title={`Open ${label}`}>{label}</ExternalLink>
    );
  }

  return <span className={s.plain}>{label}</span>;
}
