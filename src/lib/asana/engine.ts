/**
 * The simulator behind /asana/. Plays one sample task through a project's
 * automations: a person moves it, sets a field or approves it, and every
 * automation whose trigger matches runs its actions, then its Check if
 * paths. Changes an automation makes can start other automations that allow
 * it ("Can be triggered by other automations"). Date triggers (Due date is
 * approaching, Task is overdue) fire in the 00:00–01:00 window, as Asana's
 * day-precision triggers do.
 *
 * Pure functions, no DOM: the page and scripts/asana-check.mjs both use it.
 */
import type { Action, Automation, Condition, FieldValue, Path, Scenario, ScenarioEvent, Task, Trigger } from './types';

export const DAY = 1440;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Date triggers run shortly after midnight; the simulator uses 00:30. */
const DATE_TRIGGER_AT = 30;
/** How far past the last event the simulator keeps checking date triggers. */
const HORIZON = 21 * DAY;
/** Chains deeper than this stop, so a misconfigured pair can never spin forever here. */
const MAX_DEPTH = 5;

export type People = Record<string, { name: string }>;

export type Change =
  | { type: 'added' }
  | { type: 'moved'; section: string }
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'completed' }
  | { type: 'approval'; status: string }
  | { type: 'assignee' }
  | { type: 'date'; auto: string; trigger: number };

export interface TraceStep {
  t: number;
  kind: 'start' | 'event' | 'auto' | 'action' | 'path' | 'nopath' | 'chain' | 'end';
  title: string;
  detail?: string;
  /** The automation this step belongs to. */
  auto?: string;
  /** Canvas node: "trigger", "a<i>", "<path id>:<i>". */
  node?: string;
  /** Canvas branch taken: the path id. */
  branch?: string;
  /** A comment posted on the task or a Slack message. */
  message?: { kind: 'comment' | 'slack' | 'task'; to?: string; body: string; by?: string };
  task: Task;
}

export interface Trace {
  start: number;
  end: number;
  steps: TraceStep[];
  task: Task;
  /** Automation ids that ran, in order, with repeats. */
  fired: string[];
  /** "<automation id>:<path id>" for every path taken. */
  paths: string[];
  /** Tasks created in this or other projects. */
  created: { name: string; project: string }[];
}

/* ---------- Formatting ---------- */

export const dayOf = (t: number) => Math.floor(t / DAY);

export function formatTime(t: number) {
  const m = ((t % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const weekday = (d: number) => DAYS[((d % 7) + 7) % 7];
export const formatDay = (t: number) => `${weekday(dayOf(t))} · day ${dayOf(t) + 1}`;
export const formatClock = (t: number) => `${weekday(dayOf(t)).slice(0, 3)} ${formatTime(t)} · day ${dayOf(t) + 1}`;
export const formatDue = (d: number | undefined) => (d === undefined ? 'No due date' : `${weekday(d).slice(0, 3)}, day ${d + 1}`);

export function formatDuration(mins: number) {
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  if (mins < DAY) {
    const h = Math.round(mins / 60);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(mins / DAY);
  return `${d} day${d === 1 ? '' : 's'}`;
}

const nameOf = (people: People, key: string | undefined) => (key ? (people[key]?.name ?? key) : 'nobody');
const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const show = (v: FieldValue | FieldValue[] | undefined) => (Array.isArray(v) ? v.join(', ') : String(v ?? ''));

export function describeTrigger(t: Trigger): { title: string; detail?: string } {
  switch (t.type) {
    case 'added':
      return { title: 'Task added to this project' };
    case 'moved':
      return { title: 'Task moved to a section', detail: `Section is ${t.section}` };
    case 'field':
      return { title: 'Custom field is changed', detail: t.value === undefined ? `${t.key} changes` : `${t.key} is changed to ${t.value}` };
    case 'completed':
      return { title: 'Task is marked complete' };
    case 'approval':
      return { title: 'Approval status is changed', detail: t.status ? `To ${approvalLabel[t.status]}` : 'To any status' };
    case 'assignee':
      return { title: 'Assignee is changed' };
    case 'due_approaching':
      return { title: 'Due date is approaching', detail: `${t.days} day${t.days === 1 ? '' : 's'} before` };
    case 'overdue':
      return { title: 'Task is overdue', detail: 'As soon as it becomes overdue' };
  }
}

export const approvalLabel: Record<string, string> = { pending: 'Pending', approved: 'Approved', changes_requested: 'Changes requested', rejected: 'Rejected' };

export function describeCondition(c: Condition): string {
  switch (c.type) {
    case 'field': {
      const ops = { is: 'is', is_not: 'is not', is_any: 'is any of', set: 'is set', not_set: 'is not set', gt: 'is greater than', lt: 'is less than' };
      return `${c.key} ${ops[c.op]}${c.op === 'set' || c.op === 'not_set' ? '' : ` ${show(c.value)}`}`;
    }
    case 'section':
      return `Section is ${c.is}`;
    case 'approval':
      return `Approval status is ${approvalLabel[c.is]}`;
    case 'assigned':
      return c.is ? 'Assignee is set' : 'Assignee is empty';
    case 'due_set':
      return c.is ? 'Due date is set' : 'Due date is empty';
  }
}

/** The action as its builder card reads: kind and a one-line summary. */
export function describeAction(a: Action, people: People = {}): { kind: string; summary: string } {
  switch (a.type) {
    case 'move':
      return { kind: 'Move task to section', summary: a.section };
    case 'assign':
      return { kind: 'Set assignee', summary: nameOf(people, a.user) };
    case 'unassign':
      return { kind: 'Set assignee', summary: 'Clear the assignee' };
    case 'collaborators':
      return { kind: 'Add collaborators', summary: list(a.users.map((u) => nameOf(people, u))) };
    case 'set_field':
      return { kind: 'Set custom field', summary: `${a.key} → ${a.value}` };
    case 'due':
      return { kind: 'Set due date', summary: a.days === 0 ? 'Today' : a.days === 1 ? 'Tomorrow' : `In ${a.days} days` };
    case 'comment':
      return { kind: 'Add comment', summary: a.body };
    case 'subtasks':
      return { kind: 'Add subtasks', summary: a.items.map((s) => s.name).join(' · ') };
    case 'create_task':
      return { kind: 'Create task', summary: `“${a.name}” in ${a.project}${a.section ? ` › ${a.section}` : ''}${a.assignee ? `, for ${nameOf(people, a.assignee)}` : ''}` };
    case 'add_project':
      return { kind: 'Add to project', summary: a.project };
    case 'complete':
      return { kind: 'Mark task complete', summary: 'Completes the task' };
    case 'slack':
      return { kind: 'Send Slack message', summary: `${a.channel}: ${a.body}` };
  }
}

/** Every node an automation can reach, for coverage checks and counts. */
export function nodesOf(def: Automation['automation']): string[] {
  return [...def.actions.map((_, i) => `a${i}`), ...(def.paths ?? []).flatMap((p) => p.actions.map((_, i) => `${p.id}:${i}`))];
}

export const countActions = (a: Automation) => nodesOf(a.automation).length;

/* ---------- Running ---------- */

const clone = (t: Task): Task => JSON.parse(JSON.stringify(t));

export function startTask(s: Scenario, project: string, override?: Partial<Task>): Task {
  const base: Task = { project, section: '', collaborators: [], completed: false, fields: {}, subtasks: [], comments: [], alsoIn: [], ...s.task };
  const t: Task = { ...base, ...override, fields: { ...base.fields, ...(override?.fields ?? {}) } };
  return clone(t);
}

function matches(t: Trigger, c: Change, index: number, task: Task, auto: string): boolean {
  switch (t.type) {
    case 'added':
      return c.type === 'added';
    case 'moved':
      // A new task landing in the section counts too.
      return (c.type === 'moved' || c.type === 'added') && task.section === t.section;
    case 'field':
      return c.type === 'field' && c.key === t.key && (t.value === undefined || c.value === t.value);
    case 'completed':
      return c.type === 'completed';
    case 'approval':
      return c.type === 'approval' && (!t.status || c.status === t.status);
    case 'assignee':
      return c.type === 'assignee';
    case 'due_approaching':
    case 'overdue':
      return c.type === 'date' && c.auto === auto && c.trigger === index;
  }
}

export function test(c: Condition, task: Task): boolean {
  switch (c.type) {
    case 'field': {
      const v = task.fields[c.key];
      if (c.op === 'set') return v !== undefined && v !== '';
      if (c.op === 'not_set') return v === undefined || v === '';
      if (c.op === 'is') return v === c.value;
      if (c.op === 'is_not') return v !== c.value;
      if (c.op === 'is_any') return Array.isArray(c.value) && v !== undefined && c.value.includes(v);
      if (c.op === 'gt') return typeof v === 'number' && v > Number(c.value);
      return typeof v === 'number' && v < Number(c.value);
    }
    case 'section':
      return task.section === c.is;
    case 'approval':
      return task.approval === c.is;
    case 'assigned':
      return !!task.assignee === c.is;
    case 'due_set':
      return (task.due !== undefined) === c.is;
  }
}

/** The path a task takes: the first whose conditions all hold, else the "No other path is matching" one. */
export function pickPath(paths: Path[], task: Task): Path | undefined {
  return paths.find((p) => p.when.length > 0 && p.when.every((c) => test(c, task))) ?? paths.find((p) => p.when.length === 0);
}

function eventText(e: ScenarioEvent, people: People): string {
  const who = nameOf(people, e.by);
  switch (e.type) {
    case 'move':
      return `${who} moves the task to ${e.section}`;
    case 'field':
      return `${who} sets ${e.key} to ${e.value}`;
    case 'approval':
      return `${who} marks it ${approvalLabel[e.status]}`;
    case 'complete':
      return `${who} marks it complete`;
    case 'assign':
      return `${who} assigns it to ${nameOf(people, e.user)}`;
    case 'due':
      return `${who} sets the due date to ${formatDue(e.day)}`;
    case 'comment':
      return `${who} comments`;
  }
}

/**
 * Runs one scenario against every automation in `automations` (one project's
 * set). Returns the full trace; the UI plays it, the check script asserts on it.
 */
export function simulate(automations: Automation[], scenario: Scenario, project: string, people: People, override?: { task?: Partial<Task>; start?: number; events?: ScenarioEvent[] }): Trace {
  const start = override?.start ?? scenario.start;
  const shift = start - scenario.start;
  const task = startTask(scenario, project, override?.task);
  const steps: TraceStep[] = [];
  const fired: string[] = [];
  const paths: string[] = [];
  const created: Trace['created'] = [];
  const doneDates = new Set<string>();
  let now = start;
  const log = (s: Omit<TraceStep, 't' | 'task'>) => steps.push({ ...s, t: now, task: clone(task) });
  const projectAutos = automations.filter((a) => a.automation.project === project);

  /** Applies one action; returns the change it made, if any other automation could see it. */
  function apply(a: Action, auto: Automation, node: string): Change | undefined {
    const d = describeAction(a, people);
    let change: Change | undefined;
    let message: TraceStep['message'];
    let detail = d.summary;
    switch (a.type) {
      case 'move':
        if (task.section !== a.section) {
          task.section = a.section;
          change = { type: 'moved', section: a.section };
        } else detail = `Already in ${a.section}`;
        break;
      case 'assign':
        if (task.assignee !== a.user) {
          task.assignee = a.user;
          change = { type: 'assignee' };
        }
        break;
      case 'unassign':
        if (task.assignee) change = { type: 'assignee' };
        task.assignee = undefined;
        break;
      case 'collaborators':
        task.collaborators = [...new Set([...task.collaborators, ...a.users])];
        break;
      case 'set_field':
        if (task.fields[a.key] !== a.value) {
          task.fields[a.key] = a.value;
          change = { type: 'field', key: a.key, value: a.value };
        } else detail = `${a.key} is already ${a.value}`;
        break;
      case 'due':
        task.due = dayOf(now) + a.days;
        detail = `${d.summary}: ${formatDue(task.due)}`;
        break;
      case 'comment':
        task.comments.push({ by: 'automation', body: a.body, at: now });
        message = { kind: 'comment', body: a.body, by: `${auto.number} · ${auto.name}` };
        detail = '';
        break;
      case 'subtasks':
        task.subtasks.push(...a.items.map((s) => ({ ...s })));
        detail = a.items.map((s) => `${s.name}${s.assignee ? ` (${nameOf(people, s.assignee)})` : ''}`).join(' · ');
        break;
      case 'create_task':
        created.push({ name: a.name, project: a.project });
        message = { kind: 'task', to: `${a.project}${a.section ? ` › ${a.section}` : ''}`, body: `${a.name}${a.assignee ? ` · assigned to ${nameOf(people, a.assignee)}` : ''}${a.dueIn !== undefined ? ` · due ${formatDue(dayOf(now) + a.dueIn)}` : ''}` };
        detail = '';
        break;
      case 'add_project':
        if (!task.alsoIn.includes(a.project)) task.alsoIn.push(a.project);
        break;
      case 'complete':
        if (!task.completed) {
          task.completed = true;
          change = { type: 'completed' };
        }
        break;
      case 'slack':
        message = { kind: 'slack', to: a.channel, body: a.body };
        detail = '';
        break;
    }
    log({ kind: 'action', title: d.kind, detail: detail || undefined, auto: auto.id, node, message });
    return change;
  }

  /** Runs every automation the change starts, then whatever their own changes start. */
  function fire(change: Change, bySystem: boolean, chain: string[], depth: number) {
    if (depth > MAX_DEPTH) return;
    for (const auto of projectAutos) {
      const def = auto.automation;
      if (chain.includes(auto.id)) continue;
      if (bySystem && !def.settings.triggeredByOthers) continue;
      const ti = def.triggers.findIndex((t, i) => matches(t, change, i, task, auto.id));
      if (ti < 0) continue;
      // Date triggers only fire for incomplete tasks.
      if (change.type === 'date' && task.completed) continue;
      fired.push(auto.id);
      const tr = describeTrigger(def.triggers[ti]);
      log({ kind: 'auto', title: `${auto.number} · ${auto.name} runs`, detail: `${bySystem ? 'Started by the automation before it. ' : ''}Trigger: ${tr.title}${tr.detail ? ` (${tr.detail})` : ''}`, auto: auto.id, node: 'trigger' });
      const changes: Change[] = [];
      def.actions.forEach((a, i) => {
        const c = apply(a, auto, `a${i}`);
        if (c) changes.push(c);
      });
      if (def.paths?.length) {
        const p = pickPath(def.paths, task);
        if (p) {
          paths.push(`${auto.id}:${p.id}`);
          log({ kind: 'path', title: `Check if → ${p.label}`, detail: p.when.length ? p.when.map((c) => describeCondition(c)).join(' and ') : 'No other path is matching', auto: auto.id, branch: p.id });
          p.actions.forEach((a, i) => {
            const c = apply(a, auto, `${p.id}:${i}`);
            if (c) changes.push(c);
          });
        } else {
          log({ kind: 'nopath', title: 'Check if → no path matches', detail: 'Nothing else runs for this task.', auto: auto.id });
        }
      }
      for (const c of changes) fire(c, true, [...chain, auto.id], depth + 1);
    }
  }

  // The starting state.
  if (scenario.submitted) {
    log({ kind: 'start', title: 'Form submitted', detail: `A new task, “${task.name}”, lands in ${task.section}${task.assignee ? `, assigned to ${nameOf(people, task.assignee)}` : ''}.` });
    fire({ type: 'added' }, false, [], 0);
  } else {
    log({ kind: 'start', title: `“${task.name}”`, detail: `Section: ${task.section}${task.assignee ? `, assigned to ${nameOf(people, task.assignee)}` : ''}${task.due !== undefined ? `, due ${formatDue(task.due)}` : ''}.` });
  }

  const events = (override?.events ?? scenario.events.map((e) => ({ ...e, at: e.at + shift }))).slice().sort((a, b) => a.at - b.at);
  const last = Math.max(start, ...events.map((e) => e.at));

  /** The next date trigger that would fire after `after`, given the task as it is now. */
  function nextDate(after: number): { at: number; auto: Automation; index: number; key: string } | undefined {
    if (task.due === undefined || task.completed) return undefined;
    let best: ReturnType<typeof nextDate>;
    for (const auto of projectAutos) {
      auto.automation.triggers.forEach((t, index) => {
        if (t.type !== 'due_approaching' && t.type !== 'overdue') return;
        const day = t.type === 'overdue' ? task.due! + 1 : task.due! - t.days;
        const at = day * DAY + DATE_TRIGGER_AT;
        const key = `${auto.id}:${index}:${task.due}`;
        if (at <= after || doneDates.has(key)) return;
        if (!best || at < best.at) best = { at, auto, index, key };
      });
    }
    return best;
  }

  let i = 0;
  for (;;) {
    const ev = events[i];
    const date = nextDate(now);
    const dateFirst = date && (!ev || date.at < ev.at) && date.at <= last + HORIZON;
    if (dateFirst) {
      now = date.at;
      doneDates.add(date.key);
      fire({ type: 'date', auto: date.auto.id, trigger: date.index }, false, [], 0);
      continue;
    }
    if (!ev) break;
    i++;
    now = Math.max(now, ev.at);
    const changes: Change[] = [];
    switch (ev.type) {
      case 'move':
        if (task.section !== ev.section) changes.push({ type: 'moved', section: ev.section });
        task.section = ev.section;
        break;
      case 'field':
        if (task.fields[ev.key] !== ev.value) changes.push({ type: 'field', key: ev.key, value: ev.value });
        task.fields[ev.key] = ev.value;
        break;
      case 'approval':
        // Approved, Changes requested and Rejected all complete an approval task.
        task.approval = ev.status;
        changes.push({ type: 'approval', status: ev.status });
        if (!task.completed) changes.push({ type: 'completed' });
        task.completed = true;
        break;
      case 'complete':
        if (!task.completed) changes.push({ type: 'completed' });
        task.completed = true;
        task.subtasks.forEach((s) => (s.done = true));
        break;
      case 'assign':
        if (task.assignee !== ev.user) changes.push({ type: 'assignee' });
        task.assignee = ev.user;
        break;
      case 'due':
        task.due = ev.day;
        break;
      case 'comment':
        task.comments.push({ by: ev.by, body: ev.body, at: now });
        break;
    }
    log({ kind: 'event', title: eventText(ev, people), detail: ev.note, message: ev.type === 'comment' ? { kind: 'comment', body: ev.body, by: nameOf(people, ev.by) } : undefined });
    for (const c of changes) fire(c, false, [], 0);
  }

  const end = now;
  log({ kind: 'end', title: 'End of the run', detail: `${task.completed ? 'Complete' : 'Open'} in ${task.section}${task.assignee ? `, assigned to ${nameOf(people, task.assignee)}` : ', unassigned'}${task.due !== undefined ? `, due ${formatDue(task.due)}` : ''}.` });
  return { start, end, steps, task: clone(task), fired, paths, created };
}
