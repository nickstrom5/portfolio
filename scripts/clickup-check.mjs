/**
 * Checks the ClickUp showcase data on /clickup/ without a browser.
 *
 *   npm run clickup:check
 *
 * Runs every sample task of every process through the simulator and fails if
 * a run ends differently than its `expect` block says, if an Automation never
 * fires in any run, if an Automation with Conditions is never stopped by them
 * (so both outcomes are tested), if an Action would start another Automation
 * (the simulator does not chain, so the data must not rely on it), if a
 * message keeps an unresolved {{variable}}, or if a status, field or person
 * an Automation names does not exist. The Form demo is swept over every
 * combination of its dropdown answers for each "what happens next" choice.
 */
import { build } from 'esbuild';

const entry = "export { cases } from './src/data/clickup/index.ts'; export { simulate } from './src/lib/clickup/engine.ts';";
const out = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { cases, simulate } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const problems = [];
let runs = 0;
let autos = 0;
let demoRuns = 0;

function checkTrace(trace, where) {
  for (const c of trace.chains) problems.push(where(`an Action would start another Automation (${c}); ClickUp may chain them, so avoid it`));
  for (const s of trace.steps) {
    const text = `${s.title} ${s.detail ?? ''} ${s.message?.body ?? ''}`;
    const left = text.match(/\{\{[^}]+\}\}/g);
    if (left) problems.push(where(`unresolved variable ${left.join(', ')} in "${s.title}"`));
  }
}

for (const { workspace: ws, form, processes } of cases) {
  const people = new Set(ws.team.map((m) => m.key));
  const ids = new Set();
  for (const p of processes) {
    const where = (m) => `${ws.id}/${p.id}: ${m}`;
    if (ids.has(p.id)) problems.push(where('duplicate process id'));
    ids.add(p.id);
    if (!ws.handoff[p.id]) problems.push(where('missing from the journey map (handoff)'));
    const statuses = new Set(p.statuses.map((s) => s.name));
    const fields = new Map(p.fields.map((f) => [f.name, f]));
    const autoIds = new Set();
    for (const a of p.automations) {
      autos++;
      if (autoIds.has(a.id)) problems.push(where(`duplicate automation id ${a.id}`));
      autoIds.add(a.id);
      const t = a.trigger;
      for (const s of [...(t.from ?? []), ...(t.to && t.type === 'status_changes' ? t.to : [])]) if (!statuses.has(s)) problems.push(where(`${a.id}: trigger names unknown status ${s}`));
      if (t.type === 'custom_field_changes' && !fields.has(t.field)) problems.push(where(`${a.id}: trigger names unknown field ${t.field}`));
      for (const c of a.conditions ?? []) {
        if ((c.type === 'status' || c.type === 'status_not') && c.is.some((s) => !statuses.has(s))) problems.push(where(`${a.id}: condition names an unknown status`));
        if (c.type === 'time_in_status' && !statuses.has(c.status)) problems.push(where(`${a.id}: condition names unknown status ${c.status}`));
        if (c.type === 'field') {
          const f = fields.get(c.field);
          if (!f) problems.push(where(`${a.id}: condition names unknown field ${c.field}`));
          else if (f.options && c.value !== undefined && !f.options.includes(c.value)) problems.push(where(`${a.id}: ${c.field} has no option "${c.value}"`));
        }
        if (c.type === 'assignee' && c.is !== 'none' && !people.has(c.is)) problems.push(where(`${a.id}: unknown person ${c.is}`));
      }
      for (const x of a.actions) {
        if (x.type === 'change_status' && !statuses.has(x.to)) problems.push(where(`${a.id}: action sets unknown status ${x.to}`));
        if (x.type === 'update_custom_field' && !fields.has(x.field)) problems.push(where(`${a.id}: action sets unknown field ${x.field}`));
        for (const r of [...(x.to && x.type === 'change_assignees' ? x.to : []), ...(x.type === 'change_followers' ? x.add : [])]) {
          if (typeof r === 'string' && r !== 'creator' && r !== 'triggered_by' && !people.has(r)) problems.push(where(`${a.id}: unknown person ${r}`));
          if (typeof r === 'object' && fields.get(r.field)?.type !== 'People') problems.push(where(`${a.id}: ${r.field} is not a People field`));
        }
        if (x.type === 'share_task' && !people.has(x.with)) problems.push(where(`${a.id}: unknown person ${x.with}`));
      }
    }
    const fired = new Set();
    const blocked = new Set();
    for (const sc of p.scenarios) {
      runs++;
      const w = (m) => where(`scenario ${sc.id}: ${m}`);
      let trace;
      try {
        trace = simulate(p, sc, ws);
      } catch (e) {
        problems.push(w(`threw ${e.message}`));
        continue;
      }
      trace.fired.forEach((x) => fired.add(x));
      trace.blocked.forEach((x) => blocked.add(x));
      checkTrace(trace, w);
      const ex = sc.expect;
      if (trace.task.status !== ex.status) problems.push(w(`ended in "${trace.task.status}", expected "${ex.status}"`));
      for (const id of ex.fires ?? []) if (!trace.fired.includes(id)) problems.push(w(`${id} did not fire`));
      for (const id of ex.blocks ?? []) if (!trace.blocked.includes(id)) problems.push(w(`${id} was not stopped by its Conditions`));
      for (const id of trace.fired) if (ex.fires && !ex.fires.includes(id)) problems.push(w(`${id} fired but is not in expect.fires`));
      for (const tag of ex.tags ?? []) if (!trace.task.tags.includes(tag)) problems.push(w(`ended without tag ${tag}`));
      if (ex.assignees && ex.assignees.join() !== trace.task.assignees.join()) problems.push(w(`assignees ${trace.task.assignees.join(', ') || 'none'}, expected ${ex.assignees.join(', ')}`));
      if (ex.priority && (trace.task.priority ?? 'none') !== ex.priority) problems.push(w(`priority ${trace.task.priority ?? 'none'}, expected ${ex.priority}`));
      for (const e of sc.events) if (e.type === 'status' && !statuses.has(e.to)) problems.push(w(`event moves to unknown status ${e.to}`));
      for (const [k, v] of Object.entries(sc.task.fields ?? {})) {
        const f = fields.get(k);
        if (!f) problems.push(w(`task sets unknown field ${k}`));
        else if (f.options && !f.options.includes(v)) problems.push(w(`${k} has no option "${v}"`));
        else if (f.type === 'People' && !people.has(v)) problems.push(w(`${k}: unknown person ${v}`));
      }
    }
    for (const a of p.automations) {
      if (!fired.has(a.id)) problems.push(where(`${a.id} never fires in any scenario`));
      if (a.conditions?.length && !blocked.has(a.id)) problems.push(where(`${a.id} is never stopped by its Conditions in any scenario`));
    }
  }

  // The Form demo: every combination of dropdown answers, for each "what next".
  if (form) {
    const fed = processes.find((p) => p.id === form.feeds);
    if (!fed) problems.push(`${ws.id}: form feeds missing process ${form.feeds}`);
    else {
      const fields = new Map(fed.fields.map((f) => [f.name, f]));
      for (const f of form.fields) {
        if (typeof f.maps !== 'object') continue;
        const target = fields.get(f.maps.field);
        if (!target) problems.push(`${ws.id}: form question ${f.name} maps to unknown field ${f.maps.field}`);
        else if (f.options && target.options && f.options.some((o) => !target.options.includes(o))) problems.push(`${ws.id}: form question ${f.name} offers options the field lacks`);
      }
      const selects = form.fields.filter((f) => f.type === 'select' && typeof f.maps === 'object');
      let combos = [{}];
      for (const f of selects) combos = combos.flatMap((c) => f.options.map((o) => ({ ...c, [f.maps.field]: o })));
      for (const b of form.behaviors) {
        const sc = fed.scenarios.find((s) => s.id === b.scenario);
        if (!sc) {
          problems.push(`${ws.id}: form behavior ${b.value} uses missing scenario ${b.scenario}`);
          continue;
        }
        for (const fieldsOver of combos) {
          demoRuns++;
          const w = (m) => `${ws.id}: form demo "${b.value}" with ${JSON.stringify(fieldsOver)}: ${m}`;
          try {
            checkTrace(simulate(fed, sc, ws, { name: 'Alexandria Whitman-Oyelaran Studio', fields: fieldsOver }), w);
          } catch (e) {
            problems.push(w(`threw ${e.message}`));
          }
        }
      }
    }
  }
}

if (problems.length) {
  const unique = [...new Set(problems)];
  console.log('ClickUp check FAILED:\n' + unique.slice(0, 40).map((p) => '  - ' + p).join('\n') + (unique.length > 40 ? `\n  …and ${unique.length - 40} more` : ''));
  process.exit(1);
}
console.log(`ClickUp check clean: ${cases.length} case${cases.length === 1 ? '' : 's'}, ${autos} Automations, ${runs} sample-task runs, every Automation fired and every Condition tested both ways; ${demoRuns} Form-demo runs.`);
