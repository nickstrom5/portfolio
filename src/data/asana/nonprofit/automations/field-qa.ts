import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const fieldQa: Automation = {
  id: 'field-qa',
  number: '02',
  name: 'Field data to QA',
  kicker: 'Uploaded → checked before published',
  tagline: 'Field data can’t reach Published without passing QA; the checks assign themselves.',
  problem:
    'The crew uploaded data and the analyst found out when someone asked for it. Last season a temperature logger with a failed calibration was published for six weeks before anyone noticed, and a university partner had already used it.',
  solution:
    'When Luis drags a survey to Data uploaded, the automation hands it to Hana with three checks as subtasks: the calibration log, outliers against last season, and the GPS points. It moves itself to QA and is due in three days. When Hana marks it complete, a second trigger in the same automation moves it to Published. The one way to Published is through her.',
  automation: {
    name: '02 · Send uploaded field data through QA',
    project: '2026 Field Season',
    triggers: [{ type: 'moved', section: 'Data uploaded' }, { type: 'completed' }],
    actions: [],
    paths: [
      {
        id: 'p-qa-done',
        label: 'QA passed',
        when: [{ type: 'section', is: 'QA' }],
        actions: [{ type: 'move', section: 'Published' }, { type: 'slack', channel: '#data', body: 'Field data passed QA and is published to the monitoring dashboard. Partners with open requests for this site can be sent it now.' }],
      },
      {
        id: 'p-to-qa',
        label: 'Just uploaded',
        when: [{ type: 'section', is: 'Data uploaded' }],
        actions: [
          { type: 'assign', user: 'hana' },
          { type: 'due', days: 3 },
          {
            type: 'subtasks',
            items: [
              { name: 'Check the sonde calibration log for this run', assignee: 'hana' },
              { name: 'Flag outliers against last season at this site', assignee: 'hana' },
              { name: 'Confirm GPS points fall inside the site boundary', assignee: 'hana' },
            ],
          },
          { type: 'move', section: 'QA' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: ['Two triggers that read the section to know which moment it is: just uploaded, or completed while in QA.', 'A task completed anywhere else (a cancelled survey marked done in Planned) takes no path, so it isn’t published by accident.'],
    },
  },
  scenarios: [
    {
      id: 'clean',
      label: 'Clean data',
      summary: 'Luis uploads the Cedar Fork run; Hana’s checks pass on Thursday.',
      start: 1 * D + 540,
      task: { name: 'Cedar Fork: water quality run', section: 'In the field', assignee: 'luis', due: 2, fields: { Site: 'Cedar Fork', Status: 'On track' } },
      events: [{ at: 2 * D + 1020, by: 'luis', type: 'move', section: 'Data uploaded' }, { at: 4 * D + 690, by: 'hana', type: 'complete', note: 'All three checks ticked.' }],
      expect: { section: 'Published', assignee: 'hana', completed: true, paths: ['p-to-qa', 'p-qa-done'] },
    },
    {
      id: 'flagged',
      label: 'A calibration problem',
      summary: 'Hana finds a failed calibration and sends it back instead of completing it.',
      start: 1 * D + 540,
      task: { name: 'Mill Creek: water quality run', section: 'In the field', assignee: 'luis', due: 2, fields: { Site: 'Mill Creek', Status: 'On track' } },
      events: [
        { at: 2 * D + 950, by: 'luis', type: 'move', section: 'Data uploaded' },
        { at: 3 * D + 600, by: 'hana', type: 'comment', body: 'Dissolved oxygen sensor failed post-calibration. Data from this run can’t be used; needs a re-run.' },
        { at: 3 * D + 605, by: 'hana', type: 'assign', user: 'luis' },
        { at: 3 * D + 606, by: 'hana', type: 'move', section: 'Planned' },
      ],
      expect: { section: 'Planned', assignee: 'luis', completed: false, paths: ['p-to-qa'], notFired: [] },
    },
    {
      id: 'cancelled',
      label: 'A cancelled survey',
      summary: 'A survey is cancelled for high water and marked complete in Planned.',
      start: 0 * D + 540,
      task: { name: 'Alder Run: drone imagery', section: 'Planned', assignee: 'luis', due: 3, fields: { Site: 'Alder Run' } },
      events: [{ at: 1 * D + 700, by: 'luis', type: 'complete', note: 'River too high to fly; rescheduled as a new task.' }],
      expect: { section: 'Planned', completed: true },
    },
  ],
  build: [
    { title: 'Two triggers', body: 'Task moved to Data uploaded, and Task is marked complete.' },
    { title: 'Check if reads the section', body: 'In QA and completed: publish. In Data uploaded: start QA. Anywhere else: no path, nothing happens.' },
    { title: 'Checks as subtasks', body: 'Each check is a subtask for Hana, so a skipped check is visible as an open box on the card.' },
    { title: 'Move last', body: 'Moving to QA is the last action, so the card only appears in QA once its checks exist.' },
  ],
  edgeCases: [
    { title: 'Completed with checks still open', body: 'Asana lets a task be completed with open subtasks. Hana’s team agreement is that she doesn’t; the Published column’s List view shows subtask counts, so it’s easy to audit.' },
    { title: 'Re-uploaded after a fix', body: 'Dragging it to Data uploaded again starts a fresh QA with three new subtasks. The old ones stay as the record of the first pass.' },
    { title: 'Bad data found after publishing', body: 'Hana reopens the task and moves it back to QA. Partners who received it are on the matching Data Requests tasks, which is where she warns them.' },
  ],
  qa: [
    'Moving a run to Data uploaded assigns Hana with three subtasks, due in three days, and moves it to QA.',
    'Completing it in QA moves it to Published and posts to #data.',
    'Completing a task in Planned takes no path.',
  ],
  features: ['Section triggers', 'Task is marked complete', 'Multiple triggers', 'Check if paths', 'Subtasks', 'Board view', 'Asana for Slack'],
};
