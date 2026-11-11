import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Flag, LocateFixed, MapPin as MapPinIcon } from "lucide-react"
import {
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl"
// Vite bundles the map worker as its own file; maplibre is told where it lives.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

setWorkerUrl(workerUrl)
import {
  type Bounds,
  type LngLat,
  CAMPUS_BOUNDS,
  MAX_BOUNDS,
  boundsOf,
  placeCoord,
  routeCoords,
} from "./geo"

/**
 * One real-map wrapper used in two modes (BUILD.md Phase 5):
 * the interactive Map tab, and small non-interactive tiles (Right Now strip,
 * activity route preview). Tiles come from OpenFreeMap; no key, no account.
 */
const STYLES = [
  "https://tiles.openfreemap.org/styles/liberty",
  "https://tiles.openfreemap.org/styles/positron",
  "https://tiles.openfreemap.org/styles/bright",
]
const ROUTE_SOURCE = "gw-route"

export type MapLeg = {
  from: string
  to: string
  /** Dashed: part of a detour away from the direct walk. */
  detour?: boolean
}
export type MapPin = {
  id: string
  place: string
  /** Accessible name; also the tooltip. */
  label: string
  kind: "start" | "next" | "option" | "place"
  number?: number
  selected?: boolean
  icon?: ReactNode
}
type Props = {
  interactive?: boolean
  /** What to frame on load / when the inputs change. */
  fit?: "campus" | "content"
  legs?: MapLeg[]
  pins?: MapPin[]
  /** Click on a pin (option or place). Omit for a non-interactive tile. */
  onPin?: (pin: MapPin) => void
  /** Tap anywhere on a non-interactive tile (e.g. open the full map). */
  onTap?: () => void
  tapLabel?: string
  className?: string
  /** Shown in place of the map when tiles can't load. */
  fallback?: ReactNode
  /** Padding used when framing content. */
  padding?: number
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

function legsToGeoJSON(legs: MapLeg[]) {
  return {
    type: "FeatureCollection" as const,
    features: legs
      .map((leg) => ({
        type: "Feature" as const,
        properties: { detour: !!leg.detour },
        geometry: {
          type: "LineString" as const,
          coordinates: routeCoords(leg.from, leg.to),
        },
      }))
      .filter((f) => f.geometry.coordinates.length > 1),
  }
}

export default function CampusMapGL({
  interactive = false,
  fit = "content",
  legs = [],
  pins = [],
  onPin,
  onTap,
  tapLabel = "Open full map",
  className = "",
  fallback = "Map couldn’t load. Walking times still work.",
  padding,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const styleIndex = useRef(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [markerHosts, setMarkerHosts] = useState<Record<string, HTMLElement>>(
    {},
  )
  const markers = useRef<Record<string, Marker>>({})

  // Mount once.
  useEffect(() => {
    const el = container.current
    if (!el) return
    let disposed = false
    let m: MapLibreMap
    try {
      m = new MapLibreMap({
        container: el,
        style: STYLES[0],
        bounds: CAMPUS_BOUNDS,
        fitBoundsOptions: { padding: 48 },
        maxBounds: MAX_BOUNDS,
        minZoom: 13.5,
        maxZoom: 19,
        interactive,
        attributionControl: { compact: !interactive },
        fadeDuration: 0,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
      })
    } catch {
      // WebGL unavailable (very old browser, or a headless run without GPU).
      setFailed(true)
      return
    }
    m.getCanvas().setAttribute("aria-hidden", "true")
    m.getCanvas().tabIndex = -1
    m.on("error", (event) => {
      if (disposed) return
      const message = String(event?.error?.message ?? "")
      // Only a style that never loaded is fatal; a single missing tile or icon is not.
      if (m.isStyleLoaded()) return
      if (/sprite|glyph|image/i.test(message)) return
      styleIndex.current += 1
      if (styleIndex.current < STYLES.length) m.setStyle(STYLES[styleIndex.current])
      else setFailed(true)
    })
    m.on("load", () => {
      if (disposed) return
      setReady(true)
    })
    if (!interactive) {
      m.getContainer().classList.add("is-static")
    }
    map.current = m
    return () => {
      disposed = true
      Object.values(markers.current).forEach((marker) => marker.remove())
      markers.current = {}
      m.remove()
      map.current = null
    }
  }, [interactive])

  // Route layers: (re)added whenever the style (re)loads or the legs change.
  const routeData = useMemo(() => legsToGeoJSON(legs), [legs])
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const apply = () => {
      if (!m.getStyle()) return
      const existing = m.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(routeData)
        return
      }
      m.addSource(ROUTE_SOURCE, { type: "geojson", data: routeData })
      const teal = getComputedStyle(document.documentElement)
        .getPropertyValue("--gw-teal")
        .trim() || "#5f9e95"
      m.addLayer({
        id: `${ROUTE_SOURCE}-halo`,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
      })
      m.addLayer({
        id: `${ROUTE_SOURCE}-direct`,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["!=", ["get", "detour"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": teal, "line-width": 4 },
      })
      m.addLayer({
        id: `${ROUTE_SOURCE}-detour`,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "detour"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": teal, "line-width": 4, "line-dasharray": [1.5, 2] },
      })
    }
    if (m.isStyleLoaded()) apply()
    m.on("style.load", apply)
    return () => {
      m.off("style.load", apply)
    }
  }, [routeData, ready])

  // HTML markers, rendered through portals so pins can use React and icons.
  const pinKey = pins.map((p) => `${p.id}:${p.place}`).join("|")
  useEffect(() => {
    const m = map.current
    if (!m) return
    const next: Record<string, HTMLElement> = {}
    const seen = new Set<string>()
    // Pins that share a building fan out sideways so none hides another.
    const perPlace: Record<string, MapPin[]> = {}
    for (const pin of pins) (perPlace[pin.place] ??= []).push(pin)
    for (const pin of pins) {
      const coord = placeCoord(pin.place)
      if (!coord) continue
      seen.add(pin.id)
      const group = perPlace[pin.place]
      const index = group.indexOf(pin)
      const spread = group.length > 1 ? 38 : 0
      const offset: [number, number] = [
        (index - (group.length - 1) / 2) * spread,
        group.length > 2 ? (index % 2 ? -14 : 0) : 0,
      ]
      let marker = markers.current[pin.id]
      if (!marker) {
        const host = document.createElement("div")
        host.className = "gw-marker-host"
        marker = new Marker({ element: host, anchor: "center", offset })
          .setLngLat(coord)
          .addTo(m)
        markers.current[pin.id] = marker
      } else {
        marker.setLngLat(coord).setOffset(offset)
      }
      next[pin.id] = marker.getElement()
    }
    for (const id of Object.keys(markers.current)) {
      if (!seen.has(id)) {
        markers.current[id].remove()
        delete markers.current[id]
      }
    }
    setMarkerHosts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, ready])

  // Framing.
  const contentKey = `${fit}|${pinKey}|${legs.map((l) => `${l.from}>${l.to}`).join("|")}`
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    let bounds: Bounds | undefined = CAMPUS_BOUNDS
    if (fit === "content") {
      const points: LngLat[] = []
      for (const pin of pins) {
        const c = placeCoord(pin.place)
        if (c) points.push(c)
      }
      for (const leg of legs) points.push(...routeCoords(leg.from, leg.to))
      bounds = boundsOf(points) ?? CAMPUS_BOUNDS
    }
    const pad = padding ?? (interactive ? 48 : 28)
    m.fitBounds(bounds, {
      padding: interactive
        ? pad
        : { top: pad, bottom: pad, left: pad + 24, right: pad + 24 },
      maxZoom: fit === "content" ? 17.4 : 16.5,
      duration: reducedMotion() ? 0 : 450,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, ready])

  // Keep the canvas sized to its container.
  useEffect(() => {
    const el = container.current
    const m = map.current
    if (!el || !m) return
    const observer = new ResizeObserver(() => m.resize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [ready])

  return (
    <div
      className={`campus-map-gl ${interactive ? "is-interactive" : "is-static"} ${
        failed ? "has-failed" : ""
      } ${className}`}
    >
      {!failed && <div ref={container} className="campus-map-gl-canvas" />}
      {failed && (
        <div className="campus-map-fallback" role="status">
          <MapPinIcon size={18} />
          <span>{fallback}</span>
        </div>
      )}
      {!failed && !ready && (
        <div className="campus-map-loading" aria-hidden="true">
          Loading map…
        </div>
      )}
      {onTap && !failed && (
        <button
          type="button"
          className="campus-map-tap"
          aria-label={tapLabel}
          onClick={onTap}
        />
      )}
      {pins.map((pin) => {
        const host = markerHosts[pin.id]
        if (!host) return null
        return createPortal(<Pin key={pin.id} pin={pin} onPin={onPin} />, host)
      })}
    </div>
  )
}

function Pin({ pin, onPin }: { pin: MapPin; onPin?: (pin: MapPin) => void }) {
  const className = `gw-pin gw-pin--${pin.kind} ${pin.selected ? "is-selected" : ""}`
  const content =
    pin.kind === "start" ? (
      <LocateFixed size={16} aria-hidden="true" />
    ) : pin.kind === "next" ? (
      <Flag size={15} aria-hidden="true" />
    ) : pin.kind === "option" ? (
      pin.icon ?? pin.number
    ) : (
      <MapPinIcon size={13} aria-hidden="true" />
    )
  if (onPin && (pin.kind === "option" || pin.kind === "place"))
    return (
      <button
        type="button"
        className={className}
        aria-label={pin.label}
        aria-pressed={pin.selected}
        title={pin.label}
        onClick={() => onPin(pin)}
      >
        {content}
        {pin.kind === "option" && pin.number != null && pin.icon && (
          <span className="gw-pin-number">{pin.number}</span>
        )}
      </button>
    )
  return (
    <span className={className} role="img" aria-label={pin.label} title={pin.label}>
      {content}
      {pin.kind === "option" && pin.number != null && pin.icon && (
        <span className="gw-pin-number">{pin.number}</span>
      )}
    </span>
  )
}

/** Legs for "from → (activity stops) → next", with detour legs marked. */
export function routeLegs(
  from: string,
  stops: string[],
  next: string,
): MapLeg[] {
  const path = [from, ...stops, next]
  const legs: MapLeg[] = []
  if (stops.length) {
    for (let i = 0; i < path.length - 1; i++)
      legs.push({ from: path[i], to: path[i + 1], detour: true })
  }
  legs.push({ from, to: next })
  return legs
}

export type { StyleSpecification }
