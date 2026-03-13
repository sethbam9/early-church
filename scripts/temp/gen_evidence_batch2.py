#!/usr/bin/env python3
"""Add evidence for remaining batch claims that have clear passage support.
Also fix bad claims (zealots-in-sack has paul as subject, marcus-aurelius uses nero, etc.)"""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')
NOW = "2026-03-12T14:30:00Z"
CB = "cascade-evidence-batch"

existing_ev = set()
with open(os.path.join(DATA, 'claim_evidence.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        existing_ev.add((row['claim_id'], row['passage_id']))

new_evidence = []

def ev(cid, pid, role='supports', w='0.8', n=''):
    if (cid, pid) in existing_ev: return
    existing_ev.add((cid, pid))
    new_evidence.append('\t'.join([cid, pid, role, '', w, n]))

# --- Delete bad claims ---
BAD_CLAIMS = {
    'clm-zealots-in-sack',          # has paul as subject for sack of jerusalem (paul dead by 70)
    'clm-marcus-aurelius-in-lyons', # uses nero as person_id (Marcus Aurelius not in people.tsv)
    'clm-british-bishops-in-arles', # uses alban (martyred before 314)
    'clm-jacob-in-nicaea',          # points to council-of-arles-314 not Nicaea
    'clm-julius-member-roman-empire', # Julius is a centurion, not a church member; object is roman-church not roman-empire
    'clm-basilides-member-valentinians', # Basilides is NOT Valentinian — separate school
}

# --- NT active_in evidence ---
# Acts 20:4 travel party
ev('clm-aristarchus-active-rome', 'psg-phlm-23-24', 'supports', '0.8', 'Philemon 23-24 names Aristarchus as fellow prisoner with Paul.')
ev('clm-aristarchus-active-jerusalem', 'psg-acts-20-4', 'supports', '0.8')
ev('clm-aristarchus-member-roman-church', 'psg-phlm-23-24', 'supports', '0.7')
ev('clm-demas-active-rome', 'psg-phlm-23-24', 'supports', '0.8', 'Philemon 24 names Demas as fellow worker.')
ev('clm-demas-member-roman-church', 'psg-phlm-23-24', 'supports', '0.7')
ev('clm-epaphras-active-rome', 'psg-phlm-23-24', 'supports', '0.8', 'Philemon 23 names Epaphras as fellow prisoner.')
ev('clm-epaphras-member-roman', 'psg-phlm-23-24', 'supports', '0.7')

# Colossians co-workers
ev('clm-nympha-member-colossian', 'psg-col-4-15', 'supports', '0.9', 'Col 4:15 names Nympha and the church in her house.')
ev('clm-onesimus-coworker-tychicus', 'psg-col-4-7-9', 'supports', '0.8', 'Col 4:7-9 sends Tychicus with Onesimus.')
ev('clm-aristarchus-coworker-tychicus', 'psg-col-4-7-9', 'supports', '0.7')
ev('clm-epaphras-coworker-aristarchus', 'psg-phlm-23-24', 'supports', '0.7')
ev('clm-epaphras-member-hierapolis', 'psg-col-4-12-13', 'supports', '0.8', 'Col 4:12-13 names Epaphras laboring for Laodicea and Hierapolis.')

# Sopater, Secundus, Gaius, Tychicus — Acts 20 travel companions
ev('clm-sopater-active-jerusalem', 'psg-acts-20-4', 'supports', '0.8')
ev('clm-sopater-disciple', 'psg-acts-20-4', 'supports', '0.7')
ev('clm-secundus-active-jerusalem', 'psg-acts-20-4', 'supports', '0.8')
ev('clm-secundus-disciple', 'psg-acts-20-4', 'supports', '0.7')
ev('clm-gaius-active-jerusalem', 'psg-acts-20-4', 'supports', '0.8')
ev('clm-gaius-derbe-disciple', 'psg-acts-20-4', 'supports', '0.7')
ev('clm-tychicus-active-jerusalem', 'psg-acts-20-4', 'supports', '0.8')
ev('clm-tychicus-disciple', 'psg-acts-20-4', 'supports', '0.7')
ev('clm-trophimus-disciple', 'psg-acts-21-29', 'supports', '0.8')

# Erastus, Carpus, Crescens, Demas via 2 Timothy
ev('clm-erastus-disciple', 'psg-rom-16-23', 'supports', '0.7', 'Romans 16:23 names Erastus as city treasurer in Corinth.')
ev('clm-carpus-disciple', 'psg-2tim-4-13', 'supports', '0.7')
ev('clm-demas-disciple', 'psg-phlm-23-24', 'supports', '0.8')
ev('clm-crescens-disciple', 'psg-2tim-4-10-12', 'supports', '0.7')

# Phoebe
ev('clm-phoebe-active-rome', 'psg-rom-16-1-2', 'supports', '0.8', 'Romans 16:1-2 commends Phoebe, likely carried the letter to Rome.')

# Luke
ev('clm-luke-active-caesarea', 'psg-acts-21-3-8', 'supports', '0.7', 'We-passage places Luke at Caesarea.')

# Julius the centurion
ev('clm-julius-active-caesarea', 'psg-acts-27-1-3', 'supports', '1.0')
ev('clm-julius-active-rome', 'psg-acts-28-16-31', 'supports', '0.7')

# Ignatius at Smyrna
ev('clm-ignatius-member-smyrna-route', 'psg-ignatius-smyrn-1', 'supports', '0.7', 'Ignatius writes from Smyrna to the Smyrnaeans.')

# Patristic active_in with Eusebius evidence
ev('clm-aristides-active-rome', 'psg-aristides-apol-1-2', 'supports', '0.6', 'Apology addressed to emperor in Rome.')
ev('clm-hegesippus-active-antioch', 'psg-eusebius-he-4-23', 'contextualizes', '0.5')
ev('clm-origen-active-antioch', 'psg-eusebius-he-6-19', 'contextualizes', '0.5')
ev('clm-alexander-jerusalem-active-caesarea', 'psg-eusebius-he-6-19', 'supports', '0.8')
ev('clm-ambrose-alex-active-rome', 'psg-eusebius-he-6-19', 'contextualizes', '0.5')
ev('clm-julius-africanus-active-alexandria', 'psg-eusebius-he-6-19', 'contextualizes', '0.4')
ev('clm-novatian-active-carthage-mission', 'psg-eusebius-he-6-43', 'contextualizes', '0.5')
ev('clm-celerinus-active-rome', 'psg-eusebius-he-6-43', 'contextualizes', '0.6')
ev('clm-dionysius-alex-active-rome-exile', 'psg-eusebius-he-6-43', 'contextualizes', '0.5')
ev('clm-eusebius-active-antioch', 'psg-vita-const-by-eusebius', 'contextualizes', '0.4')
ev('clm-john-zebedee-active-asia', 'psg-irenaeus-ah-3-3-4', 'supports', '0.9')
ev('clm-marcion-active-pontus', 'psg-irenaeus-ah-1-27-1-2', 'supports', '0.7')
ev('clm-gregory-thaum-active-pontus', 'psg-gregory-address-6', 'supports', '0.7')
ev('clm-clement-alex-active-athens', 'psg-eusebius-he-5-10-1-2', 'contextualizes', '0.4')
ev('clm-ephrem-active-edessa', 'psg-ephrem-comm-diat-1', 'supports', '0.7')
ev('clm-rufinus-active-jerusalem', 'psg-rufinus-he-1-9', 'contextualizes', '0.4')
ev('clm-athanasius-active-trier', 'psg-athanasius-apol-const-29-31', 'contextualizes', '0.5')
ev('clm-shapur-active-seleucia', 'psg-aphrahat-dem-21', 'contextualizes', '0.5')
ev('clm-constantius-active-rome', 'psg-vita-const-by-eusebius', 'contextualizes', '0.4')
ev('clm-bardaisan-active-armenia', 'psg-eusebius-he-4-30', 'contextualizes', '0.4')

# Schism evidence
ev('clm-nicolaitans-schismed-from-ephesian', 'psg-rev-2-6', 'supports', '0.8', 'Rev 2:6 names the Nicolaitans at Ephesus.')
ev('clm-docetists-schismed-from-antioch', 'psg-ignatius-smyrn-1', 'supports', '0.7', 'Ignatius combats docetism in his letters from the Antiochene milieu.')

# Saturninus as docetist
ev('clm-saturninus-member-docetists', 'psg-irenaeus-ah-1-24-1-2', 'supports', '0.7', 'Irenaeus AH 1.24 describes Saturninus teaching the Saviour was incorporeal.')

# Patristic member_of_group
ev('clm-anicetus-member-roman-church', 'psg-irenaeus-ah-3-3-4', 'supports', '0.8')
ev('clm-eleutherus-member-roman-church', 'psg-irenaeus-ah-3-3-4', 'supports', '0.8')
ev('clm-melito-member-sardis-church', 'psg-eusebius-he-4-23', 'supports', '0.7')

# Patristic participants
ev('clm-polycarp-in-quartodeciman-visit', 'psg-eusebius-he-5-24', 'supports', '0.9')
ev('clm-cornelius-pope-in-council-251', 'psg-eusebius-he-6-43', 'supports', '0.7')
ev('clm-firmilian-in-council-256', 'psg-eusebius-he-6-43', 'contextualizes', '0.5')
ev('clm-zephyrinus-in-schism', 'psg-hippolytus-ref-9-7', 'supports', '0.8')
ev('clm-fabian-in-sardinian-return', 'psg-eusebius-he-6-43', 'contextualizes', '0.5')
ev('clm-novatian-in-decian', 'psg-eusebius-he-6-43', 'supports', '0.7')
ev('clm-dionysius-alex-in-decian', 'psg-eusebius-he-6-43', 'supports', '0.7')

# Patristic coworkers
ev('clm-dionysius-alex-coworker-origen', 'psg-eusebius-he-6-19', 'supports', '0.7')
ev('clm-athanasius-coworker-ezana', 'psg-rufinus-he-1-9', 'supports', '0.7')

# Priscilla at Rome
ev('clm-priscilla-active-rome-late', 'psg-rom-16-3-5', 'supports', '1.0')

# --- Delete bad claims ---
path = os.path.join(DATA, 'claims.tsv')
with open(path, 'r') as f:
    reader = csv.DictReader(f, delimiter='\t')
    fn = reader.fieldnames
    rows = list(reader)

kept = [r for r in rows if r['claim_id'] not in BAD_CLAIMS]
deleted = len(rows) - len(kept)
with open(path, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fn, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    writer.writerows(kept)
print(f"Deleted {deleted} bad claims")

# Clean reviews for bad claims
for fname in ['claim_reviews.tsv']:
    fpath = os.path.join(DATA, fname)
    with open(fpath, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        efn = reader.fieldnames
        erows = [r for r in reader if r['claim_id'] not in BAD_CLAIMS]
    with open(fpath, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=efn, delimiter='\t', lineterminator='\n')
        writer.writeheader()
        writer.writerows(erows)

# Append new evidence
def append_tsv(filename, rows):
    if not rows: return 0
    fpath = os.path.join(DATA, filename)
    with open(fpath, 'r') as f:
        content = f.read()
    if not content.endswith('\n'):
        content += '\n'
    with open(fpath, 'w') as f:
        f.write(content)
        for row in rows:
            f.write(row + '\n')
    return len(rows)

ne = append_tsv('claim_evidence.tsv', new_evidence)
print(f"Added {ne} evidence rows")
