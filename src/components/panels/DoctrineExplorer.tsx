import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { QuoteCard } from "../shared/QuoteCard";
import type { Doctrine } from "../../domain/types";

const CATEGORY_LABELS: Record<string, string> = {
  christology: "Christology",
  ecclesiology: "Ecclesiology",
  soteriology: "Soteriology",
  sacraments: "Sacraments",
  mariology: "Mariology",
  eschatology: "Eschatology",
  liturgy: "Liturgy",
  praxis: "Praxis",
  canon: "Canon",
  other: "Other",
};

export function DoctrineExplorer() {
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);
  const selection = useAppStore((s) => s.selection);

  const [selectedDoctrineId, setSelectedDoctrineId] = useState<string | null>(
    selection?.kind === "doctrine" ? selection.id : null,
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [doctrineSearch, setDoctrineSearch] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");

  const allDoctrines = useMemo(() => {
    return dataStore.doctrines.getAll().sort((a, b) => a.name_display.localeCompare(b.name_display));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(allDoctrines.map((d) => d.category));
    return Array.from(cats).sort();
  }, [allDoctrines]);

  const filtered = useMemo(() => {
    let docs = allDoctrines;
    if (categoryFilter !== "all") docs = docs.filter((d) => d.category === categoryFilter);
    if (doctrineSearch.trim()) {
      const q = doctrineSearch.toLowerCase();
      docs = docs.filter((d) => [d.name_display, d.description].join(" ").toLowerCase().includes(q));
    }
    return docs;
  }, [allDoctrines, categoryFilter, doctrineSearch]);

  const selectedDoctrine = selectedDoctrineId
    ? dataStore.doctrines.getById(selectedDoctrineId)
    : null;

  const quotes = useMemo(() => {
    if (!selectedDoctrineId) return [];
    let qs = dataStore.quotes.getByDoctrineId(selectedDoctrineId).sort((a, b) => a.year - b.year);
    if (quoteSearch.trim()) {
      const q = quoteSearch.toLowerCase();
      qs = qs.filter((quote) => [quote.text, quote.author_name, quote.work_reference, quote.notes].join(" ").toLowerCase().includes(q));
    }
    return qs;
  }, [selectedDoctrineId, quoteSearch]);

  const globalQuoteResults = useMemo(() => {
    if (!quoteSearch.trim() || selectedDoctrineId) return [];
    const q = quoteSearch.toLowerCase();
    return dataStore.quotes.getAll()
      .filter((quote) => [quote.text, quote.author_name, quote.work_reference, quote.notes, quote.doctrine_id].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.year - b.year);
  }, [quoteSearch, selectedDoctrineId]);

  function selectDoctrine(doctrine: Doctrine) {
    setSelectedDoctrineId(doctrine.id);
    setSelection({ kind: "doctrine", id: doctrine.id });
  }

  return (
    <div className="doctrine-explorer">
      <h2>Doctrine Timeline</h2>
      <p className="muted small">
        Select a doctrine to see chronological quotes and attributions. Map highlights cities where doctrine was discussed.
      </p>

      <div className="event-track-filters">
        <input
          type="search"
          value={doctrineSearch}
          onChange={(e) => setDoctrineSearch(e.target.value)}
          placeholder="Search doctrines..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <input
          type="search"
          value={quoteSearch}
          onChange={(e) => setQuoteSearch(e.target.value)}
          placeholder="Search quotes across all doctrines..."
          style={{ width: "100%" }}
        />
      </div>

      {quoteSearch.trim() && !selectedDoctrineId && globalQuoteResults.length > 0 && (
        <div className="quote-list" style={{ marginBottom: 12 }}>
          <h3>Quote Results ({globalQuoteResults.length})</h3>
          {globalQuoteResults.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onPersonClick={(pid) => {
                setSelection({ kind: "person", id: pid });
                setActiveRightPanel("correspondence");
              }}
            />
          ))}
        </div>
      )}

      {quoteSearch.trim() && !selectedDoctrineId && globalQuoteResults.length === 0 && (
        <p className="muted small">No quotes match "{quoteSearch}".</p>
      )}

      <div className="doctrine-list">
        {filtered.map((doctrine) => (
          <button
            key={doctrine.id}
            type="button"
            className={`doctrine-item ${selectedDoctrineId === doctrine.id ? "doctrine-item-selected" : ""}`}
            onClick={() => selectDoctrine(doctrine)}
          >
            <strong>{doctrine.name_display}</strong>
            <span className="muted small"> — {CATEGORY_LABELS[doctrine.category] ?? doctrine.category}</span>
            {doctrine.controversy_level === "high" && <Badge>Contested</Badge>}
          </button>
        ))}
      </div>

      {selectedDoctrine && (
        <div className="doctrine-detail">
          <h3>{selectedDoctrine.name_display}</h3>
          <div className="badge-row">
            <Badge>{CATEGORY_LABELS[selectedDoctrine.category] ?? selectedDoctrine.category}</Badge>
            {selectedDoctrine.first_attested_year && (
              <Badge>First attested: AD {selectedDoctrine.first_attested_year}</Badge>
            )}
            <Badge>Controversy: {selectedDoctrine.controversy_level}</Badge>
          </div>
          <p>{selectedDoctrine.description}</p>
          {selectedDoctrine.resolution && (
            <p className="muted small"><strong>Resolution:</strong> {selectedDoctrine.resolution}</p>
          )}

          <h3>Quotes & Attributions ({quotes.length})</h3>
          {quotes.length === 0 ? (
            <p className="muted small">No quotes found for this doctrine.</p>
          ) : (
            <div className="quote-list">
              {quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onPersonClick={(pid) => {
                    setSelection({ kind: "person", id: pid });
                    setActiveRightPanel("correspondence");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
