import type { Process } from '@/lib/clickup/types';

const D = 1440;
const steps = ['Move-out inspection', 'Repairs and paint', 'Deep clean', 'Carpet or floor care', 'Rekey the locks', 'Final walk-through'];
const fields = (scope: string) => ({ Property: 'Birch Commons', Unit: '12C', 'Turn scope': scope, 'Market rent': '$1,450' });

export const turnover: Process = {
  id: 'turnover',
  number: '02',
  name: 'Unit turnover',
  kicker: 'Notice to ready-to-show',
  tagline: 'One task per vacating apartment: the six-step turn arrives as subtasks, starts on move-out day and hands itself to leasing when the last step is done.',
  problem:
    'Every empty apartment costs about $48 a day in lost rent. Turns took anywhere from 6 to 19 days because each one started from memory: the painter was booked late, the locks were not rekeyed, and leasing found out an apartment was ready only when someone happened to mention it.',
  solution:
    'When a resident gives notice, the leasing agent creates one task with the move-out date as its start date and the target ready date as its due date. An Automation applies the Unit turn template, so the six steps arrive as subtasks for the maintenance supervisor. On move-out day the turn starts itself. When the last subtask is closed, the apartment is added to the Available Units List and handed to leasing. A heavy turn alerts the director, and an overdue one alerts the whole team.',
  location: { space: 'Leasing', list: 'Unit Turns' },
  statuses: [
    { name: 'Notice received', group: 'not_started', color: '#87909e' },
    { name: 'Turn in progress', group: 'active', color: '#5f55ee' },
    { name: 'Ready to show', group: 'done', color: '#008844' },
    { name: 'Leased', group: 'closed', color: '#1090e0' },
    { name: 'Notice withdrawn', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Property', type: 'Dropdown', options: ['Cedar Row Flats', 'Maple Court', 'The Linden', 'Birch Commons'] },
    { name: 'Unit', type: 'Text' },
    { name: 'Turn scope', type: 'Dropdown', options: ['Light', 'Standard', 'Heavy'], note: 'Set by Ray after the move-out inspection.' },
    { name: 'Market rent', type: 'Money', private: true, note: 'For the Dashboard’s “rent lost while vacant” figure.' },
    { name: 'Turn cost', type: 'Money', private: true },
  ],
  views: [
    { type: 'Gantt', name: 'Turn schedule', note: 'Each turn from move-out to ready date, with its subtasks. Overlapping turns show where the painter is double-booked.' },
    { type: 'Board', name: 'Turns', note: 'By status, cards showing subtask progress.' },
    { type: 'Calendar', name: 'Move-outs', note: 'Start dates on a calendar, shared with resident services.' },
  ],
  pieces: [
    { kind: 'Template', name: 'Task template: Unit turn', note: `Six subtasks: ${steps.join(', ')}, each with its own checklist.` },
    { kind: 'ClickApp', name: 'Tasks in Multiple Lists', note: 'Lets a ready apartment also appear in Available Units without leaving Unit Turns.' },
    { kind: 'Doc', name: 'Turn standard', note: 'What Light, Standard and Heavy mean, with photos.' },
  ],
  automations: [
    {
      id: 'template',
      name: 'New turn: apply the six steps',
      appliesTo: 'tasks',
      trigger: { type: 'task_created' },
      actions: [
        { type: 'apply_template', template: 'Unit turn', subtasks: steps },
        { type: 'change_assignees', mode: 'reassign', to: ['ray'] },
        { type: 'change_followers', add: ['devon'] },
      ],
      note: 'The Trigger applies to tasks only. Set to subtasks too, the template’s six new subtasks would each count as a created task and could start a loop.',
    },
    {
      id: 'move-out',
      name: 'Move-out day: start the turn',
      trigger: { type: 'start_date_arrives' },
      conditions: [{ type: 'status', is: ['Notice received'] }],
      actions: [
        { type: 'change_status', to: 'Turn in progress' },
        { type: 'add_comment', body: '@Ray Okoye {{field.Property}} {{field.Unit}} is empty from today. Move-out inspection first, then set Turn scope. Target ready date: {{task.due}}.' },
      ],
    },
    {
      id: 'heavy',
      name: 'Heavy turn: tell the director',
      trigger: { type: 'custom_field_changes', field: 'Turn scope', to: ['Heavy'] },
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'change_followers', add: ['rosa'] },
        { type: 'add_comment', body: '@Rosa Delgado heavy turn at {{field.Property}} {{field.Unit}}: expect more than the standard week and a bigger budget. Photos are on the inspection subtask.' },
      ],
    },
    {
      id: 'ready',
      name: 'Last step done: hand it to leasing',
      trigger: { type: 'subtasks_resolved' },
      actions: [
        { type: 'change_status', to: 'Ready to show' },
        { type: 'add_to_list', list: 'Leasing / Available Units' },
        { type: 'change_assignees', mode: 'reassign', to: ['devon'] },
        { type: 'add_comment', body: '@Devon Price {{field.Property}} {{field.Unit}} is ready to show. Photos and the listing today, please.' },
      ],
      note: 'Add to List keeps the task in Unit Turns too, so its history stays in one place.',
    },
    {
      id: 'overdue',
      name: 'Turn overdue',
      trigger: { type: 'date_before_after', date: 'due', days: 1, when: 'after' },
      conditions: [{ type: 'status', is: ['Turn in progress'] }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'send_channel_message', channel: '#operations', body: 'Turn overdue: {{field.Property}} {{field.Unit}} was due {{task.due}}. Ray, what is left?' },
      ],
    },
  ],
  scenarios: [
    {
      id: 'standard',
      label: 'A standard turn, on time',
      summary: 'Notice on Monday, move-out on Wednesday, ready the following Monday, two days early.',
      start: 540,
      created: 'manual',
      task: { name: 'Turn: Birch Commons 12C', creator: 'devon', startDay: 2, dueDay: 9, fields: fields('Standard') },
      events: [
        { at: 2 * D + 120, type: 'subtask_done', name: steps[0], by: 'ray' },
        { at: 2 * D + 150, type: 'field', field: 'Turn scope', value: 'Standard', by: 'ray' },
        { at: 4 * D + 480, type: 'subtask_done', name: steps[1], by: 'marcus' },
        { at: 5 * D + 180, type: 'subtask_done', name: steps[2], by: 'ray' },
        { at: 5 * D + 300, type: 'subtask_done', name: steps[3], by: 'ray' },
        { at: 6 * D + 90, type: 'subtask_done', name: steps[4], by: 'marcus' },
        { at: 7 * D + 60, type: 'subtask_done', name: steps[5], by: 'ray' },
      ],
      until: 11 * D,
      expect: { status: 'Ready to show', fires: ['template', 'move-out', 'ready'], blocks: ['overdue'], assignees: ['devon'] },
    },
    {
      id: 'heavy',
      label: 'A heavy turn that runs late',
      summary: 'Water damage under the kitchen floor. Ray marks it Heavy, the turn misses its date, and the team is told.',
      start: 540,
      created: 'manual',
      task: { name: 'Turn: Birch Commons 12C', creator: 'devon', startDay: 2, dueDay: 9, fields: fields('Standard') },
      events: [
        { at: 2 * D + 120, type: 'subtask_done', name: steps[0], by: 'ray' },
        { at: 2 * D + 150, type: 'field', field: 'Turn scope', value: 'Heavy', by: 'ray' },
        { at: 8 * D + 480, type: 'subtask_done', name: steps[1], by: 'marcus' },
        { at: 10 * D + 180, type: 'subtask_done', name: steps[3], by: 'ray' },
        { at: 11 * D + 120, type: 'subtask_done', name: steps[2], by: 'ray' },
        { at: 11 * D + 200, type: 'subtask_done', name: steps[4], by: 'marcus' },
        { at: 11 * D + 300, type: 'subtask_done', name: steps[5], by: 'ray' },
      ],
      expect: { status: 'Ready to show', fires: ['template', 'move-out', 'heavy', 'overdue', 'ready'], priority: 'Urgent', assignees: ['devon'] },
    },
    {
      id: 'withdrawn',
      label: 'The resident decides to stay',
      summary: 'The resident renews the day after giving notice. Devon withdraws the turn; move-out day passes quietly.',
      start: 540,
      created: 'manual',
      task: { name: 'Turn: Birch Commons 12C', creator: 'devon', startDay: 2, dueDay: 9, fields: fields('Standard') },
      events: [
        { at: D + 300, type: 'note', text: 'The resident signs a renewal' },
        { at: D + 310, type: 'status', to: 'Notice withdrawn', by: 'devon' },
      ],
      until: 3 * D,
      expect: { status: 'Notice withdrawn', fires: ['template'], blocks: ['move-out'] },
    },
  ],
  build: [
    { title: 'Dates carry the plan', body: 'Start date is move-out day; due date is the target ready date, usually seven days later. Start date arrives and Date is Before/After then run the schedule.' },
    { title: 'Template on creation, tasks only', body: 'Task or subtask created, limited to tasks, applies the Unit turn template. The help center warns that templates with subtasks can loop when subtasks also trigger; limiting the Trigger prevents it.' },
    { title: 'Subtasks resolved as the finish line', body: 'When the sixth subtask closes, the parent is marked Ready to show, added to Available Units and handed to leasing. Nobody has to notice.' },
    { title: 'Scope as a signal', body: 'Turn scope set to Heavy is a Custom Field changes Trigger: priority High and the director as a follower, with a comment pointing at the inspection photos.' },
    { title: 'Tasks in Multiple Lists', body: 'The ClickApp lets the same task appear in Available Units, which is the leasing team’s whole world, without moving it out of Unit Turns.' },
  ],
  edgeCases: [
    { title: 'What if the resident moves out early?', body: 'Devon changes the start date to the real move-out day; Start date arrives fires on the new date. If the new date is today, Ray starts the turn by hand.' },
    { title: 'What if a step is not needed?', body: 'Ray closes that subtask with a comment such as “carpet is fine”. Subtasks resolved only counts that every subtask is closed.' },
    { title: 'What if a subtask is reopened after the apartment is Ready to show?', body: 'The parent stays Ready to show; Ray @mentions Devon so showings pause. Subtasks resolved fires again when it closes, which re-sends the comment but changes nothing else.' },
    { title: 'What if the resident decides to stay?', body: 'Devon moves the task to Notice withdrawn. The move-out day and overdue Automations both check the status, so they stay quiet.' },
  ],
  qa: [
    'Creating a turn by hand: six subtasks, Ray assigned, Devon following, and no extra tasks created.',
    'A start date of tomorrow: the turn starts at 4 AM.',
    'Turn scope set to Light, Standard and Heavy: only Heavy alerts Rosa.',
    'Closing the subtasks in any order: Ready to show only after the last one, and the task appears in Available Units.',
    'A turn still in progress the day after its due date: Urgent and the #operations message.',
  ],
  features: ['Task templates with subtasks', 'Subtasks resolved', 'Start date arrives', 'Date is Before/After', 'Custom Field changes', 'Tasks in Multiple Lists', 'Gantt view', 'Private Money fields'],
};
