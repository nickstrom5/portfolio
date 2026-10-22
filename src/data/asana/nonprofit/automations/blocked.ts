import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const blocked: Automation = {
  id: 'blocked',
  number: '03',
  name: 'Blocked and at-risk work',
  kicker: 'Status → the program director',
  tagline: 'A blocked or at-risk task reaches the program director the day it happens, with the reason attached.',
  problem:
    'Field problems surfaced at the monthly program meeting: a washed-out road, an expired permit, a broken boat motor. By then the survey window had closed. Ben, the program director, learned about blockers when it was too late to unblock them.',
  solution:
    'Every field task has a Status field and a one-line Blocker field. When a lead changes Status, the automation reacts. Blocked adds Ben as a collaborator, comments asking for the reason if the Blocker field is empty, and posts to #field-team. At risk adds Ben quietly, so it’s on his radar without an alarm. Back to On track leaves a comment saying so, which closes the loop for everyone following. Ben’s Friday status update for the board is written from these, not from memory.',
  automation: {
    name: '03 · Escalate blocked and at-risk field work',
    project: '2026 Field Season',
    triggers: [{ type: 'field', key: 'Status' }],
    actions: [],
    paths: [
      {
        id: 'p-blocked',
        label: 'Blocked',
        when: [{ type: 'field', key: 'Status', op: 'is', value: 'Blocked' }],
        actions: [
          { type: 'collaborators', users: ['ben'] },
          { type: 'comment', body: '@Ben Hollis this is blocked. The reason is in the Blocker field; if it’s empty, the assignee will fill it in today. Reply here with what you can unblock.' },
          { type: 'slack', channel: '#field-team', body: 'A field task is blocked. Ben is on it; the reason is on the task. Anyone who can help, say so there.' },
        ],
      },
      {
        id: 'p-risk',
        label: 'At risk',
        when: [{ type: 'field', key: 'Status', op: 'is', value: 'At risk' }],
        actions: [{ type: 'collaborators', users: ['ben'] }],
      },
      {
        id: 'p-clear',
        label: 'Back on track',
        when: [],
        actions: [{ type: 'comment', body: 'Back on track. Clear the Blocker field when you have a moment, so the board report stays accurate.' }],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks_and_subtasks',
      notes: ['Runs on subtasks too, because crews often block on one step of a survey, like a permit.', 'Status is a library field shared with every program project, so the portfolio can show blocked work across all of them.'],
    },
  },
  scenarios: [
    {
      id: 'road',
      label: 'A washed-out road',
      summary: 'Luis can’t reach Alder Run; the road reopens Thursday.',
      start: 2 * D + 480,
      task: { name: 'Alder Run: spawning survey #3', section: 'In the field', assignee: 'luis', due: 5, fields: { Site: 'Alder Run', Status: 'On track' } },
      events: [
        { at: 2 * D + 540, by: 'luis', type: 'field', key: 'Blocker', value: 'Access road washed out; county reopening Thursday' },
        { at: 2 * D + 541, by: 'luis', type: 'field', key: 'Status', value: 'Blocked' },
        { at: 2 * D + 700, by: 'ben', type: 'comment', body: 'Called the county. If Thursday holds, survey Friday; I’ve moved the volunteers.' },
        { at: 4 * D + 560, by: 'luis', type: 'field', key: 'Status', value: 'On track', note: 'The road reopened.' },
      ],
      expect: { fields: { Status: 'On track' }, paths: ['p-blocked', 'p-clear'] },
    },
    {
      id: 'risk',
      label: 'A permit running late',
      summary: 'The drone waiver hasn’t been renewed yet; it might be fine.',
      start: 3 * D + 540,
      task: { name: 'Cedar Fork: drone imagery', section: 'Planned', assignee: 'luis', due: 7, fields: { Site: 'Cedar Fork', Status: 'On track' } },
      events: [{ at: 3 * D + 600, by: 'luis', type: 'field', key: 'Status', value: 'At risk' }, { at: 3 * D + 601, by: 'luis', type: 'field', key: 'Blocker', value: 'FAA waiver renewal pending' }],
      expect: { fields: { Status: 'At risk' }, paths: ['p-risk'] },
    },
  ],
  build: [
    { title: 'Two fields', body: 'Status (On track, At risk, Blocked) and Blocker (text). Both in the field library so every program project uses the same ones.' },
    { title: 'Trigger', body: 'Custom field is changed: Status, any value.' },
    { title: 'Three paths', body: 'Blocked: Ben, comment, Slack. At risk: Ben only. No other path is matching: the back-on-track comment.' },
    { title: 'Board report', body: 'The portfolio has a Status column rolled up from each project’s update; Ben filters the field season for Blocked before he writes his.' },
  ],
  edgeCases: [
    { title: 'Ben is the assignee', body: 'Adding him as a collaborator does nothing new and the comment still lands. Harmless.' },
    { title: 'Blocked twice in a day', body: 'Each change to Blocked posts again. That’s right: if it was cleared and blocked again, Ben should know.' },
    { title: 'Nobody updates Status', body: 'The automation can’t see a problem nobody records. The Friday field huddle starts with “anything Blocked that isn’t marked?”.' },
  ],
  qa: [
    'Setting Status to Blocked adds Ben, comments, and posts once to #field-team.',
    'Setting At risk adds Ben and does nothing else.',
    'Setting On track comments once.',
    'It runs on a blocked subtask as well as a task.',
  ],
  features: ['Custom fields', 'Field library', 'Custom field is changed', 'Check if paths', 'Collaborators', 'Status updates', 'Portfolios', 'Asana for Slack'],
};
