/** 03 · Visit reminder: a text the day before each clean, with an email in its place when the number cannot take one. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { firstName, niceTime, str } from '../../helpers';

const T = (c: Ctx) => c.trigger;
const client = (c: Ctx) => c.out('client');
const when = (c: Ctx) => str(c.out('when').Output);

const visit = (o: Partial<Json>): Json => ({
  Summary: 'Cleaning · Dana Whitfield',
  'Event Begins': '2026-03-05T09:00:00',
  'Event Ends': '2026-03-05T11:30:00',
  Location: '214 Tibet Rd, Columbus, OH 43202',
  'Attendee Emails': 'dana.whitfield@example.com',
  'Event ID': 'evt_7c1m2q',
  ...o,
});

export const visitReminder: Zap = {
  id: 'visit-reminder',
  number: '03',
  name: 'Visit reminder',
  kicker: 'Calendar → a text the day before',
  tagline: 'Every client hears from the office the day before their clean, by text if their number takes one and by email if it does not.',
  problem:
    'Two or three times a month a crew arrived to a locked door: the client had forgotten, or the dog was loose, or the alarm was set. Each one cost an hour of paid time. Reminder calls worked when they were made, and they were made when the office had a quiet afternoon.',
  solution:
    'The crew schedule already lives in a Google Calendar, with the client invited to each visit. One day before a visit starts, the Zap looks the client up in the Clients sheet, puts the start time in plain words and sends a text from the office number. If the number turns out to be a landline, the step’s error handler sends the reminder by email and tells the office, so no client is skipped.',
  folder: 'Maple & Main',
  trigger: {
    app: 'Google Calendar',
    event: 'Event Start',
    icon: 'calendar',
    type: 'polling',
    summary: 'Runs one day before each event on the Crew schedule calendar starts.',
    params: [
      { k: 'Calendar', v: 'Crew schedule' },
      { k: 'Time Before', v: '1' },
      { k: 'Time Before (unit)', v: 'Days' },
    ],
  },
  steps: [
    {
      kind: 'filter',
      id: 'is-clean',
      title: 'Only cleaning visits',
      summary: 'The calendar also holds team meetings, van services and days off. Visits are always named “Cleaning · client name”.',
      rules: 'Summary (Text) Starts with Cleaning',
      params: [{ k: 'Only continue if', v: '{trigger › Summary} (Text) Starts with Cleaning' }],
      test: (c) => str(T(c).Summary).startsWith('Cleaning'),
    },
    {
      kind: 'action',
      id: 'client',
      app: 'Google Sheets',
      event: 'Lookup Spreadsheet Row',
      icon: 'search',
      search: 'halt',
      title: 'Look the client up',
      summary: 'Finds the client’s row by the email invited to the visit, for their mobile number and first name. If there is no row, the run stops here.',
      params: [
        { k: 'Worksheet', v: 'Clients' },
        { k: 'Lookup Column', v: 'Email' },
        { k: 'Lookup Value', v: '{trigger › Attendee Emails}' },
        { k: 'Should this step be considered a “success” when nothing is found?', v: 'No (the default)' },
      ],
      run: (c) => {
        const email = str(T(c)['Attendee Emails']).trim().toLowerCase();
        const row = c.rows('Clients').find((r) => str(r.Email).toLowerCase() === email);
        return row ? { found: true, log: `Found ${str(row.Client)}`, output: { ...row } } : { found: false, log: `No row in Clients for ${email}` };
      },
    },
    {
      kind: 'action',
      id: 'when',
      app: 'Formatter by Zapier',
      event: 'Date / Time',
      icon: 'wand',
      title: 'Put the start time in plain words',
      summary: 'The calendar hands over 2026-03-05T09:00:00. A person wants “Thu, Mar 5 at 9:00 AM”.',
      params: [
        { k: 'Transform', v: 'Format' },
        { k: 'Input', v: '{trigger › Event Begins}' },
        { k: 'To Format', v: 'ddd, MMM D [at] h:mm A' },
        { k: 'To Timezone', v: 'America/New_York' },
      ],
      run: (c) => ({ output: { Output: niceTime(T(c)['Event Begins']) } }),
    },
    {
      kind: 'action',
      id: 'text',
      app: 'Twilio',
      event: 'Send SMS',
      icon: 'sms',
      title: 'Text the reminder',
      summary: 'Sent from the office number, so a reply or a call back reaches a person.',
      params: [
        { k: 'From Number', v: '+16145550100' },
        { k: 'To Number', v: '{client › Phone}' },
        { k: 'Message', v: 'Hi {client › Client}, it’s Maple & Main. Your cleaning is {when › Output}…' },
      ],
      run: (c) => ({
        messages: [
          {
            channel: 'sms',
            to: str(client(c).Phone),
            body: `Hi ${firstName(client(c).Client)}, it’s Maple & Main. Your cleaning is ${when(c)}; the crew arrives within an hour of that. Need to move it? Reply here or call 614-555-0100.`,
          },
        ],
      }),
      onError: [
        {
          kind: 'action',
          id: 'email-instead',
          app: 'Gmail',
          event: 'Send Email',
          icon: 'mail',
          title: 'Email the reminder instead',
          summary: 'The same reminder, by email, to the address on the calendar invite.',
          params: [
            { k: 'To', v: '{client › Email}' },
            { k: 'From Name', v: 'Maple & Main Cleaning' },
            { k: 'Subject', v: 'Your cleaning is {when › Output}' },
          ],
          run: (c) => ({
            messages: [
              {
                channel: 'email',
                to: str(client(c).Email),
                subject: `Your cleaning is ${when(c)}`,
                body: `Hi ${firstName(client(c).Client)},\n\nA quick reminder that your cleaning is ${when(c)}. The crew arrives within an hour of that time.\n\nIf you need to move it, reply to this email or call 614-555-0100.\n\nMaple & Main Cleaning`,
              },
            ],
          }),
        },
        {
          kind: 'action',
          id: 'flag',
          app: 'Slack',
          event: 'Send Channel Message',
          icon: 'slack',
          title: 'Ask the office to fix the number',
          summary: 'So the next reminder can go by text.',
          params: [
            { k: 'Channel', v: '#office' },
            { k: 'Message Text', v: 'Could not text {client › Client} at {client › Phone}. The reminder went by email. Please get a mobile number.' },
          ],
          run: (c) => ({ messages: [{ channel: 'slack', to: '#office', body: `Could not text ${str(client(c).Client)} at ${str(client(c).Phone)} about ${when(c)}. The reminder went by email instead. Please get a mobile number and update the Clients sheet.` }] }),
        },
      ],
    },
  ],
  autoreplay: false,
  owner: 'Marcus Bell',
  scenarios: [
    {
      id: 'normal',
      label: 'A visit is one day away',
      summary: 'Dana’s clean is tomorrow at 9. She gets one text from the office number.',
      start: 2 * 1440 + 9 * 60,
      trigger: visit({}),
      expect: { status: 'Successful', visits: ['is-clean', 'client', 'when', 'text'], skips: ['email-instead', 'flag'], tasks: 2 },
    },
    {
      id: 'meeting',
      label: 'A team meeting is one day away',
      summary: 'The calendar holds more than visits. This event is not a clean, so the run stops at the filter.',
      start: 3 * 1440 + 8 * 60,
      trigger: visit({ Summary: 'Team meeting', 'Event Begins': '2026-03-06T08:00:00', 'Event Ends': '2026-03-06T08:45:00', Location: 'Office', 'Attendee Emails': 'tasha@mapleandmain.example', 'Event ID': 'evt_9d4k0s' }),
      expect: { status: 'Filtered', visits: ['is-clean:stop'], skips: ['client', 'text'], tasks: 0 },
    },
    {
      id: 'unknown-client',
      label: 'The client is not in the sheet yet',
      summary: 'A visit was booked before anyone added the client’s row. The lookup finds nothing and the run stops without an error.',
      start: 3 * 1440 + 13 * 60,
      trigger: visit({ Summary: 'Cleaning · Sam Okonkwo', 'Event Begins': '2026-03-06T13:00:00', 'Event Ends': '2026-03-06T15:00:00', Location: '88 Oakland Park Ave, Columbus, OH 43214', 'Attendee Emails': 'sam.okonkwo@example.com', 'Event ID': 'evt_2b8x5r' }),
      expect: { status: 'Safely halted', visits: ['is-clean', 'client:none'], skips: ['when', 'text'], tasks: 0 },
    },
    {
      id: 'landline',
      label: 'The number on file is a landline',
      summary: 'Twilio cannot text Gordon’s number. The error handler emails him the reminder and tells the office.',
      start: 4 * 1440 + 10 * 60,
      trigger: visit({ Summary: 'Cleaning · Gordon Pruitt', 'Event Begins': '2026-03-07T10:00:00', 'Event Ends': '2026-03-07T12:00:00', Location: '41 Walhalla Rd, Columbus, OH 43202', 'Attendee Emails': 'gordon.pruitt@example.com', 'Event ID': 'evt_5h3n7w' }),
      failures: { text: { message: 'Twilio: “‘To’ number is not a valid mobile number.” (error 21614)' } },
      expect: { status: 'Handled error', visits: ['client', 'when', 'text:handled', 'email-instead', 'flag'], tasks: 3 },
    },
  ],
  fields: [
    { app: 'Google Calendar', field: 'Summary', use: 'Starts with “Cleaning” for visits; everything else is filtered out.' },
    { app: 'Google Calendar', field: 'Event Begins', use: 'The visit’s start, reformatted for the message.' },
    { app: 'Google Calendar', field: 'Attendee Emails', use: 'The client’s address, used to find their row.' },
    { app: 'Google Sheets', field: 'Clients › Phone, Client', use: 'The mobile number to text and the first name to use.' },
  ],
  build: [
    { title: 'The calendar is the schedule', body: 'The office already kept visits in Google Calendar. Event Start with “1 day before” turns every visit into a reminder without a second list to maintain.' },
    { title: 'A naming rule the filter can rely on', body: 'Visits are named “Cleaning · client name”. The filter checks that the event’s name starts with Cleaning, so meetings and van services on the same calendar never text anybody.' },
    { title: 'A search that stops the run', body: 'The lookup is left on Zapier’s default: when nothing is found, the run ends as Safely halted. Sending a text with an empty number would only produce an error to chase.' },
    { title: 'An error handler on the one step that can fail for a good reason', body: 'A landline is not a fault in the Zap; it is a fact about the client. The handler on the Twilio step sends the same reminder by email and asks the office for a mobile number, and the run is recorded as Handled error.' },
    { title: 'Autoreplay is off here', body: 'A Zap with an error handler does not use Autoreplay, and that suits this one: replaying a text to a landline five times would fail five times. For a brief Twilio outage the handler’s email is the better outcome anyway.' },
    { title: 'Format the date once', body: 'Formatter turns the calendar’s timestamp into “Thu, Mar 5 at 9:00 AM” in the business’s time zone, and both the text and the fallback email map that one field.' },
  ],
  edgeCases: [
    { title: 'A visit booked for tomorrow, this afternoon', body: 'Event Start works from events that are already on the calendar a day ahead. A visit added later than that cannot be relied on to trigger, so same-day and next-day bookings are confirmed by phone when they are made.' },
    { title: 'A visit is moved', body: 'Whether a moved event triggers again depends on when it is moved, so the rule is simple: whoever moves a visit tells the client. The Zap is a safety net for the normal week, not the way changes are announced.' },
    { title: 'Two people are invited to the visit', body: 'Attendee Emails then holds two addresses and the lookup finds no single match, so the run halts. The house rule is one client invited per visit, with the first-named client’s email.' },
    { title: 'The client is not in the Clients sheet', body: 'The run ends as Safely halted. A weekly look at halted runs in Zap history shows which clients are missing a row.' },
    { title: 'The client replies to the text', body: 'The Twilio number forwards replies and calls to the office phone. The Zap does not read replies.' },
  ],
  qa: [
    'A visit named “Cleaning · …” one day away sends exactly one text.',
    'The text names the right day and time in Eastern time.',
    'A “Team meeting” on the same calendar ends as Filtered and sends nothing.',
    'A client with no row in Clients ends as Safely halted, with no error email.',
    'A landline number sends the email and the Slack note, and the run shows Handled error.',
  ],
  features: ['Google Calendar: Event Start', 'Filter by Zapier', 'Search that halts when nothing is found', 'Formatter: Date / Time', 'Custom error handler', 'Twilio', 'Gmail', 'Slack'],
};
