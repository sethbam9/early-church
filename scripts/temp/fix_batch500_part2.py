#!/usr/bin/env python3
"""Fix Part 2 validation errors:
1. Remove duplicate event claims (keep the older one, delete the newer one)
2. Merge continuity intervals (extend the older claim's year_end, delete the newer one)
3. Remove the duplicate controls_place for philippi
"""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# --- EXACT DUPLICATES: remove the second (my batch) claim, keep the pre-existing one ---
DUPLICATES_TO_DELETE = {
    # My new claim -> already existed
    'clm-origen-expulsion-at-alexandria',   # dup of clm-expulsion-occurs-at-alexandria
    'clm-origen-expulsion-year',            # dup of clm-expulsion-year
    'clm-great-fire-year',                  # dup of clm-fire-of-rome-year
    'clm-mission-himyar-at-zafar',          # dup of clm-theophilus-mission-at-zafar
    'clm-mission-himyar-year',              # dup of clm-theophilus-mission-year
    'clm-mission-pantaenus-year',           # dup of clm-pantaenus-mission-year
    'clm-origen-torture-year',              # dup of clm-torture-decius-year
    'clm-persecution-shapur-at-seleucia',   # dup of clm-shapur-persecution-at-seleucia
    'clm-persecution-shapur-year',          # dup of clm-shapur-persecution-year
    'clm-synod-bostra-at-bostra',           # dup of clm-synod-bostra-occurs-at-bostra
}

# --- CONTINUITY MERGES: extend old claim's year_end, delete new claim ---
# Format: (claim_to_keep, new_year_end, claim_to_delete)
CONTINUITY_MERGES = [
    ('clm-group-jerusalem-church-jerusalem', 135, 'clm-jerusalem-church-at-jerusalem-late'),
    ('clm-group-antioch-church-antioch', 400, 'clm-antioch-church-at-antioch-late'),
    ('clm-group-corinthian-church-corinth', 200, 'clm-corinthian-church-at-corinth-late'),
    ('clm-group-ephesian-church-ephesus', 200, 'clm-ephesian-church-at-ephesus-late'),
    ('clm-group-smyrna-church-smyrna', 200, 'clm-smyrna-church-at-smyrna-late'),
    ('clm-group-pergamum-church-pergamum', 200, 'clm-pergamum-church-at-pergamum-late'),
    ('clm-group-philadelphia-church-philadelphia-asia', 200, 'clm-philadelphia-church-at-philadelphia-late'),
    ('clm-group-sardis-church-sardis', 200, 'clm-sardis-church-at-sardis-late'),
    ('clm-group-thyatira-church-thyatira', 200, 'clm-thyatira-church-at-thyatira-late'),
    ('clm-group-laodicean-church-laodicea', 200, 'clm-laodicean-church-at-laodicea-late'),
    ('clm-group-philippian-church-philippi', 200, 'clm-philippian-church-at-philippi-late'),
    ('clm-group-thessalonian-church-thessalonica', 200, 'clm-thessalonian-church-at-thessalonica-late'),
    ('clm-group-roman-church-rome', 400, 'clm-roman-church-at-rome-early'),
    ('clm-alexandrian-church-present', 400, 'clm-alexandrian-church-at-alexandria-late'),
    ('clm-group-roman-empire-philippi', 400, 'clm-rome-controls-philippi'),
]

all_to_delete = set(DUPLICATES_TO_DELETE)
for _, _, cid in CONTINUITY_MERGES:
    all_to_delete.add(cid)

# Build merge map: claim_to_keep -> new_year_end
merge_map = {}
for keep, new_ye, _ in CONTINUITY_MERGES:
    merge_map[keep] = new_ye

# Process claims.tsv
path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fieldnames = reader.fieldnames
    rows = list(reader)

kept = []
deleted = 0
merged = 0
for row in rows:
    cid = row['claim_id']
    if cid in all_to_delete:
        deleted += 1
        continue
    if cid in merge_map:
        row['year_end'] = str(merge_map[cid])
        merged += 1
    kept.append(row)

with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(kept)

print(f"Claims: deleted {deleted}, merged {merged}")

# Clean up evidence for deleted claims
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

print("Done. Run validation to verify.")
