import type { Process } from '@/lib/clickup/types';

const D = 1440;
const blockers = ['Content loaded into the CMS', 'Client sign-off on every page', 'QA pass on phones', 'Redirect map approved'];
const checklist = ['Lower the DNS TTL the day before', 'Switch the DNS records', 'SSL certificate issued', '301 redirects live', 'Analytics and Search Console verified', 'Test submission of the booking form'];

export const launch: Process = {
  id: 'launch',
  number: '03',
  name: 'Launch plan',
  kicker: 'Dependencies to go-live',
  tagline: 'The go-live task waits on its blockers, starts itself when they clear, and raises a flag two days out if they haven’t.',
  problem:
    'Launch day was a group chat. Nobody could say which of the last few jobs were still open, the developer found out on the morning of launch that the client had not signed off the last page, and the go-live checklist lived in one person’s head.',
  solution:
    'The Launch plan List is a Gantt chart of tasks joined by dependencies. The go-live task is waiting on four others; when the last one is done, ClickUp unblocks it and an Automation hands it to the developer. On its start date it applies the go-live checklist. Two days before the due date, a still-blocked launch alerts the project manager, and closing the checklist marks the site live.',
  location: { space: 'Client Delivery', folder: 'Juniper Dental · Website', list: 'Launch plan' },
  statuses: [
    { name: 'Waiting', group: 'not_started', color: '#87909e' },
    { name: 'Ready', group: 'active', color: '#1090e0' },
    { name: 'In progress', group: 'active', color: '#5f55ee' },
    { name: 'Live', group: 'done', color: '#008844' },
    { name: 'Cancelled', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Launch owner', type: 'People', note: 'The developer who runs go-live.' },
    { name: 'Go-live window', type: 'Dropdown', options: ['Tue–Thu morning', 'Weekend'], note: 'Tuesday to Thursday mornings unless the client asks otherwise: never a Friday afternoon.' },
    { name: 'Site URL', type: 'URL' },
  ],
  views: [
    { type: 'Gantt', name: 'Launch timeline', note: 'Every task with its dependency arrows and the critical path highlighted. Dragging a blocker shows what moves with it.' },
    { type: 'List', name: 'Blockers', note: 'Tasks that block the go-live task, sorted by due date.' },
    { type: 'Workload', name: 'Launch week', note: 'Kenji’s and Lena’s estimates for launch week, so the go-live is not stacked on top of another launch.' },
  ],
  pieces: [
    { kind: 'Dependency', name: 'Go live waits on 4 tasks', note: blockers.join(', ') + '.' },
    { kind: 'Template', name: 'Checklist template: Go-live', note: `${checklist.length} items, applied by Automation on the start date so it is always the current version.` },
    { kind: 'Doc', name: 'Launch runbook', note: 'DNS, redirects and rollback steps in detail; each checklist item links to its section.' },
  ],
  automations: [
    {
      id: 'unblocked',
      name: 'Unblocked: hand it to the developer',
      trigger: { type: 'unblocked' },
      actions: [
        { type: 'change_status', to: 'Ready' },
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'Launch owner' }] },
        { type: 'add_comment', body: '@{{field.Launch owner}} every blocker on {{task.name}} is done. It is yours for {{task.due}}.' },
      ],
    },
    {
      id: 'start',
      name: 'Start date: begin go-live',
      trigger: { type: 'start_date_arrives' },
      conditions: [{ type: 'status', is: ['Ready'] }],
      actions: [
        { type: 'change_status', to: 'In progress' },
        { type: 'apply_template', template: 'Go-live', checklist },
      ],
      note: 'Only a Ready task starts itself. A launch still waiting on blockers stays Waiting, so nobody switches DNS on a site the client has not signed off.',
    },
    {
      id: 'at-risk',
      name: 'Two days out and still blocked',
      trigger: { type: 'date_before_after', date: 'due', days: 2, when: 'before' },
      conditions: [{ type: 'status', is: ['Waiting'] }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'add_comment', body: '@Jo Adeyemi {{task.name}} is due {{task.due}} and still waiting on its blockers. Check the Blockers view and the client sign-off.' },
        { type: 'send_channel_message', channel: '#client-delivery', body: 'Launch at risk: {{task.name}}, due {{task.due}}, still blocked.' },
      ],
    },
    {
      id: 'live',
      name: 'Checklist done: it is live',
      trigger: { type: 'checklists_resolved' },
      actions: [
        { type: 'change_status', to: 'Live' },
        { type: 'send_channel_message', channel: '#studio', body: '{{task.name}} is done: the new site is live.' },
        { type: 'create_task', name: '30-day check-in: Juniper Dental', list: 'Studio Ops / Studio admin', relationship: 'Task relationship' },
      ],
      note: 'The check-in task is how the studio turns a launch into a retainer conversation.',
    },
  ],
  scenarios: [
    {
      id: 'on-track',
      label: 'On track',
      summary: 'Every blocker is done on Monday. Go-live starts itself on Thursday and Kenji works through the checklist.',
      start: 540,
      task: { name: 'Go live: switch DNS to the new site', status: 'Waiting', assignees: ['jo'], startDay: 3, dueDay: 3, waitingOn: blockers.map((name) => ({ name, done: false })), fields: { 'Launch owner': 'kenji', 'Go-live window': 'Tue–Thu morning', 'Site URL': 'https://juniperdental.example' } },
      events: [
        { at: 60, type: 'blocker_done', name: blockers[0] },
        { at: 180, type: 'blocker_done', name: blockers[2] },
        { at: 300, type: 'blocker_done', name: blockers[3] },
        { at: 420, type: 'blocker_done', name: blockers[1] },
        ...checklist.map((name, i) => ({ at: 3 * D + 30 + i * 20, type: 'checklist_done' as const, name, by: 'kenji' })),
      ],
      expect: { status: 'Live', fires: ['unblocked', 'start', 'live'], blocks: ['at-risk'], assignees: ['kenji'] },
    },
    {
      id: 'late-signoff',
      label: 'Client sign-off comes late',
      summary: 'The client has not signed off by Tuesday, so the at-risk alert fires. Sign-off lands Wednesday and the launch still goes ahead.',
      start: 540,
      task: { name: 'Go live: switch DNS to the new site', status: 'Waiting', assignees: ['jo'], startDay: 3, dueDay: 3, waitingOn: blockers.map((name) => ({ name, done: false })), fields: { 'Launch owner': 'kenji', 'Go-live window': 'Tue–Thu morning', 'Site URL': 'https://juniperdental.example' } },
      events: [
        { at: 60, type: 'blocker_done', name: blockers[0] },
        { at: 180, type: 'blocker_done', name: blockers[2] },
        { at: 300, type: 'blocker_done', name: blockers[3] },
        { at: D + 120, type: 'note', text: 'Jo calls Dana about the sign-off' },
        { at: 2 * D + 360, type: 'blocker_done', name: blockers[1] },
        ...checklist.map((name, i) => ({ at: 3 * D + 30 + i * 20, type: 'checklist_done' as const, name, by: 'kenji' })),
      ],
      expect: { status: 'Live', fires: ['unblocked', 'at-risk', 'start', 'live'], priority: 'Urgent' },
    },
    {
      id: 'slips',
      label: 'The launch slips a week',
      summary: 'Sign-off misses the start date, so go-live does not start itself. Jo moves the date and Kenji starts by hand the next week.',
      start: 540,
      task: { name: 'Go live: switch DNS to the new site', status: 'Waiting', assignees: ['jo'], startDay: 3, dueDay: 3, waitingOn: blockers.map((name) => ({ name, done: false })), fields: { 'Launch owner': 'kenji', 'Go-live window': 'Tue–Thu morning', 'Site URL': 'https://juniperdental.example' } },
      events: [
        { at: 60, type: 'blocker_done', name: blockers[0] },
        { at: 180, type: 'blocker_done', name: blockers[2] },
        { at: 300, type: 'blocker_done', name: blockers[3] },
        { at: 3 * D + 60, type: 'due', day: 9, by: 'jo' },
        { at: 4 * D + 360, type: 'blocker_done', name: blockers[1] },
        { at: 8 * D, type: 'status', to: 'In progress', by: 'kenji' },
      ],
      until: 8 * D + 60,
      expect: { status: 'In progress', fires: ['unblocked', 'at-risk'], blocks: ['start', 'at-risk'], assignees: ['kenji'] },
    },
  ],
  build: [
    { title: 'Dependencies first', body: 'The go-live task is “waiting on” the four tasks that must be finished first. ClickUp then shows it as blocked, draws the arrows in Gantt, and fires Task or subtask unblocked when the last one closes.' },
    { title: 'Start and due on the same day', body: 'Go-live has a start date and a due date on the planned launch day. Start date arrives does the work; the due date anchors the at-risk warning two days earlier.' },
    { title: 'The checklist arrives on the day', body: 'Apply a template adds the Go-live checklist template on the start date, so edits to the template reach every future launch and no old copy lingers on a task created months ago.' },
    { title: 'Conditions keep it safe', body: 'Start date arrives only acts on a Ready task, and the at-risk alert only on a Waiting one. A blocked launch can never start itself.' },
    { title: 'Closing the loop', body: 'Checklists resolved marks the task Live, tells the studio, and creates the 30-day check-in, linked back to the launch.' },
  ],
  edgeCases: [
    { title: 'What if a blocker is reopened after the launch is Ready?', body: 'ClickUp shows the go-live task as blocked again, but its status stays Ready. The Blockers view shows it, and the developer should not start until it clears; the runbook’s first line says so.' },
    { title: 'What if the launch date moves?', body: 'Jo changes the due date and the at-risk warning follows it, firing two days before the new date. A start date that has already passed does not fire again, so Kenji starts the go-live by hand, as in the “slips” sample.' },
    { title: 'What if the client wants a weekend launch?', body: 'The Go-live window field says so and the start date is set to the Saturday. The Automation fires at 4 AM that day like any other.' },
    { title: 'What if the checklist template changes mid-project?', body: 'Launches that have not started yet get the new version, because the template is applied on the start date, not when the task was created.' },
  ],
  qa: [
    'Closing the four blockers in any order: the go-live task becomes Ready only after the last one.',
    'A start date arriving on a Waiting task: nothing happens.',
    'The at-risk warning on a Waiting task, and silence on a Ready one.',
    'Moving the due date: the warning follows the new date.',
    'Checking the last checklist item: Live, the #studio message and one check-in task.',
  ],
  features: ['Dependencies (waiting on / blocking)', 'Task or subtask unblocked', 'Start date arrives', 'Date is Before/After', 'Checklist templates', 'Checklists resolved', 'Gantt view', 'Workload view'],
};
