/**
 * Data model for the Airtable showcase on /airtable/.
 *
 * Each case is one sample base: its tables, fields, views and interfaces,
 * with sample records, plus the automations that run on it. Computed fields
 * work the way Airtable's do: a lookup reads a field through a link, a rollup
 * aggregates it, a count counts the links, and a formula is computed from the
 * record. Links are stored on one side and read from both, so a record linked
 * by an automation shows up in every rollup at once. The same data renders the
 * base and the automation editor on the server and drives the in-browser
 * simulator, so the two cannot drift apart.
 */

/** Icons, drawn by src/components/airtable/Icon.astro. */
export type IconName =
  | 'bolt'
  | 'form'
  | 'clock'
  | 'code'
  | 'mail'
  | 'slack'
  | 'plus'
  | 'pen'
  | 'search'
  | 'branch'
  | 'repeat'
  | 'match'
  | 'table'
  | 'link'
  | 'check'
  | 'play'
  | 'skip'
  | 'reset'
  | 'copy'
  | 'grid'
  | 'kanban'
  | 'calendar'
  | 'gallery'
  | 'timeline'
  | 'list'
  | 'sync'
  | 'layout';

export type FieldType =
  | 'Single line text'
  | 'Long text'
  | 'Email'
  | 'URL'
  | 'Phone number'
  | 'Number'
  | 'Currency'
  | 'Percent'
  | 'Rating'
  | 'Checkbox'
  | 'Date'
  | 'Single select'
  | 'Multiple select'
  | 'User'
  | 'Attachment'
  | 'Link to another record'
  | 'Lookup'
  | 'Rollup'
  | 'Count'
  | 'Formula'
  | 'Autonumber'
  | 'Created time'
  | 'Last modified time';

/**
 * A cell value. Links hold record IDs, attachments file names, a user field
 * the person's name; dates are "2026-03-12", times ISO strings.
 */
export type Value = string | number | boolean | null | string[] | number[];

/** What a formula can read: any field of the same record, and today's date. */
export type FormulaGet = (field: string) => Value;

export interface Field {
  name: string;
  type: FieldType;
  /** Why the field exists, for the schema view. */
  note?: string;
  /** Single and multiple select choices. */
  options?: string[];
  /** Link to another record: the table it links to. */
  link?: string;
  /**
   * Link to another record, the side that does not store the links: the
   * name of the link field in the other table that does. Airtable keeps
   * both sides in step; so does the engine, by reading this side from that one.
   */
  mirror?: string;
  /** Lookup, rollup and count: the link field in this table to read through. */
  via?: string;
  /** Lookup and rollup: the field to read in the linked table. */
  of?: string;
  /** Lookup, rollup, count: only linked records that meet this, as it reads in the field's settings. */
  where?: { text: string; test: (get: FormulaGet) => boolean };
  /** Rollup: the aggregation formula as typed, and what it does. */
  agg?: { text: string; fn: (values: Value[]) => Value };
  /** Formula: the formula as typed, and what it computes. */
  formula?: { text: string; fn: (get: FormulaGet, today: string) => Value };
  /** Last modified time: the fields it watches. */
  watch?: string[];
  /** Display: how a number, currency, percent or date shows. */
  format?: 'currency' | 'percent' | 'integer' | 'decimal' | 'date' | 'datetime';
}

export interface Rec {
  id: string;
  f: Record<string, Value>;
}

export type ViewType = 'Grid' | 'Form' | 'Calendar' | 'Gallery' | 'Kanban' | 'Timeline' | 'List';

export interface View {
  name: string;
  type: ViewType;
  /** Who uses it and why. */
  purpose: string;
  /** Filters, sorts, grouping, stacking or date fields, as they read in the view's toolbar. */
  setup: string[];
  /** Form views: the fields on the form, in order; required ones listed in `required`. */
  fields?: string[];
  required?: string[];
  /** Records the view shows, for Find records "based on view" and the check. */
  test?: (get: FormulaGet, today: string) => boolean;
}

export interface Table {
  name: string;
  description: string;
  /** The first field is the primary field. */
  fields: Field[];
  records: Rec[];
  views: View[];
  /** Synced from another base: read-only here. */
  synced?: string;
}

export interface InterfacePage {
  name: string;
  layout: 'Dashboard' | 'Record review' | 'List' | 'Gallery' | 'Kanban' | 'Calendar' | 'Timeline' | 'Form';
  /** Who opens it and what they do there. */
  purpose: string;
  /** Elements, filters and buttons as they read in the Interface Designer. */
  elements: string[];
}

export interface Interface {
  name: string;
  /** Who it is shared with and how. */
  audience: string;
  pages: InterfacePage[];
}

export interface BaseSchema {
  name: string;
  workspace: string;
  plan: string;
  tables: Table[];
  interfaces: Interface[];
  /** Synced tables in and out of this base. */
  syncs: { table: string; direction: 'in' | 'out'; other: string; note: string }[];
}

/* ---------- Automations ---------- */

export type TriggerType =
  | 'When a form is submitted'
  | 'When a record matches conditions'
  | 'When a record is created'
  | 'When a record is updated'
  | 'When a record enters a view'
  | 'At a scheduled time';

export interface Trigger {
  type: TriggerType;
  table?: string;
  /** The form or view the trigger watches. */
  view?: string;
  summary: string;
  /** Settings as they read in the trigger's panel. */
  params: { k: string; v: string }[];
  /** When a record matches conditions: the conditions. A record must not match before the test event and must after. */
  test?: (get: FormulaGet, today: string) => boolean;
  /** When a record is updated: the fields it watches. */
  watch?: string[];
}

/** Something a person reads: an email, a Slack message. */
export interface Message {
  channel: 'email' | 'slack';
  to: string;
  subject?: string;
  body: string;
}

/** A record as an action sees it: every field, computed ones included. */
export interface RecordView {
  id: string;
  table: string;
  /** The primary field's value. */
  name: string;
  get: (field: string) => Value;
  /** A field as Airtable shows it in a token: names for links, text for everything else. */
  text: (field: string) => string;
}

export interface Ctx {
  /** The trigger record; undefined for a scheduled trigger. */
  trigger?: RecordView;
  /** Output of an earlier action, by its id. */
  out: (id: string) => Json;
  /** The current item inside a repeating group. */
  item?: RecordView;
  /** All records of a table, as the base is right now. */
  records: (table: string) => RecordView[];
  record: (table: string, id: string) => RecordView;
  /** Records a view shows right now. */
  inView: (table: string, view: string) => RecordView[];
  /** Simulated time, ms after Monday 00:00 of the sample week, and its date. */
  now: number;
  today: string;
  /** Email address of a collaborator, by name. */
  email: (user: string) => string;
  /** The test event's own extras. */
  fixtures: Json;
}

export type Json = { [key: string]: unknown };

export interface ActionResult {
  log?: string;
  messages?: Message[];
  /** What later steps can use as tokens. */
  output?: Json;
  create?: { table: string; fields: Record<string, Value> }[];
  update?: { table: string; id: string; fields: Record<string, Value> }[];
  /** Updates that need the IDs of the records this step just created, as a script can. */
  then?: (created: string[]) => { table: string; id: string; fields: Record<string, Value> }[];
}

export type ActionType =
  | 'Send email'
  | 'Create record'
  | 'Update record'
  | 'Find records'
  | 'Run a script'
  | 'Send a Slack message';

export interface Action {
  kind: 'action';
  id: string;
  type: ActionType;
  /** What this step is for, shown under the action type. */
  title: string;
  summary: string;
  /** Settings as they read in the action's panel; {Trigger › Field} tokens are highlighted. */
  params: { k: string; v: string }[];
  /** Run a script: input variables and the script. */
  script?: { inputs: { name: string; value: string }[]; source: string };
  /** Simulated run time, ms. */
  ms?: number;
  run: (ctx: Ctx) => ActionResult;
}

/** A conditional group: its actions run only when the conditions are met. */
export interface Group {
  kind: 'if';
  id: string;
  /** The conditions, as they read in the group. */
  when: string;
  test: (ctx: Ctx) => boolean;
  steps: Action[];
}

/** A repeating group: its actions run once for each item in a list. */
export interface Repeat {
  kind: 'repeat';
  id: string;
  /** The list, as its token reads. */
  over: string;
  list: (ctx: Ctx) => RecordView[];
  steps: Action[];
}

export type Step = Action | Group | Repeat;

/** Changes made to the base before the trigger fires: an edit in the grid, a form, a count. */
export interface Setup {
  create?: { table: string; fields: Record<string, Value> }[];
  update?: { table: string; id: string; fields: Record<string, Value> }[];
  /** Who made the change, for the log. */
  by?: string;
}

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  /** Minutes after Monday 00:00 of the sample week. */
  start: number;
  /** Base changes that happen first; for record triggers, the change that fires it. */
  setup?: Setup;
  /** Record triggers: the record that fires it (after setup). */
  record?: string;
  /** Form triggers: the answers, by field name. */
  form?: Record<string, Value>;
  fixtures?: Json;
  /** Actions that fail, by id, with Airtable's error. */
  failures?: Record<string, string>;
  /** What a correct run ends with; checked by scripts/airtable-check.mjs. */
  expect: {
    status: 'success' | 'failed';
    visits?: string[];
    skips?: string[];
    emails?: number;
  };
}

export interface Automation {
  id: string;
  number: string;
  name: string;
  kicker: string;
  tagline: string;
  /** The business problem, in the client's words. */
  problem: string;
  /** What the automation does about it. */
  solution: string;
  trigger: Trigger;
  steps: Step[];
  /** Who gets the email when a run fails. */
  notify: string;
  scenarios: Scenario[];
  /** Fields the automation reads or writes, and why. */
  fields: { table: string; field: string; use: string }[];
  build: { title: string; body: string }[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  /** Airtable features this build uses. */
  features: string[];
}

/* ---------- Case studies: one sample base per business ---------- */

export interface Business {
  /** Used in URLs and ids, e.g. "events". */
  id: string;
  name: string;
  industry: string;
  area: string;
  /** One line for the case-study switcher. */
  blurb: string;
  intro: string;
  disclaimer: string;
  /** Why Airtable, and how the base is shared. */
  setup: string;
  /** The tools the base connects to. */
  stack: string[];
  team: { name: string; role: string; email: string }[];
  /** Journey map: what each automation hands on, by automation id. */
  handoff: Record<string, string>;
  tint: { light: string; dark: string };
}

export interface DemoField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'dropdown' | 'textarea' | 'url';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  autocomplete?: string;
  /** Shown under the field, as Airtable shows a field's form description. */
  help?: string;
}

/** The base's form view, rebuilt as a working demo that feeds one automation. */
export interface DemoForm {
  /** Shown in the fake browser bar. */
  url: string;
  title: string;
  description: string;
  fields: DemoField[];
  submitLabel: string;
  ending: string;
  /** Automation id the form feeds. */
  feeds: string;
  /** How the answers become the new record's fields. */
  toRecord: (answers: Record<string, string>) => Record<string, Value>;
  /** What the rest of the world does on this run, picked by the visitor. */
  behaviors: { value: string; label: string; setup?: (answers: Record<string, string>) => Setup; failures?: Scenario['failures'] }[];
  note: string;
  notes: { title: string; body: string }[];
}

export interface CaseStudy {
  business: Business;
  base: BaseSchema;
  demo: DemoForm;
  automations: Automation[];
}
