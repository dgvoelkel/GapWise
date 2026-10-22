import type { Point } from "./campus"

export type MapRect = {
  x: number
  y: number
  width: number
  height: number
}

export type MapMarker = MapRect & {
  id: string
}

const intersects = (a: MapRect, b: MapRect, padding = 3) =>
  a.x < b.x + b.width + padding &&
  a.x + a.width + padding > b.x &&
  a.y < b.y + b.height + padding &&
  a.y + a.height + padding > b.y

const overlapArea = (a: MapRect, b: MapRect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

const offsets: Point[] = [{ x: 0, y: 0 }]
for (const radius of [
  12, 24, 36, 48, 64, 80, 96, 120, 144, 176, 208, 240, 280,
]) {
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2
    offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
}

// Keep screen-sized touch targets distinct without changing their map anchors.
export function layoutMarkers(
  markers: MapMarker[],
  size: {
    width: number
    height: number
  },
  obstacles: MapRect[],
): Record<string, Point> {
  const result: Record<string, Point> = {}
  const occupied = [...obstacles]

  for (const marker of markers) {
    const { width, height } = marker
    const original = { x: marker.x, y: marker.y }
    // Offscreen places must stay offscreen when the user pans or zooms.
    if (
      marker.x < 0 ||
      marker.x > size.width ||
      marker.y < 0 ||
      marker.y > size.height
    ) {
      result[marker.id] = original
      continue
    }

    let chosen = original
    let lowestCost = Infinity
    for (const offset of offsets) {
      const candidate = {
        x: Math.max(
          width / 2 + 3,
          Math.min(size.width - width / 2 - 3, marker.x + offset.x),
        ),
        y: Math.max(
          height / 2 + 3,
          Math.min(size.height - height / 2 - 3, marker.y + offset.y),
        ),
      }
      const rect = {
        x: candidate.x - width / 2,
        y: candidate.y - height / 2,
        width,
        height,
      }
      if (!occupied.some((other) => intersects(rect, other))) {
        chosen = candidate
        break
      }
      const cost =
        occupied.reduce((sum, other) => sum + overlapArea(rect, other), 0) *
          1000 +
        (candidate.x - marker.x) ** 2 +
        (candidate.y - marker.y) ** 2
      if (cost < lowestCost) {
        lowestCost = cost
        chosen = candidate
      }
    }
    result[marker.id] = chosen
    occupied.push({
      x: chosen.x - width / 2,
      y: chosen.y - height / 2,
      width,
      height,
    })
  }
  return result
}
