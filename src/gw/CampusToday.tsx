import { useState, type ReactNode } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Footprints,
  Leaf,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import {
  type Activity,
  type Commitment,
  type Eval,
  type Gap,
  type Prefs,
  fmt,
  gapAtTime,
  rank,
} from "./logic"
import CampusMap, {
  activityIcon,
  matchesFilter,
  type MapFilter,
} from "./CampusMap"
import { Button, Heading, RangeInput } from "./ui"

export type GapAssignment = {
  kind: "act"
  id: string
  title: string
} | { kind: "open" } | { kind: "skip" }

type Props = {
  commitments: Commitment[]
  gaps: Gap[]
  activities: Activity[]
  prefs: Prefs
  now: number
  assignments: Record<string, GapAssignment>
  banner?: ReactNode
  onTimeChange: (time: number) => void
  onCommitment: (c: Commitment) => void
  onAddCommitment: () => void
  onDetail: (g: Gap) => void
  onWhy: (g: Gap, e: Eval) => void
  onAssign: (g: Gap, a: GapAssignment | null) => void
  onDone: (id: string) => void
}

export default function CampusToday({
  commitments,
  gaps,
  activities,
  prefs,
  now,
  assignments,
  banner,
  onTimeChange,
  onCommitment,
  onAddCommitment,
  onDetail,
  onWhy,
  onAssign,
  onDone,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activitySelection, setActivitySelection] = useState<{
    gap: string
    activity: string
  } | null>(null)
  const [filter, setFilter] = useState<MapFilter>("all")
  const [agendaOpen, setAgendaOpen] = useState(false)
  const current = gaps.find((g) => now >= g.start && now < g.end)
  const defaultGap =
    current ??
    gaps.find((g) => g.start >= now && g.usable >= 15) ??
    gaps.find((g) => g.start >= now) ??
    gaps[gaps.length - 1]
  const base = gaps.find((g) => g.key === selectedKey) ?? defaultGap
  const isNow = !!base && now >= base.start && now < base.end
  const active = base ? gapAtTime(base, now) : undefined
  const fits = active ? rank(activities, active, prefs).fits : []
  const visibleFits = fits.filter((e) => matchesFilter(e, filter))
  const selected =
    visibleFits.find(
      (e) =>
        activitySelection?.gap === active?.key &&
        e.a.id === activitySelection?.activity,
    ) ?? visibleFits[0]
  const assignment = active ? assignments[active.key] : undefined
  const assignedAct =
    assignment?.kind === "act"
      ? activities.find((a) => a.id === assignment.id)
      : undefined
  const assignedEval =
    assignedAct && active
      ? rank([assignedAct], active, prefs).fits[0]
      : undefined
  const routeEval = assignment
    ? assignment.kind === "act"
      ? assignedEval
      : undefined
    : selected
  const isPast = !!active && now >= active.end
  const setGap = (g: Gap) => {
    setSelectedKey(g.key)
    setAgendaOpen(false)
  }
  const totalUsable = gaps.reduce((sum, g) => sum + Math.max(0, g.usable), 0)
  const items = commitments
    .filter((c) => c.day === 0)
    .sort((a, b) => a.start - b.start)
  const SelectedIcon = selected ? activityIcon(selected.a.id) : Leaf

  return (
    <div className={`campus-today ${agendaOpen ? "agenda-is-open" : ""}`}>
      {agendaOpen && (
        <Button
          className="agenda-scrim"
          aria-label="Close your day"
          onClick={() => setAgendaOpen(false)}
        />
      )}
      <aside className="today-sidebar" aria-label="Today's campus schedule">
        <div className="sidebar-intro">
          <span className="eyebrow">A LITTLE SPACE. A LOT OF POSSIBILITY.</span>
          <Heading as="h1">
            Your day,
            <br />
            <em>with room for you.</em>
          </Heading>
          <p>
            Good {now < 720 ? "morning" : now < 1020 ? "afternoon" : "evening"}.
            Let’s make the in-between count.
          </p>
        </div>
        <div className="today-overview">
          <span className="overview-symbol">
            <Sparkles size={18} strokeWidth={1.6} />
          </span>
          <div>
            <strong>
              {totalUsable}
              <span>min</span>
            </strong>
            <span>usable time today</span>
          </div>
          <span className="overview-divider" />
          <div className="overview-gaps">
            <strong>{gaps.length}</strong>
            <span>little opportunities</span>
          </div>
        </div>
        <div className="agenda-heading">
          <div>
            <span className="eyebrow">YOUR CAMPUS DAY</span>
            <span className="agenda-day">
              <CalendarDays size={13} />
              Today · Demo schedule
            </span>
          </div>
          <Button
            size="icon"
            className="agenda-add"
            aria-label="Add commitment"
            onClick={onAddCommitment}
          >
            <Plus size={19} />
          </Button>
          <Button
            size="icon"
            className="agenda-close"
            aria-label="Close schedule"
            onClick={() => setAgendaOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="campus-agenda">
          {items.map((c, i) => {
            const g = gaps.find((gap) => gap.prev.id === c.id)
            const chosen = g?.key === active?.key
            const a = g ? assignments[g.key] : undefined
            return (
              <div key={c.id} className="agenda-item">
                <Button
                  className={`agenda-commitment ${
                    c.canceled ? "is-canceled" : ""
                  }`}
                  onClick={() => onCommitment(c)}
                >
                  <span className="agenda-number">{i + 1}</span>
                  <span className="agenda-event-content">
                    <span className="agenda-event-time">
                      {fmt(c.start)} – {fmt(c.end)}
                      {c.canceled && " · Canceled"}
                    </span>
                    <strong>{c.title}</strong>
                    <span className="agenda-event-place">
                      <MapPin size={11} />
                      {c.location}
                    </span>
                  </span>
                  <ChevronRight size={14} className="agenda-event-arrow" />
                </Button>
                {g && (
                  <Button
                    className={`agenda-gap ${chosen ? "is-selected" : ""} ${
                      g.usable < 10 ? "is-short" : ""
                    }`}
                    onClick={() => setGap(g)}
                    aria-pressed={chosen}
                  >
                    <span className="agenda-gap-icon">
                      {a?.kind === "open" ? (
                        <Leaf size={14} />
                      ) : a?.kind === "act" ? (
                        <Check size={14} />
                      ) : (
                        <Clock3 size={14} />
                      )}
                    </span>
                    <span>
                      <strong>
                        {Math.max(
                          0,
                          chosen ? (active?.usable ?? g.usable) : g.usable,
                        )}{" "}
                        min usable
                      </strong>
                      <span>
                        {a?.kind === "act"
                          ? a.title
                          : a?.kind === "open"
                            ? "A little breathing room"
                            : a?.kind === "skip"
                              ? "Decide later"
                              : `${g.total} min gap · ${g.travel} min walk`}
                      </span>
                    </span>
                    <ArrowUpRight size={15} />
                  </Button>
                )}
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="agenda-empty">
              <Leaf size={24} />
              <Heading as="h3">A wide-open day.</Heading>
              <p>Add a commitment to see the spaces in between.</p>
              <Button
                variant="secondary"
                size="small"
                onClick={onAddCommitment}
              >
                <Plus size={14} />
                Add commitment
              </Button>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-rest-note">
            <Leaf size={14} />
            <span>You don’t have to fill every gap.</span>
          </div>
          <div className="demo-clock">
            <div>
              <span>
                <Clock3 size={13} />
                Simulated time
              </span>
              <strong>{fmt(now)}</strong>
              <span className="demo-clock-badge">DEMO</span>
            </div>
            <RangeInput
              aria-label="Simulated current time"
              min={480}
              max={1080}
              step={5}
              value={now}
              onChange={(event) => {
                setSelectedKey(null)
                onTimeChange(Number(event.target.value))
              }}
            />
            <div className="demo-clock-limits">
              <span>8 AM</span>
              <span>6 PM</span>
            </div>
          </div>
        </div>
      </aside>

      <main className={`today-map-main ${active ? "has-gap" : ""}`}>
        <CampusMap
          commitments={items}
          gaps={gaps}
          activeGap={active}
          fits={fits}
          selected={routeEval}
          filter={filter}
          setFilter={setFilter}
          onGap={setGap}
          onCommitment={onCommitment}
          onActivity={(e) =>
            setActivitySelection({ gap: active!.key, activity: e.a.id })
          }
          onAgenda={() => setAgendaOpen(!agendaOpen)}
        />
        {banner && <div className="map-change-banner">{banner}</div>}
        {active ? (
          <section
            className="map-gap-inspector anim-fade"
            aria-label="Selected gap details"
            key={active.key}
          >
            <div className="inspector-eyebrow">
              <span>
                <span className="live-indicator" />
                {isNow
                  ? "A LITTLE ROOM, RIGHT NOW"
                  : isPast
                    ? "EARLIER TODAY"
                    : "YOUR NEXT LITTLE OPPORTUNITY"}
              </span>
              <Button
                size="icon"
                aria-label="Explore selected gap"
                onClick={() => onDetail(active)}
              >
                <ArrowUpRight size={19} />
              </Button>
            </div>
            <div className="inspector-time">
              <strong>{Math.max(0, active.usable)}</strong>
              <div>
                <Heading as="h2">minutes, just for you.</Heading>
                <span>
                  {fmt(active.start)} – {fmt(active.end)}
                </span>
              </div>
            </div>
            <div className="gap-equation">
              <span>{active.total} min gap</span>
              <span>−</span>
              <span>
                <Footprints size={12} />
                {active.travel} walk
              </span>
              <span>−</span>
              <span>
                <ShieldCheck size={12} />
                {active.buffer} buffer
              </span>
            </div>
            <div className="inspector-divider" />
            {assignment ? (
              <div className="inspector-assigned">
                <span
                  className={`inspector-activity-icon ${
                    assignment.kind === "open" ? "is-rest" : ""
                  }`}
                >
                  {assignment.kind === "act" ? (
                    <Check size={20} />
                  ) : (
                    <Leaf size={20} />
                  )}
                </span>
                <div>
                  <Heading as="h3">
                    {assignment.kind === "act"
                      ? `${assignment.title}${
                          assignedAct?.done ? " · Done" : ""
                        }`
                      : assignment.kind === "open"
                        ? "A little breathing room."
                        : "Decide in the moment."}
                  </Heading>
                  <p>
                    {assignment.kind === "act"
                      ? "Your plan, at your pace."
                      : "Rest, catch up with a friend, or just be."}
                  </p>
                </div>
                <div className="assignment-actions">
                  {assignment.kind === "act" && !assignedAct?.done && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => onDone(assignment.id)}
                    >
                      Done
                    </Button>
                  )}
                  <Button size="small" onClick={() => onAssign(active, null)}>
                    Change
                  </Button>
                </div>
              </div>
            ) : isPast ? (
              <div className="inspector-empty">
                <Clock3 size={21} />
                <div>
                  <Heading as="h3">This moment has passed.</Heading>
                  <p>Select a later gap to see what’s possible.</p>
                </div>
              </div>
            ) : selected ? (
              <>
                <div className="inspector-suggestion-heading">
                  <span>
                    {selected.a.priority === "must"
                      ? "A PRIORITY THAT FITS"
                      : "SOMETHING THAT FITS"}
                  </span>
                  <span
                    className={`inspector-fit ${
                      selected.fit === "tight" ? "is-tight" : ""
                    }`}
                  >
                    {selected.fit === "tight" ? "Tight fit" : "Comfortable fit"}
                  </span>
                </div>
                <div className="inspector-recommendation">
                  <span className="inspector-activity-icon">
                    <SelectedIcon size={20} strokeWidth={1.8} />
                  </span>
                  <div>
                    <Heading as="h3">{selected.a.title}</Heading>
                    <p>
                      {selected.a.duration} min ·{" "}
                      {selected.a.locations.length
                        ? selected.loc
                        : "Right where you are"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    aria-label={`Why ${selected.a.title} fits`}
                    onClick={() => onWhy(active, selected)}
                  >
                    <ChevronRight size={18} />
                  </Button>
                </div>
                <p className="inspector-description">
                  {selected.a.deadline != null
                    ? `Due ${fmt(selected.a.deadline)}. `
                    : ""}
                  {selected.extraTravel > 0
                    ? `Adds ${selected.extraTravel} min walking; `
                    : "No extra detour; "}
                  leaves {selected.remaining} min after the full route and
                  buffer.
                </p>
                <div className="inspector-actions">
                  <Button
                    variant="primary"
                    onClick={() =>
                      onAssign(active, {
                        kind: "act",
                        id: selected.a.id,
                        title: selected.a.title,
                      })
                    }
                  >
                    Add to gap
                    <Plus size={15} />
                  </Button>
                  <Button variant="secondary" onClick={() => onDetail(active)}>
                    All options
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            ) : (
              <div className="inspector-empty">
                <Leaf size={23} />
                <div>
                  <Heading as="h3">
                    {filter === "all"
                      ? "A good moment to take it easy."
                      : "Nothing in this category fits."}
                  </Heading>
                  <p>
                    {filter === "all"
                      ? `Head to ${active.next.location}. No need to squeeze something in.`
                      : "Try Everything, or leave this time for yourself."}
                  </p>
                  {filter !== "all" && (
                    <Button size="small" onClick={() => setFilter("all")}>
                      Show everything
                      <ArrowRight size={13} />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!assignment && !isPast && (
              <Button
                className="keep-gap-open"
                onClick={() => onAssign(active, { kind: "open" })}
              >
                <Leaf size={14} />
                Or, keep this gap open. That counts too.
              </Button>
            )}
            <div className="inspector-next">
              <span className="next-commitment-dot" />
              <span>
                Next: <strong>{active.next.title}</strong> ·{" "}
                {fmt(active.next.start)}
              </span>
            </div>
          </section>
        ) : (
          <section className="map-gap-inspector map-no-gaps">
            <span className="inspector-activity-icon is-rest">
              <Leaf size={24} />
            </span>
            <Heading as="h2">Room to write your own day.</Heading>
            <p>
              {items.length < 2
                ? "Add two commitments and your usable gaps will appear right on the map."
                : "No gaps between these commitments. Your schedule is all here on the map."}
            </p>
            <Button variant="primary" onClick={onAddCommitment}>
              <Plus size={16} />
              Add commitment
            </Button>
          </section>
        )}
      </main>
    </div>
  )
}
