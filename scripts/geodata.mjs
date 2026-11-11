#!/usr/bin/env node
// Builds src/gw/data/{places.json, walking.json, routes.geojson} from public
// OpenStreetMap services (BUILD.md Phase 2). Run through `make geodata`.
//
//   node scripts/geodata.mjs --only=all|places|walking
//
// Nothing here runs at app runtime; the app only reads the committed files.
// Requests carry a generic User-Agent and no personal data.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DATA_DIR = path.join(ROOT, "src", "gw", "data")
const PLACES_FILE = path.join(DATA_DIR, "places.json")
const WALKING_FILE = path.join(DATA_DIR, "walking.json")
const ROUTES_FILE = path.join(DATA_DIR, "routes.geojson")

const USER_AGENT = "GapWise-HCI-prototype"
const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]
const OSRM = "https://routing.openstreetmap.de/routed-foot"
const MIN_GAP_MS = 1100 // ≥ 1 request per second for every public service
const MAX_FROM_GIBSON_M = 1500
const MIN_MINUTES = 2 // matches the old travel(): any non-identical pair is ≥ 2 min
const WALK_M_PER_MIN = 80
const DETOUR_FACTOR = 1.35

// Tulane's uptown campus. Nominatim queries are bounded to this box.
const CAMPUS_VIEWBOX = "-90.1400,29.9500,-90.1050,29.9200"
const GIBSON_FALLBACK = { lat: 29.9354028, lng: -90.1227531 }

/**
 * Display name → how to find it. `queries` are tried in order on Nominatim.
 * `overpass` is a fallback Overpass QL selector (centered on `near`) for things
 * Nominatim doesn't index well. `placeholder` is a last-resort coordinate that
 * is written with verified:false so Davis can correct it at Checkpoint A.
 */
const PLACES = [
  { name: "Gibson Hall", short: "Gibson", queries: ["Gibson Hall, Tulane University", "Gibson Hall"] },
  { name: "Dinwiddie Hall", short: "Dinwiddie", queries: ["Dinwiddie Hall, Tulane University", "Dinwiddie Hall"] },
  { name: "Newcomb Hall", short: "Newcomb", queries: ["Newcomb Hall, Tulane University", "Newcomb Hall"] },
  { name: "LBC", short: "LBC", queries: ["Lavin-Bernick Center, Tulane University", "Lavin-Bernick Center"] },
  { name: "The Commons", short: "Commons", queries: ["The Commons dining hall, Tulane University", "The Commons"], unsure: true },
  { name: "Howard-Tilton Library", short: "Library", queries: ["Howard-Tilton Memorial Library, Tulane", "Howard-Tilton Memorial Library"] },
  { name: "Reily Rec Center", short: "Reily", queries: ["Reily Student Recreation Center, Tulane", "Reily Student Recreation Center"] },
  { name: "Richardson Memorial", short: "Richardson Mem.", queries: ["Richardson Memorial Hall, Tulane", "Richardson Memorial Hall"] },
  { name: "Stanley Thomas Hall", short: "Stanley Thomas", queries: ["Stanley Thomas Hall, Tulane", "Stanley Thomas Hall"] },
  {
    name: "Goldring/Woldenberg",
    short: "Business School",
    queries: [
      "Goldring/Woldenberg Business Complex (Freeman School of Business), Tulane",
      "Goldring/Woldenberg Hall, Tulane",
      "Goldring/Woldenberg",
    ],
  },
  { name: "Boggs Center", short: "Boggs", queries: ["Boggs Center for Energy and Biotechnology, Tulane", "Boggs Center"] },
  { name: "Tilton Memorial Hall", short: "Tilton Hall", queries: ["Tilton Memorial Hall, Tulane", "Tilton Memorial Hall"], mustNotMatch: /library/i },
  { name: "Richardson Building", short: "Richardson Bldg", queries: ["Richardson Building, Tulane", "Richardson Building"], mustNotMatch: /memorial|caroline/i, unsure: true },
  { name: "Wilson Center", short: "Wilson", queries: ["Wilson Center, Tulane Athletics", "Wilson Athletic Center", "Wilson Center"] },
  {
    name: "Goldring Tennis Center",
    short: "Tennis",
    queries: ["Goldring Tennis Center, Tulane", "Goldring Tennis Center", "Tennis Center, Tulane"],
    overpass: { selector: 'nwr["sport"="tennis"]', near: { lat: 29.9435, lng: -90.1167 }, radius: 1200 },
    unsure: true,
  },
  {
    name: "PJ's Coffee",
    short: "PJ's",
    queries: ["PJ's Coffee, Tulane University", "PJ's Coffee"],
    // The on-campus PJ's nearest LBC (Nominatim returns the Magazine St. shop first, which is off campus).
    overpass: { selector: 'nwr["name"~"PJ",i]', near: { lat: 29.93971, lng: -90.12033 }, radius: 600 },
    unsure: true,
  },
  {
    name: "Shuttle stop",
    short: "Shuttle",
    queries: ["Tulane shuttle stop, Tulane University"],
    overpass: { selector: 'node["highway"="bus_stop"]', near: { lat: 29.93971, lng: -90.12033 }, radius: 400 },
    // OSM has no shuttle stop near LBC; this sits on McAlister Place in front of the LBC. Davis picks the real stop.
    placeholder: { lat: 29.93995, lng: -90.11975 },
    unsure: true,
  },
]

const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "--only=all").slice("--only=".length)
if (!["all", "places", "walking"].includes(only)) {
  console.error(`Unknown --only=${only}. Use all, places, or walking.`)
  process.exit(1)
}

let lastRequest = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function throttled(url, init = {}, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequest = Date.now()
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(init.headers ?? {}) },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
      return await res.json()
    } catch (e) {
      lastError = e
      if (attempt < attempts) await sleep(2000 * attempt)
    }
  }
  throw lastError
}

const toRad = (d) => (d * Math.PI) / 180
function haversineMeters(a, b) {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function nominatim(query) {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "5",
    viewbox: CAMPUS_VIEWBOX,
    bounded: "1",
    q: query,
  })
  const rows = await throttled(`${NOMINATIM}?${params}`)
  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    source: "Nominatim",
  }))
}

async function overpass({ selector, near, radius }) {
  const data = `[out:json][timeout:25];(${selector}(around:${radius},${near.lat},${near.lng}););out center tags;`
  let json, lastError
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      json = await throttled(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data }).toString(),
      })
      break
    } catch (e) {
      lastError = e
      console.warn(`! Overpass ${mirror}: ${e.message}`)
    }
  }
  if (!json) throw lastError
  const rows = (json.elements ?? [])
    .map((e) => {
      const c = e.center ?? e
      return {
        lat: c.lat,
        lng: c.lon,
        label: `${e.tags?.name ?? "(unnamed)"} [osm ${e.type}/${e.id}]`,
        source: "Overpass",
        distance: haversineMeters(c, { lat: near.lat, lng: near.lng }),
      }
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .sort((a, b) => a.distance - b.distance)
  return rows
}

async function geocodeAll(existing) {
  const out = []
  let gibson = GIBSON_FALLBACK
  const withinCampus = (r) => haversineMeters(r, gibson) <= MAX_FROM_GIBSON_M
  for (const place of PLACES) {
    const kept = existing?.find((p) => p.name === place.name && p.source === "Davis")
    if (kept) {
      console.log(`✓ ${place.name}: keeping Davis's pin (${kept.lat}, ${kept.lng})`)
      out.push(kept)
      if (place.name === "Gibson Hall") gibson = kept
      continue
    }
    let found = null
    for (const q of place.queries) {
      const rows = (await nominatim(q)).filter(
        (r) => withinCampus(r) && !(place.mustNotMatch && place.mustNotMatch.test(r.label)),
      )
      if (rows.length) {
        found = { ...rows[0], query: q }
        break
      }
    }
    if (!found && place.overpass) {
      const rows = (await overpass(place.overpass)).filter(withinCampus)
      if (rows.length) found = { ...rows[0], query: place.overpass.selector }
    }
    if (!found && place.placeholder) {
      found = { ...place.placeholder, label: "placeholder (not geocoded)", source: "placeholder" }
    }
    if (!found) {
      console.error(`✗ ${place.name}: nothing found within ${MAX_FROM_GIBSON_M} m of Gibson Hall`)
      process.exitCode = 1
      continue
    }
    const verified = found.source === "Nominatim" && !place.unsure
    const entry = {
      name: place.name,
      short: place.short,
      lat: Number(found.lat.toFixed(6)),
      lng: Number(found.lng.toFixed(6)),
      source: found.source,
      verified,
      match: found.label,
    }
    if (place.name === "Gibson Hall") gibson = entry
    console.log(`${verified ? "✓" : "?"} ${place.name}: ${entry.lat}, ${entry.lng} via ${found.source} (${found.label.slice(0, 70)})`)
    out.push(entry)
  }
  return out
}

const coordString = (places) => places.map((p) => `${p.lng},${p.lat}`).join(";")

async function osrm(service, places, query) {
  let lastError
  for (const profile of ["foot", "driving"]) {
    const url = `${OSRM}/${service}/v1/${profile}/${coordString(places)}?${query}`
    try {
      const json = await throttled(url)
      if (json.code === "Ok") return json
      lastError = new Error(`OSRM ${service} returned code ${json.code}`)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

async function walkingData(places) {
  const n = places.length
  const names = places.map((p) => p.name)
  let durations = null
  try {
    const table = await osrm("table", places, "annotations=duration,distance")
    durations = table.durations
    console.log(`✓ OSRM table: ${n}×${n} durations`)
  } catch (e) {
    console.warn(`! OSRM table unavailable (${e.message}); using straight-line estimates`)
  }

  const walking = Object.fromEntries(names.map((a) => [a, Object.fromEntries(names.map((b) => [b, 0]))]))
  const features = []
  let estimatedPairs = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = places[i], b = places[j]
      let seconds = null
      let feature = null
      if (durations && durations[i]?.[j] != null && durations[j]?.[i] != null) {
        seconds = Math.max(durations[i][j], durations[j][i])
      }
      try {
        const route = await osrm("route", [a, b], "overview=full&geometries=geojson")
        const r = route.routes[0]
        if (seconds == null) seconds = r.duration
        feature = {
          type: "Feature",
          geometry: r.geometry,
          properties: { from: a.name, to: b.name, meters: Math.round(r.distance) },
        }
      } catch (e) {
        console.warn(`! route ${a.name} → ${b.name}: ${e.message}`)
      }
      let estimated = false
      if (seconds == null || !feature) {
        const meters = haversineMeters(a, b) * DETOUR_FACTOR
        if (seconds == null) seconds = (meters / WALK_M_PER_MIN) * 60
        if (!feature)
          feature = {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
            properties: { from: a.name, to: b.name, meters: Math.round(meters) },
          }
        estimated = true
        estimatedPairs++
      }
      const minutes = Math.max(MIN_MINUTES, Math.ceil(seconds / 60))
      walking[a.name][b.name] = minutes
      walking[b.name][a.name] = minutes
      feature.properties.minutes = minutes
      if (estimated) feature.properties.estimated = true
      features.push(feature)
      process.stdout.write(`  ${a.short} → ${b.short}: ${minutes} min${estimated ? " (estimated)" : ""}\n`)
    }
  }
  if (estimatedPairs) console.warn(`! ${estimatedPairs} pair(s) used straight-line estimates; note this in docs/ai-log.md`)
  return { walking, routes: { type: "FeatureCollection", features } }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"))
  } catch {
    return null
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  let places = await readJson(PLACES_FILE)
  if (only !== "walking") {
    places = await geocodeAll(places)
    await writeFile(PLACES_FILE, JSON.stringify(places, null, 2) + "\n")
    console.log(`wrote ${path.relative(ROOT, PLACES_FILE)} (${places.length} places)`)
    if (process.exitCode) return
  } else if (!places) {
    console.error("src/gw/data/places.json is missing: run `make geodata` (ONLY=all) first")
    process.exit(1)
  }
  if (only !== "places") {
    const { walking, routes } = await walkingData(places)
    await writeFile(WALKING_FILE, JSON.stringify(walking, null, 2) + "\n")
    await writeFile(ROUTES_FILE, JSON.stringify(routes) + "\n")
    console.log(`wrote ${path.relative(ROOT, WALKING_FILE)} and ${path.relative(ROOT, ROUTES_FILE)} (${routes.features.length} routes)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
