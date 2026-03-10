import type { EditorNote } from "../../data/types";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface NoteCardProps {
  note: EditorNote;
  onSelectEntity?: (kind: string, id: string) => void;
  searchQuery?: string;
  /** When provided, renders a .note-year header with this text. */
  yearLabel?: string;
}

/**
 * Canonical note card: renders body_md via MarkdownRenderer.
 * Used everywhere editor notes / evidence is displayed.
 */
export function NoteCard({ note, onSelectEntity, searchQuery = "", yearLabel }: NoteCardProps) {
  return (
    <div className="note-card">
      {yearLabel !== undefined && yearLabel !== "" && (
        <div className="note-year">
          <span>{yearLabel}</span>
          {onSelectEntity && (
            <button
              type="button"
              className="note-open-btn"
              onClick={() => onSelectEntity("editor_note", note.editor_note_id)}
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
    </div>
  );
}
