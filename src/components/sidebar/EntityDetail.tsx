import { useState, useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { PersonWithClaims } from "../../data/dataStore";
import { Hl } from "../shared/Hl";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { NoteCard } from "../shared/NoteCard";
import { kindIcon, kindLabel } from "../shared/entityConstants";
import { CrossPageNav } from "../shared/CrossPageNav";
import { ClaimCard } from "../shared/RelationCard";
import { FootprintCard } from "../shared/FootprintCard";
import { PassageReference } from "../shared/PassageReference";

// ─── Types ───────────────────────────────────────────────────────────────────

type EntityDetailTab = "info" | "locations" | "claims" | "people" | "evidence" | "mentions";

// ─── EntityDetail (main) ─────────────────────────────────────────────────────

interface EntityDetailProps {
  kind: string;
  id: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
  mapFilterType: string | null;
  mapFilterId: string | null;
  setMapFilter: (type: string, id: string) => void;
  clearMapFilter: () => void;
  currentDecade: number;
}

export function EntityDetail({
  kind, id, onBack, onSelectEntity,
  mapFilterType, mapFilterId, setMapFilter, clearMapFilter, currentDecade,
}: EntityDetailProps) {
  const [activeTab, setActiveTab] = useState<EntityDetailTab>("info");

  const isFiltered = mapFilterType === kind && mapFilterId === id;
  const canFilter  = ["group", "person", "proposition", "event", "work"].includes(kind);
  const label      = getEntityLabel(kind, id);

  const toggleFilter = () => {
    if (isFiltered) clearMapFilter();
    else setMapFilter(kind, id);
  };

  const editorNotes = dataStore.editorNotes.getForEntity(kind, id);
  const claims      = dataStore.claims.getVisibleForEntity(kind, id);
  const footprints  = dataStore.footprints.getForEntity(kind, id);
  const mentions    = dataStore.noteMentions.getMentioning(kind, id);

  const workPeople = useMemo(() => kind === "work" ? dataStore.claims.getPeopleForWork(id) : [], [kind, id]);
  const propositionPeople = useMemo(() => kind === "proposition" ? dataStore.claims.getPeopleForEntity("proposition", id) : [], [kind, id]);

  // ── Build tab list based on kind ────────────────────────────────────────

  const availableTabs = useMemo((): { id: EntityDetailTab; label: string }[] => {
    const tabs: { id: EntityDetailTab; label: string }[] = [{ id: "info", label: "Info" }];

    if (footprints.length > 0) {
      tabs.push({ id: "locations", label: `Locations (${footprints.length})` });
    }
    if (claims.length > 0) {
      tabs.push({ id: "claims", label: `Claims (${claims.length})` });
    }
    const peopleCount = workPeople.length + propositionPeople.length;
    if (peopleCount > 0) {
      tabs.push({ id: "people", label: `People (${peopleCount})` });
    }
    if (editorNotes.length > 0) {
      tabs.push({ id: "evidence", label: `Notes (${editorNotes.length})` });
    }
    if (mentions.length > 0) {
      tabs.push({ id: "mentions", label: `Mentioned (${mentions.length})` });
    }
    return tabs;
  }, [kind, id, editorNotes.length, claims.length, footprints.length, mentions.length, workPeople.length, propositionPeople.length]);

  // ── Build header ────────────────────────────────────────────────────────

  const header = useMemo(() => {
    let title = label;
    let subtitle = "";
    let tags: string[] = [];

    if (kind === "person") {
      const p = dataStore.people.getById(id);
      if (p) {
        title = p.person_label;
        subtitle = [p.birth_year_display, p.death_year_display].filter(Boolean).join(" – ");
        tags = [p.person_kind !== "individual" ? p.person_kind : ""].filter(Boolean);
      }
    } else if (kind === "group") {
      const g = dataStore.groups.getById(id);
      if (g) { title = g.group_label; tags = [g.group_kind]; }
    } else if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w) {
        title = w.title_display;
        subtitle = `${w.work_type} · ${w.language_original}`;
        tags = [w.work_kind !== "single_work" ? w.work_kind : ""].filter(Boolean);
      }
    } else if (kind === "proposition") {
      const p = dataStore.propositions.getById(id);
      if (p) {
        title = p.proposition_label;
        const topic = dataStore.topics.getById(p.topic_id);
        subtitle = topic?.topic_label ?? p.topic_id;
      }
    } else if (kind === "event") {
      const e = dataStore.events.getById(id);
      if (e) {
        title = e.event_label;
        tags = [e.event_type].filter(Boolean);
      }
    } else if (kind === "source") {
      const s = dataStore.sources.getById(id);
      if (s) {
        title = s.title;
        subtitle = [s.author, s.year].filter(Boolean).join(" · ");
      }
    }

    return { title, subtitle, tags };
  }, [kind, id, label]);

  return (
    <div className="detail-panel">
      {/* Back bar */}
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">{kindLabel(kind)}</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="detail-kind-badge">{kindIcon(kind)} {kindLabel(kind)}</div>
          <CrossPageNav kind={kind} id={id} current="map" />
        </div>
        <div className="detail-title">{header.title}</div>
        {header.subtitle && <div className="detail-subtitle">{header.subtitle}</div>}
        {header.tags.length > 0 && (
          <div className="detail-tags">
            {header.tags.map((t, i) => <span key={i} className="tag accent">{t}</span>)}
          </div>
        )}
      </div>

      {/* Map filter banner */}
      {canFilter && (
        <div className="filter-banner">
          <span>🗺 Filter map to this {kindLabel(kind).toLowerCase()}</span>
          <button
            type="button"
            className={`filter-toggle-btn${isFiltered ? " on" : ""}`}
            onClick={toggleFilter}
          >
            {isFiltered ? "On" : "Off"}
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      {availableTabs.length > 1 && (
        <div className="detail-sub-tabs">
          {availableTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`detail-sub-tab${activeTab === t.id ? " active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab body */}
      <div className="detail-body">
        {activeTab === "info"      && <EntityInfoTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "locations" && <EntityLocationsTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "claims"    && <EntityClaimsTab claims={claims} entityId={id} entityType={kind} onSelectEntity={onSelectEntity} />}
        {activeTab === "people"    && <WorkPeopleTab people={[...workPeople, ...propositionPeople]} onSelectEntity={onSelectEntity} />}
        {activeTab === "evidence"  && <EntityEvidenceTab notes={editorNotes} onSelectEntity={onSelectEntity} />}
        {activeTab === "mentions"  && <EntityMentionedInTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
      </div>
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function EntityInfoTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const q = searchQuery.trim();

  if (kind === "person") {
    const p = dataStore.people.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {p.notes && <p className="entity-desc"><Hl text={p.notes} query={q} /></p>}
        <div className="fact-grid">
          {p.name_native && <><span className="fact-label">Native name</span><span className="fact-value">{p.name_native}</span></>}
          {p.name_alt.length > 0 && <><span className="fact-label">Also known as</span><span className="fact-value">{p.name_alt.join(", ")}</span></>}
          {p.birth_year_display && <><span className="fact-label">Born</span><span className="fact-value">{p.birth_year_display}</span></>}
          {p.death_year_display && <><span className="fact-label">Died</span><span className="fact-value">{p.death_year_display}</span></>}
        </div>
      </div>
    );
  }

  if (kind === "work") {
    const w = dataStore.works.getById(id);
    if (!w) return <div className="empty-state">Not found.</div>;
    const workSource = dataStore.sources.getAll().find((s) => s.title === w.title_display);
    return (
      <div className="flex-col-12">
        {w.notes && <p className="entity-desc"><Hl text={w.notes} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Language</span><span className="fact-value">{w.language_original || "—"}</span>
          <span className="fact-label">Type</span><span className="fact-value">{w.work_type}</span>
          {w.title_original && <><span className="fact-label">Original title</span><span className="fact-value">{w.title_original}</span></>}
        </div>
        {workSource?.url && (
          <a href={workSource.url} target="_blank" rel="noopener noreferrer" className="citation-link">
            Read online →
          </a>
        )}
      </div>
    );
  }

  if (kind === "group") {
    const g = dataStore.groups.getById(id);
    if (!g) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {g.notes && <p className="entity-desc"><Hl text={g.notes} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Kind</span><span className="fact-value">{g.group_kind}</span>
        </div>
      </div>
    );
  }

  if (kind === "proposition") {
    const p = dataStore.propositions.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    const topic = dataStore.topics.getById(p.topic_id);
    const dim   = dataStore.dimensions.getById(p.dimension_id);
    return (
      <div className="flex-col-12">
        {p.description && <p className="entity-desc"><Hl text={p.description} query={q} /></p>}
        <div className="fact-grid">
          {topic && <><span className="fact-label">Topic</span><span className="fact-value">
            <button type="button" className="mention-link" onClick={() => onSelectEntity("topic", topic.topic_id)}>{topic.topic_label}</button>
          </span></>}
          {dim && <><span className="fact-label">Dimension</span><span className="fact-value">{dim.dimension_label}</span></>}
          {p.polarity_family && <><span className="fact-label">Polarity family</span><span className="fact-value">{p.polarity_family}</span></>}
        </div>
      </div>
    );
  }

  if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (!e) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {e.notes && <p className="entity-desc"><Hl text={e.notes} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Type</span><span className="fact-value">{e.event_type}</span>
          <span className="fact-label">Kind</span><span className="fact-value">{e.event_kind}</span>
        </div>
      </div>
    );
  }

  if (kind === "source") {
    const s = dataStore.sources.getById(id);
    if (!s) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {s.notes && <p className="entity-desc"><Hl text={s.notes} query={q} /></p>}
        <div className="fact-grid">
          {s.author && <><span className="fact-label">Author</span><span className="fact-value">{s.author}</span></>}
          {s.year && <><span className="fact-label">Year</span><span className="fact-value">{s.year}</span></>}
          {s.source_kind && <><span className="fact-label">Kind</span><span className="fact-value">{s.source_kind}</span></>}
        </div>
        {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="citation-link">{s.title} →</a>}
      </div>
    );
  }

  if (kind === "topic") {
    const t = dataStore.topics.getById(id);
    if (!t) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {t.notes && <p className="entity-desc"><Hl text={t.notes} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Kind</span><span className="fact-value">{t.topic_kind}</span>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Locations tab ────────────────────────────────────────────────────────────

function EntityLocationsTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const deduped = useMemo(() => dataStore.footprints.getForEntityDeduped(kind, id), [kind, id]);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(deduped, PAGE_SIZE);

  if (deduped.length === 0) return <div className="empty-state">No locations found.</div>;

  return (
    <div className="flex-col">
      {pageItems.map((f, i) => (
        <FootprintCard
          key={`${f.place_id}:${i}`}
          footprint={f}
          showEntity={false}
          showPlace={true}
          onSelectEntity={onSelectEntity}
        />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Claims tab ───────────────────────────────────────────────────────────────

function EntityClaimsTab({ claims, entityId, entityType, onSelectEntity }: {
  claims: ReturnType<typeof dataStore.claims.getForEntity>;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const sorted = useMemo(() =>
    claims.slice().sort((a, b) => (a.year_start ?? 9999) - (b.year_start ?? 9999)),
    [claims],
  );
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(sorted, PAGE_SIZE);

  if (sorted.length === 0) return <div className="empty-state">No claims.</div>;

  return (
    <div className="flex-col">
      {pageItems.map((c) => (
        <ClaimCard
          key={c.claim_id}
          claim={c}
          entityId={entityId}
          entityType={entityType}
          onSelectEntity={onSelectEntity}
        />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Work People tab ─────────────────────────────────────────────────────────

function WorkPeopleTab({ people, onSelectEntity }: {
  people: PersonWithClaims[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(people, PAGE_SIZE);

  if (people.length === 0) return <div className="empty-state">No people found.</div>;

  return (
    <div className="flex-col">
      {pageItems.map(({ personId, claims: pClaims }) => {
        const person = dataStore.people.getById(personId);
        const label = person?.person_label ?? personId;
        const isOpen = expandedId === personId;

        const evidence = pClaims.flatMap((c) =>
          dataStore.claimEvidence.getForClaim(c.claim_id).map((ev) => ({ ...ev, predicate: c.predicate_id })),
        );

        return (
          <div key={personId} className="conn-card conn-card--col">
            <div className="conn-card-row" onClick={() => onSelectEntity("person", personId)}>
              <span className="conn-icon">{kindIcon("person")}</span>
              <div className="conn-card-body">
                <div className="conn-name">{label}</div>
                <div className="conn-rel">
                  {pClaims.map((c) => c.predicate_id.replace(/_/g, " ")).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                </div>
              </div>
              {evidence.length > 0 && (
                <button
                  type="button"
                  className="rel-expand-btn"
                  onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : personId); }}
                  title={isOpen ? "Hide references" : "Show references"}
                >
                  {isOpen ? "▲" : "▼"}
                </button>
              )}
            </div>

            {isOpen && evidence.length > 0 && (
              <div className="evidence-detail">
                {evidence.map((ev) => {
                  const passage = dataStore.passages.getById(ev.passage_id);
                  const source = passage ? dataStore.sources.getById(passage.source_id) : null;
                  return (
                    <div key={`${ev.claim_id}-${ev.passage_id}`} className="evidence-item">
                      <span className="faint">{ev.evidence_role}</span>
                      {passage && <PassageReference passage={passage} source={source} />}
                      {passage?.excerpt && <div className="evidence-excerpt">{passage.excerpt}</div>}
                      {source?.url && (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="citation-link evidence-source">
                          {source.title}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />

    </div>
  );
}

// ─── Evidence tab ─────────────────────────────────────────────────────────────

function EntityEvidenceTab({ notes, onSelectEntity }: {
  notes: ReturnType<typeof dataStore.editorNotes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(notes, PAGE_SIZE);

  if (notes.length === 0) return <div className="empty-state">No editor notes.</div>;

  return (
    <div className="flex-col-8">
      {pageItems.map((n) => (
        <NoteCard
          key={n.editor_note_id}
          note={n}
          onSelectEntity={onSelectEntity}
          searchQuery={searchQuery}
          yearLabel={n.note_kind}
        />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Mentioned In tab ─────────────────────────────────────────────────────────

function EntityMentionedInTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const notes = useMemo(() => dataStore.editorNotes.getMentioningNotes(kind, id), [kind, id]);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(notes, PAGE_SIZE);

  if (notes.length === 0) return <div className="empty-state">No notes mention this entity.</div>;

  return (
    <div className="flex-col-8">
      {pageItems.map((n) => (
        <NoteCard
          key={n.editor_note_id}
          note={n}
          onSelectEntity={onSelectEntity}
          yearLabel={n.note_kind}
        />
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
