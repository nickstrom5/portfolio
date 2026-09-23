/**
 * Checks the GHL showcase data on /ghl/ without a browser.
 *
 *   npm run ghl:check
 *   npm run ghl:check -- src/data/ghl/automations/missed-call.ts   (one file)
 *
 * Runs every scenario of every automation through the simulator and fails
 * if a run ends differently than its `expect` block says, if any step or
 * branch is never reached by any scenario, if a message still contains an
 * unresolved {{merge_field}}, if an SMS runs past two segments, or if the
 * workflow breaks a GHL builder rule (steps after an If/Else, duplicate
 * step ids).
 */
import { build } from 'esbuild';

// With a file argument, check only the automations that file exports.
const only = process.argv[2];
const entry = only
  ? `export { sampleContact, env } from './src/data/ghl/business.ts'; export { simulate } from './src/lib/ghl/engine.ts'; import * as m from './${only.replace(/^\.\//, '')}'; export const automations = Object.values(m).filter((v) => v && typeof v === 'object' && 'workflow' in v);`
  : "export * from './src/data/ghl/index.ts'; export { simulate } from './src/lib/ghl/engine.ts';";
const out = await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { automations, sampleContact, env, simulate } = mod;

const problems = [];
const warnings = [];
let runs = 0;

function walk(steps, fn, depth = 0) {
  steps.forEach((s, i) => {
    fn(s, depth, i === steps.length - 1);
    if (s.kind === 'ifelse') {
      s.branches.forEach((b) => walk(b.nodes, fn, depth + 1));
      walk(s.otherwise.nodes, fn, depth + 1);
    }
    if (s.kind === 'wait' && s.branches) {
      walk(s.branches.met.nodes, fn, depth + 1);
      walk(s.branches.timeout.nodes, fn, depth + 1);
    }
  });
}

/** GSM-7 characters count 1; anything else forces UCS-2 (70 per segment). */
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
function smsSegments(text) {
  if (GSM.test(text)) return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}

const ids = new Set();
for (const a of automations) {
  if (ids.has(a.id)) problems.push(`duplicate automation id ${a.id}`);
  ids.add(a.id);
  const where = (m) => `${a.id}: ${m}`;

  // Structure.
  const nodeIds = new Set();
  const branchKeys = new Set();
  const nodes = new Set();
  const gotos = [];
  walk(a.workflow.steps, (s, _depth, isLast) => {
    if (nodeIds.has(s.id)) problems.push(where(`duplicate step id ${s.id}`));
    nodeIds.add(s.id);
    nodes.add(s.id);
    if ((s.kind === 'ifelse' || (s.kind === 'wait' && s.branches)) && !isLast) problems.push(where(`steps after the split ${s.id} can never run: GHL branches do not rejoin`));
    if (s.kind === 'ifelse') {
      s.branches.forEach((_, i) => branchKeys.add(`${s.id}:${i}`));
      branchKeys.add(`${s.id}:else`);
    }
    if (s.kind === 'wait' && s.branches) {
      branchKeys.add(`${s.id}:met`);
      branchKeys.add(`${s.id}:timeout`);
    }
    if (s.kind === 'wait' && s.mode === 'event' && !s.event) problems.push(where(`event wait ${s.id} has no event`));
    if (s.kind === 'goto') gotos.push(s);
  });
  for (const g of gotos) if (!nodeIds.has(g.target)) problems.push(where(`Go To ${g.id} points at missing step ${g.target}`));
  if (!a.scenarios.length) problems.push(where('no scenarios'));

  // Runs.
  const seen = new Set();
  for (const sc of a.scenarios) {
    runs++;
    let trace;
    try {
      trace = simulate(a, sc, sampleContact, env);
    } catch (e) {
      problems.push(where(`scenario ${sc.id} threw: ${e.message}`));
      continue;
    }
    trace.visited.forEach((v) => seen.add(v));
    trace.skipped.forEach((v) => seen.add(v));
    const ex = sc.expect;
    if (ex.outcome !== trace.outcome) problems.push(where(`scenario ${sc.id} ended "${trace.outcome}", expected "${ex.outcome}"`));
    for (const v of ex.visits ?? []) if (!trace.visited.includes(v)) problems.push(where(`scenario ${sc.id} never reached ${v}`));
    for (const v of ex.skips ?? []) if (!trace.skipped.includes(v)) problems.push(where(`scenario ${sc.id} did not skip ${v}`));
    for (const tag of ex.tags ?? []) if (!trace.contact.tags.includes(tag)) problems.push(where(`scenario ${sc.id} ended without tag ${tag}`));
    if (ex.stage && trace.contact.opportunity?.stage !== ex.stage) problems.push(where(`scenario ${sc.id} ended in stage "${trace.contact.opportunity?.stage}", expected "${ex.stage}"`));
    for (const step of trace.steps) {
      const m = step.message;
      if (!m) continue;
      const text = `${m.subject ?? ''} ${m.body} ${m.to ?? ''}`;
      const left = text.match(/\{\{[^}]+\}\}/g);
      if (left) problems.push(where(`scenario ${sc.id}: unresolved merge field ${left.join(', ')} in "${step.title}"`));
      if (m.channel === 'sms' && m.direction === 'out') {
        if (!GSM.test(m.body)) {
          const bad = [...new Set([...m.body].filter((ch) => !GSM.test(ch)))].join(' ');
          problems.push(where(`SMS "${step.title}" has non-GSM characters (${bad}), which drops each segment to 70 characters`));
        }
        const segs = smsSegments(m.body);
        if (segs > 2) problems.push(where(`SMS "${step.title}" is ${segs} segments (${m.body.length} chars)`));
      }
    }
  }
  for (const n of nodes) if (!seen.has(n)) problems.push(where(`step ${n} is never reached by any scenario`));
  for (const k of branchKeys) if (!seen.has(k)) problems.push(where(`branch ${k} is never taken by any scenario`));
}

for (const w of warnings) console.log('warn: ' + w);
if (problems.length) {
  console.log('GHL check FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`GHL check clean: ${automations.length} automations, ${runs} scenario runs, every step and branch reached.`);
