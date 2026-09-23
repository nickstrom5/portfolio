import type { ActionNode, Automation, Condition, Contact } from '@/lib/ghl/types';
import { formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { env } from '../business';

const DAY = 1440;

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const money = (v: string | number | boolean) => `$${Number(v).toLocaleString('en-US')}`;

/** Every email ends with the business name and postal address (CAN-SPAM). GHL adds the unsubscribe link. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

/**
 * Add Task's Assign To takes one named user, so the call task splits on
 * Assigned User first. The simulator reads the owner recorded at the first step.
 */
const ownerIsLuis: Condition = { type: 'var', key: 'owner', op: 'eq', value: 'luis', label: 'Assigned User is Luis Grant' };

/** The day-seven call, one Add Task per estimator. */
const callTask = (id: string, key: 'maya' | 'luis'): ActionNode => ({
  id,
  kind: 'action',
  action: 'add_task',
  title: 'Add Task',
  label: `Call: ${env.users[key].first_name}`,
  summary: `Assign To ${env.users[key].name}, Due In 1 day, Skip Weekends on. A week in, a person calls: the messages back the estimator up, they do not replace the call.`,
  run: ({ contact, now }) => {
    const amount = contact.fields.estimate_amount;
    return {
      log: `Task for ${env.users[key].name}, due ${formatDay(nextWeekdayAt(now, 0))}: call ${contact.firstName} about the ${amount ? `${money(amount)} ` : ''}estimate. If they decide on the call, add estimate-signed or estimate-declined.`,
    };
  },
});

/** The three tags this workflow reads or writes. Cleared at the start so an earlier estimate cannot decide this one. */
const DECISION_TAGS = ['estimate-signed', 'estimate-declined', 'estimate-no-decision'];

/** A homeowner whose estimate has just gone out: card at Estimate Sent, owned by the estimator who wrote it. */
const estimateOut = (assignedTo: string, amount?: number, over: Partial<Contact> = {}): Partial<Contact> => ({
  assignedTo,
  source: 'Website form',
  ...over,
  fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', ...(amount ? { estimate_amount: amount } : {}), ...over.fields },
  opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'open', name: 'Dana Whitfield · Roof replacement' },
});

const S = {
  signs: at(1, 13, 15),
  question: at(2, 11, 30),
  quiet: at(0, 15, 40),
  saturday: at(5, 16, 50),
  dnd: at(3, 10, 20),
};

const goalSetup = `Action name:   Estimate decided

Select Type of Goal:
               Contact Tag · Added · estimate-signed
               Contact Tag · Added · estimate-declined
               (either one meets the goal)

If Contact Reaches This Goal Without Meeting Conditions:
               Continue anyway`;

const estimatorSop = `When an estimate goes out:
  1. Fill in Estimate Amount on the contact. Numbers only, no $ sign.
  2. Move the card to Estimate Sent. The follow-up starts on its own.

When the homeowner decides:
  Signed   -> add the tag estimate-signed. The card goes Won and
              production hears about it. (Marking the card Won
              yourself also works: 05 starts and ends this follow-up.)
  Said no  -> add the tag estimate-declined. The card goes Lost and
              the messages stop. Then add the lost reason on the card.
  Do not drag the card to Lost. The follow-up keeps running and
  sends the rest of its messages.

Already talking to them?
  If they replied to a follow-up text or email, the workflow has
  handed them to you and the tags no longer do anything.
  Mark the card Won or Lost yourself.`;

export const estimateFollowUp: Automation = {
  id: 'estimate-follow-up',
  number: '04',
  name: 'Estimate follow-up',
  kicker: 'Sales',
  tagline: 'Two weeks of useful follow-up after every estimate. One reply or one tag ends it, and the pipeline shows what actually happened.',
  problem:
    'Estimates went out and then nobody followed up. The estimators meant to, but by the next morning they were up on another roof. Homeowners comparing three quotes went with whoever stayed in touch, and the pipeline filled with cards stuck at Estimate Sent.',
  evidence: {
    text: 'GHL\'s Goal Event guide says only one Goal Event action can be added per workflow, but "you may configure multiple criteria inside that one Goal Event". When the goal is met, the contact moves to it "regardless of where they were in the workflow."',
    source: 'HighLevel Help Center, "Workflow Action - Goal Event"',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000003328-workflow-action-goal-event',
  },
  solution:
    'Moving the card to Estimate Sent starts two weeks of follow-up in the estimator\'s name: an offer to walk through the estimate, a financing email, a text that answers the usual questions, a call task, and a polite "should I close your file?". Texts and emails only go out Monday to Saturday, 9 to 6. Any reply hands the conversation to the estimator. One tag from the estimator, signed or declined, ends the sequence and marks the card Won or Lost. If nobody decides in two weeks, the card is marked Abandoned and tagged for a later reactivation campaign.',
  workflow: {
    name: '04 · Sales · Estimate Follow-Up',
    folder: 'Sales',
    triggers: [
      {
        title: 'Pipeline Stage Changed',
        filters: ['In Pipeline is Roofing Sales', 'Pipeline Stage is Estimate Sent', 'Status is Open'],
        label: 'Pipeline Stage Changed (Estimate Sent)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: true,
      allowMultipleOpportunities: true,
      timezone: 'contact',
      timeWindow: { start: '09:00', end: '18:00', days: [0, 1, 2, 3, 4, 5] },
      exits: [
        {
          event: 'opportunity_won',
          by: '05 · Won to Job Hand-Off fires on Won, and its first step is Remove from Workflow: 04 · Estimate Follow-Up. A card someone marks Won by hand stops these messages too.',
        },
      ],
      notes: [
        'Time Window Mon-Sat 9 AM-6 PM holds texts and emails only. Tasks, notifications and pipeline updates run on time.',
        'Stop on Response on: a reply to any message from this workflow, text or email, ends it for that contact.',
        'Allow Re-entry on: a second estimate for the same homeowner, a revised quote or a new card from 07, gets its own follow-up. GHL never re-enters a contact who is still in the workflow, so moving a card back and forward mid-sequence does not restart the texts.',
        'Allow multiple Opportunities on (the default for new workflows): each card gets its own run, and Update Opportunity only changes the card that triggered it.',
        'Timezone: Contact. A contact with no time zone falls back to the account time zone, Chicago.',
      ],
    },
    steps: [
      {
        id: 'reset',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Clear old decisions',
        summary: 'Removes estimate-signed, estimate-declined and estimate-no-decision left over from an earlier estimate, so the decision at the end only reads this one.',
        run: ({ contact }) => {
          const old = DECISION_TAGS.filter((t) => contact.tags.includes(t));
          return {
            vars: { owner: contact.assignedTo ?? '' },
            effect: { removeTags: DECISION_TAGS },
            log: old.length ? `Removed ${old.join(', ')}, left over from an earlier estimate.` : 'None of the three tags was on the contact, so nothing changed.',
          };
        },
      },
      {
        id: 'amount',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Amount on file?',
        branches: [
          {
            label: 'Amount filled in',
            when: { type: 'field', key: 'estimate_amount', op: 'not_empty', label: 'Estimate Amount is not empty' },
            nodes: [
              {
                id: 'value',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Card value',
                summary: 'Opportunity Value is {{contact.estimate_amount}}, so the Roofing Sales total shows real dollars and nobody types the number twice.',
                run: ({ contact }) => {
                  const amount = Number(contact.fields.estimate_amount);
                  return { effect: { opportunity: { value: amount } }, log: `Card value set to ${money(amount)} from Estimate Amount.` };
                },
              },
              {
                id: 'wait-2h',
                kind: 'wait',
                title: 'Wait',
                label: 'Reading time',
                mode: 'time',
                minutes: 120,
                summary: 'Two hours, so the estimate has landed before the first text arrives.',
              },
              {
                id: 'sms-walk',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Walk-through offer',
                summary: 'From the assigned estimator. An offer, not a push. Opt-out line included, because this is the first text of a new sequence.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, it's {{user.first_name}} from Harbor & Pine Roofing. You should have your estimate by now. Happy to walk you through it line by line, on a quick call or at your kitchen table. What time suits you? Reply STOP to opt out.",
                },
              },
              { id: 'wait-2d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days to read it and talk it over at home.' },
              {
                id: 'email-finance',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Financing',
                summary: 'Financing through a trigger link, so a click shows who is weighing the cost. No price in the email: estimates get revised, and last week\'s number in an automated email does more harm than none. No rate or payment amount either: those are Regulation Z triggering terms, so they stay on the financing page with the lender\'s disclosures. The footer carries the postal address; the sub-account adds the unsubscribe link.',
                message: {
                  channel: 'email',
                  subject: 'Your roof estimate, and spreading the cost',
                  body: 'Hi {{contact.first_name}},\n\nThanks again for having us out to look at your roof. A new roof is a big purchase, and plenty of homeowners would rather pay for it monthly than all at once. You can see our financing options, and what a monthly payment could look like, here: {{trigger_link.financing}}\n\nIf anything in the estimate is unclear, reply to this email or call the office at {{custom_values.office_phone}}, and I will go through it with you.\n\n{{user.name}}' + footer,
                },
              },
              { id: 'wait-3d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 3 * DAY, summary: 'Three days.' },
              {
                id: 'sms-questions',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Common questions',
                summary: 'Answers the three questions homeowners ask at this stage before they have to ask. The warranty link is a custom value, so it changes in one place.',
                message: {
                  channel: 'sms',
                  body: 'Hi {{contact.first_name}}, {{user.first_name}} again. Answers to what most people ask: most jobs like yours take 1 to 2 days, we photograph any soft decking and check with you before replacing it, and the warranty is here: {{custom_values.warranty_link}}',
                },
              },
              { id: 'wait-2d-call', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days.' },
              {
                id: 'whose-call',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Whose estimate?',
                branches: [
                  {
                    label: 'Luis',
                    when: ownerIsLuis,
                    nodes: [
                      callTask('task-call-luis', 'luis'),
                      { id: 'goto-call', kind: 'goto', title: 'Go To', target: 'wait-5d', summary: 'Joins the Maya branch after her task, so the close-out and the decision exist once.' },
                    ],
                  },
                ],
                otherwise: {
                  label: 'Maya',
                  nodes: [
                    callTask('task-call-maya', 'maya'),
                    { id: 'wait-5d', kind: 'wait', title: 'Wait', label: 'Before the close-out', mode: 'time', minutes: 5 * DAY, summary: 'Five days.' },
                    {
                      id: 'sms-close',
                      kind: 'action',
                      action: 'send_sms',
                      title: 'Send SMS',
                      label: 'Close the file?',
                      summary: 'Makes it easy to say no, which is still an answer. A reply here stops the workflow like any other.',
                      message: {
                        channel: 'sms',
                        body: "Hi {{contact.first_name}}, should I close out your roof estimate for now? No problem either way. If you'd like to go ahead or talk it through, just reply here. Thanks, {{user.first_name}}",
                      },
                    },
                    { id: 'wait-2d-end', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days for a last answer before the decision.' },
                    {
                      id: 'goal',
                      kind: 'goal',
                      title: 'Goal Event',
                      label: 'Estimate decided',
                      event: 'tag_added',
                      value: ['estimate-signed', 'estimate-declined'],
                      summary: 'Contact Tag added: estimate-signed or estimate-declined, two criteria in one Goal Event, and no other tag meets it. If neither arrives, Continue anyway takes the contact on to the decision.',
                      ifNotMet: 'continue',
                    },
                    {
                      id: 'decision',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Decision',
                      branches: [
                        {
                          label: 'Signed',
                          when: { type: 'tag', has: 'estimate-signed' },
                          nodes: [
                            {
                              id: 'won',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Won',
                              summary: 'Status Won. That fires 05 · Won to Job Hand-Off, so production hears about the job without anyone retyping it.',
                              effect: { opportunity: { status: 'won' } },
                            },
                          ],
                        },
                        {
                          label: 'Declined',
                          when: { type: 'tag', has: 'estimate-declined' },
                          nodes: [
                            {
                              id: 'lost',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Lost',
                              summary: 'Status Lost. The estimator adds the lost reason on the card, which feeds the lost-deal report. No tag for 07: they said no.',
                              effect: { opportunity: { status: 'lost' } },
                            },
                          ],
                        },
                        {
                          label: 'No decision',
                          when: { type: 'opportunity', status: 'open' },
                          nodes: [
                            {
                              id: 'abandon',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Abandoned',
                              summary: 'Status Abandoned, not Lost: they never said no, so the lost-deal report stays honest.',
                              effect: { opportunity: { status: 'abandoned' } },
                            },
                            {
                              id: 'tag-nd',
                              kind: 'action',
                              action: 'add_tag',
                              title: 'Add Contact Tag',
                              label: 'estimate-no-decision',
                              summary: 'Puts them on the list for a later reactivation campaign (07 · Database Reactivation).',
                              effect: { addTags: ['estimate-no-decision'] },
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'Closed by hand',
                        nodes: [
                          {
                            id: 'note-hand',
                            kind: 'action',
                            action: 'add_note',
                            title: 'Add Note',
                            label: 'Left as the rep set it',
                            summary: 'Someone already closed the card by hand. The workflow records that and leaves the status alone instead of overwriting it with Abandoned.',
                            run: ({ contact }) => ({ log: `Note added: the card was already ${contact.opportunity?.status ?? 'closed'} when the follow-up ended, so the workflow left it as the rep set it.` }),
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Amount blank',
          nodes: [
            {
              id: 'notify-blank',
              kind: 'action',
              action: 'internal_notification',
              title: 'Internal Notification',
              label: 'Fill in the amount',
              summary: 'Type Notification (the bell), To User Type Assigned User, Redirect Page the contact, the minute the card moves, so the gap is fixed the same day.',
              message: {
                channel: 'internal',
                to: '{{user.name}} (assigned user)',
                subject: 'Estimate Amount is blank: {{contact.name}}',
                body: 'The follow-up has started, but this card has no value, so the pipeline total is short, and the Slack post and job sheet in 05 read the same field. Fill in Estimate Amount on the contact and the value on the card.',
              },
            },
            {
              id: 'goto-seq',
              kind: 'goto',
              title: 'Go To',
              target: 'wait-2h',
              summary: 'Back onto the same follow-up, skipping only the value copy. One sequence to maintain, not two.',
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'signs',
      label: 'Signs after the financing email',
      summary: 'A $14,800 replacement. Reads the financing email, signs that evening, and Maya adds estimate-signed the next morning.',
      start: S.signs,
      contact: estimateOut('maya', 14800, { fields: { utm_source: 'google', utm_campaign: 'spring-replacement' } }),
      events: [{ at: at(4, 8, 40) - S.signs, type: 'tag_added', value: 'estimate-signed', label: 'estimate-signed, added by Maya' }],
      expect: { outcome: 'goal', visits: ['reset', 'value', 'sms-walk', 'email-finance', 'goal', 'decision:0', 'won'], tags: ['estimate-signed'], stage: 'Estimate Sent' },
    },
    {
      id: 'question',
      label: 'Replies with a question',
      summary: 'Answers the first text with a question about gutters. Luis takes the conversation from there.',
      start: S.question,
      contact: estimateOut('luis', 11250, { fields: { roof_age: '10-20 years' } }),
      events: [{ at: at(2, 13, 52) - S.question, type: 'reply', value: 'Thanks Luis. Does that price include new gutters, or just the roof?' }],
      expect: { outcome: 'stopped', visits: ['value', 'sms-walk'] },
    },
    {
      id: 'quiet',
      label: 'Back through 07, never decides',
      summary: 'Stalled on an estimate last year and came back through 07 with a new card. A $23,400 tear-off: the old tag is cleared, she gets every touch and never answers, and after two weeks the card is Abandoned and she is back on the list.',
      start: S.quiet,
      contact: estimateOut('maya', 23400, { tags: ['estimate-no-decision', 'reactivate-2026'] }),
      events: [],
      expect: { outcome: 'completed', visits: ['reset', 'sms-questions', 'whose-call:else', 'task-call-maya', 'sms-close', 'goal', 'decision:2', 'abandon', 'tag-nd'], tags: ['estimate-no-decision'] },
    },
    {
      id: 'saturday',
      label: 'Sent Saturday evening, amount blank',
      summary: 'Luis moves the card from his truck at 4:50 PM on Saturday and skips the amount. He gets an alert at once, the first text waits for Monday 9 AM, and the homeowner says no when he calls.',
      start: S.saturday,
      contact: estimateOut('luis', undefined, { fields: { roof_age: '10-20 years' } }),
      events: [{ at: at(15, 11, 5) - S.saturday, type: 'tag_added', value: 'estimate-declined', label: 'estimate-declined, added by Luis after the call' }],
      expect: { outcome: 'goal', visits: ['amount:else', 'notify-blank', 'goto-seq', 'sms-walk', 'email-finance', 'whose-call:0', 'task-call-luis', 'goto-call', 'goal', 'decision:1', 'lost'], tags: ['estimate-declined'] },
    },
    {
      id: 'dnd',
      label: 'Texts off, card closed by hand',
      summary: 'Replied STOP to an earlier text, so only the email goes out. After the follow-up call Maya drags the card to Lost instead of adding the tag.',
      start: S.dnd,
      contact: estimateOut('maya', 9600, { dnd: { sms: true }, fields: { service_needed: 'Storm damage' } }),
      events: [{ at: at(11, 14, 30) - S.dnd, type: 'opportunity_lost', label: 'Maya drags the card to Lost: they went with another roofer' }],
      expect: { outcome: 'completed', visits: ['email-finance', 'task-call-maya', 'goal', 'decision:else', 'note-hand'], skips: ['sms-walk', 'sms-questions', 'sms-close'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Estimate Amount', key: 'estimate_amount', type: 'Number', note: 'Filled in by the estimator when the estimate goes out. A plain number, because 05 puts it in Slack and the job sheet. Copied to the card value and kept out of customer messages.' },
    ],
    tags: [
      { name: 'estimate-signed', note: 'Added by the estimator when the signed estimate comes back. Meets the Goal Event.' },
      { name: 'estimate-declined', note: 'Added by the estimator when the homeowner says no. Meets the Goal Event.' },
      { name: 'estimate-no-decision', note: 'No answer after two weeks. A list for 07 · Database Reactivation. Cleared when a new estimate starts.' },
    ],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
      { name: 'Warranty Link', key: 'warranty_link', value: 'harborpine.example/warranty' },
    ],
  },
  build: [
    {
      title: 'Agree how an estimate closes',
      body: 'I agreed two rules with the estimators. When an estimate goes out, fill in Estimate Amount and move the card to Estimate Sent. When the homeowner decides, add a tag, estimate-signed or estimate-declined, instead of dragging the card. The Goal Event listens for the tag, so the tag is also what stops the messages.',
    },
    {
      title: 'Trigger on the stage they already move',
      body: 'Pipeline Stage Changed, filtered to In Pipeline Roofing Sales, Pipeline Stage Estimate Sent, Status Open. Moving the card is already part of the estimator\'s day, so the follow-up starts without a new habit. GHL\'s help doc says the trigger fires on manual moves, and again when a card comes back to the stage, so the settings below decide what a second move does.',
    },
    {
      title: 'Settings that decide behavior',
      body: 'Stop on Response on, so a reply to any message from this workflow, text or email, hands the conversation to the estimator. The workflow Time Window is Monday to Saturday, 9 AM to 6 PM, contact time zone: inside the 8 AM to 8 PM texting rule and closed on Sunday. It holds only the texts and emails. Re-entry and multiple opportunities are on, because 07 brings stalled homeowners back on a new card and that estimate needs a follow-up too. GHL never re-enters a contact who is still in the workflow, so a card dragged back and forward mid-sequence sends nothing twice.',
    },
    {
      title: 'Start clean, copy the amount once',
      body: 'With re-entry on, the first step removes the three decision tags, so an old estimate-signed cannot turn this estimate into a Won. Update Opportunity then sets the card value to {{contact.estimate_amount}}, which GHL\'s Update Opportunity guide allows with a merge field. An If/Else in front catches a blank amount and alerts the estimator, and a Go To puts that contact back on the same sequence.',
    },
    {
      title: 'Give each touch one job',
      body: 'A walk-through offer, financing through the Financing trigger link, a text that answers the three questions homeowners always ask (how long, soft decking, warranty), a call task on day seven, then a polite close. No message quotes the price. Estimates get revised, and an automated email with last week\'s number does more harm than none. Every text is about the estimate they asked for, with no offers, so it falls under the service consent from the form, not the offers box 07 needs.',
    },
    {
      title: 'One Goal Event, two criteria',
      body: 'GHL allows one Goal Event per workflow, so it holds both tags and either one meets it. A tag added during any wait pulls the contact straight to the decision. I left out the User Replied goal type: an estimator\'s own text would send the contact to the decision step, which marks an open card Abandoned. If Harbor & Pine sent estimates as GHL Documents & Contracts, the Document Status goal (Signed) could replace the tag. They use their own estimating software, so the estimator\'s tag is the signal.',
    },
    {
      title: 'Let the decision drive the pipeline',
      body: 'The final If/Else sets Won, which fires 05 · Won to Job Hand-Off, or Lost, or, if the card is still open, Abandoned with the estimate-no-decision tag. Abandoned, not Lost, because they never said no, so reporting counts only real losses. A card someone already closed by hand goes to the None branch and keeps the status that person set.',
    },
    {
      title: 'Test, publish, hand off',
      body: 'Five test contacts, one per scenario above, on cards moved by hand, including a Saturday-evening move to confirm the texts wait until Monday. Checked in Execution Logs and Enrollment History before publishing. The close-out rules went on a one-page SOP pinned next to the estimate template.',
    },
  ],
  edgeCases: [
    { title: 'Estimate goes out Saturday evening', body: 'The text falls outside the Time Window, so GHL holds it until Monday at 9 AM. Nothing goes out on Sunday. The waits after it count from when it actually sent, so the rest of the sequence moves back too.' },
    { title: 'They reply with a question', body: 'Stop on Response ends the workflow on any reply to its messages, text or email, and the estimator picks up the conversation. The card stays open at Estimate Sent, and a tag added later does nothing because the workflow has let go. The SOP says so: once they have replied, the estimator marks the card Won or Lost by hand, and Won fires 05 the same way.' },
    { title: 'Yes or no on the phone', body: 'The estimator adds estimate-signed or estimate-declined. The Goal Event pulls the contact out of whatever wait they are in, so nobody gets "should I close your file?" after they have signed, and the card goes Won or Lost.' },
    { title: 'Card dragged instead of tagged', body: 'Marking the card Won by hand fires 05, whose first step removes the contact from this workflow. Dragging it to Lost does not stop the remaining messages, and GHL\'s Goal Event guide lists no opportunity-status goal, which is why the rule is the tag. The decision step still checks the card: if it is no longer open, the workflow adds a note and leaves Lost alone instead of overwriting it with Abandoned.' },
    { title: 'Second estimate for the same homeowner', body: 'A revised quote, a repeat customer, or a stalled lead that 07 brought back on a new card. Re-entry and multiple opportunities are on, so the new card gets its own two weeks. The first step clears the old decision tags, so last year\'s estimate-signed cannot mark this one Won. The one gap: if one homeowner has two open estimates at once, a tag closes both runs, so the estimator marks those cards by hand.' },
    { title: 'No text consent, or SMS DND', body: 'The account rule is that anyone who has not agreed to texts is on SMS DND: 01 switches it on for a form lead who did not tick the box, and the office does it for anyone who says no on the phone. So this workflow relies on DND instead of repeating a consent branch. GHL does not send a text to a contact on SMS DND, and the test list checks in Execution Logs that the run goes on to the email and the call task. The decision step still closes the card after two weeks.' },
  ],
  qa: [
    'Move test cards to Estimate Sent at 4:30 PM on a weekday and on Saturday afternoon: the first text shows as waiting in Execution Logs and sends at 9 AM on the next open day, never on a Sunday',
    'Reply to the text on one contact and to the email on another: both leave the workflow, and the conversation sits with the assigned estimator',
    'Add estimate-signed during a wait on one contact and estimate-declined on another: both jump to the goal, one card goes Won and 05 starts, the other goes Lost',
    'Let one run the full two weeks: card Abandoned, tag estimate-no-decision, nothing sent after the close-out text',
    'Mark a card Won by hand mid-sequence: 05 starts and this workflow\'s Enrollment History shows "Removed by External Workflow Action". Drag another to Lost: at the end it is still Lost, with a note',
    'Contact on SMS DND with a blank Estimate Amount: the texts show as skipped, the estimator gets the blank-amount alert, and the email and the task still happen',
    'Contact with an old estimate-signed tag and a second card: the tag is removed at the start and the new card gets its own run',
    'One test estimate for Maya and one for Luis: each day-seven call task goes to the estimator who owns the contact',
    'Every merge field renders on a real phone and in Gmail and Outlook, and the financing click shows on the contact',
  ],
  snippets: [
    {
      title: 'Goal Event settings',
      language: 'text',
      code: goalSetup,
      note: 'One Goal Event per workflow is the limit, so both tags go in the same one. The If/Else right after it tells them apart.',
    },
    {
      title: 'Close-out rules for the estimators (SOP)',
      language: 'text',
      code: estimatorSop,
      note: 'Pinned next to the estimate template, so the rule is where the work happens.',
    },
  ],
  features: ['Pipeline Stage Changed', 'Remove Contact Tag', 'If/Else', 'Update Opportunity', 'Internal Notification', 'Go To', 'Wait', 'Send SMS', 'Send Email', 'Trigger Links', 'Add Task', 'Goal Event', 'Add Contact Tag', 'Add Note', 'Stop on Response', 'Time Window'],
};
