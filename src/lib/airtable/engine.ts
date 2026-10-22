/**
 * A small, deterministic runner for the bases and automations in src/data/airtable.
 *
 * It follows Airtable's rules closely enough to be honest about them: links
 * are stored once and read from both tables; lookups, rollups, counts and
 * formulas are computed from the records as they are now, so a record an
 * automation creates shows up at once in every rollup that reads it; computed
 * and synced fields cannot be written to; a "matches conditions" trigger fires
 * only when a record starts to match; actions run top to bottom, a conditional
 * group runs the first of its branches whose conditions are met (or its
 * Otherwise branch), a repeating group runs its steps once per item, and
 * either kind of group is the last step of its list; and a failed action
 * stops the run, keeps what the earlier actions did, and emails the
 * automation's owner. Time is simulated.
 *
 * Dates and the sample week are shared with /n8n/'s engine.
 */
import { dayKey, isoAt, shiftDates } from '@/lib/n8n/engine';
import type { Action, ActionResult, Automation, CaseStudy, Ctx, Field, FormulaGet, Group, Json, Message, Rec, RecordView, Repeat, Scenario, Setup, Step, Table, Value } from './types';

export { formatClock, formatDay, formatDuration, formatTime, useWeekOf } from '@/lib/n8n/engine';

const MIN = 60000;

/** Field types whose value Airtable computes; nothing can write to them. */
export const COMPUTED = new Set(['Lookup', 'Rollup', 'Count', 'Formula', 'Autonumber', 'Created time', 'Last modified time']);
export const isComputed = (f: Field) => COMPUTED.has(f.type) || !!f.mirror;

/* ---------- Helpers for formulas in the data files ---------- */

const asDate = (v: Value) => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && /^\d{4}-\d\d-\d\d/.test(s) ? Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : undefined;
};

/** Formula helpers named after the Airtable functions they stand in for. */
export const fx = {
  /** DATETIME_DIFF(a, b, 'days'): whole days from b to a; null when either is empty. */
  daysBetween(a: Value, b: Value): number | null {
    const x = asDate(a);
    const y = asDate(b);
    return x === undefined || y === undefined ? null : Math.round((x - y) / 86400000);
  },
  /** DATEADD(d, n, 'days') */
  addDays(d: Value, n: number): string | null {
    const x = asDate(d);
    return x === undefined ? null : new Date(x + n * 86400000).toISOString().slice(0, 10);
  },
  /** A number from a cell, a lookup's first value, or 0. */
  num(v: Value): number {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' && !isNaN(+x) ? +x : 0;
  },
  /** A cell as text, the way a formula reads it: lists joined with commas. */
  str(v: Value): string {
    if (v === null || v === undefined || v === false) return '';
    return Array.isArray(v) ? v.join(', ') : String(v);
  },
  /** Is the cell empty, as a filter's "is empty" reads it. */
  empty(v: Value): boolean {
    return v === null || v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);
  },
  /** Rollup aggregations. */
  sum: (vs: Value[]) => vs.reduce<number>((n, v) => n + fx.num(v), 0),
  max: (vs: Value[]) => (vs.length ? Math.max(...vs.map(fx.num)) : null),
  min: (vs: Value[]) => {
    const ds = vs.filter((v) => asDate(v) !== undefined) as string[];
    return ds.length ? [...ds].sort()[0] : null;
  },
  countAll: (vs: Value[]) => vs.length,
};

/* ---------- Display ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateText(s: string, withTime: boolean): string {
  const d = new Date(/T/.test(s) ? `${s.replace(/Z$/, '')}Z` : `${s}T00:00:00Z`);
  const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  if (!withTime || !/T/.test(s)) return date;
  const h = d.getUTCHours();
  return `${date} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

/** A cell as Airtable's grid shows it. Links must already be names. */
export function formatValue(f: Pick<Field, 'type' | 'format'>, v: Value): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '';
  if (Array.isArray(v)) return (v as Value[]).map((x) => formatValue({ type: 'Single line text', format: f.format }, x)).join(', ');
  if (f.type === 'Checkbox') return v ? '✓' : '';
  if (f.type === 'Rating' && typeof v === 'number') return '★'.repeat(v);
  const kind = f.format ?? ({ Currency: 'currency', Percent: 'percent', Date: 'date', 'Created time': 'datetime', 'Last modified time': 'datetime' } as Record<string, Field['format']>)[f.type];
  if (typeof v === 'number') {
    if (kind === 'currency') return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 })}`;
    if (kind === 'percent') return `${Math.round(v * 1000) / 10}%`;
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v)) return dateText(v, kind === 'datetime');
  return String(v);
}

/** "Mar 12" for a date cell, for messages. */
export function shortDate(v: Value): string {
  const x = asDate(v);
  if (x === undefined) return '';
  const d = new Date(x);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/* ---------- The base, in memory ---------- */

export class Store {
  tables: Table[];
  private data: Map<string, Rec[]>;
  private seq = 0;
  now = 0;

  constructor(tables: Table[], records?: Map<string, Rec[]>) {
    this.tables = tables;
    this.data = records ?? new Map(tables.map((t) => [t.name, t.records.map((r) => ({ id: r.id, f: { ...r.f } }))]));
  }

  get today() {
    return dayKey(this.now);
  }

  table(name: string): Table {
    const t = this.tables.find((x) => x.name === name);
    if (!t) throw new Error(`no table "${name}"`);
    return t;
  }

  field(table: string, name: string): Field {
    const f = this.table(table).fields.find((x) => x.name === name);
    if (!f) throw new Error(`no field "${name}" in ${table}`);
    return f;
  }

  recs(table: string): Rec[] {
    const r = this.data.get(table);
    if (!r) throw new Error(`no table "${table}"`);
    return r;
  }

  rec(table: string, id: string): Rec {
    const r = this.recs(table).find((x) => x.id === id);
    if (!r) throw new Error(`no record ${id} in ${table}`);
    return r;
  }

  /** Linked record IDs of a link field, from whichever side stores them. */
  links(r: Rec, f: Field): string[] {
    if (f.mirror) return this.recs(f.link!).filter((o) => ((o.f[f.mirror!] as string[] | undefined) ?? []).includes(r.id)).map((o) => o.id);
    return (r.f[f.name] as string[] | undefined) ?? [];
  }

  /** The primary field's value, as text. */
  name(table: string, r: Rec): string {
    const t = this.table(table);
    return formatValue(t.fields[0], this.value(table, r, t.fields[0].name, true));
  }

  /** A field's value. With `names`, links read as the linked records' names, as formulas and lookups see them. */
  value(table: string, r: Rec, field: string, names = false, depth = 0): Value {
    if (depth > 12) throw new Error(`computed fields loop at ${table}.${field}`);
    const f = this.field(table, field);
    const get: FormulaGet = (n) => this.value(table, r, n, true, depth + 1);
    switch (f.type) {
      case 'Link to another record': {
        const ids = this.links(r, f);
        return names ? ids.map((id) => this.name(f.link!, this.rec(f.link!, id))) : ids;
      }
      case 'Lookup':
      case 'Rollup':
      case 'Count': {
        const via = this.field(table, f.via!);
        const target = via.link!;
        const linked = this.links(r, via)
          .map((id) => this.rec(target, id))
          .filter((o) => !f.where || f.where.test((n) => this.value(target, o, n, true, depth + 1)));
        if (f.type === 'Count') return linked.length;
        const values = linked.flatMap((o) => {
          const v = this.value(target, o, f.of!, true, depth + 1);
          return Array.isArray(v) ? (v as Value[]) : fx.empty(v) ? [] : [v];
        });
        return f.type === 'Lookup' ? (values as string[]) : f.agg!.fn(values);
      }
      case 'Formula':
        return f.formula!.fn(get, this.today);
      default:
        return r.f[field] ?? null;
    }
  }

  view(table: string, r: Rec): RecordView {
    return {
      id: r.id,
      table,
      name: this.name(table, r),
      get: (n) => this.value(table, r, n),
      text: (n) => {
        const f = this.field(table, n);
        return formatValue(f, this.value(table, r, n, true));
      },
    };
  }

  /** Every field of every record, as display text, to diff before and after a step. */
  snapshot(): Map<string, Map<string, Record<string, string>>> {
    return new Map(this.tables.map((t) => [t.name, new Map(this.recs(t.name).map((r) => [r.id, Object.fromEntries(t.fields.map((f) => [f.name, formatValue(f, this.value(t.name, r, f.name, true))]))]))]));
  }

  private check(table: string, fields: Record<string, Value>) {
    const t = this.table(table);
    if (t.synced) throw new Error(`"${table}" is a synced table: its fields are read-only in this base`);
    for (const [k, v] of Object.entries(fields)) {
      const f = this.field(table, k);
      if (isComputed(f)) throw new Error(`${table}.${k} is a ${f.mirror ? 'link set from the other table' : f.type} field and cannot be written to`);
      if (f.type === 'Single select' && v !== null && !f.options!.includes(v as string)) throw new Error(`${table}.${k}: "${v}" is not one of its options`);
      if (f.type === 'Multiple select' && Array.isArray(v)) for (const o of v) if (!f.options!.includes(o as string)) throw new Error(`${table}.${k}: "${o}" is not one of its options`);
      if (f.type === 'Link to another record') {
        if (!Array.isArray(v)) throw new Error(`${table}.${k} needs a list of record IDs`);
        for (const id of v as string[]) this.rec(f.link!, id);
      }
    }
  }

  private stamp(table: string, r: Rec, changed: string[]) {
    for (const f of this.table(table).fields) if (f.type === 'Last modified time' && f.watch?.some((w) => changed.includes(w))) r.f[f.name] = isoAt(this.now);
  }

  create(table: string, fields: Record<string, Value>): string {
    this.check(table, fields);
    const t = this.table(table);
    const id = `rec${t.name.replace(/\W/g, '').slice(0, 3)}New${String(++this.seq).padStart(4, '0')}`;
    const f: Record<string, Value> = { ...fields };
    for (const x of t.fields) {
      if (x.type === 'Autonumber') f[x.name] = Math.max(0, ...this.recs(table).map((r) => fx.num(r.f[x.name] ?? 0))) + 1;
      if (x.type === 'Created time') f[x.name] = isoAt(this.now);
    }
    const r = { id, f };
    this.recs(table).push(r);
    this.stamp(table, r, Object.keys(fields));
    return id;
  }

  update(table: string, id: string, fields: Record<string, Value>) {
    this.check(table, fields);
    const r = this.rec(table, id);
    const changed = Object.keys(fields).filter((k) => JSON.stringify(r.f[k] ?? null) !== JSON.stringify(fields[k]));
    Object.assign(r.f, fields);
    this.stamp(table, r, changed);
    return changed;
  }

  inView(table: string, view: string): RecordView[] {
    const v = this.table(table).views.find((x) => x.name === view);
    if (!v?.test) throw new Error(`view "${view}" in ${table} has no filter to find records by`);
    return this.recs(table)
      .filter((r) => v.test!((n) => this.value(table, r, n, true), this.today))
      .map((r) => this.view(table, r));
  }
}

/** The steps directly inside a group: every branch's, or the loop's. */
export const innerSteps = (s: Group | Repeat): Step[] => (s.kind === 'if' ? s.branches.flatMap((b) => b.steps) : s.steps);

/** Every action in a list of steps, at any depth, in order. */
export function allActions(steps: Step[]): Action[] {
  return steps.flatMap((s) => (s.kind === 'action' ? [s] : allActions(innerSteps(s))));
}

/** Every conditional and repeating group in a list of steps, at any depth. */
export function allGroups(steps: Step[]): (Group | Repeat)[] {
  return steps.flatMap((s) => (s.kind === 'action' ? [] : [s, ...allGroups(innerSteps(s))]));
}

/** Steps in the editor: the trigger, every action and every group. */
export const countSteps = (a: Automation) => 1 + allActions(a.steps).length + allGroups(a.steps).length;

/* ---------- Runs ---------- */

export interface Change {
  table: string;
  record: string;
  created: boolean;
  fields: { field: string; from: string; to: string; computed: boolean }[];
}

export type TraceKind = 'setup' | 'form' | 'trigger' | 'action' | 'group' | 'skip' | 'repeat' | 'error' | 'notify' | 'end';

export interface TraceStep {
  kind: TraceKind;
  t: number;
  title: string;
  detail?: string;
  stepId?: string;
  /** "groupId:2" when a conditional group's third branch runs; "repeatId:0" for each loop item. */
  branch?: string;
  messages?: Message[];
  output?: Json;
  changes?: Change[];
}

export interface Trace {
  steps: TraceStep[];
  status: 'success' | 'failed';
  error?: { step: string; message: string };
  start: number;
  end: number;
  /** Action ids that ran; "groupId:N" for the branch a group ran, "groupId:none" when none matched; repeat ids with items, "id:empty" without. */
  visited: string[];
  /** Every change the run made, merged per record. */
  changes: Change[];
}

function diff(store: Store, before: ReturnType<Store['snapshot']>): Change[] {
  const after = store.snapshot();
  const out: Change[] = [];
  for (const t of store.tables) {
    const a = after.get(t.name)!;
    const b = before.get(t.name)!;
    for (const [id, now] of a) {
      const was = b.get(id);
      const fields = t.fields
        .map((f) => ({ field: f.name, from: was?.[f.name] ?? '', to: now[f.name], computed: isComputed(f) }))
        .filter((x) => x.from !== x.to && !(was === undefined && x.to === ''));
      if (fields.length) out.push({ table: t.name, record: now[t.fields[0].name] || id, created: !was, fields });
    }
  }
  return out;
}

function merge(all: Change[], add: Change[]) {
  for (const c of add) {
    const prev = all.find((x) => x.table === c.table && x.record === c.record);
    if (!prev) {
      all.push({ ...c, fields: c.fields.map((f) => ({ ...f })) });
      continue;
    }
    for (const f of c.fields) {
      const p = prev.fields.find((x) => x.field === f.field);
      if (p) p.to = f.to;
      else prev.fields.push({ ...f });
    }
    prev.fields = prev.fields.filter((f) => f.from !== f.to);
  }
}

const DEFAULT_MS: Record<Action['type'], number> = {
  'Find records': 350,
  'Update record': 400,
  'Create record': 450,
  'Send email': 1100,
  'Send a Slack message': 800,
  'Run a script': 1900,
};

function applySetup(store: Store, s: Setup) {
  for (const c of s.create ?? []) store.create(c.table, c.fields);
  for (const u of s.update ?? []) store.update(u.table, u.id, u.fields);
}

/** The trigger's own text, for the log. */
const triggerDetail = (a: Automation) => [a.trigger.table && `Table: ${a.trigger.table}`, a.trigger.view && `${a.trigger.type === 'When a form is submitted' ? 'Form' : 'View'}: ${a.trigger.view}`].filter(Boolean).join(' · ');

export function simulate(study: Pick<CaseStudy, 'base' | 'business'>, auto: Automation, given: Scenario): Trace {
  const sc = shiftDates(given);
  const tables = study.base.tables.map((t) => ({ ...t, records: shiftDates(t.records) }));
  const store = new Store(tables);
  const start = sc.start * MIN;
  let t = start;
  store.now = t;
  const steps: TraceStep[] = [];
  const visited: string[] = [];
  const changes: Change[] = [];
  const outs = new Map<string, Json>();
  const team = study.business.team;
  const tr = auto.trigger;

  // What happens in the base before the run: the edit that fires a record trigger.
  if (sc.setup) {
    const before = store.snapshot();
    const r = sc.record && tr.table ? store.rec(tr.table, sc.record) : undefined;
    const matchedBefore = r && tr.test ? tr.test((n) => store.value(tr.table!, r, n, true), store.today) : false;
    applySetup(store, sc.setup);
    const ch = diff(store, before);
    if (tr.type === 'When a record matches conditions') {
      if (!r || !tr.test) throw new Error('a "matches conditions" test event needs a record and conditions');
      if (matchedBefore) throw new Error(`record ${sc.record} already matched before the change, so the trigger would not fire`);
      if (!tr.test((n) => store.value(tr.table!, r, n, true), store.today)) throw new Error(`record ${sc.record} does not match the trigger's conditions after the change`);
    }
    if (tr.type === 'When a record is updated') {
      const touched = ch.find((c) => c.table === tr.table && r && c.record === store.name(tr.table, r));
      if (!touched || !touched.fields.some((f) => tr.watch?.includes(f.field))) throw new Error(`the change does not touch a field the trigger watches (${tr.watch?.join(', ')})`);
    }
    steps.push({ kind: 'setup', t, title: sc.setup.by ? `In the base: ${sc.setup.by}` : 'In the base', changes: ch });
    merge(changes, ch);
    t += 1000;
  } else if (tr.type === 'When a record matches conditions' || tr.type === 'When a record is updated') {
    throw new Error('a record trigger needs a change in setup to fire');
  }

  // The trigger.
  let triggerRec: RecordView | undefined;
  store.now = t;
  if (tr.type === 'When a form is submitted') {
    if (!sc.form) throw new Error('a form trigger needs form answers');
    const view = store.table(tr.table!).views.find((v) => v.name === tr.view && v.type === 'Form');
    if (!view) throw new Error(`no form view "${tr.view}" in ${tr.table}`);
    for (const k of Object.keys(sc.form)) if (!view.fields?.includes(k)) throw new Error(`"${k}" is not on the form "${view.name}"`);
    for (const k of view.required ?? []) if (fx.empty(sc.form[k])) throw new Error(`required form field "${k}" is empty`);
    const before = store.snapshot();
    const id = store.create(tr.table!, sc.form);
    const ch = diff(store, before);
    triggerRec = store.view(tr.table!, store.rec(tr.table!, id));
    steps.push({ kind: 'form', t, title: `Form “${tr.view}” submitted: a new record in ${tr.table}`, changes: ch });
    merge(changes, ch);
    t += 2000;
  } else if (tr.table && sc.record) {
    triggerRec = store.view(tr.table, store.rec(tr.table, sc.record));
  }
  store.now = t;
  const output: Json = triggerRec
    ? Object.fromEntries(store.table(tr.table!).fields.map((f) => [f.name, triggerRec!.text(f.name)]).filter(([, v]) => v !== ''))
    : { 'Scheduled time': isoAt(t) };
  steps.push({ kind: 'trigger', t, title: `Trigger · ${tr.type}`, detail: [triggerDetail(auto), triggerRec ? `Record: ${triggerRec.name}` : ''].filter(Boolean).join(' · '), output });
  t += 400;

  const ctx = (item?: RecordView): Ctx => ({
    trigger: triggerRec,
    out: (id) => {
      const o = outs.get(id);
      if (!o) throw new Error(`no output from step ${id} yet`);
      return o;
    },
    item,
    records: (table) => store.recs(table).map((r) => store.view(table, r)),
    record: (table, id) => store.view(table, store.rec(table, id)),
    inView: (table, view) => store.inView(table, view),
    now: t,
    today: store.today,
    email: (user) => {
      const m = team.find((x) => x.name === user);
      if (!m) throw new Error(`no team member "${user}"`);
      return m.email;
    },
    fixtures: sc.fixtures ?? {},
  });

  let failed: Trace['error'];
  const runAction = (a: Action, item?: RecordView): boolean => {
    t += a.ms ?? DEFAULT_MS[a.type];
    store.now = t;
    if (sc.failures?.[a.id]) {
      failed = { step: `${a.type} · ${a.title}`, message: sc.failures[a.id] };
      steps.push({ kind: 'error', t, title: `${a.type} · ${a.title}: failed`, detail: sc.failures[a.id], stepId: a.id });
      return false;
    }
    const before = store.snapshot();
    const res: ActionResult = a.run(ctx(item));
    const created = (res.create ?? []).map((c) => store.create(c.table, c.fields));
    for (const u of [...(res.update ?? []), ...(res.then?.(created) ?? [])]) store.update(u.table, u.id, u.fields);
    const ch = diff(store, before);
    const out = { ...(res.output ?? {}), ...(created.length ? { record: created[0], records: created } : {}) };
    outs.set(a.id, out);
    visited.push(a.id);
    steps.push({ kind: 'action', t, title: `${a.type} · ${a.title}`, detail: res.log, stepId: a.id, messages: res.messages, output: Object.keys(out).length ? out : undefined, changes: ch });
    merge(changes, ch);
    return true;
  };

  /** Runs a list of steps; false once an action fails, which ends the run. */
  const runSteps = (list: Step[], item?: RecordView): boolean => {
    for (const s of list) {
      if (s.kind === 'action') {
        if (!runAction(s, item)) return false;
        continue;
      }
      t += 50;
      if (s.kind === 'if') {
        const i = s.branches.findIndex((b) => !b.test || b.test(ctx(item)));
        if (i < 0) {
          visited.push(`${s.id}:none`);
          steps.push({ kind: 'skip', t, title: 'Conditional group: no branch matched', detail: `${s.branches.map((b) => b.when).join('; ')}: none is true, so nothing in the group runs.`, stepId: s.id });
          continue;
        }
        const b = s.branches[i];
        visited.push(`${s.id}:${i}`);
        steps.push({ kind: 'group', t, title: `Conditional group: ${b.name}`, detail: b.when ? `${i ? 'Otherwise if' : 'If'} ${b.when}` : 'Otherwise: no branch above matched', stepId: s.id, branch: `${s.id}:${i}` });
        if (!runSteps(b.steps, item)) return false;
        continue;
      }
      const items = s.list(ctx(item));
      if (!items.length) {
        visited.push(`${s.id}:empty`);
        steps.push({ kind: 'skip', t, title: 'Repeating group: the list is empty', detail: `${s.over} has no items, so its steps do not run.`, stepId: s.id });
        continue;
      }
      visited.push(s.id);
      for (const [i, it] of items.entries()) {
        steps.push({ kind: 'repeat', t, title: `Repeating group · item ${i + 1} of ${items.length}`, detail: it.name, stepId: s.id, branch: `${s.id}:0` });
        if (!runSteps(s.steps, it)) return false;
      }
    }
    return true;
  };
  runSteps(auto.steps);

  if (failed) {
    t += 3000;
    steps.push({
      kind: 'notify',
      t,
      title: 'Run failed: Airtable emails the owner',
      detail: `Steps after the failed one do not run. What earlier steps did stays done. ${auto.notify} gets Airtable’s failure email with a link to this run.`,
    });
  } else {
    steps.push({ kind: 'end', t, title: 'Run succeeded' });
  }
  return { steps, status: failed ? 'failed' : 'success', error: failed, start, end: t, visited, changes };
}

/** A short JSON preview for the log. */
export function previewJson(o: Json): string {
  return JSON.stringify(o, (_k, v: unknown) => (Array.isArray(v) && v.length > 6 ? [...v.slice(0, 5), `… ${v.length - 5} more`] : v), 2);
}

/** The base's sample records, computed, for the grid previews. */
export function gridRows(base: { tables: Table[] }, table: string, minutes: number): { id: string; cells: string[] }[] {
  const store = new Store(base.tables);
  store.now = minutes * MIN;
  const t = store.table(table);
  return store.recs(table).map((r) => ({ id: r.id, cells: t.fields.map((f) => formatValue(f, store.value(table, r, f.name, true))) }));
}
