import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/dataStore";
import type { PlacesSubTab } from "../../stores/appStore";
import { Hl } from "../shared/Hl";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { presenceColor } from "../shared/entityConstants";
import type { Essay } from "../../data/essays";

// ─── Cities list ──────────────────────────────────────────────────────────────

export function CitiesList({ search, currentDecade, onSelectCity, onFlyToCity }: {
  search: string;
  currentDecade: number;
  onSelectCity: (id: string) => void;
  onFlyToCity: (id: string) => void;
}) {
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const [page, setPage] = useState(0);
  const [mapVisibleOnly, setMapVisibleOnly] = useState(false);

  useEffect(() => { setPage(0); }, [search, currentDecade, includeCumulative, mapVisibleOnly]);

  // Decade-presence index for dot colors
  const decadePresence = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dataStore.map.getCumulativeCitiesAtDecade(currentDecade)) {
      m.set(c.city_id, c.presence_status);
    }
    return m;
  }, [currentDecade]);

  const cities = useMemo(() => {
    let base: { city_id: string; city_label: string; city_ancient: string; city_modern: string; country_modern: string; presence_status: string }[];
    if (mapVisibleOnly) {
      base = includeCumulative
        ? dataStore.map.getCumulativeCitiesAtDecade(currentDecade)
        : dataStore.map.getCitiesAtDecade(currentDecade);
    } else {
      base = dataStore.cities.getAll().map((c) => ({
        ...c,
        presence_status: decadePresence.get(c.city_id) ?? "unknown",
      }));
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) =>
      `${c.city_ancient} ${c.city_label} ${c.city_modern} ${c.country_modern}`.toLowerCase().includes(q),
    );
  }, [search, currentDecade, includeCumulative, mapVisibleOnly, decadePresence]);

  const pageItems = cities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const mapVisibleCount = decadePresence.size;

  return (
    <>
      {/* Toggle: show all (default) vs map-visible only */}
      <div className="list-filter-bar">
        <span className="faint" style={{ fontSize: "0.72rem" }}>
          {mapVisibleOnly ? `${cities.length} on map` : `${cities.length} total · ${mapVisibleCount} on map`}
        </span>
        <button
          type="button"
          className={`list-filter-toggle${mapVisibleOnly ? " active" : ""}`}
          onClick={() => setMapVisibleOnly((v) => !v)}
          title={mapVisibleOnly ? "Showing map-visible only — click for all" : "Showing all cities — click to filter to map-visible"}
        >
          {mapVisibleOnly ? "🗺 Map only" : "🌍 Show all"}
        </button>
      </div>

      {cities.length === 0
        ? <div className="empty-state">No cities found.</div>
        : <>
            {pageItems.map((c) => (
              <div key={c.city_id} className="sidebar-list-item" onClick={() => onSelectCity(c.city_id)}>
                <span className="sli-dot" style={{ background: presenceColor(c.presence_status) }} />
                <div className="sli-main">
                  <div className="sli-name"><Hl text={c.city_label} query={search} /></div>
                  <div className="sli-meta">
                    {c.city_ancient !== c.city_label ? `${c.city_ancient} · ` : ""}
                    {c.country_modern}
                    {!mapVisibleOnly && decadePresence.has(c.city_id) && (
                      <span style={{ color: "var(--attested)", marginLeft: 4, fontSize: "0.7rem" }}>on map</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="sli-fly-btn"
                  title="Fly to"
                  onClick={(e) => { e.stopPropagation(); onFlyToCity(c.city_id); }}
                >
                  ⌖
                </button>
              </div>
            ))}
            <Pagination page={page} total={cities.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
      }
    </>
  );
}

// ─── Archaeology list ─────────────────────────────────────────────────────────

export function ArchaeologyList({ search, currentDecade, onSelect, onFlyToSite }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  onFlyToSite: (id: string) => void;
}) {
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const [page, setPage] = useState(0);
  const [mapVisibleOnly, setMapVisibleOnly] = useState(false);
  useEffect(() => { setPage(0); }, [search, currentDecade, includeCumulative, mapVisibleOnly]);

  const mapVisibleSites = useMemo(() => {
    return includeCumulative
      ? dataStore.archaeology.getCumulativeAtDecade(currentDecade)
      : dataStore.archaeology.getActiveAtDecade(currentDecade);
  }, [currentDecade, includeCumulative]);

  const sites = useMemo(() => {
    const base = mapVisibleOnly ? mapVisibleSites : dataStore.archaeology.getAll();
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((a) => `${a.name_display} ${a.site_type} ${a.description ?? ""}`.toLowerCase().includes(q));
  }, [search, mapVisibleOnly, mapVisibleSites]);

  const pageItems = sites.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="list-filter-bar">
        <span className="faint" style={{ fontSize: "0.72rem" }}>
          {mapVisibleOnly ? `${sites.length} on map` : `${sites.length} total · ${mapVisibleSites.length} on map`}
        </span>
        <button
          type="button"
          className={`list-filter-toggle${mapVisibleOnly ? " active" : ""}`}
          onClick={() => setMapVisibleOnly((v) => !v)}
          title={mapVisibleOnly ? "Showing map-visible only — click for all" : "Showing all sites — click to filter to map-visible"}
        >
          {mapVisibleOnly ? "🗺 Map only" : "🌍 Show all"}
        </button>
      </div>
      {sites.length === 0
        ? <div className="empty-state">No archaeology sites found.</div>
        : <>
            {pageItems.map((a) => (
              <div key={a.archaeology_id} className="sidebar-list-item" onClick={() => onSelect(a.archaeology_id)}>
                <span className="sli-icon">★</span>
                <div className="sli-main">
                  <div className="sli-name">{a.name_display}</div>
                  <div className="sli-meta">{a.site_type}{a.year_start ? ` · AD ${a.year_start}` : ""}</div>
                </div>
                {a.lat != null && a.lon != null && (
                  <button
                    type="button"
                    className="sli-fly-btn"
                    title="Fly to"
                    onClick={(e) => { e.stopPropagation(); onFlyToSite(a.archaeology_id); }}
                  >
                    ⌖
                  </button>
                )}
              </div>
            ))}
            <Pagination page={page} total={sites.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
      }
    </>
  );
}

// ─── Persuasions list ─────────────────────────────────────────────────────────

export function PersuasionsList({ search, currentDecade, onSelect, mapFilterId, mapFilterType }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  mapFilterId: string | null;
  mapFilterType: string | null;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, currentDecade]);

  const rows = useMemo(() => {
    const statesAtDecade = dataStore.map.getCitiesAtDecade(currentDecade);
    const countByPersuasion: Record<string, number> = {};
    for (const c of statesAtDecade) {
      for (const pid of c.persuasion_ids ?? []) {
        countByPersuasion[pid] = (countByPersuasion[pid] ?? 0) + 1;
      }
    }
    const all = dataStore.persuasions.getAll();
    const q = search.trim().toLowerCase();
    return all
      .filter((p) => !q || p.persuasion_label.toLowerCase().includes(q))
      .map((p) => ({ ...p, count: countByPersuasion[p.persuasion_id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [search, currentDecade]);

  if (rows.length === 0) return <div className="empty-state">No persuasions found.</div>;

  const pageItems = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {pageItems.map((p) => {
        const isFiltered = mapFilterType === "persuasion" && mapFilterId === p.persuasion_id;
        return (
          <div
            key={p.persuasion_id}
            className={`sidebar-list-item${isFiltered ? " selected" : ""}`}
            onClick={() => onSelect(p.persuasion_id)}
          >
            <span className="sli-icon">❆</span>
            <div className="sli-main">
              <div className="sli-name">{p.persuasion_label}</div>
              {p.count > 0 && <div className="sli-meta">{p.count} cities at AD {currentDecade}</div>}
            </div>
            {p.count > 0 && <span className="sli-badge">{p.count}</span>}
          </div>
        );
      })}
      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Polities list ────────────────────────────────────────────────────────────

export function PolitiesList({ search, currentDecade, onSelect, mapFilterId, mapFilterType }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  mapFilterId: string | null;
  mapFilterType: string | null;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, currentDecade]);

  const rows = useMemo(() => {
    const statesAtDecade = dataStore.map.getCitiesAtDecade(currentDecade);
    const countByPolity: Record<string, number> = {};
    for (const c of statesAtDecade) {
      if (c.polity_id) countByPolity[c.polity_id] = (countByPolity[c.polity_id] ?? 0) + 1;
    }
    const all = dataStore.polities.getAll();
    const q = search.trim().toLowerCase();
    return all
      .filter((p) => !q || p.polity_label.toLowerCase().includes(q))
      .map((p) => ({ ...p, count: countByPolity[p.polity_id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [search, currentDecade]);

  if (rows.length === 0) return <div className="empty-state">No polities found.</div>;

  const pageItems = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {pageItems.map((p) => {
        const isFiltered = mapFilterType === "polity" && mapFilterId === p.polity_id;
        return (
          <div
            key={p.polity_id}
            className={`sidebar-list-item${isFiltered ? " selected" : ""}`}
            onClick={() => onSelect(p.polity_id)}
          >
            <span className="sli-icon">⚔</span>
            <div className="sli-main">
              <div className="sli-name">{p.polity_label}</div>
              {p.count > 0 && <div className="sli-meta">{p.count} cities at AD {currentDecade}</div>}
            </div>
            {p.count > 0 && <span className="sli-badge">{p.count}</span>}
          </div>
        );
      })}
      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── People list ──────────────────────────────────────────────────────────────

export function PeopleList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search]);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.people.getAll();
    if (!q) return all;
    return all.filter((p) => `${p.person_label} ${p.name_alt.join(" ")} ${p.roles.join(" ")} ${p.description}`.toLowerCase().includes(q));
  }, [search]);

  if (people.length === 0) return <div className="empty-state">No people found.</div>;

  const pageItems = people.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {pageItems.map((p) => (
        <div key={p.person_id} className="sidebar-list-item" onClick={() => onSelect(p.person_id)}>
          <span className="sli-icon">👤</span>
          <div className="sli-main">
            <div className="sli-name">{p.person_label}</div>
            <div className="sli-meta">
              {p.roles.slice(0, 2).join(", ")}
              {(p.birth_year || p.death_year) ? ` · ${p.birth_year ? `b.${p.birth_year}` : ""}${p.death_year ? ` d.${p.death_year}` : ""}` : ""}
            </div>
          </div>
        </div>
      ))}
      <Pagination page={page} total={people.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Doctrines list ───────────────────────────────────────────────────────────

export function DoctrinesList({ search, subTab, onSubTabChange, onSelect, onSelectEntity }: {
  search: string;
  subTab: "doctrines" | "quotes";
  onSubTabChange: (t: "doctrines" | "quotes") => void;
  onSelect: (id: string) => void;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const hl = search.trim();
  const [dPage, setDPage] = useState(0);
  const [qPage, setQPage] = useState(0);
  useEffect(() => { setDPage(0); setQPage(0); }, [hl, subTab]);

  const doctrines = useMemo(() => {
    const q = hl.toLowerCase();
    const all = dataStore.doctrines.getAll();
    if (!q) return all;
    return all.filter((d) =>
      `${d.name_display} ${d.category} ${d.description}`.toLowerCase().includes(q) ||
      dataStore.quotes.getByDoctrine(d.doctrine_id).some((qt) => qt.text.toLowerCase().includes(q)),
    );
  }, [hl]);

  const allQuotes = useMemo(() => {
    const q = hl.toLowerCase();
    const all = dataStore.quotes.getAll().slice().sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    if (!q) return all;
    return all.filter((qt) =>
      qt.text.toLowerCase().includes(q) ||
      qt.work_reference.toLowerCase().includes(q) ||
      (qt.notes ?? "").toLowerCase().includes(q),
    );
  }, [hl]);

  const docPage = doctrines.slice(dPage * PAGE_SIZE, (dPage + 1) * PAGE_SIZE);
  const quotePage = allQuotes.slice(qPage * PAGE_SIZE, (qPage + 1) * PAGE_SIZE);

  return (
    <>
      <div className="sub-tabs" style={{ padding: "0 8px" }}>
        <button type="button" className={`sub-tab${subTab === "doctrines" ? " active" : ""}`} onClick={() => onSubTabChange("doctrines")}>
          Doctrines ({doctrines.length})
        </button>
        <button type="button" className={`sub-tab${subTab === "quotes" ? " active" : ""}`} onClick={() => onSubTabChange("quotes")}>
          All Quotes {hl ? `(${allQuotes.length})` : ""}
        </button>
      </div>

      {subTab === "doctrines" && (
        doctrines.length === 0
          ? <div className="empty-state">No doctrines found.</div>
          : <>
              {docPage.map((d) => (
                <div key={d.doctrine_id} className="sidebar-list-item" onClick={() => onSelect(d.doctrine_id)}>
                  <span className="sli-icon">📖</span>
                  <div className="sli-main">
                    <div className="sli-name"><Hl text={d.name_display} query={hl} /></div>
                    <div className="sli-meta">
                      {d.category}
                      {d.first_attested_year ? ` · AD ${d.first_attested_year}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              <Pagination page={dPage} total={doctrines.length} pageSize={PAGE_SIZE} onChange={setDPage} />
            </>
      )}

      {subTab === "quotes" && (
        allQuotes.length === 0
          ? <div className="empty-state">No quotes found.</div>
          : <>
              {quotePage.map((qt) => {
                const doctrine = qt.doctrine_id ? dataStore.doctrines.getById(qt.doctrine_id) : null;
                const work     = qt.work_id     ? dataStore.works.getById(qt.work_id)         : null;
                return (
                  <div
                    key={qt.quote_id}
                    className="note-card"
                    style={{ margin: "4px 8px", cursor: "pointer" }}
                    onClick={() => onSelectEntity("quote", qt.quote_id)}
                  >
                    <div className="note-year" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {qt.year ? `AD ${qt.year}` : ""}
                      {qt.stance ? ` · ${qt.stance}` : ""}
                      {doctrine && (
                        <button type="button" className="mention-link" style={{ marginLeft: "auto" }}
                          onClick={(e) => { e.stopPropagation(); onSelectEntity("doctrine", doctrine.doctrine_id); }}>
                          {doctrine.name_display}
                        </button>
                      )}
                    </div>
                    <p style={{ fontStyle: "italic", margin: "4px 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
                      &ldquo;<Hl text={qt.text} query={hl} />&rdquo;
                    </p>
                    {qt.work_reference && (
                      <div style={{ fontSize: "0.73rem", color: "var(--text-faint)" }}>
                        — <Hl text={qt.work_reference} query={hl} />
                        {work && (
                          <button type="button" className="mention-link" style={{ marginLeft: 5 }}
                            onClick={(e) => { e.stopPropagation(); onSelectEntity("work", work.work_id); }}>
                            {work.title_display}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <Pagination page={qPage} total={allQuotes.length} pageSize={PAGE_SIZE} onChange={setQPage} />
            </>
      )}
    </>
  );
}

// ─── Events list ──────────────────────────────────────────────────────────────

export function EventsList({ search, currentDecade, onSelect }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, currentDecade]);

  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.events.getAll()
      .filter((e) => (e.year_start ?? 0) <= currentDecade + 10)
      .sort((a, b) => (a.year_start ?? 0) - (b.year_start ?? 0));
    if (!q) return all;
    return all.filter((e) => `${e.name_display} ${e.event_type} ${e.region} ${e.description}`.toLowerCase().includes(q));
  }, [search, currentDecade]);

  if (events.length === 0) return <div className="empty-state">No events found.</div>;

  const pageItems = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {pageItems.map((e) => (
        <div key={e.event_id} className="sidebar-list-item" onClick={() => onSelect(e.event_id)}>
          <span className="sli-icon">⚡</span>
          <div className="sli-main">
            <div className="sli-name">{e.name_display}</div>
            <div className="sli-meta">
              {e.year_start ? `AD ${e.year_start}` : ""}
              {e.event_type ? ` · ${e.event_type}` : ""}
            </div>
          </div>
        </div>
      ))}
      <Pagination page={page} total={events.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Works list ───────────────────────────────────────────────────────────────

export function WorksList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search]);

  const works = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = dataStore.works.getAll().sort((a, b) => (a.year_written_start ?? 0) - (b.year_written_start ?? 0));
    if (!q) return all;
    return all.filter((w) =>
      `${w.title_display} ${w.author_name_display} ${w.description} ${w.work_type}`.toLowerCase().includes(q),
    );
  }, [search]);

  if (works.length === 0) return <div className="empty-state">No works found.</div>;

  const pageItems = works.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {pageItems.map((w) => (
        <div key={w.work_id} className="sidebar-list-item" onClick={() => onSelect(w.work_id)}>
          <span className="sli-icon">📜</span>
          <div className="sli-main">
            <div className="sli-name">{w.title_display}</div>
            <div className="sli-meta">
              {w.author_name_display}
              {w.year_written_start ? ` · AD ${w.year_written_start}` : ""}
            </div>
          </div>
        </div>
      ))}
      <Pagination page={page} total={works.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Essays list ──────────────────────────────────────────────────────────────

export function EssaysList({ search, essays, loading, onSelect }: {
  search: string;
  essays: Essay[];
  loading: boolean;
  onSelect: (essay: Essay) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return essays;
    return essays.filter((e) =>
      `${e.title} ${e.summary} ${e.body}`.toLowerCase().includes(q),
    );
  }, [search, essays]);

  if (loading) return <div className="empty-state">Loading essays…</div>;
  if (filtered.length === 0) return <div className="empty-state">No essays found.</div>;

  return (
    <>
      {filtered.map((e) => (
        <div key={e.id}>
          <div
            className="sidebar-list-item"
            style={{ alignItems: "center" }}
            onClick={() => onSelect(e)}
          >
            <span className="sli-icon">✍</span>
            <div className="sli-main">
              <div className="sli-name">{e.title}</div>
            </div>
            {e.summary && (
              <button
                type="button"
                onClick={(evt) => {
                  evt.stopPropagation();
                  setExpandedId(expandedId === e.id ? null : e.id);
                }}
                title={expandedId === e.id ? "Hide summary" : "Show summary"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-faint)", fontSize: "0.7rem", padding: "2px 4px",
                  flexShrink: 0,
                }}
              >
                {expandedId === e.id ? "▲" : "▼"}
              </button>
            )}
          </div>
          {expandedId === e.id && e.summary && (
            <div style={{
              padding: "6px 12px 8px 36px",
              fontSize: "0.8rem", color: "var(--text-muted)",
              lineHeight: 1.5, borderBottom: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
            }}>
              {e.summary}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
