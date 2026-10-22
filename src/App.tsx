import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ListTodo, Settings as Cog, Sun, Clock, MapPin, Map as MapIcon, Footprints, ShieldCheck, ChevronRight, X, Plus, Check, AlertTriangle, CircleCheck, CircleSlash, Coffee, Info, ArrowDown, MoreHorizontal, Armchair, Navigation, Flag, Leaf, Circle, Printer, Utensils, BookOpen, Dumbbell, Sparkles } from 'lucide-react';
import { type Activity, type Commitment, type Eval, type Fit, type Gap, type Prefs, type Priority, BASE_ACTS, LOC_NAMES, SCENARIOS, combos, dur, evaluate, fmt, gapAtTime, gapsFor, rank, travel } from './gw/logic';
import CampusToday from './gw/CampusToday';
import { Button, Heading } from './gw/ui';

type Assign = { kind: 'act'; id: string; title: string } | { kind: 'open' } | { kind: 'skip' };
type St = { onboarded: boolean; scenario: string; cs: Commitment[]; acts: Activity[]; prefs: Prefs; now: number; assign: Record<string, Assign> };
const fresh = (sc = 'default', prefs?: Prefs): St => ({ onboarded: true, scenario: sc, cs: SCENARIOS[sc].cs, acts: SCENARIOS[sc].acts, now: SCENARIOS[sc].now, assign: {}, prefs: prefs ?? { buffer: 5, pace: 'normal', avoidLong: false, style: 'moment' } });
const DAYS = ['Today', 'Tomorrow', 'Thursday'];
const btn = 'min-h-11 rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f5c43]';
const P = 'bg-[#1f5c43] text-white hover:bg-[#184a36]', S = 'bg-white border border-[#d9d4c7] text-[#1b2433] hover:bg-[#f3efe4]';

const ICON: Record<string, typeof Coffee> = { print: Printer, lunch: Utensils, study: BookOpen, coffee: Coffee, workout: Dumbbell };
const TINT: Record<string, string> = { print: 'bg-[#e3efe8] text-[#1f5c43]', lunch: 'bg-[#f8ecc8] text-[#7a5a0c]', study: 'bg-[#e2eff0] text-[#2b6b72]', coffee: 'bg-[#f3e6da] text-[#7a4a22]', workout: 'bg-[#e8e6f3] text-[#4a4580]' };
export function ActIcon({ id, size = 40 }: { id: string; size?: number }) { const I = ICON[id] ?? Sparkles; return <span style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-xl ${TINT[id] ?? 'bg-[#efede8] text-[#4a4f58]'}`}><I size={size * 0.48} /></span>; }
export function FitBadge({ fit }: { fit: Fit }) {
  const m = { comfortable: ['Comfortable fit', CircleCheck, 'bg-[#e3efe8] text-[#1f5c43]'], tight: ['Tight fit', AlertTriangle, 'bg-[#f8ecc8] text-[#7a5a0c]'], none: ["Doesn't fit", CircleSlash, 'bg-[#eceae6] text-[#4a4f58]'] }[fit] as [string, typeof Check, string];
  const I = m[1]; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m[2]}`}><I size={13} />{m[0]}</span>;
}
export function PriorityTag({ p }: { p: Priority }) {
  const m = { must: ['Must do', Flag, 'text-[#1f5c43] bg-[#e3efe8]'], should: ['Should do', Circle, 'text-[#2b6b72] bg-[#e2eff0]'], optional: ['Optional', Leaf, 'text-[#5b616b] bg-[#efede8]'] }[p] as [string, typeof Flag, string];
  const I = m[1]; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m[2]}`}><I size={12} />{m[0]}</span>;
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusable = () => Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
    (el?.querySelector<HTMLElement>('input, select, textarea') ?? focusable()[0] ?? el)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    el?.addEventListener('keydown', handleKey);
    return () => { el?.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="gw-sheet-backdrop absolute inset-0 z-40 flex flex-col justify-end bg-black/30 anim-fade" onClick={onClose}>
    <div ref={panel} tabIndex={-1} className="gw-sheet max-h-[88%] overflow-y-auto rounded-t-3xl bg-[#fbf8f1] p-5 pb-8 anim-up" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><Heading as="h2" className="text-lg font-bold">{title}</Heading><Button size="icon" aria-label="Close" onClick={onClose} className="rounded-full hover:bg-black/5"><X size={20} /></Button></div>
      {children}</div></div>;
}
export function UsableTimeBreakdown({ g, big = true }: { g: Gap; big?: boolean }) {
  return <div>
    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-[#4a4f58]"><span>{g.total} min total</span><span>− {g.travel} travel</span><span>− {g.buffer} buffer</span><span>=</span></div>
    <div className={`font-extrabold tracking-tight text-[#1f5c43] ${big ? 'text-4xl' : 'text-2xl'}`}>{g.usable} <span className="text-lg font-bold">min usable</span></div>
  </div>;
}
export function GapBar({ g, e }: { g: Gap; e?: Eval }) {
  const segs = e ? [['Activity', e.a.duration, '#d9a84a'], ['Travel', e.t1 + e.t2, '#5f9ea0'], ['Buffer', g.buffer, '#9aa3ad'], ['Left', Math.max(0, e.remaining), '#e3efe8']] : [['Usable', g.usable, '#1f5c43'], ['Travel', g.travel, '#5f9ea0'], ['Buffer', g.buffer, '#9aa3ad']];
  return <div><div className="flex h-5 overflow-hidden rounded-full border border-[#d9d4c7]">{segs.map(([l, v, c]) => Number(v) > 0 && <div key={String(l)} style={{ width: `${(Number(v) / g.total) * 100}%`, background: String(c) }} className="transition-all duration-300" />)}</div>
    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[#4a4f58]">{segs.map(([l, v, c]) => <span key={String(l)} className="flex items-center gap-1"><i className="size-2.5 rounded-sm border border-black/10" style={{ background: String(c) }} />{l} {v} min</span>)}</div></div>;
}
export function RouteView({ g, e }: { g: Gap; e?: Eval }) {
  const stops = e && e.extraTravel > 0 || (e && e.loc !== g.prev.location) ? [[g.prev.location, e!.t1], [e!.loc, e!.t2], [g.next.location, 0]] : [[g.prev.location, g.travel], [g.next.location, 0]];
  return <div className="rounded-2xl border border-[#d9d4c7] bg-white bg-[linear-gradient(90deg,#f3efe4_1px,transparent_1px),linear-gradient(#f3efe4_1px,transparent_1px)] bg-[size:20px_20px] p-3">
    {stops.map(([l, t], i) => <div key={i}><div className={`flex items-center gap-2 rounded-lg bg-white/90 py-0.5 text-[15px] font-semibold ${e && l === e.loc && i === 1 ? 'text-[#7a5a0c]' : ''}`}><MapPin size={16} />{l}{e && i === 1 && <span className="text-xs font-medium">({e.a.title})</span>}</div>
      {i < stops.length - 1 && <div className="my-1 ml-1.5 flex items-center gap-2 border-l-2 border-dashed border-[#5f9ea0] pl-3 text-xs text-[#2b6b72]"><ArrowDown size={12} />{t} min · Estimated walking time</div>}</div>)}
  </div>;
}
export function CommitmentBlock({ c, onMenu }: { c: Commitment; onMenu: () => void }) {
  return <div className={`flex items-start gap-3 rounded-2xl p-4 ${c.canceled ? 'border border-dashed border-[#9aa3ad] bg-transparent text-[#5b616b]' : 'bg-gradient-to-br from-[#1b2433] to-[#2a3a4f] text-white shadow-[0_6px_16px_-8px_rgba(27,36,51,.6)]'} relative overflow-hidden`}>{!c.canceled && <i className="absolute -right-6 -top-6 size-24 rounded-full bg-white/5" />}<span className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${c.canceled ? 'bg-[#9aa3ad]' : 'bg-[#d9a84a]'}`} />
    <div className="flex-1"><div className="text-sm opacity-80">{fmt(c.start)} – {fmt(c.end)}</div><div className={`text-[17px] font-bold ${c.canceled ? 'line-through' : ''}`}>{c.title}{c.canceled && ' · Canceled'}</div><div className="flex items-center gap-1 text-sm opacity-80"><MapPin size={13} />{c.location}{c.recurrence.length > 0 && ` · ${c.recurrence.join(' ')}`}</div></div>
    <button aria-label={`Options for ${c.title}`} onClick={onMenu} className="flex size-11 items-center justify-center rounded-full hover:bg-white/10"><MoreHorizontal size={20} /></button></div>;
}
export function RecommendationCard({ e, onAdd, onWhy, compact }: { e: Eval; onAdd: () => void; onWhy: () => void; compact?: boolean }) {
  return <div className="rounded-2xl border border-[#e3ddcd] bg-white p-3.5 shadow-[0_1px_0_#e6e1d4] transition hover:-translate-y-px hover:shadow-md">
    <div className="flex items-start justify-between gap-2"><div className="flex gap-3"><ActIcon id={e.a.id.split('+')[0]} /><div><div className="text-[16px] font-bold">{e.a.title}{e.a.locations.length > 0 ? ` at ${e.loc}` : ''}</div>
      <div className="mt-0.5 text-sm text-[#4a4f58]">{e.a.duration} min · {e.t1 === 0 ? 'No extra travel' : `${e.t1} min away`} · Leaves {Math.max(e.remaining, 0)} min</div></div></div><FitBadge fit={e.fit} /></div>
    <div className="mt-2 flex flex-wrap gap-1.5"><PriorityTag p={e.a.priority} />{e.a.deadline != null && <span className="rounded-full bg-[#f8ecc8] px-2 py-0.5 text-xs font-medium text-[#7a5a0c]">Due {fmt(e.a.deadline)}</span>}</div>
    <p className="mt-2 text-sm text-[#1b2433]">{e.fit === 'tight' ? 'Tight fit — little room for delays. ' : ''}{e.reason}</p>
    {!compact && <div className="mt-3 flex gap-2"><button className={`${btn} ${P} flex-1`} onClick={onAdd}>Add to gap</button><button className={`${btn} ${S}`} onClick={onWhy}>Why it fits</button></div>}
    {compact && <div className="mt-2 flex gap-2"><button className={`${btn} ${P} flex-1 !min-h-10 text-sm`} onClick={onAdd}>Add</button><button className={`${btn} ${S} !min-h-10 text-sm`} onClick={onWhy}>Why it fits</button></div>}
  </div>;
}
function AssignedState({ a, acts, onUndo, onDone }: { a: Assign; acts: Activity[]; onUndo: () => void; onDone?: () => void }) {
  const act = a.kind === 'act' ? acts.find(x => x.id === a.id) : null;
  return <div className={`flex items-center gap-3 rounded-xl p-3 ${a.kind === 'open' ? 'bg-[#e2eff0]' : a.kind === 'skip' ? 'bg-[#efede8]' : 'bg-[#f8ecc8]'}`}>
    {a.kind === 'open' ? <Leaf size={18} className="text-[#2b6b72]" /> : a.kind === 'skip' ? <Clock size={18} /> : <Check size={18} className="text-[#7a5a0c]" />}
    <div className="flex-1 text-sm"><b>{a.kind === 'open' ? 'Kept open' : a.kind === 'skip' ? 'Skipped for now' : `Planned: ${a.title}${act?.done ? ' · Done' : ''}`}</b><div className="text-[#4a4f58]">{a.kind === 'open' ? 'Rest, socialize, or decide later.' : a.kind === 'skip' ? 'You can decide later.' : 'You can change this anytime.'}</div></div>
    {a.kind === 'act' && onDone && !act?.done && <button className={`${btn} ${S} !px-3 text-sm`} onClick={onDone}>Done</button>}
    <button className={`${btn} !px-3 text-sm text-[#1f5c43] underline`} onClick={onUndo}>Change</button></div>;
}
export function EmptyGapState({ g, onOpen }: { g: Gap; onOpen: () => void }) {
  return <div className="rounded-xl border border-[#d9d4c7] bg-white p-3 text-sm"><div className="flex items-center gap-2 font-bold"><Navigation size={16} />{g.usable <= 0 ? 'Start moving now' : 'No extra activity recommended'}</div>
    <p className="mt-1 text-[#4a4f58]">Best use of this gap: Head to {g.next.location}.{g.usable > 0 && ' Or rest nearby — nothing else fits comfortably.'}</p>
    {g.usable > 0 && <button className={`${btn} ${S} mt-2 w-full`} onClick={onOpen}>Keep this gap open</button>}</div>;
}
export function GapCard({ g, st, onDetail, onAdd, onWhy, onKeep, onUndo, onDone }: { g: Gap; st: St; onDetail: () => void; onAdd: (e: Eval) => void; onWhy: (e: Eval) => void; onKeep: () => void; onUndo: () => void; onDone: (id: string) => void }) {
  const { fits } = rank(st.acts, g, st.prefs); const a = st.assign[g.key];
  return <div className="relative my-3 ml-5 rounded-2xl border-2 border-dashed border-[#bcd3c4] bg-gradient-to-b from-[#f1f8f3] to-[#fbf8f1] p-4 before:absolute before:-left-[22px] before:top-0 before:h-full before:border-l-2 before:border-dotted before:border-[#bcd3c4] before:content-['']">
    <button onClick={onDetail} className="block w-full text-left"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#4a4f58]">{dur(g.total)} gap · {fmt(g.start)}–{fmt(g.end)}</span><ChevronRight size={18} /></div>
      <UsableTimeBreakdown g={g} /><div className="mt-1 text-sm text-[#4a4f58]">Next: <b className="text-[#1b2433]">{g.next.title}</b> at {fmt(g.next.start)}, {g.next.location}</div></button>
    <div className="mt-3 space-y-2">
      {a ? <AssignedState a={a} acts={st.acts} onUndo={onUndo} onDone={a.kind === 'act' ? () => onDone(a.id) : undefined} /> : fits.length === 0 ? <EmptyGapState g={g} onOpen={onKeep} /> : <>
        <div className="text-xs font-bold uppercase tracking-wide text-[#4a4f58]">Good fits</div>
        {fits.slice(0, 3).map(e => <RecommendationCard compact key={e.a.id} e={e} onAdd={() => onAdd(e)} onWhy={() => onWhy(e)} />)}
        <div className="flex gap-2"><button className={`${btn} ${S} flex flex-1 items-center justify-center gap-1.5 text-sm`} onClick={onKeep}><Armchair size={16} />Take a break nearby</button><button className={`${btn} ${S} text-sm`} onClick={onDetail}>See all options</button></div></>}
    </div></div>;
}
export function NowCard({ g, st, now, onAdd, onWhy, onKeep }: { g: Gap; st: St; now: number; onAdd: (e: Eval) => void; onWhy: (e: Eval) => void; onKeep: () => void }) {
  const ng = { ...g, start: now, total: g.end - now, usable: Math.max(0, g.end - now - g.travel - g.buffer) };
  const fits = st.acts.filter(a => !a.done).map(a => evaluate(a, ng, st.prefs)).filter(e => e.fit !== 'none').sort((a, b) => b.score - a.score).slice(0, 3);
  return <div className="mb-4 rounded-2xl border-2 border-[#d9a84a] bg-[#fdf6e3] p-4 anim-fade">
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#7a5a0c]"><Sun size={14} />Now · {fmt(now)}</div>
    <div className="mt-1 text-2xl font-extrabold leading-tight">You have <span className="text-[#1f5c43]">{ng.usable} usable minutes</span> right now.</div>
    <div className="mt-1 text-sm text-[#4a4f58]">Next: <b className="text-[#1b2433]">{g.next.title}</b> at {fmt(g.next.start)}, {g.next.location} · {g.travel} min walk + {g.buffer} min buffer</div>
    <div className="mt-3 space-y-2">{fits.length === 0 ? <EmptyGapState g={ng} onOpen={onKeep} /> : fits.map(e => <RecommendationCard compact key={e.a.id} e={e} onAdd={() => onAdd(e)} onWhy={() => onWhy(e)} />)}
      {fits.length > 0 && <button className={`${btn} ${S} flex w-full items-center justify-center gap-1.5`} onClick={onKeep}><Armchair size={16} />Sit nearby / keep this time open</button>}</div></div>;
}
function WhySheet({ e, g, onClose, onAdd }: { e: Eval; g: Gap; onClose: () => void; onAdd: () => void }) {
  const rows: [string, string][] = [[`${e.a.title}`, `${e.a.duration} min`], [`Walk to ${e.a.locations.length ? e.loc : 'spot'}`, `${e.t1} min`], [`${e.a.locations.length ? e.loc : 'Here'} → ${g.next.location}`, `${e.t2} min`], ['Your buffer', `${g.buffer} min`]];
  return <Sheet title={`Why ${e.a.title} ${e.fit === 'none' ? "doesn't fit" : 'fits'}`} onClose={onClose}>
    <p className="text-[15px]">You have <b>{dur(g.end - g.start)}</b> before {g.next.title} ({g.usable} usable after direct travel and buffer).</p>
    <div className="mt-3 flex items-center gap-3"><ActIcon id={e.a.id} size={48} /><div className="text-sm text-[#4a4f58]">{e.a.locations.length ? e.loc : 'Nearby spot'} · before {fmt(g.next.start)}</div></div>
    <div className="relative mt-3 divide-y divide-dashed divide-[#d9d4c7] rounded-t-2xl border border-b-0 border-[#d9d4c7] bg-white px-4 pt-1 shadow-sm [mask-image:linear-gradient(#000,#000)] after:absolute after:inset-x-0 after:-bottom-2 after:h-2 after:bg-[radial-gradient(circle_at_6px_0,transparent_5px,#fff_5.5px)] after:bg-[size:12px_8px] after:content-['']"><div className="py-2 text-center text-xs font-bold uppercase tracking-[.2em] text-[#9aa3ad]">Time receipt</div>{rows.map(([l, v]) => <div key={l} className="flex justify-between py-2.5 text-[15px]"><span>{l}</span><b>{v}</b></div>)}
      <div className="flex justify-between py-3 text-[16px]"><span className="font-bold">{e.remaining >= 0 ? 'Estimated extra time' : 'Short by about'}</span><b className="text-[#1f5c43]">{Math.abs(e.remaining)} min</b></div></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><FitBadge fit={e.fit} /><PriorityTag p={e.a.priority} />{e.a.deadline != null && <span className="text-sm">Due {fmt(e.a.deadline)}</span>}</div>
    <p className="mt-2 text-sm text-[#4a4f58]">{e.reason} Walking times are estimates.</p>
    {e.fit !== 'none' && <button className={`${btn} ${P} mt-4 w-full`} onClick={onAdd}>Add to gap</button>}
  </Sheet>;
}
function laterFits(a: Activity, st: St, excl: string) {
  for (const d of [0, 1, 2]) for (const g of gapsFor(st.cs, d, st.prefs)) if (g.key !== excl && evaluate(a, g, st.prefs).fit !== 'none') return g;
  return null;
}
function GapDetail({ g, st, onClose, onAdd, onWhy, onKeep, onSkip, goGap }: { g: Gap; st: St; onClose: () => void; onAdd: (e: Eval) => void; onWhy: (e: Eval) => void; onKeep: () => void; onSkip: () => void; goGap: (g: Gap) => void }) {
  const { fits, no } = rank(st.acts, g, st.prefs); const [sel, setSel] = useState<Eval | undefined>(fits[0]); const cb = combos(fits, g, st.prefs);
  return <div className="detail-panel absolute inset-0 z-30 overflow-y-auto bg-[#fbf8f1] pb-10 anim-up">
    <div className="detail-panel-header sticky top-0 z-10 flex items-center gap-2 border-b border-[#e6e1d4] bg-[#fbf8f1]/95 px-4 pb-3 pt-12 backdrop-blur"><button aria-label="Back" onClick={onClose} className="flex size-11 items-center justify-center rounded-full hover:bg-black/5"><X size={20} /></button>
      <div><div className="text-[15px] font-bold">{fmt(g.start)} → {fmt(g.end)}</div><div className="text-sm text-[#4a4f58]">{g.prev.location} → {g.next.location}</div></div></div>
    <div className="space-y-5 p-4">
      <section className="relative overflow-hidden rounded-3xl border border-[#bcd3c4] bg-gradient-to-br from-[#eaf4ee] via-[#f6faf7] to-[#fdf6e3] p-4"><svg className="pointer-events-none absolute -right-6 -top-6 opacity-30" width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="55" fill="none" stroke="#1f5c43" strokeWidth="2" strokeDasharray="3 7" /><circle cx="65" cy="65" r="30" fill="#d9a84a" opacity=".25" /></svg><div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-[#1f5c43]"><Clock size={12} />How much time do I really have?</div><UsableTimeBreakdown g={g} /><div className="mt-1 mb-3 text-sm">Next: <b>{g.next.title}</b> at {fmt(g.next.start)}</div><GapBar g={g} e={sel} />{sel && <div className="mt-1 text-xs text-[#4a4f58]">Showing: {sel.a.title}. Tap an option to compare.</div>}</section>
      <section><h3 className="mb-2 flex items-center gap-2 font-bold"><span className="flex size-7 items-center justify-center rounded-lg bg-[#e2eff0] text-[#2b6b72]"><Footprints size={15} /></span>Route</h3><RouteView g={g} e={sel} /></section>
      <section><h3 className="mb-2 flex items-center gap-2 text-lg font-bold"><span className="flex size-7 items-center justify-center rounded-lg bg-[#f8ecc8] text-[#7a5a0c]"><Sparkles size={15} /></span>What fits?</h3>
        {fits.length === 0 && <EmptyGapState g={g} onOpen={onKeep} />}
        <div className="space-y-2">{fits.map(e => <div key={e.a.id} onClick={() => setSel(e)} className={`rounded-2xl ${sel?.a.id === e.a.id ? 'ring-2 ring-[#d9a84a]' : ''}`}><RecommendationCard e={e} onAdd={() => onAdd(e)} onWhy={() => onWhy(e)} /></div>)}</div></section>
      {cb.length > 0 && <section><h3 className="mb-2 flex items-center gap-2 font-bold"><span className="flex size-7 items-center justify-center rounded-lg bg-[#e3efe8] text-[#1f5c43]"><Plus size={15} /></span>Combos that fit</h3>{cb.map(c => <div key={c.a.a.id + c.b.a.id} className="mb-2 rounded-2xl border border-[#d9d4c7] bg-white p-3.5"><div className="font-bold">{c.a.a.title} + {c.b.a.title}</div>
        <div className="text-sm text-[#4a4f58]">{c.a.a.duration} + {c.b.a.duration} min + {c.t[0] + c.t[1] + c.t[2]} travel + {g.buffer} buffer · Leaves {c.remaining} min</div><div className="mt-1"><FitBadge fit={c.remaining >= 10 ? 'comfortable' : 'tight'} /></div>
        <button className={`${btn} ${S} mt-2 w-full`} onClick={() => onAdd({ ...c.a, a: { ...c.a.a, id: c.a.a.id, title: `${c.a.a.title} + ${c.b.a.title}` } })}>Add combo to gap</button></div>)}</section>}
      <section className="grid grid-cols-2 gap-2"><button className={`${btn} ${S} flex flex-col items-center justify-center gap-1 py-3`} onClick={onKeep}><Leaf size={18} />Keep this gap open<span className="text-xs font-normal text-[#4a4f58]">Rest, socialize, or decide later</span></button><button className={`${btn} ${S} flex flex-col items-center justify-center gap-1 py-3`} onClick={onSkip}><Clock size={18} />Skip for now<span className="text-xs font-normal text-[#4a4f58]">Decide in the moment</span></button></section>
      {no.length > 0 && <section><h3 className="mb-2 flex items-center gap-2 font-bold"><span className="flex size-7 items-center justify-center rounded-lg bg-[#eceae6] text-[#4a4f58]"><CircleSlash size={15} /></span>Doesn't fit here</h3><div className="space-y-2">{no.map(e => { const lg = laterFits(e.a, st, g.key); return <div key={e.a.id} className="rounded-2xl border border-[#d9d4c7] bg-[#f4f2ed] p-3.5">
        <div className="flex justify-between gap-2"><b>{e.a.title}{e.a.locations.length ? ` at ${e.loc}` : ''}</b><FitBadge fit="none" /></div><p className="mt-1 text-sm">{e.reason}</p>
        <div className="mt-2 flex gap-2"><button className={`${btn} ${S} text-sm`} onClick={() => onWhy(e)}>Why not</button>{lg ? <button className={`${btn} ${S} flex-1 text-sm`} onClick={() => goGap(lg)}>But it fits: {DAYS[lg.day]}, {fmt(lg.start)}–{fmt(lg.end)}</button> : <span className="self-center text-sm text-[#4a4f58]">No open gap fits yet</span>}</div></div>; })}</div></section>}
    </div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>; }
const inp = 'min-h-11 w-full rounded-xl border border-[#d9d4c7] bg-white px-3 text-[15px]';
const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function AddActivitySheet({ init, onSave, onClose }: { init?: Activity; onSave: (a: Activity) => void; onClose: () => void }) {
  const [a, setA] = useState<Activity>(init ?? { id: 'a' + Date.now(), title: '', duration: 20, locations: [], priority: 'should' });
  const [more, setMore] = useState(!!init); const [rec, setRec] = useState('none');
  return <Sheet title={init ? 'Edit activity' : 'Add activity'} onClose={onClose}><div className="space-y-3">
    <Field label="Name"><input autoFocus className={inp} value={a.title} onChange={e => setA({ ...a, title: e.target.value })} placeholder="e.g. Pick up package" /></Field>
    <Field label="Duration (min)"><div className="flex gap-2">{[10, 20, 30, 45, 60].map(d => <button key={d} onClick={() => setA({ ...a, duration: d })} className={`${btn} flex-1 !px-0 ${a.duration === d ? P : S}`}>{d}</button>)}</div></Field>
    <button className="min-h-11 text-sm font-semibold text-[#1f5c43] underline" onClick={() => setMore(!more)}>{more ? 'Fewer details' : 'More details'}</button>
    {more && <div className="space-y-3 anim-fade">
      <Field label="Priority"><div className="flex gap-2">{(['must', 'should', 'optional'] as Priority[]).map(p => <button key={p} onClick={() => setA({ ...a, priority: p })} className={`${btn} flex-1 !px-1 text-sm ${a.priority === p ? P : S}`}>{{ must: 'Must do', should: 'Should do', optional: 'Optional' }[p]}</button>)}</div></Field>
      <Field label="Location"><select className={inp} value={a.locations[0] ?? ''} onChange={e => setA({ ...a, locations: e.target.value ? [e.target.value] : [], flexibleLocation: !e.target.value })}><option value="">Anywhere nearby / current location</option>{LOC_NAMES.map(l => <option key={l}>{l}</option>)}</select></Field>
      <Field label="Deadline (today)"><input type="time" className={inp} value={a.deadline != null ? toStr(a.deadline) : ''} onChange={e => setA({ ...a, deadline: e.target.value ? toMin(e.target.value) : undefined })} /></Field>
      <Field label="Time window"><div className="flex gap-2"><input type="time" className={inp} value={a.preferred ? toStr(a.preferred[0]) : ''} onChange={e => setA({ ...a, preferred: e.target.value ? [toMin(e.target.value), a.preferred?.[1] ?? 1080] : undefined })} /><input type="time" className={inp} value={a.preferred ? toStr(a.preferred[1]) : ''} onChange={e => setA({ ...a, preferred: e.target.value ? [a.preferred?.[0] ?? 480, toMin(e.target.value)] : undefined })} /></div>
        <div className="mt-2 flex gap-2">{[['Preferred (soft)', false], ['Required (hard)', true]].map(([l, v]) => <button key={String(l)} onClick={() => setA({ ...a, required: v as boolean })} className={`${btn} flex-1 text-sm ${!!a.required === v ? P : S}`}>{l}</button>)}</div></Field>
      <Field label="Recurrence"><select className={inp} value={rec} onChange={e => setRec(e.target.value)}><option value="none">Doesn't repeat</option><option>Daily</option><option>Weekly</option></select></Field>
      <Field label="Notes"><input className={inp} value={a.notes ?? ''} onChange={e => setA({ ...a, notes: e.target.value })} /></Field></div>}
    <button disabled={!a.title.trim()} className={`${btn} ${P} w-full disabled:opacity-40`} onClick={() => onSave(a)}>Save Activity</button></div></Sheet>;
}
const DCH = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];
function AddCommitmentSheet({ init, day, onSave, onClose, onCancel }: { init?: Commitment; day: number; onSave: (c: Commitment) => void; onClose: () => void; onCancel?: () => void }) {
  const [c, setC] = useState<Commitment>(init ?? { id: 'c' + Date.now(), title: '', start: 840, end: 900, location: 'Gibson Hall', day, recurrence: [], type: 'class' });
  return <Sheet title={init ? 'Edit commitment' : 'Add commitment'} onClose={onClose}><div className="space-y-3">
    <Field label="Title"><input className={inp} value={c.title} onChange={e => setC({ ...c, title: e.target.value })} placeholder="e.g. Office hours" /></Field>
    <div className="flex gap-2"><Field label="Start"><input type="time" className={inp} value={toStr(c.start)} onChange={e => setC({ ...c, start: toMin(e.target.value) })} /></Field><Field label="End"><input type="time" className={inp} value={toStr(c.end)} onChange={e => setC({ ...c, end: toMin(e.target.value) })} /></Field></div>
    <Field label="Location"><select className={inp} value={c.location} onChange={e => setC({ ...c, location: e.target.value })}>{LOC_NAMES.map(l => <option key={l}>{l}</option>)}</select></Field>
    <Field label="Repeat"><div className="flex gap-1">{DCH.map(d => <button key={d} aria-pressed={c.recurrence.includes(d)} onClick={() => setC({ ...c, recurrence: c.recurrence.includes(d) ? c.recurrence.filter(x => x !== d) : [...c.recurrence, d] })} className={`${btn} flex-1 !px-0 text-sm ${c.recurrence.includes(d) ? P : S}`}>{d}</button>)}</div></Field>
    <Field label="Buffer before this (optional override)"><select className={inp} value={c.buffer ?? ''} onChange={e => setC({ ...c, buffer: e.target.value === '' ? undefined : Number(e.target.value) })}><option value="">Use default</option>{[0, 5, 10, 15].map(b => <option key={b} value={b}>{b} min</option>)}</select></Field>
    <button disabled={!c.title.trim() || c.end <= c.start} className={`${btn} ${P} w-full disabled:opacity-40`} onClick={() => onSave(c)}>{init ? 'Save changes' : 'Add to schedule'}</button>
    {onCancel && <button className={`${btn} ${S} w-full`} onClick={onCancel}>{init?.canceled ? 'Restore commitment' : 'Mark canceled'}</button>}</div></Sheet>;
}
export function ChangeBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="mb-3 flex items-start gap-2 rounded-2xl border border-[#5f9ea0] bg-[#e2eff0] p-3 text-sm anim-fade" role="status"><Info size={18} className="mt-0.5 shrink-0 text-[#2b6b72]" /><div className="flex-1"><b>Your day changed.</b> {text}</div><button aria-label="Dismiss" onClick={onClose} className="flex size-9 items-center justify-center"><X size={16} /></button></div>;
}
export function BufferSelector({ v, onChange }: { v: number; onChange: (n: number) => void }) {
  const [custom, setCustom] = useState(![0, 5, 10, 15].includes(v));
  return <div><div className="flex gap-2">{[0, 5, 10, 15].map(b => <button key={b} aria-pressed={v === b && !custom} onClick={() => { setCustom(false); onChange(b); }} className={`${btn} flex-1 !px-0 ${v === b && !custom ? P : S}`}>{b}</button>)}<button onClick={() => setCustom(true)} className={`${btn} !px-2 text-sm ${custom ? P : S}`}>Custom</button></div>
    {custom && <input type="number" min={0} max={30} className={`${inp} mt-2`} value={v} onChange={e => onChange(Math.max(0, Number(e.target.value)))} />}</div>;
}
export function ActivityCard({ a, onClick }: { a: Activity; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-[#d9d4c7] bg-white p-4 text-left hover:bg-[#f7f4ec]">
    <ActIcon id={a.id} size={46} /><div className="flex-1"><div className={`text-[16px] font-bold ${a.done ? 'line-through opacity-60' : ''}`}>{a.title}{a.done && ' · Done'}</div><div className="text-sm text-[#4a4f58]">{a.duration} min · {a.locations.length ? a.locations.join(' / ') : 'Any nearby spot'}{a.deadline != null ? ` · Due ${fmt(a.deadline)}` : ''}</div><div className="mt-1.5"><PriorityTag p={a.priority} /></div></div><ChevronRight size={18} /></button>;
}
export function BottomNav({ tab, set }: { tab: string; set: (t: string) => void }) {
  const t = [['today', 'Today', MapIcon], ['plan', 'Plan', CalendarDays], ['acts', 'Activities', ListTodo], ['settings', 'Settings', Cog]] as const;
  return <nav className="app-navigation" aria-label="Main navigation">{t.map(([k, l, I]) => <Button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => set(k)} className={`app-nav-item ${tab === k ? 'is-active' : ''}`}><I size={17} strokeWidth={1.8} /><span>{l}</span>{tab === k && <i className="nav-active-dot" />}</Button>)}</nav>;
}
function Onboarding({ done }: { done: (buf: number, imp: boolean) => void }) {
  const [i, setI] = useState(0); const [buf, setBuf] = useState(5); const [imp, setImp] = useState(false); const [chips, setChips] = useState<string[]>(['Lunch', 'Study']);
  return <div className="flex h-full flex-col bg-[radial-gradient(circle_at_85%_10%,#f3e3b5_0,transparent_35%),radial-gradient(circle_at_0%_90%,#d6e8dc_0,transparent_40%)] p-6 pt-14">
    <div className="flex justify-between"><span className="text-sm font-bold text-[#1f5c43]">Gapwise</span><button className="min-h-11 px-2 text-sm font-semibold underline" onClick={() => done(5, false)}>Skip</button></div>
    <div key={i} className="flex flex-1 flex-col justify-center anim-fade">
      {i === 0 && <><div className="mb-8 rounded-3xl border border-[#d9d4c7] bg-white p-5"><div className="text-sm text-[#4a4f58]">Calendar says</div><div className="text-2xl font-bold text-[#9aa3ad] line-through">60 min free</div><div className="my-3 flex h-4 overflow-hidden rounded-full"><div className="w-[70%] bg-[#1f5c43]" /><div className="w-[22%] bg-[#5f9ea0]" /><div className="w-[8%] bg-[#9aa3ad]" /></div><div className="text-sm text-[#4a4f58]">Gapwise says</div><div className="text-4xl font-extrabold text-[#1f5c43]">42 usable min</div><div className="text-xs text-[#4a4f58]">after 13 min walking + 5 min buffer</div></div>
        <h1 className="text-3xl font-extrabold leading-tight">Your calendar shows free time. Gapwise shows usable time.</h1></>}
      {i === 1 && <><div className="relative mb-8 h-40">{[['lunch', 'left-2 top-4 -rotate-6'], ['study', 'left-28 top-0 rotate-3'], ['workout', 'right-4 top-6 rotate-6'], ['coffee', 'left-14 top-20 rotate-2'], ['print', 'right-16 top-24 -rotate-3']].map(([id, c]) => <div key={id} className={`absolute ${c} rounded-2xl border border-[#e3ddcd] bg-white p-2 shadow-md`}><ActIcon id={id} size={52} /></div>)}</div><h1 className="mb-6 text-3xl font-extrabold leading-tight">Add what you want to get done.</h1><div className="flex flex-wrap gap-2">{['Lunch', 'Study', 'Workout', 'Errands', 'Rest'].map(c => <button key={c} aria-pressed={chips.includes(c)} onClick={() => setChips(chips.includes(c) ? chips.filter(x => x !== c) : [...chips, c])} className={`${btn} rounded-full ${chips.includes(c) ? P : S}`}>{chips.includes(c) && <Check size={14} className="mr-1 inline" />}{c}</button>)}</div><p className="mt-4 text-[#4a4f58]">Rest counts too. You can edit these anytime.</p></>}
      {i === 2 && <><svg viewBox="0 0 300 110" className="mb-6 w-full"><path d="M30 80 C 90 10, 150 110, 210 40 S 270 30, 280 30" fill="none" stroke="#5f9ea0" strokeWidth="3" strokeDasharray="6 7" />{[[30, 80, '#1b2433', 'Here'], [150, 62, '#d9a84a', 'Stop'], [280, 30, '#1f5c43', 'Next']].map(([x, y, c, l]) => <g key={String(l)}><circle cx={Number(x)} cy={Number(y)} r="11" fill={String(c)} /><text x={Number(x)} y={Number(y) + 28} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1b2433">{l}</text></g>)}</svg><h1 className="mb-6 text-3xl font-extrabold leading-tight">We'll account for where you are and where you need to be next.</h1>
        <div className="space-y-4 rounded-3xl border border-[#d9d4c7] bg-white p-4"><Field label="Default arrival buffer (min)"><BufferSelector v={buf} onChange={setBuf} /></Field><div className="flex items-center justify-between text-[15px]"><span className="flex items-center gap-2"><Footprints size={18} />Travel mode</span><b>Walking</b></div>
          <button onClick={() => setImp(!imp)} className={`${btn} w-full ${imp ? P : S}`}>{imp ? 'Calendar imported (simulated) ✓' : 'Import calendar (optional)'}</button></div></>}
    </div>
    <div className="mb-4 flex justify-center gap-2">{[0, 1, 2].map(k => <i key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-[#1f5c43]' : 'w-2 bg-[#d9d4c7]'}`} />)}</div>
    <button className={`${btn} ${P} w-full`} onClick={() => i < 2 ? setI(i + 1) : done(buf, imp)}>{i < 2 ? 'Next' : 'Set up my day'}</button></div>;
}

export default function App() {
  const [st, setSt] = useState<St>(() => { try { const s = sessionStorage.getItem('gw'); if (s) return JSON.parse(s); } catch { /**/ } return fresh(); });
  useEffect(() => { sessionStorage.setItem('gw', JSON.stringify(st)); }, [st]);
  const [tab, setTab] = useState('today'); const [detail, setDetail] = useState<Gap | null>(null); const [why, setWhy] = useState<{ e: Eval; g: Gap } | null>(null);
  const [banner, setBanner] = useState(''); const [sheet, setSheet] = useState<null | { k: 'act'; a?: Activity } | { k: 'com'; c?: Commitment; day: number }>(null);
  const [actDetail, setActDetail] = useState<string | null>(null); const [planDay, setPlanDay] = useState(0); const [toast, setToast] = useState('');
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2200); };
  const up = (p: Partial<St>) => setSt(s => ({ ...s, ...p }));
  const allGaps = (s: St) => [0, 1, 2].flatMap(d => gapsFor(s.cs, d, s.prefs));
  const gapsToday = useMemo(() => gapsFor(st.cs, 0, st.prefs), [st]);
  const assign = (g: Gap, a: Assign | null) => { setSt(s => { const n = { ...s.assign }; if (a) n[g.key] = a; else delete n[g.key]; return { ...s, assign: n }; }); setDetail(null); setWhy(null); if (a) flash(a.kind === 'act' ? `${a.title} added to ${fmt(g.start)} gap` : a.kind === 'open' ? 'Gap kept open' : 'Skipped for now'); };
  const addE = (g: Gap) => (e: Eval) => assign(g, { kind: 'act', id: e.a.id, title: e.a.title });
  const changeCommit = (next: Commitment[], msg: (before: Gap[], after: Gap[]) => string) => { const s2 = { ...st, cs: next }; const b = allGaps(st), a = allGaps(s2); setSt(s2); setBanner(msg(b, a)); setSheet(null); setTab('today'); };
  const toggleCancel = (c: Commitment) => changeCommit(st.cs.map(x => x.id === c.id ? { ...x, canceled: !x.canceled } : x), (_b, a) => { const g = a.find(g => g.day === c.day && g.start <= c.start && g.end >= c.end); return c.canceled ? `${c.title} was restored. Gaps recalculated.` : `Your ${fmt(c.start)} ${c.title} was canceled.${g ? ` You now have ${dur(g.total)} available (${g.usable} min usable).` : ''}`; });
  const saveCommit = (c: Commitment) => changeCommit(st.cs.some(x => x.id === c.id) ? st.cs.map(x => x.id === c.id ? c : x) : [...st.cs, c], (b, a) => { const lost = st.acts.filter(x => !x.done && b.some(g => g.day === c.day && evaluate(x, g, st.prefs).fit !== 'none') && !a.some(g => g.day === c.day && evaluate(x, g, { ...st.prefs }).fit !== 'none')); return `${c.title} (${fmt(c.start)}–${fmt(c.end)}) is on your schedule.${lost.length ? ` ${lost.map(l => l.title).join(', ')} no longer fits ${DAYS[c.day].toLowerCase()}.` : ' Gaps recalculated.'}`; });
  const day = (d: number) => st.cs.filter(c => c.day === d).sort((a, b) => a.start - b.start);

  const Timeline = ({ d }: { d: number }) => { const gs = gapsFor(st.cs, d, st.prefs); const items = day(d); return <div>{items.map(c => { const g = gs.find(x => x.prev.id === c.id); return <div key={c.id}><CommitmentBlock c={c} onMenu={() => setSheet({ k: 'com', c, day: d })} />{g && <GapCard g={g} st={st} onDetail={() => setDetail(g)} onAdd={addE(g)} onWhy={e => setWhy({ e, g })} onKeep={() => assign(g, { kind: 'open' })} onUndo={() => assign(g, null)} onDone={id => { up({ acts: st.acts.map(a => a.id === id ? { ...a, done: true } : a) }); flash('Marked done'); }} />}</div>; })}
    {items.length === 0 && <p className="py-8 text-center text-[#4a4f58]">No commitments. The whole day is open.</p>}</div>; };

  const ad = st.acts.find(a => a.id === actDetail);
  return <div className="gapwise-app">
      {!st.onboarded ? <div className="onboarding-wrap"><Onboarding done={(buf, imp) => { up({ onboarded: true, prefs: { ...st.prefs, buffer: buf } }); if (imp) flash('Calendar imported (demo data)'); }} /></div> : <>
        <header className="app-header">
          <Button className="app-brand" aria-label="Gapwise home" onClick={() => { setTab('today'); setDetail(null); setActDetail(null); }}>
            <span className="brand-symbol"><svg viewBox="0 0 32 32" width="27" height="27" aria-hidden="true"><path d="M8 5v14a8 8 0 0 0 16 0V5M8 11h16" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /><path d="M13 6h6" className="brand-symbol-gap" strokeWidth="3.2" strokeLinecap="round" /></svg></span><span className="brand-wordmark">gapwise<span className="brand-period">.</span></span><span className="brand-tagline">Make the space<br />between count.</span>
          </Button>
          <BottomNav tab={tab} set={t => { setTab(t); setDetail(null); setActDetail(null); }} />
          <div className="header-right"><span className="header-local-demo"><i />LOCAL DEMO</span><span className="header-personal-note">A little less rush.</span><span className="profile-mark" aria-label="Your local demo">Y</span></div>
        </header>
        <div className="app-body">
          {tab === 'today' ? <CampusToday key={st.scenario} commitments={st.cs} gaps={gapsToday} activities={st.acts} prefs={st.prefs} now={st.now} assignments={st.assign} banner={banner ? <ChangeBanner text={banner} onClose={() => setBanner('')} /> : undefined} onTimeChange={now => up({ now })} onCommitment={c => setSheet({ k: 'com', c, day: c.day })} onAddCommitment={() => setSheet({ k: 'com', day: 0 })} onDetail={setDetail} onWhy={(g, e) => setWhy({ e, g })} onAssign={assign} onDone={id => { up({ acts: st.acts.map(a => a.id === id ? { ...a, done: true } : a) }); flash('Marked done'); }} /> : <div className="app-content anim-fade"><div className="content-page">
          {tab === 'plan' && <><h1 className="text-2xl font-extrabold">Plan</h1><p className="mb-3 text-sm text-[#4a4f58]">Optional. Assign something to a future gap or leave it unplanned.</p>
            <div className="mb-4 flex gap-2">{DAYS.map((d, i) => <button key={d} aria-pressed={planDay === i} onClick={() => setPlanDay(i)} className={`${btn} flex-1 !px-1 text-sm ${planDay === i ? P : S}`}>{d}</button>)}</div>
            <Timeline d={planDay} /><button className={`${btn} ${S} mt-3 w-full`} onClick={() => setSheet({ k: 'com', day: planDay })}>+ Add commitment on {DAYS[planDay]}</button></>}
          {tab === 'acts' && <><div className="mb-3 flex items-end justify-between"><h1 className="text-2xl font-extrabold">Activities</h1><button className={`${btn} ${P} flex items-center gap-1 !px-3 text-sm`} onClick={() => setSheet({ k: 'act' })}><Plus size={16} />Add Activity</button></div>
            <div className="space-y-2">{st.acts.map(a => <ActivityCard key={a.id} a={a} onClick={() => setActDetail(a.id)} />)}<div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#d9d4c7] p-4 text-[#4a4f58]"><Armchair size={18} /><div><b className="text-[#1b2433]">Take a break</b><div className="text-sm">Flexible · always a valid option in any gap</div></div></div></div></>}
          {tab === 'settings' && <div className="space-y-5"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1b2433] to-[#2b6b72] p-5 text-white"><Cog className="absolute -right-4 -top-4 opacity-10" size={110} /><div className="text-xs font-semibold uppercase tracking-widest text-[#f3d27a]">Your assumptions</div><h1 className="text-2xl font-extrabold">Settings</h1><p className="mt-1 text-sm text-white/80">Buffer {st.prefs.buffer} min · {st.prefs.pace} walking pace</p></div>
            <section className="rounded-2xl border border-[#d9d4c7] bg-white p-4"><h2 className="flex items-center gap-2 font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#e3efe8] text-[#1f5c43]"><ShieldCheck size={16} /></span>Default arrival buffer (min)</h2><p className="mb-3 text-sm text-[#4a4f58]">Buffer is time reserved before your next commitment so recommendations don't assume you want to arrive at the exact start time. Override per event from a commitment's menu.</p><BufferSelector v={st.prefs.buffer} onChange={b => up({ prefs: { ...st.prefs, buffer: b } })} />
              {gapsToday[0] && <p className="mt-3 rounded-xl bg-[#f3f8f4] p-2 text-sm">Preview: your {fmt(gapsToday[0].start)} gap is now <b>{gapsToday[0].usable} min usable</b>.</p>}</section>
            <section className="rounded-2xl border border-[#d9d4c7] bg-white p-4"><h2 className="mb-1 flex items-center gap-2 font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#e2eff0] text-[#2b6b72]"><Footprints size={16} /></span>Travel</h2><p className="mb-2 text-sm text-[#4a4f58]">Mode: Walking. All times are estimated walking times.</p><div className="flex gap-2">{(['relaxed', 'normal', 'brisk'] as const).map(p => <button key={p} onClick={() => up({ prefs: { ...st.prefs, pace: p } })} className={`${btn} flex-1 !px-1 text-sm capitalize ${st.prefs.pace === p ? P : S}`}>{p} pace</button>)}</div>
              <button aria-pressed={st.prefs.avoidLong} onClick={() => up({ prefs: { ...st.prefs, avoidLong: !st.prefs.avoidLong } })} className={`${btn} ${S} mt-2 flex w-full items-center justify-between`}><span className="flex items-center gap-2"><ShieldCheck size={18} />Prefer accessible routes / avoid long walks</span><b>{st.prefs.avoidLong ? 'On' : 'Off'}</b></button></section>
            <section className="rounded-2xl border border-[#d9d4c7] bg-white p-4"><h2 className="mb-2 flex items-center gap-2 font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#f8ecc8] text-[#7a5a0c]"><CalendarDays size={16} /></span>Planning style</h2><div className="flex gap-2">{([['ahead', 'Plan ahead'], ['moment', 'Decide in the moment']] as const).map(([k, l]) => <button key={k} onClick={() => up({ prefs: { ...st.prefs, style: k } })} className={`${btn} flex-1 !px-1 text-sm ${st.prefs.style === k ? P : S}`}>{l}</button>)}</div></section>
            <section className="rounded-2xl border border-[#d9a84a] bg-[#fdf6e3] p-4"><h2 className="mb-2 flex items-center gap-2 font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#7a5a0c]"><Sparkles size={16} /></span>Demo scenario</h2><div className="space-y-2">{Object.entries(SCENARIOS).map(([k, v]) => <button key={k} aria-pressed={st.scenario === k} onClick={() => { setSt(fresh(k, st.prefs)); setBanner(''); setTab('today'); flash(`Loaded: ${v.label}`); }} className={`${btn} w-full text-left ${st.scenario === k ? P : S}`}>{v.label}</button>)}</div>
              <button className={`${btn} ${S} mt-3 w-full`} onClick={() => saveCommit({ id: 'm' + Date.now(), title: 'New meeting · Advisor', start: 900, end: 960, location: 'Richardson Memorial', day: 0, recurrence: [], type: 'meeting' })}>Simulate: new meeting added 3–4 PM</button>
              <button className={`${btn} ${S} mt-2 w-full`} onClick={() => { setSt({ ...fresh('default'), onboarded: false }); setBanner(''); setTab('today'); }}>Reset demo data</button></section></div>}
        </div></div>}
        {detail && (() => { const original = allGaps(st).find(x => x.key === detail.key) ?? detail; const g = original.day === 0 ? gapAtTime(original, st.now) : original; return <GapDetail key={g.key + st.prefs.buffer} g={g} st={st} onClose={() => setDetail(null)} onAdd={addE(g)} onWhy={e => setWhy({ e, g })} onKeep={() => assign(g, { kind: 'open' })} onSkip={() => assign(g, { kind: 'skip' })} goGap={lg => { setDetail(null); setTab(lg.day === 0 ? 'today' : 'plan'); setPlanDay(lg.day); setTimeout(() => setDetail(lg), 50); }} />; })()}
        {ad && <div className="detail-panel activity-detail-panel absolute inset-0 z-30 overflow-y-auto bg-[#fbf8f1] px-4 pb-10 pt-12 anim-up"><button aria-label="Back" onClick={() => setActDetail(null)} className="flex size-11 items-center justify-center rounded-full hover:bg-black/5"><X size={20} /></button>
          <h1 className="text-2xl font-extrabold">{ad.title}</h1><div className="my-2"><PriorityTag p={ad.priority} /></div>
          <dl className="divide-y divide-[#e6e1d4] rounded-2xl border border-[#d9d4c7] bg-white px-4 text-[15px]">{([['Duration', `${ad.duration} min`], ['Deadline', ad.deadline != null ? fmt(ad.deadline) : 'None'], [ad.required ? 'Required window' : 'Preferred window', ad.preferred ? `${fmt(ad.preferred[0])}–${fmt(ad.preferred[1])}` : 'Any time'], ['Location', ad.locations.length ? ad.locations.join(' or ') : 'Any nearby spot / current location'], ['Availability', ad.required ? 'Only in window' : 'Open']] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2.5"><dt className="text-[#4a4f58]">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}</dl>
          <h2 className="mb-2 mt-5 font-bold">Gaps where it fits</h2><div className="space-y-2">{allGaps(st).map(g => ({ g, e: evaluate(ad, g, st.prefs) })).filter(x => x.e.fit !== 'none').map(({ g, e }) => <button key={g.key} onClick={() => { setActDetail(null); setTab(g.day === 0 ? 'today' : 'plan'); setPlanDay(g.day); setDetail(g); }} className="flex w-full items-center justify-between rounded-xl border border-[#d9d4c7] bg-white p-3 text-left"><span><b>{DAYS[g.day]}, {fmt(g.start)}–{fmt(g.end)}</b><span className="block text-sm text-[#4a4f58]">Leaves {e.remaining} min</span></span><FitBadge fit={e.fit} /></button>)}
            {allGaps(st).every(g => evaluate(ad, g, st.prefs).fit === 'none') && <p className="text-sm text-[#4a4f58]">No current gap fits. Try a shorter duration or another day.</p>}</div>
          <div className="mt-5 grid grid-cols-3 gap-2"><button className={`${btn} ${P}`} onClick={() => { up({ acts: st.acts.map(a => a.id === ad.id ? { ...a, done: !a.done } : a) }); flash(ad.done ? 'Marked not done' : 'Marked done'); }}>{ad.done ? 'Undo' : 'Done'}</button><button className={`${btn} ${S}`} onClick={() => setSheet({ k: 'act', a: ad })}>Edit</button><button className={`${btn} ${S}`} onClick={() => { up({ acts: st.acts.filter(a => a.id !== ad.id) }); setActDetail(null); flash('Activity deleted'); }}>Delete</button></div></div>}
        {why && <WhySheet e={why.e} g={why.g} onClose={() => setWhy(null)} onAdd={() => assign(why.g, { kind: 'act', id: why.e.a.id, title: why.e.a.title })} />}
        {sheet?.k === 'act' && <AddActivitySheet init={sheet.a} onClose={() => setSheet(null)} onSave={a => { up({ acts: st.acts.some(x => x.id === a.id) ? st.acts.map(x => x.id === a.id ? a : x) : [...st.acts, a] }); setSheet(null); flash('Saved — recommendations updated'); }} />}
        {sheet?.k === 'com' && <AddCommitmentSheet init={sheet.c} day={sheet.day} onClose={() => setSheet(null)} onSave={saveCommit} onCancel={sheet.c ? () => toggleCancel(sheet.c!) : undefined} />}
        {toast && <div className="app-toast absolute inset-x-6 bottom-28 z-50 flex items-center gap-2 rounded-xl bg-[#1b2433] p-3 text-sm text-white anim-fade" role="status"><Check size={16} />{toast}</div>}
        </div>
      </>}
    </div>;
}
void BASE_ACTS; void travel; void Coffee;
