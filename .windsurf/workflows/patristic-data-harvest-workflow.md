---
description: Windsurf workflow for AI-assisted harvesting of patristic-era canonical data from public primary-text sources
---

# Windsurf Patristic Data Harvest Workflow

Use this workflow when harvesting post-NT data for roughly AD 70–400 from public primary-text sites before handing anything off to the canonical edit workflow.

This workflow is for **retrieval and evidence gathering**.
It sits **before** `data-edit.md`.
It assumes the canonical model in `app-data.md`:
- entities stay minimal
- claims stay atomic
- passages are citable
- doctrine is proposition-based
- groups absorb sect/polity roles
- derived tables are regenerated only

---

## Objective

Harvest high-value patristic data fast, with minimal token waste, while keeping the final canonical dataset:

1. primary-source anchored
2. locality-aware
3. doctrine-aware
4. anti-duplication
5. explicit about certainty and inference strength

The target is not “everything mentioned in the fathers.”
The target is the **smallest evidence set that explains the major doctrinal, geographic, relational, and sectarian shape of the church from 0–400**.

---

## Non-negotiables

1. **Primary text first.**
   Prefer a passage from the text itself over a secondary summary about the text.

2. **One passage can support several claims, but one claim row must express one assertion only.**

3. **Never jump from a text to a place-wide conclusion without a stated inference path.**
   A person, work, correspondence, bishopric, travel route, or controversy must connect the doctrine to the locality.

4. **Do not confuse these levels:**
   - direct doctrinal statement
   - statement against the opposite
   - disciplinary assumption
   - casual unchallenged norm
   - later report about an earlier witness
   - modern editorial summary

5. **Do not over-harvest low-yield prose.**
   Once a witness has already established a doctrine/locality pair, only continue if:
   - the same witness adds a different doctrine
   - the text adds a new locality
   - the text adds a new relationship path
   - the text records a dispute, schism, or antithesis
   - the text materially strengthens certainty

6. **Language-aware search is mandatory.**
   Search in the source language whenever possible. Use translations as discovery layers, not as substitutes for source-language search when the original is available.

7. **Respect site constraints.**
   Favor sites that explicitly expose open text, downloadable files, XML/TEI, CTS, or public scans. Avoid subscription-only corpora for systematic harvesting.

---

## Preferred source ladder

Always move down this ladder in order. Stop as soon as the evidence packet is strong enough.

### Tier 1 — machine-friendly primary repositories

Use first when available.

| Source | Use it for | Why it is first |
|---|---|---|
| Patristic Text Archive (PTA) | open-access patristic text and translation harvesting | Open access; TEI/XML; Creative Commons reuse; CapiTainS-compatible data; often includes annotations and critical-text orientation |
| Scaife Viewer / Open Greek and Latin ecosystem | Greek/Latin passage retrieval, CTS-anchored extraction | Stable CTS/URN structure; predictable passage segmentation; original-language + some translations |
| BKV / Bibliothek der Kirchenväter | multilingual harvesting, especially when a fast downloadable text is needed | Downloadable DOCX/EPUB/PDF/RTF plus scans; structured divisions; bibliographic metadata shown |
| Corpus Corporum | Latin search-heavy harvesting | Fast full-text and lemmatized Latin search; excellent for Latin doctrinal clusters |

### Tier 2 — human-readable discovery and comparison sites

Use after Tier 1, or when Tier 1 lacks the work.

| Source | Use it for | Limitation |
|---|---|---|
| Early Christian Writings | discovery, parallel translations, pre-Nicene browsing | Site compilation is copyrighted; use for discovery and comparison, not blind bulk ingestion |
| New Advent Fathers | readable English retrieval and source-page metadata | Site copyright applies; good for manual or light evidence capture, not the main ingest layer |
| CCEL | readable public-domain theology corpus with XML/ThML history | Site policy is more restrictive for reuse; use cautiously and record provenance |

### Tier 3 — scan and OCR verification layers

Use for audit, page verification, and hard-to-find editions.

| Source | Use it for | Special strength |
|---|---|---|
| Internet Archive | scans, OCR, downloadable derivatives, item metadata | hOCR, page index JSON, plaintext search text, APIs |
| HathiTrust | stable bibliographic verification and public-domain volumes | strong metadata discipline |
| Gallica | scan-level verification, especially French-hosted editions | strong scan and API ecosystem |

### Tier 4 — verification-only sources

Use to confirm, never as default harvest substrate unless rights are clear in your environment.

- Loeb
- TLG
- Sources Chrétiennes Online
- Patrologia Latina database
- other subscription platforms

---

## Retrieval order per witness

For each witness or work, use this exact order:

1. **Identify the best host**
   - Tier 1 if available
   - otherwise Tier 2
   - otherwise Tier 3 scan + OCR

2. **Capture edition metadata first**
   - author
   - work title
   - language
   - edition/translation info
   - URL
   - stable locator system
   - rights note if relevant

3. **Search source-language keywords**
   - then translation-language equivalents
   - then doctrinal antonyms
   - then locality/person/group names

4. **Pull only the necessary windows**
   - table of contents
   - hit context
   - 1–3 paragraphs before and after
   - chapter/section heading
   - bibliographic header

5. **Extract candidate passages**
   - store as passage candidates before creating claim rows

6. **Filter for relevance**
   Keep only passages that produce at least one of:
   - proposition evidence
   - location tie
   - relationship tie
   - group/sect evidence
   - event/persecution/schism evidence

7. **Create the evidence packet**
   - source row candidate
   - passage row candidate(s)
   - claim row candidate(s)
   - claim-evidence links
   - review note / uncertainty note

8. **Stop**
   Move on once the witness is no longer yielding new canonical value.

---

## Canonical evidence packet

Do not send an editing agent into the canonical TSVs until you have an evidence packet.

Each packet should contain:

### A. Source packet
- `source_id`
- bibliographic title
- author/editor
- publication info if relevant
- URL
- access date
- work link if known
- rights note

### B. Passage packet
- `passage_id`
- `source_id`
- locator system
- exact locator
- excerpt
- language
- optional deep link

### C. Claim packet
One or more atomic claims that the passage supports.

### D. Link packet
- `claim_evidence.tsv` rows
- optional `claim_reviews.tsv` row
- optional `editor_notes.tsv` rationale if inference is non-obvious

---

## High-value claim classes

Always label passages by **what kind of evidence they provide** before turning them into claims.

### Class 1 — direct explicit doctrinal statement
The author plainly affirms or opposes a proposition.

Examples:
- “the Church received…”
- “the apostles handed down…”
- “the eucharist is…”
- “children/infants are baptized…”

**Typical certainty:** `high` or `probable`

### Class 2 — explicit antithesis
The author directly rejects the contrary position.

Examples:
- rejects rebaptism
- rejects a merely symbolic account
- rejects anti-episcopal or anti-tradition claims
- rejects a doctrine as foreign to the Church

**Typical certainty:** `high`

### Class 3 — disciplinary or liturgical presupposition
The text regulates a practice without defending it, which suggests normality within that context.

Examples:
- baptismal timing rules
- Eucharistic admission rules
- fast/penance rules
- clerical succession procedure
- treatment of relics/martyrs/shrines

**Typical certainty:** `probable`

### Class 4 — casual normative mention
The author mentions a doctrine or practice in passing, without controversy language.

Examples:
- speaks of the eucharistic elements as the body/blood
- speaks of bishops/altars as ordinary realities
- mentions virginity, fasting, martyr relics, or intercessory assumptions as already known

**Typical certainty:** `probable` or `possible`, depending on context

### Class 5 — relational / locality bridge
The passage ties a doctrine-bearing witness to a place or network.

Examples:
- bishop of city X
- letter to church in Y
- travels through Z
- teacher/disciple link across locations
- synod attendance

**Typical certainty:** `high` for the relation itself; lower for doctrinal spillover

### Class 6 — retrospective report
A later author reports an earlier practice or witness.

Examples:
- Eusebius summarizing earlier writers
- Jerome reporting earlier customs

**Typical certainty:** `probable` unless independently confirmed

---

## Inference ladder for doctrine-to-place mapping

Use the weakest inference that honestly fits the evidence.

### Level A — direct place-attached evidence
A doctrine is directly tied to a place through:
- bishop_of city
- work written at city
- work addressed to city/church
- synod/event at city
- martyrdom/site at city

This can support doctrine-place presence strongly.

### Level B — network-attached evidence
A doctrine is tied to a place through a person who:
- lived there
- taught there
- corresponded from there
- was recognized there
- led the church there

This usually supports `probable` place presence, not absolute locality consensus.

### Level C — travel/contact inference
A person visited or corresponded with a region, and no contrary evidence appears.

This supports only a **compatibility** inference such as:
- “not demonstrably opposed”
- “within the network of a witness affirming X”
- “possible presence of X”

Do **not** convert this into a full local consensus claim without more.

### Level D — silence-only inference
No direct evidence, only absence of dispute.

Do not create a strong proposition-place claim from silence alone.
Use an editorial note or a low-certainty claim only if the silence is historically notable and explicitly justified.

---

## Certainty and polarity guidance

### Certainty

| Situation | Use |
|---|---|
| direct statement, direct prohibition, explicit tradition claim | `high` |
| clear liturgical/disciplinary assumption; strong contextual norm | `probable` |
| indirect inference through strong network/place ties | `probable` |
| weak inference through travel/contact or retrospective summary | `possible` |
| anything textually unstable or thinly attested | `possible` or omit |

### Polarity

| Situation | Use |
|---|---|
| explicit affirmation | `supports` |
| explicit rejection of the opposite | `supports` for the proposition affirmed, or `opposes` for the contrary proposition |
| mere relation / presence / office / authorship | `not_applicable` |
| contextual mention without doctrinal direction | `neutral` or `not_applicable`, depending on predicate |

---

## Language-first search rules

### General rule

Search in this order:

1. source language
2. close translation equivalent
3. doctrinal antonym
4. institutional/locality terms
5. personal names and office terms

### Greek starter bank

Use these as seeds, then refine per author and doctrine.

#### Tradition / apostolic transmission
- παράδοσις
- παραδόσεις
- παρέδωκεν / παρέδωκαν
- παραδίδωμι
- ἀποστολικός / ἀπόστολοι
- ἐκκλησία
- ἔθος
- συνήθεια

#### Baptism / age of baptism
- βάπτισμα
- βαπτίζω
- βρέφος
- νήπιος
- παιδίον
- νηπιάζω
- λουτρόν
- παλιγγενεσία

#### Eucharist / sacrifice / altar
- εὐχαριστία
- προσφορά
- θυσία
- θυσιαστήριον
- σῶμα
- αἷμα
- κοινωνία
- μυστήριον

#### Mary / virginity
- Μαρία
- παρθένος
- ἀειπάρθενος
- θεοτόκος
- ἀδελφοί (when checking “brothers of the Lord” disputes)

#### Relics / holy matter / images / veneration
- λείψανον / λείψανα
- τιμή
- προσκύνησις
- εἰκών
- σημεῖον
- ἅγιος / ἁγίασμα

#### Asceticism
- ἄσκησις
- νηστεία
- παρθενία
- ἐγκράτεια
- μοναχός / μοναστήριον (later texts)

#### Episcopacy / succession / authority
- ἐπίσκοπος
- πρεσβύτερος
- διάκονος
- χειροτονία
- διαδοχή
- καθέδρα

#### Politics / military / nonresistance
- στρατιώτης
- πόλεμος
- βασιλεύς
- ἄρχων
- εἰρήνη
- ξίφος
- ὅρκος
- εἰδωλολατρία

### Latin starter bank

#### Tradition / apostolic transmission
- traditio
- traditiones
- traditum
- tradiderunt
- apostoli
- ecclesia
- consuetudo
- mos

#### Baptism / age of baptism
- baptismus
- baptizare
- infans
- infantia
- parvulus
- puer
- lavacrum
- regeneratio

#### Eucharist / sacrifice / altar
- eucharistia
- sacrificium
- oblatio
- altare
- corpus
- sanguis
- communio
- mysterium / sacramentum

#### Mary / virginity
- Maria
- virgo
- semper virgo
- fratres Domini

#### Relics / holy matter / images / veneration
- reliquiae
- veneratio
- honor
- imago
- sanctus / sanctitas
- sepulcrum martyris

#### Asceticism
- ieiunium
- continentia
- virginitas
- castitas
- monachus / monasterium

#### Episcopacy / succession / authority
- episcopus
- presbyter
- diaconus
- ordinatio
- successio
- cathedra

#### Politics / military / nonresistance
- miles
- bellum
- gladius
- imperator
- magistratus
- idololatria
- iuramentum

### Syriac / Coptic / Armenian / other languages

Do not invent broad keyword packs casually.
For these languages:

1. start with edition metadata and English/German/French translation search
2. identify the exact source-language term from lexica or the edition introduction
3. only then add a stable search seed to the keyword bank

---

## Doctrine-specific harvesting heuristics

These are **minimum doctrine families** that must be fully covered by the end of the campaign.

### Baptism
Capture:
- infant/child baptism
- adult baptism
- baptismal regeneration
- catechumenate timing
- rebaptism disputes
- post-baptismal discipline

### Eucharist / sacrament / altar
Capture:
- real-presence language
- sacrifice / oblation language
- altar language
- admission / communion discipline
- Eucharist as ordinary norm of church life

### Oral tradition / apostolic continuity
Capture:
- “handed down” language
- church rule / rule of faith
- succession
- appeal to received custom against innovators

### Episcopacy / church order
Capture:
- bishop / presbyter / deacon triad
- monarchical episcopacy
- succession language
- church unity tied to bishop or see
- schism handling

### Mary
Capture:
- virgin birth
- ever-virginity / perpetual virginity
- typology (new Eve etc.)
- anti-Marian antitheses where present

### Relics / holy matter / icons / sacred space
Capture:
- martyr tombs and relic treatment
- sanctified matter / holy places / shrines
- veneration/honor language
- images or image-hostile language where present

### Asceticism
Capture:
- fasting
- virginity / celibacy
- martyrdom spirituality
- monastic precursors and early monastic data

### Nonresistance / politics / military office
Capture:
- war/military participation
- magistracy and imperial service
- oath/idolatry conflicts
- persecution and state obedience tensions

---

## Sect and group harvesting rules

At minimum, every major campaign must watch for evidence on these groups:

- Montanists
- Valentinians
- broader gnostic currents
- Marcionites
- Ebionites / judaizing currents
- Novatians
- Donatists
- Arians and pre-Nicene antecedents where relevant
- “catholic” / “great church” identity where explicitly contrasted

### Group inclusion rule

Add or expand a group only when at least one of the following is true:

1. it has a real doctrinal profile
2. it has real geographic spread
3. it triggers major polemic from orthodox witnesses
4. it creates a schism, discipline crisis, or continuity question
5. it materially affects map interpretation

Do not create tiny ephemeral groups that add no doctrinal or geographic value.

---

## Place inclusion rules

A place belongs in the campaign when it is at least one of the following:

1. episcopal see or major church center
2. place of writing, reception, martyrdom, synod, or controversy
3. mission bridge or correspondence hub
4. stable sect presence
5. major expansion marker

### Minimum expansion places to keep visible over the whole project

At minimum, ensure meaningful coverage for:
- Jerusalem
- Antioch
- Rome
- Alexandria
- Caesarea
- Carthage / North Africa
- Asia Minor hubs
- Edessa / Syriac East
- Arabia
- Aksum / Ethiopia
- Britannia / England
- India traditions and their attestation path

When certainty is low, prefer a broader region identity over a fake precise city.

---

## Token-efficiency rules for AI agents

This section is mandatory.

### Never do this
- “Read the whole corpus and summarize”
- “Search every occurrence of every doctrine in every source”
- repeated full-page scraping of the same work
- duplicate harvesting from both New Advent and CCEL when the same public-domain translation is already captured
- harvesting commentary pages when the primary text page is available

### Always do this
1. define one anchor witness or one anchor controversy
2. define at most 1–2 doctrine families per batch
3. define the place/group targets before retrieval
4. search only for keyword hits and chapter headings first
5. pull only evidence windows, not full books, unless the text is short
6. stop once marginal yield drops

### Target batch size

A normal batch should end around:
- 1 anchor witness or 1 tightly related witness cluster
- 1–2 doctrine families
- 3–10 passages
- 5–25 claim candidates
- 1–5 places materially affected
- 0–3 new groups unless the batch is controversy-focused

### Scratch artifacts

Keep a non-canonical scratch file for the current batch only.
Suggested fields:

- anchor_witness
- doctrine_family
- source_url
- source_language
- query_used
- locator
- excerpt
- evidence_class
- candidate_claims
- candidate_places
- candidate_groups
- certainty_note
- duplicate_check_status

Do not treat the scratch file as canonical.

---

## Deduplication rules before editing TSVs

Before any canonical edit:

1. search for existing `source_id`
2. search for existing `passage_id`
3. search for identical or functionally identical claims
4. search for existing place/person/group rows
5. merge continuity intervals instead of restating them
6. prefer expanding evidence on an existing proposition to inventing a near-duplicate proposition

---

## Stop rules

End the current witness batch when all of the following are true:

- the main doctrine targets were checked
- the main locality ties were captured
- the main relationship ties were captured
- additional hits are repetitive, weak, or purely rhetorical
- at least one review note exists for any non-obvious inference

Then hand off to `data-edit.md`.

---

## Handoff into canonical editing

Once the harvest packet is ready:

1. create or reuse canonical entities
2. create source rows
3. create passage rows
4. create atomic claims
5. create claim-evidence links
6. add review note where inference is not direct
7. run the normal validator and sort/regeneration flow from `data-edit.md`

---

## Quick example: Origen on infant baptism

Correct approach:

1. identify the best source witness for the relevant passage
2. search Greek and Latin witness layers separately
3. record whether the passage is direct, indirect, or textually unstable
4. create a doctrinal claim only at the strength justified by the passage
5. create locality/network claims separately:
   - Origen at Alexandria
   - Origen at Caesarea
   - correspondents / teachers / students where attested
6. only then consider weaker locality inference:
   - “compatible with”
   - “not shown to oppose”
   - not “local consensus proved”

That preserves evidential honesty while still allowing the map to become interesting.

---

## Final quality gate

A harvest batch is ready only if it satisfies all of this:

- primary source anchored
- source language checked when available
- exact locator captured
- doctrine/locality/relationship classes separated correctly
- certainty is not inflated
- duplicate search completed
- batch is small enough that a human can review it quickly

If not, it is not ready for canonical ingestion.
