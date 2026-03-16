#!/usr/bin/env python3
"""
audit_conjoin.py  –  Claim Audit Pipeline
Phase 0  Preflight normalization (source tiers, excerpt forms, high-reuse, fragmentary works)
Phase 1  Deterministic structural flags per claim
Phase 2  Batch generation (Queue 0A high-reuse, 0B structural purge, 1+ subject-batched)

Usage:
    python3 scripts/audit_conjoin.py --data-dir data
"""

import argparse
import csv
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

# ── constants ────────────────────────────────────────────────────────────────

BATCH_MIN = 10
BATCH_MAX = 20
SUBJECT_NOSPLIT = 25        # don't split subjects with ≤ this many claims
HIGH_REUSE_PSG = 10         # passage used in ≥ N evidence rows
HIGH_REUSE_SRC = 50         # source used in ≥ N evidence rows

SOURCE_TIER_MAP = {
    "primary_text":     "tier_1_primary",
    "inscription":      "tier_1_primary",
    "modern_book":      "tier_2_secondary",
    "journal_article":  "tier_2_secondary",
    "reference_work":   "tier_2_secondary",
    "web_page":         "tier_3_tertiary",
    "database":         "tier_3_tertiary",
    "other":            "tier_3_tertiary",
}
SOURCE_KIND_OVERRIDES = {
    "src-quis-dives-salvetur": "primary_text",
}

PERSON_PROP_PREDS = {
    "person_affirms_proposition",
    "person_opposes_proposition",
    "person_develops_proposition",
}
WORK_PROP_PREDS = {
    "work_affirms_proposition",
    "work_opposes_proposition",
    "work_develops_proposition",
    "work_mentions_proposition",
}
MERGE_PREDS = {"controls_place", "group_present_at", "bishop_of", "active_in"}
DOCTRINAL_PREDS = PERSON_PROP_PREDS | WORK_PROP_PREDS

PRED_FAMILY = {
    "authored_by": "A", "written_at": "A", "work_year_start": "A",
    "work_year_end": "A", "addressed_to_place": "A",
    "work_affirms_proposition": "B", "work_opposes_proposition": "B",
    "work_develops_proposition": "B", "work_mentions_proposition": "B",
    "person_affirms_proposition": "C", "person_opposes_proposition": "C",
    "person_develops_proposition": "C",
    "bishop_of": "D",
    "active_in": "E", "originated_in": "E",
    "participant_in": "F", "event_occurs_at": "F", "event_has_year": "F",
    "member_of_group": "G",
    "group_present_at": "H", "controls_place": "H",
    "group_schismed_from": "I",
    "coworker_of": "J", "teacher_of": "J",
    "place_presence_status": "K",
}

FRAG_KEYWORDS = ["fragment", "lost", "reconstructed", "known through", "no surviving"]

# ── helpers ──────────────────────────────────────────────────────────────────

def load_tsv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def index_by(rows, key):
    return {r[key]: r for r in rows}


def group_by(rows, key):
    d = defaultdict(list)
    for r in rows:
        d[r[key]].append(r)
    return dict(d)


def write_tsv(path, headers, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers, delimiter="\t",
                           extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def yr(v):
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def ranges_overlap(a0, a1, b0, b1, gap=0):
    """True if year-ranges overlap or gap ≤ *gap* years."""
    a0 = yr(a0) if a0 else -9999
    a1 = yr(a1) if a1 else 9999
    b0 = yr(b0) if b0 else -9999
    b1 = yr(b1) if b1 else 9999
    return a0 <= b1 + gap and b0 <= a1 + gap


def sem_key(c):
    return (c["subject_type"], c["subject_id"], c["predicate_id"],
            c["object_mode"], c.get("object_type", ""), c.get("object_id", ""),
            c.get("value_text", ""), c.get("value_year", ""))


def id_words(entity_id):
    """Convert kebab-case id to set of lowercase words for rough text match."""
    return set(entity_id.replace("-", " ").lower().split()) if entity_id else set()


# ═════════════════════════════════════════════════════════════════════════════
# Phase 0 – Preflight
# ═════════════════════════════════════════════════════════════════════════════

def phase0(sources, passages, evidence, works):
    """Run all preflight steps. Returns (source_tiers, excerpt_forms,
    high_reuse_psg, high_reuse_src, fragmentary_works)."""

    # 0A – source tiers
    source_tiers = {}
    for s in sources:
        sid = s["source_id"]
        kind = SOURCE_KIND_OVERRIDES.get(sid, s["source_kind"])
        source_tiers[sid] = SOURCE_TIER_MAP.get(kind, "tier_3_tertiary")

    # 0B – excerpt forms
    excerpt_forms = {}
    for p in passages:
        ex = (p.get("excerpt") or "").strip()
        if ex.startswith("Paraphrase:") or ex.startswith("Paraphrase –"):
            excerpt_forms[p["passage_id"]] = "paraphrase"
        elif ex.startswith("Summary:") or ex.startswith("Summary –"):
            excerpt_forms[p["passage_id"]] = "summary"
        elif not ex:
            excerpt_forms[p["passage_id"]] = "none"
        else:
            excerpt_forms[p["passage_id"]] = "verbatim"

    # 0C – high-reuse watchlist
    psg_cnt = Counter(e["passage_id"] for e in evidence)
    psg_src = {p["passage_id"]: p.get("source_id", "") for p in passages}
    src_cnt = Counter()
    for e in evidence:
        sid = psg_src.get(e["passage_id"], "")
        if sid:
            src_cnt[sid] += 1

    high_psg = {pid: n for pid, n in psg_cnt.items() if n >= HIGH_REUSE_PSG}
    high_src = {sid: n for sid, n in src_cnt.items() if n >= HIGH_REUSE_SRC}

    # 0D – fragmentary works
    frag = set()
    for w in works:
        wid = w["work_id"]
        notes = (w.get("notes") or "").lower()
        if any(kw in notes for kw in FRAG_KEYWORDS):
            frag.add(wid)
        if "fragment" in wid:
            frag.add(wid)
    # Also hardcoded from plan (may not all have keyword in notes)
    frag |= {"papias-fragments", "marcion-antitheses", "marcion-gospel",
              "diatessaron", "philostorgius-ecclesiastical-history"}

    return source_tiers, excerpt_forms, high_psg, high_src, frag


# ═════════════════════════════════════════════════════════════════════════════
# Phase 1 – Deterministic flags
# ═════════════════════════════════════════════════════════════════════════════

def build_lookups(claims, evidence, passages_idx, sources_idx):
    """Pre-build lookup tables needed by the flag engine."""
    active = [c for c in claims if c.get("claim_status") == "active"]
    by_subj = group_by(active, "subject_id")
    ev_by_claim = group_by(evidence, "claim_id")
    ev_by_psg = group_by(evidence, "passage_id")

    # authored_by: person → set(work_id)
    authored_by = defaultdict(set)
    # written_at: work → set(place_id)
    written_at = defaultdict(set)
    # participant_in: person → set(event_id)
    participant_ev = defaultdict(set)
    # event_occurs_at: event → set(place_id)
    event_place = defaultdict(set)
    # bishop_of: (person, place) → [claims]
    bishop = defaultdict(list)
    # controls_place: (group, place) → [claims]
    controls = defaultdict(list)
    # work_prop: (work, pred, prop) → [claims]
    work_prop = defaultdict(list)

    for c in active:
        p = c["predicate_id"]
        s = c["subject_id"]
        o = c.get("object_id", "")
        if p == "authored_by":
            authored_by[o].add(s)       # person authored work
        elif p == "written_at":
            written_at[s].add(o)
        elif p == "participant_in":
            participant_ev[s].add(o)
        elif p == "event_occurs_at":
            event_place[s].add(o)
        elif p == "bishop_of":
            bishop[(s, o)].append(c)
        elif p == "controls_place":
            controls[(s, o)].append(c)
        elif p in WORK_PROP_PREDS:
            work_prop[(s, p, o)].append(c)

    return (by_subj, ev_by_claim, ev_by_psg,
            authored_by, written_at, participant_ev, event_place,
            bishop, controls, work_prop)


def flag_claim(c, ev_by_claim, passages_idx, sources_idx,
               source_tiers, excerpt_forms, frag_works,
               by_subj, authored_by, written_at, participant_ev,
               event_place, bishop, controls, work_prop):
    """Return list of flag strings for one claim."""
    flags = []
    cid = c["claim_id"]
    pred = c["predicate_id"]
    subj = c["subject_id"]
    obj = c.get("object_id", "")
    cert = c.get("certainty", "")
    ys, ye = c.get("year_start", ""), c.get("year_end", "")
    evs = ev_by_claim.get(cid, [])
    sups = [e for e in evs if e["evidence_role"] == "supports"]

    # ── structural ──
    if not evs:
        flags.append("NO_EVIDENCE")
    elif not sups:
        flags.append("NO_SUPPORTS")

    sk = sem_key(c)
    for sib in by_subj.get(subj, []):
        if sib["claim_id"] <= cid or sib.get("claim_status") != "active":
            continue
        if sem_key(sib) != sk:
            continue
        sys2, sye2 = sib.get("year_start", ""), sib.get("year_end", "")
        if ys == sys2 and ye == sye2:
            flags.append(f"EXACT_DUPLICATE:{sib['claim_id']}")
        elif ranges_overlap(ys, ye, sys2, sye2):
            flags.append(f"NEAR_DUPLICATE:{sib['claim_id']}")

    if pred in MERGE_PREDS:
        for sib in by_subj.get(subj, []):
            if sib["claim_id"] <= cid or sib.get("claim_status") != "active":
                continue
            if sem_key(sib) != sk:
                continue
            sys2, sye2 = sib.get("year_start", ""), sib.get("year_end", "")
            if ranges_overlap(ys, ye, sys2, sye2, gap=5):
                if not (ys == sys2 and ye == sye2):
                    flags.append(f"CONTINUITY_MERGE:{sib['claim_id']}")

    # ── R7 active_in redundant with bishop_of ──
    if pred == "active_in" and (subj, obj) in bishop:
        for bc in bishop[(subj, obj)]:
            if bc["claim_id"] != cid and ranges_overlap(ys, ye, bc.get("year_start",""), bc.get("year_end","")):
                flags.append(f"REDUNDANT_ACTIVE_IN:{bc['claim_id']}")
                break

    # ── R5 group_present_at redundant with controls_place ──
    if pred == "group_present_at" and (subj, obj) in controls:
        for cc in controls[(subj, obj)]:
            if cc["claim_id"] != cid and ranges_overlap(ys, ye, cc.get("year_start",""), cc.get("year_end","")):
                flags.append(f"REDUNDANT_GROUP_PRESENT:{cc['claim_id']}")
                break

    # ── R2 person_*_proposition redundant with work_*_proposition ──
    if pred in PERSON_PROP_PREDS:
        pred_map = {"person_affirms_proposition": "work_affirms_proposition",
                    "person_opposes_proposition": "work_opposes_proposition",
                    "person_develops_proposition": "work_develops_proposition"}
        wp = pred_map.get(pred)
        if wp:
            for wid in authored_by.get(subj, set()):
                if (wid, wp, obj) in work_prop:
                    for wpc in work_prop[(wid, wp, obj)]:
                        if wpc.get("claim_status") == "active":
                            flags.append(f"REDUNDANT_PERSON_PROP:{wpc['claim_id']}")
                            break
                    break

    # ── R8 active_in derivable ──
    if pred == "active_in":
        for wid in authored_by.get(subj, set()):
            if obj in written_at.get(wid, set()):
                flags.append(f"REDUNDANT_DERIVED_PRESENCE:auth_written:{wid}")
                break
        for eid in participant_ev.get(subj, set()):
            if obj in event_place.get(eid, set()):
                flags.append(f"REDUNDANT_DERIVED_PRESENCE:part_event:{eid}")
                break

    # ── P1 source mismatch ──
    if pred.startswith("work_") and pred not in {"work_year_start", "work_year_end"}:
        for e in sups:
            psg = passages_idx.get(e["passage_id"], {})
            src = sources_idx.get(psg.get("source_id", ""), {})
            sw = src.get("work_id", "")
            if sw and sw != subj:
                if subj in frag_works:
                    flags.append(f"INDIRECT_TESTIMONIUM:{e['passage_id']}:{sw}")
                else:
                    flags.append(f"SOURCE_MISMATCH:{e['passage_id']}:{sw}")

    # ── evidence-level flags ──
    for e in sups:
        pid = e["passage_id"]
        asp = e.get("support_aspect", "")
        mode = e.get("assertion_mode", "")
        wt = e.get("evidence_weight", "").strip()
        notes = e.get("notes", "").strip()
        psg = passages_idx.get(pid, {})
        excerpt = (e.get("excerpt_override", "").strip()
                   or psg.get("excerpt", "").strip())
        ef = excerpt_forms.get(pid, "verbatim")

        if not excerpt:
            flags.append(f"MISSING_EXCERPT:{pid}")
        if mode == "background_only":
            flags.append(f"SUPPORTS_BACKGROUND:{pid}")
        if not asp or not mode:
            flags.append(f"MISSING_SUPPORT_FIELDS:{pid}")
        if not wt:
            flags.append(f"UNSCORED_WEIGHT:{pid}")
        if wt:
            try:
                w = float(wt)
                if w < 0.5 and cert == "attested":
                    flags.append(f"WEIGHT_CERTAINTY_TENSION:low_wt_attested:{pid}")
                if w >= 0.9 and cert == "possible":
                    flags.append(f"WEIGHT_CERTAINTY_TENSION:high_wt_possible:{pid}")
            except ValueError:
                pass
        if mode == "weak_inference" and not notes:
            flags.append(f"EMPTY_NOTES_ON_INFERENCE:{pid}")
        if ef == "paraphrase" and (asp == "whole_claim" or mode == "explicit"):
            flags.append(f"PARAPHRASE_RISK:{pid}")
        if ef == "paraphrase" and asp == "whole_claim" and excerpt:
            sw = id_words(subj)
            ow = id_words(obj)
            ex_low = excerpt.lower()
            subj_hit = any(w in ex_low for w in sw) if sw else True
            obj_hit = any(w in ex_low for w in ow) if ow else True
            if not subj_hit or not obj_hit:
                missing = []
                if not subj_hit:
                    missing.append("subject")
                if not obj_hit:
                    missing.append("object")
                flags.append(f"PARAPHRASE_OMISSION:{pid}:{'+'.join(missing)}")

    # ── P3 attested no quality ──
    if cert == "attested" and sups:
        quality = {"whole_claim", "predicate", "subject", "object"}
        if not any(e.get("support_aspect", "") in quality for e in sups):
            flags.append("ATTESTED_NO_QUALITY")

    # ── tertiary-only ──
    if sups:
        all_tert = all(
            source_tiers.get(
                passages_idx.get(e["passage_id"], {}).get("source_id", ""),
                "tier_3_tertiary"
            ) == "tier_3_tertiary"
            for e in sups
        )
        if all_tert:
            flags.append("TERTIARY_ONLY_SUPPORT")
            if pred in DOCTRINAL_PREDS or c["subject_type"] == "person":
                flags.append("TERTIARY_DOCTRINAL")

    return flags


# ═════════════════════════════════════════════════════════════════════════════
# Phase 2 – Batch generation
# ═════════════════════════════════════════════════════════════════════════════

AUTO_RESOLVE_FLAGS = {
    "REDUNDANT_ACTIVE_IN", "REDUNDANT_PERSON_PROP",
    "REDUNDANT_GROUP_PRESENT", "REDUNDANT_DERIVED_PRESENCE",
    "EXACT_DUPLICATE", "CONTINUITY_MERGE", "NO_EVIDENCE",
}


def conjoined_packet(c, ev_by_claim, passages_idx, sources_idx,
                     source_tiers, excerpt_forms, entity_tables,
                     by_subj, ev_by_psg, flags_map):
    cid = c["claim_id"]
    evs = ev_by_claim.get(cid, [])

    # subject entity
    st = c["subject_type"]
    subj_ent = entity_tables.get(st, {}).get(c["subject_id"])

    # object entity
    obj_ent = None
    if c["object_mode"] == "entity" and c.get("object_id"):
        obj_ent = entity_tables.get(c.get("object_type", ""), {}).get(c["object_id"])

    ctx = entity_tables.get("place", {}).get(c.get("context_place_id", "")) if c.get("context_place_id") else None

    ev_packets = []
    for e in evs:
        pid = e["passage_id"]
        psg = passages_idx.get(pid, {})
        sid = psg.get("source_id", "")
        src = sources_idx.get(sid, {})
        ev_packets.append({
            "evidence": e,
            "passage": psg,
            "source": src,
            "excerpt_form": excerpt_forms.get(pid, "unknown"),
            "source_tier": source_tiers.get(sid, "unknown"),
        })

    siblings = [s["claim_id"] for s in by_subj.get(c["subject_id"], [])
                if s["claim_id"] != cid and s.get("claim_status") == "active"]

    co_users = {}
    for e in evs:
        pid = e["passage_id"]
        others = [o["claim_id"] for o in ev_by_psg.get(pid, []) if o["claim_id"] != cid]
        if others:
            co_users[pid] = others

    return {
        "claim": c,
        "subject_entity": subj_ent,
        "object_entity": obj_ent,
        "context_place": ctx,
        "evidence": ev_packets,
        "sibling_claim_ids": siblings[:30],
        "sibling_count": len(siblings),
        "passage_co_users": co_users,
        "flags": flags_map.get(cid, []),
    }


def generate_batches(active_claims, flags_map, high_psg, high_src,
                     ev_by_claim, ev_by_psg, passages_idx, sources_idx,
                     source_tiers, excerpt_forms, entity_tables, by_subj):
    """Return list of batch dicts ready for JSON output."""

    claimed_ids = set()   # claim_ids already assigned to a batch
    batches = []
    batch_n = 1

    # ── Queue 0A: high-reuse passages / sources ──
    sorted_psg = sorted(high_psg.items(), key=lambda x: -x[1])
    cur_ids, cur_focus = [], []
    for pid, cnt in sorted_psg:
        cids = list({e["claim_id"] for e in ev_by_psg.get(pid, [])})
        cur_ids.extend(cids)
        cur_focus.append(f"{pid}({cnt})")
        cur_ids = list(dict.fromkeys(cur_ids))  # dedup preserving order
        if len(cur_ids) >= BATCH_MAX or len(cur_focus) >= 3:
            batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "0A",
                            "focus": ", ".join(cur_focus),
                            "claim_ids": cur_ids[:BATCH_MAX]})
            batch_n += 1
            cur_ids, cur_focus = cur_ids[BATCH_MAX:], []
    if cur_ids:
        batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "0A",
                        "focus": ", ".join(cur_focus) if cur_focus else "high-reuse overflow",
                        "claim_ids": cur_ids})
        batch_n += 1
    # Mark 0A claims (they still go through 1+ later; 0A is passage-focused)
    q0a_claim_ids = set()
    for b in batches:
        q0a_claim_ids.update(b["claim_ids"])

    # ── Queue 0B: deterministic structural purge ──
    q0b_ids = []
    for c in active_claims:
        cid = c["claim_id"]
        cflags = flags_map.get(cid, [])
        if any(f.split(":")[0] in AUTO_RESOLVE_FLAGS for f in cflags):
            q0b_ids.append(cid)
    # batch them
    q0b_ids = list(dict.fromkeys(q0b_ids))
    for i in range(0, len(q0b_ids), BATCH_MAX):
        chunk = q0b_ids[i:i + BATCH_MAX]
        batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "0B",
                        "focus": "structural purge",
                        "claim_ids": chunk})
        claimed_ids.update(chunk)
        batch_n += 1

    # ── Queue 1+: subject-batched semantic review ──
    # Sort subjects by claim count descending
    subj_counts = Counter(c["subject_id"] for c in active_claims if c["claim_id"] not in claimed_ids)
    sorted_subjs = sorted(subj_counts.keys(), key=lambda s: -subj_counts[s])

    def _sort_key(c):
        return (PRED_FAMILY.get(c["predicate_id"], "Z"),
                yr(c.get("year_start", "")) or -9999, c["claim_id"])

    # Separate large subjects (own batch) from small ones (consolidate)
    small_accum_ids = []    # accumulated claim_ids from small subjects
    small_accum_focus = []  # subject names for the accumulated batch

    for subj in sorted_subjs:
        subj_claims = [c for c in by_subj.get(subj, [])
                       if c["claim_id"] not in claimed_ids and c.get("claim_status") == "active"]
        if not subj_claims:
            continue
        subj_claims.sort(key=_sort_key)
        cids = [c["claim_id"] for c in subj_claims]

        if len(cids) >= BATCH_MIN:
            # Large enough for own batch(es)
            if len(cids) <= SUBJECT_NOSPLIT:
                batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                                "focus": subj,
                                "claim_ids": cids})
                claimed_ids.update(cids)
                batch_n += 1
            else:
                # Split by predicate family
                fam_groups = defaultdict(list)
                for c in subj_claims:
                    fam_groups[PRED_FAMILY.get(c["predicate_id"], "Z")].append(c["claim_id"])
                cur = []
                for fam in sorted(fam_groups.keys()):
                    grp = fam_groups[fam]
                    if cur and len(cur) + len(grp) > BATCH_MAX:
                        batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                                        "focus": subj,
                                        "claim_ids": cur})
                        claimed_ids.update(cur)
                        batch_n += 1
                        cur = []
                    cur.extend(grp)
                    while len(cur) > BATCH_MAX:
                        batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                                        "focus": subj,
                                        "claim_ids": cur[:BATCH_MAX]})
                        claimed_ids.update(cur[:BATCH_MAX])
                        batch_n += 1
                        cur = cur[BATCH_MAX:]
                if cur:
                    batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                                    "focus": subj,
                                    "claim_ids": cur})
                    claimed_ids.update(cur)
                    batch_n += 1
        else:
            # Small subject — accumulate into a combined batch
            small_accum_ids.extend(cids)
            small_accum_focus.append(subj)
            # Flush when we reach BATCH_MAX
            if len(small_accum_ids) >= BATCH_MAX:
                batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                                "focus": "; ".join(small_accum_focus),
                                "claim_ids": small_accum_ids[:BATCH_MAX]})
                claimed_ids.update(small_accum_ids[:BATCH_MAX])
                batch_n += 1
                small_accum_ids = small_accum_ids[BATCH_MAX:]
                small_accum_focus = [small_accum_focus[-1]] if small_accum_ids else []

    # Flush remaining small subjects
    while small_accum_ids:
        chunk = small_accum_ids[:BATCH_MAX]
        # Collect focus labels for this chunk
        focus_label = "; ".join(small_accum_focus[:10])
        if len(small_accum_focus) > 10:
            focus_label += f" (+{len(small_accum_focus) - 10} more)"
        batches.append({"batch_id": f"batch-{batch_n:03d}", "queue": "1",
                        "focus": focus_label,
                        "claim_ids": chunk})
        claimed_ids.update(chunk)
        batch_n += 1
        small_accum_ids = small_accum_ids[BATCH_MAX:]
        small_accum_focus = small_accum_focus[10:] if len(small_accum_focus) > 10 else []

    return batches


# ═════════════════════════════════════════════════════════════════════════════
# Output writers
# ═════════════════════════════════════════════════════════════════════════════

PROGRESS_HEADERS = [
    "batch_id", "queue", "subject_ids", "claim_count", "status",
    "claims_approved", "claims_needs_revision", "claims_rejected",
    "claims_superseded", "claims_reopened", "claims_fixed",
    "evidence_fixed", "evidence_deleted", "passages_fixed", "sources_fixed",
    "blocking_issue_count", "advisory_issue_count", "top_issue_codes",
    "started_at", "completed_at",
]


def write_outputs(audit_dir, batches, claims_idx, flags_map,
                  ev_by_claim, ev_by_psg, passages_idx, sources_idx,
                  source_tiers, excerpt_forms, entity_tables, by_subj,
                  high_psg, high_src):
    batch_dir = os.path.join(audit_dir, "batches")
    os.makedirs(batch_dir, exist_ok=True)

    # Write each batch JSON
    for b in batches:
        packets = []
        for cid in b["claim_ids"]:
            c = claims_idx.get(cid)
            if not c:
                continue
            packets.append(conjoined_packet(
                c, ev_by_claim, passages_idx, sources_idx,
                source_tiers, excerpt_forms, entity_tables,
                by_subj, ev_by_psg, flags_map))
        out = {
            "batch_id": b["batch_id"],
            "queue": b["queue"],
            "focus": b["focus"],
            "claim_count": len(packets),
            "claims": packets,
        }
        path = os.path.join(batch_dir, f"{b['batch_id']}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)

    # progress.tsv
    rows = []
    for b in batches:
        focus_subjs = b["focus"]
        rows.append({h: "" for h in PROGRESS_HEADERS} | {
            "batch_id": b["batch_id"],
            "queue": b["queue"],
            "subject_ids": focus_subjs,
            "claim_count": str(len(b["claim_ids"])),
            "status": "pending",
        })
    write_tsv(os.path.join(audit_dir, "progress.tsv"), PROGRESS_HEADERS, rows)

    # passage_metadata.tsv
    pm_rows = []
    for pid in sorted(excerpt_forms.keys()):
        psg = passages_idx.get(pid, {})
        sid = psg.get("source_id", "")
        pm_rows.append({
            "passage_id": pid,
            "source_id": sid,
            "excerpt_form": excerpt_forms[pid],
            "source_tier": source_tiers.get(sid, "unknown"),
        })
    write_tsv(os.path.join(audit_dir, "passage_metadata.tsv"),
              ["passage_id", "source_id", "excerpt_form", "source_tier"], pm_rows)

    # high_reuse_watchlist.tsv
    hr_rows = []
    for pid, cnt in sorted(high_psg.items(), key=lambda x: -x[1]):
        hr_rows.append({"entity_type": "passage", "entity_id": pid, "evidence_count": str(cnt)})
    for sid, cnt in sorted(high_src.items(), key=lambda x: -x[1]):
        hr_rows.append({"entity_type": "source", "entity_id": sid, "evidence_count": str(cnt)})
    write_tsv(os.path.join(audit_dir, "high_reuse_watchlist.tsv"),
              ["entity_type", "entity_id", "evidence_count"], hr_rows)

    # batch-summary.md
    lines = ["# Audit Batch Summary\n",
             f"Generated batches: **{len(batches)}**\n"]
    for q_label, q_code in [("Queue 0A — High-reuse passage/source audit", "0A"),
                             ("Queue 0B — Deterministic structural purge", "0B"),
                             ("Queue 1  — Subject-batched semantic review", "1")]:
        q_batches = [b for b in batches if b["queue"] == q_code]
        lines.append(f"\n## {q_label}  ({len(q_batches)} batches)\n")
        lines.append("| Batch | Claims | Focus |")
        lines.append("|-------|--------|-------|")
        for b in q_batches:
            lines.append(f"| {b['batch_id']} | {len(b['claim_ids'])} | {b['focus']} |")
        lines.append("")
    with open(os.path.join(audit_dir, "batch-summary.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    # Flag summary stats to stdout
    all_flags = []
    for flist in flags_map.values():
        for fl in flist:
            all_flags.append(fl.split(":")[0])
    flag_counts = Counter(all_flags)
    print("\n── Flag Summary ──")
    for fc, cnt in flag_counts.most_common(30):
        print(f"  {fc:40s} {cnt:5d}")
    print(f"\nTotal batches:  {len(batches)}")
    print(f"  Queue 0A:     {sum(1 for b in batches if b['queue']=='0A')}")
    print(f"  Queue 0B:     {sum(1 for b in batches if b['queue']=='0B')}")
    print(f"  Queue 1:      {sum(1 for b in batches if b['queue']=='1')}")


# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description="Claim audit pipeline: preflight + batch generation")
    ap.add_argument("--data-dir", required=True, help="Root data directory")
    args = ap.parse_args()

    sheets = os.path.join(args.data_dir, "sheets")
    audit_dir = os.path.join(args.data_dir, "audit")
    os.makedirs(os.path.join(audit_dir, "batches"), exist_ok=True)

    print("Loading TSVs …")
    claims      = load_tsv(os.path.join(sheets, "claims.tsv"))
    evidence    = load_tsv(os.path.join(sheets, "claim_evidence.tsv"))
    passages    = load_tsv(os.path.join(sheets, "passages.tsv"))
    sources     = load_tsv(os.path.join(sheets, "sources.tsv"))
    works       = load_tsv(os.path.join(sheets, "works.tsv"))
    people      = load_tsv(os.path.join(sheets, "people.tsv"))
    places      = load_tsv(os.path.join(sheets, "places.tsv"))
    groups      = load_tsv(os.path.join(sheets, "groups.tsv"))
    events      = load_tsv(os.path.join(sheets, "events.tsv"))
    propositions = load_tsv(os.path.join(sheets, "propositions.tsv"))

    claims_idx    = index_by(claims, "claim_id")
    passages_idx  = index_by(passages, "passage_id")
    sources_idx   = index_by(sources, "source_id")

    entity_tables = {
        "person":      index_by(people, "person_id"),
        "place":       index_by(places, "place_id"),
        "group":       index_by(groups, "group_id"),
        "event":       index_by(events, "event_id"),
        "work":        index_by(works, "work_id"),
        "proposition": index_by(propositions, "proposition_id"),
    }

    active_claims = [c for c in claims if c.get("claim_status") == "active"]
    print(f"Active claims: {len(active_claims)}  Evidence rows: {len(evidence)}  "
          f"Passages: {len(passages)}  Sources: {len(sources)}")

    # Phase 0
    print("Phase 0: preflight …")
    source_tiers, excerpt_forms, high_psg, high_src, frag_works = phase0(
        sources, passages, evidence, works)
    print(f"  Source tiers derived for {len(source_tiers)} sources")
    print(f"  Excerpt forms: {Counter(excerpt_forms.values())}")
    print(f"  High-reuse passages (≥{HIGH_REUSE_PSG}): {len(high_psg)}")
    print(f"  High-reuse sources  (≥{HIGH_REUSE_SRC}): {len(high_src)}")
    print(f"  Fragmentary works: {sorted(frag_works)}")

    # Phase 1
    print("Phase 1: deterministic flags …")
    lookups = build_lookups(claims, evidence, passages_idx, sources_idx)
    (by_subj, ev_by_claim, ev_by_psg,
     authored_by, written_at, participant_ev, event_place,
     bishop_lk, controls_lk, work_prop_lk) = lookups

    flags_map = {}
    for c in active_claims:
        fl = flag_claim(c, ev_by_claim, passages_idx, sources_idx,
                        source_tiers, excerpt_forms, frag_works,
                        by_subj, authored_by, written_at, participant_ev,
                        event_place, bishop_lk, controls_lk, work_prop_lk)
        if fl:
            flags_map[c["claim_id"]] = fl
    flagged = sum(1 for v in flags_map.values() if v)
    print(f"  {flagged} claims flagged out of {len(active_claims)}")

    # Phase 2
    print("Phase 2: batch generation …")
    batches = generate_batches(
        active_claims, flags_map, high_psg, high_src,
        ev_by_claim, ev_by_psg, passages_idx, sources_idx,
        source_tiers, excerpt_forms, entity_tables, by_subj)

    # Write outputs
    print("Writing outputs …")
    write_outputs(audit_dir, batches, claims_idx, flags_map,
                  ev_by_claim, ev_by_psg, passages_idx, sources_idx,
                  source_tiers, excerpt_forms, entity_tables, by_subj,
                  high_psg, high_src)

    # Initialize empty findings ledger
    findings_path = os.path.join(audit_dir, "findings.ndjson")
    if not os.path.exists(findings_path):
        open(findings_path, "w").close()
        print(f"  Created empty {findings_path}")

    print("\nDone. Outputs in", audit_dir)


if __name__ == "__main__":
    main()
