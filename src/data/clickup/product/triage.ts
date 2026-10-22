import type { Process } from '@/lib/clickup/types';

const D = 1440;
const FORM = 'Report a bug';
export const S1 = 'S1: outage, nobody can work';
export const S2 = 'S2: major, no workaround';
export const S3 = 'S3: minor, has a workaround';
export const S4 = 'S4: cosmetic';

export const triage: Process = {
  id: 'triage',
  number: '01',
  name: 'Bug triage',
  kicker: 'Report to sprint or backlog',
  tagline: 'Support reports a bug once; its severity decides who sees it, how fast, and whether it jumps into the current sprint.',
  problem:
    'Support posted bugs in Slack threads, engineers missed half of them, and an outage once sat for 40 minutes because the on-call engineer was not in that channel. Vague reports bounced back and forth, and minor bugs cluttered the sprint.',
  solution:
    'Support files every bug with one ClickUp Form. Severity sets the priority and owner: an outage goes to the on-call engineer, into the current sprint and to #incidents; a major bug to the engineering lead within a day; minor ones within the week. A report missing detail goes back to the person who filed it, and returns to triage when they fill in the steps. Triaged bugs go into the sprint or the backlog by priority.',
  location: { space: 'Product', list: 'Bug Inbox' },
  statuses: [
    { name: 'New', group: 'not_started', color: '#87909e' },
    { name: 'Needs info', group: 'active', color: '#e16b16' },
    { name: 'Triaged', group: 'active', color: '#1090e0' },
    { name: 'In sprint', group: 'done', color: '#008844' },
    { name: 'Won’t fix', group: 'closed', color: '#656f7d' },
    { name: 'Duplicate', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Severity', type: 'Dropdown', options: [S1, S2, S3, S4], note: 'Chosen by support from the Severity guide; the engineering lead can change it.' },
    { name: 'Platform', type: 'Dropdown', options: ['Web', 'iOS', 'Android', 'API'] },
    { name: 'Customer plan', type: 'Dropdown', options: ['Free', 'Pro', 'Business'] },
    { name: 'Support ticket', type: 'URL' },
    { name: 'Steps to reproduce', type: 'Text area', note: 'Watched by an Automation: filling it in sends a Needs info bug back to triage.' },
  ],
  views: [
    { type: 'Form', name: FORM, note: 'For the support team, inside the Workspace. Each answer maps to a field.' },
    { type: 'List', name: 'Triage queue', note: 'Status New, sorted by priority then age. Ines works it twice a day.' },
    { type: 'Board', name: 'By severity', note: 'Grouped by Severity, to see at a glance what is burning.' },
  ],
  pieces: [
    { kind: 'Form', name: FORM, note: 'Summary, severity, platform, plan, ticket link and steps to reproduce.' },
    { kind: 'ClickApp', name: 'Sprints', note: 'The Sprint Folder in Product makes “Add to current Sprint” available as an Action.' },
    { kind: 'Doc', name: 'Severity guide', note: 'Linked from the Form’s Severity question.' },
  ],
  automations: [
    {
      id: 's1',
      name: 'S1 outage: on-call, sprint, incident channel',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Severity', op: 'eq', value: S1 }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'change_assignees', mode: 'reassign', to: ['arjun'] },
        { type: 'add_to_current_sprint' },
        { type: 'send_channel_message', channel: '#incidents', body: 'S1 reported by support: {{task.name}} ({{field.Platform}}). Arjun is on call and assigned.' },
      ],
    },
    {
      id: 's2',
      name: 'S2 major: engineering lead, one day',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Severity', op: 'eq', value: S2 }],
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'change_assignees', mode: 'reassign', to: ['ines'] },
        { type: 'change_due_date', daysAfter: 1 },
      ],
    },
    {
      id: 'minor',
      name: 'S3 and S4: triage this week',
      trigger: { type: 'task_created', form: FORM },
      conditions: [
        { type: 'field', field: 'Severity', op: 'neq', value: S1 },
        { type: 'field', field: 'Severity', op: 'neq', value: S2 },
      ],
      actions: [
        { type: 'change_priority', to: 'Normal' },
        { type: 'change_assignees', mode: 'reassign', to: ['ines'] },
        { type: 'change_due_date', daysAfter: 5 },
      ],
      note: 'Two “is not equal to” Conditions: one Condition with both values would mean “not equal to both at once”.',
    },
    {
      id: 'needs-info',
      name: 'Needs info: back to the reporter',
      trigger: { type: 'status_changes', to: ['Needs info'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: ['creator'] },
        { type: 'add_comment', body: '@{{task.creator}} engineering can’t reproduce this yet. Fill in Steps to reproduce (a screen recording helps) and it goes straight back to triage.' },
      ],
      note: 'The task creator is whoever submitted the Form inside the Workspace, so the right support agent is asked.',
    },
    {
      id: 'info-added',
      name: 'Steps added: back to triage',
      trigger: { type: 'custom_field_changes', field: 'Steps to reproduce' },
      conditions: [{ type: 'status', is: ['Needs info'] }],
      actions: [
        { type: 'change_status', to: 'New' },
        { type: 'change_assignees', mode: 'reassign', to: ['ines'] },
      ],
    },
    {
      id: 'to-sprint',
      name: 'Triaged and urgent: into this sprint',
      trigger: { type: 'status_changes', to: ['Triaged'] },
      conditions: [{ type: 'priority', is: ['Urgent', 'High'] }],
      actions: [
        { type: 'add_to_current_sprint' },
        { type: 'change_status', to: 'In sprint' },
        { type: 'add_comment', body: '@Owen Marsh pulled into the current sprint: {{task.name}}. Something else may need to move out.' },
      ],
    },
    {
      id: 'to-backlog',
      name: 'Triaged, not urgent: to the backlog',
      trigger: { type: 'status_changes', to: ['Triaged'] },
      conditions: [{ type: 'priority', is: ['Normal', 'Low'] }],
      actions: [{ type: 'move_to_list', list: 'Product / Backlog' }],
      note: 'Move to List takes it out of the Bug Inbox, which stays a list of things nobody has looked at yet.',
    },
  ],
  scenarios: [
    {
      id: 'outage',
      label: 'Invoices won’t send',
      summary: 'An S1 on Tuesday afternoon: sending any invoice fails on the web app. Arjun has it within seconds.',
      start: D + 845,
      created: 'form',
      task: { name: 'Send invoice fails with “Something went wrong”', creator: 'carla', fields: { Severity: S1, Platform: 'Web', 'Customer plan': 'Business', 'Support ticket': 'https://support.tallyway.example/t/48211', 'Steps to reproduce': 'Open any draft invoice, press Send. Error toast every time.' } },
      events: [
        { at: 10, type: 'status', to: 'Triaged', by: 'ines' },
        { at: 55, type: 'comment', body: 'Fixed: the email provider rotated an API key. Hotfix deployed; sends are going out.', by: 'arjun' },
      ],
      expect: { status: 'In sprint', fires: ['s1', 'to-sprint'], blocks: ['s2', 'minor', 'to-backlog'], priority: 'Urgent', assignees: ['arjun'] },
    },
    {
      id: 'vague',
      label: 'A vague report, sent back',
      summary: 'An S3 with no steps. Ines sends it back, Carla adds them, and it goes to the backlog.',
      start: 2 * D + 600,
      created: 'form',
      task: { name: 'PDF export cuts off the last line item', creator: 'carla', fields: { Severity: S3, Platform: 'iOS', 'Customer plan': 'Pro', 'Support ticket': 'https://support.tallyway.example/t/48302' } },
      events: [
        { at: 200, type: 'status', to: 'Needs info', by: 'ines' },
        { at: D - 40, type: 'field', field: 'Steps to reproduce', value: 'Invoice with 14+ line items on iPhone SE, Export PDF: line 14 is missing.', by: 'carla' },
        { at: D + 400, type: 'status', to: 'Triaged', by: 'ines' },
      ],
      expect: { status: 'Triaged', fires: ['minor', 'needs-info', 'info-added', 'to-backlog'], blocks: ['s1', 's2', 'to-sprint'], assignees: ['ines'] },
    },
    {
      id: 'major',
      label: 'A major bug with extra detail',
      summary: 'An S2 on Android. Support adds detail while it is still New, and Ines pulls it into the sprint.',
      start: 3 * D + 540,
      created: 'form',
      task: { name: 'Android app crashes when adding a client', creator: 'carla', fields: { Severity: S2, Platform: 'Android', 'Customer plan': 'Free', 'Support ticket': 'https://support.tallyway.example/t/48390' } },
      events: [
        { at: 30, type: 'field', field: 'Steps to reproduce', value: 'Android 15, Clients tab, tap +, type a name with an emoji: crash on save.', by: 'carla' },
        { at: 240, type: 'status', to: 'Triaged', by: 'ines' },
        { at: 245, type: 'assign', add: 'sofia', by: 'ines' },
      ],
      expect: { status: 'In sprint', fires: ['s2', 'to-sprint'], blocks: ['s1', 'minor', 'info-added', 'to-backlog'], priority: 'High' },
    },
  ],
  build: [
    { title: 'Severity as a Dropdown with words', body: 'Each option says what it means, so support picks consistently and the Conditions match exactly. The Severity guide Doc has examples.' },
    { title: 'Three routes, one Trigger', body: 'Three Automations on the Form’s Trigger, each with Severity Conditions. S3 and S4 share one rule with two “is not equal to” Conditions.' },
    { title: 'The on-call path', body: 'An S1 is Urgent, assigned to the on-call engineer, added to the current Sprint and posted to #incidents in one step.' },
    { title: 'A loop for missing detail', body: 'Needs info reassigns the task creator with a comment saying exactly what is missing. Filling in Steps to reproduce is the Trigger that sends it back to New, but only from Needs info.' },
    { title: 'Triage decides the destination', body: 'Moving a bug to Triaged sends it to the current sprint if it is Urgent or High, or to the Backlog List if not. The two Conditions never overlap.' },
  ],
  edgeCases: [
    { title: 'What if support picks the wrong severity?', body: 'Ines changes the field and the priority by hand during triage. The creation Automations don’t run again; the Triaged move uses the priority she set.' },
    { title: 'What if the on-call engineer changes?', body: 'The S1 Action names one person, so the rota change on Monday includes editing it. A Workload view of the on-call week makes a missed edit obvious.' },
    { title: 'What if a bug is a duplicate?', body: 'Ines links it to the original and moves it to Duplicate, a Closed status, so nothing else fires.' },
    { title: 'What if steps are added before anyone asks?', body: 'The Automation sees the field change but the status is New, so its Condition holds it back, as in the “extra detail” sample.' },
    { title: 'What if a bug is Triaged with no priority?', body: 'Neither destination Condition matches and it stays in the Bug Inbox, visible in the Triage queue view. Every Form bug gets a priority on creation, so only hand-made tasks can hit this.' },
  ],
  qa: [
    'A Form submission at each severity: priority, assignee, due date, and for S1 the sprint and #incidents message.',
    'Needs info reassigns the submitter, not whoever moved the status.',
    'Filling in steps on a Needs info bug returns it to New; on a New bug, nothing.',
    'Triaged with Urgent, High, Normal and Low priority: sprint or backlog, never both.',
  ],
  features: ['Forms', 'Sprints ClickApp', 'Add to current Sprint', 'Move to List', 'Change assignees to the task creator', 'Custom Field changes with Conditions', 'Priority Conditions', 'Chat channel messages'],
};
