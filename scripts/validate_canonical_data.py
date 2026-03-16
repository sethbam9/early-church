#!/usr/bin/env python3
"""Canonical data validator for the Early Christianity Atlas.

Validates all source TSV files against their schemas, checks foreign keys,
enforces redundancy and evidence-quality rules, regenerates derived tables,
and optionally scans markdown files for wiki-link integrity.

Usage:
    python3 scripts/validate_canonical_data.py --data-dir data
    python3 scripts/validate_canonical_data.py --data-dir data --json --check-evidence

Sections:
    1. Constants (headers, enums, predicate sets)
    2. Utility functions (parsing, hashing, I/O)
    3. Markdown/mention collection
    4. Derivation functions (derived table generation)
    5. Validator class:
       a. Init & helpers
       b. Loading
       c. Schema & enum validation
       d. Claim structure validation
       e. Redundancy rules (R1–R8)
       f. Evidence quality rules (P1–P5)
       g. Markdown & OSIS validation
       h. Derived table generation & comparison
       i. Reporting (sparse, evidence quality)
       j. Run (orchestrator)
    6. CLI entry point
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

SOURCE_HEADERS: Dict[str, List[str]] = {
    "places.tsv": ["place_id", "place_label", "place_label_modern", "place_kind", "parent_place_id", "lat", "lon", "location_precision", "modern_country_label", "notes"],
    "people.tsv": ["person_id", "person_label", "name_alt", "name_native", "birth_year_display", "death_year_display", "person_kind", "notes"],
    "works.tsv": ["work_id", "title_display", "title_original", "work_type", "language_original", "work_kind", "notes"],
    "events.tsv": ["event_id", "event_label", "event_type", "event_kind", "notes"],
    "groups.tsv": ["group_id", "group_label", "group_kind", "is_christian", "notes"],
    "topics.tsv": ["topic_id", "topic_label", "topic_kind", "notes"],
    "dimensions.tsv": ["dimension_id", "topic_id", "dimension_label", "dimension_kind", "notes"],
    "propositions.tsv": ["proposition_id", "topic_id", "dimension_id", "proposition_label", "polarity_family", "description", "notes"],
    "predicate_types.tsv": ["predicate_id", "predicate_label", "subject_type", "object_mode", "object_type", "inverse_label", "is_symmetric", "canonical_sort_rule", "allows_date_range", "allows_context_place", "description"],
    "sources.tsv": ["source_id", "work_id", "source_kind", "title", "author", "editor", "year_display", "year_start", "year_end", "container_title", "publisher", "url", "accessed_on", "isbn_issn", "notes"],
    "passages.tsv": ["passage_id", "source_id", "locator_type", "locator", "excerpt", "language", "passage_year", "url_override", "notes"],
    "claims.tsv": ["claim_id", "subject_type", "subject_id", "predicate_id", "object_mode", "object_type", "object_id", "value_text", "value_number", "value_year", "value_boolean", "year_start", "year_end", "context_place_id", "certainty", "claim_status", "created_by", "updated_at"],
    "claim_evidence.tsv": ["claim_id", "passage_id", "evidence_role", "support_aspect", "assertion_mode", "excerpt_override", "evidence_weight", "notes"],
    "claim_reviews.tsv": ["claim_id", "reviewer_id", "review_status", "reviewed_at", "confidence", "note"],
    "editor_notes.tsv": ["editor_note_id", "note_kind", "entity_type", "entity_id", "claim_id", "body_md", "created_by", "created_at"],
    "claim_review_events.tsv": ["claim_id", "event_type", "actor_id", "event_at", "note"],
}

DERIVED_HEADERS: Dict[str, List[str]] = {
    "note_mentions.tsv": [
        "mention_source_type",
        "source_table",
        "source_row_id",
        "source_field",
        "source_path",
        "mentioned_type",
        "mentioned_id",
        "mention_label",
    ],
    "first_attestations.tsv": ["subject_type", "subject_id", "predicate_id", "first_year", "first_claim_id", "first_passage_id"],
    "derived_edges.tsv": ["edge_id", "from_type", "from_id", "to_type", "to_id", "relation_kind", "directness", "rule_id", "year_start", "year_end", "certainty", "supporting_claim_ids", "path_text"],
    "proposition_place_presence.tsv": ["proposition_id", "place_id", "year_start", "year_end", "stance", "supporting_claim_count", "opposing_claim_count", "derived_edge_ids", "derivation_hash"],
    "entity_place_footprints.tsv": ["entity_type", "entity_id", "place_id", "year_start", "year_end", "reason_predicate_id", "stance", "derived_edge_id"],
    "place_state_by_decade.tsv": ["place_id", "decade", "presence_status", "group_presence_summary", "dominant_polity_group_id", "supporting_claim_count", "derivation_hash"],
}

TARGET_HEADERS = {**SOURCE_HEADERS, **DERIVED_HEADERS}
DERIVED_FILES = set(DERIVED_HEADERS)

ENTITY_TYPES = {
    "place", "person", "work", "event", "group", "topic", "dimension", "proposition", "source", "passage", "claim", "editor_note"
}
MENTION_TARGET_TYPES = ENTITY_TYPES | {"bible"}
MENTION_SOURCE_TYPES = {"table_field", "markdown_file"}
OBJECT_MODES = {"entity", "text", "number", "year", "boolean"}
CERTAINTY = {"attested", "probable", "possible", "claimed_tradition", "legendary", "unknown"}

CLAIM_STATUS = {"active", "deprecated", "superseded", "rejected", "draft"}
EVIDENCE_ROLE = {"supports", "opposes", "contextualizes", "mentions"}
SUPPORT_ASPECT = {"whole_claim", "subject", "predicate", "object", "date", "place", "context", "attribution"}
ASSERTION_MODE = {"explicit", "strong_inference", "weak_inference", "background_only"}
REVIEW_STATUS = {"unreviewed", "reviewed", "approved", "disputed", "needs_revision"}
REVIEW_EVENT_TYPE = {"created", "reviewed", "approved", "disputed", "reopened", "needs_revision"}
REVIEW_CONFIDENCE = {"low", "medium", "high"}
EDITOR_NOTE_KIND = {"commentary", "todo", "dispute", "migration", "rationale"}
PLACE_KIND = {"city", "region", "province", "site", "monastery", "route", "unknown"}
LOCATION_PRECISION = {"exact", "approx_site", "approx_city", "approx_region", "region_only", "unknown"}
PERSON_KIND = {"individual", "anonymous_author", "collective_author", "composite_figure", "unknown"}
WORK_TYPE = {"letter", "treatise", "homily", "commentary", "rule", "canon_list", "dialogue", "chronicle", "apology", "acta", "inscription", "other"}
WORK_KIND = {"single_work", "collection", "fragment", "recension", "inscription_unit"}
EVENT_TYPE = {"council", "martyrdom", "mission", "persecution", "political", "schism", "literary", "liturgical", "other"}
EVENT_KIND = {"simple", "composite", "recurring", "session"}
GROUP_KIND = {"communion", "sect", "school", "order", "faction", "practice_stream", "modern_heir", "polity", "unknown"}
TOPIC_KIND = {"doctrine", "practice", "office", "canon", "devotion", "discipline", "other"}
DIMENSION_KIND = {"binary", "multivalue", "continuum", "descriptive"}
SOURCE_KIND = {"primary_text", "inscription", "manuscript_catalog", "modern_book", "journal_article", "reference_work", "web_page", "database", "other"}
PASSAGE_LOCATOR_TYPES = {"bible_osis", "source_ref"}
STANCE = {"affirms", "opposes", "mixed", "neutral", "unknown"}
DERIVED_STANCE = {"", "affirms", "opposes", "mixed", "neutral"}
PRESENCE_STATUS = {"attested", "probable", "possible", "claimed_tradition", "not_attested", "suppressed", "unknown"}
CANONICAL_SORT_RULE = {"none", "lexicographic_entity_ref", "lexicographic_claim_pair"}

PROPOSITION_CLAIM_PREDICATES = {
    "work_affirms_proposition",
    "person_affirms_proposition",
    "work_opposes_proposition",
    "person_opposes_proposition",
    "work_develops_proposition",
    "person_develops_proposition",
    "work_mentions_proposition",
}
PLACE_LINK_PREDICATES = {
    "bishop_of",
    "active_in",
    "originated_in",
    "written_at",
    "addressed_to_place",
    "event_occurs_at",
    "group_present_at",
    "controls_place",
}
MERGE_REQUIRED_PREDICATES = {"group_present_at", "controls_place"}
MARKDOWN_FIELD_SUFFIXES = ("_md",)
MARKDOWN_FIELD_NAMES = {"notes", "body_md"}
SKIP_DIR_NAMES = {".git", ".hg", ".svn", "node_modules", "dist", "build", "coverage", "__pycache__", ".venv", "venv", ".windsurf", "docs"}
WIKILINK_RE = re.compile(r"\[\[([a-z_]+):([^\]|]+)(?:\|([^\]]+))?\]\]")
OSIS_RE = re.compile(r"^(?:[1-3]?[A-Za-z][A-Za-z0-9]*)\.\d+\.\d+(?:-(?:(?:[1-3]?[A-Za-z][A-Za-z0-9]*)\.\d+\.\d+|\d+))?$")
CERTAINTY_RANK = {"attested": 0, "probable": 1, "possible": 2, "claimed_tradition": 3, "legendary": 4, "unknown": 5}

# Maps predicate_id to a human-readable relation_kind for derived edges
RELATION_KIND_MAP: Dict[str, str] = {
    "bishop_of": "person_place",
    "active_in": "person_place",
    "originated_in": "entity_place",
    "written_at": "work_place",
    "addressed_to_place": "work_place",
    "event_occurs_at": "event_place",
    "group_present_at": "group_place",
    "controls_place": "group_place",
}

SPARSE_ENTITY_FILES: Dict[str, Tuple[str, str]] = {
    "places.tsv": ("place", "place_label"),
    "people.tsv": ("person", "person_label"),
    "works.tsv": ("work", "title_display"),
    "events.tsv": ("event", "event_label"),
    "groups.tsv": ("group", "group_label"),
    "topics.tsv": ("topic", "topic_label"),
    "dimensions.tsv": ("dimension", "dimension_label"),
    "propositions.tsv": ("proposition", "proposition_label"),
}


def norm(value: Any) -> str:
    return "" if value is None else str(value).strip()


def truthy(value: Any) -> bool:
    return norm(value).lower() == "true"


def parse_int(value: Any) -> Optional[int]:
    s = norm(value)
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def hash_id(prefix: str, *parts: Any, length: int = 16) -> str:
    text = "||".join("" if p is None else str(p) for p in parts)
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:length]
    return f"{prefix}-{digest}"


def decade_start(year: int) -> int:
    return (year // 10) * 10


def decade_range(year_start: Optional[int], year_end: Optional[int]) -> List[int]:
    if year_start is None and year_end is None:
        return []
    start = decade_start(year_start if year_start is not None else year_end)  # type: ignore[arg-type]
    end = decade_start(year_end if year_end is not None else year_start)  # type: ignore[arg-type]
    return list(range(start, end + 1, 10))


def parse_mentions(text: str) -> List[Tuple[str, str, Optional[str]]]:
    out: List[Tuple[str, str, Optional[str]]] = []
    for match in WIKILINK_RE.finditer(text or ""):
        out.append((match.group(1), match.group(2), match.group(3)))
    return out


def is_osis_ref(value: str) -> bool:
    return bool(OSIS_RE.fullmatch(norm(value)))


def read_tsv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as f:
        return [{k: norm(v) for k, v in row.items()} for row in csv.DictReader(f, delimiter="\t")]


def write_tsv(path: Path, headers: List[str], rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({h: "" if row.get(h) is None else row.get(h) for h in headers})


def is_markdown_field(field_name: str) -> bool:
    return field_name in MARKDOWN_FIELD_NAMES or field_name.endswith(MARKDOWN_FIELD_SUFFIXES)


def should_skip_path(path: Path) -> bool:
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def primary_key_fields(headers: Sequence[str]) -> List[str]:
    return [h for h in headers if h.endswith("_id") and h != "mentioned_id"]


def sort_value_for_field(header: str, row: Dict[str, str]) -> Tuple[int, Any]:
    if header in {"year_start", "year_end", "first_year", "decade", "passage_year", "value_year"}:
        parsed = parse_int(row.get(header))
        return (0, parsed) if parsed is not None else (1, 0)
    return (0, norm(row.get(header)))


def sort_rows(headers: Sequence[str], rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    keys = primary_key_fields(headers)
    if "year_start" in headers:
        sort_headers = ["year_start", "year_end", *keys]
    elif "first_year" in headers:
        sort_headers = ["first_year", *keys]
    elif "decade" in headers:
        sort_headers = [*keys, "decade"]
    else:
        sort_headers = keys or list(headers)
    sort_headers += [h for h in headers if h not in sort_headers]
    return sorted(rows, key=lambda row: tuple(sort_value_for_field(h, row) for h in sort_headers))


def get_row_id(row: Dict[str, str], headers: Sequence[str]) -> str:
    for header in headers:
        if header.endswith("_id") and norm(row.get(header)):
            return norm(row.get(header))
    digest = hashlib.sha1("||".join(norm(row.get(h)) for h in headers).encode("utf-8")).hexdigest()[:12]
    return f"row-{digest}"


def collect_markdown_reference_sources(source_tables_dir: Path, markdown_scan_root: Optional[Path]) -> List[Dict[str, str]]:
    sources: List[Dict[str, str]] = []
    for filename, headers in SOURCE_HEADERS.items():
        path = source_tables_dir / filename
        if not path.exists():
            continue
        rows = read_tsv(path)
        for row in rows:
            row_id = get_row_id(row, headers)
            for field in headers:
                if not is_markdown_field(field):
                    continue
                text = norm(row.get(field))
                if not text:
                    continue
                sources.append(
                    {
                        "mention_source_type": "table_field",
                        "source_table": filename,
                        "source_row_id": row_id,
                        "source_field": field,
                        "source_path": "",
                        "text": text,
                    }
                )
    if markdown_scan_root and markdown_scan_root.exists():
        for path in sorted(markdown_scan_root.rglob("*.md")):
            if should_skip_path(path) or path.is_dir():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if "[[" not in text:
                continue
            try:
                rel_path = str(path.relative_to(markdown_scan_root))
            except ValueError:
                rel_path = str(path)
            sources.append(
                {
                    "mention_source_type": "markdown_file",
                    "source_table": "",
                    "source_row_id": "",
                    "source_field": "",
                    "source_path": rel_path,
                    "text": text,
                }
            )
    return sources


def derive_note_mentions(markdown_sources: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    out: List[Dict[str, str]] = []
    for src in markdown_sources:
        for mentioned_type, mentioned_id, mention_label in parse_mentions(src.get("text", "")):
            key = (
                src["mention_source_type"],
                src.get("source_table", ""),
                src.get("source_row_id", ""),
                src.get("source_field", ""),
                src.get("source_path", ""),
                mentioned_type,
                mentioned_id,
                mention_label or "",
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "mention_source_type": src["mention_source_type"],
                    "source_table": src.get("source_table", ""),
                    "source_row_id": src.get("source_row_id", ""),
                    "source_field": src.get("source_field", ""),
                    "source_path": src.get("source_path", ""),
                    "mentioned_type": mentioned_type,
                    "mentioned_id": mentioned_id,
                    "mention_label": mention_label or "",
                }
            )
    return sorted(
        out,
        key=lambda row: (
            row["mention_source_type"],
            row["source_table"],
            row["source_row_id"],
            row["source_field"],
            row["source_path"],
            row["mentioned_type"],
            row["mentioned_id"],
            row["mention_label"],
        ),
    )


def derive_entity_place_links(claims: List[Dict[str, str]]) -> Dict[Tuple[str, str], List[Tuple[str, Optional[int], Optional[int], str, str]]]:
    links: Dict[Tuple[str, str], List[Tuple[str, Optional[int], Optional[int], str, str]]] = defaultdict(list)
    work_year_starts: Dict[str, Optional[int]] = {}
    work_year_ends: Dict[str, Optional[int]] = {}
    for claim in claims:
        if claim["subject_type"] == "work" and claim["predicate_id"] == "work_year_start":
            work_year_starts[claim["subject_id"]] = parse_int(claim.get("value_year"))
        if claim["subject_type"] == "work" and claim["predicate_id"] == "work_year_end":
            work_year_ends[claim["subject_id"]] = parse_int(claim.get("value_year"))
    for claim in claims:
        if claim.get("object_mode") != "entity" or claim.get("object_type") != "place":
            continue
        if claim["predicate_id"] not in PLACE_LINK_PREDICATES:
            continue
        year_start = parse_int(claim.get("year_start"))
        year_end = parse_int(claim.get("year_end"))
        if claim["subject_type"] == "work" and year_start is None and year_end is None:
            year_start = work_year_starts.get(claim["subject_id"])
            year_end = work_year_ends.get(claim["subject_id"])
        links[(claim["subject_type"], claim["subject_id"])].append((claim["object_id"], year_start, year_end, claim["predicate_id"], claim["claim_id"]))
    return links


def min_certainty(*values: str) -> str:
    """Return the weakest certainty from the given values."""
    best_rank = -1
    best_val = "unknown"
    for v in values:
        rank = CERTAINTY_RANK.get(v, 5)
        if rank > best_rank:
            best_rank = rank
            best_val = v
    return best_val


def derive_edges(claims: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Generate derived_edges.tsv rows from claim chains.

    Produces two kinds of edges:
    - direct: a single claim links entity→place via PLACE_LINK_PREDICATES
    - derived: proposition→place chains inferred from entity→place + proposition claims
    """
    entity_place_links = derive_entity_place_links(claims)
    edges: List[Dict[str, str]] = []
    seen_ids: set[str] = set()

    # --- Direct edges: entity→place from PLACE_LINK_PREDICATES ---
    for claim in claims:
        if claim.get("claim_status") != "active":
            continue
        if claim.get("object_mode") != "entity" or claim.get("object_type") != "place":
            continue
        if claim["predicate_id"] not in PLACE_LINK_PREDICATES:
            continue
        year_start = parse_int(claim.get("year_start"))
        year_end = parse_int(claim.get("year_end"))
        edge_id = hash_id("edge", claim["subject_type"], claim["subject_id"], "place", claim["object_id"], claim["predicate_id"], claim["claim_id"])
        if edge_id in seen_ids:
            continue
        seen_ids.add(edge_id)
        relation_kind = RELATION_KIND_MAP.get(claim["predicate_id"], "entity_place")
        path_text = f"{claim['subject_type']}:{claim['subject_id']} → {claim['predicate_id']} → place:{claim['object_id']}"
        edges.append({
            "edge_id": edge_id,
            "from_type": claim["subject_type"],
            "from_id": claim["subject_id"],
            "to_type": "place",
            "to_id": claim["object_id"],
            "relation_kind": relation_kind,
            "directness": "direct",
            "rule_id": claim["predicate_id"],
            "year_start": "" if year_start is None else str(year_start),
            "year_end": "" if year_end is None else str(year_end),
            "certainty": claim.get("certainty", "unknown"),
            "supporting_claim_ids": claim["claim_id"],
            "path_text": path_text,
        })

    # --- Derived edges: proposition→place via entity→place + proposition claim ---
    for claim in claims:
        if claim.get("claim_status") != "active":
            continue
        if claim.get("object_mode") != "entity" or claim.get("object_type") != "proposition":
            continue
        if claim["predicate_id"] not in PROPOSITION_CLAIM_PREDICATES:
            continue
        proposition_id = claim["object_id"]
        for place_id, place_start, place_end, place_pred, place_claim_id in entity_place_links.get((claim["subject_type"], claim["subject_id"]), []):
            claim_year_start = parse_int(claim.get("year_start"))
            claim_year_end = parse_int(claim.get("year_end"))
            year_start = claim_year_start if claim_year_start is not None else place_start
            year_end = claim_year_end if claim_year_end is not None else place_end
            claim_ids_sorted = "|".join(sorted({claim["claim_id"], place_claim_id}))
            edge_id = hash_id("edge", "proposition", proposition_id, "place", place_id, claim["predicate_id"], place_pred, claim_ids_sorted)
            if edge_id in seen_ids:
                continue
            seen_ids.add(edge_id)
            cert = min_certainty(claim.get("certainty", "unknown"), "probable")  # derived chains capped
            rule_id = f"{claim['predicate_id']}+{place_pred}"
            path_text = (
                f"{claim['subject_type']}:{claim['subject_id']} → {claim['predicate_id']} → proposition:{proposition_id} "
                f"+ {claim['subject_type']}:{claim['subject_id']} → {place_pred} → place:{place_id}"
            )
            edges.append({
                "edge_id": edge_id,
                "from_type": "proposition",
                "from_id": proposition_id,
                "to_type": "place",
                "to_id": place_id,
                "relation_kind": "proposition_place",
                "directness": "derived",
                "rule_id": rule_id,
                "year_start": "" if year_start is None else str(year_start),
                "year_end": "" if year_end is None else str(year_end),
                "certainty": cert,
                "supporting_claim_ids": claim_ids_sorted,
                "path_text": path_text,
            })

    return sorted(edges, key=lambda r: (r["from_type"], r["from_id"], r["to_type"], r["to_id"], r["edge_id"]))


def derive_proposition_place_presence(claims: List[Dict[str, str]], edges: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    entity_places = derive_entity_place_links(claims)
    # Build edge lookup: (proposition_id, place_id, claim_ids_key) → edge_id
    prop_edge_lookup: Dict[Tuple[str, str, str], str] = {}
    for e in edges:
        if e["from_type"] == "proposition" and e["to_type"] == "place" and e["directness"] == "derived":
            prop_edge_lookup[(e["from_id"], e["to_id"], e["supporting_claim_ids"])] = e["edge_id"]

    rows_by_key: Dict[Tuple[str, str, Optional[int], Optional[int]], Dict[str, Any]] = {}
    for claim in claims:
        if claim.get("object_mode") != "entity" or claim.get("object_type") != "proposition":
            continue
        if claim["predicate_id"] not in PROPOSITION_CLAIM_PREDICATES:
            continue
        proposition_id = claim["object_id"]
        for place_id, place_start, place_end, _place_predicate, place_claim_id in entity_places.get((claim["subject_type"], claim["subject_id"]), []):
            claim_year_start = parse_int(claim.get("year_start"))
            claim_year_end = parse_int(claim.get("year_end"))
            year_start = claim_year_start if claim_year_start is not None else place_start
            year_end = claim_year_end if claim_year_end is not None else place_end
            key = (proposition_id, place_id, year_start, year_end)
            row = rows_by_key.setdefault(
                key,
                {
                    "proposition_id": proposition_id,
                    "place_id": place_id,
                    "year_start": year_start,
                    "year_end": year_end,
                    "supporting": set(),
                    "opposing": set(),
                    "neutral": set(),
                    "path": set(),
                    "edge_ids": set(),
                },
            )
            row["path"].update({claim["claim_id"], place_claim_id})
            claim_ids_key = "|".join(sorted({claim["claim_id"], place_claim_id}))
            eid = prop_edge_lookup.get((proposition_id, place_id, claim_ids_key))
            if eid:
                row["edge_ids"].add(eid)
            if claim["predicate_id"] in {"work_affirms_proposition", "person_affirms_proposition", "work_develops_proposition", "person_develops_proposition"}:
                row["supporting"].add(claim["claim_id"])
            elif claim["predicate_id"] in {"work_opposes_proposition", "person_opposes_proposition"}:
                row["opposing"].add(claim["claim_id"])
            else:
                row["neutral"].add(claim["claim_id"])
    out: List[Dict[str, Any]] = []
    for row in rows_by_key.values():
        supports = len(row["supporting"])
        opposes = len(row["opposing"])
        if supports and opposes:
            stance = "mixed"
        elif opposes:
            stance = "opposes"
        elif supports:
            stance = "affirms"
        elif row["neutral"]:
            stance = "neutral"
        else:
            stance = "unknown"
        out.append(
            {
                "proposition_id": row["proposition_id"],
                "place_id": row["place_id"],
                "year_start": "" if row["year_start"] is None else str(row["year_start"]),
                "year_end": "" if row["year_end"] is None else str(row["year_end"]),
                "stance": stance,
                "supporting_claim_count": str(supports),
                "opposing_claim_count": str(opposes),
                "derived_edge_ids": "|".join(sorted(row["edge_ids"])),
                "derivation_hash": hash_id("drv", row["proposition_id"], row["place_id"], row["year_start"], row["year_end"], *sorted(row["path"])),
            }
        )
    return sorted(out, key=lambda row: (row["proposition_id"], row["place_id"], row["year_start"], row["year_end"]))


def derive_entity_place_footprints(claims: List[Dict[str, str]], proposition_presence: List[Dict[str, Any]], edges: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    entity_places = derive_entity_place_links(claims)
    # Build edge lookup: (from_type, from_id, to_id, claim_id) → edge_id for direct edges
    direct_edge_lookup: Dict[Tuple[str, str, str, str], str] = {}
    for e in edges:
        if e["directness"] == "direct":
            for cid in e["supporting_claim_ids"].split("|"):
                direct_edge_lookup[(e["from_type"], e["from_id"], e["to_id"], cid)] = e["edge_id"]

    out: List[Dict[str, Any]] = []
    seen = set()
    for (entity_type, entity_id), places in entity_places.items():
        for place_id, year_start, year_end, predicate_id, claim_id in places:
            key = (entity_type, entity_id, place_id, year_start, year_end, predicate_id, "")
            if key in seen:
                continue
            seen.add(key)
            edge_id = direct_edge_lookup.get((entity_type, entity_id, place_id, claim_id), "")
            out.append(
                {
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "place_id": place_id,
                    "year_start": "" if year_start is None else str(year_start),
                    "year_end": "" if year_end is None else str(year_end),
                    "reason_predicate_id": predicate_id,
                    "stance": "",
                    "derived_edge_id": edge_id,
                }
            )
    for row in proposition_presence:
        key = ("proposition", row["proposition_id"], row["place_id"], row["year_start"], row["year_end"], "derived_proposition_presence", row["stance"])
        if key in seen:
            continue
        seen.add(key)
        # Use first derived_edge_id from the presence row's pipe-delimited list
        edge_ids = row.get("derived_edge_ids", "")
        first_edge = edge_ids.split("|")[0] if edge_ids else ""
        out.append(
            {
                "entity_type": "proposition",
                "entity_id": row["proposition_id"],
                "place_id": row["place_id"],
                "year_start": row["year_start"],
                "year_end": row["year_end"],
                "reason_predicate_id": "derived_proposition_presence",
                "stance": row["stance"],
                "derived_edge_id": first_edge,
            }
        )
    return sorted(out, key=lambda row: (row["entity_type"], row["entity_id"], row["place_id"], row["year_start"], row["year_end"], row["reason_predicate_id"]))


def derive_first_attestations(claims: List[Dict[str, str]], claim_evidence: List[Dict[str, str]], passages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    evidence_by_claim: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for row in claim_evidence:
        evidence_by_claim[row["claim_id"]].append(row)
    passage_by_id = {row["passage_id"]: row for row in passages}
    best: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for claim in claims:
        if claim.get("claim_status") != "active":
            continue
        years: List[int] = []
        for field in ("value_year", "year_start", "year_end"):
            parsed = parse_int(claim.get(field))
            if parsed is not None:
                years.append(parsed)
        for evidence in evidence_by_claim.get(claim["claim_id"], []):
            passage = passage_by_id.get(evidence["passage_id"])
            if passage is None:
                continue
            passage_year = parse_int(passage.get("passage_year"))
            if passage_year is not None:
                years.append(passage_year)
        first_year = min(years) if years else None
        key = (claim["subject_type"], claim["subject_id"], claim["predicate_id"])
        existing = best.get(key)
        if existing is None or (first_year is not None and (existing["first_year"] == "" or int(existing["first_year"]) > first_year)):
            first_passage_id = ""
            if evidence_by_claim.get(claim["claim_id"]):
                first_passage_id = sorted(ev["passage_id"] for ev in evidence_by_claim[claim["claim_id"]])[0]
            best[key] = {
                "subject_type": claim["subject_type"],
                "subject_id": claim["subject_id"],
                "predicate_id": claim["predicate_id"],
                "first_year": "" if first_year is None else str(first_year),
                "first_claim_id": claim["claim_id"],
                "first_passage_id": first_passage_id,
            }
    return sorted(best.values(), key=lambda row: (row["subject_type"], row["subject_id"], row["predicate_id"]))


def derive_place_state_by_decade(claims: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    bucket: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for claim in claims:
        if claim.get("claim_status") != "active":
            continue
        predicate_id = claim["predicate_id"]
        years = decade_range(parse_int(claim.get("year_start")), parse_int(claim.get("year_end")))
        if not years:
            continue
        if predicate_id == "place_presence_status" and claim["subject_type"] == "place":
            place_ids = [claim["subject_id"]]
        elif predicate_id in {"group_present_at", "controls_place"} and claim.get("object_mode") == "entity" and claim.get("object_type") == "place":
            place_ids = [claim["object_id"]]
        else:
            continue
        for place_id in place_ids:
            for decade in years:
                row = bucket.setdefault(
                    (place_id, decade),
                    {
                        "place_id": place_id,
                        "decade": decade,
                        "presence_status": "unknown",
                        "group_ids": set(),
                        "dominant_polity_group_id": "",
                        "claim_ids": set(),
                    },
                )
                row["claim_ids"].add(claim["claim_id"])
                if predicate_id == "place_presence_status" and claim.get("value_text") in PRESENCE_STATUS:
                    row["presence_status"] = claim["value_text"]
                elif predicate_id == "group_present_at":
                    row["group_ids"].add(claim["subject_id"])
                elif predicate_id == "controls_place" and not row["dominant_polity_group_id"]:
                    row["group_ids"].add(claim["subject_id"])
                    row["dominant_polity_group_id"] = claim["subject_id"]
    out: List[Dict[str, Any]] = []
    for row in bucket.values():
        out.append(
            {
                "place_id": row["place_id"],
                "decade": str(row["decade"]),
                "presence_status": row["presence_status"],
                "group_presence_summary": "; ".join(sorted(row["group_ids"])),
                "dominant_polity_group_id": row["dominant_polity_group_id"],
                "supporting_claim_count": str(len(row["claim_ids"])),
                "derivation_hash": hash_id("state", row["place_id"], row["decade"], *sorted(row["claim_ids"])),
            }
        )
    return sorted(out, key=lambda row: (row["place_id"], int(row["decade"])))


# =============================================================================
# VALIDATOR CLASS
# =============================================================================

class Validator:
    """Core validator that loads, checks, and regenerates all canonical data."""

    # ── Init & helpers ────────────────────────────────────────────────────

    def __init__(
        self,
        data_dir: Path,
        markdown_scan_root: Optional[Path] = None,
        check_markdown: bool = True,
        rewrite_derived: bool = False,
        sparse_threshold: Optional[int] = None,
        json_output: bool = False,
        check_evidence: bool = False,
    ) -> None:
        self.data_dir = data_dir
        self.markdown_scan_root = markdown_scan_root
        self.check_markdown = check_markdown
        self.rewrite_derived = rewrite_derived
        self.sparse_threshold = sparse_threshold
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.sparse_messages: List[str] = []
        self.tables: Dict[str, List[Dict[str, str]]] = {}
        self.json_output: bool = json_output
        self.check_evidence: bool = check_evidence
        self.by_id: Dict[str, set[str]] = {}
        self.predicate_by_id: Dict[str, Dict[str, str]] = {}
        self.claim_by_id: Dict[str, Dict[str, str]] = {}
        self.passage_by_id: Dict[str, Dict[str, str]] = {}

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def markdown_source_root(self) -> Optional[Path]:
        return self.markdown_scan_root if self.check_markdown else None

    def file_for_entity_type(self, entity_type: str) -> Optional[str]:
        file_map = {
            "place": "places.tsv",
            "person": "people.tsv",
            "work": "works.tsv",
            "event": "events.tsv",
            "group": "groups.tsv",
            "topic": "topics.tsv",
            "dimension": "dimensions.tsv",
            "proposition": "propositions.tsv",
            "source": "sources.tsv",
            "passage": "passages.tsv",
            "claim": "claims.tsv",
            "editor_note": "editor_notes.tsv",
        }
        return file_map.get(entity_type)

    def subject_fk_exists(self, entity_type: str, entity_id: str) -> bool:
        filename = self.file_for_entity_type(entity_type)
        return bool(filename and entity_id in self.by_id.get(filename, set()))

    # ── Loading ────────────────────────────────────────────────────────────

    def load(self) -> None:
        sheets_dir = self.data_dir / "sheets"
        derived_dir = self.data_dir / "derived"

        for filename, headers in SOURCE_HEADERS.items():
            path = sheets_dir / filename
            if not path.exists():
                self.error(f"Missing required file: {filename}")
                continue
            rows = read_tsv(path)
            with path.open("r", encoding="utf-8") as f:
                first = f.readline().rstrip("\n\r")
                actual_headers = first.split("\t") if first else []
            if actual_headers != headers:
                self.error(f"Header mismatch in {filename}: expected {headers} got {actual_headers}")
            rows_sorted = sort_rows(headers, rows)
            if rows != rows_sorted:
                write_tsv(path, headers, rows_sorted)
                self.warn(f"Rewrote unsorted table into canonical order: {filename}")
                rows = rows_sorted
            self.tables[filename] = rows

        for filename, headers in DERIVED_HEADERS.items():
            path = derived_dir / filename
            if not path.exists():
                self.warn(f"Derived file missing and will be regenerated: {filename}")
                self.tables[filename] = []
                continue
            rows = read_tsv(path)
            with path.open("r", encoding="utf-8") as f:
                first = f.readline().rstrip("\n\r")
                actual_headers = first.split("\t") if first else []
            if actual_headers != headers:
                self.warn(f"Header mismatch in derived {filename}; file will be regenerated")
                self.tables[filename] = []
                continue
            self.tables[filename] = rows

        for filename, id_col in {
            "places.tsv": "place_id",
            "people.tsv": "person_id",
            "works.tsv": "work_id",
            "events.tsv": "event_id",
            "groups.tsv": "group_id",
            "topics.tsv": "topic_id",
            "dimensions.tsv": "dimension_id",
            "propositions.tsv": "proposition_id",
            "predicate_types.tsv": "predicate_id",
            "sources.tsv": "source_id",
            "passages.tsv": "passage_id",
            "claims.tsv": "claim_id",
            "editor_notes.tsv": "editor_note_id",
        }.items():
            rows = self.tables.get(filename, [])
            seen: set[str] = set()
            ids: set[str] = set()
            for idx, row in enumerate(rows, start=2):
                value = row.get(id_col, "")
                if not value:
                    self.error(f"{filename}:{idx} missing PK {id_col}")
                    continue
                if value in seen:
                    self.error(f"{filename}:{idx} duplicate PK {id_col}={value}")
                seen.add(value)
                ids.add(value)
            self.by_id[filename] = ids

        self.predicate_by_id = {row["predicate_id"]: row for row in self.tables.get("predicate_types.tsv", []) if row.get("predicate_id")}
        self.claim_by_id = {row["claim_id"]: row for row in self.tables.get("claims.tsv", []) if row.get("claim_id")}
        self.passage_by_id = {row["passage_id"]: row for row in self.tables.get("passages.tsv", []) if row.get("passage_id")}

    # ── Schema & enum validation ────────────────────────────────────────

    def validate_enums_and_entities(self) -> None:
        """Validate enum values and foreign keys for all entity tables."""
        for idx, row in enumerate(self.tables.get("places.tsv", []), start=2):
            if row["place_kind"] not in PLACE_KIND:
                self.error(f"places.tsv:{idx} invalid place_kind={row['place_kind']}")
            if row["location_precision"] not in LOCATION_PRECISION:
                self.error(f"places.tsv:{idx} invalid location_precision={row['location_precision']}")
            parent = row.get("parent_place_id", "")
            if parent and parent not in self.by_id.get("places.tsv", set()):
                self.error(f"places.tsv:{idx} broken FK parent_place_id={parent}")

        for idx, row in enumerate(self.tables.get("people.tsv", []), start=2):
            if row["person_kind"] not in PERSON_KIND:
                self.error(f"people.tsv:{idx} invalid person_kind={row['person_kind']}")

        for idx, row in enumerate(self.tables.get("works.tsv", []), start=2):
            if row["work_type"] not in WORK_TYPE:
                self.error(f"works.tsv:{idx} invalid work_type={row['work_type']}")
            if row["work_kind"] not in WORK_KIND:
                self.error(f"works.tsv:{idx} invalid work_kind={row['work_kind']}")

        for idx, row in enumerate(self.tables.get("events.tsv", []), start=2):
            if row["event_type"] not in EVENT_TYPE:
                self.error(f"events.tsv:{idx} invalid event_type={row['event_type']}")
            if row["event_kind"] not in EVENT_KIND:
                self.error(f"events.tsv:{idx} invalid event_kind={row['event_kind']}")

        for idx, row in enumerate(self.tables.get("groups.tsv", []), start=2):
            if row["group_kind"] not in GROUP_KIND:
                self.error(f"groups.tsv:{idx} invalid group_kind={row['group_kind']}")

        topic_ids = self.by_id.get("topics.tsv", set())
        for idx, row in enumerate(self.tables.get("topics.tsv", []), start=2):
            if row["topic_kind"] not in TOPIC_KIND:
                self.error(f"topics.tsv:{idx} invalid topic_kind={row['topic_kind']}")

        dim_ids = self.by_id.get("dimensions.tsv", set())
        for idx, row in enumerate(self.tables.get("dimensions.tsv", []), start=2):
            if row["dimension_kind"] not in DIMENSION_KIND:
                self.error(f"dimensions.tsv:{idx} invalid dimension_kind={row['dimension_kind']}")
            if row["topic_id"] not in topic_ids:
                self.error(f"dimensions.tsv:{idx} broken FK topic_id={row['topic_id']}")

        for idx, row in enumerate(self.tables.get("propositions.tsv", []), start=2):
            if row["topic_id"] not in topic_ids:
                self.error(f"propositions.tsv:{idx} broken FK topic_id={row['topic_id']}")
            dimension_id = row.get("dimension_id", "")
            if dimension_id and dimension_id not in dim_ids:
                self.error(f"propositions.tsv:{idx} broken FK dimension_id={dimension_id}")

        for idx, row in enumerate(self.tables.get("predicate_types.tsv", []), start=2):
            if row["subject_type"] not in ENTITY_TYPES:
                self.error(f"predicate_types.tsv:{idx} invalid subject_type={row['subject_type']}")
            if row["object_mode"] not in OBJECT_MODES:
                self.error(f"predicate_types.tsv:{idx} invalid object_mode={row['object_mode']}")
            if row.get("object_type") and row["object_type"] not in ENTITY_TYPES:
                self.error(f"predicate_types.tsv:{idx} invalid object_type={row['object_type']}")
            if row["canonical_sort_rule"] not in CANONICAL_SORT_RULE:
                self.error(f"predicate_types.tsv:{idx} invalid canonical_sort_rule={row['canonical_sort_rule']}")
            if row["object_mode"] == "entity" and not row.get("object_type"):
                self.error(f"predicate_types.tsv:{idx} object_mode=entity requires object_type")

        for idx, row in enumerate(self.tables.get("sources.tsv", []), start=2):
            if row["source_kind"] not in SOURCE_KIND:
                self.error(f"sources.tsv:{idx} invalid source_kind={row['source_kind']}")
            if row.get("work_id") and row["work_id"] not in self.by_id.get("works.tsv", set()):
                self.error(f"sources.tsv:{idx} broken FK work_id={row['work_id']}")
            src_ys = parse_int(row.get("year_start"))
            src_ye = parse_int(row.get("year_end"))
            if src_ys is not None and src_ye is not None and src_ye < src_ys:
                self.error(f"sources.tsv:{idx} year_end < year_start ({src_ye} < {src_ys})")

        for idx, row in enumerate(self.tables.get("passages.tsv", []), start=2):
            if row["source_id"] not in self.by_id.get("sources.tsv", set()):
                self.error(f"passages.tsv:{idx} broken FK source_id={row['source_id']}")
            if row.get("locator_type") not in PASSAGE_LOCATOR_TYPES:
                self.error(f"passages.tsv:{idx} invalid locator_type={row.get('locator_type', '')}")
            locator = norm(row.get("locator"))
            if not locator:
                self.error(f"passages.tsv:{idx} missing locator")
            if row.get("locator_type") == "bible_osis" and locator and not is_osis_ref(locator):
                self.error(f"passages.tsv:{idx} locator is not valid OSIS={locator}")

    # ── Claim structure validation ────────────────────────────────────────

    def validate_claims(self) -> None:
        """Validate claim structure: predicate match, FK integrity, logical uniqueness.
        Also dispatches all redundancy and evidence quality sub-validators."""
        logical_seen: set[Tuple[Any, ...]] = set()
        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            predicate = self.predicate_by_id.get(row["predicate_id"])
            if predicate is None:
                self.error(f"claims.tsv:{idx} missing predicate_id={row['predicate_id']}")
                continue
            if row["subject_type"] != predicate["subject_type"]:
                self.error(f"claims.tsv:{idx} subject_type {row['subject_type']} does not match predicate.subject_type {predicate['subject_type']}")
            if not self.subject_fk_exists(row["subject_type"], row["subject_id"]):
                self.error(f"claims.tsv:{idx} broken subject reference {row['subject_type']}:{row['subject_id']}")
            if row["object_mode"] != predicate["object_mode"]:
                self.error(f"claims.tsv:{idx} object_mode {row['object_mode']} does not match predicate.object_mode {predicate['object_mode']}")
            if row["certainty"] not in CERTAINTY:
                self.error(f"claims.tsv:{idx} invalid certainty={row['certainty']}")
            if row["claim_status"] not in CLAIM_STATUS:
                self.error(f"claims.tsv:{idx} invalid claim_status={row['claim_status']}")

            populated = [
                bool(row.get("object_id")),
                bool(row.get("value_text")),
                bool(row.get("value_number")),
                bool(row.get("value_year")),
                row.get("value_boolean", "") in {"true", "false"},
            ]
            if sum(populated) != 1:
                self.error(f"claims.tsv:{idx} expected exactly one populated object/value field, got {sum(populated)}")

            if row["object_mode"] == "entity":
                if row.get("object_type") != predicate.get("object_type", ""):
                    self.error(f"claims.tsv:{idx} object_type {row.get('object_type')} does not match predicate.object_type {predicate.get('object_type')}")
                if not row.get("object_id"):
                    self.error(f"claims.tsv:{idx} missing object_id for entity claim")
                elif not self.subject_fk_exists(row.get("object_type", ""), row["object_id"]):
                    self.error(f"claims.tsv:{idx} broken entity object reference {row.get('object_type')}:{row['object_id']}")
                if truthy(predicate["is_symmetric"]):
                    left = f"{row['subject_type']}:{row['subject_id']}"
                    right = f"{row['object_type']}:{row['object_id']}"
                    if left > right:
                        self.error(f"claims.tsv:{idx} symmetric predicate row is not in canonical order ({left} > {right})")
            else:
                if row.get("object_type") or row.get("object_id"):
                    self.error(f"claims.tsv:{idx} non-entity claim should not populate object_type/object_id")

            year_start = parse_int(row.get("year_start"))
            year_end = parse_int(row.get("year_end"))
            if year_start is not None and year_end is not None and year_end < year_start:
                self.error(f"claims.tsv:{idx} year_end < year_start ({year_end} < {year_start})")
            if row.get("context_place_id") and row["context_place_id"] not in self.by_id.get("places.tsv", set()):
                self.error(f"claims.tsv:{idx} broken FK context_place_id={row['context_place_id']}")

            normalized_object = (
                f"entity:{row['object_type']}:{row['object_id']}" if row["object_mode"] == "entity"
                else f"text:{row.get('value_text', '')}" if row["object_mode"] == "text"
                else f"number:{row.get('value_number', '')}" if row["object_mode"] == "number"
                else f"year:{row.get('value_year', '')}" if row["object_mode"] == "year"
                else f"boolean:{row.get('value_boolean', '')}"
            )
            logical_key = (
                row["subject_type"],
                row["subject_id"],
                row["predicate_id"],
                row["object_mode"],
                normalized_object,
                row.get("year_start", ""),
                row.get("year_end", ""),
                row.get("context_place_id", ""),
                row["claim_status"],
            )
            if row["claim_status"] == "active":
                if logical_key in logical_seen:
                    self.error(f"claims.tsv:{idx} duplicate logical active claim {logical_key}")
                logical_seen.add(logical_key)

        self.validate_change_based_group_claims()
        self.validate_author_work_affirmation_redundancy()
        self.validate_duplicate_claims()
        self.validate_bishop_location_redundancy()
        self.validate_authored_place_redundancy()
        self.validate_participant_place_redundancy()
        self.validate_controls_group_present_redundancy()
        self.validate_evidence_role_semantics()

    # ── Redundancy rules (R1–R8) ───────────────────────────────────────────

    def validate_change_based_group_claims(self) -> None:
        grouped: Dict[Tuple[str, str, str, str, str], List[Tuple[Optional[int], Optional[int], str]]] = defaultdict(list)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") not in MERGE_REQUIRED_PREDICATES:
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "place":
                continue
            key = (
                row["predicate_id"],
                row["subject_type"],
                row["subject_id"],
                row["object_type"],
                row["object_id"],
            )
            grouped[key].append((parse_int(row.get("year_start")), parse_int(row.get("year_end")), row["claim_id"]))
        for key, spans in grouped.items():
            spans_sorted = sorted(spans, key=lambda item: (item[0] is None, item[0] or -(10**9), item[1] is None, item[1] or 10**9, item[2]))
            previous_end: Optional[int] = None
            previous_claim = ""
            for start, end, claim_id in spans_sorted:
                if previous_claim:
                    prev_end_norm = previous_end if previous_end is not None else 10**9
                    start_norm = start if start is not None else -(10**9)
                    if start_norm <= prev_end_norm + 1:
                        self.error(
                            "claims.tsv: continuity merge required for "
                            f"predicate={key[0]} subject={key[1]}:{key[2]} object={key[3]}:{key[4]} "
                            f"claims={previous_claim},{claim_id}; merge uninterrupted intervals into one claim"
                        )
                previous_end = end
                previous_claim = claim_id

    def validate_author_work_affirmation_redundancy(self) -> None:
        """Error when person_*_proposition is backed solely by passages from works that already carry
        the equivalent work_*_proposition for the same proposition.

        Covers: person_affirms → work_affirms, person_opposes → work_opposes,
        person_mentions → work_mentions, person_develops → work_develops.

        Authorship is inferred structurally: if ALL of a person claim's evidence passages trace back
        (passage → source → work) to works authored by the same person that already carry the
        corresponding work-level predicate, the person claim is entirely redundant.
        """
        # passage_id -> work_id via passages.source_id -> sources.work_id
        source_by_id = {row["source_id"]: row for row in self.tables.get("sources.tsv", []) if row.get("source_id")}
        passage_to_work: Dict[str, str] = {}
        for row in self.tables.get("passages.tsv", []):
            pid = row.get("passage_id", "")
            sid = row.get("source_id", "")
            if pid and sid:
                wid = source_by_id.get(sid, {}).get("work_id", "")
                if wid:
                    passage_to_work[pid] = wid

        # Mapping from person predicate to its work equivalent
        PERSON_TO_WORK_PRED = {
            "person_affirms_proposition": "work_affirms_proposition",
            "person_opposes_proposition": "work_opposes_proposition",
            "person_mentions_proposition": "work_mentions_proposition",
            "person_develops_proposition": "work_develops_proposition",
        }
        WORK_PROP_PREDICATES = set(PERSON_TO_WORK_PRED.values())

        # work_id -> predicate -> set of proposition_ids
        work_prop_by_pred: Dict[str, Dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") in WORK_PROP_PREDICATES \
                    and row.get("object_mode") == "entity" \
                    and row.get("object_type") == "proposition":
                work_prop_by_pred[row["subject_id"]][row["predicate_id"]].add(row["object_id"])

        # claim_id -> set of passage_ids (from claim_evidence)
        claim_passages: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claim_evidence.tsv", []):
            if row.get("claim_id") and row.get("passage_id"):
                claim_passages[row["claim_id"]].add(row["passage_id"])

        # Build person_id -> set of work_ids they authored (from authored_by claims)
        person_authored_works: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "authored_by" \
                    and row.get("object_mode") == "entity" \
                    and row.get("object_type") == "person":
                person_authored_works[row["object_id"]].add(row["subject_id"])

        # Validate each person_*_proposition claim for redundancy with work_*_proposition
        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue
            person_pred = row.get("predicate_id", "")
            if person_pred not in PERSON_TO_WORK_PRED:
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "proposition":
                continue

            work_pred = PERSON_TO_WORK_PRED[person_pred]
            prop_id = row["object_id"]
            claim_id = row["claim_id"]
            subject_id = row["subject_id"]
            passages = claim_passages.get(claim_id, set())
            if not passages:
                continue  # no passage evidence — handled by evidence_role check

            # Map evidence passages to their source works
            evidence_works = {passage_to_work[p] for p in passages if p in passage_to_work}
            if not evidence_works:
                continue  # all passages are Bible / un-work-linked; legitimate person claim

            # Only fire when all evidence works are works authored by the subject person.
            person_works = person_authored_works.get(subject_id, set())
            if not evidence_works.issubset(person_works):
                continue  # some evidence is from a different author — legitimate claim

            # If EVERY evidence work already carries the corresponding work_*_proposition,
            # the person claim is redundant.
            redundant = [w for w in evidence_works if prop_id in work_prop_by_pred.get(w, {}).get(work_pred, set())]
            if len(redundant) == len(evidence_works):
                self.error(
                    f"claims.tsv:{idx} redundant {person_pred}: "
                    f"person={subject_id} prop={prop_id} is already covered by "
                    f"{work_pred} on own work(s)={redundant}. "
                    f"Remove the person claim; the work claim suffices (claim_id={claim_id})"
                )

    def validate_duplicate_claims(self) -> None:
        """Detect duplicate claims with same semantic meaning."""
        # Group claims by semantic key (excluding year ranges and claim_id)
        semantic_groups: Dict[Tuple[str, str, str, str, str, str], List[Tuple[int, Dict[str, str]]]] = defaultdict(list)
        
        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") not in {"active", "deprecated"}:
                continue
            
            normalized_object = (
                f"{row['object_type']}:{row['object_id']}" if row["object_mode"] == "entity"
                else f"text:{row.get('value_text', '')}" if row["object_mode"] == "text"
                else f"number:{row.get('value_number', '')}" if row["object_mode"] == "number"
                else f"year:{row.get('value_year', '')}" if row["object_mode"] == "year"
                else f"boolean:{row.get('value_boolean', '')}"
            )
            
            semantic_key = (
                row["subject_type"],
                row["subject_id"],
                row["predicate_id"],
                row["object_mode"],
                normalized_object,
            )
            
            semantic_groups[semantic_key].append((idx, row))
        
        # Check each group for duplicates
        for semantic_key, claims in semantic_groups.items():
            if len(claims) < 2:
                continue
            
            # Filter to active claims only
            active_claims = [(idx, row) for idx, row in claims if row.get("claim_status") == "active"]
            
            if len(active_claims) < 2:
                continue
            
            # Check for exact duplicates (same year range)
            year_groups: Dict[Tuple[str, str], List[Tuple[int, Dict[str, str]]]] = defaultdict(list)
            for idx, row in active_claims:
                year_key = (row.get("year_start", ""), row.get("year_end", ""))
                year_groups[year_key].append((idx, row))
            
            for year_key, year_claims in year_groups.items():
                if len(year_claims) > 1:
                    claim_ids = ", ".join([row["claim_id"] for _, row in year_claims])
                    indices = ", ".join([f"line {idx}" for idx, _ in year_claims])
                    self.error(
                        f"claims.tsv: exact duplicate claims ({indices}): "
                        f"subject={semantic_key[1]} predicate={semantic_key[2]} object={semantic_key[4]} "
                        f"year_range={year_key}. Merge into one claim with combined evidence: {claim_ids}"
                    )
            
            # Warn about overlapping temporal duplicates
            if len(active_claims) > 1:
                sorted_claims = sorted(active_claims, key=lambda item: (
                    parse_int(item[1].get("year_start")) or -(10**9),
                    parse_int(item[1].get("year_end")) or 10**9
                ))
                
                for i in range(len(sorted_claims) - 1):
                    idx1, row1 = sorted_claims[i]
                    idx2, row2 = sorted_claims[i + 1]
                    
                    start1 = parse_int(row1.get("year_start"))
                    end1 = parse_int(row1.get("year_end"))
                    start2 = parse_int(row2.get("year_start"))
                    end2 = parse_int(row2.get("year_end"))
                    
                    # Check for overlap or adjacency
                    if start1 is not None and end1 is not None and start2 is not None and end2 is not None:
                        if start2 <= end1 + 1:  # Overlapping or adjacent
                            self.warn(
                                f"claims.tsv:{idx1},{idx2} overlapping/adjacent temporal claims: "
                                f"subject={semantic_key[1]} predicate={semantic_key[2]} "
                                f"claim1={row1['claim_id']}({start1}-{end1}) claim2={row2['claim_id']}({start2}-{end2}). "
                                f"Consider merging if they represent continuous presence."
                            )

    def validate_bishop_location_redundancy(self) -> None:
        """Error when bishop_of implies active_in for same person-place pair."""
        bishop_places: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "bishop_of" and row.get("object_mode") == "entity" and row.get("object_type") == "place":
                bishop_places[row["subject_id"]].add(row["object_id"])

        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") != "active_in":
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "place":
                continue
            if row["object_id"] in bishop_places.get(row["subject_id"], set()):
                self.error(
                    f"claims.tsv:{idx} redundant active_in: "
                    f"person={row['subject_id']} is already bishop_of place={row['object_id']}. "
                    f"Remove active_in claim (claim_id={row['claim_id']})"
                )

    def validate_authored_place_redundancy(self) -> None:
        """Warn when active_in duplicates a derivable authored_by + written_at chain."""
        person_authored_places: Dict[str, set[str]] = defaultdict(set)
        written_at: Dict[str, set[str]] = defaultdict(set)
        authored_by: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "written_at" and row.get("object_mode") == "entity" and row.get("object_type") == "place":
                written_at[row["subject_id"]].add(row["object_id"])
            if row.get("predicate_id") == "authored_by" and row.get("object_mode") == "entity" and row.get("object_type") == "person":
                authored_by[row["subject_id"]].add(row["object_id"])
        for work_id, places in written_at.items():
            for person_id in authored_by.get(work_id, set()):
                person_authored_places[person_id].update(places)

        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") != "active_in":
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "place":
                continue
            if row["object_id"] in person_authored_places.get(row["subject_id"], set()):
                self.warn(
                    f"claims.tsv:{idx} potentially redundant active_in: "
                    f"person={row['subject_id']} place={row['object_id']} is derivable from authored_by + written_at. "
                    f"Consider removing (claim_id={row['claim_id']})"
                )

    def validate_participant_place_redundancy(self) -> None:
        """Warn when active_in duplicates participant_in + event_occurs_at for same person-place-time."""
        event_places: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "event_occurs_at" and row.get("object_mode") == "entity" and row.get("object_type") == "place":
                event_places[row["subject_id"]].add(row["object_id"])

        person_event_places: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "participant_in" and row.get("object_mode") == "entity" and row.get("object_type") == "event":
                for place_id in event_places.get(row["object_id"], set()):
                    person_event_places[row["subject_id"]].add(place_id)

        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") != "active_in":
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "place":
                continue
            if row["object_id"] in person_event_places.get(row["subject_id"], set()):
                self.warn(
                    f"claims.tsv:{idx} potentially redundant active_in: "
                    f"person={row['subject_id']} place={row['object_id']} is derivable from participant_in + event_occurs_at. "
                    f"Consider removing (claim_id={row['claim_id']})"
                )

    def validate_controls_group_present_redundancy(self) -> None:
        """R5: Error when group_present_at duplicates controls_place for same group/place/overlapping dates."""
        controls: Dict[Tuple[str, str], List[Tuple[Optional[int], Optional[int], str]]] = defaultdict(list)
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") == "controls_place" and row.get("object_mode") == "entity" and row.get("object_type") == "place":
                controls[(row["subject_id"], row["object_id"])].append(
                    (parse_int(row.get("year_start")), parse_int(row.get("year_end")), row["claim_id"])
                )

        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue
            if row.get("predicate_id") != "group_present_at":
                continue
            if row.get("object_mode") != "entity" or row.get("object_type") != "place":
                continue
            key = (row["subject_id"], row["object_id"])
            gpa_start = parse_int(row.get("year_start"))
            gpa_end = parse_int(row.get("year_end"))
            for cp_start, cp_end, cp_claim_id in controls.get(key, []):
                # Check date overlap (None treated as open-ended)
                s1 = gpa_start if gpa_start is not None else -(10**9)
                e1 = gpa_end if gpa_end is not None else 10**9
                s2 = cp_start if cp_start is not None else -(10**9)
                e2 = cp_end if cp_end is not None else 10**9
                if s1 <= e2 and s2 <= e1:
                    self.error(
                        f"claims.tsv:{idx} R5 redundant group_present_at: "
                        f"group={row['subject_id']} place={row['object_id']} is already covered by "
                        f"controls_place claim={cp_claim_id}. Remove the group_present_at claim "
                        f"(claim_id={row['claim_id']})"
                    )
                    break

    # ── Evidence quality rules (P1–P5) ──────────────────────────────────────

    def validate_evidence_role_semantics(self) -> None:
        """Validate evidence role quality rules P1–P5 and basic evidence semantics."""
        # Build indexes
        claim_evidence_rows: Dict[str, List[Dict[str, str]]] = defaultdict(list)
        claim_evidence_roles: Dict[str, set[str]] = defaultdict(set)
        for row in self.tables.get("claim_evidence.tsv", []):
            claim_id = row["claim_id"]
            evidence_role = row.get("evidence_role", "")
            if evidence_role:
                claim_evidence_roles[claim_id].add(evidence_role)
            claim_evidence_rows[claim_id].append(row)

        # passage -> source -> work_id chain
        source_by_id = {row["source_id"]: row for row in self.tables.get("sources.tsv", []) if row.get("source_id")}
        passage_to_work: Dict[str, str] = {}
        for row in self.tables.get("passages.tsv", []):
            pid = row.get("passage_id", "")
            sid = row.get("source_id", "")
            if pid and sid:
                wid = source_by_id.get(sid, {}).get("work_id", "")
                if wid:
                    passage_to_work[pid] = wid

        P3_QUALITY_ASPECTS = {"whole_claim", "predicate", "object"}

        for idx, row in enumerate(self.tables.get("claims.tsv", []), start=2):
            if row.get("claim_status") != "active":
                continue

            claim_id = row["claim_id"]
            evidence_roles = claim_evidence_roles.get(claim_id, set())
            certainty = row.get("certainty", "")
            ev_rows = claim_evidence_rows.get(claim_id, [])

            # Basic rule: 'attested' requires at least one 'supports'
            if certainty == "attested":
                if not evidence_roles:
                    self.warn(
                        f"claims.tsv:{idx} claim marked 'attested' but has no evidence: "
                        f"claim_id={claim_id}. Consider adding evidence or changing certainty."
                    )
                elif "supports" not in evidence_roles and evidence_roles.issubset({"contextualizes", "mentions"}):
                    self.warn(
                        f"claims.tsv:{idx} claim marked 'attested' but all evidence is contextual/mention: "
                        f"claim_id={claim_id} roles={evidence_roles}. "
                        f"Change certainty to 'probable' or add a direct 'supports' link."
                    )

            # Basic rule: sole evidence is contextualizes/mentions
            if evidence_roles and evidence_roles.issubset({"contextualizes", "mentions"}):
                self.warn(
                    f"claims.tsv:{idx} sole evidence is contextual/mention only (no 'supports'): "
                    f"claim_id={claim_id} roles={evidence_roles}. "
                    f"This evidence does not directly support the claim. "
                    f"Add a direct 'supports' link, change to a contextualizes-only note, or remove the evidence."
                )

            # P1: work_* claims should have evidence from the same work
            if row["subject_type"] == "work" and row["predicate_id"].startswith("work_"):
                work_subject = row["subject_id"]
                for ev in ev_rows:
                    if ev.get("evidence_role") != "supports":
                        continue
                    ev_work = passage_to_work.get(ev["passage_id"], "")
                    if ev_work and ev_work != work_subject:
                        self.warn(
                            f"claims.tsv:{idx} P1 source mismatch: work claim subject={work_subject} "
                            f"but supports evidence passage={ev['passage_id']} comes from work={ev_work}. "
                            f"claim_id={claim_id}"
                        )

            # P3: attested claims need quality support_aspect (only enforce when populated)
            if certainty == "attested" and ev_rows:
                supports_rows = [e for e in ev_rows if e.get("evidence_role") == "supports"]
                has_any_aspect = any(e.get("support_aspect") for e in supports_rows)
                if has_any_aspect:
                    has_quality = any(
                        e.get("support_aspect") in P3_QUALITY_ASPECTS
                        for e in supports_rows
                    )
                    if not has_quality:
                        self.warn(
                            f"claims.tsv:{idx} P3 attested claim has no supports evidence with "
                            f"support_aspect in {{whole_claim, predicate, object}}: "
                            f"claim_id={claim_id}. Consider adding a direct aspect reference."
                        )

            # P5: supports evidence with empty excerpt on passage
            for ev in ev_rows:
                if ev.get("evidence_role") != "supports":
                    continue
                passage = self.passage_by_id.get(ev["passage_id"])
                if passage and not passage.get("excerpt") and not ev.get("excerpt_override"):
                    self.warn(
                        f"claims.tsv:{idx} P5 supports evidence with no excerpt: "
                        f"claim_id={claim_id} passage={ev['passage_id']}. "
                        f"Add an excerpt to the passage or an excerpt_override to the evidence."
                    )

    # ── Evidence, review & note FK validation ──────────────────────────────

    def validate_evidence_reviews_notes(self) -> None:
        seen_evidence: set[Tuple[str, str, str]] = set()
        for idx, row in enumerate(self.tables.get("claim_evidence.tsv", []), start=2):
            if row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"claim_evidence.tsv:{idx} broken FK claim_id={row['claim_id']}")
            if row["passage_id"] not in self.by_id.get("passages.tsv", set()):
                self.error(f"claim_evidence.tsv:{idx} broken FK passage_id={row['passage_id']}")
            if row["evidence_role"] not in EVIDENCE_ROLE:
                self.error(f"claim_evidence.tsv:{idx} invalid evidence_role={row['evidence_role']}")
            if row.get("support_aspect") and row["support_aspect"] not in SUPPORT_ASPECT:
                self.error(f"claim_evidence.tsv:{idx} invalid support_aspect={row['support_aspect']}")
            if row.get("assertion_mode") and row["assertion_mode"] not in ASSERTION_MODE:
                self.error(f"claim_evidence.tsv:{idx} invalid assertion_mode={row['assertion_mode']}")
            # P4: supports + background_only is contradictory
            if row["evidence_role"] == "supports" and row.get("assertion_mode") == "background_only":
                self.error(
                    f"claim_evidence.tsv:{idx} supports + background_only is invalid: "
                    f"claim={row['claim_id']} passage={row['passage_id']}. "
                    f"Use evidence_role=contextualizes for background passages."
                )
            weight_str = norm(row.get("evidence_weight"))
            if weight_str:
                try:
                    weight_val = float(weight_str)
                    if weight_val < 0.0 or weight_val > 1.0:
                        self.error(f"claim_evidence.tsv:{idx} evidence_weight={weight_str} out of range 0.0–1.0")
                except ValueError:
                    self.error(f"claim_evidence.tsv:{idx} evidence_weight={weight_str} is not a valid number")
            key = (row["claim_id"], row["passage_id"], row["evidence_role"])
            if key in seen_evidence:
                self.error(f"claim_evidence.tsv:{idx} duplicate composite key {key}")
            seen_evidence.add(key)

        # Check for duplicate reviews - only one review per claim allowed
        seen_claim_ids: set[str] = set()
        for idx, row in enumerate(self.tables.get("claim_reviews.tsv", []), start=2):
            if row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"claim_reviews.tsv:{idx} broken FK claim_id={row['claim_id']}")
            if row["review_status"] not in REVIEW_STATUS:
                self.error(f"claim_reviews.tsv:{idx} invalid review_status={row['review_status']}")
            if row.get("confidence") and row["confidence"] not in REVIEW_CONFIDENCE:
                self.error(f"claim_reviews.tsv:{idx} invalid confidence={row['confidence']}")
            
            # Check for duplicate reviews of the same claim
            if row["claim_id"] in seen_claim_ids:
                self.error(f"claim_reviews.tsv:{idx} duplicate review for claim_id={row['claim_id']}. Only one review per claim is allowed. Update the existing review timestamp instead.")
            seen_claim_ids.add(row["claim_id"])

        for idx, row in enumerate(self.tables.get("editor_notes.tsv", []), start=2):
            if row["note_kind"] not in EDITOR_NOTE_KIND:
                self.error(f"editor_notes.tsv:{idx} invalid note_kind={row['note_kind']}")
            if row.get("entity_type"):
                if row["entity_type"] not in ENTITY_TYPES:
                    self.error(f"editor_notes.tsv:{idx} invalid entity_type={row['entity_type']}")
                elif row.get("entity_id") and not self.subject_fk_exists(row["entity_type"], row["entity_id"]):
                    self.error(f"editor_notes.tsv:{idx} broken entity ref {row['entity_type']}:{row['entity_id']}")
            if row.get("claim_id") and row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"editor_notes.tsv:{idx} broken FK claim_id={row['claim_id']}")

        for idx, row in enumerate(self.tables.get("claim_review_events.tsv", []), start=2):
            if row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"claim_review_events.tsv:{idx} broken FK claim_id={row['claim_id']}")
            if row["event_type"] not in REVIEW_EVENT_TYPE:
                self.error(f"claim_review_events.tsv:{idx} invalid event_type={row['event_type']}")

    # ── Markdown & OSIS validation ──────────────────────────────────────────

    def derive_expected_note_mentions(self) -> List[Dict[str, str]]:
        sources = collect_markdown_reference_sources(self.data_dir / "sheets", self.markdown_source_root())
        return derive_note_mentions(sources)

    def validate_markdown_links_and_osis(self) -> None:
        sources = collect_markdown_reference_sources(self.data_dir / "sheets", self.markdown_source_root())
        for src in sources:
            origin = src.get("source_path") or f"{src.get('source_table')}:{src.get('source_row_id')}:{src.get('source_field')}"
            for mentioned_type, mentioned_id, _label in parse_mentions(src.get("text", "")):
                if mentioned_type not in MENTION_TARGET_TYPES:
                    self.error(f"{origin} invalid wiki-link target type={mentioned_type}")
                elif mentioned_type == "bible":
                    if not is_osis_ref(mentioned_id):
                        self.error(f"{origin} invalid OSIS bible link={mentioned_id}")
                elif not self.subject_fk_exists(mentioned_type, mentioned_id):
                    self.error(f"{origin} broken wiki-link {mentioned_type}:{mentioned_id}")
        for filename, rows in self.tables.items():
            headers = TARGET_HEADERS.get(filename, [])
            osis_fields = [h for h in headers if "osis" in h.lower()]
            if not osis_fields:
                continue
            for idx, row in enumerate(rows, start=2):
                for field in osis_fields:
                    value = norm(row.get(field))
                    if value and not is_osis_ref(value):
                        self.error(f"{filename}:{idx} field {field} is not valid OSIS={value}")

    # ── Derived table generation & comparison ──────────────────────────────

    def derive_expected_first_attestations(self) -> List[Dict[str, Any]]:
        return derive_first_attestations(
            self.tables.get("claims.tsv", []),
            self.tables.get("claim_evidence.tsv", []),
            self.tables.get("passages.tsv", []),
        )

    def derive_expected_edges(self) -> List[Dict[str, str]]:
        return derive_edges(self.tables.get("claims.tsv", []))

    def derive_expected_proposition_place_presence(self, edges: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        return derive_proposition_place_presence(self.tables.get("claims.tsv", []), edges)

    def derive_expected_entity_place_footprints(self, edges: List[Dict[str, str]], proposition_presence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return derive_entity_place_footprints(self.tables.get("claims.tsv", []), proposition_presence, edges)

    def derive_expected_place_state_by_decade(self) -> List[Dict[str, Any]]:
        return derive_place_state_by_decade(self.tables.get("claims.tsv", []))

    def compare_rows(self, filename: str, expected: List[Dict[str, Any]]) -> None:
        expected_headers = TARGET_HEADERS[filename]
        expected_norm = [{h: "" if row.get(h) is None else str(row.get(h)) for h in expected_headers} for row in expected]
        expected_norm = sort_rows(expected_headers, expected_norm)
        actual = sort_rows(expected_headers, self.tables.get(filename, []))
        if actual == expected_norm:
            self.tables[filename] = actual
            return
        write_tsv(self.data_dir / "derived" / filename, expected_headers, expected_norm)
        self.warn(f"Rewrote stale derived file: {filename}")
        self.tables[filename] = expected_norm

    def validate_derived(self) -> None:
        self.compare_rows("note_mentions.tsv", self.derive_expected_note_mentions())
        self.compare_rows("first_attestations.tsv", self.derive_expected_first_attestations())
        edges = self.derive_expected_edges()
        self.compare_rows("derived_edges.tsv", edges)
        proposition_presence = self.derive_expected_proposition_place_presence(edges)
        self.compare_rows("proposition_place_presence.tsv", proposition_presence)
        self.compare_rows("entity_place_footprints.tsv", self.derive_expected_entity_place_footprints(edges, proposition_presence))
        self.compare_rows("place_state_by_decade.tsv", self.derive_expected_place_state_by_decade())

        for idx, row in enumerate(self.tables.get("derived_edges.tsv", []), start=2):
            if row["from_type"] not in ENTITY_TYPES:
                self.error(f"derived_edges.tsv:{idx} invalid from_type={row['from_type']}")
            elif not self.subject_fk_exists(row["from_type"], row["from_id"]):
                self.error(f"derived_edges.tsv:{idx} broken from ref {row['from_type']}:{row['from_id']}")
            if row["to_type"] not in ENTITY_TYPES:
                self.error(f"derived_edges.tsv:{idx} invalid to_type={row['to_type']}")
            elif not self.subject_fk_exists(row["to_type"], row["to_id"]):
                self.error(f"derived_edges.tsv:{idx} broken to ref {row['to_type']}:{row['to_id']}")

        for idx, row in enumerate(self.tables.get("note_mentions.tsv", []), start=2):
            if row["mention_source_type"] not in MENTION_SOURCE_TYPES:
                self.error(f"note_mentions.tsv:{idx} invalid mention_source_type={row['mention_source_type']}")
            if row["mentioned_type"] not in MENTION_TARGET_TYPES:
                self.error(f"note_mentions.tsv:{idx} invalid mentioned_type={row['mentioned_type']}")
            elif row["mentioned_type"] == "bible":
                if not is_osis_ref(row["mentioned_id"]):
                    self.error(f"note_mentions.tsv:{idx} invalid bible OSIS={row['mentioned_id']}")
            elif not self.subject_fk_exists(row["mentioned_type"], row["mentioned_id"]):
                self.error(f"note_mentions.tsv:{idx} broken mentioned entity ref {row['mentioned_type']}:{row['mentioned_id']}")

        for idx, row in enumerate(self.tables.get("proposition_place_presence.tsv", []), start=2):
            if row["proposition_id"] not in self.by_id.get("propositions.tsv", set()):
                self.error(f"proposition_place_presence.tsv:{idx} broken FK proposition_id={row['proposition_id']}")
            if row["place_id"] not in self.by_id.get("places.tsv", set()):
                self.error(f"proposition_place_presence.tsv:{idx} broken FK place_id={row['place_id']}")
            if row["stance"] not in STANCE:
                self.error(f"proposition_place_presence.tsv:{idx} invalid stance={row['stance']}")

        for idx, row in enumerate(self.tables.get("entity_place_footprints.tsv", []), start=2):
            if row["entity_type"] not in ENTITY_TYPES:
                self.error(f"entity_place_footprints.tsv:{idx} invalid entity_type={row['entity_type']}")
            elif not self.subject_fk_exists(row["entity_type"], row["entity_id"]):
                self.error(f"entity_place_footprints.tsv:{idx} broken entity ref {row['entity_type']}:{row['entity_id']}")
            if row["place_id"] not in self.by_id.get("places.tsv", set()):
                self.error(f"entity_place_footprints.tsv:{idx} broken FK place_id={row['place_id']}")
            if row.get("stance") and row["stance"] not in DERIVED_STANCE:
                self.error(f"entity_place_footprints.tsv:{idx} invalid stance={row['stance']}")

        for idx, row in enumerate(self.tables.get("first_attestations.tsv", []), start=2):
            if row["subject_type"] not in ENTITY_TYPES:
                self.error(f"first_attestations.tsv:{idx} invalid subject_type={row['subject_type']}")
            elif not self.subject_fk_exists(row["subject_type"], row["subject_id"]):
                self.error(f"first_attestations.tsv:{idx} broken subject ref {row['subject_type']}:{row['subject_id']}")
            if row["predicate_id"] not in self.by_id.get("predicate_types.tsv", set()):
                self.error(f"first_attestations.tsv:{idx} broken predicate ref {row['predicate_id']}")

        for idx, row in enumerate(self.tables.get("place_state_by_decade.tsv", []), start=2):
            if row["place_id"] not in self.by_id.get("places.tsv", set()):
                self.error(f"place_state_by_decade.tsv:{idx} broken FK place_id={row['place_id']}")
            if row["presence_status"] not in PRESENCE_STATUS:
                self.error(f"place_state_by_decade.tsv:{idx} invalid presence_status={row['presence_status']}")
            if row.get("dominant_polity_group_id") and row["dominant_polity_group_id"] not in self.by_id.get("groups.tsv", set()):
                self.error(f"place_state_by_decade.tsv:{idx} broken dominant_polity_group_id={row['dominant_polity_group_id']}")

    # ── Reporting ──────────────────────────────────────────────────────────

    def build_sparse_report(self) -> None:
        if self.sparse_threshold is None:
            return
        active_claims = [row for row in self.tables.get("claims.tsv", []) if row.get("claim_status") == "active"]
        claim_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        for row in active_claims:
            claim_counts[(row["subject_type"], row["subject_id"])] += 1
            if row.get("object_mode") == "entity" and row.get("object_type") and row.get("object_id"):
                claim_counts[(row["object_type"], row["object_id"])] += 1

        sparse_rows: List[Tuple[str, int, str, str]] = []
        for filename, (entity_type, label_field) in SPARSE_ENTITY_FILES.items():
            id_field = filename[:-4].replace("ies", "y")
            if filename == "places.tsv":
                id_field = "place_id"
            elif filename == "people.tsv":
                id_field = "person_id"
            elif filename == "works.tsv":
                id_field = "work_id"
            elif filename == "events.tsv":
                id_field = "event_id"
            elif filename == "groups.tsv":
                id_field = "group_id"
            elif filename == "topics.tsv":
                id_field = "topic_id"
            elif filename == "dimensions.tsv":
                id_field = "dimension_id"
            elif filename == "propositions.tsv":
                id_field = "proposition_id"
            for row in self.tables.get(filename, []):
                entity_id = row.get(id_field, "")
                if not entity_id:
                    continue
                count = claim_counts.get((entity_type, entity_id), 0)
                if count <= self.sparse_threshold:
                    sparse_rows.append((entity_type, count, entity_id, row.get(label_field, entity_id)))

        sparse_rows.sort(key=lambda item: (item[0], item[1], item[3].lower(), item[2]))
        self.sparse_messages = [
            f"{entity_type}:{entity_id} — {label} ({count} active claim link{'s' if count != 1 else ''})"
            for entity_type, count, entity_id, label in sparse_rows
        ]

    def build_evidence_report(self) -> List[Dict[str, Any]]:
        """Build detailed per-claim evidence quality report when --check-evidence is set."""
        if not self.check_evidence:
            return []
        source_by_id = {row["source_id"]: row for row in self.tables.get("sources.tsv", []) if row.get("source_id")}
        passage_to_work: Dict[str, str] = {}
        for row in self.tables.get("passages.tsv", []):
            pid, sid = row.get("passage_id", ""), row.get("source_id", "")
            if pid and sid:
                wid = source_by_id.get(sid, {}).get("work_id", "")
                if wid:
                    passage_to_work[pid] = wid
        evidence_by_claim: Dict[str, List[Dict[str, str]]] = defaultdict(list)
        for row in self.tables.get("claim_evidence.tsv", []):
            evidence_by_claim[row["claim_id"]].append(row)
        report: List[Dict[str, Any]] = []
        for row in self.tables.get("claims.tsv", []):
            if row.get("claim_status") != "active":
                continue
            claim_id = row["claim_id"]
            ev_rows = evidence_by_claim.get(claim_id, [])
            flags: List[str] = []
            if not ev_rows:
                flags.append("no_evidence")
            else:
                roles = {e.get("evidence_role") for e in ev_rows}
                if "supports" not in roles:
                    flags.append("no_supports")
                supports_rows = [e for e in ev_rows if e.get("evidence_role") == "supports"]
                for e in supports_rows:
                    psg = self.passage_by_id.get(e["passage_id"])
                    if psg and not psg.get("excerpt") and not e.get("excerpt_override"):
                        flags.append("missing_excerpt")
                        break
                if row["subject_type"] == "work" and row["predicate_id"].startswith("work_"):
                    for e in supports_rows:
                        ew = passage_to_work.get(e["passage_id"], "")
                        if ew and ew != row["subject_id"]:
                            flags.append("source_mismatch")
                            break
                has_aspect = any(e.get("support_aspect") for e in supports_rows)
                if has_aspect and not any(
                    e.get("support_aspect") in {"whole_claim", "predicate", "object"}
                    for e in supports_rows
                ):
                    flags.append("weak_aspect")
            if flags:
                report.append({"claim_id": claim_id, "certainty": row.get("certainty", ""), "flags": flags, "evidence_count": len(ev_rows)})
        report.sort(key=lambda r: (len(r["flags"]), r["claim_id"]))
        return report

    # ── Orchestrator ──────────────────────────────────────────────────────

    def run(self) -> int:
        """Run all validation passes and output results."""
        import json as json_mod
        self.load()
        self.validate_enums_and_entities()
        self.validate_claims()
        self.validate_evidence_reviews_notes()
        self.validate_markdown_links_and_osis()
        self.validate_derived()
        self.build_sparse_report()
        evidence_report = self.build_evidence_report()

        if self.json_output:
            result: Dict[str, Any] = {
                "passed": len(self.errors) == 0,
                "error_count": len(self.errors),
                "warning_count": len(self.warnings),
                "errors": self.errors,
                "warnings": self.warnings,
            }
            if self.sparse_threshold is not None:
                result["sparse"] = self.sparse_messages
            if self.check_evidence:
                result["evidence_report"] = evidence_report
            print(json_mod.dumps(result, indent=2))
            return 1 if self.errors else 0

        if self.warnings:
            print("Warnings:")
            for message in self.warnings:
                print(f"  - {message}")
        if self.check_evidence and evidence_report:
            print(f"Evidence quality issues ({len(evidence_report)} claims):")
            for item in evidence_report:
                print(f"  - {item['claim_id']}: {', '.join(item['flags'])} (ev={item['evidence_count']}, cert={item['certainty']})")
        if self.sparse_threshold is not None:
            print(f"Sparse entities (<= {self.sparse_threshold} active claim links):")
            if self.sparse_messages:
                for message in self.sparse_messages:
                    print(f"  - {message}")
            else:
                print("  - none")
        if self.errors:
            print("Errors:")
            for message in self.errors:
                print(f"  - {message}")
            return 1
        print("Canonical data validation passed.")
        return 0


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

def main() -> None:
    parser = argparse.ArgumentParser(description="Validate canonical TSV data, regenerate derived tables, optionally scan markdown files, and report sparse entities.")
    parser.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"), help="Directory containing canonical TSV files.")
    parser.add_argument("--check-markdown", action=argparse.BooleanOptionalAction, default=True, help="Scan markdown files outside TSV fields for wiki-link validation and note mention derivation (default: enabled; use --no-check-markdown to disable).")
    parser.add_argument("--scan-root", default=None, help="Root directory to scan for markdown files. Defaults to the repository root.")
    parser.add_argument("--rewrite-derived", action="store_true", help="Accepted for CLI compatibility; derived files are rewritten automatically when stale.")
    parser.add_argument("--check-sparse", nargs="?", const=1, type=int, default=None, metavar="N", help="Report entities with N or fewer active claim links. Defaults to 1 when passed without a value.")
    parser.add_argument("--json", action="store_true", help="Output results as machine-readable JSON.")
    parser.add_argument("--check-evidence", action="store_true", help="Detailed evidence quality report (source mismatches, missing excerpts, aspect coverage gaps).")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    if args.scan_root:
        markdown_scan_root = Path(args.scan_root).resolve()
    elif args.check_markdown:
        markdown_scan_root = data_dir.parent
    else:
        markdown_scan_root = None

    validator = Validator(
        data_dir,
        markdown_scan_root=markdown_scan_root,
        check_markdown=bool(args.check_markdown or args.scan_root),
        rewrite_derived=args.rewrite_derived,
        sparse_threshold=args.check_sparse,
        json_output=args.json,
        check_evidence=args.check_evidence,
    )
    sys.exit(validator.run())


if __name__ == "__main__":
    main()
