import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { dayKey, item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

export const SERVICES = ['Monthly bookkeeping', 'Bookkeeping and payroll', 'Catch-up (behind on the books)'];
const ACCOUNTANT: Record<string, { name: string; email: string; clickup: number }> = {
  'Monthly bookkeeping': { name: 'Grace Kim', email: 'grace@ledgerline.example', clickup: 4410021 },
  'Bookkeeping and payroll': { name: 'Marcus Bell', email: 'marcus@ledgerline.example', clickup: 4410022 },
  'Catch-up (behind on the books)': { name: 'Ines Duarte', email: 'ines@ledgerline.example', clickup: 4410023 },
};

/** What the website's onboarding form posts: the Webhook node's item. */
export const webhookItem = (body: Json): Item =>
  item({
    headers: { host: 'n8n.ledgerline.example', 'content-type': 'application/json', 'x-ledgerline-key': '••••••••', 'user-agent': 'ledgerline-site/2.4' },
    params: {},
    query: {},
    body,
    webhookUrl: 'https://n8n.ledgerline.example/webhook/new-client',
    executionMode: 'production',
  });

type Body = { business_name?: string; contact_name?: string; email?: string; phone?: string; service?: string; entity?: string; software?: string };
const body = (ctx: RunContext) => (ctx.$('New client form')[0]?.json.body ?? {}) as Body;
const client = (ctx: RunContext) => ctx.$('Client ID and folder name')[0]?.json ?? {};

const missingOf = (b: Body) => {
  const out: string[] = [];
  if (!b.business_name?.trim()) out.push('business_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email?.trim() ?? '')) out.push('email');
  if (!b.service || !SERVICES.includes(b.service)) out.push('service');
  return out;
};

const idCode = `// Code node, JavaScript, Mode: Run Once for Each Item.
// The client ID only has to be unique and readable. The execution id is
// unique on this instance, so LL-<year><month>-<execution> needs no counter.
const b = $('New client form').item.json.body;
const ym = $now.toFormat('yyMM');
const clientId = \`LL-\${ym}-\${$execution.id}\`;

// Each service has one owner, agreed with Hannah. Changing who covers
// payroll is an edit here, and nowhere else.
const owners = {
  'Monthly bookkeeping': { name: 'Grace Kim', email: 'grace@ledgerline.example', clickup: 4410021 },
  'Bookkeeping and payroll': { name: 'Marcus Bell', email: 'marcus@ledgerline.example', clickup: 4410022 },
  'Catch-up (behind on the books)': { name: 'Ines Duarte', email: 'ines@ledgerline.example', clickup: 4410023 },
};
const owner = owners[b.service];

return {
  json: {
    client_id: clientId,
    folder_name: \`\${b.business_name.trim()} (\${clientId})\`,
    business_name: b.business_name.trim(),
    first_name: (b.contact_name || '').trim().split(' ')[0] || 'there',
    email: b.email.trim().toLowerCase(),
    service: b.service,
    accountant: owner.name,
    accountant_email: owner.email,
    clickup_assignee: owner.clickup,
  },
};`;

const respondOk = `{
  "ok": true,
  "message": "Thanks! Check your inbox for a welcome email from Ledgerline."
}`;

export const clientOnboarding: Automation = {
  id: 'client-onboarding',
  number: '01',
  name: 'New client onboarding',
  kicker: 'Onboarding',
  tagline: 'The website’s onboarding form posts to a webhook. The site gets its answer in under a second; behind it, n8n checks for a returning client, then makes the Drive folder, shares it, logs the client, gives the bookkeeper a task, sends the welcome and starts the document chase.',
  problem:
    'Setting up a client took Tom about forty minutes of copying the same details into five places, usually a day or two after the client signed. Folders were named three different ways, a returning client once got a second folder and a second bookkeeper, and the welcome email sometimes waited for a free afternoon.',
  solution:
    'The site posts the form to an n8n Webhook protected by header auth. An If checks the three fields everything depends on; if one is missing, Respond to Webhook sends the site a 422 with the list, so the form can say what to fix. If they are all there, the site gets a 200 straight away and the work goes on. Google Sheets looks the email up in the client list, with Always Output Data on so “not found” still produces an item. A returning client stops at a Slack note. A new one gets an ID and an owner from a Code node, a Drive folder shared with them, a row in the client list, a ClickUp task for their bookkeeper and a welcome email, and an Execute Sub-workflow node starts 02, the document chase, without waiting for it. If Drive or anything after it fails for good, the execution stops and 03, the error workflow, tells Tom.',
  workflow: {
    name: '01 · Onboarding · New client',
    folder: 'Ledgerline / Onboarding',
    tags: ['onboarding', 'webhook', 'client-facing'],
    trigger: {
      id: 'webhook',
      name: 'New client form',
      type: 'Webhook',
      operation: 'POST /webhook/new-client',
      icon: 'webhook',
      tone: 'trigger',
      summary: 'The website’s server, not the browser, posts the form here, so the header secret never reaches a visitor. Authentication: Header Auth. Respond: Using ‘Respond to Webhook’ Node, so the site hears back as soon as the input is checked rather than after every step.',
      credential: 'Website to n8n (header auth)',
      params: [
        { k: 'HTTP Method', v: 'POST' },
        { k: 'Path', v: 'new-client' },
        { k: 'Authentication', v: 'Header Auth (X-Ledgerline-Key)' },
        { k: 'Respond', v: 'Using ‘Respond to Webhook’ Node' },
      ],
    },
    settings: {
      executionOrder: 'v1',
      errorWorkflow: 'error-handler',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'Error workflow: 03 · Ops · Error handler. Any failure that stops this workflow in production runs it, with the execution’s URL and the node that failed.',
        'Save successful executions on, for 30 days. Client onboarding is rare enough that the history is small and useful when a client asks what happened.',
        'Timezone America/Chicago, the firm’s, for $now in the client ID and the dates in the client list.',
      ],
    },
    steps: [
      {
        kind: 'split',
        node: {
          id: 'valid',
          name: 'Has what we need?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'AND of three conditions on the posted body: a business name, an email that matches a simple pattern, and a service from the form’s own list. Anything else is the site’s bug or a hand-made request, and gets a 422.',
          params: [
            { k: 'Condition 1', v: '{{ $json.body.business_name }} is not empty' },
            { k: 'Condition 2', v: '{{ $json.body.email }} matches regex ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
            { k: 'Condition 3', v: '{{ $json.body.service }} is one of the three services' },
            { k: 'Combine', v: 'AND' },
          ],
          run: (items) => {
            const missing = missingOf(items[0].json.body as Body);
            return { outputs: missing.length ? [[], items] : [items, []], log: missing.length ? `Missing or invalid: ${missing.join(', ')}.` : 'All three present.' };
          },
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'respond-ok',
                  name: 'Tell the site it worked',
                  type: 'Respond to Webhook',
                  operation: 'Respond With: JSON',
                  icon: 'reply',
                  tone: 'flow',
                  summary: 'Response Code 200. Sent now, before Drive and ClickUp, so the client sees “check your inbox” in under a second. The workflow carries on after it: the response closes the request, not the execution.',
                  params: [{ k: 'Response Code', v: '200' }],
                  code: { language: 'json', source: respondOk },
                  run: (items) => ({ items, messages: [{ channel: 'http', to: 'the website’s request', subject: 'HTTP 200', body: respondOk }] }),
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'lookup',
                  name: 'Look up the client',
                  type: 'Google Sheets',
                  operation: 'Row › Get Row(s)',
                  icon: 'sheet',
                  tone: 'app',
                  credential: 'Ledgerline Google (OAuth2)',
                  summary: 'Filter: email column equals the posted email. Always Output Data is on: with no match the node would output nothing and the rest of the workflow would never run, so instead it outputs one empty item.',
                  settings: { alwaysOutputData: true, retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [
                    { k: 'Sheet', v: 'Client list' },
                    { k: 'Filters', v: 'email = {{ $json.body.email.trim().toLowerCase() }}' },
                  ],
                  run: (_items, ctx) => {
                    const row = ctx.fixtures.existing as Json | undefined;
                    return row ? { items: [item(row)], log: `Found ${row.client_id}.` } : { items: [item({})], log: 'No row. Always Output Data sends one empty item on.' };
                  },
                },
              },
              {
                kind: 'split',
                node: {
                  id: 'returning',
                  name: 'Already a client?',
                  type: 'If',
                  icon: 'split',
                  tone: 'logic',
                  summary: 'True when the lookup returned a client_id. Returning clients have a folder and a bookkeeper already; a second set would split their history.',
                  params: [{ k: 'Condition', v: '{{ $json.client_id }} is not empty' }],
                  run: (items) => {
                    const yes = !!items[0]?.json.client_id;
                    return { outputs: yes ? [items, []] : [[], items], log: yes ? 'Yes, already in the list.' : 'No, a new client.' };
                  },
                },
                branches: [
                  {
                    label: 'true',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'slack-returning',
                          name: 'Note in #onboarding',
                          type: 'Slack',
                          operation: 'Message › Send',
                          icon: 'slack',
                          tone: 'app',
                          credential: 'Ledgerline Slack (bot)',
                          summary: 'Tom decides what a second form means: a new service, a new entity, or a click on an old link. Nothing is created automatically.',
                          params: [{ k: 'Channel', v: vars.onboarding_channel }],
                          run: (items, ctx) => {
                            const b = body(ctx);
                            const r = items[0].json;
                            return {
                              items: [item({ ok: true, ts: '1772548200.200115' })],
                              messages: [{ channel: 'slack', to: vars.onboarding_channel, body: `${b.business_name} filled in the onboarding form again (${b.email}, ${b.service}). They are already ${r.client_id} with ${r.accountant}, so nothing new was created. Folder: ${r.folder_url}` }],
                            };
                          },
                        },
                      },
                    ],
                  },
                  {
                    label: 'false',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'ids',
                          name: 'Client ID and folder name',
                          type: 'Code',
                          operation: 'JavaScript · Run Once for Each Item',
                          icon: 'code',
                          tone: 'core',
                          summary: 'Builds the client ID from the year, month and execution id, the folder name, and the owner for the service. One place decides who does what.',
                          code: { language: 'javascript', source: idCode },
                          run: (_items, ctx) => {
                            const b = body(ctx);
                            const id = `LL-${dayKey(ctx.now).slice(2, 4)}${dayKey(ctx.now).slice(5, 7)}-${ctx.executionId}`;
                            const o = ACCOUNTANT[b.service!];
                            return {
                              items: [
                                item({
                                  client_id: id,
                                  folder_name: `${b.business_name!.trim()} (${id})`,
                                  business_name: b.business_name!.trim(),
                                  first_name: (b.contact_name ?? '').trim().split(' ')[0] || 'there',
                                  email: b.email!.trim().toLowerCase(),
                                  service: b.service,
                                  accountant: o.name,
                                  accountant_email: o.email,
                                  clickup_assignee: o.clickup,
                                }),
                              ],
                              log: `${id}, owner ${o.name}.`,
                            };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'folder',
                          name: 'Create the client folder',
                          type: 'Google Drive',
                          operation: 'Folder › Create',
                          icon: 'folder',
                          tone: 'app',
                          credential: 'Ledgerline Google (OAuth2)',
                          summary: 'Inside the shared Clients folder, named “Business (ID)” so it sorts by name and searches by ID. Retry On Fail covers a blip; after three tries the execution stops and the error workflow takes over.',
                          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                          params: [
                            { k: 'Folder Name', v: '{{ $json.folder_name }}' },
                            { k: 'Parent Folder', v: vars.clients_folder },
                          ],
                          run: (_items, ctx) => {
                            const c = client(ctx);
                            return { items: [item({ id: '1Qm7vH2kLpX9aTz4', name: c.folder_name, webViewLink: 'https://drive.google.com/drive/folders/1Qm7vH2kLpX9aTz4' })] };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'share',
                          name: 'Share it with the client',
                          type: 'Google Drive',
                          operation: 'Folder › Share',
                          icon: 'folder',
                          tone: 'app',
                          credential: 'Ledgerline Google (OAuth2)',
                          summary: 'Role writer, type user, the client’s email, so they can drop statements in. Google’s own notification is off; the welcome email explains the folder instead.',
                          params: [
                            { k: 'Folder', v: '{{ $json.id }}' },
                            { k: 'Permissions', v: "writer · user · {{ $('Client ID and folder name').item.json.email }}" },
                          ],
                          run: (items, ctx) => ({ items: items.map(() => item({ kind: 'drive#permission', id: '09412856', type: 'user', role: 'writer', emailAddress: client(ctx).email })) }),
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'log-client',
                          name: 'Add to the client list',
                          type: 'Google Sheets',
                          operation: 'Row › Append',
                          icon: 'sheet',
                          tone: 'app',
                          credential: 'Ledgerline Google (OAuth2)',
                          summary: 'The firm’s source of truth for who is a client: ID, business, email, service, owner, folder link, status Onboarding and the start date. The lookup above reads this same sheet.',
                          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                          params: [
                            { k: 'Sheet', v: 'Client list' },
                            { k: 'Columns', v: "client_id, business_name, email, service, accountant = {{ $('Client ID and folder name').item.json.… }} · folder_url = {{ $('Create the client folder').item.json.webViewLink }} · status = Onboarding" },
                          ],
                          run: (_items, ctx) => {
                            const c = client(ctx);
                            return { items: [item({ client_id: c.client_id, business_name: c.business_name, email: c.email, service: c.service, accountant: c.accountant, folder_url: ctx.$('Create the client folder')[0].json.webViewLink, status: 'Onboarding', started: dayKey(ctx.now) })] };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'task',
                          name: 'Task for the bookkeeper',
                          type: 'ClickUp',
                          operation: 'Task › Create',
                          icon: 'task',
                          tone: 'app',
                          credential: 'Ledgerline ClickUp (OAuth2)',
                          summary: 'In the Onboarding list, assigned to the owner the Code node picked, due in five business days, with the folder link and service in the description.',
                          params: [
                            { k: 'List', v: vars.onboarding_list },
                            { k: 'Name', v: "Onboard {{ $('Client ID and folder name').item.json.business_name }}" },
                            { k: 'Assignees', v: "{{ $('Client ID and folder name').item.json.clickup_assignee }}" },
                          ],
                          run: (_items, ctx) => {
                            const c = client(ctx);
                            return {
                              items: [item({ id: '86b2qx4fh', name: `Onboard ${c.business_name}`, status: { status: 'to do' }, url: 'https://app.clickup.com/t/86b2qx4fh' })],
                              messages: [{ channel: 'task', to: `ClickUp · ${c.accountant}`, subject: `Onboard ${c.business_name}`, body: `${c.service}. Client ${c.client_id}, ${c.email}. Folder shared with the client. Due in 5 business days.` }],
                            };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'welcome',
                          name: 'Welcome email',
                          type: 'Gmail',
                          operation: 'Message › Send',
                          icon: 'mail',
                          tone: 'app',
                          credential: 'Ledgerline Gmail (OAuth2)',
                          summary: 'From hello@ledgerline.example, Reply To the bookkeeper, so the client’s questions go to the person doing the work. Names the bookkeeper, links the folder, and says a document list follows.',
                          params: [
                            { k: 'To', v: "{{ $('Client ID and folder name').item.json.email }}" },
                            { k: 'Options', v: 'Reply To = the bookkeeper · Append n8n Attribution off' },
                          ],
                          run: (_items, ctx) => {
                            const c = client(ctx);
                            const folder = ctx.$('Create the client folder')[0].json.webViewLink;
                            return {
                              items: [item({ id: '18e1f0c2b8a4d913', labelIds: ['SENT'] })],
                              messages: [
                                {
                                  channel: 'email',
                                  to: String(c.email),
                                  subject: `Welcome to Ledgerline, ${c.business_name}`,
                                  body: `Hi ${c.first_name},\n\nWelcome aboard. ${c.accountant} will look after your ${String(c.service).toLowerCase()}, and replies to this email go straight to them.\n\nWe have set up a private Google Drive folder for your documents: ${folder}\nYour client ID is ${c.client_id}.\n\nIn a separate email you will get the short list of documents we need to start. Most clients have everything in within a week.\n\nThe Ledgerline team`,
                                },
                              ],
                            };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'chase',
                          name: 'Start the document chase',
                          type: 'Execute Sub-workflow',
                          operation: '02 · Onboarding · Document chase',
                          icon: 'flow',
                          tone: 'flow',
                          summary: 'Source Database, the 02 workflow, Mode Run once for each item. Wait For Sub-Workflow Completion is off: 02 waits for days, and this execution should finish now, not hold a webhook execution open for a week.',
                          params: [
                            { k: 'Workflow', v: 'From list: 02 · Onboarding · Document chase' },
                            { k: 'Workflow Inputs', v: "client_id, first_name, email, service, accountant, folder_id = {{ $('Create the client folder').item.json.id }}, task_id = {{ $('Task for the bookkeeper').item.json.id }}" },
                            { k: 'Wait For Sub-Workflow Completion', v: 'Off' },
                          ],
                          run: (items, ctx) => ({ items, log: `Started 02 for ${client(ctx).client_id} as its own execution and moved on.` }),
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: 'false',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'respond-422',
                  name: 'Tell the site what is missing',
                  type: 'Respond to Webhook',
                  operation: 'Respond With: JSON',
                  icon: 'reply',
                  tone: 'flow',
                  summary: 'Response Code 422 and the list of fields, so the site can highlight them. Nothing else runs: there is no client to set up yet.',
                  params: [
                    { k: 'Response Code', v: '422' },
                    { k: 'Response Body', v: '{ "ok": false, "missing": {{ JSON.stringify(...) }} }' },
                  ],
                  run: (items, ctx) => {
                    const missing = missingOf(body(ctx));
                    const res = JSON.stringify({ ok: false, missing }, null, 2);
                    return { items, messages: [{ channel: 'http', to: 'the website’s request', subject: 'HTTP 422', body: res }] };
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
      id: 'new',
      label: 'A new client signs up',
      summary: 'Carmen runs a plumbing company and wants monthly bookkeeping. The site gets its 200 at once; then a folder, a share, a row, Grace’s task, the welcome email and the start of 02, in about four seconds.',
      start: at(1, 10, 22),
      input: [webhookItem({ business_name: 'Ruiz Family Plumbing LLC', contact_name: 'Carmen Ruiz', email: 'Carmen@RuizPlumbing.example', phone: '(512) 555-0147', service: 'Monthly bookkeeping', entity: 'LLC', software: 'QuickBooks Online' })],
      expect: { status: 'success', visits: ['valid:0', 'respond-ok', 'lookup', 'returning:1', 'ids', 'folder', 'share', 'log-client', 'task', 'welcome', 'chase'], skips: ['respond-422', 'slack-returning'] },
    },
    {
      id: 'invalid',
      label: 'The email is mistyped',
      summary: 'The site’s own validation missed “jamal@harbor” with no domain. The If sends it down false, the site gets a 422 naming the email field, and nothing is created.',
      start: at(2, 15, 3),
      input: [webhookItem({ business_name: 'Harbor Dental Studio', contact_name: 'Jamal Wright', email: 'jamal@harbor', service: 'Bookkeeping and payroll' })],
      expect: { status: 'success', visits: ['valid:1', 'respond-422'], skips: ['respond-ok', 'lookup'] },
    },
    {
      id: 'returning',
      label: 'A client fills in the form again',
      summary: 'Lowell’s bakery has been a client since last year and clicked an old link to add payroll. The lookup finds them, and #onboarding gets a note instead of a second folder and a second bookkeeper.',
      start: at(3, 9, 47),
      input: [webhookItem({ business_name: 'Northside Bakehouse', contact_name: 'Lowell Park', email: 'lowell@northsidebakehouse.example', service: 'Bookkeeping and payroll' })],
      fixtures: { existing: { client_id: 'LL-2507-3318', business_name: 'Northside Bakehouse', email: 'lowell@northsidebakehouse.example', service: 'Monthly bookkeeping', accountant: 'Grace Kim', folder_url: 'https://drive.google.com/drive/folders/1bK8sQ0wPxYc3nVe', status: 'Active' } },
      expect: { status: 'success', visits: ['lookup', 'returning:0', 'slack-returning'], skips: ['ids', 'folder'] },
    },
    {
      id: 'drive-down',
      label: 'Google Drive fails',
      summary: 'Drive answers 500 three times. The site already has its 200 and Grace’s client is waiting, so the execution stops, is saved as Error, and 03 · Error handler alerts #ops and gives Tom a task with the link to retry.',
      start: at(4, 11, 5),
      input: [webhookItem({ business_name: 'Oakridge Veterinary Clinic', contact_name: 'Dr. Priya Raman', email: 'office@oakridgevet.example', service: 'Monthly bookkeeping' })],
      failures: { folder: [{ status: 500, message: 'Internal Error' }, { status: 500, message: 'Internal Error' }, { status: 500, message: 'Internal Error' }] },
      expect: { status: 'error', visits: ['respond-ok', 'ids', 'folder'], skips: ['share', 'welcome', 'chase'], errorWorkflow: true },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Website to n8n (header auth)', type: 'Header Auth', note: 'Header X-Ledgerline-Key with a long random value. The website stores it as a server-side secret; it is never sent to a browser.' },
      { name: 'Ledgerline Google (OAuth2)', type: 'Google OAuth2 (Drive and Sheets)', note: 'Connected as automations@ledgerline.example, a Workspace user that owns the Clients folder, so nothing depends on one person’s account.' },
      { name: 'Ledgerline ClickUp (OAuth2)', type: 'ClickUp OAuth2', note: 'Can create tasks in the Onboarding list.' },
      { name: 'Ledgerline Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Sends as hello@ledgerline.example.' },
      { name: 'Ledgerline Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #onboarding and #ops.' },
    ],
    fields: [
      { name: 'client_id', where: 'Client list sheet', type: 'Text', note: 'LL-yyMM-<execution id>; unique on this instance' },
      { name: 'email', where: 'Client list sheet', type: 'Text', note: 'Lowercased; the returning-client lookup matches on it' },
      { name: 'status', where: 'Client list sheet', type: 'Text', note: 'Onboarding, Ready, Active, Paused' },
      { name: 'folder_url', where: 'Client list sheet', type: 'URL', note: 'From the Drive node’s webViewLink' },
    ],
    variables: [{ key: 'clients_folder', value: vars.clients_folder, note: 'Folder ID in the real build' }],
  },
  build: [
    { title: 'A webhook the site’s server calls', body: 'The form posts to Ledgerline’s own site, and the site’s server posts to the n8n Webhook with a header secret saved as a Header Auth credential. A browser never sees the URL’s secret, and a request without the header gets a 403 from n8n before any node runs.' },
    { title: 'Answer fast, then work', body: 'Respond is set to Using ‘Respond to Webhook’ Node. The 200 goes out right after validation, so the client is not watching a spinner while Drive and ClickUp do their part. A 422 goes out instead when a field is missing, with the list, for the form to show.' },
    { title: 'Look before creating', body: 'Google Sheets Get Row(s) looks the email up in the client list. Always Output Data is on for that node only: without it, “no rows” means no items and the whole new-client path would silently never run.' },
    { title: 'One Code node decides', body: 'The client ID, folder name and the bookkeeper for each service come from one Code node. $execution.id makes the ID unique without a counter, and $now formats the month in the workflow’s time zone.' },
    { title: 'Each app does one thing', body: 'Drive creates and shares the folder, Sheets logs the client, ClickUp makes the task, Gmail sends the welcome. Later nodes read the client with $(\'Client ID and folder name\').item, not $json, because each app node outputs its own API’s answer.' },
    { title: 'Hand the long wait to a sub-workflow', body: 'The document chase waits for days. Execute Sub-workflow starts 02 with exactly the fields it declares, and with Wait For Sub-Workflow Completion off this execution finishes in seconds, so one onboarding never shows as running for a week.' },
    { title: 'Fail loudly', body: 'Retry On Fail on every Google call, then Stop Workflow, which is the default, and an error workflow set in the settings. A half-made client is worse than none if nobody knows, so 03 posts the execution link to #ops and makes Tom a task.' },
  ],
  edgeCases: [
    { title: 'Drive fails after the site said “thanks”', body: 'The client has their 200 and expects a welcome email. The execution stops at the folder, is saved as Error, and 03 alerts Tom with the link. He retries it from the failed node once Drive is back, and the client gets everything a few minutes late rather than never.' },
    { title: 'Someone posts without the header', body: 'n8n answers 403 and no execution is created. Rotating the secret means updating the credential and the site’s environment variable together.' },
    { title: 'A returning client wants a new service', body: 'They stop at the Slack note on purpose. Adding payroll to an existing client is a conversation and a price, not a folder.' },
    { title: 'Two people from the same company sign up', body: 'Different emails, so the lookup finds neither, and two folders are made. Tom merges them; matching on business name would merge different companies with similar names, which is worse.' },
    { title: 'The form is submitted twice in a second', body: 'Both executions look up the sheet before either has added its row, so both pass. The site disables the submit button after one click, which is the cheap fix; a Remove Duplicates node on the email would be the n8n one.' },
    { title: 'Respond to Webhook never runs', body: 'If the workflow fails before either response node, n8n answers the site with a 500 and an error message, and the site shows its own “something went wrong, email us” text.' },
  ],
  qa: [
    'Request without the header: 403, no execution in the list',
    'Missing email, bad email, unknown service: 422 with the right fields, nothing created',
    'A new client: 200 in under a second, then folder, share, row, task, email and a separate 02 execution',
    'An existing email in a different case: the lookup still matches, because both sides are lowercased',
    'Drive credential disconnected in a copy: three tries, then an Error execution and an alert from 03 with a working link',
    'The welcome email’s Reply To is the bookkeeper for each of the three services',
  ],
  snippets: [
    { title: 'Client ID and owner (Code node)', language: 'javascript', code: idCode, note: 'Run Once for Each Item. $execution.id and $now are available in the Code node as in expressions.' },
    { title: 'Response to the site (Respond to Webhook)', language: 'json', code: respondOk, note: 'Response Code 200. The 422 path sends { ok: false, missing: [...] } instead.' },
  ],
  features: ['Webhook', 'Header Auth credential', 'Respond to Webhook', 'If (AND)', 'Google Sheets lookup', 'Always Output Data', 'Code', '$execution.id and $now', 'Google Drive', 'ClickUp', 'Gmail', 'Execute Sub-workflow', 'Retry On Fail', 'Error workflow'],
};
