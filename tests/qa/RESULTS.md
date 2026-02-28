# QFF Status Credit Calculator — QA Results

**Generated:** 2026-02-28  
**Mode:** Dry-run (model only — no Qantas calculator comparison)  
**Routes tested:** 69  

## Summary

| Status | Count |
|--------|-------|
| ✅ Pass | 69 |

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Model output matches expected SC |
| ❌ | Model output does NOT match expected SC (bug) |
| ⚠️ | Model matches expected, but Qantas calculator returned a different value (data discrepancy) |
| 🔵 | Route cannot be verified (airport not found in Qantas calculator) |
| 🟡 | Scraper error during verification |
| ⬜ | Skipped (multi-leg route verified leg-by-leg) |

## Intra-USA Short Haul

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-001 | Intra-USA 0–400mi: LAX→SFO Business | 40 | 40 | `intra_usa_short_0_400` | ✅ |
| AA-002 | Intra-USA 0–400mi: LAX→SFO Discount Economy | 10 | 10 | `intra_usa_short_0_400` | ✅ |
| AA-003 | Intra-USA 0–400mi: JFK→DCA Business | 40 | 40 | `intra_usa_short_0_400` | ✅ |
| AA-004 | Intra-USA 401–750mi: ORD→DCA Business | 40 | 40 | `intra_usa_short_401_750` | ✅ |

## East ↔ West Coast USA/Canada

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-005 | East ↔ West Coast: JFK→LAX Discount Economy | 25 | 25 | `east_west_coast` | ✅ |
| AA-006 | East ↔ West Coast: JFK→LAX Economy | 35 | 35 | `east_west_coast` | ✅ |
| AA-007 | East ↔ West Coast: JFK→LAX Flexible Economy | 50 | 50 | `east_west_coast` | ✅ |
| AA-008 | East ↔ West Coast: JFK→LAX Premium Economy | 50 | 50 | `east_west_coast` | ✅ |
| AA-009 | East ↔ West Coast: JFK→LAX Business | 100 | 100 | `east_west_coast` | ✅ |
| AA-010 | East ↔ West Coast: JFK→LAX First | 150 | 150 | `east_west_coast` | ✅ |
| AA-011 | East ↔ West Coast: LAX→JFK Business (reverse bidirectional) | 100 | 100 | `east_west_coast` | ✅ |
| AA-012 | East ↔ West Coast: YYZ→YVR Business (Canada to Canada) | 100 | 100 | `east_west_coast` | ✅ |
| AA-013 | East ↔ West Coast: BOS→SEA Business | 100 | 100 | `east_west_coast` | ✅ |

## Dallas ↔ East Coast USA/Canada

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-014 | Dallas ↔ East Coast: DFW→JFK Discount Economy | 20 | 20 | `dallas_east_coast` | ✅ |
| AA-015 | Dallas ↔ East Coast: DFW→JFK Business | 80 | 80 | `dallas_east_coast` | ✅ |
| AA-016 | Dallas ↔ East Coast: DFW→MIA Business | 80 | 80 | `dallas_east_coast` | ✅ |
| AA-017 | Dallas ↔ East Coast: DFW→BOS Business | 80 | 80 | `dallas_east_coast` | ✅ |

## Dallas ↔ West Coast USA/Canada

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-018 | Dallas ↔ West Coast: DFW→LAX Business | 100 | 100 | `dallas_west_coast` | ✅ |
| AA-019 | Dallas ↔ West Coast: DFW→SFO Business | 100 | 100 | `dallas_west_coast` | ✅ |
| AA-020 | Dallas ↔ West Coast: DFW→SEA Business | 100 | 100 | `dallas_west_coast` | ✅ |

## Australia East Coast ↔ West Coast USA

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-021 | Australia East Coast ↔ West Coast USA: SYD→LAX Business | 180 | 180 | `aus_east_coast_west_coast_usa` | ✅ |
| AA-022 | Australia East Coast ↔ West Coast USA: SYD→LAX Discount Economy | 45 | 45 | `aus_east_coast_west_coast_usa` | ✅ |
| AA-023 | Australia East Coast ↔ West Coast USA: MEL→SFO Business | 180 | 180 | `aus_east_coast_west_coast_usa` | ✅ |

## Australia East Coast ↔ East Coast USA

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-024 | Australia East Coast ↔ East Coast USA: SYD→JFK Business | 280 | 280 | `aus_east_coast_east_coast_usa` | ✅ |
| AA-025 | Australia East Coast ↔ East Coast USA: SYD→JFK First | 420 | 420 | `aus_east_coast_east_coast_usa` | ✅ |
| AA-026 | Australia East Coast ↔ East Coast USA: BNE→YYZ Business | 280 | 280 | `aus_east_coast_east_coast_usa` | ✅ |

## Australia East Coast ↔ Dallas

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-027 | Australia East Coast ↔ Dallas: SYD→DFW Business | 200 | 200 | `aus_east_coast_dallas` | ✅ |
| AA-028 | Australia East Coast ↔ Dallas: MEL→DFW Business | 200 | 200 | `aus_east_coast_dallas` | ✅ |

## US/Canada Short Haul

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-029 | US/Canada: ORD→YYZ Business (ORD falls to distance band, ~438mi) | 40 | 40 | `intra_usa_short_401_750` | ✅ |
| AA-030 | US/Canada: LGA→YYZ Business (same east_coast region, ~330mi) | 40 | 40 | `intra_usa_short_0_400` | ✅ |
| AA-031 | US/Canada: BOS→YYZ Business (same east_coast region, ~336mi) | 40 | 40 | `intra_usa_short_401_750` | ✅ |

## Multi-Leg Routings

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| AA-032 | Multi-leg: LAX→DFW→LGA→YYZ Business = 100+80+40 | 220 | 220 | `multi-leg` | ✅ |
| AA-033 | Multi-leg: SYD→LAX→JFK Business = 180+100 | 280 | 280 | `multi-leg` | ✅ |
| QF-035 | Multi-leg: SYD→SIN→LHR Business = 120+160 | 280 | 280 | `multi-leg` | ✅ |
| QF-036 | Multi-leg: SYD→DXB→LHR Business = 180+100 | 280 | 280 | `multi-leg` | ✅ |

## Australia ↔ New Zealand (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-001 | QF New Zealand: SYD→AKL Discount Economy | 20 | 20 | `aus_east_coast_new_zealand` | ✅ |
| QF-002 | QF New Zealand: SYD→AKL Economy | 25 | 25 | `aus_east_coast_new_zealand` | ✅ |
| QF-003 | QF New Zealand: SYD→AKL Premium Economy | 45 | 45 | `aus_east_coast_new_zealand` | ✅ |
| QF-004 | QF New Zealand: SYD→AKL Business | 80 | 80 | `aus_east_coast_new_zealand` | ✅ |
| QF-005 | QF New Zealand: SYD→AKL First | 120 | 120 | `aus_east_coast_new_zealand` | ✅ |
| QF-006 | QF New Zealand: MEL→AKL Business | 80 | 80 | `aus_east_coast_new_zealand` | ✅ |

## Australia ↔ Asia (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-007 | QF Singapore: SYD→SIN Business | 120 | 120 | `aus_east_coast_singapore` | ✅ |
| QF-008 | QF Singapore: MEL→SIN Business | 120 | 120 | `aus_east_coast_singapore` | ✅ |
| QF-009 | QF Hong Kong: SYD→HKG Business | 120 | 120 | `aus_east_coast_hong_kong` | ✅ |
| QF-010 | QF Japan: BNE→NRT Business | 120 | 120 | `aus_east_coast_japan` | ✅ |
| QF-011 | QF Japan: SYD→NRT Business | 120 | 120 | `aus_east_coast_japan` | ✅ |
| QF-012 | QF China: SYD→PEK Business | 120 | 120 | `aus_east_coast_china` | ✅ |
| QF-013 | QF India/Sri Lanka: SYD→DEL Business | 120 | 120 | `aus_east_coast_india_sri_lanka` | ✅ |

## Australia ↔ Europe (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-014 | QF Western Europe: SYD→LHR Business | 280 | 280 | `aus_east_coast_western_europe` | ✅ |
| QF-015 | QF Western Europe: MEL→LHR Business | 280 | 280 | `aus_east_coast_western_europe` | ✅ |
| QF-016 | QF Western Europe: SYD→CDG Business | 280 | 280 | `aus_east_coast_western_europe` | ✅ |
| QF-017 | QF Western Europe: SYD→LHR Premium Economy | 150 | 150 | `aus_east_coast_western_europe` | ✅ |
| QF-018 | QF Western Europe: SYD→LHR First | 420 | 420 | `aus_east_coast_western_europe` | ✅ |
| QF-019 | QF Northern Europe: SYD→HEL Business | 280 | 280 | `aus_east_coast_northern_europe` | ✅ |
| QF-020 | QF Southeast Europe: SYD→IST Business | 280 | 280 | `aus_east_coast_southeast_europe` | ✅ |

## Australia ↔ Middle East (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-021 | QF Middle East: SYD→DOH Business | 180 | 180 | `aus_east_coast_middle_east` | ✅ |
| QF-022 | QF Middle East: MEL→DXB Business | 180 | 180 | `aus_east_coast_middle_east` | ✅ |

## Australia ↔ USA (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-023 | QF West Coast USA: SYD→LAX Business | 180 | 180 | `aus_east_coast_west_coast_usa` | ✅ |
| QF-024 | QF Dallas: SYD→DFW Business | 200 | 200 | `aus_east_coast_dallas` | ✅ |

## QF Domestic Australia

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-025 | QF Domestic: SYD→MEL Business (distance band, ~462mi) | 40 | 40 | `qf_0_750` | ✅ |
| QF-026 | QF Domestic: SYD→PER Business | 40 | 40 | `aus_east_coast_perth` | ✅ |
| QF-027 | QF Domestic: SYD→ADL Business (distance band 0–750mi) | 40 | 40 | `qf_0_750` | ✅ |
| QF-028 | QF Domestic: SYD→CNS Business (distance band 751–1500mi) | 60 | 60 | `qf_751_1500` | ✅ |
| QF-029 | QF Domestic: SYD→DRW Business (distance band 1501–2500mi) | 80 | 80 | `qf_1501_2500` | ✅ |

## Intra-Region

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-030 | Intra-Europe: LHR→CDG Business (distance band, ~213mi) | 40 | 40 | `qf_0_750` | ✅ |
| QF-031 | Intra-Asia: HKG→NRT Business (distance band, ~1793mi) | 80 | 80 | `qf_1501_2500` | ✅ |
| QF-032 | Intra-Asia: SIN→BKK Business (distance band, ~882mi) | 60 | 60 | `qf_751_1500` | ✅ |

## Perth Routes (QF)

| ID | Description | Expected SC | Model SC | Table | Status |
|----|-------------|-------------|----------|-------|--------|
| QF-033 | QF Perth: PER→SIN Business | 100 | 100 | `perth_singapore` | ✅ |
| QF-034 | QF Perth: PER→LHR Business | 240 | 240 | `perth_western_europe` | ✅ |

## Notes

- **Source of truth:** [Qantas partner earning tables](https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html)
- **Our `business` tier** maps to "Discount Business" in the Qantas calculator (one tier below the unrestricted "Business" rate)
- **Our `flexible_economy` tier** maps to "Flexible Economy" in the calculator (= 50% of Discount Business rate)
- Routes with 🔵 cannot be verified because QF doesn't operate that route, or the Qantas calculator doesn't recognise the airport
- To re-run: `npm run scrape` (full), `npm run scrape -- --dry-run` (model only)
