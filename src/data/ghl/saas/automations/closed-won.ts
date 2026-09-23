import type { Automation, Condition, Contact } from '@/lib/ghl/types';
import { formatClock, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2, 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const { users, customValues } = business.env;

/** Full name of the contact's owner at that point in the run. */
const owner = (c: Contact) => (c.assignedTo && users[c.assignedTo]?.name) || 'the account executive';
const companyOf = (c: Contact) => String(c.fields.company_name ?? c.fields.company ?? `${c.firstName} ${c.lastName}`);

/** Add Task with Due In 1 day and Skip Weekends on: the next weekday. */
const due = (now: number) => formatDay(nextWeekdayAt(now, 0));

/**
 * When each test contact's kickoff starts, as 05a writes it into Kickoff Date
 * from the booking. The scenarios below book exactly these times, so the
 * hand-off note shows the same time the booking did.
 */
const KICKOFF: Record<string, number> = {
  'rachel@brightlinehvac.example': at(3, 14, 0),
  'nadia@greenwaylawn.example': at(4, 9, 30),
  'tnovak@lakeshoreclean.example': at(8, 10, 0),
};

const provisionBody = `{
  "event": "deal.won",
  "ghl_contact_id": "{{contact.id}}",
  "workspace_id": "{{contact.workspace_id}}",
  "company": "{{contact.company_name}}",
  "plan": "{{contact.plan}}",
  "seats": {{contact.seats}},
  "admin": {
    "email": "{{contact.email}}",
    "first_name": "{{contact.first_name}}",
    "last_name": "{{contact.last_name}}"
  }
}`;

const slackBody = `{
  "text": "Won: {{contact.company_name}}, {{contact.seats}} seats on the {{contact.plan}} plan. Closed by {{user.name}}",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Won: {{contact.company_name}}" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Seats*\\n{{contact.seats}}" },
        { "type": "mrkdwn", "text": "*Plan*\\n{{contact.plan}}" },
        { "type": "mrkdwn", "text": "*Closed by*\\n{{user.name}}" },
        { "type": "mrkdwn", "text": "*Came from*\\n{{contact.source}}" },
        { "type": "mrkdwn", "text": "*Team size*\\n{{contact.company_size}}" },
        { "type": "mrkdwn", "text": "*Onboarding*\\nLeo Park, kickoff invite sent" }
      ]
    }
  ]
}`;

const helperSpec = `05a · Sales · Kickoff Booked                          folder: Sales

Triggers
  Customer Booked Appointment    In Calendar is Kickoff Call
  Appointment Status             In Calendar is Kickoff Call
                                 Appointment Status is New
                                 Modified By is User

Action
  Update Contact Field           Action Type: Update field data
                                 Kickoff Date = Appointment > Start Time

Why a helper: appointment merge fields only resolve in a workflow with an
appointment trigger, and If/Else only offers appointment conditions there.
05 · Closed-Won to Onboarding is triggered by the deal, so it cannot see the
booking. It waits for Kickoff Date to fill instead.`;

const canText: Condition = {
  type: 'all',
  label: 'SMS Consent is Yes, and the contact is not DND for SMS',
  of: [
    { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes' },
    { type: 'not', of: { type: 'dnd', channel: 'sms' } },
  ],
};

export const closedWon: Automation = {
  id: 'closed-won',
  number: '05',
  name: 'Closed-won to onboarding',
  kicker: 'Sales to customer success',
  tagline:
    'When an AE marks a deal Won, the app upgrades the workspace, #wins hears about it and the account moves to Leo with a kickoff invite. No booking in three days means a second email, a call task and, with consent, one text.',
  problem:
    'When a deal closed, the AE posted in Slack, forwarded the order form to Leo and asked an engineer to upgrade the workspace. The upgrade could wait a day, customers who had signed still got trial emails and a "your trial is ending" notice, and Leo sometimes heard about a new customer from their first support ticket.',
  solution:
    "Marking a New Business deal Won is the trigger, and the AE's only job is to fill in Plan and Seats first. The workflow moves the card to Onboarding, takes the customer out of the trial workflows, calls Crewlo's API to put the workspace on the plan and seat count that were sold, and posts the win in #wins. Then the account moves to Leo: an email with the details, a prep task, and a welcome email from him with the kickoff calendar. A booking gets a tag and a hand-off note. No booking in three days gets a second email and a call task on the next working day, and a text only if the contact agreed to texts.",
  workflow: {
    name: '05 · Sales · Closed-Won to Onboarding',
    folder: 'Sales',
    triggers: [
      {
        title: 'Opportunity Status Changed',
        filters: ['In Pipeline is New Business', 'Moved To Status is Won'],
        label: 'Opportunity Status Changed (Won)',
      },
    ],
    settings: {
      allowReEntry: false,
      stopOnResponse: false,
      allowMultipleOpportunities: true,
      timezone: 'contact',
      senderName: 'Leo Park, Crewlo',
      notes: [
        'Allow multiple Opportunities on: the unit of work here is the deal, and every won deal needs its own provisioning call, #wins post and hand-off. With it off, GHL enrolls the contact only for the first opportunity that meets the trigger, so a customer who left and signs a new deal next year could be skipped with no error anywhere. With it on, each contact and deal pair is its own run, and later edits to the deal do not restart it.',
        'The catch: two deals for one contact won on the same day would mean two welcome emails. The SOP keeps one open New Business deal per company, and the clear step before the welcome email stops an old Kickoff Date from releasing a new run.',
        'Allow Re-entry off: the same deal marked Won, reopened and marked Won again (to fix its value, say) does not provision, post or welcome a second time. A new deal for the same contact still runs, and the QA plan checks exactly that.',
        "Stop on Response off: a reply to Leo's welcome is usually a question or a time that suits them. Leo answers in Conversations and books the call himself; 05a counts a booking made by a user, so the wait releases as if they had booked. Ending the run on a reply would lose the tag, the note and the chase for someone who then goes quiet.",
        "No workflow Time Window: the upgrade and #wins cannot wait for business hours, and the welcome email answers a signature from minutes ago. The chase has its own Advance Window, weekdays 9 AM to 5 PM in the contact's time zone, which also keeps the one text inside 8 AM to 8 PM.",
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, so both emails come from the person running the kickoff and replies reach him.',
        'Custom Webhook is a premium action: two executions per won deal. Workflow error notifications are on and go to Hana, so a failed provisioning call lands in her inbox and in the Needs Review tab.',
      ],
    },
    steps: [
      {
        id: 'stage',
        kind: 'action',
        action: 'update_opportunity',
        title: 'Update Opportunity',
        label: 'Onboarding',
        summary:
          'The deal that fired the trigger moves to New Business › Onboarding; status stays Won. The trigger carries the deal, so there is no Find Opportunity step. Allow Opportunity to Move to Any Previous Stage is off, and Onboarding is the last stage anyway.',
        run: ({ contact }) => ({
          effect: { opportunity: { pipeline: 'New Business', stage: 'Onboarding', status: 'won' } },
          log: `Moved "${contact.opportunity?.name ?? companyOf(contact)}" from ${contact.opportunity?.stage || 'its stage'} to Onboarding. Status stays Won, so the AE sees the card move the moment the workflow picks it up.`,
        }),
      },
      {
        id: 'customer',
        kind: 'action',
        action: 'add_tag',
        title: 'Add Contact Tag',
        label: 'customer',
        summary: 'Marks a paying account. Smart lists, reports and anything aimed at customers filter on it.',
        effect: { addTags: ['customer'] },
      },
      {
        id: 'leave-trial',
        kind: 'action',
        action: 'remove_from_workflow',
        title: 'Remove from Workflow',
        label: 'Out of the trial emails',
        summary:
          'Another Workflow, with 02 · Product · Trial Onboarding and 04 · Product · Trial Ending selected. Someone who just signed gets no more trial nudges and no "your trial is ending" email. Contacts in neither are not affected.',
        run: ({ contact }) => ({
          log: `Takes ${contact.firstName} ${contact.lastName} out of 02 · Trial Onboarding and 04 · Trial Ending, wherever the contact is still active, so the trial emails stop today.`,
        }),
      },
      {
        id: 'provision',
        kind: 'action',
        action: 'webhook',
        title: 'Custom Webhook',
        label: 'Provision the workspace',
        summary:
          "Premium. Event CUSTOM, Method POST to {{custom_values.api_base}}/workspaces/provision, Bearer Token from a masked key, Content-Type application/json. Sends the plan, the seats and the admin's email. The endpoint sets rather than adds, so a retry never doubles seats.",
        run: ({ contact }) => {
          const ws = String(contact.fields.workspace_id ?? '');
          return {
            log: `POST ${customValues.api_base}/workspaces/provision: ${ws ? `workspace ${ws}` : 'no workspace yet'}, plan ${contact.fields.plan}, ${contact.fields.seats} seats, admin ${contact.email}. Crewlo's API answers 200, and the workspace comes off the trial with ${contact.fields.seats} paid seats.`,
          };
        },
        code: { language: 'json', source: provisionBody },
      },
      {
        id: 'slack',
        kind: 'action',
        action: 'webhook',
        title: 'Custom Webhook',
        label: 'Post to #wins',
        summary:
          'Premium. Event CUSTOM, Method POST, Content-Type application/json, to the Slack incoming webhook for #wins, the same pattern as #demo-requests and #pql. It runs before Leo takes the contact, so {{user.name}} is still the AE who closed it. No email or phone in a company-wide channel.',
        message: {
          channel: 'slack',
          to: '#wins',
          subject: 'Won: {{contact.company_name}}',
          body: 'Seats: {{contact.seats}} · Plan: {{contact.plan}}\nClosed by: {{user.name}}\nCame from: {{contact.source}}\nTeam size: {{contact.company_size}}\nOnboarding: Leo Park, kickoff invite sent',
        },
        code: { language: 'json', source: slackBody },
      },
      {
        id: 'notify',
        kind: 'action',
        action: 'internal_notification',
        title: 'Internal Notification',
        label: 'Tell Leo',
        summary:
          'Type Email, to Leo Park by name. Sent before the reassignment, so {{user.name}} names the AE who closed the deal and Leo knows whom to ask about it.',
        message: {
          channel: 'internal',
          to: 'Leo Park',
          subject: 'New customer: {{contact.company_name}}, {{contact.seats}} seats',
          body: '{{user.name}} closed {{contact.company_name}}: {{contact.seats}} seats on the {{contact.plan}} plan. Admin: {{contact.name}}, {{contact.email}}, {{contact.phone}}. Workspace {{contact.workspace_id}}; the provisioning request has gone to the app. The contact moves to you now, your welcome email with the kickoff link goes out with it, and a prep task is on your list.',
        },
      },
      {
        id: 'task-prep',
        kind: 'action',
        action: 'add_task',
        title: 'Add Task',
        label: 'Kickoff prep',
        summary:
          "Assign To Leo Park, Due In 1 day, Skip Weekends on. The description sends him to the AE's notes on the deal and asks him to check the workspace shows the plan and seats that were sold.",
        run: ({ contact, now }) => ({
          log: `Task for Leo Park, due ${due(now)}: "Kickoff prep: ${companyOf(contact)}". Read ${owner(contact)}'s notes on the deal, check workspace ${contact.fields.workspace_id} shows ${contact.fields.seats} seats on the ${contact.fields.plan} plan, and fit the agenda to a team of ${contact.fields.company_size ?? 'unknown size'}.`,
        }),
      },
      {
        id: 'assign-leo',
        kind: 'action',
        action: 'assign_user',
        title: 'Assign To User',
        label: 'Leo Park',
        summary:
          'One user, Only Apply to Unassigned Contacts off, so the contact moves from the AE to the CSM and replies land with Leo. With Allow different owners for contacts and its opportunities on, the deal keeps the AE as its owner for win reports, and the follower sub-setting makes Leo a follower of the deal.',
        run: ({ contact }) => ({
          effect: { assignTo: 'leo' },
          log: `Contact owner: ${owner(contact)} → Leo Park. The deal stays with ${owner(contact)}, and Leo follows it.`,
        }),
      },
      {
        id: 'clear-kickoff',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Clear Kickoff Date',
        summary:
          'Action Type Clear field data, on Kickoff Date. A date left by an earlier deal would release the wait below at once, so only a booking made after this invite counts.',
        run: ({ contact }) =>
          contact.fields.kickoff_date
            ? { effect: { fields: { kickoff_date: '' } }, log: `Cleared "${contact.fields.kickoff_date}", a kickoff from an earlier deal, so only a new booking releases the wait.` }
            : { log: 'Kickoff Date is already empty, so there is nothing to clear.' },
      },
      {
        id: 'email-welcome',
        kind: 'action',
        action: 'send_email',
        title: 'Send Email',
        label: 'Welcome and book the kickoff',
        summary: 'From Leo, minutes after the signature: who looks after them now, what the kickoff covers, and one link to his Kickoff Call calendar.',
        message: {
          channel: 'email',
          subject: 'Welcome to Crewlo, {{contact.first_name}}. Next: your kickoff call',
          body: "Hi {{contact.first_name}},\n\nThanks for choosing Crewlo. I'm {{user.first_name}}, and I look after {{contact.company_name}} from here on. Your workspace is moving to the {{contact.plan}} plan with {{contact.seats}} seats now, and you don't need to do anything for that.\n\nThe next step is a 45-minute kickoff call. We set up the dispatch board around how your crews actually work, get every tech invited, and connect QuickBooks or Google Calendar if you use them. Bring whoever runs dispatch day to day.\n\nPick a time that suits you both: {{custom_values.kickoff_link}}\n\nQuestions before then? Reply to this email. It comes straight to me.\n\n{{user.name}}\nCustomer Success, {{location.name}} | {{location.phone}}",
        },
      },
      {
        id: 'wait-kickoff',
        kind: 'wait',
        title: 'Wait',
        label: 'Kickoff booked?',
        // In GHL this waits for the Kickoff Date field that 05a fills when a Kickoff
        // Call booking comes in. The simulator runs one workflow at a time, so it
        // watches the booking itself.
        mode: 'event',
        event: 'appointment_booked',
        minutes: 3 * DAY,
        summary:
          'Specific conditions to be met: Kickoff Date is not empty. 05a · Sales · Kickoff Booked fills it from the booking, whether the customer books or Leo books for them. Timeout 3 days.',
        branches: {
          met: {
            label: 'Kickoff booked',
            nodes: [
              {
                id: 'tag-booked',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'kickoff-booked',
                summary: "Leo's onboarding smart list reads it: customer plus kickoff-booked is on track, customer alone is someone to chase.",
                effect: { addTags: ['kickoff-booked'] },
              },
              {
                id: 'note',
                kind: 'action',
                action: 'add_note',
                title: 'Add Note',
                label: 'Hand-off record',
                summary:
                  'On the contact, so anyone who opens it sees where onboarding stands without reading logs: plan, seats, workspace, and the kickoff time from Kickoff Date.',
                run: ({ contact }) => {
                  const when = KICKOFF[contact.email];
                  return {
                    log: `Note on ${contact.firstName} ${contact.lastName}: "Customer: ${contact.fields.seats} seats on the ${contact.fields.plan} plan, workspace ${contact.fields.workspace_id}, provisioning request sent at the win. Kickoff with Leo Park: ${when === undefined ? 'see Kickoff Date' : formatClock(when)}."`,
                  };
                },
              },
            ],
          },
          timeout: {
            label: 'No kickoff in 3 days',
            nodes: [
              {
                id: 'office-hours',
                kind: 'wait',
                title: 'Wait',
                label: 'Weekday business hours',
                mode: 'time',
                minutes: 0,
                window: { start: '09:00', end: '17:00', days: WEEKDAYS },
                summary:
                  "No delay, but the Advance Window only resumes Monday to Friday, 9 AM to 5 PM in the contact's time zone, so the chase lands on a day Leo can pick up the phone.",
              },
              {
                id: 'email-chase',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Finding a time',
                summary: 'Plain text from Leo: why the kickoff matters to them, the calendar link again, and a way to book without the calendar.',
                message: {
                  channel: 'email',
                  subject: 'Finding a time for your Crewlo kickoff',
                  body: "Hi {{contact.first_name}},\n\nI haven't seen a kickoff booked for {{contact.company_name}} yet, so I wanted to check in before the week gets away from us.\n\nThe kickoff is where we move your schedule onto the dispatch board and get your techs on the app, so the sooner it happens, the sooner your team stops running two schedules. It takes 45 minutes.\n\nMy calendar: {{custom_values.kickoff_link}}\n\nIf none of those times work, reply with two that do and I'll send the invite myself.\n\n{{user.name}}\nCustomer Success, {{location.name}}",
                },
              },
              {
                id: 'task-call',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Leo calls',
                summary:
                  'Assign To Leo Park, Due In 1 day, Skip Weekends on. The description says to check Conversations first and shows SMS Consent, so nobody texts from a personal phone without it.',
                run: ({ contact, now }) => {
                  const text =
                    contact.fields.sms_consent === 'Yes' && !contact.dnd.sms
                      ? 'SMS Consent is Yes, so the text below goes out too.'
                      : contact.dnd.sms
                        ? 'SMS DND is on, so no texts: call or email only.'
                        : 'SMS Consent is No, so no texts: call or email only.';
                  return {
                    log: `Task for Leo Park, due ${due(now)}: "Book the kickoff: ${companyOf(contact)}". Check Conversations first, then call ${contact.firstName} at ${contact.phone}. ${text}`,
                  };
                },
              },
              {
                id: 'if-sms',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Can we text?',
                branches: [
                  {
                    label: 'SMS consent',
                    when: canText,
                    nodes: [
                      {
                        id: 'sms-kickoff',
                        kind: 'action',
                        action: 'send_sms',
                        title: 'Send SMS',
                        label: 'Kickoff nudge',
                        summary:
                          'The only text in this workflow: one link, no offer, business name first and the opt-out line. It sends inside the 9 to 5 window above, well within quiet hours.',
                        message: {
                          channel: 'sms',
                          body: "Hi {{contact.first_name}}, it's {{user.first_name}} from Crewlo. Your team's account is ready. Pick a time for your kickoff call here: {{custom_values.kickoff_link}} Reply STOP to opt out.",
                        },
                      },
                      {
                        id: 'wait-late',
                        kind: 'wait',
                        title: 'Wait',
                        label: 'Booked after the chase?',
                        // Same stand-in as wait-kickoff: GHL waits for Kickoff Date to fill.
                        mode: 'event',
                        event: 'appointment_booked',
                        minutes: 7 * DAY,
                        summary: 'The same Kickoff Date condition, with a 7-day timeout. A booking that the chase brings in still gets the tag and the note.',
                        branches: {
                          met: {
                            label: 'Booked late',
                            nodes: [
                              {
                                id: 'goto-booked',
                                kind: 'goto',
                                title: 'Go To',
                                target: 'tag-booked',
                                summary: 'The same tag and hand-off note as a booking in the first three days.',
                              },
                            ],
                          },
                          timeout: { label: 'Still no kickoff', nodes: [] },
                        },
                      },
                    ],
                  },
                ],
                otherwise: {
                  label: 'No SMS consent',
                  nodes: [
                    {
                      id: 'goto-late',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'wait-late',
                      summary: 'The same late-booking wait as the text path, without the text.',
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
  scenarios: [
    {
      id: 'books',
      label: 'Books the kickoff on day 1',
      summary:
        "Rachel's team signs the annual plan with Ben on Tuesday morning. The workspace is upgraded, #wins hears about it, and she books a kickoff with Leo from his welcome email the next morning.",
      start: at(1, 11, 20),
      contact: {
        source: 'Website demo form',
        tags: ['trial', 'activated', 'pql-alerted'],
        assignedTo: 'ben',
        opportunity: { pipeline: 'New Business', stage: 'Closed Won', status: 'won', value: 6264, name: 'Brightline HVAC' },
        fields: {
          company: 'Brightline HVAC',
          company_name: 'Brightline HVAC',
          company_size: '11-50',
          job_role: 'Operations or dispatch',
          segment: 'mid-market',
          sms_consent: 'Yes',
          plan: 'annual',
          seats: 18,
          workspace_id: 'ws_7Q2M9K',
        },
      },
      events: [
        {
          at: at(2, 8, 50) - at(1, 11, 20),
          type: 'appointment_booked',
          value: 'Kickoff Call',
          appointmentAt: KICKOFF['rachel@brightlinehvac.example'] - at(1, 11, 20),
          label: "Picks Thursday 2 PM on Leo's Kickoff Call calendar. 05a copies the start time into Kickoff Date.",
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['stage', 'customer', 'leave-trial', 'provision', 'slack', 'notify', 'task-prep', 'assign-leo', 'clear-kickoff', 'email-welcome', 'wait-kickoff:met', 'tag-booked', 'note'],
        tags: ['customer', 'kickoff-booked'],
        stage: 'Onboarding',
      },
    },
    {
      id: 'replies',
      label: 'Replies, Leo books it',
      summary:
        "Nadia's self-serve trial became a deal with Ben, and she signs on Wednesday afternoon. She answers Leo's welcome with a time that suits her. The run keeps going, Leo books it from the conversation, and the wait releases.",
      start: at(2, 14, 5),
      contact: {
        firstName: 'Nadia',
        lastName: 'Farouk',
        email: 'nadia@greenwaylawn.example',
        phone: '(919) 555-0137',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated', 'pql-alerted'],
        assignedTo: 'ben',
        opportunity: { pipeline: 'New Business', stage: 'Trial Sales-Assist', status: 'won', value: 4872, name: 'Greenway Lawn & Landscape · 14 seats' },
        fields: {
          company: 'Greenway Lawn & Landscape',
          company_name: 'Greenway Lawn & Landscape',
          company_size: '11-50',
          sms_consent: 'Yes',
          plan: 'monthly',
          seats: 14,
          workspace_id: 'ws_3RV6KE',
        },
      },
      events: [
        {
          at: 50,
          type: 'reply',
          value: "Thanks Leo. Could we do Friday morning? I'd like our office manager on the call and she's out until then.",
          label: "Replies to Leo's welcome email. Stop on Response is off, so the run keeps waiting.",
        },
        {
          at: 95,
          type: 'appointment_booked',
          value: 'Kickoff Call',
          appointmentAt: KICKOFF['nadia@greenwaylawn.example'] - at(2, 14, 5),
          label: "Leo books Friday 9:30 AM from the conversation. 05a's Appointment Status trigger (New, Modified By User) fills Kickoff Date.",
        },
      ],
      expect: { outcome: 'completed', visits: ['email-welcome', 'wait-kickoff:met', 'tag-booked', 'note'], tags: ['customer', 'kickoff-booked'], stage: 'Onboarding' },
    },
    {
      id: 'never',
      label: 'Never books',
      summary:
        "Carlos signs a 44-seat annual deal with Aisha on Thursday afternoon, then goes quiet. The three days run out on Sunday, so the chase waits for Monday at 9 AM: a second email, a call task for Leo and one text. A week later the run ends and Leo's task is still open.",
      start: at(3, 16, 45),
      contact: {
        firstName: 'Carlos',
        lastName: 'Mendez',
        email: 'carlos@harlowmech.example',
        phone: '(704) 555-0183',
        timezone: 'America/New_York',
        source: 'Website demo form',
        tags: ['trial', 'activated', 'pql-alerted'],
        assignedTo: 'aisha',
        opportunity: { pipeline: 'New Business', stage: 'Proposal', status: 'won', value: 15312, name: 'Harlow Mechanical Group' },
        fields: {
          company: 'Harlow Mechanical Group',
          company_name: 'Harlow Mechanical Group',
          company_size: '201-1,000',
          job_role: 'Operations or dispatch',
          segment: 'enterprise',
          sms_consent: 'Yes',
          plan: 'annual',
          seats: 44,
          workspace_id: 'ws_4TN6RC',
        },
      },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['wait-kickoff:timeout', 'office-hours', 'email-chase', 'task-call', 'if-sms:0', 'sms-kickoff', 'wait-late:timeout'],
        tags: ['customer'],
        stage: 'Onboarding',
      },
    },
    {
      id: 'no-consent',
      label: 'No SMS consent',
      summary:
        "Tom signs on Monday afternoon and never ticked the SMS box. Thursday's chase is email and a call task only, and he books the morning after Leo's second email, so the late wait gives him the same tag and note.",
      start: at(0, 15, 10),
      contact: {
        firstName: 'Tom',
        lastName: 'Novak',
        email: 'tnovak@lakeshoreclean.example',
        phone: '(773) 555-0151',
        timezone: 'America/Chicago',
        source: 'Website demo form',
        tags: ['trial'],
        assignedTo: 'ben',
        opportunity: { pipeline: 'New Business', stage: 'Proposal', status: 'won', value: 10440, name: 'Lakeshore Commercial Cleaning' },
        fields: {
          company: 'Lakeshore Commercial Cleaning',
          company_name: 'Lakeshore Commercial Cleaning',
          company_size: '51-200',
          job_role: 'Operations or dispatch',
          segment: 'mid-market',
          sms_consent: 'No',
          plan: 'monthly',
          seats: 30,
          workspace_id: 'ws_5CT8JQ',
        },
      },
      events: [
        {
          at: at(4, 8, 40) - at(0, 15, 10),
          type: 'appointment_booked',
          value: 'Kickoff Call',
          appointmentAt: KICKOFF['tnovak@lakeshoreclean.example'] - at(0, 15, 10),
          label: "Books next Tuesday 10 AM from the link in Leo's second email. 05a fills Kickoff Date.",
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['wait-kickoff:timeout', 'email-chase', 'task-call', 'if-sms:else', 'goto-late', 'wait-late:met', 'goto-booked', 'tag-booked', 'note'],
        tags: ['customer', 'kickoff-booked'],
        stage: 'Onboarding',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Plan', key: 'plan', type: 'Single line', note: 'The app sends "trial" at signup (02). The AE sets the plan sold, annual or monthly, before marking Won; the provisioning call sends it as it is.' },
      { name: 'Seats', key: 'seats', type: 'Number', note: 'During the trial 03 writes people invited plus the owner. The AE sets the number sold before marking Won.' },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: "From trial.started (02). Empty for a deal that never trialed; the app then creates the workspace for the admin's email." },
      { name: 'Kickoff Date', key: 'kickoff_date', type: 'Single line', note: 'Written by 05a from Appointment > Start Time, which arrives as text. Cleared here before the invite; both waits release on it.' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'From the demo form, whose box covers texts about bookings and reminders. The kickoff nudge is one of those, with no offer in it.' },
    ],
    tags: [
      { name: 'customer', note: 'A paying account. Added the moment the deal is won' },
      { name: 'kickoff-booked', note: 'A kickoff is on the calendar. Added here, on time or after the chase' },
    ],
    pipeline: { name: business.pipeline.name, stages: business.pipeline.stages },
    customValues: [
      { name: 'Kickoff Link', key: 'kickoff_link', value: customValues.kickoff_link },
      { name: 'API Base', key: 'api_base', value: customValues.api_base },
    ],
  },
  build: [
    {
      title: 'Agree what "won" means',
      body: 'I sat down with Hana, both AEs and Leo and wrote the hand-off down as three steps for the AE: the order form is signed, Plan and Seats are filled in on the contact, and the deal is marked Won in New Business. That is the last thing sales does by hand. The upgrade, the announcement, the hand-off to Leo and the chase all belong to the workflow, and Leo told me what he needs to know on day one, which became the notification.',
    },
    {
      title: 'A provisioning contract with engineering',
      body: "One endpoint, POST /workspaces/provision, with a Bearer token saved as a masked key in the Custom Webhook, so nobody can read it back out of GHL. The call sets the plan and seat count rather than adding to them, so a retry or a duplicate changes nothing. It answers 422 when Plan is still trial or Seats is empty, and the URL is built from the API Base custom value, so pointing the whole workflow at staging for tests is one edit.",
    },
    {
      title: 'Trigger and the deal-level settings',
      body: 'Opportunity Status Changed, In Pipeline New Business, Moved To Status Won. Allow multiple Opportunities is on because the deal, not the contact, is what gets provisioned: each won deal is its own run. Re-entry is off, so a deal that is reopened and won again to fix a typo does not welcome the customer twice.',
    },
    {
      title: 'Order the steps on purpose',
      body: "The card moves first, so the AE sees the workflow picked it up. The customer leaves 02 and 04 before anything else talks to them. The upgrade goes before the announcement, so #wins never celebrates an account that is still on a trial. The Slack post, Leo's email and his prep task all run before the reassignment, because {{user.name}} still names the AE who closed it at that point.",
    },
    {
      title: 'Hand the account to Leo',
      body: 'In Settings, Allow different owners for contacts and its opportunities is on, with the sub-setting that updates the opportunity follower when the contact owner changes. Assign To User then moves the contact to Leo, the deal stays with the AE for win reports, and Leo follows the deal. Sender Details are Leo, so the welcome email and every reply go through him.',
    },
    {
      title: 'Wait for a booking the workflow cannot see',
      body: 'Appointment merge fields only resolve in a workflow with an appointment trigger, and If/Else only offers appointment conditions there. So a one-action helper, 05a · Sales · Kickoff Booked, copies Appointment > Start Time into Kickoff Date on any Kickoff Call booking, including one Leo makes for the customer. This workflow clears that field before the invite and waits for Specific conditions to be met: Kickoff Date is not empty.',
    },
    {
      title: 'The chase, inside the rules',
      body: "Three days without a booking waits for weekday business hours, then sends a second plain email and gives Leo a call task whose description shows SMS Consent. An If/Else on SMS Consent and SMS DND decides whether one text goes out, with the business name and the opt-out line. Both paths then wait another week, so a booking the chase brings in still gets the tag and the note.",
    },
    {
      title: 'Test against staging',
      body: 'With API Base pointed at staging, I won one test deal per scenario below, plus one with the key deliberately wrong. Execution Logs showed each request body and response, the broken key showed up in Needs Review with an error email to Hana, and Enrollment History showed the removals from 02 and 04. Then API Base went back to production and the workflow was published.',
    },
  ],
  edgeCases: [
    {
      title: 'The provisioning call fails',
      body: "Depending on the error, GHL retries the Custom Webhook with exponential backoff or marks it failed and skips it. Either way the run moves on, so the #wins post and the hand-off still happen. The failure lands in the Needs Review tab and in Hana's inbox through the workflow error notifications. She fixes the cause and re-sends the same request from a one-step manual workflow; because the endpoint sets rather than adds, a call that did land is not doubled.",
    },
    {
      title: 'Plan or Seats not filled in',
      body: 'Plan still says trial, or Seats is empty: the app answers 422 (an empty Seats even breaks the JSON on purpose, since it is sent as a number), and the workspace stays as it was instead of getting zero seats. The error reaches Hana the same way as any failed call, and she asks the AE for the numbers.',
    },
    {
      title: 'A customer comes back, or a deal is won twice',
      body: 'A company that left and signs again gets a new deal, which Allow multiple Opportunities runs as a new enrollment, and the old Kickoff Date is cleared before the invite. The same deal marked Won a second time does not run again, because re-entry is off.',
    },
    {
      title: 'They reply instead of booking',
      body: "Stop on Response is off, so the reply lands in Conversations with Leo and the run keeps waiting. Leo books the time from the conversation; 05a's Appointment Status trigger counts a booking made by a user, and the wait releases as if they had booked it themselves.",
    },
    {
      title: 'No SMS consent, or SMS DND',
      body: "The If/Else skips the text, and the call task's description shows SMS Consent, so nobody texts from a personal phone. Consent from the demo form covers texts about bookings and reminders; anything promotional would need the separate marketing consent.",
    },
    {
      title: 'Books after the chase',
      body: 'The late wait catches a booking for another week and goes to the same tag and note. After that the run ends, but 05a still fills Kickoff Date, and Leo closes his call task when he sees the booking on his calendar.',
    },
  ],
  qa: [
    'Mark a test deal Won in New Business: the card moves to Onboarding, the contact gets the customer tag, and Enrollment History shows it removed from 02 and 04',
    'With API Base on staging: the request body matches the contract, the response is 200, and the test workspace shows the plan and seat count',
    'Win a test deal with a wrong key, then with Plan still trial: the step fails, Needs Review lists it, Hana gets the error email, and the rest of the run carries on',
    'The #wins post shows company, seats, plan, the AE and the source, and no email or phone',
    'After the run starts, the contact owner is Leo, the deal owner is still the AE, and Leo follows the deal',
    'Book a Kickoff Call as the test contact, then have Leo book one for another: Kickoff Date fills, the wait releases, and the tag and note appear both times',
    'Leave a test contact unbooked with and without SMS consent: the chase arrives in weekday business hours, the text only goes to the one with consent, and it carries the opt-out line',
    'Win a second deal for the same test contact, then re-win the first one: two enrollments, not three',
  ],
  snippets: [
    {
      title: 'Provisioning request (Custom Webhook, Raw Body)',
      language: 'json',
      code: provisionBody,
      note: 'Event CUSTOM, Method POST, URL {{custom_values.api_base}}/workspaces/provision, Authorization Bearer Token from a masked key, Content-Type application/json. Seats goes in as a number, so an empty field fails loudly instead of provisioning zero seats.',
    },
    {
      title: '#wins Slack post (Custom Webhook body)',
      language: 'json',
      code: slackBody,
      note: 'Event CUSTOM, Method POST, Content-Type application/json, to the Slack incoming webhook for #wins. The text line is what shows in notifications; the blocks are what the channel sees.',
    },
    {
      title: '05a · Sales · Kickoff Booked (helper workflow)',
      language: 'text',
      code: helperSpec,
      note: 'The only way this workflow can know a kickoff is booked. It covers bookings the customer makes and bookings Leo makes for them.',
    },
  ],
  features: [
    'Opportunity Status Changed',
    'Allow multiple Opportunities',
    'Update Opportunity',
    'Add Contact Tag',
    'Remove from Workflow',
    'Custom Webhook',
    'Internal Notification',
    'Add Task',
    'Assign To User',
    'Update Contact Field · Clear field data',
    'Send Email',
    'Wait · Specific conditions to be met',
    'Wait · Advance Window',
    'If/Else',
    'Send SMS',
    'Go To',
    'Add Note',
    'Customer Booked Appointment (05a)',
    'Workflow error notifications · Needs Review',
  ],
};
