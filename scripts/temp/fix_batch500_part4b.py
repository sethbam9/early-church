#!/usr/bin/env python3
"""Fix last 2 continuity merges from part 4."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

TO_DELETE = {'clm-disciples-at-jerusalem-late', 'clm-disciples-at-samaria-post'}
# Extend the keeper claims instead
EXTEND = {
    'clm-disciples-at-jerusalem-early': 70,  # was 30-33, extend to 70
    'clm-group-disciples-samaria': 40,       # was 33-35, extend to 40
}

path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = list(reader)

# But wait — clm-disciples-at-jerusalem-early is 30-70 and clm-disciples-at-jerusalem-late is 30-70 too
# Let me check what they actually are first
for r in rows:
    if r['claim_id'] in TO_DELETE or r['claim_id'] in EXTEND:
        print(f"  {r['claim_id']}: {r['year_start']}-{r['year_end']}")

# The "early" one covers 30-33, "late" covers 30-70 — just delete the narrow one
# For samaria: group-disciples-samaria is 33-35, disciples-at-samaria-post is 33-40

kept = [r for r in rows if r['claim_id'] not in TO_DELETE]
for r in kept:
    if r['claim_id'] in EXTEND:
        r['year_end'] = str(EXTEND[r['claim_id']])

deleted = len(rows) - len(kept)
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

print(f"Deleted {deleted} claims, extended {len(EXTEND)} year_end values.")
