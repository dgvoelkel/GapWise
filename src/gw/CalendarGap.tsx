import { type Gap, fmt } from "./logic"
import { type State } from "./state"
import { type GapPart, gapTimeline } from "./plan-time"
import { Button } from "./ui"

export type GapFocus = { kind: "overview" } | {
  kind: "activity"
  id: string
} | {
  kind: "available"
  start?: number
}

export default function CalendarGap({
  state,
  gap,
  selected,
  hourHeight,
  dayStart,
  onSelect,
}: {
  state: State
  gap: Gap
  selected: boolean
  hourHeight: number
  dayStart: number
  onSelect: (gap: Gap, focus: GapFocus) => void
}) {
  const timeline = gapTimeline(state, gap)
  const raw = timeline.gap
  const height = (raw.total * hourHeight) / 60
  const activities = timeline.sequence?.evaluations ?? []
  const choice = state.assign[raw.key]
  const keptOpen = choice?.kind === "act" && choice.remainingChoice === "open"
  const needsReview = timeline.sequence?.fit === "none"
  const dense =
    needsReview ||
    timeline.parts.some(
      (p) =>
        p.kind === "activity" && ((p.end - p.start) * hourHeight) / 60 < 32,
    )
  const describe = (part: GapPart) => {
    const minutes = part.end - part.start
    return part.kind === "activity"
      ? `${part.label}, ${part.planned} min planned`
      : part.kind === "available"
        ? `${minutes} min ${keptOpen ? "kept open" : "still available"}`
        : `${minutes} min ${part.label.toLowerCase()}`
  }
  const pick = (part?: GapPart) => {
    if (part?.kind === "activity") {
      onSelect(gap, { kind: "activity", id: part.activityId! })
      return
    }
    if (!part || part.kind === "available") {
      const window = part
        ? timeline.windows.find(
            (w) => part.start >= w.start && part.end <= w.end,
          )
        : timeline.windows.at(-1)
      if (window) {
        onSelect(gap, { kind: "available", start: window.gap.start })
        return
      }
    }
    onSelect(gap, { kind: "overview" })
  }

  return (
    <Button
      className={`calendar-gap is-planned is-partitioned ${
        selected ? "is-selected" : ""
      } ${dense ? "is-dense" : ""} ${needsReview ? "needs-review" : ""} ${
        gap.day === 0 && gap.end <= state.now ? "is-past" : ""
      }`}
      style={{
        top: ((raw.start - dayStart) * hourHeight) / 60,
        height: Math.max(44, height),
      }}
      aria-pressed={selected}
      aria-label={`Select ${fmt(raw.start)} gap, ${timeline.available} minutes ${
        keptOpen ? "kept open" : "still available"
      }. ${activities
        .map((e) => `${e.a.title}, ${e.a.duration + e.setup} min planned`)
        .join(
          ". ",
        )}. ${timeline.walking} min walking and ${timeline.buffer} min arrival buffer.${
        timeline.waiting > 0
          ? ` ${timeline.waiting} min opening wait reserved.`
          : ""
      }${needsReview ? " Plan needs review." : ""}`}
      title={timeline.parts
        .map((p) => `${fmt(p.start)}–${fmt(p.end)} · ${describe(p)}`)
        .join("\n")}
      data-start={raw.start}
      data-end={raw.end}
      data-planned={timeline.planned}
      data-available={timeline.available}
      data-walking={timeline.walking}
      data-buffer={timeline.buffer}
      data-waiting={timeline.waiting}
      onClick={(event) => {
        const activity = (event.target as HTMLElement).closest<HTMLElement>(
          ".calendar-dense-activity[data-activity-id]",
        )
        if (activity?.dataset.activityId) {
          onSelect(gap, { kind: "activity", id: activity.dataset.activityId })
          return
        }
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-part-index]",
        )
        pick(
          target ? timeline.parts[Number(target.dataset.partIndex)] : undefined,
        )
      }}
    >
      <span
        className="calendar-gap-visual"
        style={{ height }}
        aria-hidden="true"
      >
        {timeline.parts.map((part, index) => {
          const minutes = part.end - part.start
          const pixels = (minutes * hourHeight) / 60
          const visible = part.kind === "activity" || part.kind === "available"
          return (
            <span
              key={`${part.kind}-${part.start}-${index}`}
              className={`calendar-gap-segment segment-${part.kind} ${
                pixels < 16 ? "is-tiny" : ""
              } ${keptOpen && part.kind === "available" ? "is-kept-open" : ""}`}
              style={{
                top: `${((part.start - raw.start) / raw.total) * 100}%`,
                height: `${(minutes / raw.total) * 100}%`,
              }}
              data-part-index={index}
              data-kind={part.kind}
              data-start={part.start}
              data-end={part.end}
              data-duration={minutes}
              data-activity-id={part.activityId}
              data-phase={part.phase}
            >
              {!dense && visible && (
                <span className="calendar-segment-label">
                  {part.kind === "activity" ? (
                    <>
                      <strong>{part.label}</strong>
                      <small>
                        {part.planned} min planned
                        {part.evaluation?.a.done ? " · Done" : ""}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>{minutes} min</strong>
                      <small>
                        {keptOpen ? "kept open" : "still available"}
                      </small>
                    </>
                  )}
                </span>
              )}
              {!dense && !visible && pixels >= 16 && (
                <span className="calendar-reserved-label">
                  {minutes}m{" "}
                  {part.kind === "buffer"
                    ? "buffer"
                    : part.kind === "walking"
                      ? "walk"
                      : part.kind}
                </span>
              )}
            </span>
          )
        })}
      </span>
      {dense && (
        <span className="calendar-dense-summary" aria-hidden="true">
          {activities.slice(0, 2).map((e) => (
            <span
              key={e.a.id}
              className="calendar-dense-activity"
              data-activity-id={e.a.id}
            >
              <strong>{e.a.title}</strong>
              <small>{e.a.duration + e.setup} min planned</small>
            </span>
          ))}
          {activities.length > 2 && (
            <small>+{activities.length - 2} more planned</small>
          )}
          <span className="calendar-dense-available">
            <strong>{timeline.available} min</strong>
            <small>{keptOpen ? "kept open" : "still available"}</small>
          </span>
          {needsReview && <small className="warning-text">Needs review</small>}
        </span>
      )}
      <span className="sr-only">
        {timeline.available} min {keptOpen ? "kept open" : "still available"}.
        {timeline.planned} min planned. {timeline.walking} min walking.
        {timeline.buffer} min arrival buffer.
      </span>
    </Button>
  )
}
