/**
 * Case study 3: a software product team running bugs, sprints, a launch and
 * customer feedback in ClickUp. Fictional company, people, product and links
 * (.example domains cannot resolve).
 */
import type { Workspace } from '@/lib/clickup/types';

export const workspace: Workspace = {
  id: 'product',
  name: 'Tallyway',
  industry: 'Product team',
  area: 'A 9-person team, remote across the US and Canada',
  blurb: 'An invoicing app for freelancers: bug reports triaged by severity, a two-week sprint where every hand-off assigns the next person, a launch that tracks its own dependencies, and feature requests that close the loop with customers.',
  intro:
    'Tallyway makes invoicing software for freelancers, on the web and on phones, and ships in two-week sprints. Support reported bugs in Slack threads that engineers missed, code reviews waited days, and the big spring launch had a spreadsheet of dependencies that was out of date the day it was made. The head of product wanted the whole product cycle in one Workspace, with each hand-off automatic and each delay visible.',
  disclaimer: 'Tallyway is a fictional company. The people, releases, dates and links are samples.',
  team: [
    { key: 'owen', name: 'Owen Marsh', role: 'Head of product (owns ClickUp)' },
    { key: 'ines', name: 'Ines Duarte', role: 'Engineering lead, runs bug triage' },
    { key: 'arjun', name: 'Arjun Mehta', role: 'Backend engineer, on call this sprint' },
    { key: 'mia', name: 'Mia Kowalski', role: 'iOS engineer' },
    { key: 'sofia', name: 'Sofia Lind', role: 'Web engineer' },
    { key: 'noor', name: 'Noor Haddad', role: 'QA engineer' },
    { key: 'felix', name: 'Felix Brandt', role: 'Product designer' },
    { key: 'carla', name: 'Carla Reyes', role: 'Support lead' },
    { key: 'grace', name: 'Grace Kim', role: 'Marketing lead' },
  ],
  hierarchy: [
    {
      space: 'Product',
      note: 'Engineering, design and product. Support can create and comment.',
      folders: [{ name: 'Sprints', lists: ['Sprint 14', 'Sprint 15'] }],
      lists: ['Bug Inbox', 'Backlog', 'Feature Requests'],
    },
    { space: 'Launches', note: 'One Folder per launch, from the Launch Folder template.', folders: [{ name: 'Recurring invoices (3.0)', lists: ['Launch plan', 'Launch content'] }], lists: [] },
  ],
  dashboard: {
    name: 'Product health',
    note: 'Opened at the start of sprint planning and the Friday demo.',
    widgets: [
      { title: 'Sprint burndown', type: 'Sprint widget', note: 'Sprint Points remaining in the current Sprint against the ideal line.' },
      { title: 'Velocity', type: 'Sprint widget', note: 'Points completed in the last six Sprints, for planning the next.' },
      { title: 'Open bugs by severity', type: 'Bar chart', note: 'Bug Inbox and the current Sprint, grouped by Severity.' },
      { title: 'Reviews waiting', type: 'Task List', note: 'Status Code review, with time in status, longest first.' },
      { title: 'Most-requested features', type: 'Table', note: 'Feature Requests sorted by the Customer requests field.' },
    ],
  },
  goals: [
    {
      name: 'Q2 · Ship recurring invoices',
      note: 'Owned by Owen. The task target is linked to the launch milestone.',
      targets: [
        { name: 'Launch milestone closed', type: 'Task', target: '1 task' },
        { name: 'Customers using recurring invoices', type: 'Number', target: '2,000' },
      ],
    },
    {
      name: 'Q2 · Quality',
      note: 'Owned by Ines.',
      targets: [
        { name: 'S1 bugs fixed within 24 hours', type: 'Number', target: '100%' },
        { name: 'Bug Inbox empty at every sprint planning', type: 'True/False', target: 'Done' },
      ],
    },
  ],
  docs: [
    { name: 'Severity guide', note: 'What S1 to S4 mean, with examples. Linked from the bug Form.' },
    { name: '3.0 launch brief', note: 'Goals, audience, messaging and the launch-day run of show. Linked to the launch milestone.' },
    { name: 'Definition of done', note: 'Reviewed, tested on every platform, release notes written. The sprint statuses follow it.' },
  ],
  handoff: {
    triage: 'Report → triaged by severity',
    sprint: 'In progress → reviewed → tested',
    launch: 'Dependencies → launch day',
    requests: 'Customer ask → planned or declined',
  },
  tint: { light: '#c2410c', dark: '#fdba74' },
};
