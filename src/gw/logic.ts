export type Priority = "must" | "should" | "optional"
export type Commitment = {
  id: string
  title: string
  start: number
  end: number
  location: string
  day: number
  recurrence: string[]
  type: string
  canceled?: boolean
  buffer?: number
  seriesId?: string
}
export type Category = "study" | "food" | "move" | "errand" | "rest"
export type Energy = "low" | "medium" | "high"
export type Activity = {
  id: string
  title: string
  duration: number
  locations: string[]
  priority: Priority
  deadline?: number
  deadlineDay?: number
  preferred?: [number, number]
  required?: boolean
  flexibleLocation?: boolean
  done?: boolean
  notes?: string
  isRest?: boolean
  setup?: number
  category?: Category
  energy?: Energy
}
export function atLocation(a: Activity, location?: string): Activity {
  return location &&
    (a.flexibleLocation ||
      !a.locations.length ||
      a.locations.includes(location))
    ? { ...a, locations: [location], flexibleLocation: false }
    : a
}
export type Prefs = {
  buffer: number
  pace: "relaxed" | "normal" | "brisk"
  avoidLong: boolean
  style: "ahead" | "moment"
  accessible?: boolean
  energy?: "any" | Energy
}
export type Gap = {
  key: string
  day: number
  prev: Commitment
  next: Commitment
  start: number
  end: number
  total: number
  travel: number
  buffer: number
  usable: number
}
export type Fit = "comfortable" | "tight" | "none"
export type Eval = {
  a: Activity
  loc: string
  t1: number
  t2: number
  required: number
  remaining: number
  fit: Fit
  reason: string
  score: number
  extraTravel: number
  setup: number
  wait: number
  finish: number
  constraint?: "deadline" | "window"
  outsidePreferred: boolean
}
export type Sequence = {
  evaluations: Eval[]
  remaining: number
  fit: Fit
  reason: string
  walking: number
  extraTravel: number
  required: number
}
export const DEFAULT_PREFS: Prefs = {
  buffer: 10,
  pace: "normal",
  avoidLong: false,
  accessible: false,
  style: "moment",
  energy: "any",
}
export const DAYS = [
  "Today",
  "Tomorrow",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
]
export const DATE_LABELS = [
  "Wed, Oct 14",
  "Thu, Oct 15",
  "Fri, Oct 16",
  "Sat, Oct 17",
  "Sun, Oct 18",
  "Mon, Oct 19",
  "Tue, Oct 20",
]
export const categoryOf = (a: Activity): Category =>
  a.category ??
  ({
    print: "errand",
    study: "study",
    lunch: "food",
    coffee: "food",
    workout: "move",
  } as Record<string, Category>)[a.id] ??
  (a.isRest ? "rest" : "errand")
export const energyOf = (a: Activity): Energy =>
  a.energy ??
  (categoryOf(a) === "move"
    ? "high"
    : categoryOf(a) === "study"
      ? "medium"
      : "low")
export const priorityLabel = (p: Priority) =>
  ({ must: "Must do", should: "Should do", optional: "Optional" })[p]
export const deadlineLabel = (a: Activity) =>
  a.deadline == null
    ? "No deadline"
    : `${DAYS[a.deadlineDay ?? 0] ?? `Day ${(a.deadlineDay ?? 0) + 1}`} at ${fmt(a.deadline)}`

export const LOCS: Record<string, [number, number]> = {
  "Gibson Hall": [0, 0],
  "Newcomb Hall": [8, 4],
  LBC: [3, 3],
  "Howard-Tilton Library": [5, -2],
  "Reily Rec Center": [10, 9],
  "Richardson Memorial": [-2, 5],
  "Stanley Thomas Hall": [-3, 3],
  "PJ's Coffee": [1, 4],
  "Athletics facility": [14, 12],
}
export const LOC_NAMES = Object.keys(LOCS)
export function travel(a: string, b: string, p: Prefs) {
  if (!a || !b || a === b || !LOCS[a] || !LOCS[b]) return 0
  const [x1, y1] = LOCS[a],
    [x2, y2] = LOCS[b]
  const m =
    { relaxed: 1.25, normal: 1, brisk: 0.85 }[p.pace] *
    (p.accessible ? 1.15 : 1)
  return Math.max(2, Math.ceil(Math.hypot(x1 - x2, y1 - y2) * m))
}
export const fmt = (m: number) => {
  const h = Math.floor(m / 60),
    mm = m % 60
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}
export const dur = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`
    : `${m} min`

export function gapsFor(cs: Commitment[], day: number, p: Prefs): Gap[] {
  const list = cs
    .filter((c) => c.day === day && !c.canceled)
    .sort((a, b) => a.start - b.start)
  const out: Gap[] = []
  for (let i = 0; i < list.length - 1; i++) {
    const prev = list[i],
      next = list[i + 1]
    const total = next.start - prev.end
    if (total <= 0) continue
    const t = travel(prev.location, next.location, p)
    const buf = Math.max(0, next.buffer ?? p.buffer)
    out.push({
      key: `${day}-${prev.id}-${next.id}`,
      day,
      prev,
      next,
      start: prev.end,
      end: next.start,
      total,
      travel: t,
      buffer: buf,
      usable: Math.max(0, total - t - buf),
    })
  }
  return out
}
export function gapAtTime(gap: Gap, now: number): Gap {
  if (now <= gap.start || now >= gap.end) return gap
  const total = gap.end - now
  return {
    ...gap,
    start: now,
    total,
    usable: Math.max(0, total - gap.travel - gap.buffer),
  }
}
const PW = { must: 30, should: 18, optional: 8 }
export function evaluate(
  a: Activity,
  g: Gap,
  p: Prefs,
  from = g.prev.location,
  startAt = g.start,
): Eval {
  const locs =
    a.flexibleLocation || !a.locations.length
      ? [...new Set([from, g.next.location, ...a.locations])]
      : a.locations
  let best: Eval | null = null
  for (const loc of locs) {
    const t1 = travel(from, loc, p),
      t2 = travel(loc, g.next.location, p)
    const setup = a.setup ?? 0
    const wait =
      a.required && a.preferred
        ? Math.max(0, a.preferred[0] - (startAt + t1 + setup))
        : 0
    const required = t1 + setup + wait + a.duration + t2 + g.buffer
    const remaining = g.end - startAt - required
    const extraTravel = Math.max(0, t1 + t2 - travel(from, g.next.location, p))
    let fit: Fit =
      remaining >= 10 ? "comfortable" : remaining >= 0 ? "tight" : "none"
    let reason = ""
    const finish = startAt + t1 + setup + wait + a.duration
    const outsidePreferred =
      !!a.preferred &&
      (finish - a.duration < a.preferred[0] || finish > a.preferred[1])
    let constraint: Eval["constraint"]
    if (
      a.deadline != null &&
      g.day * 1440 + finish > (a.deadlineDay ?? 0) * 1440 + a.deadline
    ) {
      fit = "none"
      constraint = "deadline"
      reason = `Doesn't fit. This activity is due ${deadlineLabel(a).toLowerCase()}; you would finish too late.`
    }
    if (
      !constraint &&
      a.required &&
      a.preferred &&
      (outsidePreferred || a.preferred[0] >= g.end - g.buffer)
    ) {
      fit = "none"
      constraint = "window"
      reason = `Doesn't fit. Only available ${fmt(a.preferred[0])}–${fmt(a.preferred[1])}.`
    }
    if (!reason)
      reason =
        fit === "none"
          ? `Doesn't fit. You need ${-remaining} more minutes for the activity, full walk, setup, and arrival buffer.`
          : fit === "tight"
            ? `Tight fit. ${remaining} ${
                remaining === 1 ? "minute remains" : "minutes remain"
              } after walking and your buffer; little room for delays.`
            : `Comfortable fit. You will have ${remaining} minutes remaining.`
    const untilDeadline =
      a.deadline == null
        ? Infinity
        : (a.deadlineDay ?? 0) * 1440 + a.deadline - (g.day * 1440 + startAt)
    let score =
      PW[a.priority] +
      (untilDeadline <= 180 ? 18 : untilDeadline <= 1440 ? 8 : 0) -
      extraTravel * (p.avoidLong ? 2 : 0.8) -
      (p.avoidLong ? (t1 + t2) * 1.5 : 0) +
      Math.min(remaining, 20) * 0.25
    if (a.preferred) score += outsidePreferred ? -9 : 8
    if (p.energy && p.energy !== "any")
      score += energyOf(a) === p.energy ? 12 : -5
    if (fit === "tight") score -= 7
    const e = {
      a,
      loc,
      t1,
      t2,
      setup,
      wait,
      finish,
      constraint,
      outsidePreferred,
      required,
      remaining,
      fit,
      reason,
      score,
      extraTravel,
    }
    if (
      !best ||
      (best.fit === "none" && e.fit !== "none") ||
      ((e.fit !== "none") === (best.fit !== "none") &&
        e.remaining > best.remaining)
    )
      best = e
  }
  return best!
}
export function rank(acts: Activity[], g: Gap, p: Prefs) {
  const ev = acts
    .filter((a) => !a.done && !a.isRest)
    .map((a) => evaluate(a, g, p))
  return {
    fits: ev.filter((e) => e.fit !== "none").sort((a, b) => b.score - a.score),
    no: ev.filter((e) => e.fit === "none").sort((a, b) => b.score - a.score),
  }
}
export function evaluateSequence(
  activities: Activity[],
  g: Gap,
  p: Prefs,
  startAt = g.start,
): Sequence {
  let cursor = startAt,
    from = g.prev.location,
    walking = 0
  const evaluations: Eval[] = []
  for (const activity of activities) {
    const e = evaluate(activity, g, p, from, cursor)
    evaluations.push(e)
    walking += e.t1
    cursor = e.finish
    from = e.loc
  }
  walking += travel(from, g.next.location, p)
  const remaining = g.end - cursor - travel(from, g.next.location, p) - g.buffer
  const constraint = evaluations.find((e) => e.constraint)
  const fit: Fit =
    constraint || remaining < 0
      ? "none"
      : remaining < 10
        ? "tight"
        : "comfortable"
  return {
    evaluations,
    walking,
    remaining,
    fit,
    required: g.end - startAt - remaining,
    extraTravel: Math.max(0, walking - g.travel),
    reason:
      (evaluations.length === 1 ? evaluations[0].reason : constraint?.reason) ??
      (remaining < 0
        ? `Doesn't fit. You need ${-remaining} more minutes for both activities and the complete route.`
        : `${remaining} minutes remain after both activities, setup, walking, and your buffer.`),
  }
}
export function combos(fits: Eval[], g: Gap, p: Prefs) {
  const out: {
    a: Eval
    b: Eval
    locB: string
    t: number[]
    remaining: number
    sequence: Sequence
  }[] = []
  const top = fits.filter((f) => f.a.duration <= 30 && !f.a.isRest).slice(0, 5)
  for (let i = 0; i < top.length; i++)
    for (let j = 0; j < top.length; j++) {
      if (i === j) continue
      const A = top[i],
        B = top[j]
      const sequence = evaluateSequence([A.a, B.a], g, p)
      const [a, b] = sequence.evaluations
      const locB = b.loc
      const t = [a.t1, b.t1, b.t2]
      const remaining = sequence.remaining
      if (
        sequence.fit !== "none" &&
        !out.some((o) => o.a.a.id === B.a.id && o.b.a.id === A.a.id)
      )
        out.push({ a, b, locB, t, remaining, sequence })
    }
  return out
    .sort((x, y) => y.a.score + y.b.score - x.a.score - x.b.score)
    .slice(0, 2)
}

const T = (h: number, m = 0) => h * 60 + m
export const BASE_ACTS: Activity[] = [
  {
    id: "print",
    title: "Print assignment",
    duration: 10,
    setup: 2,
    locations: ["Howard-Tilton Library"],
    priority: "must",
    deadline: T(13),
    deadlineDay: 0,
    category: "errand",
    energy: "low",
  },
  {
    id: "study",
    title: "Study for linear algebra",
    duration: 40,
    setup: 5,
    locations: [],
    priority: "should",
    flexibleLocation: true,
    category: "study",
    energy: "medium",
  },
  {
    id: "lunch",
    title: "Get lunch",
    duration: 30,
    locations: ["LBC"],
    priority: "should",
    preferred: [T(12), T(14)],
    category: "food",
    energy: "low",
  },
  {
    id: "email",
    title: "Email my advisor",
    duration: 8,
    locations: [],
    priority: "must",
    flexibleLocation: true,
    deadline: T(15),
    deadlineDay: 1,
    category: "errand",
    energy: "low",
  },
  {
    id: "coffee",
    title: "Grab a coffee",
    duration: 10,
    locations: ["PJ's Coffee", "LBC"],
    priority: "optional",
    category: "food",
    energy: "low",
  },
  {
    id: "workout",
    title: "Work out at Reily",
    duration: 45,
    setup: 5,
    locations: ["Reily Rec Center"],
    priority: "should",
    preferred: [T(15), T(18)],
    required: true,
    category: "move",
    energy: "high",
  },
  {
    id: "reading",
    title: "Finish history reading",
    duration: 80,
    locations: ["Howard-Tilton Library"],
    priority: "optional",
    category: "study",
    energy: "medium",
  },
  {
    id: "rest",
    title: "Rest nearby",
    duration: 10,
    locations: [],
    priority: "optional",
    flexibleLocation: true,
    isRest: true,
    category: "rest",
    energy: "low",
  },
]
const c = (
  id: string,
  title: string,
  s: number,
  e: number,
  location: string,
  day = 0,
  rec: string[] = [],
): Commitment => ({
  id,
  title,
  start: s,
  end: e,
  location,
  day,
  recurrence: rec,
  type: "class",
})
export const TOMORROW = [
  c("t1", "Data Structures", T(8), T(9, 15), "Richardson Memorial", 1, [
    "T",
    "Th",
  ]),
  c("t2", "Linear Algebra", T(11), T(12, 15), "Gibson Hall", 1, ["T", "Th"]),
  c("t3", "Lab section", T(14, 30), T(16), "Stanley Thomas Hall", 1),
]
export const DEFAULT_COMMITMENTS: Commitment[] = [
  c("c1", "Topology", T(9), T(9, 50), "Gibson Hall", 0, ["M", "W", "F"]),
  c("c2", "Machine Learning", T(10), T(10, 50), "Gibson Hall", 0, [
    "M",
    "W",
    "F",
  ]),
  c("c3", "Research meeting", T(12), T(13, 15), "Newcomb Hall", 0, ["W"]),
  {
    ...c("c4", "Practice", T(16), T(17, 30), "Athletics facility"),
    type: "practice",
  },
  ...TOMORROW,
  c("f1", "Topology", T(9), T(9, 50), "Gibson Hall", 2),
  c("f2", "Machine Learning", T(11), T(11, 50), "Newcomb Hall", 2),
  c("f3", "Office hours", T(14), T(15), "Richardson Memorial", 2),
]
export const allGaps = (cs: Commitment[], p: Prefs) =>
  DAYS.flatMap((_, d) => gapsFor(cs, d, p))
export const futureGap = (g: Gap, now: number) => g.day > 0 || g.end > now
export function commitmentError(c: Commitment, cs: Commitment[]) {
  if (!c.title.trim()) return "Enter a title."
  if (
    !Number.isFinite(c.start) ||
    !Number.isFinite(c.end) ||
    c.start < 0 ||
    c.end > 1439 ||
    c.end <= c.start
  )
    return "End time must be after start time on the same day."
  const conflict = cs.find(
    (x) =>
      x.id !== c.id &&
      x.day === c.day &&
      !x.canceled &&
      !c.canceled &&
      x.start < c.end &&
      c.start < x.end,
  )
  return conflict
    ? `This overlaps ${conflict.title} (${fmt(conflict.start)}–${fmt(conflict.end)}). Choose another time.`
    : ""
}
