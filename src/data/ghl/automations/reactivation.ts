import type { Automation, Contact } from '@/lib/ghl/types';
import { env } from '../business';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/**
 * In the live build an AI Decision Maker reads the reply and picks a branch.
 * The simulator cannot call a model, so these keyword lists stand in for it.
 * The opt-out list holds phrases, never the bare word "stop", because
 * "can someone stop by?" is a yes. An exact STOP reply is caught before
 * this: the keyword switches SMS DND on, and the Opt-out branch checks DND.
 */
const OPT_OUT = ['stop texting', 'stop messaging', 'stop contacting', 'please stop', 'remove me', 'take me off', 'unsubscribe', 'opt out', 'opt-out', 'wrong number', "don't text", 'do not text', 'no more texts', 'leave me alone', 'revoke'];
const YES = ['yes', 'yeah', 'yep', 'sure', 'interested', 'still on', 'come out', 'stop by', 'take a look', 'quote', 'call me', 'book'];
const NO = ['no', 'not', 'nope', 'maybe', "don't", 'already', 'sold', 'moved', 'next year', 'later', 'someone else', 'another company', 'went with', 'all set', 'sorted'];

/** First name of the contact's owner, for logs. */
const owner = (c: Contact) => (c.assignedTo && env.users[c.assignedTo]?.first_name) || 'the assigned estimator';

/**
 * An old lead on the 2026 list: the tag that started the run, an owner, the
 * old card closed during list clean-up, and both consent answers from the form.
 */
const oldLead = (assignedTo: string, history: 'estimate-no-decision' | 'stl-no-response', over: Partial<Contact> = {}): Partial<Contact> => ({
  assignedTo,
  source: 'Website form',
  tags: [history, 'reactivate-2026'],
  opportunity:
    history === 'estimate-no-decision'
      ? { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'abandoned', name: 'Dana Whitfield · Roof replacement' }
      : { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'abandoned', name: 'Dana Whitfield · Inspection request' },
  ...over,
  fields: { sms_consent: 'Yes', sms_marketing_consent: 'Yes', ...over.fields },
});

const S = {
  interested: at(1, 10, 15),
  optOut: at(1, 10, 45),
  notNow: at(2, 11, 30),
  emailOnly: at(2, 10, 30),
  unclear: at(3, 10, 0),
  silent: at(3, 16, 45),
};

const deciderSetup = `Action name:   Route the reply

Instructions:
  A homeowner answered a text asking whether their roof is still on
  their list this year. Their reply: {{message.body}}
  Pick the branch that matches what they want. If the reply asks us to
  stop in any way, pick Opt-out, even if it also says something else.

Additional context:
  Harbor & Pine Roofing is a roofing company in the Chicago suburbs.
  The text went to old leads and to homeowners who got an estimate and
  never decided. Nobody on the list is in an open deal.

Branches:
  Opt-out         Asks us to stop texting or to remove them, says it is
                  the wrong number, or objects to being contacted.
                  When in doubt, pick this one.
  Interested      Says yes, or asks for an inspection, a visit, a price
                  or a call.
  Not now         Says no, not this year, maybe later, or the roof is
                  already done.
  Default Branch  (added by GHL, cannot be renamed or deleted)
                  Anything else. A person reads it.`;

const smartList = `Smart List: Reactivation 2026
  Tags                 include estimate-no-decision OR stl-no-response
  Last Activity On     more than 90 days ago
  Opportunity status   is not Open (pipeline: Roofing Sales)
  Tags                 exclude reactivation-opt-out, reactivate-2026
  DND all              Disabled
  Assigned user        is not empty

Then, on a weekday after 10 AM:
  Select all  >  Add Tag  >  reactivate-2026`;

export const reactivation: Automation = {
  id: 'reactivation',
  number: '07',
  name: 'Database reactivation',
  kicker: 'Nurture',
  tagline: 'Old leads get one plain question, sent slowly and only where there is consent. Every reply is read and routed: back into the pipeline, a note, an opt-out or a person.',
  problem:
    'Years of old leads and undecided estimates sat in the CRM, and nobody had time to call through them. Texting the whole list at once would have risked the phone number, reached people who never agreed to offers, and missed opt-outs written as "please stop texting me" instead of STOP.',
  evidence: {
    text: 'Under the FCC consent-revocation rules in force since April 11, 2025, a consumer can revoke consent to robocalls and robotexts by any reasonable means, and the revocation must be honoured within 10 business days. Replies such as "stop", "quit", "end", "revoke", "opt out", "cancel" or "unsubscribe" count as revocation by definition.',
    source: 'FCC Report and Order FCC 24-24, adopted February 15, 2024 (published in the Federal Register as document 2024-04587)',
    href: 'https://docs.fcc.gov/public/attachments/FCC-24-24A1.pdf',
  },
  solution:
    'One tag on a cleaned-up Smart List starts it. A Drip releases 50 contacts every 15 minutes, and the Time Window keeps sends to weekdays, 10 to 6. Contacts who ticked the offers box get two short texts from the estimator they dealt with, and everyone else gets two emails. An AI Decision Maker routes every reply. Interested homeowners go back into the pipeline on a new card, and their estimator is alerted. "Not now" gets a note. An opt-out in plain words gets SMS DND the same minute. Anything unclear goes to a person. In the simulator, keyword rules stand in for the model.',
  workflow: {
    name: '07 · Nurture · Database Reactivation',
    folder: 'Nurture',
    triggers: [{ title: 'Contact Tag', filters: ['Tag added is reactivate-2026'], label: 'Contact Tag (reactivate-2026 added)' }],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      timezone: 'contact',
      timeWindow: { start: '10:00', end: '18:00', days: WEEKDAYS },
      exits: [
        {
          event: 'appointment_booked',
          by: 'Booking fires 03 · Inspection Booked, whose first step is Remove from Workflow: 07 · Database Reactivation. Nobody with an inspection on the calendar gets asked whether their roof is still on their list.',
        },
      ],
      notes: [
        'Time Window Mon-Fri 10 AM-6 PM holds texts and emails only. Routing, DND, tags and notifications run the moment a reply arrives.',
        'Stop on Response off: the workflow routes replies itself. With it on, a reply would end the run before the Decision Maker saw it.',
        'Re-entry off. Next year the workflow is cloned with a new trigger tag, reactivate-2027.',
        'Allow multiple Opportunities is for opportunity-based triggers. Here the Duplicate Opportunity toggle on Create Opportunity is what matters.',
      ],
    },
    steps: [
      {
        id: 'drip',
        kind: 'action',
        action: 'drip',
        title: 'Drip',
        label: 'Pace the sends',
        summary: 'Batch size 50, interval 15 minutes. A list of 400 leaves in 8 batches over 1 hr 45 min, which protects the number and spreads the replies out so the estimators can answer them.',
        run: () => ({ log: 'Released with its batch. Batches of 50 leave every 15 minutes, so the number never sends to the whole list at once.' }),
      },
      {
        id: 'can-text',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Can we text an offer?',
        branches: [
          {
            label: 'Offers consent',
            when: {
              type: 'all',
              label: 'SMS Consent (offers) is Yes, and the contact is not DND for SMS',
              of: [
                { type: 'field', key: 'sms_marketing_consent', op: 'eq', value: 'Yes' },
                { type: 'not', of: { type: 'dnd', channel: 'sms' } },
              ],
            },
            nodes: [
              {
                id: 'sms-1',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Check-in',
                summary: 'From the estimator they dealt with. A plain question with no link, one segment, and the opt-out line.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, it's {{user.first_name}} at Harbor & Pine Roofing. You asked us about your roof a while back. Is it still on your list this year? Reply STOP to opt out.",
                },
              },
              {
                id: 'wait-1',
                kind: 'wait',
                title: 'Wait',
                label: 'Reply to the check-in',
                mode: 'event',
                event: 'reply',
                minutes: 2 * DAY,
                summary: 'The contact to reply, SMS, with a 2-day timeout. A reply goes to be routed. Silence gets one more text.',
                branches: {
                  met: {
                    label: 'Replied',
                    nodes: [
                      {
                        id: 'route',
                        kind: 'ifelse',
                        title: 'AI Decision Maker',
                        label: 'Route the reply',
                        branches: [
                          {
                            label: 'Opt-out',
                            when: {
                              type: 'any',
                              label: 'Asks us to stop texting or to remove them, or says wrong number. When in doubt, this one.',
                              of: [
                                { type: 'dnd', channel: 'sms' },
                                { type: 'reply_matches', words: OPT_OUT },
                              ],
                            },
                            nodes: [
                              {
                                id: 'dnd-sms',
                                kind: 'action',
                                action: 'dnd',
                                title: 'Enable/Disable DND',
                                label: 'Texts off',
                                summary: 'Enable, Outbound, SMS only, the minute the reply lands. A STOP keyword has already done this. A plain-words opt-out needs the workflow to do it.',
                                effect: { dnd: { sms: true } },
                                run: ({ contact }) => ({
                                  log: contact.dnd.sms
                                    ? 'SMS DND was already on from the STOP keyword. The action confirms it, so both kinds of opt-out end in the same place.'
                                    : 'SMS DND switched on. The reply was not a STOP keyword, so nothing would have done this by itself.',
                                }),
                              },
                              {
                                id: 'intent-optout',
                                kind: 'action',
                                action: 'update_field',
                                title: 'Update Contact Field',
                                label: 'Reply Intent: Opt-out',
                                summary: 'Records the answer for the campaign report.',
                                effect: { fields: { reply_intent: 'Opt-out' } },
                              },
                              {
                                id: 'tag-optout',
                                kind: 'action',
                                action: 'add_tag',
                                title: 'Add Contact Tag',
                                label: 'reactivation-opt-out',
                                summary: 'Keeps them off every future campaign list, email included. Fields get overwritten by next year\'s run; this tag does not.',
                                effect: { addTags: ['reactivation-opt-out'] },
                              },
                              {
                                id: 'notify-optout',
                                kind: 'action',
                                action: 'internal_notification',
                                title: 'Internal Notification',
                                label: 'Tell Jordan',
                                summary: 'To the owner, who is responsible for opt-outs. In-app and email.',
                                message: {
                                  channel: 'internal',
                                  to: '{{custom_values.owner_name}}',
                                  subject: 'Opt-out: {{contact.name}} asked us to stop texting',
                                  body: 'SMS DND is on, so GHL will not text them. Do not text them from your own phone either. If they asked to be removed altogether, turn on DND for all channels. The FCC allows 10 business days; this was done the same minute.',
                                },
                              },
                            ],
                          },
                          {
                            label: 'Interested',
                            when: {
                              type: 'all',
                              label: 'Says yes, or asks for an inspection, a visit, a price or a call',
                              of: [
                                { type: 'reply_matches', words: YES },
                                { type: 'not', of: { type: 'reply_matches', words: NO } },
                              ],
                            },
                            nodes: [
                              {
                                id: 'intent-yes',
                                kind: 'action',
                                action: 'update_field',
                                title: 'Update Contact Field',
                                label: 'Reply Intent: Interested',
                                summary: 'The Decision Maker\'s choice shows in Execution Logs, not on the contact, so each branch writes it to Reply Intent for the campaign report.',
                                effect: { fields: { reply_intent: 'Interested' } },
                              },
                              {
                                id: 'assign',
                                kind: 'action',
                                action: 'assign_user',
                                title: 'Assign To User',
                                label: 'Keep the estimator',
                                summary: 'Maya and Luis, split equally, with Only Apply to Unassigned Contacts on. The estimator who signed the texts keeps the lead. It only assigns someone if the list clean-up missed an owner.',
                                run: ({ contact }) => {
                                  if (contact.assignedTo) return { log: `Already ${owner(contact)}'s contact, and ${owner(contact)} signed the texts, so the owner stays the same.` };
                                  const who = [...`${contact.firstName}${contact.lastName}`].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2 ? 'luis' : 'maya';
                                  return { effect: { assignTo: who }, log: `No owner on file, so the rotation picks ${env.users[who].name}.` };
                                },
                              },
                              {
                                id: 'opp',
                                kind: 'action',
                                action: 'create_opportunity',
                                title: 'Create Opportunity',
                                label: 'Back in the pipeline',
                                summary: 'Roofing Sales › New Lead, source Reactivation, named after the contact. Duplicate Opportunity on, so the old closed card stays as history and the campaign gets the credit on a new one.',
                                run: ({ contact }) => {
                                  const name = `${contact.firstName} ${contact.lastName} · Reactivation 2026`;
                                  const old = contact.opportunity;
                                  return {
                                    effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open', name } },
                                    log: `New card at New Lead: "${name}", source Reactivation.${old ? ` The old card (${old.stage}, ${old.status}) stays as it was.` : ''}`,
                                  };
                                },
                              },
                              {
                                id: 'notify-rep',
                                kind: 'action',
                                action: 'internal_notification',
                                title: 'Internal Notification',
                                label: 'Call them today',
                                summary: 'In-app and email to the assigned estimator. A person writes back: the AI picks the branch, it never answers the homeowner.',
                                message: {
                                  channel: 'internal',
                                  to: '{{user.name}} (assigned user)',
                                  subject: 'Reactivation reply: {{contact.name}} is interested',
                                  body: '{{contact.first_name}} answered the 2026 check-in text and wants to talk. There is a new card at New Lead. Read the conversation, then call today: {{contact.phone}}',
                                },
                              },
                            ],
                          },
                          {
                            label: 'Not now',
                            when: { type: 'reply_matches', words: NO, label: 'Says no, not this year, maybe later, or the roof is already done' },
                            nodes: [
                              {
                                id: 'intent-later',
                                kind: 'action',
                                action: 'update_field',
                                title: 'Update Contact Field',
                                label: 'Reply Intent: Not now',
                                summary: 'Records the answer for the campaign report.',
                                effect: { fields: { reply_intent: 'Not now' } },
                              },
                              {
                                id: 'note-later',
                                kind: 'action',
                                action: 'add_note',
                                title: 'Add Note',
                                label: 'Their words',
                                summary: 'Keeps what they said, so whoever builds next year\'s list can decide whether to ask again. No more messages in this campaign.',
                                run: ({ lastReply }) => ({ log: `Note added: replied "${lastReply ?? ''}" to the 2026 check-in. No more messages this campaign.` }),
                              },
                            ],
                          },
                        ],
                        otherwise: {
                          label: 'Default Branch',
                          nodes: [
                            {
                              id: 'intent-unclear',
                              kind: 'action',
                              action: 'update_field',
                              title: 'Update Contact Field',
                              label: 'Reply Intent: Unclear',
                              summary: 'Records the answer for the campaign report.',
                              effect: { fields: { reply_intent: 'Unclear' } },
                            },
                            {
                              id: 'notify-read',
                              kind: 'action',
                              action: 'internal_notification',
                              title: 'Internal Notification',
                              label: 'A person reads it',
                              summary: 'Anything the model cannot place goes to the estimator, with nothing sent to the homeowner in the meantime.',
                              message: {
                                channel: 'internal',
                                to: '{{user.name}} (assigned user)',
                                subject: '{{contact.name}} replied, and it needs a person',
                                body: 'The reply to the 2026 check-in text did not fit a branch. Read it in Conversations and answer today. If they want a visit, add a card at New Lead with source Reactivation.',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  timeout: {
                    label: 'No reply in 2 days',
                    nodes: [
                      {
                        id: 'sms-2',
                        kind: 'action',
                        action: 'send_sms',
                        title: 'Send SMS',
                        label: 'One more, with the link',
                        summary: 'Same estimator. The booking link, and an easy way to say no.',
                        message: {
                          channel: 'sms',
                          body: "Hi {{contact.first_name}}, {{user.first_name}} again. If a free roof inspection would help this spring, pick a time here: {{custom_values.booking_link}} If the roof's sorted, just reply no and I'll close this out.",
                        },
                      },
                      {
                        id: 'wait-2',
                        kind: 'wait',
                        title: 'Wait',
                        label: 'Reply to the second text',
                        mode: 'event',
                        event: 'reply',
                        minutes: 3 * DAY,
                        summary: 'The contact to reply, SMS, with a 3-day timeout.',
                        branches: {
                          met: {
                            label: 'Replied',
                            nodes: [
                              {
                                id: 'goto-route',
                                kind: 'goto',
                                title: 'Go To',
                                target: 'route',
                                summary: 'A reply to the second text goes through the same routing. One set of branches to maintain, not two.',
                              },
                            ],
                          },
                          timeout: {
                            label: 'No reply in 3 days',
                            nodes: [
                              {
                                id: 'tag-no-reply',
                                kind: 'action',
                                action: 'add_tag',
                                title: 'Add Contact Tag',
                                label: 'reactivation-no-response',
                                summary: 'Two texts, no reply. The campaign report counts them, and next year\'s list can leave them out.',
                                effect: { addTags: ['reactivation-no-response'] },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Email only',
          nodes: [
            {
              id: 'email-1',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Check-in',
              summary: 'The same question for anyone without offers consent or on SMS DND. Booking link, postal address, and the unsubscribe link in the template footer.',
              message: {
                channel: 'email',
                subject: 'Is your roof still on your list, {{contact.first_name}}?',
                body: 'Hi {{contact.first_name}},\n\nYou asked us about your roof a while back, so I wanted to check in. If it is still on your list, we are booking free roof inspections this spring. An inspection takes about 45 minutes, and you get photos of anything we find and a written estimate.\n\nPick a time that suits you: {{custom_values.booking_link}}\n\nIf the roof is sorted, there is no need to reply. Thanks,\n{{user.name}}\nHarbor & Pine Roofing, {{location.address}}',
              },
            },
            { id: 'wait-4d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 4 * DAY, summary: 'Four days.' },
            {
              id: 'email-2',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Last note',
              summary: 'Short, and written to read fine even to someone who already answered the first one.',
              message: {
                channel: 'email',
                subject: 'One last note about your roof',
                body: 'Hi {{contact.first_name}},\n\nOne last note from me. If a roof inspection would help this year, you can book one any time at {{custom_values.booking_link}}, or call the office at {{custom_values.office_phone}}. If we have already spoken, please ignore this one.\n\n{{user.name}}\nHarbor & Pine Roofing, {{location.address}}',
              },
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'interested',
      label: 'Asks for a visit',
      summary: 'Got an estimate last year and never decided. Answers the check-in within the hour and asks whether someone can stop by. "Stop by" is not an opt-out, so they go back into the pipeline on a new card.',
      start: S.interested,
      contact: oldLead('maya', 'estimate-no-decision', { fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', estimate_amount: 16200 } }),
      events: [{ at: 47, type: 'reply', value: 'Yes, still on the list. A few shingles came off this winter. Can someone stop by next week?' }],
      expect: { outcome: 'completed', visits: ['drip', 'can-text:0', 'sms-1', 'wait-1:met', 'route:1', 'intent-yes', 'assign', 'opp', 'notify-rep'], stage: 'New Lead' },
    },
    {
      id: 'opt-out',
      label: 'Opts out in plain words',
      summary: 'An old inspection request. Replies "Please stop texting me." That is not a STOP keyword, so nothing switches DND on by itself. The workflow does it the same minute.',
      start: S.optOut,
      contact: oldLead('luis', 'stl-no-response', { fields: { service_needed: 'Leak or repair', roof_age: '10-20 years' } }),
      events: [{ at: 2 * 60 + 5, type: 'reply', value: 'Please stop texting me. We sold that house last year.' }],
      expect: { outcome: 'completed', visits: ['sms-1', 'wait-1:met', 'route:0', 'dnd-sms', 'intent-optout', 'tag-optout', 'notify-optout'], tags: ['reactivation-opt-out'] },
    },
    {
      id: 'not-now',
      label: 'Not this year, on the second text',
      summary: 'Ignores the check-in, then answers the second text at 6:40 on a Friday evening. The Go To sends the reply through the same routing, and the note goes on at once: only texts and emails wait for the Time Window.',
      start: S.notNow,
      contact: oldLead('maya', 'estimate-no-decision', { fields: { service_needed: 'Full replacement', roof_age: '10-20 years', estimate_amount: 9800 } }),
      events: [{ at: at(4, 18, 40) - S.notNow, type: 'reply', value: "Not this year, money's tight after the furnace. Maybe next spring." }],
      expect: { outcome: 'completed', visits: ['wait-1:timeout', 'sms-2', 'wait-2:met', 'goto-route', 'route:2', 'intent-later', 'note-later'] },
    },
    {
      id: 'unclear',
      label: 'Asks which house',
      summary: 'Owns two properties and asks which one we mean. The reply fits no branch, so it goes to the Default Branch and an estimator answers it.',
      start: S.unclear,
      contact: oldLead('luis', 'stl-no-response', { fields: { service_needed: 'Not sure yet' } }),
      events: [{ at: 25, type: 'reply', value: 'Is this about the rental on Elm or our place on Maple?' }],
      expect: { outcome: 'completed', visits: ['wait-1:met', 'route:else', 'intent-unclear', 'notify-read'] },
    },
    {
      id: 'silent',
      label: 'Never replies',
      summary: 'Released in the last batch on Thursday afternoon. The second text comes due on Saturday, so the Time Window holds it until Monday at 10 AM. Tagged as no response three days later.',
      start: S.silent,
      contact: oldLead('maya', 'stl-no-response', { fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years' } }),
      events: [],
      expect: { outcome: 'completed', visits: ['sms-1', 'wait-1:timeout', 'sms-2', 'wait-2:timeout', 'tag-no-reply'], tags: ['reactivation-no-response'] },
    },
    {
      id: 'email-only',
      label: 'Service texts only',
      summary: 'Ticked the box for inspection texts but not the one for offers, so this campaign emails instead. The second email comes due on Sunday and goes out Monday at 10 AM.',
      start: S.emailOnly,
      contact: oldLead('luis', 'estimate-no-decision', { fields: { sms_marketing_consent: 'No', service_needed: 'Full replacement', estimate_amount: 12400 } }),
      events: [],
      expect: { outcome: 'completed', visits: ['can-text:else', 'email-1', 'wait-4d', 'email-2'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'SMS Consent (offers)', key: 'sms_marketing_consent', type: 'Checkbox', note: 'The second box on the form: offers and seasonal reminders. Unticked by default. Only these contacts get reactivation texts.' },
      { name: 'Reply Intent', key: 'reply_intent', type: 'Dropdown (single)', note: 'Interested · Not now · Opt-out · Unclear. Written by each Decision Maker branch.' },
    ],
    tags: [
      { name: 'reactivate-2026', note: 'Added in bulk to the campaign Smart List. Starts this workflow.' },
      { name: 'reactivation-opt-out', note: 'Asked us to stop, in any words. Excluded from every future campaign list.' },
      { name: 'reactivation-no-response', note: 'Got both texts and never replied.' },
    ],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
      { name: 'Owner Name', key: 'owner_name', value: 'Jordan Blake' },
    ],
  },
  build: [
    {
      title: 'Clean the list before the tag goes on',
      body: 'The Smart List takes old leads and undecided estimates with no activity for 90 days, and leaves out anyone with an open card, anyone who opted out before and anyone on DND for all channels. Old New Lead cards from 01 were still open, so first I marked the untouched ones Abandoned in bulk, which kept those leads on the list. Everyone left has an owner, because the texts are signed with {{user.first_name}}.',
    },
    {
      title: 'Consent picks the channel',
      body: 'The form has two SMS boxes: one for inspection updates and one for offers. A reactivation text is an offer, so only the second box counts. Everyone else, including old imports with no consent on record, gets email. The email template has the postal address and an unsubscribe link, which CAN-SPAM requires.',
    },
    {
      title: 'Pace it',
      body: 'A Drip releases 50 contacts every 15 minutes, so the number never sends to the whole list at once, and the replies arrive at a pace two estimators can handle. The workflow Time Window is Monday to Friday, 10 AM to 6 PM: inside the 8 AM to 8 PM rule, and no weekends for a marketing send. GHL\'s Drip Preview lists the batch times before publishing and warns when the Time Window shifts a batch.',
    },
    {
      title: 'Two short texts',
      body: 'The first is a plain question from the estimator they dealt with: one segment, no link, the opt-out line. A plain question gets replies, and replies are what the rest of the workflow runs on. The second, two days later, has the booking link and an easy way to say no. At most one text in any 24 hours, well under the limit of three in 24 hours in Florida, Oklahoma and Maryland.',
    },
    {
      title: 'Route replies instead of stopping on them',
      body: 'Stop on Response is off, because here a reply is the start of the work, not the end. Each text is followed by a wait for the contact to reply, with a timeout. A reply to either text goes to the same routing step; the second one gets there with a Go To.',
    },
    {
      title: 'AI Decision Maker, with a person behind it',
      body: 'AI Intent Detection only sorts text into positive, negative or none, which cannot tell "not this year" from "stop texting me". AI Decision Maker takes named branches with a plain-English description each, plus a Default Branch GHL adds for anything else. It is a premium action billed per execution, and it only runs on replies, not on the whole list. Its choice shows in Execution Logs, not on the contact, so each branch saves it to Reply Intent. On this page, keyword rules stand in for the model.',
    },
    {
      title: 'Opt-outs handled the same minute',
      body: 'Standard opt-out keywords such as STOP switch on DND by themselves. "Please stop texting me" does not. Since April 11, 2025, the FCC has required honouring an opt-out made by any reasonable means within 10 business days, so the Opt-out branch turns on SMS DND with Enable/Disable DND, tags the contact and tells Jordan. The description tells the model to pick Opt-out when in doubt.',
    },
    {
      title: 'Test, publish, report',
      body: 'Six test contacts, one per scenario above, checked in Execution Logs before publishing, including that {{message.body}} in the Decision Maker holds the reply the wait caught. Results live in two places: Reply Intent for how the list answered, and Roofing Sales cards with source Reactivation for what it was worth. Next year I clone the workflow and change the trigger tag.',
    },
  ],
  edgeCases: [
    { title: '"Can someone stop by?"', body: 'The carrier only acts on a reply that is exactly a keyword like STOP, and the Decision Maker reads the whole sentence, so this goes to Interested. The simulator\'s keyword rules look for phrases such as "stop texting", never the bare word, for the same reason.' },
    { title: 'An opt-out in plain words', body: '"Please stop texting me" or "wrong number" does not trigger the keyword opt-out. The Opt-out branch switches on SMS DND at once, and Jordan decides whether they meant every channel. Missing an opt-out is a compliance problem. Misreading a yes as an opt-out loses one lead. That is why the model is told to pick Opt-out when unsure.' },
    { title: 'The model gets it wrong', body: 'The AI only picks a branch. It never writes to the homeowner, so a wrong call costs a phone call, not a wrong text. Interested creates a card and alerts a person. Anything it cannot place goes to the Default Branch, where a person reads it.' },
    { title: 'Most of the list already has a card', body: 'Create Opportunity checks for duplicates by contact ID. With duplicates off it would create nothing for anyone who ever had a card, which is almost everyone here. Duplicate Opportunity is on instead, and the Smart List already leaves out open cards, so the new card is the only open one.' },
    { title: 'List tagged after hours', body: 'The Time Window holds every text and email until 10 AM on the next weekday. The held batches then go out close together, which is what the Drip is there to prevent, so the SOP says to add the tag on a weekday after 10 AM.' },
    { title: 'An estimator texts them by hand', body: 'GHL\'s help center warns that a manual text sent while a contact is waiting for a reply can stop the workflow from counting their reply. The wait then times out and they get the second text while already talking to the estimator. The SOP says to call instead, or remove the contact from 07 before texting from Conversations.' },
  ],
  qa: [
    'Tag a test contact at 7 PM: nothing sends until 10 AM the next weekday, and the Drip Preview shows the shift',
    'Reply "Can someone stop by next week?": Reply Intent is Interested, a new New Lead card with source Reactivation sits next to the old closed one, and the estimator is alerted',
    'Reply "please stop texting me": SMS DND is on within the minute, the contact is tagged reactivation-opt-out, and Jordan is notified',
    'Reply STOP: the keyword sets DND, and the reply still routes to Opt-out and gets tagged',
    'Contact with only the service box ticked: two emails, no texts, address and unsubscribe link in the footer',
    'No reply: the second text two days later, reactivation-no-response three days after that',
    'Reply to the second text: the Go To runs the same routing',
    'In Execution Logs, the Decision Maker\'s input shows the actual reply text',
  ],
  snippets: [
    {
      title: 'AI Decision Maker setup',
      language: 'text',
      code: deciderSetup,
      note: 'The branch descriptions do most of the work. {{message.body}} is the variable GHL\'s AI docs use for an incoming message; the test run confirms it holds the reply the wait caught.',
    },
    {
      title: 'Campaign Smart List',
      language: 'text',
      code: smartList,
      note: 'Open cards are excluded, so nobody in the middle of a deal is asked whether their roof is still on their list.',
    },
  ],
  features: ['Contact Tag', 'Smart Lists', 'Drip', 'If/Else', 'Send SMS', 'Wait · The contact to reply', 'AI Decision Maker', 'Enable/Disable DND', 'Update Contact Field', 'Add Contact Tag', 'Internal Notification', 'Assign To User', 'Create Opportunity', 'Add Note', 'Go To', 'Send Email', 'Time Window'],
};
