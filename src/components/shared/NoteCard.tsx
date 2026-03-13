import type { EditorNote } from "../../data/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import s from "./NoteCard.module.css";

interface NoteCardProps {
  note: EditorNote;
  onSelectEntity?: (kind: string, id: string) => void;
  searchQuery?: string;
  yearLabel?: string;
}

export function NoteCard({ note, onSelectEntity, searchQuery = "", yearLabel }: NoteCardProps) {
  return (
    <div className={s.card}>
      {yearLabel !== undefined && yearLabel !== "" && (
        <div className={s.year}>
          <span>{yearLabel}</span>
          {onSelectEntity && (
            <button type="button" className={s.openBtn}
              onClick={() => onSelectEntity("editor_note", note.editor_note_id)} title="Open note detail">
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
