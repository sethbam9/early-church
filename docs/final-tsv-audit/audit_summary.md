# final.tsv audit (generated)

- **Rows**: 3835
- **Unique city keys (city_ancient+country_modern)**: 140
- **Unique historic sect tokens**: 58
- **Unique modern mapping tokens**: 34
- **Unique ruling polities**: 19
- **Unique key figure tokens (canonicalized)**: 385

## Issue counts

- **Duplicate (year_bucket+city_ancient+country_modern) keys**: 87
- **location_precision violations**: 32
- **Chronology contradictions (attested but planted_year_scholarly > decade end)**: 48
- **denomination_label_historic misused as presence status**: 33
- **Hybrid city_ancient values containing '/' or ';'**: 33
- **city_ancient values assigned to multiple countries**: 1

## Output files

- inventory_cities.tsv
- city_slug_collisions.tsv
- inventory_sects.tsv
- inventory_sects_raw_values.tsv
- inventory_modern_mappings.tsv
- inventory_modern_mappings_raw_values.tsv
- inventory_polities.tsv
- inventory_key_figures.tsv
- duplicate_row_keys.tsv
- location_precision_violations.tsv
- chronology_contradictions.tsv
- denomination_misused_as_status.tsv
- hybrid_city_names.tsv
- city_ancient_multiple_countries.tsv
- url_inventory.tsv

