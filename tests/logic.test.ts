import assert from "node:assert/strict"
import test from "node:test"
import {
  type Activity,
  type Commitment,
  type Gap,
  BASE_ACTS,
  DEFAULT_PREFS,
  DEFAULT_COMMITMENTS,
  allGaps,
  combos,
  commitmentError,
  evaluate,
  evaluateSequence,
  gapAtTime,
  gapsFor,
  rank,
  travel,
} from "../src/gw/logic.ts"
import {
  assignedSequence,
  assignmentIds,
  assignmentIssues,
  availableActivities,
  freshState,
  reconcileSchedule,
  suitableGaps,
} from "../src/gw/state.ts"

const p = { ...DEFAULT_PREFS }
const current = () => gapsFor(DEFAULT_COMMITMENTS, 0, p)[1]
const task = (patch: Partial<Activity> = {}): Activity => ({
  id: "test",
  title: "Task",
  priority: "should",
  duration: 10,
  locations: [],
  flexibleLocation: true,
  ...patch,
})
const block = (patch: Partial<Commitment> = {}): Commitment => ({
  id: "new",
  title: "Meeting",
  start: 660,
  end: 690,
  day: 0,
  location: "LBC",
  recurrence: [],
  type: "meeting",
  ...patch,
})
const samePlaceGap = (total: number): Gap => ({
  ...current(),
  start: 600,
  end: 600 + total,
  total,
  travel: 0,
  buffer: 10,
  usable: Math.max(0, total - 10),
  prev: { ...current().prev, location: "Gibson Hall" },
  next: { ...current().next, location: "Gibson Hall" },
})

test("coherent schedule has short, current, and long future gaps without overlap", () => {
  const gaps = gapsFor(DEFAULT_COMMITMENTS, 0, p)
  assert.deepEqual(
    gaps.map((g) => g.total),
    [10, 70, 165],
  )
  assert.equal(current().usable, 51)
  DEFAULT_COMMITMENTS.forEach((c) =>
    assert.equal(commitmentError(c, DEFAULT_COMMITMENTS), ""),
  )
})
test("full buffer is never shrunk to make a short gap fit", () => {
  const g = gapsFor(
    [
      block({ id: "a", start: 590, end: 600 }),
      block({ id: "b", start: 605, end: 620, location: "Athletics facility" }),
    ],
    0,
    p,
  )[0]
  assert.equal(g.buffer, 10)
  assert.equal(g.usable, 0)
  assert.equal(evaluate(task(), g, p).fit, "none")
})
test("remaining current time preserves walking and the full buffer", () => {
  const g = gapAtTime(current(), 700)
  assert.equal(g.start, 700)
  assert.equal(g.total, 20)
  assert.equal(g.buffer, 10)
  assert.equal(g.usable, 1)
  assert.equal(gapAtTime(current(), 719).buffer, 10)
})
test("fit boundaries are exactly 10, 0–9, and negative minutes", () => {
  assert.equal(evaluate(task(), samePlaceGap(30), p).fit, "comfortable")
  assert.equal(evaluate(task(), samePlaceGap(29), p).fit, "tight")
  assert.equal(evaluate(task(), samePlaceGap(20), p).fit, "tight")
  assert.equal(evaluate(task(), samePlaceGap(19), p).fit, "none")
})
test("sample current gap has comfortable, tight, and rejected activities", () => {
  assert.equal(
    evaluate(BASE_ACTS.find((a) => a.id === "print")!, current(), p).fit,
    "comfortable",
  )
  assert.equal(
    evaluate(BASE_ACTS.find((a) => a.id === "study")!, current(), p).fit,
    "tight",
  )
  assert.equal(
    evaluate(BASE_ACTS.find((a) => a.id === "workout")!, current(), p).fit,
    "none",
  )
})
test("setup is subtracted once from activity-specific remaining time", () => {
  const a = evaluate(task({ setup: 7 }), current(), p)
  assert.equal(
    a.required,
    a.t1 + a.setup + a.wait + a.a.duration + a.t2 + current().buffer,
  )
  assert.equal(a.remaining, current().total - a.required)
})
test("total walking and extra detour are distinct and nonnegative", () => {
  const e = evaluate(BASE_ACTS[0], current(), p)
  assert.equal(e.extraTravel, Math.max(0, e.t1 + e.t2 - current().travel))
  assert.equal(
    e.remaining,
    current().usable - e.a.duration - e.setup - e.wait - e.extraTravel,
  )
})
test("an activity at the starting location adds no detour", () => {
  const e = evaluate(
    task({ flexibleLocation: false, locations: [current().prev.location] }),
    current(),
    p,
  )
  assert.equal(e.t1, 0)
  assert.equal(e.extraTravel, 0)
  assert.equal(e.t2, current().travel)
})
test("multi-location activities choose a feasible full route, not merely a nearby stop", () => {
  const a = task({
    flexibleLocation: false,
    locations: ["Athletics facility", "LBC"],
  })
  assert.equal(evaluate(a, current(), p).loc, "LBC")
})
test("deadlines are hard constraints, including the day", () => {
  const a = BASE_ACTS[0]
  const tomorrow = gapsFor(DEFAULT_COMMITMENTS, 1, p)[0]
  assert.equal(evaluate(a, tomorrow, p).constraint, "deadline")
  assert.equal(
    evaluate({ ...a, deadlineDay: 1 }, tomorrow, p).constraint,
    undefined,
  )
  assert.equal(
    evaluate(task({ deadline: 605 }), samePlaceGap(60), p).fit,
    "none",
  )
})
test("required windows include waiting and enforce the closing time", () => {
  const e = evaluate(
    task({ preferred: [630, 660], required: true }),
    samePlaceGap(90),
    p,
  )
  assert.equal(e.wait, 30)
  assert.equal(e.finish, 640)
  assert.equal(e.remaining, 40)
  assert.equal(
    evaluate(
      task({ duration: 40, preferred: [630, 660], required: true }),
      samePlaceGap(120),
      p,
    ).constraint,
    "window",
  )
})
test("soft preferred windows influence ranking without invalidating the activity", () => {
  const g = samePlaceGap(120)
  const a = task({ preferred: [800, 900] })
  assert.equal(evaluate(a, g, p).outsidePreferred, true)
  assert.notEqual(evaluate(a, g, p).fit, "none")
  assert.ok(
    evaluate(a, g, p).score <
      evaluate({ ...a, preferred: [590, 700] }, g, p).score,
  )
})
test("priority and upcoming deadlines affect recommendation ranking", () => {
  const ranked = rank(
    [
      task({ id: "optional", priority: "optional" }),
      task({ id: "must", priority: "must", deadline: 690 }),
    ],
    samePlaceGap(90),
    p,
  )
  assert.equal(ranked.fits[0].a.id, "must")
})
test("walking pace and accessibility allowance affect estimates", () => {
  const a = "Gibson Hall",
    b = "Athletics facility"
  assert.ok(travel(a, b, { ...p, pace: "relaxed" }) > travel(a, b, p))
  assert.ok(travel(a, b, { ...p, pace: "brisk" }) < travel(a, b, p))
  assert.ok(travel(a, b, { ...p, accessible: true }) > travel(a, b, p))
})
test("larger buffers lower usable time and compatibility", () => {
  const more = { ...p, buffer: 20 },
    g = gapsFor(DEFAULT_COMMITMENTS, 0, more)[1]
  assert.equal(g.usable, current().usable - 10)
  assert.equal(
    evaluate(BASE_ACTS.find((a) => a.id === "study")!, g, more).fit,
    "none",
  )
})
test("energy and avoiding long routes have meaningful scoring effects", () => {
  const low = task({ energy: "low" })
  assert.ok(
    evaluate(low, current(), { ...p, energy: "low" }).score >
      evaluate(low, current(), { ...p, energy: "high" }).score,
  )
  const far = task({
    flexibleLocation: false,
    locations: ["Athletics facility"],
  })
  assert.ok(
    evaluate(far, current(), { ...p, avoidLong: true }).score <
      evaluate(far, current(), p).score,
  )
})
test("combinations include every task, setup, route segment, and one buffer", () => {
  const g = current(),
    a = task({ id: "a", setup: 3 }),
    b = task({ id: "b", setup: 2, flexibleLocation: false, locations: ["LBC"] })
  const seq = evaluateSequence([a, b], g, p)
  assert.equal(
    seq.required,
    a.duration + b.duration + 5 + seq.walking + g.buffer,
  )
  assert.equal(seq.remaining, g.total - seq.required)
  assert.equal(seq.evaluations.length, 2)
})
test("combinations enforce the second activity’s deadline", () => {
  const g = samePlaceGap(90),
    a = task({ id: "a", duration: 25 }),
    b = task({ id: "b", duration: 10, deadline: 630 })
  const fits = rank([a, b], g, p).fits
  assert.equal(evaluateSequence([a, b], g, p).fit, "none")
  assert.ok(
    combos(fits, g, p).every(
      (c) =>
        c.sequence.fit !== "none" &&
        !c.sequence.evaluations.some((e) => e.constraint),
    ),
  )
})
test("completed and rest activities are not unfinished-work recommendations", () => {
  assert.equal(
    rank(
      [task({ done: true }), task({ id: "rest", isRest: true })],
      current(),
      p,
    ).fits.length,
    0,
  )
})
test("activities assigned in another gap do not get recommended twice", () => {
  const s = freshState(),
    gs = allGaps(s.cs, s.prefs)
  s.assign[gs[2].key] = { kind: "act", id: "study", title: "Study" }
  assert.ok(
    !availableActivities(s, current().key).some((a) => a.id === "study"),
  )
  assert.ok(availableActivities(s, gs[2].key).some((a) => a.id === "study"))
})
test("dismissal is gap-specific and can be restored without deleting the activity", () => {
  const s = freshState()
  s.dismissed[current().key] = ["print"]
  assert.ok(
    !availableActivities(s, current().key).some((a) => a.id === "print"),
  )
  assert.ok(
    availableActivities(s, current().key, true).some((a) => a.id === "print"),
  )
  assert.equal(s.acts.length, BASE_ACTS.length)
})
test("alternative gaps respect deadlines, other assignments, and intentionally open time", () => {
  const s = freshState(),
    study = s.acts.find((a) => a.id === "study")!
  const all = suitableGaps(s, study, current().key)
  assert.ok(all.length > 0)
  s.assign[all[0].key] = { kind: "open" }
  assert.ok(
    !suitableGaps(s, study, current().key).some((g) => g.key === all[0].key),
  )
  assert.ok(suitableGaps(s, BASE_ACTS[0]).every((g) => g.day === 0))
})
test("overlapping commitments are rejected, while adjacent times are valid", () => {
  assert.match(
    commitmentError(block({ start: 620, end: 660 }), DEFAULT_COMMITMENTS),
    /overlaps Machine Learning/,
  )
  assert.equal(
    commitmentError(block({ start: 650, end: 660 }), DEFAULT_COMMITMENTS),
    "",
  )
  assert.match(
    commitmentError(block({ start: 700, end: 690 }), DEFAULT_COMMITMENTS),
    /after start/,
  )
})
test("canceled commitments do not reduce available gaps", () => {
  const cs = DEFAULT_COMMITMENTS.map((c) =>
    c.id === "c2" ? { ...c, canceled: true } : c,
  )
  const gaps = gapsFor(cs, 0, p)
  assert.equal(gaps[0].prev.id, "c1")
  assert.equal(gaps[0].next.id, "c3")
})
test("delays keep assignments visible and identify newly infeasible activities", () => {
  const s = freshState(),
    g = current()
  s.assign[g.key] = {
    kind: "act",
    id: "study",
    title: "Study",
    startAt: g.start,
  }
  assert.equal(assignmentIssues(s).length, 0)
  const changed = reconcileSchedule(
    s,
    s.cs.map((c) => (c.id === "c2" ? { ...c, end: 680 } : c)),
  )
  assert.equal(changed.assign[g.key].kind, "act")
  assert.equal(assignmentIssues(changed).length, 1)
  assert.match(assignmentIssues(changed)[0].reason, /24 more minutes/)
})
test("valid assignments survive edits, even in other gaps", () => {
  const s = freshState(),
    g = current()
  s.assign[g.key] = {
    kind: "act",
    id: "email",
    title: "Email",
    startAt: g.start,
  }
  const changed = reconcileSchedule(
    s,
    s.cs.map((c) => (c.id === "c4" ? { ...c, start: 990 } : c)),
  )
  assert.equal(changed.assign[g.key].kind, "act")
  assert.equal(assignmentIssues(changed).length, 0)
})
test("kept-open decisions survive a new commitment splitting a gap", () => {
  const s = freshState(),
    g = current()
  s.assign[g.key] = { kind: "open" }
  const changed = reconcileSchedule(s, [
    ...s.cs,
    block({ start: 675, end: 690 }),
  ])
  const split = allGaps(changed.cs, changed.prefs).filter(
    (x) => x.day === 0 && x.start >= g.start && x.end <= g.end,
  )
  assert.equal(split.length, 2)
  assert.ok(split.every((g) => changed.assign[g.key]?.kind === "open"))
})
test("a removed gap does not silently erase an unresolved assignment", () => {
  const s = freshState(),
    g = current()
  s.assign[g.key] = { kind: "act", id: "reading", title: "Reading" }
  const changed = reconcileSchedule(
    s,
    s.cs.map((c) => (c.id === "c2" ? { ...c, end: 720 } : c)),
  )
  assert.ok(changed.assign[g.key])
  assert.equal(assignmentIssues(changed)[0].gap, undefined)
})
test("fixed map location choices are preserved in assignment calculations", () => {
  const s = freshState(),
    g = current()
  const choice = {
    kind: "act" as const,
    id: "coffee",
    title: "Coffee",
    locations: { coffee: "PJ's Coffee" },
  }
  assert.equal(assignedSequence(s, g, choice).evaluations[0].loc, "PJ's Coffee")
})
test("a combination retains every member and can be found for recovery", () => {
  const s = freshState(),
    g = current()
  const choice = {
    kind: "act" as const,
    id: "print",
    ids: ["print", "email"],
    title: "Print + email",
  }
  s.assign[g.key] = choice
  assert.deepEqual(assignmentIds(choice), ["print", "email"])
  assert.equal(assignedSequence(s, g, choice).evaluations.length, 2)
})

test("editing a fixed activity location supersedes an old map location choice", () => {
  const s = freshState(),
    g = current()
  const coffee = s.acts.find((a) => a.id === "coffee")!
  coffee.locations = ["Reily Rec Center"]
  const choice = {
    kind: "act" as const,
    id: "coffee",
    title: "Coffee",
    locations: { coffee: "PJ's Coffee" },
  }
  assert.equal(
    assignedSequence(s, g, choice).evaluations[0].loc,
    "Reily Rec Center",
  )
})

test("a planned start is retained as the planning clock moves forward", () => {
  const s = freshState(),
    g = current()
  const choice = {
    kind: "act" as const,
    id: "study",
    title: "Study",
    startAt: g.start,
  }
  const original = assignedSequence(s, g, choice)
  assert.equal(
    assignedSequence(s, gapAtTime(g, 670), choice).remaining,
    original.remaining,
  )
})
