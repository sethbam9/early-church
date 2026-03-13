#!/usr/bin/env python3
"""Fix batch-500 validation errors:
1. Remove redundant active_in where bishop_of covers the same person-place
2. Fix symmetric coworker_of canonical order (subject must be lexicographically <= object)
"""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')

# --- Redundant active_in claims to DELETE ---
REDUNDANT_ACTIVE_IN = {
    'clm-james-active-jerusalem',       # bishop_of jerusalem
    'clm-peter-active-antioch',          # bishop_of antioch
    'clm-peter-active-rome',             # bishop_of rome
    'clm-john-zebedee-active-ephesus',   # bishop_of ephesus
    'clm-clement-rome-active-rome',      # bishop_of rome
    'clm-papias-active-hierapolis',      # bishop_of hierapolis
    'clm-anicetus-active-rome',          # bishop_of rome
    'clm-melito-active-sardis',          # bishop_of sardis
    'clm-dionysius-corinth-active-corinth', # bishop_of corinth
    'clm-theophilus-antioch-active-antioch', # bishop_of antioch
    'clm-polycrates-active-ephesus',     # bishop_of ephesus
    'clm-eleutherus-active-rome',        # bishop_of rome
    'clm-victor-active-rome',            # bishop_of rome
    'clm-demetrius-active-alexandria',   # bishop_of alexandria
    'clm-hippolytus-active-rome',        # bishop_of rome (rival)
    'clm-zephyrinus-active-rome',        # bishop_of rome
    'clm-callistus-active-rome',         # bishop_of rome
    'clm-heraclas-active-alexandria',    # bishop_of alexandria
    'clm-beryllus-active-bostra',        # bishop_of bostra
    'clm-urban-i-active-rome',           # bishop_of rome
    'clm-pontian-active-rome',           # bishop_of rome
    'clm-firmilian-active-caesarea-capp', # bishop_of caesarea-cappadocia
    'clm-fabian-active-rome',            # bishop_of rome
    'clm-dionysius-alex-active-alexandria', # bishop_of alexandria
    'clm-cornelius-pope-active-rome',    # bishop_of rome
    'clm-lucius-i-active-rome',          # bishop_of rome
    'clm-stephen-i-active-rome',         # bishop_of rome
    'clm-gregory-illum-active-vagharshapat', # bishop_of vagharshapat
}

def fix_claims():
    path = os.path.join(DATA, 'claims.tsv')
    with open(path, 'r') as f:
        lines = f.readlines()
    
    header = lines[0]
    kept = [header]
    removed = 0
    fixed_sym = 0
    
    for line in lines[1:]:
        if not line.strip():
            continue
        cols = line.rstrip('\n').split('\t')
        cid = cols[0]
        
        # 1. Remove redundant active_in
        if cid in REDUNDANT_ACTIVE_IN:
            removed += 1
            continue
        
        # 2. Fix symmetric coworker_of ordering
        if len(cols) > 3 and cols[3] == 'coworker_of':
            subj_id = cols[2]  # subject person id
            obj_id = cols[7] if len(cols) > 7 else ''  # object person id (object_id column)
            if obj_id and subj_id > obj_id:
                # Swap subject and object, regenerate claim_id
                cols[2] = obj_id
                cols[7] = subj_id
                fixed_sym += 1
        
        kept.append('\t'.join(cols) + '\n')
    
    with open(path, 'w') as f:
        f.writelines(kept)
    
    print(f"Claims: removed {removed} redundant active_in, fixed {fixed_sym} symmetric order")

def fix_evidence():
    """Remove evidence rows for deleted claims."""
    path = os.path.join(DATA, 'claim_evidence.tsv')
    with open(path, 'r') as f:
        lines = f.readlines()
    
    header = lines[0]
    kept = [header]
    removed = 0
    
    for line in lines[1:]:
        if not line.strip():
            continue
        cols = line.rstrip('\n').split('\t')
        cid = cols[0]
        if cid in REDUNDANT_ACTIVE_IN:
            removed += 1
            continue
        kept.append(line if line.endswith('\n') else line + '\n')
    
    with open(path, 'w') as f:
        f.writelines(kept)
    
    print(f"Evidence: removed {removed} rows for deleted claims")

def fix_reviews():
    """Remove review rows for deleted claims."""
    path = os.path.join(DATA, 'claim_reviews.tsv')
    with open(path, 'r') as f:
        lines = f.readlines()
    
    header = lines[0]
    kept = [header]
    removed = 0
    
    for line in lines[1:]:
        if not line.strip():
            continue
        cols = line.rstrip('\n').split('\t')
        cid = cols[0]
        if cid in REDUNDANT_ACTIVE_IN:
            removed += 1
            continue
        kept.append(line if line.endswith('\n') else line + '\n')
    
    with open(path, 'w') as f:
        f.writelines(kept)
    
    print(f"Reviews: removed {removed} rows for deleted claims")

fix_claims()
fix_evidence()
fix_reviews()
print("Done. Run validation to re-sort and check.")
