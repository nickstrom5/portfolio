import type { Automation, Condition, Contact } from '@/lib/ghl/types';
import { formatClock, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { business } from '../business';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2, 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const { users, customValues } = business.env;

/** Full name of the contact's owner at that point in the run: the AE until Assign To User hands the contact to Leo. */
const owner = (c: Contact) => (c.assignedTo && users[c.assignedTo]?.name) || 'the account executive';
const companyOf = (c: Contact) => String(c.fields.company_name ?? c.fields.company ?? `${c.firstName} ${c.lastName}`);

/** Add Task with Due In 1 day and Skip Weekends on: the next weekday. */
const due = (now: number) => formatDay(nextWeekdayAt(now, 0));

/** Assign To User, Leo Park. The deal keeps its AE because owners are decoupled in this sub-account. */
const toLeo = ({ contact }: { contact: Contact }) =>
  contact.assignedTo === 'leo'
    ? { log: 'Leo Park already owns the contact, so nothing changes.' }
    : { effect: { assignTo: 'leo' }, log: `Contact owner: ${owner(contact)} → Leo Park. The deal stays with ${owner(contact)}, and Leo follows it.` };

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
  "text": "Won: {{contact.company_name}}, {{contact.seats}} seats on {{contact.plan}}. Closed by {{user.name}}",
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
        { "type": "mrkdwn", "text": "*Customer success*\\nLeo Park" }
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
                                 Kickoff Date = {{appointment.start_time}}

Why a helper: appointment merge fields only resolve in a workflow with an
appointment trigger, and If/Else only offers appointment conditions there.
05 · Closed-Won to Onboarding is triggered by the deal, so it cannot see the
booking. It waits for Kickoff Date to fill instead. The second trigger
catches a kickoff that Leo or the AE books for the customer, and GHL treats
a reschedule as a new appointment, so Kickoff Date follows the new time.`;

const canText: Condition = {
  type: 'all',
  label: 'SMS consent (service) is Yes, and the contact is not DND for SMS',
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
    'When an AE marks a deal Won, the app upgrades the workspace, #wins hears about it and the account moves to Leo with a kickoff invite. No booking in three days means a second email, a call task and, with consent, one text. Expansion deals provision without a second welcome.',
  problem:
    'When a deal closed, the AE posted in Slack, forwarded the order form to Leo and asked an engineer to upgrade the workspace. The upgrade could wait a day, customers who had signed still got trial emails and a "your trial is ending" notice, and Leo sometimes heard about a new customer from their first support ticket.',
  solution:
    "Marking a New Business deal Won is the trigger, and the AE's only job is to fill in Plan and Seats first. The workflow moves the card to Onboarding, calls Crewlo's API to put the workspace on the plan and seat count that were sold, and posts the win in #wins. A new customer is then tagged, taken out of the trial workflows and off the trial tag, and handed to Leo: an email with the details, a prep task, a welcome from him with the Kickoff Call calendar, and the contact reassigned to him while the deal stays with the AE. A booking gets a tag and a hand-off note. No booking in three days gets a second email and a call task on the next working day, and a text only if the contact agreed to texts. A deal for an existing customer, usually more seats, ends after the upgrade with an email to Leo and the contact back in his name, so nobody is welcomed twice.",
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
      allowReEntry: true,
      stopOnResponse: false,
      allowMultipleOpportunities: true,
      timezone: 'contact',
      senderName: 'Leo Park, Crewlo',
      notes: [
        'Allow multiple Opportunities on: the unit of work here is the deal. A first deal, an expansion next spring and a company coming back after cancelling each need their own provisioning call and #wins post. With the toggle off, GHL enters the contact only for the first opportunity that meets the trigger, so a later deal would never provision, with no error anywhere. With it on, each contact and deal pair is its own run, and later edits to the deal do not restart it.',
        "Allow Re-entry on, for the same reason: every later deal comes from a contact who has been through this workflow before. While a deal's run is still active, marking it Won again does not start a second one. A deal reopened and marked Won again after its run has finished does run again, and that is safe: the provisioning call sets the plan and seats rather than adding to them, the customer tag sends the run down the expansion path, so no second welcome goes out, and the only visible repeat is a second #wins post.",
        "Stop on Response off: a reply to Leo's welcome is usually a question or a time that suits them. Leo answers in Conversations and books the call himself; 05a counts a booking made by a user, so the wait releases as if they had booked. Ending the run on a reply would lose the tag, the note and the chase for someone who then goes quiet.",
        "No workflow Time Window: the upgrade and #wins cannot wait for business hours, and the welcome email answers a signature from minutes ago. The chase has its own Advance Window, weekdays 9 AM to 5 PM in the contact's time zone, which also keeps the one text inside 8 AM to 8 PM. A contact with no time zone falls back to the account's.",
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, so both emails come from the person running the kickoff. From the reassignment on, Leo owns the contact, so replies land in his Conversations.',
        "Both emails are transactional under CAN-SPAM: they deliver the onboarding the customer just bought and carry no offer. Leo's signature still shows Crewlo's postal address.",
        'Custom Webhook is a premium action: two executions per won deal. Error Notifications are off by default; I turned them on with Hana as the recipient, so a failed provisioning call puts this workflow in the Needs Review tab and emails her.',
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
          'The deal that fired the trigger moves to New Business › Onboarding; status stays Won. An opportunity trigger puts the deal in context, so there is no Find Opportunity step. Allow Opportunity to Move to Any Previous Stage is off, and Onboarding is the last stage anyway.',
        run: ({ contact }) => ({
          effect: { opportunity: { pipeline: 'New Business', stage: 'Onboarding', status: 'won' } },
          log: `Moved "${contact.opportunity?.name ?? companyOf(contact)}" from ${contact.opportunity?.stage || 'its stage'} to Onboarding. Status stays Won, so the AE sees the card move the moment the workflow picks it up.`,
        }),
      },
      {
        id: 'provision',
        kind: 'action',
        action: 'webhook',
        title: 'Custom Webhook',
        label: 'Provision the workspace',
        summary:
          'Premium. Event CUSTOM, Method POST to {{custom_values.api_base}}/workspaces/provision, Authorization Bearer Token with the masked key "Crewlo API (workflows)", Content-Type application/json. Sends the plan, the seats and the admin\'s email. The endpoint sets rather than adds, so a retry, a repeat or an expansion never doubles seats.',
        run: ({ contact }) => {
          const ws = String(contact.fields.workspace_id ?? '');
          return {
            log: `POST ${customValues.api_base}/workspaces/provision: ${ws ? `workspace ${ws}` : 'no workspace yet'}, plan ${contact.fields.plan}, ${contact.fields.seats} seats, admin ${contact.email}. Crewlo's API answers 200 and sets the workspace to ${contact.fields.seats} paid seats on ${contact.fields.plan}.`,
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
          'Premium. Event CUSTOM, Method POST, Content-Type application/json, to the Slack incoming webhook for #wins, the same pattern as #demo-requests and #pql. It runs after the upgrade, so #wins never celebrates a workspace still on a trial, and before the reassignment, so {{user.name}} is the AE who closed it. No email or phone in a company-wide channel.',
        message: {
          channel: 'slack',
          to: '#wins',
          subject: 'Won: {{contact.company_name}}',
          body: 'Seats: {{contact.seats}} · Plan: {{contact.plan}}\nClosed by: {{user.name}}\nCame from: {{contact.source}}\nTeam size: {{contact.company_size}}\nCustomer success: Leo Park',
        },
        code: { language: 'json', source: slackBody },
      },
      {
        id: 'if-first',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'New customer or expansion?',
        branches: [
          {
            label: 'Already a customer',
            when: { type: 'tag', has: 'customer' },
            nodes: [
              {
                id: 'notify-expansion',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell Leo: expansion',
                summary:
                  'Type of Notification Email, To User Type Particular Users, Leo Park. The customer already had their kickoff, so there is no welcome email and no chase. Leo decides whether the new seats need a training call.',
                message: {
                  channel: 'internal',
                  to: 'Leo Park',
                  subject: 'Expansion won: {{contact.company_name}}, now {{contact.seats}} seats',
                  body: '{{user.name}} closed more business with {{contact.company_name}}: {{contact.seats}} seats on {{contact.plan}} from today. The provisioning request has gone to the app, and the contact is back with you; the deal stays with {{user.first_name}}. They are already a customer, so no welcome email or kickoff invite went out. If the new seats are a new team or location that needs training, book it with {{contact.first_name}} yourself. If they are coming back after cancelling, run the kickoff as for a new customer.',
                },
              },
              {
                id: 'handback',
                kind: 'action',
                action: 'assign_user',
                title: 'Assign To User',
                label: 'Back to Leo',
                summary:
                  "Leo Park, Only Apply to Unassigned Contacts off. 01 routes an expansion request to an AE, and its SOP has the rep hand the contact back after the demo; this does it for them. The expansion deal stays with the AE. The branch ends here.",
                run: toLeo,
              },
            ],
          },
        ],
        otherwise: {
          label: 'New customer',
          nodes: [
            {
              id: 'customer',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'customer',
              summary:
                "Marks a paying account, the same tag 04a adds when a trial pays in the app. It goes on one step before the removal from 02 and 04 on purpose: 04's Goal Event listens for it, so a trial still in 04 lands on the goal and Leo gets 04's in-app note to close any open last-day task.",
              effect: { addTags: ['customer'] },
            },
            {
              id: 'leave-trial',
              kind: 'action',
              action: 'remove_from_workflow',
              title: 'Remove from Workflow',
              label: 'Out of 02 and 04',
              summary:
                'Another Workflow, with 02 · Product · Trial Onboarding and 04 · Product · Trial Ending picked in the dropdown, so whatever is left of either ends now. Contacts in neither workflow are not affected.',
              run: ({ contact }) => ({
                log: `Takes ${contact.firstName} ${contact.lastName} out of 02 · Trial Onboarding and 04 · Trial Ending if the contact is active in either, so no trial email goes out after the signature.`,
              }),
            },
            {
              id: 'untag-trial',
              kind: 'action',
              action: 'remove_tag',
              title: 'Remove Contact Tag',
              label: 'trial',
              summary:
                "04's Custom Date Reminder fires 3 days before Trial Ends for anyone with Has Tag: trial. Removing the contact from 04 does nothing for a trial that is not there yet, so the tag comes off too, and a customer who signed on day 5 never gets a 'your trial ends in 3 days' email.",
              run: ({ contact }) =>
                contact.tags.includes('trial')
                  ? { effect: { removeTags: ['trial'] }, log: "Removed trial, so 04's reminder can no longer fire for this contact." }
                  : { log: 'No trial tag on the record, so there is nothing to remove.' },
            },
            {
              id: 'notify',
              kind: 'action',
              action: 'internal_notification',
              title: 'Internal Notification',
              label: 'Tell Leo',
              summary:
                'Type of Notification Email, To User Type Particular Users, Leo Park. Sent before the reassignment, so {{user.name}} names the AE who closed the deal and Leo knows whom to ask about it.',
              message: {
                channel: 'internal',
                to: 'Leo Park',
                subject: 'New customer: {{contact.company_name}}, {{contact.seats}} seats',
                body: '{{user.name}} closed {{contact.company_name}}: {{contact.seats}} seats on {{contact.plan}}. Admin: {{contact.name}}, {{contact.email}}, {{contact.phone}}. Workspace {{contact.workspace_id}}; the provisioning request has gone to the app. Your welcome email with the kickoff link goes out now, the contact moves to you straight after it, and the deal stays with {{user.first_name}}, with you as a follower. A prep task is on your list.',
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
                log: `Task for Leo Park, due ${due(now)}: "Kickoff prep: ${companyOf(contact)}". Read ${owner(contact)}'s notes on the deal, check workspace ${contact.fields.workspace_id} shows ${contact.fields.seats} seats on ${contact.fields.plan}, and fit the agenda to a team of ${contact.fields.company_size ?? 'unknown size'}.`,
              }),
            },
            {
              id: 'email-welcome',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Welcome and book the kickoff',
              summary:
                'From Leo, minutes after the signature: who looks after them now, what the kickoff covers, and one link to his Kickoff Call calendar. It goes before the reassignment, so its last line names the AE for anything about the agreement.',
              message: {
                channel: 'email',
                subject: 'Welcome to Crewlo, {{contact.first_name}}. Next: your kickoff call',
                body: "Hi {{contact.first_name}},\n\nThanks for choosing Crewlo. I'm Leo Park, the customer success manager for {{contact.company_name}}, and I'll get your team set up from here. Your workspace moves to your paid plan with {{contact.seats}} seats today, and you don't need to do anything for that.\n\nThe next step is a 45-minute kickoff call. We set up the dispatch board around how your crews actually work, get every tech invited, and connect QuickBooks or Google Calendar if you use them. Bring whoever runs dispatch day to day.\n\nPick a time that suits you and your dispatcher: {{custom_values.kickoff_link}}\n\nQuestions before then? Reply to this email and it comes to me. {{user.first_name}} is still your contact for anything about your agreement.\n\nLeo Park\nCustomer Success, {{location.name}} | {{location.phone}}\n{{location.full_address}}",
              },
            },
            {
              id: 'assign-leo',
              kind: 'action',
              action: 'assign_user',
              title: 'Assign To User',
              label: 'Leo Park',
              summary:
                'One user, Only Apply to Unassigned Contacts off, so the contact moves from the AE to the CSM and replies land with Leo. Allow different owners for contacts and its opportunities is on in Settings, which 03 relies on as well, so the won deal keeps the AE as its owner for win reports, and the sub-setting that updates the opportunity follower when the contact owner changes makes Leo a follower of the deal.',
              run: toLeo,
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
              value: 'Kickoff Call',
              minutes: 3 * DAY,
              summary:
                'Specific conditions to be met: Kickoff Date is not empty. 05a · Sales · Kickoff Booked fills it from any Kickoff Call booking, whether the customer books, Leo books for them, or the AE booked it on the signing call before marking Won, in which case the wait releases at once. Timeout 3 days.',
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
                      title: 'Add to Notes',
                      label: 'Hand-off record',
                      summary:
                        'Note title Onboarding hand-off, on the contact, so anyone who opens it sees where onboarding stands without reading logs: plan, seats, workspace, and the kickoff time from Kickoff Date.',
                      run: ({ contact }) => {
                        const when = KICKOFF[contact.email];
                        return {
                          log: `Note on ${contact.firstName} ${contact.lastName}, "Onboarding hand-off": "Customer: ${contact.fields.seats} seats on ${contact.fields.plan}, workspace ${contact.fields.workspace_id}, provisioning request sent at the win. Kickoff with Leo Park: ${when === undefined ? 'see Kickoff Date' : formatClock(when)}."`,
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
                        "No delay, but the Advance Window only resumes Monday to Friday (Resume On), 9 AM to 5 PM (Resume Between Hours) in the contact's time zone, so the chase lands on a day Leo can pick up the phone.",
                    },
                    {
                      id: 'email-chase',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Finding a time',
                      summary:
                        'Plain text from Leo: why the kickoff matters to them, the calendar link again, a way to book without the calendar, and a line for anyone who booked under another email.',
                      message: {
                        channel: 'email',
                        subject: 'Finding a time for your Crewlo kickoff',
                        body: "Hi {{contact.first_name}},\n\nI don't see a kickoff call on my calendar for {{contact.company_name}} yet, so I wanted to check in. If you have booked one and I missed it, thank you, and you can ignore this.\n\nThe kickoff is where we move your schedule onto the dispatch board and get your techs on the app, so the sooner it happens, the sooner your team stops running two schedules. It takes 45 minutes.\n\nMy calendar: {{custom_values.kickoff_link}}\n\nIf none of those times work, reply with two that do and I'll send the invite myself.\n\nLeo Park\nCustomer Success, {{location.name}}\n{{location.full_address}}",
                      },
                    },
                    {
                      id: 'task-call',
                      kind: 'action',
                      action: 'add_task',
                      title: 'Add Task',
                      label: 'Leo calls',
                      summary:
                        'Assign To Leo Park, Due In 1 day, Skip Weekends on. The description says to check Conversations and his calendar first, and shows SMS consent, so nobody texts from a personal phone without it.',
                      run: ({ contact, now }) => {
                        const text =
                          contact.fields.sms_consent === 'Yes' && !contact.dnd.sms
                            ? 'SMS consent is Yes, so the text below goes out too.'
                            : contact.dnd.sms
                              ? 'SMS DND is on, so no texts: call or email only.'
                              : 'No SMS consent, so no texts: call or email only.';
                        return {
                          log: `Task for Leo Park, due ${due(now)}: "Book the kickoff: ${companyOf(contact)}". Check Conversations and the Kickoff Call calendar first, then call ${contact.firstName} at ${contact.phone}. ${text}`,
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
                                'The only text in this workflow, a service text about what they bought: Leo and Crewlo named up front, one link, no offer, and the opt-out line. It sends inside the weekday 9 to 5 window above, well within 8 AM to 8 PM.',
                              message: {
                                channel: 'sms',
                                body: "Hi {{contact.first_name}}, it's Leo from Crewlo. Your team's account is ready. Pick a time for your kickoff call here: {{custom_values.kickoff_link}} Reply STOP to opt out.",
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
                              value: 'Kickoff Call',
                              minutes: 7 * DAY,
                              summary: 'The same Kickoff Date condition, with a 7-day timeout. A booking the chase brings in still gets the tag and the note. No more messages after this.',
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
      },
    ],
  },
  scenarios: [
    {
      id: 'books',
      label: 'Books the kickoff the next morning',
      summary:
        "Rachel's team signs the annual plan with Ben on Tuesday morning. Her trial ends next Tuesday, so with the trial tag left on, 04 would have told her on Saturday that it was ending. The tag comes off, the workspace is upgraded, #wins hears about it, and she books a kickoff with Leo from his welcome email the next morning.",
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
          plan: 'standard-annual',
          seats: 18,
          workspace_id: 'ws_7Q2M9K',
          trial_end: '03-10-2026',
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
        visits: ['stage', 'provision', 'slack', 'if-first:else', 'customer', 'leave-trial', 'untag-trial', 'notify', 'task-prep', 'email-welcome', 'assign-leo', 'wait-kickoff:met', 'tag-booked', 'note'],
        tags: ['customer', 'kickoff-booked'],
        stage: 'Onboarding',
      },
    },
    {
      id: 'replies',
      label: 'Replies, Leo books it',
      summary:
        "Nadia's self-serve trial became a deal with Ben, and she signs on Wednesday afternoon. She answers Leo's welcome email with a time that suits her. The run keeps going, Leo books it from the conversation, and the wait releases.",
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
          plan: 'standard-monthly',
          seats: 14,
          workspace_id: 'ws_3RV6KE',
        },
      },
      events: [
        {
          at: 50,
          type: 'reply',
          channel: 'email',
          value: "Thanks Leo. Could we do Friday morning? I'd like our office manager on the call and she's out until then.",
          label: "Replies to Leo's welcome email. Stop on Response is off, so the run keeps waiting, and the reply lands in Leo's Conversations because he owns the contact now.",
        },
        {
          at: 95,
          type: 'appointment_booked',
          value: 'Kickoff Call',
          appointmentAt: KICKOFF['nadia@greenwaylawn.example'] - at(2, 14, 5),
          label: "Leo books Friday 9:30 AM from the conversation. 05a's Appointment Status trigger (New, Modified By User) fills Kickoff Date.",
        },
      ],
      expect: { outcome: 'completed', visits: ['if-first:else', 'email-welcome', 'assign-leo', 'wait-kickoff:met', 'tag-booked', 'note'], tags: ['customer', 'kickoff-booked'], stage: 'Onboarding' },
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
          plan: 'standard-annual',
          seats: 44,
          workspace_id: 'ws_4TN6RC',
        },
      },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['if-first:else', 'wait-kickoff:timeout', 'office-hours', 'email-chase', 'task-call', 'if-sms:0', 'sms-kickoff', 'wait-late:timeout'],
        tags: ['customer'],
        stage: 'Onboarding',
      },
    },
    {
      id: 'no-consent',
      label: 'No SMS consent',
      summary:
        "Tom signs on Monday afternoon and never ticked the SMS box on the demo form. Thursday's chase is email and a call task only, and he books the morning after Leo's second email, so the late wait gives him the same tag and note.",
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
          plan: 'standard-monthly',
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
    {
      id: 'expansion',
      label: 'Existing customer buys more seats',
      summary:
        "Amy's team has run on Crewlo for a year with 23 seats. Her request for seven more went through the demo form to Aisha, who marks the deal Won on Friday morning. The workspace is set to 30 seats and #wins hears about it. Amy gets no second welcome, the contact goes back to Leo, and Leo gets an email saying why.",
      start: at(4, 11, 5),
      contact: {
        firstName: 'Amy',
        lastName: 'Chen',
        email: 'amy@chenmechanical.example',
        phone: '(206) 555-0147',
        timezone: 'America/Los_Angeles',
        source: 'Website demo form',
        tags: ['customer', 'kickoff-booked', 'nps-promoter'],
        assignedTo: 'aisha',
        opportunity: { pipeline: 'New Business', stage: 'Proposal', status: 'won', value: 2436, name: 'Chen Mechanical · +7 seats' },
        fields: {
          company: 'Chen Mechanical',
          company_name: 'Chen Mechanical',
          company_size: '11-50',
          segment: 'mid-market',
          sms_consent: 'Yes',
          plan: 'standard-annual',
          seats: 30,
          workspace_id: 'ws_2VN6TE',
        },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['stage', 'provision', 'slack', 'if-first:0', 'notify-expansion', 'handback'], tags: ['customer'], stage: 'Onboarding' },
    },
  ],
  dataModel: {
    customFields: [
      {
        name: 'Plan',
        key: 'plan',
        type: 'Single line',
        note: 'The app sends "trial" at signup (02). Before marking Won, the AE sets the plan sold, standard-annual or standard-monthly, the names the app uses in subscription.created (04a); the provisioning call sends it as it is.',
      },
      {
        name: 'Seats',
        key: 'seats',
        type: 'Number',
        note: 'During the trial 03 rewrites it every morning, so the AE sets it right before marking Won: the total seats sold, not the number added, because the provisioning call sets the workspace to this number.',
      },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: "From trial.started (02). Empty for a deal that never trialed; the app then creates the workspace for the admin's email." },
      { name: 'Kickoff Date', key: 'kickoff_date', type: 'Single line', note: 'Written by 05a from {{appointment.start_time}}, so it holds text, not a date. Both waits release on it being filled.' },
      {
        name: 'SMS consent (service)',
        key: 'sms_consent',
        type: 'Checkbox',
        note: 'The demo form\'s service box, "Text me about my demo booking and reminders." The kickoff nudge is a booking message about what they bought, with no offer, so it uses this box and not SMS consent (offers).',
      },
    ],
    tags: [
      { name: 'customer', note: 'A paying account. Added here for deals sales closes, and by 04a for trials that pay in the app. The If/Else reads it to spot an expansion, and 04 treats it as its goal' },
      { name: 'trial', note: "Removed here, so 04's Custom Date Reminder cannot fire for a paying customer" },
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
      body: 'I sat down with Hana, both AEs and Leo and wrote the hand-off down as three steps for the AE: the order form is signed, Plan and Seats are filled in on the contact, and the deal is marked Won in New Business. That is the last thing sales does by hand. Won means the status, not the Closed Won stage: only the status fires this workflow. The upgrade, the announcement, the hand-off to Leo and the chase belong to the workflow, and Leo told me what he needs to know on day one, which became his notification.',
    },
    {
      title: 'A provisioning contract with engineering',
      body: 'One endpoint, POST /workspaces/provision, with a Bearer token saved as the masked key "Crewlo API (workflows)", the same key 04 uses, so nobody can read it back out of GHL and it never appears in a body or a message. The call sets the plan and seat count rather than adding to them, so a retry, a repeat or an expansion all land on the right number. It answers 422 when Plan is still trial or Seats is empty, and the URL is built from the API Base custom value, so pointing the whole workflow at staging for tests is one edit.',
    },
    {
      title: 'Trigger and the deal-level settings',
      body: 'Opportunity Status Changed, In Pipeline New Business, Moved To Status Won. Allow multiple Opportunities is on because the deal, not the contact, is what gets provisioned: a first deal, an expansion and a returning company are each their own run. Allow Re-entry is on too, since every later deal comes from a contact who has been here before. A deal reopened and won again re-runs harmlessly, because the endpoint sets rather than adds and the If/Else below sends it down the expansion path.',
    },
    {
      title: 'Order the steps on purpose',
      body: "The card moves first, so the AE sees the workflow picked it up. The upgrade goes before #wins, so the channel never celebrates a workspace still on a trial. Then one If/Else on the customer tag, before anything adds it. A new customer gets the tag one step before Remove from Workflow: a trial still in 04 lands on 04's Goal Event, so Leo is told to close any open last-day task, and the removal then ends whatever is left of 02 and 04. The trial tag comes off as well, or 04's reminder would still fire for a customer who signed early.",
    },
    {
      title: 'Hand the account to Leo, keep the deal with the AE',
      body: "Allow different owners for contacts and its opportunities is on in Settings, with the sub-setting that updates the opportunity follower when the contact owner changes. 03 depends on the same setting and moves cards with Add Owner to Opportunity. Assign To User then moves the contact to Leo, the won deal stays with the AE for win reports, and Leo follows the deal. The #wins post, Leo's notification, his prep task and the welcome email all run before the reassignment, because {{user.name}} still names the AE at that point. An expansion goes back to Leo the same way, which is the hand-back 01's SOP asks reps for.",
    },
    {
      title: 'Wait for a booking the workflow cannot see',
      body: 'Appointment merge fields only resolve in a workflow with an appointment trigger, and If/Else only offers appointment conditions there. So a one-action helper, 05a · Sales · Kickoff Booked, copies the start time into Kickoff Date on any Kickoff Call booking, including one Leo or the AE makes for the customer. This workflow waits for Specific conditions to be met: Kickoff Date is not empty. Only customers book Kickoff Calls, so a first deal starts with the field empty, and a kickoff the AE booked on the signing call releases the wait straight away instead of being chased.',
    },
    {
      title: 'The chase, inside the rules',
      body: "Three days without a booking waits for weekday business hours, then sends a second plain email and gives Leo a call task whose description shows SMS consent. An If/Else on SMS consent (service) and SMS DND decides whether one text goes out, with the business name and the opt-out line. Both paths then wait another week, so a booking the chase brings in still gets the tag and the note. After that Leo's open task is the only follow-up.",
    },
    {
      title: 'Test against staging',
      body: 'With API Base pointed at staging, I won one test deal per scenario below, plus one with the key deliberately wrong and one with Plan left on trial. Execution Logs showed each request body and response, the failures showed up in Needs Review with an error email to Hana, and Enrollment History showed the removals from 02 and 04. Then API Base went back to production and the workflow was published.',
    },
  ],
  edgeCases: [
    {
      title: 'The provisioning call fails',
      body: "Depending on the error, GHL retries the Custom Webhook with exponential backoff or marks it failed and skips it. Either way the run moves on, so #wins and the hand-off still happen. The failure lands in the Needs Review tab, and Error Notifications email Hana, at most once every 24 hours, so her runbook starts with Needs Review rather than her inbox. She fixes the cause and provisions the workspace the same day, which keeps the welcome email's 'today' true. Because the endpoint sets rather than adds, a call that did land is not doubled.",
    },
    {
      title: 'Plan or Seats not filled in',
      body: 'Plan still says trial, or Seats is empty: the app answers 422, or 400 for an empty Seats, which leaves the JSON without a number. The workspace stays as it was instead of getting zero seats, and the error reaches Hana like any failed call. She asks the AE for the numbers.',
    },
    {
      title: 'Dragged to Closed Won, never marked Won',
      body: "The pipeline has a Closed Won stage as well as the Won status, and only the status fires this workflow. A card dragged to the stage with the status left Open provisions nothing. Hana's Monday check is the New Business board filtered to stage Closed Won and status Open; marking those Won starts the run.",
    },
    {
      title: 'An existing customer buys more, or comes back',
      body: "Expansion requests reach New Business through 01, which also moves the contact to an AE for the demo. The customer tag sends the won deal down the expansion path: the workspace is set to the new total, #wins hears about it, the contact goes back to Leo, and Leo gets an email instead of the customer getting a second welcome. A company coming back after cancelling still has the tag, so it takes the same path, and Leo's email tells him to run the kickoff by hand.",
    },
    {
      title: 'Two deals at once, or the same deal won twice',
      body: "With Allow multiple Opportunities on, two deals won for one contact on the same day are two runs, and the first adds customer, so the second takes the expansion path. The SOP still keeps one open New Business deal per company. A deal reopened and marked Won again after its run has ended re-runs: one more provisioning call that sets the same numbers, a second #wins post and an expansion email to Leo. While the first run is still active, GHL does not add it again.",
    },
    {
      title: 'No SMS consent, SMS DND, or no demo form',
      body: "The If/Else skips the text, and the call task's description shows SMS consent, so nobody texts from a personal phone. Contacts who signed up in the app never saw the consent box, so they get email and a call only. The consent covers booking and reminder texts; anything promotional would need SMS consent (offers).",
    },
  ],
  qa: [
    "Mark a test deal Won for a contact still in 04: the card moves to Onboarding, customer goes on and trial comes off, 04's goal sends Leo its in-app note, and Enrollment History shows the removal from 02 and 04",
    'With API Base on staging: the request body matches the contract, the response is 200, and the test workspace shows the plan and seat count',
    'Win a test deal with a wrong key, then one with Plan still trial: the step fails, Needs Review lists it, Hana gets the error email, and the rest of the run carries on',
    'The #wins post shows company, seats, plan, the AE and the source, and no email or phone',
    "After the reassignment the contact owner is Leo, the deal owner is still the AE, and Leo follows the deal. The welcome email's last line names the AE, and a reply to it lands in Leo's Conversations",
    'Book a Kickoff Call as one test contact, have Leo book for a second, and have the AE book for a third before marking Won: Kickoff Date fills, the wait releases (at once for the third), and the tag and note appear',
    'Leave test contacts unbooked with consent, without it, and with SMS DND: the chase arrives in weekday business hours, and the text goes only to the first, carries the opt-out line and stays one segment for a first name of up to 18 characters',
    'Win an expansion deal for a test customer owned by an AE, once while their first run is still waiting and once after it has finished: both provision and post, the contact goes back to Leo, and no second welcome goes out',
  ],
  snippets: [
    {
      title: 'Provisioning request (Custom Webhook, Raw Body)',
      language: 'json',
      code: provisionBody,
      note: 'Event CUSTOM, Method POST, URL {{custom_values.api_base}}/workspaces/provision, Authorization Bearer Token with the masked key "Crewlo API (workflows)", Content-Type application/json. Seats goes in as a number, so an empty field fails loudly instead of provisioning zero seats.',
    },
    {
      title: '#wins Slack post (Custom Webhook, Raw Body)',
      language: 'json',
      code: slackBody,
      note: 'Event CUSTOM, Method POST, Content-Type application/json, to the Slack incoming webhook for #wins. The incoming-webhook URL is a secret in itself, so it lives only in this action. The text line is what shows in notifications; the blocks are what the channel sees.',
    },
    {
      title: '05a · Sales · Kickoff Booked (helper workflow)',
      language: 'text',
      code: helperSpec,
      note: 'The only way this workflow can know a kickoff is booked. It covers bookings the customer makes and bookings Leo or the AE makes for them.',
    },
  ],
  features: [
    'Opportunity Status Changed',
    'Allow multiple Opportunities',
    'Allow Re-entry',
    'Update Opportunity',
    'Custom Webhook (premium) · masked secret keys',
    'If/Else',
    'Add Contact Tag',
    'Remove from Workflow',
    'Remove Contact Tag',
    'Internal Notification',
    'Add Task',
    'Send Email',
    'Sender Details',
    'Assign To User',
    'Allow different owners for contacts and its opportunities',
    'Wait · Specific conditions to be met',
    'Wait · Advance Window',
    'Send SMS',
    'Go To',
    'Add to Notes',
    'Customer Booked Appointment and Appointment Status (05a)',
    'Error Notifications · Needs Review',
  ],
};
