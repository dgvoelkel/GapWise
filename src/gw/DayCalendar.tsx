import { CalendarDays, Check, Clock3, Leaf, MapPin } from "lucide-react"
import { type Gap, DATE_LABELS, DAYS, fmt, gapsFor, gapAtTime } from "./logic"
import { type State, assignmentIds } from "./state"
import { EmptyState } from "./components"
import { Button } from "./ui"

const HOUR_HEIGHT = 56

export default function DayCalendar({
  state,
  day,
  gap,
  onGap,
  onCommitment,
  onAdd,
}: {
  state: State
  day: number
  gap?: Gap
  onGap: (g: Gap) => void
  onCommitment: (id: string) => void
  onAdd: () => void
}) {
  const commitments = state.cs
    .filter((c) => c.day === day)
    .sort((a, b) => a.start - b.start)
  const active = commitments.filter((c) => !c.canceled)
  const canceled = commitments.filter((c) => c.canceled)
  const gaps = gapsFor(state.cs, day, state.prefs)
  const start = Math.min(
    8 * 60,
    ...active.map((c) => Math.floor(c.start / 60) * 60),
  )
  const end = Math.max(
    20 * 60,
    ...active.map((c) => Math.ceil(c.end / 60) * 60),
  )
  const hours = Array.from(
    { length: (end - start) / 60 + 1 },
    (_, i) => start + i * 60,
  )
  const offset = (time: number) => ((time - start) / 60) * HOUR_HEIGHT
  const showNow = day === 0 && state.now >= start && state.now < end

  return (
    <section className="calendar-panel" aria-label={`${DAYS[day]} calendar`}>
      <div className="section-heading">
        <h2>
          <CalendarDays size={17} />
          {DATE_LABELS[day]}
        </h2>
        <span className="small muted">
          {active.length} {active.length === 1 ? "commitment" : "commitments"}
        </span>
      </div>
      <div className="day-grid-heading" aria-hidden="true">
        <span>Day</span>
        <span>Schedule</span>
        <span>Gaps</span>
      </div>
      <div
        className="calendar-day-grid"
        aria-label={`Day view, ${fmt(start)} to ${fmt(end)}`}
        data-start={start}
        data-end={end}
        style={{ height: offset(end) }}
      >
        {hours.map((hour) => (
          <div
            className="day-grid-hour"
            key={hour}
            style={{ top: offset(hour) }}
          >
            <time>
              {hour === 1440 ? "12 AM" : fmt(hour).replace(":00", "")}
            </time>
          </div>
        ))}
        <div className="day-grid-events">
          {active.map((c) => (
            <Button
              key={c.id}
              className={`calendar-event ${
                c.end - c.start < 60 ? "is-compact" : ""
              }`}
              style={{
                top: offset(c.start),
                height: Math.max(44, offset(c.end) - offset(c.start) - 3),
              }}
              aria-label={`Edit ${c.title}`}
              title={`${c.title} · ${fmt(c.start)}–${fmt(c.end)} · ${c.location}`}
              data-start={c.start}
              data-end={c.end}
              onClick={() => onCommitment(c.id)}
            >
              <span>
                <strong>{c.title}</strong>
                <small className="calendar-event-time">
                  {fmt(c.start)}–{fmt(c.end)}
                </small>
                <small className="calendar-event-location">
                  <MapPin size={11} />
                  {c.location}
                </small>
              </span>
            </Button>
          ))}
        </div>
        <div className="day-grid-gaps">
          {gaps.map((raw) => {
            const g = raw.day === 0 ? gapAtTime(raw, state.now) : raw
            const assignment = state.assign[g.key]
            const title =
              assignment?.kind === "act"
                ? assignmentIds(assignment)
                    .map(
                      (id) =>
                        state.acts.find((a) => a.id === id)?.title ??
                        "Activity",
                    )
                    .join(" + ")
                : assignment?.kind === "open"
                  ? "Kept open"
                  : assignment?.kind === "skip"
                    ? "Decide later"
                    : "Free gap"
            const done =
              assignment?.kind === "act" &&
              assignmentIds(assignment).every(
                (id) => state.acts.find((a) => a.id === id)?.done,
              )
            const Icon =
              assignment?.kind === "act"
                ? Check
                : assignment?.kind === "open"
                  ? Leaf
                  : Clock3
            return (
              <Button
                key={g.key}
                className={`calendar-gap ${
                  gap?.key === g.key ? "is-selected" : ""
                } ${assignment?.kind === "open" ? "is-open" : ""} ${
                  assignment?.kind === "act" ? "is-planned" : ""
                } ${day === 0 && g.end <= state.now ? "is-past" : ""} ${
                  raw.total < 60 ? "is-short" : ""
                } ${raw.total < 135 ? "is-compact" : ""} ${
                  assignment ? "has-choice" : ""
                }`}
                style={{
                  top: offset(raw.start),
                  height: Math.max(44, offset(raw.end) - offset(raw.start) - 3),
                }}
                aria-pressed={gap?.key === g.key}
                aria-label={`Select ${fmt(raw.start)} gap, ${g.usable} usable minutes, ${title}`}
                title={`${title} · ${fmt(raw.start)}–${fmt(raw.end)} · ${
                  g.usable
                } min usable · ${g.travel} min walk + ${g.buffer} min buffer`}
                data-start={raw.start}
                data-end={raw.end}
                onClick={() => {
                  onGap(g)
                  if (window.innerWidth < 850)
                    requestAnimationFrame(() =>
                      document
                        .querySelector(".planning-gap-panel")
                        ?.scrollIntoView({ block: "start" }),
                    )
                }}
              >
                <span
                  className={`calendar-gap-heading ${
                    !assignment && raw.total < 90 ? "is-redundant" : ""
                  }`}
                >
                  <Icon size={13} />
                  <strong>
                    {title}
                    {done && " · Completed"}
                  </strong>
                </span>
                <span className="calendar-gap-content">
                  <b>{g.usable} min usable</b>
                  <small>
                    {fmt(raw.start)}–{fmt(raw.end)}
                  </small>
                  <small className="calendar-gap-calculation">
                    {raw.total} min gap
                    {g.start > raw.start && ` · ${g.total} min left`}
                    <br />
                    {g.travel} min walk + {g.buffer} min buffer
                  </small>
                </span>
              </Button>
            )
          })}
        </div>
        {showNow && (
          <div
            className="calendar-now-line"
            style={{ top: offset(state.now) }}
            aria-label={`Now, ${fmt(state.now)}`}
          >
            <span>Now</span>
          </div>
        )}
        {!active.length && (
          <div className="calendar-empty">
            <EmptyState title="A day without a fixed plan.">
              <p>Add a commitment when you have somewhere to be.</p>
            </EmptyState>
          </div>
        )}
      </div>
      <div className="calendar-key">
        <span>
          <i className="calendar-key-event" />
          Commitment
        </span>
        <span>
          <i className="calendar-key-gap" />
          Gap · select to plan
        </span>
      </div>
      {canceled.length > 0 && (
        <div className="calendar-canceled">
          <span className="section-kicker">Canceled</span>
          {canceled.map((c) => (
            <Button
              key={c.id}
              className="canceled-commitment"
              onClick={() => onCommitment(c.id)}
              aria-label={`Edit ${c.title}`}
            >
              <span>{c.title}</span>
              <small>{fmt(c.start)}</small>
            </Button>
          ))}
        </div>
      )}
      <Button variant="secondary" className="full-width" onClick={onAdd}>
        Add commitment
      </Button>
    </section>
  )
}
