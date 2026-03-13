#!/usr/bin/env python3
"""Remove second round of redundant person_affirms claims where work_affirms already covers them."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

REDUNDANT = {
    'clm-aristides-affirms-virgin-birth',
    'clm-justin-affirms-bodily-resurrection',
    'clm-justin-affirms-eucharist-malachi',
    'clm-justin-affirms-eucharist-real-presence',
    'clm-justin-affirms-eucharist-sacrifice',
    'clm-justin-affirms-incarnation',
    'clm-justin-affirms-logos',
    'clm-justin-affirms-trinitarian-baptism',
    'clm-justin-affirms-virgin-birth',
    'clm-theophilus-affirms-trinity',
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

# Also remove the editor note for theophilus-trinity since the claim is gone
path = os.path.join(DATA, 'editor_notes.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = [r for r in reader if r.get('claim_id') != 'clm-theophilus-affirms-trinity']
with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)

print('Removed 10 more redundant person_affirms claims.')
