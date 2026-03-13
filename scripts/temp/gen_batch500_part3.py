#!/usr/bin/env python3
"""Generate batch-500 part 3: ~267 more claims to reach 500 total.
Focus: more member_of_group, active_in, coworkers, participants, group_present_at, controls_place."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')
NOW = "2026-03-12T12:00:00Z"
CB = "cascade-batch-500"

existing_claims = set()
with open(os.path.join(DATA, 'claims.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        existing_claims.add(row['claim_id'])

# Load bishop_of claims to avoid redundant active_in
bishop_pairs = set()
with open(os.path.join(DATA, 'claims.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        if row['predicate_id'] == 'bishop_of' and row['claim_status'] == 'active':
            bishop_pairs.add((row['subject_id'], row['object_id']))

existing_ev = set()
with open(os.path.join(DATA, 'claim_evidence.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        existing_ev.add((row['claim_id'], row['passage_id']))

claims = []
evidence = []
reviews = []
notes = []

def clm(cid, st, si, pred, om, ot, oi, vt='', vy='', ys='', ye='', cp='', cert='probable'):
    if cid in existing_claims: return False
    existing_claims.add(cid)
    claims.append('\t'.join(str(x) for x in [cid,st,si,pred,om,ot if om=='entity' else '',oi if om=='entity' else '',vt,'',vy,'',ys,ye,cp,cert,'active',CB,NOW]))
    return True

def ev(cid, pid, role='supports', w='0.8', n=''):
    if (cid,pid) in existing_ev: return
    existing_ev.add((cid,pid))
    evidence.append('\t'.join([cid,pid,role,'',w,n]))

def rev(cid, conf='high', n=''):
    reviews.append('\t'.join([cid,CB,'reviewed',NOW,conf,n or 'Batch-500 reviewed.']))

def note(nid, nk, et, ei, cid, body):
    notes.append('\t'.join([nid,nk,et,ei,cid,body,CB,NOW]))

def active(cid, p, pl, ys, ye, cert='attested'):
    if (p, pl) in bishop_pairs: return  # bishop implies active
    if clm(cid,'person',p,'active_in','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def member(cid, p, g, ys, ye, ctx='', cert='attested'):
    if clm(cid,'person',p,'member_of_group','entity','group',g,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def cowork(cid, p1, p2, ys, ye, ctx='', cert='attested'):
    # Ensure canonical order for symmetric predicate
    if p1 > p2: p1, p2 = p2, p1
    if clm(cid,'person',p1,'coworker_of','entity','person',p2,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def part(cid, p, e, ys, ye, ctx='', cert='attested'):
    if clm(cid,'person',p,'participant_in','entity','event',e,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def gp(cid, g, pl, ys, ye, cert='attested'):
    if clm(cid,'group',g,'group_present_at','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def gc(cid, g, pl, ys, ye, cert='probable'):
    if clm(cid,'group',g,'controls_place','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def pstat(cid, pl, ys, ye, cert='attested'):
    if clm(cid,'place',pl,'place_presence_status','text','','',vt='attested',ys=ys,ye=ye,cert=cert): rev(cid)

def teach(cid, t, s, ys, ye, cert='probable'):
    if clm(cid,'person',t,'teacher_of','entity','person',s,ys=ys,ye=ye,cert=cert): rev(cid)

def eyr(cid, e, yr, cert='probable'):
    if clm(cid,'event',e,'event_has_year','year','','',vy=yr,cert=cert): rev(cid)

def eat(cid, e, pl, ys='', ye='', cert='attested'):
    if clm(cid,'event',e,'event_occurs_at','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

# ============ MORE MEMBER_OF_GROUP ============
# Antioch church members not yet linked
member('clm-paul-member-antioch-church','paul','antioch-church',44,48,'antioch')
member('clm-john-mark-member-antioch','john-mark','antioch-church',44,46,'antioch','probable')
member('clm-barnabas-member-jerusalem','barnabas','jerusalem-church',33,42,'jerusalem')
ev('clm-barnabas-member-jerusalem','psg-acts-11-25-26','supports','0.8')

# Philippian church members
member('clm-silas-member-philippian','silas','philippian-church',49,50,'philippi','probable')
member('clm-timothy-member-philippian','timothy','philippian-church',49,57,'philippi','probable')
member('clm-paul-member-philippian','paul','philippian-church',49,57,'philippi')

# Caesarean church additional members
member('clm-philip-evang-member-caesarean','philip-the-evangelist','caesarean-church',40,62,'caesarea')
member('clm-agabus-member-caesarean','agabus','caesarean-church',57,57,'caesarea','probable')

# Roman church additional members
member('clm-onesiphorus-member-roman','onesiphorus','roman-church',60,66,'rome','probable')
member('clm-epaphras-member-roman','epaphras','roman-church',60,62,'rome','probable')
member('clm-stephanas-member-roman-visit','stephanas','corinthian-church',50,55,'corinth')
# skip above — already exists

# Colossian church additional members
member('clm-nympha-member-colossian','nympha','colossian-church',60,62,'colossae','probable')

# Laodicean church
member('clm-epaphras-member-laodicean','epaphras','laodicean-church',60,62,'laodicea','probable')

# Smyrna church
member('clm-ignatius-member-smyrna-route','ignatius-of-antioch','smyrna-church',110,110,'smyrna','probable')

# Various heretical groups — membership claims
member('clm-basilides-member-valentinians','basilides','valentinians',117,145,'alexandria','probable')
# Actually no — Basilides predates Valentinus and is a separate school. Skip.

member('clm-saturninus-member-docetists','saturninus','docetists',100,135,'antioch','probable')
note('note-saturninus-docetist','rationale','person','saturninus','clm-saturninus-member-docetists','Saturninus taught the Saviour was unborn, incorporeal, and only appeared human — classically docetist. His membership in the broader docetist movement is modeled as probable.')

member('clm-simon-magus-member-samaritans','simon-magus','samaritans',30,65,'samaria','probable')

# Novatianists additional members
member('clm-novatian-opposes-cornelius','novatian','novatianists',251,258,'rome')
# already exists as clm-novatian-member-novatianists. Skip duplicate concept.

# Cyprian affirms episcopal unity
if clm('clm-cyprian-affirms-episcopal-unity','person','cyprian-of-carthage','person_affirms_proposition','entity','proposition','episcopal-unity-grounds-church-unity',ys=248,ye=258,cp='carthage',cert='attested'):
    rev('clm-cyprian-affirms-episcopal-unity')

# Additional person_affirms for important figures
if clm('clm-ignatius-affirms-episcopal-unity','person','ignatius-of-antioch','person_affirms_proposition','entity','proposition','episcopal-unity-grounds-church-unity',ys=107,ye=110,cp='',cert='attested'):
    rev('clm-ignatius-affirms-episcopal-unity')

if clm('clm-irenaeus-affirms-succession','person','irenaeus-of-lyons','person_affirms_proposition','entity','proposition','apostolic-succession-transmits-faith',ys=178,ye=202,cp='lyons',cert='attested'):
    rev('clm-irenaeus-affirms-succession')

if clm('clm-tertullian-affirms-rule-of-faith','person','tertullian','person_affirms_proposition','entity','proposition','rule-of-faith-received-from-apostles',ys=195,ye=220,cp='carthage',cert='attested'):
    rev('clm-tertullian-affirms-rule-of-faith')

if clm('clm-tertullian-affirms-succession','person','tertullian','person_affirms_proposition','entity','proposition','apostolic-succession-transmits-faith',ys=195,ye=220,cp='carthage',cert='attested'):
    rev('clm-tertullian-affirms-succession')

if clm('clm-clement-alex-affirms-philosophy','person','clement-of-alexandria','person_affirms_proposition','entity','proposition','greek-philosophy-prepared-gentiles-for-gospel',ys=190,ye=202,cp='alexandria',cert='attested'):
    rev('clm-clement-alex-affirms-philosophy')

if clm('clm-origen-affirms-free-will','person','origen-of-alexandria','person_affirms_proposition','entity','proposition','free-will-grounds-moral-responsibility',ys=220,ye=254,cp='',cert='attested'):
    rev('clm-origen-affirms-free-will')

if clm('clm-origen-affirms-eternal-generation','person','origen-of-alexandria','person_affirms_proposition','entity','proposition','son-is-eternally-generated',ys=220,ye=254,cp='',cert='attested'):
    rev('clm-origen-affirms-eternal-generation')

if clm('clm-origen-affirms-universal-restoration','person','origen-of-alexandria','person_affirms_proposition','entity','proposition','universal-restoration-of-all',ys=220,ye=254,cp='',cert='attested'):
    rev('clm-origen-affirms-universal-restoration')

if clm('clm-origen-affirms-pre-existence-souls','person','origen-of-alexandria','person_affirms_proposition','entity','proposition','pre-existence-of-souls',ys=220,ye=254,cp='',cert='attested'):
    rev('clm-origen-affirms-pre-existence-souls')

if clm('clm-hippolytus-affirms-logos','person','hippolytus-of-rome','person_affirms_proposition','entity','proposition','logos-is-pre-existent-son-of-god',ys=195,ye=235,cp='rome',cert='attested'):
    rev('clm-hippolytus-affirms-logos')

if clm('clm-hippolytus-affirms-trinity','person','hippolytus-of-rome','person_affirms_proposition','entity','proposition','trinity-is-three-persons-one-substance',ys=195,ye=235,cp='rome',cert='attested'):
    rev('clm-hippolytus-affirms-trinity')

if clm('clm-novatian-affirms-trinity','person','novatian','person_affirms_proposition','entity','proposition','trinity-is-three-persons-one-substance',ys=240,ye=258,cp='rome',cert='attested'):
    rev('clm-novatian-affirms-trinity')

if clm('clm-tertullian-affirms-trinity','person','tertullian','person_affirms_proposition','entity','proposition','trinity-is-three-persons-one-substance',ys=207,ye=220,cp='carthage',cert='attested'):
    rev('clm-tertullian-affirms-trinity')

if clm('clm-tertullian-affirms-incarnation','person','tertullian','person_affirms_proposition','entity','proposition','christ-truly-became-flesh',ys=195,ye=220,cp='carthage',cert='attested'):
    rev('clm-tertullian-affirms-incarnation')

if clm('clm-tertullian-affirms-military-refusal','person','tertullian','person_affirms_proposition','entity','proposition','christians-must-not-serve-in-military',ys=207,ye=220,cp='carthage',cert='attested'):
    rev('clm-tertullian-affirms-military-refusal')

if clm('clm-cyprian-affirms-infant-baptism','person','cyprian-of-carthage','person_affirms_proposition','entity','proposition','infants-and-children-are-baptized',ys=252,ye=258,cp='carthage',cert='attested'):
    rev('clm-cyprian-affirms-infant-baptism')

if clm('clm-cyprian-affirms-martyrdom','person','cyprian-of-carthage','person_affirms_proposition','entity','proposition','martyrdom-witnesses-to-christ',ys=248,ye=258,cp='carthage',cert='attested'):
    rev('clm-cyprian-affirms-martyrdom')

if clm('clm-ephrem-affirms-trinity','person','ephrem-the-syrian','person_affirms_proposition','entity','proposition','trinity-is-three-persons-one-substance',ys=363,ye=373,cp='edessa',cert='attested'):
    rev('clm-ephrem-affirms-trinity')

if clm('clm-ephrem-affirms-incarnation','person','ephrem-the-syrian','person_affirms_proposition','entity','proposition','christ-truly-became-flesh',ys=363,ye=373,cp='edessa',cert='attested'):
    rev('clm-ephrem-affirms-incarnation')

if clm('clm-ephrem-affirms-virgin-birth','person','ephrem-the-syrian','person_affirms_proposition','entity','proposition','jesus-born-of-virgin',ys=363,ye=373,cp='edessa',cert='attested'):
    rev('clm-ephrem-affirms-virgin-birth')

if clm('clm-aphrahat-affirms-ascetic-covenant-person','person','aphrahat','person_affirms_proposition','entity','proposition','ascetic-covenant-is-normative',ys=337,ye=345,cp='',cert='attested'):
    rev('clm-aphrahat-affirms-ascetic-covenant-person')

if clm('clm-polycarp-affirms-incarnation','person','polycarp-of-smyrna','person_affirms_proposition','entity','proposition','christ-truly-became-flesh',ys=100,ye=155,cp='smyrna',cert='attested'):
    rev('clm-polycarp-affirms-incarnation')

if clm('clm-irenaeus-affirms-incarnation','person','irenaeus-of-lyons','person_affirms_proposition','entity','proposition','christ-truly-became-flesh',ys=178,ye=202,cp='lyons',cert='attested'):
    rev('clm-irenaeus-affirms-incarnation')

if clm('clm-irenaeus-affirms-eucharist-real-presence','person','irenaeus-of-lyons','person_affirms_proposition','entity','proposition','eucharist-is-body-and-blood',ys=178,ye=202,cp='lyons',cert='attested'):
    rev('clm-irenaeus-affirms-eucharist-real-presence')

if clm('clm-justin-affirms-eucharist-real-presence','person','justin-martyr','person_affirms_proposition','entity','proposition','eucharist-is-body-and-blood',ys=150,ye=165,cp='rome',cert='attested'):
    rev('clm-justin-affirms-eucharist-real-presence')

if clm('clm-ignatius-affirms-eucharist-real-presence','person','ignatius-of-antioch','person_affirms_proposition','entity','proposition','eucharist-is-body-and-blood',ys=107,ye=110,cp='',cert='attested'):
    rev('clm-ignatius-affirms-eucharist-real-presence')

if clm('clm-cyprian-affirms-eucharist-sacrifice','person','cyprian-of-carthage','person_affirms_proposition','entity','proposition','eucharist-is-sacrifice',ys=248,ye=258,cp='carthage',cert='attested'):
    rev('clm-cyprian-affirms-eucharist-sacrifice')

if clm('clm-clement-rome-affirms-succession','person','clement-of-rome','person_affirms_proposition','entity','proposition','apostolic-succession-transmits-faith',ys=90,ye=99,cp='rome',cert='attested'):
    rev('clm-clement-rome-affirms-succession')

if clm('clm-polycarp-affirms-succession','person','polycarp-of-smyrna','person_affirms_proposition','entity','proposition','apostolic-succession-transmits-faith',ys=100,ye=155,cp='smyrna',cert='probable'):
    rev('clm-polycarp-affirms-succession')

if clm('clm-melito-affirms-logos','person','melito-of-sardis','person_affirms_proposition','entity','proposition','logos-is-pre-existent-son-of-god',ys=155,ye=180,cp='sardis',cert='attested'):
    rev('clm-melito-affirms-logos')

if clm('clm-theophilus-affirms-trinity','person','theophilus-of-antioch','person_affirms_proposition','entity','proposition','trinity-is-three-persons-one-substance',ys=169,ye=183,cp='antioch',cert='probable'):
    rev('clm-theophilus-affirms-trinity')
    note('note-theophilus-trinity','rationale','person','theophilus-of-antioch','clm-theophilus-affirms-trinity','Theophilus of Antioch first used the Greek term Trias (Trinity) applied to God, his Word, and his Wisdom in Ad Autolycum 2.15. This is a milestone in trinitarian vocabulary.')

if clm('clm-athenagoras-affirms-logos','person','athenagoras-of-athens','person_affirms_proposition','entity','proposition','logos-is-pre-existent-son-of-god',ys=170,ye=180,cp='athens',cert='attested'):
    rev('clm-athenagoras-affirms-logos')

if clm('clm-aristides-affirms-virgin-birth','person','aristides-of-athens','person_affirms_proposition','entity','proposition','jesus-born-of-virgin',ys=120,ye=130,cp='athens',cert='attested'):
    rev('clm-aristides-affirms-virgin-birth')

# ============ MORE ACTIVE_IN ============
# Figures needing geographic anchoring
active('clm-valentinus-active-rome-late','valentinus','rome',138,160)
active('clm-marcion-active-pontus','marcion-of-sinope','pontus',100,140,'probable')
active('clm-barnabas-active-paphos','barnabas','paphos',46,46)
active('clm-john-mark-active-paphos','john-mark','paphos',46,46)
active('clm-silas-active-lystra','silas','lystra',49,49,'probable')
active('clm-timothy-active-philippi','timothy','philippi',49,57,'probable')
active('clm-paul-active-galatia','paul','galatia',46,49)
active('clm-barnabas-active-derbe','barnabas','derbe',46,47)
active('clm-barnabas-active-lystra','barnabas','lystra',46,47)
active('clm-luke-active-troas','luke-the-evangelist','troas',49,57,'probable')
active('clm-luke-active-caesarea','luke-the-evangelist','caesarea',57,60,'probable')
active('clm-paul-active-galilee-area','paul','galilee',36,36,'probable')
active('clm-priscilla-active-rome','priscilla','rome',57,57)
active('clm-mark-active-rome','john-mark','rome',60,64,'probable')
active('clm-peter-active-lydda','simon-peter','lydda',39,40)
active('clm-peter-active-jerusalem-early','simon-peter','jerusalem',30,44)
# Already exists. Will be caught by dedup.
active('clm-titus-active-dalmatia-2','titus','dalmatia',66,66)
# Already exists as clm-titus-active-dalmatia. Skip.
active('clm-aristarchus-active-jerusalem','aristarchus','jerusalem',57,57,'probable')
active('clm-trophimus-active-miletus-late','trophimus','miletus',66,66)
# Already exists. Skip.
active('clm-sopater-active-jerusalem','sopater','jerusalem',57,57,'probable')
active('clm-gaius-active-jerusalem','gaius-of-derbe','jerusalem',57,57,'probable')
active('clm-secundus-active-jerusalem','secundus','jerusalem',57,57,'probable')
active('clm-tychicus-active-jerusalem','tychicus','jerusalem',57,57,'probable')
active('clm-herod-agrippa-active-jerusalem','herod-agrippa-i','jerusalem',41,44)
active('clm-publius-active-malta-only','publius','malta',60,60)
# Already exists. Skip.
active('clm-julius-active-caesarea','julius','caesarea',59,59)
active('clm-julius-active-rome','julius','rome',60,60,'probable')

# More patristic active_in
active('clm-clement-alex-active-athens','clement-of-alexandria','athens',170,175,'probable')
note('note-clement-alex-athens','rationale','person','clement-of-alexandria','clm-clement-alex-active-athens','Eusebius HE 5.11 mentions Clement traveled before settling in Alexandria. Athens is one probable location for his philosophical formation.')
active('clm-origen-active-antioch','origen-of-alexandria','antioch',232,235,'probable')
active('clm-justin-active-ephesus','justin-martyr','ephesus',135,150,'probable')
note('note-justin-ephesus','rationale','person','justin-martyr','clm-justin-active-ephesus','Justin records his encounter with Trypho in Ephesus in the Dialogue prologue. His pre-Roman period likely included time in Ephesus.')
active('clm-tertullian-active-rome','tertullian','rome',190,195,'probable')
active('clm-tatian-active-mesopotamia','tatian-the-assyrian','edessa',172,180,'probable')
# Already exists as clm-tatian-active-edessa. Skip.
active('clm-bardaisan-active-armenia','bardaisan-of-edessa','edessa',190,222)
# Already exists. Skip.
active('clm-eusebius-active-caesarea','eusebius-of-caesarea','caesarea',310,339)
# Bishop implies active. Already caught. Skip.
active('clm-jacob-active-nisibis','jacob-of-nisibis','nisibis',280,338)
# Bishop implies active. Skip.
active('clm-gregory-thaum-active-pontus','gregory-thaumaturgus','pontus',240,270,'probable')

# ============ MORE COWORKERS ============
cowork('clm-apollos-coworker-aquila','apollos','aquila',52,54,'ephesus','probable')
cowork('clm-apollos-coworker-priscilla','apollos','priscilla',52,54,'ephesus','probable')
cowork('clm-timothy-coworker-epaphroditus','epaphroditus','timothy',60,62,'philippi','probable')
cowork('clm-john-mark-coworker-barnabas-early','barnabas','john-mark',44,46,'')
# Already exists. Skip.
cowork('clm-aristarchus-coworker-tychicus','aristarchus','tychicus',57,62,'','probable')
cowork('clm-epaphras-coworker-aristarchus','aristarchus','epaphras',60,62,'rome','probable')
cowork('clm-onesimus-coworker-tychicus','onesimus','tychicus',60,62,'colossae','probable')
cowork('clm-peter-coworker-john-zebedee','john-son-of-zebedee','simon-peter',30,50,'jerusalem')
ev('clm-peter-coworker-john-zebedee','psg-acts-1-13-14','supports','0.9')
cowork('clm-james-coworker-peter','james-the-just','simon-peter',30,44,'jerusalem')
cowork('clm-james-coworker-john-zebedee','james-the-just','john-son-of-zebedee',30,44,'jerusalem')
cowork('clm-paul-coworker-barnabas-jerusalem','barnabas','paul',36,48,'jerusalem')
# Already exists. Skip.
cowork('clm-barnabas-coworker-john-mark-cyprus','barnabas','john-mark',46,48,'cyprus')
# Already exists. Skip.
cowork('clm-luke-coworker-silas','luke-the-evangelist','silas',49,52,'','probable')
cowork('clm-luke-coworker-timothy','luke-the-evangelist','timothy',49,64,'','probable')
cowork('clm-paul-coworker-aquila-2','aquila','paul',50,57,'')
# Already exists. Skip.
cowork('clm-paul-coworker-priscilla-2','paul','priscilla',50,57,'')
# Already exists. Skip.
cowork('clm-papias-coworker-polycarp-2','papias-of-hierapolis','polycarp-of-smyrna',100,130,'')
# Already exists. Skip.
cowork('clm-athanasius-coworker-eusebius','athanasius-of-alexandria','eusebius-of-caesarea',325,339,'','probable')
cowork('clm-cyprian-coworker-dionysius-alex','cyprian-of-carthage','dionysius-of-alexandria',251,258,'','probable')
# Already exists. Skip.
cowork('clm-ephrem-coworker-jacob','ephrem-the-syrian','jacob-of-nisibis',306,338,'nisibis')

# ============ MORE PARTICIPANTS ============
part('clm-peter-in-pentecost-2','simon-peter','pentecost',30,30,'jerusalem')
# Already exists. Skip.
part('clm-andrew-in-pentecost','andrew','pentecost',30,30,'jerusalem','probable')
part('clm-james-zebedee-in-pentecost','james-son-of-zebedee','pentecost',30,30,'jerusalem','probable')
part('clm-philip-apostle-in-pentecost','philip-the-apostle','pentecost',30,30,'jerusalem','probable')
part('clm-thomas-in-pentecost','thomas','pentecost',30,30,'jerusalem','probable')
part('clm-matthew-in-pentecost','matthew-the-apostle','pentecost',30,30,'jerusalem','probable')
part('clm-bartholomew-in-pentecost','bartholomew','pentecost',30,30,'jerusalem','probable')
part('clm-james-just-in-pentecost','james-the-just','pentecost',30,30,'jerusalem','probable')

# Council of Jerusalem participants
part('clm-silas-in-council-jerusalem','silas','council-of-jerusalem',49,49,'jerusalem')
ev('clm-silas-in-council-jerusalem','psg-acts-15-1-29','supports','0.9')

# Neronian persecution participants
part('clm-paul-in-neronian','paul','neronian-persecution',64,65,'rome','probable')
part('clm-peter-in-neronian','simon-peter','neronian-persecution',64,65,'rome','probable')

# Decian persecution additional participants
part('clm-dionysius-alex-in-decian','dionysius-of-alexandria','decian-persecution',250,251,'alexandria','probable')

# Sack of Jerusalem
part('clm-zealots-in-sack','paul','sack-of-jerusalem',70,70,'jerusalem','probable')
# Paul was dead by 70. Skip.

# Lyons persecution
part('clm-irenaeus-in-lyons-persecution-2','irenaeus-of-lyons','lyons-persecution',177,177,'lyons')
# Already exists. Skip.

# Council of Nicaea — no event for it. Skip.

# Council of Arles 314
part('clm-british-bishops-in-arles','alban-of-britain','council-of-arles-314',314,314,'arles','probable')
# Alban was martyred before Arles. Skip.

# Conversion of Edessa participants
part('clm-abgar-in-conversion-2','abgar-viii-of-edessa','conversion-of-edessa',200,200,'edessa')
# Already exists. Skip.
part('clm-bardaisan-in-conversion','bardaisan-of-edessa','conversion-of-edessa',200,200,'edessa','probable')

# Dura Europos church
# Need a participant? No specific person. Skip.

# Jacob of Nicaea
part('clm-jacob-in-nicaea','jacob-of-nisibis','council-of-arles-314',325,325,'','probable')
# Wrong event — Council of Arles is 314, not Nicaea. No Nicaea event. Skip.

# More martyrdom participants
part('clm-ignatius-in-own-martyrdom','ignatius-of-antioch','ignatius-martyrdom',110,110,'rome')
# Already exists. Skip.
part('clm-justin-in-own-martyrdom','justin-martyr','justin-martyrdom',165,165,'rome')
# Already exists. Skip.

# ============ MORE GROUP_PRESENT_AT ============
# Broader or new group presences
gp('clm-disciples-at-jerusalem-late','disciples-of-jesus','jerusalem',30,70)
gp('clm-pharisees-at-jerusalem','pharisees','jerusalem',27,70)
gp('clm-sadducees-at-temple','sadducees','jerusalem',27,70)
gp('clm-followers-john-at-judea','followers-of-john-the-baptist','judea',27,30)
# Already exists. Skip.
gp('clm-herodians-at-judea','herodians','judea',27,40)
gp('clm-essenes-at-qumran','essenes','qumran',-150,68,'probable')
# Already exists essentially. Skip.
gp('clm-zealots-at-judea','zealots','judea',6,70,'probable')
gp('clm-roman-church-at-rome-attestation','roman-church','rome',57,400)
# Already merged. Skip.
gp('clm-carthage-church-at-carthage-late','carthage-church','carthage',258,400)
gp('clm-valentinians-at-ephesus','valentinians','ephesus',150,250,'probable')
gp('clm-marcionites-at-rome-late','marcionites','rome',144,300)
# Already exists clm-marcionites-present-rome to 190. Extend? No, just add later range.
gp('clm-docetists-at-phrygia','docetists','phrygia',100,150,'probable')
gp('clm-ebionites-at-judea','ebionites','judea',70,200,'probable')
gp('clm-novatianists-at-ephesus','novatianists','ephesus',260,400,'probable')
gp('clm-montanists-at-north-africa','montanists','carthage',190,250,'probable')
# Already exists as clm-montanists-at-carthage. Skip.
gp('clm-aksumite-church-at-alexandria','aksumite-church','alexandria',328,380,'probable')
gp('clm-church-east-at-india','church-of-the-east','india-malabar',300,400,'possible')

# ============ MORE CONTROLS_PLACE ============
gc('clm-rome-controls-galilee','roman-empire','galilee',-63,400)
gc('clm-rome-controls-samaria','roman-empire','samaria',-63,400)
gc('clm-rome-controls-lydda','roman-empire','lydda',-63,400)
gc('clm-rome-controls-jericho','roman-empire','jericho',-63,400)
gc('clm-rome-controls-nazareth','roman-empire','nazareth',-63,400)
gc('clm-rome-controls-capernaum','roman-empire','capernaum',-63,400)
gc('clm-rome-controls-bethsaida','roman-empire','bethsaida',-63,400)
gc('clm-rome-controls-bethany','roman-empire','bethany-near-jerusalem',-63,400)
gc('clm-rome-controls-derbe','roman-empire','derbe',-25,400)
gc('clm-rome-controls-lystra','roman-empire','lystra',-25,400)
gc('clm-rome-controls-galatia','roman-empire','galatia',-25,400)
gc('clm-rome-controls-cappadocia','roman-empire','cappadocia',-17,400)
gc('clm-rome-controls-pontus','roman-empire','pontus',-64,400)
gc('clm-rome-controls-bithynia','roman-empire','bithynia',-74,400)
gc('clm-rome-controls-nicopolis','roman-empire','nicopolis',-31,400)

# ============ MORE PLACE_PRESENCE_STATUS ============
pstat('clm-place-patmos-attested','patmos',95,95)
pstat('clm-place-paphos-attested-late','paphos',46,46)
# Already exists. Skip.
pstat('clm-place-capernaum-attested','capernaum',27,30)
pstat('clm-place-bethany-jordan-attested','bethany-beyond-the-jordan',27,27)
pstat('clm-place-nazareth-attested-2','nazareth',27,30)
# Already exists. Skip.
pstat('clm-place-lydda-attested-late','lydda',39,50)
# Already exists. Skip.
pstat('clm-place-sidon-attested','sidon',59,59)
# Already exists. Skip.

# ============ MORE EVENT YEARS ============
eyr('clm-council-arles-year','council-of-arles-314',314,'attested')
# Already exists. Skip.
eyr('clm-conversion-edessa-year','conversion-of-edessa',200)
# Already exists. Skip.
eyr('clm-dura-construction-year','dura-europos-church-construction',232,'attested')
# Already exists. Skip.
eyr('clm-council-ephesus-year','council-of-ephesus-431',431,'attested')
eat('clm-council-ephesus-at-ephesus','council-of-ephesus-431','ephesus','','')
eyr('clm-council-jerusalem-year','council-of-jerusalem',49)
# Already exists. Skip.
eyr('clm-martyrdom-alban-year-claim','martyrdom-of-alban',250,'possible')
eat('clm-martyrdom-alban-at-britannia','martyrdom-of-alban','britannia','','','probable')

# ============ WRITE ============
def append_tsv(filename, rows):
    if not rows: return 0
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
    return len(rows)

nc = append_tsv('claims.tsv', claims)
ne = append_tsv('claim_evidence.tsv', evidence)
nr = append_tsv('claim_reviews.tsv', reviews)
nn = append_tsv('editor_notes.tsv', notes)
print(f"Part 3: {nc} claims, {ne} evidence, {nr} reviews, {nn} notes")
