# GapWise AI log

One line per meaningful proposal, with what Davis accepted, changed, or rejected and why. Kept for report section 3.2.

## Phase 1: Baseline (2026-11-11)

- Baseline before any change: `make typecheck` clean; `make test` 48/48 unit tests pass (logic, state, plan-time).
- Baseline e2e: `make e2e` could not run on its own because `playwright.config.ts` had no `webServer` block, so it needed a manually started preview server on port 3000. Added `webServer` (`vite preview`, `reuseExistingServer: true`); e2e results with the unchanged app recorded below.
- Proposed: `vite.config.ts` reads `BASE_PATH` first, then falls back to `FIGMA_PUBLIC_URL`, so the same build can be hosted at a sub-path. Pending Davis review.
- Baseline e2e result (unchanged app, new `webServer`): 86/86 Playwright tests pass across desktop and mobile projects.
- Proposed: pin `maplibre-gl` at an exact version (6.16.0) now so `make places-check` can render the real map before Phase 5. Pending Davis review.

## Phase 2: Real places and walking times (2026-11-11)

- `make geodata` written (`scripts/geodata.mjs`): Nominatim bounded to the uptown campus, 1.1 s between requests, generic User-Agent, rejects anything > 1.5 km from Gibson Hall. Overpass (with mirror + retry) is used only as a fallback for things Nominatim doesn't index: the on-campus PJ's, the tennis courts, bus stops.
- Result: 17 places, 15 via Nominatim, PJ's Coffee and Goldring Tennis Center via Overpass (OSM tennis courts beside Reily), Shuttle stop as a placeholder on McAlister Place in front of the LBC because OSM has no shuttle stop near the LBC. Five pins flagged `verified: false` for Davis: The Commons, Richardson Building, Goldring Tennis Center, PJ's Coffee, Shuttle stop.
- Walking times: OSRM foot router `table` service worked (`/table/v1/foot/`), all 136 pair routes fetched from the `route` service. **0 pairs estimated**, so no straight-line fallback was used. Minutes = ceil(max of both directions / 60), min 2. Longest pair is 20 min (Gibson/Tilton/Dinwiddie ↔ Wilson Center).
- Script keeps any pin with `source: "Davis"` on re-runs so Checkpoint A corrections survive `make geodata`.
- `make places-check` written (`scripts/places-check.mjs`): local page with maplibre-gl + OpenFreeMap liberty style, Playwright screenshot to `docs/places-check.png`, table to `docs/places-check.md`.
- Phase 4 blocker noted early: `docs/tulane-sections.csv` has no term, section, days, start, or end on any row. Davis fills it before Phase 4.
- 🛑 Checkpoint A: waiting for Davis to confirm or correct pins.
- Checkpoint A (Davis): The Commons confirmed (real name Malkin-Sacks Commons; display name kept as "The Commons"). Goldring Tennis Center: Davis's Google result placed it by Yulman Stadium / Green Wave Grille, but Tulane Athletics' own facility page puts the new center (opened Feb 2026) at 200 Broadway on the University Square campus, and the Grille is inside Yulman Stadium. Moved the pin to 200 Broadway (1.1 km from Gibson Hall) and flagged the discrepancy for Davis. Re-ran `make geodata ONLY=walking`.

## Phase 3: Swap the travel model (2026-11-11)

- `src/gw/logic.ts`: removed the illustrative grid `LOCS` and `Math.hypot`; `travel()` now looks up `src/gw/data/walking.json` (normal-pace minutes), keeps the same signature and multipliers (relaxed 1.25 · normal 1 · brisk 0.85, accessible × 1.15), then `Math.ceil`, min 2. Unknown places still return 0. `LOC_NAMES` comes from `places.json`; new exports `PLACES`, `WALKING`, `placeByName` for Phase 5.
- JSON is imported with `with { type: "json" }` so the same files load under Node's type stripping (unit tests) and Vite (build).
- Renamed the low-fi "Athletics facility" to "Wilson Center" in `DEFAULT_COMMITMENTS`, `campus.ts` and tests. `campus.ts`'s illustrative drawing data stays until Phase 5 replaces the SVG map.
- `tests/logic.test.ts`: every hard-coded minute that depended on the old grid is now derived from `travel()` (helpers `w()` and `walk()`), so Checkpoint A pin corrections cannot break the suite. The "elapsed unplanned minutes" test used a 40-minute study block that, with the real 14-minute Gibson→Newcomb walk, leaves 1 free minute; it now uses a 20-minute block so the invariant is actually exercised. 48/48 pass.
- Not changed: e2e specs still assert low-fi numbers (e.g. "51 min usable"); they are rewritten in Phase 7 once personas replace `DEFAULT_COMMITMENTS`.
- Checkpoint A (Davis, round 2): keep the tennis courts beside Reily as "Goldring Tennis Center" rather than the new 200 Broadway center (Davis's call; keeps practice within a 6-minute walk of the Wilson Center). Richardson Building and PJ's Coffee confirmed. Shuttle stop moved to Ben Weiner Drive out front of the Reily Center. All 17 pins now `verified: true`. Re-ran `make geodata ONLY=walking` and `make places-check`.

## Phase 4: Personas (2026-11-11)

- Davis's decision: class times are not copied from the login-only schedule of classes. Instead they follow his rule: M W F classes start on the hour and run 50 min; T Th classes run 75 min on the 8:00 / 9:30 / 11:00 / 12:30 … grid. `docs/tulane-sections.csv` is filled accordingly (term "Spring 2026", section "01" are placeholders, not real section numbers). Course codes, titles, buildings and rooms are as Davis pre-filled.
- Slot choices to keep the Milestone 2 scenarios: Ryan `first` 10:00–10:50 Stanley Thomas → `second` 11:00–11:50 Dinwiddie (10-min gap, different buildings). Stella `epi` 10:00–10:50 Library → `finance` 12:00–12:50 Goldring/Woldenberg (70-min gap, opposite sides of campus; 60 min at the 11:00 demo clock). Chloe `seminar` 11:00–11:50 → `afternoon` 13:00–13:50, both Stanley Thomas, research meeting 15:00 (a 70-min gap that becomes 190 min when the 1:00 class is canceled).
- Deviation from the spec's placeholder: Chloe's MATH 6080 lands on T Th 8:00–9:15 (first slot) rather than Fri/Tue 1:00, and CMPS 6360 stays Thursday 6:00–8:30 PM (an evening grad class; outside the day-time rule). To keep "the data-science talk is offered only on Wednesday", Chloe goes home between the two Thursday classes (shuttle departs 9:40, returns 5:40 PM), which also models her "might work, might go to an event" Thursday. Her Tuesday RA hours shift to 9:30–12:30 after the 8:00 class, keeping the 3-hour duration.
- Built `src/gw/personas.ts` (three personas, class rows generated from the same values as the CSV, with `seriesId` + `recurrence` for repeating classes), `src/gw/PersonaPicker.tsx` (first-run screen and Settings → Switch student), persona-aware state (`personaState`, `emptyState`, `startingState`, `hasChanges`), and deep links read once on load (`persona`, `t`, `tab`, `day`, `gap`, `sheet=why:<id>`). `Commitment` gained `room` (display only) and `source` (cosmetic chip). Settings now reads "Schedule: demo data for {name} · Stored only in this browser tab."
- Tuning for 4.2 (walking times and fit logic untouched): Stella's lunch is 35 min (not 30) so it is Tight once the Finance buffer is 10. Chloe's shuttle arrivals sit 25–30 min before her first commitment so the shuttle→building walk plus her 10-min buffer fits; Thursday has an "At home" block between the morning and evening shuttle trips so the data-science talk is only offered on Wednesday.
- Final 4.2 numbers (from the logic, 2026-11-11):
  - Ryan Wed 10:50: gap 10:50–11:00, 4 min walk (brisk), 0 buffer → 6 usable; 0 activities fit, 0 combos. Right Now says "Head to Dinwiddie Hall."
  - Stella Wed 11:00: 60-min gap, 7 min walk, buffer 5 → 48 usable; with Finance buffer 10 → 43 (−5). Print at Goldring/Woldenberg: Comfortable, 33 min remaining, +0 detour. Coffee at Goldring/Woldenberg: Comfortable, 33 remaining, +0. Lunch at LBC: Tight, 8 remaining. Conditioning workout: Doesn't fit (16 min short); later gaps offered (Wed 12:50, Fri 8:15 and 10:50, Mon 8:15 and 12:50). Combos: Print + Pick up package, Print + Coffee.
  - Chloe Wed 12:00: gap 12:00–1:00, 0 walk, 10 buffer → 50 usable; Workout Doesn't fit (25 short). After canceling CMPS 6240: gap 12:00–3:00, 170 usable; Workout Comfortable (95 remaining). Talk fits only Wed 4:00–5:30 (Tight, 7 remaining).
  - Ryan cancel Advisor meeting: 11:50–1:00 (67 usable) + 1:30–2:00 (25) merge into 11:50–2:00 (126 usable). Rest in room: Comfortable.
- `tests/personas.test.ts` asserts every 4.2 row plus a cross-check of the class rows against `docs/tulane-sections.csv`. `make test` now runs `tests/*.test.ts` (55 tests).
- Change banner: canceling a commitment used to say "Available gaps have been recalculated" because the merged gap has a new key. It now reports the merged gap's length and usable minutes (4.2: "The banner reports the new length").
- Known polish items carried to Phase 6: 5-minute shuttle blocks render at the 44 px minimum height and overlap the following class in the Plan grid; source chips are hidden on blocks under an hour, so class blocks (50 min) show none yet.
- 🛑 Checkpoint B: screenshots in `docs/checkpoint-b/`, waiting for Davis to approve or edit the schedules.

## Phase 5: Real maps (2026-11-11)

- Checkpoint B approved by Davis ("Looks good"); he asked that the mini-map under the usable-minutes headline become a real map, which Phase 5 does.
- Added `maplibre-gl` 6.16.0 with the OpenFreeMap `liberty` style (falls back to `positron`, then `bright`, then a text fallback). No key, no account; the attribution control stays visible.
- `src/gw/map/CampusMapGL.tsx` is the single wrapper: interactive in the Map tab, static (`interactive: false`, ~128 px) in the Right Now strip and the activity-details route preview. Routes come from `routes.geojson` (teal `--gw-teal`, 4 px, dashed for detour legs); pins are HTML markers rendered through React portals so they reuse the app's icons. The canvas is `aria-hidden`; every pin is a labelled button or image and every fact is also in the text lists. `prefers-reduced-motion` disables the fit animation. Max bounds ≈ 1.5 km around campus.
- Gotcha fixed: maplibre 6 loads its worker from a sibling URL that Vite doesn't emit. The worker is imported with `?worker&url` and passed to `setWorkerUrl`, which produced a separate `maplibre-gl-worker-*.js` chunk in `dist/`.
- Pins that share a building fan out sideways so the "next" flag isn't hidden under option 1 (Stella's print option is at Goldring/Woldenberg, her next building).
- Map tab now has a numbered "Options that fit" list that matches the pins; clicking a pin selects the list item and vice versa. The old gap pins and commitment pins went away (gaps are chosen from the dropdown; commitments are edited in Plan).
- If tiles are blocked, the tile shows "Map couldn't load. Walking times still work." and the options list keeps working (verified with `page.route` aborting tiles.openfreemap.org).
- Deleted `CampusMap.tsx`, `campus.ts`, `map-layout.ts`. Their CSS (schematic buildings, leader lines, zoom controls) is still in `index.css` and is removed in the Phase 6 cleanup.
- The Right Now strip is hidden when nothing fits (Ryan's quiet state).

## Phase 6: Hi-fi polish (2026-11-11)

- Removed 230 lines of CSS that only styled the deleted schematic SVG map (buildings, trees, leader lines, zoom controls, gap pins).
- Contrast: calendar block captions were 4.3:1 on their green background; now #536545 (5.4:1). `--gw-subtle` moved from 4.5:1 to 5.0:1. Fit badges already carry icon + word.
- Calendar: commitments under 20 minutes (shuttle stops) render as a 24 px single-line row so they no longer cover the next class; source chips now show on 50-minute class blocks and hide only on those tiny rows. This is a deliberate exception to the 44 px target rule, because a 5-minute stop drawn 44 px tall would cover 47 minutes of the grid.
- Touch targets: on coarse pointers every small button and filter chip is 44 px tall; the desktop density is unchanged.
- Added a "?" help button in the header that opens a per-tab sheet (what the tab is for, three tips, the current persona's suggested tasks, and a Switch student shortcut) so graders can explore without a walkthrough.
- Copy pass: no remaining wording promises syncing or importing; the picker and help sheet say the schedule is demo data in this tab only; the quiet state keeps "You don't have to fill every gap."

## Phase 7: Tests (2026-11-11)

- Unit: the 48 invariant tests run against the real walking data; `tests/personas.test.ts` adds one test per persona for every 4.2 row plus a CSV cross-check (55 total).
- E2E: the two low-fi specs (`gapwise.spec.ts`, `plan-occupancy.spec.ts`, ~1,650 lines) were tied to the sample schedule, its grid walking times (e.g. "51 min usable") and the deleted SVG map, so they were retired rather than patched. Replaced by three persona-based specs sharing `helpers.ts`: `personas.spec.ts` (picker + buffer step, empty-schedule path, each 4.2 scenario clicked through, strip ↔ list ↔ Map-tab selection sync, blocked-tile fallback, switch student with confirmation, help sheet), `plan.spec.ts` (to-scale grid with rooms/chips and no overlapping blocks, occupancy bands that add up to the gap, remove/undo, keep remaining open, delayed-commitment recovery) and `activities.spec.ts` (add/complete/undo, form validation and CRUD, filters/dismiss/restore, planning clock, settings preview). Every test runs in both the desktop and mobile projects and asserts no runtime errors and no horizontal overflow.
- Deep-link note learned while testing: a URL with `?persona=` re-seeds that persona on every load, by design, so persistence checks navigate to a URL without it.
- E2E fixes after the first full run: a new activity keeps "Location is flexible" checked by default, so the form test unchecks it; "Study for midterm" is due Friday, so a delayed Friday shuttle leaves no alternative gap and the test now asserts the "No available gap fits yet" state and the Keep-gap-open recovery; on the phone-sized map a building pin covered the "Lunch" option pin, so option pins now stack above building pins (CSS z-order), which also makes them easier to tap for real users.

## Phase 8: Figures and access notes (2026-11-11)

- `scripts/figures.mjs` (`make figures`) renders the eight figures at deviceScaleFactor 2 from deep links; figure 3 raises Stella's Finance buffer first so the receipt explains a Tight lunch, and figures 3 and 6 crop to the dialog.
- `docs/ACCESS.md` drafted for report §3.3: link placeholder, "start by choosing a student", one line per persona with a first task, deep links, and the demo-data / no-persistence / OpenFreeMap / no-location notes plus the shared-room simplification.

## Phase 9: Build and host (2026-11-11)

- `make build` and `make preview` smoke-tested at 390 px through the mobile Playwright project (all specs) and manual screenshots of the picker, Right Now, Plan and Map tabs.
- Hosting is Davis's step: import the GitHub repo at vercel.com (Vite preset, `pnpm build`, output `dist`, install `pnpm install`). The Figma plugins and `.figma/make/site.json` are intact (`make figma-check`). Fallback: `make dist` → `gapwise-dist.zip` for Netlify Drop.
