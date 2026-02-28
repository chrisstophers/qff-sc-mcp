# CLAUDE.md — qff-sc-mcp

> Qantas Frequent Flyer Status Credit Calculator — MCP Server

---

## Project overview

**qff-sc-mcp** is a public, open-source MCP (Model Context Protocol) server that calculates Qantas Frequent Flyer (QFF) Status Credits for flights across the oneworld alliance. It helps frequent flyers quickly work out how many Status Credits a routing will earn — without manually cross-referencing Qantas's earning tables, route definitions, and distance bands.

- **Language:** TypeScript
- **License:** MIT
- **Transport:** Local stdio (Phase 2) + Remote HTTP via Vercel Edge Functions (Phase 3)
- **Data:** JSON config files (community-maintainable, no external API dependencies)
- **Target users:** Australian frequent flyers, QFF members, travel hackers, points enthusiasts

---

## Teaching mode

This is a learning project. The developer (Chris) is building this to learn how MCP servers work.

**When building each phase:**

1. Explain WHAT you're about to build and WHY before writing any code
2. Explain key MCP concepts as they come up (tools, transports, schemas, etc.)
3. After writing code, explain HOW it works — don't just dump code silently
4. Flag any gotchas or "this is important because..." moments
5. Keep explanations concise and practical — no waffle
6. Use analogies where helpful (e.g. "tools are like API endpoints that Claude can call")

**Tone:** Warm, direct, Australian English. Like a senior dev pair-programming with someone smart who's new to MCP. No jargon without explanation, no condescension.

---

## Build phases

Build this project in 4 phases. Complete each phase fully (including tests) before moving to the next. Explain what you're doing and why at each step.

### Phase 1 — Core business logic

> Goal: Build the calculator engine with zero MCP dependency. Pure TypeScript module that takes inputs and returns Status Credit calculations.

**What to build:**

1. **Airport data module** (`src/data/airports.json` + `src/airports.ts`)
   - Bundled JSON file containing airports served by oneworld alliance airlines
   - Fields: IATA code, ICAO code, city name, country, latitude, longitude
   - **Phase 1 scope:** Start with ~150 airports — every airport explicitly referenced in `regions.json` plus every airport that appears in the QA test routes. This is enough to make the calculator work for all common routes. The full ~2,000 can be expanded later via community contributions.
   - **Data source:** Use the OpenFlights dataset (https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat) — it's a CSV with IATA codes, names, cities, countries, lat/lon. Filter to airports that have a 3-letter IATA code and are referenced in the regions or test routes.
   - Resolver function that accepts IATA code OR city name and returns the airport object
   - City name matching should be case-insensitive and handle common variants (e.g. "New York" matches JFK, LGA, EWR via the aliases in regions.json)

2. **Distance calculator** (`src/distance.ts`)
   - Great circle distance calculation using the Haversine formula
   - Input: two airport codes (or city names, resolved via airport module)
   - Output: distance in statute miles (Qantas uses miles, not kilometres)
   - This is critical for classifying routes into Qantas distance bands (e.g. Intra-USA Short Haul: 0–400 miles, 401–750 miles)

3. **Region definitions** (`src/data/regions.json` + `src/regions.ts`)
   - Maps airports/cities to Qantas earning table regions
   - Qantas regions include (but are not limited to):
     - **West Coast USA/Canada:** Las Vegas, Los Angeles, Phoenix, San Francisco, Seattle, Vancouver
     - **East Coast USA/Canada:** Boston, Charlotte, Miami, New York (JFK/LGA/EWR), Orlando, Toronto (YYZ), Washington D.C. (DCA/IAD)
     - **Dallas:** DFW (note: Qantas treats Dallas as its own region, separate from East/West Coast)
     - **Australia East Coast:** Sydney, Melbourne, Brisbane, Gold Coast
     - **Perth**
     - **Adelaide**
     - **Cairns**
     - **Western Europe, Northern Europe, Southeast Europe**
     - **Southeast Asia, Japan, China, Hong Kong, Singapore, Malaysia, Thailand, Sri Lanka**
     - **Dubai, Doha, Muscat**
     - **New Zealand**
     - And others per the Qantas route definitions page
   - The JSON file should be structured so community contributors can easily add or update region mappings
   - Include a `resolveRegion(airportCode: string): string` function

4. **Earning tables** (`src/data/earning-tables/`)
   - Separate JSON files per airline (start with `american-airlines.json`, then add other oneworld partners)
   - Each file contains:
     - Earn category mappings: booking class → QFF earn category (Discount Economy, Economy, Flexible Economy, Premium Economy, Business, First)
     - Status Credit tables: route pair (origin region → destination region) × earn category → Status Credits
     - Distance-based tables for routes that use distance bands (e.g. Intra-USA Short Haul, "All other flights")
   - Structure the JSON so it mirrors how Qantas publishes the data (route-pair based, with distance-band fallbacks)
   - Reference: https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html

   **Key earning table data for American Airlines (AA-marketed flights, partner rates):**

   | Route | Discount Econ | Economy | Flex Econ | Prem Econ | Business | First |
   |---|---|---|---|---|---|---|
   | East Coast ↔ West Coast USA/Canada | 25 | 35 | 50 | 50 | 100 | 150 |
   | SYD/MEL/BNE/OOL ↔ West Coast USA/Canada | 45 | 60 | 90 | 90 | 180 | 270 |
   | SYD/MEL/BNE/OOL ↔ East Coast USA/Canada | 70 | 95 | 140 | 140 | 280 | 420 |
   | SYD/MEL/BNE/OOL ↔ Dallas | 50 | 70 | 100 | 100 | 200 | 300 |
   | Intra-USA Short Haul (0–400 mi) | 10 | 10 | 20 | 20 | 40 | 60 |
   | Intra-USA Short Haul (401–750 mi) | 10 | 10 | 20 | 20 | 40 | 60 |
   | Dallas ↔ East Coast USA/Canada | 15 | 20 | 30 | 30 | 80* | 80* |
   | Dallas ↔ West Coast USA/Canada | 25 | 35 | 50 | 50 | 100 | 150 |

   *Note: Dallas ↔ East Coast rates need verification against the Qantas calculator — flag with a TODO if uncertain.

   **Important notes on American Airlines:**
   - AA domestic "First Class" credits to QFF at **Business** rates (not First). AA doesn't have true First on domestic routes — their "First" is equivalent to domestic Business.
   - Booking classes R, I, D, C, J, etc. on AA domestic map to "Business" in QFF earn categories
   - Flights operated by American Eagle / Envoy Air still earn provided they have an AA flight number on the ticket

5. **Status Credit calculator** (`src/calculator.ts`)
   - Core function: `calculateStatusCredits(routing: string[], cabinClass: string, airline: string): CalculationResult`
   - Takes an array of airport codes (e.g. `["LAX", "DFW", "LGA", "YYZ"]`), a cabin class, and marketing airline
   - Returns a breakdown per leg: origin, destination, region pair, distance, earn category, Status Credits
   - Plus a total across all legs
   - Must handle:
     - Region-based lookups (e.g. East Coast ↔ West Coast)
     - Distance-based lookups (e.g. Intra-USA Short Haul)
     - Fallback to "All other flights" distance bands when no specific route pair exists
     - Multi-leg routings (split into individual segments)

6. **Route optimiser** (`src/optimiser.ts`)
   - Given an origin and destination, suggest connection cities that maximise Status Credits
   - e.g. LAX → YYZ could suggest LAX → DFW → LGA → YYZ for 220 SCs vs LAX → ORD → YYZ for 200 SCs
   - Start simple: check common hub cities (DFW, ORD, LAX, JFK, LGA, MIA, CLT, PHX, DCA) as connection points
   - Return top 3–5 options ranked by total SCs
   - **Guardrails:**
     - Default max stops: 2 (configurable up to 3 max)
     - Only suggest connections via known airline hub cities (don't suggest connecting through a city the airline doesn't serve or hub at)
     - Include a `hub_airports` field per airline in the earning table JSON (e.g. AA hubs: DFW, ORD, CLT, MIA, PHX, PHL, DCA, JFK, LAX)
     - Flag if a suggested routing would require more than one airline (e.g. AA for one leg, BA for another) — still show it, but note it
     - Include estimated total distance for context (so users can weigh SCs vs. convenience — don't estimate flight time, just show total miles)

**Tests for Phase 1:**
- Unit tests for distance calculation (known distances between major airports)
- Unit tests for region resolution
- Unit tests for SC calculation against known values
- Integration tests for multi-leg routings

### Phase 2 — Local stdio MCP server

> Goal: Wrap the Phase 1 logic in an MCP server that runs locally via stdio. This is the standard MCP pattern — Claude Code or Claude Desktop launches the server as a child process.

**What to build:**

1. **MCP server setup** (`src/server.ts`)
   - Use the official `@modelcontextprotocol/sdk` package
   - stdio transport (standard input/output)
   - Register 4 tools (see Tool Definitions below)

2. **Tool definitions:**

   **Tool 1: `calculate_status_credits`**
   - Description: "Calculate Qantas Frequent Flyer Status Credits for a flight routing. Provide airport codes or city names for each stop, plus the cabin class."
   - Input schema:
     ```json
     {
       "routing": ["LAX", "DFW", "LGA", "YYZ"],
       "cabin_class": "business",
       "airline": "AA"
     }
     ```
   - `routing`: Array of airport codes or city names (minimum 2). Resolved via airport module.
   - `cabin_class`: One of "discount_economy", "economy", "flexible_economy", "premium_economy", "business", "first"
   - `airline`: IATA airline code (e.g. "AA", "BA", "CX", "QR", "MH"). Determines which earning table to use.
   - **Note on cabin class vs booking class:** The tools accept `cabin_class` (the simple human-friendly category like "business" or "economy"). The `earn_category_mapping` in each airline's JSON maps booking class letters (R, I, D, Y, etc.) to these cabin classes — this exists for future use (e.g. a user could eventually input a booking class letter and have it resolved). For v1, the tools only accept the cabin class string directly.
   - Output: Per-leg breakdown + total SCs

   **Tool 2: `lookup_region`**
   - Description: "Look up which Qantas Frequent Flyer earning region an airport belongs to."
   - Input schema:
     ```json
     {
       "airport": "DFW"
     }
     ```
   - `airport`: IATA code or city name
   - Output: Region name, plus list of other airports in the same region

   **Tool 3: `optimise_routing`**
   - Description: "Find the routing between two cities that earns the most Qantas Status Credits, using common oneworld hub connections."
   - Input schema:
     ```json
     {
       "origin": "LAX",
       "destination": "YYZ",
       "cabin_class": "business",
       "airline": "AA",
       "max_stops": 2
     }
     ```
   - Output: Top 3–5 routings ranked by total SCs, with per-leg breakdown for each

   **Tool 4: `compare_routings`**
   - Description: "Compare Status Credits earned on two different routings side by side."
   - Input schema:
     ```json
     {
       "routing_a": ["LAX", "DFW", "ORD", "YYZ"],
       "routing_b": ["LAX", "DFW", "LGA", "YYZ"],
       "cabin_class": "business",
       "airline": "AA"
     }
     ```
   - Output: Side-by-side comparison with per-leg breakdown and total difference

3. **Entry point** (`src/index.ts`)
   - Starts the MCP server on stdio
   - Handles graceful shutdown

4. **npm package configuration** (`package.json`)
   - Name: `qff-sc-mcp`
   - Bin entry so it can be run via `npx qff-sc-mcp`
   - Include all JSON data files in the package

**Explain to Chris:**
- What stdio transport means and how it works
- How MCP tool registration works (schemas, handlers)
- How to test the server locally with Claude Code (`claude mcp add`)
- The lifecycle: client connects → lists tools → calls tool → gets result

**Tests for Phase 2:**
- MCP server starts and responds to tool list requests
- Each tool returns correct results for known inputs
- Error handling: invalid airport codes, missing parameters, unknown airlines

### Phase 3 — Remote HTTP MCP server (Vercel Edge Functions)

> Goal: Deploy the same MCP server as a remote HTTP endpoint on Vercel, so anyone can connect to it via URL without installing anything.

**What to build:**

1. **HTTP transport layer** (`api/mcp.ts` — Vercel API route)
   - Implement the MCP Streamable HTTP transport (as per MCP spec 2025-03-26)
   - Key concept: stdio sends JSON-RPC messages over stdin/stdout as a persistent process. HTTP transport sends the same JSON-RPC messages as HTTP request/response pairs — the protocol is identical, only the "pipe" changes.
   - The endpoint must handle these MCP JSON-RPC methods:
     - `initialize` — client handshake (capabilities negotiation)
     - `tools/list` — returns available tools
     - `tools/call` — executes a tool and returns the result
   - Endpoint: `POST /api/mcp`
   - Must handle Server-Sent Events (SSE) for streaming responses if the MCP client expects it
   - Stateless — no session management needed (each request is self-contained for our use case)

2. **Shared tool handler layer** (`src/tool-handlers.ts`)
   - Extract the tool registration and handling logic from `server.ts` into a shared module
   - Both stdio (`src/server.ts`) and HTTP (`api/mcp.ts`) should import from this shared layer
   - This ensures both transports return identical results — no drift between local and remote

3. **Vercel configuration**
   - `vercel.json` with route config pointing `/api/mcp` to the edge function
   - Edge runtime (not serverless Node) for lower latency — `export const config = { runtime: 'edge' }`
   - Bundle the JSON data files with the edge function
   - Environment: no env vars needed (no secrets, no API keys — it's a public calculator)

4. **Deployment walkthrough**
   - Step-by-step:
     1. Install Vercel CLI: `npm i -g vercel`
     2. Link to GitHub repo: `vercel link`
     3. Deploy: `vercel --prod`
     4. Test the endpoint: `curl -X POST https://your-project.vercel.app/api/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
   - Explain what happens when you deploy (edge network, regions, automatic HTTPS)
   - How someone else would connect to it from Claude Desktop:
     ```json
     {
       "mcpServers": {
         "qff-sc": {
           "type": "url",
           "url": "https://your-project.vercel.app/api/mcp"
         }
       }
     }
     ```
   - How to connect from Claude Code: `claude mcp add qff-sc --transport http https://your-project.vercel.app/api/mcp`

5. **CORS and security**
   - Handle CORS headers for browser-based MCP clients (`Access-Control-Allow-Origin: *`)
   - Basic rate limiting via Vercel's built-in edge config, or a simple in-memory counter
   - No auth needed (it's a public calculator, no sensitive data)
   - Add `X-Powered-By: qff-sc-mcp` header for fun

**Explain to Chris:**
- Difference between stdio and HTTP MCP transports (persistent process vs request/response)
- How Vercel Edge Functions work (V8 isolates, not containers — faster cold starts)
- What "edge" means (runs close to the user, globally distributed across Vercel's network)
- How the MCP client discovers and connects to a remote server (URL-based config)
- Cost implications: Vercel free tier = 100,000 edge function invocations/month. Each SC calculation = 1 invocation. You'd need ~3,300 users per day doing a calculation to hit the limit. Essentially free.
- The mental model: "Your MCP server is now a website. But instead of serving HTML, it serves tool results to AI clients."

**Tests for Phase 3:**
- Remote endpoint responds to MCP `initialize` handshake
- `tools/list` returns all 4 tools with correct schemas
- All 4 tools work over HTTP transport and return identical results to stdio
- Error responses are properly formatted JSON-RPC errors
- CORS headers are present
- Latency is acceptable (should be <100ms for calculations)

### Phase 4 — QA against Qantas calculator

> Goal: Verify the MCP server's output matches the official Qantas calculator at https://www.qantas.com/au/en/frequent-flyer/calculators.html

**What to build:**

1. **QA test suite** (`tests/qa/`)
   - 50+ test routes covering every route category in the earning tables
   - Each test case: origin, destination, airline, cabin class, expected SCs (verified manually or via scraping against the Qantas calculator)
   - Test cases should cover:
     - Every route category pair (East Coast ↔ West Coast, Australia ↔ Dallas, etc.)
     - Every cabin class
     - Every distance band (short haul, medium, long)
     - Edge cases: regional airline operators (American Eagle), codeshare nuances
     - Multiple oneworld partners (AA, BA, CX, QR, MH, JL, etc.)

2. **Automated scraper for QA** (`tests/qa/scraper.ts`)
   - Script that queries the Qantas calculator for a given route/class/airline
   - Compares result against the MCP server's output
   - Flags mismatches with details (expected vs actual, which leg, which table)
   - This is a TEST TOOL only — not part of the production MCP server
   - Note: the Qantas calculator may use JavaScript rendering — use Playwright or Puppeteer if needed

3. **QA report** (`tests/qa/RESULTS.md`)
   - Auto-generated report showing pass/fail for all 50+ routes
   - Include in the repo so contributors can see current accuracy
   - Update this as part of CI or manually before releases

**Test route categories to cover (minimum 50 total, at least 2–3 per category):**

- Intra-USA Short Haul (0–400 mi): e.g. LAX–SFO, JFK–DCA
- Intra-USA Short Haul (401–750 mi): e.g. DFW–ATL, ORD–DCA
- East Coast ↔ West Coast USA/Canada: e.g. JFK–LAX, YYZ–YVR, BOS–SEA
- Dallas ↔ East Coast: e.g. DFW–JFK, DFW–MIA, DFW–BOS
- Dallas ↔ West Coast: e.g. DFW–LAX, DFW–SFO, DFW–SEA
- Australia East Coast ↔ West Coast USA: e.g. SYD–LAX, MEL–SFO
- Australia East Coast ↔ East Coast USA: e.g. SYD–JFK, BNE–YYZ
- Australia East Coast ↔ Dallas: e.g. SYD–DFW, MEL–DFW
- Australia ↔ Asia (multiple partners): SYD–HKG, MEL–SIN, BNE–NRT
- Australia ↔ Europe: SYD–LHR, MEL–CDG
- Australia ↔ Middle East: SYD–DOH, MEL–DXB
- Intra-Europe (BA): LHR–CDG, LHR–FCO
- Intra-Asia: HKG–NRT, SIN–BKK
- US ↔ Canada short-haul: ORD–YYZ, LGA–YYZ, BOS–YYZ
- Multi-leg routings: LAX–DFW–LGA–YYZ, SYD–LAX–JFK

---

## Project structure

```
qff-sc-mcp/
├── CLAUDE.md                    ← This file (Claude Code instructions)
├── README.md                    ← Public-facing project readme
├── CONTRIBUTING.md              ← How to contribute (especially data updates)
├── LICENSE                      ← MIT license
├── package.json
├── tsconfig.json
├── vercel.json                  ← Vercel deployment config (Phase 3)
├── src/
│   ├── index.ts                 ← Entry point (stdio MCP server)
│   ├── server.ts                ← MCP server setup and tool registration (stdio)
│   ├── tool-handlers.ts         ← Shared tool logic (used by both stdio and HTTP)
│   ├── calculator.ts            ← Core SC calculation logic
│   ├── distance.ts              ← Great circle distance (Haversine)
│   ├── airports.ts              ← Airport resolver (code + city name)
│   ├── regions.ts               ← Region classification
│   ├── optimiser.ts             ← Route optimisation
│   ├── types.ts                 ← Shared TypeScript types/interfaces
│   └── data/
│       ├── airports.json        ← ~2,000 oneworld airports with coordinates
│       ├── regions.json         ← Airport → Qantas region mappings
│       └── earning-tables/
│           ├── american-airlines.json
│           ├── british-airways.json
│           ├── cathay-pacific.json
│           ├── japan-airlines.json
│           ├── malaysia-airlines.json
│           ├── qatar-airways.json
│           ├── qantas.json
│           └── ...              ← One file per oneworld partner
├── api/
│   └── mcp.ts                   ← Vercel API route (Phase 3)
├── tests/
│   ├── calculator.test.ts
│   ├── distance.test.ts
│   ├── airports.test.ts
│   ├── regions.test.ts
│   ├── server.test.ts
│   └── qa/
│       ├── routes.json          ← 50+ verified test routes
│       ├── scraper.ts           ← Qantas calculator verification script
│       └── RESULTS.md           ← Auto-generated QA report
└── docs/
    └── earning-tables.md        ← Human-readable summary of earning logic
```

---

## JSON data file formats

### airports.json

```json
{
  "LAX": {
    "iata": "LAX",
    "icao": "KLAX",
    "name": "Los Angeles International Airport",
    "city": "Los Angeles",
    "country": "US",
    "lat": 33.9425,
    "lon": -118.4081
  }
}
```

### regions.json

The regions.json file must include ALL Qantas earning table regions. The example below is the **complete set** — Claude Code should include all of these, not just a subset:

```json
{
  "last_updated": "2026-03-01",
  "regions": {
    "west_coast_usa_canada": {
      "label": "West Coast USA/Canada",
      "airports": ["LAX", "SFO", "SEA", "YVR", "LAS", "PHX", "SAN", "PDX", "SJC"]
    },
    "east_coast_usa_canada": {
      "label": "East Coast USA/Canada",
      "airports": ["JFK", "LGA", "EWR", "BOS", "CLT", "MIA", "FLL", "MCO", "YYZ", "DCA", "IAD", "PHL", "ATL"]
    },
    "dallas": {
      "label": "Dallas",
      "airports": ["DFW"]
    },
    "australia_east_coast": {
      "label": "Sydney, Melbourne, Brisbane, Gold Coast",
      "airports": ["SYD", "MEL", "BNE", "OOL"]
    },
    "perth": {
      "label": "Perth",
      "airports": ["PER"]
    },
    "adelaide": {
      "label": "Adelaide",
      "airports": ["ADL"]
    },
    "cairns": {
      "label": "Cairns",
      "airports": ["CNS"]
    },
    "darwin": {
      "label": "Darwin",
      "airports": ["DRW"]
    },
    "new_zealand": {
      "label": "New Zealand",
      "airports": ["AKL", "WLG", "CHC", "ZQN"]
    },
    "hong_kong": {
      "label": "Hong Kong",
      "airports": ["HKG"]
    },
    "singapore": {
      "label": "Singapore",
      "airports": ["SIN"]
    },
    "japan": {
      "label": "Japan",
      "airports": ["NRT", "HND", "KIX", "NGO", "FUK"]
    },
    "southeast_asia": {
      "label": "Southeast Asia (Bangkok, Kuala Lumpur, Manila, Jakarta, Ho Chi Minh City)",
      "airports": ["BKK", "KUL", "MNL", "CGK", "SGN", "HAN"]
    },
    "china": {
      "label": "China (Beijing, Shanghai, Guangzhou)",
      "airports": ["PEK", "PKX", "PVG", "SHA", "CAN"]
    },
    "india_sri_lanka": {
      "label": "India / Sri Lanka",
      "airports": ["DEL", "BOM", "MAA", "BLR", "CMB"]
    },
    "middle_east": {
      "label": "Middle East (Doha, Dubai, Muscat)",
      "airports": ["DOH", "DXB", "MCT", "AUH", "AMM"]
    },
    "western_europe": {
      "label": "Western Europe (London, Paris, Frankfurt, Amsterdam, Rome, Madrid)",
      "airports": ["LHR", "LGW", "CDG", "FRA", "AMS", "FCO", "MAD", "BCN", "MUC", "ZRH"]
    },
    "northern_europe": {
      "label": "Northern Europe (Helsinki, Stockholm, Copenhagen, Oslo)",
      "airports": ["HEL", "ARN", "CPH", "OSL"]
    },
    "southeast_europe": {
      "label": "Southeast Europe (Istanbul, Athens, Bucharest)",
      "airports": ["IST", "ATH", "OTP"]
    },
    "south_africa": {
      "label": "South Africa",
      "airports": ["JNB", "CPT"]
    },
    "south_america": {
      "label": "South America (Santiago, São Paulo, Buenos Aires, Lima, Bogotá)",
      "airports": ["SCL", "GRU", "EZE", "LIM", "BOG"]
    }
  },
  "aliases": {
    "New York": ["JFK", "LGA", "EWR"],
    "Washington": ["DCA", "IAD"],
    "Los Angeles": ["LAX"],
    "San Francisco": ["SFO", "OAK", "SJC"],
    "London": ["LHR", "LGW", "STN", "LCY"],
    "Tokyo": ["NRT", "HND"],
    "Toronto": ["YYZ", "YTZ"],
    "Paris": ["CDG", "ORY"],
    "Sydney": ["SYD"],
    "Melbourne": ["MEL"],
    "Brisbane": ["BNE"],
    "Dubai": ["DXB"],
    "Singapore": ["SIN"],
    "Hong Kong": ["HKG"]
  }
}
```

**Note:** This region list is based on the Qantas partner earning tables structure. Some airports may appear in multiple context-dependent region groupings on the Qantas site — if in doubt, match the airport to the region as Qantas defines it at https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html. If an airport doesn't appear in any region, the calculator should fall back to the distance-based tables.

### earning-tables/american-airlines.json

```json
{
  "airline": "AA",
  "name": "American Airlines",
  "notes": [
    "AA domestic First Class earns at Business rates in QFF",
    "Flights operated by American Eagle/Envoy Air earn provided they have an AA flight number"
  ],
  "hub_airports": ["DFW", "ORD", "CLT", "MIA", "PHX", "PHL", "DCA", "JFK", "LAX"],
  "earn_category_mapping": {
    "R": "business",
    "I": "business",
    "D": "business",
    "C": "business",
    "J": "business",
    "Y": "economy",
    "B": "economy",
    "H": "flexible_economy",
    "K": "economy",
    "M": "economy",
    "L": "discount_economy",
    "V": "discount_economy",
    "G": "discount_economy",
    "S": "discount_economy",
    "N": "discount_economy",
    "Q": "discount_economy",
    "O": "discount_economy"
  },
  "route_tables": [
    {
      "id": "east_west_coast",
      "origin_region": "east_coast_usa_canada",
      "destination_region": "west_coast_usa_canada",
      "bidirectional": true,
      "status_credits": {
        "discount_economy": 25,
        "economy": 35,
        "flexible_economy": 50,
        "premium_economy": 50,
        "business": 100,
        "first": 150
      },
      "qantas_points": {
        "_note": "Points data included for future use — not used in v1, but avoids restructuring later. Include this field on EVERY route_table and distance_table entry across ALL airline JSON files for consistency.",
        "discount_economy": 625,
        "economy": 1250,
        "flexible_economy": 2500,
        "premium_economy": 2750,
        "business": 3125,
        "first": 3750
      }
    },
    {
      "id": "dallas_west_coast",
      "origin_region": "dallas",
      "destination_region": "west_coast_usa_canada",
      "bidirectional": true,
      "status_credits": {
        "discount_economy": 25,
        "economy": 35,
        "flexible_economy": 50,
        "premium_economy": 50,
        "business": 100,
        "first": 150
      },
      "qantas_points": {
        "discount_economy": 625,
        "economy": 1250,
        "flexible_economy": 2500,
        "premium_economy": 2750,
        "business": 3125,
        "first": 3750
      }
    },
    {
      "id": "dallas_east_coast",
      "origin_region": "dallas",
      "destination_region": "east_coast_usa_canada",
      "bidirectional": true,
      "status_credits": {
        "discount_economy": 15,
        "economy": 20,
        "flexible_economy": 30,
        "premium_economy": 30,
        "business": 80,
        "first": 80
      },
      "qantas_points": {
        "discount_economy": 375,
        "economy": 750,
        "flexible_economy": 1500,
        "premium_economy": 1500,
        "business": 2500,
        "first": 2500
      }
    }
  ],
  "distance_tables": [
    {
      "id": "intra_usa_short_0_400",
      "applies_to": "Intra-USA flights where no specific route table matches",
      "min_miles": 0,
      "max_miles": 400,
      "status_credits": {
        "discount_economy": 10,
        "economy": 10,
        "flexible_economy": 20,
        "premium_economy": 20,
        "business": 40,
        "first": 60
      }
    },
    {
      "id": "intra_usa_short_401_750",
      "applies_to": "Intra-USA flights where no specific route table matches",
      "min_miles": 401,
      "max_miles": 750,
      "status_credits": {
        "discount_economy": 10,
        "economy": 10,
        "flexible_economy": 20,
        "premium_economy": 20,
        "business": 40,
        "first": 60
      }
    },
    {
      "id": "all_other_751_1500",
      "applies_to": "All other flights not matching a specific route table (751–1500 mi)",
      "min_miles": 751,
      "max_miles": 1500,
      "status_credits": {
        "discount_economy": 15,
        "economy": 20,
        "flexible_economy": 30,
        "premium_economy": 30,
        "business": 60,
        "first": 90
      },
      "verified": false,
      "todo": "Verify these values against Qantas calculator — extracted from general pattern, may not be exact"
    },
    {
      "id": "all_other_1501_2500",
      "applies_to": "All other flights not matching a specific route table (1501–2500 mi)",
      "min_miles": 1501,
      "max_miles": 2500,
      "status_credits": {
        "discount_economy": 20,
        "economy": 25,
        "flexible_economy": 40,
        "premium_economy": 40,
        "business": 80,
        "first": 120
      },
      "verified": false,
      "todo": "Verify these values against Qantas calculator"
    },
    {
      "id": "all_other_2501_5000",
      "applies_to": "All other flights not matching a specific route table (2501–5000 mi)",
      "min_miles": 2501,
      "max_miles": 5000,
      "status_credits": {
        "discount_economy": 25,
        "economy": 30,
        "flexible_economy": 50,
        "premium_economy": 50,
        "business": 100,
        "first": 150
      },
      "verified": false,
      "todo": "Verify these values against Qantas calculator"
    },
    {
      "id": "all_other_5001_plus",
      "applies_to": "All other flights not matching a specific route table (5001+ mi)",
      "min_miles": 5001,
      "max_miles": 99999,
      "status_credits": {
        "discount_economy": 30,
        "economy": 35,
        "flexible_economy": 60,
        "premium_economy": 60,
        "business": 120,
        "first": 180
      },
      "verified": false,
      "todo": "Verify these values against Qantas calculator"
    }
  ]
}
```

**Important:** The earning table data provided above is a starting point — it covers the most common AA domestic US routes only. The full earning table JSON for each airline must include ALL route pairs from the Qantas partner earning tables page, including:

- Australia East Coast ↔ West Coast USA/Canada (Business = 180 SCs)
- Australia East Coast ↔ East Coast USA/Canada (Business = 280 SCs)
- Australia East Coast ↔ Dallas (Business = 200 SCs)
- Australia East Coast ↔ Asia routes (Hong Kong, Singapore, Japan, etc.)
- Australia East Coast ↔ Western Europe
- Australia East Coast ↔ Middle East (Doha, Dubai, Muscat)
- Perth ↔ Asia, Middle East
- Adelaide ↔ Asia, Middle East
- Western/Northern/Southeast Europe ↔ Asia, Middle East
- New Zealand routes
- And all other combinations listed at: https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html

The "All other flights" distance bands (added to `distance_tables`) act as the fallback for any route pair not explicitly listed. Some values in the distance-band fallback tables are marked `"verified": false` — these MUST be verified against the Qantas calculator in Phase 4 before release.

Flag any uncertain values with a `"verified": false` field in the JSON. The Phase 4 QA process will catch and correct any discrepancies.

---

## README.md content

Write a README that includes:

1. **What it does** — one-paragraph summary
2. **Quick start** — `npx qff-sc-mcp` and how to add to Claude Code/Claude Desktop
3. **Remote server** — URL endpoint for those who don't want to install locally
4. **Tools available** — table of the 4 tools with brief descriptions
5. **Example usage** — show a natural language query and the tool's response
6. **Supported airlines** — list of oneworld partners currently covered
7. **Data accuracy** — note that it's verified against the Qantas calculator, with link to QA results
8. **Contributing** — how to update earning tables, add airports, fix data
9. **Disclaimer** — not affiliated with Qantas, data may not be 100% current, always verify important calculations on qantas.com

---

## CONTRIBUTING.md content

Write a contributing guide that covers:

1. **Updating earning tables** — how to edit the JSON files, what fields mean, how to verify against Qantas calculator
2. **Adding airports** — how to add missing airports to airports.json
3. **Adding airlines** — how to create a new earning table file for a oneworld partner
4. **Running tests** — how to run the test suite locally
5. **Running QA verification** — how to run the Qantas calculator scraper
6. **Pull request process** — what to include, how to label data vs code changes
7. **Code style** — TypeScript conventions, formatting

---

## Data versioning

Each earning table JSON file should include a `data_version` and `last_verified` field at the top level:

```json
{
  "airline": "AA",
  "name": "American Airlines",
  "data_version": "2025.10",
  "last_verified": "2026-03-01",
  "source_url": "https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables/partner-airline-earning-tables.html",
  "notes": [...]
}
```

- `data_version`: use `YYYY.MM` format based on when Qantas last changed the rates (e.g. `"2019.10"` for the Oct 2019 AA joint venture changes)
- `last_verified`: ISO date when someone last checked this data against the Qantas calculator
- `source_url`: link to the specific Qantas page this data was sourced from

When contributors submit PRs to update earning data, they should update `last_verified` and note what changed in the PR description. This way anyone can see at a glance how fresh the data is.

The `regions.json` and `airports.json` files should also include a `last_updated` field at the top level.

---

## Technical notes

### Core TypeScript types (`src/types.ts`)

Define these types early — they're referenced throughout:

```typescript
// Cabin class as provided by the user in tool inputs
type CabinClass = 'discount_economy' | 'economy' | 'flexible_economy' | 'premium_economy' | 'business' | 'first';

// Result for a single flight leg
interface LegResult {
  origin: string;           // IATA code
  destination: string;      // IATA code
  distance_miles: number;   // Great circle distance
  origin_region: string;    // Qantas region key (e.g. "east_coast_usa_canada")
  destination_region: string;
  cabin_class: CabinClass;
  status_credits: number;
  matched_table: string;    // Which table was used: route table id, distance band id, or "fallback"
}

// Result for a full routing calculation
interface CalculationResult {
  routing: string[];        // The input routing as resolved IATA codes
  airline: string;          // IATA airline code
  cabin_class: CabinClass;
  legs: LegResult[];
  total_status_credits: number;
  total_distance_miles: number;
  warnings: string[];       // e.g. "Distance band 751-1500 not yet verified"
}

// Result for the optimiser
interface OptimiserResult {
  origin: string;
  destination: string;
  airline: string;
  cabin_class: CabinClass;
  options: Array<{
    routing: string[];
    total_status_credits: number;
    total_distance_miles: number;
    legs: LegResult[];
    notes: string[];        // e.g. "Connects via DFW hub"
  }>;
}

// Result for compare_routings
interface ComparisonResult {
  routing_a: CalculationResult;
  routing_b: CalculationResult;
  difference: number;       // routing_a.total - routing_b.total (positive = A earns more)
  recommendation: string;   // e.g. "Routing A earns 20 more SCs"
}
```

### Error handling

Tools should return clear, structured errors for these cases:

- **Unknown airport code:** `"Unknown airport: XYZ. Did you mean XYA?"`  (suggest closest match if possible)
- **Unknown airline:** `"No earning table found for airline XX. Supported airlines: AA, BA, CX, ..."`
- **Invalid cabin class:** `"Invalid cabin class: super_first. Must be one of: discount_economy, economy, ..."`
- **Single airport routing:** `"Routing must contain at least 2 airports (origin and destination)"`
- **Airport not in any region:** `"Airport BZE is not mapped to a Qantas earning region. Status Credits could not be calculated for this leg."`  (return partial results for legs that do work, flag the failed leg)

Return errors as part of the MCP tool result (not as thrown exceptions). Use the MCP `isError: true` field for hard failures, and the `warnings` array in `CalculationResult` for soft issues (like unverified data).

### Node and TypeScript configuration

- **Node:** 20+ (LTS)
- **TypeScript:** 5.x
- **Module system:** ESM (`"type": "module"` in package.json)
- **tsconfig target:** `"ES2022"`
- **Strict mode:** Yes (`"strict": true`)

### Distance calculation

Use the Haversine formula for great circle distance in statute miles:

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c
```

Where R = 3,958.8 miles (Earth's mean radius in statute miles).

Qantas uses statute miles (not nautical miles, not kilometres) for their distance bands.

### Route classification logic

When calculating SCs for a leg, the lookup order should be:

1. **Specific route table match** — check if origin region + destination region has a dedicated table entry (e.g. East Coast ↔ West Coast). Check both directions if `bidirectional: true`.
2. **Distance-based table** — if no specific route table matches, calculate the great circle distance and find the matching distance band. The distance bands are a single unified pool ordered by range (0–400, 401–750, 751–1500, etc.). There is no separate "Intra-USA" vs "All other" distinction in the lookup — they're all distance bands, checked in order. The `applies_to` field is just a human-readable description, not a filter condition.
3. **No match at all** — if the airports aren't in any region AND the distance doesn't match any band (shouldn't happen if bands cover 0–99999), return an error with a clear message.

### City name resolution

When a user provides a city name instead of an IATA code:
- If the city has one major airport (e.g. "Dallas" → DFW), resolve directly
- If the city has multiple airports (e.g. "New York" → JFK, LGA, EWR), either:
  - Use the primary/most common airport (JFK for international, LGA for domestic)
  - Or return all options and let the user choose
- For the `optimise_routing` tool, try all airport options and pick the highest-SC combination

---

## What NOT to build

- No user authentication or accounts
- No persistent storage or databases
- No real-time fare/availability lookups
- No Qantas Points calculations (Status Credits only, for now — Points could be added later since the data is in the same tables)
- No booking functionality
- No flight search or scheduling

---

## Dependencies

Keep dependencies minimal:

- `@modelcontextprotocol/sdk` — MCP server SDK
- `zod` — schema validation (used by MCP SDK)
- `vitest` — testing
- `playwright` — for QA scraper only (dev dependency)
- `typescript` — dev dependency

No heavy frameworks. No Express. No database drivers. Keep it lean.

---

## Reminders

- Always explain what you're doing and why before writing code
- Test each phase before moving on
- Flag uncertain earning table data with `"verified": false`
- Australian English in all user-facing text (README, comments, tool descriptions)
- The Qantas calculator is the source of truth: https://www.qantas.com/au/en/frequent-flyer/calculators.html
- This is a learning project — prioritise clarity over cleverness
