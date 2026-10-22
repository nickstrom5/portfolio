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
  solution: 'When a session’s Status becomes Accepted, the automation creates a slides task for Hannah, emails the speaker every date that matters to them, and ticks Welcome sent. A conditional group then adds a travel task for Dev if the speaker needs travel, a room-setup task for Marcus if it is a workshop, or both. Every due date comes from a formula on the session.',
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
      kind: 'action',
      id: 'welcome',
      type: 'Send email',
      title: 'Welcome the speaker',
      summary: 'Confirms the slot and gives every date that matters to them. The travel and workshop lines come from a formula field, since an email’s text cannot branch.',
      params: [
        { k: 'To', v: '{Trigger › Speaker email}' },
        { k: 'From name', v: 'Brightwater Program' },
        { k: 'Reply to', v: 'hannah@brightwatersummits.example' },
        { k: 'Subject', v: 'You’re on the program: “{Trigger › Title}”' },
        { k: 'Message', v: '… Slides by {Trigger › Slides due}. Reply with a file or a link. {Trigger › Welcome extras} …' },
      ],
      run: (c) => {
        const t = T(c);
        const extras = t.text('Welcome extras');
        return {
          messages: [
            {
              channel: 'email',
              to: fx.str(t.get('Speaker email')),
              subject: `You’re on the program: “${t.text('Title')}”`,
              body: `Hi ${t.text('Speaker name').split(' ')[0]},\n\nGood news: “${t.text('Title')}” is on the program for ${t.text('Event')} on ${shortDate(t.get('Event date'))}.\n\nWhat we need from you:\n• Slides by ${shortDate(t.get('Slides due'))}. Reply with a file or a link.${extras ? `\n${extras}` : ''}\n\nHannah Lee is your contact from here on.\n\nThe Brightwater program team`,
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
    {
      kind: 'if',
      id: 'g-extras',
      branches: [
        { name: 'Workshop with travel', when: 'Trigger › Needs travel is checked · and Trigger › Format is Workshop', test: (c) => !!T(c).get('Needs travel') && T(c).get('Format') === 'Workshop', steps: [task('travel-a', 'Travel task for Dev', 'Travel · {Speaker name}', 'Travel', 'Dev Castillo', 'Book travel by', 'Flights a month ahead, when they are still cheap.'), task('room-a', 'Room-setup task for Marcus', 'Room setup · {Title}', 'Room setup', 'Marcus Webb', 'Slides due', 'Workshops need tables, power and supplies, settled when the slides are.')] },
        { name: 'Travel', when: 'Trigger › Needs travel is checked', test: (c) => !!T(c).get('Needs travel'), steps: [task('travel-b', 'Travel task for Dev', 'Travel · {Speaker name}', 'Travel', 'Dev Castillo', 'Book travel by', 'Flights a month ahead, when they are still cheap.')] },
        { name: 'Workshop', when: 'Trigger › Format is Workshop', test: (c) => T(c).get('Format') === 'Workshop', steps: [task('room-b', 'Room-setup task for Marcus', 'Room setup · {Title}', 'Room setup', 'Marcus Webb', 'Slides due', 'Workshops need tables, power and supplies, settled when the slides are.')] },
      ],
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
      expect: { status: 'success', visits: ['task-slides', 'welcome', 'mark-sent', 'g-extras:none'], skips: ['travel-a', 'travel-b', 'room-a', 'room-b'], emails: 1 },
    },
    {
      id: 'workshop-travel',
      label: 'A workshop from a speaker who flies in',
      summary: 'Jun’s repair-café workshop: slides, travel and room-setup tasks, all dated from the event.',
      start: 3 * 1440 + 990,
      setup: { by: 'Priya presses Accept in the Review queue', update: [{ table: 'Sessions', id: 'recSes06', fields: { Status: 'Accepted' } }] },
      record: 'recSes06',
      expect: { status: 'success', visits: ['task-slides', 'welcome', 'mark-sent', 'g-extras:0', 'travel-a', 'room-a'], skips: ['travel-b', 'room-b'], emails: 1 },
    },
    {
      id: 'talk-travel',
      label: 'A talk from a speaker who flies in',
      summary: 'Ana ticks Needs travel before Priya accepts: the Travel branch adds Dev’s task, nothing for the room.',
      start: 4 * 1440 + 600,
      setup: { by: 'Ana asks for travel; Priya presses Accept', update: [{ table: 'Sessions', id: 'recSes05', fields: { 'Needs travel': true, Status: 'Accepted' } }] },
      record: 'recSes05',
      expect: { status: 'success', visits: ['g-extras:1', 'travel-b'], skips: ['travel-a', 'room-a', 'room-b'], emails: 1 },
    },
    {
      id: 'local-workshop',
      label: 'A workshop from a local speaker',
      summary: 'Jun moves to Portland, so no travel: the Workshop branch adds Marcus’s room task.',
      start: 4 * 1440 + 640,
      setup: { by: 'Jun no longer needs travel; Priya presses Accept', update: [{ table: 'Sessions', id: 'recSes06', fields: { 'Needs travel': false, Status: 'Accepted' } }] },
      record: 'recSes06',
      expect: { status: 'success', visits: ['g-extras:2', 'room-b'], skips: ['travel-a', 'travel-b', 'room-a'], emails: 1 },
    },
  ],
  fields: [
    { table: 'Sessions', field: 'Event date', use: 'Rollup of Event › Starts with MIN(values): one date, not a list.' },
    { table: 'Sessions', field: 'Slides due, Book travel by', use: 'DATEADD formulas on Event date; the tasks copy them as their Due.' },
    { table: 'Sessions', field: 'Welcome sent', use: 'In the trigger’s conditions, ticked before the conditional group.' },
    { table: 'Sessions', field: 'Welcome extras', use: 'Formula with the travel and workshop lines for the email; empty for a local talk.' },
    { table: 'Tasks', field: 'Session, Owner, Due, Type', use: 'Set on each new task.' },
    { table: 'Events', field: 'Accepted sessions', use: 'A count with a condition; it goes up as soon as Status changes.' },
  ],
  build: [
    { title: 'Matches conditions, guarded', body: '“When a record matches conditions” fires when a record starts to match. Welcome sent is part of the conditions and the run ticks it, so a session that is set back to In review and accepted again does not get a second set of tasks.' },
    { title: 'Dates live in formulas', body: 'Slides due and Book travel by are formulas on the session, read from the event through a rollup. The automation copies a date; it never works one out. Moving an event moves every deadline that has not been copied yet.' },
    { title: 'Shared steps first, the group last', body: 'Every accepted session gets the slides task, the welcome and the tick, so they come first. The conditional group is the last step, as Airtable requires: nothing can follow it.' },
    { title: 'Branch order matters', body: 'Airtable runs the first branch whose conditions are met. Workshop with travel needs both tasks, so it comes first, then Travel, then Workshop. There is no Otherwise branch, so a local talk runs none of them.' },
    { title: 'One email, its extra lines from a formula', body: 'An email’s text cannot branch, so the travel and workshop sentences live in a formula field, Welcome extras, built with IF and DATETIME_FORMAT. It reads empty for a local talk, and the one Send email action covers every case.' },
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
    'A talk with travel gets only the travel task; a local workshop only the room task.',
    'Each task’s Due matches the session’s formula date.',
    'Welcome sent is ticked at the end of every successful run.',
    'Setting Status back and forth after a run starts nothing.',
  ],
  features: ['When a record matches conditions', 'Conditional group branches', 'Create record', 'Update record', 'Send email', 'Rollup', 'Formula (DATEADD)', 'Last modified time', 'User field'],
};
