import { ArrowUp, MapPin, Plus } from "lucide-react"
import { type Gap, DATE_LABELS, DAYS, fmt, gapsFor } from "./logic"
import { type State } from "./state"
import { EmptyState, TimeSummary } from "./components"
import GapWorkspace, { type GapActions } from "./GapWorkspace"
import DayCalendar from "./DayCalendar"
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
  return (
    <main className="workspace-page plan-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">October 2026</div>
          <h1>Plan</h1>
          <p>Your whole day, with room to choose what goes between.</p>
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
        <DayCalendar
          state={state}
          day={day}
          gap={gap}
          onGap={onGap}
          onCommitment={onCommitment}
          onAdd={onAdd}
        />
        <section className="planning-gap-panel" aria-label="Selected gap">
          <Button
            size="small"
            className="back-to-day"
            onClick={() =>
              document
                .querySelector(".calendar-panel")
                ?.scrollIntoView({ block: "start" })
            }
          >
            <ArrowUp size={14} />
            Back to day
          </Button>
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
