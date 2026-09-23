import type { Automation, Contact } from '@/lib/ghl/types';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
/** Monday 2 March 2026, 00:00: the sample week the simulator runs in. */
const BASE = Date.UTC(2026, 2, 2);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const api = business.env.customValues.api_base;
const company = (c: Contact) => String(c.fields.company ?? 'their company');

/** "Thu, Mar 19" for a simulated minute. */
function dayOf(min: number): string {
  const day = Math.floor(min / DAY);
  const d = new Date(BASE + day * DAY * 60000);
  return `${WEEKDAY[day % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Math Operation on a Date field: MM-DD-YYYY plus n days, written back as MM-DD-YYYY. */
function addDays(mdy: string, n: number): string {
  const [m, d, y] = mdy.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}-${dt.getUTCFullYear()}`;
}

/** Commercial emails carry the postal address; the unsubscribe link sits in the template footer. */
const footer = '\n\n{{location.name}}, {{location.address}}';

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
200  {"workspace_id": "ws_3LX8TD", "trial_end": "2026-03-25", "extended_days": 7}
409  {"error": "already_extended"}    one extension per trial, whatever GHL sends
404  {"error": "workspace_not_found"}`;

const subscriptionPayload = `{
  "event": "subscription.created",
  "event_id": "evt_01JPB6W3N8TQ5R2K7Y4MZC9DXE",
  "occurred_at": "2026-03-16T18:25:41Z",
  "email": "rachel@brightlinehvac.example",
  "workspace_id": "ws_7Q2M9K",
  "plan": "standard-monthly",
  "seats": 9
}`;

const extendOffer = {
  subject: 'Want 7 more days with Crewlo?',
  body:
    "Hi {{contact.first_name}},\n\nYour Crewlo trial ends in 3 days, and it looks like no jobs have gone out to a tech's phone yet. That is the point where Crewlo starts saving your office time, and 3 days may not be enough to get there.\n\nIf you want more time, this link adds 7 days to your trial straight away. Nothing to fill in: {{trigger_link.extend_trial}}\n\nIf it would help, I will also set it up with you on a 20-minute screen share: we load this week's jobs, invite one tech and send them their first job. Reply with two times that suit you.\n\nLeo Park\nCustomer Success, Crewlo" +
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
    'Three days before Trial Ends, the workflow looks at one tag. Activated teams get the price for the users they have, a reminder the day before, and a call from Leo on the last day, and paying at any point pulls them out through the Goal Event. Teams that have not activated get an offer of 7 more days: one click on the trigger link and GHL calls Crewlo\'s API to extend the workspace, moves Trial Ends and confirms by email. No click means a last-chance call from Leo and a trial-expired tag. Each trial can be extended once, and the workflow knows when it already has been.',
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
      notes: [
        'Allow Re-entry on: an extension moves Trial Ends 7 days, and the reminder should fire again for the new date. GHL does not let a contact re-enter while still active, and the first run has finished days before the second reminder.',
        'Stop on Response off: the deadline stays true whatever the reply says, and an out-of-office reply must not cancel the last-day call. Replies go to Leo, and his tasks tell him to read Conversations first.',
        'No workflow Time Window: the extension confirmation answers a click and goes at any hour. The trial emails wait inside Advance Windows instead.',
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, the same sender as onboarding.',
        'Custom Webhook is a premium action, billed per execution. It runs only when someone clicks the extension link.',
        'Error notifications are on in the global Workflow Settings, sent to Hana: a failed extension call puts this workflow in the Needs Review tab.',
      ],
    },
    steps: [
      {
        id: 'send-hours',
        kind: 'wait',
        title: 'Wait',
        label: 'Send hours',
        mode: 'time',
        minutes: 0,
        window: { start: '08:00', end: '18:00', days: ALL_WEEK },
        summary:
          "No delay, but its Advance Window only resumes between 8 AM and 6 PM in the contact's time zone, any day. The Custom Date Reminder article does not say at what hour the trigger fires, so this step decides when the first email goes.",
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
                    "Hi {{contact.first_name}},\n\nYour team is running jobs through Crewlo, and your trial ends in 3 days. To keep the board, the jobs and your techs' logins as they are, pick a plan before then.\n\nCrewlo is {{custom_values.price_per_seat}}. Your workspace has {{contact.seats}} users today, and you only pay for the users you keep. Choose a plan under Settings > Billing in {{custom_values.app_url}}. What each plan includes: {{custom_values.pricing_link}}\n\nIf you need annual billing, a quote or a purchase order, reply to this email and I will set it up with our sales team.\n\nLeo Park\nCustomer Success, Crewlo" +
                    footer,
                },
              },
              {
                id: 'wait-eve',
                kind: 'wait',
                title: 'Wait',
                label: 'Day before it ends',
                mode: 'time',
                minutes: 2 * DAY,
                window: { start: '08:00', end: '18:00', days: ALL_WEEK },
                summary: 'Two days, which lands on the day before Trial Ends because the trigger fired exactly 3 days out. Same 8 AM to 6 PM Advance Window.',
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
                label: 'Last day',
                mode: 'time',
                minutes: DAY,
                summary: 'One day, to the morning of the last day of the trial.',
              },
              {
                id: 'task-owner',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Leo: activated, not paid',
                summary:
                  'Assigned to Leo Park, Due In Now: the trial ends tonight, so this cannot wait for a weekday. The description gives the user count and says to check the opportunity first. If an account executive is working it in Trial Sales-Assist, the call is theirs.',
                run: ({ contact, now }) => ({
                  log: `Task for Leo Park, due now (${dayOf(now)}): "Activated, not paid: ${contact.firstName} ${contact.lastName}, ${company(contact)}". ${contact.fields.seats} users on the board and the trial ends tonight. Check Conversations and the opportunity, then call ${contact.phone}.`,
                }),
              },
              {
                id: 'wait-over-a',
                kind: 'wait',
                title: 'Wait',
                label: 'Trial over',
                mode: 'time',
                minutes: DAY,
                summary: 'One more day, so the next step runs the morning after the last day, once the trial has really ended.',
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
                  'Contact Tag Added: customer. 04a · Subscription Created adds the tag when the app posts subscription.created. Paying at any point pulls the contact here, and the nudges, the call task and the expiry tag never happen. Reached without it: End this workflow.',
              },
              {
                id: 'notify-paid',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell Leo',
                summary: 'Type of Notification: In-App Notification to Leo Park, with the contact record as the Redirect Page, so he stops chasing a trial that has already paid.',
                message: {
                  channel: 'internal',
                  to: 'Leo Park',
                  subject: 'Upgraded: {{contact.company}}',
                  body: '{{contact.name}} picked a plan for {{contact.seats}} users before the trial ended. The remaining trial emails will not send, and no last-day call task will be created.',
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
                summary: 'This is the second reminder, fired by the new Trial Ends. No extension link: each trial is extended once. It offers help and the price instead.',
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
                label: 'Last day',
                mode: 'time',
                minutes: 3 * DAY,
                summary: 'Three days, the same length as the click timeout below, so both paths reach the last day at the same hour.',
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
              minutes: 3 * DAY,
              summary: 'The contact to take an action: Clicks a trigger link, Extend my trial. Timeout 3 days, which is the morning of the last day, so no click gets its own branch.',
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
                        'Event CUSTOM, POST to the app\'s trial-extension endpoint for this workspace. Authorization is a Bearer token saved as a masked key in the action, so the API key lives in the webhook\'s headers and never in a message, a field or a custom value.',
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
                        'Select Field Trial Ends, Add 7 Days, Update Field Trial Ends. GHL\'s date now matches the app\'s, and moving it is what fires this reminder again for the new end date.',
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
                          "Hi {{contact.first_name}},\n\nDone: your Crewlo trial now runs 7 days longer. Your jobs, settings and team logins stay as they are.\n\nTo make the week count, put one real job on the board and send it to a tech's phone: {{custom_values.app_url}}. Short guides for each step: {{custom_values.help_center}}\n\nMy offer stands: reply with two times and I will set it up with you on a 20-minute screen share.\n\nLeo",
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
                        'Assigned to Leo Park, Due In Now. The description has the workspace ID and phone, and says to read Conversations and check the activity timeline for a late click before calling.',
                      run: ({ contact, now }) => {
                        const again = contact.tags.includes('trial-extended');
                        return {
                          log: `Task for Leo Park, due now (${dayOf(now)}): "Last-chance call: ${contact.firstName} ${contact.lastName}, ${company(contact)}". The trial ends tonight${again ? ' after its one extension' : ''}, and workspace ${contact.fields.workspace_id} has not sent a job to a tech yet. Call ${contact.phone}.`,
                        };
                      },
                    },
                    {
                      id: 'wait-over',
                      kind: 'wait',
                      title: 'Wait',
                      label: 'Trial over',
                      mode: 'time',
                      minutes: DAY,
                      summary: 'One day, so the tag goes on the morning after the last day, once the trial has really ended.',
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
      expect: { outcome: 'goal', visits: ['send-hours', 'if-activated:0', 'email-upgrade', 'email-tomorrow', 'goal-customer', 'notify-paid'], tags: ['activated', 'customer'] },
    },
    {
      id: 'never-pays',
      label: 'Activated, never pays',
      summary:
        'Dana\'s team uses the board every day. She opens both emails but never picks a plan, so Leo gets a call task on the last morning and the trial ends tagged trial-expired.',
      start: at(14, 6),
      contact: {
        firstName: 'Dana',
        lastName: 'Whitfield',
        email: 'dana@whitfieldclean.example',
        phone: '(919) 555-0168',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated'],
        fields: { company: 'Whitfield Home Cleaning', workspace_id: 'ws_9FC2VB', plan: 'trial', trial_end: '03-19-2026', seats: 4 },
      },
      events: [
        { at: at(14, 12, 40) - at(14, 6), type: 'email_opened' },
        { at: at(16, 19, 55) - at(14, 6), type: 'email_opened' },
      ],
      expect: { outcome: 'ended', visits: ['if-activated:0', 'email-tomorrow', 'wait-last', 'task-owner', 'wait-over-a', 'tag-expired-a', 'goal-customer'], tags: ['activated', 'trial-expired'] },
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
      expect: { outcome: 'completed', visits: ['if-activated:else', 'email-extend', 'wait-click:met', 'webhook-extend', 'math-trial-end', 'tag-extended', 'email-extended'], tags: ['trial-extended'] },
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
        'Sam took the extra week. Moving Trial Ends fired the reminder again and re-entry let him back in, but a trial is only extended once: no link this time, and Leo calls on the new last day.',
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
      events: [],
      expect: { outcome: 'completed', visits: ['if-activated:1', 'email-final', 'wait-final', 'goto-last', 'task-leo', 'tag-expired'], tags: ['trial-extended', 'trial-expired'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Trial Ends', key: 'trial_end', type: 'Date', note: 'Written by 02 from trial.started as MM-DD-YYYY. The trigger counts back from it, and the Math Operation here moves it on an extension. Empty means no reminder.' },
      { name: 'Seats', key: 'seats', type: 'Number', note: 'Users in the workspace, kept current by the app\'s events. At least 1, since the owner counts.' },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: 'Goes into the path of the extension call.' },
    ],
    tags: [
      { name: 'trial', note: 'Trigger filter. Added by 02; 04a removes it when the contact pays, so customers never get a trial reminder' },
      { name: 'activated', note: 'Picks the branch. Added by 02a when the first job reaches a tech' },
      { name: 'customer', note: 'The goal. Added by 04a from subscription.created' },
      { name: 'trial-extended', note: 'This trial has had its one extension. Added here after the API call' },
      { name: 'trial-expired', note: 'The trial ran out without a plan' },
    ],
    customValues: [
      { name: 'Price Per Seat', key: 'price_per_seat', value: '$29 per user per month' },
      { name: 'Pricing Link', key: 'pricing_link', value: 'crewlo.example/pricing' },
      { name: 'App URL', key: 'app_url', value: 'app.crewlo.example' },
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
      body: 'Custom Date Reminder on Trial Ends, Before Number of Days 3, Has Tag trial. Match on Year Along with Day and Month is on, or a trial that ended last April would get "3 days left" every April. The article\'s FAQ describes that toggle the other way round, so the test plan checks it. The article does not say at what hour the trigger fires, so the first step is a zero-length Wait whose Advance Window decides when emails go.',
    },
    {
      title: 'One tag decides the path',
      body: 'The If/Else reads activated first, so a team that activated during its extra week still gets pricing. Then trial-extended, for the second reminder. Everyone else gets the extension offer. The emails come from Leo, like onboarding, so replies reach someone who knows the account.',
    },
    {
      title: 'The extension: link, wait, API call',
      body: 'A trigger link named Extend my trial, pointing at a confirmation page in the app, inserted with the trigger link picker. A Wait for the click with a 3-day timeout. The Custom Webhook posts to the app with a Bearer token that Hana saved as a masked key, plus an Idempotency-Key header, because GHL can retry a failed call with exponential backoff and a retry must not add a second week. I tested it against the staging API with a test workspace and read the status codes in Execution Logs.',
    },
    {
      title: 'Keep GHL\'s date in step',
      body: 'Math Operation adds 7 days to Trial Ends, the same field it reads. That keeps smart lists and reports right, and it makes the reminder fire again 3 days before the new date. Re-entry is on for that second run, and the trial-extended tag sends it down the path without a link.',
    },
    {
      title: 'One goal: paid',
      body: 'GHL allows one Goal Event per workflow, so it is the one that matters: Contact Tag Added: customer. The app posts subscription.created to 04a · Subscription Created, which finds the contact, adds customer and removes trial. The goal sits after the last-day steps with End this workflow, so paying at any point skips everything that is left.',
    },
    {
      title: 'Email only, on purpose',
      body: 'No texts here. The demo form\'s text consent covers booking reminders and product news, not billing nudges. The pricing, reminder and offer emails are commercial, so they carry the postal address and the unsubscribe link in the footer. The extension confirmation is transactional and goes at any hour.',
    },
    {
      title: 'Test, then hand over',
      body: 'Test contacts with Trial Ends set 3 days out, one per scenario, entered by the real trigger, and a test copy with the waits cut to minutes for the rest. Then I walked Leo through his two tasks and wrote down what to do when the extension call fails.',
    },
  ],
  edgeCases: [
    {
      title: 'Pays before the reminder, or during it',
      body: '04a removes the trial tag on payment, so Has Tag: trial keeps paying customers out of this workflow. If they pay while in it, the Goal Event article says the contact moves to the goal from wherever they are, so even a team in the extension path lands on it and Leo hears they paid.',
    },
    {
      title: 'Clicks after the timeout, or twice',
      body: 'A late click is recorded in the activity timeline, but the wait has closed, so nothing calls the app. Leo\'s task says to check the timeline first; he extends in the app admin and updates Trial Ends by hand. A second click during the same run does nothing either: the contact is already past the wait.',
    },
    {
      title: 'The extension call fails',
      body: 'Depending on the error, GHL retries with exponential backoff or marks the step failed and skips it. This build does not branch on the response, so the confirmation still goes. Error notifications email Hana, the workflow shows in Needs Review, and her runbook says to extend that workspace in the app admin the same day, which makes the email true.',
    },
    {
      title: 'Email DND',
      body: 'GHL skips the emails, so there is nothing to click and the wait times out. Leo still gets the last-day call task, and so does an activated team that never saw the pricing.',
    },
    {
      title: 'A colleague clicks a forwarded email',
      body: 'The click counts for the contact the email was sent to. It is the same workspace, so the extension goes to the right trial either way.',
    },
    {
      title: 'The same company starts a new trial next year',
      body: 'trial-extended and trial-expired describe one trial, so they have to come off when a new trial starts. The right place is the Remove Contact Tag step at the top of 02 · Trial Onboarding, which clears activated for the same reason. Otherwise the new trial would be treated as already extended.',
    },
  ],
  qa: [
    'Activated test contact with Trial Ends 3 days out: enters on the day, and the pricing email shows the price and the right user count',
    'Contact whose Trial Ends was 3 days from today last year: does not enter',
    'Contact tagged customer without trial: does not enter',
    'Click Extend in the test email: the staging API logs the POST with the Bearer header, Execution Logs show 200, Trial Ends moves 7 days, trial-extended is added and the confirmation arrives',
    'Add the customer tag to a waiting test contact: it jumps to the goal, Leo is notified, and nothing else sends',
    'Test copy with minute-long waits and no click: Leo gets the last-chance task, and trial-expired is added a step later',
    'Extended test contact, Trial Ends 3 days out again: it re-enters, takes Extended already, and the email has no extension link',
    'Trial Ends of January 2: the reminder still fires on December 30 with year matching on',
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
      note: '{{trigger_link.extend_trial}} stands for the trigger link inserted with the picker. The link\'s target is the app\'s "your trial has 7 more days" page, so the person sees the result at once.',
    },
    {
      title: 'subscription.created payload (feeds 04a)',
      language: 'json',
      code: subscriptionPayload,
      note: '04a · Product · Subscription Created has its own Inbound Webhook URL. It runs Create/Update Contact on the email, updates Plan and Seats, adds customer and removes trial. The customer tag is what this workflow\'s goal listens for.',
    },
  ],
  features: [
    'Custom Date Reminder',
    'If/Else',
    'Wait · Advance Window',
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
