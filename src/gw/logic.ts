export type Priority = 'must' | 'should' | 'optional';
export type Commitment = { id: string; title: string; start: number; end: number; location: string; day: number; recurrence: string[]; type: string; canceled?: boolean; buffer?: number };
export type Activity = { id: string; title: string; duration: number; locations: string[]; priority: Priority; deadline?: number; preferred?: [number, number]; required?: boolean; flexibleLocation?: boolean; done?: boolean; notes?: string; isRest?: boolean };
export type Prefs = { buffer: number; pace: 'relaxed' | 'normal' | 'brisk'; avoidLong: boolean; style: 'ahead' | 'moment' };
export type Gap = { key: string; day: number; prev: Commitment; next: Commitment; start: number; end: number; total: number; travel: number; buffer: number; usable: number };
export type Fit = 'comfortable' | 'tight' | 'none';
export type Eval = { a: Activity; loc: string; t1: number; t2: number; required: number; remaining: number; fit: Fit; reason: string; score: number; extraTravel: number };

export const LOCS: Record<string, [number, number]> = {
  'Gibson Hall': [0, 0], 'Newcomb Hall': [8, 4], 'LBC': [3, 3], 'Howard-Tilton Library': [5, -2],
  'Reily Rec Center': [10, 9], 'Richardson Memorial': [-2, 5], 'Stanley Thomas Hall': [-3, 3],
  "PJ's Coffee": [1, 4], 'Athletics facility': [14, 12],
};
export const LOC_NAMES = Object.keys(LOCS);
export function travel(a: string, b: string, p: Prefs) {
  if (!a || !b || a === b || !LOCS[a] || !LOCS[b]) return 0;
  const [x1, y1] = LOCS[a], [x2, y2] = LOCS[b];
  const m = { relaxed: 1.25, normal: 1, brisk: 0.85 }[p.pace] * (p.avoidLong ? 1.1 : 1);
  return Math.max(2, Math.round(Math.hypot(x1 - x2, y1 - y2) * m));
}
export const fmt = (m: number) => { const h = Math.floor(m / 60), mm = m % 60; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const dur = (m: number) => m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;

export function gapsFor(cs: Commitment[], day: number, p: Prefs): Gap[] {
  const list = cs.filter(c => c.day === day && !c.canceled).sort((a, b) => a.start - b.start);
  const out: Gap[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const prev = list[i], next = list[i + 1];
    const total = next.start - prev.end; if (total <= 0) continue;
    const t = travel(prev.location, next.location, p);
    const buf = Math.max(0, Math.min(next.buffer ?? p.buffer, total - t));
    out.push({ key: `${day}-${prev.id}-${next.id}`, day, prev, next, start: prev.end, end: next.start, total, travel: t, buffer: buf, usable: total - t - buf });
  }
  return out;
}
const PW = { must: 30, should: 18, optional: 8 };
export function evaluate(a: Activity, g: Gap, p: Prefs, from = g.prev.location, startAt = g.start): Eval {
  const locs = a.locations.length ? a.locations : [from];
  let best: Eval | null = null;
  for (const loc of locs) {
    const t1 = travel(from, loc, p), t2 = travel(loc, g.next.location, p);
    const required = t1 + a.duration + t2 + g.buffer;
    const remaining = g.end - startAt - required;
    const extraTravel = t1 + t2 - travel(from, g.next.location, p);
    let fit: Fit = remaining >= 10 ? 'comfortable' : remaining >= 0 ? 'tight' : 'none';
    let reason = '';
    const finish = startAt + t1 + a.duration;
    if (a.deadline != null && finish > a.deadline) { fit = 'none'; reason = `Would finish after the ${fmt(a.deadline)} deadline.`; }
    if (a.required && a.preferred && (startAt + t1 < a.preferred[0] || finish > a.preferred[1])) { fit = 'none'; reason = `Only available ${fmt(a.preferred[0])}–${fmt(a.preferred[1])}.`; }
    if (!reason) reason = fit === 'none' ? `${a.duration} min + ${t1} min there + ${t2} min to ${g.next.title}. You'd need ~${-remaining} more minutes.`
      : a.deadline != null ? `${a.priority === 'must' ? 'Must do' : 'Priority'} · due ${fmt(a.deadline)} — done with ${remaining} min to spare.`
      : extraTravel <= 1 ? `On your way to ${g.next.location} — no extra travel.` : `Adds ${extraTravel} min of walking; leaves ${remaining} min.`;
    let score = PW[a.priority] + (a.deadline != null ? 15 : 0) - extraTravel * 0.8 + Math.min(remaining, 20) * 0.3;
    if (a.preferred && startAt >= a.preferred[0] - 30 && startAt < a.preferred[1]) score += 8;
    if (fit === 'tight') score -= 6;
    const e = { a, loc, t1, t2, required, remaining, fit, reason, score, extraTravel };
    if (!best || (best.fit === 'none' && e.fit !== 'none') || (e.fit !== 'none') === (best.fit !== 'none') && e.remaining > best.remaining) best = e;
  }
  return best!;
}
export function rank(acts: Activity[], g: Gap, p: Prefs) {
  const ev = acts.filter(a => !a.done && !a.isRest).map(a => evaluate(a, g, p));
  return { fits: ev.filter(e => e.fit !== 'none').sort((a, b) => b.score - a.score), no: ev.filter(e => e.fit === 'none') };
}
export function combos(fits: Eval[], g: Gap, p: Prefs) {
  const out: { a: Eval; b: Eval; locB: string; t: number[]; remaining: number }[] = [];
  const top = fits.filter(f => f.a.duration <= 30).slice(0, 4);
  for (let i = 0; i < top.length; i++) for (let j = 0; j < top.length; j++) {
    if (i === j) continue; const A = top[i], B = top[j];
    const locB = B.a.locations.length ? B.a.locations.reduce((x, y) => travel(A.loc, x, p) + travel(x, g.next.location, p) <= travel(A.loc, y, p) + travel(y, g.next.location, p) ? x : y) : A.loc;
    const t = [travel(g.prev.location, A.loc, p), travel(A.loc, locB, p), travel(locB, g.next.location, p)];
    const remaining = g.total - A.a.duration - B.a.duration - t[0] - t[1] - t[2] - g.buffer;
    if (remaining >= 3 && !out.some(o => o.a.a.id === B.a.id && o.b.a.id === A.a.id)) out.push({ a: A, b: B, locB, t, remaining });
  }
  return out.sort((x, y) => y.a.score + y.b.score - x.a.score - x.b.score).slice(0, 2);
}

const T = (h: number, m = 0) => h * 60 + m;
export const BASE_ACTS: Activity[] = [
  { id: 'print', title: 'Print assignment', duration: 10, locations: ['Howard-Tilton Library'], priority: 'must', deadline: T(13) },
  { id: 'lunch', title: 'Lunch', duration: 30, locations: ['LBC'], priority: 'should', preferred: [T(12), T(14)] },
  { id: 'study', title: 'Study', duration: 30, locations: [], priority: 'should', flexibleLocation: true },
  { id: 'coffee', title: 'Coffee', duration: 10, locations: ["PJ's Coffee", 'LBC'], priority: 'optional' },
  { id: 'workout', title: 'Workout', duration: 45, locations: ['Reily Rec Center'], priority: 'should', preferred: [T(15), T(18)] },
];
const c = (id: string, title: string, s: number, e: number, location: string, day = 0, rec: string[] = []): Commitment => ({ id, title, start: s, end: e, location, day, recurrence: rec, type: 'class' });
export const TOMORROW = [c('t1', 'Data Structures', T(8), T(9, 15), 'Richardson Memorial', 1, ['T', 'Th']), c('t2', 'Linear Algebra', T(11), T(12, 15), 'Gibson Hall', 1, ['T', 'Th']), c('t3', 'Lab section', T(14, 30), T(16), 'Stanley Thomas Hall', 1)];
export const SCENARIOS: Record<string, { label: string; cs: Commitment[]; acts: Activity[]; now: number }> = {
  default: { label: 'Default day', now: T(8, 30), acts: BASE_ACTS, cs: [c('c1', 'Topology', T(9), T(9, 50), 'Gibson Hall', 0, ['M', 'W', 'F']), c('c2', 'Machine Learning', T(10), T(10, 50), 'Gibson Hall', 0, ['M', 'W', 'F']), c('c3', 'Research Meeting', T(12, 30), T(13, 45), 'Stanley Thomas Hall', 0, ['W']), c('c4', 'Practice', T(16, 30), T(18), 'Athletics facility', 0, ['M', 'T', 'W', 'Th', 'F']), ...TOMORROW] },
  A: { label: "Scenario A — Derek's short gap", now: T(10, 50), acts: BASE_ACTS, cs: [c('a1', 'Class 1 · Topology', T(10), T(10, 50), 'Gibson Hall'), c('a2', 'Class 2 · Statistics', T(11), T(11, 50), 'Newcomb Hall'), ...TOMORROW] },
  B: { label: 'Scenario B — Longer gap', now: T(10, 30), acts: BASE_ACTS.map(a => a.id === 'print' ? { ...a, deadline: T(12, 30) } : a.id === 'lunch' ? { ...a, duration: 25, preferred: [T(11), T(14)] as [number, number] } : a), cs: [c('b1', 'Topology', T(10), T(11), 'Gibson Hall'), c('b2', 'Statistics', T(12), T(13), 'Newcomb Hall'), c('b3', 'Machine Learning', T(14), T(15), 'Newcomb Hall'), ...TOMORROW] },
  now: { label: '"Now" state', now: T(13, 5), acts: BASE_ACTS.map(a => a.id === 'lunch' ? { ...a, duration: 25 } : a), cs: [c('n1', 'Topology', T(11), T(12, 15), 'Gibson Hall'), c('n2', 'Research Meeting', T(12, 30), T(13), 'Stanley Thomas Hall'), c('n3', 'Machine Learning', T(14), T(15), 'Newcomb Hall'), ...TOMORROW] },
};
