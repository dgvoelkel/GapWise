import placesJson from "../data/places.json" with { type: "json" }
import routesRaw from "../data/routes.geojson?raw"

/** Real coordinates and walking-route geometry built by `make geodata`. */
export type LngLat = [number, number]
type RouteFeature = {
  type: "Feature"
  geometry: { type: "LineString"; coordinates: LngLat[] }
  properties: { from: string; to: string; minutes: number; meters: number }
}
const ROUTES = (JSON.parse(routesRaw) as { features: RouteFeature[] }).features
const PLACE_COORDS: Record<string, LngLat> = Object.fromEntries(
  (placesJson as { name: string; lat: number; lng: number }[]).map((p) => [
    p.name,
    [p.lng, p.lat] as LngLat,
  ]),
)

export const placeCoord = (name: string): LngLat | undefined =>
  PLACE_COORDS[name]

/** Walking path between two places, oriented from `a` to `b`. */
export function routeCoords(a: string, b: string): LngLat[] {
  const from = placeCoord(a),
    to = placeCoord(b)
  if (!from || !to) return []
  if (a === b) return [from]
  const feature = ROUTES.find(
    (f) =>
      (f.properties.from === a && f.properties.to === b) ||
      (f.properties.from === b && f.properties.to === a),
  )
  if (!feature) return [from, to]
  const coords = feature.geometry.coordinates
  return feature.properties.from === a ? coords : [...coords].reverse()
}

export type Bounds = [LngLat, LngLat]
export function boundsOf(points: LngLat[]): Bounds | undefined {
  if (!points.length) return undefined
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
/** Every place on campus. */
export const CAMPUS_BOUNDS = boundsOf(Object.values(PLACE_COORDS))!
const center: LngLat = [
  (CAMPUS_BOUNDS[0][0] + CAMPUS_BOUNDS[1][0]) / 2,
  (CAMPUS_BOUNDS[0][1] + CAMPUS_BOUNDS[1][1]) / 2,
]
/** Roughly 1.5 km around campus so the map can't be panned away. */
export const MAX_BOUNDS: Bounds = [
  [center[0] - 0.0165, center[1] - 0.0145],
  [center[0] + 0.0165, center[1] + 0.0145],
]
