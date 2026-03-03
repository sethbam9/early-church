import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { PersonCard } from "../shared/PersonCard";
import type { Edge, Person } from "../../domain/types";

const INVERSE_LABELS: Record<string, string> = {
  disciple_of: "teacher_of",
  bishop_of: "had_bishop",
  authored: "authored_by",
  sent_to: "received_from",
  attended: "attended_by",
  led: "led_by",
  affirms: "affirmed_by",
  condemned_by: "condemned",
  ordained_by: "ordained",
  martyred_at: "site_of_martyrdom",
  located_in: "contains",
  held_in: "hosted",
  wrote_from: "writing_origin_for",
  active_in: "had_active",
  visited: "visited_by",
  corresponded_with: "corresponded_with",
  co_worker_with: "co_worker_with",
  first_mentions: "first_mentioned_by",
  defined: "defined_by",
  debated: "debated_by",
  occurred_in: "site_of",
  affected: "affected_by",
};

export function CorrespondencePanel() {
  const selection = useAppStore((s) => s.selection);
  const activeDecade = useAppStore((s) => s.activeDecade);
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);

  const [searchQuery, setSearchQuery] = useState("");

  const allPeople = useMemo(() => {
    return dataStore.people.getAll().sort((a, b) => a.name_display.localeCompare(b.name_display));
  }, []);

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return allPeople;
    const q = searchQuery.toLowerCase();
    return allPeople.filter((p) =>
      [p.name_display, ...p.name_alt, ...p.roles].join(" ").toLowerCase().includes(q),
    );
  }, [allPeople, searchQuery]);

  const selectedPersonId = selection?.kind === "person" ? selection.id : null;
  const selectedPerson = selectedPersonId ? dataStore.people.getById(selectedPersonId) : null;

  const network = useMemo(() => {
    if (!selectedPersonId) return null;
    return dataStore.edges.getNetwork(selectedPersonId, "person", 2, activeDecade);
  }, [selectedPersonId, activeDecade]);

  const relationships = useMemo(() => {
    if (!selectedPersonId) return [];
    const edgesFrom = dataStore.edges.getEdgesFrom(selectedPersonId, "person");
    const edgesTo = dataStore.edges.getEdgesTo(selectedPersonId, "person");
    return [...edgesFrom, ...edgesTo];
  }, [selectedPersonId]);

  const groupedRelationships = useMemo(() => {
    const groups: Record<string, Array<{ edge: Edge; otherPerson?: Person; otherName: string }>> = {};

    for (const edge of relationships) {
      const isSource = edge.source_id === selectedPersonId;
      const otherId = isSource ? edge.target_id : edge.source_id;
      const otherType = isSource ? edge.target_type : edge.source_type;
      const rel = isSource ? edge.relationship : (INVERSE_LABELS[edge.relationship] ?? edge.relationship);

      let otherName = otherId;
      let otherPerson: Person | undefined;

      if (otherType === "person") {
        otherPerson = dataStore.people.getById(otherId);
        otherName = otherPerson?.name_display ?? otherId;
      } else if (otherType === "city") {
        const row = dataStore.churchRows.getById(otherId);
        otherName = row?.city_ancient ?? otherId;
      } else if (otherType === "work") {
        const work = dataStore.works.getById(otherId);
        otherName = work?.title_display ?? otherId;
      } else if (otherType === "event") {
        const event = dataStore.events.getById(otherId);
        otherName = event?.name_display ?? otherId;
      } else if (otherType === "doctrine") {
        const doctrine = dataStore.doctrines.getById(otherId);
        otherName = doctrine?.name_display ?? otherId;
      }

      if (!groups[rel]) groups[rel] = [];
      groups[rel].push({ edge, otherPerson, otherName });
    }

    return groups;
  }, [relationships, selectedPersonId]);

  function selectPerson(personId: string) {
    setSelection({ kind: "person", id: personId });
  }

  return (
    <div className="correspondence-panel">
      <h2>Correspondence Web</h2>
      <p className="muted small">
        Select a person to see their network of discipleship, correspondence, and connections.
      </p>

      <div className="control-card" style={{ padding: 8 }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search people..."
          style={{ width: "100%", marginBottom: 6 }}
        />
        <div className="entity-chip-list" style={{ maxHeight: 140, overflowY: "auto" }}>
          {filteredPeople.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`entity-chip ${p.id === selectedPersonId ? "entity-chip-selected" : ""}`}
              onClick={() => selectPerson(p.id)}
            >
              {p.name_display}
              {p.death_type === "martyr" ? " †" : ""}
            </button>
          ))}
        </div>
      </div>

      {selectedPerson && (
        <div className="correspondence-detail">
          <PersonCard person={selectedPerson} />

          <h3>Relationships</h3>
          {Object.keys(groupedRelationships).length === 0 ? (
            <p className="muted small">No relationships found in the edge graph.</p>
          ) : (
            Object.entries(groupedRelationships).map(([rel, items]) => (
              <div key={rel} className="relationship-group">
                <h4>{formatRelationship(rel)}</h4>
                <div className="entity-chip-list">
                  {items.map((item) => (
                    <button
                      key={item.edge.id}
                      type="button"
                      className="entity-chip"
                      onClick={() => {
                        const isSource = item.edge.source_id === selectedPersonId;
                        const otherId = isSource ? item.edge.target_id : item.edge.source_id;
                        const otherType = isSource ? item.edge.target_type : item.edge.source_type;

                        if (otherType === "person") {
                          selectPerson(otherId);
                        } else if (otherType === "event") {
                          setSelection({ kind: "event", id: otherId });
                          setActiveRightPanel("events");
                        } else if (otherType === "doctrine") {
                          setSelection({ kind: "doctrine", id: otherId });
                          setActiveRightPanel("doctrines");
                        } else if (otherType === "city") {
                          setSelection({ kind: "city", id: otherId });
                          setActiveRightPanel("chronicle");
                        }
                      }}
                    >
                      {item.otherName}
                      {item.edge.decade_start ? (
                        <span className="muted small"> ({item.edge.decade_start}s)</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          {network && (
            <div className="network-summary">
              <p className="muted small">
                Network: {network.nodes.length} entities, {network.edges.length} connections (2-hop radius)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelationship(rel: string): string {
  return rel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
