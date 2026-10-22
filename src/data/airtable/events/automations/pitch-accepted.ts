/** 02 · Pitch accepted: the decision turns into tasks with real deadlines, then a welcome email. */
import type { Action, Automation, Ctx } from '@/lib/airtable/types';
import { fx, shortDate } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;

const task = (id: string, title: string, name: string, type: string, owner: string, due: string, summary: string): Action => ({
  kind: 'action',
  id,
  type: 'Create record',
  title,
  summary,
  params: [
    { k: 'Table', v: 'Tasks' },
    { k: 'Task', v: name.replace(/\{(.+?)\}/g, '{Trigger › $1}') },
    { k: 'Session', v: '{Trigger › Airtable record ID}' },
    { k: 'Type', v: type },
    { k: 'Owner', v: owner },
    { k: 'Due', v: `{Trigger › ${due}}` },
  ],
  run: (c) => ({
    create: [{ table: 'Tasks', fields: { Task: name.replace(/\{(.+?)\}/g, (_m, f: string) => T(c).text(f)), Session: [T(c).id], Type: type, Owner: owner, Due: T(c).get(due) } }],
  }),
});

export const pitchAccepted: Automation = {
  id: 'pitch-accepted',
  number: '02',
  name: 'Pitch accepted',
  kicker: 'Accepted → tasks and a welcome',
  tagline: 'The moment a pitch is accepted, the work it creates has an owner and a date, and the speaker knows what is due when.',
  problem: 'Accepting a talk set off a dozen small jobs that lived in people’s heads: get the slides, book a flight, set up the room for a workshop. Deadlines were worked out by hand from the event date, and the welcome email went out whenever Hannah got to it.',
  solution: 'When a session’s Status becomes Accepted, the automation creates a slides task for Hannah, a travel task for Dev if the speaker needs travel, and a room-setup task for Marcus if it is a workshop. Every due date comes from a formula on the session. Then it emails the speaker the dates and ticks Welcome sent.',
  trigger: {
    type: 'When a record matches conditions',
    table: 'Sessions',
    summary: 'Fires when a session starts to match: Status becomes Accepted while it has a speaker and no welcome has been sent. A record that keeps matching does not fire again.',
    params: [
      { k: 'Table', v: 'Sessions' },
      { k: 'Conditions', v: 'Status is Accepted · and Speaker is not empty · and Welcome sent is unchecked' },
    ],
    test: (g) => g('Status') === 'Accepted' && !fx.empty(g('Speaker')) && !g('Welcome sent'),
  },
  steps: [
    task('task-slides', 'Slides task for Hannah', 'Slides · {Title}', 'Slides', 'Hannah Lee', 'Slides due', 'Every accepted session needs slides, due a week before its event.'),
    {
      kind: 'if',
      id: 'g-travel',
      when: 'Trigger › Needs travel is checked',
      test: (c) => !!T(c).get('Needs travel'),
      steps: [task('task-travel', 'Travel task for Dev', 'Travel · {Speaker name}', 'Travel', 'Dev Castillo', 'Book travel by', 'Flights a month ahead, when they are still cheap.')],
    },
    {
      kind: 'if',
      id: 'g-workshop',
      when: 'Trigger › Format is Workshop',
      test: (c) => T(c).get('Format') === 'Workshop',
      steps: [task('task-room', 'Room-setup task for Marcus', 'Room setup · {Title}', 'Room setup', 'Marcus Webb', 'Slides due', 'Workshops need tables, power and supplies, settled when the slides are.')],
    },
    {
      kind: 'action',
      id: 'welcome',
      type: 'Send email',
      title: 'Welcome the speaker',
      summary: 'Confirms the slot and gives every date that matters to them.',
      params: [
        { k: 'To', v: '{Trigger › Speaker email}' },
        { k: 'From name', v: 'Brightwater Program' },
        { k: 'Reply to', v: 'hannah@brightwatersummits.example' },
        { k: 'Subject', v: 'You’re on the program: “{Trigger › Title}”' },
      ],
      run: (c) => {
        const t = T(c);
        const travel = t.get('Needs travel') ? `\n• Travel: Dev will be in touch to book it by ${shortDate(t.get('Book travel by'))}.` : '';
        const room = t.get('Format') === 'Workshop' ? '\n• Workshop room: tell Marcus what you need on the tables by the same date as your slides.' : '';
        return {
          messages: [
            {
              channel: 'email',
              to: fx.str(t.get('Speaker email')),
              subject: `You’re on the program: “${t.text('Title')}”`,
              body: `Hi ${t.text('Speaker name').split(' ')[0]},\n\nGood news: “${t.text('Title')}” is on the program for ${t.text('Event')} on ${shortDate(t.get('Event date'))}.\n\nWhat we need from you:\n• Slides by ${shortDate(t.get('Slides due'))}. Reply with a file or a link.${travel}${room}\n\nHannah Lee is your contact from here on.\n\nThe Brightwater program team`,
            },
          ],
        };
      },
    },
    {
      kind: 'action',
      id: 'mark-sent',
      type: 'Update record',
      title: 'Tick Welcome sent',
      summary: 'Takes the session out of the trigger’s conditions for good.',
      params: [
        { k: 'Table', v: 'Sessions' },
        { k: 'Record ID', v: '{Trigger › Airtable record ID}' },
        { k: 'Welcome sent', v: 'Checked' },
      ],
      run: (c) => ({ update: [{ table: 'Sessions', id: T(c).id, fields: { 'Welcome sent': true } }] }),
    },
  ],
  notify: 'Marcus Webb',
  scenarios: [
    {
      id: 'talk',
      label: 'A talk from a local speaker',
      summary: 'Priya accepts Ana’s summit talk: one slides task, one email.',
      start: 2 * 1440 + 555,
      setup: { by: 'Priya presses Accept in the Review queue', update: [{ table: 'Sessions', id: 'recSes05', fields: { Status: 'Accepted' } }] },
      record: 'recSes05',
      expect: { status: 'success', visits: ['task-slides', 'welcome', 'mark-sent', 'g-travel:skip', 'g-workshop:skip'], skips: ['task-travel', 'task-room'], emails: 1 },
    },
    {
      id: 'workshop-travel',
      label: 'A workshop from a speaker who flies in',
      summary: 'Jun’s repair-café workshop: slides, travel and room-setup tasks, all dated from the event.',
      start: 3 * 1440 + 990,
      setup: { by: 'Priya presses Accept in the Review queue', update: [{ table: 'Sessions', id: 'recSes06', fields: { Status: 'Accepted' } }] },
      record: 'recSes06',
      expect: { status: 'success', visits: ['task-slides', 'task-travel', 'task-room', 'welcome', 'mark-sent', 'g-travel', 'g-workshop'], emails: 1 },
    },
  ],
  fields: [
    { table: 'Sessions', field: 'Event date', use: 'Rollup of Event › Starts with MIN(values): one date, not a list.' },
    { table: 'Sessions', field: 'Slides due, Book travel by', use: 'DATEADD formulas on Event date; the tasks copy them as their Due.' },
    { table: 'Sessions', field: 'Welcome sent', use: 'In the trigger’s conditions, ticked as the last step.' },
    { table: 'Tasks', field: 'Session, Owner, Due, Type', use: 'Set on each new task.' },
    { table: 'Events', field: 'Accepted sessions', use: 'A count with a condition; it goes up as soon as Status changes.' },
  ],
  build: [
    { title: 'Matches conditions, guarded', body: '“When a record matches conditions” fires when a record starts to match. Welcome sent is part of the conditions and the last step ticks it, so a session that is set back to In review and accepted again does not get a second set of tasks.' },
    { title: 'Dates live in formulas', body: 'Slides due and Book travel by are formulas on the session, read from the event through a rollup. The automation copies a date; it never works one out. Moving an event moves every deadline that has not been copied yet.' },
    { title: 'Tasks before the email', body: 'The internal work is created first. If the email ever failed, the team would still have its tasks, and the run history would say exactly what is missing.' },
    { title: 'Two conditional groups, side by side', body: 'Travel and room setup are independent, so each has its own group and a workshop from a flying speaker gets both.' },
    { title: 'Owners as user fields', body: 'Owner is a user field, so the My tasks interface page can filter on the current user without anyone setting up a view per person.' },
  ],
  edgeCases: [
    { title: 'Accepted before a speaker is linked', body: 'If automation 01 failed before linking, the session does not match (Speaker is not empty) and nothing runs. Once Marcus links the speaker, the record starts to match and the run happens then.' },
    { title: 'Accepted by mistake, then set back', body: 'The tasks and the email have already gone. Undoing is by hand: delete the tasks and send a short correction. Welcome sent stays ticked, so accepting it again later sends nothing; untick it first if it should.' },
    { title: 'The event moves', body: 'Event date, Slides due and Book travel by recalculate at once. Tasks already created keep their old Due, so Dev updates them from the Tasks grid filtered to that event.' },
    { title: 'Ten accepted at once', body: 'Each session fires its own run. Ten runs make ten welcome emails and their tasks; nothing is batched or skipped.' },
  ],
  qa: [
    'A talk with no travel makes one task and no others.',
    'A workshop with travel makes three tasks with the right owners.',
    'Each task’s Due matches the session’s formula date.',
    'Welcome sent is ticked at the end of every successful run.',
    'Setting Status back and forth after a run starts nothing.',
  ],
  features: ['When a record matches conditions', 'Conditional groups', 'Create record', 'Update record', 'Send email', 'Rollup', 'Formula (DATEADD)', 'Last modified time', 'User field'],
};
