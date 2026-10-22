/**
 * Data model for the Asana showcase on /asana/.
 *
 * Each case is one sample Asana organization: its projects (sections,
 * custom fields, views), the intake form that feeds them, the portfolio and
 * goals leadership reads, and the automations (Asana's current name for
 * rules) that keep the work moving. An automation is described the way it
 * reads in Asana's builder: triggers, an optional Check if with paths, and
 * actions. The same data renders the builder card on the server and drives
 * the in-browser simulator, so what the page shows and what it runs cannot
 * drift apart.
 */

/** Approval tasks are pending until someone approves, requests changes or rejects. */
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export type FieldValue = string | number;

export interface Subtask {
  name: string;
  assignee?: string;
  /** Days after it was created. */
  dueIn?: number;
  done?: boolean;
}

export interface Comment {
  by: string;
  body: string;
  /** Minutes after Monday 00:00 of the sample week. */
  at: number;
}

/** One task as the simulator tracks it. */
export interface Task {
  name: string;
  project: string;
  section: string;
  assignee?: string;
  collaborators: string[];
  /** Day index, 0 = Monday of the sample week. Date only, as most Asana due dates are. */
  due?: number;
  completed: boolean;
  /** Set on approval tasks only. */
  approval?: ApprovalStatus;
  /** Milestone tasks show as diamonds on Timeline. */
  milestone?: boolean;
  fields: Record<string, FieldValue>;
  subtasks: Subtask[];
  comments: Comment[];
  /** Other projects the task is multi-homed in. */
  alsoIn: string[];
  /** Who submitted the form, when the task came from one. */
  requester?: string;
}

/* ---------- Automations ---------- */

/** What starts an automation. Names follow the builder's "What starts this workflow" card. */
export type Trigger =
  | { type: 'added' }
  | { type: 'moved'; section: string }
  | { type: 'field'; key: string; value?: FieldValue }
  | { type: 'completed' }
  | { type: 'approval'; status?: Exclude<ApprovalStatus, 'pending'> }
  | { type: 'assignee' }
  | { type: 'due_approaching'; days: number }
  | { type: 'overdue' };

export type Condition =
  | { type: 'field'; key: string; op: 'is' | 'is_not' | 'is_any' | 'set' | 'not_set' | 'gt' | 'lt'; value?: FieldValue | FieldValue[] }
  | { type: 'section'; is: string }
  | { type: 'approval'; is: Exclude<ApprovalStatus, 'pending'> }
  | { type: 'assigned'; is: boolean }
  | { type: 'due_set'; is: boolean };

export type Action =
  | { type: 'move'; section: string }
  | { type: 'assign'; user: string }
  | { type: 'unassign' }
  | { type: 'collaborators'; users: string[] }
  | { type: 'set_field'; key: string; value: FieldValue }
  | { type: 'due'; days: number }
  | { type: 'comment'; body: string }
  | { type: 'subtasks'; items: Subtask[] }
  | { type: 'create_task'; name: string; project: string; section?: string; assignee?: string; dueIn?: number }
  | { type: 'add_project'; project: string }
  | { type: 'complete' }
  | { type: 'slack'; channel: string; body: string };

export interface Path {
  id: string;
  /** The path's name in the builder, e.g. "Video request". */
  label: string;
  /** All must be true (the builder ANDs conditions on one path). Empty means "No other path is matching". */
  when: Condition[];
  actions: Action[];
}

export interface AutomationDef {
  /** Exactly as in the project's Automations list. */
  name: string;
  project: string;
  /** Any one of these starts it (up to 20). */
  triggers: Trigger[];
  /** Actions that run first, before any Check if. */
  actions: Action[];
  /** A Check if node with its paths; the last may be the "No other path is matching" else path. */
  paths?: Path[];
  settings: {
    /** General settings: "Can be triggered by other automations". */
    triggeredByOthers: boolean;
    /** Runs on tasks, or tasks and first-level subtasks. */
    runsOn: 'tasks' | 'tasks_and_subtasks';
    notes?: string[];
  };
}

/** Something a person does to the task during a sample run. */
export type ScenarioEvent = { at: number; by: string; note?: string } & (
  | { type: 'move'; section: string }
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'approval'; status: Exclude<ApprovalStatus, 'pending'> }
  | { type: 'complete' }
  | { type: 'assign'; user: string }
  | { type: 'due'; day: number }
  | { type: 'comment'; body: string }
);

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  /** Minutes after Monday 00:00 of the sample week. */
  start: number;
  /** The task as it is when the run starts. With `submitted`, a form creates it at `start`. */
  task: Partial<Task> & { name: string };
  submitted?: boolean;
  events: ScenarioEvent[];
  /** What a correct run ends with; checked by scripts/asana-check.mjs. */
  expect: { section?: string; assignee?: string; fields?: Record<string, FieldValue>; paths?: string[]; fired?: string[]; notFired?: string[]; completed?: boolean };
}

export interface Automation {
  id: string;
  number: string;
  name: string;
  kicker: string;
  tagline: string;
  problem: string;
  solution: string;
  evidence?: { text: string; source: string; href: string };
  automation: AutomationDef;
  scenarios: Scenario[];
  build: { title: string; body: string }[];
  edgeCases: { title: string; body: string }[];
  qa: string[];
  /** Asana features this build exercises. */
  features: string[];
}

/* ---------- The organization around the automations ---------- */

export type FieldType = 'single-select' | 'multi-select' | 'people' | 'number' | 'date' | 'text' | 'formula';

export interface CustomField {
  key: string;
  name: string;
  type: FieldType;
  options?: string[];
  note?: string;
}

export type ViewName = 'List' | 'Board' | 'Timeline' | 'Calendar' | 'Workflow' | 'Dashboard' | 'Overview' | 'Files' | 'Messages' | 'Workload';

/** A task drawn in the project views. Days count from Monday of the sample week. */
export interface SampleTask {
  name: string;
  section: string;
  assignee?: string;
  start?: number;
  due?: number;
  milestone?: boolean;
  approval?: ApprovalStatus;
  completed?: boolean;
  fields?: Record<string, FieldValue>;
  /** Names of tasks this one is waiting on. */
  blockedBy?: string[];
  subtasks?: number;
  /** Effort points for Workload. */
  effort?: number;
}

export interface Project {
  id: string;
  name: string;
  /** What the project is for, one line. */
  purpose: string;
  /** Made from, or saved as, a project template. */
  template?: string;
  sections: string[];
  fields: string[];
  views: ViewName[];
  /** The view the project opens on. */
  defaultView: ViewName;
  tasks: SampleTask[];
  /** Status in the portfolio. */
  status: 'On track' | 'At risk' | 'Off track' | 'On hold' | 'Complete';
  owner: string;
}

export interface FormQuestion {
  name: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'date' | 'textarea';
  required?: boolean;
  options?: string[];
  initial?: string;
  /** Custom field the answer maps to, or the task title. */
  maps?: { field: string } | 'title' | 'requester' | 'email';
  /** Branching: shown only when another single-select answer is one of these. */
  showIf?: { question: string; is: string[] };
  help?: string;
  half?: boolean;
}

export interface IntakeForm {
  project: string;
  title: string;
  description: string;
  /** Where submissions land and who gets them (form Settings tab). */
  section: string;
  defaultAssignee?: string;
  questions: FormQuestion[];
  confirmation: string;
  /** How the form is set up in Asana, for builders. */
  notes: { title: string; body: string }[];
  /** The notes in one plain sentence. */
  notesSummary: string;
}

export interface Goal {
  name: string;
  owner: string;
  /** 0–100. */
  progress: number;
  status: 'On track' | 'At risk' | 'Off track';
  /** How progress is measured: linked projects, a number, or sub-goals. */
  measure: string;
  period: string;
  children?: Goal[];
}

export interface StatusUpdate {
  title: string;
  author: string;
  date: string;
  status: 'On track' | 'At risk' | 'Off track';
  summary: string;
  sections: { heading: string; items: string[] }[];
}

export interface Person {
  key: string;
  name: string;
  role: string;
  /** Effort points per week for Workload. */
  capacity?: number;
}

export interface Org {
  id: string;
  name: string;
  industry: string;
  /** Plan tier, which decides the features in reach. */
  plan: string;
  size: string;
  blurb: string;
  intro: string;
  disclaimer: string;
  team: Person[];
  tint: { light: string; dark: string };
  /** One sentence per automation id: what it hands to the next. */
  handoff: Record<string, string>;
}

export interface CaseStudy {
  org: Org;
  fields: CustomField[];
  projects: Project[];
  form: IntakeForm;
  /** The task the form demo creates goes through this scenario's automations. */
  portfolio: { name: string; owner: string; note: string };
  goals: Goal[];
  status: StatusUpdate;
  workload: { note: string; weeks: string[]; load: Record<string, number[]> };
  automations: Automation[];
}
