# Derivation Rules

How the validator generates `data/derived/derived_edges.tsv` from canonical claims.

## Edge Types

### Direct Edges

A single active claim with `object_type=place` and `predicate_id` in `PLACE_LINK_PREDICATES` produces one direct edge.

| Rule ID | Pattern | Relation Kind |
|---------|---------|---------------|
| `bishop_of` | person → bishop_of → place | person_place |
| `active_in` | person → active_in → place | person_place |
| `originated_in` | entity → originated_in → place | entity_place |
| `written_at` | work → written_at → place | work_place |
| `addressed_to_place` | work → addressed_to_place → place | work_place |
| `event_occurs_at` | event → event_occurs_at → place | event_place |
| `group_present_at` | group → group_present_at → place | group_place |
| `controls_place` | group → controls_place → place | group_place |

### Derived Edges

Multi-claim chains that infer proposition→place presence.

| Rule ID | Chain | Certainty |
|---------|-------|-----------|
| `work_affirms_proposition+written_at` | work affirms prop + work written_at place → prop at place | min(claim certainties), capped at probable |
| `person_affirms_proposition+bishop_of` | person affirms prop + person bishop_of place → prop at place | min(claim certainties), capped at probable |
| `person_affirms_proposition+active_in` | person affirms prop + person active_in place → prop at place | min(claim certainties), capped at probable |

The same patterns apply for `opposes`, `develops`, and `mentions` variants.

## Edge ID

Each edge gets a stable hash ID (`edge-XXXX`) based on the from/to entities, predicates, and supporting claim IDs. The hash is deterministic — same inputs always produce the same edge ID.

## Downstream Consumers

- `entity_place_footprints.tsv` — each footprint row references a `derived_edge_id`
- `proposition_place_presence.tsv` — each presence row has pipe-delimited `derived_edge_ids`
- The TypeScript app loads `derived_edges.tsv` and exposes `derivedEdges.getById()` and `derivedEdges.getForEntity()`
