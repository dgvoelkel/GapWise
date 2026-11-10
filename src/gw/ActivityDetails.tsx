import { ArrowRight, Check, Clock3, MapPin, Pencil, Trash2 } from "lucide-react"
import {
  type Activity,
  type Gap,
  DAYS,
  atLocation,
  deadlineLabel,
  energyOf,
  evaluate,
  fmt,
} from "./logic"
import { type State, assignmentIds, suitableGaps } from "./state"
import {
  ActIcon,
  CompletedLabel,
  FitBadge,
  PriorityTag,
  RoutePreview,
  RouteSummary,
  Sheet,
} from "./components"
import { type GapActions } from "./GapWorkspace"
import { Button } from "./ui"

export default function ActivityDetails({
  activity,
  gap,
  state,
  location,
  actions,
  onClose,
  onEdit,
  onDelete,
  onToggle,
  onGap,
}: {
  activity: Activity
  gap?: Gap
  state: State
  location?: string
  actions: GapActions
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onGap: (g: Gap, activity: Activity) => void
}) {
  const a = activity
  const e = gap
    ? evaluate(atLocation(a, location), gap, state.prefs)
    : undefined
  const booking = Object.entries(state.assign).find(([, choice]) =>
    assignmentIds(choice).includes(a.id),
  )
  const alternatives = suitableGaps(
    state,
    atLocation(a, location),
    booking?.[0] ?? gap?.key,
  )
  const assignment = gap && state.assign[gap.key]
  const canAssign =
    !!gap &&
    !!e &&
    e.fit !== "none" &&
    !a.done &&
    !booking &&
    !assignment &&
    (gap.day > 0 || gap.end > state.now)
  const rows: [string, number][] =
    e && gap
      ? [
          ["Time until next commitment", gap.total],
          ["Walk to activity", -e.t1],
          ["Setup time", -e.setup],
          ...(e.wait > 0
            ? [["Wait for opening", -e.wait] as [string, number]]
            : []),
          ["Activity duration", -a.duration],
          ["Walk to next commitment", -e.t2],
          ["Arrival buffer", -gap.buffer],
        ]
      : []
  return (
    <Sheet title="Activity details" onClose={onClose} wide>
      <div className="activity-detail-heading">
        <ActIcon a={a} />
        <div>
          <h2>{a.title}</h2>
          <div className="activity-tags">
            <PriorityTag p={a.priority} />
            {a.done && <CompletedLabel />}
          </div>
        </div>
      </div>
      <div className="details-grid">
        <div className="detail-main">
          <dl className="property-list">
            <div>
              <dt>Duration</dt>
              <dd>
                {a.duration} minutes
                {(a.setup ?? 0) > 0 && ` + ${a.setup} min setup`}
              </dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd>{deadlineLabel(a)}</dd>
            </div>
            <div>
              <dt>{a.required ? "Available window" : "Preferred time"}</dt>
              <dd>
                {a.preferred
                  ? `${fmt(a.preferred[0])}–${fmt(a.preferred[1])}`
                  : "Any time"}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {a.flexibleLocation || !a.locations.length
                  ? "Flexible · near your route"
                  : a.locations.join(" or ")}
              </dd>
            </div>
            <div>
              <dt>Energy needed</dt>
              <dd className="capitalize">{energyOf(a)}</dd>
            </div>
          </dl>
          {a.notes && <p className="activity-notes">{a.notes}</p>}
          {e && gap && (
            <section className="feasibility-section">
              <div className="section-heading">
                <h3>Before {gap.next.title}</h3>
                <FitBadge fit={e.fit} />
              </div>
              <p className="small muted">
                {DAYS[gap.day]} · {fmt(gap.start)}–{fmt(gap.end)}
              </p>
              <p className={e.fit === "none" ? "warning-text" : ""}>
                {e.reason}
              </p>
              {e.outsidePreferred && !a.required && (
                <p className="small muted">
                  This is outside your preferred time. You can still choose it.
                </p>
              )}
              <dl className="time-calculation">
                {rows.map(([label, value], i) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {i === 0 ? "" : "− "}
                      {Math.abs(value)} min
                    </dd>
                  </div>
                ))}
                <div className="calculation-total">
                  <dt>{e.remaining < 0 ? "Short by" : "Remaining time"}</dt>
                  <dd>{Math.abs(e.remaining)} min</dd>
                </div>
              </dl>
              <p className="small muted">
                The complete route takes {e.t1 + e.t2} min walking. That’s{" "}
                {e.extraTravel <= 1
                  ? "little or no extra detour"
                  : `${e.extraTravel} min more than walking directly`}{" "}
                to {gap.next.location}.
              </p>
            </section>
          )}
          {booking && !a.done && (
            <p className="planned-notice">
              Already planned in a gap.
              {booking[0] !== gap?.key && " Choose another time to move it."}
            </p>
          )}
          <div className="button-row detail-primary-actions">
            {!a.done && !booking && (
              <Button
                variant="primary"
                disabled={!canAssign}
                onClick={() => gap && actions.onAssign(gap, [a.id], location)}
              >
                Add to gap
              </Button>
            )}
            {!a.done && (
              <Button
                variant="secondary"
                onClick={() => actions.onFindTime(a, booking?.[0] ?? gap?.key)}
              >
                <Clock3 size={15} />
                {booking
                  ? "Move to another gap"
                  : e?.fit === "none"
                    ? "Find another time"
                    : "Find a gap"}
              </Button>
            )}
          </div>
          {!a.done && !booking && alternatives.length > 0 && (
            <section className="alternative-gaps">
              <h3>
                {e?.fit === "none"
                  ? "It fits in another gap"
                  : "Other available gaps"}
              </h3>
              {alternatives.slice(0, 3).map((g) => (
                <Button
                  key={g.key}
                  variant="secondary"
                  onClick={() => onGap(g, a)}
                >
                  <span>
                    <b>
                      {DAYS[g.day]} · {fmt(g.start)}–{fmt(g.end)}
                    </b>
                    <small>
                      {g.usable} min usable · before {g.next.title}
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </Button>
              ))}
            </section>
          )}
        </div>
        <div className="detail-route">
          {gap && e ? (
            <>
              <div className="section-heading">
                <h3>Your route</h3>
                <Button
                  size="small"
                  onClick={() => actions.onMap(gap, a.id, location)}
                >
                  <MapPin size={14} />
                  Full map
                </Button>
              </div>
              <RoutePreview
                g={gap}
                e={e}
                onExpand={() => actions.onMap(gap, a.id, location)}
              />
              <RouteSummary g={gap} e={e} />
            </>
          ) : (
            <div className="empty-state">
              <MapPin size={23} />
              <h3>Choose a gap to compare routes.</h3>
              <Button variant="secondary" onClick={() => actions.onFindTime(a)}>
                Find a gap
              </Button>
            </div>
          )}
        </div>
      </div>
      <footer className="detail-management">
        <Button variant="secondary" onClick={onToggle}>
          <Check size={15} />
          {a.done ? "Mark unfinished" : "Mark completed"}
        </Button>
        <Button onClick={onEdit}>
          <Pencil size={15} />
          Edit activity
        </Button>
        <Button className="danger-text" onClick={onDelete}>
          <Trash2 size={15} />
          Delete
        </Button>
      </footer>
    </Sheet>
  )
}
