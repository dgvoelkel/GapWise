import { useState } from "react"
import {
  ArrowRight,
  Check,
  Clock3,
  Leaf,
  ListFilter,
  MapPin,
  RotateCcw,
} from "lucide-react"
import {
  type Activity,
  type Gap,
  atLocation,
  combos,
  energyOf,
  evaluate,
  fmt,
  rank,
} from "./logic"
import {
  type State,
  type Assignment,
  assignedSequence,
  assignmentIds,
  availableActivities,
} from "./state"
import { EmptyState, FitBadge, RecommendationCard } from "./components"
import { Button } from "./ui"
import NowMapStrip from "./NowMapStrip"
import { departureOf } from "./plan-time"

export type GapActions = {
  onSelect: (id: string, location?: string) => void
  onDetails: (
    id: string,
    g?: Gap,
    location?: string,
    remaining?: boolean,
  ) => void
  onMap: (g?: Gap, id?: string, location?: string, remaining?: boolean) => void
  onAssign: (
    g: Gap,
    ids: string[],
    location?: string,
    remaining?: boolean,
  ) => void
  onChoice: (g: Gap, kind: "open" | "skip") => void
  onClear: (key: string) => void
  onDone: (ids: string[]) => void
  onDismiss: (g: Gap, id: string) => void
  onRestore: (g: Gap) => void
  onFindTime: (a: Activity, exclude?: string) => void
  onRemove: (g: Gap, id: string) => void
  onRemainingChoice: (g: Gap, kind?: "open" | "skip") => void
}
type Props = {
  state: State
  gap: Gap
  selectedId?: string
  selectedLocation?: string
  actions: GapActions
  heading?: string
  withMap?: boolean
  remaining?: boolean
}
const FILTERS = [
  ["short", "Short tasks"],
  ["priority", "High priority"],
  ["energy", "Low energy"],
  ["nearby", "Nearby"],
  ["detour", "No extra detour"],
] as const

export function AssignmentCard({
  state,
  gap,
  assignment,
  actions,
  availableMinutes,
}: {
  state: State
  gap: Gap
  assignment: Assignment
  actions: GapActions
  availableMinutes?: number
}) {
  const ids = assignmentIds(assignment)
  const sequence = assignedSequence(state, gap, assignment)
  const completed =
    ids.length > 0 &&
    ids.every((id) => state.acts.find((a) => a.id === id)?.done)
  return (
    <section
      className={`assignment-card ${
        assignment.kind !== "act" ? "kept-open" : ""
      } ${
        assignment.kind === "act" && sequence.fit === "none" && !completed
          ? "needs-review"
          : ""
      }`}
      aria-label="Gap choice"
    >
      <div className="assignment-heading">
        {assignment.kind === "act" ? (
          <Check size={19} />
        ) : assignment.kind === "open" ? (
          <Leaf size={19} />
        ) : (
          <Clock3 size={19} />
        )}
        <div>
          <span className="section-kicker">
            {assignment.kind === "act"
              ? completed
                ? "Completed"
                : "Planned in this gap"
              : assignment.kind === "open"
                ? "Gap kept open"
                : "Skipped for now"}
          </span>
          <h3>
            {assignment.kind === "act"
              ? ids
                  .map(
                    (id) =>
                      state.acts.find((a) => a.id === id)?.title ?? "Activity",
                  )
                  .join(" + ")
              : assignment.kind === "open"
                ? "This time is yours."
                : "Decide later."}
          </h3>
        </div>
        {assignment.kind === "act" && !completed && (
          <FitBadge fit={sequence.fit} />
        )}
      </div>
      {assignment.kind === "act" && (
        <p className="muted small">
          Scheduled at{" "}
          {fmt(
            sequence.evaluations[0]
              ? departureOf(sequence.evaluations[0])
              : Math.max(gap.prev.end, assignment.startAt ?? gap.prev.end),
          )}
          .
        </p>
      )}
      {assignment.kind === "act" && !completed && (
        <p className={sequence.fit === "none" ? "warning-text" : "muted"}>
          {availableMinutes != null && sequence.fit !== "none"
            ? `${availableMinutes} minutes are still available after the planned activities, walking, and arrival buffer.`
            : sequence.reason}
        </p>
      )}
      <div className="button-row">
        {assignment.kind === "act" && !completed && (
          <Button
            variant="primary"
            size="small"
            onClick={() => actions.onDone(ids)}
          >
            Mark {ids.length === 2 ? "both " : ids.length > 2 ? "all " : ""}
            completed
          </Button>
        )}
        {assignment.kind === "act" && (
          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              actions.onDetails(ids[0], gap, assignment.locations?.[ids[0]])
            }
          >
            View details
          </Button>
        )}
        {assignment.kind === "act" && sequence.fit === "none" && !completed && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              const a = state.acts.find((a) => a.id === ids[0])
              if (a) actions.onFindTime(a, gap.key)
            }}
          >
            Find another time
          </Button>
        )}
        <Button size="small" onClick={() => actions.onClear(gap.key)}>
          <RotateCcw size={13} />
          {assignment.kind === "act" ? "Undo assignment" : "Change choice"}
        </Button>
      </div>
    </section>
  )
}
export default function GapWorkspace({
  state,
  gap,
  selectedId,
  selectedLocation,
  actions,
  heading = "Recommended for this gap",
  withMap = false,
  remaining = false,
}: Props) {
  const [filters, setFilters] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const assignment = state.assign[gap.key]
  const available = availableActivities(state, gap.key)
  const { fits, no } = rank(
    available.map((a) =>
      a.id === selectedId ? atLocation(a, selectedLocation) : a,
    ),
    gap,
    state.prefs,
  )
  const filtered = fits.filter((e) =>
    filters.every((f) =>
      f === "short"
        ? e.a.duration <= 15
        : f === "priority"
          ? e.a.priority === "must"
          : f === "energy"
            ? energyOf(e.a) === "low"
            : f === "nearby"
              ? e.t1 <= 5
              : e.extraTravel <= 1,
    ),
  )
  const shown = showAll ? [...filtered] : filtered.slice(0, 3)
  const selected = filtered.find((e) => e.a.id === selectedId)
  const activeId = withMap ? (selected?.a.id ?? filtered[0]?.a.id) : selectedId
  if (selected && !shown.some((e) => e.a.id === selectedId))
    shown.push(selected)
  const suggestions = combos(
    rank(available, gap, state.prefs).fits,
    gap,
    state.prefs,
  )
  const rest = available.find((a) => a.isRest)
  if (assignment) {
    const sequence = assignedSequence(state, gap, assignment)
    const planned =
      assignment.kind === "act" && sequence.evaluations.some((e) => !e.a.done)
        ? sequence
        : undefined
    return (
      <div className="gap-workspace">
        {withMap && (
          <NowMapStrip
            gap={gap}
            evaluations={planned?.evaluations.filter((e) => !e.a.done) ?? []}
            selectedId={selectedId}
            sequence={planned}
            upcoming={gap.day > 0 || state.now < gap.start}
            onSelect={actions.onSelect}
            onMap={actions.onMap}
          />
        )}
        <AssignmentCard
          state={state}
          gap={gap}
          assignment={assignment}
          actions={actions}
        />
      </div>
    )
  }
  if (gap.day === 0 && gap.end <= state.now)
    return (
      <EmptyState title="This gap has passed.">
        <p>Select an upcoming gap in Plan.</p>
      </EmptyState>
    )
  return (
    <div className="gap-workspace">
      {withMap && shown.length > 0 && (
        <NowMapStrip
          gap={gap}
          evaluations={shown}
          selectedId={activeId}
          upcoming={gap.day > 0 || state.now < gap.start}
          onSelect={actions.onSelect}
          onMap={actions.onMap}
        />
      )}
      <div className="section-heading">
        <h2>{heading}</h2>
        <span className="muted small">
          {fits.length} {fits.length === 1 ? "activity fits" : "activities fit"}
        </span>
      </div>
      <div className="filter-row" aria-label="Recommendation filters">
        <ListFilter size={15} />
        {FILTERS.map(([key, label]) => (
          <Button
            key={key}
            size="small"
            aria-pressed={filters.includes(key)}
            className={`filter-chip ${
              filters.includes(key) ? "is-active" : ""
            }`}
            onClick={() =>
              setFilters((prev) =>
                prev.includes(key)
                  ? prev.filter((x) => x !== key)
                  : [...prev, key],
              )
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="recommendation-list">
        {shown.map((e, index) => (
          <RecommendationCard
            key={e.a.id}
            e={e}
            selected={activeId === e.a.id}
            number={withMap ? index + 1 : undefined}
            onSelect={() =>
              actions.onSelect(
                e.a.id,
                e.a.id === selectedId ? selectedLocation : undefined,
              )
            }
            onDetails={() =>
              actions.onDetails(
                e.a.id,
                gap,
                e.a.id === selectedId ? selectedLocation : undefined,
              )
            }
            onAdd={() =>
              actions.onAssign(
                gap,
                [e.a.id],
                e.a.id === selectedId ? selectedLocation : undefined,
              )
            }
            onMap={() =>
              actions.onMap(
                gap,
                e.a.id,
                e.a.id === selectedId ? selectedLocation : undefined,
              )
            }
            onDismiss={() => actions.onDismiss(gap, e.a.id)}
          />
        ))}
        {!filtered.length && (
          <EmptyState
            title={
              filters.length
                ? "No activities match these filters."
                : `Head to ${gap.next.location}.`
            }
          >
            <p>
              {filters.length
                ? "Try fewer filters, or leave this time open."
                : `Nothing on your list fits in ${gap.usable} usable ${
                    gap.usable === 1 ? "minute" : "minutes"
                  }. You don’t have to fill every gap.`}
            </p>
            {filters.length > 0 && (
              <Button variant="secondary" onClick={() => setFilters([])}>
                Clear filters
              </Button>
            )}
          </EmptyState>
        )}
        {filtered.length > 3 && (
          <Button
            className="show-more"
            variant="secondary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show fewer" : `Show all ${filtered.length} activities`}
          </Button>
        )}
      </div>
      <section className="open-gap-choice">
        <div>
          <Leaf size={20} />
          <div>
            <h3>Leave room for yourself</h3>
            <p>No activity needed.</p>
          </div>
        </div>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() => actions.onChoice(gap, "open")}
          >
            {remaining ? "Keep remaining time open" : "Keep this gap open"}
          </Button>
          <Button size="small" onClick={() => actions.onChoice(gap, "skip")}>
            {remaining ? "Decide about this time later" : "Skip for now"}
          </Button>
          {rest && evaluate(rest, gap, state.prefs).fit !== "none" && (
            <Button
              size="small"
              onClick={() => actions.onAssign(gap, [rest.id])}
            >
              {rest.title}
            </Button>
          )}
        </div>
      </section>
      {suggestions.length > 0 && (
        <details className="disclosure">
          <summary>Combine two short activities</summary>
          <div className="disclosure-content">
            {suggestions.map((c) => (
              <div className="combo-card" key={c.a.a.id + c.b.a.id}>
                <div>
                  <h3>
                    {c.a.a.title} + {c.b.a.title}
                  </h3>
                  <p>
                    {c.a.a.duration + c.b.a.duration} min activities ·{" "}
                    {c.sequence.walking} min walking · +{c.sequence.extraTravel}{" "}
                    min detour
                  </p>
                  <p>
                    {c.remaining} min remaining, including setup and buffer.
                  </p>
                </div>
                <FitBadge fit={c.sequence.fit} />
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => actions.onAssign(gap, [c.a.a.id, c.b.a.id])}
                >
                  Add both to gap
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
      {no.length > 0 && (
        <details
          className="disclosure"
          open={no.some((e) => e.a.id === selectedId)}
        >
          <summary>
            Doesn’t fit this gap <span>({no.length})</span>
          </summary>
          <div className="disclosure-content">
            {no.map((e) => (
              <div className="incompatible-card" key={e.a.id}>
                <div className="section-heading">
                  <h3>{e.a.title}</h3>
                  <FitBadge fit="none" />
                </div>
                <p>{e.reason}</p>
                <div className="button-row">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      actions.onDetails(
                        e.a.id,
                        gap,
                        e.a.id === selectedId ? selectedLocation : undefined,
                      )
                    }
                  >
                    View details
                  </Button>
                  <Button
                    size="small"
                    onClick={() => actions.onFindTime(e.a, gap.key)}
                  >
                    Find another time
                    <ArrowRight size={13} />
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      actions.onMap(
                        gap,
                        e.a.id,
                        e.a.id === selectedId ? selectedLocation : undefined,
                      )
                    }
                  >
                    <MapPin size={13} />
                    View on map
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {!!state.dismissed[gap.key]?.length && (
        <Button size="small" onClick={() => actions.onRestore(gap)}>
          <RotateCcw size={13} />
          Restore dismissed activities ({state.dismissed[gap.key].length})
        </Button>
      )}
    </div>
  )
}
