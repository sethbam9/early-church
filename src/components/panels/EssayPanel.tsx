import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { essays } from "../../data/runtimeData";

export function EssayPanel() {
  const [activeEssayId, setActiveEssayId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return essays;
    const q = searchQuery.toLowerCase();
    return essays.filter((e) =>
      [e.title, e.content].join(" ").toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const activeEssay = activeEssayId ? essays.find((e) => e.id === activeEssayId) : null;

  if (essays.length === 0) {
    return <p className="muted">No essays loaded from /essays.</p>;
  }

  if (activeEssay) {
    return (
      <div className="drawer-content">
        <button type="button" className="link-button" onClick={() => setActiveEssayId(null)}>
          ← Back to list
        </button>
        <article className="essay-markdown">
          <ReactMarkdown>{activeEssay.content}</ReactMarkdown>
        </article>
      </div>
    );
  }

  return (
    <div className="drawer-content">
      <h2>Essays</h2>
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search essays..."
        style={{ width: "100%", marginBottom: 8 }}
      />
      <div className="event-track-list">
        {filtered.map((essay) => (
          <div
            key={essay.id}
            className="event-card"
            onClick={() => setActiveEssayId(essay.id)}
          >
            <strong>{essay.title}</strong>
            <p className="small muted">{essay.content.slice(0, 150).replace(/[#*_]/g, "")}...</p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="muted small">No essays match your search.</p>}
    </div>
  );
}
