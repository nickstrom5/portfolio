/**
 * Data model for the n8n showcase on /n8n/.
 *
 * Each workflow is described the way it is built on the n8n canvas: a
 * trigger node, then nodes that pass items to each other. An If, Switch,
 * AI classifier or a node with an error output splits the items between its
 * outputs; one node wired to two others fans the same items out to both;
 * and unlike GoHighLevel, branches can meet again, at a Merge node or at the
 * one node they both connect to. The same data renders the canvas on the
 * server and drives the in-browser simulator, so the two cannot drift apart.
 */

/** Node icons, drawn by src/components/n8n/Icon.astro. */
export type IconName =
  | 'bolt'
  | 'webhook'
  | 'form'
  | 'clock'
  | 'code'
  | 'http'
  | 'split'
  | 'switch'
  | 'merge'
  | 'slack'
  | 'mail'
  | 'sheet'
  | 'db'
  | 'alert'
  | 'pen'
  | 'filter'
  | 'ai'
  | 'cart'
  | 'card'
  | 'user'
  | 'folder'
  | 'task'
  | 'list'
  | 'dedupe'
  | 'reply'
  | 'flow'
  | 'ticket'
  | 'check'
  | 'play'
  | 'skip'
  | 'reset'
  | 'copy'
  | 'key';

export type Json = { [key: string]: unknown };

/** One n8n item. Binary data is shown by name only. */
export interface Item {
  json: Json;
  binary?: Record<string, { fileName: string; mimeType: string; fileSize: string }>;
}

/** Something a node sends that a person reads: a Slack post, an email, a text, an HTTP response. */
export interface Message {
  channel: 'slack' | 'email' | 'sms' | 'http' | 'form' | 'task';
  /** Channel, address or caller. */
  to: string;
  subject?: string;
  body: string;
}

/** What a node can read while it runs: earlier nodes' output, the clock, the instance. */
export interface RunContext {
  /** `$('Node name').all()`: the items an earlier node output in this execution. */
  $: (name: string) => Item[];
  /** Simulated time, milliseconds after Monday 00:00 of the sample week. */
  now: number;
  /** `$execution.id` */
  executionId: string;
  /** Which try this is, for nodes with Retry On Fail. */
  attempt: number;
  env: InstanceEnv;
  /** The test event's own extras (an API's canned answers, a classifier's verdict…). */
  fixtures: Json;
}

export interface NodeResult {
  /** Output items for a node with one output. */
  items?: Item[];
  /** One list per output, for If, Switch, a classifier or a node with an error output. */
  outputs?: Item[][];
  /** One line for the log, like the hint under a node in the editor. */
  log?: string;
  messages?: Message[];
}

export interface NodeSettings {
  retryOnFail?: { maxTries: number; waitMs: number };
  /** Stop Workflow (the default), Continue, or Continue (using error output). */
  onError?: 'stop' | 'continue' | 'error-output';
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
}

export type Tone = 'trigger' | 'core' | 'logic' | 'app' | 'ai' | 'flow' | 'data';

export interface N8nNode {
  id: string;
  /** The node's name on the canvas. n8n requires it to be unique in the workflow. */
  name: string;
  /** The node type as it reads in the node panel, e.g. "HTTP Request". */
  type: string;
  /** Resource and operation, e.g. "Message › Send". */
  operation?: string;
  icon: IconName;
  tone: Tone;
  summary: string;
  /** Key parameters as they read in the node panel; values may hold {{ expressions }}. */
  params?: { k: string; v: string }[];
  /** Name of the saved credential the node uses. */
  credential?: string;
  settings?: NodeSettings;
  /** For Code nodes, SQL and request bodies. */
  code?: { language: 'javascript' | 'json' | 'sql' | 'text'; source: string };
  /** A Wait node: how long, or until what. */
  wait?: { mode: 'interval'; ms: number } | { mode: 'webhook' | 'form'; limitMs: number };
  /** Simulated run time of one call, ms. Default 30 for core nodes, 400 for app nodes. */
  ms?: number;
  /**
   * What the node does to its items. Merge nodes get every input, in order,
   * as `inputs` (undefined for a branch that never ran).
   */
  run?: (items: Item[], ctx: RunContext, inputs?: (Item[] | undefined)[]) => NodeResult;
}

/** A node in the main line. */
export interface NodeStep {
  kind: 'node';
  node: N8nNode;
}

/**
 * Where the line divides. With a node (If, Switch, Text Classifier, or a node
 * set to Continue (using error output)) that node's outputs feed the
 * branches in order. Without one, the previous node is wired to every branch
 * and each gets all of its items.
 */
export interface SplitStep {
  kind: 'split';
  /** Needed for a fan-out, which has no node of its own; a split with a node uses the node's id. */
  id?: string;
  node?: N8nNode;
  branches: Branch[];
}

export interface Branch {
  /** Output name as it reads on the canvas: "true", "Billing", "Error"… */
  label: string;
  /** The rule behind the output, as it reads in the node. */
  rule?: string;
  steps: Step[];
  /** The branch connects on to the step after the split. Without it the branch ends. */
  joins?: boolean;
}

export type Step = NodeStep | SplitStep;

export interface WorkflowSettings {
  /** Always v1 for workflows built from n8n 1.0 on; spelled out because it decides branch order. */
  executionOrder: 'v1';
  /** Id of the workflow in this case that runs when an automatic execution fails. */
  errorWorkflow?: string;
  timezone: string;
  saveFailed: boolean;
  saveSuccess: boolean;
  /** Seconds; omitted for no timeout. */
  timeout?: number;
  callerPolicy?: string;
  notes?: string[];
}

export interface Workflow {
  /** As it appears in the workflow list. */
  name: string;
  /** Project and folder in n8n. */
  folder: string;
  tags: string[];
  trigger: N8nNode;
  settings: WorkflowSettings;
  steps: Step[];
}

export interface Scenario {
  id: string;
  label: string;
  /** One line explaining what this test event is. */
  summary: string;
  /** Minutes after Monday 00:00 of the sample week. */
  start: number;
  /** The items the trigger outputs. */
  input: Item[];
  /** Canned answers for app nodes and the classifier, read by `run`. */
  fixtures?: Json;
  /**
   * Calls that fail, by node id: one entry per try, then it succeeds. With
   * `items`, only those input items fail (a batch the API rejects), which
   * matters for a node with an error output.
   */
  failures?: Record<string, { status: number; message: string; items?: number[] }[]>;
  /** For Wait nodes on a webhook or form: when the call comes in and what it carries. Omitted: the limit runs out. */
  resume?: Record<string, { afterMs: number; json: Json }>;
  /** Started by another workflow's failure (an Error Trigger run): label for the log. */
  from?: string;
  /** What a correct run ends with; checked by scripts/n8n-check.mjs. */
  expect: {
    status: 'success' | 'error';
    visits?: string[];
    skips?: string[];
    /** Output item counts by node id. */
    items?: Record<string, number>;
    /** The case's error workflow ran after this failure. */
    errorWorkflow?: boolean;
  };
}

export interface Credential {
  name: string;
  type: string;
  note: string;
}

export interface DataModel {
  credentials?: Credential[];
  /** Fields the workflow writes or reads, in a table, sheet or app. */
  fields?: { name: string; where: string; type: string; note?: string }[];
  variables?: { key: string; value: string; note?: string }[];
}

export interface Snippet {
  title: string;
  language: 'javascript' | 'json' | 'sql' | 'text';
  code: string;
  note?: string;
}

export interface Automation {
  id: string;
  number: string;
  name: string;
  kicker: string;
  tagline: string;
  /** The business problem, in the client's words. */
  problem: string;
  /** What the workflow does about it. */
  solution: string;
  workflow: Workflow;
  scenarios: Scenario[];
  dataModel: DataModel;
  build: { title: string; body: string }[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  snippets?: Snippet[];
  /** n8n nodes and features this build exercises. */
  features: string[];
}

/* ---------- Case studies: one sample n8n instance per business ---------- */

export interface InstanceEnv {
  /** e.g. https://copperleaf.app.n8n.cloud */
  baseUrl: string;
  /**
   * Values the build keeps in one place: channels, file names, links. Plain
   * constants here; n8n's own Variables ($vars) need a paid plan, so these
   * cases do not depend on them.
   */
  vars: Record<string, string>;
}

export interface Business {
  /** Used in URLs and ids, e.g. "coffee". */
  id: string;
  name: string;
  industry: string;
  area: string;
  /** One line for the case-study switcher. */
  blurb: string;
  /** A short paragraph introducing the client and what they needed. */
  intro: string;
  disclaimer: string;
  /** Where n8n runs and why. */
  hosting: string;
  /** The tools n8n connects, in the order the journey uses them. */
  stack: string[];
  team: { name: string; role: string }[];
  env: InstanceEnv;
  /** Journey map: what each workflow hands to the next, by automation id. */
  handoff: Record<string, string>;
  /** Accent colours for the switcher card (light and dark theme). */
  tint: { light: string; dark: string };
}

export interface DemoField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'dropdown' | 'textarea';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  autocomplete?: string;
}

/** A form the visitor fills in to send the case's first workflow a test event of their own. */
export interface DemoForm {
  /** Shown in the fake browser bar. */
  url: string;
  title: string;
  description: string;
  fields: DemoField[];
  submitLabel: string;
  /** Shown after submit. */
  ending: string;
  /** Automation id the form feeds. */
  feeds: string;
  /** How the answers become the trigger's item. */
  toItem: (answers: Record<string, string>, submittedAt: string) => Item;
  /** What the rest of the world does on this run, picked by the visitor. */
  behaviors: { value: string; label: string; fixtures?: Json; failures?: Scenario['failures'] }[];
  /** One line on what the visitor should watch for. */
  note: string;
  /** How the form or the request is set up in n8n. */
  notes: { title: string; body: string }[];
}

export interface CaseStudy {
  business: Business;
  demo: DemoForm;
  automations: Automation[];
}
