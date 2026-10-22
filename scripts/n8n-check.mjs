/**
 * Checks the n8n showcase data on /n8n/ without a browser.
 *
 *   npm run n8n:check
 *
 * Runs every test event of every workflow through the simulator and fails if
 * a run ends differently than its `expect` block says (status, nodes reached
 * or not, item counts, error workflow), if any node or output is never
 * reached by any test event, if a message still holds an unresolved
 * {{ expression }}, or if a workflow breaks an n8n rule this page relies on:
 * duplicate node names, an If without exactly true and false outputs, an
 * Retry On Fail outside n8n's limits or combined with a Continue setting, an
 * error output on a node not set to Continue (using error output), branches
 * that rejoin without a Merge, a credential the data model does not list,
 * or an error workflow that does not start with an Error Trigger. It also
 * submits each case's demo form once per behavior, the way page.ts does.
 */
import { build } from 'esbuild';

const out = await build({
  stdin: { contents: "export { cases } from './src/data/n8n/index.ts'; export { simulate, allNodes, splitId } from './src/lib/n8n/engine.ts'; export { specs } from './src/data/n8n/specs.ts'; export { toN8nJson, exportNodes } from './src/lib/n8n/export.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { cases, simulate, allNodes, splitId, specs, toN8nJson, exportNodes } = mod;

const problems = [];
let runs = 0;
let workflows = 0;

/** GSM-7 characters count 1; anything else forces UCS-2 (70 per segment). */
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

function checkMessages(trace, where) {
  for (const step of trace.steps) {
    for (const m of step.messages ?? []) {
      const text = `${m.subject ?? ''} ${m.body} ${m.to}`;
      const left = text.match(/\{\{[^}]*\}\}/g);
      if (left) problems.push(where(`unresolved expression ${left.join(', ')} in "${step.title}"`));
      if (/undefined|NaN|\[object Object\]/.test(text)) problems.push(where(`message from "${step.title}" reads "${text.match(/undefined|NaN|\[object Object\]/)[0]}"`));
      if (m.channel === 'sms') {
        if (!GSM.test(m.body)) problems.push(where(`SMS from "${step.title}" has non-GSM characters`));
        if (m.body.length > 306) problems.push(where(`SMS from "${step.title}" is longer than two segments`));
      }
    }
  }
}

/** Structural rules, walked over one list of steps. */
function checkSteps(steps, where, seen) {
  steps.forEach((s, i) => {
    if (s.kind === 'node') {
      const n = s.node;
      if (n.settings?.onError === 'error-output') problems.push(where(`${n.id} has an error output but is not a split: its Error output would go nowhere`));
      if (n.type === 'Merge') {
        const prev = steps[i - 1];
        const joins = prev?.kind === 'split' ? prev.branches.filter((b) => b.joins).length : 0;
        if (joins < 2) problems.push(where(`Merge ${n.id} does not follow a split with two or more joining branches`));
      }
      return;
    }
    const n = s.node;
    if (!n && !s.id) problems.push(where(`a fan-out split needs an id`));
    if (n?.type === 'If' && (s.branches.length !== 2 || s.branches[0].label !== 'true' || s.branches[1].label !== 'false')) problems.push(where(`If ${n.id} must have exactly a true and a false output, in that order`));
    if (n?.type === 'Switch' && s.branches.length < 2) problems.push(where(`Switch ${n.id} has fewer than two outputs`));
    if (n && n.settings?.onError === 'error-output' && (s.branches.length !== 2 || s.branches[0].label !== 'Success' || s.branches[1].label !== 'Error')) problems.push(where(`${n.id} uses its error output, so its outputs must be Success then Error`));
    if (n && n.settings?.onError !== 'error-output' && s.branches.some((b) => b.label === 'Error')) problems.push(where(`${n.id} has an Error branch but On Error is not Continue (using error output)`));
    if (n && !['If', 'Switch', 'Text Classifier'].includes(n.type) && n.settings?.onError !== 'error-output') problems.push(where(`${n.id} (${n.type}) splits items but is not an If, Switch, classifier or error output`));
    const joins = s.branches.filter((b) => b.joins).length;
    const next = steps[i + 1];
    if (joins && !next) problems.push(where(`split ${splitId(s)} has joining branches but nothing after it to join`));
    if (joins > 1 && !(next?.kind === 'node' && next.node.type === 'Merge')) problems.push(where(`split ${splitId(s)} has ${joins} branches joining one node without a Merge: that node would run once per branch`));
    if (!joins && next) problems.push(where(`steps after split ${splitId(s)} can never run: no branch joins them`));
    s.branches.forEach((b, bi) => {
      const lastStep = b.steps[b.steps.length - 1];
      if (b.joins && lastStep?.kind === 'split') problems.push(where(`output ${splitId(s)}:${bi} joins on but ends in another split, which the canvas cannot draw`));
      seen.branches.add(`${splitId(s)}:${bi}`);
      checkSteps(b.steps, where, seen);
    });
  });
}

for (const study of cases) {
  const { business, demo, automations } = study;
  const ids = new Set();
  for (const a of automations) {
    workflows++;
    const where = (m) => `${business.id}/${a.id}: ${m}`;
    if (ids.has(a.id)) problems.push(where('duplicate automation id'));
    ids.add(a.id);
    const wf = a.workflow;
    const nodes = [wf.trigger, ...allNodes(wf.steps)];
    const names = new Set();
    const nodeIds = new Set();
    for (const n of nodes) {
      if (names.has(n.name)) problems.push(where(`duplicate node name "${n.name}": n8n requires unique names`));
      if (nodeIds.has(n.id)) problems.push(where(`duplicate node id ${n.id}`));
      names.add(n.name);
      nodeIds.add(n.id);
      if (n.credential && !(a.dataModel.credentials ?? []).some((c) => c.name === n.credential)) problems.push(where(`node ${n.id} uses credential "${n.credential}", which the data model does not list`));
      if (n.type === 'Wait' && !n.wait) problems.push(where(`Wait ${n.id} has no wait settings`));
      // A node that continues on error hands the failure on as an item instead of throwing, so retries cannot be relied on.
      if (n.settings?.retryOnFail && n.settings.onError && n.settings.onError !== 'stop') problems.push(where(`node ${n.id} combines Retry On Fail with On Error ${n.settings.onError}`));
      if (n.settings?.retryOnFail && (n.settings.retryOnFail.maxTries < 2 || n.settings.retryOnFail.maxTries > 5 || n.settings.retryOnFail.waitMs > 5000)) problems.push(where(`node ${n.id} Retry On Fail is outside n8n's limits (2 to 5 tries, up to 5000 ms apart)`));
    }
    if (wf.trigger.tone !== 'trigger') problems.push(where('the trigger node is not toned as a trigger'));
    const seen = { branches: new Set() };
    checkSteps(wf.steps, where, seen);
    const handler = wf.settings.errorWorkflow;
    if (handler) {
      const h = automations.find((x) => x.id === handler);
      if (!h) problems.push(where(`error workflow ${handler} is not in this case`));
      else if (h.workflow.trigger.type !== 'Error Trigger') problems.push(where(`error workflow ${handler} does not start with an Error Trigger`));
      if (handler === a.id) problems.push(where('a workflow cannot be its own error workflow'));
    }
    if (!a.scenarios.length) problems.push(where('no test events'));

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
      if (trace.status !== ex.status) problems.push(w(`ended ${trace.status}, expected ${ex.status}${trace.error ? ` (${trace.error.node}: ${trace.error.message})` : ''}`));
      for (const v of ex.visits ?? []) if (!trace.visited.includes(v)) problems.push(w(`never reached ${v}`));
      for (const v of ex.skips ?? []) if (trace.visited.includes(v)) problems.push(w(`ran ${v}, which it should not`));
      for (const [k, n] of Object.entries(ex.items ?? {})) if ((trace.counts[k] ?? 0) !== n) problems.push(w(`${k} output ${trace.counts[k] ?? 0} items, expected ${n}`));
      const ranHandler = trace.executions.length > 1;
      if (!!ex.errorWorkflow !== ranHandler) problems.push(w(ranHandler ? 'started the error workflow unexpectedly' : 'expected the error workflow to run'));
      checkMessages(trace, w);
    }
    for (const n of nodes) if (!visited.has(n.id)) problems.push(where(`node ${n.id} is never reached by any test event`));
    for (const b of seen.branches) if (!visited.has(b)) problems.push(where(`output ${b} never carries an item in any test event`));
  }

  // The n8n export: every node has a spec, and the JSON wires every node in.
  for (const a of automations) {
    const where = (m) => `${business.id}/${a.id} export: ${m}`;
    const sp = specs[business.id]?.[a.id];
    if (!sp) { problems.push(where('no specs')); continue; }
    for (const n of exportNodes(a)) if (!sp[n.id]) problems.push(where(`no spec for node ${n.id}`));
    for (const id of Object.keys(sp)) if (!exportNodes(a).some((n) => n.id === id)) problems.push(where(`spec for missing node ${id}`));
    let json;
    try { json = toN8nJson(a, sp, business.id); } catch (e) { problems.push(where(`threw ${e.message}`)); continue; }
    const names = new Set(json.nodes.map((n) => n.name));
    const reached = new Set();
    for (const [from, c] of Object.entries(json.connections)) for (const outs of Object.values(c)) for (const o of outs) for (const t of o) {
      if (!names.has(from) || !names.has(t.node)) problems.push(where(`connection ${from} → ${t.node} names a missing node`));
      reached.add(t.node);
    }
    for (const n of json.nodes) if (n.type !== 'n8n-nodes-base.stickyNote' && n.name !== a.workflow.trigger.name && !reached.has(n.name) && !json.connections[n.name]?.ai_languageModel) problems.push(where(`${n.name} has no incoming connection`));
  }

  // The demo form, once per behavior, with the first option of every dropdown.
  const fed = automations.find((a) => a.id === demo.feeds);
  if (!fed) {
    problems.push(`${business.id}: demo feeds missing workflow ${demo.feeds}`);
    continue;
  }
  const answers = Object.fromEntries(demo.fields.map((f) => [f.name, f.options?.[0] ?? (f.type === 'number' ? '25' : f.type === 'email' ? 'alex@example.com' : 'Alex Sample')]));
  for (const b of demo.behaviors) {
    runs++;
    try {
      const sc = { ...fed.scenarios[0], id: `demo-${b.value}`, input: [demo.toItem(answers, '2026-03-04T10:15:00.000-05:00')], fixtures: b.fixtures ?? {}, failures: b.failures, resume: {} };
      const trace = simulate(study, fed, sc);
      checkMessages(trace, (m) => `${business.id}: demo "${b.value}": ${m}`);
    } catch (e) {
      problems.push(`${business.id}: demo "${b.value}" threw ${e.message}`);
    }
  }
}

if (problems.length) {
  console.log('n8n check FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`n8n check clean: ${cases.length} case${cases.length === 1 ? '' : 's'}, ${workflows} workflows, ${runs} test runs, every node and output reached.`);
