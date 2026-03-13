#!/usr/bin/env python3
"""Fix Part 4 validation errors: remove all exact duplicates and continuity merges."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

DUPLICATES_TO_DELETE = {
    'clm-place-bethsaida-attested-2',
    'clm-place-cana-attested-2',
    'clm-cornelius-member-disciples',
    'clm-lydia-member-disciples',
    'clm-place-philippi-attested-late',
    'clm-damaris-member-disciples',
    'clm-place-corinth-attested-late',
    'clm-place-rome-attested-late',
    'clm-priscilla-member-roman',
    'clm-epaphras-member-laodicean',
    'clm-mark-coworker-peter',
    'clm-docetists-at-phrygia-2',
    'clm-ebionites-at-syria',
    'clm-abgar-active-edessa-only',
    'clm-julius-africanus-active-emmaus-2',
    'clm-church-east-at-arbela-2',
    'clm-alexander-coworker-origen',
    'clm-ambrose-coworker-origen-2',
    'clm-aksumite-church-at-tyre-2',
    'clm-ephrem-coworker-jacob-2',
    'clm-conversion-edessa-year-2',
    'clm-council-carthage-251-year-dup',
    'clm-council-ephesus-year-2',
    'clm-martyrdom-alban-at-britannia-2',
}

all_to_delete = set(DUPLICATES_TO_DELETE)

path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

kept = [r for r in rows if r['claim_id'] not in all_to_delete]
deleted = len(rows) - len(kept)

with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(kept)

print(f"Claims: deleted {deleted}")

for fname in ['claim_evidence.tsv', 'claim_reviews.tsv']:
    fpath = os.path.join(DATA, fname)
    with open(fpath, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fn = reader.fieldnames
        erows = list(reader)
    before = len(erows)
    erows = [r for r in erows if r['claim_id'] not in all_to_delete]
    after = len(erows)
    with open(fpath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(erows)
    print(f"{fname}: removed {before - after} rows")

print("Done.")
