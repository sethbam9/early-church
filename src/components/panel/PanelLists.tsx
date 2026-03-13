import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/dataStore";
import type { PlaceKind } from "../../data/dataStore";
import { Hl } from "../shared/Hl";
import { Pagination, PAGE_SIZE } from "../shared/Pagination";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { presenceColor } from "../shared/entityConstants";
import { FilterChips } from "../shared/FilterChips";
import { Switch } from "../shared/Switch";
import type { Essay } from "../../data/essays";
import s from "./PanelLists.module.css";

// ─── Places list (unified — replaces CitiesList + ArchaeologyList) ───────────

const PLACE_KIND_OPTIONS: { value: PlaceKind; label: string }[] = [
  { value: "city", label: "City" },
  { value: "region", label: "Region" },
  { value: "site", label: "Site" },
  { value: "province", label: "Province" },
  { value: "monastery", label: "Monastery" },
  { value: "route", label: "Route" },
];

export function PlacesList({ search, currentDecade, onSelectPlace, onFlyToPlace,
  placeKindFilterOverride, setPlaceKindFilterOverride,
  christianOnlyOverride, setChristianOnlyOverride,
}: {
  search: string;
  currentDecade: number;
  onSelectPlace: (id: string) => void;
  onFlyToPlace: (id: string) => void;
  placeKindFilterOverride?: PlaceKind | null;
  setPlaceKindFilterOverride?: (k: PlaceKind | null) => void;
  christianOnlyOverride?: boolean;
  setChristianOnlyOverride?: (v: boolean) => void;
}) {
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const storePlaceKindFilter   = useAppStore((s) => s.activePlaceKindFilter);
  const storeSetPlaceKindFilter = useAppStore((s) => s.setPlaceKindFilter);
  const storeChristianOnly     = useAppStore((s) => s.christianOnly);
  const storeSetChristianOnly  = useAppStore((s) => s.setChristianOnly);

  const placeKindFilter = placeKindFilterOverride !== undefined ? placeKindFilterOverride : storePlaceKindFilter;
  const setPlaceKindFilter = setPlaceKindFilterOverride ?? storeSetPlaceKindFilter;
  const christianOnly = christianOnlyOverride !== undefined ? christianOnlyOverride : storeChristianOnly;
  const setChristianOnly = setChristianOnlyOverride ?? storeSetChristianOnly;
  const [page, setPage]   = useState(0);
  const [mapVisibleOnly, setMapVisibleOnly] = useState(false);

  useEffect(() => { setPage(0); }, [search, currentDecade, includeCumulative, mapVisibleOnly, placeKindFilter, christianOnly]);

  const decadePresence = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of dataStore.map.getCumulativePlacesAtDecade(currentDecade)) {
      m.set(p.place_id, p.presence_status);
    }
    return m;
  }, [currentDecade]);

  const places = useMemo(() => {
    let base = mapVisibleOnly
      ? (includeCumulative
          ? dataStore.map.getCumulativePlacesAtDecade(currentDecade)
          : dataStore.map.getPlacesAtDecade(currentDecade))
        .map((p) => ({ ...p }))
      : dataStore.places.getAll().map((p) => ({
          ...p,
          presence_status: decadePresence.get(p.place_id) ?? "unknown",
        }));

    if (placeKindFilter) {
      base = base.filter((p) => p.place_kind === placeKindFilter);
    }
    if (christianOnly) {
      base = base.filter((p) => dataStore.map.placeHasChristianity(p.place_id));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((p) =>
        `${p.place_label} ${p.place_label_modern} ${p.modern_country_label}`.toLowerCase().includes(q),
      );
    }
    return base;
  }, [search, currentDecade, includeCumulative, mapVisibleOnly, decadePresence, placeKindFilter, christianOnly]);

  const pageItems = places.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const mapVisibleCount = decadePresence.size;

  return (
    <>
      <FilterChips label="Place type" options={PLACE_KIND_OPTIONS} active={placeKindFilter} onChange={setPlaceKindFilter} />
      <div className={s.filterBar}>
        <span className={`${s.faint} ${s.filterBarCount}`}>
          {mapVisibleOnly ? `${places.length} on map` : `${places.length} total · ${mapVisibleCount} on map`}
        </span>
        <div className={s.filterBarActions}>
          <Switch checked={christianOnly} onChange={setChristianOnly} label="Christian" />
          <button
            type="button"
            className={`${s.listFilterToggle}${mapVisibleOnly ? ` ${s.listFilterToggleActive}` : ""}`}
            onClick={() => setMapVisibleOnly((v) => !v)}
            title={mapVisibleOnly ? "Showing map-visible only — click for all" : "Showing all places — click to filter to map-visible"}
          >
            {mapVisibleOnly ? "🌍 Show all" : "🗺 Map only"}
          </button>
        </div>
      </div>

      {places.length === 0
        ? <div className={s.emptyState}>No places found.</div>
        : <>
            {pageItems.map((p) => (
              <div key={p.place_id} className={s.listItem} onClick={() => onSelectPlace(p.place_id)}>
                <span className={s.dot} style={{ background: presenceColor((p as any).presence_status ?? "unknown") }} />
                <div className={s.main}>
                  <div className={s.name}><Hl text={p.place_label} query={search} /></div>
                  <div className={s.meta}>
                    {p.place_label_modern && p.place_label_modern !== p.place_label ? `${p.place_label_modern} · ` : ""}
                    {p.modern_country_label}
                    <span className={`${s.faint} ${s.placeKindTag}`}>{p.place_kind}</span>
                    {!mapVisibleOnly && decadePresence.has(p.place_id) && (
                      <span className={s.onMapTag}>on map</span>
                    )}
                  </div>
                </div>
                {p.lat != null && p.lon != null && (
                  <button
                    type="button"
                    className={s.flyBtn}
                    title="Fly to"
                    onClick={(e) => { e.stopPropagation(); onFlyToPlace(p.place_id); }}
                  >
                    ⌖
                  </button>
                )}
              </div>
            ))}
            <Pagination page={page} total={places.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
      }
    </>
  );
}

// ─── Groups list (replaces PersuasionsList + PolitiesList) ───────────────────

const GROUP_KIND_OPTIONS = [
  { value: "communion" as const, label: "Communion" },
  { value: "school" as const, label: "School" },
  { value: "sect" as const, label: "Sect" },
  { value: "polity" as const, label: "Polity" },
  { value: "faction" as const, label: "Faction" },
  { value: "order" as const, label: "Order" },
];

export function GroupsList({ search, currentDecade, onSelect, mapFilterId, mapFilterType }: {
  search: string;
  currentDecade: number;
  onSelect: (id: string) => void;
  mapFilterId: string | null;
  mapFilterType: string | null;
}) {
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const rows = useMemo(() => {
    const statesAtDecade = dataStore.map.getPlacesAtDecade(currentDecade);
    const countByGroup: Record<string, number> = {};
    for (const ps of statesAtDecade) {
      for (const gid of ps.group_presence_summary) {
        countByGroup[gid] = (countByGroup[gid] ?? 0) + 1;
      }
    }
    let all = dataStore.groups.getAll();
    if (kindFilter) {
      all = all.filter((g) => g.group_kind === kindFilter);
    }
    const q = search.trim().toLowerCase();
    return all
      .filter((g) => !q || g.group_label.toLowerCase().includes(q))
      .map((g) => ({ ...g, count: countByGroup[g.group_id] ?? 0 }))
      .sort((a, b) => a.group_label.localeCompare(b.group_label));
  }, [search, currentDecade, kindFilter]);

  const { page, setPage, pageItems } = usePaginatedList(rows, PAGE_SIZE);

  if (rows.length === 0 && !kindFilter) return <div className={s.emptyState}>No groups found.</div>;

  return (
    <>
      <FilterChips label="Filter by kind" options={GROUP_KIND_OPTIONS} active={kindFilter} onChange={setKindFilter} />
      {rows.length === 0
        ? <div className={s.emptyState}>No groups match this filter.</div>
        : null}
      {pageItems.map((g) => {
        const isFiltered = mapFilterType === "group" && mapFilterId === g.group_id;
        return (
          <div
            key={g.group_id}
            className={s.listItem}
            onClick={() => onSelect(g.group_id)}
          >
            <span className={s.icon}>✦</span>
            <div className={s.main}>
              <div className={s.name}>{g.group_label}</div>
              <div className={s.meta}>
                {g.group_kind}
                {g.count > 0 && ` · ${g.count} places at AD ${currentDecade}`}
              </div>
            </div>
            {g.count > 0 && <span className={s.badge}>{g.count}</span>}
          </div>
        );
      })}
      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── People list ──────────────────────────────────────────────────────────────

const PERSON_KIND_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "anonymous_author", label: "Anonymous Author" },
  { value: "collective_author", label: "Collective Author" },
  { value: "composite_figure", label: "Composite Figure" },
];

export function PeopleList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const [kindFilter, setKindFilter] = useState<string | null>(null);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    let all = dataStore.people.getAll();
    if (kindFilter) all = all.filter((p) => p.person_kind === kindFilter);
    if (!q) return all;
    return all.filter((p) => `${p.person_label} ${p.name_alt.join(" ")} ${p.notes}`.toLowerCase().includes(q));
  }, [search, kindFilter]);

  const { page, setPage, pageItems } = usePaginatedList(people, PAGE_SIZE);

  if (people.length === 0 && !kindFilter) return <div className={s.emptyState}>No people found.</div>;

  return (
    <>
      <FilterChips label="Filter by kind" options={PERSON_KIND_OPTIONS} active={kindFilter} onChange={setKindFilter} />
      {people.length === 0 ? <div className={s.emptyState}>No people match this filter.</div> : null}
      {pageItems.map((p) => (
        <div key={p.person_id} className={s.listItem} onClick={() => onSelect(p.person_id)}>
          <span className={s.icon}>👤</span>
          <div className={s.main}>
            <div className={s.name}>{p.person_label}</div>
            <div className={s.meta}>
              {p.person_kind !== "individual" ? p.person_kind : ""}
              {p.birth_year_display ? ` ${p.birth_year_display}` : ""}
              {p.death_year_display ? ` – ${p.death_year_display}` : ""}
            </div>
          </div>
        </div>
      ))}
      <Pagination page={page} total={people.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Propositions list (replaces DoctrinesList) ──────────────────────────────

export function PropositionsList({ search, onSelect }: {
  search: string;
  onSelect: (id: string) => void;
}) {
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  const topicOptions = useMemo(() =>
    dataStore.topics.getAll().map((t) => ({ value: t.topic_id, label: t.topic_label })),
    [],
  );

  const propositions = useMemo(() => {
    const q = search.trim().toLowerCase();
    let all = dataStore.propositions.getAll();
    if (topicFilter) all = all.filter((p) => p.topic_id === topicFilter);
    if (!q) return all;
    return all.filter((p) =>
      `${p.proposition_label} ${p.description} ${p.polarity_family}`.toLowerCase().includes(q),
    );
  }, [search, topicFilter]);

  const { page, setPage, pageItems } = usePaginatedList(propositions, PAGE_SIZE);

  if (propositions.length === 0 && !topicFilter) return <div className={s.emptyState}>No propositions found.</div>;

  return (
    <>
      <FilterChips label="Filter by topic" options={topicOptions} active={topicFilter} onChange={setTopicFilter} />
      {propositions.length === 0 ? <div className={s.emptyState}>No propositions match this filter.</div> : null}
      {pageItems.map((p) => {
        const topic = dataStore.topics.getById(p.topic_id);
        return (
          <div key={p.proposition_id} className={s.listItem} onClick={() => onSelect(p.proposition_id)}>
            <span className={s.icon}>📝</span>
            <div className={s.main}>
              <div className={s.name}><Hl text={p.proposition_label} query={search} /></div>
              <div className={s.meta}>
                {topic?.topic_label ?? p.topic_id}
              </div>
            </div>
          </div>
        );
      })}
      <Pagination page={page} total={propositions.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Events list ──────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: "council", label: "Council" },
  { value: "mission", label: "Mission" },
  { value: "persecution", label: "Persecution" },
  { value: "political", label: "Political" },
  { value: "literary", label: "Literary" },
  { value: "other", label: "Other" },
];

export function EventsList({ search, onSelect }: {
  search: string;
  onSelect: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    let all = dataStore.events.getAll();
    if (typeFilter) all = all.filter((e) => e.event_type === typeFilter);
    if (!q) return all;
    return all.filter((e) => `${e.event_label} ${e.event_type} ${e.notes}`.toLowerCase().includes(q));
  }, [search, typeFilter]);

  const { page, setPage, pageItems } = usePaginatedList(events, PAGE_SIZE);

  if (events.length === 0 && !typeFilter) return <div className={s.emptyState}>No events found.</div>;

  return (
    <>
      <FilterChips label="Filter by type" options={EVENT_TYPE_OPTIONS} active={typeFilter} onChange={setTypeFilter} />
      {events.length === 0 ? <div className={s.emptyState}>No events match this filter.</div> : null}
      {pageItems.map((e) => (
        <div key={e.event_id} className={s.listItem} onClick={() => onSelect(e.event_id)}>
          <span className={s.icon}>⚡</span>
          <div className={s.main}>
            <div className={s.name}>{e.event_label}</div>
            <div className={s.meta}>{e.event_type}</div>
          </div>
        </div>
      ))}
      <Pagination page={page} total={events.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

// ─── Works list ───────────────────────────────────────────────────────────────

const WORK_TYPE_OPTIONS = [
  { value: "letter", label: "Letter" },
  { value: "chronicle", label: "Chronicle" },
  { value: "treatise", label: "Treatise" },
  { value: "other", label: "Other" },
];

export function WorksList({ search, onSelect }: { search: string; onSelect: (id: string) => void }) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const works = useMemo(() => {
    const q = search.trim().toLowerCase();
    let all = dataStore.works.getAll();
    if (typeFilter) all = all.filter((w) => w.work_type === typeFilter);
    if (!q) return all;
    return all.filter((w) =>
      `${w.title_display} ${w.title_original} ${w.work_type} ${w.notes}`.toLowerCase().includes(q),
    );
  }, [search, typeFilter]);

  const { page, setPage, pageItems } = usePaginatedList(works, PAGE_SIZE);

  if (works.length === 0 && !typeFilter) return <div className={s.emptyState}>No works found.</div>;

  return (
    <>
      <FilterChips label="Filter by type" options={WORK_TYPE_OPTIONS} active={typeFilter} onChange={setTypeFilter} />
      {works.length === 0 ? <div className={s.emptyState}>No works match this filter.</div> : null}
      {pageItems.map((w) => (
        <div key={w.work_id} className={s.listItem} onClick={() => onSelect(w.work_id)}>
          <span className={s.icon}>📜</span>
          <div className={s.main}>
            <div className={s.name}>{w.title_display}</div>
            <div className={s.meta}>
              {w.work_type}
              {w.language_original ? ` · ${w.language_original}` : ""}
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

  if (loading) return <div className={s.emptyState}>Loading essays…</div>;
  if (filtered.length === 0) return <div className={s.emptyState}>No essays found.</div>;

  return (
    <>
      {filtered.map((e) => (
        <div key={e.id}>
          <div
            className={`${s.listItem} ${s.listItemCenter}`}
            onClick={() => onSelect(e)}
          >
            <span className={s.icon}>✍</span>
            <div className={s.main}>
              <div className={s.name}>{e.title}</div>
            </div>
            {e.summary && (
              <button
                type="button"
                className={s.expandBtn}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setExpandedId(expandedId === e.id ? null : e.id);
                }}
                title={expandedId === e.id ? "Hide summary" : "Show summary"}
              >
                {expandedId === e.id ? "▲" : "▼"}
              </button>
            )}
          </div>
          {expandedId === e.id && e.summary && (
            <div className={s.expandedSummary}>
              {e.summary}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
