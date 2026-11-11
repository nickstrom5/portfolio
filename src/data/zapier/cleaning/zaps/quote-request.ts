/** 01 · New quote request: the website form, cleaned up, priced, logged and routed by ZIP code. */
import type { AppStep, Ctx, Json, Zap } from '@/lib/zapier/types';
import { capitalize, e164, firstName, formatter, str } from '../../helpers';

const AREA = ['43201', '43202', '43212', '43214', '43221', '43085'];
const PRICES: Record<string, string> = {
  'Studio or 1 bedroom': '$110 to $140',
  '2 bedrooms': '$140 to $180',
  '3 bedrooms': '$180 to $230',
  '4 or more bedrooms': '$230 to $300',
};
const NO_PRICE = 'confirmed after a walkthrough';

const T = (c: Ctx) => c.trigger;
const name = (c: Ctx) => str(c.out('name').Output);
const phone = (c: Ctx) => str(c.out('phone').Output);
const price = (c: Ctx) => str(c.out('price').Output);
const inArea = (c: Ctx) => AREA.includes(str(T(c)['ZIP Code']).trim());
const SIGN = 'Marcus Bell\nMaple & Main Cleaning';

const reply: AppStep = {
  kind: 'action',
  id: 'reply',
  app: 'Gmail',
  event: 'Send Email',
  icon: 'mail',
  title: 'Send the price range',
  summary: 'A plain reply from the office address with the usual price for that home size and a link to book a walkthrough.',
  params: [
    { k: 'To', v: '{trigger › Email}' },
    { k: 'From Name', v: 'Maple & Main Cleaning' },
    { k: 'Subject', v: 'Your Maple & Main quote' },
    { k: 'Body', v: 'Hi {name › Output}… Service: {trigger › Service} · Home size: {trigger › Home Size} · Usual price per visit: {price › Output}' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'email',
        to: str(T(c).Email),
        subject: 'Your Maple & Main quote',
        body: `Hi ${firstName(name(c))},\n\nThanks for your quote request. Here is what to expect:\n\nService: ${str(T(c).Service)}\nHome size: ${str(T(c)['Home Size'])}\nUsual price per visit: ${price(c)}\n\nThe exact price comes from a free 15-minute walkthrough. Pick a time here: https://mapleandmain.example/walkthrough\n\nOr reply to this email, or call 614-555-0100.\n\n${SIGN}`,
      },
    ],
  }),
};

const tell: AppStep = {
  kind: 'action',
  id: 'tell',
  app: 'Slack',
  event: 'Send Channel Message',
  icon: 'slack',
  title: 'Tell the office',
  summary: 'Posts the lead to #new-leads with the cleaned-up name and phone number, so whoever is free can follow up.',
  params: [
    { k: 'Channel', v: '#new-leads' },
    { k: 'Message Text', v: 'New quote request: {name › Output} · {trigger › ZIP Code} · {trigger › Home Size} · {trigger › Service}' },
    { k: 'Send as a bot?', v: 'Yes, named “Leads”' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'slack',
        to: '#new-leads',
        body: `New quote request: ${name(c)} · ${str(T(c)['ZIP Code'])} · ${str(T(c)['Home Size'])} · ${str(T(c).Service)}\n${phone(c) || 'No usable phone number'} · ${str(T(c).Email)}\nQuoted ${price(c)}. Added to the Leads sheet.`,
      },
    ],
  }),
};

const owner: AppStep = {
  kind: 'action',
  id: 'owner',
  app: 'Slack',
  event: 'Send Direct Message',
  icon: 'slack',
  title: 'Flag recurring leads to Renee',
  summary: 'A recurring client is worth far more than a one-time clean, so the owner hears about these directly and calls the same day.',
  params: [
    { k: 'To Username', v: 'Renee Alvarado' },
    { k: 'Message Text', v: 'Recurring lead: {name › Output} wants “{trigger › Service}”. Worth a call today: {phone › Output}' },
  ],
  run: (c) => ({
    messages: [{ channel: 'slack', to: 'Renee Alvarado (direct message)', body: `Recurring lead: ${name(c)} wants “${str(T(c).Service)}” for a home with ${str(T(c)['Home Size']).toLowerCase()}. Worth a call today: ${phone(c) || str(T(c).Email)}` }],
  }),
};

const decline: AppStep = {
  kind: 'action',
  id: 'decline',
  app: 'Gmail',
  event: 'Send Email',
  icon: 'mail',
  title: 'Say so, politely',
  summary: 'People outside the service area get an honest answer in a minute, not silence.',
  params: [
    { k: 'To', v: '{trigger › Email}' },
    { k: 'From Name', v: 'Maple & Main Cleaning' },
    { k: 'Subject', v: 'About your quote request' },
    { k: 'Body', v: 'Hi {name › Output}… we do not clean in {trigger › ZIP Code} yet…' },
  ],
  run: (c) => ({
    messages: [
      {
        channel: 'email',
        to: str(T(c).Email),
        subject: 'About your quote request',
        body: `Hi ${firstName(name(c))},\n\nThanks for thinking of us. We do not clean in ${str(T(c)['ZIP Code'])} yet: our crews cover Clintonville, the Short North, Grandview, Upper Arlington and Worthington.\n\nIf that changes we will let you know, and if you have a home in one of those areas we would be glad to help.\n\n${SIGN}`,
      },
    ],
  }),
};

const lead = (o: Partial<Json>): Json => ({
  'Full Name': 'dana WHITFIELD',
  Email: 'dana.whitfield@example.com',
  Phone: '(614) 555-0142',
  'ZIP Code': '43214',
  'Home Size': '3 bedrooms',
  Service: 'One-time deep clean',
  Notes: 'Two cats. Hardwood floors throughout.',
  'Submission ID': '6184420917',
  ...o,
});

export const quoteRequest: Zap = {
  id: 'quote-request',
  number: '01',
  name: 'New quote request',
  kicker: 'Form → priced reply, logged, routed',
  tagline: 'Every quote request gets a price range by email within a minute, lands in the Leads sheet, and reaches the right person on Slack.',
  problem:
    'Quote requests came in through the website form and waited in a shared inbox. On a busy day the first reply went out the next afternoon, by which time the person had usually booked someone else. Names arrived in all capitals, phone numbers in five formats, and about one request in six was from a ZIP code the crews do not cover.',
  solution:
    'When the form is sent, the Zap tidies the name and phone number, looks up the usual price for that home size, and adds the lead to the Leads sheet. Then Paths decides what happens: inside the service area, the person gets the price range and a link to book a walkthrough, and the office sees the lead in Slack. If they also want recurring service, the owner gets a direct message. Outside the area, the person gets a polite no.',
  folder: 'Maple & Main',
  trigger: {
    app: 'Jotform',
    event: 'New Submission',
    icon: 'form',
    type: 'instant',
    summary: 'Runs the moment someone sends the “Get a quote” form on the website.',
    params: [{ k: 'Form', v: 'Get a quote' }],
  },
  steps: [
    formatter({
      id: 'name',
      title: 'Tidy the name',
      event: 'Text',
      transform: 'Capitalize',
      input: '{trigger › Full Name}',
      summary: 'People type their name in capitals, in lower case, or with stray spaces. Every later step uses this version.',
      run: (c) => ({ output: { Output: capitalize(T(c)['Full Name']) } }),
    }),
    formatter({
      id: 'phone',
      title: 'Put the phone number in one format',
      event: 'Numbers',
      transform: 'Format Phone Number',
      input: '{trigger › Phone}',
      summary: 'Whatever was typed becomes +16145550142, the format Twilio and click-to-call links need. A number that is not a real phone number comes out empty.',
      extra: [
        { k: 'To Format', v: '+15555551234 (E.164)' },
        { k: 'Phone Number Country Code', v: 'US' },
      ],
      run: (c) => ({ output: { Output: e164(T(c).Phone) } }),
    }),
    formatter({
      id: 'price',
      title: 'Look up the usual price',
      event: 'Utilities',
      transform: 'Lookup Table',
      input: '{trigger › Home Size}',
      summary: 'The price list lives in this one step. A home size that is not in the table gets the fallback, so the email never shows a blank.',
      extra: [
        { k: 'Lookup Table', v: Object.entries(PRICES).map(([k, v]) => `${k} → ${v}`).join(' · ') },
        { k: 'Fallback Value', v: NO_PRICE },
      ],
      run: (c) => ({ output: { Output: PRICES[str(T(c)['Home Size'])] ?? NO_PRICE } }),
    }),
    {
      kind: 'action',
      id: 'log',
      app: 'Google Sheets',
      event: 'Create Spreadsheet Row',
      icon: 'sheet',
      title: 'Add the lead to the sheet',
      summary: 'Every request is logged before anything is sent, inside the area or not, so the count of leads is always right.',
      params: [
        { k: 'Spreadsheet', v: 'Maple & Main Ops' },
        { k: 'Worksheet', v: 'Leads' },
        { k: 'Name', v: '{name › Output}' },
        { k: 'Email', v: '{trigger › Email}' },
        { k: 'Phone', v: '{phone › Output}' },
        { k: 'ZIP', v: '{trigger › ZIP Code}' },
        { k: 'Home size', v: '{trigger › Home Size}' },
        { k: 'Service', v: '{trigger › Service}' },
        { k: 'Quoted', v: '{price › Output}' },
      ],
      run: (c) => ({
        log: `Row added for ${name(c)}`,
        effects: [
          {
            app: 'Google Sheets',
            what: 'Row added to Leads',
            name: name(c),
            fields: { Email: str(T(c).Email), Phone: phone(c), ZIP: str(T(c)['ZIP Code']), 'Home size': str(T(c)['Home Size']), Service: str(T(c).Service), Quoted: price(c) },
          },
        ],
      }),
    },
    {
      kind: 'paths',
      id: 'route',
      branches: [
        { name: 'In our area', rules: `ZIP Code (Text) Is in ${AREA.join(', ')}`, test: inArea, steps: [reply, tell] },
        {
          name: 'Wants recurring service',
          rules: `ZIP Code (Text) Is in ${AREA.join(', ')} And Service (Text) Contains Recurring`,
          test: (c) => inArea(c) && str(T(c).Service).includes('Recurring'),
          steps: [owner],
        },
        { name: 'Outside our area', fallback: true, steps: [decline] },
      ],
    },
  ],
  autoreplay: true,
  owner: 'Marcus Bell',
  scenarios: [
    {
      id: 'one-time',
      label: 'A one-time clean, inside the area',
      summary: 'Dana asks for a deep clean in Clintonville. One path runs: the price goes out and the office is told.',
      start: 1440 + 9 * 60 + 41,
      event: 'On the website: Dana sends the “Get a quote” form',
      trigger: lead({}),
      expect: { status: 'Successful', visits: ['name', 'phone', 'price', 'log', 'route:0', 'reply', 'tell'], skips: ['owner', 'decline'], tasks: 3 },
    },
    {
      id: 'recurring',
      label: 'Recurring service: two paths run',
      summary: 'Imani wants a clean every two weeks. She meets the rules of two paths, so both run, one after the other.',
      start: 1440 + 13 * 60 + 5,
      event: 'On the website: Imani sends the “Get a quote” form',
      trigger: lead({ 'Full Name': 'imani brooks', Email: 'imani.brooks@example.com', Phone: '614.555.0119', 'ZIP Code': '43085', 'Home Size': '2 bedrooms', Service: 'Recurring, every 2 weeks', Notes: '', 'Submission ID': '6184433051' }),
      expect: { status: 'Successful', visits: ['route:0', 'route:1', 'reply', 'tell', 'owner'], skips: ['decline'], tasks: 4 },
    },
    {
      id: 'outside',
      label: 'A ZIP code they do not serve',
      summary: 'Leo is in Cincinnati. No path’s rules are met, so the fallback sends a polite no. The lead is still logged.',
      start: 2 * 1440 + 19 * 60 + 22,
      event: 'On the website: Leo sends the “Get a quote” form',
      trigger: lead({ 'Full Name': 'Leo Marsh', Email: 'leo.marsh@example.com', Phone: '5135550164', 'ZIP Code': '45202', 'Home Size': '4 or more bedrooms', Service: 'Move-out clean', Notes: 'Moving out on the 28th.', 'Submission ID': '6184490338' }),
      expect: { status: 'Successful', visits: ['log', 'route:2', 'decline'], skips: ['reply', 'tell', 'owner'], tasks: 2 },
    },
    {
      id: 'gmail-blip',
      label: 'Gmail fails once',
      summary: 'Gmail has a brief outage as the reply goes out. Autoreplay tries again five minutes later and nobody has to do anything.',
      start: 3 * 1440 + 8 * 60 + 15,
      event: 'On the website: Dana sends the “Get a quote” form',
      trigger: lead({}),
      failures: { reply: { message: 'Gmail: “The service is currently unavailable.” (503)', replays: 1 } },
      expect: { status: 'Successful', visits: ['reply', 'tell'], tasks: 3 },
    },
    {
      id: 'slack-archived',
      label: 'Someone archived #new-leads',
      summary: 'The Slack post fails for good. The email has already gone, the second path still runs, and Marcus is told what broke.',
      start: 4 * 1440 + 11 * 60 + 48,
      event: 'On the website: Imani sends the “Get a quote” form',
      trigger: lead({ 'Full Name': 'imani brooks', Email: 'imani.brooks@example.com', Phone: '614.555.0119', 'ZIP Code': '43085', 'Home Size': '2 bedrooms', Service: 'Recurring, weekly', Notes: '', 'Submission ID': '6184502277' }),
      failures: { tell: { message: 'Slack: “is_archived”. The channel #new-leads has been archived.' } },
      expect: { status: 'Errored', visits: ['reply', 'route:0', 'route:1', 'owner'], skips: ['tell', 'decline'], tasks: 3 },
    },
  ],
  fields: [
    { app: 'Jotform', field: 'Full Name, Phone', use: 'Cleaned up by Formatter before any other step sees them.' },
    { app: 'Jotform', field: 'Home Size', use: 'The key for the price lookup table.' },
    { app: 'Jotform', field: 'ZIP Code', use: 'Decides which paths run.' },
    { app: 'Jotform', field: 'Service', use: 'Contains “Recurring” for the leads the owner wants to hear about.' },
    { app: 'Google Sheets', field: 'Leads worksheet', use: 'One row per request, with the price that was quoted.' },
  ],
  build: [
    { title: 'Clean the data once, at the top', body: 'The three Formatter steps come straight after the trigger, and every later step maps their Output, never the raw form field. Formatter steps use no tasks, so tidying costs nothing.' },
    { title: 'Prices in a lookup table, not in the email', body: 'The email maps one field, the lookup’s Output. When prices change, Marcus edits the table in one step. The Fallback Value means a new home-size option on the form cannot produce an email with a hole in it.' },
    { title: 'Log before Paths', body: 'Nothing can follow a Paths step, so anything every lead needs happens first. The row is written before the split, which is why an outside-the-area lead is still counted.' },
    { title: 'Paths are not if-else', body: 'Zapier runs every path whose rules are met. That is used on purpose here: an in-area lead who wants recurring service runs both the first and second path. The second path repeats the ZIP rule so it cannot fire for someone the crews cannot reach.' },
    { title: 'A fallback, not a third set of rules', body: '“Outside our area” is the fallback path: it runs only when no other path does. Writing it as “ZIP is not in the list” would work today and break the day a ZIP is added to one list and not the other.' },
    { title: 'Slack goes after the email', body: 'Inside the first path the email is sent before the Slack post. If Slack fails, the customer has still been answered.' },
  ],
  edgeCases: [
    { title: 'The same person sends the form twice', body: 'They get two replies and two rows. That is acceptable for a quote form, and the Leads sheet has a filter view that shows repeated emails. A Zap that searched the sheet first would cost a task on every lead to save a rare duplicate.' },
    { title: 'A phone number that is not a phone number', body: 'Format Phone Number returns nothing for “call me”, so the Slack post says there is no usable number and the office replies by email.' },
    { title: 'A ZIP code typed with a space or +4', body: 'The form field is limited to five digits with a validation rule in Jotform, so “43214-1234” cannot be sent. The rule belongs in the form, where the person can fix it.' },
    { title: 'Gmail or Slack is down for a minute', body: 'Autoreplay tries the failed step again, first after five minutes. The run waits as Scheduled and no error email goes out unless every try fails.' },
    { title: 'A new service is added to the form', body: 'Nothing breaks: the service name is passed through as text. Only a new home-size option needs a line in the lookup table, and until then the fallback covers it.' },
  ],
  qa: [
    'A name typed in capitals reaches the email and the sheet as “Dana Whitfield”.',
    'Each home-size option on the form returns its own price range; an unknown one returns the fallback.',
    'An in-area, one-time lead runs the first path only.',
    'An in-area, recurring lead runs the first and second paths, in that order.',
    'A ZIP outside the list runs the fallback only, and the lead is still in the sheet.',
    'With the Slack channel archived, the customer email has already been sent and the run shows as Errored.',
  ],
  features: ['Instant trigger', 'Formatter: Capitalize', 'Formatter: Format Phone Number', 'Formatter: Lookup Table', 'Paths with custom rules', 'Fallback path', 'More than one path per run', 'Autoreplay', 'Google Sheets', 'Gmail', 'Slack'],
};
