import type { Automation, Contact } from '@/lib/ghl/types';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Same logic as the Custom Code step below, so the simulator scores exactly like the build. */
function score(c: Contact) {
  const service = String(c.fields.service_needed ?? '').toLowerCase();
  const age = String(c.fields.roof_age ?? '');
  let s = 20;
  if (service.includes('storm')) s += 35;
  else if (service.includes('replacement')) s += 30;
  else if (service.includes('leak')) s += 25;
  if (age === 'Over 20 years') s += 25;
  else if (age === '10-20 years') s += 15;
  if (String(c.source ?? '').toLowerCase().includes('facebook')) s -= 5;
  s = Math.max(0, Math.min(100, s));
  return { lead_score: s, call_within: s >= 70 ? '15 minutes' : '1 hour' };
}

const scoreCode = `// Custom Code step, JavaScript. Properties added in the step:
//   service  = {{contact.service_needed}}
//   roof_age = {{contact.roof_age}}
//   source   = {{contact.source}}
// GHL wraps this in an async function and reads the result from \`output\`.
const service = (inputData.service || '').toLowerCase();
const age = inputData.roof_age || '';

let score = 20;
if (service.includes('storm')) score += 35;
else if (service.includes('replacement')) score += 30;
else if (service.includes('leak')) score += 25;

if (age === 'Over 20 years') score += 25;
else if (age === '10-20 years') score += 15;

// Lead-ad leads convert lower than form fills for this client.
if ((inputData.source || '').toLowerCase().includes('facebook')) score -= 5;

score = Math.max(0, Math.min(100, score));
output = {
  lead_score: score,
  call_within: score >= 70 ? '15 minutes' : '1 hour',
};`;

export const speedToLead: Automation = {
  id: 'speed-to-lead',
  number: '01',
  name: 'Speed to lead',
  kicker: 'Lead intake',
  tagline: 'Every new lead gets a text, an email, an owner and a call task within seconds, and a person takes over the moment they reply.',
  problem: 'Leads from the website and Facebook sat in the inbox until someone noticed. By the time a rep called, the homeowner had booked another roofer.',
  evidence: {
    text: 'Companies that tried to reach a web lead within an hour were nearly seven times as likely to qualify it as those that waited even one hour longer, and over sixty times as likely as those that waited a day or more.',
    source: 'Oldroyd, McElheran and Elkington, “The Short Life of Online Sales Leads,” Harvard Business Review, March 2011',
    href: 'https://hbr.org/2011/03/the-short-life-of-online-sales-leads',
  },
  solution:
    'One workflow for both lead sources: it creates the opportunity, scores the lead, assigns a rep by round robin and pings them, then follows up by text and email for a week. It respects SMS consent and quiet hours, stops the moment the lead replies, and steps aside as soon as they book.',
  workflow: {
    name: '01 · Lead Intake · Speed to Lead',
    folder: 'Lead Intake',
    triggers: [
      { title: 'Form Submitted', filters: ['Form is Free Roof Inspection'], label: 'Form Submitted (website)' },
      { title: 'Facebook Lead Form Submitted', filters: ['Page is Harbor & Pine Roofing', 'Form is Storm Inspection 2026'], label: 'Facebook Lead Form Submitted' },
    ],
    settings: {
      allowReEntry: false,
      stopOnResponse: true,
      timezone: 'contact',
      exits: [
        {
          event: 'appointment_booked',
          by: 'Booking fires 03 · Inspection Booked, whose first step is Remove from Workflow: 01 · Speed to Lead. No more "are you still interested?" texts to someone who already booked.',
        },
      ],
    },
    steps: [
      {
        id: 'opp',
        kind: 'action',
        action: 'create_opportunity',
        title: 'Create Opportunity',
        label: 'New lead',
        summary: 'Roofing Sales › New Lead, named after the contact and the service they asked for. Duplicate opportunities off.',
        effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open' } },
      },
      {
        id: 'score',
        kind: 'action',
        action: 'custom_code',
        title: 'Custom Code',
        label: 'Lead score',
        summary: 'Scores the lead 0 to 100 from the service, roof age and source, and sets how fast the rep should call.',
        run: ({ contact }) => {
          const out = score(contact);
          return { vars: out, log: `Returned lead_score ${out.lead_score} and call_within "${out.call_within}".` };
        },
        code: { language: 'javascript', source: scoreCode },
      },
      {
        id: 'save-score',
        kind: 'action',
        action: 'update_field',
        title: 'Update Contact Field',
        label: 'Save the score',
        summary: 'Writes the code output to Lead Score and Call Priority, so reports, filters and later steps can use it.',
        run: ({ vars }) => ({ effect: { fields: { lead_score: vars.lead_score, call_priority: vars.call_within } } }),
      },
      {
        id: 'assign',
        kind: 'action',
        action: 'assign_user',
        title: 'Assign To User',
        label: 'Round robin',
        summary: 'Maya and Luis, split equally. Only Apply to Unassigned Contacts is on, so a returning customer keeps their rep.',
        run: ({ contact }) => {
          if (contact.assignedTo) return { log: `Already assigned, so the owner stays the same.` };
          const who = [...`${contact.firstName}${contact.lastName}`].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2 ? 'luis' : 'maya';
          return { effect: { assignTo: who }, log: `Next in the rotation: ${who === 'maya' ? 'Maya Ortiz' : 'Luis Grant'}.` };
        },
      },
      {
        id: 'notify',
        kind: 'action',
        action: 'internal_notification',
        title: 'Internal Notification',
        label: 'Tell the rep',
        summary: 'In-app and email to the user assigned to this contact, with the score and how fast to call.',
        message: {
          channel: 'internal',
          to: '{{user.name}} (assigned user)',
          subject: 'New lead: {{contact.name}}, score {{contact.lead_score}}',
          body: '{{contact.service_needed}}, roof {{contact.roof_age}}. Call within {{contact.call_priority}}: {{contact.phone}}',
        },
      },
      {
        id: 'email-1',
        kind: 'action',
        action: 'send_email',
        title: 'Send Email',
        label: 'Request received',
        summary: 'Confirms the request, says who will call and links the booking page.',
        message: {
          channel: 'email',
          subject: 'Your free roof inspection request',
          body: 'Hi {{contact.first_name}},\n\nThanks for reaching out to Harbor & Pine Roofing. {{user.first_name}} will call you from {{custom_values.office_phone}} to set up your free inspection. If it is easier, pick a time yourself: {{custom_values.booking_link}}\n\nAn inspection takes about 45 minutes. You get photos of anything we find and a written estimate.',
        },
      },
      {
        id: 'can-text',
        kind: 'ifelse',
        title: 'If/Else',
        label: 'Can we text?',
        branches: [
          {
            label: 'SMS consent',
            when: {
              type: 'all',
              label: 'SMS Consent is Yes, and the contact is not DND for SMS',
              of: [
                { type: 'field', key: 'sms_consent', op: 'eq', value: 'Yes' },
                { type: 'not', of: { type: 'dnd', channel: 'sms' } },
              ],
            },
            nodes: [
              {
                id: 'quiet',
                kind: 'wait',
                title: 'Wait',
                label: 'Quiet hours',
                mode: 'time',
                minutes: 0,
                window: { start: '08:00', end: '20:00', days: ALL_WEEK },
                summary: "No delay, but its Advance Window only resumes between 8 AM and 8 PM in the contact's time zone, so a lead at midnight gets their text at 8 AM.",
              },
              {
                id: 'sms-1',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Instant reply',
                summary: 'From the rep, with the booking link and the opt-out line.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, it's {{user.first_name}} at Harbor & Pine Roofing. Got your inspection request. Pick a time here: {{custom_values.booking_link}} or reply with a good time to call. Reply STOP to opt out.",
                },
              },
              { id: 'wait-15', kind: 'wait', title: 'Wait', mode: 'time', minutes: 15, summary: 'Gives them a moment to reply or book before a person calls.' },
              {
                id: 'task-call',
                kind: 'action',
                action: 'add_task',
                title: 'Add Task',
                label: 'Call now',
                summary: 'Call task for the assigned rep, due within the Call Priority the score set.',
                run: ({ contact }) => ({ log: `Task for the owner: call ${contact.firstName} within ${contact.fields.call_priority}.` }),
              },
              { id: 'wait-1d', kind: 'wait', title: 'Wait', mode: 'time', minutes: DAY, summary: 'One day.' },
              {
                id: 'sms-2',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Nudge',
                summary: 'Short, from the same rep, one link.',
                message: {
                  channel: 'sms',
                  body: 'Hi {{contact.first_name}}, {{user.first_name}} again from Harbor & Pine. Still want that free roof inspection? It takes about 45 minutes. Book here: {{custom_values.booking_link}}',
                },
              },
              { id: 'wait-2d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 2 * DAY, summary: 'Two days.' },
              {
                id: 'email-2',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'What we check',
                summary: 'A useful email instead of another "just checking in".',
                message: {
                  channel: 'email',
                  subject: 'What we look for on a free roof inspection',
                  body: 'Hi {{contact.first_name}},\n\nOn every inspection we check shingles and flashing, vents and pipe boots, gutters and the attic for signs of leaks, and we photograph anything that needs attention. No pressure and no cost.\n\nBook a time that suits you: {{custom_values.booking_link}}\n\n{{user.name}}',
                },
              },
              { id: 'wait-4d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 4 * DAY, summary: 'Four days.' },
              {
                id: 'sms-3',
                kind: 'action',
                action: 'send_sms',
                title: 'Send SMS',
                label: 'Last try',
                summary: 'Closes the loop politely. Replies to this one still stop the workflow.',
                message: {
                  channel: 'sms',
                  body: "Hi {{contact.first_name}}, I'll close out your inspection request for now. If you still want one, reply here or book: {{custom_values.booking_link}} Thanks, {{user.first_name}}",
                },
              },
              {
                id: 'tag-cold',
                kind: 'action',
                action: 'add_tag',
                title: 'Add Contact Tag',
                label: 'stl-no-response',
                summary: 'Marks the lead for the no-response report and for 06 · Reactivation later.',
                effect: { addTags: ['stl-no-response'] },
              },
            ],
          },
        ],
        otherwise: {
          label: 'No SMS consent',
          nodes: [
            {
              id: 'task-email-only',
              kind: 'action',
              action: 'add_task',
              title: 'Add Task',
              label: 'Call, no texting',
              summary: 'The rep calls or emails only. The task says so, so nobody texts from their phone.',
              run: ({ contact }) => ({ log: `Task for the owner: call ${contact.firstName} within ${contact.fields.call_priority}. No SMS consent, so no texts.` }),
            },
            { id: 'wait-1d-e', kind: 'wait', title: 'Wait', mode: 'time', minutes: DAY, summary: 'One day.' },
            {
              id: 'email-3',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Follow-up',
              summary: 'Booking link and the office number.',
              message: {
                channel: 'email',
                subject: 'Still want your free inspection, {{contact.first_name}}?',
                body: 'Hi {{contact.first_name}},\n\nWe tried to reach you about your free roof inspection. Pick any open time here: {{custom_values.booking_link}}, or call us at {{custom_values.office_phone}}.\n\n{{user.name}}, Harbor & Pine Roofing',
              },
            },
            { id: 'wait-3d-e', kind: 'wait', title: 'Wait', mode: 'time', minutes: 3 * DAY, summary: 'Three days.' },
            {
              id: 'email-4',
              kind: 'action',
              action: 'send_email',
              title: 'Send Email',
              label: 'Closing the request',
              summary: 'Last email, easy to answer.',
              message: {
                channel: 'email',
                subject: 'Closing out your inspection request',
                body: 'Hi {{contact.first_name}},\n\nI will close out your request for now. If your roof needs a look later, reply to this email or book at {{custom_values.booking_link}}.\n\n{{user.name}}',
              },
            },
            {
              id: 'tag-cold-e',
              kind: 'action',
              action: 'add_tag',
              title: 'Add Contact Tag',
              label: 'stl-no-response',
              summary: 'Same tag as the text path, so reporting counts both.',
              effect: { addTags: ['stl-no-response'] },
            },
          ],
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'replies',
      label: 'Replies within two minutes',
      summary: 'Storm damage, 20+ year roof, ticked SMS consent. Answers the first text.',
      start: 1 * DAY + 14 * 60 + 14,
      contact: { fields: { service_needed: 'Storm damage', roof_age: 'Over 20 years', sms_consent: 'Yes', utm_source: 'google', utm_campaign: 'storm-season' } },
      events: [{ at: 2, type: 'reply', value: 'Yes! Tomorrow after 3 works for me.' }],
      expect: { outcome: 'stopped', visits: ['sms-1', 'notify', 'can-text:0'] },
    },
    {
      id: 'books',
      label: 'Books from the link',
      summary: 'A small leak. Never replies, but books an inspection 38 minutes later.',
      start: 3 * DAY + 10 * 60 + 5,
      contact: { fields: { service_needed: 'Leak or repair', roof_age: '10-20 years', sms_consent: 'Yes', utm_source: 'google', utm_campaign: 'roof-repair' } },
      events: [{ at: 38, type: 'appointment_booked', appointmentAt: DAY + 5 * 60 - 5 }],
      expect: { outcome: 'ended', visits: ['task-call'] },
    },
    {
      id: 'quiet',
      label: 'Never replies',
      summary: 'Wants a full replacement, then goes quiet. Gets the whole week-long follow-up.',
      start: 9 * 60 + 30,
      contact: { fields: { service_needed: 'Full replacement', roof_age: 'Over 20 years', sms_consent: 'Yes', utm_source: 'facebook-ads', utm_campaign: 'spring-replacement' } },
      events: [],
      expect: { outcome: 'completed', visits: ['sms-3', 'tag-cold'], tags: ['stl-no-response'] },
    },
    {
      id: 'late',
      label: 'Submits at 11:48 PM',
      summary: 'The email and the rep alert go out now. The text waits for quiet hours to end.',
      start: 2 * DAY + 23 * 60 + 48,
      contact: { fields: { service_needed: 'Storm damage', roof_age: '10-20 years', sms_consent: 'Yes', utm_source: 'google', utm_campaign: 'storm-season' } },
      events: [{ at: 8 * 60 + 40, type: 'reply', value: 'Morning! Yes please, call me after 10.' }],
      expect: { outcome: 'stopped', visits: ['quiet', 'sms-1'] },
    },
    {
      id: 'no-consent',
      label: 'No SMS consent',
      summary: 'A Facebook lead who left the SMS box unticked. Email and calls only.',
      start: 4 * DAY + 13 * 60 + 20,
      trigger: 1,
      contact: { source: 'Facebook lead ad', fields: { service_needed: 'Storm damage', roof_age: 'Not sure', sms_consent: 'No' } },
      events: [],
      expect: { outcome: 'completed', visits: ['can-text:else', 'email-4'], tags: ['stl-no-response'] },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Service Needed', key: 'service_needed', type: 'Dropdown (single)', note: 'Leak or repair · Storm damage · Full replacement · Not sure yet' },
      { name: 'Roof Age', key: 'roof_age', type: 'Dropdown (single)', note: 'Under 10 years · 10-20 years · Over 20 years · Not sure' },
      { name: 'SMS Consent', key: 'sms_consent', type: 'Checkbox', note: 'Unticked by default, not required to submit' },
      { name: 'Lead Score', key: 'lead_score', type: 'Number', note: 'Written by the Custom Code step' },
      { name: 'Call Priority', key: 'call_priority', type: 'Single line', note: '"15 minutes" or "1 hour"' },
      { name: 'UTM Source / Medium / Campaign', key: 'utm_source', type: 'Single line ×3', note: 'Hidden form fields filled from the URL' },
    ],
    tags: [{ name: 'stl-no-response', note: 'Finished the sequence without replying or booking' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    { title: 'Agree the rules with the owner', body: 'What counts as a lead, who calls, how fast, and when it is too late to text. The answers became the score thresholds, the round robin and an 8 AM to 8 PM texting window: federal quiet hours end at 9 PM, but Florida, Oklahoma and Maryland stop at 8, so the strictest window is the safe default.' },
    { title: 'Data model before workflow', body: 'Custom fields and dropdown options first, spelled exactly as the form shows them, because the scoring code compares strings. Pipeline stages and custom values next, so no message has a hard-coded link or phone number.' },
    { title: 'One workflow, two sources', body: 'The website form and the Facebook lead form both trigger the same workflow, so there is one place to change the follow-up. The form carries hidden UTM fields and an SMS consent box that is unticked and optional.' },
    { title: 'Score with Custom Code', body: 'Three properties go in through inputData, and a score and a call window come out through output. I tested the step with three sample contacts so later steps could map its output, then saved both values to contact fields with Update Contact Field.' },
    { title: 'Route and alert', body: 'Assign To User rotates Maya and Luis equally, but only for unassigned contacts. The internal notification goes to the assigned user, in-app and by email, not by text at midnight.' },
    { title: 'Compliance branch', body: 'An If/Else checks consent and SMS DND. The text path gets a quiet-hours Advance Window and an opt-out line in the first message; the None path is email and phone only.' },
    { title: 'Settings that decide behaviour', body: 'Stop on Response on, so any reply hands the lead to a person. Re-entry off, so a double submit does not double-text. Workflow 03 removes the contact from this one when they book.' },
    { title: 'Test, publish, hand off', body: 'Five test contacts, one per scenario above, checked against Execution Logs and Enrollment History before publishing. Then a short Loom walkthrough and a one-page SOP for the office.' },
  ],
  edgeCases: [
    { title: 'Lead comes in at midnight', body: 'The email and the rep notification go out immediately. The text waits for the Advance Window and goes out at 8 AM.' },
    { title: 'No SMS consent, or DND', body: 'The If/Else sends them down the email-only path, and the call task says "no texting" so nobody texts from a personal phone.' },
    { title: 'They reply on day three', body: 'Stop on Response takes them out wherever they are in the sequence, because they answered a message this workflow sent. The conversation is already assigned to their rep. An out-of-office auto-reply counts too, which is fine here: a person looks at every reply anyway.' },
    { title: 'They book without replying', body: '03 · Inspection Booked removes them from this workflow in its first step, so the follow-ups stop.' },
    { title: 'Double submit', body: 'Re-entry is off and duplicate opportunities are off, so a second click does not create a second text, email or deal.' },
    { title: 'Someone edits the Facebook form', body: 'Meta gives a duplicated form a new ID, which silently breaks the trigger filter. The SOP says to re-select the form in the trigger after any change.' },
  ],
  qa: [
    'Test contact with consent: SMS, email, notification and task arrive, and the score matches the code',
    'Test contact without consent: no SMS is sent, email path runs, and the task says "no texting"',
    'Submit after 9 PM: the SMS shows as waiting in Execution Logs and sends at 8 AM',
    'Reply to the first text: the contact leaves the workflow and the conversation is assigned',
    'Book through the link: the contact is removed by 03 and gets no more follow-ups',
    'Submit twice: one opportunity, one set of messages',
    'Every merge field renders on a real phone and in Gmail and Outlook',
  ],
  snippets: [
    { title: 'Lead score (Custom Code step)', language: 'javascript', code: scoreCode, note: 'Properties are added in the step and read as inputData.<key>. The object assigned to output becomes the step output that later steps can map.' },
    {
      title: 'SMS consent checkbox text',
      language: 'text',
      code: 'I agree to receive text messages from Harbor & Pine Roofing about my inspection request. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Consent is not a condition of purchase.',
      note: 'Unticked by default and not required to submit the form. The same wording goes in the A2P campaign registration.',
    },
  ],
  features: ['Form Submitted', 'Facebook Lead Form Submitted', 'Create Opportunity', 'Custom Code', 'Update Contact Field', 'Assign To User', 'Internal Notification', 'Send Email', 'If/Else', 'Wait · Advance Window', 'Send SMS', 'Add Task', 'Add Contact Tag', 'Stop on Response'],
};
