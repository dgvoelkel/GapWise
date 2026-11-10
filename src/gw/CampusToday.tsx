import { useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  List,
  Map as MapIcon,
  Plus,
} from "lucide-react"
import { type Gap, DATE_LABELS, fmt } from "./logic"
import { type State } from "./state"
import { EmptyState, TimeSummary } from "./components"
import GapWorkspace, { type GapActions } from "./GapWorkspace"
import MapPanel, { type Selection } from "./MapPanel"
import { Button } from "./ui"

type Props = {
  state: State
  gap?: Gap
  selection: Selection
  actions: GapActions
  onGap: (g: Gap) => void
  onCommitment: (id: string) => void
  onPlan: () => void
  onAddCommitment: () => void
}
export default function CampusToday({
  state,
  gap,
  selection,
  actions,
  onGap,
  onCommitment,
  onPlan,
  onAddCommitment,
}: Props) {
  const [view, setView] = useState<"list" | "map">("list")
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
          Your day
        </Button>
      </header>
      {gap ? (
        <>
          <TimeSummary g={gap} now={state.now} />
          <div
            className="mobile-view-toggle segmented"
            aria-label="Recommendation view"
          >
            <Button
              aria-pressed={view === "list"}
              className={view === "list" ? "is-active" : ""}
              onClick={() => setView("list")}
            >
              <List size={16} />
              List
            </Button>
            <Button
              aria-pressed={view === "map"}
              className={view === "map" ? "is-active" : ""}
              onClick={() => setView("map")}
            >
              <MapIcon size={16} />
              Map
            </Button>
          </div>
          <div className={`now-layout mobile-show-${view}`}>
            <div className="now-recommendations">
              <GapWorkspace
                state={state}
                gap={gap}
                selectedId={selection.id}
                selectedLocation={selection.location}
                actions={actions}
              />
            </div>
            <div className="now-map">
              <MapPanel
                state={state}
                gap={gap}
                selection={selection}
                actions={actions}
                onGap={onGap}
                onCommitment={onCommitment}
                onPlan={onPlan}
              />
            </div>
          </div>
          {state.prefs.style === "ahead" && (
            <section className="plan-next-card">
              <CalendarDays size={21} />
              <div>
                <h3>Look a little further ahead</h3>
                <p>Explore the rest of today or make a plan for tomorrow.</p>
              </div>
              <Button variant="secondary" onClick={onPlan}>
                Plan Ahead
                <ArrowRight size={14} />
              </Button>
            </section>
          )}
        </>
      ) : (
        <div className="now-layout">
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
                Plan Ahead
              </Button>
              <Button variant="secondary" onClick={onAddCommitment}>
                <Plus size={15} />
                Add commitment
              </Button>
            </div>
          </EmptyState>
          <MapPanel
            state={state}
            selection={selection}
            actions={actions}
            onGap={onGap}
            onCommitment={onCommitment}
            onPlan={onPlan}
          />
        </div>
      )}
    </main>
  )
}
