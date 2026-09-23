import type { Automation, Contact, RunContext } from '@/lib/ghl/types';
import { formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/**
 * Enrollment pipeline, in order. The first four stages are the course sale;
 * Applied, Call Booked and Coaching Client belong to the 1:1 coaching deal
 * that 05 runs, which this workflow must never close as a $497 sale.
 */
const STAGES = business.pipeline.stages;
const CUSTOMER = STAGES.indexOf('Customer');
const COURSE_STAGES = STAGES.slice(0, CUSTOMER + 1);
const COACHING_STAGES = STAGES.slice(CUSTOMER + 1);

const COURSE = 'Career Pivot Blueprint';
const LESSON_1 = 'Where you are now';
const LESSON_4 = 'Your skills inventory';

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
  opportunity: { pipeline: 'Enrollment', stage: 'Checkout Started', status: 'open', value: 497, name: 'Marcus Lee · Workshop' },
  fields,
});

/** Update Contact Field, three fields in one step. Only Payment Plan differs between the two branches. */
const recordPurchase = (plan: 'Yes' | 'No') => ({ fields: { purchase: COURSE, payment_plan: plan, course_progress: 'Not started' } });

const canText = (c: Contact) => c.fields.sms_consent === 'Yes' && !c.dnd.sms;

/** Add Task: Assign To Jules Ortega, Due In 1 day, Due Time 11:00 AM, Skip Weekends on. */
function videoTask({ contact, now }: RunContext) {
  const due = formatDay(nextWeekdayAt(now, 11 * 60));
  const text = canText(contact);
  const email = !contact.dnd.email;
  const how =
    text && email
      ? 'by text or email'
      : text
        ? 'by text only, because Email DND is on'
        : email
          ? 'by email only, because texts are not allowed for this contact'
          : 'nowhere: no texts and Email DND is on, so she calls instead';
  return {
    log: `Task for Jules Ortega, due ${due} at 11:00 AM: record a one-minute video for ${contact.firstName} and send it from Conversations ${how}. First check Course Progress; if it says Started, close the task.`,
  };
}

/** Add Task: Assign To Jules Ortega, Due In Now. */
function loginTask({ contact }: RunContext) {
  return {
    log: `Task for Jules Ortega, due now: call ${contact.firstName} ${contact.lastName} and walk them through the first login. Email DND is on, so the welcome and every later email in this workflow are skipped. ${
      canText(contact) ? 'Texts are allowed, so she can also text the login page from Conversations.' : 'No text consent, so the call is the only way to reach them.'
    }`,
  };
}

/** Postal address under every email. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';
const julesSign = '{{user.name}}\nStudent success';

const welcomeSubject = 'Welcome to {{custom_values.course_name}}: how to log in';

const welcomeBody = `Hi {{contact.first_name}},

Thank you for joining {{custom_values.course_name}}. Your access is ready now.

How to log in:
1. Go to {{custom_values.course_login}}
2. First time? Click Forgot Password and enter {{contact.email}} to set your password. If an email from our course portal with a set-password link reaches you first, that link works too.
3. Open lesson 1, "Where you are now". It takes about 12 minutes.

Questions about the lessons go to Jules, who looks after our students. Just reply to this email. Account or billing questions: {{custom_values.support_email}}.

{{custom_values.founder_first_name}}

P.S. On the payment plan? The next two payments go on the same card a month apart. To change the card: {{custom_values.update_card_link}}${footer}`;

const nudgeSubject = 'Start with lesson 1. It takes 12 minutes.';

const nudgeBody = `Hi {{contact.first_name}},

I'm {{user.first_name}}, and I look after students at {{location.name}}. You joined {{custom_values.course_name}} a few days ago and have not opened it yet. Nothing is lost, and the first step is small.

Start with lesson 1, "Where you are now". It takes about 12 minutes, and you finish it with a one-page snapshot of where you stand today.

Log in: {{custom_values.course_login}}
First time? Use Forgot Password on that page to set your password.
Cannot get in at all? Reply to this email and I will sort it out.

${julesSign}${footer}`;

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
             Product is any of Career Pivot Blueprint
  Action     Add Contact Tag: course-started
  Settings   Allow Re-entry off

03b · Students · Skills Inventory Done
  Trigger    Lesson Completed
             Product: Career Pivot Blueprint
             Category: Week one
             Lesson: Your skills inventory (lesson 4)
  Action     Add Contact Tag: skills-inventory-done
  Settings   Allow Re-entry off

The waits in 03 that read them
  Course started?       Specific conditions to be met
                        Contact Tag includes course-started
                        Timeout 3 days, then a second wait of 4 days
  Skills inventory?     Specific conditions to be met
                        Contact Tag includes skills-inventory-done
                        Timeout 7 days

Why helpers: the Wait action can hold for time, dates, schedules,
appointments, replies, trigger-link clicks, email events and
conditions on contact data. It cannot listen for a course event, so
each helper turns one course event into a tag a condition wait can
see. The contact moves on as soon as a segment is true, so a student
who opens lesson 1 before the welcome email has even sent is not
treated as a no-show. Lessons 1 to 3 add nothing, so only the skills
inventory releases the second wait.`;

export const onboarding: Automation = {
  id: 'onboarding',
  number: '03',
  name: 'Course onboarding',
  kicker: 'Students',
  tagline:
    'Paying grants access, marks the sale Won and tells the team in Slack within the minute. Then the workflow watches for the first lesson, and brings in a person only for students who do not start or cannot be emailed.',
  problem:
    'People bought the course and then never opened it. Nobody noticed until the refund requests came in. The login email was the only thing a new student got, the team heard about sales from Square’s emails, and Jules had no list of who needed help getting started.',
  evidence: {
    text: 'HighLevel’s article on the action says granting the same offer again “won’t duplicate the enrollment or reset their progress”, and that login details are not sent automatically: “you’ll need to add an email step in the workflow after the Course Grant Offer action.”',
    source: 'HighLevel Help Center, “Workflow Action - Course Grant Offer”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000003378-workflow-action-course-grant-offer',
  },
  solution:
    'The purchase itself starts onboarding. In the same minute the workflow stops the workshop and cart messages, grants the course, hands the student to Jules, marks the course card Won and posts to #new-students. A student with Email DND gets a call from Jules instead of a welcome that GHL would skip. Then the workflow waits up to three days for the course to start. Students who start get a plan for week one and a check on the first real exercise. Students who do not get one text if they agreed to course texts, one email that asks for 12 minutes, and a personal video from Jules. A week in, anyone still not started gets an honest note that includes the refund option.',
  workflow: {
    name: '03 · Students · Course Onboarding',
    folder: 'Students',
    triggers: [{ title: 'Order Submitted', filters: ['Global Product is Career Pivot Blueprint'], label: 'Order Submitted (Career Pivot Blueprint)' }],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Morgan Hale',
      exits: [
        {
          event: 'tag_added',
          value: 'access-paused',
          by: '04 · Billing · Failed Payment Recovery pauses course access on day 10 of an unpaid installment, tags access-paused and removes the contact from this workflow, so no "log in" nudge reaches someone who cannot. This run is over about two weeks after purchase and the second installment is due a month in, so it is a guard rather than a path anyone takes today.',
        },
      ],
      notes: [
        'Trigger: Order Submitted, Global Product is Career Pivot Blueprint, which covers both prices. It fires on a completed payment; Order Form Submission, which fires on step 1 whether or not they pay, belongs to 02. No Submission Type, funnel, page or source filter: Submission Type Primary describes order-form checkouts only, and this workflow is the one place access is granted, so a payment-link sale or a future bump must not slip past it.',
        'Allow Re-entry off: a second order of the same course is a mistake to refund, not a second onboarding. Other products fire Order Submitted too but never match the filter, and a contact held in a wait could not enter a second time anyway. The one cost: someone who refunded and buys again later gets no second run, so the refund SOP says Sasha grants their offer by hand.',
        'Stop on Response off: replies are questions for Jules, and they land in her Conversations inbox. Every later step is decided by the course itself, not by whether someone replied.',
        'No workflow Time Window: access, the welcome and the Slack post must go the minute they pay, even at 11 PM. The one text sits behind its own Advance Window, 10 AM to 7 PM in the contact’s time zone.',
        'Sender Details: From Name Morgan Hale, From Email morgan@trailheadcareers.example, for the welcome. The four emails from Jules override From Name and From Email at the step with hers, because this workflow makes her the owner and her name is in the signature.',
        'Every email here delivers or supports a course the student paid for, which CAN-SPAM treats as transactional or relationship content. They still end with the business name and {{location.full_address}}, and Include Unsubscribe Link (Business Profile › General) stays on. An unsubscribe switches on Email DND for every email, billing included, which is why 03 and 04 both check it.',
        'Custom Webhook is a premium action, billed per execution: one per sale.',
        'One opportunity model across the case: the course card moves Registered, Attended, Checkout Started, Customer, and 03 marks it Won at Customer for $497; a coaching deal is a separate card that 05 creates at Applied, then Call Booked and Coaching Client. Find Opportunity here skips the coaching stages, so an open coaching card is never closed as a course sale.',
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
          'Another Workflow: 01 · Workshop · Registration and Reminders and 02 · Sales · Checkout Recovery. A buyer gets no offer, no replay and no cart nudge. Because this can pull them out of 02 before its goal runs, the tag cleanup comes next and the card update follows, writing what 02’s goal would have written.',
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'Cart tags',
        summary: 'Removes checkout-started and cart-abandoned, the same two tags 02 removes after its goal. They describe someone who has not paid, and Smart Lists built on them must not include students.',
        effect: { removeTags: ['checkout-started', 'cart-abandoned'] },
      },
      {
        id: 'grant',
        kind: 'action',
        action: 'course_access',
        title: 'Course Grant Offer',
        label: 'Career Pivot Blueprint',
        summary:
          'Offer: Career Pivot Blueprint, published under Memberships › Offers. The product’s own Membership Offer toggle stays off, so this step is the one place access is granted (04 revokes and re-grants the same offer), and it runs before any email that says how to log in.',
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
                summary: 'Purchase = Career Pivot Blueprint (01 and 05 read it to keep the course pitch away from students), Payment Plan = Yes (04 · Billing · Failed Payment Recovery shows it to Sasha), Course Progress = Not started.',
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
              label: 'Find the course card',
              branches: [
                {
                  label: 'Opportunity Found',
                  when: {
                    type: 'any',
                    label: `Latest opportunity where Pipeline is Enrollment and Stage is not ${COACHING_STAGES.join(', ').replace(/, ([^,]*)$/, ' or $1')}, any status`,
                    of: COURSE_STAGES.map((stage) => ({ type: 'opportunity' as const, stage })),
                  },
                  nodes: [
                    {
                      id: 'opp-won',
                      kind: 'action',
                      action: 'update_opportunity',
                      title: 'Update Opportunity',
                      label: 'Customer, Won',
                      summary:
                        'Enrollment › Customer, status Won, Opportunity Value $497, Opportunity Name "{{contact.name}} · Career Pivot Blueprint". The Find filter keeps coaching stages out, so the move is always forward or in place and Allow Opportunity to Move to Any Previous Stage stays off. A card 02 already won gets the same values again.',
                      run: ({ contact }) => {
                        const stage = contact.opportunity?.stage ?? '';
                        const name = `${contact.firstName} ${contact.lastName} · ${COURSE}`;
                        return {
                          effect: { opportunity: { stage: 'Customer', status: 'won', value: 497, name } },
                          log: stage === 'Customer' ? `Already at Customer, so only the values are written again: Won, $497, "${name}".` : `Enrollment › Customer, moved from ${stage}. Status Won, $497, renamed "${name}".`,
                        };
                      },
                    },
                    {
                      id: 'slack',
                      kind: 'action',
                      action: 'webhook',
                      title: 'Custom Webhook',
                      label: '#new-students',
                      summary:
                        'Event CUSTOM, Method POST, Content-Type application/json, to the Slack incoming webhook for #new-students. Name, plan, source and owner only: email and phone stay in GHL. The webhook URL lives only in this step, never in a custom value or a message.',
                      message: {
                        channel: 'slack',
                        to: '#new-students',
                        body: 'New student: {{contact.name}}, {{custom_values.course_name}}. Payment plan: {{contact.payment_plan}}. Came from: {{contact.source}}. Owner: {{user.name}}.',
                      },
                      code: { language: 'json', source: slackPayload },
                    },
                    {
                      id: 'can-email',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Can we email?',
                      branches: [
                        {
                          label: 'Email DND on',
                          when: { type: 'all', label: 'Contact is DND for Email (unsubscribed, marked as spam or bounced)', of: [{ type: 'dnd', channel: 'email' }] },
                          nodes: [
                            {
                              id: 'task-login',
                              kind: 'action',
                              action: 'add_task',
                              title: 'Add Task',
                              label: 'Call with the login',
                              summary:
                                'Assign To Jules Ortega, Due In Now. GHL skips every Send Email step for a contact with Email DND, the welcome included, so a person gets the login to them. I never switch DND off to push the welcome through: the contact set it, or the address does not work.',
                              run: loginTask,
                            },
                            {
                              id: 'goto-start',
                              kind: 'goto',
                              title: 'Go To',
                              target: 'wait-start',
                              summary: 'Back on the main path at the start wait, so Course Progress, the tags and the one text still apply. The emails after it are skipped by DND.',
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'Email allowed',
                        nodes: [
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
                            id: 'wait-start',
                            kind: 'wait',
                            title: 'Wait',
                            label: 'Course started?',
                            mode: 'event',
                            event: 'product_started',
                            value: COURSE,
                            minutes: 3 * DAY,
                            summary:
                              'Specific conditions to be met: Contact Tag includes course-started, which 03a · Students · Course Started adds on the Product Started trigger. Timeout 3 days.',
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
                                      body: `Hi {{contact.first_name}},\n\nI saw you opened {{custom_values.course_name}}. Good start. Here is what the first week looks like, so you can plan around it:\n\nLessons 1 to 3: where you are now, what you are good at, and what you want next. 12 to 20 minutes each.\nLesson 4: your skills inventory. Block an hour for this one. Everything after it builds on that list.\n\nIf a lesson does not fit your field, or an exercise does not make sense, reply and tell me. I read every reply.\n\n${julesSign}${footer}`,
                                    },
                                  },
                                  {
                                    id: 'wait-lesson',
                                    kind: 'wait',
                                    title: 'Wait',
                                    label: 'Skills inventory done?',
                                    mode: 'event',
                                    event: 'lesson_completed',
                                    value: LESSON_4,
                                    minutes: 7 * DAY,
                                    summary:
                                      'Specific conditions to be met: Contact Tag includes skills-inventory-done, which 03b adds on the Lesson Completed trigger for lesson 4 only. Finishing lessons 1 to 3 does not release it. Timeout 7 days.',
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
                                              body: `Hi {{contact.first_name}},\n\nYou started {{custom_values.course_name}} last week. Lesson 4, the skills inventory, asks the most of you, because it is hard to see your own experience as skills.\n\nTwo things that help:\n- Do it in two sittings. List everything first, sort it later.\n- Reply with your current role and the field you want, and I will send you a worked example for a similar move.\n\nYour login: {{custom_values.course_login}}\n\n${julesSign}${footer}`,
                                            },
                                          },
                                          {
                                            id: 'tag-stalled',
                                            kind: 'action',
                                            action: 'add_tag',
                                            title: 'Add Contact Tag',
                                            label: 'course-stalled',
                                            summary: 'For Jules’s "Stalled" Smart List. Started, but no skills inventory a week later. 06 removes it when they finish.',
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
                                      'A set period of time, 0 minutes, with Advance Window: Resume On every day, Resume Between Hours 10:00 AM and 7:00 PM in the contact’s time zone. Inside the 8 AM to 8 PM limit, so the nudge never lands at night.',
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
                                          label: 'SMS consent (service) is Yes, and the contact is not DND for SMS',
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
                                            label: 'Your login page',
                                            summary:
                                              'A course notice, not an offer, so the service box is the gate: it reads "if I enroll, course and billing notices". SMS consent (offers) is never read here. From Jules, one link, and the opt-out line.',
                                            message: {
                                              channel: 'sms',
                                              body: "Hi {{contact.first_name}}, it's {{user.first_name}} from {{location.name}}. Your {{custom_values.course_name}} login page is {{custom_values.course_login}} (first time? use Forgot Password). Lesson 1 takes about 12 minutes. Stuck? Reply here. Reply STOP to opt out.",
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
                                            'Assign To Jules Ortega. Due In 1 day, Due Time 11:00 AM, Skip Weekends on. The description names the channels she may use and says to check Course Progress first: if it already says Started, close the task.',
                                          run: videoTask,
                                        },
                                        {
                                          id: 'wait-late',
                                          kind: 'wait',
                                          title: 'Wait',
                                          label: 'Started after the nudge?',
                                          mode: 'event',
                                          event: 'product_started',
                                          value: COURSE,
                                          minutes: 4 * DAY,
                                          summary: 'The same course-started condition, with a 4-day timeout, which brings it to about a week after purchase and inside the 14-day guarantee.',
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
                                                    body: `Hi {{contact.first_name}},\n\nIt has been about a week since you joined {{custom_values.course_name}}, and you have not opened it yet. No judgment. Here are three honest options:\n\n1. Start small. Lesson 1 takes about 12 minutes: {{custom_values.course_login}}\n2. Tell me what is in the way. Reply to this email and a person reads it.\n3. If it is not what you need, you are covered by our {{custom_values.refund_policy}}. Reply within 14 days of your purchase and we will refund what you paid. On the payment plan, we also cancel the payments still to come.\n\n${julesSign}${footer}`,
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
                    label: 'Won course card',
                    summary:
                      'Enrollment › Customer, status Won, Opportunity Value $497, named "{{contact.name}} · Career Pivot Blueprint". Duplicate Opportunity on, with Allow Multiple Opportunities per Contact on in Sub-Account Settings › Objects › Opportunities, so a contact whose only card is a coaching deal still gets a course card. It only runs when Find came back empty, so it never makes a second course card, and nothing later updates it, so there is no second Find.',
                    run: ({ contact }) => {
                      const prev = contact.opportunity;
                      const name = `${contact.firstName} ${contact.lastName} · ${COURSE}`;
                      return {
                        effect: { opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name } },
                        log: `New card "${name}", Enrollment › Customer, Won, $497.${prev ? ` The ${prev.stage} card (${prev.status}) stays as it is for Devon.` : ''}`,
                      };
                    },
                  },
                  {
                    id: 'goto-slack',
                    kind: 'goto',
                    title: 'Go To',
                    target: 'slack',
                    summary: 'Joins the main path at the Slack post, so the email check and the welcome are the same for every buyer.',
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
        { at: 65, type: 'product_started', value: COURSE, label: 'Opens lesson 1. 03a adds course-started' },
        { at: at(6, 16, 30) - at(3, 20, 5), type: 'lesson_completed', value: LESSON_4, label: 'Lesson 4, the skills inventory. 03b adds skills-inventory-done' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['remove', 'grant', 'untag', 'assign', 'plan:else', 'record-full', 'find-opp:0', 'opp-won', 'slack', 'can-email:else', 'email-welcome', 'wait-start:met', 'progress-started', 'email-week1', 'wait-lesson:met', 'progress-inventory'],
        stage: 'Customer',
      },
    },
    {
      id: 'after-nudge',
      label: 'Starts after the nudge, then stalls',
      summary:
        'Buys after the Saturday replay, then nothing for three days. The text and email go out Tuesday; the course gets opened that evening and lesson 1 finished, but not the skills inventory.',
      start: at(5, 11, 20),
      contact: checkoutBuyer({ current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'Yes', order_total: 497 }, ['workshop-replay', 'checkout-started']),
      events: [
        {
          at: at(8, 11, 34) - at(5, 11, 20),
          type: 'reply',
          value: 'Thanks! I never set a password. Doing it tonight.',
          label: 'Stop on Response is off, so the run carries on while Jules answers from Conversations',
        },
        { at: at(8, 19, 45) - at(5, 11, 20), type: 'product_started', value: COURSE, label: 'Opens lesson 1 the evening of the nudge. 03a adds course-started' },
        { at: at(8, 20, 5) - at(5, 11, 20), type: 'lesson_completed', value: LESSON_1, label: 'Lesson 1 only. 03b ignores it, so the inventory wait keeps waiting' },
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
      summary:
        'Ticked the reminders box, then replied STOP to a workshop reminder. Buys late on Sunday and never opens the course: no text, the nudge waits for daytime, and a week later the honest note.',
      start: at(6, 21, 40),
      contact: checkoutBuyer(
        { current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'No', attended: 'Yes', order_total: 497 },
        ['workshop-attended', 'checkout-started', 'cart-abandoned'],
        { sms: true },
      ),
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['untag', 'can-email:else', 'wait-start:timeout', 'wait-window', 'can-text:else', 'email-nudge', 'task-video', 'wait-late:timeout', 'email-door', 'tag-not-started'],
        tags: ['course-not-started'],
        stage: 'Customer',
      },
    },
    {
      id: 'plan',
      label: 'Payment plan, after a strategy call',
      summary:
        'Heard Morgan on a podcast and applied for 1:1 coaching without going to a workshop, so their only card is the coaching deal at Call Booked. On the strategy call Devon suggested the course first and sent a payment link. Pays the first of three $179 payments on Wednesday afternoon and gets a course card of its own.',
      start: at(2, 13, 40),
      contact: {
        assignedTo: 'devon',
        source: 'Podcast',
        tags: ['call-booked'],
        opportunity: { pipeline: 'Enrollment', stage: 'Call Booked', status: 'open', value: 0, name: 'Marcus Lee · 1:1 Pivot Coaching' },
        fields: { current_role: 'Between roles', sms_consent: 'No', sms_marketing_consent: 'No', application_score: 72, order_total: 179 },
      },
      events: [
        { at: at(3, 12, 40) - at(2, 13, 40), type: 'product_started', value: COURSE, label: 'Opens lesson 1 at lunch the next day. 03a adds course-started' },
        { at: at(6, 20, 5) - at(2, 13, 40), type: 'lesson_completed', value: LESSON_4, label: 'Lesson 4, the skills inventory. 03b adds skills-inventory-done' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['plan:0', 'record-plan', 'goto-find', 'find-opp:else', 'create-opp', 'goto-slack', 'slack', 'can-email:else', 'email-welcome', 'wait-start:met', 'wait-lesson:met', 'progress-inventory'],
        stage: 'Customer',
      },
    },
    {
      id: 'email-dnd',
      label: 'Unsubscribed from email',
      summary:
        'Clicked unsubscribe on a workshop follow-up weeks ago, so Email DND is on. Buys on a Tuesday afternoon. The welcome would be skipped, so Jules gets a task due now, calls, and they open lesson 1 while she is on the phone.',
      start: at(1, 13, 10),
      contact: checkoutBuyer({ current_role: 'Manager', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'No', order_total: 497 }, ['workshop-replay', 'checkout-started'], { email: true }),
      events: [
        { at: 170, type: 'product_started', value: COURSE, label: 'Opens lesson 1 during Jules’s call. 03a adds course-started' },
        { at: at(5, 10, 15) - at(1, 13, 10), type: 'lesson_completed', value: LESSON_4, label: 'Lesson 4, the skills inventory. 03b adds skills-inventory-done' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['find-opp:0', 'opp-won', 'slack', 'can-email:0', 'task-login', 'goto-start', 'wait-start:met', 'progress-started', 'wait-lesson:met', 'progress-inventory'],
        skips: ['email-week1'],
        stage: 'Customer',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Purchase', key: 'purchase', type: 'Single line', note: 'Career Pivot Blueprint. Written here; 01 and 05 read it to keep the course pitch away from students' },
      { name: 'Payment Plan', key: 'payment_plan', type: 'Dropdown (single)', note: 'Yes · No. Written here from the Order Total; shown in the Slack post and in Sasha’s notifications from 04' },
      { name: 'Course Progress', key: 'course_progress', type: 'Dropdown (single)', note: 'Not started · Started · Skills inventory done · Completed. 03 writes the first three, 06 writes Completed' },
      { name: 'SMS consent (service)', key: 'sms_consent', type: 'Checkbox', note: 'The reminders box: "workshop reminders and, if I enroll, course and billing notices". Unticked by default and optional. With no SMS DND, the only thing that allows the nudge text' },
    ],
    tags: [
      { name: 'course-started', note: 'Added by 03a on Product Started. The first two waits release on it' },
      { name: 'skills-inventory-done', note: 'Added by 03b on Lesson Completed for lesson 4 only. The last wait releases on it' },
      { name: 'course-stalled', note: 'Started, but no skills inventory a week later. Jules’s "Stalled" Smart List; 06 removes it' },
      { name: 'course-not-started', note: 'Nothing opened about a week after purchase. Jules’s "Not started" Smart List; 06 removes it' },
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
      body: 'With Morgan and Jules: access within a minute of paying, a start within three days, and the skills inventory in the first week, because every later lesson builds on it. Automation does the routine part, and a person steps in only for someone who has not started or cannot be emailed. Lesson 1 was cut to about 12 minutes on purpose, because it is the one the nudge asks for.',
    },
    {
      title: 'Offer before workflow',
      body: 'The course sits in Memberships with a published offer, Career Pivot Blueprint. The product in Payments has two prices, $497 once and 3 monthly payments of $179, and I left its Membership Offer toggle off, so workflows are the one place access is granted: 03 grants it, 04 revokes and re-grants it. That also means 03 must never sit in Draft; the SOP says so. The login page, support email, refund policy and card-update page are custom values.',
    },
    {
      title: 'Trigger on the payment',
      body: 'Order Submitted fires on a completed purchase; Order Form Submission, which also fires for unpaid checkouts, belongs to 02. The only filter is Global Product, so a payment-link sale gets the same onboarding and a bump or upsell of another product never matches. I left Submission Type out: Primary describes order-form checkouts, and a filter that missed a payment-link buyer would leave them with no access. The first step removes the contact from 01 and 02.',
    },
    {
      title: 'The first minute',
      body: 'Remove from Workflow (01 and 02) and the cart tags come off first, then Course Grant Offer, and Jules becomes the owner before anything invites replies. An If/Else on the trigger’s Order Total sets Payment Plan; there are no coupons on this product, so anything under $497 is the first installment. If Morgan ever adds one, that condition moves to the price. Update Opportunity needs a card in context, so Find Opportunity comes first, filtered to the course stages so a coaching deal at Applied, Call Booked or Coaching Client is never closed as a $497 sale. No course card means Create Opportunity, already Won, and a Go To back to the main path.',
    },
    {
      title: 'Tell the team, then check email',
      body: 'A Custom Webhook posts to a Slack incoming webhook bound to #new-students: Event CUSTOM, POST, JSON body with the name, plan, source and owner, never the email or phone. The incoming webhook only posts to that one channel and does not depend on anyone’s Slack login. Then an If/Else on Email DND: GHL skips every email for those contacts, so they get a call from Jules instead of a welcome that never sends.',
    },
    {
      title: 'Turn course events into tags',
      body: 'A Wait cannot listen for Product Started or Lesson Completed. Two one-action helpers, 03a and 03b, turn those course triggers into tags, and the waits here use Specific conditions to be met on the tags, with timeouts. 03b filters on lesson 4 itself, so finishing lessons 1 to 3 does not count as the skills inventory. The learner magic link can only be used with Courses triggers, so the welcome, sent from an Order Submitted workflow, uses the portal address and Forgot Password instead.',
    },
    {
      title: 'Nudge with consent, then a person',
      body: 'After three days without a start: an Advance Window of 10 AM to 7 PM, then an If/Else on SMS consent (service) and SMS DND. The reminders box on the workshop form covers "if I enroll, course and billing notices", so an access nudge fits it; SMS consent (offers) is not the gate. Then one email that asks for 12 minutes and a video task for Jules. A second wait catches late starters and sends them to the week-one path with Go To.',
    },
    {
      title: 'Test with a real test student',
      body: 'Square Test Mode with a sandbox account, test cards, one contact per scenario above, including one with Email DND and one whose only card is at Call Booked. For each: log in to the portal as the student in a private window, open lesson 1, check that 03a added the tag, then read the Execution Logs, #new-students, Jules’s task list and the pipeline board before publishing.',
    },
  ],
  edgeCases: [
    {
      title: 'They buy at 11 PM',
      body: 'Access, the welcome and the Slack post go at once, because there is no workflow Time Window. The only text is three days later, behind a 10 AM to 7 PM Advance Window, and Jules’s tasks are due in working hours.',
    },
    {
      title: 'They unsubscribed before buying',
      body: 'Email DND is on, so GHL would skip the welcome and every email after it. The If/Else sends them to a task due now for Jules, who calls with the login, and texts it if they ticked the reminders box. The run carries on, so Course Progress, the tags and the nudge text still apply. DND stays as the contact set it.',
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
      title: 'Payment plan buyers',
      body: 'Full access on the first payment, with the plan explained in the welcome and the refund note saying the remaining payments are canceled too. 04 · Billing · Failed Payment Recovery finds installments by its own price filter, so a wrong Payment Plan value could never stop a billing notice. Whether a lapsed plan loses access is 04’s decision, not this workflow’s; if 04 does pause access, it also removes the contact from this workflow, so no login nudge goes to someone who cannot log in.',
    },
    {
      title: 'No course card, or only a coaching card',
      body: 'A payment-link buyer may have no card, and someone Devon sent a link after a strategy call has only the coaching deal. Find Opportunity skips coaching stages, comes back empty, and Create Opportunity adds a course card at Customer, already Won, with Duplicate Opportunity on. The coaching card stays open for Devon. Because Create only runs when Find came back empty, nobody gets two course cards.',
    },
  ],
  qa: [
    'Test purchase at full price: the student can log in within a minute, the card is at Customer, Won, $497 and renamed for the course, Payment Plan is No, Jules is the owner, and the #new-students post shows name, plan, source and owner with no email or phone',
    'Test purchase on the 3 x $179 price: the Execution Logs show Order Total 179 and the plan branch, and Payment Plan is Yes',
    'A test student buys during a workshop: removed from 01 and 02 in the same minute, and checkout-started is gone',
    'A test contact whose only card is at Call Booked, and one with no card: each ends with exactly one new course card at Customer, Won, and the Call Booked card is untouched',
    'Open lesson 1 as the test student: 03a adds course-started, the wait releases and the week-one email arrives. Complete lesson 1: no skills-inventory-done tag. Complete lesson 4: the last wait releases',
    'Never open it: at 3 days the text (consent, no SMS DND) and the email go out between 10 AM and 7 PM, and Jules has a task due the next weekday at 11 AM',
    'A test contact with Email DND: the Execution Logs show the If/Else going to Jules’s task, due now, and every later email skipped. A test contact with SMS DND: no Send SMS, only the email path',
    'Every merge field, the login steps and the postal address check out in Gmail, Outlook and on a phone; the text is GSM-7 and at most two segments with an 11-letter first name',
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
    'Custom Webhook',
    'Add Task',
    'Send Email',
    'Wait · Specific conditions to be met',
    'Wait · Advance Window',
    'Send SMS',
    'Add Contact Tag',
    'Product Started',
    'Lesson Completed',
  ],
};
