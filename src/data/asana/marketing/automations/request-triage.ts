import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const requestTriage: Automation = {
  id: 'request-triage',
  number: '01',
  name: 'Request triage',
  kicker: 'Form → the right maker',
  tagline: 'Every request lands with an owner, a due date and its checklist before anyone opens it.',
  problem:
    'Requests arrived in four places and sat until Ava, the creative lead, sorted them by hand, usually on Monday morning. A video request waited three days for someone to notice it needed a shoot. Half the requests came without the one detail that decides who makes them.',
  solution:
    'The form makes Request type required and maps it to a custom field. The moment a request lands, one automation checks that field and sends it down one of four paths: video to Theo with a 10-day due date and the four production steps as subtasks, design work to Jun with five days and a brand check, copy to Inés with three days, and anything marked Other to Needs info with a comment saying who will follow up. The board is sorted before Ava opens it.',
  automation: {
    name: '01 · Route new requests by type',
    project: 'Creative Requests',
    triggers: [{ type: 'added' }],
    actions: [],
    paths: [
      {
        id: 'p-video',
        label: 'Video',
        when: [{ type: 'field', key: 'Request type', op: 'is', value: 'Video' }],
        actions: [
          { type: 'assign', user: 'theo' },
          { type: 'due', days: 10 },
          { type: 'subtasks', items: [{ name: 'Script and shot list', assignee: 'ines' }, { name: 'Shoot plan', assignee: 'theo' }, { name: 'Edit v1', assignee: 'theo' }, { name: 'Captions and cutdowns', assignee: 'theo' }] },
          { type: 'move', section: 'Queued' },
        ],
      },
      {
        id: 'p-design',
        label: 'Design',
        when: [{ type: 'field', key: 'Request type', op: 'is_any', value: ['Social graphic', 'Email', 'Landing page'] }],
        actions: [
          { type: 'assign', user: 'jun' },
          { type: 'due', days: 5 },
          { type: 'subtasks', items: [{ name: 'First draft', assignee: 'jun' }, { name: 'Brand check', assignee: 'marisol' }] },
          { type: 'move', section: 'Queued' },
        ],
      },
      {
        id: 'p-copy',
        label: 'Copy only',
        when: [{ type: 'field', key: 'Request type', op: 'is', value: 'Copy only' }],
        actions: [
          { type: 'assign', user: 'ines' },
          { type: 'due', days: 3 },
          { type: 'move', section: 'Queued' },
        ],
      },
      {
        id: 'p-other',
        label: 'Anything else',
        when: [],
        actions: [
          { type: 'assign', user: 'ava' },
          { type: 'move', section: 'Needs info' },
          { type: 'comment', body: 'This request is marked Other, so it can’t be routed yet. Ava will reply here within one business day to agree the format, then move it to Queued.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'Off for “Can be triggered by other automations”: only a new request should be routed, never a task another automation moved.',
        'The paths are written so no two can match the same task, so their order never matters.',
        'Due dates are set as “in N days” from the moment the request lands. Ava adjusts by hand when the requester’s Needed by date is sooner.',
      ],
    },
  },
  scenarios: [
    {
      id: 'video',
      label: 'A video request',
      summary: 'Kai asks for a 15-second product video for the email launch.',
      start: 1 * D + 612,
      submitted: true,
      task: { name: 'Trail pack 30L: 15s product video', section: 'New requests', requester: 'kai', fields: { 'Request type': 'Video', Rush: 'No', 'Requesting team': 'Ecommerce' } },
      events: [],
      expect: { section: 'Queued', assignee: 'theo', paths: ['p-video'] },
    },
    {
      id: 'design',
      label: 'An email header',
      summary: 'Ecommerce needs a header for the holiday gift guide.',
      start: 2 * D + 905,
      submitted: true,
      task: { name: 'Holiday gift guide: email header', section: 'New requests', requester: 'kai', fields: { 'Request type': 'Email', Rush: 'No', 'Requesting team': 'Ecommerce' } },
      events: [],
      expect: { section: 'Queued', assignee: 'jun', paths: ['p-design'] },
    },
    {
      id: 'copy',
      label: 'Copy only',
      summary: 'The founders want a note for the launch landing page.',
      start: 3 * D + 560,
      submitted: true,
      task: { name: 'Founders’ note: launch landing copy', section: 'New requests', fields: { 'Request type': 'Copy only', Rush: 'No', 'Requesting team': 'Founders' } },
      events: [],
      expect: { section: 'Queued', assignee: 'ines', paths: ['p-copy'] },
    },
    {
      id: 'other',
      label: 'Something unusual',
      summary: 'Retail asks for a shelf talker, which fits none of the types.',
      start: 4 * D + 680,
      submitted: true,
      task: { name: 'Retail partner shelf talker', section: 'New requests', fields: { 'Request type': 'Other', Rush: 'No', 'Requesting team': 'Retail' } },
      events: [{ at: 5 * D + 2 * D + 540, by: 'ava', type: 'comment', body: 'Talked to Retail: it’s a printed card. Treating it as a design job.', note: 'A person picks it up on Monday, as the comment promised.' }],
      expect: { section: 'Needs info', assignee: 'ava', paths: ['p-other'] },
    },
  ],
  build: [
    { title: 'Fields first', body: 'Request type as a single-select with exactly the form’s options, so a renamed option can’t silently break a path. Added to the library so the launch project reports on the same values.' },
    { title: 'Map the form', body: 'Request type required, mapped to the field. Task name from the first question.' },
    { title: 'Trigger', body: 'Task added to this project. Form submissions count, and so does a task someone adds by hand, which is what we want: the board has one way in.' },
    { title: 'Check if, four paths', body: 'Video, Design (is any of Social graphic, Email, Landing page), Copy only, and a No other path is matching path for Other, so nothing can fall through unrouted.' },
    { title: 'Actions per path', body: 'Assignee, due date, subtasks, then Move to Queued last, so the card only appears in Queued once it is complete.' },
    { title: 'Test, then publish', body: 'One test submission per request type from a private window, checked against the automation’s run history.' },
  ],
  edgeCases: [
    { title: 'Someone adds a task by hand', body: 'It is routed the same way if Request type is set. If it isn’t, it goes to Needs info, which is the nudge to use the form.' },
    { title: 'A request type is added later', body: 'A new option, say Podcast, matches no path and lands in Needs info until a path is added. That is the safe failure.' },
    { title: 'The maker is on holiday', body: 'Change the assignee in one path while they are out. The automation doesn’t know about time off; Workload does, and Ava checks it on Mondays.' },
    { title: 'A duplicate submission', body: 'Both tasks are routed. The second is merged by hand (Mark as duplicate), which keeps comments and followers.' },
  ],
  qa: [
    'One submission per request type ends in the right section with the right assignee.',
    'Video requests get exactly four subtasks, with Script assigned to Inés.',
    'Other lands in Needs info, assigned to Ava, with the comment.',
    'A task moved into the project from another project is routed too.',
    'Run history shows one run per submission, never two.',
  ],
  features: ['Forms', 'Field mapping', 'Custom fields', 'Automations', 'Check if paths', 'Subtasks', 'Sections', 'Board view'],
};
