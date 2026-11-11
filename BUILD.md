# GapWise: High-Fidelity Prototype Build Spec

> **For Claude Code.** Work through this file top to bottom in one session, starting from the low-fi project (`GapWise_Low-Fi_MAIN_Prototype`). Read `CLAUDE.md` and `AGENTS.md` first. Use the `Makefile` targets for every command so Davis can re-run them. Stop at each **🛑 Checkpoint** and wait for Davis before continuing. Do not skip acceptance checks: run them, and fix what fails.

---

## 0. Goal and hard constraints

**Goal:** a hosted, interactive hi-fi prototype that the teaching staff can explore without help, an account, or extra permissions. It must cover the core workflows from Milestone 2's HTA: **decide right now**, **plan ahead**, **recover when the day changes**, and **manage activities**. It does this through three ready-made student personas and real Tulane campus maps.

**Hard constraints (approved scope; do not deviate):**

1. **No calendar imports.** No Google, Outlook, Apple, or Canvas connections, no OAuth, no feed parsing. Remove any copy that promises syncing.
2. **No backend, no database.** Static site only. The schedule lives in React state + `sessionStorage` (key `gw`) as today. Nothing is sent anywhere except map-tile requests.
3. **No device location.** Never call `navigator.geolocation`. "Where you are" is always the building of the previous commitment.
4. **No API keys, no paid services, no analytics.** Graders must be able to open the link cold.
5. **Keep the fit logic.** `evaluate`, `evaluateSequence`, `rank`, `combos`, gap/assignment reconciliation, and the fit thresholds are unchanged. The only logic change is *where travel minutes come from* (§3).
6. **Keep the design system** in `src/index.css` (tokens, type, radii). Polish uses these tokens, not a new look.

Keep a running file `docs/ai-log.md`. Add an entry whenever you propose something meaningful, and record what Davis accepted, changed, or rejected and why. One line each is fine. Davis needs this for report section 3.2.

---

## Phase 1: Baseline

1. `make setup` then `make check`. Record which unit and e2e tests pass in `docs/ai-log.md` before you change anything.
2. Add a `webServer` block to `playwright.config.ts` so `make e2e` starts `vite preview` on port 3000 by itself (`reuseExistingServer: true`).
3. Make `vite.config.ts` read the base path from `BASE_PATH` (falling back to the existing `FIGMA_PUBLIC_URL` logic) so the same build can be hosted at a sub-path.

**Done when:** `make check` runs end to end with no manual server.

---

## Phase 2: Real places and walking times (`make geodata`)

Write `scripts/geodata.mjs`. Run it through `make geodata`. It writes three committed files under `src/gw/data/`. At runtime nothing calls a routing or geocoding service.

| File | Contents |
|---|---|
| `places.json` | `{ name, short, lat, lng, source, verified }` for every place in the table below |
| `walking.json` | `{ [from]: { [to]: minutes } }`, symmetric, ceil to whole minutes, `0` on the diagonal |
| `routes.geojson` | One `LineString` per unordered pair, walking path geometry, `properties: { from, to, minutes, meters }` |

**Places** (display name → what to geocode). Geocode with Nominatim (`https://nominatim.openstreetmap.org/search?format=jsonv2&q=…`), max 1 request/second, `User-Agent: GapWise-HCI-prototype`. Never send Davis's email or any personal data. Bias every query to Tulane's uptown campus, and reject any result more than 1.5 km from Gibson Hall.

| Display name | Query hint | Notes |
|---|---|---|
| Gibson Hall | Gibson Hall, Tulane University | |
| Dinwiddie Hall | Dinwiddie Hall, Tulane University | Ryan's CMPS 3140 (room 108) |
| Newcomb Hall | Newcomb Hall, Tulane University | |
| LBC | Lavin-Bernick Center, Tulane University | dining + mail/package center |
| The Commons | The Commons dining hall, Tulane University | verify |
| Howard-Tilton Library | Howard-Tilton Memorial Library, Tulane | printing |
| Reily Rec Center | Reily Student Recreation Center, Tulane | |
| Richardson Memorial | Richardson Memorial Hall, Tulane | |
| Stanley Thomas Hall | Stanley Thomas Hall, Tulane | CS |
| Goldring/Woldenberg | Goldring/Woldenberg Business Complex (Freeman School of Business), Tulane | "Business School"; Stella's FINE 3010 (room 116); printing + coffee in scenario 2 |
| Boggs Center | Boggs Center for Energy and Biotechnology, Tulane | Stella's SPHU 2160 (room 239) |
| Tilton Memorial Hall | Tilton Memorial Hall, Tulane | Stella's SPHU 3110 (room 301); not the Howard-Tilton Library |
| Richardson Building | Richardson Building, Tulane | Ryan's MATH 3090 (room 108); a different building from Richardson Memorial Hall. Verify. |
| Wilson Center | Wilson Center, Tulane Athletics | team meetings, lifts |
| Goldring Tennis Center | Goldring Tennis Center, Tulane | practice |
| PJ's Coffee | on-campus PJ's Coffee nearest LBC | verify; leave `verified:false` if unsure |
| Shuttle stop | Tulane shuttle stop nearest LBC | verify; Davis picks the real stop |

**Walking times:** use the FOSSGIS OSRM foot router (`https://routing.openstreetmap.de/routed-foot/`). Use the `table` service for the minute matrix and the `route` service (`overview=full&geometries=geojson`) for each pair's geometry, ≥ 1 s between calls. Confirm the response `code` is `"Ok"`. The path segment for the profile has varied (`/route/v1/driving/` vs `/route/v1/foot/`), so try both. If routing is unavailable, fall back to straight-line distance × 1.35 ÷ 80 m/min, mark those pairs `"estimated": true`, and say so in `docs/ai-log.md`.

Minimum 2 minutes for any non-identical pair, matching the current `travel()`.

Also write `scripts/places-check.mjs` (`make places-check`). It renders a Playwright screenshot `docs/places-check.png` of the real map with every place labeled, plus a table of names, coordinates, and `verified` flags.

### 🛑 Checkpoint A
Show Davis `docs/places-check.png` and the table. He confirms or corrects each pin, especially PJ's, The Commons, and the shuttle stop. Apply his fixes directly in `places.json` (set `verified: true`, `source: "Davis"`). Then re-run `make geodata ONLY=walking` so times reflect corrected coordinates.

---

## Phase 3: Swap the travel model

1. In `src/gw/logic.ts`, replace the grid `LOCS` and the `Math.hypot` calculation in `travel()` with a lookup into `walking.json`. Keep the **same signature** and the same pace/accessibility multipliers (`relaxed 1.25 · normal 1 · brisk 0.85`, `accessible × 1.15`), then `Math.ceil`, min 2. Unknown places return 0 as before.
2. `LOC_NAMES` = the display names from `places.json`.
3. Rename any old location strings in `DEFAULT_COMMITMENTS`, `BASE_ACTS`, and tests (`"Athletics facility"` → `"Wilson Center"` or `"Goldring Tennis Center"` as appropriate).
4. Update `tests/logic.test.ts`. Keep every *invariant* test (pace ordering, accessibility, no overlap, fit thresholds). Replace hard-coded minute expectations with values read from `walking.json`, so they don't break when coordinates are corrected.
5. Delete `src/gw/campus.ts`'s illustrative `CAMPUS_PLACES`, `CAMPUS_BUILDINGS`, and the hand-drawn route path once Phase 5 no longer needs them.

**Done when:** `make test` passes and no file still uses the old grid coordinates.

---

## Phase 4: Personas

Personas replace calendar import. They are the "imported" schedules. Their classes are **real Tulane sections from a past term**.

### 4.0 Real Tulane sections (`docs/tulane-sections.csv`)

Tulane's schedule of classes (classschedule.tulane.edu) shows building and room only after Tulane sign-in. **Do not attempt to log in, scrape, or automate it.** Davis fills `docs/tulane-sections.csv` by hand from one past term (one term for all rows, e.g. Spring 2026). Course codes and titles come from the public catalog (catalog.tulane.edu).

1. **Before starting Phase 4**, check the CSV. If any row is missing `days`, `start`, `end`, `building`, or `room`, stop and ask Davis to fill it. `days` uses `M T W Th F`; times are `HH:MM` 24-hour.
2. Use each row as a recurring class commitment: `title` = `"{course} · {title}"` (e.g. `SPHU 3170 · Foundations of Epidemiology`), `location` = the building, new field `room` = the room, `recurrence` from `days`, `source: "Canvas"`. Show the room on commitment blocks and in gap details ("Next: FINE 3010 at 12:00, Goldring/Woldenberg 116"). Walking time uses the building only.
3. **Every building in the CSV must exist in `places.json`.** Add any new ones to the Phase 2 places table and re-run `make geodata`. If Phase 2 is already done, include them at **🛑 Checkpoint A** or do a quick second pin check.
4. **Assumed locations:** every CMPS section, plus MATH 2170, is Stanley Thomas Hall, room 302. The one exception is CMPS 3140, which is in Dinwiddie Hall, room 108. MATH 6080 is in Gibson Hall, room 310. All buildings and rooms in the CSV come from Davis and are pre-filled; he only adds term, section, days and times. Keep it even if it makes two CMPS classes share a room on different personas' schedules. Mention it in `docs/ACCESS.md` as a known simplification.
5. **Never store instructor names** (also login-only data, and not needed).
6. The real times replace the class rows in the tables below. Then re-fit the *non-class* rows (practice, shifts, research block, shuttle) around them so nothing overlaps, keeping each one's duration and day pattern. Prefer this order: keep the class times exactly, then move the persona's own commitments, then (last resort) change which day an activity lands on.
7. The Milestone 2 scenarios depend on specific timing patterns. Use the slot names below to pick the matching sections. If real sections can't reproduce a pattern, tell Davis which outcome in 4.2 changed and why, rather than inventing times.

| Persona | Slot(s) | Pattern needed for the scenario |
|---|---|---|
| Ryan | `first` → `second` | Back to back on the same day with ≤ 15 min between, ideally in different buildings (scenario 1's short gap) |
| Stella | `epi` → `finance` | Same day with about 60 min between, ideally on opposite sides of campus (scenario 2) |
| Chloe | `seminar` → `afternoon` → research meeting at 3:00 | `afternoon` starts around 1:00 PM on the same day as `seminar`, leaving a gap that grows when it's canceled (scenario 3) |

### 4.1 Data
Create `src/gw/personas.ts` exporting `PERSONAS: Record<"stella" | "ryan" | "chloe", Persona>`:

```ts
type Persona = {
  id: string; name: string; tagline: string; bio: string;       // picker copy
  now: number;                                                  // demo clock on load
  prefs: Partial<Prefs>;
  commitments: Commitment[];                                    // days 0–6 (Wed→Tue, see DATE_LABELS)
  activities: Activity[];
  tasks: string[];                                              // suggested things to try, shown in the picker + help
}
```

Add an optional `room?: string` field (display only) and a cosmetic `source?: "Outlook" | "Google" | "Apple" | "Canvas" | "Teamworks" | "Manual"` field to `Commitment`. Show it as a small chip on commitment blocks. It represents the calendars these students already use (Milestone 2 §2.2.1) without connecting to any of them. Settings shows: **"Schedule: demo data for {name} · Stored only in this browser tab."**

Use `seriesId` + `recurrence` for repeating classes so editing one occurrence behaves as it does today. Times below are local. Day 0 = Wednesday. **Days with no rows are intentionally open.** If any row fails `commitmentError`, fix the time and tell Davis.

**Class rows (marked ‡) are placeholders.** Their real days, times, building and room come from `docs/tulane-sections.csv` (§4.0). The placeholder values show the intended pattern only.

#### Student-Athlete Stella: junior, Public Health, tennis, lives on campus
Prefs: `buffer 5`, `pace "normal"`, `style "moment"`. Demo clock: **Wed 11:00 AM**.
Tagline: *"Packed days. Strict about practice, relaxed about class."*

| Day | Time | Title | Place | Type | Source | Buffer |
|---|---|---|---|---|---|---|
| Wed, Fri, Mon | 7:00–8:15 | Team lift | Wilson Center | practice | Teamworks | 10 |
| Wed, Fri, Mon | 10:00–11:00 | ‡ SPHU 3170 · Foundations of Epidemiology (`epi`) | Howard-Tilton Library B11 | class | Canvas | |
| Wed, Mon | 12:00–1:15 | ‡ FINE 3010 · Financial Management (`finance`) | Goldring/Woldenberg 116 | class | Canvas | |
| Wed, Thu, Mon, Tue | 3:30–6:00 | Tennis practice | Goldring Tennis Center | practice | Teamworks | 15 |
| Wed | 7:00–7:45 PM | Team meeting | Wilson Center | meeting | Teamworks | 10 |
| Thu, Tue | 9:30–10:45 | ‡ SPHU 2160 · Biostatistics in Public Health (`biostat`) | Boggs Center 239 | class | Canvas | |
| Thu, Tue | 11:00–12:15 | ‡ SPHU 3110 · Social and Behavioral Perspectives in Public Health (`social`) | Tilton Memorial Hall 301 | class | Canvas | |
| Thu, Tue | 12:30–2:30 | Front-desk shift | LBC | work | Manual | |
| Fri | 2:00–4:00 | Tennis practice | Goldring Tennis Center | practice | Teamworks | 15 |
| Sat | 10:00–2:00 | Match vs. Rice | Goldring Tennis Center | practice | Teamworks | 30 |

Activities:
- **Print assignment** · 10 min · must · due Wed 12:30 PM · Goldring/Woldenberg or Howard-Tilton Library · errand
- **Coffee** · 10 min · optional · Goldring/Woldenberg or PJ's Coffee · food · low energy
- **Lunch** · 30 min · should · LBC or The Commons · preferred 11:00–2:00 · food
- **Conditioning workout** · 45 min · should · Reily Rec Center · move · high energy
- **Epidemiology problem set** · 60 min · must · due Fri 11:59 PM · any spot · study · setup 5
- **Pick up package** · 10 min · should · LBC · errand
- **Stretch / ice** · 20 min · optional · Wilson Center · rest · low energy
- **Call home** · 15 min · optional · anywhere · rest

Tasks shown in picker: *"See what fits before Finance" · "Raise your buffer for Finance to 10 min" · "Check why lunch is Tight"*.

#### Routine Ryan: sophomore, Computer Science, lives on campus
Prefs: `buffer 0`, `pace "brisk"`, `style "ahead"`. Demo clock: **Wed 10:50 AM**.
Tagline: *"Help me only when it's actually hard."*

| Day | Time | Title | Place | Type | Source |
|---|---|---|---|---|---|
| Wed, Thu, Fri, Mon, Tue | 8:00–9:30 | Research block | Stanley Thomas Hall | research | Outlook |
| Wed, Fri, Mon | 9:55–10:50 | ‡ MATH 2170 · Intro To Discrete Math (`first`) | Stanley Thomas Hall 302 | class | Canvas |
| Wed, Fri, Mon | 11:00–11:50 | ‡ CMPS 3140 · Intro Artificial Intelligence (`second`) | Dinwiddie Hall 108 | class | Canvas |
| Wed, Mon | 2:00–3:15 | ‡ CMPS 3300 · Software Studio (`studio`) | Stanley Thomas Hall 302 | class | Canvas |
| Wed | 1:00–1:30 | Advisor meeting | Gibson Hall | meeting | Outlook |
| Thu, Tue | 11:00–12:15 | ‡ MATH 3090 · Linear Algebra (`linalg`) | Richardson Building 108 | class | Canvas |
| Thu, Tue | 9:30–10:45 | ‡ CMPS 2200 · Intro to Algorithms (`algorithms`) | Stanley Thomas Hall 302 | class | Canvas |

Activities (deliberately few; Ryan leaves small things off his calendar):
- **Lunch** · 30 min · should · LBC or The Commons · preferred 11:30–1:30 · food
- **Read assigned paper** · 30 min · should · any spot · study · medium energy
- **Submit ML lab** · 20 min · must · due Thu 11:59 PM · any spot · study
- **Coffee** · 10 min · optional · PJ's Coffee or LBC · food
- **Rest in room** · 30 min · optional · anywhere · rest · low energy (P1 went back to rest when a meeting was canceled, §2.2.6)

Tasks: *"Open Right Now between Discrete Math and Intro to AI" · "Cancel the 1:00 advisor meeting and keep the merged gap open"*.

#### Commuter Chloe: first-year master's, lives off campus, takes the shuttle
Prefs: `buffer 10`, `pace "normal"`, `style "ahead"`. Demo clock: **Wed 12:00 PM**.
Tagline: *"Stay on campus or go home? Catch conflicts before they happen."*

| Day | Time | Title | Place | Type | Source |
|---|---|---|---|---|---|
| Wed, Mon | 9:40–9:45 | Shuttle arrives | Shuttle stop | shuttle | Manual |
| Wed, Mon | 10:00–12:00 | ‡ CMPS 6160 · Introduction to Data Science (`seminar`) | Stanley Thomas Hall 302 | class | Canvas |
| Wed, Mon | 1:00–2:15 | ‡ CMPS 6240 · Intro to Machine Learning (`afternoon`) | Stanley Thomas Hall 302 | class | Canvas |
| Wed | 3:00–4:00 | Research meeting | Stanley Thomas Hall | meeting | Outlook |
| Wed | 5:30–5:35 | Shuttle departs | Shuttle stop | shuttle | Manual |
| Mon | 4:45–4:50 | Shuttle departs | Shuttle stop | shuttle | Manual |
| Fri, Tue | 8:40–8:45 | Shuttle arrives | Shuttle stop | shuttle | Manual |
| Fri, Tue | 9:00–12:00 | Research assistant hours | Howard-Tilton Library | work | Google |
| Fri, Tue | 1:00–2:15 | ‡ MATH 6080 · Intro to Statistical Inference (`stats`) | Gibson Hall 310 | class | Canvas |
| Thu | 6:00–8:30 PM | ‡ CMPS 6360 · Data Visualization (`viz`, if it meets on an otherwise-open day, keep Thursday mostly open) | Stanley Thomas Hall 302 | class | Canvas |
| Fri, Tue | 3:00–3:05 | Shuttle departs | Shuttle stop | shuttle | Manual |

Saturday and Sunday are open, and Thursday is open until the evening: Chloe's "might work, might go to an event" days (Milestone 2 §2.2.2, P6).

Activities:
- **Lunch** · 30 min · should · The Commons or LBC · preferred 12:00–2:00 · food
- **Study for midterm** · 60 min · must · due Fri 11:59 PM · Howard-Tilton Library · study · setup 5
- **Workout** · 45 min · should · Reily Rec Center · move · high energy
- **Data science talk** · 45 min · optional · Stanley Thomas Hall · **required window 4:15–5:15 PM** · study (the window applies every day, but only Wednesday has a gap that covers it)
- **Go home and come back** · 75 min · optional · Shuttle stop · rest · notes "Round trip on the shuttle" (this deliberately models the cost of a round trip, §2.2.4)
- **Coffee** · 10 min · optional · PJ's Coffee · food

Tasks: *"Your 1:00 CMPS 6240 class was canceled. Find what now fits" · "Keep the new gap open" · "Plan Thursday, or don't"*.

### 4.2 Scenario outcomes to verify (and tune)
Real walking times will differ from the Milestone 2 scenario text. If an outcome below doesn't hold, **tune activity durations or buffers, never walking times or fit logic**, and record the final numbers in `docs/ai-log.md`.

| Persona | Setup | Must be true |
|---|---|---|
| Ryan | Wed 10:50 | Right Now recommends no extra activity: "Head to Dinwiddie Hall." Nothing is suggested. |
| Stella | Wed 11:00, then set Finance buffer to 10 | Usable time drops by 5. Print and Coffee at Goldring/Woldenberg show **no extra travel** and **Comfortable**. Lunch is **Tight**. Conditioning workout is **Doesn't fit** with a later gap offered. A Print + Coffee combo is offered. |
| Chloe | Wed 12:00 | Workout is **Doesn't fit** in the 12:00–1:00 gap. After marking the `afternoon` class (CMPS 6240) canceled, the change banner appears, the gaps merge, and Workout fits. "Keep this gap open" is one tap. The data science talk is offered only in Wednesday's 4:00–5:30 gap. |
| Ryan | Wed, cancel Advisor meeting | The 11:50–1:00 and 1:30–2:00 gaps merge into one. The banner reports the new length. Rest in room is offered, and Keep open works. |

### 4.3 Picker, switching, deep links
- First run (and **Settings → Switch student**) shows a **"Explore GapWise as…"** screen: three persona cards (name, tagline, two-line bio from Milestone 2 §03, suggested tasks), plus a small **"Start with an empty schedule"** link that uses the existing manual forms. This replaces the calendar step in onboarding. Keep the buffer step.
- Switching persona resets state to that persona (confirm first if the current state has changes).
- Support deep links read once on load: `?persona=stella&t=11:00&tab=today|plan|map|acts|settings&day=0`. Optional: `&gap=<key>&sheet=why:<activityId>`. Graders (3.3) and `make figures` use these.

**Done when:** each persona loads from the picker and from its deep link, and every 4.2 row is verified manually.

### 🛑 Checkpoint B
Show Davis a screenshot of each persona's Right Now view plus the 4.2 table with final numbers. He approves the schedules or edits them.

---

## Phase 5: Real maps

**Library:** `maplibre-gl` (pin an exact version; import its CSS). **Tiles:** OpenFreeMap vector style `https://tiles.openfreemap.org/styles/liberty`. No key or account needed. Keep the attribution control visible (OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors). If that style fails to load, try `positron` or `bright` from the same host before anything else.

Build `src/gw/map/CampusMapGL.tsx`: one wrapper used in two modes.

**Map tab (`MapExplorer` / `MapPanel`):** replace the SVG `CampusMap` with interactive `CampusMapGL`.
- Fit bounds to campus places on load (padding 48). Lock max bounds to roughly 1.5 km around campus so users can't get lost.
- Layers: place markers (HTML markers with the existing `ActIcon` styling), the selected route from `routes.geojson` (teal `--gw-teal`, 4 px, dashed for the detour leg), and numbered option pins that match the option list.
- Keep the existing filter chips (`MapFilter`). Selecting an option in the list highlights its pin and route; clicking a pin selects the option in the list.

**Right Now strip (`NowMapStrip`):** a small non-interactive `CampusMapGL` (`interactive: false`, ~120 px tall) inside the Now card. Show current place → next class route, plus numbered pins for the top options. On-route options sit on the line; detours visibly leave it. Tap → opens the Map tab with the same gap selected. **Hide the strip when nothing fits** (Ryan's quiet state).

**Plan tab:** no persistent map. Gap details keep the route view, using the real route geometry.

**Accessibility and failure:** the map canvas is `aria-hidden`. Every fact it shows (place, walk minutes, detour) is also in the text list. If tiles fail to load (offline, blocked), show *"Map couldn't load. Walking times still work."* in place of the map. The app must remain fully usable. Respect `prefers-reduced-motion` (no `flyTo` animation).

**Done when:** both modes render on desktop and mobile Playwright projects, and the old SVG map code is deleted.

---

## Phase 6: Hi-fi polish

Polish what's there; don't redesign.
- Consistent spacing/type from the existing tokens. Real empty, loading, and error states. Focus rings on every control. 44 px targets.
- Copy pass: remove any wording implying sync or import (Settings, onboarding, empty states). Use Milestone 2's voice: calm, never "wasted time." Keep "You don't have to fill every gap."
- A small **"?" help sheet** on each tab: what this tab is for, plus the current persona's suggested tasks. This lets graders explore "without your team having to explain every step."
- Color contrast ≥ 4.5:1 for text. Fit badges always carry icon + word. Check at 390 px and 1440 px.

---

## Phase 7: Tests

- **Unit (`make test`):** existing invariant tests pass with real walking data. Add one test per persona asserting every 4.2 row through the logic functions (no UI).
- **E2E (`make e2e`):** add `tests/browser/personas.spec.ts`. For each persona, open via deep link and click through its 4.2 scenario in both desktop and mobile projects. Add one test that blocks tile requests (`page.route('**/tiles.openfreemap.org/**', r => r.abort())`) and asserts the fallback message and that the options list still works.
- Remove or rewrite any existing e2e test tied to the deleted SVG map.

**Done when:** `make check` is green.

---

## Phase 8: Figures and access notes (report §3.1 and §3.3)

Write `scripts/figures.mjs` (`make figures`). It saves PNGs at `deviceScaleFactor: 2` to `docs/figures/` from deep links. Each figure shows a *different* function, as the assignment requires:

| # | File | Deep link / action | Shows |
|---|---|---|---|
| 1 | `01-persona-picker.png` | first run | Entry point: choosing a student |
| 2 | `02-right-now-stella.png` | `?persona=stella&t=11:00&tab=today` | Usable-time headline, map strip, fit-labeled options |
| 3 | `03-why-it-fits.png` | Stella + `sheet=why:lunch` | Time receipt explaining a Tight fit |
| 4 | `04-plan-grid.png` | `?persona=chloe&tab=plan&day=0` | Calendar grid with gaps to scale |
| 5 | `05-recovery-chloe.png` | Chloe, cancel 1:00 class | Change banner and recalculated gap |
| 6 | `06-doesnt-fit-later.png` | Stella, workout | Doesn't fit + later gap suggestion |
| 7 | `07-map-tab.png` | `?persona=stella&tab=map` | Real campus map with route and pins |
| 8 | `08-quiet-ryan.png` | `?persona=ryan&t=10:50` | Quiet state: nothing to add |

Then write `docs/ACCESS.md`, a draft of report §3.3 for Davis to edit:
- Link (filled in after deploy). No login. Recommended: Chrome/Safari, phone or desktop.
- "Start by choosing a student." One-line description of each persona and the suggested first task for each.
- Note: schedules are demo data; nothing is saved after the tab closes; map tiles come from OpenStreetMap via OpenFreeMap.

---

## Phase 9: Build and host

1. `make build`, then `make preview`. Smoke-test all three personas by hand at 390 px.
2. Hosting. **Preferred: Figma Make** through its GitHub integration.
   - Throughout the build, **do not delete or modify** `.figma/`, `.figma/make/site.json`, or the Figma plugins in `vite.config.ts`. Make needs them. Phase 1's `BASE_PATH` change must keep `FIGMA_PUBLIC_URL` working.
   - Davis connects the Make project to a GitHub repo, pushes this work to it, and pulls it into Make. Then he checks that Make's preview runs before publishing.
   - After publishing, check that the published `figma.site` page loads the OpenFreeMap tiles (Phase 5). If the host blocks them, the map's fallback message should appear, and the app must still work.
   - **Fallback** if Make can't pull the changes or won't publish them: Netlify Drop (`make dist`, drag the zip in), Vercel, or GitHub Pages (`BASE_PATH=/<repo>/`).
3. Open the deployed link in a private window on a phone-sized viewport. Confirm the persona picker, a deep link, and the map all work. Put the link in `docs/ACCESS.md`.

### 🛑 Checkpoint C
Give Davis the link, `docs/figures/`, `docs/ACCESS.md`, and `docs/ai-log.md`.

---

## Out of scope (don't build)

Calendar connections of any kind · accounts/login · a database or server · push notifications · device GPS · turn-by-turn directions · shuttle timetables · AI-generated suggestions beyond the existing ranking logic.
