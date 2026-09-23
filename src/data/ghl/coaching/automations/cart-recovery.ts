import type { Automation, Contact } from '@/lib/ghl/types';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Enrollment pipeline, in order. Update Opportunity only moves a card forward unless told otherwise. */
const STAGES = business.pipeline.stages;
const CHECKOUT = STAGES.indexOf('Checkout Started');

const userName = (key: string) => business.env.users[key]?.name ?? key;

/** A workshop registrant: 01 · Workshop gave them a card in Enrollment. */
const registrant = (stage: 'Registered' | 'Attended', fields: Contact['fields']): Partial<Contact> => ({
  opportunity: { pipeline: 'Enrollment', stage, status: 'open' },
  fields,
});

const faqSubject = 'Questions before you join, {{contact.first_name}}?';

const faqBody = `Hi {{contact.first_name}},

You started checkout for {{custom_values.course_name}} and stopped before the payment step. That is fine. Here are straight answers to what people ask before they join.

Is it right for me?
It is built for people with years of experience in one field who want to move into another. It is not a job placement service, and nobody can promise you a new job or a salary.

How much time does it take?
It is self-paced. Short lessons, and exercises that do the real work: mapping the skills you already have, telling that story to a new field, and a 90-day plan for the move.

What if it is not for me?
It comes with a {{custom_values.refund_policy}}. Email {{custom_values.support_email}} within the guarantee period for a full refund.

Can I pay over time?
Yes. It is {{custom_values.course_price}} once, or {{custom_values.payment_plan}}. The plan costs a little more in total, and the checkout page shows both.

Your checkout: {{trigger_link.checkout}}

Or reply with your question. A person reads every reply.

{{user.name}}
{{location.name}}`;

const settingsSheet = `Trigger       Order Form Submission
  In Funnel/Website   The Career Pivot Plan
  Page Is             Blueprint Checkout
  Product Is          Career Pivot Blueprint
  Submission Type     Opt-In      step 1 submitted, paid or not

Not this one: Order Submitted fires only on a completed payment,
which suits onboarding, not recovery.

Goal Event    Payment Received
  Product             Career Pivot Blueprint   one-time and plan price
  Status              Success
  If Contact Reaches This Goal Without Meeting Conditions:
                      End this workflow

Settings      Allow Re-entry on · Stop on Response off
              Timezone: Contact · Time Window 8:00 AM to 8:00 PM, every day`;

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
    'Submitting step 1 of the two-step order form starts the workflow, whether or not payment follows. It moves their card to Checkout Started, then waits an hour, so someone who is just typing in their card number never gets a nudge. After that: an FAQ email with the refund policy and the payment plan, a text only for people who agreed to marketing texts, and a last email with no countdown. A Payment Received goal pulls a buyer out at any point and moves the card to Customer; anyone who never pays ends tagged cart-abandoned.',
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
      senderName: 'Trailhead Career Coaching',
      notes: [
        "Time Window 8 AM to 8 PM in the contact's time zone, every day: it holds both emails and the text overnight. The text's wait also has a 10 AM to 7 PM Advance Window, because 8 AM on a Saturday is legal but not kind.",
        'Stop on Response off: a reply is usually a question, and ending the run would also end the payment goal that moves the card to Customer. Replies land in the assigned user’s Conversations inbox either way.',
        'Allow Re-entry on: someone who abandons again after a later workshop gets the recovery again. GHL never enrolls a contact who is still active, so a double submit of step 1 changes nothing.',
        'One Goal Event per workflow is a GHL limit. It sits near the end of the text path, and the email-only path joins it with Go To.',
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
            when: { type: 'all', label: 'Latest opportunity in Enrollment with status Open', of: [{ type: 'opportunity', status: 'open' }] },
            nodes: [
              {
                id: 'opp-checkout',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Checkout Started',
                summary: 'Enrollment › Checkout Started, Opportunity Value $497. Allow Opportunity to Move to Any Previous Stage stays off, so a card that is further along never goes backwards.',
                run: ({ contact }) => {
                  const stage = contact.opportunity?.stage ?? '';
                  if (STAGES.indexOf(stage) > CHECKOUT) return { log: `The card is already at ${stage}. This step only moves cards forward, so it stays there.` };
                  return { effect: { opportunity: { stage: 'Checkout Started', status: 'open', value: 497 } } };
                },
              },
              {
                id: 'tag-started',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'checkout-started',
                summary: 'Marks everyone who is in checkout recovery right now. Removed the moment they pay.',
                effect: { addTags: ['checkout-started'] },
              },
              {
                id: 'assign',
                kind: 'action',
                action: 'assign_user',
                title: 'Assign To User',
                label: 'Devon',
                summary: 'Devon Brooks, the enrollment advisor, with Only Apply to Unassigned Contacts on. He signs the nudges, and replies land in his Conversations inbox.',
                run: ({ contact }) =>
                  contact.assignedTo
                    ? { log: `Already assigned to ${userName(contact.assignedTo)}, so the owner stays the same.` }
                    : { effect: { assignTo: 'devon' }, log: 'Assigned to Devon Brooks, the enrollment advisor.' },
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
                        summary: 'Honest answers to the usual questions, with the refund policy, the payment plan and the checkout trigger link. No discount, no countdown.',
                        message: { channel: 'email', subject: faqSubject, body: faqBody },
                      },
                      {
                        id: 'wait-text',
                        kind: 'wait',
                        title: 'Wait',
                        mode: 'time',
                        minutes: DAY,
                        window: { start: '10:00', end: '19:00', days: ALL_WEEK },
                        summary: 'One day, then its Advance Window only resumes between 10 AM and 7 PM, inside the 8 AM to 8 PM Time Window.',
                      },
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
                        message: {
                          channel: 'email',
                          subject: 'Last note about {{custom_values.course_name}}',
                          body: 'Hi {{contact.first_name}},\n\nThis is my last email about {{custom_values.course_name}}. Your checkout is here if you want it: {{trigger_link.checkout}}\n\nThere is no deadline and no countdown. I just do not want these piling up in your inbox.\n\nThe short version: {{custom_values.course_price}} once or {{custom_values.payment_plan}}, with a {{custom_values.refund_policy}}.\n\nIf the timing is wrong, the free workshop runs every Thursday at 7 PM Central, and you are welcome back any week.\n\n{{user.name}}\n{{location.name}}',
                        },
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
                        summary: 'Only someone who never paid reaches this step: a payment skips past it straight to the goal. For a Smart List and the recovery report, never for more cart messages.',
                        effect: { addTags: ['cart-abandoned'] },
                      },
                      {
                        id: 'goal-paid',
                        kind: 'goal',
                        title: 'Goal Event',
                        label: 'Payment Received',
                        event: 'payment',
                        ifNotMet: 'end',
                        summary: 'Payment Received for Career Pivot Blueprint, either price, status Success. Reached without paying: End this workflow.',
                      },
                      {
                        id: 'opp-customer',
                        kind: 'action',
                        action: 'update_opportunity',
                        title: 'Update Opportunity',
                        label: 'Customer',
                        summary: 'Enrollment › Customer. Status stays Open: the same card moves on to Applied if they apply for coaching later.',
                        effect: { opportunity: { stage: 'Customer', status: 'open' } },
                      },
                      {
                        id: 'untag',
                        kind: 'action',
                        action: 'remove_tag',
                        title: 'Remove Contact Tag',
                        label: 'checkout-started',
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
                      id: 'wait-1h-e',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: 60,
                      summary: 'One hour, as on the text path.',
                    },
                    {
                      id: 'email-faq-e',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Questions before you join',
                      summary: 'Same template as the text path.',
                      message: { channel: 'email', subject: faqSubject, body: faqBody },
                    },
                    {
                      id: 'wait-2d-e',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: 2 * DAY,
                      summary: 'Two days: the time the text path spends on its text and the day after it.',
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
              summary: 'Enrollment › Checkout Started, named after the contact and the course, source Checkout, Lead Value $497. For someone who reached the checkout without registering for a workshop.',
              run: ({ contact }) => ({
                effect: { opportunity: { pipeline: 'Enrollment', stage: 'Checkout Started', status: 'open', value: 497, name: `${contact.firstName} ${contact.lastName} · Career Pivot Blueprint`.trim() } },
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
      summary: 'Starts checkout during the live Q&A, stays for the last questions and pays in full 20 minutes later. Never gets a nudge.',
      start: at(3, 19, 52),
      contact: registrant('Attended', { current_role: 'Manager', goal: 'A new industry', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [{ at: 20, type: 'payment', value: 497, label: '$497 in full, Career Pivot Blueprint' }],
      expect: { outcome: 'goal', visits: ['find-opp:0', 'opp-checkout', 'can-text:0', 'wait-1h', 'goal-paid', 'opp-customer', 'untag'], stage: 'Customer' },
    },
    {
      id: 'pays-day-2',
      label: 'Pays on day 2, after the text',
      summary: 'Watches the replay on Friday evening and starts checkout. Asks about the plan in reply to Sunday’s text, then pays the first installment.',
      start: at(4, 18, 45),
      contact: registrant('Registered', { current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [
        {
          at: at(6, 10, 14) - at(4, 18, 45),
          type: 'reply',
          value: 'Does the refund still apply if I pick the payment plan?',
          label: 'Stop on Response is off, so the run carries on while Devon answers from Conversations',
        },
        { at: at(6, 11, 2) - at(4, 18, 45), type: 'payment', value: 179, label: '$179, first of 3 plan payments' },
      ],
      expect: { outcome: 'goal', visits: ['email-faq', 'wait-text', 'sms-nudge', 'goal-paid', 'opp-customer', 'untag'], stage: 'Customer' },
    },
    {
      id: 'never-pays-texts',
      label: 'Never pays, texts allowed',
      summary: 'Starts checkout at 8:25 PM, right after the live workshop, and never pays. Quiet hours move the first email to 8 AM and the text to 10 AM.',
      start: at(3, 20, 25),
      contact: registrant('Attended', { current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'Yes' }),
      events: [],
      expect: {
        outcome: 'ended',
        visits: ['email-faq', 'sms-nudge', 'email-last', 'wait-grace', 'tag-abandoned', 'goal-paid'],
        tags: ['checkout-started', 'cart-abandoned'],
        stage: 'Checkout Started',
      },
    },
    {
      id: 'reminders-only',
      label: 'Never pays, reminder consent only',
      summary: 'Ticked the workshop-reminder box but not marketing texts. Two emails, no text, then tagged cart-abandoned.',
      start: at(1, 12, 35),
      contact: registrant('Attended', { current_role: 'Manager', goal: 'Not sure yet', sms_consent: 'Yes', sms_marketing_consent: 'No' }),
      events: [],
      expect: { outcome: 'ended', visits: ['can-text:else', 'email-faq-e', 'goto-last', 'email-last', 'tag-abandoned'], tags: ['cart-abandoned'], stage: 'Checkout Started' },
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
      { name: 'checkout-started', note: 'Added on entry, removed on payment. Whoever has it is in recovery right now.' },
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
      body: 'With Morgan: someone who submits step 1 and does not pay. Three touches over two days, no discount, no countdown, no income claims. Someone who buys hears nothing from this workflow; their welcome belongs to 03 · Course Onboarding.',
    },
    {
      title: 'Product and order form first',
      body: 'Career Pivot Blueprint in Payments › Products with two prices: One time at $497, and Recurring monthly at $179 with Number of payments set to 3. Both sit on the offer step’s Two-Step Order form. Step 1 asks for name, email and phone; step 2 takes the card. Prices, the plan and the refund policy live in custom values, so the emails never hard-code them.',
    },
    {
      title: 'Pick the trigger that fires without payment',
      body: 'Order Form Submission with Submission Type Opt-In fires when step 1 is submitted, paid or not. Order Submitted fires only on a completed payment, which suits onboarding and could never start this one. I filtered on the funnel, the checkout page and the product, so a future offer gets its own recovery.',
    },
    {
      title: 'Find the card before moving it',
      body: 'Update Opportunity only works on an opportunity in context, and this trigger brings none. Find Opportunity picks the latest open card in Enrollment; someone with no card gets one from Create Opportunity and goes back through Find with Go To. Moving to a previous stage stays off, so a card further along is never dragged back.',
    },
    {
      title: 'Consent picks the path',
      body: 'Cart texts are marketing, so only Marketing Texts = Yes gets one; the workshop-reminder box is not enough. The order form’s Terms & Conditions checkbox is part of buying, so text consent cannot ride on it: consent to marketing texts can never be a condition of purchase. The split sits up front so each path reads top to bottom.',
    },
    {
      title: 'One goal, one exit',
      body: 'GHL allows one Goal Event per workflow and moves the contact to it from wherever they are waiting. Payment Received filtered by product, so both prices count. Anyone who arrives without paying ends there, and cart-abandoned is the step right before it: only non-buyers get the tag, and only buyers run the steps after the goal.',
    },
    {
      title: 'Timing and settings',
      body: 'The workflow Time Window of 8 AM to 8 PM in the contact’s time zone covers both emails and the text. Federal quiet hours end at 9 PM, but several states stop at 8, so 8 is the safe default. The text’s wait adds its own 10 AM to 7 PM Advance Window. Stop on Response off and Re-entry on, for the reasons in the settings.',
    },
    {
      title: 'Test with test cards, then publish',
      body: 'Funnel in test mode and one test contact per scenario: pay in the first minutes, pay on the plan, pay on day 2, never pay with and without consent, no card at all. Each run checked in the Execution Logs and on the pipeline board before publishing.',
    },
  ],
  edgeCases: [
    {
      title: 'They pay a minute after step 1',
      body: 'The usual buyer. The trigger fires on step 1 and the goal on payment, so they jump from the 1-hour wait straight to the goal and never get a nudge. The card moves to Customer and 03 sends the welcome.',
    },
    {
      title: 'Reminder consent only',
      body: 'The workshop-reminder box covers reminders, not offers, so they take the email-only path. Someone who replies STOP to a reminder after the split still gets no text: GHL skips SMS to a contact who is DND for SMS.',
    },
    {
      title: 'Checkout right after the live workshop',
      body: 'The pitch ends around 8 PM Central, so a checkout from the live session runs into quiet hours. The first email waits for the Time Window and goes out at 8 AM Friday, and the text follows on Saturday, after 10 AM.',
    },
    {
      title: 'They reply with a question',
      body: 'Stop on Response is off on purpose: ending the run would also end the goal that moves their card to Customer when they pay. The reply goes to the assigned user’s Conversations inbox, and the one remaining email still reads fine after a conversation.',
    },
    {
      title: 'They come back after another workshop',
      body: 'Allow Re-entry is on, so a new checkout after a later workshop starts a new recovery. GHL never enrolls a contact who is still active, so submitting step 1 twice in one evening changes nothing.',
    },
    {
      title: 'No card in the pipeline',
      body: 'A newsletter reader who never registered has no card, so Find Opportunity comes back empty. Create Opportunity adds one at Checkout Started, and Go To sends them back through Find, because a created opportunity is not in context for later updates.',
    },
  ],
  qa: [
    'Test mode, step 1 only: the contact enters, the card moves to Checkout Started with a $497 value, and the log shows the 1-hour wait',
    'Pay with a test card inside the hour: goal met, card at Customer, checkout-started removed, no email sent',
    'Pay on the 3 x $179 price: the goal is still met, because it filters on the product, not the price',
    'Reminder consent only: the Send SMS step never runs and the email path does',
    'Submit step 1 at 9:30 PM: the first email shows as waiting until 8 AM in the Execution Logs',
    'Never pay: cart-abandoned is added, then the run ends at the goal with nothing after it',
    'No card: exactly one new opportunity, and the later updates land on it',
    'The checkout trigger link, custom values and signature render in Gmail, Outlook and on a phone; the text is GSM-7 and at most two segments',
  ],
  snippets: [
    {
      title: 'Trigger, goal and settings',
      language: 'text',
      code: settingsSheet,
      note: 'The whole behavior comes from these few settings: Opt-In starts recovery at step 1, and the goal ends it at payment, for either price.',
    },
    {
      title: 'Email 1: honest FAQ',
      language: 'text',
      code: `Subject: ${faqSubject}\n\n${faqBody}`,
      note: 'No discount, no deadline and no promise of a job or a salary. The price, the plan and the refund policy are custom values, so a price change is one edit.',
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
