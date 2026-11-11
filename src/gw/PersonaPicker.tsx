import { ArrowRight, Lightbulb } from "lucide-react"
import { type PersonaId, PERSONAS, PERSONA_IDS } from "./personas"
import { fmt } from "./logic"
import { Sheet } from "./components"
import { Button } from "./ui"

type Props = {
  onChoose: (id: PersonaId) => void
  onEmpty: () => void
  /** When set, the picker is a dialog opened from Settings rather than the first-run screen. */
  onClose?: () => void
  current?: PersonaId
}

function PersonaCards({ onChoose, onEmpty, current }: Props) {
  return (
    <>
      <div className="persona-grid">
        {PERSONA_IDS.map((id) => {
          const persona = PERSONAS[id]
          const active = current === id
          return (
            <article
              key={id}
              className={`persona-card ${active ? "is-current" : ""}`}
              aria-label={persona.name}
            >
              <div className="persona-card-heading">
                <span className="persona-initial" aria-hidden="true">
                  {persona.short[0]}
                </span>
                <div>
                  <h2>{persona.name}</h2>
                  <p className="persona-tagline">“{persona.tagline}”</p>
                </div>
              </div>
              <p className="persona-bio">{persona.bio}</p>
              <div className="persona-tasks">
                <span className="section-kicker">
                  <Lightbulb size={13} />
                  Things to try
                </span>
                <ul>
                  {persona.tasks.map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              </div>
              <Button
                variant="primary"
                className="persona-choose"
                onClick={() => onChoose(id)}
              >
                {active ? `Restart as ${persona.short}` : `Explore as ${persona.short}`}
                <ArrowRight size={15} />
              </Button>
              <small className="muted">
                Demo clock starts {fmt(persona.now)} on Wednesday.
              </small>
            </article>
          )
        })}
      </div>
      <p className="persona-footer">
        <button className="text-button" onClick={onEmpty}>
          Start with an empty schedule
        </button>{" "}
        and add commitments yourself.
      </p>
    </>
  )
}

export default function PersonaPicker(props: Props) {
  if (props.onClose)
    return (
      <Sheet title="Explore GapWise as…" onClose={props.onClose} wide>
        <p className="muted">
          Switching replaces the schedule in this tab with that student’s demo
          data.
        </p>
        <PersonaCards {...props} />
      </Sheet>
    )
  return (
    <main className="persona-picker" aria-labelledby="persona-picker-title">
      <header className="persona-picker-heading">
        <span className="brand-symbol" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="28" height="28">
            <path
              d="M7 5v13a7 7 0 0 0 14 0V5M7 11h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="section-kicker">GapWise · Tulane uptown campus</div>
        <h1 id="persona-picker-title">Explore GapWise as…</h1>
        <p>
          Pick a student to see their week. The schedule is demo data that
          lives only in this browser tab: no account, no calendar connection,
          nothing saved after you close it.
        </p>
      </header>
      <PersonaCards {...props} />
    </main>
  )
}
