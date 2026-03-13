import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import s from "./WikiPage.module.css";
import { useAppStore } from "../stores/appStore";
import { dataStore } from "../data/dataStore";
import { kindIcon, kindLabel, KIND_ICONS, ENTITY_TABS } from "../components/shared/entityConstants";
import { GlobalSearchOverlay } from "../components/shared/GlobalSearchOverlay";
import { ESSAYS } from "../data/essays";
import { MarkdownRenderer } from "../components/shared/MarkdownRenderer";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { useWikiPageState } from "../hooks/useWikiPageState";
import { Pagination } from "../components/shared/Pagination";
import { CrossPageNav } from "../components/shared/CrossPageNav";
import { NoteCard } from "../components/shared/NoteCard";
import { EntityHeader as SharedEntityHeader } from "../components/shared/EntityHeader";
import { ToggleGroup } from "../components/shared/ToggleGroup";
import { Tabs } from "../components/shared/Tabs";
import { SearchInput } from "../components/shared/SearchInput";
import { Hl } from "../components/shared/Hl";
import { EntityDetail } from "../components/panel/EntityDetail";
import { getAllEntities } from "../utils/entityListHelpers";
import { ClaimsPanel } from "../components/wiki/ClaimsPanel";
import { ClaimDetailPanel } from "../components/wiki/ClaimDetailPanel";
import { AuditView } from "../components/wiki/AuditView";
import { extractEssayEntities, groupByKind } from "../utils/extractEssayEntities";

// ─── Entity list (left panel) ─────────────────────────────────────────────────

function EntityList({ kind, search, selectedId, onSelect }: {
  kind: string; search: string; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const all = useMemo(() => getAllEntities(kind).sort((a, b) => b.count - a.count), [kind]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return all;
    return all.filter((e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  }, [all, search]);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(filtered, 40);

  if (filtered.length === 0) return <div className={s.emptyState}>No results.</div>;
  return (
    <div className={s.entityList}>
      {pageItems.map((e) => (
        <button key={e.id} type="button"
          className={`${s.entityItem}${selectedId === e.id ? ` ${s.entityItemActive}` : ""}`}
          onClick={() => onSelect(e.id)}>
          <span className={s.entityItemLabel}><Hl text={e.label} query={search} /></span>
          {e.count > 0 && <span className={s.entityItemCount} title={e.countLabel}>{e.count}</span>}
        </button>
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── WikiPage (root) ──────────────────────────────────────────────────────────

export function WikiPage() {
  const navigate = useNavigate();
  const wiki = useWikiPageState();
  const scrollMapRef = useRef<Map<string, number>>(new Map());
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const {
    mode, setMode, entityKind, selectEntityKind,
    search, setSearch,
    selection, history, pushSelection, popSelection,
    selectedClaimId, setSelectedClaimId, handleSelectEntity, handleSelectClaim,
    viewMode, setViewMode,
  } = wiki;

  const [wikiEssayTab, setWikiEssayTab] = useState<"content" | "entities">("content");
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;

  // Save scroll position continuously via onScroll
  const handleBodyScroll = useCallback(() => {
    if (scrollBodyRef.current && selKey) {
      scrollMapRef.current.set(selKey, scrollBodyRef.current.scrollTop);
    }
  }, [selKey]);

  // Restore scroll position when selection changes
  useEffect(() => {
    if (!selKey) return;
    requestAnimationFrame(() => {
      if (scrollBodyRef.current) {
        const saved = scrollMapRef.current.get(selKey);
        scrollBodyRef.current.scrollTop = saved ?? 0;
      }
    });
  }, [selKey]);

  return (
    <div className={s.page}>
      {/* ── Left panel ── */}
      <div className={s.left}>
        <div className={s.leftHeader}>
          <div className={s.panelEyebrow}>Data Wiki</div>
          <ToggleGroup
            options={[{ value: "browse", label: "Browse" }, { value: "audit", label: "Audit" }]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {/* Global search */}
        <div className={s.globalSearch}>
          <GlobalSearchOverlay onSelect={handleSelectEntity} />
        </div>

        {mode === "browse" && (
          <>
            <Tabs
              tabs={ENTITY_TABS.map((t) => ({ id: t.kind, label: t.label, icon: KIND_ICONS[t.kind] ?? "•" }))}
              active={entityKind}
              onChange={selectEntityKind}
              vertical
            />
            <div className={s.searchBar}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={`Filter ${ENTITY_TABS.find((t) => t.kind === entityKind)?.label.toLowerCase() ?? ""}…`}
              />
            </div>
            <EntityList kind={entityKind} search={search} selectedId={selection?.kind === entityKind ? selection.id : null}
              onSelect={(id) => { pushSelection({ kind: entityKind, id }); }} />
          </>
        )}

        {mode === "audit" && (
          <div className={s.auditLeftInfo}>
            <div className={s.auditLeftTitle}>Claim Audit</div>
            <p className={`${s.faint} ${s.auditDesc}`}>
              Review all claims across every entity. Filter by status, entity type, certainty, and predicate to find issues.
            </p>
            <div className={s.auditColorKey}>
              <div className={s.auditKeyItem}><span className={`${s.auditKeyDot} ${s.auditKeyDotRed}`} />No evidence / Disputed</div>
              <div className={s.auditKeyItem}><span className={`${s.auditKeyDot} ${s.auditKeyDotOrange}`} />Unreviewed</div>
              <div className={s.auditKeyItem}><span className={`${s.auditKeyDot} ${s.auditKeyDotGreen}`} />Approved</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Center ── */}
      <div className={s.center}>
        {mode === "browse" && selection ? (
          <div className={s.browseDetail}>
            {/* Compact top bar: back + nav links (left) | view toggle (right) */}
            <div className={s.detailTopbar}>
              <div className={s.detailTopbarLeft}>
                {history.length > 0 && (
                  <button type="button" className={s.backBtn} onClick={popSelection}>← Back</button>
                )}
                {selection.kind !== "essay" && selection.kind !== "editor_note" && (
                  <CrossPageNav kind={selection.kind} id={selection.id} current="wiki" />
                )}
                {selection.kind === "essay" && (
                  <button type="button" className={s.essayNavBtn} onClick={() => {
                    useAppStore.getState().setPendingEssay(selection.id);
                    useAppStore.getState().setPanelTab("essays");
                    if (!useAppStore.getState().rightPanelVisible) useAppStore.getState().toggleRightPanel();
                    navigate("/");
                  }} title="Open in map">🗺️ Open in map</button>
                )}
              </div>
              {selection.kind !== "essay" && selection.kind !== "editor_note" && (
                <ToggleGroup
                  options={[{ value: "relations", label: "Relations" }, { value: "claims", label: "Claims" }]}
                  value={viewMode}
                  onChange={setViewMode}
                />
              )}
            </div>
            {selection.kind === "essay" ? (() => {
              const essay = ESSAYS.find((e) => e.id === selection.id);
              if (!essay) return <div className={s.emptyState}>Essay not found.</div>;
              const groups = groupByKind(extractEssayEntities(essay.body));
              const entCount = groups.reduce((n, [, refs]) => n + refs.length, 0);
              return (
                <>
                  <div className={s.essayTabBar}>
                    <button type="button" className={`${s.essayTab}${wikiEssayTab === "content" ? ` ${s.essayTabActive}` : ""}`}
                      onClick={() => setWikiEssayTab("content")}>Content</button>
                    <button type="button" className={`${s.essayTab}${wikiEssayTab === "entities" ? ` ${s.essayTabActive}` : ""}`}
                      onClick={() => setWikiEssayTab("entities")}>Entities ({entCount})</button>
                  </div>
                  {wikiEssayTab === "content" ? (
                    <div className={s.detailBodyStyle} ref={scrollBodyRef} onScroll={handleBodyScroll}>
                      <h2 className={s.essayTitle}>{essay.title}</h2>
                      <p className={`${s.faint} ${s.essaySummary}`}>{essay.summary}</p>
                      <MarkdownRenderer onSelectEntity={handleSelectEntity}>{essay.body}</MarkdownRenderer>
                    </div>
                  ) : (
                    <div className={s.detailBodyStyle}>
                      {groups.map(([kind, refs]) => (
                        <div key={kind}>
                          <div className={s.entityGroupLabel}>{kindLabel(kind)} ({refs.length})</div>
                          {refs.map((r) => (
                            <button key={`${r.kind}:${r.id}`} type="button" className={s.entityItem}
                              onClick={() => handleSelectEntity(r.kind, r.id)}>
                              <span className={s.entityItemIcon}>{kindIcon(r.kind)}</span>
                              <span className={s.entityItemLabel}>{r.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })() : selection.kind === "editor_note" ? (() => {
              const note = dataStore.editorNotes.getById(selection.id);
              if (!note) return <div className={s.emptyState}>Note not found.</div>;
              return (
                <div className={s.detailBodyStyle}>
                  <NoteCard note={note} onSelectEntity={handleSelectEntity} yearLabel={note.note_kind} />
                </div>
              );
            })() : viewMode === "relations" ? (
              <EntityDetail
                key={`${selection.kind}:${selection.id}`}
                kind={selection.kind}
                id={selection.id}
                hideBackBar
                currentPage="wiki"
                onBack={popSelection}
                onSelectEntity={handleSelectEntity}
              />
            ) : (
              <>
                <div className={s.claimsHeaderWrap}>
                  <SharedEntityHeader kind={selection.kind} id={selection.id} showAllFields onSelectEntity={handleSelectEntity}
                    hideExternalLink={selection.kind === "work" || selection.kind === "source"} />
                </div>
                <ClaimsPanel kind={selection.kind} id={selection.id}
                  onSelectEntity={handleSelectEntity} selectedClaimId={selectedClaimId} onSelectClaim={handleSelectClaim} />
              </>
            )}
          </div>
        ) : mode === "browse" ? (
          <div className={s.emptyCenter}>
            <div className={`${s.panelEyebrow} ${s.emptyCenterHeading}`}>Select an entity</div>
            <div className={s.faint}>Choose an entity from the browser or use the global search.</div>
          </div>
        ) : (
          <AuditView onSelectEntity={handleSelectEntity} onSelectClaim={handleSelectClaim} selectedClaimId={selectedClaimId} />
        )}
      </div>

      {/* ── Right: claim detail ── */}
      {selectedClaimId && (
        <ClaimDetailPanel claimId={selectedClaimId} onSelectEntity={handleSelectEntity}
          onClose={() => setSelectedClaimId(null)} focusKind={selection?.kind} />
      )}
    </div>
  );
}
