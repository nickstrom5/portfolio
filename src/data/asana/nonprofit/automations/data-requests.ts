import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const dataRequests: Automation = {
  id: 'data-requests',
  number: '01',
  name: 'Data request triage',
  kicker: 'Partner form → safe routing',
  tagline: 'Every partner request is routed by data type, and anything near a spawning site waits for an agreement.',
  problem:
    'Requests came by email to whoever the partner knew. In the spring a volunteer sent a spreadsheet with exact redd locations to a county planner, which is the kind of mistake that ends up on a poacher’s map. Other requests sat for weeks because nobody owned the inbox.',
  solution:
    'Partners use one form. Its required question, “Do you need exact spawning locations?”, maps to a field, and the automation checks it first. Yes goes to Mei, the data manager, in Needs data-sharing agreement, with Ben added and a comment saying nothing moves until the agreement is signed. Everything else is routed by data type: water quality to Mei, fish counts to Hana, imagery to Luis, each due in seven days so the five-business-day promise holds. Other goes to Mei to scope.',
  automation: {
    name: '01 · Triage partner data requests',
    project: 'Data Requests',
    triggers: [{ type: 'added' }],
    actions: [],
    paths: [
      {
        id: 'p-sensitive',
        label: 'Exact locations',
        when: [{ type: 'field', key: 'Sensitive locations', op: 'is', value: 'Yes' }],
        actions: [
          { type: 'assign', user: 'mei' },
          { type: 'move', section: 'Needs data-sharing agreement' },
          { type: 'collaborators', users: ['ben'] },
          { type: 'comment', body: 'Exact spawning locations requested. Nothing is shared until a data-sharing agreement is signed. @Mei Tanaka send the agreement template; if they only need site-level data, offer the 1 km grid version instead.' },
        ],
      },
      {
        id: 'p-water',
        label: 'Water quality',
        when: [{ type: 'field', key: 'Sensitive locations', op: 'is', value: 'No' }, { type: 'field', key: 'Data type', op: 'is', value: 'Water quality' }],
        actions: [{ type: 'assign', user: 'mei' }, { type: 'due', days: 7 }, { type: 'move', section: 'In progress' }],
      },
      {
        id: 'p-fish',
        label: 'Fish counts',
        when: [{ type: 'field', key: 'Sensitive locations', op: 'is', value: 'No' }, { type: 'field', key: 'Data type', op: 'is', value: 'Fish counts' }],
        actions: [{ type: 'assign', user: 'hana' }, { type: 'due', days: 7 }, { type: 'move', section: 'In progress' }],
      },
      {
        id: 'p-imagery',
        label: 'Habitat imagery',
        when: [{ type: 'field', key: 'Sensitive locations', op: 'is', value: 'No' }, { type: 'field', key: 'Data type', op: 'is', value: 'Habitat imagery' }],
        actions: [{ type: 'assign', user: 'luis' }, { type: 'due', days: 7 }, { type: 'move', section: 'In progress' }],
      },
      {
        id: 'p-other',
        label: 'Anything else',
        when: [],
        actions: [{ type: 'assign', user: 'mei' }, { type: 'due', days: 3 }, { type: 'comment', body: '@Mei Tanaka this request doesn’t fit a data type. Reply to scope it, set Data type, and move it to In progress or Declined.' }],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['The sensitive path comes first and the others each require Sensitive locations is No, so a sensitive request can never take a routine path.', 'Seven calendar days covers five business days from any weekday.'],
    },
  },
  scenarios: [
    {
      id: 'sensitive',
      label: 'Exact redd locations',
      summary: 'The state wildlife agency asks for redd counts with coordinates.',
      start: 1 * D + 600,
      submitted: true,
      task: { name: 'State fish & wildlife: 2025 redd counts, Cedar Fork', section: 'New', fields: { 'Data type': 'Fish counts', 'Sensitive locations': 'Yes', 'Organization type': 'Agency', Site: 'Cedar Fork' } },
      events: [],
      expect: { section: 'Needs data-sharing agreement', assignee: 'mei', paths: ['p-sensitive'] },
    },
    {
      id: 'water',
      label: 'Temperature data',
      summary: 'A university lab wants logger data for a thermal refuge study.',
      start: 2 * D + 820,
      submitted: true,
      task: { name: 'University lab: temperature loggers, all sites', section: 'New', fields: { 'Data type': 'Water quality', 'Sensitive locations': 'No', 'Organization type': 'University' } },
      events: [{ at: 6 * D + 600, by: 'mei', type: 'move', section: 'Delivered', note: 'Shared as a CSV with the data dictionary.' }, { at: 6 * D + 601, by: 'mei', type: 'complete' }],
      expect: { section: 'Delivered', assignee: 'mei', completed: true, paths: ['p-water'] },
    },
    {
      id: 'fish',
      label: 'Smolt counts',
      summary: 'Tribal fisheries ask for this spring’s smolt trap counts.',
      start: 3 * D + 545,
      submitted: true,
      task: { name: 'Tribal fisheries: smolt trap counts', section: 'New', fields: { 'Data type': 'Fish counts', 'Sensitive locations': 'No', 'Organization type': 'Tribe' } },
      events: [],
      expect: { section: 'In progress', assignee: 'hana', paths: ['p-fish'] },
    },
    {
      id: 'imagery',
      label: 'Drone imagery',
      summary: 'County planning wants before-and-after imagery of Mill Creek.',
      start: 0 * D + 900,
      submitted: true,
      task: { name: 'County planning: drone imagery, Mill Creek', section: 'New', fields: { 'Data type': 'Habitat imagery', 'Sensitive locations': 'No', 'Organization type': 'Agency', Site: 'Mill Creek' } },
      events: [],
      expect: { section: 'In progress', assignee: 'luis', paths: ['p-imagery'] },
    },
    {
      id: 'other',
      label: 'Something else',
      summary: 'A community group asks for “anything about beavers”.',
      start: 4 * D + 1100,
      submitted: true,
      task: { name: 'Friends of Alder Run: beaver activity', section: 'New', fields: { 'Data type': 'Other', 'Sensitive locations': 'No', 'Organization type': 'Community group', Site: 'Alder Run' } },
      events: [],
      expect: { section: 'New', assignee: 'mei', paths: ['p-other'] },
    },
  ],
  build: [
    { title: 'Ask the risky question plainly', body: 'A required Yes or No on exact spawning locations, mapped to a field. Wording a partner can’t misread.' },
    { title: 'Trigger', body: 'Task added to this project.' },
    { title: 'Five paths, sensitive first', body: 'Exact locations; then water quality, fish counts and imagery, each also requiring Sensitive locations is No; then No other path is matching.' },
    { title: 'Permissions', body: 'The project is private to the data team and Ben. Partners only see the form and the confirmation email.' },
  ],
  edgeCases: [
    { title: 'A partner answers No but needs locations', body: 'Mei notices while preparing the data and flips Sensitive locations to Yes, then moves it to Needs data-sharing agreement. The rule is on the data, not the form answer.' },
    { title: 'A request from inside the team', body: 'Staff add requests by hand with the same fields, so the same routing applies and nothing bypasses the sensitive check.' },
    { title: 'The data manager is in the field', body: 'Mei’s paths are reassigned to Hana for the week. Two clicks in the automation, and the card shows who it assigns.' },
  ],
  qa: [
    'A Yes request lands in Needs data-sharing agreement with Mei assigned, Ben added and the comment.',
    'Each data type with No lands in In progress with the right person, due in seven days.',
    'Other stays in New with Mei and a three-day due date.',
  ],
  features: ['Forms', 'Form branching', 'Field mapping', 'Automations', 'Check if paths', 'Collaborators', 'Private projects'],
};
