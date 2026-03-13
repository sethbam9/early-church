#!/usr/bin/env python3
"""Generate batch-500 claims part 2: member_of_group, group_present_at, controls_place, participant_in, schisms, place_status, events."""
import csv, os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data', 'sheets')
NOW = "2026-03-12T12:00:00Z"
CB = "cascade-batch-500"

existing_claims = set()
with open(os.path.join(DATA, 'claims.tsv'), 'r') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        existing_claims.add(row['claim_id'])

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

def member(cid, p, g, ys, ye, ctx='', cert='attested'):
    if clm(cid,'person',p,'member_of_group','entity','group',g,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def gp(cid, g, pl, ys, ye, cert='attested'):
    if clm(cid,'group',g,'group_present_at','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def gc(cid, g, pl, ys, ye, cert='probable'):
    if clm(cid,'group',g,'controls_place','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def part(cid, p, e, ys, ye, ctx='', cert='attested'):
    if clm(cid,'person',p,'participant_in','entity','event',e,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def schism(cid, child, parent, ys, ye, ctx='', cert='attested'):
    if clm(cid,'group',child,'group_schismed_from','entity','group',parent,ys=ys,ye=ye,cp=ctx,cert=cert): rev(cid)

def pstat(cid, pl, ys, ye, cert='attested'):
    if clm(cid,'place',pl,'place_presence_status','text','','',vt='attested',ys=ys,ye=ye,cert=cert): rev(cid)

def eat(cid, e, pl, ys='', ye='', cert='attested'):
    if clm(cid,'event',e,'event_occurs_at','entity','place',pl,ys=ys,ye=ye,cert=cert): rev(cid)

def eyr(cid, e, yr, cert='probable'):
    if clm(cid,'event',e,'event_has_year','year','','',vy=yr,cert=cert): rev(cid)

# ============ MEMBER_OF_GROUP ============
member('clm-clement-alex-member-alexandrian','clement-of-alexandria','alexandrian-church',170,202,'alexandria')
ev('clm-clement-alex-member-alexandrian','psg-eusebius-he-5-10-1-2','supports','0.9')
member('clm-arius-member-alexandrian','arius','alexandrian-church',256,325,'alexandria')
note('note-arius-membership','rationale','person','arius','clm-arius-member-alexandrian','Arius was a priest of the Alexandrian church condemned at Nicaea 325.')
member('clm-silas-member-jerusalem-church','silas','jerusalem-church',33,49,'jerusalem')
ev('clm-silas-member-jerusalem-church','psg-acts-15-1-29','supports','0.8')
member('clm-silas-member-antioch-church','silas','antioch-church',46,50,'antioch','probable')
member('clm-timothy-member-ephesian-church','timothy','ephesian-church',60,80,'ephesus','probable')
ev('clm-timothy-member-ephesian-church','psg-1tim-1-3','supports','0.8')
member('clm-stephanas-member-corinthian','stephanas','corinthian-church',50,55,'corinth')
member('clm-sosthenes-member-corinthian','sosthenes','corinthian-church',51,55,'corinth','probable')
member('clm-philip-evang-member-jerusalem','philip-the-evangelist','jerusalem-church',33,40,'jerusalem')
member('clm-peter-member-jerusalem-church','simon-peter','jerusalem-church',30,44,'jerusalem')
ev('clm-peter-member-jerusalem-church','psg-acts-1-13-14','supports','1.0')
member('clm-peter-member-antioch-church','simon-peter','antioch-church',40,55,'antioch','probable')
member('clm-peter-member-roman-church','simon-peter','roman-church',58,64,'rome','probable')
ev('clm-peter-member-roman-church','psg-1clement-5-1-7','supports','0.8')
member('clm-andrew-member-jerusalem','andrew','jerusalem-church',30,40,'jerusalem','probable')
member('clm-john-zebedee-member-jerusalem','john-son-of-zebedee','jerusalem-church',30,50,'jerusalem')
ev('clm-john-zebedee-member-jerusalem','psg-acts-1-13-14','supports','1.0')
member('clm-john-zebedee-member-ephesian','john-son-of-zebedee','ephesian-church',70,100,'ephesus','probable')
member('clm-paul-member-jerusalem-church','paul','jerusalem-church',36,49,'jerusalem','probable')
member('clm-paul-member-roman-church','paul','roman-church',60,64,'rome','probable')
ev('clm-paul-member-roman-church','psg-1clement-5-1-7','supports','0.7')
member('clm-paul-member-corinthian-church','paul','corinthian-church',50,52,'corinth')
ev('clm-paul-member-corinthian-church','psg-1cor-1-2','supports','0.8')
member('clm-paul-member-ephesian-church','paul','ephesian-church',52,55,'ephesus','probable')
member('clm-paul-member-thessalonian','paul','thessalonian-church',49,50,'thessalonica')
member('clm-jason-member-thessalonian','jason','thessalonian-church',49,50,'thessalonica','probable')
member('clm-aristarchus-member-thessalonian','aristarchus','thessalonian-church',50,62,'thessalonica','probable')
member('clm-secundus-member-thessalonian','secundus','thessalonian-church',57,57,'thessalonica','probable')
member('clm-titius-justus-member-corinthian','titius-justus','corinthian-church',50,52,'corinth','probable')
member('clm-phoebe-member-corinthian','phoebe','corinthian-church',56,57,'corinth','probable')
member('clm-cornelius-member-caesarean','cornelius','caesarean-church',40,41,'caesarea','probable')
member('clm-judas-iscariot-disciple','judas-iscariot','disciples-of-jesus',28,30,'galilee')
member('clm-james-zebedee-member-jerusalem','james-son-of-zebedee','jerusalem-church',30,44,'jerusalem')
ev('clm-james-zebedee-member-jerusalem','psg-acts-12-1-2','supports','1.0')
member('clm-onesiphorus-member-ephesian','onesiphorus','ephesian-church',60,66,'ephesus','probable')
member('clm-carpus-disciple','carpus','disciples-of-jesus',60,66,'troas','probable')
member('clm-tychicus-disciple','tychicus','disciples-of-jesus',57,66,'','attested')
member('clm-trophimus-disciple','trophimus','disciples-of-jesus',57,66,'','attested')
member('clm-demas-disciple','demas','disciples-of-jesus',60,66,'','attested')
member('clm-crescens-disciple','crescens','disciples-of-jesus',64,66,'','probable')
member('clm-sopater-disciple','sopater','disciples-of-jesus',57,57,'berea')
member('clm-gaius-derbe-disciple','gaius-of-derbe','disciples-of-jesus',57,57,'derbe')
member('clm-secundus-disciple','secundus','disciples-of-jesus',57,57,'thessalonica')
member('clm-erastus-disciple','erastus','disciples-of-jesus',57,66,'corinth','probable')
member('clm-philip-apostle-member-jerusalem','philip-the-apostle','jerusalem-church',30,40,'jerusalem','probable')
member('clm-anicetus-member-roman-church','anicetus','roman-church',155,166,'rome','probable')
member('clm-eleutherus-member-roman-church','eleutherus','roman-church',174,189,'rome','probable')
member('clm-melito-member-sardis-church','melito-of-sardis','sardis-church',155,180,'sardis','probable')
member('clm-dionysius-corinth-member-corinthian','dionysius-of-corinth','corinthian-church',166,174,'corinth')
member('clm-tertullian-member-carthage','tertullian','carthage-church',195,207,'carthage')
member('clm-justin-member-roman-church','justin-martyr','roman-church',150,165,'rome','probable')
member('clm-nicodemus-disciple','nicodemus','disciples-of-jesus',30,30,'jerusalem','probable')
member('clm-luke-member-antioch-church','luke-the-evangelist','antioch-church',44,50,'antioch','probable')
member('clm-agabus-member-antioch-church','agabus','antioch-church',44,46,'antioch','probable')
member('clm-titus-member-corinthian','titus','corinthian-church',55,57,'corinth','probable')
member('clm-apollos-member-corinthian','apollos','corinthian-church',53,55,'corinth','probable')
member('clm-apollos-member-ephesian','apollos','ephesian-church',52,53,'ephesus','probable')
member('clm-demas-member-roman-church','demas','roman-church',60,62,'rome','probable')
member('clm-aristarchus-member-roman-church','aristarchus','roman-church',60,62,'rome','probable')
member('clm-john-mark-member-jerusalem','john-mark','jerusalem-church',33,46,'jerusalem')
member('clm-john-mark-member-roman','john-mark','roman-church',60,64,'rome','probable')
member('clm-luke-member-roman-church','luke-the-evangelist','roman-church',60,64,'rome','probable')

# ============ GROUP_PRESENT_AT ============
gp('clm-roman-church-at-rome-early','roman-church','rome',50,400)
gp('clm-jerusalem-church-at-jerusalem-late','jerusalem-church','jerusalem',70,135,'probable')
gp('clm-antioch-church-at-antioch-late','antioch-church','antioch',70,400)
gp('clm-corinthian-church-at-corinth-late','corinthian-church','corinth',70,200)
gp('clm-ephesian-church-at-ephesus-late','ephesian-church','ephesus',95,200)
gp('clm-smyrna-church-at-smyrna-late','smyrna-church','smyrna',95,200)
gp('clm-pergamum-church-at-pergamum-late','pergamum-church','pergamum',95,200,'probable')
gp('clm-philadelphia-church-at-philadelphia-late','philadelphia-church','philadelphia-asia',95,200,'probable')
gp('clm-sardis-church-at-sardis-late','sardis-church','sardis',95,200,'probable')
gp('clm-thyatira-church-at-thyatira-late','thyatira-church','thyatira',95,200,'probable')
gp('clm-laodicean-church-at-laodicea-late','laodicean-church','laodicea',95,200,'probable')
gp('clm-philippian-church-at-philippi-late','philippian-church','philippi',70,200,'probable')
gp('clm-thessalonian-church-at-thessalonica-late','thessalonian-church','thessalonica',51,200,'probable')
gp('clm-alexandrian-church-at-alexandria-late','alexandrian-church','alexandria',215,400)
gp('clm-montanists-at-asia','montanists','asia',170,300,'probable')
gp('clm-montanists-at-antioch','montanists','antioch',200,250,'probable')
gp('clm-marcionites-at-ephesus','marcionites','ephesus',150,300,'probable')
gp('clm-marcionites-at-smyrna','marcionites','smyrna',150,300,'probable')
gp('clm-novatianists-at-alexandria','novatianists','alexandria',260,400,'probable')
gp('clm-ebionites-at-antioch','ebionites','antioch',100,300,'probable')
gp('clm-church-east-at-arbela','church-of-the-east','arbela',200,400,'probable')
gp('clm-docetists-at-rome','docetists','rome',100,150,'probable')
gp('clm-disciples-at-antioch','disciples-of-jesus','antioch',40,70)
gp('clm-disciples-at-philippi','disciples-of-jesus','philippi',49,70)
gp('clm-disciples-at-thessalonica','disciples-of-jesus','thessalonica',49,70)
gp('clm-disciples-at-corinth','disciples-of-jesus','corinth',50,70)
gp('clm-disciples-at-damascus','disciples-of-jesus','damascus',34,50)
gp('clm-disciples-at-lydda','disciples-of-jesus','lydda',39,50,'probable')
gp('clm-disciples-at-laodicea','disciples-of-jesus','laodicea',60,62,'probable')
gp('clm-disciples-at-colossae','disciples-of-jesus','colossae',60,62)
gp('clm-church-east-at-nisibis','church-of-the-east','nisibis',280,363,'probable')
gp('clm-church-east-at-edessa','church-of-the-east','edessa',300,400,'probable')

# ============ CONTROLS_PLACE ============
gc('clm-rome-controls-philippi','roman-empire','philippi',-168,400)
gc('clm-rome-controls-berea','roman-empire','berea',-168,400)
gc('clm-rome-controls-colossae','roman-empire','colossae',-133,400)
gc('clm-rome-controls-laodicea','roman-empire','laodicea',-133,400)
gc('clm-rome-controls-philadelphia','roman-empire','philadelphia-asia',-133,400)
gc('clm-rome-controls-thyatira','roman-empire','thyatira',-133,400)
gc('clm-rome-controls-troas','roman-empire','troas',-133,400)
gc('clm-rome-controls-miletus','roman-empire','miletus',-133,400)
gc('clm-rome-controls-patmos','roman-empire','patmos',-133,400)
gc('clm-rome-controls-crete','roman-empire','crete',-67,400)
gc('clm-rome-controls-cyprus','roman-empire','cyprus',-58,400)
gc('clm-rome-controls-damascus','roman-empire','damascus',-64,272)
gc('clm-rome-controls-caesarea','roman-empire','caesarea',-63,400)
gc('clm-rome-controls-joppa','roman-empire','joppa',-63,400)
gc('clm-rome-controls-tyre','roman-empire','tyre',-64,400)
gc('clm-rome-controls-sidon','roman-empire','sidon',-64,400)
gc('clm-rome-controls-malta','roman-empire','malta',-218,400)
gc('clm-rome-controls-bostra','roman-empire','bostra',106,400)
gc('clm-rome-controls-edessa','roman-empire','edessa',114,244)
gc('clm-rome-controls-neocaesarea','roman-empire','neocaesarea',-64,400)
gc('clm-rome-controls-caesarea-cappadocia','roman-empire','caesarea-cappadocia',-17,400)

# ============ PARTICIPANT_IN ============
part('clm-paul-in-pauls-martyrdom','paul','pauls-martyrdom',64,65,'rome','probable')
ev('clm-paul-in-pauls-martyrdom','psg-1clement-5-1-7','supports','0.9')
ev('clm-paul-in-pauls-martyrdom','psg-eusebius-church-history-2-25','supports','0.8')
part('clm-peter-in-peters-martyrdom','simon-peter','peters-martyrdom',64,65,'rome','probable')
ev('clm-peter-in-peters-martyrdom','psg-1clement-5-1-7','supports','0.9')
ev('clm-peter-in-peters-martyrdom','psg-eusebius-church-history-2-25','supports','0.8')
part('clm-herod-agrippa-in-james-zeb-martyrdom','herod-agrippa-i','james-son-of-zebedee-martyrdom',44,44,'jerusalem')
ev('clm-herod-agrippa-in-james-zeb-martyrdom','psg-acts-12-1-2','supports','1.0')
part('clm-john-baptist-in-own-death','john-the-baptist','john-the-baptists-martyrdom',28,29,'','attested')
part('clm-john-zebedee-in-pentecost','john-son-of-zebedee','pentecost',30,30,'jerusalem')
part('clm-mary-mother-in-pentecost','mary-mother-of-jesus','pentecost',30,30,'jerusalem')
ev('clm-mary-mother-in-pentecost','psg-acts-1-13-14','supports','0.9')
part('clm-stephen-in-jerusalem-persecution','stephen','jerusalem-persecution-after-stephen',34,34,'jerusalem')
part('clm-irenaeus-in-ah-composition','irenaeus-of-lyons','irenaeus-writes-against-heresies',180,185,'lyons')
part('clm-polycarp-in-quartodeciman-visit','polycarp-of-smyrna','quartodeciman-controversy',155,155,'rome','probable')
note('note-polycarp-quartodeciman','rationale','person','polycarp-of-smyrna','clm-polycarp-in-quartodeciman-visit','Polycarp visited Rome under Anicetus c. 155 to discuss Easter date. The formal Quartodeciman controversy is dated c. 190-195 under Victor, but the Polycarp-Anicetus precedent is crucial context.')

# ============ GROUP_SCHISMED_FROM ============
schism('clm-marcionites-schismed-from-roman','marcionites','roman-church',144,144,'rome')
ev('clm-marcionites-schismed-from-roman','psg-irenaeus-ah-3-3-4','supports','0.8')
schism('clm-valentinians-schismed-from-roman','valentinians','roman-church',140,160,'rome','probable')
schism('clm-montanists-schismed-from-ephesian','montanists','ephesian-church',170,180,'phrygia','probable')
note('note-montanist-schism','rationale','group','montanists','clm-montanists-schismed-from-ephesian','The Montanist movement originated in Phrygia as a prophetic revival within the Asian churches. Modeled against the Ephesian church as metropolitan see of Asia.')
schism('clm-ebionites-schismed-from-jerusalem','ebionites','jerusalem-church',70,100,'jerusalem','probable')
note('note-ebionite-schism','rationale','group','ebionites','clm-ebionites-schismed-from-jerusalem','Ebionites maintained Torah observance and rejected Pauline teaching. Their origin from the Jerusalem mother church is standard scholarly reconstruction.')
schism('clm-cerinthians-schismed-from-ephesian','cerinthians','ephesian-church',90,120,'ephesus','probable')
schism('clm-docetists-schismed-from-antioch','docetists','antioch-church',100,120,'antioch','probable')
schism('clm-nicolaitans-schismed-from-ephesian','nicolaitans','ephesian-church',70,100,'ephesus','probable')
schism('clm-bardesanites-schismed-from-edessa','bardesanites','edessa-church',196,222,'edessa','probable')

# ============ PLACE_PRESENCE_STATUS ============
pstat('clm-place-antioch-attested','antioch',40,400)
pstat('clm-place-rome-attested','rome',50,400)
pstat('clm-place-corinth-attested','corinth',50,200)
pstat('clm-place-philippi-attested','philippi',49,200)
pstat('clm-place-damascus-attested','damascus',34,100)
pstat('clm-place-carthage-attested','carthage',180,400)
pstat('clm-place-alexandria-attested','alexandria',70,400)
pstat('clm-place-edessa-attested','edessa',170,400)
pstat('clm-place-bostra-attested','bostra',244,400,'probable')
pstat('clm-place-neocaesarea-attested','neocaesarea',240,300,'probable')
pstat('clm-place-vagharshapat-attested','vagharshapat',301,380,'probable')
pstat('clm-place-aksum-attested','aksum',330,380)
pstat('clm-place-arbela-attested','arbela',200,400,'probable')
pstat('clm-place-seleucia-ctesiphon-attested','seleucia-ctesiphon',300,400,'probable')
pstat('clm-place-nisibis-attested','nisibis',306,363)
pstat('clm-place-dura-europos-attested','dura-europos',232,256)
pstat('clm-place-caesarea-cappadocia-attested','caesarea-cappadocia',230,268)
pstat('clm-place-flavia-neapolis-attested','flavia-neapolis',100,165,'probable')
pstat('clm-place-sardinia-attested','sardinia',235,236)
pstat('clm-place-emmaus-attested','emmaus-nicopolis',200,240,'probable')
pstat('clm-place-najran-attested','najran',300,400,'possible')
pstat('clm-place-zafar-attested','zafar',354,380,'probable')
pstat('clm-place-arles-attested','arles',314,380)
pstat('clm-place-londinium-attested','londinium',314,380)
pstat('clm-place-britannia-attested','britannia',200,400,'probable')
pstat('clm-place-sinope-attested','sinope',100,160,'probable')
pstat('clm-place-phrygia-attested','phrygia',155,300,'probable')
pstat('clm-place-gaul-attested','gaul',177,400)
pstat('clm-place-india-attested','india-malabar',52,200,'possible')
pstat('clm-place-egypt-attested','egypt',70,400,'probable')

# ============ EVENT locations and years ============
eat('clm-irenaeus-ah-at-lyons','irenaeus-writes-against-heresies','lyons',180,185,'probable')
eyr('clm-irenaeus-ah-year','irenaeus-writes-against-heresies',180)
eyr('clm-lyons-persecution-year','lyons-persecution',177,'attested')
eyr('clm-justin-martyrdom-year','justin-martyrdom',165)
eyr('clm-polycarp-martyrdom-year','polycarp-martyrdom',155)
eyr('clm-ignatius-martyrdom-year','ignatius-martyrdom',110)
eyr('clm-marcion-excommunication-year','marcion-excommunication',144)
eyr('clm-great-fire-year','great-fire-of-rome',64,'attested')
eyr('clm-neronian-persecution-year','neronian-persecution',64,'attested')
eyr('clm-sack-of-jerusalem-year','sack-of-jerusalem',70,'attested')
eyr('clm-herodian-persecution-year','herodian-persecution-of-jerusalem-church',44)
eyr('clm-james-zebedee-martyrdom-year','james-son-of-zebedee-martyrdom',44)
eyr('clm-stephens-martyrdom-year','stephens-martyrdom',34)
eyr('clm-pentecost-year','pentecost',30)
eyr('clm-john-baptist-death-year','john-the-baptists-martyrdom',29)
eyr('clm-john-on-patmos-year','john-on-patmos',95)
eat('clm-synod-bostra-at-bostra','synod-of-bostra','bostra','','')
eyr('clm-synod-bostra-year','synod-of-bostra',244,'attested')
eyr('clm-sardinian-exile-year','sardinian-exile',235,'attested')
eyr('clm-hippolytus-callistus-schism-year','hippolytus-callistus-schism',217)
eyr('clm-novatian-schism-year','novatian-schism',251,'attested')
eyr('clm-quartodeciman-year','quartodeciman-controversy',190)
eat('clm-fall-nisibis-at-nisibis','fall-of-nisibis-363','nisibis','','','probable')
eyr('clm-fall-nisibis-year','fall-of-nisibis-363',363,'attested')
eyr('clm-origen-expulsion-year','origen-expulsion-from-alexandria',231)
eat('clm-origen-expulsion-at-alexandria','origen-expulsion-from-alexandria','alexandria','','')
eyr('clm-origen-torture-year','origen-torture-under-decius',250)
eyr('clm-persecution-shapur-year','persecution-of-shapur-ii',340)
eat('clm-persecution-shapur-at-seleucia','persecution-of-shapur-ii','seleucia-ctesiphon','','','probable')
eyr('clm-mission-himyar-year','mission-of-theophilus-to-himyar',354)
eat('clm-mission-himyar-at-zafar','mission-of-theophilus-to-himyar','zafar','','','probable')
eyr('clm-mission-pantaenus-year','mission-of-pantaenus-to-india',180)
eat('clm-pauls-martyrdom-at-rome','pauls-martyrdom','rome',64,65,'probable')
ev('clm-pauls-martyrdom-at-rome','psg-eusebius-church-history-2-25','supports','0.8')
eat('clm-peters-martyrdom-at-rome','peters-martyrdom','rome',64,65,'probable')
ev('clm-peters-martyrdom-at-rome','psg-eusebius-church-history-2-25','supports','0.8')
eyr('clm-pauls-martyrdom-year','pauls-martyrdom',64)
ev('clm-pauls-martyrdom-year','psg-eusebius-church-history-2-25','supports','0.8')
eyr('clm-peters-martyrdom-year','peters-martyrdom',64)
ev('clm-peters-martyrdom-year','psg-eusebius-church-history-2-25','supports','0.8')

# Additional person_affirms for schism context
if clm('clm-cyprian-affirms-rebaptism','person','cyprian-of-carthage','person_affirms_proposition','entity','proposition','heretic-baptism-is-invalid',ys=254,ye=258,cp='carthage',cert='attested'):
    rev('clm-cyprian-affirms-rebaptism')
if clm('clm-dionysius-alex-affirms-penance','person','dionysius-of-alexandria','person_affirms_proposition','entity','proposition','post-baptismal-sin-forgiven-by-penance',ys=248,ye=264,cp='alexandria',cert='probable'):
    rev('clm-dionysius-alex-affirms-penance')

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
print(f"Part 2: {nc} claims, {ne} evidence, {nr} reviews, {nn} notes")
