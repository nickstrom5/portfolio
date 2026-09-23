import type { Automation, Condition, Contact } from '@/lib/ghl/types';
import { business } from '../business';

const DAY = 1440;
const WEEKDAYS = [0, 1, 2, 3, 4];
/** Monday 2 March 2026, 00:00: the sample week the simulator runs in. */
const BASE = Date.UTC(2026, 2, 2);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

const users = business.env.users;
const stages = business.pipeline.stages;
const company = (c: Contact) => String(c.fields.company ?? 'their company');

/** Add Task with Due In 1 day and Skip Weekends on: the next weekday. */
function dueDate(now: number): string {
  let day = Math.floor(now / DAY) + 1;
  while (day % 7 >= 5) day++;
  const d = new Date(BASE + day * DAY * 60000);
  return `${WEEKDAY[day % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/* ---------- Fit score: the Custom Code step, and the same logic for the simulator ---------- */

const FREE_MAIL = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com', 'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net'];
const SIZE_POINTS: Record<string, number> = { '1-10': 5, '11-50': 20, '51-200': 30, '201-1,000': 40, '1,000+': 45 };
const ROLE_POINTS: Record<string, number> = { 'Owner or executive': 35, 'Operations or dispatch': 30, IT: 15, Other: 0 };

function fit(c: Contact) {
  const size = String(c.fields.company_size ?? '').trim();
  const role = String(c.fields.job_role ?? '').trim();
  const domain = (String(c.email ?? '').split('@')[1] ?? '').trim().toLowerCase();
  const freeMail = FREE_MAIL.includes(domain);
  let score = (SIZE_POINTS[size] ?? 0) + (ROLE_POINTS[role] ?? 0) + (freeMail ? 0 : 20);
  score = Math.max(0, Math.min(100, score));
  let segment = 'small';
  if (score >= 50 && (size === '201-1,000' || size === '1,000+')) segment = 'enterprise';
  else if (score >= 50 && (size === '11-50' || size === '51-200')) segment = 'mid-market';
  return { fit_score: score, segment, free_mail: freeMail };
}

const fitCode = `// Custom Code step, JavaScript. Properties added in the step:
//   company_size = {{contact.company_size}}
//   job_role     = {{contact.job_role}}
//   email        = {{contact.email}}
// GHL wraps this in an async function and reads the result from \`output\`.
const FREE_MAIL = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
  'protonmail.com', 'gmx.com', 'comcast.net', 'att.net', 'sbcglobal.net',
  'verizon.net'];

// Keys match the form's dropdown options character for character.
const SIZE = { '1-10': 5, '11-50': 20, '51-200': 30, '201-1,000': 40, '1,000+': 45 };
const ROLE = { 'Owner or executive': 35, 'Operations or dispatch': 30, 'IT': 15, 'Other': 0 };

const size = (inputData.company_size || '').trim();
const role = (inputData.job_role || '').trim();
const domain = ((inputData.email || '').split('@')[1] || '').trim().toLowerCase();
const freeMail = FREE_MAIL.includes(domain);

// A work address is worth 20. In the trades plenty of owners run the
// business from Gmail, so a personal address costs points instead of
// disqualifying the request.
let score = (SIZE[size] || 0) + (ROLE[role] || 0) + (freeMail ? 0 : 20);
score = Math.max(0, Math.min(100, score));

// Under 50, the request goes to the weekly live demo and Priya checks it
// first, whatever size it claims. Account executives get requests that fit.
let segment = 'small';
if (score >= 50 && (size === '201-1,000' || size === '1,000+')) segment = 'enterprise';
else if (score >= 50 && (size === '11-50' || size === '51-200')) segment = 'mid-market';

output = { fit_score: score, segment: segment, free_mail: freeMail };`;

const slackBody = `{
  "text": "Demo request: {{contact.name}}, {{contact.company}} ({{contact.segment}}, fit {{contact.fit_score}})",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*New demo request:* {{contact.name}}, *{{contact.company}}*\\nOwner: {{user.name}}"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Segment*\\n{{contact.segment}}" },
        { "type": "mrkdwn", "text": "*Fit score*\\n{{contact.fit_score}}" },
        { "type": "mrkdwn", "text": "*Team size*\\n{{contact.company_size}}" },
        { "type": "mrkdwn", "text": "*Role*\\n{{contact.job_role}}" },
        { "type": "mrkdwn", "text": "*Source*\\n{{contact.source}}" },
        { "type": "mrkdwn", "text": "*UTM*\\n{{contact.utm_source}} / {{contact.utm_medium}} / {{contact.utm_campaign}}" }
      ]
    }
  ]
}`;

const routingTable = `Team size    Fit score 50 or more       Fit score under 50
1-10         Live demo, Priya follows   Live demo, Priya follows
11-50        Ben, one-to-one demo       Live demo, Priya follows
51-200       Ben, one-to-one demo       Live demo, Priya follows
201-1,000    Aisha, one-to-one demo     Live demo, Priya follows
1,000+       Aisha, one-to-one demo     Live demo, Priya follows

Points: team size 5 / 20 / 30 / 40 / 45
        role: owner or executive 35, operations or dispatch 30, IT 15, other 0
        work email 20, personal email (Gmail, Yahoo, Comcast...) 0`;

/* ---------- Conditions and shared step builders ---------- */

const isEnterprise: Condition = { type: 'field', key: 'segment', op: 'eq', value: 'enterprise', label: 'Segment is enterprise' };
const isMidMarket: Condition = { type: 'field', key: 'segment', op: 'eq', value: 'mid-market', label: 'Segment is mid-market' };

function assign(id: string, key: 'aisha' | 'ben' | 'priya', role: string) {
  return {
    id,
    kind: 'action' as const,
    action: 'assign_user' as const,
    title: 'Assign To User',
    label: users[key].name,
    summary: 'One named user. Only Apply to Unassigned Contacts is off, so the owner always matches the segment, even if an earlier trial or request gave the contact someone else.',
    effect: { assignTo: key },
    run: () => ({ log: `${users[key].name}, ${role}, now owns the contact.` }),
  };
}

function task(id: string, key: 'aisha' | 'ben' | 'priya') {
  return {
    id,
    kind: 'action' as const,
    action: 'add_task' as const,
    title: 'Add Task',
    label: `${users[key].first_name}: follow up`,
    summary: `Assigned to ${users[key].name}, Due In 1 day with Skip Weekends on. The description says the follow-up email has gone out from them, and to check Conversations before calling.`,
    run: ({ contact, now }: { contact: Contact; now: number }) => ({
      log: `Task for ${users[key].name}: "Follow up: ${contact.firstName} ${contact.lastName}, ${company(contact)}, no demo booked". Due ${dueDate(now)}.`,
    }),
  };
}

export const demoRequest: Automation = {
  id: 'demo-request',
  number: '01',
  name: 'Demo request',
  kicker: 'Inbound',
  tagline: 'Every demo request is scored, routed to the right rep and posted to Slack within seconds, and the pipeline card moves by itself when they book.',
  problem:
    'Demo requests landed in one shared inbox. Whoever looked first took them, a 400-person company could wait behind a two-van plumber, and the reps heard about new requests from each other instead of from the system.',
  solution:
    'The form asks the two questions routing needs. Custom Code scores the fit and picks the segment: enterprise goes to Aisha, mid-market to Ben, small teams and anything that scores low to the weekly live demo with Priya following up. The buyer gets an email from the rep who will run the demo, the rep gets an in-app alert, Slack gets the source and the score, and one card sits in Demo Requested with that rep as its owner. A booking moves it to Demo Booked. No booking within a day gives the rep a task and sends one personal follow-up, in business hours.',
  workflow: {
    name: '01 · Inbound · Demo Request',
    folder: 'Inbound',
    triggers: [{ title: 'Form Submitted', filters: ['Form is Book a Demo'], label: 'Form Submitted (Book a Demo)' }],
    settings: {
      allowReEntry: true,
      stopOnResponse: true,
      timezone: 'contact',
      notes: [
        'Stop on Response on: a reply to either email means a person takes the conversation, so no follow-up lands on top of it. The reply goes to Conversations with the owner. The run ends there, so a rep who books the demo from that reply moves the card to Demo Booked by hand.',
        'Allow Re-entry on: someone who asks again after a finished run is routed again. GHL does not let a contact re-enter while still active, so a double submit does nothing.',
        'Allow multiple Opportunities is left alone: it only matters for opportunity triggers. Duplicate cards are handled by Find Opportunity before Create Opportunity.',
        'No workflow Time Window: the invite, the alert and the Slack post answer a request made seconds ago. Only the no-booking follow-up waits for business hours, with its own Advance Window.',
        'Sender: every email uses the assigned user for From Name and From Email, so replies go to the rep who owns the deal. The sub-account keeps its automatic unsubscribe link on, and both emails carry the postal address.',
        'Custom Code and Custom Webhook are premium actions, billed per execution: two per demo request. Find Opportunity is a standard action.',
      ],
    },
    steps: [
      {
        id: 'untag',
        kind: 'action',
        action: 'remove_tag',
        title: 'Remove Contact Tag',
        label: 'demo-booked',
        summary: 'Clears the tag an earlier booking left behind, so the booking waits below only release on a booking made after this request.',
        run: ({ contact }) =>
          contact.tags.includes('demo-booked')
            ? { effect: { removeTags: ['demo-booked'] }, log: 'Removed demo-booked from an earlier booking, so only a new booking counts.' }
            : { log: 'No demo-booked tag on the record, so there is nothing to clear.' },
      },
      {
        id: 'score',
        kind: 'action',
        action: 'custom_code',
        title: 'Custom Code',
        label: 'Fit score',
        summary: 'Scores fit from 0 to 100 from team size, role and whether the email is a work address, then picks the segment. Under 50 goes to the live demo, whatever the size.',
        run: ({ contact }) => {
          const out = fit(contact);
          return { vars: out, log: `Returned fit_score ${out.fit_score}, segment "${out.segment}" and free_mail ${out.free_mail}.` };
        },
        code: { language: 'javascript', source: fitCode },
      },
      {
        id: 'save',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Save fit and segment',
        summary: 'Writes the code output to Fit Score and Segment, so the If/Else, Slack, reports and later workflows all read the same values.',
        run: ({ vars }) => ({ effect: { fields: { fit_score: vars.fit_score, segment: vars.segment } }, log: `Fit Score ${vars.fit_score}, Segment ${vars.segment}.` }),
      },
      {
        id: 'route',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Route by segment',
        branches: [
          {
            label: 'Enterprise',
            when: isEnterprise,
            nodes: [
              assign('assign-aisha', 'aisha', 'enterprise account executive'),
              {
                id: 'email-demo',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Pick a time',
                summary:
                  "From the owner, with the book-demo trigger link to the Product Demo calendar. Always Book with Assigned User is on there, so the buyer sees only the owner's times and books with the rep named in the email.",
                message: {
                  channel: 'email',
                  subject: 'Your Crewlo demo: pick a time with {{user.first_name}}',
                  body: "Hi {{contact.first_name}},\n\nThanks for asking for a Crewlo demo. I'm {{user.first_name}}, and I'll run it. If you didn't get to pick a time on the last page, my open times are here: {{trigger_link.book_demo}}\n\nIt takes 30 minutes. I'll set up the dispatch board the way a team like {{contact.company}} would use it and leave time for your questions. If someone else schedules the crews day to day, bring them along.\n\n{{user.name}}\n{{location.name}} | {{location.phone}}\n{{location.address}}",
                },
              },
              {
                id: 'find-opp',
                kind: 'ifelse',
                title: 'Find Opportunity',
                label: 'Find the open card',
                branches: [
                  {
                    label: 'Opportunity Found',
                    when: { type: 'all', label: 'Latest opportunity in New Business with Status Open', of: [{ type: 'opportunity', status: 'open' }] },
                    nodes: [
                      {
                        id: 'notify',
                        kind: 'action',
                        action: 'internal_notification',
                        title: 'Internal Notification',
                        label: 'Tell the owner',
                        summary: 'In-app notification to the assigned user, with the contact as the Redirect Page. One step serves all three segments.',
                        message: {
                          channel: 'internal',
                          to: '{{user.name}} (assigned user)',
                          subject: 'Demo request: {{contact.company}}, fit {{contact.fit_score}}',
                          body: 'From {{contact.name}}, {{contact.job_role}}. Team size {{contact.company_size}}, segment {{contact.segment}}. Your invite email has gone out. If nothing is booked within a day, you get a task.',
                        },
                      },
                      {
                        id: 'slack',
                        kind: 'action',
                        action: 'webhook',
                        title: 'Custom Webhook',
                        label: 'Post to #demo-requests',
                        summary:
                          "POST to the channel's Slack incoming webhook: Event CUSTOM, Content-Type application/json, Block Kit in the Raw Body. Source, UTM and fit in the post; no email or phone. The webhook URL is the only secret, and it lives in the action's URL field.",
                        message: {
                          channel: 'slack',
                          to: '#demo-requests',
                          body: 'New demo request: {{contact.name}}, {{contact.company}}\nOwner: {{user.name}}\nSegment: {{contact.segment}} · Fit score: {{contact.fit_score}}\nTeam size: {{contact.company_size}} · Role: {{contact.job_role}}\nSource: {{contact.source}} · UTM: {{contact.utm_source}} / {{contact.utm_medium}} / {{contact.utm_campaign}}',
                        },
                        code: { language: 'json', source: slackBody },
                      },
                      {
                        id: 'wait-book',
                        kind: 'wait',
                        title: 'Wait',
                        label: 'Booked within a day?',
                        // In GHL this waits for the demo-booked tag that 01a adds when a demo is
                        // booked. The simulator runs one workflow at a time, so it watches the
                        // booking itself.
                        mode: 'event',
                        event: 'appointment_booked',
                        minutes: DAY,
                        summary:
                          'Specific conditions to be met: contact tag includes demo-booked, which 01a · Inbound · Demo Booked adds when a Product Demo or Weekly Live Demo booking comes in. Timeout 1 day, so no booking gets its own branch.',
                        branches: {
                          met: {
                            label: 'Booked',
                            nodes: [
                              {
                                id: 'opp-booked',
                                kind: 'action',
                                action: 'update_opportunity',
                                title: 'Update Opportunity',
                                label: 'Demo Booked',
                                summary:
                                  'The card Find Opportunity picked moves to Demo Booked. Allow Opportunity to Move to Any Previous Stage is off, so a card that is already further along never moves back.',
                                run: ({ contact }) => {
                                  const now = contact.opportunity?.stage ?? '';
                                  if (stages.indexOf(now) > stages.indexOf('Demo Booked')) return { log: `The card is already at ${now}, and moving back is off, so it stays there.` };
                                  return { effect: { opportunity: { pipeline: 'New Business', stage: 'Demo Booked' } }, log: 'Moved the card from Demo Requested to Demo Booked.' };
                                },
                              },
                            ],
                          },
                          timeout: {
                            label: 'No booking in a day',
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
                                  "No delay, but its Advance Window resumes only Monday to Friday (Resume On), 9 AM to 5 PM (Resume Between Hours) in the contact's time zone, so the task and the follow-up land in a working day.",
                              },
                              {
                                id: 'owner-task',
                                kind: 'ifelse',
                                title: 'If/Else',
                                label: 'Whose task?',
                                branches: [
                                  {
                                    label: 'Enterprise',
                                    when: isEnterprise,
                                    nodes: [
                                      task('task-aisha', 'aisha'),
                                      {
                                        id: 'email-nudge',
                                        kind: 'action',
                                        action: 'send_email',
                                        title: 'Send Email',
                                        label: 'Personal follow-up',
                                        summary: 'Plain text from the owner: one question, no button, easy to answer or to decline. All three segments share it.',
                                        message: {
                                          channel: 'email',
                                          subject: 'Your Crewlo demo request',
                                          body: "Hi {{contact.first_name}},\n\nThanks again for asking about Crewlo. I don't see a demo on the calendar for you yet, so I wanted to follow up myself.\n\nTo make the demo useful from the first minute, one question: how does {{contact.company}} schedule its crews today? A whiteboard, spreadsheets, another tool?\n\nReply with a couple of times that suit you and I'll send an invite. If now isn't the right time, reply and say so, and I won't follow up again.\n\n{{user.name}}\n{{location.name}} | {{location.phone}}\n{{location.address}}",
                                        },
                                      },
                                      {
                                        id: 'wait-late',
                                        kind: 'wait',
                                        title: 'Wait',
                                        label: 'Booked after the nudge?',
                                        // Same stand-in as wait-book: GHL waits for the demo-booked tag.
                                        mode: 'event',
                                        event: 'appointment_booked',
                                        minutes: 7 * DAY,
                                        summary: 'The same demo-booked condition, with a 7-day timeout. A late booking still moves the card. No more messages after this one.',
                                        branches: {
                                          met: {
                                            label: 'Booked late',
                                            nodes: [
                                              {
                                                id: 'goto-booked',
                                                kind: 'goto',
                                                title: 'Go To',
                                                target: 'opp-booked',
                                                summary: 'The same Update Opportunity step as a booking on the first day. The card Find Opportunity picked is still the one in context.',
                                              },
                                            ],
                                          },
                                          timeout: { label: 'Still no booking', nodes: [] },
                                        },
                                      },
                                    ],
                                  },
                                  {
                                    label: 'Mid-market',
                                    when: isMidMarket,
                                    nodes: [
                                      task('task-ben', 'ben'),
                                      { id: 'goto-nudge-ben', kind: 'goto', title: 'Go To', target: 'email-nudge', summary: 'The shared follow-up email, sent from Ben because he owns the contact.' },
                                    ],
                                  },
                                ],
                                otherwise: {
                                  label: 'Small team or low fit',
                                  nodes: [
                                    task('task-priya', 'priya'),
                                    { id: 'goto-nudge-priya', kind: 'goto', title: 'Go To', target: 'email-nudge', summary: 'The shared follow-up email, sent from Priya because she owns the contact.' },
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
                  label: 'Opportunity Not Found',
                  nodes: [
                    {
                      id: 'create-opp',
                      kind: 'action',
                      action: 'create_opportunity',
                      title: 'Create Opportunity',
                      label: 'Demo Requested',
                      summary:
                        "New Business › Demo Requested, named after the company, source Demo form, value 0 until discovery. It runs after Assign To User, so the card gets the contact's owner. Duplicate Opportunity is on here on purpose: this step only runs when there is no open card.",
                      run: ({ contact }) => ({
                        effect: { opportunity: { pipeline: 'New Business', stage: 'Demo Requested', status: 'open', name: company(contact), value: 0 } },
                        log: contact.opportunity
                          ? `The only card on the record is ${contact.opportunity.status[0].toUpperCase()}${contact.opportunity.status.slice(1)}, at ${contact.opportunity.stage}, so a new one goes in Demo Requested: "${company(contact)}", owner ${contact.assignedTo ? users[contact.assignedTo].name : 'unassigned'}. With Duplicate Opportunity off, the old card would block it.`
                          : `New Business › Demo Requested: "${company(contact)}", source Demo form, owner ${contact.assignedTo ? users[contact.assignedTo].name : 'unassigned'}.`,
                      }),
                    },
                    {
                      id: 'goto-refind',
                      kind: 'goto',
                      title: 'Go To',
                      target: 'find-opp',
                      summary: 'Back through Find Opportunity, which now finds the new card. GHL does not carry a card made by Create Opportunity into later Update Opportunity steps.',
                    },
                  ],
                },
              },
            ],
          },
          {
            label: 'Mid-market',
            when: isMidMarket,
            nodes: [
              assign('assign-ben', 'ben', 'mid-market account executive'),
              { id: 'goto-demo', kind: 'goto', title: 'Go To', target: 'email-demo', summary: 'The same invite, card, alert, Slack post and booking wait as enterprise. Only the owner differs.' },
            ],
          },
        ],
        otherwise: {
          label: 'Small team or low fit',
          nodes: [
            assign('assign-priya', 'priya', 'sales development rep'),
            {
              id: 'email-live',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Join the live demo',
              summary: 'From Priya, with the Weekly Live Demo link and the free trial. A reply gets a one-to-one call.',
              message: {
                channel: 'email',
                subject: 'Your Crewlo demo: join the weekly live demo',
                body: "Hi {{contact.first_name}},\n\nThanks for asking about Crewlo. The quickest way to see it is our weekly live demo: 30 minutes, with time for questions at the end. Save a seat here: {{custom_values.group_demo_link}}\n\nYou'll see the dispatch board, the app your techs use on their phones and how a job gets from the office to the tech on site. If you'd rather try it yourself first, the free trial runs {{custom_values.trial_length}}: {{custom_values.app_url}}\n\nPrefer a one-to-one call? Reply here and I'll set one up.\n\n{{user.name}}\n{{location.name}} | {{location.phone}}\n{{location.address}}",
              },
            },
            { id: 'goto-find', kind: 'goto', title: 'Go To', target: 'find-opp', summary: 'Joins the shared steps after its own email: the card, the alert, the Slack post and the booking wait.' },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'books',
      label: 'Books on the thank-you page',
      summary: 'Rachel runs dispatch for an 11-50 person HVAC company. She books a slot two minutes after the form, so the card moves and no follow-up is needed.',
      start: at(1, 10, 14),
      contact: { fields: { company: 'Brightline HVAC', company_size: '11-50', job_role: 'Operations or dispatch', sms_consent: 'Yes', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'hvac-dispatch' } },
      events: [
        {
          at: 2,
          type: 'appointment_booked',
          value: 'Product Demo',
          appointmentAt: at(2, 14, 30) - at(1, 10, 14),
          label: "Picks Wed 2:30 PM on the thank-you page, where the calendar shows only Ben's times. 01a adds demo-booked.",
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['score', 'route:1', 'assign-ben', 'goto-demo', 'email-demo', 'find-opp:else', 'create-opp', 'goto-refind', 'find-opp:0', 'notify', 'slack', 'wait-book:met', 'opp-booked'],
        stage: 'Demo Booked',
      },
    },
    {
      id: 'replies',
      label: 'Replies to the email',
      summary: 'The owner of a 400-person facilities company answers the invite with a day and a request. The reply takes him out of the workflow; Aisha books the demo from Conversations and moves the card herself.',
      start: at(2, 9, 5),
      contact: {
        firstName: 'Daniel',
        lastName: 'Reyes',
        email: 'daniel.reyes@summitfacility.example',
        phone: '(312) 555-0178',
        timezone: 'America/Chicago',
        fields: { company: 'Summit Facility Services', company_size: '201-1,000', job_role: 'Owner or executive', sms_consent: 'No', utm_source: 'linkedin', utm_medium: 'paid-social', utm_campaign: 'enterprise-dispatch' },
      },
      events: [{ at: 35, type: 'reply', channel: 'email', value: 'Thanks. Can we do Thursday afternoon? I would like our dispatcher on the call too.' }],
      expect: { outcome: 'stopped', visits: ['route:0', 'assign-aisha', 'email-demo', 'create-opp', 'find-opp:0', 'notify', 'slack'], stage: 'Demo Requested' },
    },
    {
      id: 'quiet',
      label: 'Never books or replies',
      summary: 'A VP of operations asks on Thursday afternoon, then goes quiet. A day later Aisha gets a task and her follow-up goes out; a week after that the run ends and the card waits in Demo Requested.',
      start: at(3, 13, 40),
      contact: {
        firstName: 'Karen',
        lastName: 'Liu',
        email: 'kliu@northgatefm.example',
        phone: '',
        timezone: 'America/Denver',
        fields: { company: 'Northgate Facility Management', company_size: '1,000+', job_role: 'Owner or executive', sms_consent: 'No', utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'field-service-software' },
      },
      events: [],
      expect: { outcome: 'completed', visits: ['route:0', 'find-opp:0', 'wait-book:timeout', 'office-hours', 'owner-task:0', 'task-aisha', 'email-nudge', 'wait-late:timeout'], stage: 'Demo Requested' },
    },
    {
      id: 'small-team',
      label: 'Small team, Gmail address',
      summary: 'Andre runs a five-person plumbing company from a Gmail address and asks on a Monday evening. He gets the live demo and Priya, and saves a seat the day her follow-up arrives.',
      start: at(0, 19, 25),
      contact: {
        firstName: 'Andre',
        lastName: 'Mills',
        email: 'andre.millsplumbing@gmail.com',
        phone: '(216) 555-0164',
        timezone: 'America/New_York',
        fields: { company: 'Mills Plumbing', company_size: '1-10', job_role: 'Owner or executive', sms_consent: 'Yes', utm_source: 'facebook', utm_medium: 'paid-social', utm_campaign: 'plumbing-owners' },
      },
      events: [
        {
          at: at(2, 12, 10) - at(0, 19, 25),
          type: 'appointment_booked',
          value: 'Weekly Live Demo',
          appointmentAt: at(3, 11) - at(0, 19, 25),
          label: "Saves a seat at Thursday's live demo from the link in Priya's first email. 01a adds demo-booked.",
        },
      ],
      expect: {
        outcome: 'completed',
        visits: ['route:else', 'assign-priya', 'email-live', 'goto-find', 'find-opp:else', 'create-opp', 'find-opp:0', 'wait-book:timeout', 'office-hours', 'owner-task:else', 'task-priya', 'goto-nudge-priya', 'email-nudge', 'wait-late:met', 'goto-booked', 'opp-booked'],
        stage: 'Demo Booked',
      },
    },
    {
      id: 'friday-night',
      label: 'Friday night request',
      summary:
        "An operations manager at a 120-person cleaning company whose card from last year was marked Lost asks again at 9:48 PM on a Friday. He gets a new card, the invite and the alerts go at once, and the follow-up waits for Monday at 9 AM. He answers it.",
      start: at(4, 21, 48),
      contact: {
        firstName: 'Tom',
        lastName: 'Novak',
        email: 'tnovak@lakeshoreclean.example',
        phone: '(773) 555-0151',
        timezone: 'America/Chicago',
        fields: { company: 'Lakeshore Commercial Cleaning', company_size: '51-200', job_role: 'Operations or dispatch', sms_consent: 'No', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'cleaning-scheduling' },
        opportunity: { pipeline: 'New Business', stage: 'Demo Held', status: 'lost', name: 'Lakeshore Commercial Cleaning' },
      },
      events: [{ at: at(7, 10, 12) - at(4, 21, 48), type: 'reply', channel: 'email', value: 'Sorry, missed this on Friday. Tuesday at 2 works for me, and I will bring our two dispatchers.' }],
      expect: {
        outcome: 'stopped',
        visits: ['route:1', 'email-demo', 'find-opp:else', 'create-opp', 'find-opp:0', 'wait-book:timeout', 'office-hours', 'owner-task:1', 'task-ben', 'goto-nudge-ben', 'email-nudge'],
        stage: 'Demo Requested',
      },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Company Size', key: 'company_size', type: 'Dropdown (single)', note: '1-10 · 11-50 · 51-200 · 201-1,000 · 1,000+, spelled exactly as the code expects' },
      { name: 'Job Role', key: 'job_role', type: 'Dropdown (single)', note: 'Owner or executive · Operations or dispatch · IT · Other' },
      { name: 'Fit Score', key: 'fit_score', type: 'Number', note: '0 to 100, written by the Custom Code step' },
      { name: 'Segment', key: 'segment', type: 'Dropdown (single)', note: 'enterprise · mid-market · small, lowercase so the code output matches an option' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: "Unticked and optional. It covers the calendar's booking reminders; this workflow sends no texts" },
      { name: 'UTM Source / Medium / Campaign', key: 'utm_source', type: 'Single line ×3', note: 'Hidden form fields filled from the page URL' },
    ],
    tags: [{ name: 'demo-booked', note: 'Added by 01a · Inbound · Demo Booked when a Product Demo or Weekly Live Demo booking comes in, whoever makes it. Cleared here at entry.' }],
    pipeline: { name: business.pipeline.name, stages: business.pipeline.stages },
    customValues: [
      { name: 'Group Demo Link', key: 'group_demo_link', value: business.env.customValues.group_demo_link },
      { name: 'App URL', key: 'app_url', value: business.env.customValues.app_url },
      { name: 'Trial Length', key: 'trial_length', value: business.env.customValues.trial_length },
    ],
  },
  build: [
    {
      title: 'Agree the routing with sales',
      body: "I sat down with Hana and the three reps and asked one question: whose hour is this request worth? The answer became the routing table in the snippets: 201 people and up to Aisha, 11 to 200 to Ben, 1 to 10 to the weekly live demo with Priya following up, and anything with a fit score under 50 to Priya first, whatever size it claims. Nobody wanted a black box, so the score is three answers added up, and anyone can read it in the code.",
    },
    {
      title: 'Fields before the form',
      body: 'Company Size and Job Role are dropdowns whose options match the code character for character; one stray hyphen would give a 200-person company no points for size. Segment is a dropdown with lowercase options, because Update Contact Field writes the code output as it comes. UTM source, medium and campaign are hidden fields filled from the URL, and the SMS box is unticked and optional.',
    },
    {
      title: 'Score in Custom Code',
      body: 'Three properties go in (company_size, job_role, email), and fit_score, segment and free_mail come out. GHL only lets later steps use the output once Test your Code has run, so I tested one sample per size band plus a Gmail address. Update Contact Field then writes Fit Score and Segment, and every step after that reads the contact fields.',
    },
    {
      title: 'Owner first, then find or make the card',
      body: "Each branch starts with Assign To User: one named rep, with Only Apply to Unassigned Contacts off, so owner and segment always agree. Then Find Opportunity (Latest, Pipeline is New Business, Status is Open), because Update Opportunity only works on a card that is in context, and GHL does not carry one made by Create Opportunity into later steps. Opportunity Not Found runs Create Opportunity in Demo Requested and a Go To back to Find, which now finds it. Duplicate Opportunity is on in that one step, on purpose: it only runs when there is no open card, and with it off, a contact whose only card is Lost would bounce between Find and Create forever. A new card takes the contact's owner by default, so it lands with the rep the routing just picked.",
    },
    {
      title: 'Write the shared steps once',
      body: 'Mid-market is an Assign To User and a Go To into the enterprise path at the invite email. Small teams get their own live-demo email, then a Go To at Find Opportunity. The card, the in-app alert, the Slack post and the booking wait exist once, so changing the Slack format is one edit, not three.',
    },
    {
      title: 'Slack through a Custom Webhook',
      body: "#demo-requests is a private channel, and GHL's Send Slack Message posts to private channels as the user who connected Slack, which here would be Hana. A Slack incoming webhook posts as its own app and takes Block Kit, so segment, fit, owner, source and UTM show as fields. Event CUSTOM, Method POST, Content-Type application/json, and the webhook URL lives only in the action. No email or phone goes to Slack: more people read the channel than work the deal.",
    },
    {
      title: 'Booked, or not',
      body: "If/Else only offers appointment conditions when the trigger is an appointment, and a Specific conditions to be met wait checks contact data. So a one-action helper, 01a · Inbound · Demo Booked, adds a demo-booked tag, and the wait here releases on that tag. 01a fires on Customer Booked Appointment and on Appointment Status (status New, Modified By User), both with In Calendar set to Product Demo and Weekly Live Demo, so a rep booking on someone's behalf counts too. A booking moves the card Find Opportunity picked to Demo Booked. A day without one waits for weekday business hours, then creates a task and sends one plain follow-up from the owner. Add Task's Assign To is a user picked from a list, so that path splits by segment once more before the shared email, and a second wait catches late bookings for a week.",
    },
    {
      title: 'Calendar, settings, tests',
      body: "The Product Demo calendar is round robin across Aisha, Ben and Priya, with Always Book with Assigned User on, the form first in the booking widget and Allow Staff Selection off, so a booker sees only their owner's times. The invite links to it through the book-demo trigger link, not the landing page, so nobody fills in the form twice. Stop on Response and Allow Re-entry are on. Before publishing I ran a test contact per band, a Gmail address, a contact with a Lost card, a Friday-night submission and a reply, each checked in Execution Logs and Enrollment History.",
    },
  ],
  edgeCases: [
    {
      title: 'Personal email, big number',
      body: 'A Gmail address that claims 1,000+ people and picks Other scores 45, under the bar, so it goes to the live demo and Priya checks it first. If it turns out to be a real enterprise buyer, Priya sets Segment to enterprise and assigns Aisha, so a no-booking task later goes to Aisha too, and she says why in the Slack thread.',
    },
    {
      title: 'Replies instead of booking',
      body: 'Stop on Response takes them out on a reply to either email, so no follow-up lands on top of a conversation. The owner answers in Conversations, books the time and moves the card to Demo Booked by hand, because the run that would have moved it has ended. An out-of-office reply stops the run too; the owner still has the alert, the card and the conversation. If the reply is a no, the owner turns on DND for email, so the follow-up\'s promise holds in every workflow, not just this one.',
    },
    {
      title: 'Friday night request',
      body: "The invite, the alert and the Slack post go out at once, because they answer a request made seconds ago. The no-booking follow-up waits for the Advance Window, 9 AM Monday in the contact's time zone, so the task and the email land in a working day.",
    },
    {
      title: 'Books late, or asks twice',
      body: 'A booking in the week after the follow-up still moves the card through the same Update Opportunity step. After that the owner moves it by hand, and the task is already on their list. The opposite case: someone with a demo already on the calendar submits the form again after their first run has finished. The new run clears demo-booked, so a day later they would get a follow-up they do not need. The second Slack post is the owner\'s cue to remove them from this workflow by hand.',
    },
    {
      title: 'Someone who already has a card',
      body: "Find Opportunity looks for an open card first. A trial that 03 · Product · PQL Alert already put in Trial Sales-Assist keeps that card, no second one appears, and a booking never drags it back to Demo Booked. A lead whose last card was marked Lost gets a fresh one in Demo Requested. A customer's card is Won, not open, so an expansion request gets its own card, which is right, but routing also moves the contact from Leo to the rep. The SOP says the rep hands the contact back to Leo after the demo.",
    },
    {
      title: 'A quote in a company name',
      body: 'The Raw Body is a text template, so a double quote in a company name can break the JSON, and Slack answers 400. Execution Logs shows the failed request, and the in-app alert does not depend on Slack, so the owner still hears about the request.',
    },
  ],
  qa: [
    'One test contact per size band plus a Gmail address: Fit Score and Segment match the code, the right rep owns the contact, and one card sits in Demo Requested with that rep as its owner',
    'Execution Logs for a new contact: Find Opportunity takes Opportunity Not Found once, Create Opportunity runs once, and the Go To comes back to Opportunity Found, with no loop',
    'A test contact with a Lost card gets a new card in Demo Requested; one with an open card in Trial Sales-Assist gets no second card, and a booking leaves it where it is',
    'The Slack post shows segment, fit, owner, source and UTM, and no email or phone',
    "Book from the thank-you page as a mid-market test contact: only Ben's times show, 01a adds demo-booked, the card moves to Demo Booked and no task appears. A rep booking for another test contact from the contact record gets it tagged too",
    'Leave a test contact unbooked: at the next weekday business hours the right rep gets the task and the follow-up goes out from that rep, with the postal address and the unsubscribe link in the footer',
    'Reply to the invite email: Enrollment History shows the contact left the workflow, and no follow-up is sent',
    'Submit the form twice in a row: one enrollment, one card, one invite email. Every merge field and the trigger link render in Gmail, Outlook, the in-app notification and Slack',
  ],
  snippets: [
    {
      title: 'Fit score and segment (Custom Code step)',
      language: 'javascript',
      code: fitCode,
      note: 'Properties are added in the step and read as inputData.<key>. The object assigned to output becomes the step output; Update Contact Field saves it to the contact.',
    },
    {
      title: 'Slack post (Custom Webhook, Raw Body)',
      language: 'json',
      code: slackBody,
      note: "Event CUSTOM, Method POST, Content-Type application/json, sent to the #demo-requests incoming-webhook URL. The top-level text is what Slack shows in notifications; the blocks are what the channel sees.",
    },
    {
      title: 'Routing rules agreed with sales',
      language: 'text',
      code: routingTable,
      note: 'The table the reps signed off on. The Custom Code step is this table, and nothing else.',
    },
  ],
  features: [
    'Form Submitted',
    'Remove Contact Tag',
    'Custom Code',
    'Update Contact Field',
    'If/Else',
    'Assign To User',
    'Send Email',
    'Trigger Links',
    'Find Opportunity',
    'Create Opportunity',
    'Internal Notification',
    'Custom Webhook',
    'Go To',
    'Wait · Specific conditions to be met',
    'Wait · Advance Window',
    'Update Opportunity',
    'Add Task',
    'Stop on Response',
    'Round Robin calendar · Always Book with Assigned User',
  ],
};
