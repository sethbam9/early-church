#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import re
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
    "passages.tsv": ["passage_id", "source_id", "locator", "excerpt", "language", "passage_year", "url_override", "notes"],
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


def norm(value: Any) -> str:
    return "" if value is None else str(value).strip()


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
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({h: "" if row.get(h) is None else row.get(h) for h in headers})


def is_markdown_field(field_name: str) -> bool:
    return field_name in MARKDOWN_FIELD_NAMES or field_name.endswith(MARKDOWN_FIELD_SUFFIXES)


def should_skip_path(path: Path) -> bool:
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def get_row_id(row: Dict[str, str], headers: Sequence[str]) -> str:
    for header in headers:
        if header.endswith("_id") and norm(row.get(header)):
            return norm(row.get(header))
    digest = hashlib.sha1("||".join(norm(row.get(h)) for h in headers).encode("utf-8")).hexdigest()[:12]
    return f"row-{digest}"


def collect_markdown_reference_sources(source_tables_dir: Path, scan_root: Path) -> List[Dict[str, str]]:
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
    if scan_root.exists():
        for path in sorted(scan_root.rglob("*.md")):
            if should_skip_path(path):
                continue
            if path.is_dir():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if "[[" not in text:
                continue
            rel_path = str(path.relative_to(scan_root))
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
        links[(claim["subject_type"], claim["subject_id"])].append(
            (claim["object_id"], year_start, year_end, claim["predicate_id"], claim["claim_id"])
        )
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
        key = (
            "proposition",
            row["proposition_id"],
            row["place_id"],
            row["year_start"],
            row["year_end"],
            "derived_proposition_presence",
            row["stance"],
        )
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
        subject_type = claim["subject_type"]
        subject_id = claim["subject_id"]
        predicate_id = claim["predicate_id"]
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
        key = (subject_type, subject_id, predicate_id)
        existing = best.get(key)
        if existing is None or (first_year is not None and (existing["first_year"] == "" or int(existing["first_year"]) > first_year)):
            first_passage_id = ""
            if evidence_by_claim.get(claim["claim_id"]):
                first_passage_id = sorted(ev["passage_id"] for ev in evidence_by_claim[claim["claim_id"]])[0]
            best[key] = {
                "subject_type": subject_type,
                "subject_id": subject_id,
                "predicate_id": predicate_id,
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate derived canonical TSV tables.")
    parser.add_argument("--data-dir", default=str(Path(__file__).resolve().parent), help="Directory containing canonical TSV files.")
    parser.add_argument("--scan-root", default=None, help="Directory to scan for markdown file wiki-links. Defaults to data-dir.")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    sheets_dir = data_dir / "sheets"
    scan_root = Path(args.scan_root).resolve() if args.scan_root else data_dir

    claims = read_tsv(sheets_dir / "claims.tsv")
    passages = read_tsv(sheets_dir / "passages.tsv")
    claim_evidence = read_tsv(sheets_dir / "claim_evidence.tsv")

    markdown_sources = collect_markdown_reference_sources(sheets_dir, scan_root)
    note_mentions = derive_note_mentions(markdown_sources)
    proposition_presence = derive_proposition_place_presence(claims)
    entity_footprints = derive_entity_place_footprints(claims, proposition_presence)
    first_attestations = derive_first_attestations(claims, claim_evidence, passages)
    place_state = derive_place_state_by_decade(claims)

    derived_path = data_dir / "derived"
    write_tsv(derived_path / "note_mentions.tsv", DERIVED_HEADERS["note_mentions.tsv"], note_mentions)
    write_tsv(derived_path / "proposition_place_presence.tsv", DERIVED_HEADERS["proposition_place_presence.tsv"], proposition_presence)
    write_tsv(derived_path / "entity_place_footprints.tsv", DERIVED_HEADERS["entity_place_footprints.tsv"], entity_footprints)
    write_tsv(derived_path / "first_attestations.tsv", DERIVED_HEADERS["first_attestations.tsv"], first_attestations)
    write_tsv(derived_path / "place_state_by_decade.tsv", DERIVED_HEADERS["place_state_by_decade.tsv"], place_state)
    print("Derived tables regenerated.")


if __name__ == "__main__":
    main()
