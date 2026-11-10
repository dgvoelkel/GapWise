import {
  Children,
  cloneElement,
  useId,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  type Activity,
  type Commitment,
  type Prefs,
  type Priority,
  DAYS,
  LOC_NAMES,
  categoryOf,
  commitmentError,
  energyOf,
} from "./logic"
import { Sheet } from "./components"
import { Button } from "./ui"

export const toStr = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
export const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + m
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const id = useId()
  const child = Children.only(children) as ReactElement<{
    id?: string
    "aria-describedby"?: string
  }>
  const inputId = child.props.id ?? id
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      {cloneElement(child, {
        id: inputId,
        "aria-describedby": hint
          ? `${id}-hint`
          : child.props["aria-describedby"],
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  )
}
export function BufferSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [custom, setCustom] = useState(![0, 5, 10, 15].includes(value))
  return (
    <div>
      <div className="segmented" aria-label="Arrival buffer">
        {[0, 5, 10, 15].map((n) => (
          <Button
            key={n}
            aria-pressed={!custom && value === n}
            className={!custom && value === n ? "is-active" : ""}
            onClick={() => {
              setCustom(false)
              onChange(n)
            }}
          >
            {n} min
          </Button>
        ))}
        <Button
          aria-pressed={custom}
          className={custom ? "is-active" : ""}
          onClick={() => setCustom(true)}
        >
          Custom
        </Button>
      </div>
      {custom && (
        <Field label="Custom buffer (minutes)">
          <input
            type="number"
            min={0}
            max={60}
            value={value}
            onChange={(e) =>
              onChange(Math.max(0, Math.min(60, Number(e.target.value))))
            }
          />
        </Field>
      )}
    </div>
  )
}
export function ActivityForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Activity
  onSave: (a: Activity) => void
  onClose: () => void
}) {
  const [a, setA] = useState<Activity>(() =>
    initial
      ? { ...initial, category: categoryOf(initial), energy: energyOf(initial) }
      : {
          id: crypto.randomUUID(),
          title: "",
          duration: 20,
          locations: [],
          flexibleLocation: true,
          priority: "should",
          category: "errand",
          energy: "low",
          setup: 0,
        },
  )
  const [error, setError] = useState("")
  const [deadline, setDeadline] = useState(a.deadline != null)
  const [window, setWindow] = useState(!!a.preferred)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!a.title.trim()) return setError("Enter an activity name.")
    if (!Number.isFinite(a.duration) || a.duration < 1 || a.duration > 480)
      return setError("Duration must be between 1 and 480 minutes.")
    if ((a.setup ?? 0) < 0 || (a.setup ?? 0) > 120)
      return setError("Setup time must be between 0 and 120 minutes.")
    if (!a.flexibleLocation && !a.locations.length)
      return setError("Choose a location or allow a flexible location.")
    if (deadline && (!Number.isFinite(a.deadline) || a.deadline! < 0))
      return setError("Choose a deadline time.")
    if (window && (!a.preferred || a.preferred[1] <= a.preferred[0]))
      return setError("The time window must end after it starts.")
    onSave({
      ...a,
      title: a.title.trim(),
      deadline: deadline ? a.deadline : undefined,
      deadlineDay: deadline ? (a.deadlineDay ?? 0) : undefined,
      preferred: window ? a.preferred : undefined,
      required: window && a.required,
    })
  }
  return (
    <Sheet title={initial ? "Edit activity" : "Add activity"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Activity name">
          <input
            autoFocus
            required
            maxLength={100}
            value={a.title}
            placeholder="e.g. Pick up a package"
            onChange={(e) => setA({ ...a, title: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label="Duration (minutes)">
            <input
              type="number"
              required
              min={1}
              max={480}
              value={a.duration}
              onChange={(e) => setA({ ...a, duration: Number(e.target.value) })}
            />
          </Field>
          <Field label="Setup time (minutes)">
            <input
              type="number"
              min={0}
              max={120}
              value={a.setup ?? 0}
              onChange={(e) => setA({ ...a, setup: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Priority">
          <select
            value={a.priority}
            onChange={(e) =>
              setA({ ...a, priority: e.target.value as Priority })
            }
          >
            <option value="must">Must do</option>
            <option value="should">Should do</option>
            <option value="optional">Optional</option>
          </select>
        </Field>
        <div className="form-row">
          <Field label="Category">
            <select
              value={a.category}
              onChange={(e) =>
                setA({
                  ...a,
                  category: e.target.value as Activity["category"],
                  isRest: e.target.value === "rest",
                })
              }
            >
              <option value="study">Study</option>
              <option value="food">Food & coffee</option>
              <option value="move">Movement</option>
              <option value="errand">Errands</option>
              <option value="rest">Rest</option>
            </select>
          </Field>
          <Field label="Energy needed">
            <select
              value={a.energy}
              onChange={(e) =>
                setA({ ...a, energy: e.target.value as Activity["energy"] })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
        <Field label="Campus location">
          <select
            value={a.locations[0] ?? ""}
            onChange={(e) =>
              setA({
                ...a,
                locations: e.target.value ? [e.target.value] : [],
                flexibleLocation: e.target.value ? a.flexibleLocation : true,
              })
            }
          >
            <option value="">Any nearby location</option>
            {LOC_NAMES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            checked={!!a.flexibleLocation}
            onChange={(e) => setA({ ...a, flexibleLocation: e.target.checked })}
          />
          <span>Location is flexible</span>
        </label>
        <details className="form-disclosure">
          <summary>Other possible locations</summary>
          <div className="location-options">
            {LOC_NAMES.map((l) => (
              <label className="check-field" key={l}>
                <input
                  type="checkbox"
                  checked={a.locations.includes(l)}
                  onChange={(e) =>
                    setA({
                      ...a,
                      locations: e.target.checked
                        ? [...a.locations, l]
                        : a.locations.filter((x) => x !== l),
                    })
                  }
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </details>
        <div className="form-option-group">
          <label className="check-field">
            <input
              type="checkbox"
              checked={deadline}
              onChange={(e) => {
                setDeadline(e.target.checked)
                if (e.target.checked && a.deadline == null)
                  setA({ ...a, deadline: 780, deadlineDay: 0 })
              }}
            />
            <span>Add a deadline</span>
          </label>
          {deadline && (
            <div className="form-row">
              <Field label="Deadline day">
                <select
                  value={a.deadlineDay ?? 0}
                  onChange={(e) =>
                    setA({ ...a, deadlineDay: Number(e.target.value) })
                  }
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Deadline time">
                <input
                  required
                  type="time"
                  value={toStr(a.deadline ?? 780)}
                  onChange={(e) =>
                    setA({ ...a, deadline: toMin(e.target.value) })
                  }
                />
              </Field>
            </div>
          )}
        </div>
        <div className="form-option-group">
          <label className="check-field">
            <input
              type="checkbox"
              checked={window}
              onChange={(e) => {
                setWindow(e.target.checked)
                if (e.target.checked && !a.preferred)
                  setA({ ...a, preferred: [720, 840] })
              }}
            />
            <span>Set a preferred time window</span>
          </label>
          {window && (
            <>
              <div className="form-row">
                <Field label="Preferred start">
                  <input
                    required
                    type="time"
                    value={toStr(a.preferred?.[0] ?? 720)}
                    onChange={(e) =>
                      setA({
                        ...a,
                        preferred: [
                          toMin(e.target.value),
                          a.preferred?.[1] ?? 840,
                        ],
                      })
                    }
                  />
                </Field>
                <Field label="Preferred end">
                  <input
                    required
                    type="time"
                    value={toStr(a.preferred?.[1] ?? 840)}
                    onChange={(e) =>
                      setA({
                        ...a,
                        preferred: [
                          a.preferred?.[0] ?? 720,
                          toMin(e.target.value),
                        ],
                      })
                    }
                  />
                </Field>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={!!a.required}
                  onChange={(e) => setA({ ...a, required: e.target.checked })}
                />
                <span>Only available during this window</span>
              </label>
            </>
          )}
        </div>
        <Field label="Notes (optional)">
          <textarea
            rows={2}
            maxLength={500}
            value={a.notes ?? ""}
            onChange={(e) => setA({ ...a, notes: e.target.value })}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {initial ? "Save changes" : "Save activity"}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
export const DAY_CODES = ["W", "Th", "F", "S", "Su", "M", "T"]
export function commitmentInstances(c: Commitment) {
  return DAYS.flatMap((_, day) =>
    day === c.day || c.recurrence.includes(DAY_CODES[day])
      ? [
          {
            ...c,
            id: day === c.day ? c.id : `${c.id}-${day}`,
            day,
            seriesId: c.recurrence.length ? c.id : undefined,
          },
        ]
      : [],
  )
}
export function CommitmentForm({
  initial,
  day,
  commitments,
  onSave,
  onClose,
  onCancel,
}: {
  initial?: Commitment
  day: number
  commitments: Commitment[]
  onSave: (c: Commitment) => string | undefined
  onClose: () => void
  onCancel?: () => string | undefined
}) {
  const [c, setC] = useState<Commitment>(
    initial ?? {
      id: crypto.randomUUID(),
      title: "",
      start: 840,
      end: 900,
      location: "Gibson Hall",
      day,
      recurrence: [],
      type: "class",
    },
  )
  const [error, setError] = useState("")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = commitmentError(c, commitments)
    if (problem) setError(problem)
    else setError(onSave({ ...c, title: c.title.trim() }) ?? "")
  }
  return (
    <Sheet
      title={initial ? "Edit commitment" : "Add commitment"}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label="Title">
          <input
            autoFocus
            required
            maxLength={100}
            value={c.title}
            placeholder="e.g. Office hours"
            onChange={(e) => setC({ ...c, title: e.target.value })}
          />
        </Field>
        <Field label="Day">
          <select
            value={c.day}
            onChange={(e) => setC({ ...c, day: Number(e.target.value) })}
          >
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Start time">
            <input
              required
              type="time"
              value={toStr(c.start)}
              onChange={(e) => setC({ ...c, start: toMin(e.target.value) })}
            />
          </Field>
          <Field label="End time">
            <input
              required
              type="time"
              value={toStr(c.end)}
              onChange={(e) => setC({ ...c, end: toMin(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Location">
          <select
            value={c.location}
            onChange={(e) => setC({ ...c, location: e.target.value })}
          >
            {LOC_NAMES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Arrival buffer">
          <select
            value={c.buffer ?? ""}
            onChange={(e) =>
              setC({
                ...c,
                buffer:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          >
            <option value="">Use my default</option>
            {[0, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </Field>
        {!initial && (
          <fieldset>
            <legend>Repeat on these days</legend>
            <div className="weekday-options">
              {["M", "T", "W", "Th", "F", "S", "Su"].map((d) => (
                <Button
                  key={d}
                  aria-pressed={c.recurrence.includes(d)}
                  className={c.recurrence.includes(d) ? "is-active" : ""}
                  onClick={() =>
                    setC({
                      ...c,
                      recurrence: c.recurrence.includes(d)
                        ? c.recurrence.filter((x) => x !== d)
                        : [...c.recurrence, d],
                    })
                  }
                >
                  {d}
                </Button>
              ))}
            </div>
            <p className="small muted">
              Adds occurrences within the seven days shown in Plan.
            </p>
          </fieldset>
        )}
        {initial && c.recurrence.length > 0 && (
          <p className="muted small">
            Repeats {c.recurrence.join(", ")}. Changes apply to this occurrence.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            {initial ? "Save changes" : "Add to calendar"}
          </Button>
        </div>
        {onCancel && (
          <Button
            className="danger-text"
            onClick={() => setError(onCancel() ?? "")}
          >
            {initial?.canceled ? "Restore commitment" : "Cancel commitment"}
          </Button>
        )}
      </form>
    </Sheet>
  )
}
export function SetupForm({
  prefs,
  onClose,
  onSave,
}: {
  prefs: Prefs
  onClose: () => void
  onSave: (p: Prefs) => void
}) {
  const [p, setP] = useState(prefs)
  return (
    <Sheet title="Your planning preferences" onClose={onClose}>
      <div className="form-stack">
        <p className="muted">
          Make room for walking, arriving, and everything in between.
        </p>
        <fieldset>
          <legend>Arrival buffer</legend>
          <BufferSelector
            value={p.buffer}
            onChange={(buffer) => setP({ ...p, buffer })}
          />
        </fieldset>
        <Field label="Walking pace">
          <select
            value={p.pace}
            onChange={(e) =>
              setP({ ...p, pace: e.target.value as Prefs["pace"] })
            }
          >
            <option value="relaxed">Relaxed</option>
            <option value="normal">Normal</option>
            <option value="brisk">Brisk</option>
          </select>
        </Field>
        <Field label="Planning style">
          <select
            value={p.style}
            onChange={(e) =>
              setP({ ...p, style: e.target.value as Prefs["style"] })
            }
          >
            <option value="moment">Decide in the moment</option>
            <option value="ahead">Plan ahead</option>
          </select>
        </Field>
        <Button variant="primary" onClick={() => onSave(p)}>
          Save preferences
        </Button>
      </div>
    </Sheet>
  )
}
