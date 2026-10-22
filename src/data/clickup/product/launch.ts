import type { Process } from '@/lib/clickup/types';

const D = 1440;
const deps = ['App Store approval for 3.0', 'Help center articles published', 'Pricing page updated', 'Customer email scheduled'];
const milestone = () => ({
  name: 'Launch: recurring invoices (3.0)',
  status: 'Waiting on dependencies',
  assignees: ['owen'],
  followers: ['grace', 'ines', 'carla'],
  dueDay: 10,
  waitingOn: deps.map((name) => ({ name, done: false })),
  fields: { 'Launch tier': 'Tier 1: email, blog and press', 'Launch brief': '3.0 launch brief (Doc)' },
});

export const launch: Process = {
  id: 'launch',
  number: '03',
  name: 'Launch milestone',
  kicker: 'Dependencies to launch day',
  tagline: 'The launch is one milestone waiting on four teams; when its date moves, everyone hears about it, and a week out it says whether it is at risk.',
  problem:
    'The 2.0 launch was tracked in a spreadsheet of dependencies that was stale within a day. When App Store review slipped, the press email still went out on the old date, and support learned about the launch from customers.',
  solution:
    'The launch is a milestone task in its own Folder, waiting on the engineering, support, web and marketing tasks it depends on, all on one Gantt chart. Moving its date notifies every follower and the launch channel. A week before launch, a milestone still waiting on dependencies is marked at risk. When the last dependency is done it goes to Ready to launch, and marking it Launched closes the Goal and schedules the retro.',
  location: { space: 'Launches', folder: 'Recurring invoices (3.0)', list: 'Launch plan' },
  statuses: [
    { name: 'Waiting on dependencies', group: 'not_started', color: '#87909e' },
    { name: 'Ready to launch', group: 'active', color: '#1090e0' },
    { name: 'Launching', group: 'active', color: '#5f55ee' },
    { name: 'Launched', group: 'done', color: '#008844' },
    { name: 'Cancelled', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Launch tier', type: 'Dropdown', options: ['Tier 1: email, blog and press', 'Tier 2: email and blog', 'Tier 3: changelog only'] },
    { name: 'Launch brief', type: 'Relationship', note: 'Links the milestone to the 3.0 launch brief Doc.' },
    { name: 'Launched on', type: 'Date', note: 'Set by Automation.' },
  ],
  views: [
    { type: 'Gantt', name: 'Launch timeline', note: 'Every task in the Folder with dependency arrows and the critical path. The milestone shows as a diamond.' },
    { type: 'Timeline', name: 'By team', note: 'The same tasks in swimlanes by assignee, for the weekly launch meeting.' },
    { type: 'List', name: 'Dependencies', note: 'Tasks blocking the milestone, sorted by due date.' },
  ],
  pieces: [
    { kind: 'Dependency', name: 'The milestone waits on 4 tasks', note: deps.join(', ') + '.' },
    { kind: 'Template', name: 'Folder template: Launch', note: 'Launch plan and Launch content Lists, the milestone with its task type, and these Automations.' },
    { kind: 'Doc', name: '3.0 launch brief', note: 'Linked to the milestone through the Launch brief Relationship field.' },
  ],
  automations: [
    {
      id: 'moved',
      name: 'Launch date moved: tell everyone',
      trigger: { type: 'due_date_changes' },
      actions: [
        { type: 'add_comment', body: '@followers the launch date for {{task.name}} is now {{task.due}}. Check your tasks in the Launch timeline; anything with a fixed date (press, emails) needs moving by hand.' },
        { type: 'send_channel_message', channel: '#launch-3-0', body: 'New launch date: {{task.due}}.' },
      ],
      note: 'Comments can @mention all followers at once, so the people who follow the milestone are exactly the people told.',
    },
    {
      id: 'at-risk',
      name: 'One week out, still waiting',
      trigger: { type: 'date_before_after', date: 'due', days: 7, when: 'before' },
      conditions: [{ type: 'status', is: ['Waiting on dependencies'] }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'change_tags', add: ['at-risk'] },
        { type: 'add_comment', body: '@Owen Marsh {{task.name}} is a week away and still waiting on dependencies. Decide today: hold the date or move it.' },
      ],
    },
    {
      id: 'ready',
      name: 'All dependencies done: ready to launch',
      trigger: { type: 'unblocked' },
      actions: [
        { type: 'change_status', to: 'Ready to launch' },
        { type: 'change_tags', remove: ['at-risk'] },
        { type: 'change_priority', to: 'High' },
        { type: 'add_comment', body: '@Grace Kim every dependency for {{task.name}} is done. Launch day is {{task.due}}; the run of show is in the launch brief.' },
      ],
    },
    {
      id: 'launched',
      name: 'Launched: record it and book the retro',
      trigger: { type: 'status_changes', to: ['Launched'] },
      actions: [
        { type: 'update_custom_field', field: 'Launched on', onTriggerDate: true },
        { type: 'create_task', name: 'Launch retro: recurring invoices (3.0)', list: 'Launches / Recurring invoices (3.0) / Launch plan', relationship: 'Task relationship' },
        { type: 'send_channel_message', channel: '#general', body: 'Recurring invoices is live for every Tallyway customer. Thank you, everyone.' },
      ],
      note: 'Closing the milestone also completes the Goal’s task target, which is linked to it.',
    },
  ],
  scenarios: [
    {
      id: 'on-time',
      label: 'Everything lands on time',
      summary: 'All four dependencies are done in the first week, the at-risk check stays quiet, and Grace launches on the day.',
      start: 540,
      task: milestone(),
      events: [
        { at: 120, type: 'blocker_done', name: deps[2] },
        { at: D + 200, type: 'blocker_done', name: deps[1] },
        { at: 2 * D - 540 + 1020, type: 'blocker_done', name: deps[0] },
        { at: 2 * D + 120, type: 'blocker_done', name: deps[3] },
        { at: 10 * D, type: 'status', to: 'Launching', by: 'grace' },
        { at: 10 * D + 120, type: 'status', to: 'Launched', by: 'owen' },
      ],
      expect: { status: 'Launched', fires: ['ready', 'launched'], blocks: ['at-risk'] },
    },
    {
      id: 'slips',
      label: 'App Store review slips',
      summary: 'Apple rejects the first build. A week out the launch is flagged at risk, Owen moves it four days, and it lands on the new date.',
      start: 540,
      task: milestone(),
      events: [
        { at: 120, type: 'blocker_done', name: deps[2] },
        { at: D + 200, type: 'blocker_done', name: deps[1] },
        { at: 2 * D + 120, type: 'blocker_done', name: deps[3] },
        { at: 3 * D + 60, type: 'note', text: 'App Store review rejects the build: a missing privacy label' },
        { at: 3 * D + 240, type: 'due', day: 14, by: 'owen' },
        { at: 8 * D + 600, type: 'blocker_done', name: deps[0] },
        { at: 14 * D, type: 'status', to: 'Launching', by: 'grace' },
        { at: 14 * D + 120, type: 'status', to: 'Launched', by: 'owen' },
      ],
      expect: { status: 'Launched', fires: ['at-risk', 'moved', 'ready', 'launched'], priority: 'High' },
    },
  ],
  build: [
    { title: 'A milestone task', body: 'The launch is one task with the Milestone task type, so Gantt draws it as a diamond and it can carry the Goal’s task target.' },
    { title: 'Dependencies across teams', body: 'Engineering, support, web and marketing tasks each block the milestone. ClickUp’s Task or subtask unblocked fires once the last one closes.' },
    { title: 'Date changes broadcast', body: 'Due date changes posts one comment that @mentions every follower and one message to the launch channel. Nobody learns the new date second-hand.' },
    { title: 'A decision a week out', body: 'Date is Before/After, seven days before the due date, with a Status Condition: only a launch still waiting on dependencies is flagged.' },
    { title: 'Closing ties back to the Goal', body: 'Launched stamps the date, creates the retro task linked to the milestone, and completes the Goal target that points at it.' },
  ],
  edgeCases: [
    { title: 'What if the launch moves twice?', body: 'Each move fires the broadcast again, and the at-risk check follows the newest date. Followers see the history in the comments.' },
    { title: 'What if a dependency is added late?', body: 'Adding a blocking task makes the milestone blocked again, but its status does not change by itself. Owen moves it back to Waiting on dependencies; the next unblock fires as normal.' },
    { title: 'What if the launch is cancelled?', body: 'Cancelled is a Closed status. The at-risk Condition checks the status, so it stays quiet; the date-change broadcast still fires if someone clears the date, which is a useful record.' },
    { title: 'What if the at-risk flag fires but the date holds?', body: 'The Urgent priority and tag stay until the last dependency is done; the ready Automation removes the tag and sets High.' },
  ],
  qa: [
    'Closing the four dependencies in different orders: Ready to launch only after the last.',
    'Moving the due date: one follower comment, one channel message, and the at-risk check re-dated.',
    'A milestone seven days out in each status: only Waiting on dependencies is flagged.',
    'Launched: date stamped, retro task created and linked, Goal target complete.',
  ],
  features: ['Milestones (task types)', 'Dependencies', 'Task or subtask unblocked', 'Due date changes', 'Date is Before/After', '@followers in comments', 'Goals with task targets', 'Gantt and Timeline views', 'Relationship fields'],
};
