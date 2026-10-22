import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const reviewHandoff: Automation = {
  id: 'review-handoff',
  number: '03',
  name: 'Brand review hand-off',
  kicker: 'In review → the brand manager',
  tagline: 'Moving a card to In review hands it to the brand manager with a deadline.',
  problem:
    'Makers finished work and said so in a comment, which Marisol, the brand manager, saw when she happened to open the task. Review took anywhere from an hour to a week, and rush work waited in the same line as everything else.',
  solution:
    'Dragging a card into In review is the only step a maker takes. The automation reassigns the task to Marisol, so it shows up in her My tasks, and leaves a comment explaining how to give feedback on the proof. Then it checks Priority: high-priority work is due tomorrow, everything else in two days. If Marisol sends it back, the maker drags it into In review again and the hand-off repeats.',
  automation: {
    name: '03 · Hand finished work to brand review',
    project: 'Creative Requests',
    triggers: [{ type: 'moved', section: 'In review' }],
    actions: [
      { type: 'assign', user: 'marisol' },
      { type: 'comment', body: '@Marisol Grant ready for brand review. Comment on the proof itself: each note becomes a subtask for the maker. Approve by moving the card to Approved, or send it back to In progress.' },
    ],
    paths: [
      { id: 'p-high', label: 'High priority', when: [{ type: 'field', key: 'Priority', op: 'is', value: 'High' }], actions: [{ type: 'due', days: 1 }] },
      { id: 'p-normal', label: 'Everything else', when: [], actions: [{ type: 'due', days: 2 }] },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['A section trigger: the lightning bolt shows on the In review column in Board view, so the team can see that moving a card does something.', 'Reassigning rather than adding a collaborator is deliberate: the task should be on exactly one person’s list at a time.'],
    },
  },
  scenarios: [
    {
      id: 'standard',
      label: 'Standard review',
      summary: 'Jun finishes the carousel and drags it to In review.',
      start: 1 * D + 540,
      task: { name: 'Instagram carousel: layering 101', section: 'In progress', assignee: 'jun', due: 3, fields: { 'Request type': 'Social graphic', Priority: 'Medium' } },
      events: [{ at: 2 * D + 940, by: 'jun', type: 'move', section: 'In review' }],
      expect: { section: 'In review', assignee: 'marisol', paths: ['p-normal'] },
    },
    {
      id: 'rush',
      label: 'Rush work',
      summary: 'A high-priority banner set needs review by tomorrow.',
      start: 3 * D + 540,
      task: { name: 'REI co-op banner set', section: 'In progress', assignee: 'jun', due: 4, fields: { 'Request type': 'Social graphic', Priority: 'High' } },
      events: [{ at: 3 * D + 870, by: 'jun', type: 'move', section: 'In review' }],
      expect: { section: 'In review', assignee: 'marisol', paths: ['p-high'] },
    },
    {
      id: 'sent-back',
      label: 'Sent back once',
      summary: 'Marisol asks for a bigger logo; Jun fixes it and sends it again.',
      start: 1 * D + 540,
      task: { name: 'Holiday gift guide: email header', section: 'In progress', assignee: 'jun', due: 4, fields: { 'Request type': 'Email', Priority: 'Medium' } },
      events: [
        { at: 1 * D + 960, by: 'jun', type: 'move', section: 'In review' },
        { at: 2 * D + 610, by: 'marisol', type: 'comment', body: 'Logo needs to be bigger on mobile. One note on the proof.' },
        { at: 2 * D + 615, by: 'marisol', type: 'assign', user: 'jun' },
        { at: 2 * D + 616, by: 'marisol', type: 'move', section: 'In progress' },
        { at: 2 * D + 830, by: 'jun', type: 'move', section: 'In review' },
        { at: 3 * D + 570, by: 'marisol', type: 'move', section: 'Approved' },
      ],
      expect: { section: 'Approved', assignee: 'marisol', paths: ['p-normal'] },
    },
  ],
  build: [
    { title: 'Trigger', body: 'Task moved to a section: In review. Built from the section’s lightning bolt so it sits with the column.' },
    { title: 'Always', body: 'Set assignee to Marisol, then Add comment with the proofing instructions, before the Check if.' },
    { title: 'Check if', body: 'Priority is High: due tomorrow. No other path is matching: due in two days.' },
    { title: 'Proofing', body: 'Makers attach the proof as an image or PDF. Marisol’s comments on it become subtasks, so feedback is a checklist instead of a paragraph.' },
  ],
  edgeCases: [
    { title: 'Marisol is out', body: 'Swap the assignee action to Dana for the week. One edit; the automation shows who it assigns on its card.' },
    { title: 'A card skips In review', body: 'Dragged straight to Approved, it never reaches Marisol. Its Brand check subtask is still open, which stands out in List view, and Ava sends it back.' },
    { title: 'The due date gets earlier, never later', body: 'A rush review due tomorrow overwrites the old due date. If the requester’s date was sooner, Ava fixes it by hand; the automation only ever sets the review deadline.' },
  ],
  qa: [
    'A medium-priority card moved to In review is assigned to Marisol, due in two days, with the comment.',
    'A high-priority card is due tomorrow.',
    'Moving back to In progress does nothing; moving to In review again repeats the hand-off.',
  ],
  features: ['Section triggers', 'Board view', 'Automations', 'Check if paths', 'Comments', 'Proofing', 'My tasks'],
};
