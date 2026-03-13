#!/usr/bin/env python3
"""Final cleanup:
1. Remove remaining redundant person_affirms
2. Fix broken FK in claim_evidence
3. Deduplicate reviews (keep latest per claim)
"""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# 1. Remove remaining redundant person_affirms
MORE_REDUNDANT = {
    'clm-athenagoras-affirms-incarnation',
    'clm-athenagoras-affirms-virgin-birth',
    'clm-aphrahat-affirms-gospel-harmony-person',
    'clm-aphrahat-affirms-judgment-person',
    'clm-aphrahat-affirms-ot-person',
}

for fname in ['claims.tsv', 'claim_evidence.tsv', 'claim_reviews.tsv']:
    path = os.path.join(DATA, fname)
    with open(path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fn = reader.fieldnames
        rows = [r for r in reader if r['claim_id'] not in MORE_REDUNDANT]
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
print(f"Removed {len(MORE_REDUNDANT)} redundant person_affirms.")

# 2. Fix broken FK in claim_evidence (clm-tertullian-affirms-bodily-resurrection-person)
path = os.path.join(DATA, 'claim_evidence.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = [r for r in reader if r['claim_id'] != 'clm-tertullian-affirms-bodily-resurrection-person']
with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
print("Removed broken FK evidence row.")

# 3. Deduplicate reviews: keep latest review per claim_id
path = os.path.join(DATA, 'claim_reviews.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    all_reviews = list(reader)

# Keep the latest review per claim_id (by reviewed_at timestamp)
best = {}
for r in all_reviews:
    cid = r['claim_id']
    if cid not in best or r['reviewed_at'] > best[cid]['reviewed_at']:
        best[cid] = r

deduped = list(best.values())
removed = len(all_reviews) - len(deduped)

with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(deduped)
print(f"Deduplicated reviews: removed {removed} duplicate rows.")
