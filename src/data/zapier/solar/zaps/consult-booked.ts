/** 02 · Consult booked: a Calendly booking becomes a HubSpot deal, the team is told, and the booking joins the day's list. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { formatter, niceTime, str } from '../../helpers';

const T = (c: Ctx) => c.trigger;
const dealName = (c: Ctx) => `Solar consult · ${str(T(c)['Invitee Name'])}`;
const when = (c: Ctx) => str(c.out('when').Output);
const kind = (c: Ctx) => str(c.out('kind').Output);
const line = (c: Ctx) => `${kind(c)}: ${str(T(c)['Invitee Name'])} with ${str(T(c)['Host Name'])} · ${when(c)}`;

const booking = (o: Partial<Json>): Json => ({
  'Invitee Name': 'Carla Jimenez',
  'Invitee Email': 'carla.jimenez@example.com',
  'Event Type Name': 'Home solar consult (45 min)',
  'Event Start Time': '2026-03-05T16:00:00',
  'Host Name': 'Elena Park',
  Location: 'Video call',
  'Event ID': 'cal_81ab30',
  ...o,
});

export const consultBooked: Zap = {
  id: 'consult-booked',
  number: '02',
  name: 'Consult booked',
  kicker: 'Booking → deal, team told, day’s list',
  tagline: 'When a homeowner books or moves a consultation, HubSpot has the deal with the right date before the rep has closed the tab.',
  problem:
    'Consultations were booked in Calendly and typed into HubSpot later, or not at all, so the pipeline report was always a few days behind what the calendar already knew. When someone moved their booking, the old date stayed in HubSpot. Managers found out what had been booked by asking in Slack.',
  solution:
    'Each new or moved booking of a solar consultation finds the homeowner in HubSpot, or adds them, then finds their consult deal or creates it, and sets the consult date either way. So a moved booking updates the deal it already has. The team sees one line in #consults, and the same line is added to a digest that the third Zap sends out at the end of the day.',
  folder: 'Sales / Consults',
  trigger: {
    app: 'Calendly',
    event: 'Invitee Created or Rescheduled',
    icon: 'calendar',
    type: 'instant',
    summary: 'Runs when someone books a time on any of the team’s Calendly event types, or moves a booking they already have.',
    params: [{ k: 'Calendly account', v: 'Kettlebrook team account (every host’s bookings)' }],
  },
  steps: [
    {
      kind: 'filter',
      id: 'is-consult',
      title: 'Only solar consultations',
      summary: 'The same Calendly account books interviews and rep one-to-ones. Those stop here.',
      rules: 'Event Type Name (Text) Contains solar consult',
      params: [{ k: 'Only continue if', v: '{trigger › Event Type Name} (Text) Contains solar consult' }],
      test: (c) => str(T(c)['Event Type Name']).toLowerCase().includes('solar consult'),
    },
    {
      kind: 'action',
      id: 'contact',
      app: 'HubSpot',
      event: 'Find or Create Contact',
      icon: 'search',
      search: 'create',
      title: 'Find the homeowner, or add them',
      summary: 'Most people are already in HubSpot from the ad. A referral who booked straight from a rep’s link is created here.',
      params: [
        { k: 'Search property', v: 'Email' },
        { k: 'Search value', v: '{trigger › Invitee Email}' },
        { k: 'Create HubSpot Contact if it doesn’t exist yet?', v: 'Yes' },
        { k: 'Full name (if created)', v: '{trigger › Invitee Name}' },
        { k: 'Lead status (if created)', v: 'Consult booked' },
        { k: 'Original source (if created)', v: 'Calendly · booked directly' },
      ],
      run: (c) => {
        const email = str(T(c)['Invitee Email']).trim().toLowerCase();
        const hit = c.rows('HubSpot contacts').find((r) => str(r.Email).toLowerCase() === email);
        if (hit) return { found: true, log: `Found contact ${str(hit.Id)}`, output: { Id: hit.Id } };
        const [first, ...rest] = str(T(c)['Invitee Name']).split(' ');
        const row = { Id: '30152', Email: str(T(c)['Invitee Email']), 'First Name': first, 'Last Name': rest.join(' '), 'Contact Owner': str(T(c)['Host Name']), 'Lead Status': 'Consult booked' };
        return {
          found: false,
          log: 'Not in HubSpot, so created',
          output: { Id: row.Id },
          write: [{ collection: 'HubSpot contacts', row }],
          effects: [{ app: 'HubSpot', what: 'Contact created', name: str(T(c)['Invitee Name']), fields: { Email: row.Email, 'Lead status': 'Consult booked', 'Original source': 'Calendly · booked directly' } }],
        };
      },
    },
    {
      kind: 'action',
      id: 'deal',
      app: 'HubSpot',
      event: 'Find or Create Deal',
      icon: 'search',
      search: 'create',
      title: 'Find their consult deal, or create it',
      summary: 'Searches by the deal’s name. A first booking creates the deal in the Consult booked stage; a moved booking finds the one that is already there.',
      params: [
        { k: 'Search property', v: 'Deal name' },
        { k: 'Search value', v: 'Solar consult · {trigger › Invitee Name}' },
        { k: 'Create HubSpot Deal if it doesn’t exist yet?', v: 'Yes' },
        { k: 'Pipeline (if created)', v: 'Residential sales' },
        { k: 'Deal stage (if created)', v: 'Consult booked' },
        { k: 'Associated contact (if created)', v: '{contact › Id}' },
      ],
      run: (c) => {
        const hit = c.rows('HubSpot deals').find((r) => str(r['Deal Name']) === dealName(c));
        if (hit) return { found: true, log: `Found deal ${str(hit.Id)}, consult was ${niceTime(hit['Consult Date'])}`, output: { Id: hit.Id, 'Deal Name': hit['Deal Name'] } };
        const row = { Id: '8859', 'Deal Name': dealName(c), 'Deal Stage': 'Consult booked', 'Deal Owner': str(T(c)['Host Name']) };
        return {
          found: false,
          log: 'No deal yet, so created',
          output: { Id: row.Id, 'Deal Name': row['Deal Name'] },
          write: [{ collection: 'HubSpot deals', row }],
          effects: [{ app: 'HubSpot', what: 'Deal created', name: dealName(c), fields: { Pipeline: 'Residential sales', 'Deal stage': 'Consult booked', Contact: str(T(c)['Invitee Name']) } }],
        };
      },
    },
    {
      kind: 'action',
      id: 'date',
      app: 'HubSpot',
      event: 'Update Deal',
      icon: 'pen',
      title: 'Set the consult date and the owner',
      summary: 'Runs for new and moved bookings alike, so the deal always shows the time that is on the calendar now.',
      params: [
        { k: 'Deal', v: '{deal › Id}' },
        { k: 'Consult date', v: '{trigger › Event Start Time}' },
        { k: 'Deal owner', v: '{trigger › Host Name}' },
      ],
      run: (c) => ({ effects: [{ app: 'HubSpot', what: 'Deal updated', name: dealName(c), fields: { 'Consult date': niceTime(T(c)['Event Start Time']), 'Deal owner': str(T(c)['Host Name']) } }] }),
    },
    formatter({
      id: 'when',
      title: 'Put the time in plain words',
      event: 'Date / Time',
      transform: 'Format',
      input: '{trigger › Event Start Time}',
      summary: 'Calendly sends a timestamp. The message wants “Thu, Mar 5 at 4:00 PM”.',
      extra: [
        { k: 'To Format', v: 'ddd, MMM D [at] h:mm A' },
        { k: 'To Timezone', v: 'America/Phoenix' },
      ],
      run: (c) => ({ output: { Output: niceTime(T(c)['Event Start Time']) } }),
    }),
    formatter({
      id: 'kind',
      title: 'New booking, or a moved one?',
      event: 'Utilities',
      transform: 'Lookup Table',
      input: '{deal › Zap Data Was Found}',
      summary: 'Turns the deal search’s true or false into words a person can read in the message.',
      extra: [
        { k: 'Lookup Table', v: 'false → New consult · true → Consult moved' },
        { k: 'Fallback Value', v: 'Consult' },
      ],
      run: (c) => ({ output: { Output: c.out('deal')['Zap Data Was Found'] ? 'Consult moved' : 'New consult' } }),
    }),
    {
      kind: 'action',
      id: 'digest',
      app: 'Digest by Zapier',
      event: 'Append Entry and Schedule Digest',
      icon: 'digest',
      title: 'Add it to the day’s list',
      summary: 'One line per booking, collected under the title “Consults today”. The frequency is Manual: Zap 03 releases the list.',
      params: [
        { k: 'Title', v: 'Consults today' },
        { k: 'Entry', v: '{kind › Output}: {trigger › Invitee Name} with {trigger › Host Name} · {when › Output}' },
        { k: 'Frequency', v: 'Manual' },
      ],
      run: (c) => ({ log: 'Entry added to “Consults today”', effects: [{ app: 'Digest by Zapier', what: 'Entry added to “Consults today”', name: str(T(c)['Invitee Name']), fields: { Entry: line(c) } }] }),
    },
    {
      kind: 'action',
      id: 'post',
      app: 'Slack',
      event: 'Send Channel Message',
      icon: 'slack',
      title: 'Tell the team',
      summary: 'One line in #consults, which reps can mute and managers can watch.',
      params: [
        { k: 'Channel', v: '#consults' },
        { k: 'Message Text', v: '{kind › Output}: {trigger › Invitee Name} with {trigger › Host Name} · {when › Output}' },
      ],
      run: (c) => ({ messages: [{ channel: 'slack', to: '#consults', body: `${line(c)}\nDeal: https://app.hubspot.example/deal/${str(c.out('deal').Id)}` }] }),
    },
  ],
  autoreplay: true,
  owner: 'Darius Cole',
  scenarios: [
    {
      id: 'new',
      label: 'A first booking',
      summary: 'Carla books a consultation with Elena. A deal is created, dated, posted and added to the day’s list.',
      start: 10 * 60 + 2,
      event: 'In Calendly: Carla books “Home solar consult” with Elena',
      trigger: booking({}),
      world: { 'HubSpot contacts': [{ Id: '30140', Email: 'carla.jimenez@example.com', 'First Name': 'Carla', 'Last Name': 'Jimenez', 'Contact Owner': 'Elena Park', 'Lead Status': 'New' }] },
      expect: { status: 'Successful', visits: ['is-consult', 'contact', 'deal', 'date', 'when', 'kind', 'digest', 'post'], tasks: 4 },
    },
    {
      id: 'moved',
      label: 'A booking is moved',
      summary: 'Priya moves her consultation from Wednesday to Friday. Her existing deal is found and its date changed; no second deal appears.',
      start: 1440 + 8 * 60 + 47,
      event: 'In Calendly: Priya moves her consult to Friday at 11',
      trigger: booking({ 'Invitee Name': 'Priya Shah', 'Invitee Email': 'priya.shah@example.com', 'Event Start Time': '2026-03-06T11:00:00', 'Event ID': 'cal_77fe12' }),
      expect: { status: 'Successful', visits: ['contact', 'deal', 'date', 'digest', 'post'], tasks: 4 },
    },
    {
      id: 'referral',
      label: 'A referral books from a rep’s link',
      summary: 'Owen was never an ad lead. Both searches come back empty, so the contact and the deal are created in the same run.',
      start: 2 * 1440 + 15 * 60 + 30,
      event: 'In Calendly: Owen books “Home solar consult” with Tom',
      trigger: booking({ 'Invitee Name': 'Owen Hart', 'Invitee Email': 'owen.hart@example.com', 'Event Start Time': '2026-03-09T09:30:00', 'Host Name': 'Tom Whitaker', 'Event ID': 'cal_19cd44' }),
      expect: { status: 'Successful', visits: ['contact', 'deal', 'date', 'digest', 'post'], tasks: 4 },
    },
    {
      id: 'internal',
      label: 'A rep books a one-to-one',
      summary: 'The same Calendly account holds internal meetings. This one is not a consultation, so the run stops at the filter.',
      start: 2 * 1440 + 9 * 60 + 5,
      event: 'In Calendly: a rep books “Rep 1:1” with Monica',
      trigger: booking({ 'Invitee Name': 'Sam Ortiz', 'Invitee Email': 'sam.ortiz@kettlebrook.example', 'Event Type Name': 'Rep 1:1 (30 min)', 'Event Start Time': '2026-03-05T13:00:00', 'Host Name': 'Monica Reyes', 'Event ID': 'cal_52aa09' }),
      expect: { status: 'Filtered', visits: ['is-consult:stop'], skips: ['contact', 'deal', 'post'], tasks: 0 },
    },
    {
      id: 'slack-renamed',
      label: '#consults was renamed',
      summary: 'The Slack post fails. HubSpot is already right and the booking is already on the day’s list, because Slack is the last step.',
      start: 3 * 1440 + 13 * 60 + 18,
      event: 'In Calendly: Carla books “Home solar consult” with Elena',
      trigger: booking({ 'Event Start Time': '2026-03-10T14:00:00', 'Event ID': 'cal_90be71' }),
      world: { 'HubSpot contacts': [{ Id: '30140', Email: 'carla.jimenez@example.com', 'First Name': 'Carla', 'Last Name': 'Jimenez', 'Contact Owner': 'Elena Park', 'Lead Status': 'New' }] },
      failures: { post: { message: 'Slack: “channel_not_found”. There is no channel called #consults.' } },
      expect: { status: 'Errored', visits: ['deal', 'date', 'digest'], skips: ['post'], tasks: 3 },
    },
  ],
  fields: [
    { app: 'Calendly', field: 'Event Type Name', use: 'Must contain “solar consult” for the run to continue.' },
    { app: 'Calendly', field: 'Invitee Email', use: 'How the HubSpot contact is found.' },
    { app: 'Calendly', field: 'Event Start Time, Host Name', use: 'Become the deal’s consult date and owner.' },
    { app: 'HubSpot', field: 'Deal name', use: '“Solar consult · name”: the key that stops a moved booking creating a second deal.' },
    { app: 'Digest by Zapier', field: 'Consults today', use: 'One entry per booking, released by Zap 03.' },
  ],
  build: [
    { title: 'One trigger for new and moved bookings', body: 'Calendly’s trigger fires for both. The Zap does not need to know which: the two “find or create” steps make a first booking and a moved one end in the same place.' },
    { title: 'A deal name that can be searched', body: 'Deals are named “Solar consult · ” and the homeowner’s name, and the search looks for exactly that. It is the simplest key that needs no custom property in HubSpot.' },
    { title: 'Update the deal every time', body: 'Update Deal runs after the search whether the deal was found or created. That is one task per booking, spent so the Zap has no branches to keep in step.' },
    { title: 'A lookup table to turn true into words', body: 'The deal search reports “Zap Data Was Found” as true or false. A two-row lookup table turns that into “Consult moved” or “New consult” for the message, with no task used.' },
    { title: 'The digest before Slack', body: 'Slack is the step most likely to break, because channels get renamed. With the digest step ahead of it, a failed post still leaves the booking in the end-of-day roundup.' },
    { title: 'Manual frequency, on purpose', body: 'The digest only collects. Releasing it is a separate Zap on a schedule, so the time of the roundup can change without touching this one.' },
  ],
  edgeCases: [
    { title: 'Two homeowners with the same name', body: 'They would share a deal name, and the second booking would find the first person’s deal. It has not happened yet; if it does, the search moves to a custom property holding the Calendly invitee ID.' },
    { title: 'A booking is cancelled', body: 'This Zap does not hear about it: cancellations are a different Calendly trigger. The deal stays in Consult booked until the rep moves it, which the weekly pipeline review catches.' },
    { title: 'The host is not a HubSpot user', body: 'Update Deal would fail on the owner and the run would error. Every Calendly host is checked against HubSpot’s users when they are added to the team account.' },
    { title: 'Slack is down or the channel is gone', body: 'HubSpot and the digest are already updated. Autoreplay tries the post again; if it never works, Darius gets the error email and replays the run once the channel is fixed.' },
    { title: 'An event type is renamed', body: 'The filter looks for “solar consult” in the name, so “Home solar consult (60 min)” still passes. Renaming it to something without those words would silently stop the Zap, which is why the name is in the handoff guide.' },
  ],
  qa: [
    'A first booking creates one deal in Consult booked with the right date and owner.',
    'Moving that booking changes the date on the same deal; no second deal exists.',
    'A homeowner who is not in HubSpot is created and linked to the deal.',
    'An internal event type ends as Filtered.',
    'Each booking adds one entry to “Consults today”.',
    'With the Slack post failing, the deal and the digest entry are still there.',
  ],
  features: ['Instant trigger', 'Filter by Zapier', 'Find or Create, twice', 'Formatter: Date / Time', 'Formatter: Lookup Table', 'Digest by Zapier, Manual frequency', 'Autoreplay', 'HubSpot', 'Slack'],
};
