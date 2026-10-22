import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const overdueEscalation: Automation = {
  id: 'overdue-escalation',
  number: '05',
  name: 'Overdue escalation',
  kicker: 'Overdue → the right person',
  tagline: 'When onboarding work goes overdue, the project shows whose move it is and pulls in the right person.',
  problem:
    'Partners asked “where are we with Larkspur?” and the honest answer took a meeting. An overdue task looked the same whether the client hadn’t sent statements or the firm hadn’t started the setup.',
  solution:
    'The moment an onboarding task goes overdue, an automation labels it. Client to-dos get Waiting on: Client, Sam added as a collaborator, and a post to #client-onboarding so he can decide whether to call. The firm’s own tasks get Waiting on: Us and Priya added, because an internal delay on a new client is a partner conversation. In the portfolio, the Waiting on column turns “are we late?” into “who do I call?”.',
  automation: {
    name: '05 · Label and escalate overdue onboarding work',
    project: 'Onboarding · Larkspur Bakery',
    triggers: [{ type: 'overdue' }],
    actions: [],
    paths: [
      {
        id: 'p-client',
        label: 'Client is late',
        when: [{ type: 'section', is: 'Client to-dos' }],
        actions: [
          { type: 'set_field', key: 'Waiting on', value: 'Client' },
          { type: 'collaborators', users: ['sam'] },
          { type: 'slack', channel: '#client-onboarding', body: 'A client to-do is overdue. Sam: call or email today? Milestones after it on Timeline will move if it slips another week.' },
        ],
      },
      {
        id: 'p-us',
        label: 'We are late',
        when: [],
        actions: [
          { type: 'set_field', key: 'Waiting on', value: 'Us' },
          { type: 'collaborators', users: ['priya'] },
          { type: 'comment', body: 'Overdue on our side. Assignee: new due date and a one-line reason in a comment today, please. Priya is added because it’s a new client’s first month.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['Task is overdue fires once, at the moment the task becomes overdue, and only for open tasks. It doesn’t repeat daily, so there’s no nagging.', 'Day precision: it runs between midnight and 1 AM on the first day past the due date.'],
    },
  },
  scenarios: [
    {
      id: 'client-late',
      label: 'The client is late',
      summary: 'Statements due Friday never arrive. Wednesday’s reminder, then Saturday’s escalation.',
      start: 1 * D + 540,
      task: { name: 'Client: upload last 12 months of statements', section: 'Client to-dos', assignee: 'owen', due: 4 },
      events: [{ at: 7 * D + 610, by: 'sam', type: 'comment', body: 'Called the owner. Statements Tuesday; moving the date.' }, { at: 7 * D + 612, by: 'sam', type: 'due', day: 8 }],
      expect: { fields: { 'Waiting on': 'Client' }, paths: ['p-client'], fired: ['client-reminders'] },
    },
    {
      id: 'we-late',
      label: 'We are late',
      summary: 'The setup task slips past its date on our side.',
      start: 5 * D + 540,
      task: { name: 'Chart of accounts and QuickBooks setup', section: 'Setup', assignee: 'jordan', due: 8 },
      events: [{ at: 9 * D + 560, by: 'jordan', type: 'comment', body: 'Two catch-ups overlapped. New date Thursday; Tess is helping.' }, { at: 9 * D + 562, by: 'jordan', type: 'due', day: 10 }, { at: 10 * D + 900, by: 'jordan', type: 'complete' }],
      expect: { completed: true, fields: { 'Waiting on': 'Us' }, paths: ['p-us'] },
    },
    {
      id: 'on-time',
      label: 'Finished on time',
      summary: 'Catch-up categorization done the day before it’s due: nothing fires.',
      start: 6 * D + 540,
      task: { name: 'Catch-up categorization', section: 'Setup', assignee: 'tess', due: 12 },
      events: [{ at: 11 * D + 960, by: 'tess', type: 'complete' }],
      expect: { completed: true, notFired: ['overdue-escalation'] },
    },
  ],
  build: [
    { title: 'Trigger', body: 'Task is overdue, as soon as it becomes overdue.' },
    { title: 'Two paths', body: 'Section is Client to-dos: Waiting on Client, add Sam, Slack. No other path is matching: Waiting on Us, add Priya, comment.' },
    { title: 'Portfolio column', body: 'Waiting on is added to the Client onboardings portfolio. Sorting by it is the partners’ Monday view.' },
    { title: 'Status updates', body: 'Sam posts a weekly status on each at-risk onboarding. The portfolio rolls the latest one up, so nobody reads ten projects.' },
  ],
  edgeCases: [
    { title: 'The date moves after it went overdue', body: 'Moving the due date clears the overdue state. If the new date passes too, the automation fires again, so a second slip is never silent.' },
    { title: 'Waiting on is stale', body: 'Once a late task is done, its Waiting on value stays as history. The portfolio filter shows only open tasks, so it never misleads.' },
    { title: 'Weekends', body: 'A Friday due date goes overdue on Saturday at midnight. The Slack post waits in the channel for Monday, which is fine for a week-long onboarding.' },
  ],
  qa: [
    'A client to-do past its date gets Waiting on: Client, Sam added and one Slack post.',
    'An internal task past its date gets Waiting on: Us, Priya added and the comment.',
    'A task completed before its date triggers nothing.',
    'Moving the date and letting it pass again fires a second time.',
  ],
  features: ['Task is overdue', 'Automations', 'Check if paths', 'Portfolios', 'Status updates', 'Asana for Slack', 'Timeline'],
};
