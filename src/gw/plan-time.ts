import {
  type Eval,
  type Gap,
  type Sequence,
  allGaps,
  atLocation,
  evaluateSequence,
  travel,
} from "./logic.ts"
import {
  type Assignment,
  type State,
  assignedSequence,
  assignmentIds,
  availableActivities,
} from "./state.ts"

export type GapPartKind = "activity" | "available" | "walking" | "buffer" | "waiting" | "elapsed"
export type GapPart = {
  kind: GapPartKind
  start: number
  end: number
  label: string
  activityId?: string
  planned?: number
  evaluation?: Eval
  phase?: "setup" | "activity"
}
export type AvailableWindow = {
  gap: Gap
  beforeId?: string
  start: number
  end: number
}
export type GapTimeline = {
  gap: Gap
  parts: GapPart[]
  windows: AvailableWindow[]
  sequence?: Sequence
  planned: number
  available: number
  walking: number
  buffer: number
  waiting: number
  shortfall: number
}

export const departureOf = (e: Eval) =>
  e.finish - e.a.duration - e.setup - e.wait - e.t1

export function gapTimeline(state: State, gap: Gap): GapTimeline {
  const raw =
    allGaps(state.cs, state.prefs).find((g) => g.key === gap.key) ?? gap
  const choice = state.assign[raw.key]
  const sequence =
    choice?.kind === "act" ? assignedSequence(state, raw, choice) : undefined
  const evaluations = sequence?.evaluations ?? []
  const walking = evaluations.at(-1)?.t2 ?? raw.travel
  const reservedStart = Math.max(raw.start, raw.end - walking - raw.buffer)
  const bufferStart = Math.max(raw.start, raw.end - raw.buffer)
  const parts: GapPart[] = []
  const windows: AvailableWindow[] = []
  let cursor = raw.start
  let from = raw.prev.location
  const now = raw.day === 0 ? state.now : raw.start

  const part = (
    kind: GapPartKind,
    start: number,
    end: number,
    label: string,
    extra: Partial<GapPart> = {},
    limit = reservedStart,
  ) => {
    const a = Math.max(raw.start, Math.min(limit, start))
    const b = Math.max(a, Math.min(limit, end))
    if (b > a) parts.push({ kind, start: a, end: b, label, ...extra })
  }
  const available = (start: number, end: number) => {
    part("elapsed", start, Math.min(end, now), "Earlier unplanned time")
    part("available", Math.max(start, now), end, "Still available")
  }
  const window = (
    start: number,
    end: number,
    location: string,
    buffer: number,
    beforeId?: string,
  ) => {
    const a = Math.max(start, now)
    const walking = travel(from, location, state.prefs)
    if (end - a - walking - buffer <= 0) return
    windows.push({
      start: a,
      end: end - walking - buffer,
      beforeId,
      gap: {
        ...raw,
        prev: { ...raw.prev, location: from, end: a },
        next: beforeId
          ? {
              ...raw.next,
              id: `planned-${beforeId}`,
              title:
                state.acts.find((a) => a.id === beforeId)?.title ??
                "Planned activity",
              location,
              start: end,
              buffer: 0,
            }
          : raw.next,
        start: a,
        end,
        total: end - a,
        travel: walking,
        buffer,
        usable: end - a - walking - buffer,
      },
    })
  }

  for (const e of evaluations) {
    const departure = departureOf(e)
    available(cursor, departure)
    if (departure > Math.max(cursor, now))
      window(cursor, departure + e.t1, e.loc, 0, e.a.id)
    part("walking", departure, departure + e.t1, `Walk to ${e.a.title}`)
    if (e.wait > 0) {
      part(
        "activity",
        departure + e.t1,
        departure + e.t1 + e.setup,
        `${e.a.title} setup`,
        {
          activityId: e.a.id,
          planned: e.setup,
          evaluation: e,
          phase: "setup",
        },
      )
      part(
        "waiting",
        departure + e.t1 + e.setup,
        e.finish - e.a.duration,
        `Wait for ${e.a.title}`,
      )
      part("activity", e.finish - e.a.duration, e.finish, e.a.title, {
        activityId: e.a.id,
        planned: e.a.duration,
        evaluation: e,
        phase: "activity",
      })
    } else {
      part("activity", e.finish - e.a.duration - e.setup, e.finish, e.a.title, {
        activityId: e.a.id,
        planned: e.a.duration + e.setup,
        evaluation: e,
      })
    }
    cursor = e.finish
    from = e.loc
  }
  available(cursor, reservedStart)
  window(cursor, raw.end, raw.next.location, raw.buffer)
  part(
    "walking",
    reservedStart,
    bufferStart,
    `Walk to ${raw.next.title}`,
    {},
    raw.end,
  )
  part("buffer", bufferStart, raw.end, "Arrival buffer", {}, raw.end)
  return {
    gap: raw,
    parts,
    windows,
    sequence,
    planned: evaluations.reduce((n, e) => n + e.a.duration + e.setup, 0),
    available: parts
      .filter((p) => p.kind === "available")
      .reduce((n, p) => n + p.end - p.start, 0),
    walking: sequence?.walking ?? raw.travel,
    buffer: raw.buffer,
    waiting: evaluations.reduce((n, e) => n + e.wait, 0),
    shortfall: Math.max(
      0,
      -(sequence?.remaining ?? raw.total - raw.travel - raw.buffer),
    ),
  }
}

export function remainingWindow(state: State, gap: Gap, start?: number) {
  const timeline = gapTimeline(state, gap)
  if (timeline.sequence?.fit === "none") return undefined
  return (
    timeline.windows.find((w) => w.gap.start === start) ??
    timeline.windows.at(-1)
  )
}

export function remainingState(state: State, gap: Gap): State {
  const ids = assignmentIds(state.assign[gap.key] ?? { kind: "open" })
  const assign = { ...state.assign }
  delete assign[gap.key]
  return {
    ...state,
    assign,
    acts: state.acts.filter((a) => !ids.includes(a.id)),
  }
}

export function scheduledActivityGap(state: State, gap: Gap, id: string): Gap {
  const choice = state.assign[gap.key]
  if (choice?.kind !== "act") return gap
  const evaluations = assignedSequence(state, gap, choice).evaluations
  const index = evaluations.findIndex((e) => e.a.id === id)
  if (index < 0) return gap
  const e = evaluations[index]
  const next = evaluations[index + 1]
  const from = evaluations[index - 1]?.loc ?? gap.prev.location
  const start = departureOf(e)
  const end = next ? departureOf(next) + next.t1 : gap.end
  const buffer = next ? 0 : gap.buffer
  const walking = travel(from, next?.loc ?? gap.next.location, state.prefs)
  return {
    ...gap,
    prev: { ...gap.prev, location: from, end: start },
    next: next
      ? {
          ...gap.next,
          id: `planned-${next.a.id}`,
          title: next.a.title,
          location: next.loc,
          start: end,
        }
      : gap.next,
    start,
    end,
    total: end - start,
    buffer,
    travel: walking,
    usable: Math.max(0, end - start - walking - buffer),
  }
}

export function appendToGap(
  state: State,
  requested: Gap,
  ids: string[],
  location?: string,
): { assignment: Assignment } | { error: string } {
  const choice = state.assign[requested.key]
  if (choice?.kind !== "act")
    return { error: "This plan changed. Select the available time again." }
  if (choice.remainingChoice)
    return {
      error: "Change your remaining-time choice before adding an activity.",
    }
  const timeline = gapTimeline(state, requested)
  const window = timeline.windows.find(
    (w) => w.gap.start === requested.start && w.gap.end === requested.end,
  )
  if (!window || timeline.sequence?.fit === "none")
    return {
      error: "This time is no longer available. Review the existing plan.",
    }
  const existingIds = assignmentIds(choice)
  const available = availableActivities(state, requested.key, true).filter(
    (a) => !existingIds.includes(a.id),
  )
  const activities = ids.map((id) => available.find((a) => a.id === id))
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    activities.some((a) => !a)
  )
    return { error: "One of these activities is already planned or completed." }
  const candidate = evaluateSequence(
    activities.map((a) =>
      atLocation(a!, ids.length === 1 ? location : undefined),
    ),
    window.gap,
    state.prefs,
  )
  if (candidate.fit === "none") return { error: candidate.reason }
  const existing = timeline.sequence!.evaluations
  // Retain existing departures and locations when inserting or removing a stop.
  const notBefore = Object.fromEntries(
    existing.map((e) => [e.a.id, departureOf(e)]),
  )
  const locations = Object.fromEntries(existing.map((e) => [e.a.id, e.loc]))
  for (const e of candidate.evaluations) {
    notBefore[e.a.id] = departureOf(e)
    locations[e.a.id] = e.loc
  }
  const index = window.beforeId
    ? existingIds.indexOf(window.beforeId)
    : existingIds.length
  const combined = [
    ...existingIds.slice(0, index),
    ...ids,
    ...existingIds.slice(index),
  ]
  if (window.beforeId) {
    const next = existing.find((e) => e.a.id === window.beforeId)!
    notBefore[window.beforeId] =
      window.gap.end -
      travel(candidate.evaluations.at(-1)!.loc, next.loc, state.prefs)
  }
  const assignment: Assignment = {
    ...choice,
    id: combined[0],
    ids: combined,
    title: combined
      .map((id) => state.acts.find((a) => a.id === id)!.title)
      .join(" + "),
    startAt: Math.min(choice.startAt ?? timeline.gap.start, requested.start),
    notBefore,
    locations,
  }
  const sequence = assignedSequence(state, timeline.gap, assignment)
  if (
    sequence.fit === "none" ||
    existing.some(
      (e) =>
        sequence.evaluations.find((x) => x.a.id === e.a.id)!.finish !==
        e.finish,
    )
  )
    return {
      error: "These activities need more time before your existing plan.",
    }
  return { assignment }
}

export function removeFromGap(
  state: State,
  gap: Gap,
  id: string,
): Assignment | undefined {
  const choice = state.assign[gap.key]
  if (choice?.kind !== "act") return choice
  const ids = assignmentIds(choice).filter((item) => item !== id)
  if (!ids.length)
    return choice.remainingChoice ? { kind: choice.remainingChoice } : undefined
  const sequence = assignedSequence(state, gap, choice)
  return {
    ...choice,
    id: ids[0],
    ids,
    title: ids
      .map((id) => state.acts.find((a) => a.id === id)?.title ?? "Activity")
      .join(" + "),
    notBefore: Object.fromEntries(
      sequence.evaluations
        .filter((e) => e.a.id !== id)
        .map((e) => [e.a.id, departureOf(e)]),
    ),
    locations: Object.fromEntries(
      sequence.evaluations
        .filter((e) => e.a.id !== id)
        .map((e) => [e.a.id, e.loc]),
    ),
  }
}
