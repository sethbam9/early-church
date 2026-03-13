#!/usr/bin/env python3
"""Programmatically find and remove ALL redundant person_affirms/opposes claims
where the person's own authored works already carry the same proposition via work_affirms/opposes.
This mirrors the validator's Rule A logic."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# Load claims
claims = []
with open(os.path.join(DATA, 'claims.tsv'), 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn_claims = reader.fieldnames
    claims = list(reader)

# Load evidence
ev_by_claim = {}
with open(os.path.join(DATA, 'claim_evidence.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        ev_by_claim.setdefault(row['claim_id'], []).append(row)

# Build authored_by map: person -> set of work_ids
authored_by = {}  # person_id -> set(work_id)
for c in claims:
    if c['predicate_id'] == 'authored_by' and c['claim_status'] == 'active':
        person = c['object_id']  # authored_by: work authored_by person
        work = c['subject_id']
        authored_by.setdefault(person, set()).add(work)

# Build work_affirms/opposes map: (work_id, proposition_id) -> bool
work_props = {}  # (work_id, prop_id) -> set of passage_ids from evidence
for c in claims:
    if c['predicate_id'] in ('work_affirms_proposition', 'work_opposes_proposition') and c['claim_status'] == 'active':
        work = c['subject_id']
        prop = c['object_id']
        evs = ev_by_claim.get(c['claim_id'], [])
        passages = {e['passage_id'] for e in evs}
        work_props[(work, prop)] = passages

# Find redundant person_affirms/opposes
redundant = set()
for c in claims:
    if c['predicate_id'] not in ('person_affirms_proposition', 'person_opposes_proposition'):
        continue
    if c['claim_status'] != 'active':
        continue
    person = c['subject_id']
    prop = c['object_id']
    # Check if person has authored works that already affirm/oppose this prop
    works = authored_by.get(person, set())
    for w in works:
        direction = 'work_affirms_proposition' if 'affirms' in c['predicate_id'] else 'work_opposes_proposition'
        # Check if this work has a claim for the same prop with evidence passages
        key = (w, prop)
        if key in work_props and len(work_props[key]) > 0:
            redundant.add(c['claim_id'])
            break

print(f"Found {len(redundant)} redundant person_affirms/opposes claims to remove:")
for cid in sorted(redundant):
    print(f"  {cid}")

# Remove from all tables
for fname in ['claims.tsv', 'claim_evidence.tsv', 'claim_reviews.tsv']:
    path = os.path.join(DATA, fname)
    with open(path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fn = reader.fieldnames
        rows = [r for r in reader if r['claim_id'] not in redundant]
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

# Remove editor notes linked to deleted claims
path = os.path.join(DATA, 'editor_notes.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = [r for r in reader if r.get('claim_id', '') not in redundant]
with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)

print(f"\nRemoved {len(redundant)} claims from all tables.")
