/** 01 · Lead routing: a Facebook lead becomes a HubSpot contact with an owner, and that owner is told at once. */
import type { Ctx, Json, Zap } from '@/lib/zapier/types';
import { capitalize, e164, formatter, str } from '../../helpers';
import { QUEUE, TERRITORY } from '../business';

const T = (c: Ctx) => c.trigger;
const terr = (c: Ctx) => TERRITORY[str(T(c).State)] ?? QUEUE;
const phone = (c: Ctx) => str(c.out('phone').Output);
const fullName = (c: Ctx) => capitalize(T(c)['Full Name']);
const contact = (c: Ctx) => c.out('contact');
const table = (pick: (t: (typeof TERRITORY)[string]) => string) => Object.entries(TERRITORY).map(([state, t]) => `${state} → ${pick(t)}`).join(' · ');

const lead = (o: Partial<Json>): Json => ({
  'Full Name': 'Carla Jimenez',
  Email: 'carla.jimenez@example.com',
  'Phone Number': '(602) 555-0188',
  State: 'Arizona',
  'Homeowner?': 'Yes',
  'Monthly Electric Bill': '$150 to $250',
  'Form Name': 'Free solar estimate',
  'Ad Name': 'Spring estimate',
  'Lead ID': '1184502936',
  ...o,
});

export const leadRouting: Zap = {
  id: 'lead-routing',
  number: '01',
  name: 'Lead routing',
  kicker: 'Ad lead → owner in HubSpot, told at once',
  tagline: 'A homeowner fills in the ad’s form, and within a minute they are in HubSpot with an owner who has been told to call.',
  problem:
    'Leads from Facebook lead ads were exported twice a day and divided by hand. Calling a lead within five minutes makes a conversation far more likely than calling within an hour, and the team’s typical first call came five hours later. Renters filled in the form too, and people who had asked before were handed to a new rep as if they were strangers.',
  solution:
    'The moment a lead comes in, the Zap drops anyone who does not own their home, tidies the phone number, and looks up which territory lead covers the state. It then finds the person in HubSpot by email or creates them with that owner. A new contact’s owner gets a direct message in Slack with everything needed to call. Someone who is already in HubSpot keeps their existing owner: the Zap adds a note to their record and tells sales operations.',
  folder: 'Sales / Leads',
  trigger: {
    app: 'Facebook Lead Ads',
    event: 'New Lead',
    icon: 'megaphone',
    type: 'instant',
    summary: 'Runs when someone submits the “Free solar estimate” lead form on any ad.',
    params: [
      { k: 'Page', v: 'Kettlebrook Solar' },
      { k: 'Form', v: 'Free solar estimate' },
    ],
  },
  steps: [
    {
      kind: 'filter',
      id: 'owns',
      title: 'Homeowners only',
      summary: 'Solar is sold to the person who owns the roof. Renters stop here, before anything is created.',
      rules: 'Homeowner? (Text) Exactly matches Yes',
      params: [{ k: 'Only continue if', v: '{trigger › Homeowner?} (Text) Exactly matches Yes' }],
      test: (c) => str(T(c)['Homeowner?']) === 'Yes',
    },
    formatter({
      id: 'phone',
      title: 'Put the phone number in one format',
      event: 'Numbers',
      transform: 'Format Phone Number',
      input: '{trigger › Phone Number}',
      summary: 'One format in HubSpot means click-to-call works and the same person is not stored twice under two spellings of one number.',
      extra: [
        { k: 'To Format', v: '+15555551234 (E.164)' },
        { k: 'Phone Number Country Code', v: 'US' },
      ],
      run: (c) => ({ output: { Output: e164(T(c)['Phone Number']) } }),
    }),
    formatter({
      id: 'owner',
      title: 'Which territory lead covers this state?',
      event: 'Utilities',
      transform: 'Lookup Table',
      input: '{trigger › State}',
      summary: 'Turns the state into that territory lead’s HubSpot owner ID. A state outside the three goes to sales operations’ queue.',
      extra: [
        { k: 'Lookup Table', v: table((t) => `${t.hubspot} (${t.lead})`) },
        { k: 'Fallback Value', v: `${QUEUE.hubspot} (${QUEUE.lead})` },
      ],
      run: (c) => ({ log: `${str(T(c).State)} → ${terr(c).lead}`, output: { Output: terr(c).hubspot } }),
    }),
    formatter({
      id: 'slack-id',
      title: 'And where do we message them?',
      event: 'Utilities',
      transform: 'Lookup Table',
      input: '{trigger › State}',
      summary: 'The same lookup, returning the person’s Slack member ID, so the direct message needs no search step.',
      extra: [
        { k: 'Lookup Table', v: table((t) => `${t.slack} (${t.lead})`) },
        { k: 'Fallback Value', v: `${QUEUE.slack} (${QUEUE.lead})` },
      ],
      run: (c) => ({ output: { Output: terr(c).slack } }),
    }),
    {
      kind: 'action',
      id: 'contact',
      app: 'HubSpot',
      event: 'Find or Create Contact',
      icon: 'search',
      search: 'create',
      title: 'Find them in HubSpot, or create them',
      summary: 'Searches by email. A new person is created with the owner from step 4; someone already there is left exactly as they are.',
      params: [
        { k: 'Search property', v: 'Email' },
        { k: 'Search value', v: '{trigger › Email}' },
        { k: 'Create HubSpot Contact if it doesn’t exist yet?', v: 'Yes' },
        { k: 'Full name (if created)', v: '{trigger › Full Name}' },
        { k: 'Phone (if created)', v: '{phone › Output}' },
        { k: 'State (if created)', v: '{trigger › State}' },
        { k: 'Contact owner (if created)', v: '{owner › Output}' },
        { k: 'Lead status (if created)', v: 'New' },
        { k: 'Original source (if created)', v: 'Facebook lead ad · {trigger › Ad Name}' },
      ],
      run: (c) => {
        const email = str(T(c).Email).trim().toLowerCase();
        const hit = c.rows('HubSpot contacts').find((r) => str(r.Email).toLowerCase() === email);
        if (hit) return { found: true, log: `Already in HubSpot: owned by ${str(hit['Contact Owner'])}, lead status “${str(hit['Lead Status'])}”`, output: { Id: hit.Id, 'Contact Owner': hit['Contact Owner'], 'Lead Status': hit['Lead Status'] } };
        const [first, ...rest] = fullName(c).split(' ');
        const row = { Id: '30140', Email: str(T(c).Email), 'First Name': first, 'Last Name': rest.join(' '), State: str(T(c).State), 'Contact Owner': terr(c).lead, 'Lead Status': 'New' };
        return {
          found: false,
          log: `Not in HubSpot, so created with owner ${terr(c).lead}`,
          output: { Id: row.Id, 'Contact Owner': row['Contact Owner'], 'Lead Status': 'New' },
          write: [{ collection: 'HubSpot contacts', row }],
          effects: [{ app: 'HubSpot', what: 'Contact created', name: fullName(c), fields: { Email: row.Email, Phone: phone(c), State: row.State, 'Contact owner': row['Contact Owner'], 'Lead status': 'New', 'Original source': `Facebook lead ad · ${str(T(c)['Ad Name'])}` } }],
        };
      },
    },
    {
      kind: 'paths',
      id: 'who',
      branches: [
        {
          name: 'New lead',
          rules: 'Zap Data Was Found Is false',
          test: (c) => contact(c)['Zap Data Was Found'] === false,
          steps: [
            {
              kind: 'action',
              id: 'call-now',
              app: 'Slack',
              event: 'Send Direct Message',
              icon: 'slack',
              title: 'Tell the owner to call',
              summary: 'A direct message, not a channel post: one person is responsible, and it reaches their phone.',
              params: [
                { k: 'To Username', v: '{slack-id › Output} (a Slack member ID, as a custom value)' },
                { k: 'Message Text', v: 'New lead, call within 5 minutes: {trigger › Full Name} · {trigger › State} · bill {trigger › Monthly Electric Bill} · {phone › Output}' },
                { k: 'Send as a bot?', v: 'Yes, named “Leads”' },
              ],
              run: (c) => ({
                messages: [
                  {
                    channel: 'slack',
                    to: `${terr(c).lead} (direct message)`,
                    body: `New lead, call within 5 minutes\n${fullName(c)} · ${str(T(c).State)} · electric bill ${str(T(c)['Monthly Electric Bill'])}\n${phone(c) || 'No usable phone number'} · ${str(T(c).Email)}\nHubSpot: https://app.hubspot.example/contact/${str(contact(c).Id)}`,
                  },
                ],
              }),
            },
          ],
        },
        {
          name: 'Already in HubSpot',
          fallback: true,
          steps: [
            {
              kind: 'action',
              id: 'note',
              app: 'HubSpot',
              event: 'Create Engagement',
              icon: 'pen',
              title: 'Add a note to their record',
              summary: 'The existing owner sees that this person has asked again, and through which ad.',
              params: [
                { k: 'Engagement type', v: 'Note' },
                { k: 'Associate with contact', v: '{contact › Id}' },
                { k: 'Note', v: 'Asked for an estimate again through the ad “{trigger › Ad Name}”. Bill: {trigger › Monthly Electric Bill}.' },
              ],
              run: (c) => ({
                effects: [{ app: 'HubSpot', what: 'Note added', name: fullName(c), fields: { Note: `Asked for an estimate again through the ad “${str(T(c)['Ad Name'])}”. Bill: ${str(T(c)['Monthly Electric Bill'])}.` } }],
              }),
            },
            {
              kind: 'action',
              id: 'returning',
              app: 'Slack',
              event: 'Send Channel Message',
              icon: 'slack',
              title: 'Tell sales operations',
              summary: 'Posted to #sales-ops with the current owner’s name, so nobody is handed a lead that already belongs to someone.',
              params: [
                { k: 'Channel', v: '#sales-ops' },
                { k: 'Message Text', v: 'Returning lead: {trigger › Full Name} is already in HubSpot (owner {contact › Contact Owner}, status {contact › Lead Status}). Note added.' },
              ],
              run: (c) => ({
                messages: [{ channel: 'slack', to: '#sales-ops', body: `Returning lead: ${fullName(c)} asked for an estimate again. Already in HubSpot: owner ${str(contact(c)['Contact Owner'])}, lead status “${str(contact(c)['Lead Status'])}”. A note is on the record; the owner was not changed.` }],
              }),
            },
          ],
        },
      ],
    },
  ],
  autoreplay: true,
  owner: 'Darius Cole',
  scenarios: [
    {
      id: 'new-az',
      label: 'A new lead in Arizona',
      summary: 'Carla owns her home near Phoenix. She is created in HubSpot with Elena as owner, and Elena is told to call.',
      start: 9 * 60 + 12,
      event: 'On Facebook: Carla submits the “Free solar estimate” form',
      trigger: lead({}),
      expect: { status: 'Successful', visits: ['owns', 'phone', 'owner', 'slack-id', 'contact', 'who:0', 'call-now'], skips: ['note', 'returning'], tasks: 2 },
    },
    {
      id: 'returning',
      label: 'Someone who asked last year',
      summary: 'Marcus is already in HubSpot with Tom as owner. Nothing is reassigned: a note goes on his record and sales ops is told.',
      start: 11 * 60 + 40,
      event: 'On Facebook: Marcus submits the “Free solar estimate” form',
      trigger: lead({ 'Full Name': 'Marcus Lee', Email: 'marcus.lee@example.com', 'Phone Number': '702-555-0131', State: 'Nevada', 'Monthly Electric Bill': 'Over $250', 'Ad Name': 'Summer bill shock', 'Lead ID': '1184517720' }),
      expect: { status: 'Successful', visits: ['contact', 'who:1', 'note', 'returning'], skips: ['call-now'], tasks: 3 },
    },
    {
      id: 'renter',
      label: 'A renter',
      summary: 'Jo rents an apartment. The filter stops the run before a contact is created, and no task is used.',
      start: 1440 + 14 * 60 + 3,
      event: 'On Facebook: Jo submits the “Free solar estimate” form',
      trigger: lead({ 'Full Name': 'Jo Tran', Email: 'jo.tran@example.com', 'Phone Number': '505 555 0107', State: 'New Mexico', 'Homeowner?': 'No', 'Monthly Electric Bill': 'Under $150', 'Lead ID': '1184530411' }),
      expect: { status: 'Filtered', visits: ['owns:stop'], skips: ['contact', 'call-now'], tasks: 0 },
    },
    {
      id: 'other-state',
      label: 'A state they do not cover',
      summary: 'Ben is in Utah. The lookup table has no row for Utah, so its fallback sends him to sales operations’ queue.',
      start: 2 * 1440 + 16 * 60 + 25,
      event: 'On Facebook: Ben submits the “Free solar estimate” form',
      trigger: lead({ 'Full Name': 'ben ALDER', Email: 'ben.alder@example.com', 'Phone Number': '8015550176', State: 'Utah', 'Monthly Electric Bill': '$150 to $250', 'Lead ID': '1184551908' }),
      expect: { status: 'Successful', visits: ['contact', 'who:0', 'call-now'], tasks: 2 },
    },
    {
      id: 'rate-limit',
      label: 'HubSpot is briefly over its limit',
      summary: 'A burst of leads hits HubSpot’s per-second limit and the search fails. Autoreplay tries again five minutes later and it works.',
      start: 3 * 1440 + 10 * 60 + 1,
      event: 'On Facebook: Carla submits the “Free solar estimate” form',
      trigger: lead({}),
      failures: { contact: { message: 'HubSpot: “You have reached your secondly limit.” (429)', replays: 1 } },
      expect: { status: 'Successful', visits: ['contact', 'call-now'], tasks: 2 },
    },
  ],
  fields: [
    { app: 'Facebook Lead Ads', field: 'Homeowner?', use: 'Anything but Yes stops the run.' },
    { app: 'Facebook Lead Ads', field: 'State', use: 'The key for both lookup tables.' },
    { app: 'HubSpot', field: 'Email', use: 'How an existing contact is found.' },
    { app: 'HubSpot', field: 'Contact owner', use: 'Set once, when the contact is created. Never changed for an existing contact.' },
    { app: 'HubSpot', field: 'Lead status, Original source', use: 'Set to New and to the ad’s name on creation, for reporting.' },
  ],
  build: [
    { title: 'Filter first', body: 'The homeowner filter is step 2. A filter uses no task, and everything after it does not run, so a renter costs nothing and leaves nothing behind in HubSpot.' },
    { title: 'Routing in a lookup table', body: 'Which state belongs to whom is one table in one Formatter step. When a territory changes hands, Darius edits one row. Paths with a branch per state would work too, with three copies of the same steps to keep in step.' },
    { title: 'Two lookups, no search steps', body: 'HubSpot wants an owner ID and Slack wants a member ID. Two free lookup tables keyed by state supply both. The alternative, Get Owner by Email and Find User by Email, would use two tasks on every lead.' },
    { title: 'Find or create, by email', body: 'One step both prevents duplicates and creates the contact. Its “Zap Data Was Found” output says which happened, and that is what Paths reads.' },
    { title: 'Existing contacts keep their owner', body: 'The create fields only apply to a new contact. For someone already in HubSpot the Zap changes nothing on the record except to add a note, so a rep’s open conversation is never reassigned by an ad.' },
    { title: 'A fallback for the rule with one exception', body: '“Already in HubSpot” is the fallback path: it runs when the first path’s rule is not met. Two paths with opposite rules would behave the same until someone edited one of them.' },
  ],
  edgeCases: [
    { title: 'The same person submits two ads in a minute', body: 'The second run finds the contact the first one created and takes the “Already in HubSpot” path. Two runs starting in the same second could both try to create one; HubSpot does not allow two contacts with the same email, so the second create is rejected and that run errors, which is the safe result.' },
    { title: 'A state outside the three', body: 'Both lookup tables return their fallback, the contact is created in sales operations’ queue, and Darius gets the message. Nothing is dropped.' },
    { title: 'A phone number that cannot be read', body: 'The contact is still created, with the phone empty, and the message says there is no usable number so the owner emails instead.' },
    { title: 'HubSpot’s rate limit during a busy campaign', body: 'The failed step is replayed after five minutes. If it kept failing through every replay, Darius would get one email, with the lead’s data kept in Zap history ready to replay.' },
    { title: 'A territory lead is on holiday', body: 'Their row in both lookup tables is pointed at their cover for the week. It is a two-cell edit, listed in the handoff guide.' },
  ],
  qa: [
    'A homeowner in each of the three states is created with that territory’s lead as owner.',
    'The owner’s direct message has the name, state, bill range, phone number and a link to the record.',
    'A renter ends as Filtered with no contact created.',
    'An email already in HubSpot keeps its owner and gets a note; no direct message is sent.',
    'A state that is not in the table is owned by the sales ops queue.',
    'With the search failing once, the run finishes after one replay and only one contact exists.',
  ],
  features: ['Instant trigger', 'Filter by Zapier', 'Formatter: Format Phone Number', 'Formatter: Lookup Table with a fallback value', 'Find or Create', 'Paths with a fallback path', 'Autoreplay', 'HubSpot', 'Slack direct message'],
};
