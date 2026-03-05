# Living Enum Schema

> **Purpose**: Single source of truth for all enumerated/controlled values used across TSV data files.
> When adding a new enum value, **add it here first**, then update UI mappers and the validator as needed.
> Last updated: 2026-03-05

---

## Derived Files

| File | Derived from | Script |
|---|---|---|
| `data/places.tsv` | `cities.tsv` + `archaeology.tsv` | `npm run data:derive-places` |

`places.tsv` must **never** be edited manually. Edit the source files instead.

---

## people.tsv

### `death_type`
| Value | Meaning |
|---|---|
| `martyrdom` | Died as a martyr |
| `natural` | Died of natural causes |
| `unknown` | Manner of death unknown |

### `roles` (semicolon-separated)
| Value | Meaning |
|---|---|
| `adviser` | Counselor to a ruler or bishop |
| `apologist` | Author of apologetic works |
| `apostle` | One of the Twelve or Paul |
| `apostle-figure` | Traditionally given apostolic status |
| `ascetic` | Known for ascetic practice |
| `author` | Significant literary output |
| `benefactor` | Patron or financial supporter |
| `bishop` | Episcopal office holder |
| `chronographer` | Writer of chronological histories |
| `confessor` | Suffered for faith but not killed |
| `convert` | Notable conversion |
| `coworker` | Named associate of an apostle |
| `deacon` | Diaconal office holder |
| `delegate` | Sent on a mission by another |
| `disciple` | Direct student of a teacher |
| `emperor` | Roman emperor |
| `empress` | Roman empress |
| `evangelist` | Preacher / Gospel author |
| `exegete` | Biblical commentator |
| `forerunner` | Precursor figure (e.g. John the Baptist) |
| `founder` | Founded a movement or institution |
| `guardian` | Protector role |
| `hermit` | Solitary ascetic |
| `historian` | Writer of historical works |
| `host` | Provided hospitality |
| `hymnographer` | Composer of hymns |
| `king` | Monarch |
| `layperson` | No clerical office |
| `leader` | General leadership role |
| `librarian` | Keeper of a library |
| `martyr` | Died for the faith |
| `martyr-figure` | Traditionally regarded as martyr |
| `messenger` | Carrier of letters/messages |
| `minister` | General ministry role |
| `missionary` | Itinerant evangelist |
| `monk` | Monastic |
| `official` | Roman or civil official |
| `patriarch` | Patriarch of a major see |
| `patron` | Patron saint or supporter |
| `philosopher` | Trained philosopher |
| `pilgrim` | Religious traveler |
| `poet` | Literary poet |
| `priest` | Presbyteral office holder |
| `prophet` | Prophetic figure |
| `scribe` | Copyist or secretary |
| `teacher` | Known teacher/instructor |
| `theologian` | Systematic thinker |
| `witness` | Eyewitness to events |

---

## works.tsv

### `work_type`
| Value | Meaning |
|---|---|
| `apology` | Formal defense of Christianity |
| `canon` | Canon list or canonical collection |
| `chronicle` | Historical narrative |
| `commentary` | Biblical commentary |
| `dialogue` | Literary dialogue |
| `homily` | Sermon or preached text |
| `letter` | Epistolary text |
| `other` | Apocryphal, gnostic, or unclassifiable |
| `polemic` | Polemical treatise |
| `rule` | Church order or disciplinary text |
| `treatise` | Systematic or theological treatise |

---

## events.tsv

### `event_type`
| Value | Meaning |
|---|---|
| `council` | Synod or ecumenical council |
| `liturgical` | Liturgical development or practice |
| `martyrdom` | Martyrdom of an individual or group |
| `mission` | Missionary activity (noun form) |
| `missionary` | Missionary journey or expansion |
| `other` | Text composition, teaching, or misc. |
| `persecution` | Imperial or local persecution |
| `political` | Political event (war, edict, revolt) |
| `schism` | Schism or heretical movement emergence |

---

## doctrines.tsv

### `category`
| Value | Meaning |
|---|---|
| `canon` | New Testament canon formation |
| `christology` | Nature and person of Christ |
| `ecclesiology` | Church structure and authority |
| `eschatology` | End times, afterlife |
| `liturgy` | Worship practice, images, saints |
| `mariology` | Theology of Mary |
| `pneumatology` | Holy Spirit theology |
| `sacraments` | Baptism, Eucharist, penance |
| `soteriology` | Salvation, atonement, martyrdom |
| `theology-proper` | God, Trinity, creation |

### `controversy_level`
| Value | Meaning |
|---|---|
| `high` | Major controversy with condemnations |
| `medium` | Significant debate but less divisive |
| `low` | Broadly accepted, minimal controversy |

---

## archaeology.tsv

### `site_type`
| Value | Meaning |
|---|---|
| `baptistery` | Baptismal building |
| `basilica` | Church/basilica |
| `catacomb` | Underground burial complex |
| `cave-shrine` | Natural cave with veneration |
| `house-church` | Adapted domestic church |
| `inscription` | Epigraphic find |
| `manuscript-fragment` | Papyrus or parchment find |
| `martyrium` | Shrine over a martyr's grave |
| `necropolis` | Above-ground cemetery |
| `pool` | Ritual or public pool |
| `prison` | Prison site |
| `tomb-shrine` | Tomb with veneration |

### `current_status`
| Value | Meaning |
|---|---|
| `destroyed` | No longer extant |
| `extant` | Standing and accessible |
| `partially_accessible` | Partially open to visitors |
| `partially_excavated` | Only partly excavated |
| `partially_preserved` | Partially surviving |
| `ruins` | Ruined but visible remains |

> **Convention**: use `snake_case` for multi-word status values (not hyphens).

---

## relations.tsv

### `relation_type`
| Value | Meaning | Directionality note |
|---|---|---|
| `affiliated_with` | Person → persuasion membership | One-way: person affiliates with persuasion |
| `affirms` | Source supports a doctrine | One-way |
| `bishop_of` | Person held episcopal office in city | One-way: person → city |
| `co-worker` | Collaborative relationship | Add only **one** direction (alphabetical source) |
| `condemns` | Source opposes a doctrine | One-way |
| `corresponded_with` | Exchange of letters | Add only **one** direction |
| `develops` | Source advances/refines a doctrine | One-way |
| `disciple_of` | Student → teacher | One-way: student is source |
| `first_mentions` | Earliest attestation of doctrine | One-way |
| `mediator_between` | Person mediated a dispute | One-way |
| `mentor_of` | Teacher → protégé | One-way: mentor is source |
| `opposed` | Personal opposition | Add only **one** direction (initiator as source) |
| `ordained` | Ordainer → ordinand | One-way |
| `parent_of` | Biological parent | One-way |
| `participated_in` | Person → event | One-way |
| `successor_of` | Successor → predecessor | One-way |
| `teacher_of` | Teacher → student | One-way: teacher is source |

### `polarity`
| Value | Meaning |
|---|---|
| `supports` | Positive/affirming relationship |
| `opposes` | Negative/opposing relationship |
| `neutral` | Factual, no valence |

### `certainty`
| Value | Meaning |
|---|---|
| `attested` | Directly documented in primary sources |
| `probable` | Strong inference from sources |
| `claimed_tradition` | Later tradition, not contemporary |
| `legendary` | Legendary or hagiographic |
| `unknown` | Insufficient evidence |

---

## persuasions.tsv

### `persuasion_stream`
| Value | Meaning |
|---|---|
| `apostolic` | Mainstream episcopal tradition |
| `ascetic` | Radical ascetic movement |
| `gnostic` | Gnostic or dualist movement |
| `jewish_christian` | Jewish-Christian sect |
| `practice` | Liturgical practice group |
| `prophetic` | Charismatic/prophetic movement |
| `schism` | Formal schism from mainstream |
| `theological_party` | Theological faction within the church |

---

## quotes.tsv

### `stance`
| Value | Meaning |
|---|---|
| `supports` | Supports / affirms the doctrine |
| `opposes` | Opposes / condemns the doctrine |
| `neutral` | Mentions without clear stance |
| `developing` | Doctrine in development; foundational but not yet explicitly stated |

---

## entity_place_footprints.tsv (derived — do not edit)

### `stance`
| Value | Meaning |
|---|---|
| `affirms` | Entity/person in this city affirmed the doctrine |
| `condemns` | Entity/person in this city condemned the doctrine |
| `neutral` | Present in city, no doctrine stance |
| `` (empty) | Non-doctrine footprints (person, work, event, etc.) |

---

## places.tsv (derived — do not edit)

### `place_type`
| Value | Source |
|---|---|
| `city` | From `cities.tsv` |
| `archaeology` | From `archaeology.tsv` |

### `location_precision`
| Value | Meaning |
|---|---|
| `exact` | GPS-level precision |
| `approx_city` | City-center approximation |
| `approx_region` | Regional approximation |
| `approximate` | General area |
| `region_only` | Large region, no specific point |

---

## Conventions

- **Multi-word enum values**: use `snake_case` (e.g. `claimed_tradition`, `partially_preserved`)
- **Compound roles**: use hyphens within a single role token (e.g. `martyr-figure`, `apostle-figure`)
- **Semicolons**: separate multiple values in a single field (e.g. `bishop;theologian`)
- **Empty string**: use for missing/unknown values — never `null` or `"null"`
