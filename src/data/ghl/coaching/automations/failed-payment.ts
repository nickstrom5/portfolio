import type { Automation, Contact } from '@/lib/ghl/types';
import { formatClock, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Days between the first notice and the pause. The waits below add up to the same number. */
const PAUSE_AFTER_DAYS = 10;

/** Days from the pause to the hand-off: day 24, before the next monthly installment can come due. */
const HANDOFF_DAYS = 14;

/** Add Task with Due In 1 day, Due Time 10:00 AM and Skip Weekends on. */
const taskDue = (now: number) => formatClock(nextWeekdayAt(now, 10 * 60));

/** The two channels the workflow can use for this contact right now. */
const reach = (c: Contact) => ({ text: c.fields.sms_consent === 'Yes' && !c.dnd.sms, email: !c.dnd.email });

/** A student on the payment plan, as 03 · Students · Course Onboarding left them: course card at Customer and Won, Jules as owner, purchase fields set. */
const student = (fields: Contact['fields'], extra: Partial<Contact> = {}): Partial<Contact> => ({
  opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497, name: 'Marcus Lee · Career Pivot Blueprint' },
  assignedTo: 'jules',
  fields: { purchase: 'Career Pivot Blueprint', payment_plan: 'Yes', ...fields },
  ...extra,
});

/** Billing emails are transactional, but they still carry the postal address. */
const sign = 'Sasha Kim\nOperations and billing, {{location.name}}\n{{location.full_address}}';
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const noticeSubject = 'Your {{custom_values.course_name}} installment did not go through';
const noticeBody = `Hi {{contact.first_name}},

Your latest {{custom_values.course_name}} installment didn't go through. Your plan is {{custom_values.payment_plan}}, and this installment is still open. This often means a card expired or was replaced, or the bank flagged the charge. It is quick to fix, and your course access is unchanged.

How to update your card and pay the open installment: {{custom_values.update_card_link}}

Two other things you may notice:
- An invoice email for this payment from {{location.name}}. Paying it with a new card settles the installment, and that card is used for the rest of your plan.
- A few more automatic tries on your current card over the next nine days. If your bank clears the decline, one of them goes through and you do not need to do anything.

If something else is going on, reply to this email and I will get back to you.

${sign}`;

const day5Subject = 'Your installment is still open: what happens next';
const day5Body = `Hi {{contact.first_name}},

Your {{custom_values.course_name}} installment is still open, and I want you to have plenty of notice about what happens next.

If it is still unpaid on {{contact.access_pause_date}}, your course access will pause that day. Your account stays, and access comes back automatically as soon as the payment goes through.

How to update your card: {{custom_values.update_card_link}}

If something has changed and this month is hard, reply and tell me. We can talk it through before anything pauses.

${sign}`;

const pausedSubject = 'Your course access is paused for now';
const pausedBody = `Hi {{contact.first_name}},

Your {{custom_values.course_name}} installment is still unpaid, so as my last email mentioned, your course access is paused as of today.

Nothing else changes. Your account is still there, and access comes back automatically as soon as the installment is paid: {{custom_values.update_card_link}}

If you would like to talk about options, reply here or write to {{custom_values.support_email}}. I am happy to help.

${sign}`;

const settingsSheet = `Trigger     Payment Received
  Transaction type      Customer not present/subscription transaction
  Global Product        Career Pivot Blueprint
    Price               3 payments of $179
  Payment status        Failed
  No Payment Source filter: the plan sells through the checkout funnel
  and a payment link, and both bill the same way.

Not these: Subscription reacts to status changes (Overdue, Unpaid,
Canceled), not to each charge. A decline on the first payment is a
Customer present/first transaction, seen on the checkout page, and 02
follows it up.

Retries     Payments > Settings > Subscription   (Square)
  Retries               3, gaps of 1, 3 and 5 days: days 1, 4 and 9
  When all retries fail keep the subscription Unpaid (auto-cancel off)

Goal Event  Payment Received
  Product               Career Pivot Blueprint
  Status                Success    a retry, the invoice or Retry Payment
  If Contact Reaches This Goal Without Meeting Conditions:
                        Wait until the goal is met

Settings    Allow Re-entry on · Stop on Response off
            Timezone: Contact · Time Window 8:00 AM to 8:00 PM, every day
            Sender Details: From Name Sasha at Trailhead Career Coaching

04a · Billing · Replies to Sasha
  Trigger   Customer Replied
            Replied to Workflow is 04 · Billing · Failed Payment Recovery
  Action    Internal Notification, Type Notification (in-app),
            To User Type Particular Users: Sasha Kim
  Why       Replies land in Conversations under the owner, Jules. Sasha
            answers billing, so every reply to 04 pings her too.`;

export const failedPayment: Automation = {
  id: 'failed-payment',
  number: '04',
  name: 'Failed payment recovery',
  kicker: 'Billing',
  tagline:
    'A failed installment gets a plain notice, two reminders and a personal check-in from Sasha. Access pauses only on day 10, on a date named in advance, and comes back on its own the moment they pay.',
  problem:
    'Students on the three-payment plan sometimes had an installment fail, usually an expired or replaced card. Nobody noticed until Sasha reconciled payments at month end, weeks later. The student had never been told, and the email that finally went out read like a collections letter to someone who had done nothing wrong.',
  evidence: {
    text: 'GHL’s help article on Payment Received answers “Can this trigger failed payments too?” with: “Use the ‘Payment Status = Failed’ filter to create follow-up workflows for retries or dunning emails.” For recurring charges it recommends the “Customer not present/subscription transaction” filter, because the Subscription trigger reacts to lifecycle events, not to individual charges.',
    source: 'HighLevel Help Center, “Workflow Trigger - Payment Received”',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000003534-workflow-trigger-payment-received',
  },
  solution:
    'A failed installment starts the workflow the moment the charge fails. The student gets a plain billing notice by email, and by text if they ticked the service box, with one link to fix it. Reminders follow on day 2 and day 5, and on day 5 Sasha gets a task to reach out as a person. If the installment is still open on day 10, course access pauses on the date the day-5 email named, with an email that says how to restore it. A student whose email is switched off never got that date, so for them a person decides instead. A successful payment at any point ends the recovery, and access comes back automatically if it was paused, even weeks later.',
  workflow: {
    name: '04 · Billing · Failed Payment Recovery',
    folder: 'Billing',
    triggers: [
      {
        title: 'Payment Received',
        filters: [
          'Transaction type is Customer not present/subscription transaction',
          'Global Product is Career Pivot Blueprint, Price is 3 payments of $179',
          'Payment status is Failed',
        ],
        label: 'Payment Received (installment failed)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      timeWindow: { start: '08:00', end: '20:00', days: ALL_WEEK },
      senderName: 'Sasha at Trailhead Career Coaching',
      notes: [
        "Time Window 8 AM to 8 PM in the contact's time zone, every day. An installment that fails at 6:40 AM gets its notice at 8. Tags, the Math Operation, Sasha's tasks and notifications and the course access steps are internal and run on time.",
        'Stop on Response off: a reply like "I will fix it tonight" must not end the run whose goal restores access. Replies land in Conversations under the owner, still Jules from 03, so a one-step helper, 04a · Billing · Replies to Sasha (Customer Replied, Replied to Workflow is 04), sends Sasha an in-app notification for each one.',
        'Allow Re-entry on: the last installment can fail after an earlier one was recovered, and that is a new run. A retry that fails during a run, or a later installment that fails while an unpaid student waits at the goal, starts nothing new, because GHL never enrolls a contact who is still active.',
        'One Goal Event per workflow is a GHL limit. It sits after the hand-off, on the path that holds every message, and it is set to Wait until the goal is met, so a payment on day 3 or day 40 ends recovery the same way. The three If/Else splits before it reach it through that path or a Go To.',
        'Sender Details: From Name "Sasha at Trailhead Career Coaching". Billing emails come from the person who handles billing, not from a no-reply address. Every email ends with the business name and {{location.full_address}}, and Include Unsubscribe Link (Business Profile › General) stays on.',
        'Email DND does the gating here, and GHL only sets it by itself for an unsubscribe, a spam complaint or a permanent bounce. An account-wide, one-step helper workflow (trigger Email Events, Event is Bounced; action Enable/Disable DND, Outbound, Email), the build GHL’s help center describes, covers soft bounces too, so every check on Email DND here also catches an address that bounces.',
        'One opportunity model across the case: the course card moves Registered, Attended, Checkout Started, Customer, and 03 marks it Won at Customer for $497; a coaching deal is a separate card that 05 creates at Applied, then Call Booked and Coaching Client. This workflow moves no card: a failed installment is a billing problem, not a lost sale, so the course card stays Customer, Won, and Sasha’s Smart List is the billing view.',
        'When access pauses, this workflow removes the contact from 03 and 06, so no "log in", story or coaching email reaches someone who cannot open the course. Both list it as an exit.',
      ],
    },
    steps: [
      {
        id: 'tag-failed',
        kind: 'action',
        action: 'add_tag',
        title: 'Add Contact Tag',
        label: 'payment-failed',
        summary: 'Everyone in billing recovery right now. Sasha’s Smart List filters on it, 06 reads it to hold back the coaching invitation, and it is removed on payment.',
        effect: { addTags: ['payment-failed'] },
      },
      {
        id: 'email-ok',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Can we email?',
        branches: [
          {
            label: 'Email DND on',
            when: {
              type: 'all',
              label: 'Contact is DND for Email (unsubscribed, marked as spam or bounced)',
              of: [{ type: 'dnd', channel: 'email' }],
            },
            nodes: [
              {
                id: 'task-dnd',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Call, email is off',
                summary: 'Assign To Sasha Kim, Due In 1 day, Due Time 10:00 AM, Skip Weekends on. Email carries every reminder here, so without it a person calls within a working day instead of waiting for day 5.',
                run: ({ contact, now }) => {
                  const can = reach(contact);
                  return {
                    log: `Task for Sasha Kim, due ${taskDue(now)}: call ${contact.firstName} ${contact.lastName} about the failed installment. Email DND is on, so every billing email will be skipped and access will not pause on its own. ${can.text ? 'The billing text still goes out.' : 'No text consent either, so this call is the only notice.'}`,
                  };
                },
              },
              {
                id: 'goto-text',
                kind: 'goto',
                title: 'Go To',
                target: 'can-text',
                summary: 'Back on the main path at the text check, so they get the same timeline, the same pause date and the one goal.',
              },
            ],
          },
        ],
        otherwise: {
          label: 'Email allowed',
          nodes: [
            {
              id: 'can-text',
              kind: 'ifelse',
              title: 'If/Else',
              label: 'Can we text?',
              branches: [
                {
                  label: 'Service consent',
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
                      id: 'sms-notice',
                      kind: 'action',
                      action: 'send_sms',
                      title: 'Send SMS',
                      label: 'Billing notice',
                      summary: 'The only automated text in this workflow. From Sasha, one link, no offer, and the opt-out line even though it is an account message.',
                      message: {
                        channel: 'sms',
                        body: "Hi {{contact.first_name}}, it's Sasha at {{location.name}}. Your {{custom_values.course_name}} installment didn't go through, often just an expired card. Your course access is unchanged. To update your card: {{custom_values.update_card_link}} Reply STOP to opt out.",
                      },
                    },
                    {
                      id: 'email-notice',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Billing notice',
                      summary: 'What happened, that access is unchanged, the link, and a heads-up about GHL’s own invoice email and the retries. The no-text path joins here.',
                      message: { channel: 'email', subject: noticeSubject, body: noticeBody },
                    },
                    {
                      id: 'date-hours',
                      kind: 'wait',
                      title: 'Wait',
                      label: 'Date in their day',
                      mode: 'time',
                      minutes: 0,
                      window: { start: '08:00', end: '17:00', days: ALL_WEEK },
                      summary: "No delay, but an Advance Window of 8 AM to 5 PM in the contact's time zone. Current Date in the Math Operation is Chicago's date, and inside this window Chicago is on the same calendar day as every student from Newfoundland to Hawaii, so the date the day-5 email names is their own day plus ten.",
                    },
                    {
                      id: 'pause-date',
                      kind: 'action',
                      action: 'math',
                      title: 'Math Operation',
                      label: 'Access pause date',
                      summary: 'Current Date + 10 days, saved to Access Pause Date. It runs after the first notice, so the promised date and the waits count from the same moment.',
                      run: ({ now }) => {
                        const date = formatDay(now + PAUSE_AFTER_DAYS * DAY);
                        return { effect: { fields: { access_pause_date: date } }, log: `Current Date + ${PAUSE_AFTER_DAYS} days: Access Pause Date is ${date}.` };
                      },
                    },
                    {
                      id: 'wait-d2',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: 2 * DAY,
                      summary: 'Two days. The first automatic retry runs on day 1.',
                    },
                    {
                      id: 'email-d2',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Day 2 reminder',
                      summary: 'Two short paragraphs and the link. Says that sorting it out with the bank is enough, because the next retry picks it up.',
                      message: {
                        channel: 'email',
                        subject: 'A reminder about your {{custom_values.course_name}} installment',
                        body: `Hi {{contact.first_name}},

A quick reminder that your {{custom_values.course_name}} installment is still open. How to update your card: {{custom_values.update_card_link}}

If you have already sorted it out with your bank, the next automatic try will pick it up and you can ignore this email.

Sasha${footer}`,
                      },
                    },
                    {
                      id: 'wait-d5',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: 3 * DAY,
                      summary: 'Three more days, to day 5. The second retry runs on day 4.',
                    },
                    {
                      id: 'email-d5',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Day 5 notice',
                      summary: 'Names the pause date five days ahead, says access comes back on its own, and invites a reply. No fee, no "final notice".',
                      message: { channel: 'email', subject: day5Subject, body: day5Body },
                    },
                    {
                      id: 'notify-d5',
                      kind: 'action',
                      action: 'internal_notification',
                      title: 'Internal Notification',
                      label: 'Tell Sasha',
                      summary: 'Type Notification (in-app), To User Type Particular Users: Sasha Kim, Redirect Page: the contact record. The facts she needs before she reaches out.',
                      message: {
                        channel: 'internal',
                        to: 'Sasha Kim (Notification, Particular Users)',
                        subject: 'Still unpaid on day 5: {{contact.name}}',
                        body: 'The {{custom_values.course_name}} installment failed 5 days ago and is still open. Payment plan: {{contact.payment_plan}}. Course progress: {{contact.course_progress}}. Pause date: {{contact.access_pause_date}}, the date the day-5 email names (nothing pauses for a contact on Email DND, who could not get it). {{contact.phone}}, {{contact.email}}. A check-in task is on your list.',
                      },
                    },
                    {
                      id: 'task-d5',
                      kind: 'action',
                      action: 'add_task',
                      title: 'Add Task',
                      label: 'Personal check-in',
                      summary: 'Assign To Sasha Kim, Due In 1 day, Due Time 10:00 AM, Skip Weekends on. One call or personal message, as a person, before anything pauses.',
                      run: ({ contact, now }) => {
                        const can = reach(contact);
                        const how = can.email
                          ? can.text
                            ? ''
                            : ' No text consent, so call or email.'
                          : can.text
                            ? ' Email is off, so call or text. Access will not pause on its own.'
                            : ' No text consent and email is off, so call. Access will not pause on its own.';
                        return {
                          log: `Task for Sasha Kim, due ${taskDue(now)}: check in with ${contact.firstName} ${contact.lastName} before ${contact.fields.access_pause_date}. Ask if anything changed and share the billing link.${how}`,
                        };
                      },
                    },
                    {
                      id: 'wait-d10',
                      kind: 'wait',
                      title: 'Wait',
                      mode: 'time',
                      minutes: 5 * DAY,
                      summary: 'Five more days, to day 10: the date the day-5 email named. The last retry runs on day 9.',
                    },
                    {
                      id: 'pause-check',
                      kind: 'ifelse',
                      title: 'If/Else',
                      label: 'Did the date reach them?',
                      branches: [
                        {
                          label: 'Email DND on',
                          when: {
                            type: 'all',
                            label: 'Contact is DND for Email, so the day-5 email naming the date could not be delivered',
                            of: [{ type: 'dnd', channel: 'email' }],
                          },
                          nodes: [
                            {
                              id: 'notify-nopause',
                              kind: 'action',
                              action: 'internal_notification',
                              title: 'Internal Notification',
                              label: 'Not paused, Sasha decides',
                              summary: 'Type Notification (in-app), To User Type Particular Users: Sasha Kim. Access is never paused on a date the student was not told, and the "access paused" email would be skipped too.',
                              message: {
                                channel: 'internal',
                                to: 'Sasha Kim (Notification, Particular Users)',
                                subject: 'Day 10, not paused because email is off: {{contact.name}}',
                                body: 'The {{custom_values.course_name}} installment is still open, but Email DND is on, so the day-5 email naming {{contact.access_pause_date}} never reached them. Access stays on. Call {{contact.phone}} and agree what happens next; pause access by hand only after you have told them the date. A payment still ends 04 on its own.',
                              },
                            },
                            {
                              id: 'goto-goal',
                              kind: 'goto',
                              title: 'Go To',
                              target: 'goal-paid',
                              summary: 'Straight to the goal, which waits for the payment. Whenever they pay, the same thank-you path runs.',
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'Email allowed',
                        nodes: [
                          {
                            id: 'revoke',
                            kind: 'action',
                            action: 'course_access',
                            title: 'Course Revoke Offer',
                            label: 'Pause access',
                            summary: 'Offer: Career Pivot Blueprint. Removes course access and nothing else: the contact, the Enrollment card and the subscription stay as they are.',
                          },
                          {
                            id: 'tag-paused',
                            kind: 'action',
                            action: 'add_tag',
                            title: 'Add Contact Tag',
                            label: 'access-paused',
                            summary: 'Read by the If/Else after the goal, by 06 before its coaching invitation, and by anyone asking why a student cannot log in.',
                            effect: { addTags: ['access-paused'] },
                          },
                          {
                            id: 'stop-students',
                            kind: 'action',
                            action: 'remove_from_workflow',
                            title: 'Remove from Workflow',
                            label: 'Stop 03 and 06',
                            summary:
                              'Another Workflow: 03 · Students · Course Onboarding and 06 · Students · Completion, Testimonial and Upgrade. Neither may send a "log in" nudge, a story request or a coaching invitation to someone who cannot open the course. Most paused students are in neither: 03 ends about two weeks after purchase.',
                            run: ({ contact }) => ({
                              log:
                                contact.fields.course_progress === 'Completed'
                                  ? 'Removed from 06 if the graduate is still in it. 03 finished long ago.'
                                  : 'Removed from 03 and 06 if they are in either. For this student neither is running: 03 ended about two weeks after purchase, and 06 starts only when they finish.',
                            }),
                          },
                          {
                            id: 'email-paused',
                            kind: 'action',
                            action: 'send_email',
                            title: 'Send Email',
                            label: 'Access paused',
                            summary: 'States the fact, says nothing else changes, gives the one link that restores access, and offers a person.',
                            message: { channel: 'email', subject: pausedSubject, body: pausedBody },
                          },
                          {
                            id: 'wait-restore',
                            kind: 'wait',
                            title: 'Wait',
                            mode: 'time',
                            minutes: HANDOFF_DAYS * DAY,
                            summary: 'Two weeks with access paused, to day 24. That is before the next monthly installment can come due, so a person decides about the plan before another charge is tried.',
                          },
                          {
                            id: 'notify-final',
                            kind: 'action',
                            action: 'internal_notification',
                            title: 'Internal Notification',
                            label: 'Hand to a person',
                            summary: 'Type Notification (in-app), To User Type Particular Users: Sasha Kim. Only someone who has not paid reaches this step: a payment skips past it to the goal.',
                            message: {
                              channel: 'internal',
                              to: 'Sasha Kim (Notification, Particular Users)',
                              subject: 'Access paused two weeks, still unpaid: {{contact.name}}',
                              body: 'Access has been paused since {{contact.access_pause_date}}. Before the next installment comes due, decide with Morgan whether to pause the plan (Payments > Subscriptions, Pause) or cancel it, so a card that already failed is not charged again. 04 keeps waiting at its goal: if they pay, access comes back on its own. If the plan is canceled unpaid, remove them from 04 on the contact record.',
                            },
                          },
                          {
                            id: 'goal-paid',
                            kind: 'goal',
                            title: 'Goal Event',
                            label: 'Payment Received',
                            event: 'payment',
                            ifNotMet: 'wait',
                            summary: 'Payment Received for Career Pivot Blueprint, status Success, however it comes in: an automatic retry, the invoice GHL emailed or Sasha’s Retry Payment. Reached unpaid: Wait until the goal is met.',
                          },
                          {
                            id: 'untag-failed',
                            kind: 'action',
                            action: 'remove_tag',
                            title: 'Remove Contact Tag',
                            label: 'payment-failed',
                            summary: 'Out of billing recovery, off Sasha’s Smart List, and eligible for 06’s coaching invitation again.',
                            effect: { removeTags: ['payment-failed'] },
                          },
                          {
                            id: 'was-paused',
                            kind: 'ifelse',
                            title: 'If/Else',
                            label: 'Was access paused?',
                            branches: [
                              {
                                label: 'Paused',
                                when: { type: 'tag', has: 'access-paused' },
                                nodes: [
                                  {
                                    id: 'grant',
                                    kind: 'action',
                                    action: 'course_access',
                                    title: 'Course Grant Offer',
                                    label: 'Restore access',
                                    summary: 'The same Career Pivot Blueprint offer, back within a minute of the payment. Nobody has to notice and do it by hand.',
                                  },
                                  {
                                    id: 'untag-paused',
                                    kind: 'action',
                                    action: 'remove_tag',
                                    title: 'Remove Contact Tag',
                                    label: 'access-paused',
                                    summary: 'Access is back, so the tag goes too.',
                                    effect: { removeTags: ['access-paused'] },
                                  },
                                  {
                                    id: 'email-restored',
                                    kind: 'action',
                                    action: 'send_email',
                                    title: 'Send Email',
                                    label: 'Access is back',
                                    summary: 'One line and the login link. No mention of the pause beyond that it is over.',
                                    message: {
                                      channel: 'email',
                                      subject: 'Your course access is back',
                                      body: `Hi {{contact.first_name}},

Thank you, your payment went through and your access to {{custom_values.course_name}} is back on. Log in as usual: {{custom_values.course_login}}

Sasha${footer}`,
                                    },
                                  },
                                ],
                              },
                            ],
                            otherwise: {
                              label: 'Never paused',
                              nodes: [
                                {
                                  id: 'email-thanks',
                                  kind: 'action',
                                  action: 'send_email',
                                  title: 'Send Email',
                                  label: 'All set',
                                  summary: 'Closes the loop the first notice opened, so nobody wonders whether it worked.',
                                  message: {
                                    channel: 'email',
                                    subject: 'Thanks, your payment went through',
                                    body: `Hi {{contact.first_name}},

Your {{custom_values.course_name}} installment went through, so you are all set and there is nothing else to do.

Sasha${footer}`,
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
              ],
              otherwise: {
                label: 'No text consent',
                nodes: [
                  {
                    id: 'goto-email',
                    kind: 'goto',
                    title: 'Go To',
                    target: 'email-notice',
                    summary: 'Joins the main path at the billing email, right after the text, so everything after it is shared, including the goal.',
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
      id: 'same-day',
      label: 'Updates the card the same day',
      summary: 'The card on file expired. The installment fails Tuesday morning, and they pay with a new card over lunch.',
      start: at(1, 9, 14),
      contact: student({ current_role: 'Manager', goal: 'A new industry', sms_consent: 'Yes', sms_marketing_consent: 'No', course_progress: 'Started' }),
      events: [{ at: at(1, 12, 31) - at(1, 9, 14), type: 'payment', value: 179, label: '$179: pays the open invoice with a new card' }],
      expect: {
        outcome: 'goal',
        visits: ['email-ok:else', 'can-text:0', 'sms-notice', 'email-notice', 'pause-date', 'goal-paid', 'untag-failed', 'was-paused:else', 'email-thanks'],
      },
    },
    {
      id: 'day-4',
      label: 'Pays on day 4, after the reminder',
      summary: 'Bought at 8:05 PM right after a workshop, so installments charge at 8:05 PM. No text consent. The notice waits for 8 AM, and they pay on Monday after the day-2 reminder.',
      start: at(3, 20, 5),
      contact: student({ current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'No', sms_marketing_consent: 'No', course_progress: 'Skills inventory done' }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined. They are still in this run, so GHL does not enroll them again.' },
        { at: at(7, 12, 40) - at(3, 20, 5), type: 'payment', value: 179, label: '$179: pays the open invoice from the billing page, after the Sunday reminder' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['can-text:else', 'goto-email', 'email-notice', 'email-d2', 'goal-paid', 'untag-failed', 'was-paused:else', 'email-thanks'],
      },
    },
    {
      id: 'never-pays',
      label: 'Never pays, access paused',
      summary: 'Fails at 6:40 AM on a Wednesday, all three retries decline, and there is no payment or reply. Access pauses on day 10, Sasha gets the hand-off on day 24, and the run keeps waiting at the goal for a payment.',
      start: at(2, 6, 40),
      contact: student({ current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'Yes', course_progress: 'Not started' }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined. Still in this run, so no second enrollment.' },
        { at: 4 * DAY, type: 'payment_failed', value: 'Retry 2 of 3', label: 'Automatic retry 2 of 3 declined.' },
        { at: 9 * DAY, type: 'payment_failed', value: 'Retry 3 of 3', label: 'Automatic retry 3 of 3 declined. The subscription stays Unpaid; auto-cancel is off.' },
      ],
      expect: {
        outcome: 'ended',
        visits: ['sms-notice', 'email-notice', 'email-d2', 'email-d5', 'notify-d5', 'task-d5', 'pause-check:else', 'revoke', 'tag-paused', 'stop-students', 'email-paused', 'wait-restore', 'notify-final', 'goal-paid'],
        tags: ['payment-failed', 'access-paused'],
      },
    },
    {
      id: 'email-dnd',
      label: 'Unsubscribed from email',
      summary: 'Unsubscribed from Trailhead’s emails months ago, so Email DND is on and every billing email is skipped. The text goes out and Sasha gets a call task on day 0. On day 10 nothing pauses, because the email naming the date never reached them, and they pay the next day on a call with Sasha.',
      start: at(5, 10, 22),
      contact: student({ current_role: 'Manager', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'No', course_progress: 'Started' }, { dnd: { email: true } }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined.' },
        { at: 4 * DAY, type: 'payment_failed', value: 'Retry 2 of 3', label: 'Automatic retry 2 of 3 declined.' },
        { at: 9 * DAY, type: 'payment_failed', value: 'Retry 3 of 3', label: 'Automatic retry 3 of 3 declined.' },
        { at: at(16, 10, 15) - at(5, 10, 22), type: 'payment', value: 179, label: '$179: Sasha charges their new card with Retry Payment on the subscription, on the phone' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['email-ok:0', 'task-dnd', 'goto-text', 'can-text:0', 'sms-notice', 'task-d5', 'pause-check:0', 'notify-nopause', 'goto-goal', 'goal-paid', 'untag-failed', 'was-paused:else'],
        skips: ['email-notice', 'email-d2', 'email-d5', 'email-thanks'],
      },
    },
    {
      id: 'after-pause',
      label: 'Pays two days after the pause',
      summary: 'Changed banks and missed the reminders. Access pauses on day 10, they text back that evening, and pay on Saturday. Access comes back within the minute.',
      start: at(0, 14, 47),
      contact: student({ current_role: 'Between roles', goal: 'A new industry', sms_consent: 'Yes', sms_marketing_consent: 'No', course_progress: 'Skills inventory done' }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined.' },
        { at: 4 * DAY, type: 'payment_failed', value: 'Retry 2 of 3', label: 'Automatic retry 2 of 3 declined.' },
        { at: 9 * DAY, type: 'payment_failed', value: 'Retry 3 of 3', label: 'Automatic retry 3 of 3 declined.' },
        {
          at: at(10, 18, 10) - at(0, 14, 47),
          type: 'reply',
          value: 'Sorry about this, new job and a new bank. I will pay on Saturday.',
          label: 'Stop on Response is off, so the run keeps watching for the payment, and 04a pings Sasha to answer',
        },
        { at: at(12, 11, 5) - at(0, 14, 47), type: 'payment', value: 179, label: '$179: pays the open invoice with the new bank’s card' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['pause-check:else', 'revoke', 'tag-paused', 'email-paused', 'goal-paid', 'untag-failed', 'was-paused:0', 'grant', 'untag-paused', 'email-restored'],
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Access Pause Date', key: 'access_pause_date', type: 'Date Picker', note: 'Written by Math Operation: Current Date + 10 days, right after the first notice. The day-5 email and Sasha’s notifications quote it.' },
      { name: 'SMS consent (service)', key: 'sms_consent', type: 'Checkbox', note: 'The service box on the workshop form, unticked and optional. Its wording covers "course and billing notices", so it is enough for this account message, which has no offer. SMS consent (offers) is never read here.' },
      { name: 'Payment Plan / Course Progress', key: 'payment_plan', type: 'Dropdown (single) ×2', note: 'Written by 03 (and 06 for Completed). Shown in Sasha’s day-5 notification. Routing does not need them: the trigger’s plan-price filter already limits this workflow to installments.' },
    ],
    tags: [
      { name: 'payment-failed', note: 'Added on entry, removed on payment. Sasha’s "Billing recovery" Smart List is everyone who has it, and 06 holds back the coaching invitation while it is on.' },
      { name: 'access-paused', note: 'Added when access pauses, removed when it comes back. The If/Else after the goal reads it, and 06 holds back its coaching invitation while it is on.' },
    ],
    customValues: [
      { name: 'Update Card Link', key: 'update_card_link', value: 'trailheadcareers.example/billing' },
      { name: 'Payment Plan', key: 'payment_plan', value: '3 payments of $179' },
      { name: 'Course Login', key: 'course_login', value: 'trailheadcareers.example/portal' },
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Support Email', key: 'support_email', value: 'help@trailheadcareers.example' },
    ],
  },
  build: [
    {
      title: 'Agree the rules first',
      body: 'With Morgan and Sasha, before any workflow: how long a student keeps access while a payment is open (10 days), who reaches out as a person (Sasha, on day 5), and what the messages never do: no fees that do not exist, no "final notice" subject lines, no threats and no guilt. Pausing access is a fact stated in advance, not a penalty. It never happens to someone the notice could not reach, and it undoes itself when they pay.',
    },
    {
      title: 'Let the gateway retry first',
      body: 'Trailhead takes payments through Square, connected in Payments › Integrations. That matters here: GHL’s own Failed Payment Retries setting and the Retry Payment option on a subscription both support Square, NMI and Authorize.net, and Stripe is on neither list. In Payments › Settings › Subscription I set 3 retries with gaps of 1, 3 and 5 days, so retries land on days 1, 4 and 9 and each reminder follows a retry that also failed. Moving the subscription to Cancelled after the last retry is off: it stays Unpaid, and this workflow decides about access.',
    },
    {
      title: 'Trigger on the charge, not the subscription',
      body: 'Payment Received with Payment status Failed, Transaction type Customer not present/subscription transaction, and Global Product Career Pivot Blueprint at the plan price. There is no Payment Source filter, because the plan also sells through a payment link and 03 onboards those buyers too. The Subscription trigger reacts to status changes like Overdue or Unpaid, not to each charge. A decline on the first payment is a Customer present/first transaction that the buyer sees on the checkout page, and 02 · Sales · Checkout Recovery follows it up.',
    },
    {
      title: 'Consent and DND before the first message',
      body: 'Two If/Else steps come first. Email DND (an unsubscribe, a spam complaint or a bounce) gets Sasha a call task on day 0, because email carries every reminder here. The text needs SMS consent (service), whose wording on the workshop form covers billing notices, and no SMS DND. A billing notice is an account message, so it does not need SMS consent (offers), and it carries no offer. Both paths Go To the same timeline, so there is one set of reminders and one goal.',
    },
    {
      title: 'One goal, and it waits',
      body: 'GHL allows one Goal Event per workflow and moves the contact to it the moment a payment succeeds: Payment Received, product Career Pivot Blueprint, status Success, whether it comes from a retry, the invoice GHL emails or Sasha’s Retry Payment. It sits after the last wait on the path that holds every message, so a payment at any point skips everything in between. If they reach it unpaid, the goal is set to Wait until the goal is met, so a student who pays weeks after the hand-off still gets access back without anyone noticing first. The If/Else after it reads access-paused: a thank-you for most people, Course Grant Offer and an "access is back" email for the rest.',
    },
    {
      title: 'Dates that match what we said',
      body: 'Math Operation writes Current Date + 10 days to Access Pause Date right after the first notice, and the day-5 email quotes that date. The waits (2, 3 and 5 days) count from the same moment, so access pauses on the day the email named, never earlier. Current Date is in the sub-account’s time zone, Chicago, so a 0-minute Wait with an 8 AM to 5 PM Advance Window in the contact’s time zone runs first: at 7:30 PM in Hawaii it is already tomorrow in Chicago, and the hold keeps the date on the student’s own day. On day 10 an If/Else checks Email DND again: if the day-5 email could not be delivered, nothing pauses and Sasha decides. The hand-off comes on day 24, before the next monthly installment can come due.',
    },
    {
      title: 'Copy a stressed person can read',
      body: 'Every message says what happened, what it means for them, how to fix it and how to reach a person. They come from Sasha by name through Sender Details, with no fees, no countdowns and no red warnings. None carries an offer, which keeps them transactional under CAN-SPAM, and they still end with the business name, the postal address and the unsubscribe link. The Update Card Link custom value is Trailhead’s billing page: it sends them to the open invoice GHL emailed, where a new card becomes the card on file, and to Sasha. Links, prices and the support address are all custom values, so the copy never hard-codes them.',
    },
    {
      title: 'Test with declines, then publish',
      body: 'Square Test Mode, connected to a Square sandbox account, with test cards that decline. One test contact per scenario, and a copy of the workflow with the waits cut to minutes. I checked every run in the Execution Logs and Enrollment History, paused and restored access on a test student in the client portal, and checked that the pause took a test student out of 03 and 06, before publishing the real one.',
    },
  ],
  edgeCases: [
    {
      title: 'They fix it before the first notice',
      body: 'An installment that fails at 6:40 AM waits for the 8 AM Time Window. If they pay the invoice GHL emailed in the meantime, the goal pulls them out before the text or the billing email sends, because both sit on the same path as the goal. All they get is the short "all set" email at 8.',
    },
    {
      title: 'A retry fails during the run',
      body: 'A failed retry is another failed charge that matches this trigger. GHL never enrolls a contact who is still active, so the run carries on and nobody gets a second "your installment did not go through". Re-entry is on for the last installment, which is a new run once this one has finished.',
    },
    {
      title: 'Email DND is on',
      body: 'An unsubscribe, a spam complaint or a hard bounce turns Email DND on, and GHL skips every email step for that contact, billing included. The first If/Else gives Sasha a call task on day 0, and the text still goes out if they ticked the service box. On day 10 the second check keeps access on, because they never got the email that named the date, and Sasha decides on a call. I do not switch DND off to force a billing email through: the contact set it.',
    },
    {
      title: 'They ask for more time',
      body: 'Stop on Response is off, so a reply does not end the run whose goal restores access, and 04a pings Sasha. If she agrees a later date, she removes them from this workflow on the contact record so nothing pauses, and sets herself a task for that date. The payment-failed tag stays, so her Smart List still shows them, and she removes it when the payment lands.',
    },
    {
      title: 'Two installments open at once',
      body: 'If the next installment is charged while an unpaid student waits at the goal, it fails without starting a new run, and one payment then meets the goal while the other is still open. That is why the hand-off comes on day 24, before the next installment is due: Sasha and Morgan pause the plan in Payments › Subscriptions or cancel it before another charge is tried.',
    },
    {
      title: 'Paid in full, declined at checkout, or bought by link',
      body: 'Paid-in-full buyers have no installments, and a first-payment decline is a Customer present/first transaction that 02 follows up, so neither enters. A plan bought through the payment link does enter, because the trigger has no Payment Source filter.',
    },
  ],
  qa: [
    'Decline a test installment: the contact enters once, gets payment-failed, and the Execution Logs show the billing email and, with consent, the text',
    'Let a retry decline during the run: Enrollment History still shows one enrollment',
    'Pay the open invoice with a new test card during a wait, and on a second contact use Retry Payment: goal met both times, payment-failed removed, the thank-you sends, no reminder follows, and the new card is the default on the subscription',
    'Email DND test contact: every email step shows as skipped, Sasha’s task is created on day 0, and on day 10 she gets the not-paused notification instead of a Course Revoke Offer',
    'Access Pause Date is the first notice plus 10 days, and in the shortened copy the pause lands on that date',
    'On a test student, pause and then pay: the course disappears from the client portal and comes back after payment. I checked lesson progress before any email mentioned it, and none does',
    'Leave a test student unpaid past the hand-off: the run shows them waiting at the goal, and a payment after that still restores access and sends "access is back"',
    'Every merge field renders in Gmail, Outlook and on a phone, the pause date included; the text is GSM-7 and at most two segments',
  ],
  snippets: [
    {
      title: 'Trigger, retries, goal and settings',
      language: 'text',
      code: settingsSheet,
      note: 'The trigger filters decide who enters, the retry settings decide how often the card is tried, and the goal ends recovery on any successful payment for the product, however late.',
    },
    {
      title: 'Day 5 email: notice before the pause',
      language: 'text',
      code: `Subject: ${day5Subject}\n\n${day5Body}`,
      note: 'The date comes from Access Pause Date, which the Math Operation step wrote. It says what will happen and how to avoid it, and it offers a person. No fee, no threat.',
    },
    {
      title: 'Day 10 email: access paused',
      language: 'text',
      code: `Subject: ${pausedSubject}\n\n${pausedBody}`,
      note: 'Facts first, then the one link that restores access. It never says "failed to pay", "final" or "suspended".',
    },
  ],
  features: [
    'Payment Received',
    'Failed Payment Retries',
    'Add Contact Tag',
    'If/Else',
    'Add Task',
    'Go To',
    'Send SMS',
    'Send Email',
    'Math Operation',
    'Wait',
    'Internal Notification',
    'Course Revoke Offer',
    'Remove from Workflow',
    'Goal Event',
    'Remove Contact Tag',
    'Course Grant Offer',
    'Customer Replied',
    'Time Window',
    'Sender Details',
    'Allow Re-entry',
  ],
};
