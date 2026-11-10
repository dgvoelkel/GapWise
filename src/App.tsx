import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  Compass,
  Leaf,
  ListTodo,
  Map as MapIcon,
  RotateCcw,
  Settings as SettingsIcon,
  X,
} from "lucide-react"
import {
  type Activity,
  type Commitment,
  type Gap,
  type Prefs,
  DATE_LABELS,
  DAYS,
  allGaps,
  atLocation,
  commitmentError,
  evaluateSequence,
  fmt,
  futureGap,
  gapAtTime,
  rank,
} from "./gw/logic"
import {
  type State,
  assignmentIds,
  assignmentIssues,
  availableActivities,
  freshState,
  loadState,
  reconcileSchedule,
} from "./gw/state"
import CampusToday from "./gw/CampusToday"
import PlanAhead from "./gw/PlanAhead"
import MapExplorer from "./gw/MapExplorer"
import Activities from "./gw/Activities"
import Settings from "./gw/Settings"
import ActivityDetails from "./gw/ActivityDetails"
import {
  ActivityForm,
  CommitmentForm,
  SetupForm,
  Field,
  commitmentInstances,
  toMin,
  toStr,
} from "./gw/Forms"
import { Confirmation, EmptyState, FitBadge, Sheet } from "./gw/components"
import { type GapActions } from "./gw/GapWorkspace"
import { type Selection } from "./gw/MapPanel"
import { Button, RangeInput } from "./gw/ui"

type Tab = "today" | "plan" | "map" | "acts" | "settings"
type Detail = {
  kind: "details"
  id: string
  gapKey?: string
  location?: string
}
type Modal = Detail | {
  kind: "activity"
  activity?: Activity
  returnTo?: Detail
} | {
  kind: "commitment"
  commitment?: Commitment
  day: number
} | {
  kind: "find"
  ids: string[]
  exclude?: string
  locations?: Record<string, string>
} | {
  kind: "delete"
  id: string
  returnTo?: Detail
} | {
  kind: "setup" | "clock" | "reset"
}
type MapReturn = {
  tab: Tab
  detail: boolean
}
type HistoryEntry = {
  before: State
  label: string
}
const NAV = [
  ["today", "Right Now", Compass],
  ["plan", "Plan", CalendarDays],
  ["map", "Map", MapIcon],
  ["acts", "Activities", ListTodo],
  ["settings", "Settings", SettingsIcon],
] as const

export default function App() {
  const [state, setState] = useState<State>(loadState)
  const [tab, setTab] = useState<Tab>("today")
  const [planDay, setPlanDay] = useState(0)
  const [planKey, setPlanKey] = useState<string>()
  const [mapKey, setMapKey] = useState<string>()
  const [selection, setSelection] = useState<Selection>(() => {
    const current = allGaps(state.cs, state.prefs).find(
      (g) => g.day === 0 && g.start <= state.now && g.end > state.now,
    )
    const choice = current && state.assign[current.key]
    return { id: choice ? (assignmentIds(choice)[0] ?? "") : "print" }
  })
  const [mapReturn, setMapReturn] = useState<MapReturn>()
  const [modal, setModal] = useState<Modal | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [notice, setNotice] = useState("")
  const [storageWarning, setStorageWarning] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.title = "GapWise — Make the space between count."
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem("gw", JSON.stringify(state))
      setStorageWarning(false)
    } catch {
      setStorageWarning(true)
    }
  }, [state])
  useEffect(() => {
    const heading = page.current?.querySelector("h1")
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    page.current?.scrollTo(0, 0)
  }, [tab])
  const gaps = useMemo(
    () => allGaps(state.cs, state.prefs),
    [state.cs, state.prefs],
  )
  const effective = (g: Gap) => (g.day === 0 ? gapAtTime(g, state.now) : g)
  const today = gaps.filter((g) => g.day === 0 && futureGap(g, state.now))
  const rightBase =
    today.find((g) => g.start <= state.now && g.end > state.now) ?? today[0]
  const rightGap = rightBase && effective(rightBase)
  const dayGaps = gaps.filter((g) => g.day === planDay)
  const planBase =
    dayGaps.find((g) => g.key === planKey) ??
    dayGaps.find((g) => futureGap(g, state.now)) ??
    dayGaps[0]
  const planGap = planBase && effective(planBase)
  const mapBase =
    gaps.find((g) => g.key === mapKey && futureGap(g, state.now)) ??
    rightBase ??
    gaps.find((g) => futureGap(g, state.now))
  const mapGap = mapBase && effective(mapBase)
  const contextGap =
    tab === "plan" ? planGap : tab === "map" ? mapGap : rightGap
  const issues = useMemo(() => assignmentIssues(state), [state])

  const change = (next: State, label: string) => {
    setHistory((h) => [...h.slice(-24), { before: state, label }])
    setState(next)
    setNotice(label)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setState(last.before)
    setHistory((h) => h.slice(0, -1))
    setNotice(`Undone. ${last.label}`)
  }
  const pickGap = (g: Gap) => {
    if (tab === "map") setMapKey(g.key)
    else {
      setPlanDay(g.day)
      setPlanKey(g.key)
    }
  }
  const exploreGap = (g: Gap, activity?: Activity) => {
    setPlanDay(g.day)
    setPlanKey(g.key)
    setMapKey(g.key)
    if (activity) setSelection({ id: activity.id })
    setModal(null)
    setTab("plan")
  }
  const openCommitment = (id: string) => {
    const commitment = state.cs.find((c) => c.id === id)
    if (commitment)
      setModal({ kind: "commitment", commitment, day: commitment.day })
  }
  const openFindTime = (a: Activity, exclude?: string) => {
    const booking = Object.entries(state.assign).find(([, value]) =>
      assignmentIds(value).includes(a.id),
    )
    const location = selection.id === a.id ? selection.location : undefined
    setSelection({ id: a.id, location })
    setModal({
      kind: "find",
      ids: booking ? assignmentIds(booking[1]) : [a.id],
      exclude: booking?.[0] ?? exclude,
      locations: location ? { [a.id]: location } : undefined,
    })
  }
  const assign = (requested: Gap, ids: string[], location?: string) => {
    const original = gaps.find((g) => g.key === requested.key)
    if (!original || !futureGap(original, state.now)) {
      setNotice("This gap is no longer available. Choose an upcoming gap.")
      return
    }
    const g = effective(original)
    const available = availableActivities(state, g.key, true)
    const activities = ids
      .map((id) => available.find((a) => a.id === id))
      .filter((a): a is Activity => !!a)
    if (
      state.assign[g.key] ||
      activities.length !== ids.length ||
      !ids.length ||
      new Set(ids).size !== ids.length
    ) {
      setNotice(
        "This activity or gap is already planned. Change the existing plan first.",
      )
      return
    }
    const chosen = activities.map((a) =>
      atLocation(a, ids.length === 1 ? location : undefined),
    )
    const seq = evaluateSequence(chosen, g, state.prefs)
    if (seq.fit === "none") {
      setNotice(seq.reason)
      setModal({ kind: "details", id: ids[0], gapKey: g.key, location })
      return
    }
    const title = activities.map((a) => a.title).join(" + ")
    change(
      {
        ...state,
        assign: {
          ...state.assign,
          [g.key]: {
            kind: "act",
            id: ids[0],
            ids,
            title,
            startAt: g.start,
            day: g.day,
            start: g.start,
            end: g.end,
            locations: location
              ? { [ids[0]]: seq.evaluations[0].loc }
              : undefined,
          },
        },
      },
      `${title} added to ${DAYS[g.day].toLowerCase()}’s ${fmt(g.start)} gap.`,
    )
    setSelection({ id: ids[0], location })
    setModal(null)
  }
  const clearAssignment = (key: string) => {
    const next = { ...state.assign }
    delete next[key]
    change(
      { ...state, assign: next },
      "Gap choice removed. You can decide again.",
    )
  }
  const choose = (g: Gap, kind: "open" | "skip") => {
    if (!gaps.some((x) => x.key === g.key) || !futureGap(g, state.now)) return
    change(
      { ...state, assign: { ...state.assign, [g.key]: { kind } } },
      kind === "open"
        ? "Gap kept open. This time is yours."
        : "Skipped for now.",
    )
    setSelection({ id: "" })
    setModal(null)
  }
  const complete = (ids: string[], done = true) => {
    change(
      {
        ...state,
        acts: state.acts.map((a) => (ids.includes(a.id) ? { ...a, done } : a)),
      },
      done
        ? ids.length > 1
          ? "Both activities marked completed."
          : "Activity marked completed."
        : "Activity marked unfinished.",
    )
  }
  const actions: GapActions = {
    onSelect: (id, location) => setSelection({ id, location }),
    onDetails: (id, g, location) => {
      setSelection({ id, location })
      setModal({ kind: "details", id, gapKey: g?.key, location })
    },
    onMap: (g, id, location) => {
      setMapKey(g?.key)
      if (id) setSelection({ id, location })
      setMapReturn({ tab, detail: modal?.kind === "details" })
      setModal(null)
      setTab("map")
    },
    onAssign: assign,
    onChoice: choose,
    onClear: clearAssignment,
    onDone: complete,
    onDismiss: (g, id) => {
      change(
        {
          ...state,
          dismissed: {
            ...state.dismissed,
            [g.key]: [...(state.dismissed[g.key] ?? []), id],
          },
        },
        "Activity dismissed for this gap.",
      )
      if (selection.id === id) {
        const next = rank(
          availableActivities(state, g.key).filter((a) => a.id !== id),
          g,
          state.prefs,
        ).fits[0]
        setSelection({ id: next?.a.id ?? "" })
      }
    },
    onRestore: (g) =>
      change(
        { ...state, dismissed: { ...state.dismissed, [g.key]: [] } },
        "Dismissed activities restored.",
      ),
    onFindTime: openFindTime,
  }
  const changeSchedule = (cs: Commitment[], commitment: Commitment) => {
    const next = reconcileSchedule(state, cs)
    const nextGaps = allGaps(next.cs, next.prefs)
    const affected = gaps.filter(
      (g) =>
        g.day === commitment.day &&
        (g.prev.id === commitment.id || g.next.id === commitment.id),
    )
    const before =
      affected.find(
        (g) =>
          futureGap(g, state.now) &&
          effective(g).usable !== nextGaps.find((a) => a.key === g.key)?.usable,
      ) ??
      affected.find((g) => g.prev.id === commitment.id) ??
      affected[0]
    const after = nextGaps.find((g) => g.key === before?.key)
    const beforeUsable = before && effective(before).usable
    const afterUsable = after && effective(after).usable
    change(
      next,
      `Your schedule changed. ${
        beforeUsable != null &&
        afterUsable != null &&
        beforeUsable !== afterUsable
          ? `Available time changed from ${beforeUsable} to ${afterUsable} minutes before ${after!.next.title}.`
          : `${commitment.title} updated. Available gaps have been recalculated.`
      }`,
    )
    setModal(null)
  }
  const saveCommitment = (c: Commitment) => {
    const exists = state.cs.some((x) => x.id === c.id)
    const instances = exists ? [c] : commitmentInstances(c)
    let cs = state.cs.filter((x) => x.id !== c.id)
    for (const item of instances) {
      const error = commitmentError(item, cs)
      if (error) return `${DAYS[item.day]}: ${error}`
      cs = [...cs, item]
    }
    changeSchedule(cs, c)
    return undefined
  }
  const toggleCancel = (c: Commitment) => {
    const next = { ...c, canceled: !c.canceled }
    const error = commitmentError(next, state.cs)
    if (error) return error
    changeSchedule(
      state.cs.map((x) => (x.id === c.id ? next : x)),
      c,
    )
    return undefined
  }
  const saveActivity = (a: Activity) => {
    const editing = state.acts.some((x) => x.id === a.id)
    change(
      {
        ...state,
        acts: editing
          ? state.acts.map((x) => (x.id === a.id ? a : x))
          : [...state.acts, a],
      },
      `${a.title} saved. Recommendations updated.`,
    )
    setSelection({ id: a.id })
    setModal(
      modal?.kind === "activity" && modal.returnTo
        ? { ...modal.returnTo, location: undefined }
        : null,
    )
  }
  const deleteActivity = (id: string) => {
    const acts = state.acts.filter((a) => a.id !== id),
      assignments = { ...state.assign }
    for (const [key, a] of Object.entries(assignments)) {
      if (a.kind !== "act" || !assignmentIds(a).includes(id)) continue
      const ids = assignmentIds(a).filter((x) => x !== id)
      if (!ids.length) delete assignments[key]
      else
        assignments[key] = {
          ...a,
          id: ids[0],
          ids,
          title: ids
            .map((id) => acts.find((a) => a.id === id)?.title ?? "")
            .join(" + "),
        }
    }
    change(
      { ...state, acts, assign: assignments },
      "Activity deleted. Any remaining activities in its plan have been kept.",
    )
    setModal(null)
  }
  const navigate = (next: Tab) => {
    if (next === "map") {
      setMapKey(contextGap?.key)
      setMapReturn(undefined)
    }
    setModal(null)
    setTab(next)
  }
  const returnFromMap = () => {
    if (!mapReturn) return
    let nextTab = mapReturn.tab
    if (
      mapGap &&
      (nextTab === "plan" ||
        (nextTab === "today" && mapGap.key !== rightBase?.key))
    ) {
      setPlanDay(mapGap.day)
      setPlanKey(mapGap.key)
      nextTab = "plan"
    }
    setTab(nextTab)
    if (mapReturn.detail && selection.id)
      setModal({
        kind: "details",
        id: selection.id,
        gapKey: mapGap?.key,
        location: selection.location,
      })
    setMapReturn(undefined)
  }
  const findModal = modal?.kind === "find" ? modal : undefined
  const moving =
    findModal?.exclude && state.assign[findModal.exclude]?.kind === "act"
      ? state.assign[findModal.exclude]
      : undefined
  const findingActivities =
    findModal?.ids
      .map((id) => state.acts.find((a) => a.id === id))
      .filter((a): a is Activity => !!a) ?? []
  const findingChoices = gaps
    .filter(
      (g) =>
        futureGap(g, state.now) &&
        g.key !== findModal?.exclude &&
        !state.assign[g.key],
    )
    .map(effective)
    .map((g) => ({
      g,
      sequence: evaluateSequence(
        findingActivities.map((a) =>
          atLocation(
            a,
            moving?.kind === "act"
              ? moving.locations?.[a.id]
              : findModal?.locations?.[a.id],
          ),
        ),
        g,
        state.prefs,
      ),
    }))
    .filter((x) => x.sequence.fit !== "none" && findingActivities.length > 0)
  const useFoundGap = (g: Gap) => {
    if (!findModal) return
    if (moving?.kind === "act" && findModal.exclude) {
      const next = { ...state.assign }
      delete next[findModal.exclude]
      next[g.key] = {
        ...moving,
        startAt: g.start,
        day: g.day,
        start: g.start,
        end: g.end,
      }
      change(
        { ...state, assign: next },
        `${findingActivities.map((a) => a.title).join(" + ")} moved to ${DAYS[g.day].toLowerCase()} at ${fmt(g.start)}.`,
      )
    }
    exploreGap(g, findingActivities[0])
    const location = findModal.locations?.[findingActivities[0]?.id]
    if (location) setSelection({ id: findingActivities[0].id, location })
  }
  const detailActivity =
    modal?.kind === "details"
      ? state.acts.find((a) => a.id === modal.id)
      : undefined
  const detailBase =
    modal?.kind === "details"
      ? gaps.find((g) => g.key === modal.gapKey)
      : undefined
  const detailChoice = detailBase && state.assign[detailBase.key]
  const detailGap =
    detailBase &&
    (detailChoice?.kind === "act"
      ? gapAtTime(
          detailBase,
          Math.max(detailBase.start, detailChoice.startAt ?? detailBase.start),
        )
      : effective(detailBase))
  const changePrefs = (prefs: Prefs) =>
    change(
      { ...state, prefs },
      "Preferences saved. Walking, usable time, and activity fits updated.",
    )
  const changeTime = (now: number) => {
    change({ ...state, now }, `Planning time updated to ${fmt(now)}.`)
  }
  const addCommitment = (day = planDay) => setModal({ kind: "commitment", day })
  const pageToPlan = () => {
    if (contextGap) exploreGap(contextGap)
    else {
      setPlanDay(0)
      setTab("plan")
    }
  }

  return (
    <div className="gapwise-app">
      <div className="app-shell" inert={!!modal || !state.onboarded}>
        <header className="app-header">
          <Button
            className="app-brand"
            aria-label="GapWise home"
            onClick={() => navigate("today")}
          >
            <span className="brand-symbol">
              <svg
                viewBox="0 0 28 28"
                width="24"
                height="24"
                aria-hidden="true"
              >
                <path
                  d="M7 5v13a7 7 0 0 0 14 0V5M7 11h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="brand-wordmark">GapWise</span>
            <span className="brand-tagline">Make the space between count.</span>
          </Button>
          <nav className="app-navigation" aria-label="Main navigation">
            {NAV.map(([key, label, Icon]) => (
              <Button
                className={`app-nav-item ${tab === key ? "is-active" : ""}`}
                key={key}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
              </Button>
            ))}
          </nav>
          <Button
            className="header-clock"
            onClick={() => setModal({ kind: "clock" })}
            aria-label={`Planning clock, ${fmt(state.now)}`}
          >
            <Clock3 size={16} />
            <span>
              {fmt(state.now)}
              <small>{DATE_LABELS[0]}</small>
            </span>
          </Button>
        </header>
        <div className="app-body">
          <div className="page-scroll" ref={page}>
            {storageWarning && (
              <div className="storage-warning" role="alert">
                Changes cannot be saved in this tab. Keep it open to retain your
                plan.
              </div>
            )}
            {notice && (
              <div className="product-notice" role="status">
                <span>{notice}</span>
                {history.length > 0 && (
                  <Button size="small" onClick={undo}>
                    <RotateCcw size={14} />
                    Undo
                  </Button>
                )}
                <Button
                  size="icon"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={16} />
                </Button>
              </div>
            )}
            {issues.length > 0 && (
              <section
                className="recovery-notices"
                aria-label="Plans that need attention"
              >
                {issues.map((issue) => {
                  const ids = assignmentIds(issue.assignment),
                    a = state.acts.find((a) => a.id === ids[0])
                  const title = ids
                    .map((id) => state.acts.find((a) => a.id === id)?.title)
                    .join(" + ")
                  return (
                    <div className="recovery-card" key={issue.key}>
                      <AlertTriangle size={20} />
                      <div>
                        <h2>
                          {title} no longer fits
                          {issue.gap ? ` before ${issue.gap.next.title}` : ""}.
                        </h2>
                        <p>
                          {issue.reason} Your assignment has been kept until you
                          change it.
                        </p>
                        <div className="button-row">
                          {a && (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => openFindTime(a, issue.key)}
                            >
                              Find another time
                            </Button>
                          )}
                          {issue.gap && (
                            <Button
                              size="small"
                              onClick={() => {
                                clearAssignment(issue.key)
                                exploreGap(effective(issue.gap!))
                              }}
                            >
                              Choose a shorter activity
                            </Button>
                          )}
                          <Button
                            size="small"
                            onClick={() => clearAssignment(issue.key)}
                          >
                            Remove assignment
                          </Button>
                          {issue.gap && (
                            <Button
                              size="small"
                              onClick={() => choose(issue.gap!, "open")}
                            >
                              <Leaf size={14} />
                              Keep gap open
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
            {tab === "today" && (
              <CampusToday
                state={state}
                gap={rightGap}
                selection={selection}
                actions={actions}
                onPlan={pageToPlan}
                onAddCommitment={() => addCommitment(0)}
              />
            )}
            {tab === "plan" && (
              <PlanAhead
                state={state}
                day={planDay}
                gap={planGap}
                selectedId={selection.id}
                selectedLocation={selection.location}
                actions={actions}
                onDay={(day) => {
                  setPlanDay(day)
                  setPlanKey(undefined)
                }}
                onGap={pickGap}
                onCommitment={openCommitment}
                onAdd={() => addCommitment(planDay)}
              />
            )}
            {tab === "map" && (
              <MapExplorer
                state={state}
                gap={mapGap}
                selection={selection}
                actions={actions}
                onGap={pickGap}
                onCommitment={openCommitment}
                onPlan={pageToPlan}
                onReturn={mapReturn ? returnFromMap : undefined}
                returnLabel={
                  mapReturn?.detail
                    ? "Return to activity"
                    : mapReturn?.tab === "today"
                      ? mapGap?.key === rightGap?.key
                        ? "Return to Right Now"
                        : "Continue in Plan"
                      : "Return to gap"
                }
              />
            )}
            {tab === "acts" && (
              <Activities
                state={state}
                onAdd={() => setModal({ kind: "activity" })}
                onDetails={(a) => {
                  setSelection({ id: a.id })
                  setModal({ kind: "details", id: a.id, gapKey: rightGap?.key })
                }}
                onEdit={(activity) => setModal({ kind: "activity", activity })}
                onToggle={(a) => complete([a.id], !a.done)}
              />
            )}
            {tab === "settings" && (
              <Settings
                state={state}
                gap={rightGap}
                onPrefs={changePrefs}
                onTime={changeTime}
                onSetup={() => setModal({ kind: "setup" })}
                onReset={() => setModal({ kind: "reset" })}
              />
            )}
          </div>
        </div>
      </div>
      {modal?.kind === "details" && detailActivity && (
        <ActivityDetails
          activity={detailActivity}
          gap={detailGap}
          state={state}
          location={modal.location}
          actions={actions}
          onClose={() => setModal(null)}
          onEdit={() =>
            setModal({
              kind: "activity",
              activity: detailActivity,
              returnTo: modal,
            })
          }
          onDelete={() =>
            setModal({ kind: "delete", id: detailActivity.id, returnTo: modal })
          }
          onToggle={() => complete([detailActivity.id], !detailActivity.done)}
          onGap={(g, a) => {
            exploreGap(g, a)
            if (modal.location)
              setSelection({ id: a.id, location: modal.location })
          }}
        />
      )}
      {modal?.kind === "activity" && (
        <ActivityForm
          initial={modal.activity}
          onSave={saveActivity}
          onClose={() => setModal(modal.returnTo ?? null)}
        />
      )}
      {modal?.kind === "commitment" && (
        <CommitmentForm
          initial={modal.commitment}
          day={modal.day}
          commitments={state.cs}
          onSave={saveCommitment}
          onClose={() => setModal(null)}
          onCancel={
            modal.commitment ? () => toggleCancel(modal.commitment!) : undefined
          }
        />
      )}
      {modal?.kind === "delete" && (
        <Confirmation
          title="Delete activity?"
          confirm="Delete activity"
          onClose={() => setModal(modal.returnTo ?? null)}
          onConfirm={() => deleteActivity(modal.id)}
        >
          This activity will be removed from your list and any plans. You can
          undo the deletion.
        </Confirmation>
      )}
      {modal?.kind === "reset" && (
        <Confirmation
          title="Reset your local schedule?"
          confirm="Reset schedule"
          onClose={() => setModal(null)}
          onConfirm={() => {
            change(freshState(), "Local schedule reset.")
            setModal(null)
            setTab("today")
            setSelection({ id: "print" })
          }}
        >
          This replaces activities, commitments, and preferences in this tab
          with the starting schedule. You can undo this change.
        </Confirmation>
      )}
      {(modal?.kind === "setup" || !state.onboarded) && (
        <SetupForm
          prefs={state.prefs}
          onClose={() => {
            setModal(null)
            if (!state.onboarded) setState({ ...state, onboarded: true })
          }}
          onSave={(prefs) => {
            change(
              { ...state, prefs, onboarded: true },
              "Planning preferences saved.",
            )
            setModal(null)
          }}
        />
      )}
      {findModal && (
        <Sheet
          title={`Find time for ${findingActivities.map((a) => a.title).join(" + ")}`}
          onClose={() => setModal(null)}
        >
          <div className="form-stack">
            <p className="muted">
              Walking, setup, deadlines, and your arrival buffer are included.
              Gaps you kept open are left alone.
            </p>
            {findingChoices.length ? (
              findingChoices.map(({ g, sequence }) => (
                <div key={g.key} className="found-gap">
                  <div className="section-heading">
                    <h3>
                      {DAYS[g.day]} · {fmt(g.start)}–{fmt(g.end)}
                    </h3>
                    <FitBadge fit={sequence.fit} />
                  </div>
                  <p>
                    Before {g.next.title} · {g.next.location}
                  </p>
                  <p>
                    {sequence.remaining} min remaining · {sequence.walking} min
                    total walking · +{sequence.extraTravel} min detour
                  </p>
                  <Button variant="primary" onClick={() => useFoundGap(g)}>
                    {moving ? "Move here" : "View this gap"}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState title="No available gap fits yet.">
                <p>
                  Try a shorter activity, adjust a commitment, or add a future
                  day to your schedule.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setModal(null)
                    setTab("plan")
                  }}
                >
                  Open Plan
                </Button>
              </EmptyState>
            )}
          </div>
        </Sheet>
      )}
      {modal?.kind === "clock" && (
        <Sheet title="Planning clock" onClose={() => setModal(null)}>
          <div className="form-stack">
            <p className="muted">
              Use a different time to see what remains in today’s gaps.
            </p>
            <Field label="Time used for Right Now">
              <input
                type="time"
                value={toStr(state.now)}
                onChange={(e) => {
                  if (e.target.value) changeTime(toMin(e.target.value))
                }}
              />
            </Field>
            <RangeInput
              aria-label="Planning time"
              min={480}
              max={1080}
              step={5}
              value={state.now}
              onChange={(e) => changeTime(Number(e.target.value))}
            />
            <div className="section-heading small muted">
              <span>8:00 AM</span>
              <span>6:00 PM</span>
            </div>
            <Button variant="primary" onClick={() => setModal(null)}>
              Done
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
