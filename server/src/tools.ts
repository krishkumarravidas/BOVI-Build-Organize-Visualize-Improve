/**
 * The tools Claude sees. Read tools answer from the latest snapshot the BOVI app synced; "add" tools
 * queue items that the app adds the next time it syncs. Nothing here can delete or change existing data.
 */
import type { InboxItem, Snapshot, StoreLogic } from './store.ts';

type Json = Record<string, unknown>;
type Arr = Json[];

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations: Json;
  run(args: Json, ctx: Ctx): Promise<ToolResult>;
}

interface Ctx {
  store: StoreLogic;
  now: number;
  newId: () => string;
}

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ADD = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const STALE_HOURS = 12;

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });
const json = (header: string, data: unknown): ToolResult => text(`${header}\n\n${JSON.stringify(data, null, 1)}`);
const arr = (v: unknown): Arr => (Array.isArray(v) ? (v as Arr) : []);
const s = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------- helpers ----------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(v: string): boolean {
  if (!DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "H:mm", "HH:mm" → "HH:mm"; anything else → null. */
export function normTime(v: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const t = `${m[1].padStart(2, '0')}:${m[2]}`;
  return TIME.test(t) ? t : null;
}

function freshness(syncedAt: number | null, now: number): string {
  if (!syncedAt) return 'BOVI has not synced yet.';
  const mins = Math.round((now - syncedAt) / 60_000);
  const ago = mins < 2 ? 'just now' : mins < 120 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  const stale = mins > STALE_HOURS * 60 ? ` This may be out of date: ask the user to open BOVI so it syncs.` : '';
  return `Data from BOVI, last synced ${ago} (${new Date(syncedAt).toISOString()}).${stale}`;
}

async function snapshotOr(ctx: Ctx): Promise<{ snap: Snapshot; header: string } | ToolResult> {
  const { snapshot, syncedAt } = await ctx.store.read();
  if (!snapshot) return text('No data yet. In the BOVI app open Settings → Claude connector, enter this server and the key, and tap "Sync now".', true);
  return { snap: snapshot, header: freshness(syncedAt, ctx.now) };
}
const isResult = (v: unknown): v is ToolResult => !!v && typeof v === 'object' && 'content' in v;

/** Matches a subject by name / short name / code against the snapshot (case-insensitive). */
function findSubject(snap: Snapshot | null, q: string): { name: string } | null | 'unknown' {
  if (!snap) return null;
  const subjects = arr(snap.subjects);
  if (!subjects.length) return null;
  const k = q.trim().toLowerCase();
  const hit =
    subjects.find((x) => [x.name, x.short, x.code].some((v) => typeof v === 'string' && v.toLowerCase() === k)) ??
    (() => {
      const partial = subjects.filter((x) => s(x.name).toLowerCase().includes(k));
      return partial.length === 1 ? partial[0] : undefined;
    })();
  return hit ? { name: s(hit.name) } : 'unknown';
}

const subjectList = (snap: Snapshot | null) =>
  arr(snap?.subjects)
    .map((x) => `${s(x.name)}${x.short ? ` (${s(x.short)})` : ''}`)
    .join(', ');

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

// ---------- read tools ----------

const overview: Tool = {
  name: 'bovi_overview',
  title: 'Today in BOVI',
  description:
    "The user's day at a glance from their BOVI planner: the current semester (name, dates, week), today's classes (with attendance marked so far), tasks due today or overdue, assignments due within 7 days, exams within 14 days with readiness, today's habits, and subjects below the attendance target. Start here for questions like \"what's on today?\" or \"what should I focus on?\".",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    const { snap } = r;
    const today = s(snap.today);
    const in7 = addDays(today, 7);
    const in14 = addDays(today, 14);
    const att = (snap.attendance ?? {}) as Json;
    const target = Number(att.target ?? 75);
    return json(r.header, {
      today,
      weekday: snap.weekday,
      timeZone: snap.timeZone,
      semester: snap.semester ?? null,
      classesToday: arr(snap.timetable).filter((c) => c.date === today),
      tasks: arr(snap.tasks).filter((t) => s(t.date) <= today),
      assignmentsDueSoon: arr(snap.assignments).filter((a) => s(a.due) <= in7),
      examsSoon: arr(snap.exams).filter((e) => s(e.date) <= in14),
      habitsToday: snap.habitsToday,
      belowAttendanceTarget: arr(att.subjects).filter((x) => typeof x.percent === 'number' && (x.percent as number) < target),
      attendanceTarget: target,
    });
  },
};

const timetable: Tool = {
  name: 'bovi_timetable',
  title: 'Class timetable',
  description:
    "Classes between two dates (inclusive) with one-off changes applied (cancelled, moved, extra classes) and attendance marks. Synced data covers 7 days back to 14 days ahead; outside that, the weekly timetable is returned so you can work out regular classes. Defaults to the next 7 days.",
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Start date, YYYY-MM-DD (default: today)' },
      to: { type: 'string', description: 'End date, YYYY-MM-DD (default: 6 days after from)' },
    },
    additionalProperties: false,
  },
  annotations: READ,
  async run(a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    const from = s(a.from) || s(r.snap.today);
    const to = s(a.to) || addDays(from, 6);
    if (!isRealDate(from) || !isRealDate(to)) return text('Use dates like 2026-11-23.', true);
    return json(r.header, {
      from,
      to,
      classes: arr(r.snap.timetable).filter((c) => s(c.date) >= from && s(c.date) <= to),
      weeklyTimetable: r.snap.weeklyTimetable,
      events: arr(r.snap.events).filter((e) => s(e.endDate) >= from && s(e.startDate) <= to),
    });
  },
};

const attendance: Tool = {
  name: 'bovi_attendance',
  title: 'Attendance',
  description:
    'Attendance per subject against the user\'s target: present/total, percent, how many classes they can miss right now and stay at the target (canMissNow), how many in a row they must attend to get back to it, and, when the semester\'s remaining classes are known, how many of those they can still miss. Use for "can I skip X?" questions.',
  inputSchema: {
    type: 'object',
    properties: { subject: { type: 'string', description: 'Optional subject name, short name or code to filter' } },
    additionalProperties: false,
  },
  annotations: READ,
  async run(a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    const att = (r.snap.attendance ?? {}) as Json;
    let subjects = arr(att.subjects);
    if (s(a.subject)) {
      const q = s(a.subject).trim().toLowerCase();
      const codeOf = (name: unknown) => s(arr(r.snap.subjects).find((x) => x.name === name)?.code).toLowerCase();
      const exact = subjects.filter((x) => [s(x.subject).toLowerCase(), s(x.short).toLowerCase(), codeOf(x.subject)].includes(q));
      subjects = exact.length ? exact : subjects.filter((x) => [x.subject, x.short].some((v) => s(v).toLowerCase().includes(q)));
      if (!subjects.length) return text(`No subject matches "${s(a.subject)}". Subjects: ${subjectList(r.snap)}`, true);
    }
    return json(r.header, { target: att.target, overall: att.overall, subjects });
  },
};

const exams: Tool = {
  name: 'bovi_exams',
  title: 'Upcoming exams',
  description: 'Upcoming exams, soonest first: date, time, room, days left, syllabus, revision topics not done yet, readiness score with a tip, and planned study sessions.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    return json(r.header, { exams: r.snap.exams, studySessions: r.snap.studySessions, marks: r.snap.marks });
  },
};

const tasks: Tool = {
  name: 'bovi_tasks',
  title: 'Tasks and assignments',
  description: "The user's open tasks (to-dos, with date and optional time) and open college assignments with due dates, oldest first. Overdue items are flagged.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    return json(r.header, { tasks: r.snap.tasks, assignments: r.snap.assignments, habitsToday: r.snap.habitsToday });
  },
};

const projects: Tool = {
  name: 'bovi_projects',
  title: 'Projects and ideas',
  description:
    "The user's side projects from BOVI's second tab (named by the user, e.g. \"Projects\" or \"Game dev\"): status, next step, open milestones and tasks, deadline, last devlog date, focus minutes in the last 7 days, plus their ideas inbox.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    return json(r.header, { tabName: r.snap.projectsTabName, projects: r.snap.projects, ideas: r.snap.ideas });
  },
};

const everything: Tool = {
  name: 'bovi_snapshot',
  title: 'Everything BOVI synced',
  description: 'The full snapshot the BOVI app synced (all sections). Use when the other tools don\'t cover a question, e.g. marks, college events or the weekly timetable together.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const r = await snapshotOr(ctx);
    if (isResult(r)) return r;
    return json(r.header, r.snap);
  },
};

const pending: Tool = {
  name: 'bovi_pending',
  title: 'Waiting to sync',
  description: 'Items added through this connector that the BOVI app has not picked up yet (it picks them up the next time it is opened).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: READ,
  async run(_a, ctx) {
    const list = await ctx.store.inbox();
    return list.length ? json(`${list.length} item(s) waiting for the BOVI app.`, list) : text('Nothing waiting: everything added has reached the BOVI app.');
  },
};

// ---------- add tools ----------

async function queue(ctx: Ctx, item: Omit<InboxItem, 'id' | 'createdAt'>, summary: string): Promise<ToolResult> {
  const res = await ctx.store.enqueue({ ...item, id: ctx.newId(), createdAt: ctx.now } as InboxItem);
  if (!res.ok) return text(res.error, true);
  return text(`Queued: ${summary}. It will appear in BOVI the next time the app syncs (when the user opens it). ${res.waiting} item(s) waiting.`);
}

const strProp = (description: string) => ({ type: 'string', description });

const addTask: Tool = {
  name: 'bovi_add_task',
  title: 'Add a task',
  description: 'Adds a task to the user\'s BOVI to-do list. With a time it also shows on their calendar dial (30 min); without one it sits in that day\'s to-do list.',
  inputSchema: {
    type: 'object',
    properties: {
      title: strProp('What to do, short'),
      date: strProp('Day, YYYY-MM-DD (default: today in the user\'s time zone)'),
      time: strProp('Optional start time, 24-hour HH:mm'),
      notes: strProp('Optional details'),
    },
    required: ['title'],
    additionalProperties: false,
  },
  annotations: ADD,
  async run(a, ctx) {
    const title = s(a.title).trim();
    if (!title) return text('A task needs a title.', true);
    const date = s(a.date).trim();
    if (date && !isRealDate(date)) return text(`"${date}" isn't a date; use YYYY-MM-DD.`, true);
    let time: string | null = null;
    if (s(a.time)) {
      time = normTime(s(a.time));
      if (!time) return text(`"${s(a.time)}" isn't a time; use 24-hour HH:mm, e.g. 17:30.`, true);
    }
    return queue(ctx, { kind: 'task', title: title.slice(0, 500), ...(date ? { date } : {}), ...(time ? { time } : {}), ...(s(a.notes) ? { notes: s(a.notes).slice(0, 2000) } : {}) }, `task "${title}"${date ? ` on ${date}` : ''}${time ? ` at ${time}` : ''}`);
  },
};

const addAssignment: Tool = {
  name: 'bovi_add_assignment',
  title: 'Add an assignment',
  description: 'Adds a college assignment with a due date to BOVI. Pass the subject as it appears in BOVI (name, short name or code); bovi_overview or bovi_snapshot lists them.',
  inputSchema: {
    type: 'object',
    properties: { title: strProp('Assignment title'), due: strProp('Due date, YYYY-MM-DD'), subject: strProp('Optional subject'), notes: strProp('Optional details') },
    required: ['title', 'due'],
    additionalProperties: false,
  },
  annotations: ADD,
  async run(a, ctx) {
    const title = s(a.title).trim();
    const due = s(a.due).trim();
    if (!title) return text('An assignment needs a title.', true);
    if (!isRealDate(due)) return text(`"${due}" isn't a date; use YYYY-MM-DD.`, true);
    const { snapshot } = await ctx.store.read();
    let subject: string | undefined;
    if (s(a.subject)) {
      const m = findSubject(snapshot, s(a.subject));
      if (m === 'unknown') return text(`BOVI has no subject "${s(a.subject)}". Subjects: ${subjectList(snapshot)}. Use one of these, or leave subject out.`, true);
      subject = m?.name ?? s(a.subject);
    }
    return queue(ctx, { kind: 'assignment', title: title.slice(0, 500), due, ...(subject ? { subject } : {}), ...(s(a.notes) ? { notes: s(a.notes).slice(0, 2000) } : {}) }, `assignment "${title}" due ${due}${subject ? ` (${subject})` : ''}`);
  },
};

const addExam: Tool = {
  name: 'bovi_add_exam',
  title: 'Add an exam',
  description: 'Adds an exam to BOVI (it gets a countdown, reminders and a readiness score there). "series" is the exam round, e.g. IA1, IA2, Midsem, Final, Quiz 2.',
  inputSchema: {
    type: 'object',
    properties: {
      series: strProp('Exam round, e.g. IA2'),
      date: strProp('Date, YYYY-MM-DD'),
      subject: strProp('Subject as in BOVI (name, short name or code)'),
      title: strProp('Optional title when it is not a single subject'),
      start: strProp('Optional start time, 24-hour HH:mm'),
      end: strProp('Optional end time, 24-hour HH:mm'),
      room: strProp('Optional room'),
      syllabus: strProp('Optional syllabus / portions'),
    },
    required: ['series', 'date'],
    additionalProperties: false,
  },
  annotations: ADD,
  async run(a, ctx) {
    const series = s(a.series).trim();
    const date = s(a.date).trim();
    if (!series) return text('Give the exam round as "series", e.g. IA2.', true);
    if (!isRealDate(date)) return text(`"${date}" isn't a date; use YYYY-MM-DD.`, true);
    const times: Record<string, string> = {};
    for (const k of ['start', 'end'] as const) {
      if (!s(a[k])) continue;
      const t = normTime(s(a[k]));
      if (!t) return text(`"${s(a[k])}" isn't a time; use 24-hour HH:mm.`, true);
      times[k] = t;
    }
    if (times.start && times.end && times.end <= times.start) return text('The end time must be after the start time.', true);
    const { snapshot } = await ctx.store.read();
    let subject: string | undefined;
    if (s(a.subject)) {
      const m = findSubject(snapshot, s(a.subject));
      if (m === 'unknown' && !s(a.title)) return text(`BOVI has no subject "${s(a.subject)}". Subjects: ${subjectList(snapshot)}. Use one of these, or pass a title instead.`, true);
      subject = m && m !== 'unknown' ? m.name : s(a.subject);
    }
    const item: Json = { kind: 'exam', series: series.slice(0, 60), date, ...times };
    if (subject) item.subject = subject;
    for (const k of ['title', 'room', 'syllabus'] as const) if (s(a[k])) item[k] = s(a[k]).slice(0, k === 'syllabus' ? 4000 : 200);
    return queue(ctx, item as Omit<InboxItem, 'id' | 'createdAt'>, `${subject ?? s(a.title)} ${series} on ${date}${times.start ? ` at ${times.start}` : ''}`.trim());
  },
};

const addIdea: Tool = {
  name: 'bovi_add_idea',
  title: 'Save an idea',
  description: "Saves an idea to the ideas inbox in BOVI's projects tab, to look at later.",
  inputSchema: { type: 'object', properties: { text: strProp('The idea') }, required: ['text'], additionalProperties: false },
  annotations: ADD,
  async run(a, ctx) {
    const t = s(a.text).trim();
    if (!t) return text('The idea is empty.', true);
    return queue(ctx, { kind: 'idea', text: t.slice(0, 1000) }, `idea "${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`);
  },
};

export const TOOLS: Tool[] = [overview, timetable, attendance, exams, tasks, projects, everything, pending, addTask, addAssignment, addExam, addIdea];

export function listTools() {
  return TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } }));
}

export async function callTool(name: string, args: unknown, ctx: Ctx): Promise<ToolResult | null> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return null;
  const a = args && typeof args === 'object' && !Array.isArray(args) ? (args as Json) : {};
  try {
    return await tool.run(a, ctx);
  } catch (e) {
    return text(`Something went wrong: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}
