import type { Automation, Contact, RunContext } from '@/lib/ghl/types';
import { formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Enrollment pipeline, in order. Update Opportunity only moves a card forward. */
const STAGES = business.pipeline.stages;
const CUSTOMER = STAGES.indexOf('Customer');

const userName = (key: string) => business.env.users[key]?.name ?? key;

/**
 * A buyer who came through the workshop and the checkout: 01 gave them a
 * card, 02 moved it to Checkout Started, tagged them and assigned Devon.
 *
 * `order_total` is not a contact field. It stands in for the Order Total
 * that the Order Submitted trigger carries, which the plan If/Else reads.
 */
const checkoutBuyer = (fields: Contact['fields'], tags: string[], dnd: Contact['dnd'] = {}): Partial<Contact> => ({
  assignedTo: 'devon',
  tags,
  dnd,
  opportunity: { pipeline: 'Enrollment', stage: 'Checkout Started', status: 'open', value: 497 },
  fields,
});

/** Update Contact Field, three fields in one step. Only Payment Plan differs between the two branches. */
const recordPurchase = (plan: 'Yes' | 'No') => ({ fields: { purchase: 'Career Pivot Blueprint', payment_plan: plan, course_progress: 'Not started' } });

/** Add Task with Due In 1 day, Due Time 11:00 AM and Skip Weekends on. */
function videoTask({ contact, now }: RunContext) {
  const due = formatDay(nextWeekdayAt(now, 11 * 60));
  const canText = contact.fields.sms_consent === 'Yes' && !contact.dnd.sms;
  return {
    log: `Task for Jules Ortega, due ${due} at 11:00 AM: record a one-minute video for ${contact.firstName} and send it from Conversations${canText ? ', by text or email' : ' by email only, because texts are not allowed for this contact'}.`,
  };
}

const welcomeSubject = 'Welcome to {{custom_values.course_name}}: how to log in';

const welcomeBody = `Hi {{contact.first_name}},

Thank you for joining {{custom_values.course_name}}. Your access is ready now.

How to log in:
1. Go to {{custom_values.course_login}}
2. First time? Click Forgot Password and enter {{contact.email}} to set your password. If an email from our course portal with a set-password link reaches you first, that link works too.
3. Open lesson 1, "Where you are now". It takes about 12 minutes.

Questions about the lessons go to Jules, who looks after our students. Just reply to this email. Account or billing questions: {{custom_values.support_email}}.

{{custom_values.founder_first_name}}

P.S. On the payment plan? The next two payments go on the same card a month apart, with a receipt each time. To change the card: {{custom_values.update_card_link}}`;

const nudgeSubject = 'Start with lesson 1. It takes 12 minutes.';

const nudgeBody = `Hi {{contact.first_name}},

I'm {{user.first_name}}, and I look after students at {{location.name}}. You joined {{custom_values.course_name}} a few days ago and have not opened it yet. Nothing is lost, and the first step is small.

Start with lesson 1, "Where you are now". It takes about 12 minutes, and you finish it with a one-page snapshot of where you stand today.

Log in: {{custom_values.course_login}}
First time? Use Forgot Password on that page to set your password.
Cannot get in at all? Reply to this email and I will sort it out.

{{user.name}}
Student success, {{location.name}}`;

const slackPayload = `{
  "text": "New student: {{contact.name}}, {{custom_values.course_name}}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*New student:* {{contact.name}}\\n*Course:* {{custom_values.course_name}}\\n*Payment plan:* {{contact.payment_plan}}\\n*Came from:* {{contact.source}}"
      }
    },
    {
      "type": "context",
      "elements": [
        { "type": "mrkdwn", "text": "Owner: {{user.name}}. Email and phone stay in GHL." }
      ]
    }
  ]
}`;

const helpers = `03a · Students · Course Started
  Trigger    Product Started
             Product is Career Pivot Blueprint
  Action     Add Contact Tag: course-started
  Settings   Allow Re-entry off

03b · Students · Skills Inventory Done
  Trigger    Lesson Completed
             Career Pivot Blueprint, lesson 4 "Your skills inventory"
  Action     Add Contact Tag: skills-inventory-done
  Settings   Allow Re-entry off

The waits in 03 that read them
  Course started?       Specific conditions to be met
                        Contact Tag includes course-started
                        Timeout 3 days, then a second wait of 4 days
  Skills inventory?     Specific conditions to be met
                        Contact Tag includes skills-inventory-done
                        Timeout 7 days

Why helpers: a Wait can hold for time, dates, appointments, replies,
trigger-link clicks, email events and conditions on contact data.
It cannot listen for a course event, so each helper turns one course
event into a tag the wait can see. A condition wait also releases at
once if the tag is already there, so a student who opens lesson 1
before the welcome email has even sent is not treated as a no-show.`;

export const onboarding: Automation = {
  id: 'onboarding',
  number: '03',
  name: 'Course onboarding',
  kicker: 'Students',
  tagline:
    'Paying grants access, marks the sale Won and tells the team in Slack within the minute. Then the workflow watches for the first lesson, and brings in a person only for students who do not start.',
  problem:
    'People bought the course and then never opened it. Nobody noticed until a refund request came in weeks later. The login email was the only thing a new student got, the team heard about sales from Stripe, and Jules had no list of who needed help getting started.',
  evidence: {
    text: 'HighLevel’s article on the action says granting the same offer again “won’t duplicate the enrollment or reset their progress”, and that login details are not sent automatically: “you’ll need to add an email step in the workflow after the Course Grant Offer action.”',
    source: 'HighLevel Help Center, “Workflow Action - Course Grant Offer”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000003378-workflow-action-course-grant-offer',
  },
  solution:
    'The purchase itself starts onboarding. In the same minute the workflow stops the workshop and cart messages, grants the course, hands the student to Jules, marks the card Won and posts to #new-students. Then it waits up to three days for the course to start. Students who start get a plan for week one and a check on the first real exercise. Students who do not get one text if they agreed to texts, one email that asks for 12 minutes, and a personal video from Jules. A week in, anyone still not started gets an honest note that includes the refund option.',
  workflow: {
    name: '03 · Students · Course Onboarding',
    folder: 'Students',
    triggers: [{ title: 'Order Submitted', filters: ['Product is Career Pivot Blueprint'], label: 'Order Submitted (Career Pivot Blueprint)' }],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Morgan Hale',
      notes: [
        'Order Submitted fires only on a completed payment, for either price. Order Form Submission, which fires on step 1 whether or not they pay, belongs to 02. No funnel, page or source filter: the course also sells through a payment link, and that buyer should get the same onboarding.',
        'Allow Re-entry off: a second purchase of the same course is a refund to process, not a second onboarding. Upsells fire Order Submitted again but never match the product filter, and GHL notes a contact held in a wait could not enter a second time anyway, so any upsell gets its own workflow.',
        'Stop on Response off: replies are questions for Jules, and they land in her Conversations inbox. Every later step is decided by the course itself, not by whether someone replied.',
        'No workflow Time Window: access, the welcome and the Slack post must go the minute they pay, even at 11 PM. The one text sits behind its own Advance Window, 10 AM to 7 PM in the contact’s time zone.',
        'Sender: the welcome goes out as Morgan Hale, the founder. Every email after it sends from the assigned user, Jules, so replies and the conversation stay with the person who looks after students.',
        'Custom Webhook is a premium action at one cent per run, which is nothing next to a $497 sale.',
      ],
    },
    steps: [
      {
        id: 'remove',
        kind: 'action',
        action: 'remove_from_workflow',
        title: 'Remove from Workflow',
        label: 'Stop 01 and 02',
        summary:
          'Another Workflow: 01 · Workshop · Registration and Reminders and 02 · Sales · Checkout Recovery. A buyer gets no offer, no replay and no cart nudge. Because this can pull them out of 02 before its goal runs, the tag cleanup and the card update also live here.',
      },
      {
        id: 'grant',
        kind: 'action',
        action: 'course_access',
        title: 'Course Grant Offer',
        label: 'Career Pivot Blueprint',
        summary:
          'Offer: Career Pivot Blueprint, full course, published in Memberships › Offers. The product’s own Membership Offer toggle stays off, so this is the one place access is granted, and it happens before the email that says how to log in.',
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Cart tags',
        summary: 'Removes checkout-started and cart-abandoned. They describe someone who has not paid, and Smart Lists built on them must not include students.',
        effect: { removeTags: ['checkout-started', 'cart-abandoned'] },
      },
      {
        id: 'assign',
        kind: 'action',
        action: 'assign_user',
        title: 'Assign To User',
        label: 'Jules',
        summary:
          'Jules Ortega, student success. Only Apply to Unassigned Contacts is off on purpose: a buyer’s questions are about the course now, so the conversation moves from Devon’s inbox to Jules’s before the welcome email invites replies.',
        run: ({ contact }) =>
          contact.assignedTo && contact.assignedTo !== 'jules'
            ? { effect: { assignTo: 'jules' }, log: `Reassigned from ${userName(contact.assignedTo)} to Jules Ortega, student success.` }
            : { effect: { assignTo: 'jules' }, log: 'Assigned to Jules Ortega, student success.' },
      },
      {
        id: 'plan',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Paid in full or plan?',
        branches: [
          {
            label: 'Payment plan',
            when: { type: 'field', key: 'order_total', op: 'lt', value: 497, label: 'Order Total is less than 497' },
            nodes: [
              {
                id: 'record-plan',
                kind: 'action',
                action: 'update_field',
                title: 'Update Contact Field',
                label: 'Purchase, on the plan',
                summary: 'Purchase = Career Pivot Blueprint (01 reads it to keep the offer away from students), Payment Plan = Yes (04 · Billing reads it), Course Progress = Not started.',
                effect: recordPurchase('Yes'),
              },
              {
                id: 'goto-find',
                kind: 'goto',
                title: 'Go To',
                target: 'find-opp',
                summary: 'Joins the paid-in-full path at Find Opportunity, so both prices share one card update, one welcome and one wait.',
              },
            ],
          },
        ],
        otherwise: {
          label: 'Paid in full',
          nodes: [
            {
              id: 'record-full',
              kind: 'action',
              action: 'update_field',
              title: 'Update Contact Field',
              label: 'Purchase, paid in full',
              summary: 'Same three fields as the plan branch, with Payment Plan = No.',
              effect: recordPurchase('No'),
            },
            {
              id: 'find-opp',
              kind: 'ifelse',
              title: 'Find Opportunity',
              label: 'Find the Enrollment card',
              branches: [
                {
                  label: 'Opportunity Found',
                  when: { type: 'all', label: 'Latest opportunity in the Enrollment pipeline, any status', of: [{ type: 'opportunity' }] },
                  nodes: [
                    {
                      id: 'opp-won',
                      kind: 'action',
                      action: 'update_opportunity',
                      title: 'Update Opportunity',
                      label: 'Customer, Won',
                      summary:
                        'Enrollment › Customer, status Won, Opportunity Value $497. The course sale is closed, so won-revenue reports count it. Allow Opportunity to Move to Any Previous Stage stays off.',
                      run: ({ contact }) => {
                        const stage = contact.opportunity?.stage ?? '';
                        if (STAGES.indexOf(stage) > CUSTOMER) {
                          return { effect: { opportunity: { status: 'won', value: 497 } }, log: `The card is already at ${stage}. Backward moves are off, so it stays there; status Won, $497.` };
                        }
                        return { effect: { opportunity: { stage: 'Customer', status: 'won', value: 497 } }, log: `Enrollment › Customer, moved from ${stage || 'no stage'}. Status Won, $497.` };
                      },
                    },
                    {
                      id: 'email-welcome',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Welcome and login',
                      summary:
                        'From Morgan. Everything needed to log in without any other email: the portal address, Forgot Password for the first login, lesson 1 and who to ask. The payment plan line is a P.S. so full-price buyers can skip it.',
                      message: { channel: 'email', subject: welcomeSubject, body: welcomeBody },
                    },
                    {
                      id: 'slack',
                      kind: 'action',
                      action: 'webhook',
                      title: 'Custom Webhook',
                      label: '#new-students',
                      summary:
                        'Event CUSTOM, POST, Content-Type application/json, to the Slack incoming webhook for #new-students. Name, plan, source and owner only: email and phone stay in GHL. The webhook URL lives only in this step.',
                      message: {
                        channel: 'slack',
                        to: '#new-students',
                        body: 'New student: {{contact.name}}, {{custom_values.course_name}}. Payment plan: {{contact.payment_plan}}. Came from: {{contact.source}}. Owner: {{user.name}}.',
                      },
                      code: { language: 'json', source: slackPayload },
                    },
                    {
                      id: 'wait-start',
                      kind: 'wait',
                      title: 'Wait',
                      label: 'Course started?',
                      mode: 'event',
                      event: 'product_started',
                      minutes: 3 * DAY,
                      summary:
                        'Specific conditions to be met: Contact Tag includes course-started, which 03a · Course Started adds on the Product Started trigger. Timeout 3 days.',
                      branches: {
                        met: {
                          label: 'Started',
                          nodes: [
                            {
                              id: 'progress-started',
                              kind: 'action',
                              action: 'update_field',
                              title: 'Update Contact Field',
                              label: 'Course Progress: Started',
                              summary: 'Course Progress = Started, on the record and in Jules’s Smart Lists. Late starters from the nudge path join here too.',
                              effect: { fields: { course_progress: 'Started' } },
                            },
                            {
                              id: 'email-week1',
                              kind: 'action',
                              action: 'send_email',
                              title: 'Send Email',
                              label: 'Your first week',
                              summary: 'From Jules. What week one holds and where to protect an hour: lesson 4, the skills inventory, which everything after it builds on.',
                              message: {
                                channel: 'email',
                                subject: 'You started. Here is week one.',
                                body: 'Hi {{contact.first_name}},\n\nI saw you opened {{custom_values.course_name}}. Good start. Here is what the first week looks like, so you can plan around it:\n\nLessons 1 to 3: where you are now, what you are good at, and what you want next. 12 to 20 minutes each.\nLesson 4: your skills inventory. Block an hour for this one. Everything after it builds on that list.\n\nIf a lesson does not fit your field, or an exercise does not make sense, reply and tell me. I read every reply.\n\n{{user.name}}\nStudent success, {{location.name}}',
                              },
                            },
                            {
                              id: 'wait-lesson',
                              kind: 'wait',
                              title: 'Wait',
                              label: 'Skills inventory done?',
                              mode: 'event',
                              event: 'lesson_completed',
                              minutes: 7 * DAY,
                              summary:
                                'Specific conditions to be met: Contact Tag includes skills-inventory-done, which 03b adds on the Lesson Completed trigger for lesson 4. Timeout 7 days.',
                              branches: {
                                met: {
                                  label: 'Inventory done',
                                  nodes: [
                                    {
                                      id: 'progress-inventory',
                                      kind: 'action',
                                      action: 'update_field',
                                      title: 'Update Contact Field',
                                      label: 'Course Progress: Skills inventory done',
                                      summary: 'The last thing onboarding records. From here the course carries them, and 06 takes over when they finish.',
                                      effect: { fields: { course_progress: 'Skills inventory done' } },
                                    },
                                  ],
                                },
                                timeout: {
                                  label: 'Stalled after starting',
                                  nodes: [
                                    {
                                      id: 'email-stuck',
                                      kind: 'action',
                                      action: 'send_email',
                                      title: 'Send Email',
                                      label: 'Stuck on the inventory?',
                                      summary: 'From Jules. Two practical tips and an offer of a worked example, instead of "just checking in".',
                                      message: {
                                        channel: 'email',
                                        subject: 'Stuck on the skills inventory?',
                                        body: 'Hi {{contact.first_name}},\n\nYou started {{custom_values.course_name}} last week. Lesson 4, the skills inventory, asks the most of you, because it is hard to see your own experience as skills.\n\nTwo things that help:\n- Do it in two sittings. List everything first, sort it later.\n- Reply with your current role and the field you want, and I will send you a worked example for a similar move.\n\nYour login: {{custom_values.course_login}}\n\n{{user.name}}\nStudent success, {{location.name}}',
                                      },
                                    },
                                    {
                                      id: 'tag-stalled',
                                      kind: 'action',
                                      action: 'add_tag',
                                      title: 'Add Contact Tag',
                                      label: 'course-stalled',
                                      summary: 'For Jules’s "Stalled" Smart List. Started, but no skills inventory a week later.',
                                      effect: { addTags: ['course-stalled'] },
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                        },
                        timeout: {
                          label: 'Not started in 3 days',
                          nodes: [
                            {
                              id: 'wait-window',
                              kind: 'wait',
                              title: 'Wait',
                              label: 'Daytime only',
                              mode: 'time',
                              minutes: 0,
                              window: { start: '10:00', end: '19:00', days: ALL_WEEK },
                              summary:
                                'No delay, but its Advance Window only resumes between 10 AM and 7 PM in the contact’s time zone, inside the 8 AM to 8 PM limit, so the nudge never lands at night.',
                            },
                            {
                              id: 'can-text',
                              kind: 'ifelse',
                              title: 'If/Else',
                              label: 'Can we text?',
                              branches: [
                                {
                                  label: 'SMS consent',
                                  when: {
                                    type: 'all',
                                    label: 'SMS Consent is Yes, and the contact is not DND for SMS',
                                    of: [
                                      { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes' },
                                      { type: 'not', of: { type: 'dnd', channel: 'sms' } },
                                    ],
                                  },
                                  nodes: [
                                    {
                                      id: 'sms-nudge',
                                      kind: 'action',
                                      action: 'send_sms',
                                      title: 'Send SMS',
                                      label: 'Your login is ready',
                                      summary: 'An account message, not a sale, so marketing consent is not the gate, but a text still needs consent. From Jules, one link, and the opt-out line.',
                                      message: {
                                        channel: 'sms',
                                        body: "Hi {{contact.first_name}}, it's {{user.first_name}} from {{location.name}}. Your {{custom_values.course_name}} login is ready at {{custom_values.course_login}} and lesson 1 takes about 12 minutes. Trouble logging in? Reply here. Reply STOP to opt out.",
                                      },
                                    },
                                    {
                                      id: 'goto-email',
                                      kind: 'goto',
                                      title: 'Go To',
                                      target: 'email-nudge',
                                      summary: 'Joins the email path, so both paths share one email, one task and one follow-up wait.',
                                    },
                                  ],
                                },
                              ],
                              otherwise: {
                                label: 'Email only',
                                nodes: [
                                  {
                                    id: 'email-nudge',
                                    kind: 'action',
                                    action: 'send_email',
                                    title: 'Send Email',
                                    label: 'Start with lesson 1',
                                    summary: 'From Jules. One small ask: lesson 1, about 12 minutes, with the login and the first-login steps.',
                                    message: { channel: 'email', subject: nudgeSubject, body: nudgeBody },
                                  },
                                  {
                                    id: 'task-video',
                                    kind: 'action',
                                    action: 'add_task',
                                    title: 'Add Task',
                                    label: 'Personal video',
                                    summary:
                                      'Assign To Jules Ortega. Due In 1 day, Due Time 11:00 AM, Skip Weekends on. The description says to check Course Progress first: if it already says Started, close the task.',
                                    run: videoTask,
                                  },
                                  {
                                    id: 'wait-late',
                                    kind: 'wait',
                                    title: 'Wait',
                                    label: 'Started after the nudge?',
                                    mode: 'event',
                                    event: 'product_started',
                                    minutes: 4 * DAY,
                                    summary: 'The same course-started condition, with a 4-day timeout, which brings it to about a week after purchase.',
                                    branches: {
                                      met: {
                                        label: 'Started after the nudge',
                                        nodes: [
                                          {
                                            id: 'goto-started',
                                            kind: 'goto',
                                            title: 'Go To',
                                            target: 'progress-started',
                                            summary: 'Joins the Started path: Course Progress, the week-one email and the skills inventory check, all still true a few days late.',
                                          },
                                        ],
                                      },
                                      timeout: {
                                        label: 'Still not started',
                                        nodes: [
                                          {
                                            id: 'email-door',
                                            kind: 'action',
                                            action: 'send_email',
                                            title: 'Send Email',
                                            label: 'Three honest options',
                                            summary: 'From Jules. Start small, tell us what is in the way, or take the refund inside the guarantee. A refund they ask for beats a chargeback they file.',
                                            message: {
                                              channel: 'email',
                                              subject: 'Still want to do this, {{contact.first_name}}?',
                                              body: 'Hi {{contact.first_name}},\n\nIt has been about a week since you joined {{custom_values.course_name}}, and you have not opened it yet. No judgment. Here are three honest options:\n\n1. Start small. Lesson 1 takes about 12 minutes: {{custom_values.course_login}}\n2. Tell me what is in the way. Reply to this email and a person reads it.\n3. If it is not what you need, you are covered by our {{custom_values.refund_policy}}. Reply within 14 days of your purchase and we will refund what you paid.\n\n{{user.name}}\nStudent success, {{location.name}}',
                                            },
                                          },
                                          {
                                            id: 'tag-not-started',
                                            kind: 'action',
                                            action: 'add_tag',
                                            title: 'Add Contact Tag',
                                            label: 'course-not-started',
                                            summary: 'For Jules’s "Not started" Smart List. She works it every Monday, while the 14-day guarantee still applies.',
                                            effect: { addTags: ['course-not-started'] },
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
                    label: 'Won card',
                    summary:
                      'Enrollment › Customer, status Won, Lead Value $497, named after the contact and the course, source Payment Link. For a buyer who never registered for a workshop. Nothing later updates it, so there is no second Find.',
                    run: ({ contact }) => ({
                      effect: {
                        opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: `${contact.firstName} ${contact.lastName} · Career Pivot Blueprint`.trim() },
                      },
                      log: `New card: ${contact.firstName} ${contact.lastName} · Career Pivot Blueprint, Enrollment › Customer, Won, $497.`,
                    }),
                  },
                  {
                    id: 'goto-welcome',
                    kind: 'goto',
                    title: 'Go To',
                    target: 'email-welcome',
                    summary: 'Joins the main path at the welcome email.',
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
      id: 'day-one',
      label: 'Starts the same evening',
      summary: 'Buys at 8:05 PM, right after the live workshop, opens lesson 1 an hour later and finishes the skills inventory on Sunday.',
      start: at(3, 20, 5),
      contact: checkoutBuyer({ current_role: 'Manager', goal: 'A new industry', sms_consent: 'Yes', sms_marketing_consent: 'No', attended: 'Yes', order_total: 497 }, ['workshop-attended', 'checkout-started']),
      events: [
        { at: 65, type: 'product_started', label: 'Opens lesson 1. 03a adds course-started' },
        { at: at(6, 16, 30) - at(3, 20, 5), type: 'lesson_completed', label: 'Lesson 4, the skills inventory. 03b adds skills-inventory-done' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['remove', 'grant', 'untag', 'assign', 'plan:else', 'record-full', 'find-opp:0', 'opp-won', 'email-welcome', 'slack', 'wait-start:met', 'progress-started', 'email-week1', 'wait-lesson:met', 'progress-inventory'],
        stage: 'Customer',
      },
    },
    {
      id: 'after-nudge',
      label: 'Starts after the nudge',
      summary: 'Buys after the Saturday replay, then nothing for three days. The text and email go out Tuesday morning; the course gets opened that evening, then stalls before the skills inventory.',
      start: at(5, 11, 20),
      contact: checkoutBuyer({ current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'Yes', order_total: 497 }, ['workshop-replay', 'checkout-started']),
      events: [
        {
          at: at(8, 11, 34) - at(5, 11, 20),
          type: 'reply',
          value: 'Thanks! I never set a password. Doing it tonight.',
          label: 'Stop on Response is off, so the run carries on while Jules answers from Conversations',
        },
        { at: at(8, 19, 45) - at(5, 11, 20), type: 'product_started', label: 'Opens lesson 1 the evening of the nudge. 03a adds course-started' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['wait-start:timeout', 'wait-window', 'can-text:0', 'sms-nudge', 'goto-email', 'email-nudge', 'task-video', 'wait-late:met', 'goto-started', 'email-week1', 'wait-lesson:timeout', 'email-stuck', 'tag-stalled'],
        tags: ['course-stalled'],
        stage: 'Customer',
      },
    },
    {
      id: 'never',
      label: 'Never starts, opted out of texts',
      summary: 'Ticked the reminders box, then replied STOP to a workshop reminder. Buys late on Sunday and never opens the course: no text, the nudge waits for daytime, and a week later the honest note.',
      start: at(6, 21, 40),
      contact: checkoutBuyer(
        { current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'No', attended: 'Yes', order_total: 497 },
        ['workshop-attended', 'checkout-started', 'cart-abandoned'],
        { sms: true },
      ),
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'wait-start:timeout', 'wait-window', 'can-text:else', 'email-nudge', 'task-video', 'wait-late:timeout', 'email-door', 'tag-not-started'],
        tags: ['course-not-started'],
        stage: 'Customer',
      },
    },
    {
      id: 'plan',
      label: 'Payment plan, no card yet',
      summary: 'Referred by a friend, never at a workshop. Pays the first of three $179 payments through a payment link at 7:15 AM and starts the next day.',
      start: at(2, 7, 15),
      contact: { source: 'Referral', fields: { order_total: 179 } },
      events: [
        { at: at(3, 12, 40) - at(2, 7, 15), type: 'product_started', label: 'Opens lesson 1 at lunch the next day. 03a adds course-started' },
        { at: at(7, 20, 5) - at(2, 7, 15), type: 'lesson_completed', label: 'Lesson 4, the skills inventory. 03b adds skills-inventory-done' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['plan:0', 'record-plan', 'goto-find', 'find-opp:else', 'create-opp', 'goto-welcome', 'email-welcome', 'slack', 'wait-start:met', 'wait-lesson:met', 'progress-inventory'],
        stage: 'Customer',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Purchase', key: 'purchase', type: 'Single line', note: 'Career Pivot Blueprint. Written here; 01 reads it to send students their login instead of the offer' },
      { name: 'Payment Plan', key: 'payment_plan', type: 'Dropdown (single)', note: 'Yes · No. Written here from the Order Total; 04 · Billing reads it' },
      { name: 'Course Progress', key: 'course_progress', type: 'Dropdown (single)', note: 'Not started · Started · Skills inventory done · Completed. 03 writes the first three, 06 writes Completed' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'Unticked by default and optional. With no SMS DND, the only thing that allows the nudge text' },
    ],
    tags: [
      { name: 'course-started', note: 'Added by 03a on Product Started. The first two waits release on it' },
      { name: 'skills-inventory-done', note: 'Added by 03b on Lesson Completed for lesson 4. The last wait releases on it' },
      { name: 'course-stalled', note: 'Started, but no skills inventory a week later. Jules’s "Stalled" Smart List' },
      { name: 'course-not-started', note: 'Nothing opened about a week after purchase. Jules’s "Not started" Smart List' },
      { name: 'checkout-started', note: 'From 02. Removed here the moment they pay' },
      { name: 'cart-abandoned', note: 'From an earlier run of 02. Also removed here, so a student never lands in a cart Smart List' },
    ],
    pipeline: { name: 'Enrollment', stages: [...STAGES] },
    customValues: [
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Course Login', key: 'course_login', value: 'trailheadcareers.example/portal' },
      { name: 'Support Email', key: 'support_email', value: 'help@trailheadcareers.example' },
      { name: 'Refund Policy', key: 'refund_policy', value: '14-day money-back guarantee' },
      { name: 'Update Card Link', key: 'update_card_link', value: 'trailheadcareers.example/billing' },
      { name: 'Founder First Name', key: 'founder_first_name', value: 'Morgan' },
    ],
  },
  build: [
    {
      title: 'Agree what onboarded means',
      body: 'With Morgan and Jules: access within a minute of paying, a start within three days, and the skills inventory in the first week, because every later lesson builds on it. Automation does the routine part, and a person steps in only for someone who has not started. Lesson 1 was cut to about 12 minutes on purpose, because it is the one the nudge asks for.',
    },
    {
      title: 'Offer before workflow',
      body: 'The course sits in Memberships with a published offer, Career Pivot Blueprint. The product in Payments has two prices, $497 once and 3 monthly payments of $179, and I left its Membership Offer toggle off, so the workflow is the one place access is granted, always before the email that explains how to log in. The login page, support email, refund policy and card-update page are custom values.',
    },
    {
      title: 'Trigger on the payment',
      body: 'Order Submitted fires on a completed purchase; Order Form Submission, which also fires for unpaid checkouts, belongs to 02. The only filter is the product, so a payment link sale gets the same onboarding and an upsell never matches. The first step removes the contact from 01 and 02, so nobody gets an offer or a cart nudge for what they just bought.',
    },
    {
      title: 'The first minute',
      body: 'Course Grant Offer, then the cart tags come off and Jules becomes the owner, before the welcome invites replies. An If/Else on the trigger’s Order Total sets Payment Plan for 04. Update Opportunity needs a card in context, so Find Opportunity comes first; a buyer with no card gets one from Create Opportunity, already at Customer and Won, and joins the welcome with Go To.',
    },
    {
      title: 'Tell the team in Slack, without personal data',
      body: 'A Custom Webhook posts to a Slack incoming webhook bound to #new-students: Event CUSTOM, POST, JSON body. It carries the name, plan, source and owner, never the email or phone. The incoming webhook only posts to that one channel and does not depend on anyone’s Slack login, and its URL lives only in this step.',
    },
    {
      title: 'Turn course events into tags',
      body: 'A Wait cannot listen for Product Started or Lesson Completed. Two one-action helpers, 03a and 03b, turn those course triggers into tags, and the waits here use Specific conditions to be met on the tags, with timeouts. A condition wait also releases at once if the tag is already on the record, so a very fast starter is never nudged.',
    },
    {
      title: 'Nudge with consent, then a person',
      body: 'After three days without a start: an Advance Window of 10 AM to 7 PM, then an If/Else on SMS Consent and SMS DND. The text is about account access, not a sale, so marketing consent is not the gate, but it is still a text. Then one email that asks for 12 minutes and a video task for Jules. A second wait catches late starters and sends them to the week-one path with Go To.',
    },
    {
      title: 'Test with a real test student',
      body: 'Funnel and payment link in test mode, test cards, one contact per scenario above. For each: log in to the portal as the student in a private window, open lesson 1, check that 03a added the tag, then read the Execution Logs, #new-students, Jules’s task list and the card before publishing.',
    },
  ],
  edgeCases: [
    {
      title: 'They buy at 11 PM',
      body: 'Access, the welcome and the Slack post go at once, because there is no workflow Time Window. The only text is three days later, behind a 10 AM to 7 PM Advance Window.',
    },
    {
      title: 'Consent on file, but they texted STOP',
      body: 'STOP switches on SMS DND, and the If/Else checks DND as well as the checkbox, so they take the email-only path. Jules’s task says to send the video by email.',
    },
    {
      title: 'They start after the nudge',
      body: 'The second wait releases on the same tag and Go To sends them down the Started path. Jules’s task is still open, so its description tells her to check Course Progress first and close it if it says Started.',
    },
    {
      title: 'The login email never arrives',
      body: 'The help center says both that access emails go out and that login details are "Not automatically" sent, so the welcome does not rely on either: portal address, Forgot Password for the first login, and a reply goes to Jules. The learner magic link merge field only works with Courses triggers, and this one is Order Submitted, so the login link is a custom value.',
    },
    {
      title: 'Payment plan buyers',
      body: 'Full access on the first payment, with the plan explained in the welcome. Payment Plan = Yes tells 04 · Billing that a failed charge is an installment. Whether a lapsed plan loses access is 04’s decision, not this workflow’s.',
    },
    {
      title: 'Bought through a payment link, no card',
      body: 'Find Opportunity comes back empty, so Create Opportunity adds one at Customer, already Won. Nothing later in this workflow updates it, so there is no second Find, and because Create only runs when Find came back empty, nobody ends up with two cards.',
    },
  ],
  qa: [
    'Test purchase at full price: the student can log in within a minute, the card is at Customer and Won with $497, Payment Plan is No and Jules is the owner',
    'Test purchase on the 3 x $179 price: the plan branch runs and Payment Plan is Yes',
    'A test student buys during a workshop: removed from 01 and 02 in the same minute, and checkout-started is gone',
    'The #new-students post shows name, plan, source and owner, and no email or phone',
    'Open lesson 1 as the test student: 03a adds course-started, the wait releases and the week-one email arrives',
    'Never open it: at 3 days the text (consent, no DND) and the email go out between 10 AM and 7 PM, and Jules has a task due the next weekday at 11 AM',
    'A test contact with SMS DND: no Send SMS in the Execution Logs, only the email path',
    'Every merge field and the login steps check out in Gmail, Outlook and on a phone; the text is GSM-7 and at most two segments',
  ],
  snippets: [
    {
      title: 'Slack post (Custom Webhook raw body)',
      language: 'json',
      code: slackPayload,
      note: 'Event CUSTOM, Method POST, Content-Type application/json, URL is the Slack incoming webhook for #new-students. Only names and dropdown values go into the JSON, so nothing needs escaping.',
    },
    {
      title: 'Helper workflows 03a and 03b',
      language: 'text',
      code: helpers,
      note: 'One trigger and one action each. They exist so the waits in 03 have something on the contact record to watch.',
    },
    {
      title: 'Welcome email',
      language: 'text',
      code: `Subject: ${welcomeSubject}\n\n${welcomeBody}`,
      note: 'Works even if the portal’s own set-password email never arrives. Sent as Morgan; replies land with Jules, the assigned user.',
    },
  ],
  features: [
    'Order Submitted',
    'Remove from Workflow',
    'Course Grant Offer',
    'Remove Contact Tag',
    'Assign To User',
    'If/Else',
    'Update Contact Field',
    'Find Opportunity',
    'Update Opportunity',
    'Create Opportunity',
    'Go To',
    'Send Email',
    'Custom Webhook',
    'Wait · Specific conditions to be met',
    'Wait · Advance Window',
    'Product Started',
    'Lesson Completed',
    'Send SMS',
    'Add Task',
    'Add Contact Tag',
  ],
};
