import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Claim, ClaimEvidence } from "../data/types";
import { getPredicateLabel } from "../domain/relationLabels";
import { CertaintyBadge } from "../components/shared/CertaintyBadge";
import { DerivationChain } from "../components/shared/DerivationChain";
import { PassageReference } from "../components/shared/PassageReference";
import { SearchInput } from "../components/shared/SearchInput";
import { EntityHoverWrap } from "../components/shared/EntityHoverCard";
import { KindIcon } from "../components/shared/entityConstants";
import { formatYearRange } from "../utils/formatYear";
import { BookOpen, FileText } from "lucide-react";
import s from "./AuditPage.module.css";

type QueueFilter = "all" | "flagged" | "no_evidence" | "no_supports" | "unreviewed" | "approved" | "disputed";

interface ClaimFlags {
  claim: Claim;
  flags: string[];
  evidenceCount: number;
  reviewStatus: string;
}

function buildClaimFlags(): ClaimFlags[] {
  const allClaims = dataStore.claims.getAll().filter((c: Claim) => c.claim_status === "active");
  const out: ClaimFlags[] = [];
  for (const claim of allClaims) {
    const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
    const reviews = dataStore.claimReviews.getForClaim(claim.claim_id);
    const reviewStatus = reviews.length > 0 ? (reviews[0]?.review_status ?? "unreviewed") : "unreviewed";
    const flags: string[] = [];
    if (evidence.length === 0) flags.push("no_evidence");
    else {
      const roles = new Set(evidence.map((e) => e.evidence_role));
      if (!roles.has("supports")) flags.push("no_supports");
    }
    if (reviewStatus === "disputed") flags.push("disputed");
    if (reviewStatus === "unreviewed") flags.push("unreviewed");
    out.push({ claim, flags, evidenceCount: evidence.length, reviewStatus });
  }
  out.sort((a, b) => {
    const rank = (f: ClaimFlags) => {
      if (f.flags.includes("disputed")) return 0;
      if (f.flags.includes("no_evidence")) return 1;
      if (f.flags.includes("no_supports")) return 2;
      if (f.flags.includes("unreviewed")) return 3;
      return 4;
    };
    return rank(a) - rank(b);
  });
  return out;
}

function claimSentence(c: Claim): string {
  const sub = getEntityLabel(c.subject_type ?? "", c.subject_id ?? "");
  const pred = getPredicateLabel(c.predicate_id ?? "", true);
  const obj = c.object_mode === "entity" && c.object_id
    ? getEntityLabel(c.object_type ?? "", c.object_id ?? "")
    : (c.value_text || c.value_year?.toString() || "");
  return `${sub} ${pred} ${obj}`;
}

function flagInfo(flag: string): { text: string; cls: string } {
  switch (flag) {
    case "no_evidence": return { text: "No evidence", cls: s.flagRed ?? "" };
    case "no_supports": return { text: "No supports", cls: s.flagYellow ?? "" };
    case "disputed": return { text: "Disputed", cls: s.flagRed ?? "" };
    case "unreviewed": return { text: "Unreviewed", cls: s.flagGray ?? "" };
    default: return { text: flag, cls: s.flagGray ?? "" };
  }
}

function reviewBadgeCls(status: string): string {
  if (status === "approved") return s.reviewApproved ?? "";
  if (status === "reviewed") return s.reviewReviewed ?? "";
  if (status === "disputed") return s.reviewDisputed ?? "";
  return s.reviewDefault ?? "";
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
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const allFlags = useMemo(() => buildClaimFlags(), []);

  // Handle claimId from URL parameter
  useEffect(() => {
    const claimId = searchParams.get('claimId');
    if (claimId) {
      setSelectedId(claimId);
      
      // Find the claim in the filtered list and navigate to its page
      const claimIndex = allFlags.findIndex((f) => f.claim.claim_id === claimId);
      if (claimIndex !== -1) {
        const targetPage = Math.floor(claimIndex / PAGE_SIZE);
        setPage(targetPage);
        
        // Set filter to "all" to ensure the claim is visible
        setFilter("all");
      }
    }
  }, [searchParams, allFlags]);

  const filtered = useMemo(() => {
    let list = allFlags;
    if (filter === "flagged") list = list.filter((f) => f.flags.length > 0);
    else if (filter === "no_evidence") list = list.filter((f) => f.flags.includes("no_evidence"));
    else if (filter === "no_supports") list = list.filter((f) => f.flags.includes("no_supports"));
    else if (filter === "unreviewed") list = list.filter((f) => f.reviewStatus === "unreviewed");
    else if (filter === "approved") list = list.filter((f) => f.reviewStatus === "approved");
    else if (filter === "disputed") list = list.filter((f) => f.flags.includes("disputed"));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => claimSentence(f.claim).toLowerCase().includes(q) || f.claim.claim_id.toLowerCase().includes(q));
    }
    return list;
  }, [allFlags, filter, search]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const selected = selectedId ? allFlags.find((f) => f.claim.claim_id === selectedId) : null;
  const selectedClaim = selected?.claim ?? null;
  const selectedEvidence: ClaimEvidence[] = selectedClaim ? dataStore.claimEvidence.getForClaim(selectedClaim.claim_id) : [];
  const selectedReviews = selectedClaim ? dataStore.claimReviews.getForClaim(selectedClaim.claim_id) : [];
  const selectedEvents = selectedClaim ? dataStore.claimReviewEvents.getForClaim(selectedClaim.claim_id) : [];

  const selectedEdges = useMemo(() => {
    if (!selectedClaim) return [];
    return dataStore.derivedEdges.getAll().filter((e) =>
      e.supporting_claim_ids.includes(selectedClaim.claim_id)
    );
  }, [selectedClaim]);

  const onSelectEntity = (kind: string, id: string) => {
    if (kind === "claim") { setSelectedId(id); return; }
    // Navigate to Wiki with URL params so useWikiPageState picks up the deep link
    navigate(`/wiki?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
  };

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<QueueFilter, number> = {
      all: allFlags.length,
      flagged: allFlags.filter((f) => f.flags.length > 0).length,
      no_evidence: allFlags.filter((f) => f.flags.includes("no_evidence")).length,
      no_supports: allFlags.filter((f) => f.flags.includes("no_supports")).length,
      unreviewed: allFlags.filter((f) => f.reviewStatus === "unreviewed").length,
      approved: allFlags.filter((f) => f.reviewStatus === "approved").length,
      disputed: allFlags.filter((f) => f.flags.includes("disputed")).length,
    };
    return counts;
  }, [allFlags]);

  const filters: { key: QueueFilter; label: string }[] = [
    { key: "all", label: `All (${filterCounts.all})` },
    { key: "flagged", label: `Flagged (${filterCounts.flagged})` },
    { key: "no_evidence", label: `No Evidence (${filterCounts.no_evidence})` },
    { key: "no_supports", label: `No Supports (${filterCounts.no_supports})` },
    { key: "unreviewed", label: `Unreviewed (${filterCounts.unreviewed})` },
    { key: "approved", label: `Approved (${filterCounts.approved})` },
    { key: "disputed", label: `Disputed (${filterCounts.disputed})` },
  ];

  return (
    <div className={s.root}>
      {/* ── Left: Claim Queue ── */}
      <div className={s.queue}>
        <div className={s.queueHeader}>
          <div>Claim Queue <span className={s.queueCount}>{filtered.length} claims</span></div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search claims..." />
          <div className={s.queueFilters}>
            {filters.map((f) => (
              <button key={f.key}
                className={`${s.filterChip}${filter === f.key ? ` ${s.filterChipActive}` : ""}`}
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
              <div className={s.queueSentence}>{claimSentence(item.claim)}</div>
              <div className={s.queueMeta}>
                {item.flags.map((f) => {
                  const fl = flagInfo(f);
                  return <span key={f} className={`${s.flag} ${fl.cls}`}>{fl.text}</span>;
                })}
                <span>ev:{item.evidenceCount}</span>
                <span>{item.claim.certainty}</span>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className={s.pagination}>
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>&larr; Prev</button>
              <span>{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next &rarr;</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Full Claim Detail ── */}
      <div className={s.center}>
        {!selectedClaim ? (
          <div className={s.emptyCenter}>
            <span className={s.emptyIcon}>🔍</span>
            <span>Select a claim from the queue to inspect</span>
          </div>
        ) : (
          <>
            {/* ── Claim Identity ── */}
            <div className={s.claimCard}>
              <div className={s.claimSentence}>{claimSentence(selectedClaim)}</div>
              <div className={s.claimDetails}>
                <CertaintyBadge value={selectedClaim.certainty} />
                <span className={s.detailChip}>{selectedClaim.claim_status}</span>
                {selectedClaim.year_start != null && (
                  <span className={s.detailChip}>{formatYearRange(selectedClaim.year_start, selectedClaim.year_end) || `AD ${selectedClaim.year_start}`}</span>
                )}
                {selectedClaim.context_place_id && (
                  <span className={s.detailChip}>@ {getEntityLabel("place", selectedClaim.context_place_id)}</span>
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
                                <span className={s.evMetaChip}>{ev.assertion_mode}</span>
                              </>
                            )}

                            {ev.excerpt_override && (
                              <>
                                <span className={s.evFieldLabel}>Excerpt Override</span>
                                <span className={s.evExcerpt}>"{ev.excerpt_override}"</span>
                              </>
                            )}

                            {ev.evidence_weight != null && (
                              <>
                                <span className={s.evFieldLabel}>Evidence Weight</span>
                                <span className={s.evMetaChip}>{ev.evidence_weight}</span>
                              </>
                            )}

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
                              <span className={s.evFieldLabel}>Source ID</span>
                              <span className={s.fieldValue}>
                                {source ? (
                                  <EntityHoverWrap kind="source" id={source.source_id}>
                                    <button type="button" className={s.entityBtn} onClick={() => onSelectEntity("source", source.source_id)}>
                                      <FileText size={12} /> {source.source_id}
                                    </button>
                                  </EntityHoverWrap>
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
