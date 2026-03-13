import React from "react";
import { EntityHoverWrap } from "./EntityHoverCard";
import ms from "./MarkdownRenderer.module.css";

interface Props {
  children: string;
  onSelectEntity?: (kind: string, id: string) => void;
  searchQuery?: string;
  className?: string;
}

/**
 * Shared markdown renderer for both essays and evidence notes.
 *   - [[kind:id|label]]   → clickable mention link
 *   - [[kind:id]]         → clickable mention (uses id as label)
 *   - # / ## / ###        → headings
 *   - > text              → blockquote
 *   - **bold** / *italic* → inline formatting
 *   - Blank lines         → paragraph breaks
 *   - Literal \n in data  → treated as newline
 *   - searchQuery         → highlights matching text in plain segments
 */
export function MarkdownRenderer({ children, onSelectEntity, searchQuery, className }: Props) {
  const q = searchQuery?.trim() ?? "";

  const lines = children
    .replace(/\\n/g, "\n")   // handle literal \n sequences from TSV
    .split("\n");

  const blocks: React.ReactNode[] = [];
  let paraLines: string[] = [];
  let key = 0;

  const flushPara = () => {
    const text = paraLines.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={key++} className={ms.p}>
          {renderInline(text, onSelectEntity, key, q)}
        </p>
      );
    }
    paraLines = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      flushPara();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 || h2 || h3)![1];
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={key++} className={level === 1 ? ms.h1 : level === 2 ? ms.h2 : ms.h3}>
          {renderInline(text || '', onSelectEntity, key, q)}
        </Tag>
      );
      continue;
    }

    const bq = line.match(/^> (.+)/);
    if (bq) {
      flushPara();
      blocks.push(
        <blockquote key={key++} className={ms.blockquote}>
          {renderInline(bq[1] || '', onSelectEntity, key, q)}
        </blockquote>
      );
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      continue;
    }

    paraLines.push(line);
  }
  flushPara();

  return <div className={`${ms.root} ${className ?? ""}`}>{blocks}</div>;
}

// ─── Search highlight helper ──────────────────────────────────────────────────

function highlightText(text: string, query: string, baseKey: string): React.ReactNode {
  if (!query || !text) return <>{text}</>;
  const lq = query.toLowerCase();
  const lt = text.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let idx = 0;
  while (idx < text.length) {
    const found = lt.indexOf(lq, idx);
    if (found < 0) {
      nodes.push(<span key={`${baseKey}-t-${idx}`}>{text.slice(idx)}</span>);
      break;
    }
    if (found > idx) {
      nodes.push(<span key={`${baseKey}-t-${idx}`}>{text.slice(idx, found)}</span>);
    }
    nodes.push(
      <mark key={`${baseKey}-hl-${found}`} className={ms.highlight}>
        {text.slice(found, found + query.length)}
      </mark>
    );
    idx = found + query.length;
  }
  return <>{nodes}</>;
}

// ─── Inline renderer ──────────────────────────────────────────────────────────

function renderInline(
  text: string,
  onSelectEntity: ((kind: string, id: string) => void) | undefined,
  baseKey: number,
  searchQuery: string,
): React.ReactNode[] {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    const withLabel = part.match(/^\[\[([^:]+):([^|\]]+)\|([^\]]+)\]\]$/);
    if (withLabel) {
      const [, kind, id, label] = withLabel;
      nodes.push(
        <EntityHoverWrap key={`${baseKey}-m-${i}`} kind={kind || ''} id={id || ''}>
          <button
            type="button"
            className={ms.mention}
            onClick={() => onSelectEntity?.(kind || '', id || '')}
          >
            {searchQuery ? highlightText(label || '', searchQuery, `${baseKey}-m-${i}`) : label}
          </button>
        </EntityHoverWrap>
      );
      return;
    }

    const bare = part.match(/^\[\[([^:]+):([^\]|]+)\]\]$/);
    if (bare) {
      const [, kind, id] = bare;
      if (!kind || !id) return;
      const label = id.replace(/-/g, " ");
      nodes.push(
        <EntityHoverWrap key={`${baseKey}-m-${i}`} kind={kind} id={id}>
          <button
            type="button"
            className={ms.mention}
            onClick={() => onSelectEntity?.(kind, id)}
          >
            {searchQuery ? highlightText(label, searchQuery, `${baseKey}-m-${i}`) : label}
          </button>
        </EntityHoverWrap>
      );
      return;
    }

    // Plain text — apply bold/italic then search highlight
    const segments = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    segments.forEach((seg, j) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        const inner = seg.slice(2, -2);
        nodes.push(
          <strong key={`${baseKey}-s-${i}-${j}`}>
            {searchQuery ? highlightText(inner, searchQuery, `${baseKey}-b-${i}-${j}`) : inner}
          </strong>
        );
      } else if (seg.startsWith("*") && seg.endsWith("*")) {
        const inner = seg.slice(1, -1);
        nodes.push(
          <em key={`${baseKey}-s-${i}-${j}`}>
            {searchQuery ? highlightText(inner, searchQuery, `${baseKey}-e-${i}-${j}`) : inner}
          </em>
        );
      } else if (seg) {
        nodes.push(
          <span key={`${baseKey}-s-${i}-${j}`}>
            {searchQuery ? highlightText(seg, searchQuery, `${baseKey}-p-${i}-${j}`) : seg}
          </span>
        );
      }
    });
  });

  return nodes;
}
