/**
 * Data model for the GoHighLevel showcase on /ghl/.
 *
 * Each automation is described the way it is built in the GHL workflow
 * builder: triggers, then a list of steps (actions, waits, if/else branches
 * and goal events), plus the workflow settings. The same data renders the
 * canvas on the server and drives the in-browser simulator, so what the page
 * shows and what the simulator runs cannot drift apart.
 */

/** Things a contact (or the team) can do while a workflow is running. */
export type EventType =
  | 'reply'
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_showed'
  | 'appointment_noshow'
  | 'appointment_cancelled'
  | 'link_clicked'
  | 'email_opened'
  | 'call_answered'
  | 'payment'
  | 'opportunity_won'
  | 'opportunity_lost'
  | 'tag_added'
  | 'review_left'
  | 'survey_submitted'
  | 'review_clicked'
  | 'form_submitted'
  | 'invoice_paid'
  | 'payment_failed'
  | 'order_submitted'
  | 'document_signed'
  | 'product_started'
  | 'lesson_completed'
  | 'product_completed';

export interface ScenarioEvent {
  /** Minutes after the scenario starts. */
  at: number;
  type: EventType;
  /** Reply text, link name, tag name, review rating, survey score… */
  value?: string | number;
  /** For appointment_booked: minutes after scenario start the appointment begins. Its calendar goes in `value`. */
  appointmentAt?: number;
  /** Optional label shown in the log instead of the default. */
  label?: string;
  /** For replies: the channel they came in on. Default sms. */
  channel?: 'sms' | 'email';
  /** Writes the event's value to this custom field (e.g. a survey rating landing in "satisfaction"). */
  field?: string;
}

export type DndChannel = 'sms' | 'email' | 'calls';

export interface Opportunity {
  pipeline: string;
  stage: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  value?: number;
  name?: string;
}

export interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Shown only; the sample account runs on one time zone. */
  timezone?: string;
  /** Street address, for {{contact.address1}} and {{contact.full_address}}. */
  address?: string;
  source?: string;
  tags: string[];
  dnd: Partial<Record<DndChannel, boolean>>;
  /** Custom fields by key, e.g. { roof_age: 18 }. */
  fields: Record<string, string | number | boolean>;
  assignedTo?: string;
  opportunity?: Opportunity;
}

/** A condition inside an If/Else branch or a wait step. */
export type Condition =
  | { type: 'tag'; has: string }
  | { type: 'no_tag'; has: string }
  | { type: 'field'; key: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not_empty' | 'contains'; value?: string | number | boolean; label?: string }
  | { type: 'event'; event: EventType; value?: string | number; label?: string }
  | { type: 'reply_matches'; words: string[]; label?: string }
  | { type: 'dnd'; channel: DndChannel }
  | { type: 'opportunity'; stage?: string; status?: Opportunity['status'] }
  | { type: 'appointment'; status?: 'booked' | 'confirmed' | 'showed' | 'noshow' | 'cancelled'; calendar?: string }
  | { type: 'var'; key: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; value: string | number | boolean; label?: string }
  | { type: 'all'; of: Condition[]; label?: string }
  | { type: 'any'; of: Condition[]; label?: string }
  | { type: 'not'; of: Condition; label?: string };

/** State changes an action makes to the contact record. */
export interface Effect {
  addTags?: string[];
  removeTags?: string[];
  fields?: Record<string, string | number | boolean>;
  assignTo?: string;
  opportunity?: Partial<Opportunity>;
  dnd?: Partial<Record<DndChannel, boolean>>;
}

export type Channel = 'sms' | 'email' | 'internal' | 'slack' | 'voicemail';

export interface Message {
  channel: Channel;
  /** Email subject or notification title. */
  subject?: string;
  /** May contain merge fields such as {{contact.first_name}}. */
  body: string;
  /** Who receives it when it is not the contact, e.g. "Assigned user". */
  to?: string;
}

/** Runtime context a custom-code step or dynamic effect can read. */
export interface RunContext {
  contact: Contact;
  vars: Record<string, string | number | boolean>;
  /** Text of the most recent inbound reply, if any. */
  lastReply?: string;
  /** Simulated time, minutes after Monday 00:00 of the sample week. */
  now: number;
}

export type ActionKind =
  | 'send_sms'
  | 'send_email'
  | 'internal_notification'
  | 'add_tag'
  | 'remove_tag'
  | 'create_opportunity'
  | 'update_opportunity'
  | 'assign_user'
  | 'update_field'
  | 'add_note'
  | 'add_task'
  | 'webhook'
  | 'custom_code'
  | 'add_to_workflow'
  | 'remove_from_workflow'
  | 'review_request'
  | 'slack'
  | 'google_sheets'
  | 'dnd'
  | 'voicemail'
  | 'math'
  | 'drip'
  | 'appointment_status'
  | 'invoice'
  | 'charge'
  | 'course_access'
  | 'event_date'
  | 'follower'
  | 'ai';

export interface ActionNode {
  id: string;
  kind: 'action';
  action: ActionKind;
  /** The action's name in the GHL builder, e.g. "Send SMS". */
  title: string;
  /** The step name I gave it, e.g. "Instant reply". */
  label?: string;
  /** One-line description shown on the canvas card. */
  summary: string;
  message?: Message;
  effect?: Effect;
  /**
   * For custom code and AI steps: computes outputs at run time. Returned
   * `vars` are stored for later conditions; `effect` is applied to the contact.
   */
  run?: (ctx: RunContext) => {
    vars?: Record<string, string | number | boolean>;
    effect?: Effect;
    log?: string;
    /** Sets the date later appointment-relative waits count from (Event Start Date), absolute minutes. */
    eventStart?: number;
  };
  /** Source shown under the step: custom code, webhook payload… */
  code?: { language: 'javascript' | 'json'; source: string };
}

export interface WaitNode {
  id: string;
  kind: 'wait';
  title: string;
  label?: string;
  /**
   * time: fixed delay. event: wait for an event with a timeout; the outcome
   * is stored as `waited.<id>` = 'met' | 'timeout' and can branch via
   * `branches`. before_appointment: until N minutes before the appointment.
   */
  mode: 'time' | 'event' | 'before_appointment' | 'after_appointment';
  minutes?: number;
  event?: EventType;
  /** For event waits: only this link, tag or value counts (e.g. the 'replay' link), or any of several. */
  value?: string | number | (string | number)[];
  /** Minutes before/after the appointment start for appointment-relative waits. */
  offset?: number;
  summary: string;
  /**
   * Advance Window: after the delay, only resume on these days (0 = Monday)
   * between these hours ("HH:MM", contact's time zone).
   */
  window?: { start: string; end: string; days: number[] };
  /**
   * For appointment-relative waits: GHL's "If this date has already passed"
   * option. continue (default) moves on; skip_outbound skips Email, SMS, Call
   * and Voicemail steps until the next wait; exit removes the contact.
   */
  ifPassed?: 'continue' | 'skip_outbound' | 'exit';
  /** Optional two-way split after an event wait: met vs. timed out. */
  branches?: { met: { label: string; nodes: Step[] }; timeout: { label: string; nodes: Step[] } };
}

export interface IfElseNode {
  id: string;
  kind: 'ifelse';
  title: string;
  label?: string;
  branches: { label: string; when: Condition; nodes: Step[] }[];
  otherwise: { label: string; nodes: Step[] };
}

export interface GoalNode {
  id: string;
  kind: 'goal';
  title: string;
  label?: string;
  event: EventType;
  /** Event value the goal must match, e.g. a tag name. An array matches any of them. */
  value?: string | number | (string | number)[];
  summary: string;
  /**
   * If the contact reaches this step without meeting the goal: "Continue
   * anyway", "End this workflow" or "Wait until the goal is met" (bounded by
   * `waitMinutes` in the simulator, default 30 days).
   */
  ifNotMet: 'continue' | 'end' | 'wait';
  waitMinutes?: number;
}

/** GHL's Go To action: continue from another step in the same workflow. */
export interface GoToNode {
  id: string;
  kind: 'goto';
  title: string;
  /** Id of the step to continue from. */
  target: string;
  summary: string;
}

export interface EndNode {
  id: string;
  kind: 'end';
  title: string;
  summary?: string;
}

export type Step = ActionNode | WaitNode | IfElseNode | GoalNode | GoToNode | EndNode;

export interface Trigger {
  /** The trigger's name in GHL, e.g. "Form Submitted". */
  title: string;
  /** Filters as they read in the builder, e.g. "Form is Free Inspection". */
  filters: string[];
  /** Short name used in the simulator log. */
  label?: string;
}

export interface WorkflowSettings {
  allowReEntry: boolean;
  stopOnResponse: boolean;
  allowMultipleOpportunities?: boolean;
  /**
   * Communication steps (SMS, email, voicemail) outside the window are held
   * until it opens; internal steps run immediately. `days` uses 0 = Monday.
   * Times are 24-hour "HH:MM" in the contact's local time.
   */
  timeWindow?: { start: string; end: string; days: number[] };
  /**
   * Another workflow removes the contact from this one when this event
   * happens, e.g. booking an appointment fires 03, whose first step is
   * Remove from Workflow: 01.
   */
  exits?: { event: EventType; value?: string | number; by: string }[];
  timezone: 'contact' | 'account';
  senderName?: string;
  /** Anything else worth calling out, e.g. "Mark as read: off". */
  notes?: string[];
}

export interface Workflow {
  /** Exactly as it would appear in the workflow list, naming convention included. */
  name: string;
  folder: string;
  triggers: Trigger[];
  settings: WorkflowSettings;
  steps: Step[];
}

export interface Scenario {
  id: string;
  label: string;
  /** One line explaining what this test contact does. */
  summary: string;
  /** Minutes after Monday 00:00 of the sample week. */
  start: number;
  contact?: Partial<Contact>;
  events: ScenarioEvent[];
  /** Which trigger fires, by index into workflow.triggers. Default 0. */
  trigger?: number;
  /**
   * An appointment that already exists when the workflow starts (for
   * appointment triggers). `at` is minutes after the scenario starts.
   */
  appointment?: { at: number; calendar?: string };
  /** What a correct run ends with; checked by scripts/ghl-check.mjs. */
  expect: { outcome: 'completed' | 'stopped' | 'goal' | 'ended'; visits?: string[]; skips?: string[]; tags?: string[]; stage?: string };
}

export interface BuildStep {
  title: string;
  body: string;
}

export interface DataModel {
  customFields?: { name: string; key: string; type: string; note?: string }[];
  tags?: { name: string; note: string }[];
  pipeline?: { name: string; stages: string[] };
  customValues?: { name: string; key: string; value: string }[];
}

export interface Snippet {
  title: string;
  language: 'javascript' | 'json' | 'html' | 'css' | 'text';
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
  /** Optional sourced context, e.g. a lead-response study. */
  evidence?: { text: string; source: string; href: string };
  workflow: Workflow;
  scenarios: Scenario[];
  dataModel: DataModel;
  build: BuildStep[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  snippets?: Snippet[];
  /** GHL features this build exercises. */
  features: string[];
  /** Optional proof you can attach later: a Loom or screenshot of the real build. */
  proof?: { label: string; href: string }[];
}

/* ---------- Case studies: one sample sub-account per business ---------- */

/** Merge-field environment for a sub-account (location, users, custom values, trigger links). */
export interface SubAccountEnv {
  location: Record<string, string>;
  users: Record<string, { name: string; first_name: string; phone: string; email: string }>;
  customValues: Record<string, string>;
  triggerLinks?: Record<string, string>;
}

export interface Business {
  /** Used in URLs and ids, e.g. "roofing". */
  id: string;
  name: string;
  industry: string;
  area: string;
  /** One line for the case-study switcher. */
  blurb: string;
  /** A short paragraph introducing the client and what they needed. */
  intro: string;
  disclaimer: string;
  pipeline: { name: string; stages: string[] };
  team: { key: string; name: string; role: string }[];
  env: SubAccountEnv;
  sampleContact: Contact;
  /** Custom fields shown on the simulator's contact record, in order. */
  fieldLabels: Record<string, string>;
  /** Journey map: what each workflow hands to the next, by automation id. */
  handoff: Record<string, string>;
  /** Accent colours for the switcher card (light and dark theme). */
  tint: { light: string; dark: string };
}

export interface LandingField {
  name: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'select';
  required?: boolean;
  options?: string[];
  /** Pre-selected option for selects. */
  initial?: string;
  placeholder?: string;
  autocomplete?: string;
  /** Sit next to the following field on wide screens. */
  half?: boolean;
  /** Where the answer lands on the contact. */
  maps: 'firstName' | 'lastName' | 'phone' | 'email' | { field: string };
}

export interface LandingBehavior {
  value: string;
  label: string;
  /** Scenario of the fed automation whose label and settings to use. */
  scenario: string;
  /**
   * Events for the visitor's run. `start` is their submit time,
   * `firstText` the minutes until the first text can go out (quiet hours)
   * and `fields` the custom-field values the form wrote.
   */
  events: (ctx: { start: number; firstText: number; texts: boolean; fields: Record<string, string> }) => ScenarioEvent[];
}

export interface LandingPage {
  /** Shown in the fake browser bar. */
  url: string;
  brand: {
    name: string;
    logo: 'pine' | 'leaf' | 'peak';
    phone?: string;
    /** The page's own palette; it stays the same in dark mode, like a screenshot. */
    colors: { primary: string; primaryDark: string; bg: string; accent: string; accentInk: string; ink: string; muted: string; logo: string };
  };
  kicker: string;
  headline: string;
  sub: string;
  points: string[];
  formTitle: string;
  submitLabel: string;
  fields: LandingField[];
  consent: { transactional: string; marketing: string; fine: string };
  /** `{first}` is replaced with the visitor's first name. */
  thanks: { title: string; body: string; slots?: string[] };
  /** Automation id the form triggers. */
  feeds: string;
  /** Trigger index of that automation for this form. */
  trigger?: number;
  /** Sending window for the first text, so demo replies land after it. */
  textWindow?: { start: string; end: string; days: number[] };
  /** What the visitor should watch for in their own run, shown above the demo. */
  demoNote?: string;
  /** Shown after submit when the SMS box is ticked, if the fed workflow does not simply text them. */
  textsNote?: string;
  behaviors: LandingBehavior[];
  /** "What happens when you submit", in order. */
  steps: string[];
  /** How the page is built in the GHL funnel builder. */
  notes: { title: string; body: string }[];
}

export interface CaseStudy {
  business: Business;
  landing: LandingPage;
  automations: Automation[];
}
