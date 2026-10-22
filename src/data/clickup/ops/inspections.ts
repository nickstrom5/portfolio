import type { Process } from '@/lib/clickup/types';

const D = 1440;
const checklist = ['Exit signs and emergency lights work', 'Fire extinguishers charged and tagged', 'Stairwells clear', 'Lobby and hallway lights work', 'Laundry room clean, machines working', 'Trash area clean, lids closed'];
const task = (startDay: number) => ({
  name: 'Monthly common-area walk: Maple Court',
  status: 'Scheduled',
  assignees: ['rosa'],
  startDay,
  dueDay: 4,
  checklist: checklist.map((name) => ({ name, done: false })),
  fields: { Property: 'Maple Court', 'Inspection type': 'Common-area walk', Inspector: 'ray' },
});

export const inspections: Process = {
  id: 'inspections',
  number: '03',
  name: 'Recurring inspections',
  kicker: 'SOPs that schedule themselves',
  tagline: 'Monthly and quarterly inspections recreate themselves, arrive with the checklist, and turn any failed item into a work order.',
  problem:
    'Monthly walk-throughs and quarterly fire checks were on a wall calendar. Some months they were skipped; when they happened, problems were written on paper and often never became repair jobs. The insurer asked for proof of inspections and there wasn’t any.',
  solution:
    'Each inspection is a recurring task that creates the next one when it is finished, with the checklist from the Inspections SOP built in. On its start date it goes to the inspector with a link to the SOP. Any failed item gets a tag, which creates a linked work order in Maintenance. A clean checklist marks it Passed and records the date. An inspection still open on its due date alerts the team.',
  location: { space: 'Operations', folder: 'Compliance', list: 'Inspections' },
  statuses: [
    { name: 'Scheduled', group: 'not_started', color: '#87909e' },
    { name: 'Due this week', group: 'active', color: '#1090e0' },
    { name: 'In progress', group: 'active', color: '#5f55ee' },
    { name: 'Issues found', group: 'active', color: '#d33d44' },
    { name: 'Passed', group: 'done', color: '#008844' },
    { name: 'Closed', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Property', type: 'Dropdown', options: ['Cedar Row Flats', 'Maple Court', 'The Linden', 'Birch Commons'] },
    { name: 'Inspection type', type: 'Dropdown', options: ['Common-area walk', 'Fire extinguishers', 'Smoke detectors', 'Roof and gutters'] },
    { name: 'Inspector', type: 'People' },
    { name: 'Last passed', type: 'Date', note: 'Set by Automation. The insurer’s proof, exported from the Table view.' },
  ],
  views: [
    { type: 'Calendar', name: 'Inspection calendar', note: 'Every recurring inspection by due date, colored by Property.' },
    { type: 'Table', name: 'Insurer log', note: 'Inspection type, property, inspector and Last passed, exported to CSV each quarter.' },
    { type: 'List', name: 'This week', note: 'Due this week and In progress, grouped by Inspector.' },
  ],
  pieces: [
    { kind: 'Recurring task', name: 'Monthly, per building', note: 'Recurs on the first Monday of each month, creating a new task when the current one is Passed or Closed, with checklist and fields copied.' },
    { kind: 'Template', name: 'Checklist template: Common-area walk', note: `${checklist.length} items, one per line of the SOP.` },
    { kind: 'Doc', name: 'Inspections SOP', note: 'A page per inspection type, with photos of pass and fail. Linked from every inspection task.' },
  ],
  automations: [
    {
      id: 'due',
      name: 'Start date: to the inspector',
      trigger: { type: 'start_date_arrives' },
      conditions: [{ type: 'status', is: ['Scheduled'] }],
      actions: [
        { type: 'change_status', to: 'Due this week' },
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'Inspector' }] },
        { type: 'add_comment', body: '@{{field.Inspector}} {{task.name}} is due by {{task.due}}. Work through the checklist; tag issue-found for anything that needs a repair. The Inspections SOP has photos of what passes.' },
      ],
    },
    {
      id: 'issue',
      name: 'Issue found: open a work order',
      trigger: { type: 'tags_added', tags: ['issue-found'] },
      actions: [
        { type: 'change_status', to: 'Issues found' },
        { type: 'create_task', name: 'Inspection follow-up: {{task.name}}', list: 'Maintenance / Work Orders', relationship: 'Task relationship' },
        { type: 'add_comment', body: '@Elena Petrov a linked work order was created from this inspection. Details are in the comments above.' },
      ],
      note: 'The work order is linked both ways, so the insurer log shows the problem and the fix.',
    },
    {
      id: 'passed',
      name: 'Clean checklist: passed',
      trigger: { type: 'checklists_resolved' },
      conditions: [{ type: 'tag', lacks: ['issue-found'] }],
      actions: [
        { type: 'change_status', to: 'Passed' },
        { type: 'update_custom_field', field: 'Last passed', onTriggerDate: true },
      ],
      note: 'Passed is a Done status, so the recurring setting creates next month’s task.',
    },
    {
      id: 'late',
      name: 'Due today and not finished',
      trigger: { type: 'due_date_arrives' },
      conditions: [{ type: 'status', is: ['Due this week', 'In progress'] }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'send_channel_message', channel: '#operations', body: 'Inspection due today and not finished: {{task.name}} ({{task.assignees}}).' },
      ],
    },
  ],
  scenarios: [
    {
      id: 'clean',
      label: 'A clean walk-through',
      summary: 'The monthly walk at Maple Court. Ray does it Tuesday morning and every item passes.',
      start: 60,
      task: task(0),
      events: [
        { at: D + 540, type: 'status', to: 'In progress', by: 'ray' },
        ...checklist.map((name, i) => ({ at: D + 545 + i * 8, type: 'checklist_done' as const, name, by: 'ray' })),
      ],
      expect: { status: 'Passed', fires: ['due', 'passed'], blocks: ['late'], assignees: ['ray'] },
    },
    {
      id: 'issue',
      label: 'Started early, an exit sign is out',
      summary: 'Ray starts on Monday before the task is due, and finds a dead exit sign. The inspection becomes a work order.',
      start: 60,
      task: task(1),
      events: [
        { at: 840, type: 'status', to: 'In progress', by: 'ray' },
        { at: 850, type: 'comment', body: 'Exit sign above the 2nd-floor stairwell is dark. Battery and bulb both dead.', by: 'ray' },
        { at: 852, type: 'tag', add: ['issue-found'], by: 'ray' },
        ...checklist.map((name, i) => ({ at: 860 + i * 8, type: 'checklist_done' as const, name, by: 'ray' })),
      ],
      expect: { status: 'Issues found', fires: ['issue'], blocks: ['due', 'passed', 'late'] },
    },
    {
      id: 'missed',
      label: 'Inspector out sick',
      summary: 'Nobody gets to it this week. On Friday morning it is flagged; Rosa does it herself the next Monday.',
      start: 60,
      task: task(0),
      events: [
        { at: 7 * D + 540, type: 'status', to: 'In progress', by: 'rosa' },
        ...checklist.map((name, i) => ({ at: 7 * D + 545 + i * 8, type: 'checklist_done' as const, name, by: 'rosa' })),
      ],
      expect: { status: 'Passed', fires: ['due', 'late', 'passed'], priority: 'Urgent' },
    },
  ],
  build: [
    { title: 'Recurring, not copied', body: 'Each building’s inspection is one recurring task that creates the next when it reaches a Done or Closed status. Checklist, fields and assignee carry over, so the calendar fills itself.' },
    { title: 'SOP and checklist in step', body: 'Each checklist item is one line of the Inspections SOP Doc, with the photos in the Doc. Changing the SOP means changing the checklist template the same day.' },
    { title: 'A tag as the inspector’s one button', body: 'Inspectors on the mobile app add one tag, issue-found, and write what they saw in a comment. Tags added creates the linked work order.' },
    { title: 'Pass only when clean', body: 'Checklists resolved marks the inspection Passed only if it has no issue-found tag, and stamps Last passed. An inspection with issues stays open until the work order is done and Rosa closes it.' },
    { title: 'Late is visible', body: 'Due date arrives with a Status Condition sends one message to #operations. The Dashboard calendar shows the rest of the month.' },
  ],
  edgeCases: [
    { title: 'What if the inspector starts before the start date?', body: 'Moving it to In progress early is fine: the start-date Automation checks for Scheduled and leaves it alone.' },
    { title: 'What if two things fail?', body: 'One tag and one work order with both items in the comment. A second work order is created by hand only if the jobs need different trades.' },
    { title: 'What if the checklist is finished but an issue was found?', body: 'The Passed Automation’s tag Condition holds it back, so the inspection stays in Issues found. That is the record the insurer wants: found, fixed, then closed.' },
    { title: 'What if the building is sold?', body: 'Stop the recurrence on that building’s tasks. Past inspections and their dates stay in the Table view.' },
  ],
  qa: [
    'A recurring test task set to recur on close: completing it creates the next one with a fresh checklist.',
    'Start date arriving on Scheduled and on In progress tasks.',
    'The issue-found tag: status, linked work order in Work Orders, comment to Elena.',
    'A clean checklist with and without the tag.',
    'A task still open on its due date: Urgent and one #operations message.',
  ],
  features: ['Recurring tasks', 'Checklist templates', 'Checklists resolved', 'Tags added', 'Create a task with a relationship', 'Docs (SOPs)', 'Calendar and Table views', 'Date Custom Fields'],
};
