#!/usr/bin/env python3
"""Remove redundant person_affirms claims where work_affirms already covers them."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

REDUNDANT = {
    'clm-clement-rome-affirms-bodily-resurrection',
    'clm-clement-rome-affirms-episcopal-chair',
    'clm-clement-rome-affirms-martyrdom',
    'clm-clement-rome-affirms-rule-of-faith',
    'clm-clement-rome-affirms-succession',
    'clm-ignatius-affirms-bishop-eucharist',
    'clm-ignatius-affirms-eucharist-immortality',
    'clm-ignatius-affirms-eucharist-real-presence',
    'clm-ignatius-affirms-martyrdom',
    'clm-ignatius-affirms-virgin-birth',
}

for fname in ['claims.tsv', 'claim_evidence.tsv', 'claim_reviews.tsv']:
    path = os.path.join(DATA, fname)
    with open(path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        fn = reader.fieldnames
        rows = [r for r in reader if r['claim_id'] not in REDUNDANT]
    with open(path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

print('Removed 10 redundant person_affirms claims (covered by work_affirms).')
