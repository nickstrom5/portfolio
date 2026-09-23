import type { Automation, Contact } from '@/lib/ghl/types';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Enrollment pipeline, in order. Update Opportunity only moves a card forward unless told otherwise. */
const STAGES = business.pipeline.stages;
const CHECKOUT = STAGES.indexOf('Checkout Started');
const CUSTOMER = STAGES.indexOf('Customer');
/** The course card's stages. Applied, Call Booked and Coaching Client belong to the separate coaching card 05 makes. */
const COURSE_STAGES = STAGES.slice(0, CUSTOMER + 1);
const COACHING_LIST = STAGES.slice(CUSTOMER + 1).join(', ').replace(/, ([^,]*)$/, ' or $1');
/** Both Finds in this workflow use the same filters. */
const FIND_LABEL = `Latest opportunity where Pipeline is Enrollment, Stage is not ${COACHING_LIST}, and Status is Open`;
const COURSE = 'Career Pivot Blueprint';

const userName = (key: string) => business.env.users[key]?.name ?? key;

/**
 * A workshop registrant: 01 · Workshop · Registration and Reminders gave
 * them a course card in Enrollment at Registered, and moves it to Attended
 * 75 minutes after the live start (or two hours after a replay click).
 */
const registrant = (stage: 'Registered' | 'Attended', fields: Contact['fields']): Partial<Contact> => ({
  opportunity: { pipeline: 'Enrollment', stage, status: 'open', name: 'Marcus Lee · Workshop' },
  fields,
});

/** Name and postal address under every email: these emails sell, so CAN-SPAM applies. */
const signature = '{{user.name}}\n{{location.name}}, {{location.full_address}}';

const faqSubject = 'Questions before you join, {{contact.first_name}}?';

const faqBody = `Hi {{contact.first_name}},

You started checkout for {{custom_values.course_name}}, but the order did not go through. If you stopped on purpose, that is fine. Here are straight answers to what people ask before they join.

Is it right for me?
It is built for people with years of experience in one field who want to move into another. It is not a job placement service, and nobody can promise you a new job or a salary.

How much time does it take?
It is self-paced, so it fits around a full-time job. The first lesson takes about 12 minutes. Most of the time goes into the exercises: mapping the skills you already have, telling that story to a new field, and a 90-day plan for the move.

What if it is not for me?
It comes with a {{custom_values.refund_policy}}. Email {{custom_values.support_email}} within the guarantee period for a full refund.

Can I pay over time?
Yes. It is {{custom_values.course_price}} once, or {{custom_values.payment_plan}}. The plan costs a little more in total, and the checkout page shows both.

Your checkout: {{trigger_link.checkout}}

Or reply with your question. A person reads every reply.

${signature}`;

const lastBody = `Hi {{contact.first_name}},

This is my last email about {{custom_values.course_name}}. Your checkout is here if you want it: {{trigger_link.checkout}}

There is no deadline and no countdown. I just do not want these piling up in your inbox.

The short version: {{custom_values.course_price}} once or {{custom_values.payment_plan}}, with a {{custom_values.refund_policy}}.

If the timing is wrong, the free workshop runs every Thursday at 7 PM Central, and you are welcome back any week.

${signature}`;

const settingsSheet = `Trigger       Order Form Submission
  In Funnel/Website   The Career Pivot Plan
  Page Is             Blueprint Checkout
  Product Is          Career Pivot Blueprint
  Submission Type     Opt-In      step 1 submitted, paid or not

Not this one: Order Submitted fires only on a completed payment.
It starts 03 · Students · Course Onboarding, whose first step removes
the contact from 02.

Goal Event    Payment Received
  Product             Career Pivot Blueprint   one-time and plan price
  Payment Status      Success                  a declined card does not count
  If Contact Reaches This Goal Without Meeting Conditions:
                      End this workflow

Opportunities Find Opportunity    Latest, Pipeline is Enrollment, Status is Open,
                                  Stage is not Applied, Call Booked or Coaching Client
                                  (the same filters at the top and after the goal)
              Create Opportunity  Checkout Started, Duplicate Opportunity on,
                                  then Go To the tag, never back to Find
              Sub-Account Settings › Objects › Opportunities:
                                  Allow Multiple Opportunities per Contact on

Settings      Allow Re-entry on · Stop on Response off
              Timezone: Contact · Time Window 8:00 AM to 8:00 PM, every day
              Sender Details blank, so email goes from the assigned user`;

export const cartRecovery: Automation = {
  id: 'cart-recovery',
  number: '02',
  name: 'Checkout recovery',
  kicker: 'Sales',
  tagline:
    'Step 1 of the checkout starts it, paid or not. Buyers never hear from it. Everyone else gets two honest emails, one text only if they agreed to marketing texts, and a clean exit the moment they pay.',
  problem:
    'After each Thursday workshop, some people typed their name and email into the checkout and stopped at the card step. We had their details and did nothing with them. Some only had a question, usually about refunds or the payment plan, and nobody answered it.',
  evidence: {
    text: 'GHL separates its two order triggers by payment: Order Submitted is “tied to an actual purchase or completed transaction”, while Order Form Submission “doesn’t care if there was payment or not.” Only the second one can see a checkout that never got paid.',
    source: 'HighLevel Help Center, “Workflow Trigger - Order Submitted vs Order Form Submission”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000004303-workflow-trigger-order-submitted-vs-order-form-submission',
  },
  solution:
    'Submitting step 1 of the two-step order form starts the workflow, whether or not payment follows. It moves their course card to Checkout Started, then waits an hour, so someone who is just typing in their card number never gets a nudge. After that: an FAQ email with the refund policy and the payment plan, a text only for people who ticked the offers box, and a last email with no countdown. A Payment Received goal pulls a buyer out at any point and marks the card Customer, Won, the same change 03 · Students · Course Onboarding makes on the purchase. Anyone who never pays ends tagged cart-abandoned.',
  workflow: {
    name: '02 · Sales · Checkout Recovery',
    folder: 'Sales',
    triggers: [
      {
        title: 'Order Form Submission',
        filters: ['In Funnel/Website is The Career Pivot Plan', 'Page Is Blueprint Checkout', 'Product Is Career Pivot Blueprint', 'Submission Type is Opt-In'],
        label: 'Order Form Submission (step 1)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      timeWindow: { start: '08:00', end: '20:00', days: ALL_WEEK },
      exits: [
        {
          event: 'order_submitted',
          by: 'Paying fires 03 · Students · Course Onboarding, whose first step is Remove from Workflow: 01 · Workshop · Registration and Reminders and 02 · Sales · Checkout Recovery, and whose next step removes checkout-started and cart-abandoned. Whichever of 02’s goal and 03 gets there first, the card ends at Customer, Won.',
        },
        {
          event: 'survey_submitted',
          value: 'Coaching Application',
          by: 'A coaching application that scores 70 or more fires 05 · Sales · Coaching Application, which removes the contact from this workflow and takes off checkout-started. Devon talks to them about coaching; cart nudges for the course would talk over him.',
        },
      ],
      notes: [
        "Time Window (Specific Time) 8 AM to 8 PM in the contact's time zone, every day: it holds both emails and the text overnight, and GHL does not hold internal steps like the card update or the tag. The text's wait also has a 10 AM to 7 PM Advance Window, because 8 AM on a Saturday is legal but not kind.",
        'Stop on Response off: a reply is usually a question about refunds or the plan, and Devon answers it from Conversations. The run has to keep going so a non-buyer still ends tagged cart-abandoned, and the one email left after the text reads fine after a conversation. STOP still switches on SMS DND by itself.',
        'Allow Re-entry on: someone who abandons again after a later workshop gets the recovery again. GHL does not let a contact re-enter while still active, so a double submit of step 1 changes nothing.',
        'One Goal Event per workflow is a GHL limit. It sits near the end of the text path. GHL moves a buyer to it from wherever they are waiting, email-only path included, and a non-buyer on that path reaches it through the Go To.',
        '03 · Students · Course Onboarding runs on the same payment and removes the contact from 02 in its first step. The steps after this goal write exactly what 03 writes (both cart tags off; the course card at Customer, Won, $497, named "{{contact.name}} · Career Pivot Blueprint"), so the contact ends up the same whichever workflow gets there first.',
        'A coaching applicant who scores under 70 stays in 02: 05’s "not yet" email recommends the same course, so the two do not disagree. At 70 or more, 05 takes them out of 02 (see the exits).',
        'Texts need SMS consent (offers). Someone who ticked only the offers box on the workshop form has SMS DND from 01 (tag sms-off-no-consent), and 02 does not switch it off: that would also let 01’s reminder texts through, which they left unticked. They get the emails and no text. If they tick the texts box on the coaching application, 05 lifts the DND.',
        'Sender Details left blank: GHL then sends automated email from the assigned user, and 02 assigns Devon before the first email, so the From line matches the {{user.name}} signature. Every email ends with the business name and {{location.full_address}}, and Include Unsubscribe Link (Business Profile › General) stays on.',
        'One opportunity model across the case: the course card moves Registered, Attended, Checkout Started, Customer, and 03 marks it Won at Customer for $497; a coaching deal is a separate card that 05 creates at Applied, then Call Booked and Coaching Client. This workflow moves the course card to Checkout Started, or creates it there, and on payment writes what 03 writes. Allow Multiple Opportunities per Contact is on in Sub-Account Settings › Objects › Opportunities, so a contact whose only card is closed or a coaching deal still gets a course card here.',
      ],
    },
    steps: [
      {
        id: 'find-opp',
        kind: 'ifelse',
        title: 'Find Opportunity',
        label: 'Open course card?',
        branches: [
          {
            label: 'Opportunity Found',
            when: { type: 'any', label: FIND_LABEL, of: COURSE_STAGES.map((stage) => ({ type: 'opportunity' as const, stage, status: 'open' as const })) },
            nodes: [
              {
                id: 'opp-checkout',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Checkout Started',
                summary:
                  'Enrollment › Checkout Started, Opportunity Value $497, on the card Find just picked. Status is not in the step, so this can never reopen a card. Allow Opportunity to Move to Any Previous Stage stays off, so a card that is further along never goes backward.',
                run: ({ contact }) => {
                  const stage = contact.opportunity?.stage ?? '';
                  if (STAGES.indexOf(stage) > CHECKOUT) return { log: `The card is already at ${stage}. This step only moves cards forward, so it stays there.` };
                  if (stage === 'Checkout Started') return { effect: { opportunity: { value: 497 } }, log: 'Already at Checkout Started. Opportunity Value $497.' };
                  return { effect: { opportunity: { stage: 'Checkout Started', value: 497 } }, log: `Enrollment › Checkout Started, moved from ${stage || 'no stage'}. Opportunity Value $497.` };
                },
              },
              {
                id: 'tag-started',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'checkout-started',
                summary: 'Marks everyone who is in checkout recovery right now. Removed the moment they pay, here or in 03, or when 05 takes a qualified applicant out.',
                effect: { addTags: ['checkout-started'] },
              },
              {
                id: 'assign',
                kind: 'action',
                action: 'assign_user',
                title: 'Assign To User',
                label: 'Devon',
                summary:
                  'Devon Brooks, the enrollment advisor, with Only Apply to Unassigned Contacts on. He signs the nudges, the emails go from his address, and replies land in his Conversations inbox.',
                run: ({ contact }) =>
                  contact.assignedTo
                    ? { log: `Already assigned to ${userName(contact.assignedTo)}, so the owner stays the same.` }
                    : { effect: { assignTo: 'devon' }, log: 'Assigned to Devon Brooks, the enrollment advisor.' },
              },
              {
                id: 'wait-1h',
                kind: 'wait',
                title: 'Wait',
                mode: 'time',
                minutes: 60,
                summary: 'One hour. Someone who is still typing in their card details pays in the meantime, meets the goal and never gets a nudge.',
              },
              {
                id: 'email-faq',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Questions before you join',
                summary: 'Honest answers to the usual questions, with the refund policy, the payment plan and the checkout trigger link. No discount, no countdown. Worded so it also fits someone whose card was declined.',
                message: { channel: 'email', subject: faqSubject, body: faqBody },
              },
              {
                id: 'wait-text',
                kind: 'wait',
                title: 'Wait',
                mode: 'time',
                minutes: DAY,
                window: { start: '10:00', end: '19:00', days: ALL_WEEK },
                summary: 'One day, then its Advance Window only resumes between 10 AM and 7 PM, inside the 8 AM to 8 PM Time Window, so a text never lands at 8 AM on a Saturday.',
              },
              {
                id: 'can-text',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Can we text?',
                branches: [
                  {
                    label: 'Offers consent',
                    when: {
                      type: 'all',
                      label: 'SMS consent (offers) is Yes, and the contact is not DND for SMS',
                      of: [
                        { type: 'field', key: 'sms_marketing_consent', op: 'eq', value: 'Yes' },
                        { type: 'not', of: { type: 'dnd', channel: 'sms' } },
                      ],
                    },
                    nodes: [
                      {
                        id: 'sms-nudge',
                        kind: 'action',
                        action: 'send_sms',
                        title: 'Send SMS',
                        label: 'One text',
                        summary: 'The only text in this workflow. From the assigned user, one link, and the opt-out line because it is marketing.',
                        message: {
                          channel: 'sms',
                          body: "Hi {{contact.first_name}}, it's {{user.first_name}} from {{location.name}}. You started checkout for {{custom_values.course_name}}. Questions? Just reply. There's also a plan: {{custom_values.payment_plan}}. Checkout: {{trigger_link.checkout}} Reply STOP to opt out.",
                        },
                      },
                      { id: 'wait-last', kind: 'wait', title: 'Wait', mode: 'time', minutes: DAY, summary: 'One day.' },
                      {
                        id: 'email-last',
                        kind: 'action',
                        action: 'send_email',
                        title: 'Send Email',
                        label: 'Last note',
                        summary: 'Says it is the last email, with no fake deadline. The email-only path joins here.',
                        message: { channel: 'email', subject: 'Last note about {{custom_values.course_name}}', body: lastBody },
                      },
                      {
                        id: 'wait-grace',
                        kind: 'wait',
                        title: 'Wait',
                        mode: 'time',
                        minutes: DAY,
                        summary: 'One more day, so a purchase prompted by the last email still counts as recovered.',
                      },
                      {
                        id: 'tag-abandoned',
                        kind: 'action',
                        action: 'add_tag',
                        title: 'Add Contact Tag',
                        label: 'cart-abandoned',
                        summary:
                          'Only someone who never paid reaches this step: a payment skips past it straight to the goal. For a Smart List and the recovery report, never for more cart messages. The course card stays Open at Checkout Started, so a later checkout moves the same card instead of making a second one.',
                        effect: { addTags: ['cart-abandoned'] },
                      },
                      {
                        id: 'goal-paid',
                        kind: 'goal',
                        title: 'Goal Event',
                        label: 'Payment Received',
                        event: 'payment',
                        value: [497, 179],
                        ifNotMet: 'end',
                        summary: 'Payment Received, product Career Pivot Blueprint (either price), Payment Status Success. Reached without paying: End this workflow.',
                      },
                      {
                        id: 'untag',
                        kind: 'action',
                        action: 'remove_tag',
                        title: 'Remove Contact Tag',
                        label: 'Cart tags',
                        summary: 'Removes checkout-started, and cart-abandoned in case an earlier checkout left it, as 03 does. No receipt or welcome here: 03 starts on the purchase itself.',
                        effect: { removeTags: ['checkout-started', 'cart-abandoned'] },
                      },
                      {
                        id: 'find-paid',
                        kind: 'ifelse',
                        title: 'Find Opportunity',
                        label: 'Card to close as Won',
                        branches: [
                          {
                            label: 'Opportunity Found',
                            when: { type: 'any', label: FIND_LABEL, of: COURSE_STAGES.map((stage) => ({ type: 'opportunity' as const, stage, status: 'open' as const })) },
                            nodes: [
                              {
                                id: 'opp-customer',
                                kind: 'action',
                                action: 'update_opportunity',
                                title: 'Update Opportunity',
                                label: 'Customer, Won',
                                summary:
                                  'Enrollment › Customer, status Won, Opportunity Value $497, Opportunity Name "{{contact.name}} · Career Pivot Blueprint": the values 03 writes, so the card ends the same whichever workflow runs first. The Find right before it is what puts the card in context; a card Create Opportunity made at the top is not.',
                                run: ({ contact }) => {
                                  const stage = contact.opportunity?.stage ?? '';
                                  const name = `${contact.firstName} ${contact.lastName} · ${COURSE}`;
                                  return {
                                    effect: { opportunity: { stage: 'Customer', status: 'won', value: 497, name } },
                                    log: `Enrollment › Customer, moved from ${stage || 'no stage'}. Status Won, $497, named "${name}", as in 03.`,
                                  };
                                },
                              },
                            ],
                          },
                        ],
                        otherwise: {
                          label: 'Opportunity Not Found',
                          nodes: [
                            {
                              id: 'notify-lost',
                              kind: 'action',
                              action: 'internal_notification',
                              title: 'Internal Notification',
                              label: 'Paid after a Lost card',
                              summary:
                                'Type Notification (in-app), To User Type Particular Users: Devon Brooks, Redirect Page: the contact. Only reached when someone closed the course card during recovery. 02 does not reopen it; 03, on the same payment, finds it by stage and marks it Customer, Won.',
                              message: {
                                channel: 'internal',
                                to: 'Devon Brooks (Notification, Particular Users)',
                                subject: 'Paid after all: {{contact.name}}',
                                body: '{{contact.name}} bought {{custom_values.course_name}} after their course card was closed as Lost. 03 marks that card Customer, Won on this payment and Jules takes over onboarding. Nothing to do, unless the card was closed for another reason.',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: 'Email only',
                  nodes: [
                    {
                      id: 'wait-1d-e',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: DAY,
                      summary: 'One day, the day the text path spends after its text, so both paths send the last email at the same point.',
                    },
                    {
                      id: 'goto-last',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'email-last',
                      summary: 'Joins the text path at the last email, so both paths share one last email, one grace day and the one Goal Event.',
                    },
                  ],
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Opportunity Not Found',
          nodes: [
            {
              id: 'create-opp',
              kind: 'action',
              action: 'create_opportunity',
              title: 'Create Opportunity',
              label: 'New course card',
              summary:
                'Enrollment › Checkout Started, status Open, Opportunity Value $497, named "{{contact.name}} · Career Pivot Blueprint", Opportunity Source Checkout. Duplicate Opportunity on: a contact whose only cards are closed or a coaching deal still gets one, and the old cards stay as history.',
              run: ({ contact }) => {
                const prev = contact.opportunity;
                return {
                  effect: { opportunity: { pipeline: 'Enrollment', stage: 'Checkout Started', status: 'open', value: 497, name: `${contact.firstName} ${contact.lastName} · ${COURSE}`.trim() } },
                  log: `New course card in Enrollment at Checkout Started, $497, status Open.${prev ? ` The ${prev.stage} card (${prev.status}) stays as it is.` : ''}`,
                };
              },
            },
            {
              id: 'goto-tag',
              kind: 'goto',
              title: 'Go To',
              target: 'tag-started',
              summary: 'On to the tag, past the stage update the new card does not need. Nothing leads back to Find Opportunity, so this cannot loop; the goal runs its own Find before it closes the card.',
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'pays-fast',
      label: 'Pays after 20 minutes',
      summary: 'Starts checkout during the live Q&A, before 01 has moved the card to Attended, and pays in full 20 minutes later. Never gets a nudge.',
      start: at(3, 19, 52),
      contact: registrant('Registered', { current_role: 'Manager', goal: 'A new industry', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [{ at: 20, type: 'payment', value: 497, label: '$497 in full, Career Pivot Blueprint' }],
      expect: { outcome: 'goal', visits: ['find-opp:0', 'opp-checkout', 'assign', 'wait-1h', 'goal-paid', 'untag', 'find-paid:0', 'opp-customer'], stage: 'Customer' },
    },
    {
      id: 'pays-day-2',
      label: 'Pays on day 2, after the text',
      summary: 'Watched the replay on Friday afternoon and starts checkout that evening. Asks about the plan in reply to Sunday’s text, then pays the first installment.',
      start: at(4, 18, 45),
      contact: registrant('Attended', { current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [
        {
          at: at(6, 10, 14) - at(4, 18, 45),
          type: 'reply',
          value: 'Does the refund still apply if I pick the payment plan?',
          label: 'Stop on Response is off, so the run carries on while Devon answers from Conversations',
        },
        { at: at(6, 11, 2) - at(4, 18, 45), type: 'payment', value: 179, label: '$179, first of 3 plan payments' },
      ],
      expect: { outcome: 'goal', visits: ['email-faq', 'wait-text', 'can-text:0', 'sms-nudge', 'goal-paid', 'untag', 'find-paid:0', 'opp-customer'], stage: 'Customer' },
    },
    {
      id: 'never-pays-texts',
      label: 'Card declined, never pays',
      summary: 'Starts checkout at 8:25 PM, right after the live workshop. The card is declined and they never try again. Quiet hours move the first email to 8 AM and the text to 10 AM.',
      start: at(3, 20, 25),
      contact: registrant('Attended', { current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [{ at: 3, type: 'payment_failed', value: 497, label: 'Card declined on step 2. The goal only counts Payment Status Success, so they stay in recovery' }],
      expect: {
        outcome: 'ended',
        visits: ['email-faq', 'can-text:0', 'sms-nudge', 'email-last', 'wait-grace', 'tag-abandoned', 'goal-paid'],
        tags: ['checkout-started', 'cart-abandoned'],
        stage: 'Checkout Started',
      },
    },
    {
      id: 'reminders-only',
      label: 'Never pays, reminder consent only',
      summary: 'Ticked the workshop-reminder box but not the offers box. The same two emails, no text, then tagged cart-abandoned.',
      start: at(1, 12, 35),
      contact: registrant('Attended', { current_role: 'Manager', goal: 'Not sure yet', sms_consent: 'Yes', sms_marketing_consent: 'No' }),
      events: [],
      expect: { outcome: 'ended', visits: ['email-faq', 'can-text:else', 'wait-1d-e', 'goto-last', 'email-last', 'tag-abandoned'], tags: ['cart-abandoned'], stage: 'Checkout Started' },
    },
    {
      id: 'no-card',
      label: 'No card yet, pays after the last email',
      summary: 'Clicks the offer in a newsletter without ever registering: no card and no text consent. Pays the morning after the last email.',
      start: at(0, 9, 10),
      contact: { source: 'Newsletter' },
      events: [{ at: at(3, 7, 50) - at(0, 9, 10), type: 'payment', value: 497, label: '$497 in full, Career Pivot Blueprint' }],
      expect: {
        outcome: 'goal',
        visits: ['find-opp:else', 'create-opp', 'goto-tag', 'tag-started', 'assign', 'can-text:else', 'goto-last', 'email-last', 'goal-paid', 'untag', 'find-paid:0', 'opp-customer'],
        stage: 'Customer',
      },
    },
    {
      id: 'closed-then-pays',
      label: 'Says no, then pays anyway',
      summary: 'Starts checkout on a Wednesday morning after the replay. Answers the FAQ email with "not for me right now", so Devon closes the card as Lost. Buys on Saturday morning after the last email.',
      start: at(2, 9, 20),
      contact: registrant('Attended', { current_role: 'Manager', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'No' }),
      events: [
        {
          at: at(2, 18, 5) - at(2, 9, 20),
          type: 'reply',
          channel: 'email',
          value: 'Thanks for the honest answers. It is not for me right now.',
          label: 'Reply by email. Stop on Response is off, so the run carries on',
        },
        { at: at(3, 9, 5) - at(2, 9, 20), type: 'opportunity_lost', label: 'Devon closes the course card as Lost after the clear no' },
        { at: at(5, 8, 40) - at(2, 9, 20), type: 'payment', value: 497, label: '$497 in full, Career Pivot Blueprint, after the last email' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['email-faq', 'can-text:else', 'email-last', 'goal-paid', 'untag', 'find-paid:else', 'notify-lost'],
        stage: 'Checkout Started',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'SMS consent (offers)', key: 'sms_marketing_consent', type: 'Checkbox', note: 'From the workshop form: "Also text me about future workshops and offers." Unticked and optional. The only consent that allows the cart text, and only without SMS DND.' },
      { name: 'SMS consent (service)', key: 'sms_consent', type: 'Checkbox', note: 'Workshop reminders and course and billing notices. Not consent to a sales text, so this workflow never reads it.' },
    ],
    tags: [
      { name: 'checkout-started', note: 'Added on entry, removed on payment by 02 or 03, or by 05 when a qualified applicant leaves 02. Whoever has it is in recovery right now.' },
      { name: 'cart-abandoned', note: 'Finished recovery without paying. For reporting and Smart Lists, not for more cart messages.' },
    ],
    pipeline: { name: 'Enrollment', stages: [...STAGES] },
    customValues: [
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Course Price', key: 'course_price', value: '$497' },
      { name: 'Payment Plan', key: 'payment_plan', value: '3 payments of $179' },
      { name: 'Refund Policy', key: 'refund_policy', value: '14-day money-back guarantee' },
      { name: 'Support Email', key: 'support_email', value: 'help@trailheadcareers.example' },
    ],
  },
  build: [
    {
      title: 'Agree what abandoned means',
      body: 'With Morgan: someone who submits step 1 and does not pay, including a declined card. Three touches over two days, no discount, no countdown, no income claims. Someone who buys hears nothing from this workflow; their welcome belongs to 03 · Students · Course Onboarding.',
    },
    {
      title: 'Product and order form first',
      body: 'Career Pivot Blueprint in Payments › Products with two prices: One time at $497, and Recurring monthly at $179 with Number of payments set to 3. Both sit on the offer step’s Two-Step Order form. Step 1 asks for name, email and phone; step 2 takes the card. Prices, the plan and the refund policy live in custom values, so the emails never hard-code them.',
    },
    {
      title: 'Pick the trigger that fires without payment',
      body: 'Order Form Submission with Submission Type Opt-In fires when step 1 is submitted, paid or not. Order Submitted fires only on a completed payment, which is why it starts 03 and could never start this one. I filtered on the funnel, the checkout page and the product, so a future offer gets its own recovery.',
    },
    {
      title: 'The course card: find, or create and move on',
      body: 'Update Opportunity only works on an opportunity in context, and this trigger brings none. Find Opportunity picks the latest open course card in Enrollment, skipping the coaching stages (Applied, Call Booked, Coaching Client) exactly as 03 does, so a coaching deal from 05 is never moved to Checkout Started. With no open course card, Create Opportunity makes one at Checkout Started, with Duplicate Opportunity on and Allow Multiple Opportunities per Contact on in Sub-Account Settings › Objects › Opportunities, and Go To carries on to the tag, never back to Find. A card made by Create Opportunity is not in context for a later Update Opportunity, so the goal runs the same Find again before it closes the card.',
    },
    {
      title: 'Consent picks the path',
      body: 'Cart texts are marketing, so only SMS consent (offers) = Yes gets one; the workshop-reminder box is not enough. The If/Else sits right before the text, not at the top, so it reads consent and SMS DND when the text would go out, a day after checkout. The order form’s Terms & Conditions checkbox is part of buying, so text consent cannot ride on it: consent to marketing texts can never be a condition of purchase. The emails are commercial too, so each one ends with the business address, and GHL’s default unsubscribe link stays on (Business Profile › General › Include Unsubscribe Link).',
    },
    {
      title: 'One goal, one exit',
      body: 'GHL allows one Goal Event per workflow and moves the contact to it from wherever they are waiting. Payment Received filtered by product and Payment Status Success, so both prices count and a declined card does not. Anyone who arrives without paying ends there, and cart-abandoned is the step right before it. After the goal there is no payment If/Else, because payment conditions only exist in a workflow triggered by Payment Received and the goal already separates buyers from everyone else; there is only the tag cleanup and a Find before the card update.',
    },
    {
      title: 'Share the purchase with 03',
      body: 'The same payment fires Order Submitted, and 03 removes the contact from 02 in its first step. I cannot choose which runs first, so the steps after 02’s goal write exactly what 03 writes: both cart tags off, and the course card at Customer, Won, $497, named "{{contact.name}} · Career Pivot Blueprint". Both workflows find that card with the same stage filter. The Checkout Started update leaves Status out, so even a late run can never reopen a Won card.',
    },
    {
      title: 'Settings, then test with test cards',
      body: 'Time Window 8 AM to 8 PM in the contact’s time zone: federal quiet hours end at 9 PM, but several states stop at 8. Sender Details blank so email goes from the assigned user. Then the funnel in test mode and one test contact per scenario, a declined test card included, each checked in the Execution Logs and on the pipeline board before publishing.',
    },
  ],
  edgeCases: [
    {
      title: 'They pay a minute after step 1',
      body: 'The usual buyer. The goal pulls them from the 1-hour wait, and 03 removes them from 02 on the same payment. Whichever lands first, the card ends at Customer, Won, both cart tags are gone and no nudge goes out. 03 sends the welcome.',
    },
    {
      title: 'The card is declined',
      body: 'A decline records a failed payment, not a successful one, so the goal ignores it and they stay in recovery. The first email says the order did not go through rather than assuming they changed their mind. 04 · Billing · Failed Payment Recovery leaves first-payment declines to this workflow.',
    },
    {
      title: 'Reminder consent only, offers only, or STOP',
      body: 'The workshop-reminder box covers reminders, not offers, so they take the email-only path. Someone who ticked only the offers box has SMS DND from 01, and 02 leaves it on: lifting it would also release 01’s reminder texts, which they did not ask for, so they get email only. Someone with offers consent who texts STOP to a workshop reminder before the cart text is due has SMS DND on by then, and the If/Else, which runs right before the text, sends them down the email-only path too.',
    },
    {
      title: 'Checkout right after the live workshop',
      body: 'The pitch ends around 8 PM Central, so a checkout from the live session runs into quiet hours. The first email waits for the Time Window and goes out at 8 AM Friday, and the text follows on Saturday, after 10 AM.',
    },
    {
      title: 'Devon closed the card, then they paid',
      body: 'A clear "not for me" gets the card closed as Lost. If they buy anyway, the Find after the goal looks for an open card, finds none and tells Devon in-app instead of reopening it. 03 runs on the same payment, finds the card by stage and marks it Customer, Won, so the end result is the same.',
    },
    {
      title: 'They reply with a question',
      body: 'Stop on Response is off on purpose: the run still has to tag a non-buyer at the end. The reply goes to Devon’s Conversations inbox, and the one remaining email still reads fine after a conversation. If they buy while talking to him, the goal and 03 take it from there.',
    },
    {
      title: 'No open course card',
      body: 'A newsletter reader who never registered has no card, so Find Opportunity comes back empty and Create Opportunity adds one at Checkout Started. The same happens for someone whose only course card was closed, or whose only card is a coaching deal, which stays as it is. A current student would get a second course card this way; that is rare, because 01 and 05 keep the checkout link away from students, so I did not add a separate check.',
    },
  ],
  qa: [
    'Test mode, step 1 only: the contact enters, the course card moves to Checkout Started with a $497 value and keeps its status, Devon is the owner, and the log shows the 1-hour wait. A test contact with an open coaching card at Call Booked: that card does not move, and a new course card appears',
    'Pay with a test card inside the hour: the logs show 02’s goal or 03’s Remove from Workflow, and either way the card is at Customer, Won, $497, renamed for the course, both cart tags are gone and no cart email was sent',
    'Pay on the 3 x $179 price: the goal is still met, because it filters on the product, not the price',
    'Use a declined test card on step 2: the contact stays in 02 and gets the FAQ email an hour later',
    'Reminder consent only: the Send SMS step never runs and the email path does. Submit step 1 at 7:30 PM: the first email shows as waiting until 8 AM',
    'Never pay: cart-abandoned is added, then the run ends at the goal with nothing after it, and the card stays Open at Checkout Started',
    'No card, and a contact whose only card is Lost: exactly one new course card each, the goal’s Update Opportunity lands on it, and Execution Logs show no step running twice. Close a test card as Lost, then pay: Devon gets the in-app notification and 03 marks the card Won',
    'Ticked only the offers box on the workshop form: SMS DND stays on and the text path is never taken. Submit a qualifying coaching application mid-checkout: 05 removes the contact from 02 and checkout-started is gone',
    'Emails in Gmail, Outlook and on a phone: the checkout trigger link, custom values, signature, postal address and unsubscribe link all render; the text is GSM-7 and at most two segments',
  ],
  snippets: [
    {
      title: 'Trigger, goal and settings',
      language: 'text',
      code: settingsSheet,
      note: 'The whole behavior comes from these few settings: Opt-In starts recovery at step 1, and the goal ends it at a successful payment, for either price.',
    },
    {
      title: 'Email 1: honest FAQ',
      language: 'text',
      code: `Subject: ${faqSubject}\n\n${faqBody}`,
      note: 'No discount, no deadline and no promise of a job or a salary. The price, the plan and the refund policy are custom values, so a price change is one edit. The first lesson’s 12 minutes is the same figure 03 uses.',
    },
  ],
  features: [
    'Order Form Submission',
    'Find Opportunity',
    'Create Opportunity',
    'Update Opportunity',
    'Go To',
    'Add Contact Tag',
    'Assign To User',
    'If/Else',
    'Wait · Advance Window',
    'Send Email',
    'Send SMS',
    'Trigger Links',
    'Goal Event',
    'Remove Contact Tag',
    'Internal Notification',
    'Time Window',
    'Allow Re-entry',
  ],
};
