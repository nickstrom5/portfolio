/** 02 · Day before: each registrant waits in a Delay Until step and gets their link again a day ahead of the workshop. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { formatter, niceTime, str } from '../../helpers';

const T = (c: Ctx) => c.trigger;
const DAY = 86400000;
/** An ISO time without a zone, as epoch ms. */
const ms = (iso: unknown) => Date.parse(`${str(iso).slice(0, 19)}Z`);
const remindAt = (c: Ctx) => new Date(ms(T(c)['Webinar Start Time']) - DAY).toISOString().slice(0, 19);
const when = (c: Ctx) => str(c.out('when').Output);

const registrant = (o: Partial<Json>): Json => ({
  'First Name': 'Renata',
  Email: 'renata.silva@example.com',
  'Webinar Topic': 'Grant budgets that get funded',
  'Webinar ID': '86120450917',
  'Webinar Start Time': '2026-03-05T13:00:00',
  'Join URL': 'https://zoom.example/w/86120450917?tk=rg_5Tq2',
  'Registrant ID': 'rg_5Tq2',
  ...o,
});

export const dayBefore: Zap = {
  id: 'day-before',
  number: '02',
  name: 'Day-before email',
  kicker: 'Registrant → their link again, a day ahead',
  tagline: 'Whenever someone registered, they get their join link and what to bring one day before the workshop starts.',
  problem:
    'The join link arrives when someone pays, which can be three weeks before the workshop. By the day itself it is buried, and the half hour before each session was spent answering “where is my link?” one email at a time.',
  solution:
    'Each new registrant starts a run that works out the moment one day before their workshop and then waits for it. When that moment comes, they get one short email with their own join link, the start time and what to have ready. Someone who registers on the day itself, after that moment has passed, gets the email straight away.',
  folder: 'Fieldnote',
  trigger: {
    app: 'Zoom',
    event: 'New Webinar Registrant',
    icon: 'video',
    type: 'instant',
    summary: 'Runs for each person registered for any Fieldnote webinar, including the ones Zap 01 registers.',
    params: [{ k: 'Webinar', v: 'Any webinar on the account' }],
  },
  steps: [
    formatter({
      id: 'remind-at',
      title: 'Work out one day before the start',
      event: 'Date / Time',
      transform: 'Add/Subtract Time',
      input: '{trigger › Webinar Start Time}',
      summary: 'Takes the workshop’s start and subtracts a day. The Delay step needs a date; it cannot do the sum itself.',
      extra: [
        { k: 'Expression', v: '-1 day' },
        { k: 'To Format', v: 'YYYY-MM-DDTHH:mm:ss' },
      ],
      run: (c) => ({ log: `One day before is ${niceTime(remindAt(c))}`, output: { Output: remindAt(c) } }),
    }),
    {
      kind: 'delay',
      id: 'wait',
      event: 'Delay Until',
      title: 'Wait until a day before the workshop',
      summary: 'The run sits here, shown as Delayed, for hours or weeks. If the moment has already passed by less than a day, it carries straight on.',
      params: [
        { k: 'Date/Time Delayed Until', v: '{remind-at › Output}' },
        { k: 'How Should We Handle Dates In The Past?', v: 'Continue if it’s up to one day (default)' },
      ],
      until: (c) => c.now + (ms(c.out('remind-at').Output) - ms(c.iso)),
    },
    formatter({
      id: 'when',
      title: 'Put the start time in plain words',
      event: 'Date / Time',
      transform: 'Format',
      input: '{trigger › Webinar Start Time}',
      summary: 'For the subject line and the first sentence of the email.',
      extra: [
        { k: 'To Format', v: 'ddd, MMM D [at] h:mm A' },
        { k: 'To Timezone', v: 'America/New_York' },
      ],
      run: (c) => ({ output: { Output: niceTime(T(c)['Webinar Start Time']) } }),
    }),
    {
      kind: 'action',
      id: 'prep',
      app: 'Gmail',
      event: 'Send Email',
      icon: 'mail',
      title: 'Send the link and what to bring',
      summary: 'Short enough to read on a phone: when, the link, and three things to have ready.',
      params: [
        { k: 'To', v: '{trigger › Email}' },
        { k: 'From Name', v: 'Fieldnote Workshops' },
        { k: 'Subject', v: '{trigger › Webinar Topic}: {when › Output} Eastern' },
        { k: 'Body', v: 'Hi {trigger › First Name}… Your link: {trigger › Join URL}' },
      ],
      run: (c) => ({
        messages: [
          {
            channel: 'email',
            to: str(T(c).Email),
            subject: `${str(T(c)['Webinar Topic'])}: ${when(c)} Eastern`,
            body: `Hi ${str(T(c)['First Name'])},\n\n${str(T(c)['Webinar Topic'])} starts ${when(c)} Eastern and runs 90 minutes.\n\nYour link: ${str(T(c)['Join URL'])}\n\nTo get the most from it, have ready:\n1. A budget or appeal you are working on now\n2. Last year’s numbers for the same program\n3. One question you want answered\n\nThe room opens ten minutes early. If you cannot make it, you will get the recording afterwards.\n\nNadia and the Fieldnote team`,
          },
        ],
      }),
    },
  ],
  autoreplay: true,
  owner: 'Jules Bennett',
  scenarios: [
    {
      id: 'early',
      label: 'Registered three days ahead',
      summary: 'Renata registers on Monday for Thursday’s workshop. The run waits until Wednesday at 1 pm, then sends the email.',
      start: 10 * 60 + 27,
      event: 'In Zoom: Renata is registered for Thursday’s workshop',
      trigger: registrant({}),
      expect: { status: 'Successful', visits: ['remind-at', 'wait', 'when', 'prep'], tasks: 1 },
    },
    {
      id: 'last-minute',
      label: 'Registered on the morning of the workshop',
      summary: 'Arjun registers three hours before the start. “One day before” was yesterday, less than a day ago, so the email goes at once.',
      start: 3 * 1440 + 9 * 60 + 58,
      event: 'In Zoom: Arjun is registered for today’s workshop',
      trigger: registrant({ 'First Name': 'Arjun', Email: 'arjun.rao@example.com', 'Join URL': 'https://zoom.example/w/86120450917?tk=rg_8Lm4', 'Registrant ID': 'rg_8Lm4' }),
      expect: { status: 'Successful', visits: ['wait', 'prep'], tasks: 1 },
    },
    {
      id: 'sending-limit',
      label: 'Gmail’s daily limit is reached',
      summary: 'A large workshop’s reminders all come due in the same minute and Gmail refuses the last few. The run errors and Jules is emailed.',
      start: 1440 + 11 * 60 + 3,
      event: 'In Zoom: Mei is registered for Wednesday’s workshop',
      trigger: registrant({ 'First Name': 'Mei', Email: 'mei.tanaka@example.com', 'Webinar Topic': 'Year-end appeals that work', 'Webinar ID': '84477201563', 'Webinar Start Time': '2026-03-04T12:00:00', 'Join URL': 'https://zoom.example/w/84477201563?tk=rg_2Nc7', 'Registrant ID': 'rg_2Nc7' }),
      failures: { prep: { message: 'Gmail: “Daily user sending limit exceeded.”' } },
      expect: { status: 'Errored', visits: ['remind-at', 'wait', 'when'], skips: ['prep'], tasks: 0 },
    },
  ],
  fields: [
    { app: 'Zoom', field: 'Webinar Start Time', use: 'The moment everything is measured from.' },
    { app: 'Zoom', field: 'Join URL', use: 'The registrant’s own link, repeated in the email.' },
    { app: 'Zoom', field: 'First Name, Email, Webinar Topic', use: 'Who to write to and about what.' },
  ],
  build: [
    { title: 'One run per person, parked in a delay', body: 'There is no nightly job that works out who needs a reminder. Each registrant’s own run waits in a Delay Until step and wakes at the right time, so a workshop added tomorrow needs no change.' },
    { title: 'Formatter does the date sum', body: 'Delay Until takes a date; it cannot subtract a day from one. A Date / Time step with the expression “-1 day” produces the moment to wait for. Both steps are free.' },
    { title: 'Dates in the past, left on the default', body: 'Delay Until asks what to do when its date has already gone. The default, continue if it is up to one day past, is exactly right here: a same-day registrant gets the email at once.' },
    { title: 'A delay needs the Zap to stay on', body: 'Runs waiting in a delay only continue if the Zap is on when their time comes. This Zap is edited as a draft and published, never switched off, while registrants are waiting.' },
    { title: 'Format the time after the wait', body: 'The Format step sits after the delay only so the editor reads in the order things happen. Formatter steps cost nothing wherever they sit.' },
  ],
  edgeCases: [
    { title: 'Someone registers more than 30 days ahead', body: 'A delay can hold a run for at most 30 days. Registration for each workshop opens three weeks before it, so no run waits longer than 20 days; opening sales earlier would need a different design.' },
    { title: 'The workshop is moved', body: 'Runs already waiting keep the old time. Moving a workshop is rare and announced by email from Mailchimp; the checklist for it includes replaying or cancelling the waiting runs in Zap history.' },
    { title: 'Many reminders come due together', body: 'Everyone who registered early is released at the same moment. Up to about a hundred emails is within the account’s Gmail limits; beyond that the send step would move to a bulk email service.' },
    { title: 'Someone registers after the workshop has started', body: 'By then “one day before” is more than a day in the past, which the default setting does not continue from, so no reminder goes out. That is fine: Zoom’s own confirmation, sent the moment they registered, has their link.' },
    { title: 'A registrant is removed in Zoom', body: 'Their run still wakes and emails them. For a refund, Ama finds the delayed run by email address in Zap history and cancels it.' },
  ],
  qa: [
    'A registrant three days ahead shows as Delayed, then gets one email a day before the start.',
    'The email’s link is that registrant’s own Join URL.',
    'A same-day registrant gets the email within a minute.',
    'The time in the subject is Eastern and matches the Zoom webinar.',
    'With Gmail refusing the send, the run errors at the last step and Jules gets Zapier’s email.',
  ],
  features: ['Instant trigger', 'Formatter: Add/Subtract Time', 'Delay Until', 'Dates in the past', 'Formatter: Date / Time Format', 'Autoreplay', 'Zoom', 'Gmail'],
};
