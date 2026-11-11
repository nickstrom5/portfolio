/**
 * A small, deterministic runner for the Zaps in src/data/zapier.
 *
 * It follows Zapier's rules closely enough to be honest about them, each one
 * checked against Zapier's help center:
 *  - An instant trigger starts the run at once; a polling trigger starts it at
 *    Zapier's next check, which depends on the plan.
 *  - Steps run top to bottom. A Filter whose rules are not met ends the run as
 *    Filtered. A search that finds nothing ends it as Safely halted, unless the
 *    step is set to count that as a success or to create the record.
 *  - Paths runs every path whose rules are met, left to right; the fallback
 *    runs only when none was; an error in one path does not stop the next.
 *    Nothing follows a Paths step.
 *  - Every step after a Looping step runs once per value, and each iteration
 *    is its own run in Zap history. A loop takes at most 500 values.
 *  - A step that errors ends the run as Errored, unless it has an error
 *    handler (Handled error). With Autoreplay on, Zapier tries the step again,
 *    first after 5 minutes, up to 5 times, and emails nobody until the last
 *    try fails.
 *  - Tasks: one per successful action or search step. Triggers, Filter,
 *    Paths, and Zapier's Formatter, Delay, Looping, Digest, Storage and Zapier
 *    Manager steps use none; neither does a step that errors or halts.
 * Time is simulated: a two-day delay finishes at once and every step carries
 * its simulated timestamp.
 *
 * Dates and the sample week are shared with /n8n/'s engine.
 */
import { formatDuration, formatTime, isoAt, shiftDates } from '@/lib/n8n/engine';
import type { AppStep, CaseStudy, Ctx, Effect, Json, Message, RunStatus, Scenario, Step, StepResult, Zap } from './types';

export { formatClock, formatDay, formatDuration, formatTime, useWeekOf } from '@/lib/n8n/engine';

const MIN = 60000;
/** Zapier's cap on values in one loop. */
export const LOOP_MAX = 500;
/** How long Autoreplay keeps trying: the last of its 5 tries, counted from the first error. */
const REPLAY_FIRST = 5 * MIN;
const REPLAY_LAST = 635 * MIN;

/** Zapier's own apps whose steps never use a task. */
export const FREE_APPS = new Set(['Formatter by Zapier', 'Delay by Zapier', 'Looping by Zapier', 'Filter by Zapier', 'Paths by Zapier', 'Digest by Zapier', 'Storage by Zapier', 'Zapier Manager', 'Sub-Zap by Zapier', 'Zapier Tables']);

/** The steps directly inside a container step. */
export const innerSteps = (s: Step): Step[] => (s.kind === 'paths' ? s.branches.flatMap((b) => b.steps) : s.kind === 'loop' ? s.steps : s.kind === 'action' ? (s.onError ?? []) : []);

/** Every step of a Zap in editor order, containers and error handlers included. */
export function allSteps(steps: Step[]): Step[] {
  return steps.flatMap((s) => [s, ...allSteps(innerSteps(s))]);
}

/** Steps in the editor, the trigger included. */
export const countSteps = (z: Zap) => 1 + allSteps(z.steps).length;

/** Step numbers as the editor shows them: the trigger is 1, then every step in order. */
export function stepNumbers(z: Zap): Map<string, number> {
  const m = new Map<string, number>([['trigger', 1]]);
  allSteps(z.steps).forEach((s, i) => m.set(s.id, i + 2));
  return m;
}

/** How a step reads in the editor's header: "HubSpot · Create Deal". */
export function stepLabel(s: Step): string {
  if (s.kind === 'action') return `${s.app} · ${s.event}`;
  if (s.kind === 'filter') return 'Filter by Zapier';
  if (s.kind === 'delay') return `Delay by Zapier · ${s.event}`;
  if (s.kind === 'loop') return `Looping by Zapier · ${s.event}`;
  return 'Paths by Zapier';
}

/** Whether a successful run of this step uses a task. */
export const usesTask = (s: Step) => s.kind === 'action' && !FREE_APPS.has(s.app);

/**
 * Everything a test can reach in a Zap: each step, each path of a Paths
 * step, and each loop. The hero counts these; the check wants every one hit.
 */
export function outcomes(z: Zap): string[] {
  return allSteps(z.steps).flatMap((s) => (s.kind === 'paths' ? s.branches.map((_, i) => `${s.id}:${i}`) : [s.id]));
}

/* ---------- Runs ---------- */

export type TraceKind = 'event' | 'trigger' | 'action' | 'filter' | 'stop' | 'paths' | 'path' | 'skip' | 'delay' | 'loop' | 'iteration' | 'error' | 'replay' | 'handler' | 'notify' | 'end';

export interface TraceStep {
  kind: TraceKind;
  t: number;
  title: string;
  detail?: string;
  stepId?: string;
  /** "pathsId:1" when a Paths step's second path runs; "loopId:0" for each iteration. */
  branch?: string;
  messages?: Message[];
  output?: Json;
  effects?: Effect[];
  /** This step used a task. */
  task?: boolean;
}

/** One row of Zap history. */
export interface HistoryRow {
  label: string;
  status: RunStatus;
  tasks: number;
}

export interface Trace {
  steps: TraceStep[];
  /** The run's status; for a loop, the most serious status among its iterations. */
  status: RunStatus;
  error?: { step: string; message: string };
  start: number;
  end: number;
  /** Step ids that ran; "pathsId:N" for each path taken, "pathsId:none" when none was; "filterId:stop" and "searchId:none" for the stops; loop ids with values, "id:empty" without. */
  visited: string[];
  /** Tasks the whole thing used. */
  tasks: number;
  /** Zap history: one row, or one per loop iteration. */
  runs: HistoryRow[];
  /** Tasks used by steps before a loop, which run once. */
  beforeLoop: number;
  effects: Effect[];
}

const SEVERITY: RunStatus[] = ['Successful', 'Filtered', 'Safely halted', 'Handled error', 'Errored'];
const worse = (a: RunStatus, b: RunStatus) => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a);

function defaultMs(s: AppStep): number {
  if (s.ms) return s.ms;
  if (FREE_APPS.has(s.app)) return 180;
  if (s.app === 'Code by Zapier') return 1400;
  if (s.search) return 520;
  return /mail|sms|slack/i.test(s.app) ? 950 : 700;
}

export function simulate(study: Pick<CaseStudy, 'business' | 'world'>, zap: Zap, given: Scenario): Trace {
  const sc = shiftDates(given);
  const world = new Map<string, Json[]>(Object.entries(shiftDates(study.world)).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  for (const [k, rows] of Object.entries(sc.world ?? {})) world.set(k, [...(world.get(k) ?? []), ...rows.map((r) => ({ ...r }))]);

  const start = sc.start * MIN;
  let t = start;
  const steps: TraceStep[] = [];
  const visited: string[] = [];
  const effects: Effect[] = [];
  const outs = new Map<string, Json>();
  const tr = zap.trigger;

  // What happens in the app, then when Zapier hears about it.
  if (sc.event) steps.push({ kind: 'event', t, title: sc.event });
  let how: string;
  if (tr.type === 'polling') {
    const every = study.business.pollMinutes;
    const next = (Math.floor(sc.start / every) + 1) * every;
    t = next * MIN + 4000;
    how = `Polling trigger: Zapier asks ${tr.app} for new items every ${every} ${every === 1 ? 'minute' : 'minutes'} on this plan. The ${formatTime(t)} check found this one, ${formatDuration(t - start)} after it happened. Zapier remembers each item’s ID, so it will not pick it up twice.`;
  } else if (tr.type === 'instant') {
    t += 2000;
    how = `Instant trigger: ${tr.app} tells Zapier the moment it happens, so the run starts within seconds.`;
  } else {
    how = 'Schedule by Zapier starts the run at the set time. No app has to do anything first.';
  }
  steps.push({ kind: 'trigger', t, title: `Trigger · ${tr.app} · ${tr.event}`, detail: how, output: sc.trigger });
  t += 300;

  // One "run" in Zap history: the whole Zap, or one loop iteration.
  let cur = { status: 'Successful' as RunStatus, tasks: 0 };
  let error: Trace['error'];
  const runs: HistoryRow[] = [];

  const ctx = (loop?: Ctx['loop']): Ctx => ({
    trigger: sc.trigger,
    out: (id) => {
      const o = outs.get(id);
      if (!o) throw new Error(`no output from step ${id} yet`);
      return o;
    },
    loop,
    rows: (c) => {
      const r = world.get(c);
      if (!r) throw new Error(`no sample data called "${c}"`);
      return r;
    },
    now: t,
    iso: isoAt(t),
    fixtures: sc.fixtures ?? {},
  });

  const apply = (res: StepResult) => {
    for (const w of res.write ?? []) {
      if (!world.has(w.collection)) throw new Error(`no sample data called "${w.collection}"`);
      world.get(w.collection)!.push({ ...w.row });
    }
    effects.push(...(res.effects ?? []));
  };

  /** Runs one app step; false when the list it is in must stop. */
  const runAction = (s: AppStep, loop?: Ctx['loop']): boolean => {
    const label = stepLabel(s);
    t += defaultMs(s);
    const fail = sc.failures?.[s.id];
    // A failure Autoreplay recovers: the step errors, waits as Scheduled, and works on the next try.
    const recovers = !!(fail?.replays && zap.autoreplay);
    if (fail && recovers) {
      steps.push({ kind: 'error', t, title: `${label}: errored`, detail: fail.message, stepId: s.id });
      t += REPLAY_FIRST;
      steps.push({
        kind: 'replay',
        t,
        title: 'Autoreplay: Zapier tries the step again',
        detail: 'Autoreplay is on for this Zap. The run waited as Scheduled and the failed step was tried again 5 minutes later, from that step on. Nobody is emailed while a replay is pending.',
        stepId: s.id,
      });
      t += defaultMs(s);
    }
    // Otherwise the step fails because the test event says so, or because the step itself reports an error.
    const res: StepResult = fail && !recovers ? {} : s.run(ctx(loop));
    const message = fail && !recovers ? fail.message : res.error;
    if (message) {
      steps.push({ kind: 'error', t, title: `${label}: errored`, detail: message, stepId: s.id });
      if (s.onError) {
        visited.push(`${s.id}:handled`);
        steps.push({ kind: 'handler', t, title: 'Error handler runs', detail: 'This step has its own error handler, so its steps run in place of the rest of the Zap. The run is recorded as Handled error and Zapier sends no error email.', stepId: s.id, branch: `${s.id}:error` });
        cur.status = worse(cur.status, 'Handled error');
        runSteps(s.onError, loop);
        return false;
      }
      cur.status = 'Errored';
      error ??= { step: `${label} · ${s.title}`, message };
      return false;
    }
    if (s.search && res.found === false && s.search === 'halt') {
      visited.push(`${s.id}:none`);
      steps.push({ kind: 'stop', t, title: `${label}: nothing found`, detail: `${res.log ? `${res.log}. ` : ''}The step is set to stop the run when the search comes back empty, so the run ends here as Safely halted. That is not an error: nobody is emailed and no task is used.`, stepId: s.id });
      cur.status = worse(cur.status, 'Safely halted');
      return false;
    }
    apply(res);
    // Zapier adds a found flag to every search: one name for a plain search, another for "find or create".
    const output: Json = s.search ? { ...(res.output ?? {}), [s.search === 'create' ? 'Zap Data Was Found' : 'Zap Search Was Found Status']: res.found !== false } : (res.output ?? {});
    outs.set(s.id, output);
    visited.push(s.id);
    const task = usesTask(s);
    if (task) cur.tasks++;
    steps.push({ kind: 'action', t, title: `${label} · ${s.title}`, detail: res.log, stepId: s.id, messages: res.messages, output: Object.keys(output).length ? output : undefined, effects: res.effects, task });
    return true;
  };

  /** Runs a list of steps; false once something stops the list. */
  function runSteps(list: Step[], loop?: Ctx['loop']): boolean {
    for (const s of list) {
      if (s.kind === 'action') {
        if (!runAction(s, loop)) return false;
        continue;
      }
      if (s.kind === 'filter') {
        t += 60;
        if (!s.test(ctx(loop))) {
          visited.push(`${s.id}:stop`);
          steps.push({ kind: 'stop', t, title: 'Filter: the rules are not met', detail: `Only continue if ${s.rules}. They are not, so nothing after this step runs and the run is recorded as Filtered. A filter uses no task.`, stepId: s.id });
          cur.status = worse(cur.status, 'Filtered');
          return false;
        }
        visited.push(s.id);
        steps.push({ kind: 'filter', t, title: `Filter: passed · ${s.title}`, detail: `Only continue if ${s.rules}.`, stepId: s.id });
        continue;
      }
      if (s.kind === 'delay') {
        visited.push(s.id);
        const from = t;
        if (s.event === 'Delay For') {
          t += s.ms ?? 0;
          steps.push({ kind: 'delay', t, title: `Delay For · ${formatDuration(t - from)}`, detail: `${s.title}. The run shows as Delayed in Zap history until the time is up; the Zap must stay on for it to continue.`, stepId: s.id });
        } else {
          const target = s.until!(ctx(loop));
          if (target > t) {
            t = target;
            steps.push({ kind: 'delay', t, title: `Delay Until · waited ${formatDuration(t - from)}`, detail: `${s.title}. The run shows as Delayed until then.`, stepId: s.id });
          } else if (t - target <= 1440 * MIN) {
            t += 60;
            steps.push({ kind: 'delay', t, title: 'Delay Until · the time has already passed', detail: `${s.title}. That moment was ${formatDuration(from - target)} ago. The step is left on Zapier’s default for dates in the past, “Continue if it’s up to one day”, so the run goes straight on.`, stepId: s.id });
          } else {
            throw new Error(`${s.id}: the date is more than a day in the past, which the default setting does not continue from`);
          }
        }
        continue;
      }
      if (s.kind === 'paths') {
        t += 60;
        const met = s.branches.map((b, i) => ({ b, i })).filter(({ b }) => !b.fallback && b.test!(ctx(loop)));
        const fb = s.branches.findIndex((b) => b.fallback);
        const take = met.length ? met : fb >= 0 ? [{ b: s.branches[fb], i: fb }] : [];
        if (!take.length) {
          visited.push(`${s.id}:none`);
          steps.push({ kind: 'skip', t, title: 'Paths: no path’s rules are met', detail: 'There is no fallback path, so nothing more runs. The run is still Successful.', stepId: s.id });
          continue;
        }
        steps.push({
          kind: 'paths',
          t,
          title: `Paths: ${take.map(({ b }) => `“${b.name}”`).join(' and ')}`,
          detail: met.length > 1 ? 'More than one path’s rules are met, so each runs, one after the other, left to right.' : met.length ? 'Zapier checks every path’s rules; only this one’s are met.' : 'No other path’s rules are met, so the fallback runs.',
          stepId: s.id,
        });
        for (const { b, i } of take) {
          visited.push(`${s.id}:${i}`);
          steps.push({ kind: 'path', t, title: `Path · ${b.name}`, detail: b.fallback ? 'Fallback: runs only when no other path does.' : `Rules: ${b.rules}`, stepId: s.id, branch: `${s.id}:${i}` });
          // An error in one path does not stop the paths after it.
          runSteps(b.steps, loop);
        }
        continue;
      }
      // A loop: everything after it runs once per value, each as its own run.
      t += 120;
      const all = s.values(ctx(loop));
      const values = all.slice(0, LOOP_MAX);
      if (!values.length) {
        visited.push(`${s.id}:empty`);
        steps.push({ kind: 'skip', t, title: 'Looping: there is nothing to loop over', detail: `${s.title}. The list is empty, so the steps after the loop do not run.`, stepId: s.id });
        continue;
      }
      visited.push(s.id);
      steps.push({ kind: 'loop', t, title: `${stepLabel(s)} · ${values.length} ${values.length === 1 ? s.noun : `${s.noun}s`}`, detail: `${s.title}. Every step after this one runs once for each ${s.noun}, and each iteration is its own run in Zap history.${all.length > LOOP_MAX ? ` The list has ${all.length} values; a loop takes the first ${LOOP_MAX}.` : ''}`, stepId: s.id });
      const before = cur;
      const beforeLoop = cur.tasks;
      trace.beforeLoop = beforeLoop;
      values.forEach((item, index) => {
        cur = { status: 'Successful', tasks: 0 };
        const name = String(Object.values(item)[0] ?? index + 1);
        steps.push({ kind: 'iteration', t, title: `Loop iteration ${index + 1} of ${values.length}`, detail: name, stepId: s.id, branch: `${s.id}:0` });
        runSteps(s.steps, { item, index, total: values.length });
        runs.push({ label: `Iteration ${index + 1} · ${name}`, status: cur.status, tasks: cur.tasks });
        before.status = worse(before.status, cur.status);
        before.tasks += cur.tasks;
      });
      cur = before;
    }
    return true;
  }

  const trace: Trace = { steps, status: 'Successful', start, end: t, visited, tasks: 0, runs, beforeLoop: 0, effects };
  runSteps(zap.steps);

  trace.status = cur.status;
  trace.tasks = cur.tasks;
  trace.error = error;
  if (!runs.length) runs.push({ label: zap.name, status: cur.status, tasks: cur.tasks });
  if (cur.status === 'Errored') {
    // Replays come after everything else in the run, later paths included, has finished.
    if (zap.autoreplay) {
      t += REPLAY_LAST;
      steps.push({ kind: 'replay', t, title: 'Autoreplay: 5 more tries, all failed', detail: 'Autoreplay is on for this Zap, so the run waited as Scheduled while Zapier tried the failed step again 5 times, the first after 5 minutes and the last about ten and a half hours after the first error. Each try failed the same way.' });
    }
    t += 2000;
    steps.push({
      kind: 'notify',
      t,
      title: `Zapier emails ${zap.owner}`,
      detail: `The run is recorded as Errored and the steps after the failed one did not run; what earlier steps did stays done. ${zap.owner} owns this Zap and gets Zapier’s error email with a link to the run, which can be replayed from the failed step once the cause is fixed.`,
    });
  } else {
    steps.push({ kind: 'end', t, title: runs.length > 1 ? `${runs.length} runs finished` : `Run ended · ${cur.status}` });
  }
  trace.end = t;
  return trace;
}

/** A short JSON preview for the log. */
export function previewJson(o: Json): string {
  return JSON.stringify(o, (_k, v: unknown) => (Array.isArray(v) && v.length > 6 ? [...v.slice(0, 5), `… ${v.length - 5} more`] : v), 2);
}
