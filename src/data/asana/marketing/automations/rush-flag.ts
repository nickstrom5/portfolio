import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const rushFlag: Automation = {
  id: 'rush-flag',
  number: '02',
  name: 'Rush requests',
  kicker: 'Rush → the creative lead decides',
  tagline: 'Rush work reaches the creative lead in minutes, and only she bumps the queue.',
  problem:
    'Everything was urgent. Requesters messaged makers directly, makers said yes to whoever asked last, and planned work slipped without anyone choosing to slip it. Ava found out on Friday.',
  solution:
    'Rush is a required Yes or No on the form, mapped to a field. When a request comes in as rush, or someone flips Rush to Yes later, one automation sets Priority to High, adds Ava as a collaborator and posts to #creative-rush in Slack. Makers keep working the queue in order; Ava decides what moves. The same automation listens to both triggers, so a request that becomes rush on day three is treated exactly like one that started that way.',
  automation: {
    name: '02 · Flag rush requests to the creative lead',
    project: 'Creative Requests',
    triggers: [{ type: 'added' }, { type: 'field', key: 'Rush', value: 'Yes' }],
    actions: [],
    paths: [
      {
        id: 'p-rush',
        label: 'Rush',
        when: [{ type: 'field', key: 'Rush', op: 'is', value: 'Yes' }],
        actions: [
          { type: 'set_field', key: 'Priority', value: 'High' },
          { type: 'collaborators', users: ['ava'] },
          { type: 'slack', channel: '#creative-rush', body: 'Rush request in Creative Requests: needed in under 7 days. Ava decides what moves; makers, keep your current order until she does.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'Two triggers, either one starts it: a new task, or Rush changed to Yes. The Check if makes the new-task trigger do nothing unless Rush is Yes.',
        'No else path on purpose: a request that isn’t rush needs nothing from this automation.',
        'The Slack action runs on the Slack connection of the person who created the automation, so only that person can edit it. Ava owns it.',
      ],
    },
  },
  scenarios: [
    {
      id: 'rush-form',
      label: 'Rush on the form',
      summary: 'Partnerships needs a banner for a co-op promo that starts Monday.',
      start: 3 * D + 845,
      submitted: true,
      task: { name: 'REI co-op banner set', section: 'New requests', fields: { 'Request type': 'Social graphic', Rush: 'Yes', 'Requesting team': 'Partnerships' } },
      events: [],
      expect: { section: 'Queued', assignee: 'jun', fields: { Priority: 'High' }, paths: ['p-rush'] },
    },
    {
      id: 'not-rush',
      label: 'Not rush',
      summary: 'A normal request: the automation runs, checks, and does nothing.',
      start: 1 * D + 610,
      submitted: true,
      task: { name: 'Instagram carousel: layering 101', section: 'New requests', fields: { 'Request type': 'Social graphic', Rush: 'No', 'Requesting team': 'Ecommerce' } },
      events: [],
      expect: { section: 'Queued', assignee: 'jun' },
    },
    {
      id: 'becomes-rush',
      label: 'Becomes rush later',
      summary: 'The founders move a date, and Ava flips Rush to Yes on a queued task.',
      start: 0 * D + 540,
      task: { name: 'Founders’ note: launch landing copy', section: 'Queued', assignee: 'ines', due: 4, fields: { 'Request type': 'Copy only', Rush: 'No', Priority: 'Medium', 'Requesting team': 'Founders' } },
      events: [{ at: 1 * D + 690, by: 'ava', type: 'field', key: 'Rush', value: 'Yes', note: 'The launch moved up a week.' }],
      expect: { section: 'Queued', assignee: 'ines', fields: { Priority: 'High' }, paths: ['p-rush'] },
    },
  ],
  build: [
    { title: 'Rush, not a date', body: 'Requesters are bad at dates and good at “do you need it this week?”. A Yes or No is easy to answer honestly and easy to automate on.' },
    { title: 'Two triggers', body: 'Task added to this project, and Custom field is changed with Rush changed to Yes. Either starts the automation.' },
    { title: 'One path', body: 'Check if Rush is Yes. Priority to High, Ava as collaborator, a Slack message to #creative-rush.' },
    { title: 'Slack connected once', body: 'The Slack action uses Asana for Slack, authorized by Ava, so messages come from a person the team knows.' },
  ],
  edgeCases: [
    { title: 'Rush flipped back to No', body: 'Nothing happens: the trigger only listens for Yes. Ava lowers Priority herself, which is the honest record of the decision.' },
    { title: 'Everything becomes rush', body: 'The Dashboard has a chart of rush requests by requesting team per month. When one team is always rush, that is a planning conversation, not an automation.' },
    { title: 'Ava leaves the company', body: 'Her automations become orphaned and Asana tells project editors. Anyone with edit access can claim ownership and reconnect Slack.' },
  ],
  qa: [
    'A rush submission ends with Priority High, Ava as collaborator, and one Slack post.',
    'A non-rush submission runs the automation but takes no path, and posts nothing.',
    'Changing Rush from No to Yes on an existing task posts once; changing it back posts nothing.',
  ],
  features: ['Custom fields', 'Automations', 'Multiple triggers', 'Check if paths', 'Collaborators', 'Asana for Slack', 'Dashboards'],
};
