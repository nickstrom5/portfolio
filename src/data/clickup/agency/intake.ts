import type { Process } from '@/lib/clickup/types';

const FORM = 'Start a project';

export const intake: Process = {
  id: 'intake',
  number: '01',
  name: 'Project intake',
  kicker: 'Form to first reply',
  tagline: 'Every request lands in one List, routed to the right lead and answered within a day.',
  problem:
    'Requests arrived by email, Instagram DMs and the contact form, and sat until someone happened to read them. A $70,000 rebrand waited four days once. Small jobs under the studio’s minimum got the same long discovery call as everything else.',
  solution:
    'One ClickUp Form on the website creates a task in Project Requests with the service, budget and timeline as Custom Fields. Automations give Sam a reply-by date, bring in the right lead, flag big budgets to Priya and small ones for a polite no, and raise the alarm if a request is still untouched a day later. When a deal is won, the kickoff task is created for delivery.',
  location: { space: 'Sales & Intake', list: 'Project Requests' },
  statuses: [
    { name: 'New request', group: 'not_started', color: '#87909e' },
    { name: 'Qualifying', group: 'active', color: '#1090e0' },
    { name: 'Discovery call', group: 'active', color: '#5f55ee' },
    { name: 'Proposal sent', group: 'active', color: '#e16b16' },
    { name: 'Won', group: 'done', color: '#008844' },
    { name: 'Not a fit', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Service', type: 'Dropdown', options: ['Website', 'Brand identity', 'Brand + website', 'Ongoing support'], note: 'Drives which lead follows the task.' },
    { name: 'Budget', type: 'Dropdown', options: ['Under $10k', '$10k–$25k', '$25k–$60k', '$60k+'], note: 'Ranges, not a number: people answer ranges honestly.' },
    { name: 'Timeline', type: 'Dropdown', options: ['Under 6 weeks', '6–12 weeks', 'Flexible'] },
    { name: 'Contact email', type: 'Email' },
    { name: 'Heard about us', type: 'Dropdown', options: ['Referral', 'Google', 'Dribbble', 'Instagram', 'Other'], note: 'Feeds the pipeline chart on the Dashboard.' },
    { name: 'Deal value', type: 'Money', private: true, note: 'Private field, filled by Sam once a proposal is out. Feeds the Signed revenue Goal.' },
  ],
  views: [
    { type: 'Form', name: FORM, note: 'Embedded on fernhill.example/start. Each question maps to a Custom Field; the company name becomes the task name.' },
    { type: 'Board', name: 'Pipeline', note: 'Grouped by status, cards show Service, Budget and the due date.' },
    { type: 'List', name: 'Needs a reply', note: 'Filtered to status New request, sorted by due date. Sam’s default view.' },
    { type: 'Table', name: 'All requests', note: 'Every field as a column, for the quarterly look at where work comes from.' },
  ],
  pieces: [
    { kind: 'Form', name: FORM, note: 'Conditional logic: the Timeline question only shows when Service is not Ongoing support.' },
    { kind: 'Template', name: 'Project kickoff', note: 'Task template applied to the kickoff task: contract, deposit invoice, kickoff call, access to hosting, as subtasks.' },
    { kind: 'Doc', name: 'Reply templates', note: 'The first-reply emails Sam sends, one per Service, plus the polite no for small budgets.' },
  ],
  automations: [
    {
      id: 'reply-by',
      name: 'Reply-by date and owner',
      trigger: { type: 'task_created', form: FORM },
      actions: [
        { type: 'change_due_date', daysAfter: 1 },
        { type: 'change_assignees', mode: 'reassign', to: ['sam'] },
      ],
      note: 'Sam answers every request, so the reply has one owner. The due date is the promise on the website: a reply within a day.',
    },
    {
      id: 'web-lead',
      name: 'Website work: bring in Maya',
      trigger: { type: 'task_created', form: FORM },
      conditions: [
        { type: 'field', field: 'Service', op: 'neq', value: 'Brand identity' },
        { type: 'field', field: 'Service', op: 'neq', value: 'Ongoing support' },
      ],
      actions: [
        { type: 'change_followers', add: ['maya'] },
        { type: 'add_comment', body: '@Maya Brooks new website request from {{task.name}}: {{field.Service}}, {{field.Budget}}, {{field.Timeline}}. Anything Sam should ask on the first call?' },
      ],
      note: 'Two “is not equal to” Conditions, because one Condition with two values would require the field to differ from both at once.',
    },
    {
      id: 'brand-lead',
      name: 'Brand work: bring in Theo',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Service', op: 'eq', value: 'Brand identity' }],
      actions: [
        { type: 'change_followers', add: ['theo'] },
        { type: 'add_comment', body: '@Theo Lindqvist new brand request from {{task.name}}: {{field.Budget}}, {{field.Timeline}}.' },
      ],
    },
    {
      id: 'big-budget',
      name: 'Big budgets to Priya',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Budget', op: 'eq', value: '$60k+' }],
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'change_followers', add: ['priya'] },
        { type: 'add_comment', body: '@Priya Nair $60k+ request from {{task.name}} ({{field.Service}}). Sam is on the first reply; join the discovery call?' },
      ],
    },
    {
      id: 'small-budget',
      name: 'Under the minimum: the polite no',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Budget', op: 'eq', value: 'Under $10k' }],
      actions: [
        { type: 'change_tags', add: ['small-budget'] },
        { type: 'add_comment', body: '@Sam Ortiz under our $10k minimum. Send the “Starter options” reply from the Reply templates Doc, with the freelancer referral list, then move it to Not a fit.' },
      ],
      note: 'The studio still answers: a fast, kind no keeps referrals coming.',
    },
    {
      id: 'no-reply',
      name: 'Still waiting after a day',
      trigger: { type: 'due_date_arrives' },
      conditions: [{ type: 'status', is: ['New request'] }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'add_comment', body: '@Sam Ortiz {{task.name}} has waited a day with no reply. Answer it first thing, or reassign it if you are out.' },
        { type: 'send_channel_message', channel: '#sales', body: 'Overdue first reply: {{task.name}} ({{field.Service}}, {{field.Budget}}). Due {{task.due}}.' },
      ],
      note: 'Due date arrives fires at 4 AM, so the nudge is waiting when Sam starts the day. The Status Condition keeps it quiet once anyone has replied.',
    },
    {
      id: 'won',
      name: 'Won: hand over to delivery',
      trigger: { type: 'status_changes', to: ['Won'] },
      actions: [
        { type: 'create_task', name: 'Kickoff: {{task.name}}', list: 'Client Delivery / Kickoffs', template: 'Project kickoff', relationship: 'Task relationship' },
        { type: 'send_channel_message', channel: '#studio', body: 'Signed: {{task.name}}, {{field.Service}}. Jo has the kickoff task.' },
        { type: 'change_due_date', remove: true },
      ],
      note: 'The kickoff task is linked back to the request, so delivery can read the whole sales history in one click.',
    },
    {
      id: 'not-a-fit',
      name: 'Not a fit: keep in touch',
      trigger: { type: 'status_changes', to: ['Not a fit'] },
      actions: [
        { type: 'change_tags', add: ['nurture-list'] },
        { type: 'change_due_date', remove: true },
      ],
      note: 'Removing the due date keeps closed requests out of the overdue filters and stops the day-later nudge from ever matching.',
    },
  ],
  scenarios: [
    {
      id: 'website-fast',
      label: 'Website, replied the same morning',
      summary: 'A $25k–$60k website request on Monday morning. Sam replies within two hours and the deal is signed that week.',
      start: 615,
      created: 'form',
      task: { name: 'Juniper Dental', fields: { Service: 'Website', Budget: '$25k–$60k', Timeline: '6–12 weeks', 'Contact email': 'dana@juniperdental.example', 'Heard about us': 'Referral' } },
      events: [
        { at: 125, type: 'status', to: 'Qualifying', by: 'sam' },
        { at: 1500, type: 'status', to: 'Discovery call', by: 'sam' },
        { at: 2 * 1440 + 380, type: 'status', to: 'Proposal sent', by: 'priya' },
        { at: 2 * 1440 + 400, type: 'field', field: 'Deal value', value: '$38,500', by: 'sam' },
        { at: 4 * 1440 + 60, type: 'status', to: 'Won', by: 'sam' },
      ],
      expect: { status: 'Won', fires: ['reply-by', 'web-lead', 'won'], blocks: ['brand-lead', 'big-budget', 'small-budget', 'no-reply'], assignees: ['sam'] },
    },
    {
      id: 'brand-friday',
      label: 'Big brand job, late Friday',
      summary: 'A $60k+ rebrand arrives at 4:40 PM on a Friday. Nobody looks until Monday.',
      start: 4 * 1440 + 1000,
      created: 'form',
      task: { name: 'Harbor Point Hotels', fields: { Service: 'Brand identity', Budget: '$60k+', Timeline: 'Flexible', 'Contact email': 'marketing@harborpoint.example', 'Heard about us': 'Google' } },
      events: [
        { at: 3 * 1440 - 1000 + 545, type: 'status', to: 'Qualifying', by: 'sam' },
        { at: 4 * 1440 - 1000 + 840, type: 'status', to: 'Discovery call', by: 'sam' },
        { at: 6 * 1440 - 1000 + 600, type: 'status', to: 'Proposal sent', by: 'priya' },
      ],
      expect: { status: 'Proposal sent', fires: ['reply-by', 'brand-lead', 'big-budget', 'no-reply'], blocks: ['web-lead', 'small-budget'], priority: 'Urgent' },
    },
    {
      id: 'small',
      label: 'Under the $10k minimum',
      summary: 'A landing page with a $6,000 budget. Sam sends the polite no with referrals within the hour.',
      start: 2 * 1440 + 690,
      created: 'form',
      task: { name: 'Northgate Yoga', fields: { Service: 'Website', Budget: 'Under $10k', Timeline: 'Under 6 weeks', 'Contact email': 'hello@northgateyoga.example', 'Heard about us': 'Instagram' } },
      events: [
        { at: 40, type: 'note', text: 'Sam sends the “Starter options” email with three freelancer referrals' },
        { at: 45, type: 'status', to: 'Not a fit', by: 'sam' },
      ],
      until: 2 * 1440,
      expect: { status: 'Not a fit', fires: ['reply-by', 'web-lead', 'small-budget', 'not-a-fit'], blocks: ['brand-lead', 'big-budget'], tags: ['small-budget', 'nurture-list'] },
    },
  ],
  build: [
    { title: 'Fields before the Form', body: 'Created the Custom Fields at the List level first, so the Form can map each question to a field and Automations can read them. Dropdowns, not free text, for anything an Automation checks.' },
    { title: 'The Form', body: 'Form view on Project Requests. The company name maps to the task name, the brief to the task description, everything else to its field. Conditional logic hides Timeline for support requests. Assignee left blank on the Form itself, so the Automation decides.' },
    { title: 'Automations at the List', body: 'All eight live on Project Requests, not the Space, so a new List in Sales & Intake does not inherit them by accident. Each is named for what it does.' },
    { title: 'Routing by Condition', body: 'One Trigger (Task or subtask created, from the Form) with five Automations, each with its own Conditions. ClickUp runs Automations with the same Trigger at the same time, so none of them depends on another’s result.' },
    { title: 'The safety net', body: 'Due date arrives with a Status Condition. It only does anything when the request is still New request, so it costs nothing on the days the team is on top of things.' },
    { title: 'Hand-off', body: 'Won creates the kickoff task in Client Delivery from a task template, linked to the request. Jo owns it from there.' },
  ],
  edgeCases: [
    { title: 'What if the request comes in on a Friday night?', body: '“1 day after trigger date” counts calendar days, so it is due Saturday and the nudge fires Saturday at 4 AM. It sits at the top of Sam’s Inbox on Monday, marked Urgent. If weekend replies mattered, a second Automation on Every… Monday could re-flag it.' },
    { title: 'What if someone picks “Brand + website”?', body: 'The website Condition matches it (it is neither Brand identity nor Ongoing support), so Maya follows it. Theo is added by hand on the discovery call; the comment says so.' },
    { title: 'What if the same company submits twice?', body: 'Two tasks. Sam merges them with ClickUp’s Merge tasks, which keeps both comment histories. An Automation cannot spot duplicates, so the Needs a reply view sorts by name to make them obvious.' },
    { title: 'What if a request is created by hand, not from the Form?', body: 'The Trigger is limited to tasks created from the Form, so a task Sam adds while on the phone is not re-routed. He sets the fields himself.' },
    { title: 'What if a won deal is reopened?', body: 'Moving it out of Won and back would create a second kickoff task. Jo archives the extra one; Won is rarely reopened, so a guard is not worth the complexity.' },
  ],
  qa: [
    'A test submission for each Service and each Budget, checking followers, priority and the comment on each.',
    'A request left in New request overnight: the 4 AM nudge, Urgent priority and the #sales message.',
    'A request moved to Qualifying before 4 AM: no nudge.',
    'Won creates exactly one kickoff task, from the template, linked back.',
    'Not a fit removes the due date and adds nurture-list.',
    'The Form as a logged-out visitor in a private window, on a phone.',
  ],
  features: ['Forms (with conditional logic)', 'Custom Fields: Dropdown, Email, Money (private)', 'Automations with Conditions', 'Due date arrives', 'Task templates', 'Task relationships', 'Chat channel messages', 'Board and Table views'],
};
