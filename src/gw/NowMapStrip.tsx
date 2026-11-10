import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, Flag, Footprints, LocateFixed } from "lucide-react"
import { type Eval, type Gap, type Sequence } from "./logic"
import { CAMPUS_BUILDINGS, placePoint, routePath } from "./campus"
import { layoutMarkers } from "./map-layout"
import { Button } from "./ui"

type Props = {
  gap: Gap
  evaluations: Eval[]
  selectedId?: string
  sequence?: Sequence
  upcoming?: boolean
  onSelect: (id: string, location?: string) => void
  onMap: (gap: Gap, id?: string, location?: string) => void
}

export default function NowMapStrip({
  gap,
  evaluations,
  selectedId,
  sequence,
  upcoming = false,
  onSelect,
  onMap,
}: Props) {
  const canvas = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 132 })
  useEffect(() => {
    const element = canvas.current!
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const options = evaluations
    .map((e, index) => ({ e, number: index + 1 }))
    .filter(({ e }, index) => index < 3 || e.a.id === selectedId)
  const selected =
    options.find(({ e }) => e.a.id === selectedId)?.e ?? options[0]?.e
  const route = sequence?.evaluations ?? (selected ? [selected] : [])
  const stops = [
    gap.prev.location,
    ...route.map((e) => e.loc),
    gap.next.location,
  ]
  const points = [
    placePoint(gap.prev.location),
    placePoint(gap.next.location),
    ...options.map(({ e }) => placePoint(e.loc)),
    ...route.map((e) => placePoint(e.loc)),
  ]
  const minX = Math.min(638, ...points.map((p) => p.x))
  const maxX = Math.max(638, ...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))
  const scale = Math.min(
    Math.max(1, size.width) / (maxX - minX + 190),
    Math.max(1, size.height) / (maxY - minY + 170),
  )
  const width = Math.max(1, size.width) / scale
  const height = Math.max(1, size.height) / scale
  const left = (minX + maxX - width) / 2
  const top = (minY + maxY - height) / 2
  const project = (location: string) => {
    const p = placePoint(location)
    return { x: (p.x - left) * scale, y: (p.y - top) * scale }
  }
  const anchors = [
    { id: "start", location: gap.prev.location },
    { id: "next", location: gap.next.location },
    ...options.map(({ e }) => ({ id: e.a.id, location: e.loc })),
  ].map((item) => ({
    ...item,
    ...project(item.location),
    width: 44,
    height: 44,
  }))
  const positions = layoutMarkers(anchors, size, [])
  const walking =
    sequence?.walking ?? (selected ? selected.t1 + selected.t2 : gap.travel)
  const extra = sequence?.extraTravel ?? selected?.extraTravel ?? 0
  const startLabel = upcoming ? "Gap starts" : "Your location"

  return (
    <section
      className="now-map-strip"
      aria-label="Suggestions along your route"
    >
      <header className="now-strip-heading">
        <span>
          {sequence ? "Your planned route" : "Suggestions on your way"}
        </span>
        <Button
          size="small"
          onClick={() => onMap(gap, selected?.a.id, selected?.loc)}
        >
          Open full map
          <ArrowUpRight size={14} />
        </Button>
      </header>
      <div className="now-strip-canvas" ref={canvas}>
        <svg
          viewBox={`${left} ${top} ${width} ${height}`}
          className="now-strip-geography"
          aria-hidden="true"
        >
          <path
            d={`M 638 ${top} V ${top + height}`}
            className="now-strip-walkway"
          />
          {CAMPUS_BUILDINGS.map((building, i) => (
            <rect
              key={i}
              x={building.x}
              y={building.y}
              width={building.w}
              height={building.h}
              rx={3}
              className="now-strip-building"
            />
          ))}
          <path
            d={routePath(gap.prev.location, gap.next.location)}
            className="now-strip-direct"
          />
          {route.length > 0 &&
            stops
              .slice(1)
              .map((stop, i) => (
                <path
                  key={i}
                  d={routePath(stops[i], stop)}
                  className={`now-strip-route ${
                    i === stops.length - 2 ? "is-next" : "is-detour"
                  }`}
                />
              ))}
        </svg>
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          className="now-strip-leaders"
          aria-hidden="true"
        >
          {anchors.map((anchor) => (
            <line
              key={anchor.id}
              x1={anchor.x}
              y1={anchor.y}
              x2={positions[anchor.id].x}
              y2={positions[anchor.id].y}
            />
          ))}
        </svg>
        {anchors.slice(0, 2).map((anchor, index) => {
          const Icon = index === 0 ? LocateFixed : Flag
          return (
            <span
              key={anchor.id}
              className={`now-strip-marker now-strip-endpoint ${
                index === 0 ? "is-location" : "is-next"
              }`}
              style={{
                left: positions[anchor.id].x,
                top: positions[anchor.id].y,
              }}
              role="img"
              aria-label={`${
                index === 0 ? startLabel : "Next commitment"
              }: ${anchor.location}`}
              title={`${
                index === 0 ? startLabel : gap.next.title
              } · ${anchor.location}`}
            >
              <Icon size={17} aria-hidden="true" />
            </span>
          )
        })}
        {options.map(({ e, number }) => (
          <Button
            key={e.a.id}
            className={`now-strip-marker now-strip-pin ${
              selected?.a.id === e.a.id ? "is-selected" : ""
            }`}
            style={{
              left: positions[e.a.id].x,
              top: positions[e.a.id].y,
            }}
            aria-label={`Suggestion ${number}: ${e.a.title}, ${e.loc}, ${
              e.t1 + e.t2
            } minutes total walking, ${e.extraTravel} minutes extra detour`}
            aria-pressed={selected?.a.id === e.a.id}
            title={`${e.a.title} · ${e.loc} · +${e.extraTravel} min detour`}
            onClick={() => onSelect(e.a.id, e.loc)}
          >
            {number}
          </Button>
        ))}
        <span className="now-strip-note">Schematic routes</span>
      </div>
      <div className="now-strip-key">
        <span>
          <LocateFixed size={13} />
          {upcoming ? "Gap starts" : "You"} · {gap.prev.location}
        </span>
        <span>
          <Flag size={13} />
          Next · {gap.next.location}
        </span>
      </div>
      <div className="now-strip-comparison" aria-live="polite">
        <span>
          {sequence
            ? "Planned route"
            : (selected?.a.title ?? "Direct to next commitment")}
        </span>
        <span>
          <Footprints size={14} />
          {walking} min total walk
          <b>+{extra} min detour</b>
        </span>
      </div>
    </section>
  )
}
