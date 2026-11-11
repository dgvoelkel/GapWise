# Accessing the GapWise prototype (draft of report §3.3)

**Link:** _(filled in after deploy)_ `https://<project>.vercel.app`

No login, no account, no extra permissions. Open the link in a current Chrome or Safari, on a phone or a desktop. Nothing has to be installed.

## Start by choosing a student

The first screen is **"Explore GapWise as…"**. Pick one of the three students; their week loads as if it had been imported from the calendars they already use. You can switch students at any time from **Settings → Switch student**, or start with an empty schedule and add commitments yourself.

| Student | Who they are | Try this first |
|---|---|---|
| **Student-Athlete Stella** | Junior in Public Health on the tennis team. Lifts and practice are fixed; class is where she's flexible. | On Right Now, see what fits before Finance. Then raise her buffer for Finance to 10 minutes (Plan → edit FINE 3010) and check why lunch becomes *Tight*. |
| **Routine Ryan** | Sophomore in Computer Science. Same routine most days; wants help only when it's actually hard. | Open Right Now between Discrete Math and Intro to AI (nothing fits, and the app says so). Then cancel the 1:00 advisor meeting in Plan and keep the merged gap open. |
| **Commuter Chloe** | First-year master's student who lives off campus and rides the shuttle. | Her 1:00 CMPS 6240 class was canceled: cancel it in Plan, see what now fits, and keep the new gap open. Then look at Thursday and decide whether to plan it at all. |

The **?** button in the header explains the current tab and repeats these suggestions.

## Deep links

Graders can jump straight to a state:

- `?persona=stella&t=11:00&tab=today` – Stella's Right Now at 11:00 AM
- `?persona=chloe&tab=plan&day=0` – Chloe's Wednesday in Plan
- `?persona=ryan&t=10:50` – Ryan's quiet state
- `?persona=stella&tab=map` – the campus map
- add `&sheet=why:lunch` to open the "why it fits" receipt for an activity

`tab` is one of `today`, `plan`, `map`, `acts`, `settings`; `day` is 0–6 (Wednesday to Tuesday).

## What to know

- **Schedules are demo data.** Class times follow Tulane's usual M W F / T Th grid, and buildings and rooms are real, but no section data was pulled from a Tulane system. Nothing is connected to Canvas, Google, Outlook, Apple, or Teamworks; the small source chips on commitments only show which calendar a student like this would use.
- **Nothing is saved after the tab closes.** The schedule lives in this browser tab only. Reloading keeps it; closing the tab clears it. Nothing is sent to a server.
- **No device location.** "Where you are" is always the building of your previous commitment.
- **Map tiles come from OpenStreetMap via OpenFreeMap.** If the map can't load (offline, blocked), a note appears in its place and every walking time still works.
- **Walking times** are real campus routes between the buildings, at the walking pace chosen in Settings.
- **Known simplification:** every CMPS section, plus MATH 2170, is placed in Stanley Thomas Hall room 302 (CMPS 3140 in Dinwiddie Hall 108; MATH 6080 in Gibson Hall 310), so two students' classes can share a room on different days.
