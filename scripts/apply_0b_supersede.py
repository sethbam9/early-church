#!/usr/bin/env python3
"""Apply Queue 0B structural purge: supersede 27 narrow-range derivable claims."""
import csv
import json
from datetime import datetime, timezone

SUPERSEDE = [
    "clm-judas-iscariot-active-jerusalem",
    "clm-matthew-active-jerusalem",
    "clm-joseph-arimathea-active-jerusalem",
    "clm-mary-magdalene-active-jerusalem",
    "clm-mary-mother-active-jerusalem",
    "clm-nicodemus-active-jerusalem",
    "clm-thomas-active-jerusalem",
    "clm-stephen-active-jerusalem",
    "clm-paul-active-damascus",
    "clm-paul-active-rome",
    "clm-john-person-affirms-logos",
    "clm-antipas-active-pergamum",
    "clm-john-active-patmos",
    "clm-polycarp-affirms-eucharist",
    "clm-polycarp-affirms-fasting",
    "clm-ignatius-active-smyrna",
    "clm-justin-affirms-fasting",
    "clm-melito-affirms-ot-scripture",
    "clm-melito-affirms-passion",
    "clm-tatian-affirms-gospel-harmony",
    "clm-irenaeus-active-rome",
    "clm-clement-alex-affirms-incarnation",
    "clm-tertullian-affirms-catechumenate",
    "clm-celerinus-active-rome",
    "clm-theophilus-active-zafar",
    "clm-ephrem-affirms-prayer",
    "clm-addai-active-edessa",
]

ss = set(SUPERSEDE)
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rw_tsv(path):
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f, delimiter="\t")
        return rd.fieldnames, list(rd)


def ww_tsv(path, headers, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers, delimiter="\t",
                           lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow(r)


# 1. Supersede claims
h, rows = rw_tsv("data/sheets/claims.tsv")
changed = 0
for r in rows:
    if r["claim_id"] in ss and r["claim_status"] == "active":
        r["claim_status"] = "superseded"
        changed += 1
ww_tsv("data/sheets/claims.tsv", h, rows)
print(f"Claims superseded: {changed}")

# 2. Delete evidence rows
h2, ev = rw_tsv("data/sheets/claim_evidence.tsv")
kept = [r for r in ev if r["claim_id"] not in ss]
print(f"Evidence rows deleted: {len(ev) - len(kept)}")
ww_tsv("data/sheets/claim_evidence.tsv", h2, kept)

# 3. Write reviews
h3, rev = rw_tsv("data/sheets/claim_reviews.tsv")
for cid in SUPERSEDE:
    is_pprop = "affirms" in cid or "opposes" in cid
    rev.append({
        "claim_id": cid,
        "reviewer_id": "cascade-audit-v2",
        "review_status": "approved",
        "reviewed_at": now,
        "confidence": "high",
        "note": ("Superseded: person_*_proposition covered by work_*_proposition (R2)."
                 if is_pprop else
                 "Superseded: active_in derivable from event/work claims (R8), narrow year range."),
    })
ww_tsv("data/sheets/claim_reviews.tsv", h3, rev)
print(f"Reviews written: {len(SUPERSEDE)}")

# 4. Append review events
h4, evt = rw_tsv("data/sheets/claim_review_events.tsv")
for cid in SUPERSEDE:
    evt.append({
        "claim_id": cid,
        "event_type": "approved",
        "actor_id": "cascade-audit-v2",
        "event_at": now,
        "note": "Queue 0B structural purge: superseded as derivable.",
    })
ww_tsv("data/sheets/claim_review_events.tsv", h4, evt)
print(f"Review events: {len(SUPERSEDE)}")

# 5. Append findings
findings = []
for cid in SUPERSEDE:
    is_pprop = "affirms" in cid or "opposes" in cid
    findings.append({
        "claim_id": cid,
        "issue_codes": ["REDUNDANT_PERSON_PROP"] if is_pprop else ["REDUNDANT_DERIVED_PRESENCE"],
        "recommended_action": "supersede",
        "confidence": "high",
        "applied": True,
        "batch_id": "queue-0B",
        "note": ("R2: person_*_proposition covered by work_*_proposition."
                 if is_pprop else
                 "R8: active_in fully covered by event/work derivation (narrow year range)."),
    })
with open("data/audit/findings.ndjson", "a", encoding="utf-8") as f:
    for fi in findings:
        f.write(json.dumps(fi, ensure_ascii=False) + "\n")
print(f"Findings appended: {len(findings)}")
print("Done.")
