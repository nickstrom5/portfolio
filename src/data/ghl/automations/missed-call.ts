import type { Automation, Contact } from '@/lib/ghl/types';
import { env } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** First name of the contact's assigned user, for task logs. */
const rep = (c: Contact) => (c.assignedTo && env.users[c.assignedTo]?.first_name) || 'the assigned rep';

/** A caller GHL has never seen: a phone number and nothing else. */
const unknownCaller = (phone: string): Partial<Contact> => ({ firstName: '', lastName: '', email: '', phone, source: 'Inbound call' });

const sop = `When a missed-call alert comes in:
1. Call back within 15 minutes, from the GHL app or the office line,
   not your own number.
2. Got through? Move the card to Contacted, or book the inspection
   on the calendar. Either one stops the follow-up text.
3. Not a homeowner (supplier, sales call, wrong number)? Mark the
   card Lost. That stops the follow-up text too. Same spam number
   again? Turn on DND for all channels.
4. They texted back? Answer in Conversations and add their name
   to the contact.
5. They asked us to stop texting, in any words? Turn on SMS DND
   on the contact the same day.
6. Never text a customer from your personal phone.`;

const a2pSamples = `Text-back to a new caller:
Hi, this is Harbor & Pine Roofing. Sorry we missed your call. We'll call you back as soon as we can, or reply here if texting is easier. To book a free roof inspection yourself: harborpine.example/book Reply STOP to opt out.

One follow-up, between 8 AM and 8 PM:
Hi, it's Maya at Harbor & Pine Roofing, following up on your call. What can we help with? Reply here or book a free roof inspection: harborpine.example/book

Existing customer:
Hi, it's Harbor & Pine Roofing. Sorry we missed your call. Maya will call you back as soon as possible, or reply here if texting is easier.`;

export const missedCall: Automation = {
  id: 'missed-call',
  number: '02',
  name: 'Missed-call text-back',
  kicker: 'Lead intake',
  tagline: 'Every missed call gets a text within seconds, a new caller becomes a New Lead with an owner, and people we already work with go straight to their own rep.',
  problem:
    'Calls come in while the estimators are on roofs and the office is on the other line. People who reach voicemail rarely leave a message. They call the next roofer on the list, and nobody here even knows they called.',
  evidence: {
    text: 'GHL\'s built-in Missed Call Text Back "triggers an SMS notification for every missed call," even when the same caller tries several times in a short time. GHL\'s advice is to use a workflow instead, for example with a Wait step of about 20 minutes. This is that workflow, built out.',
    source: 'HighLevel Help Center, "Where and How to Configure the Missed Call Text Back Feature"',
    href: 'https://help.gohighlevel.com/support/solutions/articles/48001239140-where-and-how-to-configure-the-missed-call-text-back-feature',
  },
  solution:
    'Every missed call on the main line gets a text within seconds, day or night, while the caller still has the phone in their hand. New callers get the booking link, a New Lead card, a rep and a call-back task; people who already have a deal with us get a short "your rep will call you back" text instead. Replies go to a person, and one follow-up goes out only if nobody has touched the card, never outside 8 AM to 8 PM.',
  workflow: {
    name: '02 · Lead Intake · Missed-Call Text-Back',
    folder: 'Lead Intake',
    triggers: [
      {
        title: 'Call Details',
        filters: ['Call Direction is Incoming', 'Call Status is busy, no-answer or voicemail', 'In Phone Number is (312) 555-0142, the main line'],
        label: 'Call Details (missed inbound call)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      exits: [
        {
          event: 'appointment_booked',
          by: 'Booking fires 03 · Inspection Booked, whose first step is Remove from Workflow: 01, 02 and 07. Nobody with an inspection on the calendar gets the follow-up text.',
        },
      ],
      notes: [
        'Allow Re-entry on, so a call after a run has ended gets an answer. GHL never enrols a contact who is still active, and the known-caller path ends with a 30-minute wait so a repeat call cannot text them twice.',
        'Stop on Response off: replies are handled by the reply waits and their branches.',
        'No workflow Time Window: it would hold the text-back too. The follow-up has its own 8 AM to 8 PM Advance Window.',
        'Allow multiple Opportunities is for opportunity-based triggers. Here the Duplicate Opportunity toggle on Create Opportunity is what matters.',
        'Sender Details: From Number is the main line, so the text comes from the number they just called.',
      ],
    },
    steps: [
      {
        id: 'assign',
        kind: 'action',
        action: 'assign_user',
        title: 'Assign To User',
        label: 'Round robin',
        summary: 'Maya and Luis, split equally, with Only Apply to Unassigned Contacts on, so anyone we know keeps their rep. It runs first because the customer text names the rep, and a notification to the assigned user has nobody to go to without one.',
        run: ({ contact }) => {
          if (contact.assignedTo) return { log: `Already assigned to ${rep(contact)}, so the owner stays the same.` };
          const who = [...contact.phone.replace(/\D/g, '')].reduce((n, d) => n + Number(d), 0) % 2 ? 'luis' : 'maya';
          return { effect: { assignTo: who }, log: `Next in the rotation: ${env.users[who].name}.` };
        },
      },
      {
        id: 'find-open',
        kind: 'ifelse',
        title: 'Find Opportunity',
        label: 'Open deal?',
        branches: [
          {
            label: 'Opportunity Found',
            when: { type: 'all', label: 'Latest card in Roofing Sales with Status Open', of: [{ type: 'opportunity', status: 'open' }] },
            nodes: [
              {
                id: 'sms-known',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Your rep will call',
                summary: 'Answers the call right away and names their rep. No booking link and no name merge field: an earlier missed caller can still be a card with no name.',
                message: {
                  channel: 'sms',
                  body: "Hi, it's Harbor & Pine Roofing. Sorry we missed your call. {{user.first_name}} will call you back as soon as possible, or reply here if texting is easier.",
                },
              },
              {
                id: 'notify-known',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell their rep',
                summary: 'Type Notification (the bell in GHL) to the assigned user, with the contact as the Redirect Page. Each notification action sends one type; the task below is the second channel.',
                message: {
                  channel: 'internal',
                  to: '{{user.name}} (assigned user)',
                  subject: 'Missed call from a customer: {{contact.phone}}',
                  body: 'They have an open or won deal with us, so this workflow does not send them the booking link or make a new card. Call them back as soon as you can.',
                },
              },
              {
                id: 'task-known',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Call back',
                summary: 'For their rep, Due In: Now, so the call-back sits on a task list and not only in a notification.',
                run: ({ contact }) => ({ log: `Task for ${rep(contact)}, due now: call ${contact.firstName || contact.phone} back.` }),
              },
              {
                id: 'cooldown',
                kind: 'wait',
                title: 'Wait',
                label: 'Cooldown',
                mode: 'time',
                minutes: 30,
                summary:
                  'Keeps them in the workflow for 30 minutes. Call Details fires on every status change of a call, and people call twice; while they are active, GHL does not enrol them again, so neither sends a second text.',
              },
            ],
          },
        ],
        otherwise: {
          label: 'Opportunity Not Found',
          nodes: [
            {
              id: 'find-won',
              kind: 'ifelse',
              title: 'Find Opportunity',
              label: 'Won deal?',
              branches: [
                {
                  label: 'Opportunity Found',
                  when: { type: 'all', label: 'Latest card in Roofing Sales with Status Won', of: [{ type: 'opportunity', status: 'won' }] },
                  nodes: [
                    {
                      id: 'goto-known',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'sms-known',
                      summary: 'A customer whose job is sold gets the same short text and the same alert as an open deal. Find filters are AND-only, so open-or-won takes two Finds and one Go To.',
                    },
                  ],
                },
              ],
              otherwise: {
                label: 'Opportunity Not Found',
                nodes: [
                  {
                    id: 'sms-textback',
                    kind: 'action',
                    action: 'send_sms',
                    title: 'Send SMS',
                    label: 'Text-back',
                    summary: 'Goes out the moment the call is missed, day or night, because it answers a call they just made. No name merge field: a new caller is only a phone number. Opt-out line included.',
                    message: {
                      channel: 'sms',
                      body: "Hi, this is Harbor & Pine Roofing. Sorry we missed your call. We'll call you back as soon as we can, or reply here if texting is easier. To book a free roof inspection yourself: {{custom_values.booking_link}} Reply STOP to opt out.",
                    },
                  },
                  {
                    id: 'create-opp',
                    kind: 'action',
                    action: 'create_opportunity',
                    title: 'Create Opportunity',
                    label: 'New lead',
                    summary: 'Roofing Sales › New Lead, Opportunity Source Missed call. Duplicate Opportunity on, so a past lead whose deal was lost gets a fresh card; the old one stays as history.',
                    run: ({ contact }) => {
                      const old = contact.opportunity;
                      const effect = { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open' as const, value: 0 } };
                      if (old) return { effect, log: `New card in Roofing Sales › New Lead, source Missed call. Their ${old.status} card from ${old.stage} stays as it was.` };
                      return { effect, log: 'New card in Roofing Sales › New Lead, source Missed call.' };
                    },
                  },
                  {
                    id: 'tag',
                    kind: 'action',
                    action: 'add_tag',
                    title: 'Add Contact Tag',
                    label: 'missed-call',
                    summary: 'Marks everyone who came in through a missed call, for Smart Lists and the monthly lead-source count.',
                    effect: { addTags: ['missed-call'] },
                  },
                  {
                    id: 'notify-new',
                    kind: 'action',
                    action: 'internal_notification',
                    title: 'Internal Notification',
                    label: 'Alert the rep',
                    summary: 'Type Notification to the assigned user, Redirect Page the contact. In-app, not a text to the rep, so a call at 2 AM does not wake anyone.',
                    message: {
                      channel: 'internal',
                      to: '{{user.name}} (assigned user)',
                      subject: 'Missed call: {{contact.phone}}, new lead',
                      body: 'No open or won deal, so there is now a New Lead card with source Missed call. Call back within 15 minutes, and check Conversations first in case they have texted.',
                    },
                  },
                  {
                    id: 'task-callback',
                    kind: 'action',
                    action: 'add_task',
                    title: 'Add Task',
                    label: 'Call back',
                    summary: 'For the assigned rep, Due In: Now. It shows as overdue until someone calls.',
                    run: ({ contact }) => ({ log: `Task for ${rep(contact)}, due now: call ${contact.phone} back.` }),
                  },
                  {
                    id: 'wait-reply',
                    kind: 'wait',
                    title: 'Wait',
                    label: 'Wait for a reply',
                    mode: 'event',
                    event: 'reply',
                    minutes: 120,
                    summary: 'The contact to reply, Reply To channel SMS, Timeout 2 hours. That gives the rep time to call back before anything else is sent.',
                    branches: {
                      met: {
                        label: 'Replied',
                        nodes: [
                          {
                            id: 'settle',
                            kind: 'wait',
                            title: 'Wait',
                            label: 'Let DND update',
                            mode: 'time',
                            minutes: 1,
                            summary: 'One minute, so the If/Else below reads the contact after GHL has processed a STOP reply and switched DND on.',
                          },
                          {
                            id: 'check-reply',
                            kind: 'ifelse',
                            title: 'If/Else',
                            label: 'Can we still text them?',
                            branches: [
                              {
                                label: 'Texts are off',
                                when: { type: 'dnd', channel: 'sms' },
                                nodes: [
                                  {
                                    id: 'note-optout',
                                    kind: 'action',
                                    action: 'add_note',
                                    title: 'Add Note',
                                    label: 'Opt-out record',
                                    summary: 'A dated note on the contact that texts are off, so there is a record of when it was honoured.',
                                    run: () => ({ log: 'Note added: SMS DND is on after their reply. Phone only from here.' }),
                                  },
                                  {
                                    id: 'notify-optout',
                                    kind: 'action',
                                    action: 'internal_notification',
                                    title: 'Internal Notification',
                                    label: 'No more texts',
                                    summary: 'Tells the rep before they reach for their own phone.',
                                    message: {
                                      channel: 'internal',
                                      to: '{{user.name}} (assigned user)',
                                      subject: '{{contact.phone}} has opted out of texts',
                                      body: 'SMS DND is on, so GHL will not text them. Do not text them from your own phone either. If they still need help, call.',
                                    },
                                  },
                                ],
                              },
                            ],
                            otherwise: {
                              label: 'Any other reply',
                              nodes: [
                                {
                                  id: 'notify-reply',
                                  kind: 'action',
                                  action: 'internal_notification',
                                  title: 'Internal Notification',
                                  label: 'They replied',
                                  summary: 'A person answers every reply. The alert also carries the two things GHL cannot do from here: the name and the stage.',
                                  message: {
                                    channel: 'internal',
                                    to: '{{user.name}} (assigned user)',
                                    subject: '{{contact.phone}} replied to the missed-call text',
                                    body: 'Answer in Conversations. Add their name to the contact, and move the card to Contacted once you have spoken. If they asked us to stop texting in their own words, turn on SMS DND today.',
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                      timeout: {
                        label: 'No reply in 2 hours',
                        nodes: [
                          {
                            id: 'quiet',
                            kind: 'wait',
                            title: 'Wait',
                            label: 'Quiet hours',
                            mode: 'time',
                            minutes: 0,
                            window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                            summary: "No delay, but the Advance Window only resumes between 8 AM and 8 PM in the contact's time zone. The follow-up is not an answer to the call, so it waits.",
                          },
                          {
                            id: 'find-new',
                            kind: 'ifelse',
                            title: 'Find Opportunity',
                            label: 'Card still untouched?',
                            branches: [
                              {
                                label: 'Opportunity Found',
                                when: { type: 'all', label: 'Latest card in Roofing Sales with Pipeline Stage New Lead and Status Open', of: [{ type: 'opportunity', stage: 'New Lead', status: 'open' }] },
                                nodes: [
                                  {
                                    id: 'sms-nudge',
                                    kind: 'action',
                                    action: 'send_sms',
                                    title: 'Send SMS',
                                    label: 'Follow-up',
                                    summary: 'One follow-up, from the assigned rep. It is the last text this workflow sends.',
                                    message: {
                                      channel: 'sms',
                                      body: "Hi, it's {{user.first_name}} at Harbor & Pine Roofing, following up on your call. What can we help with? Reply here or book a free roof inspection: {{custom_values.booking_link}}",
                                    },
                                  },
                                  {
                                    id: 'wait-reply-2',
                                    kind: 'wait',
                                    title: 'Wait',
                                    label: 'Wait for a reply to the follow-up',
                                    mode: 'event',
                                    event: 'reply',
                                    minutes: DAY,
                                    summary: 'The contact to reply, Reply To channel SMS, Timeout 1 day.',
                                    branches: {
                                      met: {
                                        label: 'Replied',
                                        nodes: [
                                          {
                                            id: 'goto-reply',
                                            kind: 'goto',
                                            title: 'Go To',
                                            target: 'settle',
                                            summary: 'Same handling as a reply to the text-back, so there is one set of steps to change.',
                                          },
                                        ],
                                      },
                                      timeout: { label: 'No reply', nodes: [] },
                                    },
                                  },
                                ],
                              },
                            ],
                            otherwise: { label: 'Opportunity Not Found', nodes: [] },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'replies',
      label: 'New caller who texts back',
      summary: 'Busy line on a Tuesday afternoon. Replies to the text-back three minutes later with what they need.',
      start: at(1, 14, 12),
      contact: unknownCaller('(708) 555-0123'),
      events: [{ at: 3, type: 'reply', value: "Hi, this is Dana Whitfield. We have a leak over the kitchen after last night's storm. Can someone look at it this week?" }],
      expect: {
        outcome: 'completed',
        visits: ['assign', 'find-open:else', 'find-won:else', 'sms-textback', 'create-opp', 'tag', 'notify-new', 'task-callback', 'wait-reply:met', 'settle', 'check-reply:else', 'notify-reply'],
        tags: ['missed-call'],
        stage: 'New Lead',
      },
    },
    {
      id: 'customer',
      label: 'Customer with an open estimate',
      summary: 'Dana has a $14,800 estimate out with Maya and calls on Saturday morning. No booking link and no new card; Maya gets the call-back.',
      start: at(5, 9, 18),
      contact: {
        assignedTo: 'maya',
        fields: { estimate_amount: 14800 },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'open', value: 14800 },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['find-open:0', 'sms-known', 'notify-known', 'task-known', 'cooldown'], stage: 'Estimate Sent' },
    },
    {
      id: 'won',
      label: 'Customer whose job is sold',
      summary: 'Tom signed with Luis and the crew is booked. He calls at 7:10 AM, before the office opens, about where the dumpster goes.',
      start: at(3, 7, 10),
      contact: {
        firstName: 'Tom',
        lastName: 'Kowalski',
        phone: '(708) 555-0174',
        email: 'tom.k@example.com',
        assignedTo: 'luis',
        fields: { estimate_amount: 12950 },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Job Scheduled', status: 'won', value: 12950 },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['find-open:else', 'find-won:0', 'goto-known', 'sms-known', 'task-known', 'cooldown'], stage: 'Job Scheduled' },
    },
    {
      id: 'night-stop',
      label: 'Calls at night, then opts out',
      summary: 'Leaves a voicemail at 8:47 PM. Gets the text-back at once and the follow-up at 8 AM, and replies STOP.',
      start: at(3, 20, 47),
      contact: unknownCaller('(847) 555-0133'),
      events: [{ at: at(4, 8, 26) - at(3, 20, 47), type: 'reply', value: 'STOP' }],
      expect: {
        outcome: 'completed',
        visits: ['sms-textback', 'wait-reply:timeout', 'quiet', 'find-new:0', 'sms-nudge', 'wait-reply-2:met', 'goto-reply', 'settle', 'check-reply:0', 'note-optout', 'notify-optout'],
        tags: ['missed-call'],
      },
    },
    {
      id: 'dnd',
      label: 'Past lead who opted out of texts',
      summary: 'Went with another roofer last year after Luis quoted them, and replied STOP back then. Both texts are skipped; a fresh New Lead card sits next to the lost one, and Luis gets the alert and the task.',
      start: at(2, 16, 40),
      contact: { assignedTo: 'luis', dnd: { sms: true }, opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'lost', value: 11200 } },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['find-won:else', 'create-opp', 'notify-new', 'task-callback', 'wait-reply:timeout', 'find-new:0', 'wait-reply-2:timeout'],
        skips: ['sms-textback', 'sms-nudge'],
        tags: ['missed-call'],
        stage: 'New Lead',
      },
    },
    {
      id: 'not-a-lead',
      label: 'Rep gets through first',
      summary: 'No answer on a Monday morning. Luis calls back 20 minutes later: it is a gutter-guard salesman, so he marks the card Lost and no follow-up goes out.',
      start: at(0, 11, 5),
      contact: unknownCaller('(630) 555-0186'),
      events: [{ at: 20, type: 'opportunity_lost', label: 'Luis called back and got through. A gutter-guard salesman, not a homeowner, so he marked the card Lost (SOP step 3).' }],
      expect: { outcome: 'completed', visits: ['sms-textback', 'task-callback', 'wait-reply:timeout', 'quiet', 'find-new:else'], tags: ['missed-call'] },
    },
  ],
  dataModel: {
    tags: [{ name: 'missed-call', note: 'Came in through a missed call. Set on the new-caller path only, so customers are not counted as new leads.' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    {
      title: 'Start with the phone, not the workflow',
      body: "I asked where the main line rings, for how long, and who calls back. It forwards to the estimators' cells, and when a cell's voicemail picks up, Twilio marks the call Completed and this workflow never fires. Call Connect on the main line fixes that: a whisper asks the estimator to press a key, and only a keypress counts as answered. The ring timeout is 20 seconds, the top of GHL's suggested range.",
    },
    {
      title: 'A workflow, not the built-in setting',
      body: 'GHL has a built-in Missed Call Text Back (Settings › Phone System › Voice › Voicemail & Missed Call Text Back) that sends one message for every missed call, repeat calls included. This client needs different texts for customers and new callers, a card, an owner and a follow-up, so I built it on the Call Details trigger, which used to be called Call Status: Incoming, busy, no-answer or voicemail, main line only. The built-in setting stays off, or callers get two texts.',
    },
    {
      title: 'Find the deal, because If/Else cannot see it',
      body: 'GHL only lets If/Else read opportunity fields in a workflow with an opportunity-based trigger, and Call Details is not one. So Find Opportunity does the check with its own filters: the latest Roofing Sales card with Status Open, and if there is none, one with Status Won. Its filters are AND-only, so open or won takes two Finds and a Go To.',
    },
    {
      title: 'Owner first, then the text, then the CRM work',
      body: "Assign To User runs first, only for unassigned contacts, because the customer text names the rep and a notification to the assigned user has nobody to go to without one. After the two lookups, the text-back comes before the card and the tag, while the caller still has the phone in their hand. I treat it as a reply, not a promotion: it answers a call they made seconds ago. No text uses the first name, because a new caller is only a phone number in GHL and \"Hi ,\" is a poor first impression.",
    },
    {
      title: 'A new card for every new enquiry',
      body: 'Create Opportunity checks for duplicates by contact ID, so with Duplicate Opportunity off, a past lead who lost to another roofer last year would get no card at all. It is on, the same as in 03 and 07, and the two Finds above make sure nobody with an open or won deal reaches it. Nothing later updates the card: a card made by Create is not in context for Update Opportunity, so the rep moves it, and the one check that reads it uses Find again.',
    },
    {
      title: 'Replies go to a person',
      body: 'Stop on Response is off because replies are handled inside the workflow, by Wait steps set to The contact to reply with a timeout. After a one-minute wait, an If/Else checks SMS DND: a STOP has already switched it on, so the workflow adds a note and tells the rep not to text. Any other reply alerts the rep to answer, add the name and move the card. The reply wait after the follow-up uses Go To, so both replies share one set of steps.',
    },
    {
      title: 'One follow-up, and only if nobody has touched the card',
      body: "After two hours with no reply, an Advance Window holds the contact to 8 AM to 8 PM, and only then does Find Opportunity check the card is still New Lead and Open, so a rep who got through at 7:50 AM is not undercut at 8. Booking removes them earlier (03's first step), and a card moved to Contacted or marked Lost gets nothing. Two texts at most, under the three-in-24-hours cap in Florida, Oklahoma and Maryland. A new caller has no time zone on file, so GHL uses the account's, Chicago.",
    },
    {
      title: 'Test with real phones, then hand off',
      body: 'Test calls from a cell, a landline and two phones at once for busy, a forwarded call left to go to a cell voicemail, and calls from test contacts with open, won and lost cards, each checked in Enrollment History and Execution Logs. No premium actions, so nothing is billed per execution beyond the texts. Then the one-page SOP below, because the follow-up check only works if whoever gets through moves the card.',
    },
  ],
  edgeCases: [
    { title: 'Call at 8:47 PM', body: 'The text-back goes out at once, because it answers a call they just made. The rep alert is in-app, not a text at night. The follow-up is not an answer to anything, so it waits for 8 AM.' },
    {
      title: 'They call twice',
      body: 'Call Details fires on each status change of a call, and people redial. A contact who is still active is not enrolled again, so on the new-caller path the second call sends nothing new and the first alert and task still stand. The customer path would finish in seconds, so it ends with a 30-minute wait for the same reason. A call after the run has ended starts a fresh one, and their open New Lead card sends it down the customer path: a short "your rep will call" text and no second booking link.',
    },
    { title: 'A customer calls mid-job', body: 'An open or won deal gets a text naming their own rep, not a booking link for an inspection they already had, and no new card. The alert and the task go to the rep who knows the job.' },
    { title: 'Suppliers, sales calls and wrong numbers', body: 'They get the text-back and a card too; the workflow cannot tell before someone calls. The rep marks the card Lost, and the check before the follow-up sees it. A repeat call from the same number makes another card, because Duplicate Opportunity is on, so for persistent spam the SOP is DND on all channels, and a tag check at the top is the next change if it grows.' },
    { title: 'Opt-outs in their own words', body: 'STOP and the other standard keywords switch on DND automatically, and the reply branch notes it and warns the rep. "Please stop texting me" does not. Here a person reads every reply, and the reply alert and the SOP say to switch SMS DND on by hand the same day: since April 11, 2025 the FCC has required honouring an opt-out made by any reasonable means, within 10 business days. 07 automates this because it handles far more replies.' },
    { title: 'Landlines and numbers that cannot take texts', body: "The text fails and Execution Logs shows the error. GHL's DND article lists carrier error codes 30003 to 30006 as a reason it switches DND on, so later texts are skipped too. The rep alert and the call-back task do not depend on the text, so the caller still gets a call back." },
  ],
  qa: [
    'Let a test call ring out: the text-back arrives from the main line within a minute, a New Lead card with source Missed call appears, and the rep gets the bell notification and a task due now. Repeat for busy and voicemail; an answered call never enters',
    "Forward a call to a cell and let its voicemail pick up: with Call Connect on, the workflow still fires",
    'Call from test contacts with an open deal and with a won deal: a short text with no booking link, their own rep alerted, no new card. Find Opportunity shows Found in Execution Logs',
    'Call from a test contact whose only deal is Lost: a second, open New Lead card appears and the lost one is untouched',
    'Call twice within ten minutes, as a new caller and as a customer: one text each, and Enrollment History shows one enrolment',
    'Reply to the text-back: the reply alert arrives and no follow-up is sent. Separately, book from the link, move a card to Contacted, and mark one Lost: none of them gets the follow-up',
    'Call at 9 PM: the text-back arrives at once, and the follow-up shows as waiting in Execution Logs until 8 AM',
    'Reply STOP, and call from a landline: DND is on, the note and the opt-out alert appear and nothing else is texted; the landline SMS error shows in Execution Logs and the alert and task still arrive',
  ],
  snippets: [
    { title: 'Team SOP: missed-call alerts', language: 'text', code: sop, note: 'Part of the handover. The check before the follow-up text depends on steps 2 and 3.' },
    {
      title: 'A2P sample messages for this flow',
      language: 'text',
      code: a2pSamples,
      note: "GHL's registration guide says not to put custom fields or values in sample messages, so each one is written out the way a customer receives it. Reviewers check that the samples match the campaign's use case.",
    },
  ],
  features: [
    'Call Details',
    'Assign To User',
    'Find Opportunity',
    'Go To',
    'Send SMS',
    'Internal Notification',
    'Add Task',
    'Create Opportunity',
    'Add Contact Tag',
    'Wait · The contact to reply',
    'If/Else',
    'Add Note',
    'Wait · Advance Window',
    'Allow Re-entry',
  ],
};
