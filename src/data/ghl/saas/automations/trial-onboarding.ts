import type { Automation, Contact } from '@/lib/ghl/types';
import { dateFieldValue, formatDay, nextWeekdayAt } from '@/lib/ghl/engine';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Add Task with Due In 1 day and Skip Weekends on: the next weekday. */
const dueDate = (now: number) => formatDay(nextWeekdayAt(now, 0));

/** "a", "a and b", "a, b and c". */
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * Tags that describe one trial. 02a adds activated, 03 adds pql-alerted and
 * pql-tip-sent, 04 adds trial-extended and trial-expired. A new trial clears
 * them all, or the goal here, the PQL alert in 03 and the extension offer in
 * 04 would treat it as the old one.
 */
const TRIAL_TAGS = ['activated', 'pql-alerted', 'pql-tip-sent', 'trial-extended', 'trial-expired'];

/**
 * What the app sends in each test contact's trial.started event, beyond their
 * own name and email. `existing` marks people GHL already knew by that email.
 */
const TRIALS: Record<string, { company: string; workspace_id: string; existing: boolean }> = {
  'rachel@brightlinehvac.example': { company: 'Brightline HVAC', workspace_id: 'ws_7Q2M9K', existing: true },
  'marcus@haleplumbing.example': { company: 'Hale Plumbing & Drain', workspace_id: 'ws_3LX8TD', existing: false },
  'dana@whitfieldclean.example': { company: 'Whitfield Home Cleaning', workspace_id: 'ws_9FC2VB', existing: false },
  'greg@northsidepest.example': { company: 'Northside Pest Control', workspace_id: 'ws_5RJ7NW', existing: true },
  'owen@brookselectric.example': { company: 'Brooks Electric', workspace_id: 'ws_8HN4QA', existing: true },
};

const trialOf = (c: Contact) => TRIALS[c.email] ?? { company: String(c.fields.company ?? ''), workspace_id: 'ws_TEST01', existing: false };

/** The onboarding tips and offers are treated as commercial: postal address here, unsubscribe link in the template footer. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

const payload = `{
  "event": "trial.started",
  "event_id": "evt_01JNR3D8Q6ZK4M7T2W9XB5C1HA",
  "email": "rachel@brightlinehvac.example",
  "first_name": "Rachel",
  "last_name": "Okafor",
  "phone": "+16145550192",
  "company": "Brightline HVAC",
  "workspace_id": "ws_7Q2M9K",
  "plan": "trial",
  "trial_end": "MM-DD-YYYY"
}`;

const mapping = `Create/Update Contact field    Value from the Inbound Webhook Trigger group
Email                          {{inboundWebhookRequest.body.email}}
First Name                     {{inboundWebhookRequest.body.first_name}}
Last Name                      {{inboundWebhookRequest.body.last_name}}
Phone                          {{inboundWebhookRequest.body.phone}}
Company Name (standard)        {{inboundWebhookRequest.body.company}}
Plan (custom)                  {{inboundWebhookRequest.body.plan}}
Trial Ends (custom, Date)      {{inboundWebhookRequest.body.trial_end}}
Workspace ID (custom)          {{inboundWebhookRequest.body.workspace_id}}

Not mapped: event and event_id. The app logs event_id next to
the ID GHL returns for each request, and that ID finds the
request again in the trigger's Mapping Reference list.`;

const activationPayload = `{
  "event": "workspace.activated",
  "event_id": "evt_01JNV7P2K9DQ3F8M4X6RT0B2ZC",
  "email": "rachel@brightlinehvac.example",
  "workspace_id": "ws_7Q2M9K",
  "rule": "first_job_dispatched"
}`;

export const trialOnboarding: Automation = {
  id: 'trial-onboarding',
  number: '02',
  name: 'Trial onboarding',
  kicker: 'Product events',
  tagline:
    'Every new trial gets four short emails from the customer success manager, each with one job to do. When the app says the team is up and running, the nudges stop and the next email changes.',
  problem:
    'Everyone who started a trial got the same emails on the same days. Owners who had their whole crew on the board by lunchtime were still told to invite their team, and the trials that stalled were only noticed when they expired.',
  solution:
    'The app posts trial.started to GHL, which creates or updates the contact, clears the tags left by any earlier trial and starts four emails from Leo, the CSM: log in, invite the techs, connect QuickBooks and Google Calendar, then an offer to set it up together. When the app reports activation, a two-step helper workflow tags the contact, and the Goal Event pulls them out of the nudges and onto a what-next email. Anyone still stuck on day 5 becomes a task for Leo, and contacts GHL cannot email go to him on day 0.',
  workflow: {
    name: '02 · Product · Trial Onboarding',
    folder: 'Product',
    triggers: [
      {
        title: 'Inbound Webhook',
        filters: ['Its own URL, called by the app for trial.started only', 'Mapping Reference: a saved trial.started request'],
        label: 'Inbound Webhook (trial.started)',
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
          by: "05 · Sales · Closed-Won to Onboarding, when a New Business deal is marked Won: right after it adds customer, its Remove from Workflow step takes the contact out of 02 and 04, so a signed customer gets Leo's kickoff instead of trial nudges. A self-serve payment (04a) does not remove anyone from 02.",
        },
      ],
      notes: [
        'Allow Re-entry on: a company that comes back for a second trial gets a new workspace and should get onboarding again. GHL does not let a contact re-enter while still active. This trigger starts without a contact, so the test plan checks that a repeated trial.started during a run does not start a second one.',
        'Stop on Response off: a reply like "do my techs need a smartphone?" is a question for Leo, not a reason to drop the rest of onboarding. If Leo takes someone over by hand, he removes them from this workflow himself: the one Goal Event is spent on activation, so a User Replied goal cannot do it for him.',
        'No workflow Time Window: the welcome email has to go the minute they sign up. The later emails wait inside their own Advance Windows.',
        'Timezone: Contact. A contact the webhook creates may have no time zone, and GHL then falls back to the account time zone.',
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, so every reply reaches the person who can help.',
        'Inbound Webhook is a premium trigger, billed per execution: one per new trial.',
      ],
    },
    steps: [
      {
        id: 'upsert',
        kind: 'action',
        action: 'update_field',
        title: 'Create/Update Contact',
        label: 'Map the payload',
        summary:
          'GHL opens this step after an Inbound Webhook trigger. It updates the contact with this email, or creates one, and maps name, phone, Company Name, Plan, Trial Ends and Workspace ID from the payload.',
        run: ({ contact, now }) => {
          const p = trialOf(contact);
          const trial_end = dateFieldValue(now + 14 * DAY);
          const found = p.existing ? `Found the existing contact for ${contact.email} and updated it` : `No contact with ${contact.email} yet, so it created one`;
          return {
            effect: { fields: { company: p.company, plan: 'trial', trial_end, workspace_id: p.workspace_id } },
            log: `${found}: Company Name ${p.company}, Plan trial, Trial Ends ${trial_end}, Workspace ID ${p.workspace_id}.`,
          };
        },
        code: { language: 'json', source: payload },
      },
      {
        id: 'tag-trial',
        kind: 'action',
        action: 'add_tag',
        title: 'Add Contact Tag',
        label: 'trial',
        summary: 'Marks everyone who has started a trial. 04 · Product · Trial Ending filters on it; 04a takes it off on a self-serve payment and 05 on a sales win.',
        effect: { addTags: ['trial'] },
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: "Last trial's tags",
        summary:
          'activated, pql-alerted, pql-tip-sent, trial-extended and trial-expired each describe one trial. Clearing them here means this trial has to earn them again: the goal below can fire, 03 can alert sales, and 04 can offer the extension.',
        run: ({ contact }) => {
          const old = TRIAL_TAGS.filter((t) => contact.tags.includes(t));
          return {
            log: old.length
              ? `Removed ${list(old)}, left from an earlier trial. This trial starts clean, so the goal below can fire and 03 and 04 treat it as new.`
              : 'None of the per-trial tags are on the record, so there is nothing to clear.',
          };
        },
        effect: { removeTags: TRIAL_TAGS },
      },
      {
        id: 'if-email',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Can we email them?',
        branches: [
          {
            label: 'Email allowed',
            when: { type: 'not', label: 'Contact is not DND for Email', of: { type: 'dnd', channel: 'email' } },
            nodes: [
              {
                id: 'email-welcome',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Welcome and log in',
                summary: 'Transactional: it gives them access to what they signed up for, so it goes the minute they sign up, day or night. One link and one first job.',
                message: {
                  channel: 'email',
                  subject: 'Your Crewlo trial is ready, {{contact.first_name}}',
                  body:
                    "Hi {{contact.first_name}},\n\nYour Crewlo trial is set up. Log in here: {{custom_values.app_url}}\n\nYour trial runs {{custom_values.trial_length}}. The quickest way to find out whether Crewlo fits your team is to run real work through it, so start by putting this week's jobs on the dispatch board. Everything else in Crewlo builds on that board.\n\nShort guides for each step are at {{custom_values.help_center}}. Or reply to this email with any question. It comes straight to me.\n\nLeo Park\nCustomer Success, Crewlo",
                },
              },
              {
                id: 'wait-d1',
                kind: 'wait',
                title: 'Wait',
                label: 'Day 1, 8 AM to 6 PM',
                mode: 'time',
                minutes: DAY,
                window: { start: '08:00', end: '18:00', days: ALL_WEEK },
                summary:
                  "One day, then an Advance Window: Resume Between Hours 8 AM to 6 PM, any day, in the contact's time zone. The trial clock runs on weekends, so these emails do too.",
              },
              {
                id: 'email-invite',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Invite your techs',
                summary: 'Activation means a tech with a job on their phone, so this is the email that matters most.',
                message: {
                  channel: 'email',
                  subject: 'Get your techs on the board',
                  body:
                    "Hi {{contact.first_name}},\n\nCrewlo starts saving time when your techs see their jobs on their phones instead of calling the office for the next address.\n\nTo invite them, open {{custom_values.app_url}} and go to Team > Invite. Add each tech's mobile number or email, and they get a link to the Crewlo app.\n\nThen drag one job onto a tech on the board and ask them to check their phone. That is the moment the trial starts working for you.\n\nLeo" +
                    footer,
                },
              },
              {
                id: 'wait-d3',
                kind: 'wait',
                title: 'Wait',
                label: 'Day 3, 8 AM to 6 PM',
                mode: 'time',
                minutes: 2 * DAY,
                window: { start: '08:00', end: '18:00', days: ALL_WEEK },
                summary: 'Two more days, same Advance Window.',
              },
              {
                id: 'email-connect',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Connect QuickBooks and Google Calendar',
                summary: 'The two integrations that stop the office typing things twice, with where to find them.',
                message: {
                  channel: 'email',
                  subject: 'Connect QuickBooks and Google Calendar',
                  body:
                    'Hi {{contact.first_name}},\n\nTwo connections save your office from typing things twice:\n\n- QuickBooks: your customer list comes in once, and finished jobs go back as invoices ready to send.\n- Google Calendar: the office sees the dispatch board in the calendar they already use.\n\nBoth are under Settings > Integrations in {{custom_values.app_url}}. Step-by-step guides: {{custom_values.help_center}}\n\nLeo' +
                    footer,
                },
              },
              {
                id: 'wait-d5',
                kind: 'wait',
                title: 'Wait',
                label: 'Day 5, weekdays 9 to 5',
                mode: 'time',
                minutes: 2 * DAY,
                window: { start: '09:00', end: '17:00', days: WEEKDAYS },
                summary:
                  'Two more days, but this Advance Window has Resume On Monday to Friday and Resume Between Hours 9 AM to 5 PM. The next steps hand the trial to Leo, so they wait for a day he is working.',
              },
              {
                id: 'task-leo',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Leo checks in',
                summary:
                  'Assign To Leo Park, Due In 1 day, Skip Weekends on. The description has the workspace ID and phone, and says what to check before calling: a reply in Conversations, the activated and customer tags, and whether an account executive owns an open deal.',
                run: ({ contact, now }) => ({
                  log: `Task for Leo Park, due ${dueDate(now)}: "Trial not activated: ${contact.fields.company}". Workspace ${contact.fields.workspace_id} has not sent a job to a tech yet, and the set-up offer email goes out now. Before calling ${contact.phone}, check Conversations for a reply and the record for the activated and customer tags. If an account executive owns an open deal, the call is theirs.`,
                }),
              },
              {
                id: 'email-offer',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Set-up call offer',
                summary: 'Instead of another tip, a person offers to do it with them. A reply goes to Leo.',
                message: {
                  channel: 'email',
                  subject: 'Want me to set Crewlo up with you?',
                  body:
                    "Hi {{contact.first_name}},\n\nIt looks like no jobs have gone out to a tech's phone in Crewlo yet. Moving a whole schedule into new software takes time, and I would rather help than send you more tips.\n\nIf it is useful, I will set it up with you on a 20-minute screen share: we load this week's jobs, invite one tech and send them their first job. Reply with two times that suit you and I will send an invite.\n\nLeo Park\nCustomer Success, Crewlo" +
                    footer,
                },
              },
              {
                id: 'wait-grace',
                kind: 'wait',
                title: 'Wait',
                label: 'Time for the call',
                mode: 'time',
                minutes: 3 * DAY,
                summary: 'Three days for the set-up call to happen. If they activate in that time, the goal still catches it.',
              },
              {
                id: 'goal-activated',
                kind: 'goal',
                title: 'Goal Event',
                label: 'Activated',
                event: 'tag_added',
                value: 'activated',
                ifNotMet: 'end',
                summary:
                  'Contact Tag Added or Removed, watching for activated to be added. 02a · Product · Workspace Activated adds it when the app reports the first job sent to a tech. Reached without it: End this workflow, and 04 · Product · Trial Ending picks the trial up 3 days before Trial Ends.',
              },
              {
                id: 'wait-next',
                kind: 'wait',
                title: 'Wait',
                label: 'Next day, 8 AM to 6 PM',
                mode: 'time',
                minutes: DAY,
                window: { start: '08:00', end: '18:00', days: ALL_WEEK },
                summary: 'A day after activation, so the next email does not land while they are still in the middle of setting up. Same 8 AM to 6 PM Advance Window.',
              },
              {
                id: 'email-next',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'What to set up next',
                summary: 'The activated path: the next two setups, and one question whose answer tells Leo what could stop them buying.',
                message: {
                  channel: 'email',
                  subject: 'Your crew is on Crewlo. What to set up next',
                  body:
                    "Hi {{contact.first_name}},\n\nYour first job has gone out to a tech's phone, so the hardest part of switching is behind you.\n\nTwo things worth setting up next:\n\n1. Recurring jobs for maintenance contracts and repeat visits, so they land on the board without anyone retyping them.\n2. QuickBooks, if you have not connected it yet, so finished jobs turn into invoices.\n\nAnd one question: what would stop you from running next week's schedule in Crewlo? Just reply. I read every answer.\n\nLeo" +
                    footer,
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Email DND',
          nodes: [
            {
              id: 'task-dnd',
              kind: 'action',
              action: 'add_task',
              title: 'Add Task',
              label: 'Leo welcomes them by phone',
              summary:
                'None of the onboarding emails could send, so a person takes over on day 0. Assign To Leo Park, Due In 1 day, Skip Weekends on. The description says to call unless calls are on DND too, and to change DND only if the contact asks.',
              run: ({ contact, now }) => ({
                log: `Task for Leo Park, due ${dueDate(now)}: "New trial, email is off: ${contact.firstName} ${contact.lastName}, ${contact.fields.company}". Email DND is on, so no onboarding email will send. Call ${contact.phone} to welcome them and offer the set-up session, unless calls are on DND too. Change DND only if they ask, and note that they did.`,
              }),
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'day-two',
      label: 'Activates on day 2',
      summary: 'Rachel starts a trial an hour after her Wednesday demo. Her techs get their first jobs on Thursday evening, after the invite-your-team email, and the remaining nudges never send.',
      start: at(2, 15, 30),
      contact: { source: 'Website demo form', fields: { company: 'Brightline HVAC', company_size: '11-50', job_role: 'Operations or dispatch' } },
      events: [{ at: at(3, 17, 45) - at(2, 15, 30), type: 'tag_added', value: 'activated', label: 'Added by 02a: the app reported her first job dispatched to a tech' }],
      expect: {
        outcome: 'goal',
        visits: ['upsert', 'tag-trial', 'untag', 'if-email:0', 'email-welcome', 'wait-d1', 'email-invite', 'wait-d3', 'goal-activated', 'wait-next', 'email-next'],
        tags: ['trial', 'activated'],
      },
    },
    {
      id: 'never',
      label: 'Never activates',
      summary: 'Marcus signs up on Wednesday morning and never gets a job onto the board. Day 5 is a Monday, so Leo gets the task at 9 AM and the run ends on Thursday.',
      start: at(2, 8, 50),
      contact: {
        firstName: 'Marcus',
        lastName: 'Hale',
        email: 'marcus@haleplumbing.example',
        phone: '(512) 555-0134',
        timezone: 'America/Chicago',
        source: 'Crewlo app signup',
      },
      events: [],
      expect: {
        outcome: 'ended',
        visits: ['if-email:0', 'email-welcome', 'email-invite', 'email-connect', 'wait-d5', 'task-leo', 'email-offer', 'wait-grace', 'goal-activated'],
        tags: ['trial'],
      },
    },
    {
      id: 'fast',
      label: 'Activates the same day',
      summary: 'Dana signs up after lunch and has a tech on a job by 4:50 PM. She gets the welcome email, then the what-next email the following afternoon, and nothing in between.',
      start: at(3, 13, 30),
      contact: {
        firstName: 'Dana',
        lastName: 'Whitfield',
        email: 'dana@whitfieldclean.example',
        phone: '(919) 555-0168',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
      },
      events: [{ at: 3 * 60 + 20, type: 'tag_added', value: 'activated', label: 'Added by 02a: first job dispatched, 3 hours 20 minutes in' }],
      expect: { outcome: 'goal', visits: ['email-welcome', 'wait-d1', 'goal-activated', 'wait-next', 'email-next'], tags: ['trial', 'activated'] },
    },
    {
      id: 'email-dnd',
      label: 'Email DND',
      summary: 'Greg asked to be taken off Crewlo emails last fall, so Email DND is on. He starts a trial on Friday evening, and Leo gets a call task for Monday instead of an email sequence nobody would receive.',
      start: at(4, 16, 45),
      contact: {
        firstName: 'Greg',
        lastName: 'Lindqvist',
        email: 'greg@northsidepest.example',
        phone: '(612) 555-0127',
        timezone: 'America/Chicago',
        source: 'Newsletter signup',
        dnd: { email: true },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['upsert', 'tag-trial', 'untag', 'if-email:else', 'task-dnd'], tags: ['trial'] },
    },
    {
      id: 'second-trial',
      label: 'Second trial, old tags',
      summary:
        "Owen trialed last spring and never bought, so he still carries that trial's activated, pql-tip-sent and trial-expired tags. They come off at entry, so his new activation counts. He signs up on Sunday night, so the day-1 email waits for Tuesday morning.",
      start: at(6, 20, 15),
      contact: {
        firstName: 'Owen',
        lastName: 'Brooks',
        email: 'owen@brookselectric.example',
        phone: '(303) 555-0151',
        timezone: 'America/Denver',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated', 'pql-tip-sent', 'trial-expired'],
        fields: { company: 'Brooks Electric', plan: 'trial', workspace_id: 'ws_2DK6PM' },
      },
      events: [{ at: at(9, 11, 30) - at(6, 20, 15), type: 'tag_added', value: 'activated', label: 'Added by 02a: first job dispatched in the new workspace' }],
      expect: { outcome: 'goal', visits: ['untag', 'email-welcome', 'wait-d1', 'email-invite', 'goal-activated', 'email-next'], tags: ['trial', 'activated'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Company Name', key: 'company_name', type: 'Standard field', note: "From the payload's company. Merges as {{contact.company_name}}, the same field the demo form's Company fills" },
      { name: 'Plan', key: 'plan', type: 'Single line', note: 'trial here, from trial.started. Once paid, 04a (self-serve) or the AE before marking Won (05) writes standard-monthly or standard-annual. Single line, so a new plan name never fails a dropdown match.' },
      { name: 'Trial Ends', key: 'trial_end', type: 'Date', note: 'Sent as MM-DD-YYYY, a format GHL documents for writing values into Date fields. 04 counts back from it' },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: "The app's ID for the workspace. Workflows that call the app back send it." },
    ],
    tags: [
      { name: 'trial', note: 'Has started a trial. Added here; 04 filters on it, and 04a (self-serve payment) or 05 (sales win) removes it' },
      { name: 'activated', note: 'Activated this trial. Added by 02a · Product · Workspace Activated; the goal listens for it' },
      { name: 'pql-alerted', note: 'Set by 03 once per trial. Cleared here when a new trial starts' },
      { name: 'pql-tip-sent', note: 'Set by 03 once per trial. Cleared here when a new trial starts' },
      { name: 'trial-extended', note: 'Set by 04 for one trial. Cleared here when a new trial starts' },
      { name: 'trial-expired', note: 'Set by 04 for one trial. Cleared here when a new trial starts' },
    ],
    customValues: [
      { name: 'App URL', key: 'app_url', value: 'app.crewlo.example' },
      { name: 'Help Center', key: 'help_center', value: 'help.crewlo.example' },
      { name: 'Trial Length', key: 'trial_length', value: '14 days' },
    ],
  },
  build: [
    {
      title: 'Activation, defined once',
      body: "Hana and Crewlo's product team agreed on one rule: the first job dispatched to a technician's phone. The app owns that rule and sends workspace.activated once per workspace. GHL allows one Goal Event per workflow and none of its goal types is a webhook, so 02a · Product · Workspace Activated takes the event, finds the contact with Create/Update Contact and adds the activated tag. The goal here listens for that tag.",
    },
    {
      title: 'A payload contract, in writing',
      body: 'One webhook URL per event. Flat JSON with snake_case keys, because GHL does not accept keys with spaces. Email on every event, because Create/Update Contact needs an email or phone to find the contact. trial_end in MM-DD-YYYY, a format GHL documents for Date fields, instead of an ISO timestamp. Nothing secret in the body: the URL itself is the only credential, so the app keeps it in its secret store.',
    },
    {
      title: 'Trigger and mapping',
      body: "Inbound Webhook, then a test event from the app's staging environment, Test Trigger, and that request saved as the Mapping Reference. GHL opens Create/Update Contact after the trigger, and I mapped each field from the Inbound Webhook Trigger group in the picker. The developers' runbook has the article's two rules: pick the Mapping Reference again when the payload changes, and if the URL leaks, delete the trigger and add a new one, which issues a new URL.",
    },
    {
      title: 'Data model and deduplication',
      body: 'Custom fields for Plan, Trial Ends and Workspace ID; the company goes to the standard Company Name field. Under Contact Deduplication Preferences, Allow Duplicate Contact is off and Find Existing Contacts Based On is Email. That article names Forms, Zapier, Facebook and Instagram, not workflow actions, so the test plan checks that a demo request and a later trial land on one record.',
    },
    {
      title: 'One trial, one set of tags',
      body: 'activated, pql-alerted, pql-tip-sent, trial-extended and trial-expired each describe one trial, and 02, 03 and 04 all read them. Remove Contact Tag takes more than one tag, so one step clears all five at entry. The Goal Event FAQ says a contact who has met a goal is not evaluated for it again "within that workflow". I read that as per enrollment, and the test plan proves it on a re-entered contact before a second trial depends on it.',
    },
    {
      title: 'Emails with one job each',
      body: 'Log in and load real jobs, invite the techs, connect QuickBooks and Google Calendar, then an offer to set it up together. All from Leo, so replies reach someone who can help. The welcome gives access to what they signed up for, so it is transactional. The four after it teach and offer help, and like 03 and 04 I treat them as commercial: postal address and unsubscribe link in the footer. They follow the trial clock, weekends included, between 8 AM and 6 PM, and the hand-off to Leo waits for a weekday. No texts: the app signup asks for no text consent, so the phone is for Leo\'s calls.',
    },
    {
      title: 'Settings on purpose',
      body: 'Allow Re-entry on, for companies that come back with a new workspace. The app sends trial.started once per workspace, and GHL refuses re-entry while a contact is active; the trigger starts without a contact, so the test plan proves a repeated event does not double the emails. Because of that rule, a goal that is not met ends the workflow instead of Wait until the goal is met: a contact parked at the goal stays active and would miss onboarding for their next trial. Stop on Response off, so a question about the mobile app reaches Leo without ending the onboarding. No workflow Time Window, because the welcome email has to go the minute they sign up.',
    },
    {
      title: 'Test before publishing',
      body: 'I sent staging events for each scenario below, and ran a test copy of the workflow with the waits cut to minutes. Execution Logs had to show the goal jump, the skipped nudges and the day-5 task. Then I walked Leo through the two tasks he will get.',
    },
  ],
  edgeCases: [
    {
      title: 'Activates mid-sequence',
      body: "The tag lands while the contact is waiting, and the Goal Event pulls them straight to the activated path, so nobody is asked to invite a team they already invited. If it lands after Leo's day-5 task, the task is already in his list, which is why it says to check for the activated tag before calling.",
    },
    {
      title: 'Second trial, old tags',
      body: 'A returning company still carries last trial\'s tags. An old activated would block the goal, which reacts to the tag being added, not to it being there. An old pql-alerted would keep 03 from alerting sales, and an old trial-extended would skip the extension offer in 04. The first steps clear all five, and re-entry is on so the new trial gets onboarding again.',
    },
    {
      title: 'Email DND, at signup or later',
      body: 'GHL skips email steps for a contact with Email DND and runs everything else. At signup the If/Else hands the trial to Leo on day 0, instead of running a sequence nobody receives. If they unsubscribe partway, the remaining emails skip but the day-5 task still reaches Leo. Either way DND stays as it is unless the contact asks.',
    },
    {
      title: 'Already talking to sales',
      body: "Someone who booked a demo first is found by email, so the demo history, their account executive and the trial sit on one record. The emails still come from Leo, and his day-5 task says to check the opportunity first: if an AE owns an open deal, the call is theirs.",
    },
    {
      title: 'Signs during the trial',
      body: "A deal marked Won fires 05 · Sales · Closed-Won to Onboarding, which adds customer and then takes the contact out of 02 and 04 with Remove from Workflow, so Leo's kickoff replaces the trial emails. A self-serve payment does not: 04a · Product · Subscription Created only adds customer and removes trial, because a team that has paid but not dispatched a job still needs the invite and set-up help, and gets no kickoff from 05. Leo's day-5 task says to check for the customer tag first.",
    },
    {
      title: 'New contact, no time zone',
      body: 'The payload carries no time zone, so a contact the webhook creates may have none. GHL documents the fallback: with Contact Timezone selected, a contact without one runs on the account time zone. For email that moves the 8 AM to 6 PM window by a few hours, which does no harm, and this workflow sends no texts.',
    },
  ],
  qa: [
    'Send a staging trial.started for a new email and for one that already exists: one contact each, with name, Company Name, Plan, Trial Ends as a real date and Workspace ID',
    'Send the same event twice while the contact is in the workflow: one enrollment and one welcome email',
    'Fire workspace.activated for a waiting test contact: Execution Logs show the jump to the goal, and no more nudges send',
    'Test copy with minute-long waits and no activation: Leo gets the day-5 task, the offer email sends, and the goal ends the run',
    'Contacts with Email DND and with DND on all channels: no emails, and Leo has a welcome-call task due the next weekday',
    'A finished test contact carrying activated, pql-alerted, pql-tip-sent, trial-extended and trial-expired re-enters: all five are gone, and adding activated again fires the goal on this second enrollment',
    'Mark a test deal Won: Execution Logs show Removed by External Workflow Action, and no more trial emails send',
    'Every link and merge field renders in Gmail and Outlook, the four commercial emails show the postal address and unsubscribe link, and replies land in Conversations for Leo',
  ],
  snippets: [
    {
      title: 'trial.started payload',
      language: 'json',
      code: payload,
      note: "POSTed by the app to this workflow's Inbound Webhook URL when a workspace is created. JSON is the only format the trigger accepts. trial_end carries the trial's last day as MM-DD-YYYY, and event_id lets a run be traced back to the app's own logs.",
    },
    {
      title: 'Create/Update Contact mapping',
      language: 'text',
      code: mapping,
      note: 'The values come from the Inbound Webhook Trigger group of the picker once a Mapping Reference is saved.',
    },
    {
      title: 'workspace.activated payload (feeds 02a)',
      language: 'json',
      code: activationPayload,
      note: "02a · Product · Workspace Activated has its own Inbound Webhook URL. It runs Create/Update Contact on the email, then Add Contact Tag: activated. That tag is what this workflow's goal listens for.",
    },
  ],
  features: [
    'Inbound Webhook (premium)',
    'Mapping Reference',
    'Create/Update Contact',
    'Add Contact Tag',
    'Remove Contact Tag',
    'If/Else',
    'Send Email',
    'Wait · Advance Window',
    'Add Task',
    'Goal Event',
    'Allow Re-entry',
    'Sender Details',
    'Contact Deduplication Preferences',
  ],
};
