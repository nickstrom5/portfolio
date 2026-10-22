import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
/** Minutes after Monday 00:00 of the sample week (Mon Mar 2, 2026). */
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

/** The Form Trigger names each answer after its field label, plus submittedAt and formMode. */
export const formItem = (a: Record<string, string>, submittedAt: string): Item =>
  item({
    'Business name': a.business ?? '',
    'Your name': a.name ?? '',
    Email: a.email ?? '',
    'Business type': a.type ?? 'Café or coffee shop',
    'Coffee per week (lbs)': a.lbs ?? '0',
    'City and state': a.city ?? '',
    'Mostly espresso or brewed?': a.focus ?? 'About half and half',
    'Anything else?': a.note ?? '',
    submittedAt,
    formMode: 'production',
  });

const TYPE_POINTS: Record<string, number> = { 'Café or coffee shop': 25, Restaurant: 15, 'Grocery or retail': 15, Office: 10 };

/** Same logic as the Code node below, so the simulator scores exactly like the build. */
function score(j: Json) {
  const lbs = Number(j.lbs_per_week) || 0;
  let s = Math.min(Math.round(lbs * 1.2), 60);
  s += TYPE_POINTS[String(j.business_type)] ?? 5;
  if (j.focus === 'Mostly espresso') s += 15;
  s = Math.min(s, 100);
  const tier = lbs >= 30 || s >= 70 ? 'priority' : lbs >= 10 ? 'standard' : 'small';
  return { fit_score: s, tier };
}

const scoreCode = `// Code node, JavaScript, Mode: Run Once for Each Item.
// $input.item is the item being processed; return one item back.
const j = $input.item.json;
const lbs = Number(j.lbs_per_week) || 0;

// Volume carries most of the score. Wholesale pricing starts at 10 lb a week,
// and 50 lb a week is a café that reorders every Monday.
let score = Math.min(Math.round(lbs * 1.2), 60);

const typePoints = {
  'Café or coffee shop': 25,
  'Restaurant': 15,
  'Grocery or retail': 15,
  'Office': 10,
};
score += typePoints[j.business_type] ?? 5;

// Espresso bars reorder like clockwork and need the most training, so
// Maya wants to meet them in person.
if (j.focus === 'Mostly espresso') score += 15;
score = Math.min(score, 100);

const tier = lbs >= 30 || score >= 70 ? 'priority'
  : lbs >= 10 ? 'standard'
  : 'small';

return { json: { ...j, fit_score: score, tier } };`;

/** The lead as the Code node left it; every later node reads it with $('Score the fit').item. */
const lead = (ctx: RunContext) => ctx.$('Score the fit')[0]?.json ?? {};

const slackBlocks = `{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "Wholesale lead: {{ $('Score the fit').item.json.business_name }}" } },
    { "type": "section", "fields": [
      { "type": "mrkdwn", "text": "*Who*\\n{{ $('Score the fit').item.json.contact_name }}" },
      { "type": "mrkdwn", "text": "*Where*\\n{{ $('Score the fit').item.json.location }}" },
      { "type": "mrkdwn", "text": "*Volume*\\n{{ $('Score the fit').item.json.lbs_per_week }} lb a week, {{ $('Score the fit').item.json.focus }}" },
      { "type": "mrkdwn", "text": "*Fit*\\n{{ $('Score the fit').item.json.fit_score }}/100" }
    ] },
    { "type": "section", "text": { "type": "mrkdwn", "text": "{{ $('Score the fit').item.json.message || '_No message_' }}" } }
  ]
}`;

export const wholesaleInquiry: Automation = {
  id: 'wholesale-inquiry',
  number: '01',
  name: 'Wholesale inquiry',
  kicker: 'Lead intake',
  tagline: 'A café fills in the wholesale form. Within a minute it is in HubSpot with a fit score, and it has an answer that suits its size: a call with the owner, the price list, or a pointer to the subscription.',
  problem:
    'Wholesale inquiries arrived as contact-form emails in a shared inbox. Maya answered the big ones when she saw them and the rest when she had time, which could be a week. Nothing reached the CRM unless someone typed it in, and a café doing 60 pounds a week got the same wait as an office ordering four.',
  solution:
    'The website links to an n8n form. Edit Fields cleans the answers, a Code node scores the fit from volume, type of business and espresso focus, and HubSpot gets the contact, created or updated by email. A Switch then answers by tier: priority leads go to #wholesale and get a personal note from Maya with a booking link; standard ones get the price list attached from Google Drive; small ones are pointed to the café subscription. If HubSpot is down, the error output posts to Slack so someone adds the lead by hand, and the café still gets its email.',
  workflow: {
    name: '01 · Wholesale · Inquiry intake',
    folder: 'Copperleaf / Wholesale',
    tags: ['wholesale', 'form'],
    trigger: {
      id: 'form',
      name: 'Wholesale inquiry form',
      type: 'n8n Form Trigger',
      icon: 'form',
      tone: 'trigger',
      summary: 'Hosted by n8n at its production URL, linked from the Wholesale page. Eight fields, five required. Respond When: Form Is Submitted, so the café sees the thank-you page at once while the workflow runs.',
      params: [
        { k: 'Form Title', v: 'Wholesale coffee for your business' },
        { k: 'Respond When', v: 'Form Is Submitted' },
        { k: 'Options', v: 'Append n8n Attribution off · Ignore Bots on · Use Workflow Timezone on' },
      ],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/New_York',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'Timezone America/New_York, the roastery’s, with Use Workflow Timezone on in the form, so submittedAt reads in local time in HubSpot and Slack.',
        'Save successful production executions is on. At a few inquiries a day the history costs nothing and answers “did this café ever get an email?”',
        'No error workflow: the one external call that can fail, HubSpot, has its own error output. A failure anywhere else shows in Executions, which Sam checks each Monday.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'clean',
          name: 'Clean up the answers',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'Manual Mapping, Include Other Input Fields off. Renames the form’s labels to snake_case keys, trims and lowercases the email, and makes the weekly volume a Number, so nothing later depends on how a label is worded.',
          params: [
            { k: 'email', v: "{{ $json.Email.trim().toLowerCase() }}" },
            { k: 'first_name', v: "{{ $json['Your name'].trim().split(' ')[0] }}" },
            { k: 'lbs_per_week (Number)', v: "{{ Number($json['Coffee per week (lbs)']) }}" },
            { k: 'submitted_at', v: '{{ $json.submittedAt }}' },
          ],
          run: (items) => ({
            items: items.map((it) => {
              const j = it.json as Record<string, string>;
              const name = String(j['Your name'] ?? '').trim();
              return item({
                business_name: String(j['Business name'] ?? '').trim(),
                contact_name: name,
                first_name: name.split(' ')[0] || 'there',
                email: String(j.Email ?? '').trim().toLowerCase(),
                business_type: j['Business type'],
                lbs_per_week: Number(j['Coffee per week (lbs)']) || 0,
                location: String(j['City and state'] ?? '').trim(),
                focus: j['Mostly espresso or brewed?'],
                message: String(j['Anything else?'] ?? '').trim(),
                submitted_at: j.submittedAt,
                source: 'wholesale-form',
              });
            }),
            log: 'Nine fields, typed and trimmed.',
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'score',
          name: 'Score the fit',
          type: 'Code',
          operation: 'JavaScript · Run Once for Each Item',
          icon: 'code',
          tone: 'core',
          summary: 'Scores 0 to 100 from pounds a week, type of business and espresso focus, and picks a tier: priority (30 lb or more, or 70 points), standard (10 lb or more) or small. The weights are in one place, so Maya can change them without touching anything else.',
          code: { language: 'javascript', source: scoreCode },
          run: (items) => {
            const out = items.map((it) => item({ ...it.json, ...score(it.json) }));
            const j = out[0]?.json ?? {};
            return { items: out, log: `fit_score ${j.fit_score}, tier “${j.tier}”.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'hubspot',
          name: 'Add to HubSpot',
          type: 'HubSpot',
          operation: 'Contact › Create or Update',
          icon: 'user',
          tone: 'app',
          summary: 'Matches on email, so a café that writes twice updates one contact instead of making two. Sets company, lifecycle stage Lead and two custom properties, fit score and pounds a week. On Error is Continue (using error output): if HubSpot fails, the item leaves through the Error output instead of stopping the run.',
          credential: 'Copperleaf HubSpot (app token)',
          settings: { onError: 'error-output' },
          params: [
            { k: 'Email', v: '{{ $json.email }}' },
            { k: 'Company Name', v: '{{ $json.business_name }}' },
            { k: 'Lifecycle Stage', v: 'Lead' },
            { k: 'Custom Properties', v: 'wholesale_fit_score = {{ $json.fit_score }} · lbs_per_week = {{ $json.lbs_per_week }}' },
          ],
          run: (items, ctx) =>
            ({
              items: items.map(() => item({ vid: Number(ctx.fixtures.hubspotId ?? 90412), isNew: ctx.fixtures.hubspotNew !== false })),
              log: ctx.fixtures.hubspotNew === false ? `Found contact ${ctx.fixtures.hubspotId} by email and updated it.` : `New contact ${ctx.fixtures.hubspotId ?? 90412}.`,
            }),
        },
        branches: [
          { label: 'Success', steps: [], joins: true },
          {
            label: 'Error',
            rule: 'HubSpot answered with an error. The item carries it and goes on.',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'slack-hubspot',
                  name: 'Tell #wholesale HubSpot missed it',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Copperleaf Slack (bot)',
                  summary: 'Names the café and the error, and says the reply email is still going out, so nobody writes to them twice. Sam adds the contact by hand.',
                  params: [
                    { k: 'Channel', v: vars.wholesale_channel },
                    { k: 'Text', v: "HubSpot did not take {{ $('Score the fit').item.json.business_name }}: {{ $json.error.message }}" },
                  ],
                  run: (items, ctx) => {
                    const l = lead(ctx);
                    const err = (items[0]?.json.error as { message?: string } | undefined)?.message ?? 'unknown error';
                    return {
                      items: items.map(() => item({ ok: true, channel: 'C04WHOLESALE', ts: '1772462460.104519' })),
                      messages: [{ channel: 'slack', to: vars.wholesale_channel, body: `HubSpot did not take ${l.business_name} (${l.email}): ${err}. Please add them by hand. Their reply email is still going out.` }],
                    };
                  },
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'merge',
          name: 'Carry on either way',
          type: 'Merge',
          operation: 'Append',
          icon: 'merge',
          tone: 'flow',
          summary: 'Input 1 is the Success output, input 2 the Slack post after an error. Only one of them ever gets the item, and Append passes on whatever arrived, so the café is answered whether or not HubSpot was up.',
          params: [{ k: 'Mode', v: 'Append' }],
          run: (items) => ({ items, log: 'One item in, one item out.' }),
        },
      },
      {
        kind: 'split',
        node: {
          id: 'route',
          name: 'Route by tier',
          type: 'Switch',
          operation: 'Rules',
          icon: 'switch',
          tone: 'logic',
          summary: 'Reads the tier back from the Code node with $(), since the items arriving here are HubSpot’s answer or the Slack post, not the lead. Fallback Output: Extra Output, named Small.',
          params: [
            { k: 'Value', v: "{{ $('Score the fit').item.json.tier }}" },
            { k: 'Rules', v: 'is equal to priority · is equal to standard' },
            { k: 'Fallback Output', v: 'Extra Output (Small)' },
          ],
          run: (items, ctx) => {
            const tier = String(lead(ctx).tier);
            const i = tier === 'priority' ? 0 : tier === 'standard' ? 1 : 2;
            return { outputs: [0, 1, 2].map((k) => (k === i ? items : [])), log: `Tier “${tier}”.` };
          },
        },
        branches: [
          {
            label: 'Priority',
            rule: 'tier is equal to priority',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'slack-priority',
                  name: 'Post to #wholesale',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Copperleaf Slack (bot)',
                  summary: 'Block Kit message with who, where, volume, score and their note, so Maya can decide on her phone whether to call before her email lands.',
                  params: [
                    { k: 'Channel', v: vars.wholesale_channel },
                    { k: 'Message Type', v: 'Blocks' },
                  ],
                  code: { language: 'json', source: slackBlocks },
                  run: (items, ctx) => {
                    const l = lead(ctx);
                    return {
                      items: items.map(() => item({ ok: true, channel: 'C04WHOLESALE', ts: '1772462461.209337' })),
                      messages: [{ channel: 'slack', to: vars.wholesale_channel, subject: `Wholesale lead: ${l.business_name}`, body: `${l.contact_name}, ${l.location}\n${l.lbs_per_week} lb a week, ${String(l.focus).toLowerCase()}\nFit ${l.fit_score}/100${l.message ? `\n“${l.message}”` : ''}` }],
                    };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'mail-priority',
                  name: 'Note from Maya',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Maya’s Gmail (OAuth2)',
                  summary: 'Sent from Maya’s own Gmail, so the reply reaches her. Plain text, one link to book a call and taste samples, and Append n8n Attribution turned off: by default the Gmail node adds a “sent automatically with n8n” line.',
                  params: [
                    { k: 'To', v: "{{ $('Score the fit').item.json.email }}" },
                    { k: 'Subject', v: "Coffee for {{ $('Score the fit').item.json.business_name }}" },
                    { k: 'Email Type', v: 'Text' },
                    { k: 'Options', v: 'Append n8n Attribution off · Sender Name Maya Okoye' },
                  ],
                  run: (items, ctx) => {
                    const l = lead(ctx);
                    return {
                      items: items.map(() => item({ id: '18e0c4a9d1f2b7c3', threadId: '18e0c4a9d1f2b7c3', labelIds: ['SENT'] })),
                      messages: [
                        {
                          channel: 'email',
                          to: String(l.email),
                          subject: `Coffee for ${l.business_name}`,
                          body: `Hi ${l.first_name},\n\nThanks for reaching out about wholesale. At ${l.lbs_per_week} pounds a week we would love to roast for ${l.business_name}.\n\nThe best next step is a short call and a box of samples, so you can taste three of our espresso and filter roasts on your own equipment. Pick a time here: ${vars.booking_link}\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville`,
                        },
                      ],
                    };
                  },
                },
              },
            ],
          },
          {
            label: 'Standard',
            rule: 'tier is equal to standard',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'drive',
                  name: 'Get the price list',
                  type: 'Google Drive',
                  operation: 'File › Download',
                  icon: 'folder',
                  tone: 'app',
                  credential: 'Copperleaf Google (OAuth2)',
                  summary: 'Downloads the current price list PDF by file ID into binary property data. Maya replaces the file in Drive when prices change, and the workflow never needs editing.',
                  params: [
                    { k: 'File', v: `By ID · ${vars.price_list_file}` },
                    { k: 'Put Output File in Field', v: 'data' },
                  ],
                  run: (items) => ({
                    items: items.map((it) => ({ json: it.json, binary: { data: { fileName: vars.price_list_file, mimeType: 'application/pdf', fileSize: '412 kB' } } })),
                    log: `Binary “data”: ${vars.price_list_file}, 412 kB.`,
                  }),
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'mail-standard',
                  name: 'Send the price list',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Maya’s Gmail (OAuth2)',
                  summary: 'Attachments: data, the PDF from the step before. Same sender and settings as Maya’s note, and an offer of samples rather than a call.',
                  params: [
                    { k: 'To', v: "{{ $('Score the fit').item.json.email }}" },
                    { k: 'Attachments', v: 'data' },
                    { k: 'Options', v: 'Append n8n Attribution off · Sender Name Maya Okoye' },
                  ],
                  run: (items, ctx) => {
                    const l = lead(ctx);
                    return {
                      items: items.map(() => item({ id: '18e0c4b2a7e41f90', threadId: '18e0c4b2a7e41f90', labelIds: ['SENT'] })),
                      messages: [
                        {
                          channel: 'email',
                          to: String(l.email),
                          subject: 'Copperleaf wholesale prices',
                          body: `Hi ${l.first_name},\n\nThanks for asking about wholesale for ${l.business_name}. Our price list is attached (${vars.price_list_file}). At ${l.lbs_per_week} pounds a week you are on our standard tier, with free delivery in Buncombe County and two-day shipping everywhere else.\n\nIf you would like samples first, reply with your address and I will send a box this week.\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville`,
                        },
                      ],
                    };
                  },
                },
              },
            ],
          },
          {
            label: 'Small',
            rule: 'Fallback: nothing above matched',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'mail-small',
                  name: 'Suggest the café subscription',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Maya’s Gmail (OAuth2)',
                  summary: 'Under 10 pounds a week the wholesale minimum does not work for either side, so this points to the office and café subscription instead, kindly and with a discount code.',
                  params: [
                    { k: 'To', v: "{{ $('Score the fit').item.json.email }}" },
                    { k: 'Options', v: 'Append n8n Attribution off · Sender Name Maya Okoye' },
                  ],
                  run: (items, ctx) => {
                    const l = lead(ctx);
                    return {
                      items: items.map(() => item({ id: '18e0c4b9c3d08a21', threadId: '18e0c4b9c3d08a21', labelIds: ['SENT'] })),
                      messages: [
                        {
                          channel: 'email',
                          to: String(l.email),
                          subject: 'Fresh coffee for your team',
                          body: `Hi ${l.first_name},\n\nThanks for thinking of us for ${l.business_name}. Wholesale starts at 10 pounds a week, so for ${l.lbs_per_week} pounds our office subscription is the better deal: freshly roasted bags every week or two, cancel any time. The code TEAM15 takes 15% off the first three months at copperleaf.example/subscribe.\n\nIf you grow into wholesale, just reply and I will set it up.\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville`,
                        },
                      ],
                    };
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: 'priority',
      label: 'Espresso café, 60 lb a week',
      summary: 'Rosa runs a busy espresso bar in Charlotte. She scores 100: a Block Kit post in #wholesale, a new HubSpot contact and a note from Maya with a booking link, all within about two seconds.',
      start: at(0, 9, 41),
      input: [formItem({ business: 'Ninebark Espresso', name: 'Rosa Delgado', email: 'Rosa@NinebarkEspresso.example ', type: 'Café or coffee shop', lbs: '60', city: 'Charlotte, NC', focus: 'Mostly espresso', note: 'Opening a second shop in May.' }, '2026-03-02T09:41:12.880-05:00')],
      fixtures: { hubspotId: 90412 },
      expect: { status: 'success', visits: ['clean', 'score', 'hubspot', 'hubspot:0', 'merge', 'route:0', 'slack-priority', 'mail-priority'], skips: ['slack-hubspot', 'drive'] },
    },
    {
      id: 'standard',
      label: 'Restaurant, 15 lb a week',
      summary: 'Owen’s restaurant serves brewed coffee at brunch. Standard tier: the price list PDF comes out of Google Drive and goes out attached, from Maya.',
      start: at(1, 14, 5),
      input: [formItem({ business: 'Laurel & Lye', name: 'Owen Pryor', email: 'owen@laurelandlye.example', type: 'Restaurant', lbs: '15', city: 'Greenville, SC', focus: 'Mostly brewed', note: '' }, '2026-03-03T14:05:40.112-05:00')],
      fixtures: { hubspotId: 90418 },
      expect: { status: 'success', visits: ['hubspot:0', 'route:1', 'drive', 'mail-standard'], skips: ['slack-priority', 'mail-small'] },
    },
    {
      id: 'small',
      label: 'Office, 4 lb a week',
      summary: 'Priya orders for a 20-person office. Too small for wholesale, so she gets a friendly pointer to the office subscription and a discount code. Nobody at Copperleaf has to write it.',
      start: at(2, 11, 20),
      input: [formItem({ business: 'Tidewell Design Studio', name: 'Priya Natarajan', email: 'priya@tidewell.example', type: 'Office', lbs: '4', city: 'Asheville, NC', focus: 'Mostly brewed', note: 'Just want good coffee for the team!' }, '2026-03-04T11:20:03.554-05:00')],
      fixtures: { hubspotId: 90423 },
      expect: { status: 'success', visits: ['route:2', 'mail-small'], skips: ['drive', 'slack-priority'] },
    },
    {
      id: 'hubspot-down',
      label: 'HubSpot is down',
      summary: 'A grocery co-op writes while HubSpot answers 503 Service Unavailable. The Error output tells #wholesale to add them by hand, and the co-op still gets the price list.',
      start: at(3, 16, 48),
      input: [formItem({ business: 'French Broad Food Co-op', name: 'Dana Whitfield', email: 'dana@fbfc.example', type: 'Grocery or retail', lbs: '25', city: 'Asheville, NC', focus: 'About half and half', note: 'Interested in a local shelf section.' }, '2026-03-05T16:48:31.017-05:00')],
      failures: { hubspot: [{ status: 503, message: 'Service Unavailable' }] },
      expect: { status: 'success', visits: ['hubspot:1', 'slack-hubspot', 'merge', 'route:1', 'mail-standard'] },
    },
    {
      id: 'repeat',
      label: 'Same café writes again',
      summary: 'Rosa fills in the form again a week later, now at 80 pounds. Create or Update finds her by email and updates the same HubSpot contact, so there is still one record; Maya’s note goes out again, which is what Rosa asked for.',
      start: at(4, 8, 15),
      input: [formItem({ business: 'Ninebark Espresso', name: 'Rosa Delgado', email: 'rosa@ninebarkespresso.example', type: 'Café or coffee shop', lbs: '80', city: 'Charlotte, NC', focus: 'Mostly espresso', note: 'Second shop opens May 4. Can we talk this week?' }, '2026-03-06T08:15:09.630-05:00')],
      fixtures: { hubspotId: 90412, hubspotNew: false },
      expect: { status: 'success', visits: ['hubspot:0', 'route:0', 'mail-priority'] },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Copperleaf HubSpot (app token)', type: 'HubSpot App Token', note: 'A private app with contacts read and write only. Tokens do not expire like OAuth, so it is rotated each January.' },
      { name: 'Maya’s Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Connected by Maya herself, so emails come from her and replies reach her.' },
      { name: 'Copperleaf Google (OAuth2)', type: 'Google Drive OAuth2', note: 'Read-only scope is enough to download the price list.' },
      { name: 'Copperleaf Slack (bot)', type: 'Slack OAuth2', note: 'A Copperleaf bot invited to #wholesale, #packing and #ops only.' },
    ],
    fields: [
      { name: 'wholesale_fit_score', where: 'HubSpot contact property', type: 'Number', note: '0 to 100 from the Code node' },
      { name: 'lbs_per_week', where: 'HubSpot contact property', type: 'Number', note: 'From the form, as a number' },
      { name: 'tier', where: 'Workflow item only', type: 'String', note: 'priority, standard or small; decides the Switch output' },
    ],
    variables: [
      { key: 'price_list_file', value: vars.price_list_file, note: 'Drive file ID in the real build; shown by name here' },
      { key: 'booking_link', value: vars.booking_link },
    ],
  },
  build: [
    { title: 'Start from the form, not the inbox', body: 'An n8n Form Trigger replaced the website contact form for wholesale. Its fields are the questions Maya asked by email anyway, and the answers arrive as one clean item instead of free text. Respond When is Form Is Submitted, so the café never waits on HubSpot or Gmail to see the thank-you page.' },
    { title: 'Rename once, early', body: 'The Form Trigger names each answer after its label, like “Coffee per week (lbs)”. Edit Fields maps them to snake_case keys and types the volume as a Number right after the trigger, so a reworded label later means one edit here, not a broken expression in five nodes.' },
    { title: 'Score in one Code node', body: 'Run Once for Each Item, returning { json }. The weights sit together with comments, and I pinned three test submissions on the trigger to check the tiers before going live: pinned data lets every later node be tested without filling in the form again.' },
    { title: 'Upsert, and plan for HubSpot failing', body: 'Create or Update matches on email, so a repeat inquiry updates one contact. On Error is Continue (using error output), wired to a Slack post, and both outputs meet at a Merge in Append mode, so the lead is never lost and never left unanswered. No Retry On Fail here: a node that continues on error hands the failure on as an item rather than throwing it, so I do not count on retries for it, and a person adding one lead by hand is cheap.' },
    { title: 'Reach back with $()', body: 'After HubSpot, the item is HubSpot’s answer (a vid), not the lead. Every later node reads the lead with $(\'Score the fit\').item, which follows n8n’s item pairing back through the Merge to the right submission.' },
    { title: 'One Switch, three answers', body: 'Rules on the tier, with Fallback Output set to Extra Output so anything unexpected still gets the gentle “small” email rather than nothing. The standard path downloads the price list from Drive as binary data and attaches it, so the file has one home.' },
    { title: 'Publish and watch', body: 'The production form URL only works once the workflow is published; the test URL only while the editor is listening. I swapped the link on the website after publishing and read the first week of executions in the Executions list.' },
  ],
  edgeCases: [
    { title: 'The same café submits twice', body: 'HubSpot Create or Update matches the email and updates the existing contact. The email goes out again, which is right: they asked again. If repeat inquiries ever became a nuisance, a HubSpot Get before the Switch could check when the last one was.' },
    { title: 'A typo in the email', body: 'The Form Trigger’s Email field rejects anything that is not an address. A real but wrong address bounces back to Maya’s inbox, where she sees it next to the Slack post.' },
    { title: 'HubSpot is down or the token was revoked', body: 'The Error output fires on the first failure. #wholesale gets the café’s name and the error, and the email still goes out. A revoked token shows the same way, as a 401, on every inquiry until someone reconnects it, which the Slack posts make obvious within the hour.' },
    { title: 'Bots fill in the form', body: 'Ignore Bots is on, which skips link previewers and crawlers. A determined spammer still gets through; the score makes junk land in the “small” tier, where the only cost is one polite email.' },
    { title: 'Prices change', body: 'Maya replaces the PDF in Drive, keeping the same file. The workflow downloads it fresh every time, so nobody edits n8n for a price change.' },
    { title: 'Gmail’s sending limits', body: 'A Google Workspace account can send about 2,000 messages a day. A few inquiries a day is nowhere near it, which is why this uses Maya’s Gmail and not a marketing tool.' },
  ],
  qa: [
    'Three pinned test submissions, one per tier: the Switch output matches the hand-scored tier',
    'Same email twice: one HubSpot contact, updated, with the newer volume',
    'HubSpot token swapped for a wrong one: the item leaves through the Error output, the Slack post arrives, the email still goes out',
    'Price list replaced in Drive: the next standard email carries the new file',
    'Emails read right in Gmail and Outlook, with no n8n attribution line and Maya as the sender',
    'Production form URL works only after publishing; the website links to it, not the test URL',
  ],
  snippets: [
    { title: 'Fit score (Code node)', language: 'javascript', code: scoreCode, note: 'Run Once for Each Item: $input.item is the current item and the node returns one { json } object.' },
    { title: '#wholesale post (Slack Blocks)', language: 'json', code: slackBlocks, note: 'The expressions read the lead from the Code node, since the item arriving at the Switch is HubSpot’s answer.' },
  ],
  features: ['n8n Form Trigger', 'Edit Fields (Set)', 'Code (per item)', 'HubSpot', 'Error output', 'Merge (Append)', 'Switch with fallback', '$() item pairing', 'Google Drive binary data', 'Gmail attachments', 'Slack Blocks', 'Pinned data'],
};
