/**
 * Checks the Asana showcase data on /asana/ without a browser.
 *
 *   npm run asana:check
 *
 * Runs every scenario of every automation through the simulator and fails
 * if a run ends differently than its `expect` block says, if any Check if
 * path is never taken by any scenario, or if the data breaks something Asana
 * would not allow: a section, custom field, option or person that doesn't
 * exist, more than 20 triggers or 20 actions in one automation, more than 50
 * automations in a project, the same action twice in one automation, more
 * than one "No other path is matching" path, a form question mapped to a
 * missing field, or a project view Asana doesn't have.
 */
import { build } from 'esbuild';

const out = await build({
  stdin: { contents: "export { cases } from './src/data/asana/index.ts'; export { simulate } from './src/lib/asana/engine.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { cases, simulate } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const problems = [];
let runs = 0;
const VIEWS = new Set(['List', 'Board', 'Timeline', 'Calendar', 'Workflow', 'Dashboard', 'Overview', 'Files', 'Messages', 'Workload']);

for (const c of cases) {
  const id = c.org.id;
  const people = Object.fromEntries(c.org.team.map((p) => [p.key, { name: p.name }]));
  const fields = Object.fromEntries(c.fields.map((f) => [f.key, f]));
  const projects = Object.fromEntries(c.projects.map((p) => [p.id, p]));
  const where = (s) => `${id}: ${s}`;
  const person = (k, ctx) => k !== undefined && !people[k] && problems.push(where(`${ctx}: unknown person "${k}"`));
  const fieldValue = (key, v, ctx) => {
    const f = fields[key];
    if (!f) return problems.push(where(`${ctx}: unknown custom field "${key}"`));
    if (f.options) for (const x of [v].flat()) if (!f.options.includes(x)) problems.push(where(`${ctx}: "${x}" is not an option of ${key}`));
    if (f.type === 'number' && [v].flat().some((x) => typeof x !== 'number')) problems.push(where(`${ctx}: ${key} is a number field`));
  };
  const section = (proj, s, ctx) => projects[proj] && !projects[proj].sections.includes(s) && problems.push(where(`${ctx}: no section "${s}" in ${proj}`));

  // Projects and their sample tasks.
  for (const p of c.projects) {
    person(p.owner, `${p.id} owner`);
    for (const v of p.views) if (!VIEWS.has(v)) problems.push(where(`${p.id}: unknown view ${v}`));
    if (!p.views.includes(p.defaultView)) problems.push(where(`${p.id}: default view not in views`));
    for (const f of p.fields) if (!fields[f]) problems.push(where(`${p.id}: unknown field ${f}`));
    // Dependencies can cross projects, as in Asana.
    const names = new Set(c.projects.flatMap((x) => x.tasks.map((t) => t.name)));
    for (const t of p.tasks) {
      section(p.id, t.section, `${p.id} › ${t.name}`);
      person(t.assignee, `${p.id} › ${t.name}`);
      for (const [k, v] of Object.entries(t.fields ?? {})) fieldValue(k, v, `${p.id} › ${t.name}`);
      for (const b of t.blockedBy ?? []) if (!names.has(b)) problems.push(where(`${p.id} › ${t.name}: blocked by unknown task "${b}"`));
      if (t.milestone && t.assignee === undefined && t.approval) problems.push(where(`${t.name}: a task can't be both a milestone and an approval`));
    }
    const autos = c.automations.filter((a) => a.automation.project === p.id);
    if (autos.length > 50) problems.push(where(`${p.id}: ${autos.length} automations (Asana allows 50 per project)`));
  }

  // The form.
  if (!projects[c.form.project]) problems.push(where(`form: unknown project ${c.form.project}`));
  section(c.form.project, c.form.section, 'form');
  person(c.form.defaultAssignee, 'form default assignee');
  for (const q of c.form.questions) {
    if (q.maps && typeof q.maps === 'object') {
      fieldValue(q.maps.field, q.options ?? [], `form question ${q.name}`);
      if (!projects[c.form.project]?.fields.includes(q.maps.field)) problems.push(where(`form question ${q.name}: ${q.maps.field} is not on ${c.form.project}`));
    }
    if (q.showIf && !c.form.questions.some((o) => o.name === q.showIf.question && o.type === 'select')) problems.push(where(`form question ${q.name}: branches from a missing single-select`));
  }
  if (!c.form.questions.some((q) => q.maps === 'title')) problems.push(where('form: no question maps to the task name'));

  // Portfolio, goals, status, workload.
  person(c.portfolio.owner, 'portfolio');
  const goals = (gs) => gs.forEach((g) => (person(g.owner, `goal ${g.name}`), goals(g.children ?? [])));
  goals(c.goals);
  person(c.status.author, 'status update');
  for (const k of Object.keys(c.workload.load)) {
    person(k, 'workload');
    if (c.workload.load[k].length !== c.workload.weeks.length) problems.push(where(`workload ${k}: one number per week`));
    if (!c.org.team.find((p) => p.key === k)?.capacity) problems.push(where(`workload ${k}: no capacity`));
  }

  // Automations.
  const taken = new Set();
  for (const a of c.automations) {
    const def = a.automation;
    const ctx = `${a.number} · ${a.name}`;
    if (!projects[def.project]) problems.push(where(`${ctx}: unknown project ${def.project}`));
    if (!c.org.handoff[a.id]) problems.push(where(`${ctx}: no hand-off line in org.handoff`));
    if (def.triggers.length < 1 || def.triggers.length > 20) problems.push(where(`${ctx}: ${def.triggers.length} triggers (1–20)`));
    for (const t of def.triggers) {
      if (t.type === 'moved') section(def.project, t.section, ctx);
      if (t.type === 'field') t.value === undefined ? fields[t.key] || problems.push(where(`${ctx}: unknown field ${t.key}`)) : fieldValue(t.key, t.value, ctx);
      if ((t.type === 'due_approaching' || t.type === 'overdue') && def.settings.runsOn !== 'tasks') problems.push(where(`${ctx}: date triggers need "Runs on tasks"`));
    }
    const lists = [def.actions, ...(def.paths ?? []).map((p) => p.actions)];
    for (const acts of lists) {
      const kinds = [...def.actions, ...(acts === def.actions ? [] : acts)].map((x) => x.type);
      const dup = kinds.find((k, i) => kinds.indexOf(k) !== i);
      if (dup) problems.push(where(`${ctx}: the "${dup}" action twice on one path (Asana allows each action once)`));
      if (kinds.length > 20) problems.push(where(`${ctx}: more than 20 actions on one path`));
      for (const x of acts) {
        if (x.type === 'move') section(def.project, x.section, ctx);
        if (x.type === 'assign') person(x.user, ctx);
        if (x.type === 'collaborators') x.users.forEach((u) => person(u, ctx));
        if (x.type === 'set_field') fieldValue(x.key, x.value, ctx);
        if (x.type === 'subtasks') x.items.forEach((s) => person(s.assignee, ctx));
        if (x.type === 'create_task') {
          person(x.assignee, ctx);
          if (projects[x.project] && x.section) section(x.project, x.section, ctx);
        }
      }
    }
    const elses = (def.paths ?? []).filter((p) => p.when.length === 0);
    if (elses.length > 1) problems.push(where(`${ctx}: more than one "No other path is matching" path`));
    if (elses.length && def.paths[def.paths.length - 1].when.length) problems.push(where(`${ctx}: the else path must be last`));
    for (const p of def.paths ?? []) for (const w of p.when) {
      if (w.type === 'field') fieldValue(w.key, w.value ?? [], `${ctx} › ${p.label}`);
      if (w.type === 'section') section(def.project, w.is, ctx);
    }

    for (const s of a.scenarios) {
      runs++;
      const sctx = `${ctx} › ${s.label}`;
      section(def.project, s.task.section, sctx);
      person(s.task.assignee, sctx);
      for (const [k, v] of Object.entries(s.task.fields ?? {})) fieldValue(k, v, sctx);
      for (const e of s.events) {
        person(e.by, sctx);
        if (e.type === 'move') section(def.project, e.section, sctx);
        if (e.type === 'field') fieldValue(e.key, e.value, sctx);
        if (e.type === 'assign') person(e.user, sctx);
        if (e.at < s.start) problems.push(where(`${sctx}: an event before the start`));
      }
      const tr = simulate(c.automations, s, def.project, people);
      tr.paths.forEach((p) => taken.add(p));
      const ex = s.expect;
      if (!tr.fired.includes(a.id) && !ex.notFired?.includes(a.id)) problems.push(where(`${sctx}: automation never ran`));
      if (ex.section && tr.task.section !== ex.section) problems.push(where(`${sctx}: ends in ${tr.task.section}, expected ${ex.section}`));
      if (ex.assignee && tr.task.assignee !== ex.assignee) problems.push(where(`${sctx}: assigned to ${tr.task.assignee}, expected ${ex.assignee}`));
      if (ex.completed !== undefined && tr.task.completed !== ex.completed) problems.push(where(`${sctx}: completed is ${tr.task.completed}`));
      for (const [k, v] of Object.entries(ex.fields ?? {})) if (tr.task.fields[k] !== v) problems.push(where(`${sctx}: ${k} is ${tr.task.fields[k]}, expected ${v}`));
      for (const p of ex.paths ?? []) if (!tr.paths.includes(`${a.id}:${p}`)) problems.push(where(`${sctx}: path ${p} not taken (took ${tr.paths.join(', ') || 'none'})`));
      for (const f of ex.fired ?? []) if (!tr.fired.includes(f)) problems.push(where(`${sctx}: ${f} did not run`));
      for (const f of ex.notFired ?? []) if (tr.fired.includes(f)) problems.push(where(`${sctx}: ${f} ran, expected not`));
      if (tr.steps.some((st) => /undefined|NaN/.test(`${st.title} ${st.detail ?? ''} ${st.message?.body ?? ''}`))) problems.push(where(`${sctx}: "undefined" or "NaN" in the log`));
    }
  }
  for (const a of c.automations) for (const p of a.automation.paths ?? []) if (!taken.has(`${a.id}:${p.id}`)) problems.push(where(`${a.number} · ${a.name}: path "${p.label}" is never taken by any scenario`));
}

const total = cases.reduce((n, c) => n + c.automations.length, 0);
if (problems.length) {
  console.error(`asana:check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`asana:check ok: ${cases.length} cases, ${total} automations, ${runs} scenario runs.`);
