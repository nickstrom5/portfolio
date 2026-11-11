/** 03 · After the workshop: one email per person on the roster, by whether Zoom saw them in the room. */
import type { AppStep, Ctx, Json, Zap } from '@/lib/zapier/types';
import { firstName, str } from '../../helpers';

const T = (c: Ctx) => c.trigger;
const topic = (c: Ctx) => str(T(c).Topic);
const who = (c: Ctx) => c.loop!.item;
const came = (c: Ctx) => str(c.out('attended')['Participant Emails']).toLowerCase().split(', ').includes(str(who(c).Email).toLowerCase());

const recording = (o: Partial<Json>): Json => ({
  Topic: 'Grant budgets that get funded',
  'Meeting ID': '86120450917',
  'Share URL': 'https://zoom.example/rec/share/gb-0305',
  'Start Time': '2026-03-05T13:00:00',
  Duration: '92',
  ...o,
});

const thanks: AppStep = {
  kind: 'action',
  id: 'thanks',
  app: 'Gmail',
  event: 'Send Email',
  icon: 'mail',
  title: 'Thank them, with the recording and certificate',
  summary: 'For people who were in the room: the recording, their certificate of attendance and a two-minute feedback form.',
  params: [
    { k: 'To', v: '{each › Email}' },
    { k: 'From Name', v: 'Nadia at Fieldnote' },
    { k: 'Subject', v: 'Recording and certificate: {trigger › Topic}' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'email',
        to: str(who(c).Email),
        subject: `Recording and certificate: ${topic(c)}`,
        body: `Hi ${firstName(who(c).Name)},\n\nThank you for joining ${topic(c)}.\n\nRecording (available for 30 days): ${str(T(c)['Share URL'])}\nYour certificate of attendance: https://fieldnote.example/certificate\n\nOne favor: two minutes of feedback shapes the next session. https://fieldnote.example/feedback\n\nNadia`,
      },
    ],
  }),
};

const missed: AppStep = {
  kind: 'action',
  id: 'missed',
  app: 'Gmail',
  event: 'Send Email',
  icon: 'mail',
  title: 'Send the recording to those who missed it',
  summary: 'For people who paid and could not come: the recording and the next live dates. No certificate, and no thanks for attending.',
  params: [
    { k: 'To', v: '{each › Email}' },
    { k: 'From Name', v: 'Nadia at Fieldnote' },
    { k: 'Subject', v: 'Sorry we missed you: {trigger › Topic}' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'email',
        to: str(who(c).Email),
        subject: `Sorry we missed you: ${topic(c)}`,
        body: `Hi ${firstName(who(c).Name)},\n\nSorry you could not make ${topic(c)}. Your seat includes the recording, which is available for 30 days: ${str(T(c)['Share URL'])}\n\nIf you would rather join a live session, the next dates are here, and your seat can be moved at no charge: https://fieldnote.example/workshops\n\nNadia`,
      },
    ],
  }),
};

export const afterWorkshop: Zap = {
  id: 'after-workshop',
  number: '03',
  name: 'After the workshop',
  kicker: 'Recording ready → the right email each',
  tagline: 'When the recording is ready, everyone on the roster gets one email, and it is the right one for whether they came.',
  problem:
    'After each workshop one email went to everybody: it thanked people who had not come for coming, and offered a certificate of attendance to people who had not attended. Splitting the list by hand meant exporting two reports and comparing them, so it was skipped.',
  solution:
    'When Zoom finishes processing the recording, the Zap fetches the roster for that workshop from the Attendees sheet and the list of people Zoom saw in the room. It then loops over the roster. For each person, Paths compares their email with the list from Zoom: those who came get the recording, their certificate and a feedback form; everyone else gets the recording and the next live dates.',
  folder: 'Fieldnote',
  trigger: {
    app: 'Zoom',
    event: 'New Cloud Recording',
    icon: 'video',
    type: 'instant',
    summary: 'Runs when Zoom has finished processing a cloud recording on the account, some time after the session ends.',
    params: [{ k: 'Zoom account', v: 'workshops@fieldnote.example' }],
  },
  steps: [
    {
      kind: 'action',
      id: 'roster',
      app: 'Google Sheets',
      event: 'Lookup Spreadsheet Rows (Advanced)',
      icon: 'search',
      search: 'halt',
      title: 'Fetch everyone who paid for this workshop',
      summary: 'Returns every Attendees row for the workshop as one list. A recording with no roster, such as a team meeting, stops the run here.',
      params: [
        { k: 'Worksheet', v: 'Attendees' },
        { k: 'Lookup Column', v: 'Workshop' },
        { k: 'Lookup Value', v: '{trigger › Topic}' },
        { k: 'Row Count', v: '500' },
      ],
      run: (c) => {
        const rows = c.rows('Attendees').filter((r) => str(r.Workshop) === topic(c));
        if (!rows.length) return { found: false, log: `No rows in Attendees for “${topic(c)}”` };
        return { found: true, log: `${rows.length} on the roster`, output: { Names: rows.map((r) => str(r.Name)), Emails: rows.map((r) => str(r.Email)), Count: rows.length } };
      },
    },
    {
      kind: 'action',
      id: 'attended',
      app: 'Zoom',
      event: 'Find Meeting or Webinar Participants',
      icon: 'search',
      search: 'continue',
      title: 'Ask Zoom who was in the room',
      summary: 'Returns the emails of everyone who joined. If nobody did, the step still counts as a success, so the no-shows get their email.',
      params: [
        { k: 'Meeting or Webinar ID', v: '{trigger › Meeting ID}' },
        { k: 'Should this step be considered a “success” when nothing is found?', v: 'Yes' },
      ],
      run: (c) => {
        const emails = c.rows('Zoom participants').filter((r) => str(r['Webinar ID']) === str(T(c)['Meeting ID'])).map((r) => str(r.Email));
        return { found: emails.length > 0, log: emails.length ? `${emails.length} joined` : 'Nobody joined', output: { 'Participant Emails': emails.join(', '), Count: emails.length } };
      },
    },
    {
      kind: 'loop',
      id: 'each',
      event: 'Create Loop From Line Items',
      title: 'Go through the roster one person at a time',
      summary: 'Everything after this step runs once for each person on the roster, with that person’s name and email.',
      params: [
        { k: 'Values to Loop · Name', v: '{roster › Names}' },
        { k: 'Values to Loop · Email', v: '{roster › Emails}' },
        { k: 'Maximum number of Loop iterations', v: '500' },
      ],
      noun: 'attendee',
      values: (c) => {
        const names = c.out('roster').Names as string[];
        const emails = c.out('roster').Emails as string[];
        return names.map((Name, i) => ({ Name, Email: emails[i] }));
      },
      steps: [
        {
          kind: 'paths',
          id: 'came',
          branches: [
            { name: 'Attended', rules: 'Participant Emails (Text) Contains this person’s Email', test: came, steps: [thanks] },
            { name: 'Missed it', fallback: true, steps: [missed] },
          ],
        },
      ],
    },
  ],
  autoreplay: true,
  owner: 'Jules Bennett',
  scenarios: [
    {
      id: 'thursday',
      label: 'Four on the roster, three came',
      summary: 'Thursday’s recording is ready. The loop runs four times: three people get the thank-you, and Beth, who missed it, gets the recording and new dates.',
      start: 3 * 1440 + 15 * 60 + 12,
      event: 'In Zoom: the recording of Thursday’s workshop finishes processing',
      trigger: recording({}),
      expect: { status: 'Successful', visits: ['roster', 'attended', 'each', 'came:0', 'came:1', 'thanks', 'missed'], tasks: 6, runs: 4 },
    },
    {
      id: 'nobody',
      label: 'A session nobody joined',
      summary: 'Wednesday’s small session had two seats sold and an empty room. Zoom’s list is empty, the step still succeeds, and both people get the “missed it” email.',
      start: 2 * 1440 + 14 * 60 + 40,
      event: 'In Zoom: the recording of Wednesday’s workshop finishes processing',
      trigger: recording({ Topic: 'Year-end appeals that work', 'Meeting ID': '84477201563', 'Share URL': 'https://zoom.example/rec/share/ye-0304', 'Start Time': '2026-03-04T12:00:00', Duration: '14' }),
      expect: { status: 'Successful', visits: ['each', 'came:1', 'missed'], skips: ['thanks'], tasks: 4, runs: 2 },
    },
    {
      id: 'team-meeting',
      label: 'A recording that is not a workshop',
      summary: 'Someone recorded the Monday planning call on the same Zoom account. There is no roster for it, so the run stops before anyone is emailed.',
      start: 12 * 60 + 5,
      event: 'In Zoom: the recording of “Weekly planning” finishes processing',
      trigger: recording({ Topic: 'Weekly planning', 'Meeting ID': '81133094420', 'Share URL': 'https://zoom.example/rec/share/wp-0302', 'Start Time': '2026-03-02T11:00:00', Duration: '31' }),
      expect: { status: 'Safely halted', visits: ['roster:none'], skips: ['attended', 'each', 'thanks', 'missed'], tasks: 0 },
    },
  ],
  fields: [
    { app: 'Zoom', field: 'Topic', use: 'Matches the Workshop column of the Attendees sheet.' },
    { app: 'Zoom', field: 'Meeting ID', use: 'Which session to ask Zoom about.' },
    { app: 'Zoom', field: 'Share URL', use: 'The recording’s link, in both emails.' },
    { app: 'Google Sheets', field: 'Attendees › Workshop, Name, Email', use: 'The roster the loop goes through.' },
  ],
  build: [
    { title: 'The roster search goes first, and halts', body: 'Any cloud recording on the account starts this Zap. Looking up the roster first, with the search left on “stop if nothing is found”, ends the run for a team meeting before a task is spent.' },
    { title: 'The participants search is set to continue', body: 'An empty room is a real result, not a reason to stop. That search is set to count as a success when nothing is found, so the people who paid still hear from Fieldnote.' },
    { title: 'Everything after the loop is the loop', body: 'In Zapier, each step after a Looping step runs once per value. The two searches sit before it and run once; putting either after it would repeat it for every person on the roster.' },
    { title: 'Paths inside the loop', body: 'For each person, the first path’s rule asks whether Zoom’s list of participant emails contains that person’s email. The fallback catches everyone else, so nobody on the roster gets no email.' },
    { title: 'Each iteration is its own run', body: 'A workshop of 80 people shows as 80 runs in Zap history, each Successful on its own. If one send fails, that one run errors and the other 79 are unaffected.' },
    { title: 'Know the task cost before the first big workshop', body: 'Two searches plus one email per person: 82 tasks for a roster of 80. That is counted against the plan’s monthly tasks before a 300-seat event is announced, not after.' },
  ],
  edgeCases: [
    { title: 'A roster of more than 500', body: 'A loop takes at most 500 values, and the lookup is set to return up to 500 rows. Fieldnote’s largest session is 120; a bigger event would be split across two worksheets and two runs.' },
    { title: 'Someone joined with a different email', body: 'Zoom records the email they joined with, so they do not match the roster and get the “missed it” email. It still contains the recording, and the reply address reaches Ama, who sends the certificate.' },
    { title: 'Someone joined for two minutes', body: 'They count as attended. The certificate page asks them to confirm they stayed for the session, which is the honest limit of what an email match can know.' },
    { title: 'Zoom processes the recording twice', body: 'A re-processed recording would start the Zap again and email everyone twice. Recordings are trimmed only after the follow-up has gone out, and the weekly check of Zap history looks for a second run on the same Meeting ID.' },
    { title: 'A team meeting is recorded to the cloud', body: 'The roster search finds nothing and the run ends as Safely halted, with no error email and no task used.' },
  ],
  qa: [
    'Everyone on the roster for the workshop gets exactly one email.',
    'People in Zoom’s participant list get the thank-you with the certificate link.',
    'People not in it get the “missed it” email, with no certificate link.',
    'Zap history shows one run per person on the roster.',
    'With an empty participant list, everyone gets the “missed it” email.',
    'A recording whose topic is not in the Attendees sheet ends as Safely halted.',
  ],
  features: ['Instant trigger', 'Search that halts when nothing is found', 'Search set to succeed when nothing is found', 'Looping by Zapier: Create Loop From Line Items', 'Paths inside a loop', 'Fallback path', 'One run per iteration', 'Zoom', 'Google Sheets', 'Gmail'],
};
