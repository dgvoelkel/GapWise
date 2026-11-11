import { ArrowRight, Footprints, Leaf, Minus, RotateCcw } from "lucide-react"
import { type Gap, fmt } from "./logic"
import { type State } from "./state"
import {
  departureOf,
  gapTimeline,
  remainingState,
  remainingWindow,
} from "./plan-time"
import GapWorkspace, { AssignmentCard, type GapActions } from "./GapWorkspace"
import { type GapFocus } from "./CalendarGap"
import { Button } from "./ui"

export default function PlanGapDetails({
  state,
  gap,
  focus,
  selectedId,
  selectedLocation,
  actions,
  onFocus,
}: {
  state: State
  gap: Gap
  focus: GapFocus
  selectedId?: string
  selectedLocation?: string
  actions: GapActions
  onFocus: (focus: GapFocus) => void
}) {
  const assignment = state.assign[gap.key]
  const timeline = gapTimeline(state, gap)
  const window = remainingWindow(
    state,
    gap,
    focus.kind === "available" ? focus.start : undefined,
  )
  if (assignment?.kind !== "act") return null
  const sequence = timeline.sequence!
  const choice = assignment.remainingChoice
  const remainingActions: GapActions = {
    ...actions,
    onAssign: (g, ids, location) => actions.onAssign(g, ids, location, true),
    onDetails: (id, g, location) => actions.onDetails(id, g, location, true),
    onMap: (g, id, location) => actions.onMap(g, id, location, true),
    onChoice: (_, kind) => actions.onRemainingChoice(gap, kind),
  }

  return (
    <div className="plan-assigned-gap">
      <section className="plan-time-balance" aria-label="Gap time breakdown">
        <div className="section-kicker">
          {timeline.gap.total} min between commitments
        </div>
        <h2>
          <strong>{timeline.available}</strong> min still available
        </h2>
        <p>{timeline.planned} min planned, including setup</p>
        <div className="plan-reserved-summary">
          <Footprints size={14} />
          {timeline.walking} min walking + {timeline.buffer} min arrival buffer
          reserved
        </div>
        {sequence.extraTravel > 0 && (
          <small>Walking includes a +{sequence.extraTravel} min detour.</small>
        )}
        {timeline.waiting > 0 && (
          <p>{timeline.waiting} min opening wait reserved</p>
        )}
        {sequence.fit === "none" && (
          <p className="warning-text">Plan needs review. {sequence.reason}</p>
        )}
      </section>
      <AssignmentCard
        state={state}
        gap={gap}
        assignment={assignment}
        actions={actions}
        availableMinutes={timeline.available}
      />
      <section
        className="plan-time-details"
        aria-label="Scheduled activity times"
      >
        {sequence.evaluations.map((e) => {
          const start = e.finish - e.a.duration - e.setup
          return (
            <div
              key={e.a.id}
              className={`plan-scheduled-row ${
                focus.kind === "activity" && focus.id === e.a.id
                  ? "is-selected"
                  : ""
              }`}
            >
              <Button
                className="plan-scheduled-label"
                onClick={() =>
                  actions.onDetails(e.a.id, gap, assignment.locations?.[e.a.id])
                }
                aria-label={`View details for ${e.a.title}`}
              >
                <strong>
                  {e.a.title} — {e.a.duration + e.setup} min planned
                </strong>
                <span>
                  {e.wait > 0 ? (
                    <>
                      {e.setup > 0 &&
                        `${fmt(departureOf(e) + e.t1)}–${fmt(departureOf(e) + e.t1 + e.setup)} setup · `}
                      {fmt(e.finish - e.a.duration)}–{fmt(e.finish)} activity
                    </>
                  ) : (
                    <>
                      {fmt(start)}–{fmt(e.finish)}
                    </>
                  )}
                </span>
                <small>
                  {e.a.duration} min activity
                  {e.setup > 0 && ` + ${e.setup} min setup`}
                  {e.a.done && " · Completed"}
                </small>
              </Button>
              <Button
                size="icon"
                className="plan-remove-activity"
                aria-label={`Remove ${e.a.title} from this gap`}
                onClick={() => actions.onRemove(gap, e.a.id)}
              >
                <Minus size={16} />
              </Button>
            </div>
          )
        })}
        <details className="plan-reservation-details">
          <summary>Walking and buffer breakdown</summary>
          <dl className="property-list">
            {timeline.parts
              .filter(
                (p) =>
                  p.kind === "walking" ||
                  p.kind === "buffer" ||
                  p.kind === "waiting",
              )
              .map((part, i) => (
                <div key={i}>
                  <dt>{part.label}</dt>
                  <dd>
                    {part.end - part.start} min · {fmt(part.start)}–
                    {fmt(part.end)}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      </section>
      {timeline.available > 0 && (
        <section
          className="plan-remaining-time"
          aria-label="Remaining available time"
        >
          <div className="section-heading">
            <h3>
              {timeline.available} min{" "}
              {choice === "open" ? "kept open" : "still available"}
            </h3>
            {choice === "open" && <Leaf size={17} />}
          </div>
          {choice ? (
            <>
              <p className="small muted">
                {choice === "open"
                  ? "Your planned activities stay scheduled. The rest of this time is yours."
                  : "Your planned activities stay scheduled. Decide about the rest later."}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  actions.onRemainingChoice(gap)
                  onFocus({ kind: "available", start: window?.gap.start })
                }}
              >
                <RotateCcw size={14} />
                Change remaining-time choice
              </Button>
            </>
          ) : focus.kind === "available" && window ? (
            <>
              {timeline.windows.length > 1 && (
                <label className="plan-window-select">
                  Available portion
                  <select
                    value={window.gap.start}
                    onChange={(event) =>
                      onFocus({
                        kind: "available",
                        start: Number(event.target.value),
                      })
                    }
                  >
                    {timeline.windows.map((w) => (
                      <option key={w.gap.start} value={w.gap.start}>
                        {fmt(w.start)}–{fmt(w.end)} · {w.gap.usable} min
                        available
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="small muted">
                {fmt(window.start)}–{fmt(window.end)} · {window.gap.usable} min
                available. Walking to {window.gap.next.title} and its arrival
                buffer stay reserved.
              </p>
              <GapWorkspace
                key={`${gap.key}-${window.gap.start}`}
                state={remainingState(state, gap)}
                gap={window.gap}
                selectedId={selectedId}
                selectedLocation={selectedLocation}
                actions={remainingActions}
                remaining
                heading="Activities for this time"
              />
            </>
          ) : window ? (
            <div className="button-row">
              <Button
                variant="secondary"
                onClick={() =>
                  onFocus({ kind: "available", start: window.gap.start })
                }
              >
                Plan available time
                <ArrowRight size={14} />
              </Button>
              <Button onClick={() => actions.onRemainingChoice(gap, "open")}>
                <Leaf size={14} />
                Keep remaining time open
              </Button>
            </div>
          ) : (
            <p className="small muted">
              Review the existing plan before adding another activity.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
