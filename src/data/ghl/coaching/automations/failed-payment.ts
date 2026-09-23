import type { Automation, Contact } from '@/lib/ghl/types';
import { formatClock, nextWeekdayAt } from '@/lib/ghl/engine';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Days between the first notice and the pause. The waits below add up to the same number. */
const PAUSE_AFTER_DAYS = 10;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A date as the emails print it, e.g. "Saturday, March 14". */
function longDate(min: number): string {
  const day = Math.floor(min / DAY);
  const d = new Date(Date.UTC(2026, 2, 2 + day));
  return `${WEEKDAYS[day % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Add Task with Due In 1 day, Due Time 10:00 AM and Skip Weekends on. */
const taskDue = (now: number) => formatClock(nextWeekdayAt(now, 10 * 60));

/** A student on the payment plan, as 03 · Course Onboarding left them: card at Customer and Won, Jules as owner, purchase fields set. */
const student = (fields: Contact['fields'], extra: Partial<Contact> = {}): Partial<Contact> => ({
  opportunity: { pipeline: 'Enrollment', stage: 'Customer', status: 'won', value: 497 },
  assignedTo: 'jules',
  fields: { purchase: 'Career Pivot Blueprint', payment_plan: 'Yes', ...fields },
  ...extra,
});

const sign = 'Sasha Kim\nOperations and billing, {{location.name}}';

const noticeSubject = 'Your {{custom_values.course_name}} installment did not go through';
const noticeBody = `Hi {{contact.first_name}},

Your latest installment for {{custom_values.course_name}} didn't go through. This usually means a card expired or was replaced, or the bank flagged the charge. It is quick to fix, and your course access is unchanged.

Update your card and pay the open installment here: {{custom_values.update_card_link}}

Two other things you may notice:
- We retry the card automatically over the next few days.
- You may also get an invoice email for the same payment. Paying through either one settles it, and the retries stop.

If something else is going on, reply to this email and I will get back to you.

${sign}`;

const day5Subject = 'Your installment is still open: what happens next';
const day5Body = `Hi {{contact.first_name}},

Your {{custom_values.course_name}} installment is still open, and I want you to have plenty of notice about what happens next.

If it is still unpaid on {{contact.access_pause_date}}, your course access will pause that day. Your account stays, and access comes back automatically as soon as the payment goes through.

Update your card here: {{custom_values.update_card_link}}

If something has changed and this month is hard, reply and tell me. We can talk it through before anything pauses.

${sign}`;

const pausedSubject = 'Your course access is paused for now';
const pausedBody = `Hi {{contact.first_name}},

Your {{custom_values.course_name}} installment is still unpaid, so as my last email mentioned, your course access is paused from today.

Nothing else changes. Your account is still there, and access comes back automatically as soon as the installment is paid: {{custom_values.update_card_link}}

If you would like to talk about options, reply here or write to {{custom_values.support_email}}. I am happy to help.

${sign}`;

const settingsSheet = `Trigger     Payment Received
  Payment Source        Funnel/Website
    Transaction type    Customer not present/subscription transaction
  Global Product        Career Pivot Blueprint
    Price               3 payments of $179
  Payment status        Failed

Not these: Subscription reacts to status changes (Overdue, Unpaid,
Canceled), not to each charge. A decline on the first payment happens
on the checkout page, in front of the buyer, and 02 follows it up.

Retries     Payments > Settings > Subscription   (Square)
  Retries               3, gaps of 1, 3 and 5 days: days 1, 4 and 9
  When all retries fail keep the subscription Unpaid (auto-cancel off)

Goal Event  Payment Received
  Product               Career Pivot Blueprint
  Status                Success          any source: retry, link, invoice
  If Contact Reaches This Goal Without Meeting Conditions:
                        End this workflow

Settings    Allow Re-entry on · Stop on Response off
            Timezone: Contact · Time Window 8:00 AM to 8:00 PM, every day
            From Name: Sasha at Trailhead Career Coaching`;

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
    'A failed installment starts the workflow the moment the charge fails. The student gets a plain billing notice by email, and by text if they ticked the transactional box, with one link to fix it. Reminders follow on day 2 and day 5, and on day 5 Sasha gets a task to reach out as a person. If the installment is still open on day 10, course access pauses on the date the day-5 email named, with an email that says how to restore it. A successful payment at any point ends the recovery, and access comes back automatically if it was paused.',
  workflow: {
    name: '04 · Billing · Failed Payment Recovery',
    folder: 'Billing',
    triggers: [
      {
        title: 'Payment Received',
        filters: [
          'Payment Source is Funnel/Website',
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
        "Time Window 8 AM to 8 PM in the contact's time zone, every day. An installment that fails at 6:40 AM gets its notice at 8. Tags, Sasha's tasks and the course access steps are internal and run on time.",
        'Stop on Response off: a reply like "I will fix it tonight" must not end the goal that restores access. Replies land in Conversations. The owner stays Jules, set by 03, and the payment-failed tag on the contact tells whoever opens a reply that Sasha answers billing questions.',
        'Allow Re-entry on: installment 3 can fail after installment 2 was recovered, and that is a new run. A retry that fails during a run changes nothing, because GHL never enrolls a contact who is still active.',
        'One Goal Event per workflow is a GHL limit. It sits after the last wait, on the same path as every message, so a payment at any point jumps straight to it. Both If/Else splits come before that path and join it with Go To.',
        'Sender Details: From Name "Sasha at Trailhead Career Coaching". Billing emails come from the person who handles billing, not from a no-reply address.',
      ],
    },
    steps: [
      {
        id: 'tag-failed',
        kind: 'action',
        action: 'add_tag',
        title: 'Add Contact Tag',
        label: 'payment-failed',
        summary: 'Everyone in billing recovery right now. Sasha’s Smart List filters on it, and it is removed on payment.',
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
                label: 'Call now, email is off',
                summary: 'Assign To Sasha Kim, Due In 1 day at 10:00 AM, Skip Weekends on. Email is the main channel here, so without it a person has to reach them on day 0, not day 5.',
                run: ({ contact, now }) => {
                  const canText = contact.fields.sms_consent === 'Yes' && !contact.dnd.sms;
                  return {
                    log: `Task for Sasha Kim, due ${taskDue(now)}: call ${contact.firstName} ${contact.lastName} about the failed installment. Email DND is on, so every billing email will be skipped. ${canText ? 'The billing text still goes out.' : 'No text consent either, so this call is the only notice.'}`,
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
                  label: 'Transactional consent',
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
                      id: 'sms-notice',
                      kind: 'action',
                      action: 'send_sms',
                      title: 'Send SMS',
                      label: 'Billing notice',
                      summary: 'The only automated text in this workflow. From Sasha, one link, no offer, and the opt-out line even though it is an account message.',
                      message: {
                        channel: 'sms',
                        body: "Hi {{contact.first_name}}, it's Sasha at {{location.name}}. Your {{custom_values.course_name}} installment didn't go through, often just an expired card. Your access is unchanged. Update it here: {{custom_values.update_card_link}} Reply STOP to opt out.",
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
                      id: 'pause-date',
                      kind: 'action',
                      action: 'math',
                      title: 'Math Operation',
                      label: 'Access pause date',
                      summary: 'Current Date + 10 days, saved to Access Pause Date. It runs after the first notice, so the promised date and the waits count from the same moment.',
                      run: ({ now }) => {
                        const date = longDate(now + PAUSE_AFTER_DAYS * DAY);
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
                      summary: 'Three sentences and the link. Says that sorting it out with the bank is enough, because the next retry picks it up.',
                      message: {
                        channel: 'email',
                        subject: 'A reminder about your {{custom_values.course_name}} installment',
                        body: `Hi {{contact.first_name}},

A quick reminder that your {{custom_values.course_name}} installment is still open. It takes about a minute to fix: {{custom_values.update_card_link}}

If you have already sorted it out with your bank, the next automatic retry will pick it up and you can ignore this email.

Sasha`,
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
                      summary: 'In-app Notification to Sasha Kim, Redirect Page: the contact record. The facts she needs before she reaches out.',
                      message: {
                        channel: 'internal',
                        to: 'Sasha Kim (in-app notification)',
                        subject: 'Still unpaid on day 5: {{contact.name}}',
                        body: 'The {{custom_values.course_name}} installment failed 5 days ago and is still open. Payment plan: {{contact.payment_plan}}. Course progress: {{contact.course_progress}}. Access pauses on {{contact.access_pause_date}}. {{contact.phone}}, {{contact.email}}. A check-in task is on your list.',
                      },
                    },
                    {
                      id: 'task-d5',
                      kind: 'action',
                      action: 'add_task',
                      title: 'Add Task',
                      label: 'Personal check-in',
                      summary: 'Assign To Sasha Kim, Due In 1 day at 10:00 AM, Skip Weekends on. One call or personal email, as a person, before anything pauses.',
                      run: ({ contact, now }) => {
                        const canText = contact.fields.sms_consent === 'Yes' && !contact.dnd.sms;
                        return {
                          log: `Task for Sasha Kim, due ${taskDue(now)}: check in with ${contact.firstName} ${contact.lastName} before access pauses on ${contact.fields.access_pause_date}. Ask if anything changed and share the billing link.${canText ? '' : ' No text consent, so call or email only.'}`,
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
                      summary: 'Read by the If/Else after the goal, and by anyone asking why a student cannot log in.',
                      effect: { addTags: ['access-paused'] },
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
                      minutes: 30 * DAY,
                      summary: 'Thirty days with access paused. A payment at any point in them jumps to the goal and restores access.',
                    },
                    {
                      id: 'notify-final',
                      kind: 'action',
                      action: 'internal_notification',
                      title: 'Internal Notification',
                      label: 'Hand to a person',
                      summary: 'Only someone who never paid reaches this step: a payment skips past it to the goal. From here a person decides, not the workflow.',
                      message: {
                        channel: 'internal',
                        to: 'Sasha Kim (in-app notification)',
                        subject: 'Access paused 30 days, still unpaid: {{contact.name}}',
                        body: 'Access has been paused since {{contact.access_pause_date}} and the recovery workflow ends now. Decide with Morgan whether to cancel the rest of the plan. If they pay after today, grant access by hand: 04 no longer watches for the payment.',
                      },
                    },
                    {
                      id: 'goal-paid',
                      kind: 'goal',
                      title: 'Goal Event',
                      label: 'Payment Received',
                      event: 'payment',
                      ifNotMet: 'end',
                      summary: 'Payment Received for Career Pivot Blueprint, status Success, any source: a retry, the billing link or GHL’s invoice email. Reached without paying: End this workflow.',
                    },
                    {
                      id: 'untag-failed',
                      kind: 'action',
                      action: 'remove_tag',
                      title: 'Remove Contact Tag',
                      label: 'payment-failed',
                      summary: 'Out of billing recovery and off Sasha’s Smart List.',
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
                              summary: 'Two lines and the login link. No mention of the pause beyond that it is over.',
                              message: {
                                channel: 'email',
                                subject: 'Your course access is back',
                                body: `Hi {{contact.first_name}},

Thank you, your payment went through and your access to {{custom_values.course_name}} is back on. Log in as usual: {{custom_values.course_login}}

Sasha`,
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

Sasha`,
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
      events: [{ at: at(1, 12, 31) - at(1, 9, 14), type: 'payment', value: 179, label: '$179 through the billing link, new card' }],
      expect: {
        outcome: 'goal',
        visits: ['email-ok:else', 'can-text:0', 'sms-notice', 'email-notice', 'pause-date', 'goal-paid', 'untag-failed', 'was-paused:else', 'email-thanks'],
      },
    },
    {
      id: 'day-4',
      label: 'Pays on day 4, after the reminder',
      summary: 'Bought right after a Thursday workshop, so installments charge at 8:05 PM. No text consent. The notice waits for 8 AM, and they pay on Monday after the day-2 reminder.',
      start: at(3, 20, 5),
      contact: student({ current_role: 'Individual contributor', goal: 'A new role', sms_consent: 'No', sms_marketing_consent: 'No', course_progress: 'Skills inventory done' }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined. They are still in this run, so GHL does not enroll them again.' },
        { at: at(7, 12, 40) - at(3, 20, 5), type: 'payment', value: 179, label: '$179 through the billing link, after the Sunday reminder' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['can-text:else', 'goto-email', 'email-notice', 'email-d2', 'goal-paid', 'untag-failed', 'was-paused:else', 'email-thanks'],
      },
    },
    {
      id: 'never-pays',
      label: 'Never pays, access paused',
      summary: 'Fails at 6:40 AM on a Wednesday, all three retries decline, and there is no payment or reply. Access pauses on day 10, and after 30 more days Sasha decides.',
      start: at(2, 6, 40),
      contact: student({ current_role: 'Senior leader', goal: 'Freelancing', sms_consent: 'Yes', sms_marketing_consent: 'Yes', course_progress: 'Not started' }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined. Still in this run, so no second enrollment.' },
        { at: 4 * DAY, type: 'payment_failed', value: 'Retry 2 of 3', label: 'Automatic retry 2 of 3 declined.' },
        { at: 9 * DAY, type: 'payment_failed', value: 'Retry 3 of 3', label: 'Automatic retry 3 of 3 declined. The subscription stays Unpaid; auto-cancel is off.' },
      ],
      expect: {
        outcome: 'ended',
        visits: ['sms-notice', 'email-notice', 'email-d2', 'email-d5', 'notify-d5', 'task-d5', 'revoke', 'tag-paused', 'email-paused', 'wait-restore', 'notify-final', 'goal-paid'],
        tags: ['payment-failed', 'access-paused'],
      },
    },
    {
      id: 'email-dnd',
      label: 'Unsubscribed from email',
      summary: 'Unsubscribed from the workshop emails months ago, so Email DND is on and every billing email is skipped. Sasha gets a task on day 0, and they pay while she has them on the phone.',
      start: at(5, 10, 22),
      contact: student({ current_role: 'Manager', goal: 'A new role', sms_consent: 'Yes', sms_marketing_consent: 'No', course_progress: 'Started' }, { dnd: { email: true } }),
      events: [
        { at: DAY, type: 'payment_failed', value: 'Retry 1 of 3', label: 'Automatic retry 1 of 3 declined.' },
        { at: at(7, 10, 15) - at(5, 10, 22), type: 'payment', value: 179, label: '$179 through the billing link, during Sasha’s call' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['email-ok:0', 'task-dnd', 'goto-text', 'can-text:0', 'sms-notice', 'goal-paid', 'was-paused:else'],
        skips: ['email-notice', 'email-thanks'],
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
          label: 'Stop on Response is off, so the run keeps watching for the payment while Sasha answers',
        },
        { at: at(12, 11, 5) - at(0, 14, 47), type: 'payment', value: 179, label: '$179 through the billing link, new card' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['revoke', 'tag-paused', 'email-paused', 'goal-paid', 'untag-failed', 'was-paused:0', 'grant', 'untag-paused', 'email-restored'],
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Access Pause Date', key: 'access_pause_date', type: 'Date', note: 'Written by Math Operation: the first notice plus 10 days. The day-5 email and Sasha’s notifications quote it.' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'The transactional box, unticked and optional. Enough for a billing notice, which is an account message with no offer. Marketing Texts is never read here.' },
      { name: 'Payment Plan / Course Progress', key: 'payment_plan', type: 'Dropdown (single) ×2', note: 'Written by 03 (and 06 for Completed). Shown in Sasha’s day-5 notification. Routing does not need them: the trigger’s plan-price filter already limits this workflow to installments.' },
    ],
    tags: [
      { name: 'payment-failed', note: 'Added on entry, removed on payment. Sasha’s "Billing recovery" Smart List is everyone who has it.' },
      { name: 'access-paused', note: 'Added when access pauses, removed when it comes back. The If/Else after the goal reads it.' },
    ],
    customValues: [
      { name: 'Update Card Link', key: 'update_card_link', value: 'trailheadcareers.example/billing' },
      { name: 'Course Login', key: 'course_login', value: 'trailheadcareers.example/portal' },
      { name: 'Course Name', key: 'course_name', value: 'Career Pivot Blueprint' },
      { name: 'Support Email', key: 'support_email', value: 'help@trailheadcareers.example' },
    ],
  },
  build: [
    {
      title: 'Agree the rules first',
      body: 'With Morgan and Sasha, before any workflow: how long a student keeps access while a payment is open (10 days), who reaches out as a person (Sasha, on day 5), and what the messages never do: no fees that do not exist, no "final notice" subject lines, no threats and no guilt. Pausing access is a fact stated in advance, not a penalty, and it undoes itself when they pay.',
    },
    {
      title: 'Let the gateway retry first',
      body: 'Trailhead takes payments through Square, one of the gateways GHL’s Failed Payment Retries setting supports, with NMI and Authorize.net. In Payments › Settings › Subscription I set 3 retries with gaps of 1, 3 and 5 days, so retries land on days 1, 4 and 9 and each reminder follows a retry that also failed. Auto-cancel after the last retry is off: the subscription stays Unpaid, and this workflow decides about access.',
    },
    {
      title: 'Trigger on the charge, not the subscription',
      body: 'Payment Received with Payment status Failed, under Funnel/Website with Transaction type Customer not present/subscription transaction, and Global Product Career Pivot Blueprint at the plan price. The Subscription trigger reacts to status changes like Overdue or Unpaid, not to each charge. A decline on the first payment happens on the checkout page, in front of the buyer, and 02 · Checkout Recovery already follows it up.',
    },
    {
      title: 'Consent and DND before the first message',
      body: 'Two If/Else steps come first. Email DND (an unsubscribe, a spam complaint or a bounce) gets Sasha a task on day 0, because email is the main channel here. The text needs SMS Consent, the transactional box, and no SMS DND. A billing notice is an account message, so it does not need Marketing Texts, and it carries no offer. Both paths Go To the same timeline, so there is one set of reminders and one goal.',
    },
    {
      title: 'One goal, after every wait',
      body: 'GHL allows one Goal Event per workflow and moves the contact to it the moment a payment succeeds. Payment Received, product Career Pivot Blueprint, status Success, any source: a retry, the billing link and GHL’s own invoice email all count. It sits after the last wait on the path that holds every message, so a payment at any point skips everything in between. The If/Else after it reads access-paused: a thank-you for most people, Course Grant Offer and an "access is back" email for the rest.',
    },
    {
      title: 'Dates that match what we said',
      body: 'Math Operation writes Current Date + 10 days to Access Pause Date right after the first notice, and the day-5 email quotes that date. The waits (2, 3 and 5 days) count from the same moment, so access pauses on the day the email named, never earlier.',
    },
    {
      title: 'Copy a stressed person can read',
      body: 'Every message says what happened, what it means for them, how to fix it in a minute and how to reach a person. They come from Sasha by name through Sender Details, with no fees, no countdowns and no red warnings. Prices, links and the support address are custom values, so the copy never hard-codes them.',
    },
    {
      title: 'Test with declines, then publish',
      body: 'Square Test Mode, connected to a Square sandbox account, with test cards that decline. One test contact per scenario, and a copy of the workflow with the waits cut to minutes. I checked every run in the Execution Logs and Enrollment History, and paused and restored access on a test student in the client portal, before publishing the real one.',
    },
  ],
  edgeCases: [
    {
      title: 'They fix it before the first notice',
      body: 'An installment that fails at 6:40 AM waits for the 8 AM Time Window. If they pay in the meantime, the goal pulls them out before the text or email sends, because both steps sit on the same path as the goal. All they get is the short "all set" email at 8.',
    },
    {
      title: 'A retry fails during the run',
      body: 'A failed retry is another failed charge that matches this trigger. GHL never enrolls a contact who is still active, so the run carries on and nobody gets a second "your installment did not go through". Re-entry is on for the next installment, which is a new run.',
    },
    {
      title: 'Email DND is on',
      body: 'An unsubscribe from the workshop emails turns Email DND on, and GHL skips every email step for that contact, billing included. The first If/Else catches it and gives Sasha a task on day 0, and the text still goes out if they ticked the transactional box. I do not switch DND off to force a billing email through: the contact set it.',
    },
    {
      title: 'They ask for more time',
      body: 'Stop on Response is off, so a reply does not end the goal that restores access. Sasha answers from Conversations. If she agrees a later date, she removes them from this workflow on the contact record so nothing pauses, and sets herself a task for that date.',
    },
    {
      title: 'They pay GHL’s invoice instead',
      body: 'GHL emails its own invoice when a subscription payment fails. Paying it is a Payment Received success for the same product, so the goal is met, the retries stop, and a new card used there becomes the default for the last installment. The first notice mentions that invoice, so the second email is not a surprise.',
    },
    {
      title: 'Paid in full, or declined at checkout',
      body: 'Neither enters. Paid-in-full buyers have no installments, and the Customer not present/subscription transaction filter leaves out a first-payment decline, which the buyer sees on the checkout page and 02 follows up.',
    },
  ],
  qa: [
    'Decline a test installment: the contact enters once, gets payment-failed, and the Execution Logs show the billing email and, with consent, the text',
    'Let a retry decline during the run: Enrollment History still shows one enrollment',
    'Pay through the billing link during a wait: goal met, payment-failed removed, the thank-you sends, and no reminder follows',
    'Pay GHL’s invoice email instead: the same goal, the same result',
    'Email DND test contact: every email step shows as skipped, and Sasha’s task is created on day 0',
    'Access Pause Date is the first notice plus 10 days, and in the shortened copy the pause lands on that date',
    'On a test student, pause and then pay: the course disappears from the client portal and comes back after payment. I checked lesson progress before any email mentioned it, and none does',
    'Every merge field renders in Gmail, Outlook and on a phone; the text is GSM-7 and at most two segments',
  ],
  snippets: [
    {
      title: 'Trigger, retries, goal and settings',
      language: 'text',
      code: settingsSheet,
      note: 'The trigger filters decide who enters, the retry settings decide how often the card is tried, and the goal ends recovery on any successful payment for the product.',
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
    'Goal Event',
    'Remove Contact Tag',
    'Course Grant Offer',
    'Time Window',
    'Allow Re-entry',
  ],
};
