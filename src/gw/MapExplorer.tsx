import { ArrowLeft, CalendarDays } from "lucide-react"
import { type Gap, DAYS, allGaps, fmt, futureGap, gapAtTime } from "./logic"
import { type State } from "./state"
import { TimeSummary } from "./components"
import { type GapActions } from "./GapWorkspace"
import MapPanel, { type Selection } from "./MapPanel"
import { Button } from "./ui"

export default function MapExplorer({
  state,
  gap,
  selection,
  actions,
  onGap,
  onCommitment,
  onPlan,
  onReturn,
  returnLabel,
}: {
  state: State
  gap?: Gap
  selection: Selection
  actions: GapActions
  onGap: (g: Gap) => void
  onCommitment: (id: string) => void
  onPlan: () => void
  onReturn?: () => void
  returnLabel?: string
}) {
  const gaps = allGaps(state.cs, state.prefs).filter((g) =>
    futureGap(g, state.now),
  )
  return (
    <main className="workspace-page map-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">Tulane · Uptown campus</div>
          <h1>Map</h1>
          <p>Your activity, your full route, and where you need to be next.</p>
        </div>
        {onReturn ? (
          <Button variant="secondary" onClick={onReturn}>
            <ArrowLeft size={15} />
            {returnLabel ?? "Return to gap"}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onPlan}>
            <CalendarDays size={15} />
            Plan this gap
          </Button>
        )}
      </header>
      <section className="map-context-bar">
        <label>
          <span>Explore a gap</span>
          <select
            aria-label="Map gap"
            value={gap?.key ?? ""}
            onChange={(e) => {
              const g = gaps.find((g) => g.key === e.target.value)
              if (g) onGap(g.day === 0 ? gapAtTime(g, state.now) : g)
            }}
          >
            {!gap && <option value="">Select a gap</option>}
            {gaps.map((g) => (
              <option value={g.key} key={g.key}>
                {DAYS[g.day]} · {fmt(g.start)}–{fmt(g.end)} · {g.prev.location}{" "}
                → {g.next.location}
              </option>
            ))}
          </select>
        </label>
        {gap && (
          <div>
            <b>{gap.usable} min usable</b>
            <span>
              {gap.total} gap − {gap.travel} walking − {gap.buffer} buffer
            </span>
          </div>
        )}
        <Button variant="secondary" onClick={onPlan}>
          Plan this gap
        </Button>
      </section>
      {!gap && (
        <p className="muted">
          Select or add commitments in Plan Ahead to compare routes with an
          available gap.
        </p>
      )}
      <MapPanel
        state={state}
        gap={gap}
        selection={selection}
        actions={actions}
        onGap={onGap}
        onCommitment={onCommitment}
        onPlan={onPlan}
        full
      />
    </main>
  )
}
