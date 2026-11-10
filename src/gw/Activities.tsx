import { useState } from "react"
import { ArrowRight, Check, Pencil, Plus, Search } from "lucide-react"
import {
  type Activity,
  type Category,
  categoryOf,
  deadlineLabel,
} from "./logic"
import { type State, assignmentIds } from "./state"
import { ActIcon, CompletedLabel, EmptyState, PriorityTag } from "./components"
import { Button } from "./ui"

export default function Activities({
  state,
  onAdd,
  onDetails,
  onEdit,
  onToggle,
}: {
  state: State
  onAdd: () => void
  onDetails: (a: Activity) => void
  onEdit: (a: Activity) => void
  onToggle: (a: Activity) => void
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"active" | "done" | "all">("active")
  const [category, setCategory] = useState<"all" | Category>("all")
  const active = state.acts.filter((a) => !a.done)
  const planned = new Set(Object.values(state.assign).flatMap(assignmentIds))
  const list = state.acts.filter(
    (a) =>
      (status === "all" || !!a.done === (status === "done")) &&
      (category === "all" || categoryOf(a) === category) &&
      `${a.title} ${a.locations.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <main className="workspace-page activities-page">
      <header className="page-heading">
        <div>
          <div className="section-kicker">Your activities</div>
          <h1>Things to make time for</h1>
          <p>
            {active.length} unfinished ·{" "}
            {state.acts.filter((a) => a.done).length} completed
          </p>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <Plus size={16} />
          Add activity
        </Button>
      </header>
      <div className="activity-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search activities"
            placeholder="Search activities or locations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Activity category"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
        >
          <option value="all">All categories</option>
          <option value="study">Study</option>
          <option value="food">Food & coffee</option>
          <option value="move">Movement</option>
          <option value="errand">Errands</option>
          <option value="rest">Rest</option>
        </select>
        <div className="segmented" aria-label="Activity status">
          {(["active", "done", "all"] as const).map((k) => (
            <Button
              key={k}
              aria-pressed={status === k}
              className={status === k ? "is-active" : ""}
              onClick={() => setStatus(k)}
            >
              {{ active: "Unfinished", done: "Completed", all: "All" }[k]}
            </Button>
          ))}
        </div>
      </div>
      <div className="activity-management-list">
        {list.map((a) => (
          <article
            key={a.id}
            className={`activity-management-card ${
              a.done ? "is-completed" : ""
            }`}
            aria-label={a.title}
          >
            <ActIcon a={a} />
            <div className="activity-management-content">
              <button
                className="text-button activity-title"
                onClick={() => onDetails(a)}
              >
                {a.title}
              </button>
              <p>
                {a.duration} min
                {(a.setup ?? 0) > 0 && ` + ${a.setup} min setup`} ·{" "}
                {a.flexibleLocation || !a.locations.length
                  ? "Flexible location"
                  : a.locations.join(" / ")}
              </p>
              <div className="activity-tags">
                <PriorityTag p={a.priority} />
                {a.done ? (
                  <CompletedLabel />
                ) : planned.has(a.id) ? (
                  <span className="planned-label">Planned</span>
                ) : null}
                {a.deadline != null && (
                  <span className="deadline-label">
                    Due {deadlineLabel(a).toLowerCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="activity-management-actions">
              <Button size="small" onClick={() => onDetails(a)}>
                Details & gaps
                <ArrowRight size={13} />
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => onEdit(a)}
              >
                <Pencil size={13} />
                Edit
              </Button>
              <Button
                size="small"
                aria-label={`${
                  a.done ? "Mark unfinished" : "Complete"
                } ${a.title}`}
                onClick={() => onToggle(a)}
              >
                <Check size={14} />
                {a.done ? "Undo completion" : "Complete"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title={
            query
              ? "No matching activities."
              : status === "done"
                ? "No completed activities yet."
                : "No activities here."
          }
        >
          <p>
            {query
              ? "Try a different name, category, or location."
              : "Add something you’d like to make time for."}
          </p>
          <Button variant="secondary" onClick={onAdd}>
            Add activity
          </Button>
        </EmptyState>
      )}
    </main>
  )
}
