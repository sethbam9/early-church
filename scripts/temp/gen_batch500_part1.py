#!/usr/bin/env python3
"""Generate batch-500 claims part 1: bishops, coworkers, active_in, member_of_group."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')
NOW = "2026-03-12T12:00:00Z"
CB = "cascade-batch-500"

def load_ids(path, col):
    ids = set()
    with open(os.path.join(DATA, path), 'r') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            ids.add(row[col])
    return ids

existing_claims = load_ids('claims.tsv', 'claim_id')
existing_ev = set()
with open(os.path.join(DATA, 'claim_evidence.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        existing_ev.add((row['claim_id'], row['passage_id']))

claims = []
evidence = []
reviews = []
notes = []

def clm(cid, st, si, pred, om, ot, oi, vt='', vn='', vy='', vb='', ys='', ye='', cp='', cert='probable', cs='active'):
    if cid in existing_claims: return False
    existing_claims.add(cid)
    claims.append('\t'.join(str(x) for x in [cid,st,si,pred,om,ot if om=='entity' else '',oi if om=='entity' else '',vt,vn,vy,vb,ys,ye,cp,cert,cs,CB,NOW]))
    return True

def ev(cid, pid, role='supports', w='0.8', n=''):
    if (cid,pid) in existing_ev: return
    existing_ev.add((cid,pid))
    evidence.append('\t'.join([cid,pid,role,'',w,n]))

def rev(cid, conf='high', n=''):
    reviews.append('\t'.join([cid,CB,'reviewed',NOW,conf,n or 'Batch-500 reviewed.']))

def note(nid, nk, et, ei, cid, body):
    notes.append('\t'.join([nid,nk,et,ei,cid,body,CB,NOW]))

# === BISHOPS ===
def bishop(cid, p, pl, ys, ye, cert='probable'):
    if clm(cid,'person',p,'bishop_of','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

bishop('clm-anicetus-bishop-rome','anicetus','rome',155,166)
ev('clm-anicetus-bishop-rome','psg-irenaeus-ah-3-3-4','supports','0.9','Irenaeus lists Anicetus in Roman succession.')
bishop('clm-eleutherus-bishop-rome','eleutherus','rome',174,189)
ev('clm-eleutherus-bishop-rome','psg-irenaeus-ah-3-3-4','supports','0.9')
bishop('clm-hippolytus-rival-bishop-rome','hippolytus-of-rome','rome',217,235)
ev('clm-hippolytus-rival-bishop-rome','psg-hippolytus-ref-9-7','supports','0.8')
note('note-hippolytus-rival-bishop','rationale','person','hippolytus-of-rome','clm-hippolytus-rival-bishop-rome','Hippolytus established a rival episcopal succession against Callistus I c. 217. Modeled as probable to reflect contested status.')
bishop('clm-gregory-illum-bishop-vagharshapat','gregory-the-illuminator','vagharshapat',301,331)
bishop('clm-john-zebedee-bishop-ephesus','john-son-of-zebedee','ephesus',70,100)
ev('clm-john-zebedee-bishop-ephesus','psg-irenaeus-ah-3-3-4','supports','0.8')
note('note-john-bishop-ephesus','rationale','person','john-son-of-zebedee','clm-john-zebedee-bishop-ephesus','The term bishop applied to John at Ephesus is anachronistic. Irenaeus and Polycrates name John as the apostolic authority. Modeled as probable.')
bishop('clm-peter-bishop-antioch','simon-peter','antioch',40,55)
note('note-peter-bishop-antioch','rationale','person','simon-peter','clm-peter-bishop-antioch','Patristic tradition names Peter as first bishop of Antioch. Formal episcopal terminology is anachronistic for Peter.')
bishop('clm-peter-bishop-rome','simon-peter','rome',58,64)
ev('clm-peter-bishop-rome','psg-irenaeus-ah-3-3-1','supports','0.8')
ev('clm-peter-bishop-rome','psg-1clement-5-1-7','supports','0.7')
note('note-peter-bishop-rome','rationale','person','simon-peter','clm-peter-bishop-rome','Irenaeus AH 3.3.1-3 names Peter as co-founder of the Roman church. Modeled as probable because monarchical episcopacy postdates Peter.')
bishop('clm-james-just-bishop-jerusalem','james-the-just','jerusalem',33,62)
ev('clm-james-just-bishop-jerusalem','psg-acts-15-1-29','supports','0.8')

# === ACTIVE_IN ===
def active(cid, p, pl, ys, ye, cert='attested'):
    if clm(cid,'person',p,'active_in','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

active('clm-peter-active-antioch','simon-peter','antioch',40,55)
active('clm-peter-active-rome','simon-peter','rome',58,64,'probable')
ev('clm-peter-active-rome','psg-1clement-5-1-7','supports','0.8')
ev('clm-peter-active-rome','psg-irenaeus-ah-3-3-1','supports','0.8')
active('clm-john-zebedee-active-ephesus','john-son-of-zebedee','ephesus',70,100,'probable')
ev('clm-john-zebedee-active-ephesus','psg-irenaeus-ah-3-3-4','supports','0.9')
active('clm-clement-rome-active-rome','clement-of-rome','rome',90,99)
active('clm-irenaeus-active-smyrna','irenaeus-of-lyons','smyrna',145,165,'probable')
active('clm-gregory-illum-active-vagharshapat','gregory-the-illuminator','vagharshapat',301,331,'probable')
active('clm-arius-active-alexandria','arius','alexandria',256,336)
active('clm-peter-active-jerusalem','simon-peter','jerusalem',30,44)
ev('clm-peter-active-jerusalem','psg-acts-1-13-14','supports','1.0')
active('clm-john-zebedee-active-jerusalem','john-son-of-zebedee','jerusalem',30,50)
ev('clm-john-zebedee-active-jerusalem','psg-acts-1-13-14','supports','1.0')
active('clm-andrew-active-jerusalem','andrew','jerusalem',30,40,'probable')
active('clm-james-zebedee-active-jerusalem','james-son-of-zebedee','jerusalem',30,44)
ev('clm-james-zebedee-active-jerusalem','psg-acts-12-1-2','supports','1.0')
active('clm-philip-apostle-active-jerusalem','philip-the-apostle','jerusalem',30,40,'probable')
active('clm-philip-apostle-active-galilee','philip-the-apostle','galilee',28,30)
active('clm-thomas-active-galilee','thomas','galilee',28,30,'probable')
active('clm-matthew-active-jerusalem','matthew-the-apostle','jerusalem',28,30,'probable')
active('clm-barnabas-active-jerusalem','barnabas','jerusalem',33,42)
active('clm-silas-active-jerusalem','silas','jerusalem',33,49)
ev('clm-silas-active-jerusalem','psg-acts-15-1-29','supports','0.9')
active('clm-silas-active-antioch','silas','antioch',49,50)
active('clm-silas-active-philippi','silas','philippi',49,50)
active('clm-timothy-active-corinth','timothy','corinth',50,55,'probable')
active('clm-timothy-active-thessalonica','timothy','thessalonica',49,50,'probable')
active('clm-timothy-active-rome','timothy','rome',60,65,'probable')
active('clm-titus-active-corinth','titus','corinth',55,57,'probable')
ev('clm-titus-active-corinth','psg-2cor-8-23','supports','0.8')
active('clm-apollos-active-corinth','apollos','corinth',53,55)
ev('clm-apollos-active-corinth','psg-1cor-3-5-6','supports','0.9')
active('clm-stephanas-active-corinth','stephanas','corinth',50,55)
active('clm-phoebe-active-rome','phoebe','rome',57,57,'probable')
active('clm-onesiphorus-active-rome','onesiphorus','rome',60,66)
active('clm-onesiphorus-active-ephesus','onesiphorus','ephesus',55,66,'probable')
active('clm-polycarp-active-ephesus','polycarp-of-smyrna','ephesus',110,140,'probable')
active('clm-hegesippus-active-corinth','hegesippus','corinth',155,170,'probable')
active('clm-origen-active-tyre','origen-of-alexandria','tyre',250,254,'probable')
active('clm-celerinus-active-carthage','celerinus','carthage',250,260)
active('clm-pontius-active-carthage','pontius-deacon','carthage',248,258)
active('clm-cornelius-pope-active-rome','cornelius-pope','rome',251,253)
active('clm-stephen-i-active-rome','stephen-i-pope','rome',254,257)
active('clm-lucius-i-active-rome','lucius-i-pope','rome',253,254)
active('clm-fabian-active-rome','fabian','rome',236,250)
active('clm-callistus-active-rome','callistus-i','rome',199,222)
active('clm-zephyrinus-active-rome','zephyrinus','rome',199,217)
active('clm-urban-i-active-rome','urban-i','rome',222,230,'probable')
active('clm-pontian-active-rome','pontian','rome',230,235)
active('clm-alexander-jerusalem-active-caesarea','alexander-of-jerusalem','caesarea',212,251,'probable')
active('clm-julius-africanus-active-rome','julius-africanus','rome',220,230,'probable')
active('clm-dionysius-alex-active-alexandria','dionysius-of-alexandria','alexandria',248,264)
active('clm-heraclas-active-alexandria','heraclas','alexandria',202,248)
active('clm-demetrius-active-alexandria','demetrius-of-alexandria','alexandria',189,232)
active('clm-polycrates-active-ephesus','polycrates-of-ephesus','ephesus',170,196)
active('clm-dionysius-corinth-active-corinth','dionysius-of-corinth','corinth',166,174)
active('clm-theophilus-antioch-active-antioch','theophilus-of-antioch','antioch',169,183)
active('clm-anicetus-active-rome','anicetus','rome',155,166,'probable')
active('clm-eleutherus-active-rome','eleutherus','rome',174,189,'probable')
active('clm-victor-active-rome','victor-i-of-rome','rome',189,199,'probable')
active('clm-ephrem-active-edessa','ephrem-the-syrian','edessa',363,373)
active('clm-firmilian-active-caesarea-capp','firmilian-of-caesarea','caesarea-cappadocia',230,268)
active('clm-beryllus-active-bostra','beryllus-of-bostra','bostra',220,250)
active('clm-papias-active-hierapolis','papias-of-hierapolis','hierapolis',95,130)
active('clm-melito-active-sardis','melito-of-sardis','sardis',155,180)
active('clm-john-mark-active-jerusalem','john-mark','jerusalem',33,46)
ev('clm-john-mark-active-jerusalem','psg-acts-12-25','supports','0.9')
active('clm-john-mark-active-antioch','john-mark','antioch',44,46)
active('clm-luke-active-antioch','luke-the-evangelist','antioch',44,50,'probable')
active('clm-luke-active-philippi','luke-the-evangelist','philippi',49,57,'probable')
active('clm-agabus-active-antioch','agabus','antioch',44,46)
active('clm-titus-active-jerusalem','titus','jerusalem',49,49,'probable')
active('clm-aristarchus-active-rome','aristarchus','rome',60,62,'probable')
active('clm-john-mark-active-rome','john-mark','rome',60,64,'probable')
active('clm-demas-active-rome','demas','rome',60,62,'probable')
active('clm-epaphras-active-rome','epaphras','rome',60,62,'probable')
active('clm-paul-active-jerusalem','paul','jerusalem',36,57)
ev('clm-paul-active-jerusalem','psg-acts-15-1-29','supports','0.9')
active('clm-paul-active-philippi','paul','philippi',49,57)
active('clm-paul-active-derbe','paul','derbe',46,49)
active('clm-paul-active-lystra','paul','lystra',46,49)
active('clm-barnabas-active-salamis','barnabas','salamis',46,46)
active('clm-paul-active-paphos','paul','paphos',46,46)
active('clm-paul-active-salamis','paul','salamis',46,46)
active('clm-stephanas-active-ephesus','stephanas','ephesus',54,55,'probable')
active('clm-tatian-active-edessa','tatian-the-assyrian','edessa',172,180,'probable')
note('note-tatian-return-east','rationale','person','tatian-the-assyrian','clm-tatian-active-edessa','After Justin\'s death Tatian returned East. The Diatessaron\'s Syriac composition localizes him at Edessa.')
active('clm-julius-africanus-active-alexandria','julius-africanus','alexandria',200,220,'probable')
active('clm-constantius-active-rome','constantius-ii','rome',337,350)
active('clm-shapur-active-seleucia','shapur-ii','seleucia-ctesiphon',309,379)

# === COWORKERS ===
def cowork(cid, p1, p2, ys, ye, ctx='', cert='attested'):
    if clm(cid,'person',p1,'coworker_of','entity','person',p2,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

cowork('clm-paul-coworker-stephanas','paul','stephanas',50,55,'corinth')
cowork('clm-paul-coworker-sosthenes','paul','sosthenes',51,55,'corinth','probable')
cowork('clm-paul-coworker-onesiphorus','paul','onesiphorus',60,66,'rome')
cowork('clm-barnabas-coworker-silas','barnabas','silas',46,49,'antioch','probable')
cowork('clm-peter-coworker-silas','simon-peter','silas',50,64,'','probable')
ev('clm-peter-coworker-silas','psg-1pet-5-13','supports','0.7','1 Peter 5:12 names Silvanus.')
cowork('clm-peter-coworker-paul','simon-peter','paul',34,55,'','attested')
ev('clm-peter-coworker-paul','psg-acts-15-1-29','supports','0.9')
cowork('clm-origen-coworker-ambrose','origen-of-alexandria','ambrose-of-alexandria',220,250)
cowork('clm-origen-coworker-firmilian','origen-of-alexandria','firmilian-of-caesarea',232,254,'caesarea','probable')
cowork('clm-peter-coworker-barnabas','simon-peter','barnabas',33,46,'jerusalem','probable')
cowork('clm-barnabas-coworker-lucius','barnabas','lucius-of-cyrene',46,46,'antioch')
ev('clm-barnabas-coworker-lucius','psg-acts-13-1','supports','0.8')
cowork('clm-barnabas-coworker-manaen','barnabas','manaen',46,46,'antioch')
ev('clm-barnabas-coworker-manaen','psg-acts-13-1','supports','0.8')
cowork('clm-barnabas-coworker-simeon-niger','barnabas','simeon-called-niger',46,46,'antioch')
ev('clm-barnabas-coworker-simeon-niger','psg-acts-13-1','supports','0.8')
cowork('clm-cyprian-coworker-celerinus','cyprian-of-carthage','celerinus',250,258,'carthage','probable')
cowork('clm-lucius-cyrene-coworker-paul','lucius-of-cyrene','paul',46,46,'antioch')
ev('clm-lucius-cyrene-coworker-paul','psg-acts-13-1','supports','0.8')
cowork('clm-manaen-coworker-paul','manaen','paul',46,46,'antioch')
ev('clm-manaen-coworker-paul','psg-acts-13-1','supports','0.8')
cowork('clm-simeon-niger-coworker-paul','simeon-called-niger','paul',46,46,'antioch')
ev('clm-simeon-niger-coworker-paul','psg-acts-13-1','supports','0.8')

# === TEACHERS ===
def teach(cid, t, s, ys, ye, cert='probable'):
    if clm(cid,'person',t,'teacher_of','entity','person',s,ys=ys,ye=ye,cert=cert): rev(cid)

teach('clm-barnabas-teacher-john-mark','barnabas','john-mark',44,48)
teach('clm-paul-teacher-of-luke','paul','luke-the-evangelist',50,64)
teach('clm-peter-teacher-of-mark','simon-peter','john-mark',50,64)
ev('clm-peter-teacher-of-mark','psg-1pet-5-13','supports','0.7','1 Pet 5:13 calls Mark my son.')
teach('clm-paul-teacher-of-apollos','paul','apollos',52,55)
teach('clm-paul-teacher-of-epaphras','paul','epaphras',52,62)
teach('clm-paul-teacher-of-onesimus','paul','onesimus',60,62)
teach('clm-paul-teacher-of-philemon','paul','philemon',50,62)
teach('clm-origen-teacher-of-julius-africanus','origen-of-alexandria','julius-africanus',220,240)

# === WRITE FILES ===
def append_tsv(filename, rows):
    if not rows: return
    path = os.path.join(DATA, filename)
    with open(path, 'r') as f:
        content = f.read()
    if content.endswith('\n\n'):
        content = content[:-1]
    elif not content.endswith('\n'):
        content += '\n'
    with open(path, 'w') as f:
        f.write(content)
        for row in rows:
            f.write(row + '\n')

append_tsv('claims.tsv', claims)
append_tsv('claim_evidence.tsv', evidence)
append_tsv('claim_reviews.tsv', reviews)
append_tsv('editor_notes.tsv', notes)

print(f"Part 1: {len(claims)} claims, {len(evidence)} evidence, {len(reviews)} reviews, {len(notes)} notes")
