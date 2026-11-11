import { ArrowUpRight, Flag, Footprints, LocateFixed } from "lucide-react"
import { type Eval, type Gap, type Sequence } from "./logic"
import CampusMapGL, { type MapPin, routeLegs } from "./map/CampusMapGL"
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

/** A small real map inside the Now card: your route and the top options. */
export default function NowMapStrip({
  gap,
  evaluations,
  selectedId,
  sequence,
  upcoming = false,
  onSelect,
  onMap,
}: Props) {
  const options = evaluations
    .map((e, index) => ({ e, number: index + 1 }))
    .filter(({ e }, index) => index < 3 || e.a.id === selectedId)
  const selected =
    options.find(({ e }) => e.a.id === selectedId)?.e ?? options[0]?.e
  const route = sequence?.evaluations ?? (selected ? [selected] : [])
  const stops = route
    .map((e) => e.loc)
    .filter((loc) => loc !== gap.prev.location || route.length > 1)
  const legs = routeLegs(gap.prev.location, stops, gap.next.location)
  const walking =
    sequence?.walking ?? (selected ? selected.t1 + selected.t2 : gap.travel)
  const extra = sequence?.extraTravel ?? selected?.extraTravel ?? 0
  const startLabel = upcoming ? "Gap starts" : "Your location"
  const pins: MapPin[] = [
    {
      id: "start",
      place: gap.prev.location,
      kind: "start",
      label: `${startLabel}: ${gap.prev.location}`,
    },
    {
      id: "next",
      place: gap.next.location,
      kind: "next",
      label: `Next commitment: ${gap.next.title}, ${gap.next.location}`,
    },
    ...options.map(({ e, number }) => ({
      id: e.a.id,
      place: e.loc,
      kind: "option" as const,
      number,
      selected: selected?.a.id === e.a.id,
      label: `Suggestion ${number}: ${e.a.title}, ${e.loc}, ${
        e.t1 + e.t2
      } minutes total walking, ${e.extraTravel} minutes extra detour`,
    })),
  ]

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
      <div className="now-strip-canvas">
        <CampusMapGL
          fit="content"
          legs={legs}
          pins={pins}
          onPin={(pin) => {
            const option = options.find(({ e }) => e.a.id === pin.id)
            if (option) onSelect(option.e.a.id, option.e.loc)
          }}
          onTap={() => onMap(gap, selected?.a.id, selected?.loc)}
          tapLabel="Open full map for this gap"
        />
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
