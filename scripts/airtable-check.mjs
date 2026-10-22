/**
 * Checks the Airtable showcase data on /airtable/ without a browser.
 *
 *   npm run airtable:check
 *
 * Schema: every link points at a real table and has its other side, every
 * lookup, rollup and count reads through a link field into a field that
 * exists, select values are among their options, linked record IDs exist,
 * computed fields hold no typed values, form views list real, writable
 * fields, and every cell of every sample record computes.
 *
 * Automations: steps follow Airtable's layout rules (a conditional or
 * repeating group is the last step of its list, only a group's last branch
 * may be Otherwise, no repeating group inside another, at most two levels of
 * groups); every test event runs through the simulator and must end as its
 * `expect` block says (status, steps reached or not, emails sent); every
 * action must run in some test event, every branch must be taken, a group
 * with no Otherwise must also be seen matching nothing, and every repeating
 * group must get items; a "matches
 * conditions" event must make its record start to match; tokens like
 * {Trigger › Field} must name real fields; and no message may hold an
 * unresolved token or read "undefined". Writes to computed or synced fields
 * fail the run, as they would in Airtable. Each case's demo form is also
 * submitted once per behavior, the way page.ts does.
 */
import { build } from 'esbuild';

const out = await build({
  stdin: { contents: "export { cases } from './src/data/airtable/index.ts'; export { simulate, allActions, allGroups, Store, isComputed } from './src/lib/airtable/engine.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { cases, simulate, allActions, allGroups, Store, isComputed } = mod;

const problems = [];
let runs = 0;
let automations = 0;
const VIEW_TYPES = ['Grid', 'Form', 'Calendar', 'Gallery', 'Kanban', 'Timeline', 'List'];
const STAMPED = new Set(['Autonumber', 'Created time', 'Last modified time']);

function checkSchema(study) {
  const { base, business } = study;
  const where = (m) => `${business.id} base: ${m}`;
  const table = (n) => base.tables.find((t) => t.name === n);
  const tnames = new Set();
  for (const t of base.tables) {
    if (tnames.has(t.name)) problems.push(where(`duplicate table ${t.name}`));
    tnames.add(t.name);
    const fnames = new Set();
    for (const f of t.fields) {
      const w = (m) => where(`${t.name}.${f.name}: ${m}`);
      if (fnames.has(f.name)) problems.push(w('duplicate field name'));
      fnames.add(f.name);
      if (f.type === 'Link to another record') {
        const other = table(f.link);
        if (!other) problems.push(w(`links to missing table ${f.link}`));
        else if (f.mirror) {
          const owner = other.fields.find((x) => x.name === f.mirror);
          if (!owner || owner.type !== 'Link to another record' || owner.link !== t.name || owner.mirror) problems.push(w(`mirror ${f.link}.${f.mirror} is not a stored link back to ${t.name}`));
        } else if (!other.synced && !other.fields.some((x) => x.mirror === f.name && x.link === t.name)) problems.push(w(`no reciprocal link field in ${f.link}`));
      }
      if (['Lookup', 'Rollup', 'Count'].includes(f.type)) {
        const via = t.fields.find((x) => x.name === f.via);
        if (!via || via.type !== 'Link to another record') problems.push(w(`reads through "${f.via}", which is not a link field here`));
        else if (f.type !== 'Count' && !table(via.link)?.fields.some((x) => x.name === f.of)) problems.push(w(`reads ${via.link}.${f.of}, which does not exist`));
        if (f.type === 'Rollup' && !f.agg) problems.push(w('rollup without an aggregation'));
      }
      if (f.type === 'Formula' && !f.formula) problems.push(w('formula without a formula'));
      if (/select/.test(f.type) && !f.options?.length) problems.push(w('select without options'));
    }
    for (const r of t.records) {
      for (const [k, v] of Object.entries(r.f)) {
        const f = t.fields.find((x) => x.name === k);
        const w = (m) => where(`${t.name} ${r.id}.${k}: ${m}`);
        if (!f) {
          problems.push(w('no such field'));
          continue;
        }
        if (isComputed(f) && !STAMPED.has(f.type)) problems.push(w(`${f.type} field holds a typed value`));
        if (f.type === 'Single select' && !f.options.includes(v)) problems.push(w(`"${v}" is not an option`));
        if (f.type === 'Multiple select' && v.some((o) => !f.options.includes(o))) problems.push(w('value not among options'));
        if (f.type === 'Link to another record') for (const id of v) if (!table(f.link)?.records.some((x) => x.id === id)) problems.push(w(`links to missing record ${id}`));
      }
    }
    for (const v of t.views) {
      const w = (m) => where(`${t.name} view "${v.name}": ${m}`);
      if (!VIEW_TYPES.includes(v.type)) problems.push(w(`unknown view type ${v.type}`));
      if (v.type === 'Form') {
        if (t.synced) problems.push(w('a synced table cannot have a form'));
        for (const n of v.fields ?? []) {
          const f = t.fields.find((x) => x.name === n);
          if (!f) problems.push(w(`form field ${n} does not exist`));
          else if (isComputed(f)) problems.push(w(`form field ${n} is computed and cannot be on a form`));
        }
        for (const n of v.required ?? []) if (!v.fields?.includes(n)) problems.push(w(`required field ${n} is not on the form`));
      }
    }
  }
  for (const s of base.syncs) if (!table(s.table)) problems.push(where(`sync names missing table ${s.table}`));
  // Every cell computes.
  try {
    const store = new Store(base.tables);
    for (const t of base.tables) for (const r of store.recs(t.name)) for (const f of t.fields) store.value(t.name, r, f.name, true);
  } catch (e) {
    problems.push(where(`computing a cell threw: ${e.message}`));
  }
}

function checkMessages(trace, w) {
  for (const s of trace.steps)
    for (const m of s.messages ?? []) {
      const text = `${m.to} ${m.subject ?? ''} ${m.body}`;
      const left = text.match(/\{[^}]*›[^}]*\}/g);
      if (left) problems.push(w(`unresolved token ${left.join(', ')} in "${s.title}"`));
      const bad = text.match(/undefined|NaN|\[object Object\]|\bnull\b/);
      if (bad) problems.push(w(`message from "${s.title}" reads "${bad[0]}"`));
      if (m.channel === 'email' && !/^\S+@\S+(,\s*\S+@\S+)*$/.test(m.to)) problems.push(w(`email from "${s.title}" goes to "${m.to}"`));
    }
}

for (const study of cases) {
  const { business, base, demo } = study;
  checkSchema(study);
  const ids = new Set();
  for (const a of study.automations) {
    automations++;
    const where = (m) => `${business.id}/${a.id}: ${m}`;
    if (ids.has(a.id)) problems.push(where('duplicate automation id'));
    ids.add(a.id);
    const tr = a.trigger;
    const t = tr.table && base.tables.find((x) => x.name === tr.table);
    if (tr.table && !t) problems.push(where(`trigger table ${tr.table} does not exist`));
    if (tr.view && t && !t.views.some((v) => v.name === tr.view)) problems.push(where(`trigger view ${tr.view} does not exist`));
    if (tr.type === 'When a form is submitted' && t && t.views.find((v) => v.name === tr.view)?.type !== 'Form') problems.push(where('form trigger does not watch a form view'));
    if (tr.type === 'When a record matches conditions' && !tr.test) problems.push(where('matches-conditions trigger without conditions'));
    if (tr.type === 'When a record is updated' && t) for (const f of tr.watch ?? []) if (!t.fields.some((x) => x.name === f)) problems.push(where(`trigger watches missing field ${f}`));
    if (!business.team.some((m) => m.name === a.notify)) problems.push(where(`notify ${a.notify} is not on the team`));

    const steps = new Set();
    const actions = allActions(a.steps);
    const groups = allGroups(a.steps);
    for (const s of [...groups, ...actions]) {
      if (steps.has(s.id)) problems.push(where(`duplicate step id ${s.id}`));
      steps.add(s.id);
    }
    // Airtable's layout rules for groups.
    const layout = (list, depth, inLoop) =>
      list.forEach((s, i) => {
        if (s.kind === 'action') return;
        if (i !== list.length - 1) problems.push(where(`${s.id} is followed by another step, but nothing can come after a ${s.kind === 'if' ? 'conditional' : 'repeating'} group`));
        if (depth > 2) problems.push(where(`${s.id} is nested more than two groups deep`));
        if (s.kind === 'repeat') {
          if (inLoop) problems.push(where(`${s.id} is a repeating group inside another`));
          layout(s.steps, depth + 1, true);
          return;
        }
        if (!s.branches.length) problems.push(where(`${s.id} has no branches`));
        s.branches.forEach((b, bi) => {
          const last = bi === s.branches.length - 1;
          if (!b.when && !last) problems.push(where(`${s.id}: only the last branch may be Otherwise`));
          if (!!b.when !== !!b.test) problems.push(where(`${s.id}: branch "${b.name}" needs both conditions and a test, or neither for Otherwise`));
          if (!b.steps.length) problems.push(where(`${s.id}: branch "${b.name}" is empty`));
          layout(b.steps, depth + 1, inLoop);
        });
      });
    layout(a.steps, 1, false);
    // Tokens that name the trigger record's fields must name real ones.
    for (const x of actions)
      for (const p of x.params)
        for (const m of p.v.matchAll(/\{Trigger › ([^}]+)\}/g)) {
          const name = m[1].split(' › ')[0];
          if (name !== 'Airtable record ID' && t && !t.fields.some((f) => f.name === name)) problems.push(where(`${x.id} uses {Trigger › ${name}}, not a field of ${tr.table}`));
        }

    const visited = new Set();
    for (const sc of a.scenarios) {
      runs++;
      const w = (m) => where(`test event ${sc.id}: ${m}`);
      let trace;
      try {
        trace = simulate(study, a, sc);
      } catch (e) {
        problems.push(w(`threw ${e.message}`));
        continue;
      }
      trace.visited.forEach((v) => visited.add(v));
      const ex = sc.expect;
      if (trace.status !== ex.status) problems.push(w(`ended ${trace.status}, expected ${ex.status}${trace.error ? ` (${trace.error.step}: ${trace.error.message})` : ''}`));
      for (const v of ex.visits ?? []) if (!trace.visited.includes(v)) problems.push(w(`never reached ${v}`));
      for (const v of ex.skips ?? []) if (trace.visited.includes(v)) problems.push(w(`ran ${v}, which it should not`));
      const emails = trace.steps.flatMap((s) => s.messages ?? []).filter((m) => m.channel === 'email').length;
      if (ex.emails !== undefined && emails !== ex.emails) problems.push(w(`sent ${emails} emails, expected ${ex.emails}`));
      if (sc.start < 0 || sc.start >= 7 * 1440) problems.push(w('starts outside the sample week'));
      checkMessages(trace, w);
    }
    for (const x of actions) if (!visited.has(x.id)) problems.push(where(`action ${x.id} never runs in any test event`));
    for (const s of groups) {
      if (s.kind === 'if') {
        s.branches.forEach((b, bi) => !visited.has(`${s.id}:${bi}`) && problems.push(where(`${s.id}: branch "${b.name}" is never taken`)));
        if (s.branches[s.branches.length - 1].when && !visited.has(`${s.id}:none`)) problems.push(where(`${s.id} has no Otherwise branch and is never seen matching nothing`));
      }
      if (s.kind === 'repeat' && !visited.has(s.id)) problems.push(where(`repeating group ${s.id} never gets an item`));
    }
  }

  // The demo form, once per behavior, with the first option of every dropdown.
  const fed = study.automations.find((a) => a.id === demo.feeds);
  if (!fed || fed.trigger.type !== 'When a form is submitted') {
    problems.push(`${business.id}: demo feeds ${demo.feeds}, which is not a form-triggered automation`);
    continue;
  }
  const answers = Object.fromEntries(demo.fields.map((f) => [f.name, f.options?.[0] ?? (f.type === 'number' ? '25' : f.type === 'email' ? 'alex@example.com' : f.type === 'url' ? 'https://example.com' : 'Alex Sample')]));
  for (const b of demo.behaviors) {
    runs++;
    const w = (m) => `${business.id}: demo "${b.value}": ${m}`;
    try {
      const sc = { id: `demo-${b.value}`, label: b.label, summary: '', start: 1440 + 615, form: demo.toRecord(answers), setup: b.setup?.(answers), failures: b.failures, expect: { status: 'success' } };
      const trace = simulate(study, fed, sc);
      checkMessages(trace, w);
    } catch (e) {
      problems.push(w(`threw ${e.message}`));
    }
  }
}

if (problems.length) {
  console.log('Airtable check FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Airtable check clean: ${cases.length} case${cases.length === 1 ? '' : 's'}, ${automations} automations, ${runs} test runs, every action and branch reached.`);
