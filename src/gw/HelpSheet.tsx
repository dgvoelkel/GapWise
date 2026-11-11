import { Lightbulb, Users } from "lucide-react"
import { type Persona } from "./personas"
import { Sheet } from "./components"
import { Button } from "./ui"

type Tab = "today" | "plan" | "map" | "acts" | "settings"

/** What each tab is for, in the product's own voice (Milestone 2). */
const HELP: Record<Tab, { title: string; what: string; tips: string[] }> = {
  today: {
    title: "Right Now",
    what: "The gap in front of you. GapWise subtracts the walk to your next commitment and your arrival buffer, then shows what honestly fits in the minutes that remain.",
    tips: [
      "Each option carries a fit label: Comfortable, Tight, or Doesn’t fit. Open “View details” to see the time receipt behind it.",
      "Numbered pins on the small map match the numbered options. Tap the map to open the full Map tab.",
      "“Keep this gap open” is a real choice. You don’t have to fill every gap.",
    ],
  },
  plan: {
    title: "Plan",
    what: "Your whole week as a day grid. Gaps are drawn to scale, so a 10-minute gap looks small and a free afternoon looks free.",
    tips: [
      "Select a gap to see what fits before the next commitment, or add an activity to it.",
      "Edit a commitment to move it, give it its own arrival buffer, or cancel it. Gaps merge and the banner tells you what changed.",
      "Planned activities, the walk, and the buffer show as separate bands inside the gap.",
    ],
  },
  map: {
    title: "Map",
    what: "The real Tulane uptown campus. The teal line is the walk between your last and next commitment; a dashed line is a detour to an option.",
    tips: [
      "Numbered pins match the “Options that fit” list. Tap either one to select it.",
      "Building pins show what on your list could happen there.",
      "Walking minutes come from real campus paths at your chosen pace. If the map can’t load, the minutes still work.",
    ],
  },
  acts: {
    title: "Activities",
    what: "The things you’d like to make time for: how long they take, where they can happen, and any deadline or time window.",
    tips: [
      "Setup time, a required window (like a talk), and a deadline all change whether something fits.",
      "“Details & gaps” lists every upcoming gap an activity fits into.",
      "Completed activities stop being recommended.",
    ],
  },
  settings: {
    title: "Settings",
    what: "How cautious GapWise should be for you: your arrival buffer, walking pace, accessibility allowance, and planning style.",
    tips: [
      "Raising the buffer lowers usable minutes everywhere at once; the preview shows the effect on your current gap.",
      "Switch student to explore a different schedule. Everything stays in this browser tab.",
    ],
  },
}

export default function HelpSheet({
  tab,
  persona,
  onClose,
  onSwitch,
}: {
  tab: Tab
  persona?: Persona
  onClose: () => void
  onSwitch: () => void
}) {
  const help = HELP[tab]
  return (
    <Sheet title={`About ${help.title}`} onClose={onClose}>
      <div className="help-section">
        <p>{help.what}</p>
        <ul>
          {help.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      {persona && (
        <div className="help-section">
          <h3>
            <Lightbulb size={16} /> Things to try as {persona.short}
          </h3>
          <ul className="help-tasks">
            {persona.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
          <p>
            {persona.name}: {persona.bio}
          </p>
        </div>
      )}
      <div className="help-section">
        <p>
          This is a prototype with demo schedules. Nothing is connected to a
          calendar, nothing is sent anywhere, and nothing is kept after this tab
          closes.
        </p>
        <div className="button-row">
          <Button variant="secondary" onClick={onSwitch}>
            <Users size={14} />
            Switch student
          </Button>
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
