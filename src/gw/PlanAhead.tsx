import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Leaf,
  MapPin,
  Plus,
} from "lucide-react"
import { type Gap, DATE_LABELS, DAYS, fmt, gapsFor, gapAtTime } from "./logic"
import { type State, assignmentIds } from "./state"
import { EmptyState, TimeSummary } from "./components"
import GapWorkspace, { type GapActions } from "./GapWorkspace"
import { Button } from "./ui"

export default function PlanAhead({
  state,
  day,
  gap,
  selectedId,
  selectedLocation,
  onDay,
  onGap,
  onCommitment,
  onAdd,
  actions,
}: {
  state: State
  day: number
  gap?: Gap
  selectedId?: string
  selectedLocation?: string
  onDay: (d: number) => void
  onGap: (g: Gap) => void
  onCommitment: (id: string) => void
  onAdd: () => void
  actions: GapActions
}) {
  const commitments = state.cs
    .filter((c) => c.day === day)
    .sort((a, b) => a.start - b.start)
  const gaps = gapsFor(state.cs, day, state.prefs)
  return (
    <main className="workspace-page plan-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">October 2026</div>
          <h1>Plan Ahead</h1>
          <p>Choose a gap. Make a plan, or leave it open.</p>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <Plus size={16} />
          Add commitment
        </Button>
      </header>
      <div className="day-selector" aria-label="Choose planning day">
        {DAYS.map((label, i) => (
          <Button
            key={i}
            className={day === i ? "is-active" : ""}
            aria-pressed={day === i}
            onClick={() => onDay(i)}
          >
            <span>{i < 2 ? label : DATE_LABELS[i].slice(0, 3)}</span>
            <b>{14 + i}</b>
            <small>{gapsFor(state.cs, i, state.prefs).length} gaps</small>
          </Button>
        ))}
      </div>
      <div className="plan-layout">
        <section
          className="calendar-panel"
          aria-label={`${DAYS[day]} calendar`}
        >
          <div className="section-heading">
            <h2>
              <CalendarDays size={17} />
              {DATE_LABELS[day]}
            </h2>
            <span className="small muted">
              {commitments.filter((c) => !c.canceled).length} commitments
            </span>
          </div>
          <div className="calendar-timeline">
            {commitments.map((c) => {
              const raw = gaps.find((g) => g.prev.id === c.id)
              const g = raw && raw.day === 0 ? gapAtTime(raw, state.now) : raw
              const a = raw && state.assign[raw.key]
              const title =
                a?.kind === "act"
                  ? assignmentIds(a)
                      .map(
                        (id) =>
                          state.acts.find((x) => x.id === id)?.title ??
                          "Activity",
                      )
                      .join(" + ")
                  : a?.kind === "open"
                    ? "Kept open · This time is yours"
                    : a?.kind === "skip"
                      ? "Decide later"
                      : "Free gap"
              const done =
                a?.kind === "act" &&
                assignmentIds(a).every(
                  (id) => state.acts.find((x) => x.id === id)?.done,
                )
              return (
                <div key={c.id} className="calendar-group">
                  <div
                    className={`calendar-row ${
                      c.canceled ? "is-canceled" : ""
                    }`}
                  >
                    <div className="calendar-time">
                      <b>{fmt(c.start).replace(" ", "\u00a0")}</b>
                      <span>{fmt(c.end).replace(" ", "\u00a0")}</span>
                    </div>
                    <Button
                      className={`calendar-event ${
                        c.canceled ? "is-canceled" : ""
                      }`}
                      style={{
                        minHeight: Math.max(
                          76,
                          Math.min(140, (c.end - c.start) * 1.1),
                        ),
                      }}
                      onClick={() => onCommitment(c.id)}
                      aria-label={`Edit ${c.title}`}
                    >
                      <span>
                        <strong>
                          {c.title}
                          {c.canceled && " · Canceled"}
                        </strong>
                        <small>
                          <MapPin size={13} />
                          {c.location}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                  {g && raw && (
                    <div className="calendar-row">
                      <div className="calendar-time">
                        <b>{fmt(raw.start).replace(" ", "\u00a0")}</b>
                        <span>{fmt(raw.end).replace(" ", "\u00a0")}</span>
                      </div>
                      <Button
                        className={`calendar-gap ${
                          gap?.key === g.key ? "is-selected" : ""
                        } ${a?.kind === "open" ? "is-open" : ""} ${
                          a?.kind === "act" ? "is-planned" : ""
                        } ${day === 0 && g.end <= state.now ? "is-past" : ""}`}
                        style={{
                          minHeight: Math.max(
                            78,
                            Math.min(170, raw.total * 1.05),
                          ),
                        }}
                        aria-pressed={gap?.key === g.key}
                        aria-label={`Select ${fmt(raw.start)} gap, ${g.usable} usable minutes`}
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
                        <span className="calendar-gap-icon">
                          {a?.kind === "open" ? (
                            <Leaf size={18} />
                          ) : a?.kind === "act" ? (
                            <Check size={18} />
                          ) : (
                            <Clock3 size={18} />
                          )}
                        </span>
                        <span>
                          <strong>
                            {title}
                            {done && " · Completed"}
                          </strong>
                          <small>
                            {g.usable} min usable · {g.total} min gap
                          </small>
                          <small>
                            {g.travel} min walk + {g.buffer} min buffer
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!commitments.length && (
            <EmptyState title="No commitments on this day.">
              <p>Your time is open.</p>
              <Button variant="secondary" onClick={onAdd}>
                Add a commitment
              </Button>
            </EmptyState>
          )}
          <Button variant="secondary" className="full-width" onClick={onAdd}>
            <Plus size={15} />
            Add commitment
          </Button>
        </section>
        <section className="planning-gap-panel" aria-label="Selected gap">
          {gap ? (
            <>
              <div className="section-heading">
                <h2>
                  {DAYS[gap.day]} · {fmt(gap.start)}–{fmt(gap.end)}
                </h2>
                <Button
                  size="small"
                  onClick={() =>
                    actions.onMap(gap, selectedId, selectedLocation)
                  }
                >
                  <MapPin size={15} />
                  View map
                </Button>
              </div>
              <div className="between-commitments">
                <span>
                  After <b>{gap.prev.title}</b> · {gap.prev.location}
                </span>
                <span>
                  Before <b>{gap.next.title}</b> · {gap.next.location}
                </span>
              </div>
              <TimeSummary g={gap} compact />
              <GapWorkspace
                key={gap.key}
                state={state}
                gap={gap}
                selectedId={selectedId}
                selectedLocation={selectedLocation}
                actions={actions}
                heading="Activities that fit"
              />
            </>
          ) : (
            <EmptyState
              title={
                commitments.length
                  ? "No gaps between these commitments."
                  : "A day without a fixed plan."
              }
            >
              <p>
                {commitments.length
                  ? "You can edit a commitment or explore another day."
                  : "Add a commitment when you have somewhere to be."}
              </p>
            </EmptyState>
          )}
        </section>
      </div>
    </main>
  )
}
