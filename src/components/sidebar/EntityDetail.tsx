import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { Hl } from "../shared/Hl";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { NoteCard } from "../shared/NoteCard";
import { kindIcon, kindLabel } from "../shared/entityConstants";
import { getRelationLabel } from "../../domain/relationLabels";

// ─── Types ───────────────────────────────────────────────────────────────────

type EntityDetailTab = "info" | "locations" | "works" | "people" | "quotes" | "evidence" | "related";

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
  const canFilter  = ["persuasion", "polity", "person", "doctrine", "event", "work"].includes(kind);
  const label      = getEntityLabel(kind, id);

  const toggleFilter = () => {
    if (isFiltered) clearMapFilter();
    else setMapFilter(kind, id);
  };

  const notes     = dataStore.notes.getForEntity(kind, id);
  const relations = dataStore.relations.getForEntity(kind, id);

  // ── Pre-compute counts for tab badges ───────────────────────────────────

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<EntityDetailTab, number>> = {};
    if (kind === "person") {
      const fps  = dataStore.footprints.getForEntity("person", id);
      const rels = dataStore.relations.getForEntity("person", id);
      const cityIds = new Set<string>();
      for (const fp of fps) if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
      for (const r of rels) {
        const othId  = r.source_id === id ? r.target_id : r.source_id;
        const othType= r.source_id === id ? r.target_type : r.source_type;
        if (othType === "city") cityIds.add(othId);
      }
      const p = dataStore.people.getById(id);
      if (p?.city_of_origin_id) cityIds.add(p.city_of_origin_id);
      counts.locations = cityIds.size;
      counts.works = dataStore.works.getByAuthor(id).length;
    }
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      const personIds = new Set<string>();
      if (w?.author_person_id) personIds.add(w.author_person_id);
      for (const r of dataStore.relations.getForEntity("work", id)) {
        const othId  = r.source_id === id ? r.target_id : r.source_id;
        const othType= r.source_id === id ? r.target_type : r.source_type;
        if (othType === "person") personIds.add(othId);
      }
      counts.people = personIds.size;
      counts.quotes = dataStore.quotes.getByWork(id).length;
    }
    if (kind === "doctrine") {
      counts.quotes    = dataStore.quotes.getByDoctrine(id).length;
      counts.locations = dataStore.footprints.getForEntity("doctrine", id).filter(f => f.place_id.startsWith("city:")).length;
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      counts.people    = (e?.key_figure_person_ids ?? []).length;
      counts.locations = e?.primary_place_id ? 1 : 0;
    }
    if (kind === "persuasion") {
      counts.locations = dataStore.map.getCitiesAtDecade(currentDecade)
        .filter(c => (c.persuasion_ids ?? []).includes(id)).length;
    }
    if (kind === "polity") {
      counts.locations = dataStore.map.getCitiesAtDecade(currentDecade)
        .filter(c => c.polity_id === id).length;
    }
    counts.evidence = notes.length;
    counts.related  = relations.length;
    return counts;
  }, [kind, id, notes.length, relations.length, currentDecade]);

  // ── Build tab list based on kind ────────────────────────────────────────

  const badge = (tab: EntityDetailTab, fallback: string) => {
    const c = tabCounts[tab];
    return c != null ? `${fallback} (${c})` : fallback;
  };

  const availableTabs = useMemo((): { id: EntityDetailTab; label: string }[] => {
    const tabs: { id: EntityDetailTab; label: string }[] = [{ id: "info", label: "Info" }];

    if (kind === "person") {
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
      tabs.push({ id: "works",     label: badge("works", "Works") });
    }
    if (kind === "work") {
      tabs.push({ id: "people", label: badge("people", "People") });
      tabs.push({ id: "quotes", label: badge("quotes", "Quotes") });
    }
    if (kind === "doctrine") {
      tabs.push({ id: "quotes",    label: badge("quotes", "Quotes") });
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
    }
    if (kind === "event") {
      tabs.push({ id: "people",    label: badge("people", "Key Figures") });
      tabs.push({ id: "locations", label: badge("locations", "Locations") });
    }
    if (kind === "persuasion" || kind === "polity") {
      tabs.push({ id: "locations", label: badge("locations", "Cities") });
    }
    if (notes.length > 0) {
      tabs.push({ id: "evidence", label: `Evidence (${notes.length})` });
    }
    if (relations.length > 0 || kind === "archaeology") {
      tabs.push({ id: "related", label: `Related (${relations.length})` });
    }
    return tabs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, notes.length, relations.length, currentDecade]);

  // ── Build header ────────────────────────────────────────────────────────

  const header = useMemo(() => {
    let title = label;
    let subtitle = "";
    let tags: string[] = [];

    if (kind === "person") {
      const p = dataStore.people.getById(id);
      if (p) {
        title = p.person_label;
        subtitle = [
          p.birth_year ? `b. AD ${p.birth_year}` : "",
          p.death_year ? `d. AD ${p.death_year}` : "",
        ].filter(Boolean).join(" · ");
        tags = p.roles;
      }
    } else if (kind === "persuasion") {
      const p = dataStore.persuasions.getById(id);
      if (p) { title = p.persuasion_label; tags = [p.persuasion_stream].filter(Boolean); }
    } else if (kind === "polity") {
      const p = dataStore.polities.getById(id);
      if (p) {
        title = p.polity_label;
        subtitle = [p.region, p.capital].filter(Boolean).join(" · ");
      }
    } else if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w) {
        title = w.title_display;
        subtitle = `${w.author_name_display}${w.year_written_start ? ` · AD ${w.year_written_start}` : ""}`;
        tags = [w.work_type, w.language].filter(Boolean);
      }
    } else if (kind === "doctrine") {
      const d = dataStore.doctrines.getById(id);
      if (d) {
        title = d.name_display;
        subtitle = d.category;
        tags = [d.controversy_level ? `controversy: ${d.controversy_level}` : ""].filter(Boolean);
      }
    } else if (kind === "event") {
      const e = dataStore.events.getById(id);
      if (e) {
        title = e.name_display;
        subtitle = [e.year_start ? `AD ${e.year_start}` : "", e.region].filter(Boolean).join(" · ");
        tags = [e.event_type].filter(Boolean);
      }
    } else if (kind === "archaeology") {
      const a = dataStore.archaeology.getById(id);
      if (a) {
        title = a.name_display;
        subtitle = a.site_type;
        tags = [a.current_status].filter(Boolean);
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
        <div className="detail-kind-badge">{kindIcon(kind)} {kindLabel(kind)}</div>
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
        {activeTab === "locations" && <EntityLocationsTab kind={kind} id={id} currentDecade={currentDecade} onSelectEntity={onSelectEntity} />}
        {activeTab === "works"     && <EntityWorksTab personId={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "people"    && <EntityPeopleTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "quotes"    && <EntityQuotesTab kind={kind} id={id} onSelectEntity={onSelectEntity} />}
        {activeTab === "evidence"  && <EntityEvidenceTab notes={notes} onSelectEntity={onSelectEntity} />}
        {activeTab === "related"   && <EntityRelatedTab relations={relations} entityId={id} entityType={kind} onSelectEntity={onSelectEntity} />}
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
        {p.description && <p className="entity-desc"><Hl text={p.description} query={q} /></p>}
        <div className="fact-grid">
          {p.apostolic_connection && <><span className="fact-label">Apostolic connection</span><span className="fact-value">{p.apostolic_connection}</span></>}
          {p.death_type && <><span className="fact-label">Death type</span><span className="fact-value">{p.death_type}</span></>}
          {p.city_of_origin_id && (
            <>
              <span className="fact-label">City of origin</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("city", p.city_of_origin_id!)}>
                  {dataStore.cities.getById(p.city_of_origin_id)?.city_label ?? p.city_of_origin_id}
                </button>
              </span>
            </>
          )}
        </div>
        {p.wikipedia_url && (
          <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>
        )}
        {p.citations.length > 0 && (
          <div>
            <div className="detail-section-title">Sources</div>
            {p.citations.map((url, i) => <a key={i} className="citation-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          </div>
        )}
      </div>
    );
  }

  if (kind === "work") {
    const w = dataStore.works.getById(id);
    if (!w) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {w.description && <p className="entity-desc"><Hl text={w.description} query={q} /></p>}
        {w.significance && <p className="entity-desc--italic"><Hl text={w.significance} query={q} /></p>}
        <div className="fact-grid">
          <span className="fact-label">Language</span><span className="fact-value">{w.language || "—"}</span>
          {w.year_written_start && <><span className="fact-label">Written</span><span className="fact-value">AD {w.year_written_start}{w.year_written_end && w.year_written_end !== w.year_written_start ? ` – ${w.year_written_end}` : ""}</span></>}
          {w.author_person_id && (
            <>
              <span className="fact-label">Author</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("person", w.author_person_id!)}>
                  {w.author_name_display}
                </button>
              </span>
            </>
          )}
        </div>
        {w.modern_edition_url && <a href={w.modern_edition_url} target="_blank" rel="noopener noreferrer" className="citation-link">Modern edition →</a>}
      </div>
    );
  }

  if (kind === "doctrine") {
    const d = dataStore.doctrines.getById(id);
    if (!d) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {d.description && <p className="entity-desc"><Hl text={d.description} query={q} /></p>}
        {d.resolution && <p className="entity-desc--italic"><Hl text={d.resolution} query={q} /></p>}
        <div className="fact-grid">
          {d.first_attested_year && <><span className="fact-label">First attested</span><span className="fact-value">AD {d.first_attested_year}</span></>}
          {d.controversy_level && <><span className="fact-label">Controversy</span><span className="fact-value">{d.controversy_level}</span></>}
          {d.first_attested_work_id && (
            <>
              <span className="fact-label">First work</span>
              <span className="fact-value">
                <button type="button" className="mention-link" onClick={() => onSelectEntity("work", d.first_attested_work_id!)}>
                  {dataStore.works.getById(d.first_attested_work_id)?.title_display ?? d.first_attested_work_id}
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (!e) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {e.description && <p className="entity-desc"><Hl text={e.description} query={q} /></p>}
        {e.significance && <p className="entity-desc--italic"><Hl text={e.significance} query={q} /></p>}
        <div className="fact-grid">
          {e.outcome && <><span className="fact-label">Outcome</span><span className="fact-value">{e.outcome}</span></>}
          {e.primary_place_id && (
            <>
              <span className="fact-label">Location</span>
              <span className="fact-value">
                {e.primary_place_id.startsWith("city:") ? (
                  <button type="button" className="mention-link" onClick={() => onSelectEntity("city", e.primary_place_id!.slice(5))}>
                    {dataStore.cities.getById(e.primary_place_id.slice(5))?.city_label ?? e.primary_place_id}
                  </button>
                ) : e.primary_place_id}
              </span>
            </>
          )}
        </div>
        {e.citations.length > 0 && (
          <div>
            <div className="detail-section-title">Sources</div>
            {e.citations.map((url, i) => <a key={i} className="citation-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          </div>
        )}
      </div>
    );
  }

  if (kind === "persuasion") {
    const p = dataStore.persuasions.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {p.description && <p className="entity-desc">{p.description}</p>}
        <div className="fact-grid">
          {p.persuasion_stream && <><span className="fact-label">Stream</span><span className="fact-value">{p.persuasion_stream}</span></>}
          {p.year_start && <><span className="fact-label">Active from</span><span className="fact-value">AD {p.year_start}{p.year_end ? ` – ${p.year_end}` : ""}</span></>}
        </div>
        {p.wikipedia_url && <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>}
      </div>
    );
  }

  if (kind === "polity") {
    const p = dataStore.polities.getById(id);
    if (!p) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {p.description && <p className="entity-desc">{p.description}</p>}
        <div className="fact-grid">
          {p.capital && <><span className="fact-label">Capital</span><span className="fact-value">{p.capital}</span></>}
          {p.region && <><span className="fact-label">Region</span><span className="fact-value">{p.region}</span></>}
          {p.year_start && <><span className="fact-label">Period</span><span className="fact-value">AD {p.year_start}{p.year_end ? ` – ${p.year_end}` : ""}</span></>}
        </div>
        {p.wikipedia_url && <a href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia →</a>}
      </div>
    );
  }

  if (kind === "archaeology") {
    const a = dataStore.archaeology.getById(id);
    if (!a) return <div className="empty-state">Not found.</div>;
    return (
      <div className="flex-col-12">
        {a.description && <p className="entity-desc">{a.description}</p>}
        {a.significance && <p className="entity-desc--italic">{a.significance}</p>}
        <div className="fact-grid">
          {a.year_start != null && <><span className="fact-label">Dated</span><span className="fact-value">AD {a.year_start}{a.year_end && a.year_end !== a.year_start ? ` – ${a.year_end}` : ""}</span></>}
          {a.city_id && <><span className="fact-label">Near</span><span className="fact-value">{dataStore.cities.getById(a.city_id)?.city_label ?? a.city_id}</span></>}
          {a.current_status && <><span className="fact-label">Status</span><span className="fact-value">{a.current_status}</span></>}
          {a.location_precision && <><span className="fact-label">Precision</span><span className="fact-value">{a.location_precision}</span></>}
        </div>
        {a.discovery_notes && (
          <div>
            <div className="detail-section-title">Discovery</div>
            <p className="entity-desc">{a.discovery_notes}</p>
          </div>
        )}
        {a.uncertainty && (
          <div>
            <div className="detail-section-title">Uncertainty</div>
            <p className="entity-desc">{a.uncertainty}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Locations tab ────────────────────────────────────────────────────────────

function EntityLocationsTab({ kind, id, currentDecade, onSelectEntity }: {
  kind: string; id: string; currentDecade: number;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [allTime, setAllTime] = useState(true);
  const [page, setPage] = useState(0);

  const isTimeFilterable = kind === "persuasion" || kind === "polity";

  const cities = useMemo(() => {
    if (kind === "persuasion") {
      if (allTime) {
        const cityIds = new Set<string>();
        for (const ps of dataStore.map.getAllPlaceStates()) {
          if (ps.place_id.startsWith("city:") && (ps.persuasion_ids ?? []).includes(id)) {
            cityIds.add(ps.place_id.slice(5));
          }
        }
        return Array.from(cityIds).map(cid => dataStore.cities.getById(cid)).filter(Boolean) as NonNullable<ReturnType<typeof dataStore.cities.getById>>[];
      }
      return dataStore.map.getCitiesAtDecade(currentDecade)
        .filter((c) => (c.persuasion_ids ?? []).includes(id));
    }
    if (kind === "polity") {
      if (allTime) {
        const cityIds = new Set<string>();
        for (const ps of dataStore.map.getAllPlaceStates()) {
          if (ps.place_id.startsWith("city:") && ps.polity_id === id) {
            cityIds.add(ps.place_id.slice(5));
          }
        }
        return Array.from(cityIds).map(cid => dataStore.cities.getById(cid)).filter(Boolean) as NonNullable<ReturnType<typeof dataStore.cities.getById>>[];
      }
      return dataStore.map.getCitiesAtDecade(currentDecade)
        .filter((c) => c.polity_id === id);
    }
    if (kind === "person") {
      const fps = dataStore.footprints.getForEntity("person", id);
      const rels = dataStore.relations.getForEntity("person", id);
      const cityIds = new Set<string>();
      for (const fp of fps) {
        if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
      }
      for (const r of rels) {
        const otherId = r.source_id === id ? r.target_id : r.source_id;
        const otherType = r.source_id === id ? r.target_type : r.source_type;
        if (otherType === "city") cityIds.add(otherId);
      }
      const person = dataStore.people.getById(id);
      if (person?.city_of_origin_id) cityIds.add(person.city_of_origin_id);
      return Array.from(cityIds)
        .map((cid) => dataStore.cities.getById(cid))
        .filter(Boolean) as ReturnType<typeof dataStore.cities.getById>[];
    }
    if (kind === "doctrine") {
      const fps = dataStore.footprints.getForEntity("doctrine", id);
      const cityIds = new Set(fps.filter((f) => f.place_id.startsWith("city:")).map((f) => f.place_id.slice(5)));
      return Array.from(cityIds).map((cid) => dataStore.cities.getById(cid)).filter(Boolean) as ReturnType<typeof dataStore.cities.getById>[];
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      if (e?.primary_place_id?.startsWith("city:")) {
        const city = dataStore.cities.getById(e.primary_place_id.slice(5));
        return city ? [city] : [];
      }
    }
    return [];
  }, [kind, id, currentDecade, allTime]);

  useEffect(() => { setPage(0); }, [kind, id, allTime]);

  const pageItems = cities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex-col">
      {isTimeFilterable && (
        <div style={{ display: "flex", gap: 6, padding: "6px 0 8px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
          <button
            type="button"
            className={`detail-sub-tab${allTime ? " active" : ""}`}
            onClick={() => setAllTime(true)}
          >
            All time
          </button>
          <button
            type="button"
            className={`detail-sub-tab${!allTime ? " active" : ""}`}
            onClick={() => setAllTime(false)}
          >
            AD {currentDecade}
          </button>
        </div>
      )}
      {cities.length === 0
        ? <div className="empty-state">No locations found.</div>
        : (
          <>
            <div className="conn-list">
              {pageItems.map((c) => c && (
                <div key={c.city_id} className="conn-card" onClick={() => onSelectEntity("city", c.city_id)}>
                  <span className="conn-icon">🏛</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="conn-name">{c.city_label}</div>
                    <div className="conn-rel">{c.country_modern}</div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} total={cities.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )
      }
    </div>
  );
}

// ─── Works tab ────────────────────────────────────────────────────────────────

function EntityWorksTab({ personId, onSelectEntity }: {
  personId: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const works = dataStore.works.getByAuthor(personId);
  if (works.length === 0) return <div className="empty-state">No works found.</div>;
  const pageItems = works.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="conn-list">
        {pageItems.map((w) => (
          <div key={w.work_id} className="conn-card" onClick={() => onSelectEntity("work", w.work_id)}>
            <span className="conn-icon">📜</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="conn-name">{w.title_display}</div>
              <div className="conn-rel">{w.year_written_start ? `AD ${w.year_written_start}` : ""} · {w.work_type}</div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} total={works.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── People tab ───────────────────────────────────────────────────────────────

function EntityPeopleTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const people = useMemo(() => {
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      const personIds = new Set<string>();
      if (w?.author_person_id) personIds.add(w.author_person_id);
      const rels = dataStore.relations.getForEntity("work", id);
      for (const r of rels) {
        const otherId = r.source_id === id ? r.target_id : r.source_id;
        const otherType = r.source_id === id ? r.target_type : r.source_type;
        if (otherType === "person") personIds.add(otherId);
      }
      return Array.from(personIds).map((pid) => dataStore.people.getById(pid)).filter(Boolean);
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      return (e?.key_figure_person_ids ?? []).map((pid) => dataStore.people.getById(pid)).filter(Boolean);
    }
    return [];
  }, [kind, id]);

  if (people.length === 0) return <div className="empty-state">No people found.</div>;
  const pageItems = people.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="conn-list">
        {pageItems.map((p) => p && (
          <div key={p.person_id} className="conn-card" onClick={() => onSelectEntity("person", p.person_id)}>
            <span className="conn-icon">👤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="conn-name">{p.person_label}</div>
              <div className="conn-rel">{p.roles.slice(0, 2).join(", ")}</div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} total={people.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Quotes tab ───────────────────────────────────────────────────────────────

function EntityQuotesTab({ kind, id, onSelectEntity }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const globalQuery = useAppStore((s) => s.searchQuery);
  const [quoteSearch, setQuoteSearch] = useState(globalQuery.trim());
  const [page, setPage] = useState(0);

  const hlQuery = quoteSearch.trim() || globalQuery.trim();

  const quotes = useMemo(() => {
    const all = kind === "doctrine"
      ? dataStore.quotes.getByDoctrine(id)
      : kind === "work"
        ? dataStore.quotes.getByWork(id)
        : [];
    if (!quoteSearch.trim()) return all;
    const q = quoteSearch.trim().toLowerCase();
    return all.filter((qt) => qt.text.toLowerCase().includes(q) || qt.work_reference.toLowerCase().includes(q));
  }, [kind, id, quoteSearch]);

  useEffect(() => { setPage(0); }, [quoteSearch]);

  const pageItems = quotes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex-col-8">
      <div className="sidebar-search" style={{ marginBottom: 4 }}>
        <span className="search-input-icon">🔍</span>
        <input
          type="text"
          placeholder="Search quotes…"
          value={quoteSearch}
          onChange={(e) => setQuoteSearch(e.target.value)}
        />
        {quoteSearch && (
          <button type="button" className="close-btn" onClick={() => setQuoteSearch("")}>✕</button>
        )}
      </div>

      {quotes.length === 0 && <div className="empty-state">No quotes found.</div>}

      {pageItems.map((qt) => {
        const work = qt.work_id ? dataStore.works.getById(qt.work_id) : null;
        return (
          <div
            key={qt.quote_id}
            className="note-card"
            style={{ cursor: "pointer" }}
            onClick={() => onSelectEntity("quote", qt.quote_id)}
          >
            <div className="note-year">
              {qt.year ? `AD ${qt.year}` : ""}
              {qt.stance ? ` · ${qt.stance}` : ""}
            </div>
            <p style={{ fontStyle: "italic", margin: "4px 0", fontSize: "0.83rem", lineHeight: 1.5 }}>
              &ldquo;<Hl text={qt.text} query={hlQuery} />&rdquo;
            </p>
            {qt.work_reference && (
              <div style={{ fontSize: "0.74rem", color: "var(--text-faint)" }}>
                — <Hl text={qt.work_reference} query={hlQuery} />
                {work && (
                  <button
                    type="button"
                    className="mention-link"
                    style={{ marginLeft: 6 }}
                    onClick={(e) => { e.stopPropagation(); onSelectEntity("work", work.work_id); }}
                  >
                    {work.title_display}
                  </button>
                )}
              </div>
            )}
            {qt.notes && <div style={{ fontSize: "0.74rem", color: "var(--text-faint)", marginTop: 3 }}><Hl text={qt.notes} query={hlQuery} /></div>}
          </div>
        );
      })}
      <Pagination page={page} total={quotes.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

// ─── Evidence tab ─────────────────────────────────────────────────────────────

function EntityEvidenceTab({ notes, onSelectEntity }: {
  notes: ReturnType<typeof dataStore.notes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery).trim();
  const [page, setPage] = useState(0);
  if (notes.length === 0) return <div className="empty-state">No evidence notes.</div>;
  const pageItems = notes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex-col-8">
      {pageItems.map((n) => (
        <NoteCard
          key={n.note_id}
          note={n}
          onSelectEntity={onSelectEntity}
          searchQuery={searchQuery}
          yearLabel={`AD ${n.year_bucket ?? n.year_exact ?? "?"} · ${n.note_kind}`}
        />
      ))}
      <Pagination page={page} total={notes.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

// ─── Related tab ──────────────────────────────────────────────────────────────

function EntityRelatedTab({ relations, entityId, entityType, onSelectEntity }: {
  relations: ReturnType<typeof dataStore.relations.getForEntity>;
  entityId: string;
  entityType: string;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [entityId]);

  if (relations.length === 0) return <div className="empty-state">No related entities.</div>;

  const pageItems = relations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex-col">
      <div className="conn-list">
        {pageItems.map((r) => {
          const isOut   = r.source_id === entityId && r.source_type === entityType;
          const otherId = isOut ? r.target_id   : r.source_id;
          const othKind = isOut ? r.target_type : r.source_type;
          const lbl     = getEntityLabel(othKind, otherId);
          return (
            <div key={r.relation_id} className="conn-card" onClick={() => onSelectEntity(othKind, otherId)}>
              <span className="conn-icon">{kindIcon(othKind)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="conn-name">{lbl}</div>
                <div className="conn-rel">{getRelationLabel(r.relation_type, isOut)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination page={page} total={relations.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}
