import { useRef, useState } from "react"
import { ArrowRight, Footprints, MapPin } from "lucide-react"
import {
  type Eval,
  type Gap,
  atLocation,
  categoryOf,
  deadlineLabel,
  evaluate,
  gapsFor,
  rank,
} from "./logic"
import { type State, assignedSequence, availableActivities } from "./state"
import CampusMap, { type MapFilter } from "./CampusMap"
import { FitBadge, PriorityTag } from "./components"
import { type GapActions } from "./GapWorkspace"
import { Button } from "./ui"

export type Selection = {
  id: string
  location?: string
}
export function selectedEvaluation(
  state: State,
  g: Gap | undefined,
  selection: Selection,
): Eval | undefined {
  const a = state.acts.find((a) => a.id === selection.id && !a.done)
  if (!a || !g) return undefined
  return evaluate(atLocation(a, selection.location), g, state.prefs)
}
export default function MapPanel({
  state,
  gap,
  selection,
  actions,
  onGap,
  onCommitment,
  onPlan,
  full = false,
}: {
  state: State
  gap?: Gap
  selection: Selection
  actions: GapActions
  onGap: (g: Gap) => void
  onCommitment: (id: string) => void
  onPlan: () => void
  full?: boolean
}) {
  const [filter, setFilter] = useState<MapFilter>("all")
  const [place, setPlace] = useState<string>()
  const panel = useRef<HTMLElement>(null)
  const reveal = (selector: string) =>
    requestAnimationFrame(() =>
      panel.current
        ?.querySelector(selector)
        ?.scrollIntoView({ block: "nearest" }),
    )
  const backToMap = () =>
    panel.current
      ?.querySelector(".map-canvas")
      ?.scrollIntoView({ block: "start" })
  const browsing = !gap
    ? state.acts.find((a) => a.id === selection.id && !a.done)
    : undefined
  const assignment = gap && state.assign[gap.key]
  const sequence =
    gap && assignment?.kind === "act"
      ? assignedSequence(state, gap, assignment)
      : undefined
  const selected =
    sequence?.evaluations.find((e) => e.a.id === selection.id && !e.a.done) ??
    selectedEvaluation(state, gap, selection)
  const activities = gap
    ? availableActivities(state, gap.key, true)
    : state.acts.filter((a) => !a.done)
  const evaluations = gap
    ? activities.map((a) => evaluate(a, gap, state.prefs))
    : []
  if (selected && !evaluations.some((e) => e.a.id === selected.a.id))
    evaluations.push(selected)
  else if (selected)
    evaluations.splice(
      evaluations.findIndex((e) => e.a.id === selected.a.id),
      1,
      selected,
    )
  const routeEvaluations = sequence?.evaluations ?? (selected ? [selected] : [])
  const activePlace = selection.location ?? place ?? browsing?.locations[0]
  const placeActivities = activities.filter(
    (a) => filter === "all" || categoryOf(a) === filter,
  )
  const atPlace = activities.filter(
    (a) =>
      (filter === "all" || categoryOf(a) === filter) &&
      (a.locations.includes(activePlace ?? "") ||
        a.flexibleLocation ||
        !a.locations.length),
  )
  const selectPlace = (location: string) => {
    setPlace(location)
    const a =
      placeActivities.find((a) => a.locations.includes(location)) ??
      placeActivities.find((a) => a.flexibleLocation || !a.locations.length)
    actions.onSelect(a?.id ?? "", location)
    reveal(".map-location-results")
  }
  const walking =
    sequence?.walking ??
    (selected ? selected.t1 + selected.t2 : (gap?.travel ?? 0))
  const extra = sequence?.extraTravel ?? selected?.extraTravel ?? 0
  const canAdd =
    selected &&
    selected.fit !== "none" &&
    !assignment &&
    activities.some((a) => a.id === selected.a.id) &&
    !!gap &&
    (gap.day > 0 || gap.end > state.now)
  return (
    <section
      ref={panel}
      className={`map-panel ${full ? "map-panel-full" : ""}`}
      aria-label="Campus map and route"
    >
      {!full && (
        <header className="map-panel-heading">
          <h2>On campus</h2>
          <Button
            size="small"
            onClick={() =>
              actions.onMap(gap, selected?.a.id, selection.location)
            }
          >
            Open full map
            <ArrowRight size={14} />
          </Button>
        </header>
      )}
      <div className="map-canvas">
        <CampusMap
          commitments={state.cs
            .filter((c) => c.day === (gap?.day ?? 0))
            .sort((a, b) => a.start - b.start)}
          gaps={gapsFor(state.cs, gap?.day ?? 0, state.prefs)}
          activeGap={gap}
          fits={evaluations}
          selected={selected}
          routeEvaluations={routeEvaluations}
          filter={filter}
          setFilter={(next) => {
            setFilter(next)
            if (next !== "all" && selected && categoryOf(selected.a) !== next)
              actions.onSelect("", activePlace)
          }}
          onGap={onGap}
          onCommitment={(c) => onCommitment(c.id)}
          onActivity={(e) => {
            setPlace(e.loc)
            actions.onSelect(e.a.id, e.loc)
            reveal(".map-selected-activity")
          }}
          onAgenda={onPlan}
          onLocation={selectPlace}
          selectedLocation={activePlace}
          instanceId={full ? "full-map" : "now-map"}
        />
      </div>
      {gap && (
        <div className="map-route-strip" aria-live="polite">
          <span>
            <Footprints size={15} />
            <b>{walking} min</b> total walk
          </span>
          <span>{gap.travel} min direct</span>
          <span>
            <b>+{extra} min</b> detour
          </span>
        </div>
      )}
      {activePlace && (
        <div className="map-location-results">
          <h3>
            <MapPin size={15} />
            {activePlace}
          </h3>
          {atPlace.length ? (
            <div className="place-activity-options">
              {atPlace.map((a) => (
                <Button
                  key={a.id}
                  size="small"
                  className={selection.id === a.id ? "is-active" : ""}
                  aria-pressed={selection.id === a.id}
                  onClick={() => {
                    actions.onSelect(a.id, activePlace)
                    reveal(".map-selected-activity")
                  }}
                >
                  {a.title} · {a.duration} min
                </Button>
              ))}
            </div>
          ) : (
            <p className="muted small">
              No unfinished activities at this location.
            </p>
          )}
        </div>
      )}
      {selected && gap && (
        <div className="map-selected-activity" aria-live="polite">
          <div className="section-heading">
            <h3>{selected.a.title}</h3>
            <FitBadge fit={selected.fit} />
          </div>
          <p>
            {selected.a.duration} min · {selected.loc}{" "}
            <PriorityTag p={selected.a.priority} />
          </p>
          {selected.a.deadline != null && (
            <p className="small muted">
              Due {deadlineLabel(selected.a).toLowerCase()}
            </p>
          )}
          <p
            className={
              selected.fit === "none" ? "warning-text small" : "muted small"
            }
          >
            {selected.reason}
          </p>
          <p className="small route-segments">
            {selected.t1} min to activity <span>→</span> {selected.t2} min to{" "}
            {gap.next.location}
          </p>
          <div className="button-row">
            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                actions.onDetails(selected.a.id, gap, selection.location)
              }
            >
              View details
            </Button>
            {!assignment && (
              <Button
                variant="primary"
                size="small"
                disabled={!canAdd}
                onClick={() =>
                  actions.onAssign(gap, [selected.a.id], selection.location)
                }
              >
                Add to gap
              </Button>
            )}
            {selected.fit === "none" && (
              <Button
                size="small"
                onClick={() => actions.onFindTime(selected.a, gap.key)}
              >
                Find another time
                <ArrowRight size={13} />
              </Button>
            )}
            {full && (
              <Button
                className="map-back-canvas"
                size="small"
                onClick={backToMap}
              >
                Back to map
              </Button>
            )}
          </div>
        </div>
      )}
      {browsing && (
        <div className="map-selected-activity">
          <div className="section-heading">
            <h3>{browsing.title}</h3>
            <PriorityTag p={browsing.priority} />
          </div>
          <p>
            {browsing.duration} min · {activePlace ?? "Flexible location"}
          </p>
          <p className="muted small">{deadlineLabel(browsing)}</p>
          <p className="muted small">
            Choose an available gap to check walking time and fit.
          </p>
          <div className="button-row">
            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                actions.onDetails(browsing.id, undefined, activePlace)
              }
            >
              View details
            </Button>
            <Button size="small" onClick={() => actions.onFindTime(browsing)}>
              Find a gap
              <ArrowRight size={13} />
            </Button>
            {full && (
              <Button
                className="map-back-canvas"
                size="small"
                onClick={backToMap}
              >
                Back to map
              </Button>
            )}
          </div>
        </div>
      )}
      {!selected && !browsing && !activePlace && (
        <p className="map-select-hint">
          Select a building or activity marker to see what’s available.
        </p>
      )}
      {filter !== "all" &&
        gap &&
        !rank(activities, gap, state.prefs).fits.some(
          (e) => categoryOf(e.a) === filter,
        ) && (
          <p className="map-filter-note small muted">
            No activities in this category fit this gap. Select a marker to
            check another time.
          </p>
        )}
    </section>
  )
}
