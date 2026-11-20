import { dayShiftFor, periodOfWindow } from './radial';
import { emptyState } from './habits';
import { migrateState } from './storage';
import { buildTimeline } from './timeline';
import { buildBriefing } from './briefing';
import { emptyCollege } from './college';
import { emptyProjects } from './projects';
import { missedTimed, openTasksOn, taskReminders, moveTodo, pruneTodos, removeTodo, setTodoDone, untimedTodos, upsertTodo } from './todos';
import type { Todo } from './types';

const todo = (id: string, date: string, extra: Partial<Todo> = {}): Todo => ({ id, title: id, date, done: false, ...extra });

describe('dial across days', () => {
  it('shifts the day once the window middle crosses midnight', () => {
    expect(dayShiftFor(1080)).toBe(0); // 18:00–24:00, middle 21:00
    expect(dayShiftFor(1259)).toBe(0);
    expect(dayShiftFor(1260)).toBe(1); // middle at midnight
    expect(dayShiftFor(-179)).toBe(0);
    expect(dayShiftFor(-181)).toBe(-1);
    // Header period stays sensible for windows hanging over midnight.
    expect(periodOfWindow(-170)).toBe('night');
    expect(periodOfWindow(1250)).toBe('evening');
  });
});

describe('tasks', () => {
  it('adds, completes, moves and removes tasks', () => {
    let s = upsertTodo(emptyState(), todo('a', '2026-11-17'));
    s = upsertTodo(s, { ...todo('a', '2026-11-17'), title: 'Renamed' });
    expect(s.todos).toHaveLength(1);
    s = setTodoDone(s, 'a', true, 99);
    expect(s.todos![0]).toMatchObject({ title: 'Renamed', done: true, doneAt: 99 });
    expect(setTodoDone(s, 'a', false, 100).todos![0].doneAt).toBeUndefined();
    expect(moveTodo(s, 'a', '2026-11-18').todos![0].date).toBe('2026-11-18');
    expect(removeTodo(s, 'a').todos).toEqual([]);
  });

  it('lists untimed tasks, carrying unfinished ones over to today', () => {
    const s = {
      ...emptyState(),
      todos: [
        todo('old-open', '2026-11-14'),
        todo('old-done', '2026-11-14', { done: true }),
        todo('today', '2026-11-17'),
        todo('timed', '2026-11-17', { time: '18:00' }),
        todo('later', '2026-11-20'),
      ],
    };
    expect(untimedTodos(s, '2026-11-17', '2026-11-17').map((x) => [x.todo.id, x.overdue])).toEqual([
      ['old-open', true],
      ['today', false],
    ]);
    // Other days show only their own.
    expect(untimedTodos(s, '2026-11-20', '2026-11-17').map((x) => x.todo.id)).toEqual(['later']);
    expect(missedTimed({ ...s, todos: [todo('m', '2026-11-16', { time: '09:00' })] }, '2026-11-17').map((t) => t.id)).toEqual(['m']);
  });

  it('puts timed tasks on the timeline (30 min by default) and prunes old done ones', () => {
    const s = { ...emptyState(), todos: [todo('t', '2026-11-17', { time: '18:30' }), todo('u', '2026-11-17', { time: '20:00', minutes: 90, done: true }), todo('x', '2026-11-17')] };
    const items = buildTimeline('2026-11-17', { habitState: s }).items;
    expect(items.map((i) => [i.kind, i.title, i.start.getHours(), 'end' in i ? (i.end.getTime() - i.start.getTime()) / 60_000 : null])).toEqual([
      ['task', 't', 18, 30],
      ['task', 'u', 20, 90],
    ]);
    const pruned = pruneTodos({ ...emptyState(), todos: [todo('ancient', '2026-08-01', { done: true }), todo('ancient-open', '2026-08-01')] }, '2026-11-17');
    expect(pruned.todos!.map((t) => t.id)).toEqual(['ancient-open']);
  });

  it('survives saving and loading (migration keeps tasks)', () => {
    const s = upsertTodo(emptyState(), todo('a', '2026-11-17', { time: '09:00', remind: true }));
    expect(migrateState(JSON.parse(JSON.stringify(s)))!.todos).toEqual(s.todos);
    expect('todos' in migrateState(JSON.parse(JSON.stringify(emptyState())))!).toBe(false);
  });

  it('reminds for timed tasks and lists open tasks in the briefing', () => {
    const s = { ...emptyState(), todos: [todo('call', '2026-11-18', { time: '09:00', remind: true }), todo('quiet', '2026-11-18', { time: '10:00' }), todo('print', '2026-11-17')] };
    expect(taskReminders(s, new Date(2026, 10, 17, 12)).map((r) => [r.id, r.date.getHours()])).toEqual([['task:call', 9]]);
    expect(openTasksOn(s, '2026-11-18', '2026-11-18').map((t) => t.id)).toEqual(['call', 'quiet', 'print']);
    const b = buildBriefing('2026-11-18', { college: emptyCollege(), habitState: s, projects: emptyProjects() });
    expect(b.body).toContain('Tasks: call 9:00, quiet 10:00, print');
  });
});
