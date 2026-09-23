import type { Automation, Contact } from '@/lib/ghl/types';
import { calendarDate, dateFieldValue, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { env } from '../business';

const DAY = 1440;
const MON_SAT = [0, 1, 2, 3, 4, 5];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** The way a GHL date field stores it: MM-DD-YYYY. */
const dateField = dateFieldValue;

/** The way {{right_now.middle_endian_date}} renders it: M/D/YYYY. */
const sheetDate = (min: number) => {
  const d = calendarDate(min);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
};

/** Full name of the contact's assigned estimator, for log lines. */
const estimator = (c: Contact) => (c.assignedTo && env.users[c.assignedTo]?.name) || 'the assigned estimator';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every email ends with the business name and postal address. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const slackPayload = `{
  "text": "New job: {{contact.name}}, {{contact.service_needed}}, \${{contact.estimate_amount}}",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "New job: {{contact.name}}" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Address*\\n{{contact.full_address}}" },
        { "type": "mrkdwn", "text": "*Homeowner*\\n{{contact.phone}}" },
        { "type": "mrkdwn", "text": "*Scope*\\n{{contact.service_needed}}, roof age {{contact.roof_age}}" },
        { "type": "mrkdwn", "text": "*Contract*\\n\${{contact.estimate_amount}}" },
        { "type": "mrkdwn", "text": "*Sold by*\\n{{user.name}}" },
        { "type": "mrkdwn", "text": "*Next*\\n{{custom_values.production_manager}} orders materials" }
      ]
    }
  ]
}`;

const sheetColumns = `Jobs 2026 › worksheet "Sold", columns A to I

A  Sold on        {{right_now.middle_endian_date}}   the day the deal was marked Won
B  Customer       {{contact.name}}
C  Phone          {{contact.phone}}
D  Address        {{contact.full_address}}
E  Scope          {{contact.service_needed}}
F  Amount         {{contact.estimate_amount}}   column formatted as currency, so it totals
G  Estimator      {{user.name}}
H  Install date   blank: Sam fills it in when he books the crew
I  Crew           blank: Sam`;

const crewSop = `When a job is finished and you have walked it with the homeowner:

  1. Open the contact in the LeadConnector app.
  2. Add the tag job-complete.

That is all. The card moves to Job Complete by itself, Job Date is set
to today, and the homeowner gets the review request from 06.

Do not drag the card to Job Complete yourself: the date is not set
and this workflow keeps waiting for a tag that never comes.

Homeowner texts back?        You follow every sold contact, so it shows
                             in your notifications. Answer in Conversations.
Job slipping past 45 days?   Add a note on the contact saying why.
Signed job canceled?         Mark the opportunity Lost and post in #production.`;

export const jobHandoff: Automation = {
  id: 'job-handoff',
  number: '05',
  name: 'Won to job hand-off',
  kicker: 'Production',
  tagline: 'The moment a deal is marked Won, the crew channel, the job sheet, the production manager and the homeowner all hear about it, and the card moves itself to Job Complete when the crew signs off.',
  problem:
    'A sold job reached production by text message, if it reached it at all. Sam heard about sales days late, materials went on order late, homeowners called to ask what happens next, and finished jobs sat in Job Scheduled, so nobody ever asked those customers for a review.',
  solution:
    "One workflow starts when a Roofing Sales deal is marked Won, whether an estimator does it in the app or 04 does it when the estimate is signed. It takes the contact out of 04's follow-up, checks that this card has not been handed off before, and moves it to Job Scheduled. It posts the job to the crew channel in Slack, adds a row to the Jobs 2026 sheet, gives Sam a task to order materials and book the install, and sends the homeowner a welcome email and a text from Sam. Then it waits for the crew to tag the job complete, stamps the date and moves the card to Job Complete, which starts 06 · Reviews & Referrals. A job with no sign-off after 45 days goes to Jordan instead of going quiet.",
  evidence: {
    text: 'GHL\'s own Update Opportunity guide uses this trigger as its example, because it "ensures the workflow starts with an opportunity already in context" and so "no extra lookup is required". With a trigger that is not opportunity-based you need Find Opportunity first; with no opportunity in the workflow, the action is skipped.',
    source: 'HighLevel Help Center, "Workflow Action - Update Opportunity"',
    href: 'https://help.gohighlevel.com/support/solutions/articles/155000004753-workflow-action-update-opportunity',
  },
  workflow: {
    name: '05 · Production · Won to Job Hand-Off',
    folder: 'Production',
    triggers: [{ title: 'Opportunity Status Changed', filters: ['In Pipeline is Roofing Sales', 'Moved To Status is Won'], label: 'Opportunity Status Changed (Won)' }],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      allowMultipleOpportunities: true,
      timeWindow: { start: '08:00', end: '20:00', days: MON_SAT },
      timezone: 'contact',
      senderName: 'Sam Rivera, Harbor & Pine Roofing',
      notes: [
        "Stop on Response off: a reply to Sam must not end the run before the card reaches Job Complete, or 06 never starts. Nothing after Sam's text goes to the homeowner, so no automated message ever follows a reply.",
        'Time Window Monday to Saturday, 8 AM to 8 PM, contact time zone. It holds the email and the text only; Slack, the sheet row and the task run the moment the deal is won.',
        "Allow Re-entry on, so a repeat customer's next job gets its own hand-off. GHL never re-enters a contact who is still in the workflow, and the If/Else at the top stops a card that was already handed off from running it twice.",
        'Allow multiple Opportunities on (the default for new workflows): each won card gets its own run, and Update Opportunity changes the card that triggered it.',
        'Sender Details: From Name Sam Rivera, From Email sam@harborpine.example, From Number the main line the homeowner already has saved.',
      ],
    },
    steps: [
      {
        id: 'remove-04',
        kind: 'action',
        action: 'remove_from_workflow',
        title: 'Remove from Workflow',
        label: 'Stop estimate follow-up',
        summary: 'Another Workflow: 04 · Estimate Follow-Up, before anything else runs. A deal marked Won by hand in the middle of that sequence gets no more "should I close your file?" texts.',
      },
      {
        id: 'first-time',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'First hand-off for this card?',
        branches: [
          {
            label: 'New sale',
            when: {
              type: 'not',
              label: 'Pipeline Stage is not Job Scheduled and is not Job Complete',
              of: { type: 'any', of: [{ type: 'opportunity', stage: 'Job Scheduled' }, { type: 'opportunity', stage: 'Job Complete' }] },
            },
            nodes: [
              {
                id: 'clear-tag',
                kind: 'action',
                action: 'remove_tag',
                title: 'Remove Contact Tag',
                label: 'Reset job-complete',
                summary: 'Removes a job-complete tag left over from an earlier job, so it cannot end the wait below on day one.',
                effect: { removeTags: ['job-complete'] },
              },
              {
                id: 'opp-scheduled',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Job Scheduled',
                summary: 'Roofing Sales › Job Scheduled, status stays Won. The trigger carries this deal, so there is no Find Opportunity step. Every move here is forward, so Allow Opportunity to Move to Any Previous Stage stays off.',
                effect: { opportunity: { stage: 'Job Scheduled', status: 'won' } },
              },
              {
                id: 'slack',
                kind: 'action',
                action: 'webhook',
                title: 'Custom Webhook',
                label: 'Post to #production',
                summary: 'Premium. Event CUSTOM, Method POST, Content-Type application/json, to a Slack incoming webhook for #production. Block Kit fields the crew can read on a phone.',
                message: {
                  channel: 'slack',
                  to: '#production',
                  subject: 'New job: {{contact.name}}',
                  body: 'Address: {{contact.full_address}}\nScope: {{contact.service_needed}}, roof age {{contact.roof_age}}\nContract: ${{contact.estimate_amount}}\nSold by: {{user.name}}\nHomeowner: {{contact.phone}}\nNext: {{custom_values.production_manager}} orders materials',
                },
                code: { language: 'json', source: slackPayload },
              },
              {
                id: 'sheet',
                kind: 'action',
                action: 'google_sheets',
                title: 'Google Sheets',
                label: 'Add to Jobs 2026',
                summary: 'Premium. Create Spreadsheet Row in Jobs 2026 › Sold, columns A to I. Install date and crew stay blank for Sam.',
                run: ({ contact, now }) => ({
                  log: `New row in Jobs 2026 › Sold: ${sheetDate(now)} | ${contact.firstName} ${contact.lastName} | ${contact.phone} | ${contact.address ?? ''} | ${contact.fields.service_needed} | ${contact.fields.estimate_amount} | ${estimator(contact)}. Install date and crew are left blank for Sam.`,
                }),
              },
              {
                id: 'task-materials',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Order materials, book the install',
                summary: 'Assign To Sam Rivera, Due In 1 day, Skip Weekends on. Order materials and call the homeowner to set the install date, which the welcome email promises within two business days. The description carries the scope, the amount, the estimator and the address.',
                run: ({ contact, now }) => ({
                  log: `Task for Sam Rivera, due ${formatDay(nextWeekdayAt(now, 0))}: order materials for ${contact.firstName} ${contact.lastName} (${String(contact.fields.service_needed).toLowerCase()}) and call to set the install date.`,
                }),
              },
              {
                id: 'follow-sam',
                kind: 'action',
                action: 'follower',
                title: 'Add Contact Follower',
                label: 'Sam follows the job',
                summary: "Sam Rivera becomes a follower; the estimator stays the assigned user. GHL's in-app alert for new messages on followed conversations is on by default, so a reply to Sam reaches Sam.",
                run: ({ contact }) => ({ log: `Sam Rivera added as a follower. ${estimator(contact)} is still the assigned user.` }),
              },
              {
                id: 'email-welcome',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Welcome and prep checklist',
                summary: 'From Sam: who looks after the job now, what happens next, how to get the house ready, and the warranty link. No offer and no referral ask; those wait for 06.',
                message: {
                  channel: 'email',
                  subject: 'Your new roof: what happens next',
                  body: "Hi {{contact.first_name}},\n\nThank you for choosing Harbor & Pine Roofing. I'm {{custom_values.production_manager}}, the production manager, and I look after your job from here until the crew packs up. {{user.first_name}} is still your contact for anything about the contract.\n\nWhat happens next\n1. I order your materials and call you within two business days to set an install date.\n2. Most roofs take one or two days. If the forecast turns, I call you before the crew is due, not after.\n3. When the crew finishes, we walk the property with you before we call it done.\n\nGetting ready\n- Move cars out of the driveway and the garage the night before.\n- Take down pictures and shelves on top-floor walls. Hammering shakes them.\n- Move patio furniture, grills and planters away from the house.\n- Keep pets inside while the crew works, and let your neighbors know it will be noisy.\n\nYour warranty and what it covers: {{custom_values.warranty_link}}\n\nQuestions? Reply to this email or call {{custom_values.office_phone}}.\n\n{{custom_values.production_manager}}\nProduction Manager" + footer,
                },
              },
              {
                id: 'sms-sam',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Hello from Sam',
                summary: 'Informational, about a job they signed for: no offer, no link. Held by the Time Window, skipped for SMS DND. Replies land in Conversations and alert Sam as a follower.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, it's {{custom_values.production_manager}}, production manager at Harbor & Pine Roofing. Thanks for choosing us. I'm ordering your materials and will call you within two business days to set your install date. Texting me here works too.",
                },
              },
              {
                id: 'wait-job',
                kind: 'wait',
                title: 'Wait',
                label: 'Until the crew signs off',
                mode: 'event',
                event: 'tag_added',
                value: 'job-complete',
                minutes: 45 * DAY,
                summary: 'Specific conditions to be met: Contact Tag includes job-complete, which Sam adds after the final walkthrough. No other tag ends it. Timeout: 45 days.',
                branches: {
                  met: {
                    label: 'Job complete',
                    nodes: [
                      {
                        id: 'job-date',
                        kind: 'action',
                        action: 'update_field',
                        title: 'Update Contact Field',
                        label: 'Job Date',
                        summary: 'Job Date set to Current Date. The warranty and the review timing count from it.',
                        run: ({ now }) => ({ effect: { fields: { job_date: dateField(now) } }, log: `Job Date set to ${dateField(now)}, the day the crew signed off.` }),
                      },
                      {
                        id: 'opp-complete',
                        kind: 'action',
                        action: 'update_opportunity',
                        title: 'Update Opportunity',
                        label: 'Job Complete',
                        summary: 'Roofing Sales › Job Complete, status still Won. The stage change starts 06 · Reviews & Referrals.',
                        effect: { opportunity: { stage: 'Job Complete', status: 'won' } },
                      },
                    ],
                  },
                  timeout: {
                    label: 'No sign-off in 45 days',
                    nodes: [
                      {
                        id: 'check-card',
                        kind: 'ifelse',
                        title: 'If/Else',
                        label: 'Still waiting on the crew?',
                        branches: [
                          {
                            label: 'Still Job Scheduled',
                            when: {
                              type: 'all',
                              label: 'Opportunity Status is Won and Pipeline Stage is Job Scheduled',
                              of: [
                                { type: 'opportunity', status: 'won' },
                                { type: 'opportunity', stage: 'Job Scheduled' },
                              ],
                            },
                            nodes: [
                              {
                                id: 'notify-stale',
                                kind: 'action',
                                action: 'internal_notification',
                                title: 'Internal Notification',
                                label: 'Stale job card',
                                summary: 'Type Notification (the bell), To User Type Particular Users: Jordan Blake, Redirect Page the opportunity. Says what to do in each case.',
                                message: {
                                  channel: 'internal',
                                  to: 'Jordan Blake (particular user)',
                                  subject: 'Stale job: {{contact.name}}, no sign-off yet',
                                  body: 'Sold by {{user.name}}, in Job Scheduled for 45 days or more with no job-complete tag. Roof done? Ask {{custom_values.production_manager}} to add the tag: this workflow is still watching, and the tag moves the card and starts the review request. Delayed? Add a note saying why. Canceled? Mark the deal Lost.',
                                },
                              },
                              {
                                id: 'goto-wait',
                                kind: 'goto',
                                title: 'Go To',
                                target: 'wait-job',
                                summary: 'Back into the 45-day wait, so a late tag still moves the card and starts 06. Jordan hears again if another 45 days pass.',
                              },
                            ],
                          },
                        ],
                        otherwise: {
                          label: 'Closed another way',
                          nodes: [
                            {
                              id: 'note-closed',
                              kind: 'action',
                              action: 'add_note',
                              title: 'Add Note',
                              label: 'Closed without sign-off',
                              summary: 'The deal is no longer Won in Job Scheduled: canceled, lost or moved by hand. It says so on the contact and ends without an alert.',
                              run: ({ contact }) => {
                                const o = contact.opportunity;
                                return { log: `Note on the contact: "Hand-off closed after 45 days. The deal is ${capital(o?.status ?? 'unknown')} in ${o?.stage ?? 'no stage'} and was never tagged job-complete, so no stale-job alert went out."` };
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
          label: 'Already handed off',
          nodes: [
            {
              id: 'note-again',
              kind: 'action',
              action: 'add_note',
              title: 'Add Note',
              label: 'Won again, nothing re-sent',
              summary: 'The status changed on a card that already had its hand-off. The note says so and the run ends: no second Slack post, sheet row, task or welcome message.',
              run: ({ contact }) => ({
                log: `Note on the contact: "Marked Won again on a card already at ${contact.opportunity?.stage ?? 'a later stage'}. The hand-off ran when the job was sold, so nothing went to Slack, the sheet, Sam or the homeowner this time."`,
              }),
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'signed',
      label: 'Signs on a Tuesday, done in 10 days',
      summary: "Dana signs the estimate at 2:25 PM and 04 marks the deal Won. She answers Sam's text, which does not end the run, and Sam tags the job complete after the walkthrough.",
      start: at(1, 14, 25),
      contact: {
        assignedTo: 'maya',
        address: '418 Maple Ave, Oak Park, IL 60302',
        tags: ['estimate-signed'],
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 14800 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 14800 },
      },
      events: [
        { at: 38, type: 'reply', value: 'Thank you! Mornings are best for a call, I work from home.', label: 'Stop on Response is off, so she stays in the workflow. Maya still owns the contact; Sam gets the follower alert' },
        { at: at(11, 16, 40) - at(1, 14, 25), type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam in the app after the final walkthrough' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['remove-04', 'first-time:0', 'clear-tag', 'opp-scheduled', 'slack', 'sheet', 'task-materials', 'follow-sam', 'email-welcome', 'sms-sam', 'wait-job:met', 'job-date', 'opp-complete'],
        tags: ['job-complete'],
        stage: 'Job Complete',
      },
    },
    {
      id: 'late',
      label: 'Won at 9:10 PM, texts off',
      summary: 'Luis closes a storm-damage job at the kitchen table and marks it Won from the app on Thursday night. The homeowner replied STOP to an estimate text last week. The crew post, the sheet row and the task go now; the welcome email waits for 8 AM and Sam\'s text is skipped.',
      start: at(3, 21, 10),
      contact: {
        assignedTo: 'luis',
        address: '2215 Elm St, Berwyn, IL 60402',
        dnd: { sms: true },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 11200 },
        fields: { service_needed: 'Storm damage', roof_age: '10-20 years', sms_consent: 'Yes', estimate_amount: 11200 },
      },
      events: [{ at: at(16, 15, 5) - at(3, 21, 10), type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam after the walkthrough' }],
      expect: { outcome: 'completed', visits: ['slack', 'sheet', 'task-materials', 'email-welcome', 'wait-job:met', 'opp-complete'], skips: ['sms-sam'], stage: 'Job Complete' },
    },
    {
      id: 'stale',
      label: 'Nobody signs off',
      summary: 'The roof goes on, but nobody adds the tag. At 45 days Jordan gets the stale-job alert, the workflow keeps watching, and the tag Sam adds a week later still moves the card.',
      start: at(0, 11, 30),
      contact: {
        assignedTo: 'luis',
        address: '731 Linden Ave, Forest Park, IL 60130',
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 16400 },
        fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 16400 },
      },
      events: [{ at: 52 * DAY + 5 * 60 - 30, type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam after Jordan asked' }],
      expect: {
        outcome: 'completed',
        visits: ['wait-job:timeout', 'check-card:0', 'notify-stale', 'goto-wait', 'wait-job:met', 'job-date', 'opp-complete'],
        stage: 'Job Complete',
      },
    },
    {
      id: 'cancelled',
      label: 'Cancels after signing',
      summary: 'Signs on Saturday and calls on Monday to cancel. Luis marks the deal Lost; nothing more goes to the homeowner, and at 45 days the run closes quietly instead of raising a false alarm.',
      start: at(5, 11, 20),
      contact: {
        assignedTo: 'luis',
        address: '52 Cedar Ct, River Forest, IL 60305',
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 9800 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 9800 },
      },
      events: [{ at: at(7, 9, 5) - at(5, 11, 20), type: 'opportunity_lost', label: 'Luis marked it Lost, reason Canceled by customer, and told Sam' }],
      expect: { outcome: 'completed', visits: ['sms-sam', 'wait-job:timeout', 'check-card:else', 'note-closed'], stage: 'Job Scheduled' },
    },
    {
      id: 'again',
      label: 'Won again after the job',
      summary: 'Three weeks after the roof went on, Jordan sets the finished card to Open by mistake during a pipeline cleanup, then back to Won. The workflow starts again, finds the card at Job Complete and only leaves a note.',
      start: at(2, 16, 5),
      contact: {
        assignedTo: 'maya',
        address: '418 Maple Ave, Oak Park, IL 60302',
        tags: ['estimate-signed', 'job-complete'],
        opportunity: { pipeline: 'Roofing Sales', stage: 'Job Complete', status: 'won', value: 13400 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 13400, job_date: '02-10-2026' },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['remove-04', 'first-time:else', 'note-again'], tags: ['job-complete'], stage: 'Job Complete' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Estimate Amount', key: 'estimate_amount', type: 'Number', note: 'Filled in by the estimator when the estimate goes out (04). A plain number, so the Slack post adds its own dollar sign. Feeds the Slack post and the sheet, never a customer message' },
      { name: 'Job Date', key: 'job_date', type: 'Date', note: 'Set to Current Date when the crew signs off. Warranty and review timing count from it' },
    ],
    tags: [{ name: 'job-complete', note: 'Added by Sam after the final walkthrough. Ends the wait; cleared at the start of every new hand-off' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Production Manager', key: 'production_manager', value: 'Sam Rivera' },
      { name: 'Warranty Link', key: 'warranty_link', value: 'harborpine.example/warranty' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    {
      title: 'Agree what Won means',
      body: 'With Jordan and Sam: a deal is Won when the contract is signed, not when the homeowner says yes on the phone. Sam wanted every sale in #production and in the Jobs sheet he already runs, one call to the homeowner from him instead of three from different people, and to see their replies himself. Those answers are the workflow.',
    },
    {
      title: 'Trigger on the status, and hand off once per card',
      body: "Opportunity Status Changed, In Pipeline Roofing Sales, Moved To Status Won, so an estimator marking Won in the app and 04 marking it on a signed estimate start the same hand-off. The first step takes the contact out of 04. GHL's own FAQ says this trigger fires every time the status changes, so an If/Else checks the card next: one already at Job Scheduled or Job Complete has had its hand-off, gets a note and stops. The trigger carries the deal, so Update Opportunity needs no Find Opportunity, and the If/Else can read opportunity fields, which GHL only allows with an opportunity-based trigger.",
    },
    {
      title: 'Slack through a Custom Webhook',
      body: "A Slack incoming webhook on #production, called by Custom Webhook with Event CUSTOM, Method POST, Content-Type application/json and a raw JSON body. GHL's Send Slack Message action would also work and is premium too; I used the webhook because it takes Slack's Block Kit JSON, so the post reads as fields on a phone. Free-text fields stay out of the body: a double quote or line break in a merge value can break the JSON. The URL is the credential, so it lives only in this action, and a leaked one is revoked in Slack and replaced.",
    },
    {
      title: 'The job sheet Sam already uses',
      body: "Google Sheets, Create Spreadsheet Row: I connected the office's Google account, picked Jobs 2026 and the Sold worksheet, clicked Refresh Headers and mapped columns A to I. The date comes from {{right_now.middle_endian_date}} and the amount goes into a currency column so the sheet can total it. Install date and crew stay blank, because Sam fills those in when he books the crew.",
    },
    {
      title: 'Premium steps only where they earn it',
      body: 'Custom Webhook and Google Sheets are premium: GHL bills $0.01 per execution after a sub-account\'s first 100, unless a Workflows Pro plan covers it. That is two premium executions per sold roof. Everything else is a standard action, nothing premium sits inside the Go To loop, and the check at the top stops a status flip from paying for a second post and row. If Slack returns an error, GHL retries with backoff or marks the step failed and skips it, so an outage never holds up the homeowner\'s email.',
    },
    {
      title: 'Wait for the crew, not the calendar',
      body: 'Install dates move with the weather, so the workflow does not guess one. A Wait for Specific conditions to be met (Contact Tag includes job-complete) holds the contact for up to 45 days. Sam adds the tag after the walkthrough, and the workflow stamps Job Date and moves the card, which starts 06. The hand-off clears any old job-complete tag first, so a repeat customer cannot skip the wait.',
    },
    {
      title: 'Settings and ownership on purpose',
      body: 'Stop on Response off: "thanks, mornings are best" must not pull the job out before it reaches Job Complete. Time Window Monday to Saturday, 8 AM to 8 PM: it holds only the email and the text, so a 9 PM kitchen-table sale reaches Slack now and the homeowner at 8 AM. Sam is added as a contact follower rather than made the assigned user, so the estimator keeps the customer and Sam still gets the follower alert, which is on by default, for every reply. GHL\'s workflow error emails cover Custom Webhook and Google Sheets but are off by default, so I turned them on with Jordan as a recipient.',
    },
    {
      title: 'Test, publish, hand off',
      body: "On a test contact I mark a deal Won at night, reply to Sam's text, add the tag, then set the finished card to Open and back to Won. A draft copy with a 5-minute timeout covers the stale and canceled paths. Execution Logs must show a 200 from Slack and exactly one sheet row per sale. Sam and the crew get the one-page sign-off card below.",
    },
  ],
  edgeCases: [
    {
      title: 'Won late at night',
      body: "The Slack post, the sheet row and the task happen the moment the deal is won. The Time Window holds the welcome email and Sam's text until 8 AM, and a sale marked after 8 PM on Saturday waits for Monday morning.",
    },
    {
      title: 'The homeowner answers Sam',
      body: 'Stop on Response is off, so the reply lands in Conversations and the job stays in the workflow. The estimator still owns the contact, and Sam follows it, so the reply reaches the person who sent the text. Nothing automated goes to the homeowner after that text, so no reply is ever answered by the workflow. With Stop on Response on, the run would end there, the card would never reach Job Complete and 06 would never ask for a review.',
    },
    {
      title: 'Texts are off',
      body: "Sam's text is informational: it is about a job they signed for, has no offer or link, and goes out inside the same 8 AM to 8 PM window as everything else. A homeowner who replied STOP earlier is DND for SMS, and GHL skips the text. The welcome email says the same things, and Sam's task has him calling within two business days anyway.",
    },
    {
      title: 'Nobody adds the tag',
      body: 'At 45 days an If/Else reads the deal. Still Won in Job Scheduled: Jordan gets an alert that opens the opportunity, and a Go To puts the contact back in the wait, so a late tag still moves the card and starts 06. The loop only ends when the card is tagged, marked Lost or moved, which is the point: a sold roof cannot go quiet. GHL notes that contacts already in a Wait keep their old wait if the step is edited, so I chose 45 days before publishing rather than after.',
    },
    {
      title: 'Cancels after signing',
      body: 'The estimator marks the deal Lost and tells Sam the same day, because materials may already be on order. Nothing else goes to the homeowner, and at 45 days the If/Else sees the deal is no longer Won and closes the run with a note instead of a false alarm. If cancellations become common, I would add a small workflow on Moved From Status Won that alerts Sam at once.',
    },
    {
      title: 'Status changed twice',
      body: "During the job, a Won, Open, Won misclick changes nothing: GHL does not re-enter a contact who is still in the workflow. After the job, re-entry is on, so the If/Else at the top reads the card. At Job Scheduled or Job Complete it has had its hand-off, so it gets a note and nothing else, and the job-complete tag stays. A repeat customer's next job, on its own card, passes the check and gets a full hand-off, and its first step clears last year's tag.",
    },
  ],
  qa: [
    'Mark a test deal Won while it is still in 04: 04\'s Enrollment History shows "Removed by External Workflow Action", the card moves to Job Scheduled, #production gets one post with a 200 in Execution Logs, Jobs 2026 gets one row, and Sam gets one task due the next business day',
    'Mark Won after 8 PM: Slack, the sheet and the task happen now; the email and the SMS show as waiting and send at 8 AM',
    "Reply to Sam's text: the contact stays in the workflow, Sam gets the follower alert in the app, and the estimator is still the assigned user",
    'Contact with SMS DND: the SMS step shows as skipped and the email still sends',
    'Add job-complete: Job Date is today, the card moves to Job Complete, and the contact appears in 06',
    'Draft copy with a 5-minute timeout: Jordan gets an alert that opens the opportunity and the contact goes back into the wait; with the deal marked Lost first, a note and no alert',
    'Set the finished test card to Open and back to Won: one note on the contact, nothing in Slack, the sheet, the task list or the homeowner\'s inbox, and job-complete still on the contact',
    "A name with an apostrophe, an address with an ampersand and a $14,800 estimate: the Slack post shows one dollar sign, and the sheet row lands in the right columns with the amount totaling",
  ],
  snippets: [
    { title: 'Slack post (Custom Webhook raw body)', language: 'json', code: slackPayload, note: 'Posted to a Slack incoming webhook for #production. "text" is what shows in the phone notification; the blocks lay the job out as fields.' },
    { title: 'Jobs 2026 column map (Google Sheets)', language: 'text', code: sheetColumns, note: 'Refresh Headers after any change to row 1, or the mapping shifts one column.' },
    { title: 'Crew sign-off card (SOP)', language: 'text', code: crewSop, note: 'The whole hand-off hangs on one tag, so the SOP is about that tag.' },
  ],
  features: [
    'Opportunity Status Changed',
    'Remove from Workflow',
    'If/Else',
    'Remove Contact Tag',
    'Update Opportunity',
    'Custom Webhook',
    'Google Sheets',
    'Add Task',
    'Add Contact Follower',
    'Send Email',
    'Send SMS',
    'Wait · Specific conditions',
    'Update Contact Field',
    'Internal Notification',
    'Go To',
    'Add Note',
    'Time Window',
    'Allow Re-entry',
  ],
};
