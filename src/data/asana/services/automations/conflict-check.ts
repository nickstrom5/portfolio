import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const conflictCheck: Automation = {
  id: 'conflict-check',
  number: '02',
  name: 'Conflict check gate',
  kicker: 'No proposal before it’s clear',
  tagline: 'The conflict check is a gate: the searches are assigned, and only a clear result moves the prospect on.',
  problem:
    'Conflict checks happened when someone remembered. In the spring the firm sent a proposal to a business whose former co-owner was already a client in a dispute with it. Nothing went wrong, but only because the partner recognized the name on the call.',
  solution:
    'Moving a prospect to Conflict check hands it to Owen with the three searches as subtasks and a two-day due date. When he sets the Conflict check field, the same automation reads it. Clear moves the prospect to Proposal and back to Sam to draft the fee. Flagged goes to Priya, the managing partner, with a comment, and stays put until she decides. The proposal column only ever holds prospects that passed.',
  automation: {
    name: '02 · Run and gate the conflict check',
    project: 'New Client Intake',
    triggers: [{ type: 'moved', section: 'Conflict check' }, { type: 'field', key: 'Conflict check' }],
    actions: [],
    paths: [
      {
        id: 'p-clear',
        label: 'Clear',
        when: [{ type: 'field', key: 'Conflict check', op: 'is', value: 'Clear' }],
        actions: [{ type: 'move', section: 'Proposal' }, { type: 'assign', user: 'sam' }, { type: 'due', days: 2 }],
      },
      {
        id: 'p-flagged',
        label: 'Flagged',
        when: [{ type: 'field', key: 'Conflict check', op: 'is', value: 'Flagged' }],
        actions: [
          { type: 'assign', user: 'priya' },
          { type: 'due', days: 1 },
          { type: 'comment', body: '@Priya Nair the conflict searches found a possible match. Details are in the subtasks. Decide whether we can act; if not, move this to Not a fit and Owen will send the decline.' },
        ],
      },
      {
        id: 'p-start',
        label: 'Not checked yet',
        when: [],
        actions: [
          { type: 'assign', user: 'owen' },
          { type: 'due', days: 2 },
          {
            type: 'subtasks',
            items: [
              { name: 'Search the business, its owners and officers in the practice management system', assignee: 'owen' },
              { name: 'Search related parties: spouses, other businesses, the other side of any dispute', assignee: 'owen' },
              { name: 'Record the result in the Conflict check field', assignee: 'owen' },
            ],
          },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'Two triggers: moved to Conflict check, and Conflict check changed. The paths sort out which moment it is: no result yet means the check is starting.',
        'Not triggered by other automations, so a task moved by an automation can’t start a second round of searches.',
      ],
    },
  },
  scenarios: [
    {
      id: 'clear',
      label: 'Clear',
      summary: 'Sam moves the bakery to Conflict check after a good call; the searches find nothing.',
      start: 2 * D + 540,
      task: { name: 'Larkspur Bakery LLC', section: 'Discovery call', assignee: 'sam', due: 2, fields: { Service: 'Bookkeeping', 'Entity type': 'LLC', 'Revenue band': 'Under $1M' } },
      events: [
        { at: 2 * D + 900, by: 'sam', type: 'move', section: 'Conflict check', note: 'Straight after the discovery call.' },
        { at: 3 * D + 640, by: 'owen', type: 'field', key: 'Conflict check', value: 'Clear' },
      ],
      expect: { section: 'Proposal', assignee: 'sam', paths: ['p-start', 'p-clear'] },
    },
    {
      id: 'flagged',
      label: 'A possible conflict',
      summary: 'A co-owner of the prospect is on the other side of a client’s dispute.',
      start: 1 * D + 540,
      task: { name: 'Copperline Electric', section: 'Discovery call', assignee: 'sam', due: 1, fields: { Service: 'Bookkeeping', 'Entity type': 'LLC', 'Revenue band': '$1M–$5M' } },
      events: [
        { at: 1 * D + 840, by: 'sam', type: 'move', section: 'Conflict check' },
        { at: 2 * D + 1000, by: 'owen', type: 'field', key: 'Conflict check', value: 'Flagged' },
        { at: 3 * D + 600, by: 'priya', type: 'move', section: 'Not a fit', note: 'Priya decides the firm can’t take it on.' },
      ],
      expect: { section: 'Not a fit', assignee: 'priya', paths: ['p-start', 'p-flagged'] },
    },
    {
      id: 'skipped',
      label: 'Someone tries to skip it',
      summary: 'A partner drags a prospect from Discovery call straight to Proposal.',
      start: 3 * D + 540,
      task: { name: 'Ridgeway Physical Therapy', section: 'Discovery call', assignee: 'marcus', due: 3, fields: { Service: 'Tax', 'Entity type': 'S corp', 'Revenue band': '$1M–$5M' } },
      events: [
        { at: 3 * D + 700, by: 'marcus', type: 'move', section: 'Proposal' },
        { at: 3 * D + 760, by: 'sam', type: 'move', section: 'Conflict check', note: 'Sam’s Monday review: Proposal holds a task with no Conflict check value. He moves it back.' },
      ],
      expect: { section: 'Conflict check', assignee: 'owen', paths: ['p-start'] },
    },
  ],
  build: [
    { title: 'A field as the gate', body: 'Conflict check is a single-select with only Clear and Flagged. Empty means not done, which is what the Check if reads.' },
    { title: 'Two triggers, three paths', body: 'Clear moves on; Flagged goes to Priya; the No other path is matching path is the start, when the field is still empty.' },
    { title: 'Searches as subtasks', body: 'The three searches are subtasks so they show in Owen’s My tasks with the prospect’s name, and the record of who checked what stays on the task.' },
    { title: 'The skip check', body: 'List view of Proposal, grouped by Conflict check. Anything under “No Conflict check” is a skipped gate. Sam looks every Monday.' },
  ],
  edgeCases: [
    { title: 'Someone skips the column', body: 'An automation can’t stop a drag. It makes the gate the easy path, and the Monday view catches the rest, as in the third sample.' },
    { title: 'Flagged, then cleared', body: 'If Priya decides there’s no real conflict, she changes the field to Clear and the prospect moves on to Proposal, with the comment explaining why on record.' },
    { title: 'Run twice', body: 'Moving a task back into Conflict check with a result already set takes the Clear or Flagged path again, not the start. The searches aren’t duplicated.' },
  ],
  qa: [
    'Moving a prospect into Conflict check assigns Owen with three subtasks, due in two days.',
    'Setting Clear moves it to Proposal, assigned to Sam.',
    'Setting Flagged assigns Priya with the comment and doesn’t move it.',
    'A second move into Conflict check with a result already set doesn’t add the subtasks again.',
  ],
  features: ['Custom fields', 'Section triggers', 'Multiple triggers', 'Check if paths', 'Subtasks', 'My tasks', 'List view grouping'],
};
