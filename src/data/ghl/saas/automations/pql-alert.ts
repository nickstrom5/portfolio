import type { Automation, Contact } from '@/lib/ghl/types';
import { business } from '../business';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week (Mon Mar 2, 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const users = business.env.users;
const stages = business.pipeline.stages;
const ownerOf = (c: Contact) => (c.assignedTo && users[c.assignedTo]?.name) || 'the owner';
const money = (v: number) => `$${v.toLocaleString('en-US')}`;

/** 01 gives a demo request's card to the rep for its segment, so that is who owns an open card from a demo. */
const DEMO_REP: Record<string, string> = { enterprise: 'aisha', 'mid-market': 'ben', small: 'priya' };

/**
 * Add Owner to Opportunity. It acts on the card Find Opportunity put in
 * context, and GHL skips it when there is none. Owners are decoupled in this
 * sub-account (05 relies on that), so Assign To User never moves the card.
 */
function cardOwner(c: Contact, who: 'aisha' | 'ben') {
  const name = users[who].name;
  if (c.opportunity?.status !== 'open') {
    return { log: `No card in context yet, so GHL skips this step. Create Opportunity below gives the new card the contact's owner, ${name}.` };
  }
  const was = DEMO_REP[String(c.fields.segment ?? '')];
  if (was === who) {
    return { log: `The card is already ${name}'s, since 01 gave it to the rep for its segment, so nothing changes. The step is there for cards that are not, like a small team's card from Priya's live demo.` };
  }
  return { log: `Card owner changes${was ? ` from ${users[was].name}` : ''} to ${name}, the same as the contact. Assign To User alone would have left it where it was.` };
}

/** What the app sends in usage.snapshot, beyond the owner's email. */
interface Snapshot {
  workspace_id: string;
  plan: string;
  seats_invited: number;
  jobs_scheduled: number;
  integrations_connected: number;
  days_active: number;
}

/**
 * The snapshot each test contact's workspace sends, by email and day of the
 * sample week. Totals for the trial so far, counted up to midnight.
 */
const SNAPSHOTS: Record<string, Snapshot> = {
  'carlos@harlowmech.example|1': { workspace_id: 'ws_4TN6RC', plan: 'trial', seats_invited: 40, jobs_scheduled: 188, integrations_connected: 1, days_active: 5 },
  'carlos@harlowmech.example|2': { workspace_id: 'ws_4TN6RC', plan: 'trial', seats_invited: 44, jobs_scheduled: 231, integrations_connected: 2, days_active: 6 },
  'megan@doyleplumbing.example|5': { workspace_id: 'ws_6PB3HX', plan: 'trial', seats_invited: 11, jobs_scheduled: 71, integrations_connected: 0, days_active: 5 },
  'derek@lawsongaragedoor.example|0': { workspace_id: 'ws_2WQ9LM', plan: 'trial', seats_invited: 0, jobs_scheduled: 64, integrations_connected: 1, days_active: 6 },
  'sofia@marchettipools.example|3': { workspace_id: 'ws_8KD5JT', plan: 'trial', seats_invited: 1, jobs_scheduled: 18, integrations_connected: 0, days_active: 3 },
};

const snapshotOf = (c: Contact, now: number): Snapshot =>
  SNAPSHOTS[`${c.email}|${Math.floor(now / DAY)}`] ?? { workspace_id: String(c.fields.workspace_id ?? 'ws_TEST01'), plan: 'trial', seats_invited: 3, jobs_scheduled: 22, integrations_connected: 1, days_active: 4 };

const TIPS: Record<string, string> = {
  team: 'Invite your techs from Team > Invite. Each of them then sees their own jobs on their phone, and the office stops fielding calls for the next address.',
  jobs: 'Put a full week of real jobs on the dispatch board. A trial only shows what Crewlo saves when it runs your actual schedule.',
  integrations: 'Connect QuickBooks or Google Calendar under Settings > Integrations, so nobody types the same job in twice.',
  none: 'No gaps: the team, the jobs and both integrations are all in place.',
};

/** Same logic as the Custom Code step below, so the simulator scores exactly like the build. */
function score(p: Snapshot, seatsNow?: string | number | boolean) {
  const invited = Number(p.seats_invited) || 0;
  const jobs = Number(p.jobs_scheduled) || 0;
  const integrations = Number(p.integrations_connected) || 0;
  const days = Number(p.days_active) || 0;
  const parts: Record<string, number> = {
    team: Math.min(invited * 5, 35),
    jobs: Math.min(Math.floor(jobs / 2), 30),
    integrations: Math.min(integrations * 10, 20),
  };
  const habit = Math.min(days * 3, 15);
  const isTrial = String(p.plan || '').toLowerCase() === 'trial';
  const pql_score = isTrial ? parts.team + parts.jobs + parts.integrations + habit : 0;
  const max: Record<string, number> = { team: 35, jobs: 30, integrations: 20 };
  const order = ['team', 'jobs', 'integrations'];
  const weakest = order.every((k) => parts[k] === max[k]) ? 'none' : order.reduce((a, b) => (parts[b] / max[b] < parts[a] / max[a] ? b : a));
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const seats = isTrial ? invited + 1 : Number(seatsNow) || invited + 1;
  return {
    parts: { ...parts, habit } as Record<string, number>,
    out: {
      pql_score,
      seats,
      annual_value: seats * 29 * 12,
      trial_usage: `${plural(seats, 'seat')}, ${plural(jobs, 'job')} scheduled, ${integrations} of 2 integrations, ${plural(days, 'active day')}`,
      weakest,
      next_step: TIPS[weakest],
    },
  };
}

const payload = `{
  "event": "usage.snapshot",
  "event_id": "evt_01JNXC2M8T4R6K9P3WQ5ZB7D1E",
  "occurred_at": "2026-03-03T12:02:07Z",
  "email": "carlos@harlowmech.example",
  "workspace_id": "ws_4TN6RC",
  "plan": "trial",
  "seats_invited": 40,
  "jobs_scheduled": 188,
  "integrations_connected": 1,
  "days_active": 5
}`;

const scoreCode = `// Custom Code step, JavaScript. Properties added in the step: five picked
// from the Inbound Webhook trigger's Body values, one from the contact.
//   seats_invited          = {{inboundWebhookRequest.body.seats_invited}}
//   jobs_scheduled         = {{inboundWebhookRequest.body.jobs_scheduled}}
//   integrations_connected = {{inboundWebhookRequest.body.integrations_connected}}
//   days_active            = {{inboundWebhookRequest.body.days_active}}
//   plan                   = {{inboundWebhookRequest.body.plan}}
//   seats_now              = {{contact.seats}}
// GHL wraps this in an async function and reads the result from \`output\`.
const num = (v) => Number(v) || 0;
const invited = num(inputData.seats_invited);
const jobs = num(inputData.jobs_scheduled);
const integrations = num(inputData.integrations_connected);
const days = num(inputData.days_active);

// Weights agreed with sales. Team size counts most: a sales call
// only pays for itself on a team big enough to need one. With nobody
// invited the most a trial can score is 65, so a solo trial never pages sales.
const parts = {
  team: Math.min(invited * 5, 35),               // 7+ people invited
  jobs: Math.min(Math.floor(jobs / 2), 30),      // 60+ jobs scheduled
  integrations: Math.min(integrations * 10, 20), // QuickBooks and Google Calendar
};
const habit = Math.min(days * 3, 15);            // active on 5+ days

// Only trials score. A workspace that has bought or expired never pages sales.
const isTrial = String(inputData.plan || '').toLowerCase() === 'trial';
const score = isTrial ? parts.team + parts.jobs + parts.integrations + habit : 0;

// The weakest of the three things a tip can fix, as a share of its maximum.
// Ties go to the team, then jobs: the order they matter in.
const max = { team: 35, jobs: 30, integrations: 20 };
const order = ['team', 'jobs', 'integrations'];
const weakest = order.every((k) => parts[k] === max[k])
  ? 'none'
  : order.reduce((a, b) => (parts[b] / max[b] < parts[a] / max[a] ? b : a));

const tips = {
  team: 'Invite your techs from Team > Invite. Each of them then sees their own jobs on their phone, and the office stops fielding calls for the next address.',
  jobs: 'Put a full week of real jobs on the dispatch board. A trial only shows what Crewlo saves when it runs your actual schedule.',
  integrations: 'Connect QuickBooks or Google Calendar under Settings > Integrations, so nobody types the same job in twice.',
  none: 'No gaps: the team, the jobs and both integrations are all in place.',
};

const plural = (k, w) => \`\${k} \${w}\${k === 1 ? '' : 's'}\`;
// People invited plus the owner, who is a paid seat too. Outside a trial,
// keep the number the AE set before marking the deal Won (05).
const seats = isTrial ? invited + 1 : num(inputData.seats_now) || invited + 1;
output = {
  pql_score: score,
  seats: seats,
  annual_value: seats * 29 * 12, // list price: $29 per user per month
  trial_usage: \`\${plural(seats, 'seat')}, \${plural(jobs, 'job')} scheduled, \${integrations} of 2 integrations, \${plural(days, 'active day')}\`,
  weakest: weakest,
  next_step: tips[weakest],
};`;

const slackPayload = `{
  "text": "PQL: {{contact.company_name}}, score {{contact.pql_score}}, owner {{user.name}}",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "PQL: {{contact.company_name}} ({{contact.pql_score}}/100)" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Contact*\\n{{contact.name}}" },
        { "type": "mrkdwn", "text": "*Owner*\\n{{user.name}}" },
        { "type": "mrkdwn", "text": "*Usage*\\n{{contact.trial_usage}}" },
        { "type": "mrkdwn", "text": "*At list price*\\n{{contact.seats}} seats at {{custom_values.price_per_seat}}" },
        { "type": "mrkdwn", "text": "*Trial ends*\\n{{contact.trial_end}}" },
        { "type": "mrkdwn", "text": "*Workspace*\\n{{contact.workspace_id}}" }
      ]
    }
  ]
}`;

export const pqlAlert: Automation = {
  id: 'pql-alert',
  number: '03',
  name: 'PQL alert',
  kicker: 'Product-qualified leads',
  tagline:
    'Once a day the app reports how each trial is being used. When a trial starts to look like a buyer, the right AE hears about it once, with the numbers, and a trial nobody at Crewlo is talking to yet gets one plain email from them. Trials that are close get one useful tip instead.',
  problem:
    'Sales could not tell which trials were being used for real. A 40-person HVAC company running its whole schedule in Crewlo looked the same in the CRM as someone who signed up and never came back, so the AEs either called every trial or waited for trials to call them.',
  solution:
    'The app posts one usage snapshot per trial workspace every morning. Custom Code turns people invited, jobs scheduled, integrations and active days into a product score from 0 to 100 and saves it on the contact. At 70 or more the trial goes to sales exactly once: the right AE by segment, a post in #pql with the numbers, and a deal on the New Business board. A trial that already has an open deal keeps that card, which moves to Trial Sales-Assist and to the AE along with the contact, and gets no automated email: someone in sales has already talked to them. A trial without one gets a new card in Trial Sales-Assist and a plain email from the AE. Between 40 and 69, Leo sends one tip aimed at the weakest signal. Below 40 nothing happens, and 02 · Trial Onboarding keeps doing its job.',
  workflow: {
    name: '03 · Product · PQL Alert',
    folder: 'Product',
    triggers: [
      {
        title: 'Inbound Webhook',
        filters: ['Its own URL, called by the app once a day per trial workspace (usage.snapshot)', 'Mapping Reference: a saved usage.snapshot request'],
        label: 'Inbound Webhook (usage.snapshot)',
      },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: false,
      timezone: 'contact',
      timeWindow: { start: '09:00', end: '17:00', days: ALL_WEEK },
      senderName: 'Leo Park, Crewlo',
      notes: [
        'Allow Re-entry on: every trial sends a snapshot every day, and each one has to be scored. The pql-alerted tag, not this setting, is what stops a second alert.',
        'Stop on Response off: the only message to the contact is the last step of its branch, so there is nothing left for a reply to stop.',
        "Time Window 9 AM to 5 PM in the contact's time zone. GHL documents that it holds communication actions such as emails, and not tags, field updates or opportunities. So the tag, the owner, the card and the Slack post happen at about 7 AM when the snapshot lands, and the AE has read the numbers before the prospect sees the email. The test plan confirms the Custom Webhook is not held.",
        'Include Days is every day, not weekdays only. Field-service owners run crews and do their admin on Saturdays, and the trial clock runs through the weekend. It also keeps holds short: GHL does not let a contact re-enter while still active, so a warm trial held from Saturday to Monday could miss the snapshot that makes it a PQL. The test plan checks how a second snapshot behaves during a hold.',
        "Sender Details: From Name Leo Park, From Email leo@crewlo.example, for the tip email. The AE email overrides both with the assigned user's name and email.",
        'Inbound Webhook, Custom Code and Custom Webhook are premium, billed per execution: two per trial per day, plus one Slack post per alert. Find Opportunity and Add Owner to Opportunity are standard actions.',
      ],
    },
    steps: [
      {
        id: 'upsert',
        kind: 'action',
        action: 'update_field',
        title: 'Create/Update Contact',
        label: 'Map the snapshot',
        summary:
          'GHL opens this step when the Inbound Webhook trigger is saved. It finds the workspace owner by email (02 created them at trial.started) and refreshes Plan and Workspace ID. It is also what gives the run a contact: without it the tag, the owner and the deal would have nothing to attach to. The counts go to the next step, not onto the contact.',
        run: ({ contact, now }) => {
          const p = snapshotOf(contact, now);
          return {
            effect: { fields: { plan: p.plan, workspace_id: p.workspace_id } },
            log: `Found ${contact.firstName} ${contact.lastName} by ${contact.email} and refreshed Plan (${p.plan}) and Workspace ID (${p.workspace_id}).`,
          };
        },
        code: { language: 'json', source: payload },
      },
      {
        id: 'score',
        kind: 'action',
        action: 'custom_code',
        title: 'Custom Code',
        label: 'Product score',
        summary:
          'Premium. Scores the trial 0 to 100 from people invited, jobs scheduled, integrations and active days, works out seats and the annual value at list price, and picks the weakest signal and its tip. A workspace not on the trial plan scores 0 and keeps its Seats.',
        run: ({ contact, now }) => {
          const { parts, out } = score(snapshotOf(contact, now), contact.fields.seats);
          return {
            vars: out,
            log: `Returned pql_score ${out.pql_score} (team ${parts.team}, jobs ${parts.jobs}, integrations ${parts.integrations}, active days ${parts.habit}), seats ${out.seats}, annual_value ${out.annual_value} and weakest "${out.weakest}".`,
          };
        },
        code: { language: 'javascript', source: scoreCode },
      },
      {
        id: 'save',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Save score and usage',
        summary:
          'Dynamic Values from the Custom Code output into Product Score, Seats, Trial Usage and Next Step. Runs on every snapshot, alerted or not, so the AE always sees current usage on the contact.',
        run: ({ contact, vars }) => {
          const was = (k: string) => (contact.fields[k] !== undefined && contact.fields[k] !== vars[k] ? ` (was ${contact.fields[k]})` : '');
          const tip = vars.weakest === 'none' ? 'says there are no gaps left' : `holds the ${vars.weakest} tip`;
          return {
            effect: { fields: { pql_score: vars.pql_score, seats: vars.seats, trial_usage: vars.trial_usage, next_step: vars.next_step } },
            log: `Product Score ${vars.pql_score}${was('pql_score')}, Seats ${vars.seats}${was('seats')}, Trial Usage "${vars.trial_usage}". Next Step ${tip}.`,
          };
        },
      },
      {
        id: 'if-alerted',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Already with sales?',
        branches: [
          {
            label: 'Already alerted',
            when: { type: 'tag', has: 'pql-alerted' },
            nodes: [
              {
                id: 'end-alerted',
                kind: 'end',
                title: 'End',
                summary:
                  "The branch ends here, with a Sticky Note saying why: sales already has this trial. Today's numbers are on the contact, so the AE's view stays current, and nothing else runs: no second Slack post, no second deal, no email.",
              },
            ],
          },
        ],
        otherwise: {
          label: 'Not alerted yet',
          nodes: [
            {
              id: 'if-score',
              kind: 'ifelse',
              title: 'If/Else',
              label: 'How warm is the trial?',
              branches: [
                {
                  label: 'PQL: 70 or more',
                  when: { type: 'field', key: 'pql_score', op: 'gte', value: 70, label: 'Product Score is greater than or equal to 70' },
                  nodes: [
                    {
                      id: 'tag-pql',
                      kind: 'action',
                      action: 'add_tag',
                      title: 'Add Contact Tag',
                      label: 'pql-alerted',
                      summary: 'The very first step of this path, so even if a later step fails, the guard above holds and sales is never alerted twice.',
                      effect: { addTags: ['pql-alerted'] },
                    },
                    {
                      id: 'find-opp',
                      kind: 'ifelse',
                      title: 'Find Opportunity',
                      label: 'Open deal already?',
                      branches: [
                        {
                          label: 'Opportunity Found',
                          when: { type: 'all', label: 'Latest opportunity in New Business with Status Open', of: [{ type: 'opportunity', status: 'open' }] },
                          nodes: [
                            {
                              id: 'update-opp',
                              kind: 'action',
                              action: 'update_opportunity',
                              title: 'Update Opportunity',
                              label: 'Trial Sales-Assist, never back',
                              summary:
                                'The card Find Opportunity picked moves to Trial Sales-Assist. Allow Opportunity to Move to Any Previous Stage is off, so a card at Demo Held or later stays where the AE put it. Value is left alone, because the AE may have set it after discovery.',
                              run: ({ contact }) => {
                                const now = contact.opportunity?.stage ?? '';
                                if (stages.indexOf(now) > stages.indexOf('Trial Sales-Assist')) {
                                  return { log: `The card is already at ${now}, and moving back is off, so it stays there with its value.` };
                                }
                                return {
                                  effect: { opportunity: { pipeline: 'New Business', stage: 'Trial Sales-Assist' } },
                                  log: `Moved the card from ${now} to Trial Sales-Assist.`,
                                };
                              },
                            },
                            {
                              id: 'goto-route',
                              kind: 'goto',
                              title: 'Go To',
                              target: 'if-segment',
                              summary: 'Joins the routing with this card still in context, so Add Owner to Opportunity can hand it to the AE along with the contact.',
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'Opportunity Not Found',
                        nodes: [
                          {
                            id: 'if-segment',
                            kind: 'ifelse',
                            title: 'If/Else',
                            label: 'Which AE?',
                            branches: [
                              {
                                label: 'Enterprise',
                                when: { type: 'field', key: 'segment', op: 'eq', value: 'enterprise', label: 'Segment is enterprise' },
                                nodes: [
                                  {
                                    id: 'assign-aisha',
                                    kind: 'action',
                                    action: 'assign_user',
                                    title: 'Assign To User',
                                    label: 'Aisha Rahman',
                                    summary: 'Enterprise AE, one named user. Only Apply to Unassigned Contacts is off, so an account sitting with the SDR moves to the AE.',
                                    run: ({ contact }) => {
                                      if (contact.assignedTo === 'aisha') return { log: "Already Aisha Rahman's from the demo, so the owner stays the same." };
                                      const prev = contact.assignedTo && users[contact.assignedTo]?.name;
                                      return { effect: { assignTo: 'aisha' }, log: `Assigned to Aisha Rahman${prev ? `, taking over from ${prev}` : ''}.` };
                                    },
                                  },
                                  {
                                    id: 'owner-aisha',
                                    kind: 'action',
                                    action: 'update_opportunity',
                                    title: 'Add Owner to Opportunity',
                                    label: 'Aisha Rahman',
                                    summary:
                                      "User Aisha Rahman, Only Apply to Unassigned Opportunities off. Owners are decoupled in this sub-account, so Assign To User moves only the contact; this moves the card Find Opportunity picked. With no card in context, GHL skips it.",
                                    run: ({ contact }) => cardOwner(contact, 'aisha'),
                                  },
                                  {
                                    id: 'goto-slack',
                                    kind: 'goto',
                                    title: 'Go To',
                                    target: 'slack',
                                    summary: "Joins Ben's path at the #pql post, so the post, the deal check and the email are built once and read the same for both AEs.",
                                  },
                                ],
                              },
                            ],
                            otherwise: {
                              label: 'Mid-market, small or no segment',
                              nodes: [
                                {
                                  id: 'assign-ben',
                                  kind: 'action',
                                  action: 'assign_user',
                                  title: 'Assign To User',
                                  label: 'Ben Carter',
                                  summary:
                                    'Mid-market AE, and the owner for self-serve trials that never filled in the demo form. Only Apply to Unassigned Contacts is off here too, so a small team that Priya sent to the live demo moves to Ben once it grows.',
                                  run: ({ contact }) => {
                                    if (contact.assignedTo === 'ben') return { log: "Already Ben Carter's, so the owner stays the same." };
                                    const prev = contact.assignedTo && users[contact.assignedTo]?.name;
                                    return { effect: { assignTo: 'ben' }, log: `Assigned to Ben Carter${prev ? `, taking over from ${prev}` : ''}.` };
                                  },
                                },
                                {
                                  id: 'owner-ben',
                                  kind: 'action',
                                  action: 'update_opportunity',
                                  title: 'Add Owner to Opportunity',
                                  label: 'Ben Carter',
                                  summary:
                                    "User Ben Carter, Only Apply to Unassigned Opportunities off. A small team's card from Priya's live demo moves to Ben with the contact; a mid-market card is already his. With no card in context, GHL skips it.",
                                  run: ({ contact }) => cardOwner(contact, 'ben'),
                                },
                                {
                                  id: 'slack',
                                  kind: 'action',
                                  action: 'webhook',
                                  title: 'Custom Webhook',
                                  label: 'Post to #pql',
                                  summary:
                                    'Premium. Event CUSTOM, Method POST, Content-Type application/json, Block Kit in the Raw Body, to a Slack incoming webhook for #pql. Score, usage, seats at list price, trial end and the owner. No email or phone: more people read the channel than work the deal.',
                                  message: {
                                    channel: 'slack',
                                    to: '#pql',
                                    subject: 'PQL: {{contact.company_name}}, score {{contact.pql_score}}',
                                    body: '{{contact.name}}, {{contact.company_name}}\nOwner: {{user.name}}\nUsage: {{contact.trial_usage}}\nAt list price: {{contact.seats}} seats at {{custom_values.price_per_seat}}\nTrial ends: {{contact.trial_end}}\nWorkspace: {{contact.workspace_id}}',
                                  },
                                  code: { language: 'json', source: slackPayload },
                                },
                                {
                                  id: 'find-new',
                                  kind: 'ifelse',
                                  title: 'Find Opportunity',
                                  label: 'Deal to create?',
                                  branches: [
                                    {
                                      label: 'Opportunity Found',
                                      when: { type: 'all', label: 'Latest opportunity in New Business with Status Open', of: [{ type: 'opportunity', status: 'open' }] },
                                      nodes: [
                                        {
                                          id: 'end-has-deal',
                                          kind: 'end',
                                          title: 'End',
                                          summary:
                                            "The branch ends here, with a Sticky Note saying why: this trial came in through a demo request, its card has been moved and handed to the AE, and someone in sales has already talked to them. The AE follows up in person after the #pql post; an automated hello to someone they have met would read as one.",
                                        },
                                      ],
                                    },
                                  ],
                                  otherwise: {
                                    label: 'Opportunity Not Found',
                                    nodes: [
                                      {
                                        id: 'create-opp',
                                        kind: 'action',
                                        action: 'create_opportunity',
                                        title: 'Create Opportunity',
                                        label: 'Trial Sales-Assist deal',
                                        summary:
                                          "New Business › Trial Sales-Assist, named after the company and seat count, source PQL, Opportunity Value from the code's annual_value (seats × $29 × 12). It runs after Assign To User, so the new card starts with the AE as its owner. Duplicate Opportunity is on here on purpose: this step only runs when there is no open card, and with it off an old Lost card would block the new one.",
                                        run: ({ contact, vars }) => {
                                          const company = String(contact.fields.company_name ?? contact.fields.company ?? `${contact.firstName} ${contact.lastName}`);
                                          const value = Number(vars.annual_value);
                                          const name = `${company} · ${vars.seats} seats`;
                                          const old = contact.opportunity ? ` The ${contact.opportunity.status} card from before stays as it is.` : '';
                                          return {
                                            effect: { opportunity: { pipeline: 'New Business', stage: 'Trial Sales-Assist', status: 'open', value, name } },
                                            log: `New deal "${name}" in New Business › Trial Sales-Assist, value ${money(value)} (${vars.seats} seats × $29 × 12), owner ${ownerOf(contact)}.${old}`,
                                          };
                                        },
                                      },
                                      {
                                        id: 'email-ae',
                                        kind: 'action',
                                        action: 'send_email',
                                        title: 'Send Email',
                                        label: 'Hello from the AE',
                                        summary:
                                          "Only for a trial with no open deal, usually a self-serve signup nobody in sales has talked to. From Name and From Email set to the assigned user, so it comes from Aisha or Ben and the reply reaches them. Plain text, one link, no ask beyond 'reply if it helps'. The Time Window holds it until 9 AM, contact time.",
                                        message: {
                                          channel: 'email',
                                          subject: 'Your Crewlo trial, and a quick hello',
                                          body: "Hi {{contact.first_name}},\n\nI'm {{user.first_name}}, one of the account executives at Crewlo. Your team is up and running in Crewlo, so I wanted to introduce myself in case I can save you some time.\n\nTeams at this stage often have questions about moving the rest of the crew over, how billing works ({{custom_values.price_per_seat}}, only for the users you keep), or what support looks like after the trial. If any of that is on your mind, reply here, or pick a time that suits you: {{trigger_link.book_demo}}\n\nIf you would rather keep going on your own, that is completely fine.\n\n{{user.name}}\n{{location.name}} | {{location.phone}}\n{{location.full_address}}",
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
                    },
                  ],
                },
                {
                  label: 'Warming: 40 to 69',
                  when: {
                    type: 'all',
                    label: 'Product Score is greater than or equal to 40 and less than 70, and contact tag does not include pql-tip-sent',
                    of: [
                      { type: 'field', key: 'pql_score', op: 'gte', value: 40 },
                      { type: 'field', key: 'pql_score', op: 'lt', value: 70 },
                      { type: 'no_tag', has: 'pql-tip-sent' },
                    ],
                  },
                  nodes: [
                    {
                      id: 'tag-tip',
                      kind: 'action',
                      action: 'add_tag',
                      title: 'Add Contact Tag',
                      label: 'pql-tip-sent',
                      summary: "One tip per trial, tagged before the email so a failed send cannot lead to a second one. Tomorrow's snapshot for a trial still in the 40s, 50s or 60s falls through to Nothing today instead of getting another email.",
                      effect: { addTags: ['pql-tip-sent'] },
                    },
                    {
                      id: 'email-tip',
                      kind: 'action',
                      action: 'send_email',
                      title: 'Send Email',
                      label: 'Tip for the weakest signal',
                      summary: 'From Leo, like the onboarding emails in 02. The tip itself is merged from Next Step, which the Custom Code picked from the weakest of team, jobs and integrations.',
                      message: {
                        channel: 'email',
                        subject: 'One thing to try next in Crewlo',
                        body: 'Hi {{contact.first_name}},\n\nThanks for giving Crewlo a real try. From what you have set up so far, one change would make the biggest difference this week:\n\n{{contact.next_step}}\n\nThere is a short guide for it at {{custom_values.help_center}}. And if something is in the way, reply and tell me what it is. I read every reply.\n\nLeo Park\nCustomer Success, Crewlo\n\n{{location.name}}, {{location.full_address}}',
                      },
                    },
                  ],
                },
              ],
              otherwise: {
                label: 'Nothing today',
                nodes: [
                  {
                    id: 'end-cold',
                    kind: 'end',
                    title: 'End',
                    summary:
                      "The branch ends here, with a Sticky Note saying why: below 40, or 40 to 69 with the tip already sent. No alert and no email today. The onboarding emails in 02 cover this stage, and tomorrow's snapshot scores the trial again.",
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
      id: 'enterprise',
      label: 'Demo-led trial crosses 70',
      summary:
        "Carlos had his demo with Aisha last week and started a trial the next day. Tuesday's snapshot scores 90. Find Opportunity finds her deal at Demo Held, which stays there, the contact and the card are already hers, and #pql hears at 7:02 AM. No intro email goes out: she has already met him.",
      start: at(1, 7, 2),
      contact: {
        firstName: 'Carlos',
        lastName: 'Mendez',
        email: 'carlos@harlowmech.example',
        phone: '(704) 555-0183',
        timezone: 'America/New_York',
        source: 'Website demo form',
        tags: ['trial', 'activated'],
        assignedTo: 'aisha',
        opportunity: { pipeline: 'New Business', stage: 'Demo Held', status: 'open', value: 0, name: 'Harlow Mechanical Group' },
        fields: {
          company: 'Harlow Mechanical Group',
          company_name: 'Harlow Mechanical Group',
          company_size: '201-1,000',
          job_role: 'Operations or dispatch',
          segment: 'enterprise',
          fit_score: 90,
          plan: 'trial',
          trial_end: '03-11-2026',
          workspace_id: 'ws_4TN6RC',
        },
      },
      events: [],
      expect: {
        outcome: 'ended',
        visits: ['if-alerted:else', 'if-score:0', 'tag-pql', 'find-opp:0', 'update-opp', 'goto-route', 'if-segment:0', 'assign-aisha', 'owner-aisha', 'goto-slack', 'slack', 'find-new:0', 'end-has-deal'],
        tags: ['pql-alerted'],
        stage: 'Demo Held',
      },
    },
    {
      id: 'self-serve',
      label: 'Self-serve trial on a Saturday',
      summary:
        "Megan signed up on her own on Monday and had invited 11 of her plumbers by Friday. Saturday's snapshot scores 80. She has no deal and no segment, so she goes to Ben: the #pql post and a new card in Trial Sales-Assist at 7:04 AM, and his email waits for the 9 AM window.",
      start: at(5, 7, 4),
      contact: {
        firstName: 'Megan',
        lastName: 'Doyle',
        email: 'megan@doyleplumbing.example',
        phone: '(216) 555-0176',
        timezone: 'America/New_York',
        source: 'Crewlo app signup',
        tags: ['trial', 'activated'],
        fields: { company: 'Doyle & Sons Plumbing', company_name: 'Doyle & Sons Plumbing', plan: 'trial', trial_end: '03-16-2026', workspace_id: 'ws_6PB3HX' },
      },
      events: [],
      expect: {
        outcome: 'completed',
        visits: ['if-score:0', 'find-opp:else', 'if-segment:else', 'assign-ben', 'owner-ben', 'slack', 'find-new:else', 'create-opp', 'email-ae'],
        tags: ['pql-alerted'],
        stage: 'Trial Sales-Assist',
      },
    },
    {
      id: 'tip',
      label: 'Warming, but nobody invited',
      summary:
        "Derek has scheduled 64 jobs himself and connected QuickBooks, but none of his techs are on Crewlo yet. Monday's snapshot scores 55, so Leo's tip is about inviting the team. It waits for the 9 AM window.",
      start: at(0, 7, 3),
      contact: {
        firstName: 'Derek',
        lastName: 'Lawson',
        email: 'derek@lawsongaragedoor.example',
        phone: '(314) 555-0129',
        timezone: 'America/Chicago',
        source: 'Crewlo app signup',
        tags: ['trial'],
        fields: { company: 'Lawson Garage Door Co.', company_name: 'Lawson Garage Door Co.', plan: 'trial', trial_end: '03-10-2026', workspace_id: 'ws_2WQ9LM' },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['if-score:1', 'tag-tip', 'email-tip'], tags: ['pql-tip-sent'] },
    },
    {
      id: 'cold',
      label: 'Early days, below 40',
      summary: "Sofia is three days in with one helper invited and 18 jobs on the board. Thursday's snapshot scores 23: the numbers are saved and the run ends quietly.",
      start: at(3, 7, 5),
      contact: {
        firstName: 'Sofia',
        lastName: 'Marchetti',
        email: 'sofia@marchettipools.example',
        phone: '(480) 555-0162',
        timezone: 'America/Phoenix',
        source: 'Crewlo app signup',
        tags: ['trial'],
        fields: { company: 'Marchetti Pool Service', company_name: 'Marchetti Pool Service', plan: 'trial', trial_end: '03-16-2026', workspace_id: 'ws_8KD5JT' },
      },
      events: [],
      expect: { outcome: 'ended', visits: ['save', 'if-score:else', 'end-cold'] },
    },
    {
      id: 'repeat',
      label: 'Next morning, already alerted',
      summary:
        "Wednesday's snapshot for Carlos's workspace: more people invited and both integrations connected, so the score reaches 100. The fields update for Aisha; the guard ends the run before anything else happens.",
      start: at(2, 7, 1),
      contact: {
        firstName: 'Carlos',
        lastName: 'Mendez',
        email: 'carlos@harlowmech.example',
        phone: '(704) 555-0183',
        timezone: 'America/New_York',
        source: 'Website demo form',
        tags: ['trial', 'activated', 'pql-alerted'],
        assignedTo: 'aisha',
        opportunity: { pipeline: 'New Business', stage: 'Demo Held', status: 'open', value: 0, name: 'Harlow Mechanical Group' },
        fields: {
          company: 'Harlow Mechanical Group',
          company_name: 'Harlow Mechanical Group',
          company_size: '201-1,000',
          job_role: 'Operations or dispatch',
          segment: 'enterprise',
          fit_score: 90,
          plan: 'trial',
          trial_end: '03-11-2026',
          workspace_id: 'ws_4TN6RC',
          pql_score: 90,
          seats: 41,
          trial_usage: '41 seats, 188 jobs scheduled, 1 of 2 integrations, 5 active days',
          next_step: TIPS.integrations,
        },
      },
      events: [],
      expect: { outcome: 'ended', visits: ['save', 'if-alerted:0', 'end-alerted'], tags: ['pql-alerted'], stage: 'Demo Held' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Product Score', key: 'pql_score', type: 'Number', note: '0 to 100, rewritten by every snapshot. The If/Else reads this field, not the raw code output.' },
      {
        name: 'Seats',
        key: 'seats',
        type: 'Number',
        note: 'People invited plus the owner, rewritten every morning while the plan is trial. Deal value is Seats × $29 × 12. The AE sets the number sold right before marking Won (05), since the next trial snapshot would overwrite an earlier edit. Once the plan is not trial, the code leaves it alone.',
      },
      { name: 'Trial Usage', key: 'trial_usage', type: 'Single line', note: 'One line for the AE: seats, jobs, integrations, active days' },
      { name: 'Next Step', key: 'next_step', type: 'Multi line', note: 'The tip for the weakest signal. The tip email merges it, and the AE can read it on the contact.' },
    ],
    tags: [
      { name: 'pql-alerted', note: 'Sales has been alerted about this trial. Added first on the PQL path; the guard reads it. 02 clears it when a new trial starts' },
      { name: 'pql-tip-sent', note: 'Has had the one tip email this trial. 02 clears it when a new trial starts' },
    ],
    pipeline: { name: 'New Business', stages },
    customValues: [
      { name: 'Price Per Seat', key: 'price_per_seat', value: '$29 per user per month' },
      { name: 'Help Center', key: 'help_center', value: 'help.crewlo.example' },
    ],
  },
  build: [
    {
      title: 'Define a PQL with sales and product',
      body: "Hana, both AEs and Crewlo's product team agreed on four signals the app already counts: people invited, jobs scheduled, integrations connected and days active. Team size carries the most weight, because a sales call only pays for itself on a team big enough to need one, and the bar is 70 out of 100. With nobody invited the most a trial can score is 65, so solo operators never page sales. The weights live in one Custom Code step, so changing them is an edit in GHL, not a release of the app.",
    },
    {
      title: 'One snapshot a day, totals to date',
      body: "The app posts usage.snapshot for every trial workspace at about 7 AM, workspace time. It sends totals for the trial so far rather than the day's change, so a failed snapshot loses nothing: the next one catches up. Once a day is enough for a sales alert, and the premium trigger and Custom Code are billed per execution, so the app does not send one per click.",
    },
    {
      title: 'Trigger, Mapping Reference, contact',
      body: "Inbound Webhook, one staging event, Test Trigger, then that request saved as the Mapping Reference. GHL then opens Create/Update Contact, which finds the owner by email and refreshes Plan and Workspace ID. That step matters more than it looks: an Inbound Webhook run starts without a contact, and Create Opportunity cannot make a deal without one. The four counts and the plan go into Custom Code as properties, picked from the Inbound Webhook trigger's Body values, plus the contact's current Seats.",
    },
    {
      title: 'Score, then save before deciding',
      body: 'The code reads inputData, converts each value with Number() and assigns its result to output. GHL will not offer the output to later steps until Test your Code has run, so I tested it with three saved payloads: a big trial, a warm one and a cold one. Update Contact Field writes the score, seats, a usage line and the tip with Dynamic Values, and the If/Else reads the saved Product Score field.',
    },
    {
      title: 'Guards before anything talks',
      body: 'The numbers save on every run, alerted or not, so the AE always sees current usage. Only then does the If/Else check for pql-alerted, and the PQL path adds that tag as its very first step. Warm trials get one tip per trial, guarded the same way by pql-tip-sent. 02 clears both tags when a new trial starts, so a returning company can be alerted again.',
    },
    {
      title: 'Card first, then owner, post and deal',
      body: "Find Opportunity (Latest, Pipeline is New Business, Status is Open, the same filters as 01) comes first, because Update Opportunity and Add Owner to Opportunity only act on a card in context. Found: Update Opportunity moves an early card to Trial Sales-Assist, never backwards, and a Go To joins the routing. The routing If/Else sends enterprise to Aisha and everyone else to Ben. Assign To User (Only Apply to Unassigned Contacts off) moves the contact, and Add Owner to Opportunity moves the card, because Allow different owners for contacts and its opportunities is on in this sub-account for 05. The #pql post is a Custom Webhook to a Slack incoming webhook, for Block Kit fields that read well on a phone, and like #demo-requests it carries no email or phone. Branches never rejoin, so a second Find Opportunity after the post tells the two cases apart again. Not Found runs Create Opportunity: value from annual_value, the AE as owner because it runs after the assignment, and Duplicate Opportunity on, because GHL checks duplicates by contact and an old Lost card would otherwise block it. Nothing leads back into a Find, so Find and Create can never loop.",
    },
    {
      title: 'Emails a person would send',
      body: "Only a trial without an open deal gets the AE email. Anyone with a card has asked for a demo and talked to someone in sales, so the AE writes to them in person from the #pql post; an automated hello would read as one. The email sets From Name and From Email to the assigned user, is plain text with one link, and asks for nothing. The tip email comes from Leo, like the onboarding emails in 02, with the tip merged from Next Step. The workflow Time Window holds both to 9 AM to 5 PM in the contact's time zone. Both end with Crewlo's full postal address from {{location.full_address}}, and the sub-account's unsubscribe link stays on.",
    },
    {
      title: 'Test with staging payloads',
      body: 'I posted a staging snapshot for each scenario below and read Execution Logs for the branch taken, the saved fields and the skipped steps. Then I sent the same payload twice, and a higher one the next morning, to prove the guard: one post in #pql, one deal, one email. A test contact with a card owned by Priya proved that Add Owner to Opportunity moves the card, not only the contact.',
    },
  ],
  edgeCases: [
    {
      title: "Tomorrow's snapshot, same trial",
      body: 'Re-entry is on, so it runs and the numbers update. The pql-alerted guard then ends the run before anything reaches sales or the contact. The tag goes on first, so even a failed Slack post cannot lead to a second alert.',
    },
    {
      title: 'The trial already has a deal',
      body: "A demo-led trial has a card from 01 · Demo Request. Find Opportunity picks it up, and Update Opportunity moves it to Trial Sales-Assist only from an earlier stage, so a card at Demo Held or Proposal stays put, value and all. Owners are decoupled in this sub-account, so after a small team moves from Priya to Ben, Assign To User alone would leave the card with Priya and her name on the win in 05. Add Owner to Opportunity moves it to Ben. No intro email goes out, because they have already talked to sales; the #pql post is the AE's cue to write in person.",
    },
    {
      title: 'Email DND',
      body: 'GHL skips the AE email, and the tag, the deal and the Slack post still happen. The AE sees Email DND on the contact and calls instead. On the tip path the email is skipped the same way. The tag still goes on, so lifting DND later does not send a stale tip.',
    },
    {
      title: 'A big team that skipped the demo form',
      body: "Segment only comes from the demo form, so a large self-serve trial routes to Ben. The Slack post shows the seat count, and when it is Aisha's kind of account Ben hands it over by changing the owner on the contact and on the card, since owners are decoupled here. The rule stays simple on purpose.",
    },
    {
      title: 'Slack is down, or the webhook URL is revoked',
      body: 'Depending on the error, GHL marks the Custom Webhook failed and skips it, or retries it with exponential backoff, and the steps after it wait behind the retries. Either way the card and the email still happen, and Execution Logs show the failure. The incoming webhook URL is a secret in itself, so it lives only in this step.',
    },
    {
      title: 'A paying or expired workspace sends a snapshot',
      body: 'The app should stop sending snapshots once a workspace buys or its trial ends. If one slips through, plan is no longer trial: the code returns a score of 0 and keeps Seats as it was, so nothing reaches sales or the customer, and the number sold that 05 provisioned is not overwritten.',
    },
  ],
  qa: [
    'Staging snapshot with known numbers: Product Score, Seats, Trial Usage and Next Step match a hand calculation',
    "Score 70+, no segment, no deal: owner Ben, Add Owner to Opportunity skipped, a card owned by Ben in Trial Sales-Assist valued at Seats × $348, one #pql post at 7 AM (not held by the Time Window), and Ben's email held until 9 AM",
    'Segment enterprise with an open Demo Held card: Aisha owns the contact and the card, the card stays in Demo Held with its value, no second card, a #pql post and no email',
    'Segment small with an open Demo Booked card owned by Priya: the contact and the card both move to Ben, the card moves to Trial Sales-Assist, and no email goes out',
    'Only a Lost card on the record: a new open card appears in Trial Sales-Assist next to it',
    'Same payload twice, then a higher one the next morning: one alert, one deal, one email, and the fields still update. A second snapshot while an email is held: Enrollment History shows what GHL did with it',
    'Score 40 to 69: one tip about the weakest signal, and a second warm snapshot sends nothing. Email DND: the email shows as skipped. Plan other than trial: score 0, Seats unchanged, no alert',
    'The #pql post shows no email or phone. Both emails show the postal address and unsubscribe link in Gmail and Outlook, and replies land in Conversations for the sender',
  ],
  snippets: [
    {
      title: 'usage.snapshot payload',
      language: 'json',
      code: payload,
      note: "POSTed by the app to this workflow's Inbound Webhook URL once a day per trial workspace. Counts are totals for the trial so far. Create/Update Contact maps email, plan and workspace_id; the counts only feed the Custom Code step.",
    },
    {
      title: 'Product score (Custom Code step)',
      language: 'javascript',
      code: scoreCode,
      note: "Properties are read as inputData.<key>: five from the trigger's Body values and the contact's current Seats. The object assigned to output becomes the step output that Update Contact Field and Create Opportunity map with Dynamic Values.",
    },
    {
      title: '#pql Slack post (Custom Webhook body)',
      language: 'json',
      code: slackPayload,
      note: 'Event CUSTOM, Method POST, Content-Type application/json, sent to a Slack incoming webhook for #pql. The text line is the fallback for notifications; the blocks are what people see in the channel. No email or phone in a channel.',
    },
  ],
  features: [
    'Inbound Webhook (premium)',
    'Mapping Reference',
    'Create/Update Contact',
    'Custom Code',
    'Update Contact Field',
    'Dynamic Values',
    'If/Else',
    'Add Contact Tag',
    'Assign To User',
    'Go To',
    'Custom Webhook',
    'Find Opportunity',
    'Update Opportunity',
    'Add Owner to Opportunity',
    'Create Opportunity',
    'Send Email',
    'Allow Re-entry',
    'Time Window',
    'Sticky Notes',
  ],
};
