#!/usr/bin/env python3
"""Fix last continuity merge: sadducees at jerusalem."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# Merge clm-group-sadducees-jerusalem (27-30) with clm-sadducees-at-temple (27-70)
# Keep the broader one, delete the narrower one
TO_DELETE = {'clm-sadducees-at-temple'}
EXTEND = {'clm-group-sadducees-jerusalem': 70}

path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = list(reader)

kept = []
for row in rows:
    if row['claim_id'] in TO_DELETE:
        continue
    if row['claim_id'] in EXTEND:
        row['year_end'] = str(EXTEND[row['claim_id']])
    kept.append(row)

with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(kept)

for fname in ['claim_reviews.tsv']:
    fpath = os.path.join(DATA, fname)
    with open(fpath, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        efn = reader.fieldnames
        erows = [r for r in reader if r['claim_id'] not in TO_DELETE]
    with open(fpath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=efn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(erows)

print("Fixed sadducees continuity merge.")
