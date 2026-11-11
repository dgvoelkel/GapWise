import {
  type Activity,
  type Commitment,
  type Gap,
  type Prefs,
  BASE_ACTS,
  DEFAULT_COMMITMENTS,
  DEFAULT_PREFS,
  allGaps,
  atLocation,
  evaluateSequence,
  futureGap,
  gapAtTime,
} from "./logic.ts"

export type Assignment = {
  kind: "act"
  id: string
  ids?: string[]
  title: string
  locations?: Record<string, string>
  startAt?: number
  day?: number
  start?: number
  end?: number
  notBefore?: Record<string, number>
  remainingChoice?: "open" | "skip"
} | { kind: "open" } | { kind: "skip" }
export type State = {
  version: 3
  onboarded: boolean
  cs: Commitment[]
  acts: Activity[]
  prefs: Prefs
  now: number
  assign: Record<string, Assignment>
  dismissed: Record<string, string[]>
}
export const assignmentIds = (a: Assignment) =>
  a.kind === "act" ? (a.ids ?? [a.id]) : []
export const freshState = (): State => ({
  version: 3,
  onboarded: true,
  cs: structuredClone(DEFAULT_COMMITMENTS),
  acts: structuredClone(BASE_ACTS),
  prefs: { ...DEFAULT_PREFS },
  now: 650,
  assign: {},
  dismissed: {},
})
export function loadState(): State {
  try {
    const raw = sessionStorage.getItem("gw")
    if (!raw) return freshState()
    const s = JSON.parse(raw)
    if (!Array.isArray(s.cs) || !Array.isArray(s.acts)) return freshState()
    return {
      ...freshState(),
      ...s,
      version: 3,
      prefs: { ...DEFAULT_PREFS, ...s.prefs },
      dismissed: s.dismissed ?? {},
      assign: s.assign ?? {},
    }
  } catch {
    return freshState()
  }
}
export function availableActivities(
  s: State,
  gapKey: string,
  includeDismissed = false,
) {
  const booked = new Set(
    Object.entries(s.assign)
      .filter(([key]) => key !== gapKey)
      .flatMap(([, a]) => assignmentIds(a)),
  )
  return s.acts.filter(
    (a) =>
      !a.done &&
      !booked.has(a.id) &&
      (includeDismissed || !s.dismissed[gapKey]?.includes(a.id)),
  )
}
export function assignedSequence(s: State, g: Gap, a: Assignment) {
  const activities = assignmentIds(a)
    .map((id) => s.acts.find((x) => x.id === id))
    .filter((x): x is Activity => !!x)
    .map((activity) =>
      atLocation(
        activity,
        a.kind === "act" ? a.locations?.[activity.id] : undefined,
      ),
    )
  const original =
    allGaps(s.cs, s.prefs).find((original) => original.key === g.key) ?? g
  return evaluateSequence(
    activities,
    original,
    s.prefs,
    a.kind === "act"
      ? Math.max(original.start, a.startAt ?? original.start)
      : original.start,
    a.kind === "act" ? a.notBefore : undefined,
  )
}
export function suitableGaps(s: State, activity: Activity, exclude?: string) {
  const booked = new Set(
    Object.entries(s.assign)
      .filter(([key]) => key !== exclude)
      .flatMap(([, a]) => assignmentIds(a)),
  )
  if (activity.done || booked.has(activity.id)) return []
  return allGaps(s.cs, s.prefs)
    .filter((g) => g.key !== exclude && futureGap(g, s.now) && !s.assign[g.key])
    .map((g) => (g.day === 0 ? gapAtTime(g, s.now) : g))
    .filter((g) => evaluateSequence([activity], g, s.prefs).fit !== "none")
}
export type AssignmentIssue = {
  key: string
  assignment: Assignment
  gap: Gap | undefined
  reason: string
}
export function assignmentIssues(s: State): AssignmentIssue[] {
  const gaps = allGaps(s.cs, s.prefs)
  return Object.entries(s.assign).flatMap<AssignmentIssue>(([key, a]) => {
    if (a.kind !== "act") return []
    const acts = assignmentIds(a).map((id) => s.acts.find((x) => x.id === id))
    if (acts.every((x) => x?.done)) return []
    const g = gaps.find((x) => x.key === key)
    if (!g)
      return [
        {
          key,
          assignment: a,
          gap: undefined,
          reason: "This gap is no longer available.",
        },
      ]
    const seq = assignedSequence(s, g, a)
    return seq.fit === "none"
      ? [{ key, assignment: a, gap: g, reason: seq.reason }]
      : []
  })
}
// Preserve decisions across split/merged gaps; leave unresolved plans available for recovery.
export function reconcileSchedule(s: State, cs: Commitment[]): State {
  const before = allGaps(s.cs, s.prefs),
    after = allGaps(cs, s.prefs)
  const assign = { ...s.assign }
  const sameKeys = new Set(after.map((g) => g.key))
  for (const [key, choice] of Object.entries(s.assign)) {
    if (sameKeys.has(key)) continue
    const previous = before.find((g) => g.key === key)
    if (!previous) continue
    const candidates = after
      .filter(
        (g) =>
          g.day === previous.day &&
          g.start < previous.end &&
          g.end > previous.start &&
          !assign[g.key],
      )
      .sort(
        (a, b) =>
          Math.min(b.end, previous.end) -
          Math.max(b.start, previous.start) -
          (Math.min(a.end, previous.end) - Math.max(a.start, previous.start)),
      )
    if (choice.kind === "open" || choice.kind === "skip") {
      if (candidates.length) {
        delete assign[key]
        for (const g of candidates) assign[g.key] = choice
      }
    } else {
      const candidate = candidates.find(
        (g) => assignedSequence({ ...s, cs }, g, choice).fit !== "none",
      )
      if (candidate) {
        delete assign[key]
        assign[candidate.key] = {
          ...choice,
          startAt: Math.max(candidate.start, choice.startAt ?? candidate.start),
        }
      }
    }
  }
  return { ...s, cs, assign }
}
