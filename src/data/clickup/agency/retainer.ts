import type { Process } from '@/lib/clickup/types';

const D = 1440;
const FORM = 'Retainer request';

export const retainer: Process = {
  id: 'retainer',
  number: '04',
  name: 'Retainer requests',
  kicker: 'Small asks, weekly rhythm',
  tagline: 'Retainer clients send small jobs through a Form; bugs jump the queue, everything else is planned on Monday.',
  problem:
    'Four retainer clients sent “quick changes” by text, email and Slack at all hours. Designers were interrupted mid-project, small jobs were forgotten, and at month end nobody knew how many hours each client had used.',
  solution:
    'A second Form, for retainer clients only, creates a task in Retainer Requests with a two-hour estimate and a five-day due date. Bugs go straight to the developer. Everything else waits for Monday planning, where a scheduled Automation moves the week’s requests in. Starting a timer moves a task to In progress, so time tracking and status agree, and the Dashboard shows hours per client.',
  location: { space: 'Studio Ops', list: 'Retainer Requests' },
  statuses: [
    { name: 'Requested', group: 'not_started', color: '#87909e' },
    { name: 'Scheduled', group: 'active', color: '#1090e0' },
    { name: 'In progress', group: 'active', color: '#5f55ee' },
    { name: 'Client check', group: 'active', color: '#e16b16' },
    { name: 'Done', group: 'done', color: '#008844' },
    { name: 'Cancelled', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Client', type: 'Dropdown', options: ['Juniper Dental', 'Copperleaf Bakery', 'Alder & Pine Law', 'Harbor Point Hotels'], note: 'Groups time tracked per client on the Dashboard.' },
    { name: 'Request type', type: 'Dropdown', options: ['Text or image change', 'New page or section', 'Bug: something is broken', 'Other'] },
    { name: 'Page URL', type: 'URL' },
    { name: 'Requested by', type: 'Email' },
  ],
  views: [
    { type: 'Form', name: FORM, note: 'Linked from each retainer client’s welcome email. Not public: shared only with retainer clients.' },
    { type: 'Board', name: 'This week', note: 'Scheduled, In progress and Client check, grouped by assignee.' },
    { type: 'Table', name: 'Hours by client', note: 'Grouped by Client, with time tracked summed per group. The month-end invoice comes from here.' },
  ],
  pieces: [
    { kind: 'Form', name: FORM, note: 'Client, request type, page URL and a description. The Client dropdown also maps the task to the right Dashboard group.' },
    { kind: 'ClickApp', name: 'Time Tracking', note: 'On, with time estimates. Team members start the timer from the task.' },
    { kind: 'Recurring task', name: 'Retainer hours report', note: 'A recurring task on the last weekday of each month for Sam: export the Hours by client table and send the summaries.' },
  ],
  automations: [
    {
      id: 'estimate',
      name: 'New request: estimate and due date',
      trigger: { type: 'task_created', form: FORM },
      actions: [
        { type: 'estimate_time', minutes: 120 },
        { type: 'change_due_date', daysAfter: 5 },
      ],
      note: 'Two hours is the default size of a retainer job. The designer adjusts it once they look.',
    },
    {
      id: 'bug',
      name: 'Bugs jump the queue',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Request type', op: 'eq', value: 'Bug: something is broken' }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'change_status', to: 'Scheduled' },
        { type: 'change_assignees', mode: 'reassign', to: ['kenji'] },
        { type: 'add_comment', body: '@Kenji Ward bug report from {{field.Client}}: {{task.name}}. Please look today.' },
      ],
    },
    {
      id: 'monday',
      name: 'Monday planning: pull in the week’s requests',
      trigger: { type: 'every', days: [0], at: '09:00' },
      conditions: [{ type: 'status', is: ['Requested'] }],
      actions: [
        { type: 'change_status', to: 'Scheduled' },
        { type: 'change_assignees', mode: 'add', to: ['sam'] },
        { type: 'add_comment', body: '@Sam Ortiz scheduled for this week: {{task.name}} ({{field.Client}}). Hand it to a designer in the planning meeting.' },
      ],
      note: 'Every… applies to every open task in the List; the Status Condition narrows it to new requests only.',
    },
    {
      id: 'timer',
      name: 'Timer started: in progress',
      trigger: { type: 'time_tracked' },
      conditions: [{ type: 'status', is: ['Scheduled'] }],
      actions: [{ type: 'change_status', to: 'In progress' }],
      note: 'Tracking time is the signal that work began, so nobody has to remember to move the card.',
    },
    {
      id: 'done',
      name: 'Done: clear the date and post it',
      trigger: { type: 'status_changes', to: ['Done'] },
      actions: [
        { type: 'change_due_date', remove: true },
        { type: 'send_channel_message', channel: '#retainers', body: 'Done for {{field.Client}}: {{task.name}}.' },
      ],
    },
  ],
  scenarios: [
    {
      id: 'thursday',
      label: 'A text change on Thursday',
      summary: 'A new photo for the team page, sent Thursday afternoon. It waits for Monday planning, then takes Lena an hour.',
      start: 3 * D + 840,
      created: 'form',
      task: { name: 'Swap the team photo on the About page', fields: { Client: 'Juniper Dental', 'Request type': 'Text or image change', 'Page URL': 'https://juniperdental.example/about', 'Requested by': 'dana@juniperdental.example' } },
      events: [
        { at: 4 * D - 840 + 600, type: 'assign', add: 'lena', by: 'sam' },
        { at: 4 * D - 840 + 660, type: 'track_time', minutes: 50, by: 'lena' },
        { at: 4 * D - 840 + 720, type: 'status', to: 'Done', by: 'lena' },
      ],
      expect: { status: 'Done', fires: ['estimate', 'monday', 'timer', 'done'], blocks: ['bug'] },
    },
    {
      id: 'bug',
      label: 'A broken booking form',
      summary: 'A bug report on Tuesday morning goes straight to Kenji, marked Urgent, and is fixed before lunch.',
      start: D + 600,
      created: 'form',
      task: { name: 'Booking form shows an error on submit', fields: { Client: 'Copperleaf Bakery', 'Request type': 'Bug: something is broken', 'Page URL': 'https://copperleaf.example/order', 'Requested by': 'owner@copperleaf.example' } },
      events: [
        { at: 40, type: 'track_time', minutes: 45, by: 'kenji' },
        { at: 95, type: 'comment', body: 'Fixed: the form’s spam filter was rejecting every submission. Tested from a phone.', by: 'kenji' },
        { at: 100, type: 'status', to: 'Done', by: 'kenji' },
      ],
      until: 7 * D,
      expect: { status: 'Done', fires: ['estimate', 'bug', 'timer', 'done'], priority: 'Urgent', assignees: ['kenji'] },
    },
    {
      id: 'monday-late',
      label: 'Sent just after Monday planning',
      summary: 'A new section request lands at 10:30 on Monday. Sam pulls it in by hand, so next Monday’s run leaves it alone.',
      start: 630,
      created: 'form',
      task: { name: 'Add a catering section to the menu page', fields: { Client: 'Copperleaf Bakery', 'Request type': 'New page or section', 'Page URL': 'https://copperleaf.example/menu', 'Requested by': 'owner@copperleaf.example' } },
      events: [
        { at: 210, type: 'status', to: 'In progress', by: 'sam' },
        { at: 215, type: 'assign', add: 'lena', by: 'sam' },
        { at: D + 30, type: 'track_time', minutes: 150, by: 'lena' },
        { at: 2 * D + 120, type: 'status', to: 'Client check', by: 'lena' },
      ],
      until: 7 * D + 120,
      expect: { status: 'Client check', fires: ['estimate'], blocks: ['bug', 'monday', 'timer'] },
    },
  ],
  build: [
    { title: 'A separate Form for retainer clients', body: 'Different questions from the public Form, and its own List, so retainer work never mixes with new business. The Form link goes only to retainer clients.' },
    { title: 'Defaults on arrival', body: 'Every request gets a two-hour estimate and a five-day due date, so the Workload view and overdue filters work from the first minute.' },
    { title: 'A weekly rhythm with Every…', body: 'Every Monday at 9:00, a scheduled Automation moves anything still Requested to Scheduled and adds Sam. It runs on every open task in the List; the Status Condition makes it touch only new ones.' },
    { title: 'Time tracking drives status', body: 'The Time tracked Trigger with a Scheduled Condition moves a task to In progress when someone starts work. Tasks already moved by hand are left alone.' },
    { title: 'Hours per client', body: 'The Client dropdown groups the Table view and the Dashboard’s Time Reporting card, which is what the month-end summary is built from.' },
  ],
  edgeCases: [
    { title: 'What if a client sends a bug on Saturday?', body: 'It is Urgent and assigned to Kenji straight away; the comment notifies him. Weekend cover is a business decision, not an Automation: the Form’s confirmation says bugs are fixed on the next business day.' },
    { title: 'What if a request arrives at 9:05 on Monday?', body: 'It missed the 9:00 run, so it waits a week unless Sam pulls it in by hand during planning, as in the “just after” sample.' },
    { title: 'What if someone tracks time on a task still in Requested?', body: 'The Condition only looks for Scheduled, so nothing moves. The task shows up in the Monday run, which schedules it with the time already logged.' },
    { title: 'What if a client goes over their monthly hours?', body: 'The Hours by client table shows it; Sam raises it in the monthly summary. ClickUp Automations can’t sum time across tasks, so the check is a person reading a report.' },
  ],
  qa: [
    'A Form submission of each request type: estimate, due date, and for bugs the priority, status, assignee and comment.',
    'The Every… Automation on a test List with tasks in each status: only Requested ones move.',
    'Starting a timer on a Scheduled task, and on an In progress one.',
    'Done clears the due date and posts to #retainers.',
  ],
  features: ['Forms', 'Every… (scheduled) Trigger', 'Time tracked Trigger', 'Estimate time', 'Time Tracking ClickApp', 'Recurring tasks', 'Table view with grouping', 'Chat channel messages'],
};
