import { ArrowRight, CalendarDays, Plus } from "lucide-react"
import { type Gap, DATE_LABELS, fmt } from "./logic"
import { type State } from "./state"
import { EmptyState, TimeSummary } from "./components"
import GapWorkspace, { type GapActions } from "./GapWorkspace"
import { type Selection } from "./MapPanel"
import { Button } from "./ui"

type Props = {
  state: State
  gap?: Gap
  selection: Selection
  actions: GapActions
  onPlan: () => void
  onAddCommitment: () => void
}
export default function CampusToday({
  state,
  gap,
  selection,
  actions,
  onPlan,
  onAddCommitment,
}: Props) {
  const current = state.cs.find(
    (c) =>
      c.day === 0 && !c.canceled && c.start <= state.now && c.end > state.now,
  )
  const upcoming = gap && state.now < gap.start
  return (
    <main className="workspace-page right-now-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">
            {DATE_LABELS[0]} · {fmt(state.now)}
          </div>
          <h1>Right Now</h1>
          <p>
            {current
              ? `You’re in ${current.title}. Your next gap starts at ${fmt(gap?.start ?? current.end)}.`
              : upcoming
                ? `Your next gap starts at ${fmt(gap.start)}.`
                : "A little time. A realistic plan."}
          </p>
        </div>
        <Button variant="secondary" onClick={onPlan}>
          <CalendarDays size={16} />
          Plan your day
        </Button>
      </header>
      {gap ? (
        <>
          <section className="now-card" aria-label="Your next decision">
            <TimeSummary g={gap} now={state.now} />
            <GapWorkspace
              key={gap.key}
              state={state}
              gap={gap}
              selectedId={selection.id}
              selectedLocation={selection.location}
              actions={actions}
              withMap
              heading={upcoming ? "For your next gap" : "What fits right now"}
            />
          </section>
          {state.prefs.style === "ahead" && (
            <section className="plan-next-card">
              <CalendarDays size={21} />
              <div>
                <h3>Look a little further ahead</h3>
                <p>Explore the rest of today or make a plan for tomorrow.</p>
              </div>
              <Button variant="secondary" onClick={onPlan}>
                Open Plan
                <ArrowRight size={14} />
              </Button>
            </section>
          )}
        </>
      ) : (
        <div className="now-empty">
          <EmptyState
            title={
              state.cs.filter((c) => c.day === 0 && !c.canceled).length < 2
                ? "Your day is open."
                : "No more gaps today."
            }
          >
            <p>
              {state.cs.filter((c) => c.day === 0 && !c.canceled).length < 2
                ? "Add commitments to find time between them."
                : "You can plan a future day or adjust your schedule."}
            </p>
            <div className="button-row">
              <Button variant="primary" onClick={onPlan}>
                Open Plan
              </Button>
              <Button variant="secondary" onClick={onAddCommitment}>
                <Plus size={15} />
                Add commitment
              </Button>
              <Button onClick={() => actions.onMap()}>
                Open full map
                <ArrowRight size={14} />
              </Button>
            </div>
          </EmptyState>
        </div>
      )}
    </main>
  )
}
