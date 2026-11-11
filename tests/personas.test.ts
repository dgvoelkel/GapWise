import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  type Prefs,
  DEFAULT_PREFS,
  allGaps,
  combos,
  commitmentError,
  evaluate,
  gapAtTime,
  gapsFor,
  rank,
} from "../src/gw/logic.ts"
import { personaState, suitableGaps, reconcileSchedule } from "../src/gw/state.ts"
import { PERSONAS, PERSONA_IDS } from "../src/gw/personas.ts"
import walking from "../src/gw/data/walking.json" with { type: "json" }

// BUILD.md 4.2: each row is asserted through the logic functions only (no UI).

const prefsOf = (id: keyof typeof PERSONAS): Prefs => ({
  ...DEFAULT_PREFS,
  ...PERSONAS[id].prefs,
})
const rightNow = (s: ReturnType<typeof personaState>) => {
  const today = gapsFor(s.cs, 0, s.prefs)
  const base =
    today.find((g) => g.start <= s.now && g.end > s.now) ??
    today.find((g) => g.end > s.now)!
  return gapAtTime(base, s.now)
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
const DAY_CODES = ["W", "Th", "F", "S", "Su", "M", "T"]

test("every persona schedule is valid, uses known places, and has no overlaps", () => {
  for (const id of PERSONA_IDS) {
    const p = PERSONAS[id]
    for (const c of p.commitments) {
      assert.equal(commitmentError(c, p.commitments), "", `${id}: ${c.title} day ${c.day}`)
      assert.ok(walking[c.location as keyof typeof walking], `${id}: unknown place ${c.location}`)
    }
    for (const a of p.activities)
      for (const loc of a.locations)
        assert.ok(walking[loc as keyof typeof walking], `${id}: unknown place ${loc}`)
    assert.ok(p.tasks.length >= 2)
  }
})

test("class rows match docs/tulane-sections.csv (course, days, times, building, room)", () => {
  const rows = readFileSync(new URL("../docs/tulane-sections.csv", import.meta.url), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
  assert.equal(rows.length, 13)
  for (const [persona, slot, course, , , , days, start, end, building, room] of rows) {
    const p = PERSONAS[persona as keyof typeof PERSONAS]
    const sections = p.commitments.filter((c) => c.title.startsWith(`${course} ·`))
    const expectedDays = days.split(" ").map((d) => DAY_CODES.indexOf(d)).sort()
    assert.deepEqual(
      sections.map((c) => c.day).sort(),
      expectedDays,
      `${persona}/${slot} days`,
    )
    for (const c of sections) {
      assert.equal(c.start, toMin(start), `${persona}/${slot} start`)
      assert.equal(c.end, toMin(end), `${persona}/${slot} end`)
      assert.equal(c.location, building, `${persona}/${slot} building`)
      assert.equal(c.room, room, `${persona}/${slot} room`)
      assert.equal(c.source, "Canvas")
      assert.equal(c.type, "class")
    }
  }
})

test("Ryan at Wed 10:50: nothing fits, so Right Now only says to head to Dinwiddie Hall", () => {
  const s = personaState("ryan")
  const g = rightNow(s)
  assert.equal(g.next.location, "Dinwiddie Hall")
  assert.equal(g.end - g.start, 10)
  const r = rank(s.acts, g, s.prefs)
  assert.equal(r.fits.length, 0)
  assert.ok(r.no.length > 0)
  assert.equal(combos(r.fits, g, s.prefs).length, 0)
})

test("Stella at Wed 11:00 with a 10-minute Finance buffer: usable drops by 5; print and coffee fit comfortably with no detour; lunch is tight; workout fits later", () => {
  const s = personaState("stella")
  const before = rightNow(s)
  assert.equal(before.next.title, "FINE 3010 · Financial Management")
  const cs = s.cs.map((c) => (c.seriesId === "st-finance" ? { ...c, buffer: 10 } : c))
  const raised = { ...s, cs }
  const g = rightNow(raised)
  assert.equal(g.usable, before.usable - 5)
  const r = rank(raised.acts, g, raised.prefs)
  const by = (id: string) => [...r.fits, ...r.no].find((e) => e.a.id === id)!
  assert.equal(by("print").loc, "Goldring/Woldenberg")
  assert.equal(by("print").extraTravel, 0)
  assert.equal(by("print").fit, "comfortable")
  assert.equal(by("coffee").loc, "Goldring/Woldenberg")
  assert.equal(by("coffee").extraTravel, 0)
  assert.equal(by("coffee").fit, "comfortable")
  assert.equal(by("lunch").fit, "tight")
  assert.equal(by("workout").fit, "none")
  const later = suitableGaps(raised, raised.acts.find((a) => a.id === "workout")!, g.key)
  assert.ok(later.length > 0, "a later gap is offered for the workout")
  assert.ok(
    combos(r.fits, g, raised.prefs).some(
      (c) =>
        (c.a.a.id === "print" && c.b.a.id === "coffee") ||
        (c.a.a.id === "coffee" && c.b.a.id === "print"),
    ),
    "a Print + Coffee combination is offered",
  )
})

test("Chloe at Wed 12:00: workout fits only after the 1:00 class is canceled, and the talk is offered only in Wednesday's late gap", () => {
  const s = personaState("chloe")
  const g = rightNow(s)
  assert.equal(g.start, 12 * 60)
  assert.equal(g.end, 13 * 60)
  const workout = s.acts.find((a) => a.id === "workout")!
  assert.equal(evaluate(workout, g, s.prefs).fit, "none")
  const canceled = reconcileSchedule(
    s,
    s.cs.map((c) => (c.id === "ch-afternoon-0" ? { ...c, canceled: true } : c)),
  )
  const merged = rightNow(canceled)
  assert.equal(merged.end, 15 * 60)
  assert.ok(merged.usable > g.usable)
  assert.notEqual(evaluate(workout, merged, canceled.prefs).fit, "none")
  const talk = s.acts.find((a) => a.id === "talk")!
  const offered = allGaps(s.cs, s.prefs).filter(
    (x) => evaluate(talk, x, s.prefs).fit !== "none",
  )
  assert.deepEqual(
    offered.map((x) => [x.day, x.start, x.end]),
    [[0, 16 * 60, 17 * 60 + 30]],
  )
})

test("Ryan: canceling the Wednesday advisor meeting merges two gaps, rest fits, and keep-open applies to the merged gap", () => {
  const s = personaState("ryan")
  const before = gapsFor(s.cs, 0, s.prefs)
  assert.ok(before.some((g) => g.start === 11 * 60 + 50 && g.end === 13 * 60))
  assert.ok(before.some((g) => g.start === 13 * 60 + 30 && g.end === 14 * 60))
  const canceled = reconcileSchedule(
    s,
    s.cs.map((c) => (c.id === "ry-advisor" ? { ...c, canceled: true } : c)),
  )
  const after = gapsFor(canceled.cs, 0, canceled.prefs)
  const merged = after.find((g) => g.start === 11 * 60 + 50)!
  assert.equal(merged.end, 14 * 60)
  assert.equal(after.length, before.length - 1)
  const rest = canceled.acts.find((a) => a.isRest)!
  assert.equal(rest.title, "Rest in room")
  assert.notEqual(evaluate(rest, merged, canceled.prefs).fit, "none")
  const kept = { ...canceled, assign: { [merged.key]: { kind: "open" as const } } }
  assert.equal(kept.assign[merged.key].kind, "open")
})

test("persona preferences and demo clocks match the spec", () => {
  assert.deepEqual(prefsOf("stella"), { ...DEFAULT_PREFS, buffer: 5, pace: "normal", style: "moment" })
  assert.deepEqual(prefsOf("ryan"), { ...DEFAULT_PREFS, buffer: 0, pace: "brisk", style: "ahead" })
  assert.deepEqual(prefsOf("chloe"), { ...DEFAULT_PREFS, buffer: 10, pace: "normal", style: "ahead" })
  assert.equal(PERSONAS.stella.now, 11 * 60)
  assert.equal(PERSONAS.ryan.now, 10 * 60 + 50)
  assert.equal(PERSONAS.chloe.now, 12 * 60)
})
