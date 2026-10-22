/**
 * A small, deterministic runner for the workflows in src/data/n8n.
 *
 * It follows n8n's rules closely enough to be honest about them: nodes pass
 * items, and most act once per item; an If or Switch sends each item down
 * the output it matches, so one execution can run both sides of an If; with
 * the v1 execution order each branch finishes before the next one starts,
 * top to bottom; a node that receives no items does not run, so neither does
 * anything after it; Retry On Fail tries again after its wait; a node that
 * still fails stops the execution, unless it continues using its error
 * output; and a failed automatic execution starts the error workflow. Time
 * is simulated: a Wait of three days finishes instantly and every node
 * carries its simulated timestamp.
 */
import type { Automation, Branch, CaseStudy, Item, Json, Message, N8nNode, RunContext, Scenario, Step } from './types';

/**
 * Scenario times are minutes after Monday 00:00 of a sample week. By default
 * that is 2 March 2026 (so builds and checks are deterministic); in the
 * browser the page moves it to the visitor's current week, so dates in the
 * log match their calendar.
 */
const SAMPLE_BASE = Date.UTC(2026, 2, 2);
let BASE = SAMPLE_BASE;

export function useWeekOf(date: Date): void {
  BASE = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - ((date.getDay() + 6) % 7) * 86400000;
}

const MIN = 60000;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Test events are written against the sample week, so their timestamps read
 * like 2026-03-03T09:41:00. When the page moves the timeline to the
 * visitor's week, ISO dates within about five months of the sample week move
 * with it, by whole weeks, so weekdays stay right.
 */
export function shiftDates<T>(value: T): T {
  const offset = BASE - SAMPLE_BASE;
  if (!offset) return value;
  const near = (ms: number) => Math.abs(ms - SAMPLE_BASE) <= 150 * 86400000;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string')
      return v.replace(/\b(20\d\d)-(\d\d)-(\d\d)/g, (whole, y: string, m: string, d: string) => {
        const ms = Date.UTC(+y, +m - 1, +d);
        return near(ms) ? new Date(ms + offset).toISOString().slice(0, 10) : whole;
      });
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** The calendar date of a simulated time, as a Date in UTC. */
export const dateAt = (t: number) => new Date(BASE + t);

/** ISO timestamp for item data, e.g. 2026-03-03T09:41:07.000-05:00 style without the offset (sample week runs in one zone). */
export function isoAt(t: number): string {
  return dateAt(t).toISOString().replace('Z', '');
}

/** "2026-03-03" for a simulated time. */
export const dayKey = (t: number) => isoAt(t).slice(0, 10);

export function formatTime(t: number, seconds = false): string {
  const d = dateAt(t);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}${seconds ? `:${String(s).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDay(t: number): string {
  const d = dateAt(t);
  return `${DAY_NAMES[(d.getUTCDay() + 6) % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatClock(t: number): string {
  const d = dateAt(t);
  return `${DAYS[(d.getUTCDay() + 6) % 7]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${formatTime(t, true)}`;
}

/** A length of time in words: 3.2 s, 4 min, 2 h 10 min, 3 days. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  if (ms < MIN) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const min = Math.round(ms / MIN);
  if (min < 60) return `${min} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const r = min % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.round((min % 1440) / 60);
  return h ? `${d} day${d === 1 ? '' : 's'} ${h} h` : `${d} day${d === 1 ? '' : 's'}`;
}

/** Every node in a workflow, trigger first, in canvas order. */
export function allNodes(steps: Step[], out: N8nNode[] = []): N8nNode[] {
  for (const s of steps) {
    if (s.kind === 'node') out.push(s.node);
    else {
      if (s.node) out.push(s.node);
      s.branches.forEach((b) => allNodes(b.steps, out));
    }
  }
  return out;
}

export const countNodes = (a: Automation) => allNodes(a.workflow.steps).length + 1;

/** Number of outputs that can carry items in a workflow, counted for the hero. */
export function countBranches(steps: Step[]): number {
  return steps.reduce((n, s) => (s.kind === 'split' ? n + s.branches.length + s.branches.reduce((k, b) => k + countBranches(b.steps), 0) : n), 0);
}

export type TraceKind = 'trigger' | 'node' | 'retry' | 'error' | 'split' | 'empty' | 'wait' | 'resume' | 'handoff' | 'end';

export interface TraceStep {
  kind: TraceKind;
  t: number;
  title: string;
  detail?: string;
  nodeId?: string;
  /** "split:index" when items took an output. */
  branch?: string;
  /** Output of the node, for the item preview. */
  items?: Item[];
  messages?: Message[];
  /** The error workflow's steps run under its own name. */
  workflow?: string;
}

export interface Execution {
  id: string;
  workflow: string;
  status: 'success' | 'error';
  start: number;
  end: number;
  mode: 'production' | 'error';
}

export interface Trace {
  steps: TraceStep[];
  status: 'success' | 'error';
  start: number;
  end: number;
  /** Node ids that ran, and "splitId:index" outputs that carried items. */
  visited: string[];
  /** Node ids that were reached but got no items. */
  skipped: string[];
  /** Items each node output, by node id. */
  counts: Record<string, number>;
  executions: Execution[];
  error?: { node: string; message: string };
}

class NodeFailure extends Error {
  constructor(
    public node: N8nNode,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const isApp = (n: N8nNode) => n.tone === 'app' || n.tone === 'ai';

/** Execution ids look like the ones in n8n's Executions list. */
let execCounter = 0;
const nextExecId = (seed: number) => String(4810 + (Math.floor(seed / MIN) % 900) + execCounter++);

interface Run {
  study: Pick<CaseStudy, 'business' | 'automations'>;
  auto: Automation;
  scenario: Scenario;
  t: number;
  trace: Trace;
  outputs: Map<string, Item[]>;
  executionId: string;
  workflowLabel?: string;
}

function ctxFor(run: Run, attempt: number): RunContext {
  return {
    $: (name) => {
      const node = [run.auto.workflow.trigger, ...allNodes(run.auto.workflow.steps)].find((n) => n.name === name);
      return (node && run.outputs.get(node.id)) ?? [];
    },
    now: run.t,
    executionId: run.executionId,
    attempt,
    env: run.study.business.env,
    fixtures: run.scenario.fixtures ?? {},
  };
}

function push(run: Run, step: Omit<TraceStep, 't'> & { t?: number }) {
  run.trace.steps.push({ t: run.t, workflow: run.workflowLabel, ...step });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Runs one node: retries, the error output, Execute Once, and the clock. */
function runNode(run: Run, node: N8nNode, items: Item[], inputs?: (Item[] | undefined)[]): { items: Item[]; outputs?: Item[][] } {
  const failures = run.scenario.failures?.[node.id] ?? [];
  const retry = node.settings?.retryOnFail;
  const tries = retry ? retry.maxTries : 1;
  const input = node.settings?.executeOnce ? items.slice(0, 1) : items;
  for (let attempt = 1; attempt <= tries; attempt++) {
    run.t += node.ms ?? (isApp(node) ? 400 : 30);
    const fail = failures[attempt - 1];
    if (fail) {
      if (attempt < tries) {
        push(run, { kind: 'retry', nodeId: node.id, title: `${node.name}: try ${attempt} failed`, detail: `${fail.status} ${fail.message}. Retry On Fail waits ${formatDuration(retry!.waitMs)} and tries again (${attempt + 1} of ${tries}).` });
        run.t += retry!.waitMs;
        continue;
      }
      const msg = `${fail.status ? `${fail.status} ` : ''}${fail.message}`;
      if (fail.items && node.settings?.onError === 'error-output') {
        // Some items fail and the rest succeed: each goes out of its own output.
        const bad = new Set(fail.items);
        const ok = input.filter((_, i) => !bad.has(i));
        const okRes = node.run ? node.run(ok, ctxFor(run, attempt)) : { items: ok };
        const good = okRes.items ?? [];
        const errItems = input.filter((_, i) => bad.has(i)).map((it) => ({ json: { ...it.json, error: { message: fail.message, httpCode: String(fail.status) } } }));
        run.outputs.set(node.id, [...good, ...errItems]);
        run.trace.counts[node.id] = good.length + errItems.length;
        run.trace.visited.push(node.id);
        push(run, { kind: 'node', nodeId: node.id, title: node.name, detail: `${good.length} of ${input.length} succeeded. ${errItems.length === 1 ? 'One' : errItems.length} failed with ${msg}, and ${errItems.length === 1 ? 'it goes' : 'they go'} out of the Error output.`, items: good, messages: okRes.messages });
        return { items: good, outputs: [good, errItems] };
      }
      if (node.settings?.onError === 'error-output') {
        const errItems = input.map((it) => ({ json: { ...it.json, error: { message: fail.message, httpCode: String(fail.status) } } }));
        run.outputs.set(node.id, errItems);
        run.trace.counts[node.id] = errItems.length;
        run.trace.visited.push(node.id);
        push(run, { kind: 'error', nodeId: node.id, title: `${node.name}: failed${tries > 1 ? ` after ${tries} tries` : ''}`, detail: `${msg}. On Error is Continue (using error output), so ${errItems.length === 1 ? 'the item goes' : `the ${errItems.length} items go`} out of the Error output instead of stopping the execution.`, items: errItems });
        return { items: [], outputs: [[], errItems] };
      }
      if (node.settings?.onError === 'continue') {
        const errItems = input.map(() => ({ json: { error: { message: fail.message, httpCode: String(fail.status) } } }));
        run.outputs.set(node.id, errItems);
        run.trace.counts[node.id] = errItems.length;
        run.trace.visited.push(node.id);
        push(run, { kind: 'error', nodeId: node.id, title: `${node.name}: failed, carrying on`, detail: `${msg}. On Error is Continue, so the node outputs the error as its item and the next node runs on it.`, items: errItems });
        return { items: errItems };
      }
      run.trace.visited.push(node.id);
      throw new NodeFailure(node, msg, fail.status);
    }
    const res = node.run ? node.run(input, ctxFor(run, attempt), inputs) : { items: input };
    const outputs = res.outputs;
    const out = outputs ? outputs.flat() : (res.items ?? []);
    const shown = outputs ? outputs.flat() : out;
    run.outputs.set(node.id, outputs ? shown : out);
    run.trace.counts[node.id] = shown.length;
    run.trace.visited.push(node.id);
    push(run, {
      kind: node.tone === 'trigger' ? 'trigger' : 'node',
      nodeId: node.id,
      title: node.name,
      detail: `${res.log ?? node.type}${attempt > 1 ? ` Succeeded on try ${attempt}.` : ''}`,
      items: shown,
      messages: res.messages,
    });
    if (node.settings?.onError === 'error-output') return { items: out, outputs: [out, []] };
    return { items: out, outputs: outputs && outputs.length ? outputs : undefined };
  }
  return { items: [] };
}

/** Runs a list of steps on some items; returns the items that come out of the end of the list. */
function runSteps(run: Run, steps: Step[], items: Item[]): Item[] | undefined {
  let current: Item[] | undefined = items;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!current || current.length === 0) {
      // n8n does not run a node that receives no items, nor anything after it.
      const first = s.kind === 'node' ? s.node : (s.node ?? firstNode(s.branches[0]?.steps));
      for (const n of allNodes(steps.slice(i))) run.trace.skipped.push(n.id);
      if (first) push(run, { kind: 'empty', nodeId: first.id, title: `${first.name}: no items, does not run`, detail: steps.length - i > 1 ? 'Nothing reached it, so neither it nor the nodes after it on this line run.' : 'Nothing reached it, so it does not run.' });
      return undefined;
    }
    if (s.kind === 'node') {
      const n = s.node;
      if (n.wait) current = runWait(run, n, current);
      else current = runNode(run, n, current).items;
      continue;
    }
    // A split: run the deciding node, or fan the same items out.
    let outs: Item[][];
    if (s.node) {
      const r = runNode(run, s.node, current);
      outs = r.outputs ?? [r.items];
    } else {
      outs = s.branches.map(() => current!);
    }
    const joined: (Item[] | undefined)[] = [];
    s.branches.forEach((b, bi) => {
      const got = outs[bi] ?? [];
      const id = splitId(s);
      if (got.length) {
        run.trace.visited.push(`${id}:${bi}`);
        push(run, { kind: 'split', nodeId: undefined, branch: `${id}:${bi}`, title: `${b.label}: ${plural(got.length, 'item')}`, detail: s.node ? (b.rule ? `Output “${b.label}”. ${b.rule}` : `Output “${b.label}”.`) : `Same items, branch ${bi + 1} of ${s.branches.length}: v1 order runs it ${bi === 0 ? 'first' : 'after the one above finishes'}.` });
      }
      const res = got.length ? runSteps(run, b.steps, got) : skipBranch(run, b);
      if (b.joins) joined.push(res && res.length ? res : undefined);
    });
    const rest = steps.slice(i + 1);
    const next = rest[0];
    if (!next) return joined.find((j) => j)?.slice();
    if (next.kind === 'node' && next.node.type === 'Merge') {
      i++;
      const ran = joined.filter((j) => j !== undefined);
      if (!ran.length) {
        current = [];
        continue;
      }
      const r = runNode(run, next.node, ran.flat(), joined);
      current = r.items;
      continue;
    }
    // One branch joins the line: the next node runs on whatever it brought (it may be empty).
    current = joined.find((j) => j) ?? [];
  }
  return current;
}

/** The key a split's outputs are tracked under: its node's id, or its own for a fan-out. */
export const splitId = (s: Extract<Step, { kind: 'split' }>) => s.node?.id ?? s.id ?? 'fan-out';

function firstNode(steps: Step[] | undefined): N8nNode | undefined {
  const s = steps?.[0];
  if (!s) return undefined;
  return s.kind === 'node' ? s.node : (s.node ?? firstNode(s.branches[0]?.steps));
}

function skipBranch(run: Run, b: Branch): undefined {
  for (const n of allNodes(b.steps)) run.trace.skipped.push(n.id);
  return undefined;
}

function runWait(run: Run, node: N8nNode, items: Item[]): Item[] {
  const w = node.wait!;
  run.trace.visited.push(node.id);
  run.trace.counts[node.id] = items.length;
  if (w.mode === 'interval') {
    push(run, { kind: 'wait', nodeId: node.id, title: `${node.name}: waiting ${formatDuration(w.ms)}`, detail: w.ms > 65000 ? 'Longer than 65 seconds, so n8n saves the execution to the database and picks it up again when the time is up. The execution shows as Waiting.' : 'Under 65 seconds, so the execution stays in memory.' });
    run.t += w.ms;
    push(run, { kind: 'resume', nodeId: node.id, title: `${node.name}: time is up`, detail: 'The same items carry on.', items });
    run.outputs.set(node.id, items);
    return items;
  }
  const how = w.mode === 'form' ? 'a form submission' : 'a call to its resume URL ($execution.resumeUrl)';
  push(run, { kind: 'wait', nodeId: node.id, title: `${node.name}: waiting for ${how}`, detail: `Limit Wait Time ${formatDuration(w.limitMs)}. The execution is saved as Waiting until then.` });
  const r = run.scenario.resume?.[node.id];
  if (r && r.afterMs < w.limitMs) {
    run.t += r.afterMs;
    const out = [{ json: r.json }];
    push(run, { kind: 'resume', nodeId: node.id, title: `${node.name}: resumed`, detail: `The call came in after ${formatDuration(r.afterMs)}; its data is the node's output.`, items: out });
    run.outputs.set(node.id, out);
    return out;
  }
  run.t += w.limitMs;
  push(run, { kind: 'resume', nodeId: node.id, title: `${node.name}: limit reached`, detail: 'Nobody called, so the execution resumes on its own and the items it was holding carry on.', items });
  run.outputs.set(node.id, items);
  return items;
}

/** The Error Trigger's item, shaped like the one n8n sends. */
function errorItem(run: Run, err: NodeFailure): Item {
  const base = run.study.business.env.baseUrl;
  return {
    json: {
      execution: {
        id: run.executionId,
        url: `${base}/workflow/${run.auto.id}/executions/${run.executionId}`,
        error: { message: err.message, stack: `NodeApiError: ${err.message}\n    at ExecuteContext.execute (${err.node.type})` },
        lastNodeExecuted: err.node.name,
        // App triggers like Shopify and Calendly register webhooks; only polling and schedules run as 'trigger'.
        mode: run.auto.workflow.trigger.type === 'Schedule Trigger' ? 'trigger' : 'webhook',
      },
      workflow: { id: run.auto.id, name: run.auto.workflow.name },
    },
  };
}

/** Runs one scenario of one workflow, plus the error workflow if the execution fails. */
export function simulate(study: Pick<CaseStudy, 'business' | 'automations'>, auto: Automation, given: Scenario): Trace {
  execCounter = 0;
  const scenario: Scenario = { ...given, input: shiftDates(given.input), fixtures: shiftDates(given.fixtures), resume: shiftDates(given.resume) };
  const start = scenario.start * MIN;
  const trace: Trace = { steps: [], status: 'success', start, end: start, visited: [], skipped: [], counts: {}, executions: [] };
  const run: Run = { study, auto, scenario, t: start, trace, outputs: new Map(), executionId: nextExecId(start) };
  const trig = auto.workflow.trigger;
  const items = scenario.input;
  run.outputs.set(trig.id, items);
  trace.counts[trig.id] = items.length;
  trace.visited.push(trig.id);
  const triggerItems = trig.run ? (trig.run(items, ctxFor(run, 1)).items ?? items) : items;
  run.outputs.set(trig.id, triggerItems);
  push(run, {
    kind: 'trigger',
    nodeId: trig.id,
    title: scenario.from ? `${trig.name}: ${scenario.from}` : trig.name,
    detail: `${trig.type}${trig.operation ? ` · ${trig.operation}` : ''}. Execution ${run.executionId} starts with ${plural(triggerItems.length, 'item')}.`,
    items: triggerItems,
  });
  try {
    runSteps(run, auto.workflow.steps, triggerItems);
    trace.status = 'success';
    push(run, { kind: 'end', title: 'Execution succeeded', detail: `Every branch that got items ran to its end. Saved in Executions as Success.` });
  } catch (e) {
    if (!(e instanceof NodeFailure)) throw e;
    trace.status = 'error';
    trace.error = { node: e.node.name, message: e.message };
    for (const n of allNodes(auto.workflow.steps)) if (!trace.visited.includes(n.id) && !trace.skipped.includes(n.id)) trace.skipped.push(n.id);
    const tries = e.node.settings?.retryOnFail?.maxTries ?? 1;
    push(run, { kind: 'error', nodeId: e.node.id, title: `${e.node.name}: failed${tries > 1 ? ` after ${tries} tries` : ''}`, detail: `${e.message}. On Error is Stop Workflow, so the execution stops here and is saved as Error.` });
  }
  trace.executions.push({ id: run.executionId, workflow: auto.workflow.name, status: trace.status, start, end: run.t, mode: 'production' });
  const handlerId = auto.workflow.settings.errorWorkflow;
  const handler = handlerId && study.automations.find((a) => a.id === handlerId);
  if (trace.status === 'error' && handler) {
    const err = trace.error!;
    const failure = new NodeFailure([trig, ...allNodes(auto.workflow.steps)].find((n) => n.name === err.node)!, err.message);
    run.t += 1200;
    const item = errorItem(run, failure);
    push(run, { kind: 'handoff', title: `Error workflow starts: ${handler.workflow.name}`, detail: 'Set under Settings › Error workflow. It runs because this was an automatic (production) execution; a manual test run never starts it.' });
    const sub: Run = { study, auto: handler, scenario: { ...scenario, failures: {}, resume: {}, input: [item] }, t: run.t, trace: { ...trace, steps: [], visited: [], skipped: [], counts: {}, executions: [] }, outputs: new Map(), executionId: nextExecId(run.t), workflowLabel: handler.workflow.name };
    sub.outputs.set(handler.workflow.trigger.id, [item]);
    push(sub, { kind: 'trigger', nodeId: handler.workflow.trigger.id, title: handler.workflow.trigger.name, detail: `Error Trigger. Execution ${sub.executionId} starts with the failed execution's details.`, items: [item] });
    let subStatus: 'success' | 'error' = 'success';
    try {
      runSteps(sub, handler.workflow.steps, [item]);
      push(sub, { kind: 'end', title: 'Error workflow succeeded' });
    } catch (e) {
      if (!(e instanceof NodeFailure)) throw e;
      subStatus = 'error';
      push(sub, { kind: 'error', nodeId: e.node.id, title: `${e.node.name}: failed`, detail: `${e.message}. An error workflow does not call itself again.` });
    }
    trace.steps.push(...sub.trace.steps);
    trace.executions.push({ id: sub.executionId, workflow: handler.workflow.name, status: subStatus, start: run.t, end: sub.t, mode: 'error' });
    run.t = sub.t;
  }
  trace.end = run.t;
  return trace;
}

/** Pretty JSON for the item preview, with long arrays shortened. */
export function previewJson(items: Item[], max = 3): string {
  const shown = items.slice(0, max).map((it) => (it.binary ? { json: it.json, binary: it.binary } : it.json));
  const text = JSON.stringify(shown.length === 1 ? shown[0] : shown, (_k, v: unknown) => (Array.isArray(v) && v.length > 6 ? [...v.slice(0, 5), `… ${v.length - 5} more`] : v), 2);
  return items.length > max ? `${text}\n… and ${items.length - max} more items` : text;
}

/** Item helper for data files. */
export const item = (json: Json): Item => ({ json });
