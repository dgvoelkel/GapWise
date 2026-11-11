import { useRef, useState } from "react"
import { ArrowRight, Flag, Footprints, LocateFixed, MapPin } from "lucide-react"
import {
  type Eval,
  type Gap,
  LOC_NAMES,
  atLocation,
  categoryOf,
  deadlineLabel,
  evaluate,
  rank,
} from "./logic"
import { type State, assignedSequence, availableActivities } from "./state"
import CampusMapGL, { type MapPin as MapPinSpec, routeLegs } from "./map/CampusMapGL"
import { MAP_FILTERS, type MapFilter, activityIcon, matchesFilter } from "./map/filters"
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
  // Numbered options: everything that fits, ranked, filtered by category.
  const ranked = gap ? rank(activities, gap, state.prefs) : { fits: [], no: [] }
  const options = ranked.fits
    .map((e) =>
      selected && e.a.id === selected.a.id ? selected : e,
    )
    .filter((e) => matchesFilter(e, filter))
  const routeEvaluations = sequence?.evaluations ?? (selected ? [selected] : [])
  const stops = routeEvaluations
    .map((e) => e.loc)
    .filter((loc, i, all) => i === 0 || loc !== all[i - 1])
  const legs = gap
    ? routeLegs(
        gap.prev.location,
        stops.filter((loc) => loc !== gap.prev.location || stops.length > 1),
        gap.next.location,
      )
    : []
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
  const pinnedPlaces = new Set([
    gap?.prev.location,
    gap?.next.location,
    ...options.map((e) => e.loc),
  ])
  const pins: MapPinSpec[] = [
    ...(gap
      ? [
          {
            id: "start",
            place: gap.prev.location,
            kind: "start" as const,
            label: `Start: ${gap.prev.title}, ${gap.prev.location}`,
          },
          {
            id: "next",
            place: gap.next.location,
            kind: "next" as const,
            label: `Next: ${gap.next.title}, ${gap.next.location}`,
          },
        ]
      : []),
    ...options.map((e, index) => {
      const Icon = activityIcon(e.a)
      return {
        id: `option:${e.a.id}`,
        place: e.loc,
        kind: "option" as const,
        number: index + 1,
        selected: selected?.a.id === e.a.id,
        icon: <Icon size={16} strokeWidth={1.9} aria-hidden="true" />,
        label: `Option ${index + 1}: ${e.a.title} at ${e.loc}, ${e.t1 + e.t2} min walking`,
      }
    }),
    ...LOC_NAMES.filter((name) => !pinnedPlaces.has(name)).map((name) => ({
      id: `place:${name}`,
      place: name,
      kind: "place" as const,
      selected: activePlace === name,
      label: `Explore ${name}`,
    })),
  ]
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
  const chooseOption = (e: Eval) => {
    setPlace(e.loc)
    actions.onSelect(e.a.id, e.loc)
  }
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
      <div className="map-filters" aria-label="Filter activity spots">
        {MAP_FILTERS.map(([key, label, Icon]) => (
          <Button
            key={key}
            size="small"
            className={`map-filter ${filter === key ? "is-active" : ""}`}
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key)
              if (key !== "all" && selected && categoryOf(selected.a) !== key)
                actions.onSelect("", activePlace)
            }}
          >
            <Icon size={14} />
            {label}
          </Button>
        ))}
      </div>
      <div className="map-canvas">
        <CampusMapGL
          interactive
          fit={gap ? "content" : "campus"}
          legs={legs}
          pins={pins}
          padding={full ? 72 : 56}
          onPin={(pin) => {
            if (pin.kind === "option") {
              const e = options.find((o) => `option:${o.a.id}` === pin.id)
              if (e) {
                chooseOption(e)
                reveal(".map-selected-activity")
              }
            } else if (pin.kind === "place") selectPlace(pin.place)
          }}
        />
        <div className="map-legend" aria-hidden="true">
          <span>
            <i className="gw-pin gw-pin--start gw-pin--legend">
              <LocateFixed size={10} />
            </i>
            Start
          </span>
          <span>
            <i className="gw-pin gw-pin--next gw-pin--legend">
              <Flag size={10} />
            </i>
            Next
          </span>
          <span>
            <i className="gw-pin gw-pin--option gw-pin--legend">1</i>
            Option
          </span>
          <span>
            <i className="map-legend-line" />
            Walk
          </span>
          <span>
            <i className="map-legend-line is-detour" />
            Detour
          </span>
        </div>
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
      {gap && (
        <div className="map-option-list" aria-label="Options on the map">
          <div className="section-heading">
            <h3>Options that fit</h3>
            <span className="muted small">
              {options.length} {options.length === 1 ? "activity" : "activities"}
            </span>
          </div>
          {options.length ? (
            <ol>
              {options.map((e, index) => (
                <li key={e.a.id}>
                  <Button
                    className={`map-option ${
                      selected?.a.id === e.a.id ? "is-selected" : ""
                    }`}
                    aria-pressed={selected?.a.id === e.a.id}
                    onClick={() => chooseOption(e)}
                  >
                    <span className="gw-pin gw-pin--option gw-pin--inline">
                      {index + 1}
                    </span>
                    <span className="map-option-text">
                      <b>{e.a.title}</b>
                      <small>
                        {e.loc} · {e.t1 + e.t2} min walk ·{" "}
                        {e.extraTravel <= 1
                          ? "on your way"
                          : `+${e.extraTravel} min detour`}
                      </small>
                    </span>
                    <FitBadge fit={e.fit} />
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">
              {filter === "all"
                ? "Nothing on your list fits this gap. You can head straight to your next commitment."
                : "No activities in this category fit this gap. Try another filter."}
            </p>
          )}
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
          Select a numbered option or a building pin to see what’s available
          there.
        </p>
      )}
      {!gap && (
        <p className="map-select-hint">
          <Button variant="secondary" size="small" onClick={onPlan}>
            Choose a gap in Plan
          </Button>
        </p>
      )}
    </section>
  )
}
