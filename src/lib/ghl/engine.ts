/**
 * A small, deterministic runner for the workflows in src/data/ghl.
 *
 * It follows the GHL builder's rules closely enough to be honest about them:
 * If/Else branches never merge back, a Goal Event pulls the contact forward
 * the moment the goal happens, Stop on Response ends the run on any reply,
 * DND skips a message instead of sending it, and the workflow time window
 * holds steps until it opens. Time is simulated: a run that spans two weeks
 * finishes instantly and every step carries its simulated timestamp.
 */
import type {
  ActionNode,
  Automation,
  Condition,
  Contact,
  EventType,
  GoalNode,
  Scenario,
  ScenarioEvent,
  Step,
  SubAccountEnv,
  WaitNode,
  WorkflowSettings,
} from './types';

/** Monday 2 March 2026, 00:00. Scenario times are minutes after this. */
const BASE = Date.UTC(2026, 2, 2);
const DAY = 1440;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTime(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDay(min: number): string {
  const d = new Date(BASE + Math.floor(min / DAY) * DAY * 60000);
  return `${DAYS[(d.getUTCDay() + 6) % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatClock(min: number): string {
  return `${formatDay(min)} · ${formatTime(min)}`;
}

export function formatDuration(min: number): string {
  if (min <= 0) return '0 min';
  const d = Math.floor(min / DAY);
  const h = Math.floor((min % DAY) / 60);
  const m = min % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
  if (h) parts.push(`${h} hr`);
  if (m) parts.push(`${m} min`);
  return parts.slice(0, 2).join(' ');
}

const EVENT_LABEL: Record<EventType, string> = {
  reply: 'Contact replied',
  appointment_booked: 'Appointment booked',
  appointment_confirmed: 'Appointment confirmed',
  appointment_showed: 'Appointment status: Showed',
  appointment_noshow: 'Appointment status: No-show',
  appointment_cancelled: 'Appointment cancelled',
  link_clicked: 'Trigger link clicked',
  email_opened: 'Email opened',
  call_answered: 'Call answered',
  payment: 'Payment received',
  opportunity_won: 'Opportunity marked won',
  opportunity_lost: 'Opportunity marked lost',
  tag_added: 'Tag added',
  review_left: 'Review left',
  survey_submitted: 'Survey submitted',
  form_submitted: 'Form submitted',
  invoice_paid: 'Invoice paid',
  payment_failed: 'Payment failed',
  order_submitted: 'Order submitted',
  document_signed: 'Document signed',
  product_started: 'Course started',
  lesson_completed: 'Lesson completed',
  product_completed: 'Course completed',
};

/** GHL's appointment statuses: New, Confirmed, Cancelled, Showed, No-show, Invalid. */
const APPT_LABEL = { booked: 'New', confirmed: 'Confirmed', showed: 'Showed', noshow: 'No-show', cancelled: 'Cancelled' } as const;

export function eventLabel(type: EventType): string {
  return EVENT_LABEL[type];
}

/** Plain-English version of a condition, as it would read in the If/Else editor. */
export function describeCondition(c: Condition): string {
  switch (c.type) {
    case 'tag':
      return `Contact tag includes ${c.has}`;
    case 'no_tag':
      return `Contact tag does not include ${c.has}`;
    case 'field': {
      if (c.label) return c.label;
      const ops = { eq: 'is', neq: 'is not', gt: 'is greater than', gte: 'is at least', lt: 'is less than', lte: 'is at most', empty: 'is empty', not_empty: 'is not empty', contains: 'contains' };
      return `${c.key} ${ops[c.op]}${c.value === undefined ? '' : ` ${c.value}`}`;
    }
    case 'event':
      return c.label ?? `${EVENT_LABEL[c.event]}${c.value === undefined ? '' : `: ${c.value}`}`;
    case 'reply_matches':
      return c.label ?? `Reply contains ${c.words.map((w) => `“${w}”`).join(' or ')}`;
    case 'dnd':
      return `Contact is DND for ${c.channel.toUpperCase()}`;
    case 'opportunity':
      return `Opportunity ${c.stage ? `stage is ${c.stage}` : ''}${c.stage && c.status ? ' and ' : ''}${c.status ? `status is ${c.status}` : ''}`;
    case 'appointment':
      return [c.calendar && `Appointment calendar is ${c.calendar}`, c.status && `Appointment status is ${APPT_LABEL[c.status]}`].filter(Boolean).join(' and ');
    case 'var': {
      if (c.label) return c.label;
      const ops = { eq: 'is', neq: 'is not', gt: '>', gte: '≥', lt: '<', lte: '≤' };
      return `${c.key} ${ops[c.op]} ${c.value}`;
    }
    case 'all':
      return c.label ?? c.of.map(describeCondition).join(' AND ');
    case 'any':
      return c.label ?? c.of.map(describeCondition).join(' OR ');
    case 'not':
      return c.label ?? `Not: ${describeCondition(c.of)}`;
  }
}

/** Merge-field environment for one sub-account. Trigger links render for {{trigger_link.<id>}}. */
export type MergeEnv = SubAccountEnv;

export interface Appointment {
  start: number;
  status: 'booked' | 'confirmed' | 'showed' | 'noshow' | 'cancelled';
  calendar?: string;
}

/** Builds the object merge fields resolve against, e.g. contact.first_name. */
function mergeContext(contact: Contact, env: MergeEnv, appt: Appointment | undefined, vars: Record<string, unknown>) {
  const user = (contact.assignedTo && env.users[contact.assignedTo]) || Object.values(env.users)[0];
  const snake: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(contact.fields)) snake[k] = v;
  return {
    contact: {
      first_name: contact.firstName,
      last_name: contact.lastName,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      full_name: `${contact.firstName} ${contact.lastName}`.trim(),
      phone: contact.phone,
      email: contact.email,
      source: contact.source ?? '',
      ...snake,
    },
    user,
    location: env.location,
    custom_values: env.customValues,
    trigger_link: env.triggerLinks ?? {},
    appointment: appt
      ? {
          start_time: formatClock(appt.start),
          only_start_date: formatDay(appt.start),
          only_start_time: formatTime(appt.start),
          day_of_week: DAYS[Math.floor(appt.start / DAY) % 7],
          reschedule_link: `${env.location.website}/reschedule`,
          cancellation_link: `${env.location.website}/cancel`,
          meeting_location: 'At your property',
          add_to_google_calendar: `${env.location.website}/calendar`,
          title: appt.calendar ?? 'Appointment',
        }
      : {},
    custom_code: vars,
  };
}

export function renderMerge(tpl: string, ctx: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, path: string) => {
    let cur: unknown = ctx;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
      else return whole;
    }
    return cur === undefined || cur === null || typeof cur === 'object' ? whole : String(cur);
  });
}

export type TraceKind = 'trigger' | 'action' | 'wait' | 'branch' | 'goal' | 'event' | 'skip' | 'hold' | 'stop' | 'end';

export interface TraceMessage {
  channel: 'sms' | 'email' | 'internal' | 'slack' | 'voicemail';
  direction: 'out' | 'in';
  subject?: string;
  body: string;
  to?: string;
}

export interface TraceStep {
  t: number;
  kind: TraceKind;
  nodeId?: string;
  /** For branch steps: the key of the branch taken, e.g. "if-score:0" or "if-score:else". */
  branch?: string;
  title: string;
  detail?: string;
  message?: TraceMessage;
  contact: Contact;
}

export interface Trace {
  steps: TraceStep[];
  outcome: 'completed' | 'stopped' | 'goal' | 'ended';
  /** Node ids that ran, plus branch keys that were taken. */
  visited: string[];
  /** Node ids skipped (DND, no appointment…). */
  skipped: string[];
  contact: Contact;
  vars: Record<string, string | number | boolean>;
  start: number;
  end: number;
}

class Halt {
  constructor(
    public outcome: Trace['outcome'],
    public t: number,
  ) {}
}
class GoToJump {
  constructor(public target: string) {}
}
class GoalJump {
  constructor(
    public t: number,
    public frame: number,
    public index: number,
    public goal: GoalNode,
  ) {}
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function mergeContact(base: Contact, over: Partial<Contact> = {}): Contact {
  return {
    ...clone(base),
    ...clone(over),
    tags: [...(over.tags ?? base.tags)],
    dnd: { ...base.dnd, ...over.dnd },
    fields: { ...base.fields, ...over.fields },
  };
}

/**
 * The contact a run starts with: the sample contact, the scenario's
 * differences on top, then (for the landing-page demo) the visitor's own
 * name and answers on top of that.
 */
export function startContact(base: Contact, scenario: Scenario, identity?: Partial<Contact>): Contact {
  return mergeContact(mergeContact(base, scenario.contact), identity);
}

function hhmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Next minute (>= t) inside the workflow time window, or t if there is no window. */
export function nextWindowOpen(t: number, win: WorkflowSettings['timeWindow']): number {
  if (!win) return t;
  const start = hhmm(win.start);
  const end = hhmm(win.end);
  for (let i = 0; i < 8; i++) {
    const dayStart = (Math.floor(t / DAY) + i) * DAY;
    const dow = Math.floor(dayStart / DAY) % 7;
    if (!win.days.includes(dow)) continue;
    const open = dayStart + start;
    const close = dayStart + end;
    const from = i === 0 ? Math.max(t, open) : open;
    if (from < close) return from;
  }
  return t;
}

export function simulate(auto: Automation, scenario: Scenario, baseContact: Contact, env: MergeEnv, identity?: Partial<Contact>): Trace {
  const wf = auto.workflow;
  const settings = wf.settings;
  const start = scenario.start;
  const contact = startContact(baseContact, scenario, identity);
  const vars: Record<string, string | number | boolean> = {};
  const steps: TraceStep[] = [];
  const visited: string[] = [];
  const skipped: string[] = [];
  const queue: ScenarioEvent[] = [...scenario.events].map((e) => ({ ...e, at: start + e.at })).sort((a, b) => a.at - b.at);
  const fired: ScenarioEvent[] = [];
  /** Where the contact is: one frame per nested step list, innermost last. */
  const path: { list: Step[]; index: number }[] = [];
  const goalsMet = new Set<string>();
  let lastReply: string | undefined;
  let appt: Appointment | undefined = scenario.appointment ? { start: start + scenario.appointment.at, status: 'booked', calendar: scenario.appointment.calendar } : undefined;
  let t = start;
  let budget = 400;
  /** Stop on Response only reacts to replies once this workflow has messaged the contact. */
  let messaged = false;

  const log = (s: Omit<TraceStep, 'contact' | 't'> & { t?: number }) => {
    if (--budget < 0) throw new Error(`${auto.id}/${scenario.id}: more than 400 log entries, probably a Go To loop`);
    steps.push({ t: s.t ?? t, ...s, contact: clone(contact) });
  };
  const matches = (ev: ScenarioEvent, type: EventType, value?: string | number) => ev.type === type && (value === undefined || value === ev.value);
  const hasFired = (type: EventType, value?: string | number) => fired.some((e) => matches(e, type, value));

  /** A Goal Event further along the contact's current path that this event satisfies. */
  function goalAhead(ev: ScenarioEvent): { frame: number; index: number; goal: GoalNode } | undefined {
    for (let f = path.length - 1; f >= 0; f--) {
      const { list, index } = path[f];
      for (let i = index + 1; i < list.length; i++) {
        const s = list[i];
        if (s.kind === 'goal' && !goalsMet.has(s.id) && matches(ev, s.event, s.value)) return { frame: f, index: i, goal: s };
      }
    }
    return undefined;
  }

  function applyEvent(ev: ScenarioEvent) {
    fired.push(ev);
    let detail: string | undefined = ev.label;
    let message: TraceMessage | undefined;
    switch (ev.type) {
      case 'reply':
        lastReply = String(ev.value ?? '');
        vars.replied = true;
        message = { channel: 'sms', direction: 'in', body: lastReply };
        if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i.test(lastReply)) {
          contact.dnd.sms = true;
          detail = detail ?? 'Opt-out keyword: SMS DND switched on automatically';
        }
        break;
      case 'appointment_booked':
        appt = { start: ev.appointmentAt !== undefined ? start + ev.appointmentAt : ev.at + DAY, status: 'booked', calendar: ev.value === undefined ? undefined : String(ev.value) };
        detail = detail ?? `${appt.calendar ? `${appt.calendar}, ` : ''}${formatClock(appt.start)}`;
        break;
      case 'appointment_confirmed':
        if (appt) appt.status = 'confirmed';
        break;
      case 'appointment_showed':
        if (appt) appt.status = 'showed';
        break;
      case 'appointment_noshow':
        if (appt) appt.status = 'noshow';
        break;
      case 'appointment_cancelled':
        if (appt) appt.status = 'cancelled';
        break;
      case 'link_clicked':
        vars[`clicked_${ev.value}`] = true;
        detail = detail ?? String(ev.value ?? '');
        break;
      case 'email_opened':
        vars.email_opened = true;
        break;
      case 'call_answered':
        vars.call_answered = true;
        break;
      case 'payment':
        vars.payment = Number(ev.value ?? 0);
        detail = detail ?? `$${Number(ev.value ?? 0).toLocaleString('en-US')}`;
        break;
      case 'opportunity_won':
        if (contact.opportunity) contact.opportunity.status = 'won';
        break;
      case 'opportunity_lost':
        if (contact.opportunity) contact.opportunity.status = 'lost';
        break;
      case 'tag_added':
        if (ev.value && !contact.tags.includes(String(ev.value))) contact.tags.push(String(ev.value));
        detail = detail ?? String(ev.value ?? '');
        break;
      case 'review_left':
        vars.review_rating = Number(ev.value ?? 0);
        detail = detail ?? `${ev.value}★`;
        break;
      case 'survey_submitted':
        vars.survey_score = Number(ev.value ?? 0);
        detail = detail ?? `Score ${ev.value}`;
        break;
      default:
        // Payments, documents, courses and forms: remember that it happened, and the value if any.
        vars[ev.type] = ev.value ?? true;
        if (ev.value !== undefined && detail === undefined) detail = typeof ev.value === 'number' ? `$${ev.value.toLocaleString('en-US')}` : String(ev.value);
        break;
    }
    log({ t: ev.at, kind: 'event', title: EVENT_LABEL[ev.type], detail, message });
  }

  /**
   * Moves the clock to `target`, applying scenario events on the way. Returns
   * the time a watched event happened, if it did. Throws for goal jumps,
   * removals by another workflow and Stop on Response.
   */
  function advanceTo(target: number, watch?: { event: EventType }): number | undefined {
    while (queue.length && queue[0].at <= target) {
      const ev = queue.shift()!;
      t = Math.max(t, ev.at);
      applyEvent(ev);
      const exit = settings.exits?.find((x) => matches(ev, x.event, x.value));
      if (exit) {
        log({ kind: 'stop', title: 'Removed from this workflow', detail: exit.by });
        throw new Halt('ended', ev.at);
      }
      const ahead = goalAhead(ev);
      if (ahead) throw new GoalJump(ev.at, ahead.frame, ahead.index, ahead.goal);
      if (settings.stopOnResponse && ev.type === 'reply' && messaged) {
        log({ kind: 'stop', title: 'Stop on Response', detail: 'The contact replied to a message from this workflow, so they leave it and a person picks up the conversation.' });
        throw new Halt('stopped', ev.at);
      }
      if (watch && ev.type === watch.event) return ev.at;
    }
    t = Math.max(t, target);
    return undefined;
  }

  function evaluate(c: Condition): boolean {
    switch (c.type) {
      case 'tag':
        return contact.tags.includes(c.has);
      case 'no_tag':
        return !contact.tags.includes(c.has);
      case 'field':
        return compare(contact.fields[c.key], c.op, c.value);
      case 'event':
        return hasFired(c.event, c.value);
      case 'reply_matches':
        return !!lastReply && c.words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lastReply!));
      case 'dnd':
        return !!contact.dnd[c.channel];
      case 'opportunity':
        return !!contact.opportunity && (!c.stage || contact.opportunity.stage === c.stage) && (!c.status || contact.opportunity.status === c.status);
      case 'var':
        return compare(vars[c.key], c.op, c.value);
      case 'appointment':
        return !!appt && (!c.status || appt.status === c.status) && (!c.calendar || appt.calendar === c.calendar);
      case 'all':
        return c.of.every(evaluate);
      case 'any':
        return c.of.some(evaluate);
      case 'not':
        return !evaluate(c.of);
    }
  }

  function applyEffect(e: NonNullable<ActionNode['effect']>) {
    for (const tag of e.addTags ?? []) if (!contact.tags.includes(tag)) contact.tags.push(tag);
    if (e.removeTags) contact.tags = contact.tags.filter((tag) => !e.removeTags!.includes(tag));
    if (e.fields) Object.assign(contact.fields, e.fields);
    if (e.assignTo) contact.assignedTo = e.assignTo;
    if (e.dnd) Object.assign(contact.dnd, e.dnd);
    if (e.opportunity) {
      contact.opportunity = { pipeline: '', stage: '', status: 'open', ...contact.opportunity, ...e.opportunity };
    }
  }

  function runAction(node: ActionNode) {
    const msg = node.message;
    const toContact = !!msg && (msg.channel === 'sms' || msg.channel === 'email' || msg.channel === 'voicemail');
    if (toContact) {
      const channel = msg!.channel === 'voicemail' ? 'calls' : (msg!.channel as 'sms' | 'email');
      if (contact.dnd[channel]) {
        skipped.push(node.id);
        log({ kind: 'skip', nodeId: node.id, title: `${node.title} skipped`, detail: `The contact is DND for ${channel === 'calls' ? 'calls and voicemail' : channel.toUpperCase()}, so GHL does not send it.` });
        return;
      }
      // The workflow Time Window holds communication steps only.
      const open = nextWindowOpen(t, settings.timeWindow);
      if (open > t) {
        log({ kind: 'hold', nodeId: node.id, title: 'Held by the time window', detail: `Outside the workflow's time window, so this waits until ${formatClock(open)}.` });
        advanceTo(open);
      }
    }
    let detail = node.summary;
    if (node.run) {
      const out = node.run({ contact, vars, lastReply, now: t });
      if (out.vars) Object.assign(vars, out.vars);
      if (out.effect) applyEffect(out.effect);
      if (out.log) detail = out.log;
      if (out.eventStart !== undefined) appt = { start: out.eventStart, status: 'booked' };
    }
    if (node.effect) applyEffect(node.effect);
    let message: TraceMessage | undefined;
    if (msg) {
      const ctx = mergeContext(contact, env, appt, vars);
      message = {
        channel: msg.channel,
        direction: 'out',
        subject: msg.subject ? renderMerge(msg.subject, ctx) : undefined,
        body: renderMerge(msg.body, ctx),
        to: msg.to ? renderMerge(msg.to, ctx) : undefined,
      };
    }
    if (toContact) messaged = true;
    visited.push(node.id);
    log({ kind: 'action', nodeId: node.id, title: node.label ? `${node.title}: ${node.label}` : node.title, detail, message });
  }

  function runWait(node: WaitNode): Step[] | undefined {
    visited.push(node.id);
    const title = node.label ?? (node.mode === 'time' ? `Wait ${formatDuration(node.minutes ?? 0)}` : node.title);
    if (node.mode === 'time') {
      log({ kind: 'wait', nodeId: node.id, title, detail: node.summary });
      advanceTo(t + (node.minutes ?? 0));
      if (node.window) {
        const open = nextWindowOpen(t, node.window);
        if (open > t) {
          log({ kind: 'hold', nodeId: node.id, title: 'Advance Window', detail: `Only resumes inside its window, so it waits until ${formatClock(open)}.` });
          advanceTo(open);
        } else if (!node.minutes) {
          steps[steps.length - 1].detail = `${node.summary} Inside the window, so it moves straight on.`;
        }
      }
      return undefined;
    }
    if (node.mode === 'before_appointment' || node.mode === 'after_appointment') {
      if (!appt) {
        skipped.push(node.id);
        log({ kind: 'skip', nodeId: node.id, title: `${title} skipped`, detail: 'No appointment on the record, so there is nothing to wait for.' });
        return undefined;
      }
      const target = node.mode === 'before_appointment' ? appt.start - (node.offset ?? 0) : appt.start + (node.offset ?? 0);
      if (target <= t) {
        log({ kind: 'wait', nodeId: node.id, title, detail: 'That time has already passed, so the workflow moves to the next step.' });
        return undefined;
      }
      log({ kind: 'wait', nodeId: node.id, title, detail: `${node.summary} Resumes ${formatClock(target)}.` });
      advanceTo(target);
      return undefined;
    }
    // Wait for an event, with a timeout.
    log({ kind: 'wait', nodeId: node.id, title, detail: node.summary });
    const metAt = advanceTo(t + (node.minutes ?? DAY), { event: node.event! });
    const met = metAt !== undefined;
    vars[`waited_${node.id}`] = met ? 'met' : 'timeout';
    if (!node.branches) return undefined;
    const b = met ? node.branches.met : node.branches.timeout;
    const key = `${node.id}:${met ? 'met' : 'timeout'}`;
    visited.push(key);
    log({ kind: 'branch', nodeId: node.id, branch: key, title: b.label, detail: met ? `${EVENT_LABEL[node.event!]} before the timeout.` : `No ${EVENT_LABEL[node.event!].toLowerCase()} within ${formatDuration(node.minutes ?? DAY)}.` });
    return b.nodes;
  }

  /** Runs one step. Returns a branch to descend into, if the step split. */
  function runStep(node: Step): Step[] | undefined {
    switch (node.kind) {
      case 'action':
        runAction(node);
        return undefined;
      case 'wait':
        return runWait(node);
      case 'ifelse': {
        visited.push(node.id);
        const idx = node.branches.findIndex((b) => evaluate(b.when));
        const b = idx >= 0 ? node.branches[idx] : node.otherwise;
        const key = `${node.id}:${idx >= 0 ? idx : 'else'}`;
        visited.push(key);
        log({ kind: 'branch', nodeId: node.id, branch: key, title: `${node.label ?? node.title}: ${b.label}`, detail: idx >= 0 ? describeCondition(node.branches[idx].when) : 'No condition matched, so the None branch runs.' });
        return b.nodes;
      }
      case 'goal': {
        visited.push(node.id);
        if (hasFired(node.event, node.value)) {
          goalsMet.add(node.id);
          log({ kind: 'goal', nodeId: node.id, title: `Goal met: ${node.label ?? EVENT_LABEL[node.event]}`, detail: node.summary });
        } else if (node.ifNotMet === 'end') {
          log({ kind: 'end', nodeId: node.id, title: 'Goal not met: End this workflow', detail: node.summary });
          throw new Halt('ended', t);
        } else {
          log({ kind: 'goal', nodeId: node.id, title: 'Goal not met: Continue anyway', detail: node.summary });
        }
        return undefined;
      }
      case 'goto':
        visited.push(node.id);
        log({ kind: 'branch', nodeId: node.id, title: `${node.title}: ${stepName(node.target)}`, detail: node.summary });
        throw new GoToJump(node.target);
      case 'end':
        visited.push(node.id);
        log({ kind: 'end', nodeId: node.id, title: node.title, detail: node.summary });
        throw new Halt('ended', t);
    }
  }

  function stepName(id: string): string {
    const found = locate(wf.steps, id);
    const s = found?.list[found.index];
    if (!s) return id;
    return ('label' in s && s.label) || s.title;
  }

  /**
   * Walks the tree. A split (If/Else, or a wait with branches) is always the
   * last step of its list, because GHL branches never rejoin; descending into
   * the chosen branch therefore replaces the rest of the current list.
   */
  function run(list: Step[], from: number) {
    path.push({ list, index: from });
    const frame = path.length - 1;
    for (let i = from; i < list.length; i++) {
      path[frame].index = i;
      const branch = runStep(list[i]);
      if (branch) {
        run(branch, 0);
        break;
      }
    }
    path.pop();
  }

  const trigger = wf.triggers[scenario.trigger ?? 0];
  log({ kind: 'trigger', title: `Trigger: ${trigger.label ?? trigger.title}`, detail: trigger.filters.join(' · ') || undefined });

  let outcome: Trace['outcome'] = 'completed';
  try {
    let next: (() => void) | undefined = () => run(wf.steps, 0);
    while (next) {
      const go = next;
      next = undefined;
      try {
        go();
      } catch (e) {
        if (e instanceof GoalJump) {
          const jump = e;
          goalsMet.add(jump.goal.id);
          visited.push(jump.goal.id);
          log({ t: jump.t, kind: 'goal', nodeId: jump.goal.id, title: `Goal met: ${jump.goal.label ?? EVENT_LABEL[jump.goal.event]}`, detail: `${jump.goal.summary} The contact skips straight here from wherever they were waiting.` });
          // Continue after the goal in the list that holds it; deeper frames are abandoned.
          const holder = path[jump.frame];
          path.length = jump.frame;
          next = () => run(holder.list, jump.index + 1);
        } else if (e instanceof GoToJump) {
          const found = locate(wf.steps, e.target);
          if (!found) throw new Error(`${auto.id}: Go To target ${e.target} not found`);
          path.length = 0;
          path.push(...found.ancestors);
          next = () => run(found.list, found.index);
        } else throw e;
      }
    }
    outcome = goalsMet.size ? 'goal' : 'completed';
    log({ kind: 'end', title: 'Workflow complete', detail: 'The contact has reached the end of the workflow.' });
  } catch (e) {
    if (e instanceof Halt) {
      outcome = e.outcome;
      t = e.t;
    } else throw e;
  }

  return { steps, outcome, visited, skipped, contact, vars, start, end: t };
}

/** Finds a step anywhere in the tree, with the frames that lead to it. */
function locate(list: Step[], id: string, ancestors: { list: Step[]; index: number }[] = []): { list: Step[]; index: number; ancestors: { list: Step[]; index: number }[] } | undefined {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.id === id) return { list, index: i, ancestors };
    const here = [...ancestors, { list, index: i }];
    const children: Step[][] =
      s.kind === 'ifelse' ? [...s.branches.map((b) => b.nodes), s.otherwise.nodes] : s.kind === 'wait' && s.branches ? [s.branches.met.nodes, s.branches.timeout.nodes] : [];
    for (const c of children) {
      const found = locate(c, id, here);
      if (found) return found;
    }
  }
  return undefined;
}

function compare(v: unknown, op: string, target: unknown): boolean {
  switch (op) {
    case 'empty':
      return v === undefined || v === '' || v === null;
    case 'not_empty':
      return !(v === undefined || v === '' || v === null);
    case 'eq':
      return v === target;
    case 'neq':
      return v !== target;
    case 'contains':
      return typeof v === 'string' && typeof target === 'string' && v.toLowerCase().includes(target.toLowerCase());
    case 'gt':
      return Number(v) > Number(target);
    case 'gte':
      return Number(v) >= Number(target);
    case 'lt':
      return Number(v) < Number(target);
    case 'lte':
      return Number(v) <= Number(target);
    default:
      return false;
  }
}

/** Counts the steps in a workflow, branches included. */
export function countSteps(list: Step[]): number {
  let n = 0;
  for (const s of list) {
    n++;
    if (s.kind === 'ifelse') {
      for (const b of s.branches) n += countSteps(b.nodes);
      n += countSteps(s.otherwise.nodes);
    }
    if (s.kind === 'wait' && s.branches) n += countSteps(s.branches.met.nodes) + countSteps(s.branches.timeout.nodes);
  }
  return n;
}

/** Minutes of the next `dow` (0 = Monday) at `minuteOfDay`, strictly after `from` plus `leadMinutes`. */
export function nextDayAt(from: number, dow: number, minuteOfDay: number, leadMinutes = 0): number {
  let day = Math.floor(from / DAY);
  for (let i = 0; i < 15; i++, day++) {
    const at = day * DAY + minuteOfDay;
    if (day % 7 === dow && at > from + leadMinutes) return at;
  }
  return from + 7 * DAY;
}

/** Minutes of the next weekday (Mon-Fri) at `minuteOfDay`, at least one calendar day after `from`. */
export function nextWeekdayAt(from: number, minuteOfDay: number): number {
  let day = Math.floor(from / DAY) + 1;
  while (day % 7 >= 5) day++;
  return day * DAY + minuteOfDay;
}
