import type { CSSProperties } from "react";
import { dataStore } from "../../data/dataStore";
import { MarkdownRenderer } from "./MarkdownRenderer";

export type Note = ReturnType<typeof dataStore.notes.getForEntity>[number];

interface NoteCardProps {
  note: Note;
  onSelectEntity?: (kind: string, id: string) => void;
  searchQuery?: string;
  /** When provided, renders a .note-year header with this text. */
  yearLabel?: string;
  style?: CSSProperties;
}

/**
 * Canonical note card: renders body_md via MarkdownRenderer and shows
 * citation_urls as clickable links. Used everywhere evidence is displayed.
 */
export function NoteCard({ note, onSelectEntity, searchQuery = "", yearLabel, style }: NoteCardProps) {
  return (
    <div className="note-card" style={style}>
      {yearLabel !== undefined && yearLabel !== "" && (
        <div className="note-year" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{yearLabel}</span>
          {onSelectEntity && (
            <button
              type="button"
              className="note-open-btn"
              onClick={() => onSelectEntity("note", note.note_id)}
              title="Open note detail"
            >
              open →
            </button>
          )}
        </div>
      )}
      <MarkdownRenderer onSelectEntity={onSelectEntity} searchQuery={searchQuery}>
        {note.body_md}
      </MarkdownRenderer>
      {note.citation_urls.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {note.citation_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">
              {url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
