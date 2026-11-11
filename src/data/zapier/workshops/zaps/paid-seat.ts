/** 01 · Paid seat: a completed Stripe checkout becomes a Zoom registration, a roster row and, with consent, a Mailchimp subscriber. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { firstName, formatter, niceTime, str } from '../../helpers';
import { WORKSHOPS } from '../business';

const T = (c: Ctx) => c.trigger;
const topic = (c: Ctx) => str(T(c)['Metadata Workshop']);
const buyer = (c: Ctx) => str(T(c)['Customer Details Name']);
const email = (c: Ctx) => str(T(c)['Customer Details Email']);

const checkout = (o: Partial<Json>): Json => ({
  ID: 'cs_live_a1Qx7Lm2',
  'Customer Details Name': 'Renata Silva',
  'Customer Details Email': 'renata.silva@example.com',
  'Payment Status': 'paid',
  'Amount Total': '12900',
  Currency: 'usd',
  'Metadata Workshop': 'Grant budgets that get funded',
  'Consent Promotions': 'opt_in',
  ...o,
});

export const paidSeat: Zap = {
  id: 'paid-seat',
  number: '01',
  name: 'Paid seat',
  kicker: 'Payment → Zoom seat, roster, list',
  tagline: 'Someone pays for a seat and has their own Zoom link before they have closed the receipt.',
  problem:
    'Buyers were registered in Zoom by hand, from Stripe’s receipt emails, when the founder had an evening free. People who paid on the day of a workshop sometimes had no link when it started. The attendee list lived in three places that never agreed, and everyone who bought a seat was added to the newsletter whether they had asked for it or not.',
  solution:
    'When a checkout completes and the payment has cleared, the Zap looks up which Zoom webinar belongs to that workshop and registers the buyer, so Zoom sends their personal join link at once. It adds a row to the Attendees sheet and a line in Slack. Last, a filter checks the box the buyer ticked at checkout: only those who asked to hear about new dates are added to Mailchimp, tagged with the workshop they bought.',
  folder: 'Fieldnote',
  trigger: {
    app: 'Stripe',
    event: 'Checkout Session Completed',
    icon: 'card',
    type: 'instant',
    summary: 'Runs when someone finishes paying through any of the workshop payment links.',
    params: [{ k: 'Stripe account', v: 'Fieldnote (live mode)' }],
  },
  steps: [
    {
      kind: 'filter',
      id: 'paid',
      title: 'Only when the money has arrived',
      summary: 'A card payment is paid at once. A bank debit completes the checkout first and clears days later; that run stops here.',
      rules: 'Payment Status (Text) Exactly matches paid',
      params: [{ k: 'Only continue if', v: '{trigger › Payment Status} (Text) Exactly matches paid' }],
      test: (c) => str(T(c)['Payment Status']) === 'paid',
    },
    formatter({
      id: 'webinar',
      title: 'Which Zoom webinar is this workshop?',
      event: 'Utilities',
      transform: 'Lookup Table',
      input: '{trigger › Metadata Workshop}',
      summary: 'Each payment link carries the workshop’s name. This table turns the name into that workshop’s Zoom webinar ID.',
      extra: [
        { k: 'Lookup Table', v: Object.entries(WORKSHOPS).map(([k, v]) => `${k} → ${v.zoom}`).join(' · ') },
        { k: 'Fallback Value', v: '(left empty, on purpose)' },
      ],
      run: (c) => ({ log: WORKSHOPS[topic(c)] ? `Webinar ${WORKSHOPS[topic(c)].zoom}` : 'No row for this workshop, so the output is empty', output: { Output: WORKSHOPS[topic(c)]?.zoom ?? '' } }),
    }),
    formatter({
      id: 'first',
      title: 'Take the first name',
      event: 'Text',
      transform: 'Split Text',
      input: '{trigger › Customer Details Name}',
      summary: 'Stripe gives one name field; Zoom wants a first name. This keeps everything before the first space.',
      extra: [
        { k: 'Separator', v: '[:space:]' },
        { k: 'Segment Index', v: 'First' },
      ],
      run: (c) => ({ output: { Output: firstName(buyer(c)) } }),
    }),
    {
      kind: 'action',
      id: 'register',
      app: 'Zoom',
      event: 'Create Webinar Registrant',
      icon: 'video',
      title: 'Give them their seat',
      summary: 'Registers the buyer for the webinar. Zoom then emails them a join link that is theirs alone.',
      params: [
        { k: 'Webinar', v: '{webinar › Output} (a webinar ID, as a custom value)' },
        { k: 'First Name', v: '{first › Output}' },
        { k: 'Email', v: '{trigger › Customer Details Email}' },
      ],
      run: (c) => {
        const id = str(c.out('webinar').Output);
        if (!id) return { error: 'Zoom: “Webinar does not exist.” (3001)' };
        const starts = WORKSHOPS[topic(c)].starts;
        return {
          log: `Registered for webinar ${id}`,
          output: { 'Registrant ID': 'rg_5Tq2', 'Join URL': `https://zoom.example/w/${id}?tk=rg_5Tq2`, 'Start Time': starts },
          effects: [{ app: 'Zoom', what: 'Webinar registrant added', name: buyer(c), fields: { Webinar: `${topic(c)} · ${niceTime(starts)}`, Email: email(c) } }],
          messages: [
            {
              channel: 'email',
              to: email(c),
              subject: `${topic(c)}: you are registered`,
              body: `Hi ${firstName(buyer(c))},\n\nThank you for registering for ${topic(c)}.\n\nWhen: ${niceTime(starts)} Eastern\nJoin from a computer, tablet or phone: https://zoom.example/w/${id}?tk=rg_5Tq2\n\nThis link is yours alone, so please do not share it.\n\n(Sent by Zoom, not by the Zap.)`,
            },
          ],
        };
      },
    },
    {
      kind: 'action',
      id: 'roster',
      app: 'Google Sheets',
      event: 'Create Spreadsheet Row',
      icon: 'sheet',
      title: 'Add them to the roster',
      summary: 'One row per paid seat. The follow-up Zap reads this sheet after the workshop.',
      params: [
        { k: 'Spreadsheet', v: 'Fieldnote Ops' },
        { k: 'Worksheet', v: 'Attendees' },
        { k: 'Workshop', v: '{trigger › Metadata Workshop}' },
        { k: 'Name', v: '{trigger › Customer Details Name}' },
        { k: 'Email', v: '{trigger › Customer Details Email}' },
        { k: 'Stripe session', v: '{trigger › ID}' },
      ],
      run: (c) => ({
        write: [{ collection: 'Attendees', row: { Workshop: topic(c), Name: buyer(c), Email: email(c) } }],
        effects: [{ app: 'Google Sheets', what: 'Row added to Attendees', name: buyer(c), fields: { Workshop: topic(c), Email: email(c), 'Stripe session': str(T(c).ID) } }],
      }),
    },
    {
      kind: 'action',
      id: 'tell',
      app: 'Slack',
      event: 'Send Channel Message',
      icon: 'slack',
      title: 'Tell the team',
      summary: 'One line in #registrations, so everyone can see a workshop filling up.',
      params: [
        { k: 'Channel', v: '#registrations' },
        { k: 'Message Text', v: 'Seat sold: {trigger › Customer Details Name} for {trigger › Metadata Workshop}' },
      ],
      run: (c) => ({ messages: [{ channel: 'slack', to: '#registrations', body: `Seat sold: ${buyer(c)} for ${topic(c)}. Registered in Zoom and on the roster.` }] }),
    },
    {
      kind: 'filter',
      id: 'consent',
      title: 'Did they ask to hear from us?',
      summary: 'Checkout has an optional box, “Send me new workshop dates”. Everything the buyer paid for has already happened above this line; only the newsletter depends on it.',
      rules: 'Consent Promotions (Text) Exactly matches opt_in',
      params: [{ k: 'Only continue if', v: '{trigger › Consent Promotions} (Text) Exactly matches opt_in' }],
      test: (c) => str(T(c)['Consent Promotions']) === 'opt_in',
    },
    {
      kind: 'action',
      id: 'subscribe',
      app: 'Mailchimp',
      event: 'Add/Update Subscriber',
      icon: 'megaphone',
      title: 'Add them to the list',
      summary: 'Adds the buyer, or updates them if they are already there, with a tag for the workshop they bought.',
      params: [
        { k: 'Audience', v: 'Fieldnote' },
        { k: 'Subscriber Email', v: '{trigger › Customer Details Email}' },
        { k: 'Status', v: 'Subscribed' },
        { k: 'Update Existing', v: 'Yes' },
        { k: 'First Name', v: '{first › Output}' },
        { k: 'Tag(s)', v: 'Attended: {trigger › Metadata Workshop}' },
      ],
      run: (c) => ({ effects: [{ app: 'Mailchimp', what: 'Subscriber added or updated', name: email(c), fields: { 'First name': firstName(buyer(c)), Tag: `Attended: ${topic(c)}` } }] }),
    },
  ],
  autoreplay: true,
  owner: 'Jules Bennett',
  scenarios: [
    {
      id: 'card',
      label: 'A card payment, newsletter box ticked',
      summary: 'Renata pays by card and ticks the box. She is registered, added to the roster and the list, and the team is told.',
      start: 10 * 60 + 26,
      event: 'In Stripe: Renata pays for “Grant budgets that get funded”',
      trigger: checkout({}),
      expect: { status: 'Successful', visits: ['paid', 'webinar', 'first', 'register', 'roster', 'tell', 'consent', 'subscribe'], tasks: 4 },
    },
    {
      id: 'no-newsletter',
      label: 'A card payment, box left empty',
      summary: 'Luis buys a seat and does not ask for emails. He gets everything he paid for, and the run stops before Mailchimp.',
      start: 1440 + 16 * 60 + 9,
      event: 'In Stripe: Luis pays for “Year-end appeals that work”',
      trigger: checkout({ ID: 'cs_live_c8Rk2Vd9', 'Customer Details Name': 'Luis Ortega', 'Customer Details Email': 'luis.ortega@example.com', 'Amount Total': '8900', 'Metadata Workshop': 'Year-end appeals that work', 'Consent Promotions': 'opt_out' }),
      expect: { status: 'Filtered', visits: ['register', 'roster', 'tell', 'consent:stop'], skips: ['subscribe'], tasks: 3 },
    },
    {
      id: 'bank-debit',
      label: 'A bank debit that has not cleared',
      summary: 'The checkout is complete but the money is still on its way. The first filter stops the run; no seat is given yet.',
      start: 2 * 1440 + 9 * 60 + 51,
      event: 'In Stripe: an organization checks out by bank debit',
      trigger: checkout({ ID: 'cs_live_f3Wn5Hb1', 'Customer Details Name': 'Beth Lindqvist', 'Customer Details Email': 'beth.lindqvist@example.com', 'Payment Status': 'unpaid' }),
      expect: { status: 'Filtered', visits: ['paid:stop'], skips: ['register', 'roster'], tasks: 0 },
    },
    {
      id: 'new-workshop',
      label: 'A workshop nobody added to the table',
      summary: 'A new payment link went live before its row was added to the lookup table. Zoom has no webinar to register for, the run errors, and Jules is emailed.',
      start: 3 * 1440 + 11 * 60 + 14,
      event: 'In Stripe: Kwame pays for “Board reports people read”',
      trigger: checkout({ ID: 'cs_live_k6Yp1Zs4', 'Customer Details Name': 'Kwame Mensah', 'Customer Details Email': 'kwame.mensah@example.com', 'Amount Total': '14900', 'Metadata Workshop': 'Board reports people read' }),
      expect: { status: 'Errored', visits: ['paid', 'webinar', 'first'], skips: ['register', 'roster', 'tell', 'subscribe'], tasks: 0 },
    },
  ],
  fields: [
    { app: 'Stripe', field: 'Payment Status', use: 'Must be “paid” for a seat to be given.' },
    { app: 'Stripe', field: 'Metadata › Workshop', use: 'Set on each payment link; the key for the Zoom lookup table.' },
    { app: 'Stripe', field: 'Consent › Promotions', use: 'The checkout’s optional box. Only “opt_in” reaches Mailchimp.' },
    { app: 'Zoom', field: 'Webinar ID', use: 'Which webinar the buyer is registered for.' },
    { app: 'Google Sheets', field: 'Attendees worksheet', use: 'One row per seat, read again by Zap 03.' },
  ],
  build: [
    { title: 'Trigger on the checkout, filter on the payment', body: 'Checkout Session Completed fires for every finished checkout, including ones paid by a method that clears later. The filter on Payment Status keeps unpaid sessions from getting a seat.' },
    { title: 'The workshop’s name travels in metadata', body: 'Each Stripe payment link has a metadata field, Workshop, and Stripe copies it onto the checkout session. One Zap serves every workshop, and adding a workshop is a new payment link plus one row in the lookup table.' },
    { title: 'No fallback in this lookup', body: 'In the quote Zap a fallback value hid a gap gracefully. Here a fallback would register people for the wrong workshop, so the table has none: an unknown workshop gives Zoom an empty ID, the step errors, and someone finds out the same minute.' },
    { title: 'Let Zoom send the link', body: 'Zoom’s own confirmation email carries a join link unique to the registrant. The Zap does not copy that link into an email of its own, which would be one more thing to keep in step.' },
    { title: 'The consent filter goes last', body: 'A filter stops everything after it, so the steps the buyer paid for come first and the newsletter step sits alone behind the filter. A run that ends there shows as Filtered, and that is a normal, complete sale.' },
    { title: 'Ask before adding anyone to a list', body: 'Buying a seat is not asking for a newsletter. The checkout’s optional promotions box is the record of consent, and the Zap reads it; it does not assume.' },
  ],
  edgeCases: [
    { title: 'A bank debit clears three days later', body: 'This Zap has already stopped at the first filter. Stripe reports the later success as a different event, which a small second Zap, not shown here, turns into the same registration.' },
    { title: 'Someone buys two seats', body: 'The checkout has one buyer, so one person is registered. The payment links allow a quantity of one; teams are asked to buy a seat each so that every person gets their own link.' },
    { title: 'The same person pays twice by mistake', body: 'Zoom does not register an email twice for one webinar, so the second run adds a second roster row and nothing else. The Attendees sheet highlights repeated emails, and Ama refunds the extra payment.' },
    { title: 'A refund', body: 'Not handled by this Zap. Refunds are rare enough that Ama removes the registrant in Zoom and the row in the sheet by hand, from a checklist.' },
    { title: 'Zoom is unreachable for a minute', body: 'Autoreplay tries the step again. Nothing after it has run yet, so there is no half-finished registration to clean up.' },
  ],
  qa: [
    'A paid card checkout registers the buyer for the right webinar within a minute.',
    'Each payment link’s workshop name maps to its own webinar ID.',
    'An unpaid checkout ends as Filtered at step 2, with nobody registered.',
    'With the box unticked, the buyer is registered and on the roster, and is not in Mailchimp.',
    'With the box ticked, the subscriber has the workshop’s tag.',
    'A workshop missing from the table errors at the Zoom step and Jules gets Zapier’s email.',
  ],
  features: ['Instant trigger', 'Filter by Zapier, twice', 'Formatter: Lookup Table without a fallback', 'Formatter: Split Text', 'A step that errors on purpose', 'Autoreplay', 'Stripe', 'Zoom', 'Google Sheets', 'Mailchimp', 'Slack'],
};
