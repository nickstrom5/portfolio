/** 03 · Daily roundup: at 5:30 on weekdays, the day's bookings in one Slack post and one email, or nothing at all. */
import type { Ctx, Zap } from '@/lib/zapier/types';
import { str } from '../../helpers';

const digest = (c: Ctx) => str(c.out('release')['Final Digest']);

const BUSY = [
  'New consult: Carla Jimenez with Elena Park · Thu, Mar 5 at 4:00 PM',
  'Consult moved: Priya Shah with Elena Park · Fri, Mar 6 at 11:00 AM',
  'New consult: Owen Hart with Tom Whitaker · Mon, Mar 9 at 9:30 AM',
  'New consult: Dale Kim with Sofia Marin · Fri, Mar 6 at 2:00 PM',
  'New consult: Ruth Abara with Tom Whitaker · Thu, Mar 5 at 10:00 AM',
  'New consult: Gil Navarro with Elena Park · Tue, Mar 10 at 3:30 PM',
];

export const dailyRoundup: Zap = {
  id: 'daily-roundup',
  number: '03',
  name: 'Daily roundup',
  kicker: 'Weekdays at 5:30 → one message',
  tagline: 'Managers get the day’s bookings in one post at the end of the day, and on a day with none they get nothing.',
  problem:
    'Managers wanted to know what had been booked each day without reading every line of a busy channel, and the VP of sales, who is rarely in Slack, wanted the same by email. A daily message that says “nothing today” teaches everyone to ignore the daily message.',
  solution:
    'Every weekday at 5:30 pm the Zap releases the “Consults today” digest that Zap 02 has been adding to. If the digest is empty, a filter ends the run there. Otherwise the list goes to #sales-floor and by email to the VP of sales, and the digest is cleared for tomorrow.',
  folder: 'Sales / Consults',
  trigger: {
    app: 'Schedule by Zapier',
    event: 'Every Day',
    icon: 'clock',
    type: 'schedule',
    summary: 'Runs at 5:30 pm, Monday to Friday, in the account’s time zone.',
    params: [
      { k: 'Trigger on Weekends?', v: 'No' },
      { k: 'Time of Day', v: '5:30 pm' },
      { k: 'Time zone', v: 'America/Phoenix (the account’s)' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'release',
      app: 'Digest by Zapier',
      event: 'Release Existing Digest',
      icon: 'digest',
      title: 'Hand over the day’s list',
      summary: 'Returns every entry added since the last release as one block of text, and empties the digest.',
      params: [
        { k: 'Digest', v: 'Consults today' },
        { k: 'Delete Digest on Release', v: 'Yes' },
      ],
      run: (c) => {
        const entries = (c.fixtures.entries as string[] | undefined) ?? [];
        return {
          log: entries.length ? `${entries.length} entries released` : 'The digest is empty',
          output: { 'Final Digest': entries.join('\n') },
          effects: entries.length ? [{ app: 'Digest by Zapier', what: 'Digest released and cleared', name: 'Consults today', fields: { Entries: String(entries.length) } }] : [],
        };
      },
    },
    {
      kind: 'filter',
      id: 'any',
      title: 'Only if something was booked',
      summary: 'An empty digest ends the run here, so a quiet day sends no message.',
      rules: 'Final Digest Exists',
      params: [{ k: 'Only continue if', v: '{release › Final Digest} Exists' }],
      test: (c) => digest(c).trim() !== '',
    },
    {
      kind: 'action',
      id: 'post',
      app: 'Slack',
      event: 'Send Channel Message',
      icon: 'slack',
      title: 'Post the list',
      summary: 'One message in #sales-floor, where managers plan the next day.',
      params: [
        { k: 'Channel', v: '#sales-floor' },
        { k: 'Message Text', v: 'Consults booked or moved today:\n{release › Final Digest}' },
      ],
      run: (c) => ({ messages: [{ channel: 'slack', to: '#sales-floor', body: `Consults booked or moved today:\n${digest(c)}` }] }),
    },
    {
      kind: 'action',
      id: 'mail',
      app: 'Gmail',
      event: 'Send Email',
      icon: 'mail',
      title: 'Email the VP of sales',
      summary: 'The same list, for someone who reads email, not Slack.',
      params: [
        { k: 'To', v: 'monica@kettlebrook.example' },
        { k: 'From Name', v: 'Kettlebrook sales ops' },
        { k: 'Subject', v: 'Consults booked or moved today' },
        { k: 'Body', v: '{release › Final Digest}' },
      ],
      run: (c) => ({
        messages: [{ channel: 'email', to: 'monica@kettlebrook.example', subject: 'Consults booked or moved today', body: `Hi Monica,\n\nToday’s bookings:\n\n${digest(c)}\n\nEach one is a deal in HubSpot, in the Consult booked stage.\n\nSales ops` }],
      }),
    },
  ],
  autoreplay: true,
  owner: 'Darius Cole',
  scenarios: [
    {
      id: 'busy',
      label: 'A normal weekday',
      summary: 'Six bookings came in today. They go out as one Slack post and one email.',
      start: 3 * 1440 + 17 * 60 + 30,
      trigger: { 'Pretty Date': 'Thursday at 5:30 PM' },
      fixtures: { entries: BUSY },
      expect: { status: 'Successful', visits: ['release', 'any', 'post', 'mail'], tasks: 2 },
    },
    {
      id: 'quiet',
      label: 'A day with no bookings',
      summary: 'The digest is empty, so the filter ends the run. Nobody receives a message that says nothing.',
      start: 4 * 1440 + 17 * 60 + 30,
      trigger: { 'Pretty Date': 'Friday at 5:30 PM' },
      fixtures: { entries: [] },
      expect: { status: 'Filtered', visits: ['release', 'any:stop'], skips: ['post', 'mail'], tasks: 0 },
    },
    {
      id: 'slack-renamed',
      label: '#sales-floor was renamed',
      summary: 'The digest has been released and cleared, then the Slack post fails. The list is not lost: it is in this run, ready to replay.',
      start: 2 * 1440 + 17 * 60 + 30,
      trigger: { 'Pretty Date': 'Wednesday at 5:30 PM' },
      fixtures: { entries: BUSY.slice(0, 3) },
      failures: { post: { message: 'Slack: “channel_not_found”. There is no channel called #sales-floor.' } },
      expect: { status: 'Errored', visits: ['release', 'any'], skips: ['post', 'mail'], tasks: 0 },
    },
  ],
  fields: [
    { app: 'Digest by Zapier', field: 'Consults today', use: 'The digest Zap 02 adds to. Its title must match exactly in both Zaps.' },
    { app: 'Digest by Zapier', field: 'Final Digest', use: 'The released entries as text. Empty means nothing was booked.' },
    { app: 'Schedule by Zapier', field: 'Time of Day, Trigger on Weekends?', use: 'When the roundup goes out.' },
  ],
  build: [
    { title: 'Two Zaps, one digest', body: 'Zap 02 appends; this Zap releases. Keeping them apart means the roundup’s time, channel and wording can change without touching the Zap that handles bookings.' },
    { title: 'Release, then filter', body: 'On a quiet day the release comes back with an empty Final Digest. The filter right after checks that it exists, so nothing is posted when there is nothing to say.' },
    { title: 'Delete on release', body: 'The digest is cleared each time it is released, so tomorrow’s list starts empty and the digest never grows past Zapier’s size limit.' },
    { title: 'Nearly free to run', body: 'The schedule trigger, the Digest step and the filter use no tasks. A quiet day costs nothing; a busy one costs two tasks, however many bookings there were.' },
    { title: 'Email after Slack', body: 'If the Slack post fails, the run stops before the email. Replaying the run from the failed step then sends both, so the VP never gets a list the team has not seen.' },
  ],
  edgeCases: [
    { title: 'The Slack post fails after the digest is cleared', body: 'The released text is part of this run’s data in Zap history. Once the channel is fixed, replaying from the failed step posts the same list; nothing has to be re-collected.' },
    { title: 'A booking comes in at 5:31', body: 'It is added to the digest after the release and appears in tomorrow’s roundup. The message says “today” and means “since the last roundup”, which the team was told at handoff.' },
    { title: 'A public holiday', body: 'The schedule still runs. With no bookings the filter stops it; with bookings from a rep who worked, the list goes out as usual.' },
    { title: 'Someone renames the digest in Zap 02', body: 'This Zap would then release an empty digest every day and stay silent. The title “Consults today” is listed in the handoff guide as a name not to change in one Zap without the other.' },
    { title: 'The Zap is off at 5:30', body: 'That day’s release does not happen and the entries stay in the digest, so the next roundup carries two days of bookings.' },
  ],
  qa: [
    'With entries in the digest, one Slack post and one email go out, each listing every entry once.',
    'After a release the digest is empty.',
    'With an empty digest the run ends as Filtered and nothing is sent.',
    'The schedule does not run on Saturday or Sunday.',
    'With the Slack post failing, no email is sent, and replaying the run sends both.',
  ],
  features: ['Schedule by Zapier', 'Digest by Zapier: Release Existing Digest', 'Filter by Zapier', 'Two Zaps sharing one digest', 'Autoreplay', 'Slack', 'Gmail'],
};
