import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchBiblePassage, osisToStepBibleUrl, locatorToDisplay, type BiblePassageResult } from "../../utils/bibleApi";
import { ExternalLink } from "./ExternalLink";
import s from "./BibleOverlay.module.css";

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
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.overlay}>
        <div className={s.header}>
          <div className={s.title}>{displayRef}</div>
          <button type="button" className={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={s.body}>
          {loading && <div className={s.emptyState}>Loading passage…</div>}
          {error && <div className={s.emptyState}>Could not load passage.</div>}
          {result && (
            <>
              <blockquote className={s.text}>
                {result.verses.length > 0
                  ? result.verses.map((v) => (
                      <span key={`${v.chapter}:${v.verse}`}>
                        <sup className={s.verseNum}>{v.verse}</sup>
                        {v.text.trim()}{" "}
                      </span>
                    ))
                  : result.text}
              </blockquote>
              <div className={s.meta}>
                {result.translation_name} ({result.translation_id.toUpperCase()})
              </div>
            </>
          )}
        </div>
        <div className={s.footer}>
          <ExternalLink href={stepUrl} className={s.stepLink}>
            Open in STEP Bible
          </ExternalLink>
        </div>
      </div>
    </>,
    document.body,
  );
}
