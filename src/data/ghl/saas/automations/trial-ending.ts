import type { Automation, Contact } from '@/lib/ghl/types';
import { formatClock, formatDay, minutesAtDate } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const api = business.env.customValues.api_base;
const company = (c: Contact) => String(c.fields.company ?? 'their company');
const name = (c: Contact) => `${c.firstName} ${c.lastName}`;

/** Trial Ends (MM-DD-YYYY) as simulated minutes: the start of that day on the current timeline. */
function trialEndsAt(c: Contact): number | undefined {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(c.fields.trial_end ?? ''));
  return m ? minutesAtDate(Number(m[3]), Number(m[1]), Number(m[2])) : undefined;
}

/** Math Operation on a Date field: MM-DD-YYYY plus n days, written back as MM-DD-YYYY. */
function addDays(mdy: string, n: number): string {
  const [m, d, y] = mdy.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}-${dt.getUTCFullYear()}`;
}

/** Commercial emails carry the full postal address; the unsubscribe link sits in the template footer. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const extensionBody = `{
  "days": 7,
  "source": "ghl_trigger_link",
  "requested_by": "{{contact.email}}",
  "ghl_contact_id": "{{contact.id}}"
}`;

const extensionCall = `Action          Custom Webhook
Event           CUSTOM
Method          POST
URL             {{custom_values.api_base}}/workspaces/{{contact.workspace_id}}/trial-extension
Authorization   Bearer Token, key "Crewlo API (workflows)", saved masked in the action
Headers         Content-Type: application/json
                Idempotency-Key: trial-extension-{{contact.workspace_id}}
Raw Body        ${extensionBody.replace(/\n\s*/g, ' ')}

What the app answers
200  {"workspace_id": "ws_3LX8TD", "extended_days": 7, "trial_end": "YYYY-MM-DD"}
409  {"error": "already_extended"}    one extension per trial, whatever GHL sends
404  {"error": "workspace_not_found"}`;

const subscriptionPayload = `{
  "event": "subscription.created",
  "event_id": "evt_01JPB6W3N8TQ5R2K7Y4MZC9DXE",
  "email": "rachel@brightlinehvac.example",
  "workspace_id": "ws_7Q2M9K",
  "plan": "standard-monthly",
  "seats": 9
}`;

const extendOffer = {
  subject: 'Want 7 more days with Crewlo?',
  body:
    "Hi {{contact.first_name}},\n\nYour Crewlo trial ends in 3 days, and it looks like no jobs have gone out to a tech's phone yet. That is the point where Crewlo starts saving your office time, and 3 days may not be enough to get there.\n\nIf you want more time, click this link in the next 3 days and your trial gets 7 more days. Nothing to fill in: {{trigger_link.extend_trial}}\n\nIf it would help, I will also set it up with you on a 20-minute screen share: we load this week's jobs, invite one tech and send them their first job. Reply with two times that suit you.\n\nLeo Park\nCustomer Success, Crewlo" +
    footer,
};

export const trialEnding: Automation = {
  id: 'trial-ending',
  number: '04',
  name: 'Trial ending',
  kicker: 'Trial conversion',
  tagline:
    'Three days before a trial ends, teams that use Crewlo get the price for their seat count, and teams that have not got going get one 7-day extension with a single click. GHL calls the app to extend the workspace, and Leo calls whoever is left on the last day.',
  problem:
    'Trials ended on day 14 whether anyone was ready or not. Teams dispatching from Crewlo every day hit the end of the trial before anyone had talked price with them, and owners who wanted more time emailed support and waited a day or two for someone to extend it by hand.',
  solution:
    "Three days before Trial Ends, the workflow looks at one tag. Activated teams get the price for the users they have, a reminder the day before, and a call from Leo on the last day, and paying at any point pulls them out through the Goal Event. Teams that have not activated get an offer of 7 more days: one click on the trigger link and GHL calls Crewlo's API to extend the workspace, moves Trial Ends and confirms by email. No click means a last-chance call from Leo and a trial-expired tag. Every later step counts from Trial Ends itself, not from the hour the trigger happened to fire, and each trial can be extended once.",
  workflow: {
    name: '04 · Product · Trial Ending',
    folder: 'Product',
    triggers: [
      {
        title: 'Custom Date Reminder',
        filters: ['Custom Date Field: Trial Ends', 'Before Number of Days: 3', 'Has Tag: trial', 'Match on Year Along with Day and Month: on'],
        label: 'Custom Date Reminder (3 days before Trial Ends)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      senderName: 'Leo Park, Crewlo',
      exits: [
        {
          event: 'opportunity_won',
          by: "05 · Sales · Closed-Won to Onboarding, when a New Business deal is marked Won. It adds customer first, so a trial waiting here lands on this workflow's goal and Leo gets the in-app note. Its next step, Remove from Workflow, then takes the contact out of 02 and 04, ending whatever is left of this run, and the step after that removes the trial tag.",
        },
      ],
      notes: [
        'Allow Re-entry on: an extension moves Trial Ends 7 days, and the reminder has to fire again for the new date. GHL does not let a contact re-enter while still active, and the first run has finished days before the second reminder.',
        "Stop on Response off: the deadline stays true whatever the reply says, and an out-of-office reply must not cancel the last-day call. Replies go to Leo, and both of his tasks tell him to read Conversations first.",
        "Timezone: Contact, for the first email's Advance Window. Event Start Date always runs on the account time zone, Pacific, so the waits that count from Trial Ends release at 8 AM in San Francisco, 11 AM in New York: a fine hour for an email and for a call task.",
        'No workflow Time Window: the extension confirmation answers a click and goes at any hour. The first email waits inside an Advance Window, and the rest are pinned to Trial Ends.',
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, the same sender as onboarding.',
        'Custom Webhook is a premium action, billed per execution. It runs only when someone clicks the extension link.',
        'Error notifications are on in the global Workflow Settings and go to Hana. GHL sends at most one error email every 24 hours, so her runbook checks the Needs Review tab each morning instead of waiting for the email.',
      ],
    },
    steps: [
      {
        id: 'event-date',
        kind: 'action',
        action: 'event_date',
        title: 'Event Start Date',
        label: 'Trial Ends',
        summary:
          'Type Custom Field, Trial Ends. The waits below count from this date, not from whenever the trigger fired, which is the product-trial use the Set Event Start Date article describes. GHL runs this action on the account time zone, Pacific, even with the workflow on contact time.',
        run: ({ contact }) => {
          const start = trialEndsAt(contact);
          if (start === undefined) return { log: 'Trial Ends is empty, so there is no date to count from. The Custom Date Reminder does not fire without one.' };
          return { eventStart: start, log: `Event start set to ${formatClock(start)}, the start of the day Trial Ends names (${contact.fields.trial_end}). The waits below count from it.` };
        },
      },
      {
        id: 'send-hours',
        kind: 'wait',
        title: 'Wait',
        label: 'Send hours',
        mode: 'time',
        minutes: 0,
        window: { start: '08:00', end: '18:00', days: ALL_WEEK },
        summary:
          "No delay, but its Advance Window only resumes between 8 AM and 6 PM in the contact's time zone, any day. The Birthday Reminder article says that trigger runs at 8 AM account time; the Custom Date Reminder article gives no hour, so this step decides when the first email goes.",
      },
      {
        id: 'if-activated',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Where is the trial?',
        branches: [
          {
            label: 'Activated',
            when: { type: 'tag', has: 'activated' },
            nodes: [
              {
                id: 'email-upgrade',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Price for their team',
                summary: 'The price per user and their own user count, where to pick a plan, and a reply path for annual billing or a purchase order.',
                message: {
                  channel: 'email',
                  subject: 'Your Crewlo trial ends in 3 days',
                  body:
                    "Hi {{contact.first_name}},\n\nYour team is running jobs through Crewlo, and your trial ends in 3 days. To keep dispatching without a break, pick a plan before then.\n\nCrewlo is {{custom_values.price_per_seat}}, and you only pay for the users you keep. Users in your workspace today, counting you and everyone you have invited: {{contact.seats}}. Choose a plan under Settings > Billing in {{custom_values.app_url}}. What each plan includes: {{custom_values.pricing_link}}\n\nIf you need annual billing, a quote or a purchase order, reply to this email and I will set it up with our sales team.\n\nLeo Park\nCustomer Success, Crewlo" +
                    footer,
                },
              },
              {
                id: 'wait-eve',
                kind: 'wait',
                title: 'Wait',
                label: 'Day before, 8 AM',
                mode: 'before_appointment',
                offset: 16 * 60,
                ifPassed: 'skip_outbound',
                summary:
                  "An upcoming appointment or booking, Type Appointment / Calendar Event (the Event Start Date article's Wait for Event/Appointment Time): Before, 16 hours, which is 8 AM the day before Trial Ends. If this date has already passed: Skip all outbound communication actions till next wait or event start date action, so an \"ends tomorrow\" email can never go out on the last day.",
              },
              {
                id: 'email-tomorrow',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Ends tomorrow',
                summary: 'Short and plain: the deadline, where to pay, what happens to their data, and an honest question about what is in the way.',
                message: {
                  channel: 'email',
                  subject: 'Your Crewlo trial ends tomorrow',
                  body:
                    'Hi {{contact.first_name}},\n\nA quick reminder that your Crewlo trial ends tomorrow. To keep dispatching from the board without a break, choose a plan under Settings > Billing in {{custom_values.app_url}}. You can change the number of users at any time.\n\nIf the trial runs out first, your jobs and settings are kept, and picking a plan later brings everything back.\n\nIf something is holding you back, reply and tell me what it is.\n\nLeo' +
                    footer,
                },
              },
              {
                id: 'wait-last',
                kind: 'wait',
                title: 'Wait',
                label: 'Last day, 8 AM',
                mode: 'after_appointment',
                offset: 8 * 60,
                ifPassed: 'continue',
                summary: 'An upcoming appointment or booking: After, 8 hours, which is 8 AM on the last day of the trial. If this date has already passed: Continue to next action, because the call matters most on the last day.',
              },
              {
                id: 'task-owner',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Leo: activated, not paid',
                summary:
                  'Assign To Leo Park, Due In Now: the trial ends today, so this cannot wait for a weekday. The description has the seat count and phone, and says to check Conversations, Email DND (then they never saw the pricing) and the opportunity first. If an account executive is working it in Trial Sales-Assist, the call is theirs.',
                run: ({ contact, now }) => ({
                  log: `Task for Leo Park, due now (${formatDay(now)}): "Activated, not paid: ${name(contact)}, ${company(contact)}". Seats: ${contact.fields.seats}. Trial Ends is today. Check Conversations, Email DND and the opportunity, then call ${contact.phone}.`,
                }),
              },
              {
                id: 'wait-over-a',
                kind: 'wait',
                title: 'Wait',
                label: 'Trial over',
                mode: 'after_appointment',
                offset: DAY + 8 * 60,
                ifPassed: 'continue',
                summary: 'After, 1 day 8 hours: 8 AM the morning after the last day, once the trial has really ended. If this date has already passed: Continue to next action.',
              },
              {
                id: 'tag-expired-a',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'trial-expired',
                summary: 'The trial ran out without a plan. Same tag as the not-activated path, so the trial report counts both.',
                effect: { addTags: ['trial-expired'] },
              },
              {
                id: 'goal-customer',
                kind: 'goal',
                title: 'Goal Event',
                label: 'Paid',
                event: 'tag_added',
                value: 'customer',
                ifNotMet: 'end',
                summary:
                  'Contact Tag Added or Removed, watching for customer to be added. 04a · Product · Subscription Created adds it when the app posts subscription.created, a self-serve upgrade, and 05 · Sales · Closed-Won to Onboarding adds it on a sales win, one step before it removes the contact from this workflow. The contact moves here from wherever they are, any branch included, so paying skips every email, task and tag still ahead. Reached without it: End this workflow.',
              },
              {
                id: 'notify-paid',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell Leo',
                summary: 'Type of Notification: In-App Notification. To User Type: Particular Users, Leo Park. Redirect Page: the contact. One type per action, and the bell is enough: this tells him to stop, not to act.',
                message: {
                  channel: 'internal',
                  to: 'Leo Park',
                  subject: 'Now a customer: {{contact.company_name}}',
                  body: '{{contact.name}} is a paying customer now (seats on record: {{contact.seats}}), so no more trial emails go out from 04 · Product · Trial Ending. If a last-day call task is open for them, close it.',
                },
              },
            ],
          },
          {
            label: 'Extended already',
            when: { type: 'tag', has: 'trial-extended' },
            nodes: [
              {
                id: 'email-final',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Extra week ends',
                summary: 'The second reminder, fired by the new Trial Ends. No extension link: each trial is extended once. It offers help and the price instead.',
                message: {
                  channel: 'email',
                  subject: 'Your extra week with Crewlo ends in 3 days',
                  body:
                    "Hi {{contact.first_name}},\n\nYour extended trial ends in 3 days. Trials can only be extended once, so this one ends on schedule, but I can still help you get there: reply with two times and I will set Crewlo up with you on a 20-minute screen share, jobs and techs included.\n\nIf you are ready to keep going, choose a plan under Settings > Billing in {{custom_values.app_url}}. Crewlo is {{custom_values.price_per_seat}}, and you only pay for the users you keep.\n\nLeo Park\nCustomer Success, Crewlo" +
                    footer,
                },
              },
              {
                id: 'wait-final',
                kind: 'wait',
                title: 'Wait',
                label: 'Last day, 8 AM',
                mode: 'after_appointment',
                offset: 8 * 60,
                ifPassed: 'continue',
                summary: 'An upcoming appointment or booking: After, 8 hours, which is 8 AM on the new last day. If this date has already passed: Continue to next action.',
              },
              {
                id: 'goto-last',
                kind: 'goto',
                title: 'Go To',
                target: 'task-leo',
                summary: 'The same last-chance call and expiry steps as a trial that never clicked. One set of steps to maintain.',
              },
            ],
          },
        ],
        otherwise: {
          label: 'Not activated',
          nodes: [
            {
              id: 'email-extend',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Offer 7 more days',
              summary: 'One click on the Extend my trial trigger link, inserted with the trigger link picker, not as a raw URL. The set-up call offer from 02 again, for anyone who would rather have help than time.',
              message: { channel: 'email', subject: extendOffer.subject, body: extendOffer.body },
            },
            {
              id: 'wait-click',
              kind: 'wait',
              title: 'Wait',
              label: 'Clicked Extend?',
              mode: 'event',
              event: 'link_clicked',
              value: 'extend_trial',
              minutes: 3 * DAY,
              summary:
                'The contact to take an action: Clicks a trigger link, Extend my trial, so no other click releases it. Timeout 3 days, which is the morning of the last day, and no click gets its own branch.',
              branches: {
                met: {
                  label: 'Clicked',
                  nodes: [
                    {
                      id: 'webhook-extend',
                      kind: 'action',
                      action: 'webhook',
                      title: 'Custom Webhook',
                      label: 'Extend the workspace',
                      summary:
                        "Premium. Event CUSTOM, Method POST to the app's trial-extension endpoint for this workspace. Authorization is a Bearer Token saved as a masked key in the action, so the API key lives in the webhook's headers and never in the body, a message, a field or a custom value. An Idempotency-Key header makes a retry harmless.",
                      run: ({ contact }) => ({
                        log: `POST ${api}/workspaces/${contact.fields.workspace_id}/trial-extension with "days": 7 and an Idempotency-Key header. Crewlo answers 200 and the workspace gets 7 more days.`,
                      }),
                      code: { language: 'json', source: extensionBody },
                    },
                    {
                      id: 'math-trial-end',
                      kind: 'action',
                      action: 'math',
                      title: 'Math Operation',
                      label: 'Trial Ends + 7 days',
                      summary:
                        "Select Field Trial Ends, add 7 days, Update Field Trial Ends. Update Contact Field cannot add days to a date; Math Operation can. GHL's date now matches the app's, and moving it is what fires the reminder again for the new end date.",
                      run: ({ contact }) => {
                        const before = String(contact.fields.trial_end ?? '');
                        if (!before) return { log: 'Trial Ends is empty, so there is nothing to add to.' };
                        const after = addDays(before, 7);
                        return { effect: { fields: { trial_end: after } }, log: `Trial Ends ${before} + 7 days = ${after}.` };
                      },
                    },
                    {
                      id: 'tag-extended',
                      kind: 'action',
                      action: 'add_tag',
                      title: 'Add Contact Tag',
                      label: 'trial-extended',
                      summary: 'Marks the one extension this trial gets. The If/Else above reads it when the reminder fires again.',
                      effect: { addTags: ['trial-extended'] },
                    },
                    {
                      id: 'email-extended',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Extension confirmed',
                      summary: 'Transactional, so it goes at once, day or night: they just asked for it. One job for the extra week, and the set-up offer again.',
                      message: {
                        channel: 'email',
                        subject: 'Your Crewlo trial has 7 more days',
                        body:
                          "Hi {{contact.first_name}},\n\nDone: your Crewlo trial now runs 7 days longer, and the new end date shows under Settings > Billing. Your jobs, settings and team logins stay as they are.\n\nTo make the week count, put one real job on the board and send it to a tech's phone: {{custom_values.app_url}}. Short guides for each step: {{custom_values.help_center}}\n\nMy offer stands: reply with two times and I will set it up with you on a 20-minute screen share.\n\nLeo",
                      },
                    },
                  ],
                },
                timeout: {
                  label: 'No click by the last day',
                  nodes: [
                    {
                      id: 'task-leo',
                      kind: 'action',
                      action: 'add_task',
                      title: 'Add Task',
                      label: 'Last-chance call',
                      summary:
                        'Assign To Leo Park, Due In Now: the trial ends today. The description has the workspace ID and phone, and three checks before calling: a reply in Conversations, the activated tag (the team may have started since the offer went out) and the activity timeline for a late click on Extend my trial.',
                      run: ({ contact, now }) => {
                        const again = contact.tags.includes('trial-extended');
                        return {
                          log: `Task for Leo Park, due now (${formatDay(now)}): "Last-chance call: ${name(contact)}, ${company(contact)}". Trial Ends is today${again ? ', after its one extension' : ''}. Workspace ${contact.fields.workspace_id} had not sent a job to a tech when the reminder fired 3 days ago. Check Conversations, the activated tag and the activity timeline, then call ${contact.phone}.`,
                        };
                      },
                    },
                    {
                      id: 'wait-over',
                      kind: 'wait',
                      title: 'Wait',
                      label: 'Trial over',
                      mode: 'after_appointment',
                      offset: DAY + 8 * 60,
                      ifPassed: 'continue',
                      summary: 'An upcoming appointment or booking: After, 1 day 8 hours, so the tag goes on at 8 AM the morning after the last day, once the trial has really ended. If this date has already passed: Continue to next action.',
                    },
                    {
                      id: 'tag-expired',
                      kind: 'action',
                      action: 'add_tag',
                      title: 'Add Contact Tag',
                      label: 'trial-expired',
                      summary: 'The trial ran out without a plan. The trial report and any later win-back list filter on it.',
                      effect: { addTags: ['trial-expired'] },
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
  scenarios: [
    {
      id: 'upgrades',
      label: 'Activated, then upgrades',
      summary:
        "Rachel's crew has dispatched from Crewlo since day 2 of her trial. The reminder fires early Saturday and the pricing email waits for 8 AM. She picks a plan on Monday afternoon, after the day-before email, and the Goal Event takes her out.",
      start: at(12, 6),
      contact: {
        tags: ['trial', 'activated'],
        fields: { company: 'Brightline HVAC', workspace_id: 'ws_7Q2M9K', plan: 'trial', trial_end: '03-17-2026', seats: 9 },
      },
      events: [
        { at: at(12, 8, 14) - at(12, 6), type: 'email_opened' },
        { at: at(14, 14, 25) - at(12, 6), type: 'tag_added', value: 'customer', label: 'Added by 04a: the app posted subscription.created for 9 seats' },
      ],
      expect: {
        outcome: 'goal',
        visits: ['event-date', 'send-hours', 'if-activated:0', 'email-upgrade', 'wait-eve', 'email-tomorrow', 'goal-customer', 'notify-paid'],
        tags: ['activated', 'customer'],
      },
    },
    {
      id: 'never-pays',
      label: 'Activated, unsubscribed, never pays',
      summary:
        "Dana's team uses the board every day, but she unsubscribed from the onboarding tips in week one, so Email DND is on. GHL skips both emails. Leo's call task on the last morning is the only touch, and the trial ends tagged trial-expired.",
      start: at(14, 6),
      contact: {
        firstName: 'Dana',
        lastName: 'Whitfield',
        email: 'dana@whitfieldclean.example',
        phone: '(919) 555-0168',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated'],
        dnd: { email: true },
        fields: { company: 'Whitfield Home Cleaning', workspace_id: 'ws_9FC2VB', plan: 'trial', trial_end: '03-19-2026', seats: 4 },
      },
      events: [],
      expect: {
        outcome: 'ended',
        visits: ['if-activated:0', 'wait-eve', 'wait-last', 'task-owner', 'wait-over-a', 'tag-expired-a', 'goal-customer'],
        skips: ['email-upgrade', 'email-tomorrow'],
        tags: ['activated', 'trial-expired'],
      },
    },
    {
      id: 'extends',
      label: 'Not activated, clicks Extend',
      summary:
        "Marcus never got a job to a tech's phone. He clicks the extension link at 9:12 on Sunday night: Crewlo's API extends the workspace, Trial Ends moves a week, and the confirmation goes out straight away.",
      start: at(13, 5),
      contact: {
        firstName: 'Marcus',
        lastName: 'Hale',
        email: 'marcus@haleplumbing.example',
        phone: '(512) 555-0134',
        timezone: 'America/Chicago',
        source: 'Crewlo app signup',
        tags: ['trial'],
        fields: { company: 'Hale Plumbing & Drain', workspace_id: 'ws_3LX8TD', plan: 'trial', trial_end: '03-18-2026', seats: 1 },
      },
      events: [
        { at: at(13, 21, 10) - at(13, 5), type: 'email_opened' },
        { at: at(13, 21, 12) - at(13, 5), type: 'link_clicked', value: 'extend_trial', label: 'Extend my trial' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['event-date', 'if-activated:else', 'email-extend', 'wait-click:met', 'webhook-extend', 'math-trial-end', 'tag-extended', 'email-extended'],
        tags: ['trial-extended'],
      },
    },
    {
      id: 'ignores',
      label: 'Not activated, ignores it',
      summary:
        'Kira opens the offer on Tuesday and does nothing. On the last morning Leo gets a last-chance call task, and the next morning the trial is tagged trial-expired.',
      start: at(8, 3),
      contact: {
        firstName: 'Kira',
        lastName: 'Novak',
        email: 'kira@novakpools.example',
        phone: '(602) 555-0187',
        timezone: 'America/Phoenix',
        source: 'Google ads',
        tags: ['trial'],
        fields: { company: 'Novak Pool Service', workspace_id: 'ws_4TB6YE', plan: 'trial', trial_end: '03-13-2026', seats: 2 },
      },
      events: [{ at: at(8, 12, 15) - at(8, 3), type: 'email_opened' }],
      expect: { outcome: 'completed', visits: ['if-activated:else', 'email-extend', 'wait-click:timeout', 'task-leo', 'wait-over', 'tag-expired'], tags: ['trial-expired'] },
    },
    {
      id: 'second-reminder',
      label: 'Already extended once',
      summary:
        "Sam took the extra week. Moving Trial Ends fired the reminder again and re-entry let him back in, but a trial is only extended once: no link this time. He answers by email asking for the screen share. Stop on Response is off, so Leo still gets the last-day task and the expiry tag still follows.",
      start: at(11, 4),
      contact: {
        firstName: 'Sam',
        lastName: 'Ortega',
        email: 'sam@ortegadoors.example',
        phone: '(720) 555-0163',
        timezone: 'America/Denver',
        source: 'Crewlo app signup',
        tags: ['trial', 'trial-extended'],
        fields: { company: 'Ortega Garage Doors', workspace_id: 'ws_6MW3RC', plan: 'trial', trial_end: '03-16-2026', seats: 1 },
      },
      events: [{ at: at(11, 12, 40) - at(11, 4), type: 'reply', channel: 'email', value: 'Thanks Leo. Could we do the screen share Monday at 10 my time?' }],
      expect: { outcome: 'completed', visits: ['if-activated:1', 'email-final', 'wait-final', 'goto-last', 'task-leo', 'wait-over', 'tag-expired'], tags: ['trial-extended', 'trial-expired'] },
    },
  ],
  dataModel: {
    customFields: [
      {
        name: 'Trial Ends',
        key: 'trial_end',
        type: 'Date',
        note: 'Written by 02 from trial.started as MM-DD-YYYY. The trigger counts back from it, Event Start Date anchors the waits to it, and the Math Operation here moves it on an extension. Empty means no reminder.',
      },
      { name: 'Seats', key: 'seats', type: 'Number', note: 'Written by 03 from each daily usage.snapshot while the plan is trial: people invited plus the owner, the number the pricing email quotes. Once paid, 04a writes the seats bought in the app, or the AE the seats sold (05).' },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: "The app's ID for the workspace. Goes into the path of the extension call." },
    ],
    tags: [
      { name: 'trial', note: 'Trigger filter: the trigger can require a tag but not exclude one, so this is the gate. Added by 02; 04a removes it on subscription.created and 05 when a deal is won, so customers never get a trial reminder' },
      { name: 'activated', note: 'Picks the branch. Added by 02a when the first job reaches a tech' },
      { name: 'customer', note: 'The goal. Added by 04a from subscription.created, and by 05 on a sales win one step before it removes the contact from this workflow, so both land on the goal' },
      { name: 'trial-extended', note: 'This trial has had its one extension. Added here after the API call; 02 clears it when a new trial starts' },
      { name: 'trial-expired', note: 'The trial ran out without a plan. 02 clears it when a new trial starts' },
    ],
    customValues: [
      { name: 'Price Per Seat', key: 'price_per_seat', value: '$29 per user per month' },
      { name: 'Pricing Link', key: 'pricing_link', value: 'crewlo.example/pricing' },
      { name: 'App URL', key: 'app_url', value: 'app.crewlo.example' },
      { name: 'Help Center', key: 'help_center', value: 'help.crewlo.example' },
      { name: 'API Base', key: 'api_base', value: 'https://api.crewlo.example/v1' },
    ],
  },
  build: [
    {
      title: 'Agree the end of a trial first',
      body: 'With Hana and Leo: activated teams get pricing and a call, teams that have not activated get one 7-day extension, and nobody gets two. The product team owns the rule in the app too: the extension endpoint refuses a second extension for the same workspace, whatever GHL sends.',
    },
    {
      title: 'Trigger on the date the app already sends',
      body: "Custom Date Reminder on Trial Ends, Before Number of Days 3, Has Tag trial. The trigger can require a tag but not exclude one, so both ways of paying remove trial: 04a on subscription.created and 05 when a deal is won. Match on Year Along with Day and Month is on, or a trial that ended last April would get \"3 days left\" every April; the article's FAQ describes that toggle the other way round, so the test plan checks it. The article gives no hour for the trigger, so a zero-length Wait with an Advance Window decides when the first email goes.",
    },
    {
      title: 'Count from Trial Ends, not from the trigger',
      body: 'Event Start Date reads Trial Ends, and every later timed wait is An upcoming appointment or booking counted from it: 16 hours before for the day-before email, 8 hours after for the last-day call, a day and 8 hours after for the expiry tag. If the trigger fires late, or someone adds a contact by hand, the emails still land on the right day, and the day-before wait skips its email rather than send it on the last day. A chain of 2-day and 1-day waits would drift with the trigger hour.',
    },
    {
      title: 'One tag decides the path',
      body: 'The If/Else reads activated first, so a team that activated during its extra week still gets pricing. Then trial-extended, for the second reminder. Everyone else gets the extension offer. The emails come from Leo, like onboarding, so replies reach someone who knows the account.',
    },
    {
      title: 'The extension: link, wait, API call, date',
      body: "A trigger link named Extend my trial, inserted with the picker, whose URL is Settings > Billing in the app: that page shows the trial's real end date from Crewlo's own records, so a failed or late click never shows an extension that did not happen. The Wait listens for that one link, with a 3-day timeout. The Custom Webhook posts to the app with a Bearer token Hana saved as a masked key, plus an Idempotency-Key header, because GHL can retry a failed call with exponential backoff and a retry must not add a second week. Then Math Operation adds 7 days to Trial Ends, which keeps reports right and makes the reminder fire again for the new date. I tested it against the staging API with a test workspace and read the status codes in Execution Logs.",
    },
    {
      title: 'One goal: paid',
      body: "GHL allows one Goal Event per workflow, so it is the one that matters: Contact Tag Added or Removed, watching for customer to be added. The app posts subscription.created to 04a · Product · Subscription Created, which finds the contact with Create/Update Contact (Plan and Seats mapped), adds customer and removes trial. A deal won in sales gets the same tag from 05, one step before 05's Remove from Workflow, so both kinds of payment land here and Leo gets the same note. The goal sits after the last-day steps with End this workflow, and a contact who pays in any branch moves to it, so paying skips everything that is left.",
    },
    {
      title: 'Email only, on purpose',
      body: "No texts here. SMS consent (service) on the demo form covers booking reminders, and SMS consent (offers) covers product news and event invites; a nudge to pay is neither, and trials that start in the app give no text consent at all. The pricing, reminder and offer emails are commercial, so they carry the full postal address and the unsubscribe link in the footer. The extension confirmation is transactional and goes at any hour.",
    },
    {
      title: 'Test, then hand over',
      body: 'Test contacts with Trial Ends set 3 days out, one per scenario, entered by the real trigger, so Enrollment History showed the hour it fires and Execution Logs the hour GHL gives a date with no time. Then a contact added by hand the day before its Trial Ends, to watch the day-before wait skip its email. I walked Leo through his two tasks and wrote down what to do when the extension call fails.',
    },
  ],
  edgeCases: [
    {
      title: 'Pays, signs or is already with sales',
      body: "04a and 05 remove the trial tag, so Has Tag: trial keeps paying customers out. If they pay while in the workflow, the Goal Event moves them to the goal from wherever they are, extension path included, and Leo gets the in-app note. That holds for a deal won in sales too: 05 adds customer first, then removes the contact from 02 and 04, then removes trial, so its removal only ends what the goal has left. A trial that 03 sent to an account executive still gets the pricing email, which quotes the public price and routes quotes to a reply; Leo's last-day task says the call belongs to the AE if the deal is open.",
    },
    {
      title: 'Clicks late, twice, or from a forwarded email',
      body: "The link opens Billing, which shows the real end date, so nobody is told they got a week they did not get. A click after the wait closes is only recorded in the activity timeline; Leo's task says to check it, and if they want the week he extends it in the app admin, adds 7 days to Trial Ends, adds trial-extended and removes them from 04 so trial-expired does not follow. A second click in the same run does nothing, and a forwarded click counts for the contact it was sent to, which is the same workspace.",
    },
    {
      title: 'The extension call fails',
      body: "Depending on the error, GHL retries with exponential backoff or marks the step failed and skips it. The docs offer Save response from this Webhook for GET only, so this build does not branch on the response: the date, the tag and the confirmation still follow. The workflow lands in Needs Review, and Hana's morning check extends that workspace in the app admin the same day, which makes the email true. A 409 means support had already extended that workspace by hand; she sets Trial Ends back to the app's date.",
    },
    {
      title: 'Unsubscribed (Email DND)',
      body: 'GHL skips every email step, so there is nothing to click and the wait times out. Leo still gets the last-day call task, and so does an activated team that never saw the pricing. A phone call from Leo is not an email, so the unsubscribe does not block it.',
    },
    {
      title: 'Last day on a weekend',
      body: "Leo's task is due Now on a Saturday or Sunday and may sit until Monday, when the trial has ended. That call becomes a win-back call, and it still works: the app keeps the workspace, and picking a plan brings it back. The emails do not wait for weekdays, because the trial clock does not.",
    },
    {
      title: 'The same company starts a new trial next year',
      body: 'trial-extended and trial-expired describe one trial, so they have to come off when a new trial starts. The Remove Contact Tag step at the top of 02 · Product · Trial Onboarding clears them along with activated, pql-alerted and pql-tip-sent. Otherwise the new trial would be treated as already extended.',
    },
  ],
  qa: [
    'Activated test contact with Trial Ends 3 days out: enters that day, Enrollment History shows the hour, and the pricing email shows the price and the right user count',
    'Trial Ends 3 days from today but last year: does not enter. Trial Ends on January 2: check it still enters on December 30 with year matching on, since the article reads as if the year must match the current one',
    'Contact tagged customer without trial: does not enter. Win a test deal for a contact waiting here: Execution Logs show the jump to the goal and Leo gets the in-app note, trial comes off and no reminder follows',
    'Click Extend in the test email: the staging API logs the POST with the Bearer header, Execution Logs show 200, Trial Ends moves 7 days, trial-extended is added and the confirmation arrives',
    'Add the customer tag to test contacts waiting in each branch: each jumps to the goal, Leo gets the in-app note, and nothing else sends',
    'Add a contact by hand the day before its Trial Ends: the day-before email is skipped, and the last-day task and expiry tag still come at 8 AM Pacific',
    'Extended test contact, Trial Ends 3 days out again: it re-enters, takes Extended already, and the email has no extension link',
    'Contact with Email DND: no emails, Leo still gets the task. The other emails show the full postal address and unsubscribe link in Gmail and Outlook',
  ],
  snippets: [
    {
      title: 'Extension call (Custom Webhook)',
      language: 'text',
      code: extensionCall,
      note: 'The API key is a masked key saved in the action and sent as the Authorization header. It is never in a URL, a message, a contact field or a custom value, where any user could merge it into an email.',
    },
    {
      title: 'Extension offer email',
      language: 'text',
      code: `Subject: ${extendOffer.subject}\n\n${extendOffer.body}`,
      note: "{{trigger_link.extend_trial}} stands for the trigger link inserted with the picker. Its URL is Settings > Billing in the app, which shows the trial's end date from Crewlo's own records: the new date a few seconds after the call lands, or the old one if the click came too late.",
    },
    {
      title: 'subscription.created payload (feeds 04a)',
      language: 'json',
      code: subscriptionPayload,
      note: "04a · Product · Subscription Created has its own Inbound Webhook URL. Create/Update Contact finds the contact by email and maps Plan and Seats, then Add Contact Tag adds customer and Remove Contact Tag removes trial. It does not remove anyone from 02: a team that pays before dispatching a job still needs the onboarding emails. The customer tag is what this workflow's goal listens for.",
    },
  ],
  features: [
    'Custom Date Reminder',
    'Event Start Date',
    'Wait · Advance Window',
    'Wait · An upcoming appointment or booking',
    'If/Else',
    'Send Email',
    'Trigger Links',
    'Wait · The contact to take an action',
    'Custom Webhook (premium)',
    'Math Operation',
    'Add Contact Tag',
    'Add Task',
    'Go To',
    'Goal Event',
    'Internal Notification',
    'Allow Re-entry',
    'Error notifications',
  ],
};
