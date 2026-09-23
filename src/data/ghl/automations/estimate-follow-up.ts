import type { Automation, Contact } from '@/lib/ghl/types';
import { env } from '../business';

const DAY = 1440;

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** First name of the contact's assigned estimator, for task logs. */
const rep = (c: Contact) => (c.assignedTo && env.users[c.assignedTo]?.first_name) || 'the assigned estimator';

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

export const estimateFollowUp: Automation = {
  id: 'estimate-follow-up',
  number: '04',
  name: 'Estimate follow-up',
  kicker: 'Sales',
  tagline: 'Two weeks of useful follow-up after every estimate. One reply or one tag ends it, and the pipeline shows what actually happened.',
  problem:
    'Estimates went out and then nobody followed up. The estimators meant to, but by the next morning they were up on another roof. Homeowners comparing three quotes went with whoever stayed in touch, and the pipeline filled with cards stuck at Estimate Sent.',
  solution:
    'Moving the card to Estimate Sent starts two weeks of follow-up in the estimator\'s name: an offer to walk through the estimate, a financing email, a text that answers the usual questions, a call task, and a polite "should I close your file?". Texts and emails only go out Monday to Saturday, 9 to 6. Any reply hands the conversation to the estimator. One tag from the estimator, signed or declined, ends the sequence and marks the card Won or Lost. If nobody decides in two weeks, the card is marked Abandoned and tagged for a later reactivation campaign.',
  workflow: {
    name: '04 · Sales · Estimate Follow-Up',
    folder: 'Sales',
    triggers: [
      {
        title: 'Pipeline Stage Changed',
        filters: ['In pipeline is Roofing Sales', 'Pipeline stage is Estimate Sent', 'Status is Open'],
        label: 'Pipeline Stage Changed (Estimate Sent)',
      },
    ],
    settings: {
      allowReEntry: false,
      stopOnResponse: true,
      allowMultipleOpportunities: false,
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
        'Re-entry off: Pipeline Stage Changed fires again when a card moves back and forward, and that must not restart the texts.',
        'Allow multiple Opportunities off: one follow-up per homeowner, even with an older card on file.',
      ],
    },
    steps: [
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
                  return { effect: { opportunity: { value: amount } }, log: `Card value set to $${amount} from Estimate Amount.` };
                },
              },
              {
                id: 'wait-2h',
                kind: 'wait',
                title: 'Wait',
                label: 'Reading time',
                mode: 'time',
                minutes: 120,
                summary: 'Two hours, so the estimate email has landed before the first text arrives.',
              },
              {
                id: 'sms-walk',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Walk-through offer',
                summary: 'From the estimator who wrote the estimate. An offer, not a push. Opt-out line included.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, it's {{user.first_name}} from Harbor & Pine Roofing. Your estimate is in your inbox. Happy to walk you through it line by line, on a quick call or at your kitchen table. What time suits you? Reply STOP to opt out.",
                },
              },
              { id: 'wait-2d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days to read it and talk it over at home.' },
              {
                id: 'email-finance',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Financing',
                summary: 'Financing through a trigger link, so a click shows who is weighing the cost. No price in the email: estimates get revised, and last week\'s number in an automated email does more harm than none.',
                message: {
                  channel: 'email',
                  subject: 'Your roof estimate, and spreading the cost',
                  body: 'Hi {{contact.first_name}},\n\nThanks again for having us out to look at your roof. A new roof is a big purchase, and plenty of homeowners would rather pay for it monthly than all at once. You can see our financing options, and what a monthly payment could look like, here: {{trigger_link.financing}}\n\nIf anything in the estimate is unclear, reply to this email or call the office at {{custom_values.office_phone}}, and I will go through it with you.\n\n{{user.name}}\nHarbor & Pine Roofing',
                },
              },
              { id: 'wait-3d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 3 * DAY, summary: 'Three days.' },
              {
                id: 'sms-questions',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Common questions',
                summary: 'Answers the questions before they have to ask. The warranty link is a custom value, so it changes in one place.',
                message: {
                  channel: 'sms',
                  body: 'Hi {{contact.first_name}}, {{user.first_name}} again. Three things people usually ask at this stage: how long the job takes, what happens if we find soft decking, and what the warranty covers ({{custom_values.warranty_link}}). Happy to answer those or anything else.',
                },
              },
              { id: 'wait-2d-call', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days.' },
              {
                id: 'task-call',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Call about the estimate',
                summary: 'For the assigned estimator, due today. A week in, a person calls: the messages back the estimator up, they do not replace the call.',
                run: ({ contact }) => {
                  const amount = contact.fields.estimate_amount;
                  return { log: `Task for ${rep(contact)}, due today: call ${contact.firstName} about the ${amount ? `$${amount} ` : ''}estimate. If they decide on the call, add estimate-signed or estimate-declined.` };
                },
              },
              { id: 'wait-5d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 5 * DAY, summary: 'Five days.' },
              {
                id: 'sms-close',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Close the file?',
                summary: 'Makes it easy to say no, which is still an answer. A reply here stops the workflow like any other.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, should I close out your roof estimate for now? No problem either way. If you'd still like to go ahead, or talk it through, just reply here. Thanks, {{user.first_name}}",
                },
              },
              { id: 'wait-2d-end', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days for a last answer before the decision.' },
              {
                id: 'goal',
                kind: 'goal',
                title: 'Goal Event',
                label: 'Estimate decided',
                event: 'tag_added',
                summary: 'Contact Tag added: estimate-signed or estimate-declined. One Goal Event with two criteria, and either one pulls the contact here from any wait. No decision after two weeks: Continue anyway.',
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
                        summary: 'Status Lost. The estimator adds the lost reason on the card, which feeds the lost-deal report.',
                        effect: { opportunity: { status: 'lost' } },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: 'No decision',
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
                      summary: 'Marks them for a later reactivation campaign (07 · Database Reactivation).',
                      effect: { addTags: ['estimate-no-decision'] },
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
              summary: 'In-app and email to the assigned estimator the minute the card moves, so the gap is fixed the same day.',
              message: {
                channel: 'internal',
                to: '{{user.name}} (assigned user)',
                subject: 'Estimate Amount is blank: {{contact.name}}',
                body: 'The follow-up has started, but this card has no value, so the pipeline total is short. Fill in Estimate Amount on the contact and the value on the card.',
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
      expect: { outcome: 'goal', visits: ['value', 'sms-walk', 'email-finance', 'goal', 'decision:0', 'won'], tags: ['estimate-signed'] },
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
      label: 'Never decides',
      summary: 'A $23,400 tear-off. Gets every touch and never answers. After two weeks the card is marked Abandoned.',
      start: S.quiet,
      contact: estimateOut('maya', 23400),
      events: [],
      expect: { outcome: 'completed', visits: ['sms-close', 'task-call', 'goal', 'decision:else', 'abandon', 'tag-nd'], tags: ['estimate-no-decision'] },
    },
    {
      id: 'saturday',
      label: 'Sent Saturday evening, amount blank',
      summary: 'Luis moves the card from his truck at 4:50 PM on Saturday and skips the amount. He gets an alert at once, and the first text waits for Monday 9 AM.',
      start: S.saturday,
      contact: estimateOut('luis'),
      events: [{ at: at(9, 8, 10) - S.saturday, type: 'tag_added', value: 'estimate-signed', label: 'estimate-signed, added by Luis after the signed estimate came back' }],
      expect: { outcome: 'goal', visits: ['amount:else', 'notify-blank', 'goto-seq', 'sms-walk', 'goal', 'decision:0', 'won'] },
    },
    {
      id: 'dnd',
      label: 'Texts turned off, says no on the call',
      summary: 'Opted out of texts earlier (SMS DND), so only the email goes out. Tells Maya on the day-seven call that they went with another roofer.',
      start: S.dnd,
      contact: estimateOut('maya', 9600, { dnd: { sms: true }, fields: { service_needed: 'Storm damage', sms_consent: 'No' } }),
      events: [{ at: at(10, 15, 5) - S.dnd, type: 'tag_added', value: 'estimate-declined', label: 'estimate-declined, added by Maya after the call' }],
      expect: { outcome: 'goal', visits: ['email-finance', 'task-call', 'goal', 'decision:1', 'lost'], skips: ['sms-walk', 'sms-questions'], tags: ['estimate-declined'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Estimate Amount', key: 'estimate_amount', type: 'Monetary', note: 'Filled in by the estimator when the estimate goes out. Copied to the card value and kept out of customer messages.' },
    ],
    tags: [
      { name: 'estimate-signed', note: 'Added by the estimator when the signed estimate comes back. Meets the Goal Event.' },
      { name: 'estimate-declined', note: 'Added by the estimator when the homeowner says no. Meets the Goal Event.' },
      { name: 'estimate-no-decision', note: 'No answer after two weeks. A list for 07 · Database Reactivation later.' },
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
      body: 'I agreed two rules with the estimators. When an estimate goes out, fill in Estimate Amount and move the card to Estimate Sent. When the homeowner decides, add a tag, estimate-signed or estimate-declined, instead of dragging the card. The Goal Event listens for the tag, so the tag is also what stops the texts.',
    },
    {
      title: 'Trigger on the stage they already move',
      body: 'Pipeline Stage Changed, filtered to Roofing Sales, stage Estimate Sent, status Open. Moving the card is already part of the estimator\'s day, so the follow-up starts without a new habit. GHL\'s help doc says the trigger fires on manual moves and fires again if a card moves back to the stage, which is why re-entry is off.',
    },
    {
      title: 'Settings that decide behavior',
      body: 'Stop on Response on, so a reply to any message from this workflow, text or email, hands the conversation to the estimator. The workflow Time Window is Monday to Saturday, 9 AM to 6 PM: inside the 8 AM to 8 PM texting rule and closed on Sunday. It holds only the texts and emails; the task and the pipeline updates run on time.',
    },
    {
      title: 'Copy the amount once',
      body: 'Update Opportunity sets the card value to {{contact.estimate_amount}}, so the pipeline total is in real dollars and nobody types the number twice. An If/Else in front catches a blank amount and alerts the estimator, and a Go To puts that contact back on the same sequence.',
    },
    {
      title: 'Give each touch one job',
      body: 'A walk-through offer, financing through a trigger link, a text that answers the three questions homeowners always ask, a call task for the estimator on day seven, then a polite close. No message quotes the price. Estimates get revised, and an automated email with last week\'s number does more harm than none.',
    },
    {
      title: 'One Goal Event, two criteria',
      body: 'GHL allows one Goal Event per workflow, so it holds both tags and either one meets it. A tag added during any wait pulls the contact straight to the decision. If Harbor & Pine sent estimates as GHL Documents & Contracts, the Document Status goal (Signed) could replace the tag. They use their own estimating software, so the estimator\'s tag is the signal.',
    },
    {
      title: 'Let the decision drive the pipeline',
      body: 'The final If/Else sets Won, which fires 05 · Won to Job Hand-Off, or Lost, or Abandoned with the estimate-no-decision tag. Abandoned, not Lost, because they never said no. Reporting counts real losses, and 07 can try the rest again next season.',
    },
    {
      title: 'Test, publish, hand off',
      body: 'Five test contacts, one per scenario above, on cards moved by hand, including a Saturday-evening move to confirm the texts wait until Monday. Checked in Execution Logs and Enrollment History before publishing. The two close-out rules went on a one-page SOP pinned next to the estimate template.',
    },
  ],
  edgeCases: [
    { title: 'Estimate goes out Saturday evening', body: 'The text falls outside the Time Window, so GHL holds it until Monday at 9 AM. Nothing goes out on Sunday. The waits after it count from when it actually sent, so the rest of the sequence moves back too.' },
    { title: 'They reply with a question', body: 'Stop on Response ends the workflow on any reply to its messages, text or email, and the estimator picks up the conversation. They have left the sequence, so if they sign later the estimator sets the card to Won by hand, which fires 05 the same way.' },
    { title: 'Yes or no on the phone', body: 'The estimator adds estimate-signed or estimate-declined. The Goal Event pulls the contact out of whatever wait they are in, so nobody gets "should I close your file?" after they have signed, and the card goes Won or Lost.' },
    { title: 'Estimate Amount left blank', body: 'The If/Else sends the contact down the None branch. The estimator gets an alert the minute the card moves, and the Go To puts the contact back on the normal sequence. No customer message uses the amount, so a blank never shows up in front of the homeowner.' },
    { title: 'Texts turned off', body: 'A contact on SMS DND has every text skipped and logged, while the email and the day-seven call task still happen. The close-out question is a text, so they never get it, but the decision step still closes the card after two weeks.' },
    { title: 'Revised estimate', body: 'Moving the card back to Inspected and forward again fires the trigger again, but re-entry is off, so the homeowner does not get a second round of texts. A revised estimate gets a personal call from the estimator.' },
  ],
  qa: [
    'Move a test card to Estimate Sent at 4:30 PM on a weekday: the first text shows as waiting in Execution Logs and sends at 9 AM the next day',
    'Move one on Saturday afternoon: nothing sends on Sunday',
    'Reply to the text, then to the email on a second contact: both leave the workflow',
    'Add estimate-signed during a wait: the contact jumps to the goal, the card goes Won and 05 starts',
    'Add estimate-declined: the card goes Lost and nothing else is sent',
    'Let one run the full two weeks: card Abandoned, tag estimate-no-decision, nothing sent after the close-out text',
    'Leave Estimate Amount blank: the estimator gets the alert, the card value stays empty, the sequence runs normally',
    'Contact with SMS DND: the texts show as skipped, the email and the task still happen',
  ],
  snippets: [
    {
      title: 'Goal Event settings',
      language: 'text',
      code: 'Action name:    Estimate decided\nType of goal:   Contact Tag · Added · estimate-signed\n                Contact Tag · Added · estimate-declined\n                (either one meets the goal)\nIf contact reaches this goal without meeting conditions:\n                Continue anyway',
      note: 'One Goal Event per workflow is the limit, so both tags go in the same one. The If/Else right after it tells them apart.',
    },
    {
      title: 'Close-out rules for the estimators (SOP)',
      language: 'text',
      code: 'When an estimate goes out:\n  1. Fill in Estimate Amount on the contact.\n  2. Move the card to Estimate Sent. The follow-up starts on its own.\n\nWhen the homeowner decides:\n  Signed   -> add the tag estimate-signed. The card goes Won and production hears about it.\n  Said no  -> add the tag estimate-declined. The card goes Lost. Add the lost reason on the card.\n\nIf they have replied to any follow-up message, the workflow already handed them to you.\nSet the card to Won or Lost yourself.',
      note: 'Pinned next to the estimate template, so the rule is where the work happens.',
    },
  ],
  features: ['Pipeline Stage Changed', 'If/Else', 'Update Opportunity', 'Internal Notification', 'Go To', 'Wait', 'Send SMS', 'Send Email', 'Trigger Link', 'Add Task', 'Goal Event', 'Add Contact Tag', 'Stop on Response', 'Time Window'],
};
