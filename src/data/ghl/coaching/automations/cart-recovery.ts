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

const userName = (key: string) => business.env.users[key]?.name ?? key;

/**
 * A workshop registrant: 01 · Workshop gave them a card in Enrollment at
 * Registered, and moves it to Attended 75 minutes after the live start (or
 * two hours after a replay click).
 */
const registrant = (stage: 'Registered' | 'Attended', fields: Contact['fields']): Partial<Contact> => ({
  opportunity: { pipeline: 'Enrollment', stage, status: 'open', name: 'Marcus Lee · Workshop' },
  fields,
});

/** Name and postal address under every email: these emails sell, so CAN-SPAM applies. */
const signature = '{{user.name}}\n{{location.name}}, {{location.address}}';

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
It starts 03 · Course Onboarding, which removes the contact from 02.

Goal Event    Payment Received
  Product             Career Pivot Blueprint   one-time and plan price
  Payment Status      Success                  a declined card does not count
  If Contact Reaches This Goal Without Meeting Conditions:
                      End this workflow

Opportunities Find Opportunity    Latest, Pipeline is Enrollment, Status is Open
              Create Opportunity  Duplicate Opportunity on
              Settings › Objects › Opportunities:
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
    'Submitting step 1 of the two-step order form starts the workflow, whether or not payment follows. It moves their card to Checkout Started, then waits an hour, so someone who is just typing in their card number never gets a nudge. After that: an FAQ email with the refund policy and the payment plan, a text only for people who agreed to marketing texts, and a last email with no countdown. A Payment Received goal pulls a buyer out at any point and marks the card Customer, Won, the same change 03 · Course Onboarding makes on the purchase. Anyone who never pays ends tagged cart-abandoned.',
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
      notes: [
        "Time Window (Specific Time) 8 AM to 8 PM in the contact's time zone, every day: it holds both emails and the text overnight, and GHL does not hold internal steps like the card update or the tag. The text's wait also has a 10 AM to 7 PM Advance Window, because 8 AM on a Saturday is legal but not kind.",
        'Stop on Response off: a reply is usually a question about refunds or the plan, and Devon answers it from Conversations. The run has to keep going so a non-buyer still ends tagged cart-abandoned, and the one email left after the text reads fine after a conversation. STOP still switches on SMS DND by itself.',
        'Allow Re-entry on: someone who abandons again after a later workshop gets the recovery again. GHL does not let a contact re-enter while still active, so a double submit of step 1 changes nothing.',
        'One Goal Event per workflow is a GHL limit. It sits near the end of the text path. GHL moves a buyer to it from wherever they are waiting, email-only path included, and a non-buyer on that path reaches it through the Go To.',
        '03 · Course Onboarding runs on the same payment and its first step is Remove from Workflow: 02. The steps after this goal write exactly what 03 writes (card at Customer, Won, $497, both cart tags off), so whichever workflow gets there first, the contact ends up the same.',
        'Sender Details left blank: GHL then sends automated email from the assigned user, and 02 assigns Devon before the first email, so the From line matches the {{user.name}} signature.',
      ],
    },
    steps: [
      {
        id: 'find-opp',
        kind: 'ifelse',
        title: 'Find Opportunity',
        label: 'Find the enrollment card',
        branches: [
          {
            label: 'Opportunity Found',
            when: { type: 'all', label: 'Latest Opportunity, Pipeline is Enrollment and Status is Open', of: [{ type: 'opportunity', status: 'open' }] },
            nodes: [
              {
                id: 'opp-checkout',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Checkout Started',
                summary:
                  'Enrollment › Checkout Started, Opportunity Value $497. Status is not in the step, so this can never reopen a card. Allow Opportunity to Move to Any Previous Stage stays off, so a card that is further along never goes backwards.',
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
                summary: 'Marks everyone who is in checkout recovery right now. Removed the moment they pay, here or in 03.',
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
                    label: 'Marketing consent',
                    when: {
                      type: 'all',
                      label: 'Marketing Texts is Yes, and the contact is not DND for SMS',
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
                          'Only someone who never paid reaches this step: a payment skips past it straight to the goal. For a Smart List and the recovery report, never for more cart messages. The card stays Open at Checkout Started, so a later checkout or application finds it instead of making a second one.',
                        effect: { addTags: ['cart-abandoned'] },
                      },
                      {
                        id: 'goal-paid',
                        kind: 'goal',
                        title: 'Goal Event',
                        label: 'Payment Received',
                        event: 'payment',
                        ifNotMet: 'end',
                        summary: 'Payment Received, product Career Pivot Blueprint (either price), Payment Status Success. Reached without paying: End this workflow.',
                      },
                      {
                        id: 'opp-customer',
                        kind: 'action',
                        action: 'update_opportunity',
                        title: 'Update Opportunity',
                        label: 'Customer, Won',
                        summary:
                          'Enrollment › Customer, status Won, Opportunity Value $497: the same values 03 writes, so the result does not depend on which workflow runs first. A later coaching application gets its own card in 05, because this one is closed.',
                        run: ({ contact }) => {
                          const stage = contact.opportunity?.stage ?? '';
                          if (STAGES.indexOf(stage) > CUSTOMER) {
                            return { effect: { opportunity: { status: 'won', value: 497 } }, log: `The card is already at ${stage}. Backward moves are off, so it stays there; status Won, $497, as in 03.` };
                          }
                          return { effect: { opportunity: { stage: 'Customer', status: 'won', value: 497 } }, log: `Enrollment › Customer, moved from ${stage || 'no stage'}. Status Won, $497.` };
                        },
                      },
                      {
                        id: 'untag',
                        kind: 'action',
                        action: 'remove_tag',
                        title: 'Remove Contact Tag',
                        label: 'Cart tags',
                        summary: 'Removes checkout-started, and cart-abandoned in case an earlier checkout left it. No receipt or welcome here: 03 starts on the purchase itself.',
                        effect: { removeTags: ['checkout-started', 'cart-abandoned'] },
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
              label: 'New card',
              summary:
                'Enrollment › Checkout Started, named after the contact and the course, Opportunity Source Checkout, Opportunity Value $497. Duplicate Opportunity on: a contact whose only card is closed would otherwise get no new card, and the Go To below would send them round forever.',
              run: ({ contact }) => ({
                effect: { opportunity: { pipeline: 'Enrollment', stage: 'Checkout Started', status: 'open', value: 497, name: `${contact.firstName} ${contact.lastName} · Career Pivot Blueprint`.trim() } },
                log: 'New card in Enrollment at Checkout Started, $497, status Open.',
              }),
            },
            {
              id: 'goto-find',
              kind: 'goto',
              title: 'Go To',
              target: 'find-opp',
              summary: 'A created opportunity is not in context for later updates, so the contact goes back through Find Opportunity, which now finds it.',
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
      expect: { outcome: 'goal', visits: ['find-opp:0', 'opp-checkout', 'assign', 'wait-1h', 'goal-paid', 'opp-customer', 'untag'], stage: 'Customer' },
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
      expect: { outcome: 'goal', visits: ['email-faq', 'wait-text', 'can-text:0', 'sms-nudge', 'goal-paid', 'opp-customer', 'untag'], stage: 'Customer' },
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
      summary: 'Ticked the workshop-reminder box but not marketing texts. The same two emails, no text, then tagged cart-abandoned.',
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
        visits: ['find-opp:else', 'create-opp', 'goto-find', 'find-opp:0', 'can-text:else', 'goto-last', 'email-last', 'goal-paid', 'opp-customer'],
        stage: 'Customer',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Marketing Texts', key: 'sms_marketing_consent', type: 'Checkbox', note: 'From the workshop form: "Also text me about future workshops and offers." Unticked and optional. The only thing that allows the cart text.' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'Workshop reminders only. Not consent to a sales text, so this workflow never reads it.' },
    ],
    tags: [
      { name: 'checkout-started', note: 'Added on entry, removed on payment by 02 or 03. Whoever has it is in recovery right now.' },
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
      body: 'With Morgan: someone who submits step 1 and does not pay, including a declined card. Three touches over two days, no discount, no countdown, no income claims. Someone who buys hears nothing from this workflow; their welcome belongs to 03 · Course Onboarding.',
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
      title: 'Find the card before moving it',
      body: 'Update Opportunity only works on an opportunity in context, and this trigger brings none. Find Opportunity picks the latest open card in Enrollment; with no open card, Create Opportunity makes one and Go To runs Find again. Duplicate Opportunity is on in that step and Allow Multiple Opportunities per Contact is on in Settings › Objects › Opportunities, as 05 needs too. With either off, a contact whose only card is Won or Lost gets no new card, Find fails again and the Go To loops.',
    },
    {
      title: 'Consent picks the path',
      body: 'Cart texts are marketing, so only Marketing Texts = Yes gets one; the workshop-reminder box is not enough. The If/Else sits right before the text, not at the top, so it reads consent and SMS DND when the text would go out, a day after checkout. The order form’s Terms & Conditions checkbox is part of buying, so text consent cannot ride on it: consent to marketing texts can never be a condition of purchase. The emails are commercial too, so each one ends with the business address, and GHL’s default unsubscribe link stays on (Business Profile › General › Include Unsubscribe Link).',
    },
    {
      title: 'One goal, one exit',
      body: 'GHL allows one Goal Event per workflow and moves the contact to it from wherever they are waiting. Payment Received filtered by product and Payment Status Success, so both prices count and a declined card does not. Anyone who arrives without paying ends there, and cart-abandoned is the step right before it. There is no If/Else after the goal: payment conditions only exist in a workflow triggered by Payment Received, and the goal already separates buyers from everyone else.',
    },
    {
      title: 'Share the purchase with 03',
      body: 'The same payment fires Order Submitted, and 03 removes the contact from 02 in its first step. I cannot choose which runs first, so the steps after 02’s goal write exactly what 03 writes: Customer, Won, $497, both cart tags off. The Checkout Started update leaves Status out, so even a late run can never reopen a Won card.',
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
      body: 'A decline records a failed payment, not a successful one, so the goal ignores it and they stay in recovery. The first email says the order did not go through rather than assuming they changed their mind. 04 · Billing leaves first-payment declines to this workflow.',
    },
    {
      title: 'Reminder consent only, or STOP',
      body: 'The workshop-reminder box covers reminders, not offers, so they take the email-only path. Someone with marketing consent who texts STOP to a workshop reminder before the cart text is due has SMS DND on by then, so the If/Else, which runs right before the text, sends them down the email-only path too.',
    },
    {
      title: 'Checkout right after the live workshop',
      body: 'The pitch ends around 8 PM Central, so a checkout from the live session runs into quiet hours. The first email waits for the Time Window and goes out at 8 AM Friday, and the text follows on Saturday, after 10 AM.',
    },
    {
      title: 'They reply with a question',
      body: 'Stop on Response is off on purpose: the run still has to tag a non-buyer at the end. The reply goes to Devon’s Conversations inbox, and the one remaining email still reads fine after a conversation. If they buy while talking to him, the goal and 03 take it from there.',
    },
    {
      title: 'No open card',
      body: 'A newsletter reader who never registered has no card, so Find Opportunity comes back empty; Create Opportunity adds one at Checkout Started and Go To sends them back through Find. The same happens for a current student, whose card is Won. That is rare, because 01 and 05 keep the checkout link away from students, so I did not add a separate check.',
    },
  ],
  qa: [
    'Test mode, step 1 only: the contact enters, the card moves to Checkout Started with a $497 value and keeps its status, Devon is the owner, and the log shows the 1-hour wait',
    'Pay with a test card inside the hour: the logs show 02’s goal or 03’s Remove from Workflow, and either way the card is at Customer, Won, both cart tags are gone and no cart email was sent',
    'Pay on the 3 x $179 price: the goal is still met, because it filters on the product, not the price',
    'Use a declined test card on step 2: the contact stays in 02 and gets the FAQ email an hour later',
    'Reminder consent only: the Send SMS step never runs and the email path does. Submit step 1 at 7:30 PM: the first email shows as waiting until 8 AM',
    'Never pay: cart-abandoned is added, then the run ends at the goal with nothing after it, and the card stays Open at Checkout Started',
    'No card, and a contact whose only card is Won: exactly one new opportunity each, the later updates land on it, and no Go To loop',
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
    'Time Window',
    'Allow Re-entry',
  ],
};
