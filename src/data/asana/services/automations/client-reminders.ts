import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const clientReminders: Automation = {
  id: 'client-reminders',
  number: '04',
  name: 'Client to-do reminders',
  kicker: 'Two days out → a nudge',
  tagline: 'Two days before a client to-do is due, the coordinator is told to send a friendly nudge.',
  problem:
    'Most onboarding delays were waiting on the client: statements, bank access, a signed form. Nobody chased until the date had passed, and then the reminder sounded like a complaint.',
  solution:
    'In every onboarding project, tasks the client owes sit in Client to-dos, assigned to Owen as the person responsible for getting them. Two days before one is due, an automation checks that it is a client to-do and comments with the reminder to send. It runs only on open tasks, so anything already done is never chased. Because it lives in the template, every new client’s project has it from day one.',
  automation: {
    name: '04 · Remind before client to-dos are due',
    project: 'Onboarding · Larkspur Bakery',
    triggers: [{ type: 'due_approaching', days: 2 }],
    actions: [],
    paths: [
      {
        id: 'p-client',
        label: 'Client to-do',
        when: [{ type: 'section', is: 'Client to-dos' }],
        actions: [
          { type: 'comment', body: '@Owen Carter due in two days and still open. Send the friendly reminder (the Client reminder email template), log it here, and offer a 10-minute screen share if they’re stuck.' },
          { type: 'set_field', key: 'Waiting on', value: 'Client' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'Due date is approaching only works on tasks, not subtasks, and only fires for incomplete tasks. Both suit this: client to-dos are tasks, and done ones need no chase.',
        'It fires between midnight and 1 AM on the day, so the comment is waiting when Owen starts work.',
        'No else path: internal tasks have assignees who see their own due dates in My tasks.',
      ],
    },
  },
  scenarios: [
    {
      id: 'reminded',
      label: 'Statements not in yet',
      summary: 'The bakery’s statements are due Friday; Wednesday morning Owen is reminded.',
      start: 1 * D + 540,
      task: { name: 'Client: upload last 12 months of statements', section: 'Client to-dos', assignee: 'owen', due: 4 },
      events: [{ at: 3 * D + 600, by: 'owen', type: 'comment', body: 'Sent the reminder. Owner says Thursday evening.' }, { at: 3 * D + 1250, by: 'owen', type: 'complete', note: 'The statements arrive Thursday night.' }],
      expect: { section: 'Client to-dos', completed: true, fields: { 'Waiting on': 'Client' }, paths: ['p-client'] },
    },
    {
      id: 'early',
      label: 'Done early',
      summary: 'The client connects the bank feeds on day one; nobody is chased.',
      start: 1 * D + 540,
      task: { name: 'Client: connect bank and card feeds', section: 'Client to-dos', assignee: 'owen', due: 4 },
      events: [{ at: 1 * D + 930, by: 'owen', type: 'complete', note: 'Feeds connected during the kickoff call.' }],
      expect: { completed: true, notFired: ['client-reminders'] },
    },
    {
      id: 'internal',
      label: 'An internal task',
      summary: 'The trigger fires for Jordan’s setup task too, but it isn’t a client to-do.',
      start: 4 * D + 540,
      task: { name: 'Chart of accounts and QuickBooks setup', section: 'Setup', assignee: 'jordan', due: 8 },
      events: [{ at: 7 * D + 700, by: 'jordan', type: 'complete' }],
      expect: { completed: true },
    },
  ],
  build: [
    { title: 'Trigger', body: 'Due date is approaching, 2 days before. Set in the template so every onboarding project has it.' },
    { title: 'Check if', body: 'Section is Client to-dos. Only the client’s own homework gets a reminder.' },
    { title: 'Actions', body: 'Comment to Owen with the reminder to send, and set Waiting on to Client so the portfolio shows whose move it is.' },
    { title: 'The message itself', body: 'Owen sends it from his own email with a saved template, and logs a one-line comment on the task, so the history of every chase is in one place.' },
  ],
  edgeCases: [
    { title: 'No due date', body: 'A client to-do with no due date is never reminded. The template gives every one a relative due date, so a new project can’t have that gap.' },
    { title: 'The date moves', body: 'If the client asks for more time and Owen moves the due date, the reminder fires two days before the new date instead.' },
    { title: 'Due tomorrow when created', body: 'The two-day point has already passed, so no reminder fires. Owen sets the date in the kickoff call, which is the reminder.' },
    { title: 'The automation doesn’t email the client', body: 'On purpose. A person sends it, so it can mention the call they just had. Automations are good at noticing; people are better at nudging.' },
  ],
  qa: [
    'A client to-do still open two days before its due date gets one comment and Waiting on set to Client.',
    'A client to-do completed early gets nothing.',
    'A Setup task reaching its two-day point runs the automation but takes no path.',
  ],
  features: ['Due date is approaching', 'Automations', 'Check if paths', 'Comments', 'Project templates'],
};
