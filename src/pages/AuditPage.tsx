import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { ClaimEvidence } from "../data/types";
import {
  getAuditRows, getComputedFlags, getSourceTier,
  COMPUTED_FLAG_INFO, type ClaimAuditRow,
} from "../utils/claimAudit";
import { getPredicateLabel } from "../domain/relationLabels";
import { CertaintyBadge } from "../components/shared/CertaintyBadge";
import { DerivationChain } from "../components/shared/DerivationChain";
import { PassageReference } from "../components/shared/PassageReference";
import { SearchInput } from "../components/shared/SearchInput";
import { Pagination } from "../components/shared/Pagination";
import { EntityHoverWrap } from "../components/shared/EntityHoverCard";
import { KindIcon } from "../components/shared/entityConstants";
import { formatYearRange } from "../utils/formatYear";
import { BookOpen, FileText, Search } from "lucide-react";
import s from "./AuditPage.module.css";

type QueueFilter = "all" | "flagged" | "no-evidence" | "needs-revision" | "unreviewed" | "approved" | "disputed" | "PARAPHRASE_RISK" | "UNSCORED_WEIGHT" | "TERTIARY_ONLY";

function claimSentence(row: ClaimAuditRow): string {
  const c = row.claim;
  const sub = getEntityLabel(c.subject_type ?? "", c.subject_id ?? "");
  const pred = getPredicateLabel(c.predicate_id ?? "", true);
  const obj = c.object_mode === "entity" && c.object_id
    ? getEntityLabel(c.object_type ?? "", c.object_id ?? "")
    : (c.value_text || c.value_year?.toString() || "");
  return `${sub} ${pred} ${obj}`;
}

function statusChipCls(status: string): string {
  if (status === "approved") return s.flagGreen ?? "";
  if (status === "disputed" || status === "no-evidence") return s.flagRed ?? "";
  if (status === "needs-revision") return s.flagYellow ?? "";
  return s.flagGray ?? "";
}

function reviewBadgeCls(status: string): string {
  if (status === "approved") return s.reviewApproved ?? "";
  if (status === "reviewed") return s.reviewReviewed ?? "";
  if (status === "disputed") return s.reviewDisputed ?? "";
  return s.reviewDefault ?? "";
}

function WeightBar({ weight, unscored }: { weight: number | null; unscored?: boolean }) {
  if (weight === null) return <span className={s.weightUnscored}>{unscored ? "unscored" : "—"}</span>;
  const fillPx = Math.round(weight * 32);
  const cls = weight >= 0.7 ? s.weightHigh : weight >= 0.4 ? s.weightMid : s.weightLow;
  return (
    <span className={s.weightBarWrap}>
      <span className={`${s.weightBarFill} ${cls}`} style={{ width: `${fillPx}px` }} />
      <span className={s.weightNum}>{weight.toFixed(2)}</span>
    </span>
  );
}

function SourceTierBadge({ sourceKind }: { sourceKind: string }) {
  const tier = getSourceTier(sourceKind);
  const cls = tier === "tier_1" ? s.tier1 : tier === "tier_2" ? s.tier2 : s.tier3;
  const title = tier === "tier_1" ? "Primary source" : tier === "tier_2" ? "Secondary source" : "Tertiary source (web/wiki)";
  const label = tier === "tier_1" ? "T1" : tier === "tier_2" ? "T2" : "T3";
  return <span className={`${s.tierBadge} ${cls}`} title={title}>{label}</span>;
}

function AssertionBadge({ mode }: { mode: string }) {
  const cls = mode === "explicit" ? s.assertExplicit
    : mode === "strong_inference" ? s.assertStrong
    : mode === "weak_inference" ? s.assertWeak
    : s.assertBg;
  const label = mode === "explicit" ? "explicit"
    : mode === "strong_inference" ? "strong inf."
    : mode === "weak_inference" ? "weak inf."
    : mode || "—";
  return <span className={`${s.assertBadge} ${cls}`}>{label}</span>;
}

function StatusProgressBar({ rows }: { rows: ClaimAuditRow[] }) {
  const total = rows.length;
  if (total === 0) return null;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const segs = [
    { key: "approved", cls: s.segApproved, label: "Approved" },
    { key: "ok",       cls: s.segOk,       label: "Reviewed" },
    { key: "needs-revision", cls: s.segNeedsRev, label: "Needs revision" },
    { key: "disputed", cls: s.segDisputed, label: "Disputed" },
    { key: "unreviewed", cls: s.segUnreviewed, label: "Unreviewed" },
    { key: "no-evidence", cls: s.segNoEv, label: "No evidence" },
  ];
  return (
    <div className={s.progressBar} title={segs.map((seg) => `${seg.label}: ${counts[seg.key] ?? 0}`).join(" | ")}>
      {segs.map((seg) => {
        const pct = ((counts[seg.key] ?? 0) / total) * 100;
        if (pct === 0) return null;
        return <div key={seg.key} className={`${s.progressSeg} ${seg.cls}`} style={{ width: `${pct}%` }} />;
      })}
    </div>
  );
}

// ── Clickable entity reference ──
function EntityRef({ type, id, onSelect }: { type: string; id: string; onSelect: (k: string, i: string) => void }) {
  const label = getEntityLabel(type, id);
  return (
    <EntityHoverWrap kind={type} id={id}>
      <button type="button" className={s.entityBtn} onClick={() => onSelect(type, id)}>
        <KindIcon kind={type} size={14} /> {label}
      </button>
    </EntityHoverWrap>
  );
}

const PAGE_SIZE = 50;

export function AuditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [derivationEdgeId, setDerivationEdgeId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const allRows = useMemo(() => getAuditRows(), []);

  // Sync selectedId + filter to URL so ShareButton captures full state
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedId) params.set("claimId", selectedId);
    if (filter !== "all") params.set("filter", filter);
    const q = params.toString();
    window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
  }, [selectedId, filter]);

  useEffect(() => {
    const claimId = searchParams.get("claimId");
    const edgeId = searchParams.get("edgeId");
    if (edgeId) {
      setDerivationEdgeId(edgeId);
      // Auto-select the first supporting claim from the edge
      const edge = dataStore.derivedEdges.getById(edgeId);
      if (edge && edge.supporting_claim_ids.length > 0) {
        const firstClaim = edge.supporting_claim_ids[0]!;
        setSelectedId(firstClaim);
        const idx = allRows.findIndex((r) => r.claim.claim_id === firstClaim);
        if (idx !== -1) { setPage(Math.floor(idx / PAGE_SIZE)); setFilter("all"); }
      }
    } else if (claimId) {
      setSelectedId(claimId);
      setDerivationEdgeId(null);
      const idx = allRows.findIndex((r) => r.claim.claim_id === claimId);
      if (idx !== -1) { setPage(Math.floor(idx / PAGE_SIZE)); setFilter("all"); }
    } else {
      const f = searchParams.get("filter") as QueueFilter | null;
      if (f) setFilter(f);
    }
  }, [searchParams, allRows]);

  const filtered = useMemo(() => {
    let list = allRows;
    if (filter === "flagged") list = list.filter((r) => r.status !== "approved" && r.status !== "ok");
    else if (filter === "no-evidence") list = list.filter((r) => r.status === "no-evidence");
    else if (filter === "needs-revision") list = list.filter((r) => r.status === "needs-revision");
    else if (filter === "unreviewed") list = list.filter((r) => r.status === "unreviewed");
    else if (filter === "approved") list = list.filter((r) => r.status === "approved");
    else if (filter === "disputed") list = list.filter((r) => r.status === "disputed");
    else if (filter === "PARAPHRASE_RISK") list = list.filter((r) => r.computedFlags.includes("PARAPHRASE_RISK"));
    else if (filter === "UNSCORED_WEIGHT") list = list.filter((r) => r.hasUnscoredSupports);
    else if (filter === "TERTIARY_ONLY") list = list.filter((r) => r.computedFlags.includes("TERTIARY_ONLY"));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => claimSentence(r).toLowerCase().includes(q) || r.claim.claim_id.toLowerCase().includes(q));
    }
    return list;
  }, [allRows, filter, search]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selected = selectedId ? allRows.find((r) => r.claim.claim_id === selectedId) : null;
  const selectedClaim = selected?.claim ?? null;
  const selectedEvidence: ClaimEvidence[] = selectedClaim ? dataStore.claimEvidence.getForClaim(selectedClaim.claim_id) : [];
  const selectedReviews = selectedClaim ? dataStore.claimReviews.getForClaim(selectedClaim.claim_id) : [];
  const selectedEvents = selectedClaim ? dataStore.claimReviewEvents.getForClaim(selectedClaim.claim_id) : [];

  const selectedEdges = useMemo(() => {
    if (!selectedClaim) return [];
    return dataStore.derivedEdges.getAll().filter((e) =>
      e.directness === "derived" && e.supporting_claim_ids.includes(selectedClaim.claim_id)
    );
  }, [selectedClaim]);

  const selectedComputedFlags = useMemo(() =>
    selectedClaim ? getComputedFlags(selectedClaim, selectedEvidence) : [],
  [selectedClaim, selectedEvidence]);

  const onSelectEntity = (kind: string, id: string) => {
    if (kind === "claim") { setSelectedId(id); return; }
    navigate(`/wiki?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
  };

  const filterCounts = useMemo(() => ({
    all: allRows.length,
    flagged: allRows.filter((r) => r.status !== "approved" && r.status !== "ok").length,
    "no-evidence": allRows.filter((r) => r.status === "no-evidence").length,
    "needs-revision": allRows.filter((r) => r.status === "needs-revision").length,
    unreviewed: allRows.filter((r) => r.status === "unreviewed").length,
    approved: allRows.filter((r) => r.status === "approved").length,
    disputed: allRows.filter((r) => r.status === "disputed").length,
    PARAPHRASE_RISK: allRows.filter((r) => r.computedFlags.includes("PARAPHRASE_RISK")).length,
    UNSCORED_WEIGHT: allRows.filter((r) => r.hasUnscoredSupports).length,
    TERTIARY_ONLY: allRows.filter((r) => r.computedFlags.includes("TERTIARY_ONLY")).length,
  }), [allRows]);

  const queueFilters: { key: QueueFilter; label: string; variant?: "flag" }[] = [
    { key: "all", label: `All (${filterCounts.all})` },
    { key: "flagged", label: `Flagged (${filterCounts.flagged})` },
    { key: "no-evidence", label: `No Evidence (${filterCounts["no-evidence"]})` },
    { key: "needs-revision", label: `Needs Revision (${filterCounts["needs-revision"]})` },
    { key: "unreviewed", label: `Unreviewed (${filterCounts.unreviewed})` },
    { key: "approved", label: `Approved (${filterCounts.approved})` },
    { key: "disputed", label: `Disputed (${filterCounts.disputed})` },
    { key: "PARAPHRASE_RISK", label: `Paraphrase Risk (${filterCounts.PARAPHRASE_RISK})`, variant: "flag" },
    { key: "UNSCORED_WEIGHT", label: `Unscored (${filterCounts.UNSCORED_WEIGHT})`, variant: "flag" },
    { key: "TERTIARY_ONLY", label: `Tertiary Only (${filterCounts.TERTIARY_ONLY})`, variant: "flag" },
  ];

  return (
    <div className={s.root}>
      {/* ── Left: Claim Queue ── */}
      <div className={s.queue}>
        <div className={s.queueHeader}>
          <div className={s.queueTitle}>Claim Queue <span className={s.queueCount}>{filtered.length} of {allRows.length}</span></div>
          <StatusProgressBar rows={allRows} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search claims..." />
          <div className={s.queueFilters}>
            {queueFilters.map((f) => (
              <button key={f.key}
                className={`${s.filterChip}${filter === f.key ? ` ${s.filterChipActive}` : ""}${f.variant === "flag" ? ` ${s.filterChipFlag}` : ""}`}
                onClick={() => { setFilter(f.key); setPage(0); }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className={s.queueList}>
          {pageItems.map((item) => (
            <div key={item.claim.claim_id}
              className={`${s.queueItem}${selectedId === item.claim.claim_id ? ` ${s.queueItemActive}` : ""}`}
              onClick={() => setSelectedId(item.claim.claim_id)}>
              <div className={s.queueSentence}>{claimSentence(item)}</div>
              <div className={s.queueMeta}>
                <span className={`${s.flag} ${statusChipCls(item.status)}`}>{item.status.replace("-", " ")}</span>
                {item.computedFlags.map((f) => (
                  <span key={f} className={`${s.flag} ${s.flagOrange}`}>{f.replace(/_/g, " ").toLowerCase()}</span>
                ))}
                <span className={s.queueMetaNum}>ev:{item.evidenceCount}</span>
                {item.avgWeight !== null && <WeightBar weight={item.avgWeight} />}
                <span className={s.queueMetaFaint}>{item.claim.certainty}</span>
              </div>
            </div>
          ))}
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Center: Full Claim Detail ── */}
      <div className={s.center}>
        {!selectedClaim ? (
          <div className={s.emptyCenter}>
            <Search size={28} className={s.emptyIcon} />
            <span>Select a claim from the queue to inspect</span>
          </div>
        ) : (
          <>
            {/* ── Claim Identity ── */}
            <div className={s.claimCard}>
              <div className={s.claimSentence}>{claimSentence(selected!)}</div>
              <div className={s.claimDetails}>
                <CertaintyBadge value={selectedClaim.certainty} />
                <span className={s.detailChip}>{selectedClaim.claim_status}</span>
                {selectedClaim.year_start != null && (
                  <span className={s.detailChip}>{formatYearRange(selectedClaim.year_start, selectedClaim.year_end) || `AD ${selectedClaim.year_start}`}</span>
                )}
                {selectedClaim.context_place_id && (
                  <span className={s.detailChip}>@ {getEntityLabel("place", selectedClaim.context_place_id)}</span>
                )}
                {selected?.avgWeight !== undefined && (
                  <span className={s.claimAvgWeight}>
                    avg wt: <WeightBar weight={selected.avgWeight} unscored={selected.hasUnscoredSupports} />
                  </span>
                )}
                <span className={s.claimId}>{selectedClaim.claim_id}</span>
              </div>
            </div>

            {/* ── All Claim Fields ── */}
            <div className={s.sectionCard}>
              <div className={s.sectionTitle}>Claim Structure</div>
              <div className={s.fieldGrid}>
                <span className={s.fieldLabel}>Subject</span>
                <span><EntityRef type={selectedClaim.subject_type} id={selectedClaim.subject_id} onSelect={onSelectEntity} /></span>
                <span className={s.fieldLabel}>Predicate</span>
                <span className={s.fieldValue}>{getPredicateLabel(selectedClaim.predicate_id, true)} <span className={s.faint}>({selectedClaim.predicate_id})</span></span>
                <span className={s.fieldLabel}>Object</span>
                <span>
                  {selectedClaim.object_mode === "entity" && selectedClaim.object_id ? (
                    <EntityRef type={selectedClaim.object_type ?? ""} id={selectedClaim.object_id} onSelect={onSelectEntity} />
                  ) : (
                    <span className={s.fieldValue}>
                      {selectedClaim.value_text || selectedClaim.value_year?.toString() || selectedClaim.value_number?.toString() || (selectedClaim.value_boolean != null ? String(selectedClaim.value_boolean) : "—")}
                      <span className={s.faint}> ({selectedClaim.object_mode})</span>
                    </span>
                  )}
                </span>
                <span className={s.fieldLabel}>Certainty</span>
                <span><CertaintyBadge value={selectedClaim.certainty} /> <span className={s.faint}>({selectedClaim.certainty})</span></span>
                <span className={s.fieldLabel}>Date Range</span>
                <span className={s.fieldValue}>{formatYearRange(selectedClaim.year_start, selectedClaim.year_end) || "—"}</span>
                {selectedClaim.context_place_id && <>
                  <span className={s.fieldLabel}>Context Place</span>
                  <span><EntityRef type="place" id={selectedClaim.context_place_id} onSelect={onSelectEntity} /></span>
                </>}
                <span className={s.fieldLabel}>Status</span>
                <span className={s.fieldValue}>{selectedClaim.claim_status}</span>
                <span className={s.fieldLabel}>Created By</span>
                <span className={s.fieldValue}>{selectedClaim.created_by || "—"}</span>
                <span className={s.fieldLabel}>Updated At</span>
                <span className={s.fieldValue}>{selectedClaim.updated_at || "—"}</span>
              </div>
            </div>

            {/* ── Evidence ── */}
            <div className={s.sectionCard}>
              <div className={s.sectionTitle}>Evidence ({selectedEvidence.length})</div>
              <div className={s.evidenceList}>
                {selectedEvidence.length === 0 ? (
                  <div className={s.faint}>No evidence linked to this claim</div>
                ) : (
                  selectedEvidence.map((ev) => {
                    const passage = dataStore.passages.getById(ev.passage_id);
                    const source = passage ? dataStore.sources.getById(passage.source_id) : undefined;
                    return (
                      <div key={`${ev.claim_id}-${ev.passage_id}`} className={s.evRow}>
                        {/* Evidence Fields */}
                        <div className={s.evSection}>
                          <div className={s.evSectionTitle}>Evidence Fields</div>
                          <div className={s.evFields}>
                            <span className={s.evFieldLabel}>Claim ID</span>
                            <span className={s.fieldValue}>
                              <EntityHoverWrap kind="claim" id={ev.claim_id}>
                                <button type="button" className={s.entityBtn} onClick={() => onSelectEntity("claim", ev.claim_id)}>
                                  {ev.claim_id}
                                </button>
                              </EntityHoverWrap>
                            </span>
                            
                            <span className={s.evFieldLabel}>Passage ID</span>
                            <span className={s.fieldValue}>
                              {passage ? (
                                <EntityHoverWrap kind="passage" id={ev.passage_id}>
                                  <button type="button" className={s.entityBtn} onClick={() => onSelectEntity("passage", ev.passage_id)}>
                                    <BookOpen size={13} /> {ev.passage_id}
                                  </button>
                                </EntityHoverWrap>
                              ) : ev.passage_id}
                            </span>

                            <span className={s.evFieldLabel}>Evidence Role</span>
                            <span className={`${s.evRoleBadge} ${ev.evidence_role === "supports" ? s.evRoleSupports : ev.evidence_role === "opposes" ? s.evRoleOpposes : s.evRoleOther}`}>{ev.evidence_role}</span>

                            {ev.support_aspect && (
                              <>
                                <span className={s.evFieldLabel}>Support Aspect</span>
                                <span className={s.evMetaChip}>{ev.support_aspect}</span>
                              </>
                            )}

                            {ev.assertion_mode && (
                              <>
                                <span className={s.evFieldLabel}>Assertion Mode</span>
                                <AssertionBadge mode={ev.assertion_mode} />
                              </>
                            )}

                            {ev.excerpt_override && (
                              <>
                                <span className={s.evFieldLabel}>Excerpt Override</span>
                                <span className={s.evExcerpt}>"{ev.excerpt_override}"</span>
                              </>
                            )}

                            <span className={s.evFieldLabel}>Evidence Weight</span>
                            <WeightBar weight={ev.evidence_weight} unscored={ev.evidence_role === "supports" && ev.evidence_weight == null} />

                            {ev.notes && (
                              <>
                                <span className={s.evFieldLabel}>Evidence Notes</span>
                                <span className={s.fieldValue}>{ev.notes}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Passage Fields */}
                        {passage && (
                          <div className={s.evSection}>
                            <div className={s.evSectionTitle}>Passage Fields</div>
                            <div className={s.evFields}>
                              <span className={s.evFieldLabel}>Source</span>
                              <span className={s.fieldValue}>
                                {source ? (
                                  <span className={s.evSourceRow}>
                                    <EntityHoverWrap kind="source" id={source.source_id}>
                                      <button type="button" className={s.entityBtn} onClick={() => onSelectEntity("source", source.source_id)}>
                                        <FileText size={12} /> {source.source_id}
                                      </button>
                                    </EntityHoverWrap>
                                    <SourceTierBadge sourceKind={source.source_kind} />
                                  </span>
                                ) : passage.source_id}
                              </span>

                              <span className={s.evFieldLabel}>Locator Type</span>
                              <span className={s.fieldValue}>{passage.locator_type}</span>

                              <span className={s.evFieldLabel}>Locator</span>
                              <span className={s.fieldValue}>
                                <PassageReference passage={passage} source={source} />
                              </span>

                              {passage.excerpt && (
                                <>
                                  <span className={s.evFieldLabel}>Passage Excerpt</span>
                                  <span className={s.evExcerpt}>"{passage.excerpt}"</span>
                                </>
                              )}

                              <span className={s.evFieldLabel}>Language</span>
                              <span className={s.fieldValue}>{passage.language}</span>

                              {passage.passage_year != null && (
                                <>
                                  <span className={s.evFieldLabel}>Passage Year</span>
                                  <span className={s.fieldValue}>{passage.passage_year}</span>
                                </>
                              )}

                              {passage.url_override && (
                                <>
                                  <span className={s.evFieldLabel}>URL Override</span>
                                  <span className={s.fieldValue}>
                                    <a href={passage.url_override} target="_blank" rel="noopener noreferrer" className={s.extLink}>
                                      {passage.url_override}
                                    </a>
                                  </span>
                                </>
                              )}

                              {passage.notes && (
                                <>
                                  <span className={s.evFieldLabel}>Passage Notes</span>
                                  <span className={s.fieldValue}>{passage.notes}</span>
                                </>
                              )}

                              {source && (
                                <>
                                  <span className={s.evFieldLabel}>Source Title</span>
                                  <span className={s.fieldValue}>{source.title}</span>
                                </>
                              )}

                              {source?.url && (
                                <>
                                  <span className={s.evFieldLabel}>Source URL</span>
                                  <span className={s.fieldValue}>
                                    <a href={source.url} target="_blank" rel="noopener noreferrer" className={s.extLink}>
                                      ↗ Open Source
                                    </a>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Review & Derivation ── */}
      <div className={s.right}>
        {!selectedClaim ? (
          <div className={s.emptyRight}>No claim selected</div>
        ) : (
          <>
            {selectedComputedFlags.length > 0 && (
              <div className={s.rightSection}>
                <div className={s.rightTitle}>Audit Flags ({selectedComputedFlags.length})</div>
                <div className={s.computedFlagList}>
                  {selectedComputedFlags.map((flag) => {
                    const info = COMPUTED_FLAG_INFO[flag];
                    const cls = info?.severity === "red" ? s.computedFlagRed
                      : info?.severity === "orange" ? s.computedFlagOrange
                      : s.computedFlagYellow;
                    return (
                      <div key={flag} className={`${s.computedFlagItem} ${cls}`}>
                        <span className={s.computedFlagCode}>{flag}</span>
                        {info && <span className={s.computedFlagLabel}>{info.label}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={s.rightSection}>
              <div className={s.rightTitle}>Review Status</div>
              {selectedReviews.length === 0 ? (
                <div className={s.faint}>Unreviewed</div>
              ) : (
                selectedReviews.map((r, i) => (
                  <div key={i} className={s.reviewRow}>
                    <span className={`${s.reviewBadge} ${reviewBadgeCls(r.review_status)}`}>{r.review_status}</span>
                    <span>{r.reviewer_id}</span>
                    <span className={s.faint}>{r.confidence}</span>
                  </div>
                ))
              )}
            </div>

            {selectedEvents.length > 0 && (
              <div className={s.rightSection}>
                <div className={s.rightTitle}>Review History ({selectedEvents.length})</div>
                {selectedEvents.map((ev, i) => (
                  <div key={i} className={s.eventRow}>
                    <div className={s.eventHeader}>
                      <span className={s.eventType}>{ev.event_type}</span>
                      <span>{ev.actor_id}</span>
                      <span className={s.faint}>{ev.event_at}</span>
                    </div>
                    {ev.note && <div className={s.faint}>{ev.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {derivationEdgeId && (() => {
              const focusEdge = dataStore.derivedEdges.getById(derivationEdgeId);
              if (!focusEdge) return null;
              return (
                <div className={s.rightSection}>
                  <div className={s.rightTitle}>Focused Derivation Trail</div>
                  <div className={s.derivationRow}>
                    <DerivationChain edgeId={derivationEdgeId} onSelectEntity={onSelectEntity} />
                  </div>
                  {focusEdge.supporting_claim_ids.length > 1 && (
                    <div className={s.derivClaimLinks}>
                      {focusEdge.supporting_claim_ids.map((cid) => {
                        const row = allRows.find((r) => r.claim.claim_id === cid);
                        const claim = row?.claim ?? dataStore.claims.getById(cid);
                        if (!claim) {
                          return (
                            <span key={cid} className={s.faint} title="Claim not found — regenerate derived tables (npm run data:validate)">
                              {cid} (not found)
                            </span>
                          );
                        }
                        return (
                          <button key={cid} type="button"
                            className={`${s.derivClaimLink}${selectedId === cid ? ` ${s.derivClaimLinkActive}` : ""}`}
                            onClick={() => setSelectedId(cid)}>
                            {claimSentence(row ?? ({ claim } as ClaimAuditRow))}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedEdges.length > 0 && (
              <div className={s.rightSection}>
                <div className={s.rightTitle}>Derivation Chains ({selectedEdges.length})</div>
                {selectedEdges.map((edge) => (
                  <div key={edge.edge_id} className={s.derivationRow}>
                    <DerivationChain edgeId={edge.edge_id} onSelectEntity={onSelectEntity} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
