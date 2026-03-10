import { useState } from "react";
import type { Passage, SourceRecord } from "../../data/types";
import { BibleOverlay } from "./BibleOverlay";
import { formatPassageLocator, getPassageUrl, isBiblePassage } from "../../utils/passageReferences";
import { getSourceAccessLabel } from "../../utils/sourceLinks";

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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          className="bible-ref-btn evidence-locator"
          onClick={(event) => {
            event.stopPropagation();
            setShowBibleOverlay(true);
          }}
          title={`Look up ${label}`}
        >
          {label}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="citation-link evidence-locator"
            onClick={(event) => event.stopPropagation()}
            title={accessLabel || `Open ${label}`}
          >
            ↗
          </a>
        )}
        {showBibleOverlay && (
          <BibleOverlay locator={passage.locator} onClose={() => setShowBibleOverlay(false)} />
        )}
      </span>
    );
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="citation-link evidence-locator"
        onClick={(event) => event.stopPropagation()}
        title={`Open ${label}`}
      >
        {label}
      </a>
    );
  }

  return <span className="faint evidence-locator">{label}</span>;
}
