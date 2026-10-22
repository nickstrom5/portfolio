import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const reportPrep: Automation = {
  id: 'report-prep',
  number: '04',
  name: 'Report prep',
  kicker: 'Two weeks out → the checklist',
  tagline: 'Two weeks before a report is due, it builds its own checklist and pulls in the people who write it.',
  problem:
    'Quarterly funder reports were assembled in the last four days. Grace chased Hana for metrics, Noor for photos and the finance volunteer for budget numbers, all at once, and the narrative was written the night before. Board reports were the same, a week later.',
  solution:
    'Every report owed is a task in Grant Reporting with a due date and a Report type. Fourteen days before it’s due, the automation checks the type. A funder report gets the full checklist as subtasks, each with an owner (metrics, narrative and photos, budget against actuals, the program director’s read), Grace and Ben added, a move to Drafting and a post in #grants. A board report gets a shorter list for Ben and Rosa. Permit reports have their own process, so they take no path.',
  automation: {
    name: '04 · Start report prep two weeks out',
    project: 'Grant Reporting',
    triggers: [{ type: 'due_approaching', days: 14 }],
    actions: [],
    paths: [
      {
        id: 'p-funder',
        label: 'Funder report',
        when: [{ type: 'field', key: 'Report type', op: 'is', value: 'Funder report' }],
        actions: [
          {
            type: 'subtasks',
            items: [
              { name: 'Pull metrics from the season dashboard', assignee: 'hana' },
              { name: 'Narrative and three field photos', assignee: 'noor' },
              { name: 'Budget against actuals', assignee: 'grace' },
              { name: 'Program director read-through', assignee: 'ben' },
            ],
          },
          { type: 'collaborators', users: ['grace', 'ben'] },
          { type: 'move', section: 'Drafting' },
          { type: 'slack', channel: '#grants', body: 'A funder report is due in 14 days. The checklist is on the task with an owner and date on each step.' },
        ],
      },
      {
        id: 'p-board',
        label: 'Board report',
        when: [{ type: 'field', key: 'Report type', op: 'is', value: 'Board report' }],
        actions: [
          { type: 'subtasks', items: [{ name: 'Update the portfolio status', assignee: 'ben' }, { name: 'Executive director’s memo', assignee: 'rosa' }] },
          { type: 'move', section: 'Drafting' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['Due date is approaching works on tasks only, and fires once per due date, between midnight and 1 AM.'],
    },
  },
  scenarios: [
    {
      id: 'funder',
      label: 'The Q3 funder report',
      summary: 'Due in three weeks. Two weeks out, it starts itself.',
      start: 0 * D + 540,
      task: { name: 'Q3 report: Salmon Habitat Fund', section: 'Upcoming', assignee: 'grace', due: 20, fields: { 'Report type': 'Funder report', Grant: 'Salmon Habitat Fund' } },
      events: [],
      expect: { section: 'Drafting', assignee: 'grace', paths: ['p-funder'] },
    },
    {
      id: 'board',
      label: 'The board packet',
      summary: 'Ben’s November board packet gets the short list.',
      start: 0 * D + 540,
      task: { name: 'November board packet', section: 'Upcoming', assignee: 'ben', due: 16, fields: { 'Report type': 'Board report', Grant: 'Unrestricted' } },
      events: [],
      expect: { section: 'Drafting', paths: ['p-board'] },
    },
    {
      id: 'permit',
      label: 'A permit report',
      summary: 'The state summary runs, checks and takes no path: Mei has her own process.',
      start: 0 * D + 540,
      task: { name: 'State permit: annual monitoring summary', section: 'Upcoming', assignee: 'mei', due: 18, fields: { 'Report type': 'Permit report', Grant: 'State restoration grant' } },
      events: [],
      expect: { section: 'Upcoming' },
    },
  ],
  build: [
    { title: 'Every report is a task', body: 'Due date, Report type and Grant on each. The year’s reports are entered once, in January, from the grant agreements.' },
    { title: 'Trigger', body: 'Due date is approaching: 14 days before.' },
    { title: 'Two paths, no else', body: 'Funder report gets four subtasks, each with an assignee,, two collaborators, Drafting and Slack. Board report gets two subtasks and Drafting.' },
    { title: 'Dependencies', body: 'The Q3 report is blocked by Season data published in the field season project, a cross-project dependency, so the timeline shows when field delays will reach the funder.' },
    { title: 'Milestone', body: 'Q3 funder report submitted is a milestone, linked to the goal “Submit every funder report on time”.' },
  ],
  edgeCases: [
    { title: 'A report added with less than 14 days to go', body: 'The moment has passed, so no checklist appears. Grace adds it from the saved task template in one click.' },
    { title: 'The funder extends the deadline', body: 'Grace moves the due date; the trigger fires 14 days before the new date instead. If the checklist already exists, it isn’t added twice, because it fires once per due date and the old one has passed.' },
    { title: 'A report that is already done', body: 'Due date triggers only fire for open tasks, so an early submission is never re-opened as work.' },
  ],
  qa: [
    'A funder report 14 days out gets four subtasks with assignees, Grace and Ben added, moved to Drafting, one Slack post.',
    'A board report gets two subtasks and moves to Drafting.',
    'A permit report takes no path.',
  ],
  features: ['Due date is approaching', 'Check if paths', 'Subtasks', 'Cross-project dependencies', 'Milestones', 'Goals', 'Task templates', 'Asana for Slack'],
};
