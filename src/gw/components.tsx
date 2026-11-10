import { useEffect, useId, useRef, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleCheck,
  CircleSlash,
  Flag,
  Footprints,
  Leaf,
  MapPin,
  X,
} from "lucide-react"
import {
  type Activity,
  type Eval,
  type Fit,
  type Gap,
  type Priority,
  deadlineLabel,
  fmt,
  priorityLabel,
} from "./logic"
import { CAMPUS_BUILDINGS, placePoint, routePath } from "./campus"
import { activityIcon } from "./CampusMap"
import { Button } from "./ui"

export function Sheet({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = panel.current!
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], summary, [tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length > 0)
    ;(element.querySelector<HTMLElement>("[autofocus]") ?? element)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      }
      if (event.key !== "Tab") return
      const nodes = focusable(),
        first = nodes[0],
        last = nodes[nodes.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault()
        first?.focus()
      }
    }
    element.addEventListener("keydown", onKey)
    return () => {
      element.removeEventListener("keydown", onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-panel ${wide ? "modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <Button size="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </Button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  )
}
export function FitBadge({ fit }: { fit: Fit }) {
  const Icon =
    fit === "comfortable"
      ? CircleCheck
      : fit === "tight"
        ? AlertTriangle
        : CircleSlash
  return (
    <span className={`fit-badge fit-${fit}`}>
      <Icon size={13} />
      {fit === "comfortable"
        ? "Comfortable"
        : fit === "tight"
          ? "Tight"
          : "Doesn't fit"}
    </span>
  )
}
export function PriorityTag({ p }: { p: Priority }) {
  return (
    <span className={`priority-tag priority-${p}`}>
      <Flag size={12} />
      {priorityLabel(p)}
    </span>
  )
}
export function ActIcon({ a }: { a: Activity }) {
  const Icon = a.isRest ? Leaf : activityIcon(a.id)
  return (
    <span className="activity-symbol">
      <Icon size={19} strokeWidth={1.7} />
    </span>
  )
}
export function TimeSummary({
  g,
  now,
  compact = false,
}: {
  g: Gap
  now?: number
  compact?: boolean
}) {
  return (
    <section
      className={`time-summary ${compact ? "is-compact" : ""}`}
      aria-label="Available time"
    >
      <div className="time-summary-main">
        <div className="section-kicker">
          {g.day === 0 && now != null && now >= g.start && now < g.end
            ? "Your current gap"
            : "Available between commitments"}
        </div>
        <h2>
          <strong>{g.usable}</strong> usable minutes
        </h2>
        <div className="time-equation">
          <span>{g.total} min gap</span>
          <span>− {g.travel} min walking</span>
          <span>− {g.buffer} min buffer</span>
          <b>= {g.usable} min usable</b>
        </div>
        {g.total < g.travel + g.buffer && (
          <p className="warning-text">
            Walking and your buffer need {g.travel + g.buffer - g.total} more
            minutes than this gap allows.
          </p>
        )}
      </div>
      <div className="next-event">
        <span className="section-kicker">Next commitment</span>
        <strong>{g.next.title}</strong>
        <span>
          <MapPin size={14} />
          {g.next.location}
        </span>
        <span>
          {fmt(g.next.start)} · {Math.max(0, g.total)} min away
        </span>
      </div>
    </section>
  )
}
export function RoutePreview({
  g,
  e,
  onExpand,
}: {
  g: Gap
  e?: Eval
  onExpand: () => void
}) {
  const stops = [g.prev.location, ...(e ? [e.loc] : []), g.next.location]
  const points = stops.map(placePoint)
  const minX = Math.min(...points.map((p) => p.x)) - 110,
    minY = Math.min(...points.map((p) => p.y)) - 90
  const width = Math.max(240, Math.max(...points.map((p) => p.x)) - minX + 110)
  const height = Math.max(220, Math.max(...points.map((p) => p.y)) - minY + 90)
  return (
    <div className="route-preview">
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="img"
        aria-label={`Route: ${stops.join(" to ")}`}
      >
        {CAMPUS_BUILDINGS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="#e9e9e3"
            stroke="#c5c9c2"
          />
        ))}
        {stops.slice(1).map((stop, i) => (
          <path
            key={i}
            d={routePath(stops[i], stop)}
            fill="none"
            stroke={i === 0 && e ? "#9a7a3e" : "#44736b"}
            strokeWidth={5}
            strokeDasharray={i === 0 && e ? "8 5" : undefined}
          />
        ))}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill={
                i === 0
                  ? "#253c33"
                  : i === points.length - 1
                    ? "#44736b"
                    : "#9a7a3e"
              }
              stroke="white"
              strokeWidth="3"
            />
            <text
              x={p.x}
              y={p.y + 6}
              textAnchor="middle"
              fontSize="18"
              fontWeight="600"
              fill="white"
            >
              {i === 0 ? "A" : i === points.length - 1 ? "B" : "1"}
            </text>
          </g>
        ))}
      </svg>
      <Button variant="secondary" size="small" onClick={onExpand}>
        <MapPin size={14} />
        Expand map
      </Button>
    </div>
  )
}
type RouteSummaryProps = {
  g: Gap
  e?: Eval
}
export function RouteSummary({ g, e }: RouteSummaryProps) {
  return (
    <div className="route-summary">
      <div>
        <i className="route-point point-start">A</i>
        <span>
          <small>Start</small>
          <b>{g.prev.location}</b>
        </span>
      </div>
      {e && (
        <>
          <p>
            <Footprints size={14} />
            {e.t1} min to activity
          </p>
          <div>
            <i className="route-point point-activity">1</i>
            <span>
              <small>{e.a.title}</small>
              <b>{e.loc}</b>
            </span>
          </div>
        </>
      )}
      <p>
        <Footprints size={14} />
        {e ? e.t2 : g.travel} min to next commitment
      </p>
      <div>
        <i className="route-point point-next">B</i>
        <span>
          <small>
            {g.next.title} · {fmt(g.end)}
          </small>
          <b>{g.next.location}</b>
        </span>
      </div>
      {e && (
        <div className="route-totals">
          <span>
            <b>{e.t1 + e.t2} min</b> total walking
          </span>
          <span>
            <b>{g.travel} min</b> direct
          </span>
          <span>
            <b>+{e.extraTravel} min</b> detour
          </span>
        </div>
      )}
    </div>
  )
}
export function RecommendationCard({
  e,
  selected,
  onSelect,
  onDetails,
  onAdd,
  onMap,
  onDismiss,
}: {
  e: Eval
  selected: boolean
  onSelect: () => void
  onDetails: () => void
  onAdd: () => void
  onMap: () => void
  onDismiss: () => void
}) {
  return (
    <article
      className={`recommendation-card ${selected ? "is-selected" : ""}`}
      aria-label={e.a.title}
    >
      <div className="recommendation-top">
        <ActIcon a={e.a} />
        <div className="recommendation-title">
          <button className="text-button activity-title" onClick={onSelect}>
            {e.a.title}
          </button>
          <span>
            {e.a.duration} min{e.setup > 0 && ` + ${e.setup} min setup`} ·{" "}
            {e.a.flexibleLocation || !e.a.locations.length
              ? "Flexible location"
              : e.loc}
          </span>
        </div>
        <FitBadge fit={e.fit} />
      </div>
      <div className="activity-tags">
        <PriorityTag p={e.a.priority} />
        {e.a.deadline != null && (
          <span className="deadline-label">
            Due {deadlineLabel(e.a).toLowerCase()}
          </span>
        )}
      </div>
      <p className="recommendation-reason">{e.reason}</p>
      <p className="detour-label">
        <Footprints size={14} />
        {e.t1 + e.t2} min walking ·{" "}
        {e.extraTravel <= 1
          ? "Little or no extra detour"
          : `+${e.extraTravel} min detour`}
      </p>
      {e.outsidePreferred && (
        <p className="muted small">Outside your preferred time window.</p>
      )}
      <div className="recommendation-actions">
        <Button
          variant="primary"
          size="small"
          onClick={onAdd}
          disabled={e.fit === "none"}
        >
          Add to gap
        </Button>
        <Button size="small" onClick={onDetails}>
          View details
          <ArrowRight size={13} />
        </Button>
        <Button size="small" onClick={onMap}>
          <MapPin size={13} />
          View on map
        </Button>
        <Button
          size="small"
          aria-label={`Dismiss ${e.a.title}`}
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </article>
  )
}
export function Confirmation({
  title,
  children,
  confirm = "Confirm",
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirm?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted">{children}</p>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirm}
        </Button>
      </div>
    </Sheet>
  )
}
export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Leaf size={23} />
      <h3>{title}</h3>
      {children}
    </div>
  )
}
export function CompletedLabel() {
  return (
    <span className="completed-label">
      <Check size={14} />
      Completed
    </span>
  )
}
