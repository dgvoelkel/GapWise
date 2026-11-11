#!/usr/bin/env node
// Renders docs/places-check.png: the real campus map with every place in
// src/gw/data/places.json labeled, plus a table of names, coordinates and
// verified flags (BUILD.md Phase 2, Checkpoint A). Run through `make places-check`.
//
//   node scripts/places-check.mjs --port=3000
//
// Serves a tiny local page (maplibre-gl from node_modules + OpenFreeMap tiles)
// and screenshots it with Playwright. No app build is required.

import { createServer } from "node:http"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PLACES_FILE = path.join(ROOT, "src", "gw", "data", "places.json")
const OUT_PNG = path.join(ROOT, "docs", "places-check.png")
const OUT_MD = path.join(ROOT, "docs", "places-check.md")
const MAPLIBRE_DIST = path.join(ROOT, "node_modules", "maplibre-gl", "dist")
const STYLE = "https://tiles.openfreemap.org/styles/liberty"

const portArg = process.argv.find((a) => a.startsWith("--port="))
const requestedPort = Number(portArg?.slice("--port=".length) ?? 3000)

const places = JSON.parse(await readFile(PLACES_FILE, "utf8"))

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>GapWise places check</title>
<link rel="stylesheet" href="/maplibre/maplibre-gl.css">
<style>
  html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  #map { position: absolute; inset: 0; }
  .pin { display: flex; align-items: center; gap: 6px; }
  .pin.left { flex-direction: row-reverse; }
  .pin b { width: 24px; height: 24px; border-radius: 50%; background: #0f766e; color: #fff;
    display: grid; place-items: center; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.4); flex: none; }
  .pin.unverified b { background: #b45309; }
  .pin span { background: rgba(255,255,255,.95); border: 1px solid #0f766e; border-radius: 6px;
    padding: 2px 6px; font-size: 12px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  .pin.unverified span { border-color: #b45309; }
  .legend { position: absolute; left: 12px; top: 12px; background: rgba(255,255,255,.95);
    border-radius: 8px; padding: 8px 12px; font-size: 13px; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
</style></head>
<body>
<div id="map" role="img" aria-label="Campus places"></div>
<div class="legend"><div><i style="background:#0f766e"></i>geocoded, looks right</div>
<div><i style="background:#b45309"></i>needs Davis to confirm</div></div>
<script type="module">
  import * as maplibregl from "/maplibre/maplibre-gl.mjs";
  const places = ${JSON.stringify(places)};
  const map = new maplibregl.Map({ container: "map", style: ${JSON.stringify(STYLE)}, attributionControl: { compact: false }, fadeDuration: 0 });
  const bounds = new maplibregl.LngLatBounds();
  places.forEach((p, i) => {
    bounds.extend([p.lng, p.lat]);
    const el = document.createElement("div");
    const left = i % 2 === 1;
    el.className = "pin" + (p.verified ? "" : " unverified") + (left ? " left" : "");
    el.innerHTML = "<b>" + (i + 1) + "</b><span>" + p.name.replace(/</g, "&lt;") + "</span>";
    new maplibregl.Marker({ element: el, anchor: left ? "right" : "left", offset: [left ? 12 : -12, 0] }).setLngLat([p.lng, p.lat]).addTo(map);
  });
  map.fitBounds(bounds, { padding: 80, duration: 0 });
  map.on("error", (e) => { window.__mapError = String(e?.error?.message ?? e); });
  map.once("idle", () => { window.__ready = true; });
</script>
</body></html>`

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".map": "application/json" }
const server = createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0]
  try {
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      return res.end(page)
    }
    if (url.startsWith("/maplibre/")) {
      const file = path.join(MAPLIBRE_DIST, path.basename(url))
      const body = await readFile(file)
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" })
      return res.end(body)
    }
    res.writeHead(404)
    res.end("not found")
  } catch (e) {
    res.writeHead(500)
    res.end(String(e))
  }
})

const port = await new Promise((resolve, reject) => {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE") {
      server.listen(0, "127.0.0.1", () => resolve(server.address().port))
    } else reject(e)
  })
  server.listen(requestedPort, "127.0.0.1", () => resolve(server.address().port))
})

const browser = await chromium.launch({
  executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
try {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 2 })
  tab.on("pageerror", (e) => console.warn(`! page error: ${e.message}`))
  tab.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.warn(`! console ${m.type()}: ${m.text()}`)
  })
  tab.on("requestfailed", (r) => console.warn(`! request failed: ${r.url()} (${r.failure()?.errorText})`))
  await tab.goto(`http://127.0.0.1:${port}/`)
  try {
    await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })
  } catch {
    console.warn("! map never became idle within 60 s; screenshotting whatever rendered")
  }
  await tab.waitForTimeout(500)
  const mapError = await tab.evaluate(() => window.__mapError)
  if (mapError) console.warn(`! map reported: ${mapError}`)
  await mkdir(path.dirname(OUT_PNG), { recursive: true })
  await tab.screenshot({ path: OUT_PNG })
} finally {
  await browser.close()
  server.close()
}

const rows = places.map(
  (p, i) =>
    `| ${i + 1} | ${p.name} | ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} | ${p.source} | ${p.verified ? "yes" : "**no**"} | ${(p.match ?? "").replace(/\|/g, "/").slice(0, 60)} |`,
)
const table = [
  "| # | Place | Lat, lng | Source | Verified | Matched |",
  "|---|---|---|---|---|---|",
  ...rows,
].join("\n")
const md = `# Places check\n\nGenerated by \`make places-check\` on ${new Date().toISOString().slice(0, 10)}. Pins numbered as in \`places-check.png\`. Teal pins were geocoded cleanly; amber pins need Davis to confirm or move them. Corrections go straight into \`src/gw/data/places.json\` (set \`verified: true\`, \`source: "Davis"\`), then run \`make geodata ONLY=walking\`.\n\n![Places check](places-check.png)\n\n${table}\n`
await writeFile(OUT_MD, md)
console.log(table)
console.log(`\nwrote ${path.relative(ROOT, OUT_PNG)} and ${path.relative(ROOT, OUT_MD)}`)
