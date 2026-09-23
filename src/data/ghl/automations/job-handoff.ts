import type { Automation, Contact } from '@/lib/ghl/types';
import { formatDay, nextWeekdayAt } from '@/lib/ghl/engine';
import { env } from '../business';

const DAY = 1440;
const MON_SAT = [0, 1, 2, 3, 4, 5];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** The simulated date the way a GHL date field stores it: MM-DD-YYYY. */
const dateField = (min: number) => {
  const d = new Date(Date.UTC(2026, 2, 2) + Math.floor(min / DAY) * DAY * 60000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
};

/** Full name of the contact's assigned estimator, for log lines. */
const estimator = (c: Contact) => (c.assignedTo && env.users[c.assignedTo]?.name) || 'the assigned estimator';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

A  Sold on         date the deal was marked Won
B  Customer        {{contact.name}}
C  Phone           {{contact.phone}}
D  Address         {{contact.full_address}}
E  Scope           {{contact.service_needed}}
F  Amount          {{contact.estimate_amount}}   plain number, so the sheet can total it
G  Estimator       {{user.name}}
H  Install date    blank: Sam fills it in when he books the crew
I  Crew            blank: Sam`;

const crewSop = `When a job is finished and you have walked it with the homeowner:

  1. Open the contact in the LeadConnector app.
  2. Add the tag job-complete.

That is all. The card moves to Job Complete by itself, Job Date is set
to today, and the homeowner gets the review request from 06.

Do not drag the card to Job Complete yourself: the date is not set
and this workflow keeps waiting for a tag that never comes.

Job slipping past 45 days?  Add a note on the contact saying why.
Signed job cancelled?       Mark the opportunity Lost and post in #production.`;

export const jobHandoff: Automation = {
  id: 'job-handoff',
  number: '05',
  name: 'Won to job hand-off',
  kicker: 'Production',
  tagline: 'The moment a deal is marked Won, the crew channel, the job sheet, the production manager and the homeowner all hear about it, and the card moves itself to Job Complete when the crew signs off.',
  problem:
    'A sold job reached production by text message, if it reached it at all. Sam heard about sales days late, materials went on order late, homeowners called to ask what happens next, and finished jobs sat in Job Scheduled, so nobody ever asked those customers for a review.',
  solution:
    'One workflow starts when a Roofing Sales deal is marked Won, whether an estimator does it in the app or 04 does it when the estimate is signed. It moves the card to Job Scheduled, posts the job to the crew channel in Slack, adds a row to the Jobs 2026 sheet, gives Sam a materials task, and sends the homeowner a welcome email and a text from Sam. Then it waits for the crew to tag the job complete, stamps the date and moves the card to Job Complete, which starts 06 · Reviews & Referrals. A job with no sign-off after 45 days goes to Jordan instead of going quiet.',
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
      timeWindow: { start: '08:00', end: '20:00', days: MON_SAT },
      timezone: 'contact',
      senderName: 'Sam Rivera, Harbor & Pine Roofing',
      notes: [
        'Stop on Response off: a reply to Sam must not end the run before the card reaches Job Complete, or 06 never starts. Replies land in Conversations for a person.',
        'Time Window Monday to Saturday, 8 AM to 8 PM, contact time zone. It holds the email and the text only; Slack, the sheet row and the task run the moment the deal is won.',
        'Allow Re-entry on, so a repeat customer gets a hand-off for their next job. GHL does not re-enter a contact who is still in the workflow, so a Won, Open, Won misclick mid-job sends nothing twice.',
        'Sender Details: From Name Sam Rivera, From Email sam@harborpine.example, From Number the main line the homeowner already has saved.',
      ],
    },
    steps: [
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
        summary: 'Roofing Sales › Job Scheduled, status stays Won. The trigger carries this deal, so there is no Find Opportunity step.',
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
          body: 'Scope: {{contact.service_needed}}, roof age {{contact.roof_age}}\nContract: ${{contact.estimate_amount}}\nSold by: {{user.name}}\nHomeowner: {{contact.phone}}\nNext: {{custom_values.production_manager}} orders materials',
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
          log: `New row in Jobs 2026 › Sold: ${dateField(now)} | ${contact.firstName} ${contact.lastName} | ${contact.phone} | ${contact.fields.service_needed} | ${contact.fields.estimate_amount} | ${estimator(contact)}. The address comes from the contact record; install date and crew are left blank for Sam.`,
        }),
      },
      {
        id: 'task-materials',
        kind: 'action',
        action: 'add_task',
        title: 'Add Task',
        label: 'Order materials',
        summary: 'Assign To Sam Rivera, Due In 1 day, Skip Weekends on. The description carries the scope, the amount and the estimator.',
        run: ({ contact, now }) => ({
          log: `Task for Sam Rivera: order materials for ${contact.firstName} ${contact.lastName} (${String(contact.fields.service_needed).toLowerCase()}), due ${formatDay(nextWeekdayAt(now, 0))}.`,
        }),
      },
      {
        id: 'email-welcome',
        kind: 'action',
        action: 'send_email',
        title: 'Send Email',
        label: 'Welcome and prep checklist',
        summary: 'From Sam: who looks after the job now, what happens next, how to get the house ready, and the warranty link.',
        message: {
          channel: 'email',
          subject: 'Your new roof: what happens next',
          body: "Hi {{contact.first_name}},\n\nThank you for choosing Harbor & Pine Roofing. I'm {{custom_values.production_manager}}, the production manager, and I look after your job from here until the crew packs up. {{user.first_name}} is still your contact for anything about the contract.\n\nWhat happens next\n1. I order your materials and call you within two business days to set an install date.\n2. Most roofs take one or two days. If the forecast turns, I call you before the crew is due, not after.\n3. When the crew finishes, we walk the property with you before we call it done.\n\nGetting ready\n- Move cars out of the driveway and the garage the night before.\n- Take down pictures and shelves on top-floor walls. Hammering shakes them.\n- Move patio furniture, grills and planters away from the house.\n- Keep pets inside while the crew works, and let your neighbors know it will be noisy.\n\nYour warranty and what it covers: {{custom_values.warranty_link}}\n\nQuestions? Reply to this email or call {{custom_values.office_phone}}.\n\n{{custom_values.production_manager}}\nHarbor & Pine Roofing",
        },
      },
      {
        id: 'sms-sam',
        kind: 'action',
        action: 'send_sms',
        title: 'Send SMS',
        label: 'Hello from Sam',
        summary: 'A transactional text about a job they signed: no offer, no link. Replies go to Conversations, not to Sam\'s own phone.',
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
        minutes: 45 * DAY,
        summary: 'Specific conditions to be met: Contact Tag includes job-complete, which Sam adds after the final walkthrough. Timeout: 45 days.',
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
                id: 'still-open',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Still waiting on the crew?',
                branches: [
                  {
                    label: 'Still Job Scheduled',
                    when: { type: 'all', label: 'Opportunity status is Won and stage is Job Scheduled', of: [{ type: 'opportunity', stage: 'Job Scheduled', status: 'won' }] },
                    nodes: [
                      {
                        id: 'notify-stale',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Stale job card',
                        summary: 'In-app and email to Jordan, with the Redirect Page set to the opportunity. Says what to do in each case.',
                        message: {
                          channel: 'internal',
                          to: '{{custom_values.owner_name}} (owner)',
                          subject: 'Stale job: {{contact.name}}, no sign-off yet',
                          body: 'Sold by {{user.name}}, in Job Scheduled for 45 days or more with no job-complete tag. Roof done? Ask {{custom_values.production_manager}} to add the tag: this workflow is still watching, and the tag moves the card and starts the review request. Delayed? Add a note saying why. Cancelled? Mark the deal Lost.',
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
                      summary: 'The deal is no longer Won in Job Scheduled: cancelled, lost or moved by hand. It says so on the contact and ends without an alert.',
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
  scenarios: [
    {
      id: 'signed',
      label: 'Signs on a Tuesday, done in 10 days',
      summary: 'Dana signs the estimate at 2:25 PM and 04 marks the deal Won. She answers Sam\'s text, which does not end the run, and Sam tags the job complete after the walkthrough.',
      start: at(1, 14, 25),
      contact: {
        assignedTo: 'maya',
        tags: ['estimate-signed'],
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 14800 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 14800 },
      },
      events: [
        { at: 38, type: 'reply', value: 'Thank you! Mornings are best for a call, I work from home.', label: 'Stop on Response is off, so the reply goes to Conversations and she stays in the workflow' },
        { at: at(11, 16, 40) - at(1, 14, 25), type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam in the app after the final walkthrough' },
      ],
      expect: {
        outcome: 'completed',
        visits: ['clear-tag', 'opp-scheduled', 'slack', 'sheet', 'task-materials', 'email-welcome', 'sms-sam', 'wait-job:met', 'job-date', 'opp-complete'],
        tags: ['job-complete'],
        stage: 'Job Complete',
      },
    },
    {
      id: 'late',
      label: 'Won at 9:10 PM',
      summary: 'Luis closes a storm-damage job at the kitchen table and marks it Won from the app on Thursday night. The crew post, the sheet row and the task go now; the homeowner hears from us at 8 AM.',
      start: at(3, 21, 10),
      contact: {
        assignedTo: 'luis',
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 11200 },
        fields: { service_needed: 'Storm damage', roof_age: '10-20 years', sms_consent: 'Yes', estimate_amount: 11200 },
      },
      events: [{ at: at(16, 15, 5) - at(3, 21, 10), type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam after the walkthrough' }],
      expect: { outcome: 'completed', visits: ['slack', 'sheet', 'task-materials', 'email-welcome', 'sms-sam', 'wait-job:met', 'opp-complete'], stage: 'Job Complete' },
    },
    {
      id: 'no-texts',
      label: 'Texts turned off',
      summary: 'Replied STOP to an estimate follow-up text, then signed anyway. Sam\'s text is skipped; the welcome email and everything internal still run.',
      start: at(4, 10, 45),
      contact: {
        assignedTo: 'maya',
        dnd: { sms: true },
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 12950 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 12950 },
      },
      events: [{ at: at(17, 13, 20) - at(4, 10, 45), type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam after the walkthrough' }],
      expect: { outcome: 'completed', visits: ['email-welcome', 'wait-job:met', 'job-date', 'opp-complete'], skips: ['sms-sam'], stage: 'Job Complete' },
    },
    {
      id: 'stale',
      label: 'Nobody signs off',
      summary: 'The roof goes on, but nobody adds the tag. At 45 days Jordan gets the stale-job alert, the workflow keeps watching, and the tag Sam adds a week later still moves the card.',
      start: at(0, 11, 30),
      contact: {
        assignedTo: 'luis',
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 16400 },
        fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 16400 },
      },
      events: [{ at: 52 * DAY + 5 * 60 - 30, type: 'tag_added', value: 'job-complete', label: 'job-complete, added by Sam after Jordan asked' }],
      expect: {
        outcome: 'completed',
        visits: ['wait-job:timeout', 'still-open:0', 'notify-stale', 'goto-wait', 'wait-job:met', 'job-date', 'opp-complete'],
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
        opportunity: { pipeline: 'Roofing Sales', stage: 'Estimate Sent', status: 'won', value: 9800 },
        fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', estimate_amount: 9800 },
      },
      events: [{ at: at(7, 9, 5) - at(5, 11, 20), type: 'opportunity_lost', label: 'Luis marked it Lost, reason Cancelled by customer, and told Sam' }],
      expect: { outcome: 'completed', visits: ['sms-sam', 'wait-job:timeout', 'still-open:else', 'note-closed'], stage: 'Job Scheduled' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Estimate Amount', key: 'estimate_amount', type: 'Number', note: 'Set when the estimate goes out. Feeds the Slack post and the sheet' },
      { name: 'Job Date', key: 'job_date', type: 'Date', note: 'Set to Current Date when the crew signs off. Warranty and review timing count from it' },
    ],
    tags: [{ name: 'job-complete', note: 'Added by Sam after the final walkthrough. Ends the wait; cleared at the start of every hand-off' }],
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
      body: 'With Jordan and Sam: a deal is Won when the contract is signed, not when the homeowner says yes on the phone. Sam wanted every sale in #production and in the Jobs sheet he already runs, and one call to the homeowner from him, not three from different people. Those answers are the workflow.',
    },
    {
      title: 'Trigger on the status, not the stage',
      body: 'Opportunity Status Changed, In Pipeline Roofing Sales, Moved To Status Won. An estimator marking Won in the app and 04 marking it when the estimate is signed start the same hand-off. The trigger carries the deal, so Update Opportunity moves it without Find Opportunity, and the If/Else later can read opportunity fields, which GHL only allows with an opportunity-based trigger.',
    },
    {
      title: 'Slack through a Custom Webhook',
      body: "A Slack incoming webhook on #production, called by Custom Webhook with Event CUSTOM, Method POST and a raw JSON body. The native Slack Message action would also work; I used the webhook because it takes Slack's Block Kit JSON, so the post reads as fields on a phone. Free-text fields stay out of the body: a double quote or line break in a merge value can break the JSON. The URL is the credential, so it lives only in this action, and a leaked one is revoked in Slack and replaced.",
    },
    {
      title: 'The job sheet Sam already uses',
      body: "Google Sheets, Create Spreadsheet Row: I connected the office's Google account, picked Jobs 2026 and the Sold worksheet, clicked Refresh Headers and mapped columns A to I. The amount goes in as a plain number so the sheet can total it. Install date and crew stay blank, because Sam fills those in when he books the crew.",
    },
    {
      title: 'Premium steps only where they earn it',
      body: 'Custom Webhook and Google Sheets are premium actions, about $0.01 per execution once the free allowance is used, or covered by a Workflows Pro plan. That is two premium executions per sold roof. The messages, the wait and the branches are standard actions, and nothing premium sits inside the Go To loop.',
    },
    {
      title: 'Wait for the crew, not the calendar',
      body: 'Install dates move with the weather, so the workflow does not guess one. A Wait for Specific conditions to be met (Contact Tag includes job-complete) holds the contact for up to 45 days. Sam adds the tag after the walkthrough, and the workflow stamps Job Date and moves the card, which starts 06. The first step clears any old job-complete tag, so a repeat customer cannot skip the wait.',
    },
    {
      title: 'Settings on purpose',
      body: 'Stop on Response off: "thanks, mornings are best" must not pull the job out before it reaches Job Complete. Time Window Monday to Saturday, 8 AM to 8 PM: it holds only the email and the text, so a 9 PM kitchen-table sale reaches Slack now and the homeowner at 8 AM. Allow Re-entry on for repeat customers. GHL\'s workflow error emails cover Custom Webhook and Google Sheets but are off by default, so I turned them on with Jordan as a recipient.',
    },
    {
      title: 'Test, publish, hand off',
      body: "On a test contact I mark a deal Won at night, reply to Sam's text, and add the tag, then run a draft copy with a 5-minute timeout for the stale and cancelled paths. Execution Logs must show a 200 from Slack and exactly one sheet row per run. Sam and the crew get the one-page sign-off card below.",
    },
  ],
  edgeCases: [
    {
      title: 'Won late at night',
      body: 'The Slack post, the sheet row and the task happen the moment the deal is won. The Time Window holds the welcome email and Sam\'s text until 8 AM, and a sale marked after 8 PM on Saturday waits for Monday morning.',
    },
    {
      title: 'The homeowner answers Sam',
      body: 'Stop on Response is off, so the reply lands in Conversations and the job stays in the workflow. With it on, that reply would end the run, the card would never reach Job Complete and 06 would never ask for a review.',
    },
    {
      title: 'Texts are off',
      body: "A homeowner who replied STOP earlier is DND for SMS, and GHL skips Sam's text. The welcome email says the same things, and Sam's task has him calling within two business days anyway.",
    },
    {
      title: 'Nobody adds the tag',
      body: 'At 45 days an If/Else reads the deal. Still Won in Job Scheduled: Jordan gets an alert that opens the opportunity, and a Go To puts the contact back in the wait, so a late tag still moves the card and starts 06. GHL notes that people already in a Wait keep their old wait if the step is edited, so I chose 45 days before publishing rather than after.',
    },
    {
      title: 'Cancels after signing',
      body: 'The estimator marks the deal Lost and tells Sam the same day, because materials may already be on order. Nothing else goes to the homeowner, and at 45 days the If/Else sees the deal is no longer Won and closes the run with a note instead of a false alarm. If cancellations become common, I would add a small workflow on Moved From Status Won that alerts Sam at once.',
    },
    {
      title: 'Won, reopened, won again',
      body: 'Opportunity Status Changed fires on every change. GHL does not re-enter a contact who is still in the workflow, so a misclick during the job sends nothing twice. A second job for the same homeowner next year gets a fresh run, and its first step clears last year\'s job-complete tag.',
    },
  ],
  qa: [
    'Mark a test deal Won: the card moves to Job Scheduled, one post in #production with a 200 in Execution Logs, one row in Jobs 2026, one task for Sam due the next business day',
    'Mark Won after 8 PM: Slack, the sheet and the task happen now; the email and the SMS show as waiting and send at 8 AM',
    "Reply to Sam's text: the contact stays in the workflow, still waiting for the tag",
    'Contact with SMS DND: the SMS step shows as skipped and the email still sends',
    'Add job-complete: Job Date is today, the card moves to Job Complete, and the contact appears in 06',
    'Draft copy with a 5-minute timeout: Jordan gets an alert that opens the opportunity, and the contact goes back into the wait',
    'Same copy with the test deal marked Lost first: a note on the contact and no alert',
    "A name with an apostrophe and an address with an ampersand: the Slack post still arrives and the sheet row is intact",
  ],
  snippets: [
    { title: 'Slack post (Custom Webhook raw body)', language: 'json', code: slackPayload, note: 'Posted to a Slack incoming webhook for #production. "text" is what shows in the phone notification; the blocks lay the job out as fields.' },
    { title: 'Jobs 2026 column map (Google Sheets)', language: 'text', code: sheetColumns, note: 'Refresh Headers after any change to row 1, or the mapping shifts one column.' },
    { title: 'Crew sign-off card (SOP)', language: 'text', code: crewSop, note: 'The whole hand-off hangs on one tag, so the SOP is about that tag.' },
  ],
  features: [
    'Opportunity Status Changed',
    'Remove Contact Tag',
    'Update Opportunity',
    'Custom Webhook',
    'Google Sheets',
    'Add Task',
    'Send Email',
    'Send SMS',
    'Wait · Specific conditions',
    'Update Contact Field',
    'If/Else',
    'Internal Notification',
    'Go To',
    'Add Note',
    'Time Window',
    'Sender Details',
  ],
};
