#!/usr/bin/env python3
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
    "sources.tsv": ["source_id", "source_kind", "title", "author", "editor", "year", "container_title", "publisher", "url", "accessed_on", "isbn_issn", "notes"],
    "passages.tsv": ["passage_id", "source_id", "locator_type", "locator", "excerpt", "language", "passage_year", "url_override", "notes"],
    "claims.tsv": ["claim_id", "subject_type", "subject_id", "predicate_id", "object_mode", "object_type", "object_id", "value_text", "value_number", "value_year", "value_boolean", "year_start", "year_end", "context_place_id", "certainty", "polarity", "claim_status", "created_by", "updated_at"],
    "claim_evidence.tsv": ["claim_id", "passage_id", "evidence_role", "excerpt_override", "evidence_weight", "notes"],
    "claim_reviews.tsv": ["claim_id", "reviewer_id", "review_status", "reviewed_at", "confidence", "note"],
    "editor_notes.tsv": ["editor_note_id", "note_kind", "entity_type", "entity_id", "claim_id", "body_md", "created_by", "created_at"],
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
    "proposition_place_presence.tsv": ["proposition_id", "place_id", "year_start", "year_end", "stance", "supporting_claim_count", "opposing_claim_count", "derivation_hash"],
    "entity_place_footprints.tsv": ["entity_type", "entity_id", "place_id", "year_start", "year_end", "reason_predicate_id", "stance", "path_signature"],
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
POLARITY = {"supports", "opposes", "neutral", "mixed", "not_applicable"}
CLAIM_STATUS = {"active", "deprecated", "superseded", "rejected", "draft"}
EVIDENCE_ROLE = {"supports", "opposes", "contextualizes", "mentions"}
REVIEW_STATUS = {"unreviewed", "reviewed", "approved", "disputed", "needs_revision"}
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
SKIP_DIR_NAMES = {".git", ".hg", ".svn", "node_modules", "dist", "build", "coverage", "__pycache__", ".venv", "venv"}
WIKILINK_RE = re.compile(r"\[\[([a-z_]+):([^\]|]+)(?:\|([^\]]+))?\]\]")
OSIS_RE = re.compile(r"^(?:[1-3]?[A-Za-z][A-Za-z0-9]*)\.\d+\.\d+(?:-(?:(?:[1-3]?[A-Za-z][A-Za-z0-9]*)\.\d+\.\d+|\d+))?$")
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
    if header in {"year_start", "year_end", "first_year", "decade", "passage_year", "year", "value_year"}:
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


def derive_proposition_place_presence(claims: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    entity_places = derive_entity_place_links(claims)
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
                },
            )
            row["path"].update({claim["claim_id"], place_claim_id})
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
                "derivation_hash": hash_id("drv", row["proposition_id"], row["place_id"], row["year_start"], row["year_end"], *sorted(row["path"])),
            }
        )
    return sorted(out, key=lambda row: (row["proposition_id"], row["place_id"], row["year_start"], row["year_end"]))


def derive_entity_place_footprints(claims: List[Dict[str, str]], proposition_presence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    entity_places = derive_entity_place_links(claims)
    out: List[Dict[str, Any]] = []
    seen = set()
    for (entity_type, entity_id), places in entity_places.items():
        for place_id, year_start, year_end, predicate_id, claim_id in places:
            key = (entity_type, entity_id, place_id, year_start, year_end, predicate_id, "")
            if key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "place_id": place_id,
                    "year_start": "" if year_start is None else str(year_start),
                    "year_end": "" if year_end is None else str(year_end),
                    "reason_predicate_id": predicate_id,
                    "stance": "",
                    "path_signature": hash_id("path", *key, claim_id),
                }
            )
    for row in proposition_presence:
        key = ("proposition", row["proposition_id"], row["place_id"], row["year_start"], row["year_end"], "derived_proposition_presence", row["stance"])
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "entity_type": "proposition",
                "entity_id": row["proposition_id"],
                "place_id": row["place_id"],
                "year_start": row["year_start"],
                "year_end": row["year_end"],
                "reason_predicate_id": "derived_proposition_presence",
                "stance": row["stance"],
                "path_signature": row["derivation_hash"],
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


class Validator:
    def __init__(
        self,
        data_dir: Path,
        markdown_scan_root: Optional[Path] = None,
        check_markdown: bool = False,
        rewrite_derived: bool = False,
        sparse_threshold: Optional[int] = None,
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

    def validate_enums_and_entities(self) -> None:
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

    def validate_claims(self) -> None:
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
            if row["polarity"] not in POLARITY:
                self.error(f"claims.tsv:{idx} invalid polarity={row['polarity']}")
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
                row["polarity"],
                row["claim_status"],
            )
            if row["claim_status"] == "active":
                if logical_key in logical_seen:
                    self.error(f"claims.tsv:{idx} duplicate logical active claim {logical_key}")
                logical_seen.add(logical_key)

        self.validate_change_based_group_claims()

    def validate_change_based_group_claims(self) -> None:
        grouped: Dict[Tuple[str, str, str, str, str, str], List[Tuple[Optional[int], Optional[int], str]]] = defaultdict(list)
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
                row["polarity"],
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

    def validate_evidence_reviews_notes(self) -> None:
        seen_evidence: set[Tuple[str, str, str]] = set()
        for idx, row in enumerate(self.tables.get("claim_evidence.tsv", []), start=2):
            if row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"claim_evidence.tsv:{idx} broken FK claim_id={row['claim_id']}")
            if row["passage_id"] not in self.by_id.get("passages.tsv", set()):
                self.error(f"claim_evidence.tsv:{idx} broken FK passage_id={row['passage_id']}")
            if row["evidence_role"] not in EVIDENCE_ROLE:
                self.error(f"claim_evidence.tsv:{idx} invalid evidence_role={row['evidence_role']}")
            key = (row["claim_id"], row["passage_id"], row["evidence_role"])
            if key in seen_evidence:
                self.error(f"claim_evidence.tsv:{idx} duplicate composite key {key}")
            seen_evidence.add(key)

        seen_reviews: set[Tuple[str, str]] = set()
        for idx, row in enumerate(self.tables.get("claim_reviews.tsv", []), start=2):
            if row["claim_id"] not in self.by_id.get("claims.tsv", set()):
                self.error(f"claim_reviews.tsv:{idx} broken FK claim_id={row['claim_id']}")
            if row["review_status"] not in REVIEW_STATUS:
                self.error(f"claim_reviews.tsv:{idx} invalid review_status={row['review_status']}")
            if row.get("confidence") and row["confidence"] not in REVIEW_CONFIDENCE:
                self.error(f"claim_reviews.tsv:{idx} invalid confidence={row['confidence']}")
            key = (row["claim_id"], row["reviewer_id"])
            if key in seen_reviews:
                self.error(f"claim_reviews.tsv:{idx} duplicate composite key {key}")
            seen_reviews.add(key)

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

    def derive_expected_first_attestations(self) -> List[Dict[str, Any]]:
        return derive_first_attestations(
            self.tables.get("claims.tsv", []),
            self.tables.get("claim_evidence.tsv", []),
            self.tables.get("passages.tsv", []),
        )

    def derive_expected_proposition_place_presence(self) -> List[Dict[str, Any]]:
        return derive_proposition_place_presence(self.tables.get("claims.tsv", []))

    def derive_expected_entity_place_footprints(self) -> List[Dict[str, Any]]:
        proposition_presence = self.derive_expected_proposition_place_presence()
        return derive_entity_place_footprints(self.tables.get("claims.tsv", []), proposition_presence)

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
        self.compare_rows("proposition_place_presence.tsv", self.derive_expected_proposition_place_presence())
        self.compare_rows("entity_place_footprints.tsv", self.derive_expected_entity_place_footprints())
        self.compare_rows("place_state_by_decade.tsv", self.derive_expected_place_state_by_decade())

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

    def run(self) -> int:
        self.load()
        self.validate_enums_and_entities()
        self.validate_claims()
        self.validate_evidence_reviews_notes()
        self.validate_markdown_links_and_osis()
        self.validate_derived()
        self.build_sparse_report()
        if self.warnings:
            print("Warnings:")
            for message in self.warnings:
                print(f"  - {message}")
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate canonical TSV data, regenerate derived tables, optionally scan markdown files, and report sparse entities.")
    parser.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "data"), help="Directory containing canonical TSV files.")
    parser.add_argument("--check-markdown", action="store_true", help="Also scan markdown files outside TSV fields for wiki-link validation and note mention derivation.")
    parser.add_argument("--scan-root", default=None, help="Root directory to scan for markdown files. Defaults to the repository root when --check-markdown is enabled.")
    parser.add_argument("--rewrite-derived", action="store_true", help="Accepted for CLI compatibility; derived files are rewritten automatically when stale.")
    parser.add_argument("--check-sparse", nargs="?", const=1, type=int, default=None, metavar="N", help="Report entities with N or fewer active claim links. Defaults to 1 when passed without a value.")
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
    )
    sys.exit(validator.run())


if __name__ == "__main__":
    main()
