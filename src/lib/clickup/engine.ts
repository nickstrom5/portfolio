/**
 * The ClickUp simulator: follows one task through a process, applying what
 * people do (the scenario's events) and firing the List's Automations the way
 * ClickUp does: a Trigger, then Conditions (all must be true), then Actions in
 * order. Date Triggers fire at 4 AM on the day, as ClickUp's do, and Every…
 * Triggers skip tasks in a Done or Closed status.
 *
 * Changes made by an Automation's Actions do not start other Automations here.
 * Rather than lean on chaining, each process is built so that no Action
 * matches another Automation's Trigger, and `chains` reports any that would,
 * so scripts/clickup-check.mjs can fail the build on it.
 */
import { calendarDate, formatDay as dayOnly, formatDuration } from '@/lib/ghl/engine';
import type { Action, Condition, CuAutomation, FieldValue, PersonRef, Process, Scenario, ScenarioEvent, Task, Trigger, Workspace } from './types';

export { formatClock, formatDuration, formatTime, useWeekOf } from '@/lib/ghl/engine';

/** "Thu, Apr 2", with the year when it is not the sample week's year (an insurance renewal a year out). */
export function formatDay(min: number): string {
  const y = calendarDate(min).getUTCFullYear();
  return y === calendarDate(0).getUTCFullYear() ? dayOnly(min) : `${dayOnly(min)}, ${y}`;
}

const DAY = 1440;
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---------- Words ---------- */

export const to12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const list = (xs: string[], joiner = 'or') => (xs.length < 3 ? xs.join(` ${joiner} `) : `${xs.slice(0, -1).join(', ')} ${joiner} ${xs[xs.length - 1]}`);
const daysText = (d: number[]) => {
  const s = [...d].sort();
  if (s.length === 5 && s.join() === '0,1,2,3,4') return 'every weekday';
  if (s.length === 1) return `every ${DAYS[s[0]]}`;
  return `every ${s.map((i) => SHORT[i]).join(', ')}`;
};

/** A Trigger as it reads in the builder: its ClickUp name and the options set on it. */
export function describeTrigger(t: Trigger): { title: string; detail?: string } {
  switch (t.type) {
    case 'task_created':
      return { title: 'Task or subtask created', detail: t.form ? `Created from the Form “${t.form}”` : undefined };
    case 'status_changes':
      return { title: 'Status changes', detail: [t.from && `from ${list(t.from)}`, t.to && `to ${list(t.to)}`].filter(Boolean).join(' ') || 'to any status' };
    case 'custom_field_changes':
      return { title: 'Custom Field changes', detail: `${t.field}${t.to ? ` changes to ${list(t.to.map(String))}` : ' changes'}` };
    case 'priority_changes':
      return { title: 'Priority changes', detail: t.to ? `to ${list(t.to)}` : undefined };
    case 'tags_added':
      return { title: 'Tags added', detail: list(t.tags) };
    case 'assignee_added':
      return { title: 'Assignee added' };
    case 'comment_added':
      return { title: 'Comment is added' };
    case 'due_date_arrives':
      return { title: 'Due date arrives', detail: 'Fires at 4:00 AM on the due date' };
    case 'start_date_arrives':
      return { title: 'Start date arrives', detail: 'Fires at 4:00 AM on the start date' };
    case 'due_date_changes':
      return { title: 'Due date changes' };
    case 'date_before_after':
      return { title: 'Date is Before/After', detail: `${t.days} ${t.days === 1 ? 'day' : 'days'} ${t.when} the ${t.date === 'due' ? 'due date' : 'start date'}, at 4:00 AM` };
    case 'every':
      return { title: 'Every…', detail: `${daysText(t.days)} at ${to12(t.at)}` };
    case 'subtasks_resolved':
      return { title: 'Subtasks resolved' };
    case 'checklists_resolved':
      return { title: 'Checklists resolved' };
    case 'unblocked':
      return { title: 'Task or subtask unblocked' };
    case 'time_tracked':
      return { title: 'Time tracked' };
  }
}

export type Names = Record<string, string>;
export const namesOf = (ws: Workspace): Names => Object.fromEntries(ws.team.map((m) => [m.key, m.name]));
const who = (names: Names, key?: string) => (key ? (names[key] ?? key) : 'nobody');
const personRef = (names: Names, p: PersonRef) =>
  typeof p === 'string' ? (p === 'creator' ? 'Task creator' : p === 'triggered_by' ? 'Automation triggered by' : who(names, p)) : `${p.field} (People field)`;

export function describeCondition(c: Condition, names: Names): string {
  switch (c.type) {
    case 'status':
      return `Status is ${list(c.is)}`;
    case 'status_not':
      return `Status is not ${list(c.is, 'and not')}`;
    case 'field':
      return c.op === 'set' ? `${c.field} is set` : c.op === 'not_set' ? `${c.field} is not set` : `${c.field} ${c.op === 'eq' ? 'is equal to' : 'is not equal to'} ${String(c.value)}`;
    case 'priority':
      return `Priority is ${list(c.is.map((p) => (p === 'none' ? 'no priority' : p)))}`;
    case 'tag':
      return [c.has && `Tag is any of ${list(c.has)}`, c.lacks && `Tag does not contain ${list(c.lacks)}`].filter(Boolean).join(' and ');
    case 'assignee':
      return c.is === 'none' ? 'Assignee is none' : `Assignee is ${who(names, c.is)}`;
    case 'time_in_status':
      return `Time in Status: ${c.status} for more than ${fmtSpan(c.moreThanMinutes)}`;
  }
}

const fmtSpan = (m: number) => (m % DAY === 0 ? `${m / DAY} ${m === DAY ? 'day' : 'days'}` : m % 60 === 0 ? `${m / 60} ${m === 60 ? 'hour' : 'hours'}` : formatDuration(m));

export function describeAction(a: Action, names: Names): { title: string; detail: string } {
  switch (a.type) {
    case 'change_status':
      return { title: 'Change status', detail: `to ${a.to}` };
    case 'change_assignees':
      return {
        title: 'Change assignees',
        detail: a.mode === 'remove_all' ? 'Remove all assignees' : `${a.mode === 'add' ? 'Add' : 'Reassign to'} ${list((a.to ?? []).map((p) => personRef(names, p)), 'and')}`,
      };
    case 'change_priority':
      return { title: 'Change Priority', detail: a.to ? `to ${a.to}` : 'Clear priority' };
    case 'change_due_date':
      return { title: 'Change due date', detail: a.remove ? 'Remove date' : a.daysAfter ? `${a.daysAfter} ${a.daysAfter === 1 ? 'day' : 'days'} after trigger date` : 'On trigger date' };
    case 'change_start_date':
      return { title: 'Change start date', detail: a.daysAfter ? `${a.daysAfter} days after trigger date` : 'On trigger date' };
    case 'change_tags':
      return { title: 'Change tags', detail: [a.add && `Add ${list(a.add, 'and')}`, a.remove && `Remove ${list(a.remove, 'and')}`].filter(Boolean).join(' · ') };
    case 'change_followers':
      return { title: 'Change followers', detail: `Add ${list(a.add.map((p) => personRef(names, p)), 'and')}` };
    case 'add_comment':
      return { title: 'Add a comment', detail: a.body };
    case 'apply_template':
      return { title: 'Apply a template', detail: `${a.template}${a.subtasks ? `: ${a.subtasks.length} subtasks` : ''}${a.checklist ? `${a.subtasks ? ',' : ':'} a ${a.checklist.length}-item checklist` : ''}` };
    case 'create_subtask':
      return { title: 'Create a subtask', detail: `${a.name}${a.assignee ? `, assigned to ${who(names, a.assignee)}` : ''}` };
    case 'create_task':
      return { title: 'Create a task', detail: `“${a.name}” in ${a.list}${a.template ? ` from the template ${a.template}` : ''}${a.relationship ? `, related as ${a.relationship}` : ''}` };
    case 'add_to_list':
      return { title: 'Add to List', detail: `${a.list} (Tasks in Multiple Lists)` };
    case 'move_to_list':
      return { title: 'Move to List', detail: a.list };
    case 'update_custom_field':
      return { title: 'Update custom field', detail: `${a.field}: ${a.onTriggerDate ? 'On trigger date' : String(a.value)}` };
    case 'estimate_time':
      return { title: 'Estimate time', detail: fmtSpan(a.minutes) };
    case 'add_to_current_sprint':
      return { title: 'Add to current Sprint', detail: 'The Sprint Folder’s current Sprint List' };
    case 'send_channel_message':
      return { title: 'Send a channel message', detail: `${a.channel}: ${a.body}` };
    case 'call_webhook':
      return { title: 'Call webhook', detail: a.url };
    case 'share_task':
      return { title: 'Share task', detail: `with ${who(names, a.with)}, ${a.permission} permission` };
    case 'archive_task':
      return { title: 'Archive task or subtask', detail: 'Archive the task' };
  }
}

/* ---------- Task state ---------- */

const groupOf = (proc: Process, status: string) => proc.statuses.find((s) => s.name === status)?.group;
export const isFinished = (proc: Process, status: string) => ['done', 'closed'].includes(groupOf(proc, status) ?? '');
const clone = (t: Task): Task => JSON.parse(JSON.stringify(t));

/** The task at the start of a run. An override (from the Form demo) replaces the name and fields it gives. */
export function startTask(proc: Process, sc: Scenario, override?: { name?: string; fields?: Record<string, FieldValue> }): Task {
  const day0 = dayStart(sc.start);
  const { dueDay, startDay, ...rest } = sc.task;
  const defaults: Omit<Task, 'name'> = {
    list: proc.location.list,
    alsoIn: [],
    status: proc.statuses[0].name,
    statusSince: sc.start,
    assignees: [],
    followers: [],
    tags: [],
    fields: {},
    tracked: 0,
    subtasks: [],
    checklist: [],
    waitingOn: [],
    links: [],
    shared: [],
  };
  const t: Task = { ...defaults, ...(JSON.parse(JSON.stringify(rest)) as Partial<Task>), name: rest.name };
  if (dueDay !== undefined) t.due = day0 + dueDay * DAY;
  if (startDay !== undefined) t.start = day0 + startDay * DAY;
  if (override?.name) t.name = override.name;
  if (override?.fields) t.fields = { ...t.fields, ...override.fields };
  return t;
}

/** Something that happened to the task that a Trigger can listen for. */
type Signal =
  | { kind: 'created'; subtask?: boolean; form?: boolean }
  | { kind: 'status'; from: string; to: string }
  | { kind: 'field'; field: string; to: FieldValue }
  | { kind: 'priority'; to: string | null }
  | { kind: 'tags_added'; tags: string[] }
  | { kind: 'assignee_added' }
  | { kind: 'comment' }
  | { kind: 'due_changed' }
  | { kind: 'due_arrives' }
  | { kind: 'start_arrives' }
  | { kind: 'subtasks_resolved' }
  | { kind: 'checklists_resolved' }
  | { kind: 'unblocked' }
  | { kind: 'time_tracked' }
  | { kind: 'scheduled'; auto: string };

function matches(a: CuAutomation, s: Signal, formName?: string): boolean {
  const t = a.trigger;
  const scope = a.appliesTo ?? 'tasks';
  switch (t.type) {
    case 'task_created':
      if (s.kind !== 'created') return false;
      if (s.subtask ? scope === 'tasks' : scope === 'subtasks') return false;
      return !t.form || (!!s.form && t.form === formName);
    case 'status_changes':
      return s.kind === 'status' && (!t.from || t.from.includes(s.from)) && (!t.to || t.to.includes(s.to));
    case 'custom_field_changes':
      return s.kind === 'field' && s.field === t.field && (!t.to || t.to.includes(s.to));
    case 'priority_changes':
      return s.kind === 'priority' && (!t.to || (s.to !== null && (t.to as string[]).includes(s.to)));
    case 'tags_added':
      return s.kind === 'tags_added' && s.tags.some((x) => t.tags.includes(x));
    case 'assignee_added':
      return s.kind === 'assignee_added';
    case 'comment_added':
      return s.kind === 'comment';
    case 'due_date_arrives':
      return s.kind === 'due_arrives';
    case 'start_date_arrives':
      return s.kind === 'start_arrives';
    case 'due_date_changes':
      return s.kind === 'due_changed';
    case 'subtasks_resolved':
      return s.kind === 'subtasks_resolved';
    case 'checklists_resolved':
      return s.kind === 'checklists_resolved';
    case 'unblocked':
      return s.kind === 'unblocked';
    case 'time_tracked':
      return s.kind === 'time_tracked';
    case 'date_before_after':
    case 'every':
      return s.kind === 'scheduled' && s.auto === a.id;
  }
}

/** The first Condition that is false, or undefined when all are true. */
function failing(conds: Condition[] | undefined, task: Task, now: number): Condition | undefined {
  for (const c of conds ?? []) {
    let ok = true;
    switch (c.type) {
      case 'status':
        ok = c.is.includes(task.status);
        break;
      case 'status_not':
        ok = !c.is.includes(task.status);
        break;
      case 'field': {
        const v = task.fields[c.field];
        const set = v !== undefined && v !== '';
        ok = c.op === 'set' ? set : c.op === 'not_set' ? !set : c.op === 'eq' ? v === c.value : v !== c.value;
        break;
      }
      case 'priority':
        ok = c.is.includes(task.priority ?? 'none');
        break;
      case 'tag':
        ok = (!c.has || c.has.some((x) => task.tags.includes(x))) && (!c.lacks || !c.lacks.some((x) => task.tags.includes(x)));
        break;
      case 'assignee':
        ok = c.is === 'none' ? task.assignees.length === 0 : task.assignees.includes(c.is);
        break;
      case 'time_in_status':
        ok = task.status === c.status && now - task.statusSince > c.moreThanMinutes;
        break;
    }
    if (!ok) return c;
  }
  return undefined;
}

/** What the failing Condition actually found, for the log. */
function found(c: Condition, task: Task, now: number, names: Names): string {
  switch (c.type) {
    case 'status':
    case 'status_not':
      return `the status is ${task.status}`;
    case 'field':
      return task.fields[c.field] === undefined || task.fields[c.field] === '' ? `${c.field} is empty` : `${c.field} is ${String(task.fields[c.field])}`;
    case 'priority':
      return `the priority is ${task.priority ?? 'not set'}`;
    case 'tag':
      return task.tags.length ? `the tags are ${task.tags.join(', ')}` : 'the task has no tags';
    case 'assignee':
      return task.assignees.length ? `it is assigned to ${task.assignees.map((k) => who(names, k)).join(', ')}` : 'it has no assignee';
    case 'time_in_status': {
      if (task.status !== c.status) return `the status is ${task.status}`;
      const h = Math.floor((now - task.statusSince) / 60);
      return `it has been ${c.status} for ${h < 1 ? 'under an hour' : h < 48 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${Math.floor(h / 24)} days`}`;
    }
  }
}

/** Fills {{task.name}}, {{task.due}}, {{task.status}}, {{task.creator}}, {{task.assignees}} and {{field.Name}}. Unknown ones stay, for the check to catch. */
export function renderVars(text: string, task: Task, names: Names): string {
  return text.replace(/\{\{\s*([\w.]+(?: [\w&]+)*)\s*\}\}/g, (all, key: string) => {
    if (key === 'task.name') return task.name;
    if (key === 'task.status') return task.status;
    if (key === 'task.due') return task.due !== undefined ? formatDay(task.due) : 'no due date';
    if (key === 'task.creator') return task.creator ? who(names, task.creator) : 'the task creator';
    if (key === 'task.assignees') return task.assignees.length ? task.assignees.map((k) => who(names, k)).join(', ') : 'nobody';
    if (key.startsWith('field.')) {
      const v = task.fields[key.slice(6)];
      if (v === undefined) return all;
      return typeof v === 'string' && names[v] ? names[v] : String(v);
    }
    return all;
  });
}

/* ---------- The run ---------- */

const blockingLeft = (n: number) => (n === 0 ? 'No blocking tasks left' : `${n} blocking ${n === 1 ? 'task' : 'tasks'} left`);

export type TraceKind = 'event' | 'trigger' | 'action' | 'skip' | 'end';

export interface TraceMessage {
  kind: 'comment' | 'chat' | 'webhook';
  /** Comment author, or the Chat channel. */
  from?: string;
  body: string;
}

export interface TraceStep {
  t: number;
  kind: TraceKind;
  title: string;
  detail?: string;
  /** The Automation this step belongs to. */
  auto?: string;
  message?: TraceMessage;
  /** Something outside ClickUp, told for the story (a call, an email). */
  outside?: boolean;
  task: Task;
}

export interface Trace {
  start: number;
  end: number;
  steps: TraceStep[];
  task: Task;
  /** Automation ids that fired, in order (repeats included). */
  fired: string[];
  /** Automation ids whose Trigger matched but whose Conditions stopped them. */
  blocked: string[];
  /** "a → b" where an Action of a would start b in ClickUp. Must stay empty. */
  chains: string[];
}

export function simulate(proc: Process, sc: Scenario, ws: Workspace, override?: { name?: string; fields?: Record<string, FieldValue> }): Trace {
  const names = namesOf(ws);
  const task = startTask(proc, sc, override);
  const steps: TraceStep[] = [];
  const fired: string[] = [];
  const blocked: string[] = [];
  const chains: string[] = [];
  const formName = proc.pieces.find((p) => p.kind === 'Form')?.name;
  const day0 = dayStart(sc.start);
  const log = (t: number, kind: TraceKind, title: string, detail?: string, extra: Partial<TraceStep> = {}) => steps.push({ t, kind, title, detail, task: clone(task), ...extra });

  // Every… skips that would repeat each morning are logged once per status.
  const quietSkips = new Set<string>();

  /** Applies one Action; returns the signals it would raise in ClickUp. */
  const act = (a: Action, t: number, by: string | undefined, auto: CuAutomation): Signal[] => {
    const out: Signal[] = [];
    const resolve = (p: PersonRef) => (typeof p === 'string' ? (p === 'creator' ? task.creator : p === 'triggered_by' ? by : p) : (task.fields[p.field] as string | undefined));
    let message: TraceMessage | undefined;
    switch (a.type) {
      case 'change_status': {
        if (!proc.statuses.some((s) => s.name === a.to)) throw new Error(`${auto.id}: status "${a.to}" is not in this List`);
        const from = task.status;
        if (from !== a.to) {
          task.status = a.to;
          task.statusSince = t;
          out.push({ kind: 'status', from, to: a.to });
        }
        break;
      }
      case 'change_assignees': {
        if (a.mode !== 'add') task.assignees = [];
        for (const p of a.to ?? []) {
          const k = resolve(p);
          if (k && !task.assignees.includes(k)) {
            task.assignees.push(k);
            out.push({ kind: 'assignee_added' });
          }
        }
        break;
      }
      case 'change_priority':
        task.priority = a.to ?? undefined;
        out.push({ kind: 'priority', to: a.to });
        break;
      case 'change_due_date':
        task.due = a.remove ? undefined : dayStart(t) + (a.daysAfter ?? 0) * DAY;
        out.push({ kind: 'due_changed' });
        break;
      case 'change_start_date':
        task.start = dayStart(t) + (a.daysAfter ?? 0) * DAY;
        break;
      case 'change_tags': {
        const added = (a.add ?? []).filter((x) => !task.tags.includes(x));
        task.tags = [...task.tags.filter((x) => !(a.remove ?? []).includes(x)), ...added];
        if (added.length) out.push({ kind: 'tags_added', tags: added });
        break;
      }
      case 'change_followers':
        for (const p of a.add) {
          const k = resolve(p);
          if (k && !task.followers.includes(k)) task.followers.push(k);
        }
        break;
      case 'add_comment':
        message = { kind: 'comment', from: 'ClickUp Automation', body: renderVars(a.body, task, names) };
        out.push({ kind: 'comment' });
        break;
      case 'apply_template':
        for (const n of a.subtasks ?? []) {
          task.subtasks.push({ name: n, done: false });
          out.push({ kind: 'created', subtask: true });
        }
        for (const n of a.checklist ?? []) task.checklist.push({ name: n, done: false });
        break;
      case 'create_subtask':
        task.subtasks.push({ name: a.name, done: false, assignee: a.assignee });
        out.push({ kind: 'created', subtask: true });
        break;
      case 'create_task':
        task.links.push(`${renderVars(a.name, task, names)} (${a.list})`);
        break;
      case 'add_to_list':
        if (!task.alsoIn.includes(a.list)) task.alsoIn.push(a.list);
        break;
      case 'move_to_list':
        task.list = a.list;
        break;
      case 'update_custom_field': {
        const v = a.onTriggerDate ? formatDay(t) : a.value!;
        task.fields[a.field] = v;
        out.push({ kind: 'field', field: a.field, to: v });
        break;
      }
      case 'estimate_time':
        task.estimate = a.minutes;
        break;
      case 'add_to_current_sprint':
        task.sprint = 'Current Sprint';
        break;
      case 'send_channel_message':
        message = { kind: 'chat', from: a.channel, body: renderVars(a.body, task, names) };
        break;
      case 'call_webhook':
        message = { kind: 'webhook', from: a.url, body: renderVars(a.payload, task, names) };
        break;
      case 'share_task':
        if (!task.shared.some((s) => s.who === a.with)) task.shared.push({ who: a.with, permission: a.permission });
        break;
      case 'archive_task':
        task.archived = true;
        break;
    }
    const d = describeAction(a, names);
    // Date Actions show the date they set, not only the rule.
    const set = a.type === 'change_due_date' && task.due !== undefined ? task.due : a.type === 'change_start_date' ? task.start : undefined;
    // People-field Actions show who that turned out to be.
    const whoNow = a.type === 'change_assignees' && a.to?.some((p) => typeof p !== 'string') ? `: now ${task.assignees.map((k) => who(names, k)).join(', ') || 'nobody'}` : '';
    const dated = a.type === 'update_custom_field' && a.onTriggerDate ? `: ${formatDay(t)}` : '';
    const detail = renderVars(d.detail, task, names) + (set !== undefined ? `: ${formatDay(set)}` : '') + whoNow + dated;
    log(t, 'action', d.title, a.type === 'add_comment' || a.type === 'send_channel_message' || a.type === 'call_webhook' ? undefined : detail, { auto: auto.id, message });
    return out;
  };

  /** Runs every Automation whose Trigger matches one of these signals. */
  const fire = (signals: Signal[], t: number, by?: string) => {
    for (const s of signals) {
      for (const a of proc.automations) {
        if (!matches(a, s, formName)) continue;
        if (task.archived) return;
        const bad = failing(a.conditions, task, t);
        const trig = describeTrigger(a.trigger);
        if (bad) {
          blocked.push(a.id);
          const key = `${a.id}|${task.status}|${describeCondition(bad, names)}`;
          if (s.kind === 'scheduled' && a.trigger.type === 'every') {
            if (quietSkips.has(key)) continue;
            quietSkips.add(key);
          }
          log(t, 'skip', `${a.name}: Conditions not met`, `${trig.title} matched, but “${describeCondition(bad, names)}” is false: ${found(bad, task, t, names)}. Nothing changes.`, { auto: a.id });
          continue;
        }
        fired.push(a.id);
        log(t, 'trigger', `Automation: ${a.name}`, [trig.title, trig.detail].filter(Boolean).join(' · '), { auto: a.id });
        for (const action of a.actions) {
          const raised = act(action, t, by, a);
          for (const r of raised) for (const other of proc.automations) if (matches(other, r, formName)) chains.push(`${a.id} → ${other.id}`);
        }
      }
    }
  };

  /** Applies one thing a person does; returns its signals. */
  const happen = (e: ScenarioEvent, t: number): Signal[] => {
    const by = e.by ? who(names, e.by) : undefined;
    const say = (title: string, detail?: string, message?: TraceMessage) => log(t, 'event', e.label ?? title, detail, { message });
    switch (e.type) {
      case 'status': {
        const from = task.status;
        task.status = e.to;
        task.statusSince = t;
        say(`${by ?? 'Someone'} moves it to ${e.to}`, `Status: ${from} → ${e.to}`);
        return from === e.to ? [] : [{ kind: 'status', from, to: e.to }];
      }
      case 'field':
        task.fields[e.field] = e.value;
        say(`${by ?? 'Someone'} sets ${e.field}`, `${e.field}: ${typeof e.value === 'string' && names[e.value] ? names[e.value] : String(e.value)}`);
        return [{ kind: 'field', field: e.field, to: e.value }];
      case 'tag': {
        const added = (e.add ?? []).filter((x) => !task.tags.includes(x));
        task.tags = [...task.tags.filter((x) => !(e.remove ?? []).includes(x)), ...added];
        say(`${by ?? 'Someone'} ${e.add ? `adds the tag ${e.add.join(', ')}` : `removes the tag ${e.remove!.join(', ')}`}`);
        return added.length ? [{ kind: 'tags_added', tags: added }] : [];
      }
      case 'priority':
        task.priority = e.to;
        say(`${by ?? 'Someone'} sets the priority to ${e.to}`);
        return [{ kind: 'priority', to: e.to }];
      case 'assign':
        if (!task.assignees.includes(e.add)) task.assignees.push(e.add);
        say(`${by ?? 'Someone'} assigns ${who(names, e.add)}`);
        return [{ kind: 'assignee_added' }];
      case 'comment':
        say(`${by ?? 'Someone'} comments`, undefined, { kind: 'comment', from: by, body: e.body });
        return [{ kind: 'comment' }];
      case 'subtask_done':
      case 'checklist_done':
      case 'blocker_done': {
        const items = e.type === 'subtask_done' ? task.subtasks : e.type === 'checklist_done' ? task.checklist : task.waitingOn;
        const item = items.find((x) => x.name === e.name);
        if (!item) throw new Error(`no ${e.type.replace('_done', '')} "${e.name}" on the task`);
        const wasOpen = items.some((x) => !x.done);
        item.done = true;
        const noun = e.type === 'subtask_done' ? 'subtask' : e.type === 'checklist_done' ? 'checklist item' : 'blocking task';
        say(e.type === 'blocker_done' ? `“${e.name}” is done` : `${by ?? 'Someone'} closes the ${noun} “${e.name}”`, e.type === 'blocker_done' ? blockingLeft(items.filter((x) => !x.done).length) : undefined);
        if (!wasOpen || items.some((x) => !x.done)) return [];
        return [{ kind: e.type === 'subtask_done' ? 'subtasks_resolved' : e.type === 'checklist_done' ? 'checklists_resolved' : 'unblocked' }];
      }
      case 'due':
        task.due = day0 + e.day * DAY;
        say(`${by ?? 'Someone'} moves the due date to ${formatDay(task.due)}`);
        return [{ kind: 'due_changed' }];
      case 'track_time':
        task.tracked += e.minutes;
        say(`${by ?? 'Someone'} tracks ${fmtSpan(e.minutes)} on the task`);
        return [{ kind: 'time_tracked' }];
      case 'note':
        log(t, 'event', e.label ?? e.text, undefined, { outside: true });
        return [];
    }
  };

  // The run starts with the task being created, or already in the List.
  const creator = sc.task.creator ? who(names, sc.task.creator) : undefined;
  if (sc.created === 'form') {
    log(sc.start, 'event', `Form submitted: a new task in ${task.list}`, `“${task.name}”, created from the Form “${formName ?? 'Form'}”`);
    fire([{ kind: 'created', form: true }], sc.start);
  } else if (sc.created === 'manual') {
    log(sc.start, 'event', `${creator ?? 'Someone'} creates the task in ${task.list}`, `“${task.name}”`);
    fire([{ kind: 'created' }], sc.start);
  } else {
    log(sc.start, 'event', `The task is in ${task.list}`, `“${task.name}”, status ${task.status}`);
  }

  // Events and scheduled moments, in time order.
  const events = [...sc.events].sort((a, b) => a.at - b.at);
  const lastEvent = events.length ? events[events.length - 1].at : 0;
  const datesEnd = Math.max(task.due ?? 0, task.start ?? 0) + 6 * 60 - sc.start;
  const end = sc.start + (sc.until ?? Math.max(lastEvent, datesEnd) + DAY);
  const scheduled = proc.automations.filter((a) => a.trigger.type === 'every');
  const firedDates = new Set<string>();
  let i = 0;
  for (let day = day0; day <= end; day += DAY) {
    // Moments today: 4 AM for date Triggers, each Every… Trigger at its time.
    const moments: { t: number; auto?: CuAutomation }[] = [{ t: day + 240 }];
    for (const a of scheduled) {
      const tr = a.trigger as Extract<Trigger, { type: 'every' }>;
      const dow = Math.floor(day / DAY) % 7;
      if (tr.days.includes(dow)) {
        const [h, m] = tr.at.split(':').map(Number);
        moments.push({ t: day + h * 60 + m, auto: a });
      }
    }
    moments.sort((a, b) => a.t - b.t);
    for (const m of moments) {
      while (i < events.length && sc.start + events[i].at < m.t && sc.start + events[i].at <= end) {
        const e = events[i++];
        const t = sc.start + e.at;
        fire(happen(e, t), t, e.by);
        if (task.archived) break;
      }
      if (task.archived) break;
      if (m.t <= sc.start || m.t > end) continue;
      if (m.auto) {
        if (!isFinished(proc, task.status)) fire([{ kind: 'scheduled', auto: m.auto.id }], m.t);
        continue;
      }
      // Date Triggers, once per date value.
      const once = (key: string) => !firedDates.has(key) && (firedDates.add(key), true);
      if (task.due === day && once(`due@${day}`)) fire([{ kind: 'due_arrives' }], m.t);
      if (task.start === day && once(`start@${day}`)) fire([{ kind: 'start_arrives' }], m.t);
      for (const a of proc.automations) {
        const tr = a.trigger;
        if (tr.type !== 'date_before_after') continue;
        const base = tr.date === 'due' ? task.due : task.start;
        if (base === undefined) continue;
        const target = base + (tr.when === 'before' ? -tr.days : tr.days) * DAY;
        if (target === day && once(`${a.id}@${base}`)) fire([{ kind: 'scheduled', auto: a.id }], m.t);
      }
    }
    if (task.archived) break;
  }
  // Events after the last scheduled moment of the last day.
  while (!task.archived && i < events.length) {
    const e = events[i++];
    const t = sc.start + e.at;
    fire(happen(e, t), t, e.by);
  }
  const last = steps[steps.length - 1].t;
  log(last, 'end', task.archived ? 'Task archived' : `Run ends: ${task.status}`, isFinished(proc, task.status) ? 'The task is in a Done or Closed status.' : 'The task is still open; the next person picks it up from here.');
  return { start: sc.start, end: last, steps, task, fired, blocked, chains };
}

/** Counts used in the hero and case headers. */
export const countActions = (p: Process) => p.automations.reduce((n, a) => n + a.actions.length, 0);
