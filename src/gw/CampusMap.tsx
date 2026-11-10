import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react"
import {
  BookOpen,
  Check,
  Coffee,
  Dumbbell,
  Footprints,
  Layers,
  List,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Printer,
  SlidersHorizontal,
  Utensils,
  X,
} from "lucide-react"
import { type Commitment, type Eval, type Gap, categoryOf, fmt } from "./logic"
import {
  CAMPUS_BUILDINGS,
  CAMPUS_LABELS,
  CAMPUS_PLACES,
  CAMPUS_TREES,
  gapPoint,
  placePoint,
  routePath,
  type Point,
} from "./campus"
import { Button, Heading } from "./ui"
import { layoutMarkers, type MapMarker, type MapRect } from "./map-layout"

export type MapFilter = "all" | "study" | "food" | "move" | "errand" | "rest"

export const activityIcon = (id: string) =>
  ({
    print: Printer,
    study: BookOpen,
    lunch: Utensils,
    coffee: Coffee,
    workout: Dumbbell,
  })[id] ?? MapPin

export function matchesFilter(e: Eval, filter: MapFilter) {
  if (filter === "all") return true
  return categoryOf(e.a) === filter
}

const CampusScenery = memo(function CampusScenery() {
  return (
    <>
      <defs>
        <pattern
          id="campus-paper"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".55" className="map-paper-dot" />
        </pattern>
        <pattern
          id="campus-park"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <path d="M3 11l4-5m8 14 3-5" className="map-grass-mark" />
        </pattern>
      </defs>
      <rect
        x="-1500"
        y="-1500"
        width="4200"
        height="4200"
        className="map-ground"
      />
      <rect
        x="-1500"
        y="-1500"
        width="4200"
        height="4200"
        fill="url(#campus-paper)"
      />
      <path
        d="M272 130 879 72 941 873 292 936Z"
        className="map-campus-boundary"
      />
      <path d="M292 936 1250 843 1350 1500 230 1500Z" className="map-park" />
      <path
        d="M292 936 1250 843 1350 1500 230 1500Z"
        fill="url(#campus-park)"
      />
      <path
        d="M-300 180 1500 5M-300 413 1500 240M-300 690 1500 518M-300 985 1500 812M255-300 255 1500M936-300 936 1500M80-300 80 1500M1130-300 1130 1500"
        className="map-road-edge"
      />
      <path
        d="M-300 180 1500 5M-300 413 1500 240M-300 690 1500 518M-300 985 1500 812M255-300 255 1500M936-300 936 1500M80-300 80 1500M1130-300 1130 1500"
        className="map-road"
      />
      <path
        d="M-300 981 1500 808M-300 991 1500 818"
        className="map-streetcar-track"
      />
      {Array.from({ length: 12 }, (_, row) =>
        [120, 1004, 1176].map((x, col) => (
          <g
            key={`${row}-${col}`}
            transform={`translate(${x} ${row * 83 - 100}) rotate(-5)`}
          >
            <rect
              width={col === 1 ? 64 : 45}
              height="29"
              rx="3"
              className="map-neighborhood-building"
            />
            <rect
              x="12"
              y="35"
              width="34"
              height="24"
              rx="2"
              className="map-neighborhood-building"
            />
          </g>
        )),
      )}
      <path d="M328 405 559 405 559 475 328 475Z" className="map-quad" />
      <path d="M683 335 855 335 855 377 683 377Z" className="map-quad" />
      <path d="M573 672 701 672 701 774 573 774Z" className="map-quad" />
      <rect
        x="481"
        y="320"
        width="119"
        height="75"
        rx="15"
        className="map-quad"
      />
      <rect
        x="664"
        y="205"
        width="185"
        height="40"
        rx="6"
        className="map-field"
      />
      <path d="M677 212H836V238H677ZM756 212V238" className="map-field-line" />
      <path
        d="M638 123V841M332 450H862M332 523H862M521 681V843M347 724H843M344 811H856M393 305V609"
        className="map-walk-edge"
      />
      <path
        d="M638 123V841M332 450H862M332 523H862M521 681V843M347 724H843M344 811H856M393 305V609"
        className="map-walk"
      />
      <circle cx="638" cy="724" r="38" className="map-quad" />
      <path d="M611 699 665 750M611 750 665 699" className="map-walk" />
      {CAMPUS_BUILDINGS.map((b, i) => (
        <g key={i} transform={`rotate(-4 ${b.x + b.w / 2} ${b.y + b.h / 2})`}>
          <rect
            x={b.x + 4}
            y={b.y + 5}
            width={b.w}
            height={b.h}
            rx="4"
            className="map-building-shadow"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="4"
            className={`map-building map-building--${b.kind}`}
          />
          <rect
            x={b.x + 8}
            y={b.y + 8}
            width={b.w - 16}
            height={b.h - 16}
            rx="2"
            className="map-building-roof"
          />
          <path
            d={`M${b.x + 8} ${b.y + b.h / 2}H${b.x + b.w - 8}`}
            className="map-building-detail"
          />
          {b.kind === "main" && (
            <path
              d={`M${b.x + b.w / 2} ${b.y + 8}V${b.y + b.h - 8}`}
              className="map-building-detail"
            />
          )}
        </g>
      ))}
      {CAMPUS_TREES.map((t, i) => (
        <g key={i}>
          <circle
            cx={t.x + 2}
            cy={t.y + 3}
            r={i % 3 === 0 ? 10 : 8}
            className="map-tree-shadow"
          />
          <circle
            cx={t.x}
            cy={t.y}
            r={i % 3 === 0 ? 10 : 8}
            className={`map-tree map-tree--${i % 3}`}
          />
          <circle
            cx={t.x - 2}
            cy={t.y - 3}
            r="3"
            className="map-tree-highlight"
          />
        </g>
      ))}
      <g className="map-street-label">
        <text x="652" y="66" transform="rotate(-5.5 652 66)">
          S CLAIBORNE AVENUE
        </text>
        <text x="452" y="310" transform="rotate(-5.5 452 310)">
          WILLOW STREET
        </text>
        <text x="565" y="616" transform="rotate(-5.5 565 616)">
          FRERET STREET
        </text>
        <text x="644" y="907" transform="rotate(-5.5 644 907)">
          ST CHARLES AVENUE
        </text>
        <text x="239" y="590" transform="rotate(-90 239 590)">
          BROADWAY STREET
        </text>
        <text x="953" y="451" transform="rotate(-90 953 451)">
          CALHOUN STREET
        </text>
        <text
          x="625"
          y="383"
          transform="rotate(-90 625 383)"
          className="map-walk-label"
        >
          McALISTER WALK
        </text>
      </g>
      <g className="map-area-label">
        <text x="436" y="450">
          NEWCOMB QUAD
        </text>
        <text x="632" y="763">
          ACADEMIC QUAD
        </text>
        <text x="813" y="1022" className="map-park-label">
          AUDUBON PARK
        </text>
        <text x="62" y="766" transform="rotate(-90 62 766)">
          UPTOWN NEW ORLEANS
        </text>
      </g>
      {CAMPUS_LABELS.map((l) => (
        <text key={l.lines[0]} x={l.x} y={l.y} className="map-building-label">
          {l.lines.map((line, i) => (
            <tspan key={line} x={l.x} dy={i ? 30 : 0}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </>
  )
})

type Props = {
  commitments: Commitment[]
  gaps: Gap[]
  activeGap?: Gap
  fits: Eval[]
  selected?: Eval
  filter: MapFilter
  setFilter: (filter: MapFilter) => void
  onGap: (g: Gap) => void
  onCommitment: (c: Commitment) => void
  onActivity: (e: Eval) => void
  onAgenda: () => void
  onLocation?: (location: string) => void
  selectedLocation?: string
  routeEvaluations?: Eval[]
  instanceId?: string
}

export default function CampusMap({
  commitments,
  gaps,
  activeGap,
  fits,
  selected,
  filter,
  setFilter,
  onGap,
  onCommitment,
  onActivity,
  onAgenda,
  onLocation,
  selectedLocation,
  routeEvaluations,
  instanceId = "campus",
}: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1000, height: 800 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{
    x: number
    y: number
    pan: Point
    pointer: number
  } | null>(null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showActivities, setShowActivities] = useState(true)
  const [geometry, setGeometry] = useState<{
    obstacles: MapRect[]
    sizes: Record<string, Pick<MapRect, "width" | "height">>
  }>({ obstacles: [], sizes: {} })
  const geometrySignature = useRef("")

  useLayoutEffect(() => {
    const el = viewport.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const bounds = el.getBoundingClientRect()
    const obstacles = Array.from(
      parent.querySelectorAll<HTMLElement>(
        ".map-campus-title, .map-filters, .map-tools-top, .mobile-agenda-button, .map-controls, .map-gap-inspector, .map-legend",
      ),
    )
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => {
        const rect = node.getBoundingClientRect()
        return {
          x: Math.round((rect.x - bounds.x) * 10) / 10,
          y: Math.round((rect.y - bounds.y) * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        }
      })
      .filter((rect) => rect.y < bounds.height && rect.y + rect.height > 0)
    const sizes: Record<string, Pick<MapRect, "width" | "height">> = {}
    el.querySelectorAll<HTMLElement>("[data-map-marker]").forEach((node) => {
      const rect = node.getBoundingClientRect()
      sizes[node.dataset.mapMarker!] = {
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      }
    })
    const next = { obstacles, sizes }
    const signature = JSON.stringify(next)
    if (signature !== geometrySignature.current) {
      geometrySignature.current = signature
      setGeometry(next)
    }
  })

  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const compact = size.width < 640
  const topInset = compact ? 114 : 105
  const scale =
    Math.max(
      0.2,
      Math.min(
        size.width / 850,
        (size.height - topInset) / (compact ? 900 : 960),
      ),
    ) * zoom
  const centerX = 608
  const view = {
    x: centerX + pan.x - size.width / scale / 2,
    y: 489 + pan.y - topInset / scale / 2 - size.height / scale / 2,
    w: size.width / scale,
    h: size.height / scale,
  }
  const project = (point: Point, offset: Point = { x: 0, y: 0 }): Point => ({
    x: (point.x - view.x) * scale + offset.x,
    y: (point.y - view.y) * scale + offset.y,
  })
  const screenPosition = (point: Point): CSSProperties => ({
    transform: `translate(${point.x}px, ${point.y}px)`,
  })
  const position = (point: Point, offset: Point = { x: 0, y: 0 }) =>
    screenPosition(project(point, offset))
  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  const move = (next: Point) =>
    setPan({
      x: Math.max(-650, Math.min(650, next.x)),
      y: Math.max(-700, Math.min(700, next.y)),
    })
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const shownActivities = fits.filter((e) => matchesFilter(e, filter))
  const route = routeEvaluations?.length
    ? routeEvaluations
    : selected
      ? [selected]
      : []
  const routeStops = activeGap
    ? [
        activeGap.prev.location,
        ...route.map((e) => e.loc),
        activeGap.next.location,
      ]
    : []
  const routeD = routeStops
    .slice(1)
    .map((stop, i) => routePath(routeStops[i], stop))
    .join(" ")
  const makeMarker = (
    id: string,
    anchor: Point,
    offset: Point,
    isGap = false,
  ): MapMarker & { anchor: Point } => {
    const point = project(anchor, offset)
    if (isGap && zoom === 1 && pan.x === 0)
      point.x = Math.max(65, Math.min(size.width - 65, point.x))
    return {
      id,
      ...point,
      anchor,
      ...(geometry.sizes[id] ?? {
        width: isGap ? (compact ? 100 : 138) : 44,
        height: isGap ? (compact ? 48 : 60) : 44,
      }),
    }
  }
  const liveCommitments = commitments.filter((c) => !c.canceled)
  const commitmentMarkers = liveCommitments.map((c) => {
    const siblings = liveCommitments.filter(
      (item) => item.location === c.location,
    )
    return makeMarker(`commitment:${c.id}`, placePoint(c.location), {
      x: siblings.findIndex((item) => item.id === c.id) * (compact ? 38 : 49),
      y: 0,
    })
  })
  const activityMarkers = showActivities
    ? shownActivities.map((e) => {
        const siblings = shownActivities.filter((item) => item.loc === e.loc)
        return makeMarker(`activity:${e.a.id}`, placePoint(e.loc), {
          x:
            (e.loc === activeGap?.prev.location ? -52 : 0) +
            siblings.findIndex((item) => item.a.id === e.a.id) * 49,
          y: liveCommitments.some((c) => c.location === e.loc) ? -49 : 0,
        })
      })
    : []
  const gapMarkers = gaps.map((g, i) =>
    makeMarker(
      `gap:${g.key}`,
      gapPoint(g),
      {
        x: g.prev.location === g.next.location ? 145 : compact ? 105 : 120,
        y:
          g.prev.location === g.next.location
            ? compact
              ? 0
              : 20
            : i % 2
              ? compact
                ? -36
                : -12
              : 16,
      },
      true,
    ),
  )
  const locationMarkers = onLocation
    ? Object.entries(CAMPUS_PLACES).map(([name, point]) =>
        makeMarker(`place:${name}`, point, { x: 20, y: 22 }),
      )
    : []
  const markers = [
    ...commitmentMarkers,
    ...gapMarkers.filter((marker) => marker.id === `gap:${activeGap?.key}`),
    ...gapMarkers.filter((marker) => marker.id !== `gap:${activeGap?.key}`),
    ...activityMarkers.filter(
      (marker) => marker.id === `activity:${selected?.a.id}`,
    ),
    ...activityMarkers.filter(
      (marker) => marker.id !== `activity:${selected?.a.id}`,
    ),
    ...locationMarkers,
  ]
  const placed = layoutMarkers(markers, size, geometry.obstacles)
  const walkingLabel = activeGap
    ? {
        x: 638,
        y:
          (placePoint(selected?.loc ?? activeGap.prev.location).y +
            placePoint(activeGap.next.location).y) /
          2,
      }
    : null

  return (
    <>
      <div
        ref={viewport}
        className={`campus-viewport ${dragging ? "is-dragging" : ""}`}
        role="region"
        aria-label="Interactive Tulane campus map"
        aria-describedby={`${instanceId}-instructions`}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest("button"))
            return
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            pan,
            pointer: event.pointerId,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (!start || start.pointer !== event.pointerId) return
          if (
            Math.abs(event.clientX - start.x) +
              Math.abs(event.clientY - start.y) >
            4
          )
            setDragging(true)
          move({
            x: start.pan.x - (event.clientX - start.x) / scale,
            y: start.pan.y - (event.clientY - start.y) / scale,
          })
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const amount = 60 / scale
          const keys: Record<string, () => void> = {
            ArrowLeft: () => move({ x: pan.x - amount, y: pan.y }),
            ArrowRight: () => move({ x: pan.x + amount, y: pan.y }),
            ArrowUp: () => move({ x: pan.x, y: pan.y - amount }),
            ArrowDown: () => move({ x: pan.x, y: pan.y + amount }),
            "+": () => setZoom((z) => Math.min(1.8, z + 0.2)),
            "=": () => setZoom((z) => Math.min(1.8, z + 0.2)),
            "-": () => setZoom((z) => Math.max(0.7, z - 0.2)),
            Home: reset,
          }
          if (keys[event.key]) {
            event.preventDefault()
            keys[event.key]()
          }
        }}
      >
        <span className="sr-only" id={`${instanceId}-instructions`}>
          Drag to pan. Focus the map and use arrow keys to pan, plus and minus
          to zoom, or Home to recenter. Select a numbered commitment, a green
          usable-time gap, or a gold activity spot. Positions and routes are
          illustrative, not live navigation.
        </span>
        <svg
          className="campus-svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          aria-hidden="true"
        >
          <CampusScenery />
          {showRoutes &&
            gaps
              .filter((g) => g.key !== activeGap?.key)
              .map((g) => (
                <path
                  key={g.key}
                  d={routePath(g.prev.location, g.next.location)}
                  className="map-other-route"
                />
              ))}
          {showRoutes && activeGap && (
            <>
              <path d={routeD} className="map-route-halo" />
              {route.length ? (
                <>
                  {routeStops.slice(1).map((stop, i) => (
                    <path
                      key={i}
                      d={routePath(routeStops[i], stop)}
                      className={`map-route ${
                        i === routeStops.length - 2
                          ? "map-route--next"
                          : "map-route--detour"
                      }`}
                    />
                  ))}
                </>
              ) : (
                <path
                  d={routePath(
                    activeGap.prev.location,
                    activeGap.next.location,
                  )}
                  className="map-route map-route--next"
                />
              )}
            </>
          )}
          {markers
            .filter(
              (marker) =>
                Math.hypot(
                  placed[marker.id].x - marker.x,
                  placed[marker.id].y - marker.y,
                ) > 12,
            )
            .map((marker) => {
              const end = placed[marker.id]
              return (
                <path
                  key={marker.id}
                  d={`M ${marker.anchor.x} ${marker.anchor.y} L ${view.x + end.x / scale} ${view.y + end.y / scale}`}
                  className="map-pin-leader"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
        </svg>
        {onLocation &&
          Object.keys(CAMPUS_PLACES).map((name) => (
            <div
              key={name}
              className="map-marker-position map-place-position"
              style={screenPosition(placed[`place:${name}`])}
            >
              <Button
                className={`map-place-pin ${
                  selectedLocation === name ? "is-selected" : ""
                }`}
                aria-label={`Explore ${name}`}
                aria-pressed={selectedLocation === name}
                title={name}
                data-map-marker={`place:${name}`}
                onClick={() => onLocation(name)}
              >
                <MapPin size={15} />
              </Button>
            </div>
          ))}
        {commitments
          .filter((c) => !c.canceled)
          .map((c) => {
            const isStart = c.id === activeGap?.prev.id
            const isNext = c.id === activeGap?.next.id
            const number = commitments.findIndex((item) => item.id === c.id) + 1
            return (
              <div
                className="map-marker-position"
                key={c.id}
                style={screenPosition(placed[`commitment:${c.id}`])}
              >
                <Button
                  className={`map-commitment-pin ${isStart ? "is-start" : ""} ${
                    isNext ? "is-next" : ""
                  }`}
                  aria-label={`Edit ${c.title}, ${fmt(c.start)}, ${c.location}`}
                  title={`${c.title} · ${fmt(c.start)} · ${c.location}`}
                  data-map-marker={`commitment:${c.id}`}
                  onClick={() => onCommitment(c)}
                >
                  <span className="commitment-pin-number">{number}</span>
                  {(isStart || isNext) && (
                    <span className="commitment-pin-caption">
                      {isStart ? "From here" : "Up next"}
                    </span>
                  )}
                </Button>
              </div>
            )
          })}
        {showActivities &&
          shownActivities.map((e) => {
            const Icon = activityIcon(e.a.id)
            return (
              <div
                className="map-marker-position map-activity-position"
                key={e.a.id}
                style={screenPosition(placed[`activity:${e.a.id}`])}
              >
                <Button
                  className={`map-activity-pin ${
                    selected?.a.id === e.a.id ? "is-selected" : ""
                  }`}
                  onClick={() => onActivity(e)}
                  aria-pressed={selected?.a.id === e.a.id}
                  aria-label={`Preview ${e.a.title} at ${e.loc}, ${e.a.duration} minutes`}
                  title={`${e.a.title} · ${e.loc}`}
                  data-map-marker={`activity:${e.a.id}`}
                >
                  <span className="activity-pin-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  {selected?.a.id === e.a.id && (
                    <span className="activity-pin-caption">
                      {e.a.title}
                      <span>{e.a.duration} min stop</span>
                    </span>
                  )}
                </Button>
              </div>
            )
          })}
        {gaps.map((g) => {
          const active = g.key === activeGap?.key
          const usable = Math.max(0, active ? activeGap!.usable : g.usable)
          return (
            <div
              className={`map-marker-position map-gap-position ${
                active ? "is-active" : ""
              }`}
              key={g.key}
              style={screenPosition(placed[`gap:${g.key}`])}
            >
              <Button
                className={`map-gap-pin ${active ? "is-selected" : ""} ${
                  usable < 10 ? "is-short" : ""
                }`}
                onClick={() => onGap(g)}
                aria-pressed={active}
                aria-label={`Select gap ${fmt(g.start)} to ${fmt(g.end)}, ${usable} usable minutes`}
                data-map-marker={`gap:${g.key}`}
              >
                <span className="gap-pin-glyph">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{usable} min</strong>
                  <span className="gap-pin-subtitle">usable time</span>
                </span>
              </Button>
            </div>
          )
        })}
        {showRoutes && activeGap && walkingLabel && (
          <div
            className="map-marker-position map-walk-position"
            style={position(walkingLabel, { x: 0, y: compact ? -20 : -24 })}
          >
            <span className="map-walk-estimate">
              <Footprints size={12} />
              {route.length
                ? route.reduce((sum, e) => sum + e.t1, 0) +
                  route[route.length - 1].t2
                : activeGap.travel}{" "}
              min full-route walk
            </span>
          </div>
        )}
      </div>

      <div className="map-topline">
        <div className="map-campus-title">
          <span className="map-location-mark">
            <MapPin size={19} />
          </span>
          <div>
            <Heading as="h2">Tulane campus</Heading>
            <span>UPTOWN · NEW ORLEANS</span>
          </div>
        </div>
        <Button
          size="small"
          className="mobile-agenda-button"
          onClick={onAgenda}
        >
          <List size={16} />
          Your day
        </Button>
        <div className="map-tools-top">
          <div className="map-north" aria-label="North">
            <span>N</span>
            <NavigationArrow />
          </div>
          <Button
            size="icon"
            className="map-tool-button"
            aria-label="Map layers"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen(!layersOpen)}
          >
            {layersOpen ? <X size={18} /> : <Layers size={18} />}
          </Button>
        </div>
      </div>
      <div className="map-filters" aria-label="Filter activity spots">
        {([
          ["all", "Everything", SlidersHorizontal],
          ["study", "Study", BookOpen],
          ["food", "Food & coffee", Coffee],
          ["move", "Move", Dumbbell],
          ["errand", "Errands", Printer],
          ["rest", "Rest", Coffee],
        ] as const).map(([key, label, Icon]) => (
          <Button
            key={key}
            size="small"
            className={`map-filter ${filter === key ? "is-active" : ""}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            <Icon size={14} />
            {label}
          </Button>
        ))}
      </div>
      {layersOpen && (
        <div className="map-layer-popover anim-fade">
          <span className="eyebrow">Map layers</span>
          <Button
            size="small"
            aria-pressed={showActivities}
            onClick={() => setShowActivities(!showActivities)}
          >
            <span
              className={`layer-checkbox ${showActivities ? "is-checked" : ""}`}
            >
              {showActivities && <Check size={12} />}
            </span>
            Activity spots
          </Button>
          <Button
            size="small"
            aria-pressed={showRoutes}
            onClick={() => setShowRoutes(!showRoutes)}
          >
            <span
              className={`layer-checkbox ${showRoutes ? "is-checked" : ""}`}
            >
              {showRoutes && <Check size={12} />}
            </span>
            Walking routes
          </Button>
        </div>
      )}
      <div className="map-controls">
        <div className="map-zoom-controls">
          <Button
            size="icon"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
            disabled={zoom >= 1.8}
          >
            <Plus size={19} />
          </Button>
          <Button
            size="icon"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
            disabled={zoom <= 0.7}
          >
            <Minus size={19} />
          </Button>
        </div>
        <Button
          size="icon"
          className="map-recenter-button"
          aria-label="Recenter Tulane campus"
          title="Recenter campus"
          onClick={reset}
        >
          <LocateFixed size={20} />
        </Button>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-dot legend-dot--commitment" />
          Commitment
        </span>
        <span>
          <i className="legend-dot legend-dot--gap" />
          Usable gap
        </span>
        <span>
          <i className="legend-dot legend-dot--activity" />
          Activity
        </span>
      </div>
      <div className="map-disclaimer">
        Schematic campus · walking estimates, not live navigation
      </div>
    </>
  )
}

function NavigationArrow() {
  return (
    <svg viewBox="0 0 24 28" width="19" height="22" aria-hidden="true">
      <path d="m12 1 9 25-9-6-9 6Z" className="compass-arrow" />
      <path d="M12 1v19l9 6Z" className="compass-arrow-light" />
    </svg>
  )
}
