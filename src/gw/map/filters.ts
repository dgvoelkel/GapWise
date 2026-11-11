import {
  BookOpen,
  Coffee,
  Dumbbell,
  Leaf,
  MapPin,
  Printer,
  SlidersHorizontal,
  Utensils,
} from "lucide-react"
import { type Activity, type Eval, categoryOf } from "../logic"

export type MapFilter = "all" | "study" | "food" | "move" | "errand" | "rest"

export const MAP_FILTERS = [
  ["all", "Everything", SlidersHorizontal],
  ["study", "Study", BookOpen],
  ["food", "Food & coffee", Coffee],
  ["move", "Move", Dumbbell],
  ["errand", "Errands", Printer],
  ["rest", "Rest", Leaf],
] as const

/** Icon for an activity, by category (ids were used in the low-fi). */
export const activityIcon = (a: Pick<Activity, "id" | "isRest"> & Partial<Activity>) => {
  if (a.isRest) return Leaf
  const category = a.category ?? categoryOf(a as Activity)
  return (
    {
      study: BookOpen,
      food: a.id === "coffee" ? Coffee : Utensils,
      move: Dumbbell,
      errand: a.id === "print" ? Printer : MapPin,
      rest: Leaf,
    } as const
  )[category]
}

export function matchesFilter(e: Eval, filter: MapFilter) {
  if (filter === "all") return true
  return categoryOf(e.a) === filter
}
