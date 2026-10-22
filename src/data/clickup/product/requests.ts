import type { Process } from '@/lib/clickup/types';

const D = 1440;

export const requests: Process = {
  id: 'requests',
  number: '04',
  name: 'Feature requests',
  kicker: 'Customer ask to answer',
  tagline: 'Every request gets a decision within two weeks, high demand reaches the head of product, and support hears the outcome to tell customers.',
  problem:
    'Feature requests lived in support tickets and a shared doc. Popular ones were invisible because nobody counted, decisions were never sent back to support, and customers who asked for something that shipped never found out.',
  solution:
    'Support logs each distinct request once, with a running count of customers who asked. New requests go to the head of product with a two-week decision date. High demand raises the priority. Planned creates the build task in the backlog, shipped and declined both tell support, and a request still in the Inbox after two weeks is flagged.',
  location: { space: 'Product', list: 'Feature Requests' },
  statuses: [
    { name: 'Inbox', group: 'not_started', color: '#87909e' },
    { name: 'Under review', group: 'active', color: '#1090e0' },
    { name: 'Planned', group: 'active', color: '#5f55ee' },
    { name: 'Shipped', group: 'done', color: '#008844' },
    { name: 'Declined', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Theme', type: 'Dropdown', options: ['Invoicing', 'Payments', 'Reports', 'Integrations', 'Mobile'] },
    { name: 'Customer requests', type: 'Number', note: 'Support adds one each time a customer asks; the ticket links go in a comment.' },
    { name: 'Demand', type: 'Dropdown', options: ['Low', 'Medium', 'High'], note: 'Carla’s judgment from the count, the plans asking and how often it comes up in sales calls.' },
    { name: 'Largest plan asking', type: 'Dropdown', options: ['Free', 'Pro', 'Business'] },
  ],
  views: [
    { type: 'Table', name: 'Top requests', note: 'Sorted by Customer requests, grouped by Theme. Opened at quarterly planning.' },
    { type: 'Board', name: 'Decisions', note: 'By status: what is waiting for a decision and what has been decided.' },
  ],
  pieces: [
    { kind: 'Doc', name: 'Support reply macros', note: 'The “planned”, “shipped” and “not right now” replies support sends to customers.' },
    { kind: 'Template', name: 'Task template: Feature request', note: 'Problem, who asked, workarounds today, as description sections.' },
  ],
  automations: [
    {
      id: 'new',
      name: 'New request: a decision in two weeks',
      trigger: { type: 'task_created' },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: ['owen'] },
        { type: 'change_due_date', daysAfter: 14 },
      ],
    },
    {
      id: 'demand',
      name: 'High demand: raise it',
      trigger: { type: 'custom_field_changes', field: 'Demand', to: ['High'] },
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'add_comment', body: '@Owen Marsh demand for {{task.name}} is now High ({{field.Customer requests}} customers, up to {{field.Largest plan asking}}).' },
      ],
    },
    {
      id: 'planned',
      name: 'Planned: create the build task',
      trigger: { type: 'status_changes', to: ['Planned'] },
      actions: [
        { type: 'create_task', name: 'Build: {{task.name}}', list: 'Product / Backlog', template: 'Engineering ticket', relationship: 'Task relationship' },
        { type: 'add_comment', body: '@Carla Reyes planned. Use the “planned” reply for the customers linked above; no dates promised.' },
      ],
    },
    {
      id: 'shipped',
      name: 'Shipped: tell the customers who asked',
      trigger: { type: 'status_changes', to: ['Shipped'] },
      actions: [
        { type: 'send_channel_message', channel: '#customer-success', body: 'Shipped: {{task.name}}. {{field.Customer requests}} customers asked for it; their tickets are linked on the request.' },
        { type: 'add_comment', body: '@Carla Reyes shipped. Send the “shipped” reply to everyone linked above.' },
      ],
    },
    {
      id: 'declined',
      name: 'Declined: support explains why',
      trigger: { type: 'status_changes', to: ['Declined'] },
      actions: [
        { type: 'change_due_date', remove: true },
        { type: 'add_comment', body: '@Carla Reyes declined; the reason is in Owen’s comment above. Use the “not right now” reply.' },
      ],
    },
    {
      id: 'overdue',
      name: 'Two weeks in the Inbox',
      trigger: { type: 'due_date_arrives' },
      conditions: [{ type: 'status', is: ['Inbox'] }],
      actions: [{ type: 'add_comment', body: '@Owen Marsh {{task.name}} has waited two weeks for a decision. Review, plan or decline it this week.' }],
    },
  ],
  scenarios: [
    {
      id: 'popular',
      label: 'A popular request ships',
      summary: 'Partial payments. Demand climbs to High, Owen plans it and it ships in the next release.',
      start: 600,
      created: 'manual',
      task: { name: 'Let clients pay an invoice in parts', creator: 'carla', fields: { Theme: 'Payments', 'Customer requests': 23, Demand: 'Medium', 'Largest plan asking': 'Business' } },
      events: [
        { at: D + 120, type: 'field', field: 'Customer requests', value: 31, by: 'carla' },
        { at: D + 125, type: 'field', field: 'Demand', value: 'High', by: 'carla' },
        { at: 2 * D + 300, type: 'status', to: 'Under review', by: 'owen' },
        { at: 3 * D + 240, type: 'status', to: 'Planned', by: 'owen' },
        { at: 12 * D + 60, type: 'status', to: 'Shipped', by: 'owen' },
      ],
      until: 15 * D,
      expect: { status: 'Shipped', fires: ['new', 'demand', 'planned', 'shipped'], blocks: ['overdue'], priority: 'High' },
    },
    {
      id: 'ignored',
      label: 'Waits, then declined',
      summary: 'A niche request sits in the Inbox for two weeks. The reminder fires; Owen declines it with a reason.',
      start: 600,
      created: 'manual',
      task: { name: 'Invoices in Klingon', creator: 'carla', fields: { Theme: 'Invoicing', 'Customer requests': 1, Demand: 'Low', 'Largest plan asking': 'Free' } },
      events: [
        { at: 14 * D + 120, type: 'comment', body: 'Not now: one request in a year, and translations need a vendor we don’t have.', by: 'owen' },
        { at: 14 * D + 125, type: 'status', to: 'Declined', by: 'owen' },
      ],
      expect: { status: 'Declined', fires: ['new', 'overdue', 'declined'] },
    },
  ],
  build: [
    { title: 'One task per request, not per customer', body: 'Support searches before creating, then raises the Customer requests count and links the ticket in a comment. The Table view then ranks by real demand.' },
    { title: 'A decision date on everything', body: 'Every new request gets Owen and a two-week due date. Due date arrives with an Inbox Condition flags only the ones nobody has looked at.' },
    { title: 'Demand as a signal', body: 'Demand changing to High is a Custom Field changes Trigger with a value filter: the priority goes up and Owen sees the numbers in the comment.' },
    { title: 'Decisions go back to support', body: 'Planned, Shipped and Declined each tell Carla which reply to send, and Planned creates the linked build task in the Backlog from the engineering template.' },
  ],
  edgeCases: [
    { title: 'What if demand is High from the start?', body: 'Custom Field changes has an Advanced option for which tasks it watches: new ones, updates, or both. It is set to both, so a request logged with Demand already High is raised the moment it is created.' },
    { title: 'What if a declined request comes back?', body: 'Owen moves it back to Inbox and sets a new due date. The history of why it was declined stays in the comments.' },
    { title: 'What if the shipped version only covers part of the request?', body: 'Owen splits it: the rest becomes a new request, linked, so customers asking for the remaining part are not told it shipped.' },
  ],
  qa: [
    'A new request: Owen assigned, due in 14 days.',
    'Demand set to Medium does nothing; to High raises priority and comments with the count.',
    'Planned creates exactly one linked build task in Backlog.',
    'A request left in Inbox for two weeks: one comment. One under review: none.',
  ],
  features: ['Task or subtask created', 'Custom Field changes with a value', 'Number and Dropdown fields', 'Create a task from a template', 'Due date arrives with Conditions', 'Table view sorting', 'Chat channel messages'],
};
