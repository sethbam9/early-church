import React from "react";

interface Props {
  children: string;
  onSelectEntity?: (kind: string, id: string) => void;
  className?: string;
}

/**
 * Renders a markdown string with:
 *   - [[kind:id|label]]   → clickable mention link
 *   - [[kind:id]]         → clickable mention (uses id as label)
 *   - # / ## / ###        → headings
 *   - > text              → blockquote
 *   - **bold** / *italic* → inline formatting
 *   - Blank lines         → paragraph breaks
 *   - Literal \n in data  → treated as newline
 */
export function MarkdownRenderer({ children, onSelectEntity, className }: Props) {
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
        <p key={key++} className="md-p">
          {renderInline(text || '', onSelectEntity, key)}
        </p>
      );
    }
    paraLines = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Heading
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      flushPara();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const text = (h1 || h2 || h3)![1];
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={key++} className={`md-h${level}`}>
          {renderInline(text || '', onSelectEntity, key)}
        </Tag>
      );
      continue;
    }

    // Blockquote
    const bq = line.match(/^> (.+)/);
    if (bq) {
      flushPara();
      blocks.push(
        <blockquote key={key++} className="md-blockquote">
          {renderInline(bq[1] || '', onSelectEntity, key)}
        </blockquote>
      );
      continue;
    }

    // Blank line → flush paragraph
    if (line.trim() === "") {
      flushPara();
      continue;
    }

    paraLines.push(line);
  }
  flushPara();

  return <div className={`markdown-renderer ${className ?? ""}`}>{blocks}</div>;
}

// ─── Inline renderer ──────────────────────────────────────────────────────────

function renderInline(
  text: string,
  onSelectEntity: ((kind: string, id: string) => void) | undefined,
  baseKey: number,
): React.ReactNode[] {
  // Split on mention patterns [[kind:id|label]] or [[kind:id]]
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    // Full mention with label
    const withLabel = part.match(/^\[\[([^:]+):([^|\]]+)\|([^\]]+)\]\]$/);
    if (withLabel) {
      const [, kind, id, label] = withLabel;
      nodes.push(
        <button
          key={`${baseKey}-m-${i}`}
          type="button"
          className="mention-link"
          onClick={() => onSelectEntity?.(kind || '', id || '')}
          title={`View ${kind || ''}: ${label || ''}`}
        >
          {label}
        </button>
      );
      return;
    }

    // Bare mention without label
    const bare = part.match(/^\[\[([^:]+):([^\]]+)\]\]$/);
    if (bare) {
      const [, kind, id] = bare;
      if (!kind || !id) return;
      const label = id.replace(/-/g, " ");
      nodes.push(
        <button
          key={`${baseKey}-m-${i}`}
          type="button"
          className="mention-link"
          onClick={() => onSelectEntity?.(kind, id)}
          title={`View ${kind || ''}`}
        >
          {label}
        </button>
      );
      return;
    }

    // Plain text — apply bold/italic
    const segments = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    segments.forEach((seg, j) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        nodes.push(<strong key={`${baseKey}-s-${i}-${j}`}>{seg.slice(2, -2)}</strong>);
      } else if (seg.startsWith("*") && seg.endsWith("*")) {
        nodes.push(<em key={`${baseKey}-s-${i}-${j}`}>{seg.slice(1, -1)}</em>);
      } else if (seg) {
        nodes.push(<span key={`${baseKey}-s-${i}-${j}`}>{seg}</span>);
      }
    });
  });

  return nodes;
}
