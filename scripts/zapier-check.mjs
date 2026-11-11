/**
 * Checks the Zapier showcase data on /zapier/ without a browser.
 *
 *   npm run zapier:check
 *
 * Layout, by Zapier's own rules: a Paths step or a loop is the last step of
 * its list; a Zap has at most one loop; a Paths step has 2 to 10 paths, at
 * most one fallback, and the fallback is last; paths nest at most 3 deep; an
 * error handler holds plain steps only, and a Zap that has one keeps
 * Autoreplay off.
 *
 * Mapping: every {step-id › Field} names the trigger or a step that comes
 * earlier in the editor, and every {trigger › Field} is a field some test
 * event actually sends. Every app a step uses is one the case has connected.
 *
 * Runs: every test event goes through the simulator and must end as its
 * `expect` block says (status, steps reached or not, tasks used, runs in Zap
 * history). Across a Zap's test events, every step must run, every path must
 * be taken, every filter must be seen both passing and stopping the run,
 * every search that halts must be seen finding nothing, every loop must get
 * values, and every error handler must run. No message may hold an unresolved
 * token or read "undefined"; emails go to addresses and texts to phone
 * numbers. Each case's demo form is also submitted once per behavior, the way
 * page.ts does.
 */
import { build } from 'esbuild';

const out = await build({
  stdin: { contents: "export { cases } from './src/data/zapier/index.ts'; export { simulate, allSteps, outcomes, stepNumbers } from './src/lib/zapier/engine.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { cases, simulate, allSteps, outcomes, stepNumbers } = mod;

const problems = [];
let runs = 0;
let zaps = 0;
let tasks = 0;
const STATUSES = ['Successful', 'Filtered', 'Errored', 'Safely halted', 'Handled error'];
const builtIn = (app) => / by Zapier$/.test(app) || app === 'Zapier Manager' || app === 'Zapier Tables';

function checkMessages(trace, w) {
  for (const s of trace.steps)
    for (const m of s.messages ?? []) {
      const text = `${m.to} ${m.subject ?? ''} ${m.body}`;
      const left = text.match(/\{[^{}]*›[^{}]*\}/g);
      if (left) problems.push(w(`unresolved token ${left.join(', ')} in "${s.title}"`));
      const bad = text.match(/undefined|NaN|\[object Object\]|\bnull\b/);
      if (bad) problems.push(w(`message from "${s.title}" reads "${bad[0]}"`));
      if (m.channel === 'email' && !/^\S+@\S+\.\S+(,\s*\S+@\S+\.\S+)*$/.test(m.to)) problems.push(w(`email from "${s.title}" goes to "${m.to}"`));
      if (m.channel === 'sms' && !/^\+1\d{10}$/.test(m.to)) problems.push(w(`text from "${s.title}" goes to "${m.to}"`));
      if (!m.body.trim()) problems.push(w(`empty message from "${s.title}"`));
    }
}

const caseIds = new Set();
for (const study of cases) {
  const { business, connections, demo } = study;
  if (caseIds.has(business.id)) problems.push(`duplicate case id ${business.id}`);
  caseIds.add(business.id);
  const connected = new Set(connections.map((c) => c.app));
  if (connected.size !== connections.length) problems.push(`${business.id}: an app is connected twice`);
  for (const s of business.stack) if (!connected.has(s)) problems.push(`${business.id}: stack names ${s}, which is not a connected app`);
  const zapIds = new Set();

  for (const z of study.zaps) {
    zaps++;
    const where = (m) => `${business.id}/${z.id}: ${m}`;
    if (zapIds.has(z.id)) problems.push(where('duplicate Zap id'));
    zapIds.add(z.id);
    if (!business.handoff[z.id]) problems.push(where('no handoff line for the journey map'));
    if (!business.team.some((m) => m.name === z.owner)) problems.push(where(`owner ${z.owner} is not on the team`));
    if (!builtIn(z.trigger.app) && !connected.has(z.trigger.app)) problems.push(where(`trigger app ${z.trigger.app} is not connected`));
    if ((z.trigger.type === 'schedule') !== (z.trigger.app === 'Schedule by Zapier')) problems.push(where('only Schedule by Zapier is a schedule trigger'));

    const steps = allSteps(z.steps);
    const numbers = stepNumbers(z);
    const ids = new Set(['trigger']);
    for (const s of steps) {
      if (ids.has(s.id)) problems.push(where(`duplicate step id ${s.id}`));
      ids.add(s.id);
      if (s.kind === 'action' && !builtIn(s.app) && !connected.has(s.app)) problems.push(where(`${s.id} uses ${s.app}, which is not connected`));
    }
    if (steps.filter((s) => s.kind === 'loop').length > 1) problems.push(where('more than one loop; Zapier allows one Looping step per Zap'));
    const handled = steps.some((s) => s.kind === 'action' && s.onError);
    if (handled && z.autoreplay) problems.push(where('has an error handler, so Autoreplay must be off'));

    // Zapier's layout rules.
    const layout = (list, depth, inLoop) =>
      list.forEach((s, i) => {
        const last = i === list.length - 1;
        if ((s.kind === 'paths' || s.kind === 'loop') && !last) problems.push(where(`${s.id} is followed by another step, but nothing can come after ${s.kind === 'paths' ? 'Paths' : 'a loop: its steps are everything after it'}`));
        if (s.kind === 'paths') {
          if (depth > 3) problems.push(where(`${s.id} is nested more than three Paths deep`));
          if (s.branches.length < 2 || s.branches.length > 10) problems.push(where(`${s.id} has ${s.branches.length} paths; Zapier allows 2 to 10`));
          s.branches.forEach((b, bi) => {
            if (b.fallback && bi !== s.branches.length - 1) problems.push(where(`${s.id}: the fallback path must be last`));
            if (b.fallback && (b.rules || b.test)) problems.push(where(`${s.id}: the fallback path "${b.name}" has rules`));
            if (!b.fallback && (!b.rules || !b.test)) problems.push(where(`${s.id}: path "${b.name}" needs rules and a test`));
            if (!b.steps.length) problems.push(where(`${s.id}: path "${b.name}" is empty`));
            layout(b.steps, depth + 1, inLoop);
          });
          if (s.branches.filter((b) => b.fallback).length > 1) problems.push(where(`${s.id} has more than one fallback path`));
        }
        if (s.kind === 'loop') {
          if (inLoop) problems.push(where(`${s.id} is a loop inside a loop`));
          if (!s.steps.length) problems.push(where(`${s.id} has no steps to repeat`));
          layout(s.steps, depth, true);
        }
        if (s.kind === 'action' && s.onError) {
          if (!s.onError.length) problems.push(where(`${s.id} has an empty error handler`));
          for (const h of s.onError) if (h.kind !== 'action') problems.push(where(`${s.id}: an error handler holds plain steps only`));
        }
        if (s.kind === 'action' && s.search && !/^(Find|Lookup|Get) /.test(s.event)) problems.push(where(`${s.id} is a search but its event is "${s.event}"`));
        if (s.kind === 'filter' && (!s.rules || !s.test)) problems.push(where(`${s.id}: a filter needs rules and a test`));
        if (s.kind === 'delay' && (s.event === 'Delay For' ? !(s.ms >= 60000 && s.ms <= 30 * 86400000) : !s.until)) problems.push(where(`${s.id}: a delay needs a time between 1 minute and 30 days, or a moment to wait for`));
      });
    layout(z.steps, 1, false);

    // Mapped values name the trigger or an earlier step.
    const sent = new Set(z.scenarios.flatMap((sc) => Object.keys(sc.trigger)));
    for (const s of steps) {
      if (s.kind === 'paths') continue;
      for (const p of s.params)
        for (const m of p.v.matchAll(/\{([^{}›]+) › ([^{}]+)\}/g)) {
          const [, id, field] = m;
          if (!ids.has(id)) problems.push(where(`${s.id} maps {${id} › ${field}}, but there is no step "${id}"`));
          else if (numbers.get(id) >= numbers.get(s.id)) problems.push(where(`${s.id} maps {${id} › ${field}}, but step ${id} comes after it`));
          else if (id === 'trigger' && !sent.has(field.split(' › ')[0])) problems.push(where(`${s.id} maps {trigger › ${field}}, which no test event sends`));
        }
    }

    const visited = new Set();
    for (const sc of z.scenarios) {
      runs++;
      const w = (m) => where(`test event ${sc.id}: ${m}`);
      for (const [id, f] of Object.entries(sc.failures ?? {})) {
        const step = steps.find((s) => s.id === id);
        if (!step || step.kind !== 'action') problems.push(w(`fails ${id}, which is not an app step`));
        if (f.replays !== undefined && (f.replays !== 1 || !z.autoreplay || step?.onError)) problems.push(w(`${id}: a replayed failure needs replays: 1 on a Zap with Autoreplay on and no error handler`));
      }
      if (z.trigger.type !== 'schedule' && z.trigger.type !== 'polling' && !sc.event) problems.push(w('an instant trigger needs an `event` line saying what happened'));
      let trace;
      try {
        trace = simulate(study, z, sc);
      } catch (e) {
        problems.push(w(`threw ${e.message}`));
        continue;
      }
      trace.visited.forEach((v) => visited.add(v));
      tasks += trace.tasks;
      const ex = sc.expect;
      if (!STATUSES.includes(ex.status)) problems.push(w(`expects unknown status ${ex.status}`));
      if (trace.status !== ex.status) problems.push(w(`ended ${trace.status}, expected ${ex.status}${trace.error ? ` (${trace.error.step}: ${trace.error.message})` : ''}`));
      for (const v of ex.visits ?? []) if (!trace.visited.includes(v)) problems.push(w(`never reached ${v}`));
      for (const v of ex.skips ?? []) if (trace.visited.includes(v)) problems.push(w(`ran ${v}, which it should not`));
      if (ex.tasks === undefined) problems.push(w('expect.tasks is missing'));
      else if (trace.tasks !== ex.tasks) problems.push(w(`used ${trace.tasks} tasks, expected ${ex.tasks}`));
      if ((ex.runs ?? 1) !== trace.runs.length) problems.push(w(`made ${trace.runs.length} runs in Zap history, expected ${ex.runs ?? 1}`));
      if (trace.runs.reduce((n, r) => n + r.tasks, 0) + (trace.runs.length > 1 ? trace.beforeLoop : 0) !== trace.tasks) problems.push(w('tasks per run do not add up to the total'));
      if (sc.start < 0 || sc.start >= 7 * 1440) problems.push(w('starts outside the sample week'));
      checkMessages(trace, w);
    }
    for (const o of outcomes(z)) if (!visited.has(o)) problems.push(where(`${o} is never reached by a test event`));
    for (const s of steps) {
      if (s.kind === 'filter' && !visited.has(`${s.id}:stop`)) problems.push(where(`filter ${s.id} is never seen stopping a run`));
      if (s.kind === 'paths' && !s.branches.some((b) => b.fallback) && !visited.has(`${s.id}:none`)) problems.push(where(`${s.id} has no fallback and is never seen matching nothing`));
      if (s.kind === 'action' && s.search === 'halt' && !visited.has(`${s.id}:none`)) problems.push(where(`search ${s.id} halts when nothing is found, but no test event shows it`));
      if (s.kind === 'action' && s.onError && !visited.has(`${s.id}:handled`)) problems.push(where(`the error handler on ${s.id} never runs`));
    }
  }

  // The demo form, once per behavior, with the first option of every dropdown.
  const fed = study.zaps.find((z) => z.id === demo.feeds);
  if (!fed) {
    problems.push(`${business.id}: demo feeds ${demo.feeds}, which is not a Zap in this case`);
    continue;
  }
  const answers = Object.fromEntries(demo.fields.map((f) => [f.name, f.options?.[0] ?? (f.type === 'number' ? '25' : f.type === 'email' ? 'alex@example.com' : f.type === 'tel' ? '(614) 555-0199' : 'alex SAMPLE')]));
  const stepIds = new Set(allSteps(fed.steps).map((s) => s.id));
  for (const b of demo.behaviors) {
    runs++;
    const w = (m) => `${business.id}: demo "${b.value}": ${m}`;
    for (const id of Object.keys(b.failures ?? {})) if (!stepIds.has(id)) problems.push(w(`fails ${id}, which is not a step of ${fed.id}`));
    try {
      const sc = { id: `demo-${b.value}`, label: b.label, summary: '', start: 1440 + 615, event: 'You send the form', trigger: demo.toTrigger(answers, '2026-03-03T10:15:00'), world: b.world?.(answers), fixtures: b.fixtures, failures: b.failures, expect: { status: 'Successful' } };
      const trace = simulate(study, fed, sc);
      tasks += trace.tasks;
      checkMessages(trace, w);
    } catch (e) {
      problems.push(w(`threw ${e.message}`));
    }
  }
}

if (problems.length) {
  console.log('Zapier check FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Zapier check clean: ${cases.length} case${cases.length === 1 ? '' : 's'}, ${zaps} Zaps, ${runs} test runs, every step, path, filter and error handler reached; ${tasks} tasks counted.`);
