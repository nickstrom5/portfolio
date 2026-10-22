/**
 * Turns a workflow from src/data/n8n into the JSON n8n itself imports: the
 * file you get from Download in the editor, or can paste onto a canvas.
 *
 * The page's data describes what each node does; each case's n8n-json folder
 * adds what n8n needs to rebuild it (node type, version and parameters). This
 * file joins the two: it lays the nodes out left to right the way the canvas
 * draws them, and wires the connections from the same splits and joins the
 * simulator runs, so the export cannot disagree with the page.
 */
import type { Automation, Json, N8nNode, Step } from './types';
import { allNodes } from './engine';

/** What n8n needs for one node, beyond what the page already knows. */
export interface NodeSpec {
  type: string;
  typeVersion: number;
  parameters: Json;
  /** Credential type key, e.g. "slackOAuth2Api". The name comes from the page's node. */
  credentialType?: string;
  /** Webhook-style nodes get a stable id so test and production URLs survive import. */
  webhookId?: string;
  /** An AI root node's chat model, drawn under it and wired as ai_languageModel. */
  model?: { name: string; type: string; typeVersion: number; parameters: Json; credentialType: string; credential: string };
}

export type Specs = Record<string, NodeSpec>;

interface N8nJsonNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Json;
  credentials?: Record<string, { id: string; name: string }>;
  webhookId?: string;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: 'continueRegularOutput' | 'continueErrorOutput';
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  notes?: string;
}

type Conn = { node: string; type: 'main' | 'ai_languageModel'; index: number };

const X = 260;
const Y = 200;

/** A short, stable id from a string, shaped like n8n's uuids. */
function uid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of seed) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 + ch.charCodeAt(0), 2246822519) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Every node the export needs a spec for, trigger first. */
export const exportNodes = (a: Automation): N8nNode[] => [a.workflow.trigger, ...allNodes(a.workflow.steps)];

export function toN8nJson(a: Automation, specs: Specs, caseId: string): Json {
  const nodes: N8nJsonNode[] = [];
  const connections: Record<string, { main?: Conn[][]; ai_languageModel?: Conn[][] }> = {};
  const placed = new Map<string, [number, number]>();

  const connect = (from: { name: string; output: number }, to: string, index = 0, type: Conn['type'] = 'main') => {
    const c = (connections[from.name] ??= {});
    const list = (c[type] ??= []);
    while (list.length <= from.output) list.push([]);
    list[from.output].push({ node: to, type, index });
  };

  const add = (n: N8nNode, x: number, y: number) => {
    const spec = specs[n.id];
    if (!spec) throw new Error(`${caseId}/${a.id}: no n8n spec for node ${n.id}`);
    const s = n.settings ?? {};
    const node: N8nJsonNode = {
      id: uid(`${caseId}/${a.id}/${n.id}`),
      name: n.name,
      type: spec.type,
      typeVersion: spec.typeVersion,
      position: [x, y],
      // A Code node's program is already on the page; the export uses that same text.
      parameters: spec.type === 'n8n-nodes-base.code' && n.code && spec.parameters.jsCode === undefined ? { ...spec.parameters, jsCode: n.code.source } : spec.parameters,
    };
    if (spec.credentialType && n.credential) node.credentials = { [spec.credentialType]: { id: uid(`cred/${n.credential}`).slice(0, 16).replace(/-/g, ''), name: n.credential } };
    if (spec.webhookId) node.webhookId = spec.webhookId;
    if (s.retryOnFail) Object.assign(node, { retryOnFail: true, maxTries: s.retryOnFail.maxTries, waitBetweenTries: s.retryOnFail.waitMs });
    if (s.onError === 'error-output') node.onError = 'continueErrorOutput';
    if (s.onError === 'continue') node.onError = 'continueRegularOutput';
    if (s.alwaysOutputData) node.alwaysOutputData = true;
    if (s.executeOnce) node.executeOnce = true;
    nodes.push(node);
    placed.set(n.id, [x, y]);
    if (spec.model) {
      nodes.push({
        id: uid(`${caseId}/${a.id}/${n.id}/model`),
        name: spec.model.name,
        type: spec.model.type,
        typeVersion: spec.model.typeVersion,
        position: [x, y + Y],
        parameters: spec.model.parameters,
        credentials: { [spec.model.credentialType]: { id: uid(`cred/${spec.model.credential}`).slice(0, 16).replace(/-/g, ''), name: spec.model.credential } },
      });
      connect({ name: spec.model.name, output: 0 }, n.name, 0, 'ai_languageModel');
    }
  };

  /** Height of a list of steps in rows, so branches below each other never overlap. */
  const rows = (steps: Step[]): number =>
    Math.max(1, ...steps.map((s) => (s.kind === 'node' ? (specs[s.node.id]?.model ? 2 : 1) : s.branches.reduce((n, b) => n + rows(b.steps), 0))));

  /**
   * Lays out and wires a list of steps starting at column x, row y, fed by
   * `from`. Returns the column after the last step and the outputs that carry
   * on past the end of the list (for a join, or for the caller).
   */
  const lay = (steps: Step[], x: number, y: number, from: { name: string; output: number }[]): { x: number; tails: { name: string; output: number }[] } => {
    let tails = from;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind === 'node') {
        add(s.node, x, y);
        tails.forEach((t) => connect(t, s.node.name));
        tails = [{ name: s.node.name, output: 0 }];
        // AI root nodes are drawn wide on n8n's canvas; give them the room.
        x += specs[s.node.id]?.model ? X + 120 : X;
        continue;
      }
      let feeds: { name: string; output: number }[][];
      if (s.node) {
        add(s.node, x, y);
        tails.forEach((t) => connect(t, s.node!.name));
        feeds = s.branches.map((_, bi) => [{ name: s.node!.name, output: bi }]);
        x += X;
      } else {
        feeds = s.branches.map(() => tails);
      }
      let by = y;
      let end = x;
      const joined: { name: string; output: number }[][] = [];
      s.branches.forEach((b, bi) => {
        const r = lay(b.steps, x, by, feeds[bi]);
        end = Math.max(end, r.x);
        if (b.joins) joined.push(r.tails);
        by += rows(b.steps) * Y;
      });
      x = end;
      const next = steps[i + 1];
      if (next?.kind === 'node' && next.node.type === 'Merge') {
        add(next.node, x, y);
        joined.forEach((ts, input) => ts.forEach((t) => connect(t, next.node.name, input)));
        tails = [{ name: next.node.name, output: 0 }];
        x += X;
        i++;
      } else {
        tails = joined.flat();
      }
    }
    return { x, tails };
  };

  add(a.workflow.trigger, 0, 0);
  lay(a.workflow.steps, X, 0, [{ name: a.workflow.trigger.name, output: 0 }]);

  // Sticky note with what the page says the workflow does, like a builder leaves for the next person.
  const st = a.workflow.settings;
  const settings: Json = { executionOrder: 'v1', timezone: st.timezone, saveDataSuccessExecution: st.saveSuccess ? 'all' : 'none', saveDataErrorExecution: st.saveFailed ? 'all' : 'none', saveManualExecutions: true };
  if (st.timeout) settings.executionTimeout = st.timeout;
  if (st.errorWorkflow) settings.errorWorkflow = `${caseId}-${st.errorWorkflow}`;
  const note = {
    id: uid(`${caseId}/${a.id}/note`),
    name: 'About this workflow',
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [-40, -260] as [number, number],
    parameters: { content: `## ${a.workflow.name}\n${a.tagline}\n\nA sample from work-with-nick.com/n8n. Fictional business; connect your own credentials before running it.`, width: 560, height: 120 + Math.ceil(a.tagline.length / 80) * 22, color: 5 },
  };
  return {
    name: a.workflow.name,
    nodes: [note, ...nodes],
    connections,
    pinData: {},
    settings,
    tags: a.workflow.tags.map((t) => ({ name: t })),
    meta: { templateCredsSetupCompleted: false, instanceId: 'work-with-nick-sample' },
  };
}
