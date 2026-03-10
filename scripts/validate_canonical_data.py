#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from generate_derived_tables import (
    TARGET_HEADERS,
    DERIVED_FILES,
    ENTITY_TYPES,
    MENTION_TARGET_TYPES,
    MENTION_SOURCE_TYPES,
    OBJECT_MODES,
    CERTAINTY,
    POLARITY,
    CLAIM_STATUS,
    EVIDENCE_ROLE,
    REVIEW_STATUS,
    REVIEW_CONFIDENCE,
    EDITOR_NOTE_KIND,
    PLACE_KIND,
    LOCATION_PRECISION,
    PERSON_KIND,
    WORK_TYPE,
    WORK_KIND,
    EVENT_TYPE,
    EVENT_KIND,
    GROUP_KIND,
    TOPIC_KIND,
    DIMENSION_KIND,
    SOURCE_KIND,
    STANCE,
    DERIVED_STANCE,
    PRESENCE_STATUS,
    CANONICAL_SORT_RULE,
    MERGE_REQUIRED_PREDICATES,
    parse_int,
    parse_mentions,
    is_osis_ref,
    hash_id,
    decade_range,
    write_tsv,
    derive_entity_place_footprints,
    derive_first_attestations,
    derive_note_mentions,
    derive_place_state_by_decade,
    derive_proposition_place_presence,
    collect_markdown_reference_sources,
)


def norm(value: Any) -> str:
    return "" if value is None else str(value).strip()


def truthy(value: str) -> bool:
    return norm(value).lower() == "true"


def read_tsv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [{k: norm(v) for k, v in row.items()} for row in reader]


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


class Validator:
    def __init__(self, data_dir: Path, scan_root: Optional[Path] = None, rewrite_derived: bool = False) -> None:
        self.data_dir = data_dir
        self.scan_root = scan_root or data_dir.parent
        self.rewrite_derived = rewrite_derived
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.tables: Dict[str, List[Dict[str, str]]] = {}
        self.by_id: Dict[str, set[str]] = {}
        self.predicate_by_id: Dict[str, Dict[str, str]] = {}
        self.claim_by_id: Dict[str, Dict[str, str]] = {}
        self.passage_by_id: Dict[str, Dict[str, str]] = {}

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

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
        for filename, headers in TARGET_HEADERS.items():
            path = self.data_dir / filename
            if not path.exists():
                self.error(f"Missing required file: {filename}")
                continue
            rows = read_tsv(path)
            actual_headers = []
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
            locator = norm(row.get("locator"))
            if locator and (locator.startswith("bible:") or row["source_id"].lower().startswith("bible-")):
                raw = locator.removeprefix("bible:")
                if not is_osis_ref(raw):
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
            spans_sorted = sorted(spans, key=lambda item: (item[0] is None, item[0] or -10**9, item[1] is None, item[1] or 10**9, item[2]))
            previous_start: Optional[int] = None
            previous_end: Optional[int] = None
            previous_claim = ""
            for start, end, claim_id in spans_sorted:
                if previous_claim:
                    prev_end_norm = previous_end if previous_end is not None else 10**9
                    start_norm = start if start is not None else -10**9
                    if start_norm <= prev_end_norm + 1:
                        self.error(
                            "claims.tsv: continuity merge required for "
                            f"predicate={key[0]} subject={key[1]}:{key[2]} object={key[3]}:{key[4]} "
                            f"claims={previous_claim},{claim_id}; merge uninterrupted intervals into one claim"
                        )
                previous_start, previous_end, previous_claim = start, end, claim_id

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
        sources = collect_markdown_reference_sources(self.data_dir, self.scan_root)
        return derive_note_mentions(sources)

    def validate_markdown_links_and_osis(self) -> None:
        sources = collect_markdown_reference_sources(self.data_dir, self.scan_root)
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
        write_tsv(self.data_dir / filename, expected_headers, expected_norm)
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

    def run(self) -> int:
        self.load()
        self.validate_enums_and_entities()
        self.validate_claims()
        self.validate_evidence_reviews_notes()
        self.validate_markdown_links_and_osis()
        self.validate_derived()
        if self.warnings:
            print("Warnings:")
            for message in self.warnings:
                print(f"  - {message}")
        if self.errors:
            print("Errors:")
            for message in self.errors:
                print(f"  - {message}")
            return 1
        print("Canonical data validation passed.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate canonical TSV data against the canonical schema and rewrite into canonical order.")
    parser.add_argument("--data-dir", default=str(Path(__file__).resolve().parent), help="Directory containing canonical TSV files.")
    parser.add_argument("--scan-root", default=None, help="Project root to scan for markdown-file wiki-links. Defaults to parent of data-dir.")
    parser.add_argument("--rewrite-derived", action="store_true", help="Accepted for CLI compatibility; derived files are rewritten automatically when stale.")
    args = parser.parse_args()
    validator = Validator(Path(args.data_dir).resolve(), scan_root=Path(args.scan_root).resolve() if args.scan_root else None, rewrite_derived=args.rewrite_derived)
    sys.exit(validator.run())


if __name__ == "__main__":
    main()
