#!/usr/bin/env python3
"""Fix symmetric coworker_of canonical order: subject_id must be <= object_id lexicographically."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

fixed = 0
for row in rows:
    if row['predicate_id'] == 'coworker_of':
        subj = row['subject_id']
        obj = row['object_id']
        if subj > obj:
            row['subject_id'] = obj
            row['object_id'] = subj
            fixed += 1

with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)

print(f"Fixed {fixed} symmetric coworker_of rows")
