import type { Process } from '@/lib/clickup/types';

const D = 1440;
const fields = { Developer: 'mia', Reviewer: 'sofia', 'QA owner': 'noor', 'Pull request': 'https://git.tallyway.example/app/pull/2291', Release: '3.0' };

export const sprint: Process = {
  id: 'sprint',
  number: '02',
  name: 'Sprint board',
  kicker: 'Build, review, test',
  tagline: 'Every status hand-off assigns the next person, a failed test goes straight back with a tag, and a review waiting a day is raised at stand-up.',
  problem:
    'Engineers moved cards to “Review” and then waited for someone to notice. Testers found out a ticket was ready from Slack. A ticket that failed testing went back to a column with no owner, and code reviews of three days or more were normal.',
  solution:
    'Each sprint is a List in a Sprint Folder. Every ticket carries its Developer, Reviewer and QA owner as People fields, so each status change reassigns the next person with a comment. A ticket that fails QA goes back to its developer tagged qa-bounce. At 9:30 each weekday, just before stand-up, any review older than a day is raised with its reviewer.',
  location: { space: 'Product', folder: 'Sprints', list: 'Sprint 14' },
  statuses: [
    { name: 'To do', group: 'not_started', color: '#87909e' },
    { name: 'In progress', group: 'active', color: '#1090e0' },
    { name: 'Code review', group: 'active', color: '#5f55ee' },
    { name: 'QA', group: 'active', color: '#e16b16' },
    { name: 'Done', group: 'done', color: '#008844' },
    { name: 'Released', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Developer', type: 'People' },
    { name: 'Reviewer', type: 'People', note: 'Chosen at sprint planning, never the developer.' },
    { name: 'QA owner', type: 'People' },
    { name: 'Pull request', type: 'URL' },
    { name: 'Release', type: 'Dropdown', options: ['3.0', '3.0.1', 'Later'] },
  ],
  views: [
    { type: 'Board', name: 'Sprint board', note: 'By status, grouped by assignee in swimlanes. The stand-up view.' },
    { type: 'List', name: 'My work', note: 'Me mode: only tasks assigned to the viewer, across the Sprint.' },
    { type: 'Workload', name: 'Sprint capacity', note: 'Sprint Points per person against capacity, used in planning.' },
  ],
  pieces: [
    { kind: 'Sprint', name: 'Two-week Sprints', note: 'Sprint Folder settings: Mondays to Fridays two weeks later, unfinished tasks moved to the next Sprint automatically, Sprint Points on.' },
    { kind: 'Template', name: 'Task template: Engineering ticket', note: 'Description sections (why, acceptance criteria, test notes) and the three People fields, empty, as a reminder.' },
    { kind: 'Doc', name: 'Definition of done', note: 'Reviewed, tested on every platform it touches, release note written.' },
  ],
  automations: [
    {
      id: 'review',
      name: 'Code review: to the reviewer',
      trigger: { type: 'status_changes', to: ['Code review'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'Reviewer' }] },
        { type: 'add_comment', body: '@{{field.Reviewer}} review please: {{task.name}}. Pull request: {{field.Pull request}}' },
      ],
    },
    {
      id: 'qa',
      name: 'QA: to the tester',
      trigger: { type: 'status_changes', to: ['QA'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'QA owner' }] },
        { type: 'change_tags', remove: ['stale-review'] },
        { type: 'add_comment', body: '@{{field.QA owner}} ready to test: {{task.name}}. Test notes are in the description.' },
      ],
    },
    {
      id: 'bounce',
      name: 'Failed QA: back to the developer',
      trigger: { type: 'status_changes', from: ['QA'], to: ['In progress'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'Developer' }] },
        { type: 'change_tags', add: ['qa-bounce'] },
        { type: 'add_comment', body: '@{{field.Developer}} back from QA. What failed is in the comment above.' },
      ],
      note: 'Only QA to In progress counts as a bounce. The tag feeds a Dashboard count of tickets that failed testing at least once.',
    },
    {
      id: 'done',
      name: 'Done: into the release notes',
      trigger: { type: 'status_changes', to: ['Done'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: [{ field: 'Developer' }] },
        { type: 'send_channel_message', channel: '#releases', body: 'Done for {{field.Release}}: {{task.name}}.' },
      ],
      note: 'Back to the developer, who writes the release note before the Sprint closes.',
    },
    {
      id: 'stale',
      name: 'Review waiting over a day',
      trigger: { type: 'every', days: [0, 1, 2, 3, 4], at: '09:30' },
      conditions: [
        { type: 'time_in_status', status: 'Code review', moreThanMinutes: D },
        { type: 'tag', lacks: ['stale-review'] },
      ],
      actions: [
        { type: 'change_tags', add: ['stale-review'] },
        { type: 'add_comment', body: '@{{field.Reviewer}} this review has waited more than a day. Review it today, or hand it on at stand-up.' },
      ],
      note: '9:30, before the 10:00 stand-up, so the comment is fresh when the team meets.',
    },
  ],
  scenarios: [
    {
      id: 'clean',
      label: 'Straight through',
      summary: 'Mia finishes a ticket Monday afternoon; Sofia reviews it next morning and Noor passes it.',
      start: 600,
      task: { name: 'Recurring invoice schedule picker (iOS)', status: 'In progress', assignees: ['mia'], fields },
      events: [
        { at: 360, type: 'status', to: 'Code review', by: 'mia' },
        { at: D + 30, type: 'comment', body: 'Looks good, one nit fixed in a follow-up commit.', by: 'sofia' },
        { at: D + 60, type: 'status', to: 'QA', by: 'sofia' },
        { at: D + 300, type: 'status', to: 'Done', by: 'noor' },
      ],
      expect: { status: 'Done', fires: ['review', 'qa', 'done'], blocks: ['stale'], assignees: ['mia'] },
    },
    {
      id: 'bounce',
      label: 'Fails QA once',
      summary: 'Noor finds the picker breaks on the smallest iPhone. Back to Mia, fixed, reviewed again and passed.',
      start: 600,
      task: { name: 'Recurring invoice schedule picker (iOS)', status: 'In progress', assignees: ['mia'], fields },
      events: [
        { at: 120, type: 'status', to: 'Code review', by: 'mia' },
        { at: 240, type: 'status', to: 'QA', by: 'sofia' },
        { at: 400, type: 'comment', body: 'On iPhone SE the date wheel overlaps the Save button. Screenshot attached.', by: 'noor' },
        { at: 405, type: 'status', to: 'In progress', by: 'noor' },
        { at: D + 60, type: 'status', to: 'Code review', by: 'mia' },
        { at: D + 150, type: 'status', to: 'QA', by: 'sofia' },
        { at: D + 330, type: 'status', to: 'Done', by: 'noor' },
      ],
      expect: { status: 'Done', fires: ['review', 'qa', 'bounce', 'done'], blocks: ['stale'], tags: ['qa-bounce'] },
    },
    {
      id: 'stale',
      label: 'A review that sits',
      summary: 'The review is requested Monday morning and forgotten. Wednesday’s 9:30 check raises it.',
      start: 600,
      task: { name: 'Recurring invoices: skip a month', status: 'In progress', assignees: ['sofia'], fields: { ...fields, Developer: 'sofia', Reviewer: 'arjun', 'Pull request': 'https://git.tallyway.example/app/pull/2297' } },
      events: [
        { at: 60, type: 'status', to: 'Code review', by: 'sofia' },
        { at: 2 * D + 240, type: 'status', to: 'QA', by: 'arjun' },
      ],
      until: 3 * D,
      expect: { status: 'QA', fires: ['review', 'stale', 'qa'], blocks: ['stale'], assignees: ['noor'] },
    },
  ],
  build: [
    { title: 'Sprints ClickApp', body: 'A Sprint Folder with two-week Sprint Lists, Sprint Points, and unfinished tasks moving to the next Sprint when one ends. Burndown and velocity come from the Sprint widgets. These Automations are created on the Sprints Folder, so each new Sprint List has them from day one.' },
    { title: 'People fields for every role', body: 'Developer, Reviewer and QA owner are set at sprint planning. Each hand-off Automation reassigns from a field, so one set of rules serves the whole team.' },
    { title: 'Status as the hand-off', body: 'Moving a card is the only thing anyone does. The Automation changes the assignee and posts the comment with the pull request link, which notifies the next person.' },
    { title: 'A bounce is a specific move', body: 'The failed-QA rule triggers only on QA to In progress, so a developer pausing their own work does not get tagged.' },
    { title: 'Stand-up nudge', body: 'Every weekday at 9:30, Time in Status finds reviews older than a day. The tag means one nudge per review; moving to QA clears it.' },
  ],
  edgeCases: [
    { title: 'What if the reviewer field is empty?', body: 'Change assignees has nobody to assign, so the developer is removed and the card has no owner. The sprint planning checklist includes “every ticket has a Reviewer”, and the Board groups unassigned cards at the top.' },
    { title: 'What if the sprint ends mid-review?', body: 'The Sprint setting moves unfinished tasks to Sprint 15 with their status, fields and tags. The Automations are set on the Sprints Folder, not on one Sprint List, so they apply to every Sprint, including the next one.' },
    { title: 'What if a review goes back for changes?', body: 'The reviewer moves it to In progress. That is not a QA bounce, so no tag; the review comment says what to change.' },
    { title: 'What if a ticket bounces twice?', body: 'The tag is already there. The Dashboard counts tickets with the tag, and the retro looks at the comments.' },
  ],
  qa: [
    'A test ticket through every status: assignee and comment at each step.',
    'QA to In progress tags qa-bounce; Code review to In progress does not.',
    'A ticket in Code review for 25 hours at 9:30: one comment and the stale-review tag; the next morning, nothing.',
    'Closing a Sprint with unfinished tasks: they move to the next Sprint and the Automations still fire there.',
  ],
  features: ['Sprints ClickApp', 'Sprint Points', 'People Custom Fields', 'Status changes with from and to', 'Every… Trigger', 'Time in Status Condition', 'Sprint widgets on Dashboards', 'Me mode'],
};
