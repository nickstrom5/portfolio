import type { ActionNode, Automation, Condition, Contact } from '@/lib/ghl/types';

const DAY = 1440;
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Minutes after Monday 00:00 of the sample week. */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;

/** Every email ends with the business name and postal address (CAN-SPAM). GHL adds the unsubscribe link. */
const footer = '\n\n{{location.name}}, {{location.full_address}}';

/**
 * Add Task's Assign To takes one named user, so a task for whoever owns the
 * contact splits on Assigned User first. The simulator reads the owner that
 * the Assign To User step recorded.
 */
const ownerIsLuis: Condition = { type: 'var', key: 'owner', op: 'eq', value: 'luis', label: 'Assigned User is Luis Grant' };

/** The call task, one per estimator. */
const callTask = (id: string, name: string): ActionNode => ({
  id,
  kind: 'action',
  action: 'add_task',
  title: 'Add Task',
  label: `Call task for ${name.split(' ')[0]}`,
  summary: `Assign To ${name}, Due In: Now. Title "Call {{contact.first_name}} within {{contact.call_priority}}". The description has the service, roof age, score and SMS consent, so nobody texts a lead who did not tick the box.`,
  run: ({ contact }) => ({
    log: `Task for ${name}, due now: call ${contact.firstName} within ${contact.fields.call_priority}. SMS consent: ${contact.fields.sms_consent === 'Yes' ? 'yes' : 'no, so call or email only'}.`,
  }),
});

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

// The owner asked for lead-ad leads to rank a little below form fills.
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
  tagline: 'Every new lead gets an email, a text if they asked for one, an owner and a call task within seconds, and a person takes over the moment they reply.',
  problem: 'Leads from the website and Facebook sat in the inbox until someone noticed. By the time a rep called, the homeowner had booked another roofer.',
  evidence: {
    text: 'Companies that tried to reach a web lead within an hour were nearly seven times as likely to qualify it as those that waited even one hour longer, and over sixty times as likely as those that waited a day or more.',
    source: 'Oldroyd, McElheran and Elkington, “The Short Life of Online Sales Leads,” Harvard Business Review, March 2011',
    href: 'https://hbr.org/2011/03/the-short-life-of-online-sales-leads',
  },
  solution:
    'One workflow for both lead sources: it finds or creates the opportunity, scores the lead, assigns a rep by round robin, emails them and gives them a call task, then follows up by text and email for a week. Leads who did not tick the SMS box are switched to email only, and no text goes out before 8 AM. It stops the moment the lead replies, and steps aside as soon as they book.',
  workflow: {
    name: '01 · Lead Intake · Speed to Lead',
    folder: 'Lead Intake',
    triggers: [
      { title: 'Form Submitted', filters: ['Form is Free Roof Inspection'], label: 'Form Submitted (website)' },
      { title: 'Facebook Lead Form Submitted', filters: ['Page is Harbor & Pine Roofing', 'Form is Storm Inspection 2026'], label: 'Facebook Lead Form Submitted' },
    ],
    settings: {
      allowReEntry: true,
      stopOnResponse: true,
      timezone: 'contact',
      exits: [
        {
          event: 'appointment_booked',
          by: 'Booking fires 03 · Inspection Booked, whose first step is Remove from Workflow: 01 · Speed to Lead. No more "are you still interested?" texts to someone who already booked.',
        },
      ],
      notes: [
        'Allow Re-entry on: a past lead who asks again next spring gets a fresh follow-up, and the first step takes them out of 07. GHL never enrolls a contact who is still active in the workflow, so a double submit during the week starts nothing.',
        'Stop on Response on: a reply to any text or email from this workflow hands the lead to their rep.',
        'No workflow Time Window: it would hold the email to the lead too. The texts wait behind their own 8 AM to 8 PM Advance Window.',
        'Allow multiple Opportunities is for opportunity-based triggers. Here Find Opportunity and the Duplicate Opportunity toggle on Create Opportunity decide the card.',
      ],
    },
    steps: [
      {
        id: 'remove',
        kind: 'action',
        action: 'remove_from_workflow',
        title: 'Remove from Workflow',
        label: 'One follow-up at a time',
        summary: 'Another Workflow: 02 · Missed-Call Text-Back and 07 · Database Reactivation. A caller or an old lead who fills in the form gets this follow-up only, not a second one running alongside it.',
      },
      {
        id: 'find-opp',
        kind: 'ifelse',
        title: 'Find Opportunity',
        label: 'Open card already?',
        branches: [
          {
            label: 'Opportunity Found',
            when: { type: 'all', label: 'Latest opportunity in Roofing Sales with Status Open', of: [{ type: 'opportunity', status: 'open' }] },
            nodes: [
              {
                id: 'opp-name',
                kind: 'action',
                action: 'update_opportunity',
                title: 'Update Opportunity',
                label: 'Name the card',
                summary: 'Opportunity Name is {{contact.name}} · {{contact.service_needed}}. A card 02 made from a missed call only had a phone number to go on. Stage, status and source stay as they are.',
                run: ({ contact }) => {
                  const name = `${contact.firstName} ${contact.lastName} · ${contact.fields.service_needed}`;
                  return { effect: { opportunity: { name } }, log: `Found the open card at ${contact.opportunity?.stage}. Renamed it "${name}"; nothing else changed.` };
                },
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
                summary: 'Maya and Luis, Split Traffic Equally. Only Apply to Unassigned Contacts is on, so a returning customer, or a caller 02 already assigned, keeps their rep.',
                run: ({ contact }) => {
                  if (contact.assignedTo) return { vars: { owner: contact.assignedTo }, log: `Already assigned to ${contact.assignedTo === 'maya' ? 'Maya Ortiz' : 'Luis Grant'}, so the owner stays the same.` };
                  const who = [...`${contact.firstName}${contact.lastName}`].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2 ? 'luis' : 'maya';
                  return { effect: { assignTo: who }, vars: { owner: who }, log: `Next in the rotation: ${who === 'maya' ? 'Maya Ortiz' : 'Luis Grant'}.` };
                },
              },
              {
                id: 'notify',
                kind: 'action',
                action: 'internal_notification',
                title: 'Internal Notification',
                label: 'Tell the rep',
                summary: 'Type Email, To User Type Assigned User, with the score and how fast to call. Not a text to the rep at midnight; the call task below is the second channel.',
                message: {
                  channel: 'internal',
                  to: '{{user.name}} (assigned user)',
                  subject: 'New lead: {{contact.name}}, score {{contact.lead_score}}',
                  body: '{{contact.service_needed}}, roof {{contact.roof_age}}, SMS consent {{contact.sms_consent}}. Call within {{contact.call_priority}}: {{contact.phone}}',
                },
              },
              {
                id: 'email-1',
                kind: 'action',
                action: 'send_email',
                title: 'Send Email',
                label: 'Request received',
                summary: 'Confirms the request, says who will call and links the booking page. Every lead gets it, texts or not.',
                message: {
                  channel: 'email',
                  subject: 'Your free roof inspection request',
                  body: `Hi {{contact.first_name}},\n\nThanks for reaching out to Harbor & Pine Roofing. {{user.first_name}} will call you from {{custom_values.office_phone}} to set up your free inspection. If it is easier, pick a time yourself: {{custom_values.booking_link}}\n\nAn inspection takes about 45 minutes. You get photos of anything we find and a written estimate.\n\n{{user.name}}${footer}`,
                },
              },
              {
                id: 'whose',
                kind: 'ifelse',
                title: 'If/Else',
                label: 'Whose call?',
                branches: [
                  {
                    label: 'Luis',
                    when: ownerIsLuis,
                    nodes: [
                      callTask('task-luis', 'Luis Grant'),
                      { id: 'goto-can-text', kind: 'goto', title: 'Go To', target: 'can-text', summary: 'Back to the consent check, so both estimators share one follow-up sequence.' },
                    ],
                  },
                ],
                otherwise: {
                  label: 'Maya',
                  nodes: [
                    callTask('task-maya', 'Maya Ortiz'),
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
                            label: 'SMS consent (service) is Yes, and the contact is not DND for SMS',
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
                              summary: "A set period of time of 0 minutes with an Advance Window: resume between 8 AM and 8 PM in the contact's time zone, so a lead at midnight gets their text at 8 AM.",
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
                              summary: 'Says what the inspection covers instead of another "just checking in".',
                              message: {
                                channel: 'email',
                                subject: 'What we look for on a free roof inspection',
                                body: `Hi {{contact.first_name}},\n\nOn every inspection we check shingles and flashing, vents and pipe boots, gutters and the attic for signs of leaks, and we photograph anything that needs attention. No pressure and no cost.\n\nBook a time that suits you: {{custom_values.booking_link}}\n\n{{user.name}}${footer}`,
                              },
                            },
                            { id: 'wait-4d', kind: 'wait', title: 'Wait', mode: 'time', minutes: 4 * DAY, summary: 'Four days.' },
                            {
                              id: 'sms-3',
                              kind: 'action',
                              action: 'send_sms',
                              title: 'Send SMS',
                              label: 'Last try',
                              summary: 'Closes the loop politely. A reply to this one still stops the workflow.',
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
                              summary: 'Marks the lead for the no-response report and for the 07 · Database Reactivation list later.',
                              effect: { addTags: ['stl-no-response'] },
                            },
                          ],
                        },
                      ],
                      otherwise: {
                        label: 'No consent, or texts off',
                        nodes: [
                          {
                            id: 'dnd-sms',
                            kind: 'action',
                            action: 'dnd',
                            title: 'Enable/Disable DND',
                            label: 'Texts off',
                            summary: 'Direction Outbound, Enable, selected channel SMS. They did not tick the box, so 02, 03 and every later workflow skip texts to them as well. Email and calls stay open.',
                            effect: { dnd: { sms: true } },
                            run: ({ contact }) => ({ log: contact.dnd.sms ? 'SMS DND was already on. The action leaves it on.' : 'SMS DND switched on: no SMS consent on the form.' }),
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
                              body: `Hi {{contact.first_name}},\n\nWe tried to reach you about your free roof inspection. Pick any open time here: {{custom_values.booking_link}}, or call us at {{custom_values.office_phone}}.\n\n{{user.name}}${footer}`,
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
                              body: `Hi {{contact.first_name}},\n\nI will close out your request for now. If your roof needs a look later, reply to this email or book at {{custom_values.booking_link}}.\n\n{{user.name}}${footer}`,
                            },
                          },
                          {
                            id: 'tag-cold-e',
                            kind: 'action',
                            action: 'add_tag',
                            title: 'Add Contact Tag',
                            label: 'stl-no-response',
                            summary: 'Same tag as the text path, so the report counts both.',
                            effect: { addTags: ['stl-no-response'] },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
        otherwise: {
          label: 'Opportunity Not Found',
          nodes: [
            {
              id: 'opp',
              kind: 'action',
              action: 'create_opportunity',
              title: 'Create Opportunity',
              label: 'New lead',
              summary: 'Roofing Sales › New Lead, named {{contact.name}} · {{contact.service_needed}}, Opportunity Source {{contact.source}}. Duplicate Opportunity on: this only runs when there is no open card, and with it off a lead whose only card was lost last year would get none.',
              run: ({ contact }) => {
                const name = `${contact.firstName} ${contact.lastName} · ${contact.fields.service_needed}`;
                const old = contact.opportunity;
                return {
                  effect: { opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open', name } },
                  log: `New card in Roofing Sales › New Lead: "${name}".${old ? ` The ${old.status} card at ${old.stage} stays as it was.` : ''}`,
                };
              },
            },
            { id: 'goto-score', kind: 'goto', title: 'Go To', target: 'score', summary: 'On to the score. Nothing later updates the card, so it does not need to be found again.' },
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
      expect: { outcome: 'stopped', visits: ['remove', 'find-opp:else', 'opp', 'goto-score', 'notify', 'whose:else', 'task-maya', 'can-text:0', 'sms-1'], stage: 'New Lead' },
    },
    {
      id: 'books',
      label: 'Books from the link',
      summary: 'A small leak. Never replies, but books an inspection 38 minutes later.',
      start: 3 * DAY + 10 * 60 + 5,
      contact: { fields: { service_needed: 'Leak or repair', roof_age: '10-20 years', sms_consent: 'Yes', utm_source: 'google', utm_campaign: 'roof-repair' } },
      events: [{ at: 38, type: 'appointment_booked', appointmentAt: DAY + 5 * 60 - 5 }],
      expect: { outcome: 'ended', visits: ['task-maya', 'sms-1'] },
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
      summary: 'The email to the lead, the rep alert and the call task happen now. The text waits for quiet hours to end.',
      start: 2 * DAY + 23 * 60 + 48,
      contact: { fields: { service_needed: 'Storm damage', roof_age: '10-20 years', sms_consent: 'Yes', utm_source: 'google', utm_campaign: 'storm-season' } },
      events: [{ at: 8 * 60 + 40, type: 'reply', value: 'Morning! Yes please, call me after 10.' }],
      expect: { outcome: 'stopped', visits: ['email-1', 'quiet', 'sms-1'] },
    },
    {
      id: 'no-consent',
      label: 'No SMS consent',
      summary: 'A Facebook lead who left the SMS box unticked. SMS DND goes on, and the follow-up is email and calls only.',
      start: 4 * DAY + 13 * 60 + 20,
      trigger: 1,
      contact: { source: 'Facebook lead ad', fields: { service_needed: 'Storm damage', roof_age: 'Not sure', sms_consent: 'No' } },
      events: [],
      expect: { outcome: 'completed', visits: ['can-text:else', 'dnd-sms', 'email-3', 'email-4'], tags: ['stl-no-response'] },
    },
    {
      id: 'called-first',
      label: 'Called first, then filled in the form',
      summary: 'Missed the office on Wednesday night, so 02 texted back and made a New Lead card for Luis. Fills in the form on Thursday morning: 02 lets go, the card gets a name instead of a second card, and Luis keeps the lead.',
      start: at(3, 9, 5),
      contact: {
        phone: '(847) 555-0133',
        source: 'Inbound call',
        assignedTo: 'luis',
        tags: ['missed-call'],
        opportunity: { pipeline: 'Roofing Sales', stage: 'New Lead', status: 'open', name: '(847) 555-0133' },
        fields: { service_needed: 'Leak or repair', roof_age: 'Over 20 years', sms_consent: 'Yes' },
      },
      events: [{ at: 6, type: 'reply', value: 'Yes, that was me calling last night. Tomorrow afternoon works.' }],
      expect: { outcome: 'stopped', visits: ['remove', 'find-opp:0', 'opp-name', 'whose:0', 'task-luis', 'goto-can-text', 'sms-1'], stage: 'New Lead' },
    },
  ],
  dataModel: {
    customFields: [
      { name: 'Service Needed', key: 'service_needed', type: 'Dropdown (single)', note: 'Leak or repair · Storm damage · Full replacement · Not sure yet' },
      { name: 'Roof Age', key: 'roof_age', type: 'Dropdown (single)', note: 'Under 10 years · 10-20 years · Over 20 years · Not sure' },
      { name: 'SMS consent (service)', key: 'sms_consent', type: 'Checkbox', note: 'The first box: inspection texts. Unticked by default, not required to submit. The If/Else reads it' },
      { name: 'SMS consent (offers)', key: 'sms_marketing_consent', type: 'Checkbox', note: 'The second box: offers and seasonal reminders. Only 07 reads it' },
      { name: 'Lead Score', key: 'lead_score', type: 'Number', note: 'Written by the Custom Code step' },
      { name: 'Call Priority', key: 'call_priority', type: 'Single line', note: '"15 minutes" or "1 hour"' },
      { name: 'UTM Source / Medium / Campaign', key: 'utm_source', type: 'Single line ×3', note: 'Hidden form fields filled from the URL' },
    ],
    tags: [{ name: 'stl-no-response', note: 'Finished the sequence without replying or booking. One of the two lists 07 starts from' }],
    pipeline: { name: 'Roofing Sales', stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'] },
    customValues: [
      { name: 'Booking Link', key: 'booking_link', value: 'harborpine.example/book' },
      { name: 'Office Phone', key: 'office_phone', value: '(312) 555-0142' },
    ],
  },
  build: [
    { title: 'Agree the rules with the owner', body: 'What counts as a lead, who calls, how fast, and when it is too late to text. The answers became the score thresholds, the round robin and an 8 AM to 8 PM texting window: federal quiet hours end at 9 PM, but Florida, Oklahoma and Maryland stop at 8, so the strictest window is the safe default.' },
    { title: 'Data model before workflow', body: 'Custom fields and dropdown options first, spelled exactly as the form shows them, because the scoring code compares strings. Pipeline stages and custom values next, so no message has a hard-coded link or phone number.' },
    { title: 'One workflow, two sources', body: 'The website form and the Facebook lead form both trigger the same workflow, so there is one place to change the follow-up. The form carries hidden UTM fields and two SMS consent boxes, service and offers, both unticked and optional.' },
    { title: 'Clear the way, then find the card', body: 'The first step removes the contact from 02 · Missed-Call Text-Back and 07 · Database Reactivation, so a caller or an old lead who fills in the form gets one follow-up, not two. Find Opportunity then looks for the latest open Roofing Sales card. If 02 already made one from a missed call, Update Opportunity gives it the name and service. If not, Create Opportunity makes one at New Lead with Duplicate Opportunity on, because GHL checks duplicates by contact, and with it off a lead whose only card was lost last year would get none. A Go To joins the two paths at the score.' },
    { title: 'Score with Custom Code', body: 'Three properties go in through inputData, and a score and a call window come out through output. I tested the step with three sample contacts so later steps could map its output, then saved both values to contact fields with Update Contact Field.' },
    { title: 'Route, alert, and one task per rep', body: 'Assign To User rotates Maya and Luis equally, only for unassigned contacts. The alert is an Internal Notification of type Email to the assigned user, not a text at midnight. Add Task takes one named user, so an If/Else on Assigned User gives Maya a task for her leads and Luis one for his, due now, and a Go To puts Luis\'s leads back on the shared sequence.' },
    { title: 'Compliance branch', body: 'An If/Else checks SMS consent (service) and SMS DND. The text path waits for an 8 AM to 8 PM Advance Window and carries the opt-out line in the first text. The other path turns on SMS DND with Enable/Disable DND, so no later workflow texts someone who did not tick the box, and follows up by email and phone.' },
    { title: 'Settings that decide behavior', body: 'Stop on Response on, so any reply hands the lead to a person. Re-entry on, so a lead who asks again after a finished run is followed up again; GHL does not enroll a contact who is still active, so a double submit does not double-text. 03 removes the contact from this workflow when they book.' },
    { title: 'Test, publish, hand off', body: 'Six test contacts, one per scenario above, checked against Execution Logs and Enrollment History before publishing. Then a short Loom walkthrough and a one-page SOP for the office.' },
  ],
  edgeCases: [
    { title: 'Lead comes in at midnight', body: 'The email to the lead, the rep\'s email alert and the call task happen immediately. The text waits for the Advance Window and goes out at 8 AM.' },
    { title: 'No SMS consent, or DND', body: 'The If/Else sends them down the email path, which turns SMS DND on first, so 02, 03 and the rest skip texts to them too. Ticking the box on a later form does not turn texts back on by itself: the office checks the new consent and switches SMS DND off by hand.' },
    { title: 'They reply on day three', body: 'Stop on Response takes them out wherever they are in the sequence, because they answered a message this workflow sent. The conversation is already assigned to their rep. An out-of-office auto-reply counts too, which is fine here: a person looks at every reply anyway.' },
    { title: 'They book without replying', body: '03 · Inspection Booked removes them from this workflow in its first step, so the follow-ups stop.' },
    { title: 'Called first, then filled in the form', body: '02 made a New Lead card from the missed call and may still be waiting to send its own follow-up. The first step takes them out of 02, Find Opportunity finds that card and renames it, and Only Apply to Unassigned Contacts keeps the rep 02 assigned.' },
    { title: 'Double submit', body: 'The first run is still active, and GHL does not enroll a contact twice in the same workflow, so the second submit starts nothing. One text, one email, one deal.' },
    { title: 'Asks again next year', body: 'Re-entry is on, so the new request gets the full follow-up. Their old card is Abandoned or Lost, so Find Opportunity finds nothing open and Create Opportunity adds a new one, with Duplicate Opportunity on. If they were in the middle of 07, the first step takes them out.' },
    { title: 'Someone edits the Facebook form', body: 'Meta gives a duplicated form a new ID, which silently breaks the trigger filter. The SOP says to re-select the form in the trigger after any change.' },
  ],
  qa: [
    'Test contact with consent: email, rep alert, task and SMS arrive, and the score matches the code',
    'Test contact without consent: SMS DND is on, no SMS is sent, the email path runs, and the task shows SMS consent No',
    'One test lead for each rep: the task goes to the rep who owns the contact, and both reach the same texts',
    'Submit after 8 PM: the SMS shows as waiting in Execution Logs and sends at 8 AM',
    'Reply to the first text: the contact leaves the workflow and the conversation is assigned',
    'Book through the link: the contact is removed by 03 and gets no more follow-ups',
    'Miss a call from a test phone, then submit the form from it: 02 shows the contact as removed, one card, renamed, same rep',
    'Submit twice: one opportunity, one set of messages',
    'Every merge field renders on a real phone and in Gmail and Outlook, and every email ends with the postal address',
  ],
  snippets: [
    { title: 'Lead score (Custom Code step)', language: 'javascript', code: scoreCode, note: 'Properties are added in the step and read as inputData.<key>. The object assigned to output becomes the step output that later steps can map.' },
    {
      title: 'SMS consent checkboxes on the form',
      language: 'text',
      code: 'Box 1 (SMS consent, service):\nText me about my inspection request: scheduling, reminders and updates from Harbor & Pine Roofing. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.\n\nBox 2 (SMS consent, offers):\nAlso text me occasional offers and seasonal roof reminders. Reply STOP to opt out.\n\nUnder both: Consent is optional and not a condition of purchase. Privacy Policy · Terms of Service',
      note: 'Both boxes are unticked by default and neither is required to submit. The same wording goes in the A2P campaign registration.',
    },
  ],
  features: [
    'Form Submitted',
    'Facebook Lead Form Submitted',
    'Remove from Workflow',
    'Find Opportunity',
    'Update Opportunity',
    'Create Opportunity',
    'Go To',
    'Custom Code',
    'Update Contact Field',
    'Assign To User',
    'Internal Notification',
    'Send Email',
    'If/Else',
    'Add Task',
    'Wait · Advance Window',
    'Send SMS',
    'Enable/Disable DND',
    'Add Contact Tag',
    'Stop on Response',
  ],
};
