/**
 * Data model for the ClickUp showcase on /clickup/.
 *
 * Each case is one sample Workspace. Each process is one List (or a set of
 * Lists) with its statuses, Custom Fields, views and the ClickUp Automations
 * that run on it. Triggers, Conditions and Actions use ClickUp's own names,
 * checked against ClickUp's help center, so every Automation can be rebuilt
 * as written. The same data renders the page and drives the in-browser
 * simulator, so what the page shows and what the simulator runs cannot drift.
 */

/** ClickUp's four status groups. Done and Closed both count as finished. */
export type StatusGroup = 'not_started' | 'active' | 'done' | 'closed';

export interface Status {
  name: string;
  group: StatusGroup;
  /** Hex colour, as picked in the status editor. */
  color: string;
}

export type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';

export type FieldValue = string | number | boolean;

export interface CustomField {
  name: string;
  /** ClickUp's field type name: Dropdown, Labels, Text, Text area, Number, Money, Date, People, Email, URL, Checkbox, Formula, Relationship, Files. */
  type: string;
  options?: string[];
  note?: string;
  /** Private Custom Field (Business plan and up): hidden from guests. */
  private?: boolean;
}

export interface Subtask {
  name: string;
  done: boolean;
  assignee?: string;
}

export interface ChecklistItem {
  name: string;
  done: boolean;
}

/** A task the run follows. People are team keys from the Workspace. */
export interface Task {
  name: string;
  /** Home List. */
  list: string;
  /** Other Lists the task also lives in (Tasks in Multiple Lists). */
  alsoIn: string[];
  status: string;
  /** When the task entered its current status, for Time in Status. */
  statusSince: number;
  assignees: string[];
  followers: string[];
  creator?: string;
  priority?: Priority;
  tags: string[];
  /** Custom Fields by name. People fields hold a team key. */
  fields: Record<string, FieldValue>;
  /** Dates are stored as the start of their day, in minutes. */
  due?: number;
  start?: number;
  /** Time estimate in minutes. */
  estimate?: number;
  /** Time tracked in minutes. */
  tracked: number;
  subtasks: Subtask[];
  checklist: ChecklistItem[];
  /** Waiting-on dependencies: this task is blocked until each is done. */
  waitingOn: ChecklistItem[];
  /** Tasks this one is linked to (task relationships). */
  links: string[];
  sprint?: string;
  shared: { who: string; permission: string }[];
  archived?: boolean;
}

/* ---------- Automations: Trigger, Conditions, Actions ---------- */

/** Triggers by their names in ClickUp's Automation builder. */
export type Trigger =
  | { type: 'task_created'; /** Only tasks created from this Form. */ form?: string }
  | { type: 'status_changes'; from?: string[]; to?: string[] }
  | { type: 'custom_field_changes'; field: string; to?: FieldValue[] }
  | { type: 'priority_changes'; to?: Priority[] }
  | { type: 'tags_added'; tags: string[] }
  | { type: 'assignee_added' }
  | { type: 'comment_added' }
  | { type: 'due_date_arrives' }
  | { type: 'start_date_arrives' }
  | { type: 'due_date_changes' }
  | { type: 'date_before_after'; date: 'due' | 'start'; days: number; when: 'before' | 'after' }
  | { type: 'every'; /** 0 = Monday. */ days: number[]; /** "HH:MM", 24-hour. */ at: string }
  | { type: 'subtasks_resolved' }
  | { type: 'checklists_resolved' }
  | { type: 'unblocked' }
  | { type: 'time_tracked' };

/** Conditions are ANDed, as in ClickUp. */
export type Condition =
  | { type: 'status'; is: string[] }
  | { type: 'status_not'; is: string[] }
  | { type: 'field'; field: string; op: 'eq' | 'neq' | 'set' | 'not_set'; value?: FieldValue }
  | { type: 'priority'; is: (Priority | 'none')[] }
  | { type: 'tag'; has?: string[]; lacks?: string[] }
  | { type: 'assignee'; is: string | 'none' }
  | { type: 'time_in_status'; status: string; moreThanMinutes: number };

/** Who an assignee or follower change points at. */
export type PersonRef = string | { field: string } | 'creator' | 'triggered_by';

export type Action =
  | { type: 'change_status'; to: string }
  | { type: 'change_assignees'; mode: 'add' | 'reassign' | 'remove_all'; to?: PersonRef[] }
  | { type: 'change_priority'; to: Priority | null }
  | { type: 'change_due_date'; daysAfter?: number; remove?: boolean }
  | { type: 'change_start_date'; daysAfter?: number }
  | { type: 'change_tags'; add?: string[]; remove?: string[] }
  | { type: 'change_followers'; add: PersonRef[] }
  | { type: 'add_comment'; body: string }
  | { type: 'apply_template'; template: string; subtasks?: string[]; checklist?: string[] }
  | { type: 'create_subtask'; name: string; assignee?: string }
  | { type: 'create_task'; name: string; list: string; template?: string; relationship?: 'Waiting on' | 'Blocking' | 'Task relationship' }
  | { type: 'add_to_list'; list: string }
  | { type: 'move_to_list'; list: string }
  | { type: 'update_custom_field'; field: string; value?: FieldValue; onTriggerDate?: boolean }
  | { type: 'estimate_time'; minutes: number }
  | { type: 'add_to_current_sprint' }
  | { type: 'send_channel_message'; channel: string; body: string }
  | { type: 'call_webhook'; url: string; payload: string }
  | { type: 'share_task'; with: string; permission: 'View only' | 'Comment' | 'Edit' | 'Full' }
  | { type: 'archive_task' };

export interface CuAutomation {
  id: string;
  /** My name for it, shown above the rule (ClickUp lets you name Automations). */
  name: string;
  /** Tasks, subtasks or both, as set on the trigger. Default tasks. */
  appliesTo?: 'tasks' | 'subtasks' | 'both';
  trigger: Trigger;
  conditions?: Condition[];
  actions: Action[];
  /** One line on why it is set up this way. */
  note?: string;
}

/* ---------- Sample tasks ---------- */

/** What people (not Automations) do to the task during a run. */
export type ScenarioEvent = { at: number; by?: string; label?: string } & (
  | { type: 'status'; to: string }
  | { type: 'field'; field: string; value: FieldValue }
  | { type: 'tag'; add?: string[]; remove?: string[] }
  | { type: 'priority'; to: Priority }
  | { type: 'assign'; add: string }
  | { type: 'comment'; body: string }
  | { type: 'subtask_done'; name: string }
  | { type: 'checklist_done'; name: string }
  | { type: 'blocker_done'; name: string }
  /** Due date moved to this many days after the run's first day. */
  | { type: 'due'; day: number }
  | { type: 'track_time'; minutes: number }
  /** Something outside ClickUp, for the story (an email, a call). No state change. */
  | { type: 'note'; text: string }
);

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  /** Minutes after Monday 00:00 of the sample week. */
  start: number;
  /** How the task appears at the start: a Form submission, created by hand, or already in the List. */
  created?: 'form' | 'manual';
  /** The task as it is at the start (or as created). Dates are days after the run's first day. */
  task: Partial<Omit<Task, 'due' | 'start'>> & { name: string; dueDay?: number; startDay?: number };
  events: ScenarioEvent[];
  /** Run until this many minutes after the start. Default: one day after the last event or date. */
  until?: number;
  /** What a correct run ends with; checked by scripts/clickup-check.mjs. */
  expect: {
    status: string;
    fires?: string[];
    blocks?: string[];
    tags?: string[];
    assignees?: string[];
    priority?: Priority | 'none';
  };
}

/* ---------- Process (one List and its Automations) ---------- */

export interface View {
  type: 'List' | 'Board' | 'Gantt' | 'Calendar' | 'Workload' | 'Table' | 'Form' | 'Timeline' | 'Doc' | 'Activity';
  name: string;
  note: string;
}

export interface Snippet {
  title: string;
  language: 'json' | 'text';
  code: string;
  note?: string;
}

export interface Process {
  id: string;
  number: string;
  name: string;
  kicker: string;
  tagline: string;
  /** The problem, in the client's words. */
  problem: string;
  /** What the setup does about it. */
  solution: string;
  /** Space / Folder / List the process lives in. */
  location: { space: string; folder?: string; list: string };
  statuses: Status[];
  fields: CustomField[];
  views: View[];
  /** Task templates, recurring tasks, Docs and other pieces that are not Automations. */
  pieces: { kind: 'Template' | 'Recurring task' | 'Doc' | 'Form' | 'ClickApp' | 'Dependency' | 'Sprint'; name: string; note: string }[];
  automations: CuAutomation[];
  scenarios: Scenario[];
  build: { title: string; body: string }[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  snippets?: Snippet[];
  /** ClickUp features this build uses. */
  features: string[];
}

/* ---------- Workspace (one case study) ---------- */

export interface TeamMember {
  key: string;
  name: string;
  role: string;
  /** A guest (client, resident, vendor): limited access, shown with a tag. */
  guest?: boolean;
}

export interface Workspace {
  /** Used in URLs and ids, e.g. "agency". */
  id: string;
  name: string;
  industry: string;
  area: string;
  blurb: string;
  intro: string;
  disclaimer: string;
  team: TeamMember[];
  /** The Workspace sidebar: Spaces, Folders and Lists, with the process ids that live in each List. */
  hierarchy: { space: string; note: string; folders: { name: string; lists: string[] }[]; lists: string[] }[];
  dashboard: { name: string; note: string; widgets: { title: string; type: string; note: string }[] };
  goals: { name: string; note: string; targets: { name: string; type: 'Number' | 'True/False' | 'Currency' | 'Task'; target: string }[] }[];
  docs: { name: string; note: string }[];
  /** Journey map: what each process hands to the next, by process id. */
  handoff: Record<string, string>;
  tint: { light: string; dark: string };
}

/* ---------- The Form demo ---------- */

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
  initial?: string;
  placeholder?: string;
  autocomplete?: string;
  /** Where the answer lands on the task: the task name or a Custom Field. */
  maps: 'name' | 'description' | { field: string };
}

export interface FormDemo {
  /** The Form's name in Form view. */
  title: string;
  description: string;
  /** Shown in the fake browser bar (a ClickUp Form's share link). */
  url: string;
  fields: FormField[];
  submitLabel: string;
  thanks: string;
  /** Process id the Form creates tasks in. */
  feeds: string;
  /** What the visitor can choose to happen next: each runs one of the fed process's scenarios with their answers. */
  behaviors: { value: string; label: string; scenario: string }[];
  /** "What happens when you submit", in order. */
  steps: string[];
  notes: { title: string; body: string }[];
}

export interface CaseStudy {
  workspace: Workspace;
  form: FormDemo;
  processes: Process[];
}
