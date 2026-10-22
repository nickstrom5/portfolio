/** 03 · Monday slides chase: one digest for the team, one nudge per speaker, silence when all are in. */
import type { Automation, Ctx } from '@/lib/airtable/types';
import { fx, shortDate } from '@/lib/airtable/engine';

const found = (c: Ctx) => c.out('find-missing').records as string[];

const SCRIPT = `// Groups the sessions still missing slides by event, for one digest email.
const { ids } = input.config();
const table = base.getTable('Sessions');
const query = await table.selectRecordsAsync({
  fields: ['Title', 'Speaker name', 'Event', 'Slides due'],
  recordIds: ids,
});

const byEvent = {};
for (const r of query.records) {
  const event = r.getCellValueAsString('Event');
  if (!byEvent[event]) byEvent[event] = [];
  byEvent[event].push(
    '• ' + r.getCellValueAsString('Title') + ' (' + r.getCellValueAsString('Speaker name') +
    '), due ' + r.getCellValueAsString('Slides due')
  );
}

const digest = Object.keys(byEvent)
  .map((event) => event + '\\n' + byEvent[event].join('\\n'))
  .join('\\n\\n');

output.set('digest', digest);
output.set('count', query.records.length);`;

export const slidesChase: Automation = {
  id: 'slides-chase',
  number: '03',
  name: 'Monday slides chase',
  kicker: 'Every Monday → digest and nudges',
  tagline: 'One email tells the team what is missing; each speaker gets their own reminder. When everything is in, nobody hears a thing.',
  problem: 'Slides were chased in reply-all threads, so speakers who had sent theirs got nagged and the ones who had not slipped through. Dev found out what was missing the night before an event.',
  solution: 'Every Monday at 8 AM the automation reads the view of accepted sessions with no slides and an event in the next 14 days. If the list has anything in it, a conditional group runs: a short script groups the list by event for one digest to Dev and Hannah, then a repeating group sends each of those speakers their own reminder with their own due date.',
  trigger: {
    type: 'At a scheduled time',
    summary: 'Runs every Monday at 8:00 AM Pacific time.',
    params: [
      { k: 'Interval type', v: 'Weeks' },
      { k: 'Every', v: '1 week, on Monday' },
      { k: 'Time', v: '8:00 AM' },
      { k: 'Timezone', v: 'America/Los_Angeles' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'find-missing',
      type: 'Find records',
      title: 'Sessions still missing slides',
      summary: 'Reads the view, so the rule lives in one place the team can see.',
      params: [
        { k: 'Table', v: 'Sessions' },
        { k: 'Find records based on', v: 'View' },
        { k: 'View', v: 'Missing slides · next 14 days' },
      ],
      run: (c) => {
        const recs = c.inView('Sessions', 'Missing slides · next 14 days');
        return { log: recs.length ? `Found ${recs.length}: ${recs.map((r) => r.name).join('; ')}` : 'No records found', output: { records: recs.map((r) => r.id) } };
      },
    },
    {
      kind: 'if',
      id: 'g-any',
      branches: [
        {
          name: 'Something is missing',
          when: 'Find records › Records is not empty',
          test: (c) => found(c).length > 0,
          steps: [
            {
              kind: 'action',
              id: 'digest',
              type: 'Run a script',
              title: 'Group them by event',
              summary: 'A few lines of script turn the list into a readable digest.',
              params: [{ k: 'Input variable ids', v: '{Find records › Records › Airtable record ID}' }],
              script: { inputs: [{ name: 'ids', value: 'Find records › Records › Airtable record ID (list)' }], source: SCRIPT },
              run: (c) => {
                const recs = found(c).map((id) => c.record('Sessions', id));
                const events = [...new Set(recs.map((r) => r.text('Event')))];
                const digest = events.map((e) => `${e}\n${recs.filter((r) => r.text('Event') === e).map((r) => `• ${r.text('Title')} (${r.text('Speaker name')}), due ${r.text('Slides due')}`).join('\n')}`).join('\n\n');
                return { log: `output.set: digest (${recs.length} sessions, ${events.length} event${events.length === 1 ? '' : 's'}), count`, output: { digest, count: recs.length } };
              },
            },
            {
              kind: 'action',
              id: 'digest-email',
              type: 'Send email',
              title: 'Digest to Dev and Hannah',
              summary: 'One email with the whole list.',
              params: [
                { k: 'To', v: 'dev@brightwatersummits.example, hannah@brightwatersummits.example' },
                { k: 'Subject', v: 'Slides missing: {Run a script › count} sessions' },
                { k: 'Message', v: '{Run a script › digest}' },
              ],
              run: (c) => {
                const o = c.out('digest');
                return {
                  messages: [{ channel: 'email', to: `${c.email('Dev Castillo')}, ${c.email('Hannah Lee')}`, subject: `Slides missing: ${o.count} session${o.count === 1 ? '' : 's'}`, body: `Accepted sessions with no slides and an event in the next 14 days:\n\n${o.digest}\n\nEach speaker gets their own reminder this morning.` }],
                };
              },
            },
          {
            kind: 'repeat',
            id: 'r-speakers',
            over: 'Find records › Records',
            list: (c) => found(c).map((id) => c.record('Sessions', id)),
            steps: [
              {
                kind: 'action',
                id: 'nudge',
                type: 'Send email',
                title: 'Remind the speaker',
                summary: 'One email per session, with that session’s own date.',
                params: [
                  { k: 'To', v: '{Current item › Speaker email}' },
                  { k: 'From name', v: 'Hannah at Brightwater' },
                  { k: 'Reply to', v: 'hannah@brightwatersummits.example' },
                  { k: 'Subject', v: 'Your slides for {Current item › Event}' },
                ],
                run: (c) => {
                  const s = c.item!;
                  const late = s.get('Slides status') === 'Overdue';
                  return {
                    messages: [
                      {
                        channel: 'email',
                        to: fx.str(s.get('Speaker email')),
                        subject: `Your slides for ${s.text('Event')}`,
                        body: `Hi ${s.text('Speaker name').split(' ')[0]},\n\n${late ? `Your slides for “${s.text('Title')}” were due ${shortDate(s.get('Slides due'))}` : `A reminder that your slides for “${s.text('Title')}” are due ${shortDate(s.get('Slides due'))}`}. The event is on ${shortDate(s.get('Event date'))}. Reply to this email with a file or a link, even a draft.\n\nThanks,\nHannah`,
                      },
                    ],
                  };
                },
              },
            ],
          },
          ],
        },
      ],
    },
  ],
  notify: 'Marcus Webb',
  scenarios: [
    {
      id: 'three-missing',
      label: 'Three sessions still without slides',
      summary: 'Ten days before Seattle: one digest, three reminders. Ana already sent hers, so she hears nothing.',
      start: 480,
      expect: { status: 'success', visits: ['find-missing', 'g-any:0', 'digest', 'digest-email', 'r-speakers', 'nudge'], emails: 4 },
    },
    {
      id: 'all-in',
      label: 'Every speaker has sent slides',
      summary: 'The speakers uploaded theirs last week, so the view is empty and the run ends quietly.',
      start: 480,
      setup: {
        by: 'Hannah attaches the slides speakers sent last week',
        update: [
          { table: 'Sessions', id: 'recSes01', fields: { Slides: ['supplier-scorecards.pdf'] } },
          { table: 'Sessions', id: 'recSes02', fields: { Slides: ['books-in-three-days.key'] } },
          { table: 'Sessions', id: 'recSes04', fields: { Slides: ['heat-pump-workshop.pdf'] } },
        ],
      },
      expect: { status: 'success', visits: ['find-missing', 'g-any:none'], skips: ['digest', 'digest-email', 'r-speakers', 'nudge'], emails: 0 },
    },
  ],
  fields: [
    { table: 'Sessions', field: 'Slides', use: 'Empty means missing; the view filters on it.' },
    { table: 'Sessions', field: 'Event date', use: 'Rollup the view filters with “is within the next 14 days”.' },
    { table: 'Sessions', field: 'Slides status', use: 'Formula that says Overdue once the due date has passed; the reminder’s wording follows it.' },
    { table: 'Events', field: 'Slides received', use: 'Count with two conditions, shown on the Event dashboard.' },
  ],
  build: [
    { title: 'The rule lives in a view', body: 'Find records reads the view “Missing slides · next 14 days” instead of repeating its filters. Hannah works from the same view, so what she sees and what the automation chases cannot differ.' },
    { title: 'Quiet when nothing is missing', body: 'Everything after Find records sits in one conditional group branch that needs a non-empty list. On a Monday with every slide in, no branch matches, and the run succeeds having sent nothing.' },
    { title: 'The loop is the last step of the branch', body: 'Airtable lets nothing follow a repeating group or a conditional group, so the order is fixed: digest first, then the loop of reminders, both inside the one branch.' },
    { title: 'A repeating group for the nudges', body: 'The repeating group runs its Send email once per record in the list, with Current item tokens, so each speaker gets their own title and date instead of a group email.' },
    { title: 'Script only for what actions cannot do', body: 'Grouping a list by event is the one thing the built-in actions do not do. The script takes the record IDs as an input variable, reads only the four fields it needs, and hands back two outputs. It stays well inside the 30-second limit for scripts in automations.' },
    { title: 'Mondays at 8 AM Pacific', body: 'The schedule names its timezone, so it does not drift when someone on the team changes theirs. Monday gives speakers a working week before most deadlines.' },
  ],
  edgeCases: [
    { title: 'A speaker with two sessions', body: 'They get two reminders, one per session, each with its own title and date. That is deliberate: a combined email hides which deck is missing.' },
    { title: 'Slides sent by email, not uploaded', body: 'The record still shows Slides empty, so the speaker is chased again. Hannah attaches every file she receives; the reminder says “reply with a file or a link” so it all comes to her.' },
    { title: 'An event that was moved earlier', body: 'Event date recalculates, the session enters the view as soon as it is within 14 days, and next Monday’s run picks it up.' },
    { title: 'The script fails', body: 'The run stops before the digest email and before the nudges, and Marcus gets the failure email. Nothing half-sent: the order means a bad digest never goes out with good reminders.' },
  ],
  qa: [
    'With three sessions missing, one digest and three reminders go out.',
    'A session whose slides are attached is in neither email.',
    'With nothing missing, the run succeeds and sends nothing.',
    'An overdue session’s reminder says “were due”.',
    'The digest groups by event and counts correctly.',
  ],
  features: ['At a scheduled time', 'Find records (based on view)', 'Conditional group', 'Repeating group inside a branch', 'Run a script', 'Send email', 'Formula (IS_BEFORE, TODAY)', 'Grid view filters'],
};
