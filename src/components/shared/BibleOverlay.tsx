import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchBiblePassage, osisToStepBibleUrl, locatorToDisplay, type BiblePassageResult } from "../../utils/bibleApi";

interface BibleOverlayProps {
  locator: string;
  onClose: () => void;
}

export function BibleOverlay({ locator, onClose }: BibleOverlayProps) {
  const [result, setResult] = useState<BiblePassageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchBiblePassage(locator).then((r) => {
      if (r) setResult(r);
      else setError(true);
      setLoading(false);
    });
  }, [locator]);

  const displayRef = locatorToDisplay(locator);
  const stepUrl = osisToStepBibleUrl(locator);

  return createPortal(
    <>
      <div className="bible-overlay-backdrop" onClick={onClose} />
      <div className="bible-overlay">
        <div className="bible-overlay-header">
          <div className="bible-overlay-title">{displayRef}</div>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="bible-overlay-body">
          {loading && <div className="empty-state">Loading passage…</div>}
          {error && <div className="empty-state">Could not load passage.</div>}
          {result && (
            <>
              <blockquote className="bible-overlay-text">
                {result.verses.length > 0
                  ? result.verses.map((v) => (
                      <span key={`${v.chapter}:${v.verse}`}>
                        <sup className="bible-verse-num">{v.verse}</sup>
                        {v.text.trim()}{" "}
                      </span>
                    ))
                  : result.text}
              </blockquote>
              <div className="bible-overlay-meta">
                {result.translation_name} ({result.translation_id.toUpperCase()})
              </div>
            </>
          )}
        </div>

        <div className="bible-overlay-footer">
          <a
            href={stepUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="view-on-map-btn"
            style={{ textAlign: "center", flex: 1, textDecoration: "none" }}
          >
            Open in STEP Bible →
          </a>
        </div>
      </div>
    </>,
    document.body,
  );
}
