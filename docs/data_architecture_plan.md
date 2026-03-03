# Early Christianity Atlas — Data Architecture & Feature Design Plan
**Version 2.0** | Fully revised based on codebase audit + web research

---

## 1. Vision

The app is a **decade-driven relational atlas** of early Christianity (AD 33–800). Every entity — city, person, event, work, doctrine, archaeological site — is anchored to one or more decade buckets and connected to every other entity through a typed edge graph. Selecting anything illuminates everything related to it across the entire map and all panels.

**Five new feature pillars:**
1. **Key Events Timeline** — councils, persecutions, synods, martyrdoms
2. **Correspondence Web** — who discipled whom, who wrote to whom, which decade
3. **Doctrine Timeline** — topic-driven view with direct quotes / historical attributions
4. **Location Chronicle** — click a city → full vertical timeline from founding to present decade
5. **Archaeology Layer** — churches, catacombs, baptisteries, monasteries on the map

**Core constraint:** The domain layer is fully independent of the data source. All data access goes through TypeScript repository interfaces. Swapping TSV for a database requires only new repository implementations — zero UI changes.

---

## 2. Decade-First Data Model

Every entity that changes over time carries a `decade_bucket` (primary) plus optional `decade_start` / `decade_end`. All repository query methods default to the current `activeDecade` from the global store.

```
Decade bucket values: 33, 40, 50, 60, ... 800 (same as current final.tsv)
Decade range: decade → decade + 9 (e.g., 110 → "110–119")
```

Entities that don't change over time (a doctrine concept, a person's identity) still link to decade-scoped **edges** and **quotes** so they are correctly filtered.

---

## 3. Data Files Overview

| File | Role | Status |
|---|---|---|
| `final.tsv` | City × Decade presence records | Existing — unchanged |
| `data/people.tsv` | Person entities | **New** |
| `data/events.tsv` | Historical events | **New** |
| `data/works.tsv` | Written works | **New** |
| `data/doctrines.tsv` | Doctrine/topic entities | **New** |
| `data/quotes.tsv` | Direct quotes & attributions | **New** |
| `data/archaeology.tsv` | Physical sites | **New** (migrates `starred_pois.json`) |
| `data/edges.tsv` | All relationships between entities | **New** |

---

## 4. Entity Schemas

### 4.1 `data/people.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | Stable unique ID (e.g., `ignatius-of-antioch`) |
| `name_display` | string | Display name |
| `name_alt` | string (`;`-list) | Alternative names / spellings |
| `birth_year` | int\|null | Approximate birth year AD |
| `death_year` | int\|null | Approximate death year AD |
| `death_type` | enum | `natural` \| `martyr` \| `unknown` |
| `roles` | string (`;`-list) | `bishop` \| `apologist` \| `theologian` \| `emperor` \| `heretic` \| `monk` \| `deacon` \| `presbyter` \| `layperson` |
| `city_of_origin_id` | slug\|null | City where born / primarily from |
| `apostolic_connection` | string | Free text (e.g., "disciple of John the Apostle") |
| `description` | string | 2–4 sentence biography |
| `wikipedia_url` | url\|null | Canonical Wikipedia link |
| `citations` | string (`;`-list) | Source URLs |

### 4.2 `data/events.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | e.g., `council-of-nicaea-325` |
| `name_display` | string | Display name |
| `event_type` | enum | `council` \| `persecution` \| `synod` \| `martyrdom` \| `schism` \| `political` \| `liturgical` \| `missionary` \| `other` |
| `year_start` | int | Year event began |
| `year_end` | int\|null | Year ended (null = point event) |
| `decade_bucket` | int | Primary decade for UI placement |
| `city_id` | slug\|null | Where held (links to city record) |
| `city_ancient` | string | Ancient city name (for display if no match) |
| `region` | string | Broader region label |
| `key_figure_ids` | string (`;`-list) | Person IDs of main participants |
| `description` | string | What happened |
| `significance` | string | Why it matters |
| `outcome` | string | Result / decision |
| `citations` | string (`;`-list) | Source URLs |

### 4.3 `data/works.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | e.g., `ignatius-to-smyrnaeans` |
| `title_display` | string | Display title |
| `author_id` | slug\|null | Person ID (null = anonymous) |
| `author_name_display` | string | Display name (for anonymous: "Unknown") |
| `year_written_earliest` | int | Earliest plausible date |
| `year_written_latest` | int | Latest plausible date |
| `decade_bucket` | int | Primary decade |
| `work_type` | enum | `letter` \| `apology` \| `treatise` \| `homily` \| `canon` \| `creed` \| `chronicle` \| `inscription` \| `rule` \| `gospel` \| `other` |
| `city_written_id` | slug\|null | Where authored |
| `city_recipient_ids` | string (`;`-list) | City IDs of recipients |
| `language` | string | Greek \| Latin \| Syriac \| Coptic \| Armenian \| other |
| `description` | string | What the work covers |
| `significance` | string | Doctrinal / historical importance |
| `modern_edition_url` | url\|null | Link to modern text |
| `citations` | string (`;`-list) | Source URLs |

### 4.4 `data/doctrines.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | e.g., `real-presence` |
| `name_display` | string | Display name |
| `category` | enum | `christology` \| `ecclesiology` \| `soteriology` \| `sacraments` \| `mariology` \| `eschatology` \| `liturgy` \| `praxis` \| `canon` \| `other` |
| `description` | string | What the doctrine is about |
| `first_attested_year` | int\|null | Earliest known attestation year |
| `first_attested_work_id` | slug\|null | Work where first attested |
| `controversy_level` | enum | `low` \| `medium` \| `high` |
| `resolution` | string\|null | How controversy resolved, if applicable |
| `citations` | string (`;`-list) | Source URLs |

### 4.5 `data/quotes.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | e.g., `ignatius-smyrnaeans-6-real-presence` |
| `doctrine_id` | slug | Links to doctrine |
| `text` | string | The actual quote |
| `source_type` | enum | `primary` \| `secondary` \| `modern_scholar` |
| `author_id` | slug\|null | Person ID (primary sources) |
| `author_name` | string | Display name (for modern scholars) |
| `work_id` | slug\|null | Work ID for primary sources |
| `work_reference` | string | e.g., "Letter to Smyrnaeans 6.2" |
| `year` | int | Approximate year of writing |
| `decade_bucket` | int | Primary decade |
| `stance` | enum | `affirming` \| `condemning` \| `neutral` \| `questioning` \| `developing` |
| `notes` | string | Contextual explanation |
| `citations` | string (`;`-list) | Source URLs |

### 4.6 `data/archaeology.tsv`

| Column | Type | Description |
|---|---|---|
| `id` | slug | e.g., `dura-europos-house-church` |
| `name_display` | string | Display name |
| `site_type` | enum | `house-church` \| `basilica` \| `catacomb` \| `baptistery` \| `monastery` \| `inscription` \| `martyrium` \| `mosaic` \| `other` |
| `city_id` | slug\|null | Links to city in final.tsv |
| `city_ancient` | string | Ancient city name |
| `lat` | float\|null | Latitude |
| `lon` | float\|null | Longitude |
| `location_precision` | enum | `exact` \| `approx_city` \| `region_only` \| `unknown` |
| `year_start` | int | Construction / occupation start |
| `year_end` | int\|null | Destruction / abandonment (null = extant) |
| `decade_bucket_start` | int | Primary decade for timeline |
| `description` | string | What the site is |
| `significance` | string | Historical / theological importance |
| `discovery_notes` | string | Excavation / discovery context |
| `current_status` | enum | `extant` \| `destroyed` \| `partially_preserved` \| `unknown` |
| `uncertainty` | string | Dating/interpretation caveats |
| `citations` | string (`;`-list) | Source URLs |

### 4.7 `data/edges.tsv` — The Relational Graph

This is the single most important file. Every relationship between any two entities is one row.

| Column | Type | Description |
|---|---|---|
| `id` | slug | Unique edge ID |
| `source_type` | enum | `person` \| `event` \| `work` \| `doctrine` \| `city` \| `archaeology` |
| `source_id` | slug | ID of source entity |
| `relationship` | string | Typed relationship (see vocabulary below) |
| `target_type` | enum | Same enum as source_type |
| `target_id` | slug | ID of target entity |
| `decade_start` | int\|null | Decade when relationship begins (null = always) |
| `decade_end` | int\|null | Decade when relationship ends (null = open) |
| `weight` | int 1–5 | Significance (5 = most important) |
| `notes` | string | Contextual explanation |
| `citations` | string (`;`-list) | Source URLs |

**Relationship vocabulary by source type:**

```
person → city:        born_in | died_in | bishop_of | visited | wrote_from
                      martyred_in | exiled_to | fled_to | active_in
person → person:      disciple_of | discipled | corresponded_with | debated_with
                      condemned_by | ordained_by | co_worker_with | succeeded
person → work:        authored | condemned | translated | quoted_in
person → event:       attended | led | presided | condemned_at | martyred_at
person → doctrine:    affirmed | developed | opposed | first_articulated
person → archaeology: buried_at | commissioned

work → city:          written_in | sent_to
work → doctrine:      affirms | condemns | first_mentions | develops
work → event:         produced_at | references_event
work → person:        addressed_to | cites

event → city:         held_in | affected | occurred_in
event → doctrine:     defined | condemned | debated | affirmed
event → person:       condemned | exiled | honored | martyred

doctrine → doctrine:  precedes | opposes | develops_from

archaeology → city:   located_in
archaeology → person: dedicated_to | burial_site_of | built_by
archaeology → event:  built_after | commissioned_at | destroyed_at
```

---

## 5. Template Data (Sample Rows)

### 5.1 `data/people.tsv` — sample rows

```tsv
id	name_display	name_alt	birth_year	death_year	death_type	roles	city_of_origin_id	apostolic_connection	description	wikipedia_url	citations
ignatius-of-antioch	Ignatius of Antioch	Theophorus	50	107	martyr	bishop;theologian	0040-antioch-antakya	Disciple of John the Apostle and Polycarp	Third bishop of Antioch whose seven letters written en route to martyrdom in Rome are the earliest clear attestation of monarchical episcopacy, the Eucharist as the "flesh of Christ," and the term "Catholic Church."	https://en.wikipedia.org/wiki/Ignatius_of_Antioch	https://www.newadvent.org/fathers/0109.htm
polycarp-of-smyrna	Polycarp of Smyrna		69	155	martyr	bishop;theologian	0090-smyrna-izmir	Disciple of John the Apostle; ordained by apostles	Bishop of Smyrna whose Martyrdom account is the earliest dated example of a saint's feast, and whose Letter to the Philippians witnesses early canon formation.	https://en.wikipedia.org/wiki/Polycarp	https://www.newadvent.org/fathers/0136.htm
justin-martyr	Justin Martyr	Justin the Philosopher	100	165	martyr	apologist;theologian	0100-flavia-neapolis-nablus	Converted by an elderly Christian; no direct apostolic link	Samaritan-born philosopher who wrote the first systematic Christian apologetics to the Roman emperor, including the first detailed description of Sunday Eucharist and baptism.	https://en.wikipedia.org/wiki/Justin_Martyr	https://www.newadvent.org/fathers/0126.htm
irenaeus-of-lyon	Irenaeus of Lyon		130	202	martyr	bishop;theologian	0130-smyrna-izmir	Disciple of Polycarp who was disciple of John	Bishop of Lyon whose Against Heresies systematically refutes Gnosticism and establishes apostolic succession as the doctrinal rule of faith.	https://en.wikipedia.org/wiki/Irenaeus	https://www.newadvent.org/fathers/0103.htm
origen-of-alexandria	Origen of Alexandria	Origen Adamantius	184	253	natural	theologian;presbyter	0180-alexandria-alexandria	Student of Clement of Alexandria	The most prolific early Christian scholar; produced the Hexapla, homilies on nearly every biblical book, and De Principiis — the first systematic Christian theology.	https://en.wikipedia.org/wiki/Origen	https://www.newadvent.org/fathers/0412.htm
eusebius-of-caesarea	Eusebius of Caesarea		260	339	natural	bishop;chronicler	0260-caesarea-maritima-qesarya	Student of Pamphilus of Caesarea	Bishop of Caesarea who wrote the Ecclesiastical History, the primary surviving chronicle of the first three centuries of Christianity; attended Nicaea.	https://en.wikipedia.org/wiki/Eusebius	https://www.newadvent.org/fathers/2501.htm
athanasius-of-alexandria	Athanasius of Alexandria	Athanasius the Great	296	373	natural	bishop;theologian	0290-alexandria-alexandria	Student of Alexander of Alexandria	Bishop of Alexandria who championed Nicene orthodoxy through five exiles; his Festal Letter 367 is the first canonical list matching the modern New Testament.	https://en.wikipedia.org/wiki/Athanasius_of_Alexandria	https://www.newadvent.org/fathers/2806.htm
```

### 5.2 `data/events.tsv` — sample rows

```tsv
id	name_display	event_type	year_start	year_end	decade_bucket	city_id	city_ancient	region	key_figure_ids	description	significance	outcome	citations
apostolic-council-jerusalem-49	Apostolic Council of Jerusalem	council	49	49	40	0040-jerusalem-jerusalem	Jerusalem	Palestine	james-the-just;peter;paul	The Jerusalem Council convened to decide whether Gentile converts required circumcision and observance of Mosaic law.	Established the principle that Gentile Christians were not bound by Jewish ceremonial law; foundational for the Gentile mission.	Gentile converts exempted from circumcision; dietary guidelines issued (Acts 15 decree).	https://biblehub.com/acts/15.htm;https://www.britannica.com/event/Council-of-Jerusalem
destruction-of-jerusalem-70	Destruction of Jerusalem	political	70	70	70	0070-jerusalem-jerusalem	Jerusalem	Palestine	simeon-bar-cleophas	Roman general Titus besieged and destroyed Jerusalem and the Temple following the Jewish revolt.	Ended the Jerusalem church's geographic center; scattered the Jewish-Christian community; ended Temple-based Judaism.	Jerusalem Christians fled to Pella; Jewish-Christian community reconstituted at reduced size.	https://www.newadvent.org/fathers/250103.htm
persecution-of-decius	Persecution under Decius	persecution	249	251	240	null	Roman Empire	Empire-wide	decius-emperor	Emperor Decius ordered all citizens to sacrifice to Roman gods and obtain certificates (libelli). Refusal led to imprisonment and execution.	First empire-wide systematic persecution; produced the lapsed (lapsi) controversy and shaped later penitential theology.	Widespread apostasy and martyrdoms; Cyprian of Carthage in exile; controversy over readmitting lapsed.	https://www.britannica.com/event/Decian-persecution
council-of-nicaea-325	First Council of Nicaea	council	325	325	320	0320-nicaea-iznik	Nicaea	Bithynia	constantine-i;alexander-of-alexandria;arius;athanasius-of-alexandria;hosius-of-cordoba	Convened by Constantine I with ~300 bishops to resolve the Arian controversy regarding the nature of Christ.	First ecumenical council; produced the Nicene Creed; established canonical principles; set Easter calculation rules.	Arian position condemned; homoousios affirmed; Arius exiled; Nicene Creed promulgated.	https://www.britannica.com/event/First-Council-of-Nicaea-325;https://www.newadvent.org/fathers/3801.htm
edict-of-milan-313	Edict of Milan	political	313	313	310	null	Milan	Western Empire	constantine-i;licinius	Constantine I and Licinius issued a letter granting religious toleration throughout the empire.	Ended official persecution of Christians; enabled public church construction and the Constantinian transformation of Christianity.	Christianity and all religions granted legal status; confiscated church property returned.	https://www.britannica.com/topic/Edict-of-Milan
martyrdom-of-polycarp-155	Martyrdom of Polycarp	martyrdom	155	155	150	0150-smyrna-izmir	Smyrna	Asia Minor	polycarp-of-smyrna	Bishop Polycarp of Smyrna was arrested, tried, and burned alive at the stadium; the earliest datable Christian martyrdom account.	The Martyrdom of Polycarp established the template for later hagiography and the martyr cult; first dated feast of a saint.	Polycarp's relics preserved; annual commemoration established; account circulated widely.	https://www.newadvent.org/fathers/0102.htm
```

### 5.3 `data/works.tsv` — sample rows

```tsv
id	title_display	author_id	author_name_display	year_written_earliest	year_written_latest	decade_bucket	work_type	city_written_id	city_recipient_ids	language	description	significance	modern_edition_url	citations
ignatius-to-smyrnaeans	Letter to the Smyrnaeans	ignatius-of-antioch	Ignatius of Antioch	107	107	100	letter	null	0090-smyrna-izmir	Greek	Written en route to martyrdom in Rome; addresses docetism directly and uses the term "Catholic Church" for the first time.	First extant use of "Catholic Church"; clearest early statement of the real bodily resurrection of Christ; attestation of Eucharist as "flesh of Christ."	https://www.newadvent.org/fathers/0109.htm	https://www.newadvent.org/fathers/0109.htm
didache	Didache (Teaching of the Twelve Apostles)	null	Anonymous (Syrian community)	80	110	80	canon	null	null	Greek	Early church order document covering baptism, fasting, Eucharist, itinerant prophets, and the Lord's Prayer.	Earliest description of Eucharistic prayer and Sunday assembly practice; key source for early liturgy and church order.	https://www.newadvent.org/fathers/0714.htm	https://www.newadvent.org/fathers/0714.htm
justin-first-apology	First Apology	justin-martyr	Justin Martyr	150	155	150	apology	0150-rome-rome	null	Greek	Addressed to Emperor Antoninus Pius defending Christianity as philosophically superior to paganism; includes detailed description of Sunday Eucharist and baptism.	First systematic description of Sunday Eucharist; earliest description of baptism rite; defense of Christian ethics.	https://www.newadvent.org/fathers/0126.htm	https://www.newadvent.org/fathers/0126.htm
irenaeus-against-heresies	Against Heresies (Adversus Haereses)	irenaeus-of-lyon	Irenaeus of Lyon	180	185	180	treatise	0180-lugdunum-lyon	null	Greek (Latin translation)	Five-book refutation of Gnostic systems, particularly Valentinianism; establishes the rule of faith and apostolic succession.	Most complete early refutation of Gnosticism; establishes apostolic succession doctrine; preserves Gnostic texts now lost.	https://www.newadvent.org/fathers/0103.htm	https://www.newadvent.org/fathers/0103.htm
pliny-trajan-correspondence	Pliny-Trajan Correspondence (Ep. 10.96–97)	null	Pliny the Younger	112	112	110	letter	null	null	Latin	Roman governor Pliny asks Emperor Trajan how to handle Christians in Bithynia; describes early Christian practice and the emperor's response.	The earliest non-Christian eyewitness account of Christian worship; attests Sunday hymn-singing, communal meal, and oath-taking.	https://www.tertullian.org/fathers/pliny_younger_letters_10_part2.htm	https://www.tertullian.org/fathers/pliny_younger_letters_10_part2.htm
nicene-creed-325	Nicene Creed	null	Council of Nicaea	325	325	320	creed	0320-nicaea-iznik	null	Greek	The dogmatic statement produced by the First Council of Nicaea defining Christ as homoousios (consubstantial) with the Father.	Foundational creedal statement of Trinitarian orthodoxy; still used across Catholic, Orthodox, and most Protestant traditions.	https://www.newadvent.org/cathen/11049a.htm	https://www.newadvent.org/cathen/11049a.htm
```

### 5.4 `data/doctrines.tsv` — sample rows

```tsv
id	name_display	category	description	first_attested_year	first_attested_work_id	controversy_level	resolution	citations
real-presence	Real Presence (Eucharist)	sacraments	The belief that Christ's body and blood are truly, really, and substantially present in the Eucharist, not merely symbolically.	107	ignatius-to-smyrnaeans	medium	Affirmed consistently in patristic sources; later controversy over mode of presence led to transubstantiation (1215) vs. Reformed memorialist views.	https://www.newadvent.org/cathen/05573a.htm
monarchical-episcopacy	Monarchical Episcopacy	ecclesiology	The church governance model where a single bishop holds supreme authority in a local church, distinct from the college of presbyters.	107	ignatius-to-smyrnaeans	medium	Became the universal model by mid-2nd century; debated in Protestant Reformation.	https://www.newadvent.org/cathen/05277a.htm
apostolic-succession	Apostolic Succession	ecclesiology	The doctrine that bishops are the direct successors of the apostles in an unbroken chain of ordination conferring teaching authority.	180	irenaeus-against-heresies	medium	Affirmed by Catholic, Orthodox traditions; rejected by most Protestant traditions.	https://www.newadvent.org/cathen/01641b.htm
theotokos	Mary as Theotokos (God-bearer)	mariology	The title affirming that Mary bore God incarnate, not merely a human Jesus later united with divinity (Nestorianism).	431	null	high	Defined at Council of Ephesus (431); rejected by Church of the East (Nestorians).	https://www.newadvent.org/cathen/14708a.htm
logos-christology	Logos Christology	christology	The identification of Christ with the divine Logos of Greek philosophy, pre-existent and active in creation and revelation.	150	justin-first-apology	low	Became standard in Greek patristic theology; refined through Nicene and Chalcedonian definitions.	https://www.newadvent.org/cathen/09328a.htm
homoousios	Homoousios (Consubstantial)	christology	The affirmation that the Son is of the same substance (ousia) as the Father, rejecting Arian subordinationism.	325	nicene-creed-325	high	Affirmed at Nicaea (325); contested through Arian controversy until Constantinople (381).	https://www.newadvent.org/cathen/07402b.htm
eucharistic-sacrifice	Eucharist as Sacrifice	sacraments	The doctrine that the Eucharist is a true sacrifice, not merely a commemorative meal, related to the sacrifice of the Cross.	96	null	medium	Affirmed in Didache; developed by Cyprian; formally defined by Council of Trent (1545).	https://www.newadvent.org/cathen/14341a.htm
altar-terminology	Altar (thusiasterion) in Worship	liturgy	The use of the term "altar" (thusiasterion) for the table of the Eucharist, implying sacrificial character of Christian worship.	107	ignatius-to-smyrnaeans	low	Universal in patristic usage; Reformers replaced with "table" terminology.	https://www.newadvent.org/cathen/01359b.htm
```

### 5.5 `data/quotes.tsv` — sample rows

```tsv
id	doctrine_id	text	source_type	author_id	author_name	work_id	work_reference	year	decade_bucket	stance	notes	citations
ignatius-smyrn-6-real-presence	real-presence	"Take note of those who hold heterodox opinions on the grace of Jesus Christ which has come to us, and see how contrary their opinions are to the mind of God. They abstain from the Eucharist and from prayer, because they confess not the Eucharist to be the flesh of our Saviour Jesus Christ, which suffered for our sins."	primary	ignatius-of-antioch	Ignatius of Antioch	ignatius-to-smyrnaeans	Letter to the Smyrnaeans 6.2	107	100	affirming	Ignatius equates denial of the real presence with heresy; one of the earliest and clearest patristic attestations of the doctrine.	https://www.newadvent.org/fathers/0109.htm
ignatius-smyrn-8-altar	altar-terminology	"Let that be deemed a proper Eucharist, which is [administered] either by the bishop, or by one to whom he has entrusted it. Wherever the bishop shall appear, there let the multitude [of the people] also be; even as, wherever Jesus Christ is, there is the Catholic Church. It is not lawful without the bishop either to baptize or to celebrate a love-feast; but whatsoever he shall approve of, that is also pleasing to God, so that everything that is done may be secure and valid."	primary	ignatius-of-antioch	Ignatius of Antioch	ignatius-to-smyrnaeans	Letter to the Smyrnaeans 8.1	107	100	affirming	Uses "thusiasterion" (altar) language; connects Eucharist directly to bishop; earliest clear statement of Catholic Church terminology.	https://www.newadvent.org/fathers/0109.htm
justin-apol-66-real-presence	real-presence	"For not as common bread and common drink do we receive these; but in like manner as Jesus Christ our Saviour, having been made flesh by the Word of God, had both flesh and blood for our salvation, so likewise have we been taught that the food which is blessed by the prayer of His word... is the flesh and blood of that Jesus who was made flesh."	primary	justin-martyr	Justin Martyr	justin-first-apology	First Apology 66	150	150	affirming	Justin explicitly distinguishes the Eucharistic bread from ordinary food; foundational for real presence doctrine.	https://www.newadvent.org/fathers/0126.htm
didache-14-eucharistic-sacrifice	eucharistic-sacrifice	"But every Lord's day do ye gather yourselves together, and break bread, and give thanksgiving after having confessed your transgressions, that your sacrifice may be pure."	primary	null	Anonymous	didache	Didache 14.1	100	90	affirming	Uses "sacrifice" (thusia) for the Sunday Eucharist; earliest post-apostolic attestation of sacrificial language for the Lord's Supper.	https://www.newadvent.org/fathers/0714.htm
irenaeus-ah-4-18-eucharistic-sacrifice	eucharistic-sacrifice	"He took from among creation that which is bread, and gave thanks, saying, 'This is My body.' The cup likewise, which is from among the creation to which we belong, He confessed to be His blood, and taught the new oblation of the new covenant... offering to God the first-fruits of His own created things."	primary	irenaeus-of-lyon	Irenaeus of Lyon	irenaeus-against-heresies	Against Heresies 4.17.5	180	180	affirming	Irenaeus explicitly calls the Eucharist the "new oblation" and links it to Malachi 1:11; key patristic proof for sacrificial interpretation.	https://www.newadvent.org/fathers/0103418.htm
pliny-hymn-christo-worship	logos-christology	"They were in the habit of meeting on a certain fixed day before it was light, when they sang in alternate verses a hymn to Christ, as to a god."	primary	null	Pliny the Younger	pliny-trajan-correspondence	Letters 10.96	112	110	affirming	Non-Christian Roman eyewitness to early Christian worship treating Christ as divine; important external attestation.	https://www.tertullian.org/fathers/pliny_younger_letters_10_part2.htm
```

### 5.6 `data/archaeology.tsv` — sample rows (migrating `starred_pois.json`)

```tsv
id	name_display	site_type	city_id	city_ancient	lat	lon	location_precision	year_start	year_end	decade_bucket_start	description	significance	discovery_notes	current_status	uncertainty	citations
dura-europos-house-church	Dura-Europos House Church	house-church	null	Dura-Europos	34.7494	40.7288	approx_city	230	256	230	Domestic structure adapted as a worship space, including a dedicated baptistery with early Christian wall paintings including Adam and Eve and the Good Shepherd.	Oldest known purpose-built Christian worship space with iconographic program; baptistery predates all known basilica-type churches.	Excavated 1920s–1930s by Yale/French teams; baptistery panels now at Yale University Art Gallery.	destroyed	Exact date of adaptation debated within mid-3rd century horizon.	https://en.wikipedia.org/wiki/Dura-Europos_church;https://www.britannica.com/place/Dura-Europos
holy-sepulchre-jerusalem	Church of the Holy Sepulchre	basilica	0320-jerusalem-jerusalem	Jerusalem	31.7785	35.2296	exact	335	null	330	Imperial Constantinian basilica complex enclosing traditional sites of crucifixion and resurrection, built by order of Constantine following Helena's pilgrimage.	Primary Christian pilgrimage site since 4th century; key to development of pilgrimage theology and liturgy.	Helena's pilgrimage ~326-328; Macarius of Jerusalem oversaw construction. Eusebius describes dedication in Life of Constantine.	extant	Multiple rebuild phases; earliest fabric largely obscured by later construction.	https://en.wikipedia.org/wiki/Church_of_the_Holy_Sepulchre;https://www.britannica.com/topic/Holy-Sepulchre
catacombs-saint-callixtus	Catacombs of Saint Callixtus	catacomb	null	Rome	41.8555	12.5117	approx_city	200	450	200	Multi-level Christian burial complex on the Appian Way housing crypts of early Roman bishops and martyrs including papal crypt.	Key site for funerary art, martyr veneration, and episcopal commemoration in Rome; source for early Christian iconography.	Rediscovered by Giovanni Battista de Rossi in 1849; ongoing excavation and documentation.	extant	Dating and attribution of specific chambers varies by excavation phase.	https://en.wikipedia.org/wiki/Catacomb_of_Callixtus;https://www.britannica.com/place/catacomb
megiddo-house-church	Megiddo (Prison) House Church	house-church	null	Legio (Megiddo)	32.5853	35.1818	approx_city	200	null	200	Floor mosaic inscriptions within a Roman military base, including a dedicatory inscription to "God Jesus Christ" and a table described as an altar.	Potentially the earliest Christian mosaic inscription yet found; uniquely attests both "altar" terminology and a female donor in an early context.	Discovered 2005 during prison construction at Megiddo; mosaic panels preserved in situ.	extant	Chronology and interpretation actively debated; some scholars date later.	https://en.wikipedia.org/wiki/Megiddo_church;https://www.haaretz.com/archaeology/2019-11-06
etchmiadzin-cathedral	Etchmiadzin Cathedral	basilica	null	Vagharshapat	40.1619	44.2914	exact	301	null	300	Armenian ecclesial center traditionally founded by Gregory the Illuminator following Armenia's adoption of Christianity; seat of the Catholicos.	Symbolic center of Armenian Christianity; among the earliest state-sponsored church buildings; continuous ecclesiastical use.	Archaeological investigation of earliest phases ongoing; current structure largely medieval.	extant	Precise early construction phases uncertain; tradition strong but archaeology complex.	https://en.wikipedia.org/wiki/Etchmiadzin_Cathedral
monastery-saint-antony	Monastery of Saint Antony	monastery	null	Eastern Desert	28.9119	32.3472	approx_city	356	null	350	Anchoritic and cenobitic monastic community in the Eastern Desert of Egypt associated with Antony the Great; the oldest continuously inhabited Christian monastery.	Foundation of Egyptian monastic tradition; influenced Benedict's Rule and Western monasticism; pilgrimage site.	Still functioning; Athanasius' Life of Antony is the primary literary source for early occupation.	extant	Current architecture spans centuries beyond initial monastic occupation.	https://en.wikipedia.org/wiki/Monastery_of_Saint_Anthony
```

### 5.7 `data/edges.tsv` — sample rows

```tsv
id	source_type	source_id	relationship	target_type	target_id	decade_start	decade_end	weight	notes	citations
e001	person	ignatius-of-antioch	bishop_of	city	0070-antioch-antakya	70	110	5	Ignatius was bishop of Antioch from approximately AD 69 until his arrest and transport to Rome c.107.	https://www.newadvent.org/fathers/0109.htm
e002	person	ignatius-of-antioch	disciple_of	person	polycarp-of-smyrna	80	107	4	The patristic tradition records contact between Ignatius and Polycarp; Polycarp's letter to the Philippians references Ignatius.	https://www.newadvent.org/fathers/0136.htm
e003	person	ignatius-of-antioch	authored	work	ignatius-to-smyrnaeans	100	110	5	Written en route to martyrdom in Rome, c.107.	https://www.newadvent.org/fathers/0109.htm
e004	work	ignatius-to-smyrnaeans	sent_to	city	0090-smyrna-izmir	100	110	5	The letter is explicitly addressed to the church at Smyrna.	https://www.newadvent.org/fathers/0109.htm
e005	work	ignatius-to-smyrnaeans	affirms	doctrine	real-presence	100	null	5	Letter to Smyrnaeans 6.2 is the clearest early patristic statement of the real presence.	https://www.newadvent.org/fathers/0109.htm
e006	work	ignatius-to-smyrnaeans	first_mentions	doctrine	monarchical-episcopacy	100	null	5	The letters contain the clearest early case for a single bishop ruling each church.	https://www.newadvent.org/fathers/0109.htm
e007	event	apostolic-council-jerusalem-49	held_in	city	0040-jerusalem-jerusalem	40	50	5	The council was held in Jerusalem per Acts 15.	https://biblehub.com/acts/15.htm
e008	event	apostolic-council-jerusalem-49	debated	doctrine	apostolic-succession	40	50	3	The council established the authority structure for Gentile mission leadership.	https://biblehub.com/acts/15.htm
e009	person	paul-of-tarsus	attended	event	apostolic-council-jerusalem-49	40	50	5	Paul's presence and argument for Gentile freedom is the central narrative of Acts 15.	https://biblehub.com/acts/15.htm
e010	person	polycarp-of-smyrna	disciple_of	person	ignatius-of-antioch	80	110	4	Patristic tradition; Ignatius wrote a personal letter to Polycarp.	https://www.newadvent.org/fathers/0109.htm
e011	person	irenaeus-of-lyon	disciple_of	person	polycarp-of-smyrna	150	160	5	Irenaeus explicitly states in his Letter to Florinus that he sat at Polycarp's feet in Smyrna.	https://www.newadvent.org/fathers/0103.htm
e012	person	irenaeus-of-lyon	bishop_of	city	0170-lugdunum-lyon	177	202	5	Irenaeus succeeded Pothinus as bishop after the 177 martyrdoms.	https://www.newadvent.org/fathers/0103.htm
e013	work	irenaeus-against-heresies	affirms	doctrine	apostolic-succession	180	null	5	Against Heresies 3.3.2 is the locus classicus for apostolic succession as doctrinal criterion.	https://www.newadvent.org/fathers/0103.htm
e014	event	council-of-nicaea-325	held_in	city	0320-nicaea-iznik	320	330	5	Nicaea (modern İznik) hosted the council convened by Constantine.	https://www.britannica.com/event/First-Council-of-Nicaea-325
e015	event	council-of-nicaea-325	defined	doctrine	homoousios	320	330	5	The council defined the Son as homoousios (consubstantial) with the Father.	https://www.britannica.com/event/First-Council-of-Nicaea-325
e016	person	athanasius-of-alexandria	attended	event	council-of-nicaea-325	320	330	5	Athanasius attended as deacon and theological advisor to Alexander of Alexandria.	https://www.newadvent.org/fathers/2806.htm
e017	archaeology	dura-europos-house-church	located_in	city	null	230	256	5	Dura-Europos; city record may not exist in final.tsv — use city_ancient field.	https://en.wikipedia.org/wiki/Dura-Europos_church
e018	work	didache	affirms	doctrine	eucharistic-sacrifice	80	null	5	Didache 14.1 uses thusia (sacrifice) for the Sunday Eucharist.	https://www.newadvent.org/fathers/0714.htm
e019	person	justin-martyr	wrote_from	city	0150-rome-rome	150	165	4	Justin was active in Rome where he ran a philosophical school before his martyrdom.	https://en.wikipedia.org/wiki/Justin_Martyr
e020	person	origen-of-alexandria	disciple_of	person	clement-of-alexandria	200	210	4	Origen studied under Clement at the Catechetical School of Alexandria.	https://www.newadvent.org/fathers/0412.htm
```

---

## 6. Domain Layer — Repository Interfaces

All data access is through these TypeScript interfaces. The implementation (in-memory from TSV, or SQL) is hidden behind them.

```typescript
// src/domain/types.ts
// (abbreviated — see full file for all fields)

export interface Person { id: string; name_display: string; roles: string[]; ... }
export interface HistoricalEvent { id: string; name_display: string; event_type: EventType; decade_bucket: number; ... }
export interface Work { id: string; title_display: string; author_id: string | null; decade_bucket: number; ... }
export interface Doctrine { id: string; name_display: string; category: DoctrineCategory; ... }
export interface Quote { id: string; doctrine_id: string; text: string; decade_bucket: number; stance: Stance; ... }
export interface ArchaeologySite { id: string; name_display: string; site_type: SiteType; decade_bucket_start: number; ... }
export interface Edge { id: string; source_type: EntityType; source_id: string; relationship: string; target_type: EntityType; target_id: string; decade_start: number | null; decade_end: number | null; weight: number; }

// Selection union — anything the user can "select"
export type Selection =
  | { kind: 'city'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'work'; id: string }
  | { kind: 'doctrine'; id: string }
  | { kind: 'archaeology'; id: string };

export interface HighlightEntry {
  color: string;
  label: string;
  intensity: 1 | 2 | 3; // 1=weak, 3=direct
}
```

```typescript
// src/domain/repositories.ts

export interface IRepository<T> {
  getById(id: string): T | undefined;
  getAll(): T[];
}

export interface IPersonRepository extends IRepository<Person> {
  getByDecade(decade: number): Person[];
  getByCityId(cityId: string, decade?: number): Person[];
  search(query: string): Person[];
}

export interface IEventRepository extends IRepository<HistoricalEvent> {
  getByDecade(decade: number): HistoricalEvent[];
  getByCityId(cityId: string): HistoricalEvent[];
  getByType(type: EventType): HistoricalEvent[];
}

export interface IWorkRepository extends IRepository<Work> {
  getByDecade(decade: number): Work[];
  getByAuthorId(personId: string): Work[];
  getByCityRecipient(cityId: string): Work[];
}

export interface IDoctrineRepository extends IRepository<Doctrine> {
  getByCategory(category: DoctrineCategory): Doctrine[];
  getAll(): Doctrine[];
}

export interface IQuoteRepository extends IRepository<Quote> {
  getByDoctrineId(doctrineId: string, decade?: number): Quote[];
  getByPersonId(personId: string): Quote[];
  getByDecade(decade: number): Quote[];
}

export interface IArchaeologyRepository extends IRepository<ArchaeologySite> {
  getActiveAtDecade(decade: number): ArchaeologySite[];
  getByCityId(cityId: string): ArchaeologySite[];
  getByType(type: SiteType): ArchaeologySite[];
}

export interface IEdgeRepository {
  getEdgesFrom(sourceId: string, sourceType?: EntityType, decade?: number): Edge[];
  getEdgesTo(targetId: string, targetType?: EntityType, decade?: number): Edge[];
  getEdgesOfRelationship(relationship: string, decade?: number): Edge[];
  // Returns all edges within maxDepth hops from a starting entity
  getNetwork(entityId: string, entityType: EntityType, maxDepth: number, decade?: number): { nodes: EntityRef[]; edges: Edge[] };
}
```

---

## 7. Service Layer

```typescript
// src/services/HighlightService.ts
// Given a selection, produces a highlights map: cityId → HighlightEntry
// This is the "web" — how selecting anything illuminates everything.

class HighlightService {
  highlight(selection: Selection, decade: number): Record<string, HighlightEntry> {
    switch (selection.kind) {
      case 'doctrine':  return this.highlightByDoctrine(selection.id, decade);
      case 'person':    return this.highlightByPerson(selection.id, decade);
      case 'event':     return this.highlightByEvent(selection.id, decade);
      case 'work':      return this.highlightByWork(selection.id, decade);
      case 'city':      return this.highlightByCity(selection.id, decade);
    }
  }

  private highlightByDoctrine(doctrineId, decade) {
    // 1. Find works that affirm/condemn/mention this doctrine via edges
    // 2. From those works → get city_written_id and city_recipient_ids → highlight cities
    // 3. From those works → get author_id → get that person's bishop_of cities → highlight
    // 4. Find events that defined/debated this doctrine → get event cities → highlight
  }

  private highlightByPerson(personId, decade) {
    // 1. Get all edges from this person: bishop_of, visited, wrote_from → cities → highlight
    // 2. Get all their works → get those works' recipient cities → highlight
    // 3. Return arc data: all "corresponded_with" person edges for CorrespondenceLayer
  }
}

// src/services/TimelineService.ts
// Builds ordered lists of events/quotes for a given entity and time range

// src/services/SearchService.ts
// Fuzzy search across all entity types; returns ranked results
```

---

## 8. State Management (Zustand)

```typescript
// src/stores/appStore.ts

interface AppState {
  // Decade navigation
  activeDecade: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 5;

  // Selection — the single source of truth for what's "selected"
  selection: Selection | null;

  // Highlights — computed by HighlightService when selection changes
  highlights: Record<string, HighlightEntry>;       // keyed by city row id
  correspondenceArcs: CorrespondenceArc[];          // for CorrespondenceLayer

  // UI layout
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  activeRightPanel: RightPanel;                     // see enum below
  activeLeftTab: LeftTab;

  // Layer toggles
  archaeologyLayerVisible: boolean;
  correspondenceLayerVisible: boolean;

  // Filters (existing)
  filters: FilterState;

  // Actions
  setDecade(decade: number): void;
  setSelection(selection: Selection | null): void;
  toggleLayer(layer: 'archaeology' | 'correspondence'): void;
  setRightPanel(panel: RightPanel): void;
}

type RightPanel = 'chronicle' | 'events' | 'doctrines' | 'correspondence' | 'archaeology' | 'essays';
type LeftTab = 'filters' | 'search' | 'timeline-nav';
```

---

## 9. Folder & File Structure

```
apostolic_church/
├── data/
│   ├── people.tsv              ← NEW
│   ├── events.tsv              ← NEW
│   ├── works.tsv               ← NEW
│   ├── doctrines.tsv           ← NEW
│   ├── quotes.tsv              ← NEW
│   ├── archaeology.tsv         ← NEW (migrates starred_pois.json)
│   ├── edges.tsv               ← NEW (the graph)
│   └── starred_pois.json       ← keep for now; archaeology.tsv supersedes
├── docs/
│   ├── data_architecture_plan.md  ← this file
│   └── ...
├── essays/
├── final.tsv                   ← unchanged
├── scripts/
│   └── tsv_to_json.ts          ← extend to parse all new TSV files
└── src/
    ├── domain/
    │   ├── types.ts            ← ALL domain interfaces (replaces current types.ts)
    │   └── repositories.ts     ← IRepository interfaces (no implementations)
    ├── data/
    │   ├── adapters/
    │   │   ├── churchRowAdapter.ts     ← parse final.tsv rows → ChurchRow
    │   │   ├── personAdapter.ts
    │   │   ├── eventAdapter.ts
    │   │   ├── workAdapter.ts
    │   │   ├── doctrineAdapter.ts
    │   │   ├── quoteAdapter.ts
    │   │   ├── archaeologyAdapter.ts
    │   │   └── edgeAdapter.ts
    │   ├── repositories/
    │   │   ├── InMemoryPersonRepository.ts
    │   │   ├── InMemoryEventRepository.ts
    │   │   ├── InMemoryWorkRepository.ts
    │   │   ├── InMemoryDoctrineRepository.ts
    │   │   ├── InMemoryQuoteRepository.ts
    │   │   ├── InMemoryArchaeologyRepository.ts
    │   │   ├── InMemoryEdgeRepository.ts
    │   │   └── InMemoryChurchRowRepository.ts
    │   ├── generated/          ← build output (git-ignored)
    │   │   ├── indexedData.json
    │   │   ├── people.json
    │   │   ├── events.json
    │   │   ├── works.json
    │   │   ├── doctrines.json
    │   │   ├── quotes.json
    │   │   ├── archaeology.json
    │   │   ├── edges.json
    │   │   ├── starredPois.json
    │   │   └── essays.json
    │   └── runtimeData.ts      ← creates all repositories from generated JSON
    ├── services/
    │   ├── HighlightService.ts
    │   ├── TimelineService.ts
    │   ├── NetworkService.ts
    │   └── SearchService.ts
    ├── stores/
    │   └── appStore.ts         ← Zustand store (add zustand dependency)
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   ├── LeftPanel.tsx
    │   │   └── RightPanel.tsx
    │   ├── controls/
    │   │   ├── TimelineControl.tsx
    │   │   ├── FilterPanel.tsx
    │   │   ├── SearchBar.tsx
    │   │   └── MapToolbar.tsx
    │   ├── map/
    │   │   ├── MapContainer.tsx         ← Leaflet mount & lifecycle
    │   │   ├── CityLayer.tsx            ← existing city circles
    │   │   ├── ArchaeologyLayer.tsx     ← NEW: archaeology markers
    │   │   └── CorrespondenceLayer.tsx  ← NEW: SVG arc overlays
    │   ├── panels/
    │   │   ├── CityChronicle.tsx        ← NEW: full location timeline
    │   │   ├── EventTrack.tsx           ← NEW: events timeline
    │   │   ├── DoctrineExplorer.tsx     ← NEW: doctrine + quotes view
    │   │   ├── CorrespondencePanel.tsx  ← NEW: person network view
    │   │   ├── ArchaeologyPanel.tsx     ← NEW: site detail
    │   │   └── EssayPanel.tsx           ← extracted from current App.tsx
    │   └── shared/
    │       ├── Badge.tsx
    │       ├── CitationList.tsx
    │       ├── PersonCard.tsx
    │       ├── QuoteCard.tsx
    │       └── KeyboardShortcutHelp.tsx
    ├── App.tsx                 ← thin orchestrator ~80 lines
    ├── constants.ts            ← extend with new color maps
    ├── main.tsx
    └── styles.css
```

---

## 10. Component Architecture

### 10.1 App.tsx (thin orchestrator)
Renders `<AppShell>` only. All state lives in Zustand. All logic in services.

### 10.2 Left Panel tabs
1. **Filters** — existing facets (presence status, polity, denomination)
2. **Search** — global search across all entity types; results grouped by type
3. **Navigate** — quick-jump by decade, event shortcuts

### 10.3 Right Panel tabs (new)
| Tab | Component | What it shows |
|---|---|---|
| `chronicle` | `CityChronicle` | Selected city's full decade-by-decade timeline |
| `events` | `EventTrack` | Events timeline with decade grouping |
| `doctrines` | `DoctrineExplorer` | Select a doctrine; see ordered quotes + city highlights |
| `correspondence` | `CorrespondencePanel` | Select a person; ego-network of relationships |
| `archaeology` | `ArchaeologyPanel` | Selected site detail |
| `essays` | `EssayPanel` | Existing markdown essays |

### 10.4 CityChronicle (Location Timeline)
- Click any city marker → right panel opens to `chronicle`
- Vertical timeline: one card per decade where city has data
- Each card shows: presence status, key figures, council context, denomination, evidence summary
- Chips link to person/event/work/doctrine panels
- "Active decade" card highlighted

### 10.5 DoctrineExplorer
- Browse list of doctrines grouped by category
- Select one → `QuoteCard` list ordered chronologically
- Each `QuoteCard` shows: quote text, attribution, date, stance badge, work link
- City markers update to highlight all cities where this doctrine was affirmed/debated (via `HighlightService`)

### 10.6 CorrespondenceLayer (Map Arcs)
- SVG overlay using Leaflet's `L.SVGOverlay` or custom Canvas layer
- Renders Bézier arcs between cities for active person's `corresponded_with` / `wrote_to` relationships
- Arc thickness = `weight` (1–5); color = relationship type
- Only shown when `correspondenceLayerVisible = true`

### 10.7 ArchaeologyLayer
- Distinct marker shape (star/triangle icon) at each active site's coordinates
- Visible when `archaeologyLayerVisible = true`
- Filtered to `year_start ≤ activeDecade` and (`year_end ≥ activeDecade` OR `year_end = null`)
- Click → opens `ArchaeologyPanel` in right sidebar

---

## 11. The Web — Cross-Entity Highlight Cascade

This is the mechanism that makes everything interactive and interconnected.

### Selection cascade rules

```
SELECT Doctrine "Real Presence"
  → HighlightService.highlightByDoctrine('real-presence', decade)
    → edges WHERE target_id='real-presence' AND relationship IN (affirms,condemns,first_mentions)
        → work ids: [ignatius-to-smyrnaeans, justin-first-apology, ...]
    → for each work:
        → edges WHERE source_id=work.id AND relationship='written_in'   → cities: highlight orange
        → edges WHERE source_id=work.id AND relationship='sent_to'      → cities: highlight lighter
        → edges WHERE source_id=work.id AND relationship='authored' target=person → person.bishop_of cities
    → edges WHERE target_id='real-presence' AND source_type='event'
        → event cities: highlight purple
  → dispatch highlights to store → CityLayer re-renders

SELECT Person "Ignatius of Antioch"
  → HighlightService.highlightByPerson('ignatius-of-antioch', decade)
    → edges: bishop_of → Antioch (strong highlight)
    → edges: wrote_from → en-route cities
    → edges: corresponded_with → Smyrna, Philadelphia, etc.
    → if CorrespondenceLayer active: render arcs

SELECT Event "Council of Nicaea"
  → HighlightService.highlightByEvent('council-of-nicaea-325', decade)
    → event.city_id → Nicaea (direct)
    → edges WHERE source_id=event AND relationship='affected' → other cities
    → edges WHERE source_id=event AND relationship='defined' → doctrine 'homoousios'
    → find all persons who attended → their home cities highlighted

SELECT City "Antioch"  
  → CityChronicle opens for Antioch in right panel
  → HighlightService.highlightByCity('antioch', decade)
    → find all persons bishop_of this city → open CorrespondencePanel option
    → find all works sent_to this city → show in chronicle
    → find all events held_in → show in chronicle
```

### Highlight color vocabulary
| Selection type | Highlight color |
|---|---|
| Direct connection | `#e67e22` (strong orange) |
| 2nd-degree (via work/person) | `#f39c12` (lighter orange) |
| Event connection | `#8e44ad` (purple) |
| Doctrine connection | `#2980b9` (blue) |
| Archaeology connection | `#27ae60` (green) |

---

## 12. Build Pipeline Changes

Extend `scripts/tsv_to_json.ts` to:
1. Parse all 7 new TSV files with their respective schemas
2. Validate IDs: every `source_id` and `target_id` in `edges.tsv` must resolve to a known entity (warn on missing)
3. Build cross-reference indexes (e.g., `edgesBySourceId`, `edgesByTargetId`, `quotesByDoctrineId`)
4. Output JSON files to `src/data/generated/` (all git-ignored via `.gitignore`)
5. Validate decade buckets: all values must be in the known `yearBuckets` array

`runtimeData.ts` creates all InMemory repositories from the generated JSON and exports them. All components import repositories from `runtimeData.ts` only — never raw JSON.

---

## 13. New Dependencies to Add

| Package | Purpose |
|---|---|
| `zustand` | Global state management (replace React useState in App.tsx) |
| `d3-geo` (already have d3-dsv) | Great-circle arc path calculation for correspondence arcs |

No graph visualization library needed for the map arcs (use Leaflet SVG directly). If an ego-network panel is added later, use `cytoscape.js` (lightweight, no React dependency).

---

## 14. Implementation Roadmap

### Phase 0 — Data Creation (no code changes)
- [ ] Create `data/people.tsv` with ~60 key figures
- [ ] Create `data/events.tsv` with ~50 key events
- [ ] Create `data/works.tsv` with ~70 key works
- [ ] Create `data/doctrines.tsv` with ~35 doctrines
- [ ] Create `data/quotes.tsv` with ~200 quotes
- [ ] Create `data/archaeology.tsv` (migrate + expand starred_pois.json to ~40 sites)
- [ ] Create `data/edges.tsv` with ~600 edges

### Phase 1 — Build Pipeline
- [ ] Extend `scripts/tsv_to_json.ts` for all new TSV files
- [ ] Add ID validation and cross-reference checks
- [ ] Update `src/data/runtimeData.ts` with all repositories

### Phase 2 — Domain Layer
- [ ] Create `src/domain/types.ts` (all entity interfaces)
- [ ] Create `src/domain/repositories.ts` (all IRepository interfaces)
- [ ] Implement all 8 `InMemory*Repository` classes
- [ ] Add Zustand (`npm install zustand`)
- [ ] Implement `appStore.ts`

### Phase 3 — Component Decomposition (no new features yet)
- [ ] Extract `FilterPanel`, `SearchBar`, `TimelineControl`, `MapToolbar` from `App.tsx`
- [ ] Extract `MapContainer`, `CityLayer` from map rendering in `App.tsx`
- [ ] Extract `EssayPanel` from right panel in `App.tsx`
- [ ] Result: `App.tsx` ~80 lines

### Phase 4 — Services
- [ ] Implement `HighlightService`
- [ ] Implement `TimelineService`
- [ ] Implement `SearchService`

### Phase 5 — New Feature Panels
- [ ] `CityChronicle` (location timeline)
- [ ] `EventTrack` (events timeline)
- [ ] `DoctrineExplorer` + `QuoteCard`
- [ ] `CorrespondencePanel`
- [ ] `ArchaeologyPanel`

### Phase 6 — New Map Layers
- [ ] `ArchaeologyLayer` (markers)
- [ ] `CorrespondenceLayer` (SVG arcs)

### Phase 7 — Polish
- [ ] URL state includes selection + active panel
- [ ] Keyboard shortcuts for new panels
- [ ] Mobile/responsive adjustments
- [ ] Performance: memoize highlight computations, virtualize long quote lists

---

## 15. Future Database Migration

Because all UI code uses `IRepository<T>` interfaces exclusively:

```typescript
// Current (TSV / in-memory):
const personRepo = new InMemoryPersonRepository(generatedPeopleJson);

// Future (SQL/Supabase/Postgres):
const personRepo = new SqlPersonRepository(db);
// or
const personRepo = new SupabasePersonRepository(supabaseClient);
```

**Zero UI changes required.** Only `runtimeData.ts` changes.

For user-editable data:
- Add a thin CRUD REST API or use Supabase Row Level Security
- The repository interface gains optional `save(entity: T): Promise<void>` / `delete(id: string): Promise<void>` methods
- UI components call `repo.save()` after validation — same interface, new capability

The `edges.tsv` maps to a graph-edges SQL table indexed on `(source_id, source_type)` and `(target_id, target_type)`. `IEdgeRepository.getNetwork()` becomes a recursive CTE query.
