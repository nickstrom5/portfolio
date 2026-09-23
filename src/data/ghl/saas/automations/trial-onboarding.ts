import type { Automation, Contact } from '@/lib/ghl/types';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
/** Monday 2 March 2026, 00:00: the sample week the simulator runs in. */
const BASE = Date.UTC(2026, 2, 2);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateOf = (day: number) => new Date(BASE + day * DAY * 60000);

/** MM-DD-YYYY, the format the app sends trial_end in. */
function mdy(min: number): string {
  const d = dateOf(Math.floor(min / DAY));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
}

/** Add Task with Due In 1 day and Skip Weekends on: the next weekday. */
function dueDate(now: number): string {
  let day = Math.floor(now / DAY) + 1;
  while (day % 7 >= 5) day++;
  const d = dateOf(day);
  return `${WEEKDAY[day % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

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

const payload = `{
  "event": "trial.started",
  "event_id": "evt_01JNR3D8Q6ZK4M7T2W9XB5C1HA",
  "occurred_at": "2026-03-03T15:40:12Z",
  "email": "rachel@brightlinehvac.example",
  "first_name": "Rachel",
  "last_name": "Okafor",
  "phone": "+16145550192",
  "company": "Brightline HVAC",
  "workspace_id": "ws_7Q2M9K",
  "plan": "trial",
  "trial_end": "03-17-2026"
}`;

const mapping = `Create/Update Contact field    Value from the Inbound Webhook Trigger group
Email                          {{inboundWebhookRequest.body.email}}
First Name                     {{inboundWebhookRequest.body.first_name}}
Last Name                      {{inboundWebhookRequest.body.last_name}}
Phone                          {{inboundWebhookRequest.body.phone}}
Company Name (standard)        {{inboundWebhookRequest.body.company}}
Plan (custom)                  {{inboundWebhookRequest.body.plan}}
Trial Ends (custom, date)      {{inboundWebhookRequest.body.trial_end}}
Workspace ID (custom)          {{inboundWebhookRequest.body.workspace_id}}

Not mapped: event, event_id, occurred_at. They stay in the
Execution Logs for tracing a run back to the app's event.`;

const activationPayload = `{
  "event": "workspace.activated",
  "event_id": "evt_01JNV7P2K9DQ3F8M4X6RT0B2ZC",
  "occurred_at": "2026-03-05T20:15:03Z",
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
    'Every new trial gets four short, useful emails from the customer success manager. When the app says the team is up and running, the nudges stop and the next email changes.',
  problem:
    'Everyone who started a trial got the same emails on the same days. Owners who had their whole crew on the board by lunchtime were still told to invite their team, and the trials that stalled were only noticed when they expired.',
  solution:
    'The app posts trial.started to GHL, which creates or updates the contact and starts four emails from Leo, the CSM: log in, invite the techs, connect QuickBooks and Google Calendar, then an offer to set it up together. When the app reports activation, a two-step helper workflow tags the contact, and the Goal Event pulls them out of the nudges and onto a what-next email. Anyone still stuck on day 5 becomes a task for Leo, and contacts GHL cannot email go to him on day 0.',
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
      notes: [
        'Allow Re-entry on: a company that comes back for a second trial gets a new workspace and should get onboarding again. GHL does not let a contact re-enter while still active, so a repeated trial.started does not start a second run.',
        'Stop on Response off: a reply like "do my techs need a smartphone?" is a question for Leo, not a reason to drop the rest of onboarding. Replies still land in Conversations.',
        'No workflow Time Window: the welcome email has to go the minute they sign up. The later emails wait inside their own Advance Windows.',
        'Sender Details: From Name Leo Park, From Email leo@crewlo.example, so every reply reaches the person who can help.',
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
          'GHL adds this step after an Inbound Webhook trigger. It updates the contact with this email, or creates one, and maps name, phone, company, plan, trial end and workspace ID from the payload.',
        run: ({ contact, now }) => {
          const p = trialOf(contact);
          const trial_end = mdy(now + 14 * DAY);
          const found = p.existing ? `Found the existing contact for ${contact.email} and updated it` : `No contact with ${contact.email} yet, so it created one`;
          return {
            effect: { fields: { company: p.company, plan: 'trial', trial_end, workspace_id: p.workspace_id } },
            log: `${found}: company ${p.company}, plan trial, trial ends ${trial_end}, workspace ${p.workspace_id}.`,
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
        summary: 'Marks everyone who has started a trial. Smart lists and the other trial workflows filter on it.',
        effect: { addTags: ['trial'] },
      },
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'activated',
        summary:
          'Clears activated left over from an earlier trial. The tag then always means this trial, and Contact Tag Added can fire again for the goal below.',
        run: ({ contact }) => ({
          log: contact.tags.includes('activated')
            ? 'Removed the activated tag from an earlier trial, so this trial has to earn it again and the goal below can fire.'
            : 'No activated tag on the record, so there is nothing to clear.',
        }),
        effect: { removeTags: ['activated'] },
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
                summary: 'Goes the minute they sign up, day or night: they are at the keyboard. One link and one first job.',
                message: {
                  channel: 'email',
                  subject: 'Your Crewlo trial is ready, {{contact.first_name}}',
                  body:
                    "Hi {{contact.first_name}},\n\nYour Crewlo trial is set up. Log in here: {{custom_values.app_url}}\n\nYou have {{custom_values.trial_length}}, and they count most with real work, so start by putting this week's jobs on the dispatch board. Everything else in Crewlo builds on that board.\n\nShort guides for each step are at {{custom_values.help_center}}. Or reply to this email with any question. It comes straight to me.\n\nLeo Park\nCustomer Success, Crewlo",
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
                    "Hi {{contact.first_name}},\n\nCrewlo starts saving time when your techs see their jobs on their phones instead of calling the office for the next address.\n\nTo invite them, open {{custom_values.app_url}} and go to Team > Invite. Add each tech's mobile number or email, and they get a link to the Crewlo app.\n\nThen drag one job onto a tech on the board and ask them to check their phone. That is the moment the trial starts working for you.\n\nLeo",
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
                summary: 'The two integrations that remove double entry, with where to find them.',
                message: {
                  channel: 'email',
                  subject: 'Connect QuickBooks and Google Calendar',
                  body:
                    'Hi {{contact.first_name}},\n\nTwo connections cut out most of the double entry:\n\n- QuickBooks: your customer list comes in once, and finished jobs go back as invoices ready to send.\n- Google Calendar: the office sees the dispatch board in the calendar they already use.\n\nBoth are under Settings > Integrations in {{custom_values.app_url}}. Step-by-step guides: {{custom_values.help_center}}\n\nLeo',
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
                  'Two more days, but this Advance Window resumes Monday to Friday, 9 AM to 5 PM. The next step asks for a reply from Leo, so it waits for a day he is working.',
              },
              {
                id: 'task-leo',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Leo checks in',
                summary:
                  'Assigned to Leo Park, Due In 1 day with Skip Weekends on. The description gives the workspace ID and says to check for the activated tag before reaching out.',
                run: ({ contact, now }) => ({
                  log: `Task for Leo Park, due ${dueDate(now)}: "Trial not activated: ${contact.fields.company}". Workspace ${contact.fields.workspace_id} has no job dispatched yet. The offer email goes out now; if there is no reply by then, call ${contact.phone}.`,
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
                    "Hi {{contact.first_name}},\n\nIt looks like no jobs have gone out to a tech's phone in Crewlo yet. Moving a whole schedule into new software takes time, and I would rather help than send you more tips.\n\nIf it is useful, I will set it up with you on a 20-minute screen share: we load this week's jobs, invite one tech and send them their first job. Reply with two times that suit you and I will send an invite.\n\nLeo Park\nCustomer Success, Crewlo",
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
                  'Contact Tag Added: activated. 02a · Workspace Activated adds the tag when the app reports the first job dispatched to a tech. Reached without it: End this workflow, and 04 · Trial Ending carries on from there.',
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
                    "Hi {{contact.first_name}},\n\nYour first job has gone out to a tech's phone, so the hardest part of switching is behind you.\n\nTwo things worth setting up next:\n\n1. Recurring jobs for maintenance contracts and repeat visits, so they land on the board without anyone retyping them.\n2. QuickBooks, if you have not connected it yet, so finished jobs turn into invoices.\n\nAnd one question: what would stop you from running next week's schedule in Crewlo? Just reply. I read every answer.\n\nLeo",
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
                'None of the onboarding emails could send, so a person takes over on day 0. Assigned to Leo Park, Due In 1 day with Skip Weekends on. DND stays on unless the contact asks for it to change.',
              run: ({ contact, now }) => ({
                log: `Task for Leo Park, due ${dueDate(now)}: "New trial, email is off: ${contact.firstName} ${contact.lastName}, ${contact.fields.company}". Welcome them by phone at ${contact.phone} and check the DND tab for why email is off.`,
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
      summary: 'Rachel starts a trial after her demo. Her techs get their first jobs on Thursday afternoon, and the remaining nudges never send.',
      start: DAY + 10 * 60 + 40,
      contact: { source: 'Website demo form', fields: { company: 'Brightline HVAC', company_size: '11-50', job_role: 'Operations or dispatch' } },
      events: [{ at: 2 * DAY + 4 * 60 + 35, type: 'tag_added', value: 'activated', label: 'Added by 02a: the app reported her first job dispatched to a tech' }],
      expect: { outcome: 'goal', visits: ['upsert', 'if-email:0', 'email-welcome', 'email-invite', 'goal-activated', 'email-next'], tags: ['trial', 'activated'] },
    },
    {
      id: 'never',
      label: 'Never activates',
      summary: 'Marcus signs up on Wednesday morning and never gets a job onto the board. Day 5 is a Monday, so Leo gets the task at 9 AM.',
      start: 2 * DAY + 8 * 60 + 50,
      contact: {
        firstName: 'Marcus',
        lastName: 'Hale',
        email: 'marcus@haleplumbing.example',
        phone: '(512) 555-0134',
        timezone: 'America/Chicago',
        source: 'Crewlo app signup',
      },
      events: [],
      expect: { outcome: 'ended', visits: ['email-connect', 'wait-d5', 'task-leo', 'email-offer', 'wait-grace', 'goal-activated'], tags: ['trial'] },
    },
    {
      id: 'fast',
      label: 'Activates the same day',
      summary: 'Dana signs up after lunch and has a tech on a job by 4:50 PM. She gets the welcome email, then the what-next email the following afternoon, and nothing in between.',
      start: 3 * DAY + 13 * 60 + 30,
      contact: {
        firstName: 'Dana',
        lastName: 'Whitfield',
        email: 'dana@whitfieldclean.example',
        phone: '(919) 555-0168',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
      },
      events: [{ at: 3 * 60 + 20, type: 'tag_added', value: 'activated', label: 'Added by 02a: first job dispatched, 3 hours 20 minutes in' }],
      expect: { outcome: 'goal', visits: ['email-welcome', 'goal-activated', 'wait-next', 'email-next'], tags: ['trial', 'activated'] },
    },
    {
      id: 'email-dnd',
      label: 'Email DND',
      summary: 'Greg asked to be taken off Crewlo emails last fall, so Email DND is on. He starts a trial on Friday evening, and Leo gets a task for Monday instead of an email sequence nobody would receive.',
      start: 4 * DAY + 16 * 60 + 45,
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
      expect: { outcome: 'completed', visits: ['tag-trial', 'if-email:else', 'task-dnd'], tags: ['trial'] },
    },
    {
      id: 'second-trial',
      label: 'Second trial, old tag',
      summary:
        "Owen trialed last year and still carries last year's activated tag. It comes off at entry, so his new activation counts. He signs up on Sunday night, so the day-1 email waits for Tuesday morning.",
      start: 6 * DAY + 20 * 60 + 15,
      contact: {
        firstName: 'Owen',
        lastName: 'Brooks',
        email: 'owen@brookselectric.example',
        phone: '(303) 555-0151',
        timezone: 'America/Denver',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated'],
        fields: { company: 'Brooks Electric', trial_end: '04-21-2025', workspace_id: 'ws_2DK6PM' },
      },
      events: [{ at: 9 * DAY + 11 * 60 + 30 - (6 * DAY + 20 * 60 + 15), type: 'tag_added', value: 'activated', label: 'Added by 02a: first job dispatched in the new workspace' }],
      expect: { outcome: 'goal', visits: ['untag', 'wait-d1', 'email-invite', 'goal-activated', 'email-next'], tags: ['trial', 'activated'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Plan', key: 'plan', type: 'Single line', note: 'The app sends "trial" here. Single line, so a new plan name never fails a dropdown match.' },
      { name: 'Trial Ends', key: 'trial_end', type: 'Date', note: 'Sent as MM-DD-YYYY, a format GHL documents for writing values into Date fields' },
      { name: 'Workspace ID', key: 'workspace_id', type: 'Single line', note: "The app's ID for the workspace. Workflows that call the app back send it." },
    ],
    tags: [
      { name: 'trial', note: 'Has started a trial. Added here from trial.started' },
      { name: 'activated', note: 'Activated this trial. Added by 02a · Workspace Activated; removed here when a new trial starts' },
    ],
    customValues: [
      { name: 'App URL', key: 'app_url', value: 'app.crewlo.example' },
      { name: 'Help Center', key: 'help_center', value: 'help.crewlo.example' },
      { name: 'Trial Length', key: 'trial_length', value: '14 days' },
    ],
  },
  build: [
    {
      title: 'Define activation with the product team',
      body: "Hana and Crewlo's product team agreed on one rule: the first job dispatched to a technician's phone. The app owns that rule and sends workspace.activated once per workspace. GHL does not try to infer activation from email opens or clicks.",
    },
    {
      title: 'A payload contract, in writing',
      body: 'One webhook URL per event. Flat JSON with snake_case keys, because GHL does not accept keys with spaces. Email on every event, because Create/Update Contact needs an email or phone to find the contact. trial_end in MM-DD-YYYY, a format GHL documents for Date fields, instead of an ISO timestamp.',
    },
    {
      title: 'Data model and deduplication',
      body: 'Custom fields for Plan, Trial Ends and Workspace ID; company goes to the standard Company Name field. Two tags, trial and activated. Under Contact Deduplication Preferences, Allow Duplicate Contact is off and existing contacts are found by Email. Someone who requested a demo and then starts a trial should stay on one record, and the test plan checks exactly that.',
    },
    {
      title: 'Trigger and mapping',
      body: "Inbound Webhook, then a test event from the app's staging environment, Test Trigger, and that request saved as the Mapping Reference. GHL adds Create/Update Contact after the trigger, and I mapped each field from the Inbound Webhook Trigger group in the picker. When the payload changes, the Mapping Reference has to be picked again, so that is in the developers' runbook.",
    },
    {
      title: 'One goal, fed by a two-step helper',
      body: 'GHL allows one Goal Event per workflow, and none of its goal types is a webhook. So 02a · Product · Workspace Activated takes workspace.activated, finds the contact with Create/Update Contact and adds the activated tag. The goal here is Contact Tag Added: activated. Because that only fires when the tag is added, the first steps remove any activated tag left from an earlier trial.',
    },
    {
      title: 'Emails with one job each',
      body: 'Log in and load real jobs, invite the techs, connect QuickBooks and Google Calendar, then an offer to set it up together. All from Leo, the CSM, so replies reach someone who can help. The automated emails follow the trial clock, weekends included, between 8 AM and 6 PM. The hand-off to Leo waits for a weekday.',
    },
    {
      title: 'Settings on purpose',
      body: 'Allow Re-entry on, for companies that come back with a new workspace. GHL still refuses re-entry while a contact is active, so a repeated event does not double the emails. Stop on Response off, so a question about the mobile app reaches Leo without ending the onboarding. No workflow Time Window, because the welcome email has to go the minute they sign up.',
    },
    {
      title: 'Test before publishing',
      body: 'I sent staging events for each scenario below, and ran a test copy of the workflow with the waits cut to minutes. Execution Logs had to show the goal jump, the skipped nudges and the day-5 task. Then I walked Leo through the two tasks he will get.',
    },
  ],
  edgeCases: [
    {
      title: 'Activates mid-sequence',
      body: 'The tag lands while the contact is waiting, and the Goal Event pulls them straight to the activated path. The remaining nudges never send, so nobody is asked to invite a team they already invited.',
    },
    {
      title: 'Second trial, old tag',
      body: 'Contact Tag Added only fires when a tag is added. A returning company still carries activated from last year, so its new activation would never reach the goal. The first steps remove the old tag, and re-entry is on so the new trial gets onboarding again.',
    },
    {
      title: 'Email DND',
      body: 'GHL skips email steps for a contact with Email DND and runs everything else. A sequence that skips every email helps nobody, so the If/Else hands these trials to Leo on day 0. His task says to leave DND alone unless the contact asks.',
    },
    {
      title: 'Starts a trial after a demo',
      body: 'Create/Update Contact finds them by email and updates the same record, so the demo history and the new trial sit on one contact.',
    },
    {
      title: 'Activates after Leo has his task',
      body: 'The task is already in his list, so its description says to check for the activated tag first. The contact still jumps to the goal and gets the what-next email.',
    },
    {
      title: 'The URL leaks or the payload changes',
      body: 'A leaked URL means deleting the trigger and adding a new one, which issues a new URL for the app to use. A changed payload means picking the Mapping Reference again. Both are in the developers\' runbook.',
    },
  ],
  qa: [
    'Send a staging trial.started: the contact shows name, company, plan, Trial Ends as a real date and Workspace ID',
    'Send it for an email that already exists: one contact, updated, no duplicate',
    'Send the same event twice while the contact is in the workflow: one enrollment and one welcome email',
    'Fire workspace.activated for a waiting test contact: Execution Logs show the jump to the goal and no more nudges',
    'Test copy with minute-long waits and no activation: Leo gets the day-5 task, the offer email sends, and the goal ends the run',
    'Contact with Email DND: no emails, and Leo has a task due the next weekday',
    'Contact with an old activated tag: the tag is gone after entry, and adding it again fires the goal',
    'Every link and merge field renders in Gmail and Outlook, and replies land in Conversations',
  ],
  snippets: [
    {
      title: 'trial.started payload',
      language: 'json',
      code: payload,
      note: "POSTed by the app to this workflow's Inbound Webhook URL when a workspace is created. JSON is the only format the trigger accepts. event_id is there so a run can be traced back to the app's own logs.",
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
      note: '02a · Product · Workspace Activated has its own Inbound Webhook URL. It runs Create/Update Contact on the email, then Add Contact Tag: activated. That tag is what this workflow\'s goal listens for.',
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
    'Contact Deduplication Preferences',
  ],
};
