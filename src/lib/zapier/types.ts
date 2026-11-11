/**
 * Data model for the Zapier showcase on /zapier/.
 *
 * Each Zap is described the way it reads in Zapier's editor: a trigger, then
 * numbered steps top to bottom. A step is an app's action or search, or one
 * of Zapier's own tools: Filter, Formatter, Delay, Looping, Paths. A Paths
 * step or a loop is always the last step of its list, as in Zapier: every
 * step "after" a loop runs once per iteration, and nothing can follow Paths.
 * The same data renders the editor on the server and drives the in-browser
 * simulator, so the two cannot drift apart.
 */

/** Icons, drawn by src/components/zapier/Icon.astro. */
export type IconName =
  | 'bolt'
  | 'form'
  | 'clock'
  | 'code'
  | 'mail'
  | 'slack'
  | 'sms'
  | 'plus'
  | 'pen'
  | 'search'
  | 'branch'
  | 'repeat'
  | 'filter'
  | 'wand'
  | 'hourglass'
  | 'sheet'
  | 'crm'
  | 'card'
  | 'invoice'
  | 'calendar'
  | 'video'
  | 'megaphone'
  | 'digest'
  | 'alert'
  | 'check'
  | 'play'
  | 'skip'
  | 'reset'
  | 'copy'
  | 'plug';

export type Json = { [key: string]: unknown };

/** Something a person reads: an email, a Slack message, a text. */
export interface Message {
  channel: 'email' | 'slack' | 'sms';
  to: string;
  subject?: string;
  body: string;
}

/** What a step did in a connected app, for the run log. */
export interface Effect {
  app: string;
  /** "Contact created", "Row added to Leads", "Invoice sent". */
  what: string;
  /** The record it touched, by the name a person would know it by. */
  name: string;
  /** Fields it set, as they read in the app. */
  fields?: Record<string, string>;
}

/** What a step can read while it runs. */
export interface Ctx {
  /** The trigger's data, as Zapier shows it under step 1. */
  trigger: Json;
  /** Output of an earlier step, by its id. */
  out: (id: string) => Json;
  /** Inside a loop: this iteration's values, its position and the count. */
  loop?: { item: Json; index: number; total: number };
  /** Records in a connected app as they are right now: the sample data plus what this run has written. */
  rows: (collection: string) => Json[];
  /** Simulated time, ms after Monday 00:00 of the sample week, and its ISO form. */
  now: number;
  iso: string;
  /** The test event's own extras: what an app answers on this run. */
  fixtures: Json;
}

export interface StepResult {
  /** One line for the log. */
  log?: string;
  /** The step's output fields, which later steps map. */
  output?: Json;
  messages?: Message[];
  effects?: Effect[];
  /** Records to add to a connected app's sample data, so later steps in this run find them. */
  write?: { collection: string; row: Json }[];
  /** Searches: false when nothing matched. */
  found?: boolean;
}

interface StepBase {
  id: string;
  /** What this step is for, in the builder's words; shown as the step's name. */
  title: string;
  summary: string;
  /** Settings as they read in the step's panel. {step-id › Field} is a mapped value from an earlier step. */
  params: { k: string; v: string }[];
}

/**
 * An app step: an action (writes something), a search (finds something), or a
 * "find or create" search. Zapier's own apps (Formatter, Digest, Storage…)
 * are app steps too; they just never use a task.
 */
export interface AppStep extends StepBase {
  kind: 'action';
  /** The app as Zapier names it: "HubSpot", "Formatter by Zapier". */
  app: string;
  /** The action event as Zapier names it: "Create Deal", "Send Channel Message", "Text". */
  event: string;
  icon: IconName;
  /** Searches only. `halt`: nothing found stops the run (Zapier's default). `continue`: the step counts as a success and the Zap goes on. `create`: the search creates the record. */
  search?: 'halt' | 'continue' | 'create';
  /** Code by Zapier and long bodies. */
  code?: { language: 'javascript' | 'text'; source: string };
  /** A custom error handler: steps that run in place of the rest when this step errors. */
  onError?: Step[];
  /** Simulated run time, ms. */
  ms?: number;
  run: (ctx: Ctx) => StepResult;
}

/** Filter by Zapier: the run goes on only if the rules are met. */
export interface FilterStep extends StepBase {
  kind: 'filter';
  /** The rules as they read in the step: "Status (Text) Exactly matches Done". */
  rules: string;
  test: (ctx: Ctx) => boolean;
}

/** Delay by Zapier. */
export interface DelayStep extends StepBase {
  kind: 'delay';
  event: 'Delay For' | 'Delay Until';
  /** Delay For: how long. */
  ms?: number;
  /** Delay Until: the moment to wait for, as simulated ms. */
  until?: (ctx: Ctx) => number;
}

/** One branch of a Paths step. */
export interface Branch {
  /** The path's name in the editor: "In our area". */
  name: string;
  /** Custom rules, as they read; omitted for a fallback. */
  rules?: string;
  /** Runs only when no other path's rules were met. One per Paths step, always last. */
  fallback?: boolean;
  test?: (ctx: Ctx) => boolean;
  steps: Step[];
}

/**
 * Paths by Zapier. Every path whose rules are met runs, left to right; the
 * fallback runs only when none was. It is the last step of its list.
 */
export interface PathsStep {
  kind: 'paths';
  id: string;
  branches: Branch[];
}

/**
 * Looping by Zapier. Its steps are everything after it in the Zap: they run
 * once per value, and each iteration is its own run in Zap history.
 */
export interface LoopStep extends StepBase {
  kind: 'loop';
  event: 'Create Loop From Line Items' | 'Create Loop From Text' | 'Create Loop From Numbers';
  values: (ctx: Ctx) => Json[];
  /** What to call one value in the log: "attendee". */
  noun: string;
  steps: Step[];
}

export type Step = AppStep | FilterStep | DelayStep | PathsStep | LoopStep;

export interface Trigger {
  app: string;
  /** The trigger event as Zapier names it: "New Submission", "Updated Deal Stage". */
  event: string;
  icon: IconName;
  /** Instant: the app tells Zapier at once. Polling: Zapier asks the app on a schedule. Schedule: the clock. */
  type: 'instant' | 'polling' | 'schedule';
  summary: string;
  params: { k: string; v: string }[];
}

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  /** Minutes after Monday 00:00 of the sample week: when the event happens in the app. */
  start: number;
  /** What happened in the app, for the first line of the log: "Dana marks the job Done". */
  event?: string;
  /** The trigger's data on this run. */
  trigger: Json;
  /** Extra records in connected apps on this run, by collection. */
  world?: Record<string, Json[]>;
  fixtures?: Json;
  /**
   * Steps that error, by id, with the app's message. With `replays`, the step
   * fails that many times and then works, so Autoreplay recovers the run.
   */
  failures?: Record<string, { message: string; replays?: number }>;
  /** What a correct run ends with; checked by scripts/zapier-check.mjs. */
  expect: {
    status: RunStatus;
    visits?: string[];
    skips?: string[];
    tasks?: number;
    /** Runs in Zap history: one, or one per loop iteration. */
    runs?: number;
  };
}

/** A Zap run's status, as Zap history names it. */
export type RunStatus = 'Successful' | 'Filtered' | 'Errored' | 'Safely halted' | 'Handled error';

export interface Zap {
  id: string;
  number: string;
  name: string;
  kicker: string;
  tagline: string;
  /** The business problem, in the client's words. */
  problem: string;
  /** What the Zap does about it. */
  solution: string;
  /** Folder in Zapier. */
  folder: string;
  trigger: Trigger;
  steps: Step[];
  /** Whether Autoreplay is on for this Zap. Off when a step has an error handler. */
  autoreplay: boolean;
  /** Who owns the Zap and gets Zapier's error emails. */
  owner: string;
  scenarios: Scenario[];
  /** Fields the Zap reads or writes, and why. */
  fields: { app: string; field: string; use: string }[];
  build: { title: string; body: string }[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  /** Zapier features this build uses. */
  features: string[];
}

/* ---------- Case studies: one sample Zapier account per business ---------- */

export interface Business {
  /** Used in URLs and ids, e.g. "cleaning". */
  id: string;
  name: string;
  industry: string;
  area: string;
  /** One line for the case-study switcher. */
  blurb: string;
  intro: string;
  disclaimer: string;
  /** The Zapier plan and why, and how the account is organised. */
  setup: string;
  /** The polling interval on that plan, in minutes. */
  pollMinutes: number;
  /** The apps the Zaps connect, in the order the journey uses them. */
  stack: string[];
  team: { name: string; role: string }[];
  /** Journey map: what each Zap hands on, by Zap id. */
  handoff: Record<string, string>;
  tint: { light: string; dark: string };
}

/** A connected app, for the "Connected apps" list. */
export interface Connection {
  app: string;
  icon: IconName;
  /** The connection's name in Zapier and whose login it uses. */
  account: string;
  /** What the Zaps do there. */
  use: string;
}

export interface DemoField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'dropdown' | 'textarea' | 'tel';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  autocomplete?: string;
  help?: string;
}

/** The business's form, rebuilt as a working demo that feeds one Zap. */
export interface DemoForm {
  /** Shown in the fake browser bar. */
  url: string;
  title: string;
  description: string;
  fields: DemoField[];
  submitLabel: string;
  ending: string;
  /** Zap id the form feeds. */
  feeds: string;
  /** How the answers become the trigger's data. */
  toTrigger: (answers: Record<string, string>, submittedAt: string) => Json;
  /** What the rest of the world does on this run, picked by the visitor. */
  behaviors: { value: string; label: string; world?: (answers: Record<string, string>) => Scenario['world']; fixtures?: Json; failures?: Scenario['failures'] }[];
  note: string;
  notes: { title: string; body: string }[];
}

export interface CaseStudy {
  business: Business;
  connections: Connection[];
  /** Sample records in the connected apps, by collection name ("HubSpot contacts"). */
  world: Record<string, Json[]>;
  demo: DemoForm;
  zaps: Zap[];
}
