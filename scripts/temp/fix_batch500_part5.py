#!/usr/bin/env python3
"""Fix Part 5: remove duplicate event_has_year claims."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

TO_DELETE = {
    'clm-burial-of-jesus-year',          # dup of clm-burial-year
    'clm-council-carthage-256-year-new',  # dup of clm-council-carthage-256-year
    'clm-council-ephesus-year',           # dup of clm-council-ephesus-431-year
    'clm-triumphal-entry-year',           # dup of clm-jesus-entry-year
    'clm-john-baptists-death-year-2',     # dup of clm-john-baptist-death-year
    'clm-martyrdom-alban-year-claim',     # dup of clm-martyrdom-alban-year-2
    'clm-sermon-mount-year',             # dup of clm-sermon-year
    'clm-temple-cleansing-year',         # dup of clm-temple-year
}

path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = list(reader)

kept = [r for r in rows if r['claim_id'] not in TO_DELETE]
print(f"Claims: deleted {len(rows) - len(kept)}")

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

print("Done.")
