import type { Quote } from "../../domain/types";
import { Badge } from "./Badge";

interface QuoteCardProps {
  quote: Quote;
  onPersonClick?: (personId: string) => void;
  onWorkClick?: (workId: string) => void;
}

export function QuoteCard({ quote, onPersonClick, onWorkClick }: QuoteCardProps) {
  return (
    <div className="quote-card">
      <blockquote className="quote-text">"{quote.text}"</blockquote>
      <div className="quote-attribution">
        <span className="quote-author">
          {quote.author_id && onPersonClick ? (
            <button type="button" className="link-button" onClick={() => onPersonClick(quote.author_id!)}>
              {quote.author_name}
            </button>
          ) : (
            quote.author_name
          )}
        </span>
        {quote.work_reference && (
          <span className="quote-ref">
            {quote.work_id && onWorkClick ? (
              <button type="button" className="link-button" onClick={() => onWorkClick(quote.work_id!)}>
                {quote.work_reference}
              </button>
            ) : (
              quote.work_reference
            )}
          </span>
        )}
      </div>
      <div className="badge-row">
        <Badge>AD {quote.year}</Badge>
        <Badge>{quote.stance}</Badge>
        <Badge>{quote.source_type}</Badge>
      </div>
      {quote.notes && <p className="muted small">{quote.notes}</p>}
    </div>
  );
}
