import type { Gap } from "./logic"

export type Point = {
  x: number
  y: number
}

// Deliberately illustrative positions, separate from the prototype's walking-time model.
export const CAMPUS_PLACES: Record<string, Point> = {
  "Gibson Hall": { x: 655, y: 811 },
  "Newcomb Hall": { x: 423, y: 370 },
  LBC: { x: 666, y: 455 },
  "Howard-Tilton Library": { x: 467, y: 534 },
  "Reily Rec Center": { x: 587, y: 214 },
  "Richardson Memorial": { x: 521, y: 748 },
  "Stanley Thomas Hall": { x: 758, y: 699 },
  "PJ's Coffee": { x: 713, y: 568 },
  "Athletics facility": { x: 775, y: 161 },
}

export const placePoint = (name: string): Point =>
  CAMPUS_PLACES[name] ?? { x: 640, y: 500 }

export function gapPoint(gap: Gap): Point {
  const from = placePoint(gap.prev.location)
  const to = placePoint(gap.next.location)
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

export function routePath(from: string, to: string): string {
  const a = placePoint(from)
  const b = placePoint(to)
  if (from === to) return `M ${a.x} ${a.y} l 0 -1`
  const walk = 638
  return `M ${a.x} ${a.y} L ${walk} ${a.y} L ${walk} ${b.y} L ${b.x} ${b.y}`
}

export const CAMPUS_BUILDINGS = [
  { x: 716, y: 112, w: 124, h: 87, kind: "sport" },
  { x: 518, y: 163, w: 113, h: 78, kind: "main" },
  { x: 367, y: 150, w: 99, h: 56, kind: "stone" },
  { x: 343, y: 230, w: 114, h: 55, kind: "sand" },
  { x: 462, y: 268, w: 79, h: 42, kind: "stone" },
  { x: 683, y: 261, w: 69, h: 54, kind: "sand" },
  { x: 781, y: 246, w: 73, h: 82, kind: "stone" },
  { x: 356, y: 334, w: 125, h: 59, kind: "main" },
  { x: 311, y: 422, w: 65, h: 74, kind: "stone" },
  { x: 405, y: 487, w: 124, h: 73, kind: "main" },
  { x: 617, y: 409, w: 117, h: 85, kind: "main" },
  { x: 777, y: 390, w: 87, h: 56, kind: "sand" },
  { x: 793, y: 475, w: 62, h: 62, kind: "stone" },
  { x: 684, y: 542, w: 67, h: 40, kind: "sand" },
  { x: 329, y: 551, w: 62, h: 47, kind: "sand" },
  { x: 345, y: 673, w: 99, h: 59, kind: "stone" },
  { x: 476, y: 707, w: 78, h: 61, kind: "main" },
  { x: 714, y: 662, w: 97, h: 56, kind: "main" },
  { x: 787, y: 754, w: 69, h: 60, kind: "stone" },
  { x: 600, y: 786, w: 112, h: 54, kind: "main" },
  { x: 380, y: 795, w: 93, h: 48, kind: "sand" },
]

export const CAMPUS_LABELS = [
  { x: 572, y: 153, lines: ["Reily Recreation", "Center"] },
  { x: 785, y: 100, lines: ["Athletics"] },
  { x: 411, y: 323, lines: ["Newcomb Hall"] },
  { x: 438, y: 581, lines: ["Howard-Tilton", "Memorial Library"] },
  { x: 685, y: 396, lines: ["Lavin-Bernick", "Center"] },
  { x: 739, y: 597, lines: ["PJ’s Coffee"] },
  { x: 494, y: 790, lines: ["Richardson", "Memorial"] },
  { x: 787, y: 742, lines: ["Stanley Thomas"] },
  { x: 641, y: 867, lines: ["Gibson Hall"] },
]

export const CAMPUS_TREES: Point[] = [
  ...Array.from({ length: 18 }, (_, i) => ({ x: 608, y: 300 + i * 30 })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 666, y: 295 + i * 31 })),
  ...Array.from({ length: 15 }, (_, i) => ({
    x: 280 + (i % 2) * 14,
    y: 175 + i * 44,
  })),
  ...Array.from({ length: 16 }, (_, i) => ({
    x: 885 + (i % 3) * 10,
    y: 172 + i * 42,
  })),
  ...Array.from({ length: 13 }, (_, i) => ({
    x: 350 + i * 39,
    y: 884 - i * 3,
  })),
  ...Array.from({ length: 11 }, (_, i) => ({
    x: 330 + i * 48,
    y: 643 - i * 4,
  })),
  { x: 396, y: 433 },
  { x: 421, y: 461 },
  { x: 476, y: 434 },
  { x: 519, y: 458 },
  { x: 549, y: 392 },
  { x: 557, y: 345 },
  { x: 744, y: 344 },
  { x: 790, y: 359 },
  { x: 570, y: 692 },
  { x: 564, y: 805 },
  { x: 712, y: 775 },
  { x: 734, y: 825 },
  ...Array.from({ length: 42 }, (_, i) => ({
    x: 300 + ((i * 103) % 655),
    y: 961 + ((i * 47) % 205),
  })),
]
