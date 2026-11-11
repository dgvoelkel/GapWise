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
import {
  appendToGap,
  gapTimeline,
  remainingWindow,
  removeFromGap,
  scheduledActivityGap,
} from "../src/gw/plan-time.ts"

const p = { ...DEFAULT_PREFS }
// Walking minutes come from src/gw/data/walking.json, so expectations are
// derived from travel() rather than hard-coded (BUILD.md Phase 3).
const w = (a: string, b: string, prefs = p) => travel(a, b, prefs)
const current = () => gapsFor(DEFAULT_COMMITMENTS, 0, p)[1]
// Day-1 study example: Gibson Hall → Stanley Thomas Hall direct walk.
const walk = () => w("Gibson Hall", "Stanley Thomas Hall")
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
  assert.equal(current().usable, 70 - w("Gibson Hall", "Newcomb Hall") - 10)
  DEFAULT_COMMITMENTS.forEach((c) =>
    assert.equal(commitmentError(c, DEFAULT_COMMITMENTS), ""),
  )
})
test("full buffer is never shrunk to make a short gap fit", () => {
  const g = gapsFor(
    [
      block({ id: "a", start: 590, end: 600 }),
      block({ id: "b", start: 605, end: 620, location: "Wilson Center" }),
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
  assert.equal(g.travel, current().travel)
  assert.equal(g.usable, Math.max(0, 20 - g.travel - 10))
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
    locations: ["Wilson Center", "LBC"],
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
    b = "Wilson Center"
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
    locations: ["Wilson Center"],
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
  const shortfall = 5 + 40 + w("Gibson Hall", "Newcomb Hall") + 10 - 40
  assert.match(
    assignmentIssues(changed)[0].reason,
    new RegExp(`${shortfall} more minutes`),
  )
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

const studyPlan = () => {
  const s = freshState()
  const g = gapsFor(s.cs, 1, s.prefs)[1]
  s.assign[g.key] = {
    kind: "act",
    id: "study",
    ids: ["study"],
    title: "Study for linear algebra",
    startAt: g.start,
  }
  return { s, g }
}
const withAppend = (
  s: ReturnType<typeof freshState>,
  g: Gap,
  ids: string[],
  location?: string,
  start?: number,
) => {
  const window = remainingWindow(s, g, start)!
  const result = appendToGap(s, window.gap, ids, location)
  assert.ok("assignment" in result, "error" in result ? result.error : "")
  return { ...s, assign: { ...s.assign, [g.key]: result.assignment } }
}
const assertPartition = (s: ReturnType<typeof freshState>, g: Gap) => {
  const timeline = gapTimeline(s, g)
  let cursor = timeline.gap.start
  for (const part of timeline.parts) {
    assert.equal(part.start, cursor)
    assert.ok(part.end > part.start)
    cursor = part.end
  }
  assert.equal(cursor, timeline.gap.end)
}

test("the study example partitions 135 minutes into 45 planned, free time, the walk, and 10 buffer", () => {
  const { s, g } = studyPlan()
  const timeline = gapTimeline(s, g)
  assert.equal(g.start, 735)
  assert.equal(g.end, 870)
  assert.equal(g.usable, 125 - walk())
  assert.equal(timeline.planned, 45)
  assert.equal(timeline.available, 80 - walk())
  assert.equal(timeline.walking, walk())
  assert.equal(timeline.buffer, 10)
  assert.deepEqual(
    timeline.parts.map((p) => [p.kind, p.start, p.end]),
    [
      ["activity", 735, 780],
      ["available", 780, 860 - walk()],
      ["walking", 860 - walk(), 860],
      ["buffer", 860, 870],
    ],
  )
  assertPartition(s, g)
})

test("removing the only activity restores the original usable time", () => {
  const { s, g } = studyPlan()
  const next = removeFromGap(s, g, "study")
  assert.equal(next, undefined)
  const assign = { ...s.assign }
  delete assign[g.key]
  const timeline = gapTimeline({ ...s, assign }, g)
  assert.equal(timeline.planned, 0)
  assert.equal(timeline.available, 125 - walk())
  assert.equal(timeline.walking + timeline.buffer, walk() + 10)
  assertPartition({ ...s, assign }, g)
})

test("adding another activity uses only remaining time and retains the study start", () => {
  const { s, g } = studyPlan()
  const next = withAppend(s, g, ["email"])
  const timeline = gapTimeline(next, g)
  assert.deepEqual(assignmentIds(next.assign[g.key]), ["study", "email"])
  assert.equal(timeline.sequence!.evaluations[0].finish, 780)
  assert.equal(timeline.sequence!.evaluations[1].finish, 788)
  assert.equal(timeline.available, 72 - walk())
  assert.equal(timeline.planned, 53)
  assertPartition(next, g)
})

test("additional detours reserve the complete route, not the original direct walk", () => {
  const { s, g } = studyPlan()
  const next = withAppend(s, g, ["coffee"], "PJ's Coffee")
  const timeline = gapTimeline(next, g)
  const viaCoffee =
    w("Gibson Hall", "PJ's Coffee") + w("PJ's Coffee", "Stanley Thomas Hall")
  assert.equal(timeline.planned, 55)
  assert.equal(timeline.walking, viaCoffee)
  assert.equal(timeline.available, 70 - viaCoffee)
  assert.equal(timeline.sequence!.extraTravel, viaCoffee - walk())
  assert.equal(timeline.sequence!.remaining, timeline.available)
  assertPartition(next, g)
})

test("several explicitly added activities have separate, ordered non-overlapping intervals", () => {
  const { s, g } = studyPlan()
  const next = withAppend(s, g, ["email", "coffee"], "PJ's Coffee")
  const timeline = gapTimeline(next, g)
  const planned = timeline.parts.filter((p) => p.kind === "activity")
  assert.equal(planned.length, 3)
  assert.deepEqual(
    planned.map((p) => p.activityId),
    ["study", "email", "coffee"],
  )
  assert.ok(planned[1].start >= planned[0].end)
  assert.ok(planned[2].start >= planned[1].end)
  assertPartition(next, g)
})

test("removing one activity frees its time without pulling later departures forward", () => {
  const { s, g } = studyPlan()
  const combined = withAppend(
    withAppend(s, g, ["email"]),
    g,
    ["coffee"],
    "PJ's Coffee",
  )
  const before = gapTimeline(combined, g)
  const choice = removeFromGap(combined, g, "email")!
  const next = { ...combined, assign: { ...combined.assign, [g.key]: choice } }
  const after = gapTimeline(next, g)
  assert.equal(
    after.sequence!.evaluations.find((e) => e.a.id === "coffee")!.finish,
    before.sequence!.evaluations.find((e) => e.a.id === "coffee")!.finish,
  )
  assert.equal(after.available, before.available + 8)
  assert.equal(after.windows.length, 2)
  assertPartition(next, g)
  const restored = withAppend(
    next,
    g,
    ["email"],
    undefined,
    after.windows[0].gap.start,
  )
  assert.deepEqual(assignmentIds(restored.assign[g.key]), [
    "study",
    "email",
    "coffee",
  ])
  assert.equal(gapTimeline(restored, g).available, before.available)
  assertPartition(restored, g)
})

test("activity duration and setup edits change occupied and remaining minutes", () => {
  const { s, g } = studyPlan()
  for (const [duration, setup, planned, available] of [
    [60, 5, 65, 60 - walk()],
    [10, 2, 12, 113 - walk()],
  ]) {
    const next = {
      ...s,
      acts: s.acts.map((a) =>
        a.id === "study" ? { ...a, duration, setup } : a,
      ),
    }
    const timeline = gapTimeline(next, g)
    assert.equal(timeline.planned, planned)
    assert.equal(timeline.available, available)
    assertPartition(next, g)
  }
})

test("pace and buffer changes recalculate reserved and available calendar time", () => {
  const { s, g } = studyPlan()
  const moreBuffer = { ...s, prefs: { ...s.prefs, buffer: 20 } }
  assert.equal(gapTimeline(moreBuffer, g).available, 70 - walk())
  assert.equal(gapTimeline(moreBuffer, g).buffer, 20)
  const relaxed = { ...s, prefs: { ...s.prefs, pace: "relaxed" as const } }
  const relaxedWalk = w("Gibson Hall", "Stanley Thomas Hall", relaxed.prefs)
  assert.ok(relaxedWalk > walk())
  assert.equal(gapTimeline(relaxed, g).walking, relaxedWalk)
  assert.equal(gapTimeline(relaxed, g).available, 80 - relaxedWalk)
  assertPartition(moreBuffer, g)
  assertPartition(relaxed, g)
})

test("commitment edits update the gap and retain infeasible plans without painting over reserved time", () => {
  const { s, g } = studyPlan()
  for (const [start, available, shortfall] of [
    [810, 20 - walk(), 0],
    [780, 0, walk() + 10],
  ]) {
    const next = reconcileSchedule(
      s,
      s.cs.map((c) => (c.id === "t3" ? { ...c, start } : c)),
    )
    const timeline = gapTimeline(next, g)
    assert.equal(timeline.available, available)
    assert.equal(timeline.shortfall, shortfall)
    assert.equal(timeline.planned, 45)
    assert.equal(timeline.gap.end, start)
    assert.equal(assignmentIds(next.assign[g.key])[0], "study")
    assertPartition(next, g)
  }
})

test("required opening waits are distinct from setup and activity occupancy", () => {
  const { s, g } = studyPlan()
  const choice = s.assign[g.key]
  if (choice.kind === "act") choice.locations = { study: "Gibson Hall" }
  const next = {
    ...s,
    acts: s.acts.map((a) =>
      a.id === "study"
        ? { ...a, required: true, preferred: [780, 850] as [number, number] }
        : a,
    ),
  }
  const timeline = gapTimeline(next, g)
  assert.equal(timeline.planned, 45)
  assert.equal(timeline.parts.find((p) => p.kind === "waiting")!.start, 740)
  assert.equal(timeline.parts.find((p) => p.kind === "waiting")!.end, 780)
  assert.equal(timeline.parts.find((p) => p.phase === "setup")!.end, 740)
  assert.equal(timeline.parts.find((p) => p.phase === "activity")!.start, 780)
  assert.equal(timeline.waiting, 40)
  assert.equal(timeline.available, 40 - walk())
  assertPartition(next, g)
})

test("a later saved start leaves earlier time unassigned and can accept an activity without moving the saved plan", () => {
  const { s, g } = studyPlan()
  s.assign[g.key] = {
    ...s.assign[g.key],
    kind: "act",
    id: "study",
    title: "Study",
    startAt: 780,
  }
  const before = gapTimeline(s, g)
  assert.equal(before.available, 80 - walk())
  assert.equal(before.windows.length, 2)
  const next = withAppend(
    s,
    g,
    ["email"],
    undefined,
    before.windows[0].gap.start,
  )
  assert.equal(gapTimeline(next, g).sequence!.evaluations[1].finish, 825)
  assert.equal(gapTimeline(next, g).available, 72 - walk())
  assertPartition(next, g)
})

test("elapsed unplanned minutes are not offered again as the planning clock advances", () => {
  const s = freshState(),
    g = current()
  // A 20-minute study block (5 setup + 20) ends at 675, leaving free time before departure.
  s.acts = s.acts.map((a) => (a.id === "study" ? { ...a, duration: 20 } : a))
  s.assign[g.key] = {
    kind: "act",
    id: "study",
    title: "Study",
    startAt: g.start,
  }
  s.now = 690
  const timeline = gapTimeline(s, g)
  const departure = 720 - g.travel - 10
  assert.ok(departure > 690)
  assert.equal(timeline.available, departure - 690)
  assert.equal(timeline.parts.find((p) => p.kind === "elapsed")!.end, 690)
  assert.equal(remainingWindow(s, g)!.gap.start, 690)
  assert.ok("error" in appendToGap(s, remainingWindow(s, g)!.gap, ["email"]))
  assertPartition(s, g)
})

test("remaining-time choices are preserved and never silently filled", () => {
  const { s, g } = studyPlan()
  const choice = s.assign[g.key]
  assert.equal(choice.kind, "act")
  s.assign[g.key] = {
    ...choice,
    kind: "act",
    id: "study",
    title: "Study",
    remainingChoice: "open",
  }
  assert.ok("error" in appendToGap(s, remainingWindow(s, g)!.gap, ["email"]))
  assert.deepEqual(assignmentIds(s.assign[g.key]), ["study"])
  assert.equal(gapTimeline(s, g).available, 80 - walk())
})

test("remaining-time scheduling rejects duplicate, completed, or already booked activities", () => {
  const { s, g } = studyPlan()
  const window = remainingWindow(s, g)!.gap
  assert.ok("error" in appendToGap(s, window, ["study"]))
  assert.ok("error" in appendToGap(s, window, ["email", "email"]))
  s.acts.find((a) => a.id === "email")!.done = true
  assert.ok("error" in appendToGap(s, window, ["email"]))
  s.assign["another-gap"] = { kind: "act", id: "coffee", title: "Coffee" }
  assert.ok("error" in appendToGap(s, window, ["coffee"]))
})

test("a commitment-specific buffer remains reserved in the calendar", () => {
  const { s, g } = studyPlan()
  const next = {
    ...s,
    cs: s.cs.map((c) => (c.id === "t3" ? { ...c, buffer: 20 } : c)),
  }
  const timeline = gapTimeline(next, g)
  assert.equal(timeline.planned, 45)
  assert.equal(timeline.buffer, 20)
  assert.equal(timeline.available, 70 - walk())
  assert.equal(remainingWindow(next, g)!.gap.buffer, 20)
  assertPartition(next, g)
})

test("scheduled activity details use their actual departure and respect the next planned stop", () => {
  const { s, g } = studyPlan()
  const next = withAppend(
    withAppend(s, g, ["email"]),
    g,
    ["coffee"],
    "PJ's Coffee",
  )
  const emailGap = scheduledActivityGap(next, g, "email")
  const toCoffee = w("Gibson Hall", "PJ's Coffee")
  assert.equal(emailGap.start, 780)
  assert.equal(emailGap.next.title, "Grab a coffee")
  assert.equal(emailGap.end, 788 + toCoffee)
  assert.equal(emailGap.buffer, 0)
  const email = evaluate(
    next.acts.find((a) => a.id === "email")!,
    emailGap,
    next.prefs,
  )
  assert.equal(email.remaining, 0)
  const coffeeGap = scheduledActivityGap(next, g, "coffee")
  assert.equal(coffeeGap.start, 788)
  const coffee = evaluate(
    {
      ...next.acts.find((a) => a.id === "coffee")!,
      locations: ["PJ's Coffee"],
    },
    coffeeGap,
    next.prefs,
  )
  assert.equal(coffee.finish, 798 + toCoffee)
  assert.equal(
    coffee.remaining,
    870 - coffee.finish - w("PJ's Coffee", "Stanley Thomas Hall") - 10,
  )
})
