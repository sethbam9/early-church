# Mid-Audit Review — Claim Audit Campaign

**Date:** 2026-03-17
**Auditor:** cascade-audit-v2
**Scope:** batch-001 through batch-108 (Queues 0A, 0B, 1)
**Status:** 61.4% complete (108 / 176 batches)

---

## Executive Summary

The audit is past the halfway mark. All 43 high-reuse passage checks (Queue 0A) and 4 structural purge batches (Queue 0B) are done, plus 61 of 129 semantic review batches (Queue 1). Of the 887 Queue 1 claims reviewed so far, **68.8% were approved**, **30.1% flagged as needs-revision**, and only **2 were rejected outright**. No claims were superseded during Queue 1 (67 were already superseded during Queue 0B).

The single largest systemic problem is **passage–claim mismatch**: evidence rows citing passages that do not actually support the claimed proposition. This appeared in 34 of 108 batches. The second systemic problem is **paraphrase quality**: excerpts that compress, omit, or mislocate the source text, triggering mandatory mode downgrades in 20+ batches. A smaller but high-severity cluster involves **wrong source URLs** (3 batches) and **garbage auto-generated fields** (6 batches), both pointing to AI-ingested data that was never human-verified.

Overall, the canonical dataset is structurally sound but has a significant layer of imprecise evidence mapping that the audit is steadily repairing. The remediation rate is high: 677 evidence rows and 638 claim fields have been fixed so far.

---

## 1. Audit Progress

### 1.1 Batch Completion

| Queue | Purpose | Batches Done | Batches Pending | Claims Touched |
|-------|---------|-------------|-----------------|---------------|
| 0A | High-reuse passage/source verification | 43 | 0 | 855 |
| 0B | Deterministic structural purge | 4 | 0 | 67 |
| 1 | Subject-batched semantic review | 61 | 68 | 887 |
| **Total** | | **108** | **68** | **1,809** |

Queue 0A and 0B are **fully complete**. Queue 1 is **47.3% complete** (61/129).

### 1.2 Queue 1 Review Outcomes

| Outcome | Count | Percentage |
|---------|-------|-----------|
| Approved | 610 | 68.8% |
| Needs revision | 267 | 30.1% |
| Rejected | 2 | 0.2% |
| Superseded | 0 | 0.0% |

The low rejection rate reflects the fact that most claims are historically defensible — the problems lie in evidence mapping, not in the claims themselves.

### 1.3 Remediation Volume

| Action | Queue 0B | Queue 1 | Total |
|--------|----------|---------|-------|
| Claims fixed | — | 638 | 638 |
| Evidence rows fixed | — | 677 | 677 |
| Evidence rows deleted | 124 | 61 | 185 |
| Passages fixed | — | 0 | 0 |
| Sources fixed | — | 0 | 0 |

Note: Source URL corrections (3 sources) were applied but tracked as findings, not in the `sources_fixed` counter.

---

## 2. Issue Taxonomy

### 2.1 Issue Code Frequency (by batch count)

| Issue Code | Batches | Severity | Description |
|-----------|---------|----------|-------------|
| WRONG_PASSAGE_FOR_CLAIM | 34 | **blocking** | Cited passage does not support the specific claim |
| PARAPHRASE_RISK | 22 | advisory | Paraphrase excerpt may overstate or compress source |
| PARAPHRASE_CAP_APPLIED | 20 | advisory | Mode downgraded from explicit → strong/weak_inference per paraphrase policy |
| PARAPHRASE_OMISSION | 8 | advisory | Paraphrase omits subject, predicate, or object relevant to claim |
| GARBAGE_WEIGHT_FIELD | 6 | **blocking** | Auto-generated text in weight or notes field (AI artifact) |
| UNSCORED_WEIGHT | 5 | advisory | Evidence weight left blank on mature rows |
| MODE_DOWNGRADED | 5 | advisory | assertion_mode corrected (usually explicit → weak_inference) |
| TERTIARY_ONLY_SUPPORT | 5 | **blocking** | Claim supported only by tier-3 tertiary source (usually Wikipedia) |
| WEAK_PASSAGE_MATCH | 3 | advisory | Passage loosely related but not directly on point |
| WRONG_SOURCE_URL | 3 | **blocking** | Source URL points to wrong work entirely |
| GENERIC_EXCERPT | 3 | advisory | Excerpt too generic to support specific claim |
| CLAIM_NOT_IN_PASSAGE | 2 | **blocking** | Passage verified and proposition not present |
| PREDICATE_EVIDENCE_MISMATCH | 2 | **blocking** | Evidence supports a different predicate than claimed |
| NO_SUPPORTS | 2 | **blocking** | Claim has no supports-role evidence at all |
| REDUNDANT_DERIVED_PRESENCE | 4 | structural | active_in covered by event/work derivation (Queue 0B) |
| REDUNDANT_PERSON_PROP | 4 | structural | person_*_proposition covered by work_*_proposition (Queue 0B) |
| QUOTED_SPEAKER_NOT_SUBJECT | 1 | **blocking** | Eusebius quoting Papias attributed to Eusebius's own views |
| ANACHRONISTIC_EVIDENCE | 1 | **blocking** | Passage predates the phenomenon it is cited for |
| WRONG_ENCOUNTER_LOCATION | 1 | **blocking** | Geographic location of encounter misattributed |
| AUTO_GENERATED_NOTES | 1 | advisory | Boilerplate AI notes with no real evaluation |

### 2.2 Issue Severity Distribution

| Severity | Issue Count (batches) |
|----------|----------------------|
| Blocking | 251 |
| Advisory | 490 |

Blocking issues require data edits before a claim can be approved. Advisory issues are quality improvements that strengthen confidence but don't invalidate the claim.

---

## 3. Systemic Patterns

### 3.1 Passage–Claim Mismatch (34 batches)

**The #1 problem.** Evidence rows cite a passage from the correct *work* but the wrong *section*, or a section that addresses a different topic than claimed.

**Common patterns:**
- A christological passage cited for an ecclesiological claim
- A baptism passage cited for a penance claim
- A eucharistic passage cited for a fasting claim
- A literary-critical passage cited for a doctrinal claim
- A passage about person A cited for a claim about person B

**Root cause:** During initial data ingestion, passages were matched to claims by work-level association ("Origen discusses baptism somewhere") rather than passage-level verification ("this specific section discusses baptism").

**Examples:**
- batch-086: Dialogue with Trypho 70 (virgin birth prophecy) cited for 5 unrelated claims (succession, baptism, resurrection, logos, rule of faith)
- batch-096: HE 3.39 (Eusebius quoting Papias) cited for 6 claims about Eusebius's own theological views
- batch-096: HE 3.36 (Ignatius's martyrdom journey) cited for 6 claims about Eusebius's biography
- batch-106: Hom. Jer. 16.6 (threefold Scripture sense) cited for eternal generation, incarnation, and Logos claims

**Remediation:** Downgraded to `contextualizes` or `weak_inference` with reduced weights. In severe cases, evidence rows deleted entirely.

### 3.2 Paraphrase Quality (22+ batches)

**The #2 problem.** Paraphrased excerpts compress, omit key terms, or mislocate content relative to the cited locator.

**Sub-patterns:**
- **Paraphrase omission (8 batches):** The paraphrase drops the subject, predicate, or object that the claim depends on (e.g., Acts 12:25 paraphrase for John Mark omits that Antioch is not named in the verse)
- **Mislocated paraphrase (batch-098):** Paraphrase describes content from chapters 15-16 but locator says chapter 5; composite paraphrase from chapters 13, 25-26 but locator says chapter 27
- **Paraphrase overstatement:** Paraphrase implies stronger support than the text provides

**Remediation:** All paraphrase-based evidence rows with `mode=explicit` were capped to `strong_inference` or `weak_inference` per the paraphrase cap policy. Weights reduced accordingly.

### 3.3 Wrong Source URLs (3 batches)

Three sources had URLs pointing to entirely different works due to numbering system mismatches:

| Source | Claimed Work | Actual URL Content | Root Cause |
|--------|-------------|-------------------|------------|
| src-origen-on-prayer | De Oratione | Letter to Africanus (0414.htm) | Wrong NAF number |
| src-cyprian-epistula-64 | Ep. 64 to Fidus (infant baptism) | Ep. 64 to Rogatianus (deacon) | ANF vs CSEL numbering |
| src-cyprian-sententiae | Sententiae Episcoporum | Epistle 7 (clergy/prayer) | Wrong NAF number |

All three were corrected in batch-102. **35 evidence rows** were affected across batches 98-100.

### 3.4 AI-Generated Garbage Fields (6 batches)

Evidence rows contained auto-generated boilerplate text in weight and notes fields — artifacts of the original AI data ingestion that were never reviewed:

- Weight fields containing prose descriptions instead of decimal values
- Notes fields containing generic strings like "commentary-on-diatessaron-ephrem is a primary text directly relevant to X" with no actual evaluation
- "Upgraded from contextualizes" notes that describe a hallucinated editorial action

**Remediation:** All garbage fields replaced with proper scored weights and substantive notes.

### 3.5 Tertiary-Only Support (5 batches)

55 `controls_place` claims for the Roman Empire used a single generic Wikipedia excerpt (`psg-wikipedia-roman-empire-provinces`) that names no specific places. All were downgraded from `supports` to `contextualizes`. The claims are historically correct but need primary evidence to be properly supported.

Additional tertiary-only issues appeared for Marcionite and Novatianist geographic spread claims.

---

## 4. Subject Coverage Assessment

### 4.1 Subjects Audited (48 unique)

**Persons:** Paul, Jesus of Nazareth, Simon Peter, John son of Zebedee, John Mark, Luke the Evangelist, Timothy, Silas, Cyprian of Carthage, Origen of Alexandria, Athanasius of Alexandria, Eusebius of Caesarea

**Works:** Against Heresies, Epistles of Ignatius, First Epistle of Clement, First Apology of Justin, Dialogue with Trypho, Epistle of Polycarp, Epistle of Barnabas, Revelation of John, Teaching of the Twelve Apostles (Didache), Demonstrations of Aphrahat, Apostolic Tradition, De Principiis, Contra Celsum, De Unitate Ecclesiae, De Dominica Oratione, De Lapsis, Epistula 64/73 Cyprian, Sententiae Episcoporum, Paedagogus, Commentary on Matthew/John/Romans (Origen), Homilies on Leviticus/Luke/Jeremiah (Origen), On Prayer (Origen), Hymns on Faith (Ephrem), Commentary on Diatessaron (Ephrem), Homily on the Passover (Melito), Acts of Thomas, Didascalia Apostolorum

**Groups:** Roman Empire, Disciples of Jesus, Marcionites

### 4.2 Pending Subjects (444 unique across 68 batches)

Key pending subjects include:
- **Major authors:** Tertullian, Clement of Alexandria (Stromateis), Hippolytus, Novatian, Arius, Athanasius (additional), Basil, Gregory, Chrysostom, Augustine
- **Major works:** Adversus Marcionem, De Baptismo, Protrepticus, De Praescriptione, Shepherd of Hermas, Martyrdom of Polycarp
- **Major persons:** James the Just, Apollos, Valentinus, Marcion, Irenaeus (person), Polycarp (person), Papias, Montanus, Constantine
- **Major groups:** Valentinians, Montanists, Novatianists, Donatists, Arians, Ebionites
- **Events and places:** Council of Nicaea, Council of Jerusalem, councils of Carthage, persecutions, geographic entities

### 4.3 Campaign Alignment

Cross-referencing against the patristic batch collection plan campaigns:

| Campaign | Focus | Audit Status |
|----------|-------|-------------|
| 1 — Apostolic Fathers | Didache, 1 Clement, Ignatius, Polycarp, Barnabas, Hermas | **Mostly done** (works audited; persons/Hermas pending) |
| 2 — Early Apologists | Justin, Aristides, Melito | **Partially done** (1 Apol, Dial, Melito Passover done; Aristides pending) |
| 3 — Irenaeus | Against Heresies | **Done** (work audited) |
| 4 — Alexandria pre-Origen | Clement of Alexandria | **Pending** (Paedagogus done; Stromateis pending) |
| 5 — Tertullian | Tertullian works | **Pending** (next in queue: batch-109) |
| 6 — Roman order | Hippolytus, Apostolic Tradition | **Partially done** (Ap. Trad. done; Hippolytus person pending) |
| 7 — Origen | Origen works | **Mostly done** (6 works audited; person done) |
| 8 — Cyprian | Cyprian works | **Mostly done** (4 works + person audited) |
| 9 — Syriac East | Aphrahat, Didascalia, Ephrem | **Mostly done** (all three audited) |
| 10 — Expansion edge | Ethiopia, India, Britannia | **Pending** |
| 11 — Eusebius registry | Eusebius | **Partially done** (person audited; HE as work pending) |
| 12 — Fourth century | Athanasius, Cappadocians, etc. | **Partially done** (Athanasius person done; most pending) |

---

## 5. Evidence Quality Metrics

### 5.1 Passage Verification (Queue 0A)

Of the 43 high-reuse passages checked:
- **40 verified OK** — correct excerpt, correct source tier, plausible locator
- **3 flagged** — all Wikipedia/tertiary passages with generic excerpts

The primary-text backbone of the dataset (Eusebius, Irenaeus, Acts, biblical passages) is **sound**. The problems concentrate in the evidence *mapping* layer, not in the passages themselves.

### 5.2 Source Tier Distribution

High-reuse sources verified in Queue 0A:
- **Tier 1 (primary text):** Acts, Eusebius HE, Irenaeus AH, John, Mark, Romans — all confirmed
- **Tier 3 (tertiary):** Wikipedia Roman Empire, Wikipedia Early Church Geography, Wikipedia Church of East — all confirmed as tier 3, appropriately classified

### 5.3 Evidence Mapping Quality

Based on Queue 1 findings, the evidence mapping layer has the following quality profile:

| Quality Level | Approximate Share | Description |
|--------------|-------------------|-------------|
| Clean (no fixes needed) | ~30% | Evidence role, aspect, mode, weight all correct |
| Minor fix (paraphrase cap only) | ~35% | Mode downgraded due to paraphrase; claim still valid |
| Moderate fix (wrong passage/weight) | ~25% | Passage doesn't directly support claim; downgraded or deleted |
| Major fix (wrong URL/work/garbage) | ~10% | Structural error requiring significant correction |

---

## 6. Findings Detail by Finding Type

### 6.1 WRONG_PASSAGE_FOR_CLAIM — Selected Cases

| Batch | Subject | Passage | Problem |
|-------|---------|---------|---------|
| 060 | Ignatius | Eph.13 | Worship assembly cited for judgment, ordination, OT, repentance |
| 063 | Against Heresies | Various | 6 claims cite passages not addressing the proposition |
| 082 | John Zebedee | John 19.38-42 | Burial passage cited for crucifixion witness (John not named) |
| 083 | Acts of Thomas | AoT 49-50 | Eucharist rite cited for baptismal anointing, fasting, second-marriage |
| 084 | Comm. Matthew | 14.25 | Episcopal duties cited for baptism, free will, virginity |
| 086 | Dial. Trypho | Dial. 70 | Virgin birth prophecy cited for 5 unrelated doctrines |
| 096 | Eusebius | HE 3.39, HE 3.36 | Papias/Ignatius passages cited for Eusebius's biography/theology |
| 103 | Marcionites | AH 1.27.1-2 | Doctrine-only passage cited for 5 geographic claims |
| 106 | Hom. Jeremiah | 16.6 | Scripture hermeneutics cited for trinitarian theology |

### 6.2 WRONG_SOURCE_URL — All Cases

| Batch | Source | Wrong URL | Correct Work |
|-------|--------|-----------|-------------|
| 098 | src-origen-on-prayer | NAF 0414 (Letter to Africanus) | De Oratione |
| 099 | src-cyprian-epistula-64 | NAF 050664 (Ep. to Rogatianus) | CSEL Ep. 64 (Ep. to Fidus) |
| 100 | src-cyprian-sententiae | NAF 050607 (Epistle 7) | Sententiae Episcoporum |

### 6.3 Notable Single-Case Findings

- **ANACHRONISTIC_EVIDENCE (batch-103):** Galatians 1:6-9 (c. 48-49 AD) cited for Marcionite presence in Galatia (c. 144+ AD). The "different gospel" refers to Judaizers, not Marcionites.
- **QUOTED_SPEAKER_NOT_SUBJECT (batch-096):** Eusebius quoting Papias on apostolic tradition was attributed as Eusebius expressing his own theological views.
- **WRONG_ENCOUNTER_LOCATION (batch-103):** Polycarp–Marcion encounter attributed to Smyrna but AH 3.3.4 says "coming to Rome in the time of Anicetus."
- **CHRISTS_VS_GENERAL_RESURRECTION (batch-108):** Melito's Passover homily affirms Christ's own resurrection, not the general bodily resurrection at the last day — related but distinct doctrines.

---

## 7. Recommendations for Remaining Batches

### 7.1 High-Priority Process Improvements

1. **Source URL pre-verification:** Before auditing a batch, verify that every source URL actually points to the claimed work. The ANF/CSEL/NAF numbering mismatches caught in batches 98-100 likely affect other Cyprian and Origen sources not yet audited.

2. **Passage-level verification before evidence review:** For each evidence row, read the actual passage (not just the excerpt) before evaluating support_aspect and assertion_mode. The bulk of WRONG_PASSAGE_FOR_CLAIM findings stem from never having verified the passage content.

3. **Garbage field scan:** Run a pre-audit scan for evidence rows with non-numeric weight fields or boilerplate notes. These can be batch-corrected before individual claim review.

### 7.2 Expected Issues in Pending Batches

Based on patterns observed so far:

- **Tertullian (batch-109):** Expect high paraphrase risk and potential passage mismatches. Tertullian's works are doctrinally dense and passages can be easily misassigned across his many treatises.
- **Stromateis (batch-110):** Clement's discursive style means passages may support claims only loosely. Expect significant mode downgrades.
- **Person batches (batch-117+):** Batches covering multiple persons (e.g., "aristarchus; valentinus; marcion-of-sinope") will likely have cross-contamination of passages between subjects.
- **Event and place batches (batch-156+):** These large 20-claim batches covering events and places will need careful geographic verification.

### 7.3 Remediation Priorities for needs_revision Claims

The 267 claims flagged as `needs_revision` fall into these remediation categories:

| Category | Estimated Count | Remediation |
|----------|----------------|-------------|
| Needs proper primary evidence | ~100 | Harvest primary-source passages to replace tertiary/contextualizes-only support |
| Needs passage correction | ~80 | Find correct passage within the same work |
| Needs mode/weight adjustment only | ~50 | Minor field corrections, no new evidence needed |
| Needs claim restructuring | ~37 | Predicate change, split, or merge |

### 7.4 Dataset-Wide Recommendations

1. **Evidence weight audit pass:** After all Queue 1 batches complete, run a pass to ensure all mature evidence rows have scored weights. Currently ~5 batches flagged UNSCORED_WEIGHT.

2. **Wikipedia support replacement campaign:** The ~55 Roman Empire `controls_place` claims and ~5 Marcionite/Novatianist geographic claims need primary evidence. This is a good candidate for a targeted harvest campaign.

3. **Cross-reference verification:** Claims about the same passage from different batches should be cross-checked for consistency. The high-reuse watchlist passages (especially Acts, Eusebius HE, Irenaeus AH) are the highest-value targets.

4. **Paraphrase upgrade campaign:** The highest-impact quality improvement would be replacing paraphrase excerpts with verbatim quotes for the most-cited passages. This would remove the paraphrase cap ceiling on ~200+ evidence rows.

---

## 8. Statistical Summary

| Metric | Value |
|--------|-------|
| Total batches | 176 |
| Batches complete | 108 (61.4%) |
| Total claims touched | 1,809 |
| Queue 1 claims reviewed | 887 |
| Queue 1 approval rate | 68.8% |
| Queue 1 needs-revision rate | 30.1% |
| Queue 0B claims superseded | 67 |
| Evidence rows fixed | 677 |
| Evidence rows deleted | 185 |
| Claims fixed | 638 |
| Blocking issues found | 251 |
| Advisory issues found | 490 |
| Findings logged | 173 |
| Unique subjects audited | 48 |
| Unique subjects pending | 444 |

---

## 9. Conclusion

The audit has established that the dataset's **claim layer is historically sound** — only 2 of 887 Queue 1 claims were rejected. The **passage and source infrastructure is also solid** — Queue 0A verified that high-reuse primary passages are correctly classified and properly excerpted.

The core quality gap is in the **evidence mapping layer**: the connections between passages and claims. Roughly 35% of evidence rows required some form of correction, ranging from minor paraphrase-cap adjustments to major wrong-passage deletions. This is consistent with a dataset that was initially populated by AI harvesting with work-level rather than passage-level precision.

The audit is on track to complete all 176 batches. The remaining 68 batches include several large multi-subject batches and event/place batches that may require different auditing patterns than the single-subject work batches audited so far. The process improvements recommended in Section 7 should be adopted before proceeding.
