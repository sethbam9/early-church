#!/usr/bin/env python3
"""Fix Part 3 validation errors: remove exact duplicates, merge continuity intervals."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# Exact duplicates: delete the second claim (my batch), keep the first
DUPLICATES_TO_DELETE = {
    'clm-place-nazareth-attested-2',
    'clm-peter-in-pentecost-2',
    'clm-peter-active-jerusalem-early',
    'clm-place-paphos-attested-late',
    'clm-stephanas-member-roman-visit',
    'clm-paul-coworker-aquila-2',
    'clm-paul-coworker-priscilla-2',
    'clm-roman-church-at-rome-attestation',
    'clm-publius-active-malta-only',
    'clm-mark-active-rome',
    'clm-titus-active-dalmatia-2',
    'clm-trophimus-active-miletus-late',
    'clm-papias-coworker-polycarp-2',
    'clm-ignatius-in-own-martyrdom',
    'clm-valentinus-active-rome-late',
    'clm-justin-in-own-martyrdom',
    'clm-tatian-active-mesopotamia',
    'clm-irenaeus-in-lyons-persecution-2',
    'clm-montanists-at-north-africa',
    'clm-abgar-in-conversion-2',
    'clm-cyprian-coworker-dionysius-alex',  # dup of clm-dionysius-alex-coworker-cyprian
    'clm-novatian-opposes-cornelius',       # dup of clm-novatian-member-novatianists
    'clm-council-jerusalem-year',           # dup of clm-council-year
    'clm-dura-construction-year',           # dup of clm-dura-church-year
}

# Continuity merges: extend year_end of the keeper, delete the extension claim
CONTINUITY_MERGES = [
    ('clm-marcionites-present-rome', 300, 'clm-marcionites-at-rome-late'),
    ('clm-carthage-church-at-carthage', 400, 'clm-carthage-church-at-carthage-late'),
]

all_to_delete = set(DUPLICATES_TO_DELETE)
for _, _, cid in CONTINUITY_MERGES:
    all_to_delete.add(cid)

merge_map = {keep: new_ye for keep, new_ye, _ in CONTINUITY_MERGES}

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
