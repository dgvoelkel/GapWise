import {
  type Activity,
  type Commitment,
  type CommitmentSource,
  type Prefs,
} from "./logic.ts"

/**
 * Three ready-made students (BUILD.md Phase 4). They stand in for calendar
 * import: nothing is ever connected, the schedule is plain data that lives in
 * React state and this browser tab.
 *
 * Class rows mirror docs/tulane-sections.csv (course, title, days, times,
 * building, room). Day 0 = Wednesday, matching DATE_LABELS in logic.ts.
 */
export type PersonaId = "stella" | "ryan" | "chloe"
export type Persona = {
  id: PersonaId
  name: string
  short: string
  tagline: string
  bio: string
  now: number
  prefs: Partial<Prefs>
  commitments: Commitment[]
  activities: Activity[]
  tasks: string[]
}

const T = (h: number, m = 0) => h * 60 + m
/** Plan-day index for each day code, with Wednesday as day 0. */
const DAY_INDEX: Record<string, number> = {
  W: 0,
  Th: 1,
  F: 2,
  S: 3,
  Su: 4,
  M: 5,
  T: 6,
}
const ORDER = ["M", "T", "W", "Th", "F", "S", "Su"]
const sortDays = (days: string[]) =>
  [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))

type Row = {
  id: string
  title: string
  days: string // "M W F", "T Th", "W"
  start: number
  end: number
  location: string
  type: string
  source: CommitmentSource
  room?: string
  buffer?: number
}
/** Expands rows into one commitment per listed day. */
const rows = (...list: Row[]) => list.flatMap(series)
/** One commitment per listed day; repeating rows share a seriesId. */
function series(row: Row): Commitment[] {
  const days = sortDays(row.days.split(/\s+/).filter(Boolean))
  const recurrence = days.length > 1 ? days : []
  return days.map((code) => {
    const day = DAY_INDEX[code]
    if (day == null) throw new Error(`Unknown day code ${code} for ${row.id}`)
    return {
      id: days.length > 1 ? `${row.id}-${day}` : row.id,
      title: row.title,
      start: row.start,
      end: row.end,
      location: row.location,
      day,
      recurrence,
      type: row.type,
      source: row.source,
      room: row.room,
      buffer: row.buffer,
      seriesId: days.length > 1 ? row.id : undefined,
    }
  })
}
const classRow = (
  id: string,
  course: string,
  title: string,
  days: string,
  start: number,
  end: number,
  location: string,
  room: string,
): Row => ({
  id,
  title: `${course} · ${title}`,
  days,
  start,
  end,
  location,
  room,
  type: "class",
  source: "Canvas",
})

const act = (
  id: string,
  title: string,
  duration: number,
  priority: Activity["priority"],
  locations: string[],
  patch: Partial<Activity> = {},
): Activity => ({
  id,
  title,
  duration,
  priority,
  locations,
  flexibleLocation: locations.length === 0,
  ...patch,
})

export const PERSONAS: Record<PersonaId, Persona> = {
  stella: {
    id: "stella",
    name: "Student-Athlete Stella",
    short: "Stella",
    tagline: "Packed days. Strict about practice, relaxed about class.",
    bio: "Junior in Public Health on the tennis team, living on campus. Practice and lifts are fixed; everything else has to fit around them.",
    now: T(11),
    prefs: { buffer: 5, pace: "normal", style: "moment" },
    commitments: rows(
      {
        id: "st-lift",
        title: "Team lift",
        days: "M W F",
        start: T(7),
        end: T(8, 15),
        location: "Wilson Center",
        type: "practice",
        source: "Teamworks",
        buffer: 10,
      },
      classRow(
        "st-epi",
        "SPHU 3170",
        "Foundations of Epidemiology",
        "M W F",
        T(10),
        T(10, 50),
        "Howard-Tilton Library",
        "B11",
      ),
      classRow(
        "st-finance",
        "FINE 3010",
        "Financial Management",
        "M W",
        T(12),
        T(12, 50),
        "Goldring/Woldenberg",
        "116",
      ),
      {
        id: "st-practice",
        title: "Tennis practice",
        days: "M T W Th",
        start: T(15, 30),
        end: T(18),
        location: "Goldring Tennis Center",
        type: "practice",
        source: "Teamworks",
        buffer: 15,
      },
      {
        id: "st-meeting",
        title: "Team meeting",
        days: "W",
        start: T(19),
        end: T(19, 45),
        location: "Wilson Center",
        type: "meeting",
        source: "Teamworks",
        buffer: 10,
      },
      classRow(
        "st-biostat",
        "SPHU 2160",
        "Biostatistics in Public Health",
        "T Th",
        T(9, 30),
        T(10, 45),
        "Boggs Center",
        "239",
      ),
      classRow(
        "st-social",
        "SPHU 3110",
        "Social and Behavioral Perspectives in Public Health",
        "T Th",
        T(11),
        T(12, 15),
        "Tilton Memorial Hall",
        "301",
      ),
      {
        id: "st-shift",
        title: "Front-desk shift",
        days: "T Th",
        start: T(12, 30),
        end: T(14, 30),
        location: "LBC",
        type: "work",
        source: "Manual",
      },
      {
        id: "st-practice-fri",
        title: "Tennis practice",
        days: "F",
        start: T(14),
        end: T(16),
        location: "Goldring Tennis Center",
        type: "practice",
        source: "Teamworks",
        buffer: 15,
      },
      {
        id: "st-match",
        title: "Match vs. Rice",
        days: "S",
        start: T(10),
        end: T(14),
        location: "Goldring Tennis Center",
        type: "practice",
        source: "Teamworks",
        buffer: 30,
      },
    ),
    activities: [
      act("print", "Print assignment", 10, "must", [
        "Goldring/Woldenberg",
        "Howard-Tilton Library",
      ], { deadline: T(12, 30), deadlineDay: 0, category: "errand", energy: "low" }),
      act("coffee", "Coffee", 10, "optional", [
        "Goldring/Woldenberg",
        "PJ's Coffee",
      ], { category: "food", energy: "low" }),
      act("lunch", "Lunch", 35, "should", ["LBC", "The Commons"], {
        preferred: [T(11), T(14)],
        category: "food",
        energy: "low",
      }),
      act("workout", "Conditioning workout", 45, "should", ["Reily Rec Center"], {
        category: "move",
        energy: "high",
      }),
      act("epi-pset", "Epidemiology problem set", 60, "must", [], {
        deadline: T(23, 59),
        deadlineDay: 2,
        setup: 5,
        category: "study",
        energy: "medium",
      }),
      act("package", "Pick up package", 10, "should", ["LBC"], {
        category: "errand",
        energy: "low",
      }),
      act("stretch", "Stretch / ice", 20, "optional", ["Wilson Center"], {
        category: "rest",
        energy: "low",
      }),
      act("call-home", "Call home", 15, "optional", [], {
        category: "rest",
        energy: "low",
      }),
    ],
    tasks: [
      "See what fits before Finance",
      "Raise your buffer for Finance to 10 min",
      "Check why lunch is Tight",
    ],
  },
  ryan: {
    id: "ryan",
    name: "Routine Ryan",
    short: "Ryan",
    tagline: "Help me only when it's actually hard.",
    bio: "Sophomore in Computer Science, living on campus. Same routine most days, small things left off the calendar, and no patience for suggestions he didn't ask for.",
    now: T(10, 50),
    prefs: { buffer: 0, pace: "brisk", style: "ahead" },
    commitments: rows(
      {
        id: "ry-research",
        title: "Research block",
        days: "M T W Th F",
        start: T(8),
        end: T(9, 30),
        location: "Stanley Thomas Hall",
        type: "research",
        source: "Outlook",
      },
      classRow(
        "ry-first",
        "MATH 2170",
        "Intro To Discrete Math",
        "M W F",
        T(10),
        T(10, 50),
        "Stanley Thomas Hall",
        "302",
      ),
      classRow(
        "ry-second",
        "CMPS 3140",
        "Intro Artificial Intelligence",
        "M W F",
        T(11),
        T(11, 50),
        "Dinwiddie Hall",
        "108",
      ),
      classRow(
        "ry-studio",
        "CMPS 3300",
        "Software Studio",
        "M W",
        T(14),
        T(14, 50),
        "Stanley Thomas Hall",
        "302",
      ),
      {
        id: "ry-advisor",
        title: "Advisor meeting",
        days: "W",
        start: T(13),
        end: T(13, 30),
        location: "Gibson Hall",
        type: "meeting",
        source: "Outlook",
      },
      classRow(
        "ry-algorithms",
        "CMPS 2200",
        "Intro to Algorithms",
        "T Th",
        T(9, 30),
        T(10, 45),
        "Stanley Thomas Hall",
        "302",
      ),
      classRow(
        "ry-linalg",
        "MATH 3090",
        "Linear Algebra",
        "T Th",
        T(11),
        T(12, 15),
        "Richardson Building",
        "108",
      ),
    ),
    activities: [
      act("lunch", "Lunch", 30, "should", ["LBC", "The Commons"], {
        preferred: [T(11, 30), T(13, 30)],
        category: "food",
        energy: "low",
      }),
      act("paper", "Read assigned paper", 30, "should", [], {
        category: "study",
        energy: "medium",
      }),
      act("ml-lab", "Submit ML lab", 20, "must", [], {
        deadline: T(23, 59),
        deadlineDay: 1,
        category: "study",
        energy: "medium",
      }),
      act("coffee", "Coffee", 10, "optional", ["PJ's Coffee", "LBC"], {
        category: "food",
        energy: "low",
      }),
      act("rest", "Rest in room", 30, "optional", [], {
        isRest: true,
        category: "rest",
        energy: "low",
      }),
    ],
    tasks: [
      "Open Right Now between Discrete Math and Intro to AI",
      "Cancel the 1:00 advisor meeting and keep the merged gap open",
    ],
  },
  chloe: {
    id: "chloe",
    name: "Commuter Chloe",
    short: "Chloe",
    tagline: "Stay on campus or go home? Catch conflicts before they happen.",
    bio: "First-year master's student who lives off campus and rides the shuttle. Every day is a decision about whether the trip home is worth it.",
    now: T(12),
    prefs: { buffer: 10, pace: "normal", style: "ahead" },
    commitments: rows(
      {
        id: "ch-arrive-mw",
        title: "Shuttle arrives",
        days: "M W",
        start: T(10, 30),
        end: T(10, 35),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      classRow(
        "ch-seminar",
        "CMPS 6160",
        "Introduction to Data Science",
        "M W",
        T(11),
        T(11, 50),
        "Stanley Thomas Hall",
        "302",
      ),
      classRow(
        "ch-afternoon",
        "CMPS 6240",
        "Intro to Machine Learning",
        "M W",
        T(13),
        T(13, 50),
        "Stanley Thomas Hall",
        "302",
      ),
      {
        id: "ch-research",
        title: "Research meeting",
        days: "W",
        start: T(15),
        end: T(16),
        location: "Stanley Thomas Hall",
        type: "meeting",
        source: "Outlook",
      },
      {
        id: "ch-depart-w",
        title: "Shuttle departs",
        days: "W",
        start: T(17, 30),
        end: T(17, 35),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      {
        id: "ch-depart-m",
        title: "Shuttle departs",
        days: "M",
        start: T(16, 45),
        end: T(16, 50),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      {
        id: "ch-arrive-tth",
        title: "Shuttle arrives",
        days: "T Th",
        start: T(7, 25),
        end: T(7, 30),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      classRow(
        "ch-stats",
        "MATH 6080",
        "Intro to Statistical Inference",
        "T Th",
        T(8),
        T(9, 15),
        "Gibson Hall",
        "310",
      ),
      {
        id: "ch-ra-tue",
        title: "Research assistant hours",
        days: "T",
        start: T(9, 45),
        end: T(12, 45),
        location: "Howard-Tilton Library",
        type: "work",
        source: "Google",
      },
      {
        id: "ch-depart-tf",
        title: "Shuttle departs",
        days: "T F",
        start: T(15),
        end: T(15, 5),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      {
        id: "ch-arrive-f",
        title: "Shuttle arrives",
        days: "F",
        start: T(8, 30),
        end: T(8, 35),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      {
        id: "ch-ra-fri",
        title: "Research assistant hours",
        days: "F",
        start: T(9),
        end: T(12),
        location: "Howard-Tilton Library",
        type: "work",
        source: "Google",
      },
      {
        id: "ch-depart-th-am",
        title: "Shuttle departs",
        days: "Th",
        start: T(9, 50),
        end: T(9, 55),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      {
        id: "ch-home-th",
        title: "At home",
        days: "Th",
        start: T(9, 55),
        end: T(17, 30),
        location: "Shuttle stop",
        type: "home",
        source: "Manual",
      },
      {
        id: "ch-arrive-th-pm",
        title: "Shuttle arrives",
        days: "Th",
        start: T(17, 30),
        end: T(17, 35),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
      classRow(
        "ch-viz",
        "CMPS 6360",
        "Data Visualization",
        "Th",
        T(18),
        T(20, 30),
        "Stanley Thomas Hall",
        "302",
      ),
      {
        id: "ch-depart-th-pm",
        title: "Shuttle departs",
        days: "Th",
        start: T(20, 55),
        end: T(21),
        location: "Shuttle stop",
        type: "shuttle",
        source: "Manual",
      },
    ),
    activities: [
      act("lunch", "Lunch", 30, "should", ["The Commons", "LBC"], {
        preferred: [T(12), T(14)],
        category: "food",
        energy: "low",
      }),
      act("midterm", "Study for midterm", 60, "must", ["Howard-Tilton Library"], {
        deadline: T(23, 59),
        deadlineDay: 2,
        setup: 5,
        category: "study",
        energy: "medium",
      }),
      act("workout", "Workout", 45, "should", ["Reily Rec Center"], {
        category: "move",
        energy: "high",
      }),
      act("talk", "Data science talk", 45, "optional", ["Stanley Thomas Hall"], {
        preferred: [T(16, 15), T(17, 15)],
        required: true,
        category: "study",
        energy: "medium",
      }),
      act("go-home", "Go home and come back", 75, "optional", ["Shuttle stop"], {
        category: "rest",
        energy: "low",
        notes: "Round trip on the shuttle.",
      }),
      act("coffee", "Coffee", 10, "optional", ["PJ's Coffee"], {
        category: "food",
        energy: "low",
      }),
    ],
    tasks: [
      "Your 1:00 CMPS 6240 class was canceled. Find what now fits",
      "Keep the new gap open",
      "Plan Thursday, or don't",
    ],
  },
}

export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[]
export const isPersonaId = (value: unknown): value is PersonaId =>
  typeof value === "string" && value in PERSONAS
