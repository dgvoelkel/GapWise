import {
  Accessibility,
  CalendarDays,
  Clock3,
  Footprints,
  Leaf,
  RotateCcw,
  Settings2,
  Users,
} from "lucide-react"
import { type Gap, type Prefs, fmt } from "./logic"
import { type State } from "./state"
import { PERSONAS } from "./personas"
import { BufferSelector, Field, toMin, toStr } from "./Forms"
import { Button } from "./ui"

export default function Settings({
  state,
  gap,
  onPrefs,
  onTime,
  onSetup,
  onReset,
  onSwitch,
}: {
  state: State
  gap?: Gap
  onPrefs: (prefs: Prefs) => void
  onTime: (time: number) => void
  onSetup: () => void
  onReset: () => void
  onSwitch: () => void
}) {
  const p = state.prefs
  const persona = state.persona ? PERSONAS[state.persona] : undefined
  return (
    <main className="workspace-page settings-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">Make it work for you</div>
          <h1>Settings</h1>
          <p>Set a realistic pace and leave yourself room to arrive.</p>
        </div>
      </header>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>
            <Clock3 size={19} />
            Arrival buffer
          </h2>
          <p>
            Reserve time before the next commitment. Individual commitments can
            use a different buffer.
          </p>
          <BufferSelector
            value={p.buffer}
            onChange={(buffer) => onPrefs({ ...p, buffer })}
          />
          {gap && (
            <div className="settings-preview">
              Your {fmt(gap.start)} gap: <b>{gap.usable} min usable</b> after{" "}
              {gap.travel} min walking and {gap.buffer} min buffer.
            </div>
          )}
        </section>
        <section className="settings-section">
          <h2>
            <Footprints size={19} />
            Walking pace
          </h2>
          <p>Walking estimates update across recommendations and routes.</p>
          <div className="segmented">
            {(["relaxed", "normal", "brisk"] as const).map((pace) => (
              <Button
                key={pace}
                aria-pressed={p.pace === pace}
                className={`capitalize ${p.pace === pace ? "is-active" : ""}`}
                onClick={() => onPrefs({ ...p, pace })}
              >
                {pace[0].toUpperCase() + pace.slice(1)}
              </Button>
            ))}
          </div>
          <span className="small muted">
            All walking times are approximate.
          </span>
        </section>
        <section className="settings-section">
          <h2>
            <Accessibility size={19} />
            Accessibility & walking
          </h2>
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!p.accessible}
              onChange={(e) => onPrefs({ ...p, accessible: e.target.checked })}
            />
            <span>
              Prefer accessible routes
              <small>
                Allow 15% more walking time for route flexibility. Step-free
                building access is not verified.
              </small>
            </span>
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={p.avoidLong}
              onChange={(e) => onPrefs({ ...p, avoidLong: e.target.checked })}
            />
            <span>
              Avoid unnecessarily long walks
              <small>Rank shorter complete routes above extra detours.</small>
            </span>
          </label>
        </section>
        <section className="settings-section">
          <h2>
            <CalendarDays size={19} />
            Planning style
          </h2>
          <div className="segmented">
            {([
              ["ahead", "Plan ahead"],
              ["moment", "Decide in the moment"],
            ] as const).map(([style, label]) => (
              <Button
                key={style}
                aria-pressed={p.style === style}
                className={p.style === style ? "is-active" : ""}
                onClick={() => onPrefs({ ...p, style })}
              >
                {label}
              </Button>
            ))}
          </div>
          <p>
            {p.style === "ahead"
              ? "Show upcoming planning shortcuts on Right Now."
              : "Keep Right Now focused on the gap in front of you."}
          </p>
        </section>
        <section className="settings-section">
          <h2>
            <Leaf size={19} />
            Activity preferences
          </h2>
          <Field label="Preferred energy level">
            <select
              value={p.energy ?? "any"}
              onChange={(e) =>
                onPrefs({ ...p, energy: e.target.value as Prefs["energy"] })
              }
            >
              <option value="any">Any energy level</option>
              <option value="low">Low energy</option>
              <option value="medium">Medium energy</option>
              <option value="high">High energy</option>
            </select>
          </Field>
          <p>
            Give activities at your preferred energy level a higher place in
            recommendations.
          </p>
        </section>
        <section className="settings-section">
          <h2>
            <Settings2 size={19} />
            Your schedule
          </h2>
          <Field
            label="Time used for Right Now"
            hint="Adjust the planning clock to see the time remaining in today’s gaps."
          >
            <input
              type="time"
              value={toStr(state.now)}
              onChange={(e) => {
                if (e.target.value) onTime(toMin(e.target.value))
              }}
            />
          </Field>
          <p className="schedule-source">
            <Users size={16} />
            <span>
              Schedule:{" "}
              {persona
                ? `demo data for ${persona.name}`
                : "your own entries"}{" "}
              · Stored only in this browser tab.
            </span>
          </p>
          <p>
            Nothing is sent anywhere, and nothing is kept after this tab closes.
          </p>
          <div className="button-row">
            <Button variant="secondary" onClick={onSwitch}>
              <Users size={14} />
              Switch student
            </Button>
            <Button variant="secondary" onClick={onSetup}>
              Update planning preferences
            </Button>
            <Button className="danger-text" onClick={onReset}>
              <RotateCcw size={14} />
              Reset schedule
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
