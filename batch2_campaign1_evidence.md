# Campaign 1 — Batch 2 Evidence Packet

## Source texts retrieved

### Ignatius to the Ephesians 18-19 (c. 110)
- Ch.18: "our God, Jesus Christ, was...conceived in the womb by Mary, of the seed of David, but by the Holy Ghost"
- Ch.19: "Now the virginity of Mary was hidden from the prince of this world...three mysteries of renown, which were wrought in silence by God"
- Ch.20: "breaking one and the same bread, which is the medicine of immortality, and the antidote to prevent us from dying"

### Ignatius to the Smyrnaeans 1 (c. 110)
- "He was truly born of a virgin, was baptized by John, in order that all righteousness might be fulfilled by Him"
- Context: combating docetists who deny physical incarnation

### Martyrdom of Polycarp 17-18 (c. 155-160)
- Ch.17: "many desired...to become possessors of his holy flesh" / "the martyrs...we worthily love on account of their extraordinary affection"
- Ch.18: "we afterwards took up his bones, as being more precious than the most exquisite jewels...deposited them in a fitting place...to celebrate the anniversary of his martyrdom"
- Ch.16: "bishop of the Catholic Church which is in Smyrna"

---

## Plan

### topics.tsv — add 2 rows
| topic_id | topic_label | topic_kind | notes |
|---|---|---|---|
| holy-matter | Holy Matter | practice | Honoring sacred material objects: relics, bones, burial places of martyrs and saints. |
| mariology | Mariology | doctrine | Person and role of Mary in Christian theology, including virgin birth and perpetual virginity. |

### dimensions.tsv — add 3 rows
| dimension_id | topic_id | label | scale | description |
|---|---|---|---|---|
| eucharist-immortality | eucharist-practice | Eucharist as medicine of immortality | binary | Whether the Eucharist is described as conferring immortality or incorruption. |
| relic-veneration | holy-matter | Relic veneration | binary | Whether bodily remains of martyrs are treated as precious and gathered for commemoration. |
| virgin-birth | mariology | Virgin birth | binary | Whether Jesus was truly born of a virgin through the Holy Spirit. |

### propositions.tsv — add 3 rows
| proposition_id | topic_id | dimension_id | label | tag | description | search_hint |
|---|---|---|---|---|---|---|
| eucharist-is-medicine-of-immortality | eucharist-practice | eucharist-immortality | The Eucharist is medicine of immortality | eucharist_immortality | The eucharistic bread confers immortality and incorruption on those who receive it; sharing in Christ's deathless life. | Medicine of immortality |
| jesus-born-of-virgin | mariology | virgin-birth | Jesus was truly born of a virgin | virgin_birth | Jesus was truly conceived by the Holy Spirit and born of the virgin Mary, not through natural human generation. | Virgin birth |
| martyrs-relics-honored | holy-matter | relic-veneration | The bones of martyrs are precious and gathered for commemoration | relic_honor | The bodily remains of martyrs are treated as precious, gathered for custody, and commemorated at annual anniversary gatherings. | Relic veneration |

### groups.tsv — add 1 row
| group_id | group_label | group_kind | is_christian | notes |
|---|---|---|---|---|
| docetists | Docetists | sect | true | Early Christian heretical group denying Christ's physical incarnation and real bodily suffering; combated by Ignatius and Polycarp. |

### passages.tsv — add 4 rows
| psg-ignatius-eph-18-19 | src-ignatius-ephesians | ref | Eph.18-19 | "conceived in the womb by Mary...by the Holy Ghost. Now the virginity of Mary was hidden from the prince of this world" | 110 | 110 |
| psg-ignatius-eph-20 | src-ignatius-ephesians | ref | Eph.20 | "breaking one and the same bread, which is the medicine of immortality, and the antidote to prevent us from dying, but [which causes] that we should live for ever in Jesus Christ" | 110 | 110 |
| psg-ignatius-smyrn-1 | src-ignatius-smyrnaeans | ref | Smyrn.1 | "He was truly born of a virgin, was baptized by John, in order that all righteousness might be fulfilled by Him" | 110 | 110 |
| psg-martyrdom-polycarp-17-18 | src-martyrdom-polycarp | ref | Mart.Pol.17-18 | "we afterwards took up his bones, as being more precious than the most exquisite jewels...deposited them in a fitting place...to celebrate the anniversary of his martyrdom" | 155 | 160 |

### claims.tsv — add 8 rows
- clm-docetists-at-antioch: group docetists group_present_at antioch 100-120 probable
- clm-docetists-at-ephesus: group docetists group_present_at ephesus 100-120 attested
- clm-docetists-at-smyrna: group docetists group_present_at smyrna 100-120 attested
- clm-ignatius-eph-affirms-eucharist-immortality: work epistles-of-ignatius work_affirms_proposition eucharist-is-medicine-of-immortality 110 attested supports
- clm-ignatius-eph-affirms-virgin-birth: work epistles-of-ignatius work_affirms_proposition jesus-born-of-virgin 110 attested supports
- clm-ignatius-person-affirms-virgin-birth: person ignatius-of-antioch person_affirms_proposition jesus-born-of-virgin 110 attested supports
- clm-ignatius-smyrn-affirms-virgin-birth: work epistles-of-ignatius work_affirms_proposition jesus-born-of-virgin (covered by eph entry)
- clm-martyrdom-polycarp-affirms-relic-honor: work martyrdom-of-polycarp work_affirms_proposition martyrs-relics-honored 155-160 attested supports

### claim_evidence.tsv — add links
- clm-ignatius-eph-affirms-eucharist-immortality → psg-ignatius-eph-20 supports 1.0
- clm-ignatius-eph-affirms-virgin-birth → psg-ignatius-eph-18-19 supports 1.0
- clm-ignatius-eph-affirms-virgin-birth → psg-ignatius-smyrn-1 supports 1.0
- clm-ignatius-person-affirms-virgin-birth → psg-ignatius-eph-18-19 supports 1.0
- clm-ignatius-person-affirms-virgin-birth → psg-ignatius-smyrn-1 supports 1.0
- clm-martyrdom-polycarp-affirms-relic-honor → psg-martyrdom-polycarp-17-18 supports 1.0
- clm-docetists-at-smyrna → psg-ignatius-smyrn-7 contextualizes 0.8
- clm-docetists-at-ephesus → psg-ignatius-eph-13 contextualizes 0.7
