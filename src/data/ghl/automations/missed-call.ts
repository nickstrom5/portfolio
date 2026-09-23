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

export const missedCall: Automation = {
  id: 'missed-call',
  number: '02',
  name: 'Missed-call text-back',
  kicker: 'Lead intake',
  tagline: 'Every missed call gets a text within seconds, a new caller becomes an opportunity with an owner, and people we already work with go straight to their own rep.',
  problem:
    'Calls come in while the estimators are on roofs and the office is on the other line. People who reach voicemail rarely leave a message. They call the next roofer on the list, and nobody here even knows they called.',
  solution:
    'Every missed call on the main line gets a text within seconds, day or night, while the caller still has the phone in their hand. New callers get the booking link, a New Lead opportunity, a rep and a call-back task; people who already have a deal with us get a short "your rep will call you back" text instead. Replies go to a person, and one follow-up goes out only if nobody has booked or got through, never before 8 AM.',
  workflow: {
    name: '02 · Lead Intake · Missed-Call Text-Back',
    folder: 'Lead Intake',
    triggers: [
      {
        title: 'Call Details',
        filters: ['Call direction is Inbound', 'Call status is No answer, Busy or Voicemail', 'Number is (312) 555-0142, the main line'],
        label: 'Call Details (missed inbound call)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      notes: [
        'No workflow Time Window: it would hold the text-back too. The nudge has its own quiet-hours window.',
        'Stop on Response off: replies are handled by the two reply waits and their branches.',
      ],
    },
    steps: [
      {
        id: 'who',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Do we know them?',
        branches: [
          {
            label: 'Open or won deal',
            when: {
              type: 'any',
              label: 'Roofing Sales opportunity is open or won',
              of: [
                { type: 'opportunity', status: 'open' },
                { type: 'opportunity', status: 'won' },
              ],
            },
            nodes: [
              {
                id: 'sms-known',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Your rep will call',
                summary: 'Answers the call right away. No booking link: they already have a deal with us.',
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
                summary: 'In-app and email to the user assigned to this contact, who already knows the job.',
                message: {
                  channel: 'internal',
                  to: '{{user.name}} (assigned user)',
                  subject: 'Missed call: {{contact.phone}}, open or won deal',
                  body: 'They already have a deal with us, so they got a short "we will call you back" text instead of the booking link. Call back as soon as you can.',
                },
              },
              {
                id: 'task-known',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Call back',
                summary: 'For their rep, due in 30 minutes.',
                run: ({ contact }) => ({ log: `Task for ${rep(contact)}: call ${contact.firstName || contact.phone} back within 30 minutes.` }),
              },
            ],
          },
        ],
        otherwise: {
          label: 'New caller',
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
              id: 'opp',
              kind: 'action',
              action: 'create_opportunity',
              title: 'Create Opportunity',
              label: 'New lead',
              summary: 'Roofing Sales › New Lead, with the opportunity source set to Missed call so reporting can count these leads.',
              effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open', name: 'Missed call' } },
            },
            {
              id: 'tag',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'missed-call',
              summary: 'For Smart Lists and reporting. "Missed-call leads still in New Lead" is this tag plus a stage filter, so no second tag is needed.',
              effect: { addTags: ['missed-call'] },
            },
            {
              id: 'assign',
              kind: 'action',
              action: 'assign_user',
              title: 'Assign To User',
              label: 'Round robin',
              summary: 'Maya and Luis, split equally, the same rotation as 01. Only Apply to Unassigned Contacts is on, so a contact we already know keeps their rep.',
              run: ({ contact }) => {
                if (contact.assignedTo) return { log: 'Already assigned, so the owner stays the same.' };
                const who = [...contact.phone.replace(/\D/g, '')].reduce((n, d) => n + Number(d), 0) % 2 ? 'luis' : 'maya';
                return { effect: { assignTo: who }, log: `Next in the rotation: ${env.users[who].name}.` };
              },
            },
            {
              id: 'notify-new',
              kind: 'action',
              action: 'internal_notification',
              title: 'Internal Notification',
              label: 'Alert the rep',
              summary: 'In-app and email to the assigned rep. Nobody on the team gets a text at 9 PM.',
              message: {
                channel: 'internal',
                to: '{{user.name}} (assigned user)',
                subject: 'Missed call: {{contact.phone}}, no deal on file',
                body: 'New lead, source Missed call. Call back within 15 minutes. The text-back and any reply are in Conversations.',
              },
            },
            {
              id: 'task-callback',
              kind: 'action',
              action: 'add_task',
              title: 'Add Task',
              label: 'Call back',
              summary: 'For the assigned rep, due in 15 minutes. A call that comes in after hours shows as overdue first thing in the morning.',
              run: ({ contact }) => ({ log: `Task for ${rep(contact)}: call ${contact.phone} back within 15 minutes.` }),
            },
            {
              id: 'wait-reply',
              kind: 'wait',
              title: 'Wait',
              label: 'Wait for a reply',
              mode: 'event',
              event: 'reply',
              minutes: 120,
              summary: 'Wait for the contact to reply, with a 2-hour timeout. That gives the rep time to call back before anything else is sent.',
              branches: {
                met: {
                  label: 'Replied',
                  nodes: [
                    {
                      id: 'check-reply',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Check the reply',
                      branches: [
                        {
                          label: 'Opted out',
                          when: { type: 'dnd', channel: 'sms' },
                          nodes: [
                            {
                              id: 'note-optout',
                              kind: 'action',
                              action: 'add_note',
                              title: 'Add Note',
                              label: 'Opt-out record',
                              summary: 'A dated note that SMS DND is on and why, so there is a record of when the opt-out was honoured.',
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
                            id: 'update-contacted',
                            kind: 'action',
                            action: 'update_opportunity',
                            title: 'Update Opportunity',
                            label: 'Contacted',
                            summary: 'A reply is a two-way conversation, so the deal moves to Contacted.',
                            effect: { opportunity: { stage: 'Contacted' } },
                          },
                          {
                            id: 'notify-reply',
                            kind: 'action',
                            action: 'internal_notification',
                            title: 'Internal Notification',
                            label: 'They replied',
                            summary: 'A person answers every reply. The rep also fills in the name the caller gives.',
                            message: {
                              channel: 'internal',
                              to: '{{user.name}} (assigned user)',
                              subject: '{{contact.phone}} replied to the missed-call text',
                              body: 'Pick it up in Conversations, and add their name to the contact once you have it.',
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
                      id: 'reached',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Already handled?',
                      branches: [
                        {
                          label: 'Booked or reached',
                          // In GHL this is one opportunity condition. The events stand in for
                          // what moves the stage outside this workflow, because the simulator
                          // runs one workflow at a time: 03 on booking, the rep after a call.
                          when: {
                            type: 'any',
                            label: 'Opportunity stage is no longer New Lead',
                            of: [
                              { type: 'not', of: { type: 'opportunity', stage: 'New Lead' } },
                              { type: 'event', event: 'appointment_booked' },
                              { type: 'event', event: 'call_answered' },
                            ],
                          },
                          nodes: [],
                        },
                      ],
                      otherwise: {
                        label: 'Still New Lead',
                        nodes: [
                          {
                            id: 'quiet',
                            kind: 'wait',
                            title: 'Wait',
                            label: 'Quiet hours',
                            mode: 'time',
                            minutes: 0,
                            window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                            summary: "No delay, but the Advanced Window only resumes between 8 AM and 8 PM in the contact's time zone. The nudge is a follow-up, not an answer to the call, so it waits.",
                          },
                          {
                            id: 'sms-nudge',
                            kind: 'action',
                            action: 'send_sms',
                            title: 'Send SMS',
                            label: 'Nudge',
                            summary: 'One follow-up, from the assigned rep. It is the last text this workflow sends.',
                            message: {
                              channel: 'sms',
                              body: "Hi, it's {{user.first_name}} at Harbor & Pine Roofing. Sorry we missed each other earlier. How can we help? Reply here or book a free roof inspection: {{custom_values.booking_link}}",
                            },
                          },
                          {
                            id: 'wait-reply-2',
                            kind: 'wait',
                            title: 'Wait',
                            label: 'Wait for a reply to the nudge',
                            mode: 'event',
                            event: 'reply',
                            minutes: DAY,
                            summary: 'Wait for the contact to reply, with a 1-day timeout.',
                            branches: {
                              met: {
                                label: 'Replied',
                                nodes: [
                                  {
                                    id: 'goto-reply',
                                    kind: 'goto',
                                    title: 'Go To',
                                    target: 'check-reply',
                                    summary: 'Same handling as a reply to the text-back, so there is one set of steps to change.',
                                  },
                                ],
                              },
                              timeout: {
                                label: 'No reply',
                                nodes: [],
                              },
                            },
                          },
                        ],
                      },
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
  scenarios: [
    {
      id: 'replies',
      label: 'New caller who texts back',
      summary: 'Busy line on a Tuesday afternoon. Replies to the text-back three minutes later with what they need.',
      start: at(1, 14, 12),
      contact: unknownCaller('(708) 555-0123'),
      events: [{ at: 3, type: 'reply', value: "Hi, this is Dana Whitfield. We have a leak over the kitchen after last night's storm. Can someone look at it this week?" }],
      expect: { outcome: 'completed', visits: ['sms-textback', 'opp', 'assign', 'notify-new', 'wait-reply:met', 'check-reply:else', 'update-contacted', 'notify-reply'], tags: ['missed-call'], stage: 'Contacted' },
    },
    {
      id: 'customer',
      label: 'Customer with an open estimate',
      summary: 'Dana has a $14,800 estimate out with Maya and calls on Saturday morning. No booking link; Maya gets the call-back.',
      start: at(5, 9, 18),
      contact: {
        assignedTo: 'maya',
        fields: { estimate_amount: 14800 },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'open', value: 14800 },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['who:0', 'sms-known', 'notify-known', 'task-known'], stage: 'Estimate Sent' },
    },
    {
      id: 'books',
      label: 'Books from the text',
      summary: 'No answer on a Monday morning. Never replies, but books an inspection from the link 22 minutes later, so the nudge never goes out.',
      start: at(0, 11, 5),
      contact: unknownCaller('(630) 555-0186'),
      events: [
        {
          at: 22,
          type: 'appointment_booked',
          appointmentAt: at(2, 10) - at(0, 11, 5),
          label: 'Books Wed at 10:00 AM from the link in the text-back. 03 · Inspection Booked takes over and moves the deal to Inspection Booked.',
        },
      ],
      expect: { outcome: 'completed', visits: ['sms-textback', 'wait-reply:timeout', 'reached:0'], tags: ['missed-call'] },
    },
    {
      id: 'night-stop',
      label: 'Calls at night, then opts out',
      summary: 'Leaves a voicemail at 8:47 PM. Gets the text-back at once, the nudge at 8 AM, and replies STOP.',
      start: at(3, 20, 47),
      contact: unknownCaller('(847) 555-0133'),
      events: [{ at: at(4, 8, 26) - at(3, 20, 47), type: 'reply', value: 'STOP' }],
      expect: { outcome: 'completed', visits: ['sms-textback', 'reached:else', 'quiet', 'sms-nudge', 'wait-reply-2:met', 'goto-reply', 'check-reply:0', 'note-optout', 'notify-optout'], tags: ['missed-call'] },
    },
    {
      id: 'dnd',
      label: 'Already opted out of texts',
      summary: 'Replied STOP to a text last year and has no open deal. Both texts are skipped; the rep still gets the alert and the call-back task.',
      start: at(2, 16, 40),
      contact: { assignedTo: 'luis', dnd: { sms: true } },
      events: [],
      expect: { outcome: 'completed', visits: ['notify-new', 'task-callback', 'reached:else', 'wait-reply-2:timeout'], skips: ['sms-textback', 'sms-nudge'], tags: ['missed-call'], stage: 'New Lead' },
    },
  ],
  dataModel: {
    tags: [{ name: 'missed-call', note: 'A new lead that came in through a missed call. Set once, on the new-caller path only.' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [{ name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' }],
  },
  build: [
    {
      title: 'Start with the phone, not the workflow',
      body: "I asked where the main line rings, for how long, and who calls back. If calls forward to a cell phone, the cell's own voicemail can pick up first, and then GHL can see the call as answered and nothing fires. So the forwarding rings for less time than the cell takes to reach its voicemail, and I tested it on every phone in the rotation.",
    },
    {
      title: 'Trigger on Call Details',
      body: 'Inbound calls to the main line with a status of no answer, busy or voicemail; answered calls never enter. The help center also has an older Call Status trigger with similar statuses. I built on Call Details because it can filter by the number that was called.',
    },
    {
      title: 'Known callers first',
      body: 'An If/Else checks the Roofing Sales opportunity before anything is sent. Open or won means we already work with them: a short "your rep will call you back" text and an alert to that rep, with no booking link and no new opportunity. Everyone else is a new lead.',
    },
    {
      title: 'Text first, then the CRM work',
      body: 'The text-back is the first action, so it lands while the caller still has the phone in their hand. Then the opportunity (New Lead, source Missed call), the tag, the round robin and the rep alert. No text uses the contact\'s first name: a new caller is only a phone number in GHL, and "Hi ," is a poor first impression.',
    },
    {
      title: 'Replies go to a person',
      body: 'Stop on Response is off because replies are handled inside the workflow, by a 2-hour reply wait with branches. A reply moves the deal to Contacted and alerts the rep. If the reply was STOP, GHL has already switched on SMS DND, so the workflow adds a note and tells the rep not to text. The reply wait after the nudge uses Go To, so both replies share one set of steps.',
    },
    {
      title: 'One nudge, and only if nobody got through',
      body: "Before the follow-up, an If/Else checks that the deal is still New Lead. If they booked (03 moves it to Inspection Booked) or the rep reached them and moved it to Contacted, the workflow ends there. Otherwise a Wait with an Advanced Window holds the nudge for 8 AM to 8 PM. A new caller has no time zone on file, so GHL falls back to the account's, Chicago, which is right for a local roofer.",
    },
    {
      title: 'Settings on purpose',
      body: 'Allow Re-entry is on: every missed call deserves an answer, whether it is the first this year or the fifth. The known-caller branch stops a second call from sending a second booking link. No workflow Time Window, because it would hold the text-back too. Every step is a standard action, so nothing here is billed per execution beyond the texts themselves.',
    },
    {
      title: 'Test with real phones, then hand off',
      body: 'Test calls from a cell, a landline and two phones at once for busy, each checked in Execution Logs. Then a one-page SOP for the team, because the nudge check only works if whoever gets through moves the opportunity to Contacted.',
    },
  ],
  edgeCases: [
    { title: 'Call at 8:47 PM', body: 'The text-back goes out at once, because it answers a call they just made. The rep alert is in-app and email, not a text at night. The nudge is a follow-up, so it waits for 8 AM.' },
    { title: 'Two calls in a row', body: 'Re-entry is on, so the second call enrols them again. By then they have an open New Lead opportunity, so they take the known-caller path: one short "your rep will call" text, no second booking link and no second opportunity.' },
    { title: 'A customer calls mid-job', body: 'An open or won deal gets a text naming their own rep, not a booking link for an inspection they already had. If they reply, that also stops 04 · Estimate Follow-Up through its Stop on Response, which is right: a person is talking to them now.' },
    { title: 'Booked or reached before the nudge', body: 'The If/Else before the nudge checks whether the deal is still New Lead. Booking through the link or a call-back that got through ends the workflow, so nobody gets "sorry we missed each other" after they have spoken to us.' },
    { title: 'Opt-outs in their own words', body: 'STOP and the other standard keywords switch on SMS DND automatically, and the reply branch notes it and warns the rep. "Please stop texting me" does not. Here a person reads every reply, and the SOP says to switch DND on by hand the same day: since April 11, 2025 the FCC requires honouring an opt-out made by any reasonable means, within 10 business days. 07 automates this because it handles far more replies.' },
    { title: 'Landlines and numbers that cannot take texts', body: 'The text fails and Execution Logs shows the error. The rep alert and the call-back task do not depend on the text, so the caller still gets a call back.' },
  ],
  qa: [
    'Let a test call ring out: the text-back arrives within a minute, the opportunity is New Lead with source Missed call, and the rep gets the alert and the task. Repeat for busy and voicemail; an answered call never enters',
    'Call from a contact with an open deal: a short text with no booking link, their own rep is alerted, and no second opportunity appears',
    'Call twice within a minute: one booking link and one opportunity',
    'Reply to the text-back: the stage moves to Contacted, the rep is alerted, and no nudge follows',
    'Book from the link without replying, and separately move a test deal to Contacted: neither gets the nudge at the two-hour mark',
    'Call at 9 PM: the text-back arrives at once, and the nudge shows as waiting in Execution Logs until 8 AM',
    'Reply STOP: SMS DND is on, the note and the opt-out alert appear, and nothing else is texted',
    'Call from a landline: the SMS error shows in Execution Logs, and the alert and task still arrive',
  ],
  snippets: [
    {
      title: 'Team SOP: missed-call alerts',
      language: 'text',
      code: `When a missed-call alert comes in:
1. Call back within 15 minutes, from the GHL app or the office line, not your own number.
2. Got through? Move the opportunity to Contacted, or book the inspection. Either one stops the follow-up text.
3. They texted back? Answer in Conversations, and add their name to the contact.
4. They asked us to stop texting, in any words? Turn on DND for SMS on the contact the same day.
5. Never text a customer from your personal phone.`,
      note: 'Part of the handover. The check before the nudge depends on step 2.',
    },
    {
      title: 'A2P sample messages for this flow',
      language: 'text',
      code: `Text-back (new caller):
Hi, this is Harbor & Pine Roofing. Sorry we missed your call. We'll call you back as soon as we can, or reply here if texting is easier. To book a free roof inspection yourself: [booking link] Reply STOP to opt out.

Follow-up (once, 8 AM to 8 PM):
Hi, it's [rep first name] at Harbor & Pine Roofing. Sorry we missed each other earlier. How can we help? Reply here or book a free roof inspection: [booking link]

Existing customer:
Hi, it's Harbor & Pine Roofing. Sorry we missed your call. [rep first name] will call you back as soon as possible, or reply here if texting is easier.`,
      note: 'Carriers check live traffic against the registered campaign, so every automated text in the account is listed as a sample message, with links as bracketed placeholders.',
    },
  ],
  features: ['Call Details', 'Allow Re-entry', 'If/Else', 'Send SMS', 'Create Opportunity', 'Add Contact Tag', 'Assign To User', 'Internal Notification', 'Add Task', 'Wait · Contact Reply', 'Update Opportunity', 'Add Note', 'Wait · Advanced Window', 'Go To'],
};
