import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

export const CATEGORIES = ['Outage', 'Billing', 'Bug', 'How-to', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

/** What the in-app Contact support form posts: the Webhook node's item. */
export const ticketItem = (body: { account_id: string; name: string; email: string; subject: string; message: string; page?: string }): Item =>
  item({
    headers: { host: 'n8n.slotwise.example', 'content-type': 'application/json', 'x-slotwise-signature': '••••••••' },
    params: {},
    query: {},
    body: { page: 'app.slotwise.example/calendar', ...body },
    webhookUrl: 'https://n8n.slotwise.example/webhook/support',
    executionMode: 'production',
  });

/**
 * Stands in for the language model in this simulator. In the real build the
 * OpenAI model reads the categories' descriptions; here a test event can name
 * its verdict, and anything you type is sorted by simple keyword rules.
 */
export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/\b(down|outage|not loading|won.t load|can.t log ?in|cannot log ?in|nobody can|everyone|500 error|offline)\b/.test(t)) return 'Outage';
  if (/\b(charge[ds]?|invoice|refund|billing|card|price|pricing|plan|subscription|receipt|vat)\b/.test(t)) return 'Billing';
  if (/\b(bug|error|broken|wrong|crash(es|ed)?|glitch|doesn.t work|does not work|not working|missing|duplicate)\b/.test(t)) return 'Bug';
  if (/\b(how (do|can|to)|where (is|do|can)|can i|is it possible|set ?up|help me)\b/.test(t)) return 'How-to';
  return 'Other';
}

const ROUTES: Record<Category, { group: string; type: string; priority: string; tags: string[] }> = {
  Outage: { group: 'Tier 2', type: 'incident', priority: 'urgent', tags: ['outage', 'ai-triaged'] },
  Billing: { group: 'Billing', type: 'question', priority: 'normal', tags: ['billing', 'ai-triaged'] },
  Bug: { group: 'Tier 2', type: 'problem', priority: 'high', tags: ['bug', 'ai-triaged'] },
  'How-to': { group: 'Tier 1', type: 'question', priority: 'low', tags: ['how-to', 'ai-triaged'] },
  Other: { group: 'Tier 1', type: 'question', priority: 'normal', tags: ['ai-other'] },
};

const ticket = (ctx: RunContext) => (ctx.$('The ticket')[0]?.json ?? {}) as Record<string, string>;
const account = (ctx: RunContext) => (ctx.$('Look up the account')[0]?.json ?? {}) as Record<string, string | number | Json>;
const known = (a: ReturnType<typeof account>) => !a.error && typeof a.mrr === 'number';

const categories = `Outage: The product, or a core part of it (booking page, calendar, login,
  reminders), is unavailable or failing for the customer or their clients.
Billing: Charges, invoices, refunds, plan changes, payment methods, VAT.
Bug: Something works, but wrong: a wrong time, a duplicate booking, a
  reminder with the wrong text, an error on one screen.
How-to: How to do or set up something the product already does.`;

const zendeskBody = `{
  "ticket": {
    "subject": "{{ $('The ticket').item.json.subject }}",
    "comment": { "body": "{{ $('The ticket').item.json.message }}" },
    "requester": { "name": "{{ $('The ticket').item.json.name }}", "email": "{{ $('The ticket').item.json.email }}" },
    "group_id": {{ $json.group_id }},
    "type": "{{ $json.type }}",
    "priority": "{{ $json.priority }}",
    "tags": {{ JSON.stringify($json.tags) }},
    "external_id": "{{ $('The ticket').item.json.account_id }}",
    "custom_fields": [
      { "id": 36011804, "value": "{{ $('Look up the account').item.json.plan ?? 'unknown' }}" }
    ]
  }
}`;

/** An Edit Fields node per route; the classifier's output decides which one runs. */
const route = (cat: Category, id: string, extra?: string) => ({
  kind: 'node' as const,
  node: {
    id,
    name: `Route: ${cat}`,
    type: 'Edit Fields (Set)',
    icon: 'pen' as const,
    tone: 'core' as const,
    summary: `Sets the Zendesk group, type, priority and tags for ${cat === 'Other' ? 'anything the model could not place' : `a${/^[AEIOU]/.test(cat) ? 'n' : ''} ${cat.toLowerCase()} ticket`}${extra ? `, ${extra}` : ''}. Include Other Input Fields off: only the routing goes on, and the ticket is read back with $().`,
    params: [
      { k: 'group', v: ROUTES[cat].group },
      { k: 'type', v: ROUTES[cat].type },
      { k: 'priority', v: ROUTES[cat].priority },
      { k: 'tags (Array)', v: JSON.stringify(ROUTES[cat].tags) },
    ],
    run: (items: Item[], ctx: RunContext) => ({
      items: items.map(() => item({ ...ROUTES[cat], group_id: { 'Tier 1': 360001, 'Tier 2': 360002, Billing: 360003 }[ROUTES[cat].group], category: cat, ...(cat === 'Bug' ? { jira: ctx.$('Open a Jira issue')[0]?.json.key } : {}) })),
      log: `${ROUTES[cat].group}, ${ROUTES[cat].priority}.`,
    }),
  },
});

export const supportTriage: Automation = {
  id: 'support-triage',
  number: '01',
  name: 'Support triage',
  kicker: 'AI classification',
  tagline: 'A ticket from the in-app form is looked up against the customer’s account, classified by an AI Text Classifier as an outage, billing, a bug, a how-to or other, and created in Zendesk already in the right group and priority. Outages page #incidents, bugs open a Jira issue, and big accounts reach their success manager.',
  problem:
    'Every ticket landed in one Zendesk view. Felix sorted them by hand each morning, an outage report could sit behind twenty password resets, bugs reached engineering by copy and paste, and nobody in success knew their biggest customer had written in until the customer mentioned it on a call.',
  solution:
    'The in-app form posts to an n8n Webhook, which answers at once. Edit Fields shapes the ticket, and an HTTP Request asks Slotwise’s internal API for the account’s plan, monthly revenue and success manager; if that API is down, On Error is Continue and triage goes on without it. A Text Classifier with an OpenAI chat model picks one of four categories from their descriptions, or the extra Other output when nothing fits. Each output sets its own routing, outages also post to #incidents and bugs also open a Jira issue, then all five meet at a Merge and one HTTP Request creates the Zendesk ticket with everything set. Accounts paying $300 a month or more get a direct message to their success manager.',
  workflow: {
    name: '01 · Support · Triage',
    folder: 'Slotwise / Support',
    tags: ['support', 'ai', 'webhook'],
    trigger: {
      id: 'webhook',
      name: 'Support form',
      type: 'Webhook',
      operation: 'POST /webhook/support',
      icon: 'webhook',
      tone: 'trigger',
      summary: 'Called by Slotwise’s backend when a signed-in user sends the in-app Contact support form, so the account ID comes from the session, not from what the user typed. Header Auth, and Respond: Immediately with 202, since the app only needs to know the ticket was received.',
      credential: 'Slotwise backend to n8n (header auth)',
      params: [
        { k: 'HTTP Method', v: 'POST' },
        { k: 'Authentication', v: 'Header Auth' },
        { k: 'Respond', v: 'Immediately · Response Code 202' },
      ],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'UTC',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'Execution order v1. Only one classifier output gets the item, so only one route runs; the Merge then passes on whichever arrived.',
        'Timezone UTC, like the product: support is in three time zones and Zendesk shows local times anyway.',
        'Saved executions are pruned after 14 days. They hold customers’ messages, so they are not kept longer than the debugging needs.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'shape',
          name: 'The ticket',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'Pulls the six fields out of the request body and trims the message. Every later node reads the ticket from here with $(\'The ticket\').',
          params: [
            { k: 'account_id', v: '{{ $json.body.account_id }}' },
            { k: 'subject, message', v: '{{ $json.body.subject.trim() }} · {{ $json.body.message.trim() }}' },
          ],
          run: (items) => ({ items: items.map((it) => { const b = it.json.body as Record<string, string>; return item({ account_id: b.account_id, name: b.name, email: b.email, subject: b.subject.trim(), message: b.message.trim(), page: b.page }); }) }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'account',
          name: 'Look up the account',
          type: 'HTTP Request',
          operation: 'GET /internal/accounts/:id',
          icon: 'http',
          tone: 'app',
          credential: 'Slotwise internal API (header auth)',
          summary: 'Plan, monthly revenue, locations and success manager from Slotwise’s own API. Timeout 5 seconds. On Error is Continue: if the API is slow or down, the node outputs the error as its item and the ticket is still triaged, just without account details.',
          settings: { onError: 'continue' },
          params: [
            { k: 'URL', v: `${vars.api_base}/accounts/{{ $json.account_id }}` },
            { k: 'Authentication', v: 'Generic Credential Type · Header Auth' },
            { k: 'Options', v: 'Timeout 5000 ms' },
          ],
          run: (items, ctx) => {
            const a = ctx.fixtures.account as Json | undefined;
            return { items: items.map(() => item(a ?? { error: 'not_found' })), log: a ? `${a.plan}, $${a.mrr} a month, CSM ${a.csm}.` : 'No such account.' };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'classify',
          name: 'What is it about?',
          type: 'Text Classifier',
          operation: 'Model: OpenAI Chat Model (gpt-4.1-mini, temperature 0)',
          icon: 'ai',
          tone: 'ai',
          credential: 'Slotwise OpenAI',
          summary: 'An AI root node with an OpenAI Chat Model sub-node. It reads the subject and message, and only those: no name, email or account details go to the model. Four categories with descriptions, one output each, and When No Clear Match set to Output on Extra ‘Other’ Branch, so nothing is silently dropped.',
          params: [
            { k: 'Input Prompt', v: "{{ $('The ticket').item.json.subject }}\\n\\n{{ $('The ticket').item.json.message }}" },
            { k: 'Categories', v: 'Outage · Billing · Bug · How-to, each with a description' },
            { k: 'Options', v: "Allow Multiple Classes To Be True off · When No Clear Match: Output on Extra 'Other' Branch" },
          ],
          code: { language: 'text', source: categories },
          run: (items, ctx) => {
            const t = ticket(ctx);
            const cat = (ctx.fixtures.category as Category | undefined) ?? guessCategory(`${t.subject} ${t.message}`);
            const i = CATEGORIES.indexOf(cat);
            return { outputs: CATEGORIES.map((_, k) => (k === i ? items : [])), log: `${cat}.${ctx.fixtures.category ? '' : ' (In this simulator, keyword rules stand in for the model.)'}` };
          },
        },
        branches: [
          {
            label: 'Outage',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'incident',
                  name: 'Page #incidents',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Slotwise Slack (bot)',
                  summary: 'Posted before the ticket even exists, with the account and the customer’s own words. Ravi’s on-call alerting watches the channel.',
                  params: [{ k: 'Channel', v: vars.incidents_channel }],
                  run: (items, ctx) => {
                    const t = ticket(ctx);
                    const a = account(ctx);
                    return { items, messages: [{ channel: 'slack', to: vars.incidents_channel, subject: `Possible outage reported: ${t.subject}`, body: `${t.name}${known(a) ? `, ${a.name} (${a.plan}, ${a.locations} locations)` : ''}: “${t.message}”\nPage: ${t.page}` }] };
                  },
                },
              },
              route('Outage', 'route-outage', 'as an incident'),
            ],
          },
          { label: 'Billing', joins: true, steps: [route('Billing', 'route-billing')] },
          {
            label: 'Bug',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'jira',
                  name: 'Open a Jira issue',
                  type: 'Jira Software',
                  operation: 'Issue › Create',
                  icon: 'ticket',
                  tone: 'app',
                  credential: 'Slotwise Jira (API token)',
                  summary: 'In the SUP project, type Bug, label from-support, with the customer’s message and the page they were on. Engineering triages SUP; the key goes onto the Zendesk ticket.',
                  params: [
                    { k: 'Project', v: vars.jira_project },
                    { k: 'Issue Type', v: 'Bug' },
                    { k: 'Summary', v: "{{ $('The ticket').item.json.subject }}" },
                  ],
                  run: (items) => ({ items: items.map(() => item({ id: '10482', key: 'SUP-1482', self: 'https://slotwise.atlassian.example/rest/api/3/issue/10482' })), log: 'SUP-1482.' }),
                },
              },
              route('Bug', 'route-bug', 'with the Jira key'),
            ],
          },
          { label: 'How-to', joins: true, steps: [route('How-to', 'route-howto')] },
          { label: 'Other', rule: 'No clear match.', joins: true, steps: [route('Other', 'route-other')] },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'merge',
          name: 'One route',
          type: 'Merge',
          operation: 'Append · 5 inputs',
          icon: 'merge',
          tone: 'flow',
          summary: 'Number of Inputs 5, one per classifier output. Exactly one has the item; Append passes it on, so the Zendesk call below is built once.',
          params: [
            { k: 'Mode', v: 'Append' },
            { k: 'Number of Inputs', v: '5' },
          ],
          run: (items) => ({ items }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'zendesk',
          name: 'Create the Zendesk ticket',
          type: 'HTTP Request',
          operation: 'POST /api/v2/tickets.json',
          icon: 'http',
          tone: 'app',
          credential: 'Slotwise Zendesk (API token)',
          summary: 'HTTP Request with the predefined Zendesk credential type, because the API takes requester, group, type, priority, tags and custom fields in one call. Retry On Fail, three tries a second apart: a ticket is the one thing this workflow must not lose.',
          settings: { retryOnFail: { maxTries: 3, waitMs: 1000 } },
          params: [
            { k: 'Authentication', v: 'Predefined Credential Type · Zendesk API' },
            { k: 'Body', v: 'JSON (below)' },
          ],
          code: { language: 'json', source: zendeskBody },
          run: (items, ctx) => {
            const r = items[0].json;
            const t = ticket(ctx);
            const n = 88000 + (Number(ctx.executionId) % 1000);
            return {
              items: [item({ ticket: { id: n, status: 'new', group_id: r.group_id, type: r.type, priority: r.priority, tags: r.tags } })],
              messages: [{ channel: 'task', to: `Zendesk · ${r.group}`, subject: `#${n} ${t.subject}`, body: `Type ${r.type}, priority ${r.priority}, tags ${(r.tags as string[]).join(', ')}${r.jira ? `, linked ${r.jira}` : ''}. Requester ${t.name} <${t.email}>.` }],
              log: `Ticket #${n}.`,
            };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'big',
          name: 'Big account?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'Number condition on the looked-up revenue, with Convert types where required on, so a missing value (unknown account, or the API was down) is simply not 300 or more.',
          params: [{ k: 'Condition', v: "{{ $('Look up the account').item.json.mrr }} is greater than or equal to 300" }],
          run: (items, ctx) => {
            const a = account(ctx);
            const yes = known(a) && Number(a.mrr) >= 300;
            return { outputs: yes ? [items, []] : [[], items], log: known(a) ? `$${a.mrr} a month.` : 'No account details.' };
          },
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'csm',
                  name: 'Tell their CSM',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Slotwise Slack (bot)',
                  summary: 'A direct message to the account’s success manager, looked up by the email the API returned, with the category and the ticket number, so they can reach out before the customer has to ask twice.',
                  params: [{ k: 'Send Message To', v: "User · {{ $('Look up the account').item.json.csm_email }}" }],
                  run: (items, ctx) => {
                    const a = account(ctx);
                    const t = ticket(ctx);
                    const z = items[0].json.ticket as Json;
                    const cat = ctx.$('One route')[0].json.category;
                    return { items, messages: [{ channel: 'slack', to: `DM to ${a.csm}`, body: `${a.name} ($${a.mrr}/mo) just wrote in: ${String(cat).toLowerCase()}, ticket #${z.id}. ${t.name}: “${t.subject}”` }] };
                  },
                },
              },
            ],
          },
          { label: 'false', steps: [] },
        ],
      },
    ],
  },
  scenarios: [
    {
      id: 'outage',
      label: 'Booking page down, big account',
      summary: 'A 12-location salon group says clients cannot open its booking page. #incidents hears in about a second, Zendesk gets an urgent incident in Tier 2, and Chloe gets a direct message.',
      start: at(1, 14, 3),
      input: [ticketItem({ account_id: 'acc_7HX2QK', name: 'Imani Brooks', email: 'imani@lumenhair.example', subject: 'Booking page not loading for our clients', message: 'Since about 2pm none of our clients can open the booking page. It just spins. This is all 12 locations.', page: 'app.slotwise.example/settings/booking-page' })],
      fixtures: { category: 'Outage', account: { id: 'acc_7HX2QK', name: 'Lumen Hair Group', plan: 'Scale', mrr: 400, locations: 12, csm: 'Chloe Martin', csm_email: 'chloe@slotwise.example' } },
      expect: { status: 'success', visits: ['shape', 'account', 'classify:0', 'incident', 'route-outage', 'merge', 'zendesk', 'big:0', 'csm'] },
    },
    {
      id: 'billing',
      label: 'Charged twice',
      summary: 'A yoga studio was charged twice this month. Billing group, normal priority. A $79 account, so no direct message.',
      start: at(2, 9, 40),
      input: [ticketItem({ account_id: 'acc_3MP8VA', name: 'Sara Lind', email: 'sara@stillwateryoga.example', subject: 'Double charge on my card', message: 'I see two charges of $79 this month on my card. Can you refund one?' })],
      fixtures: { category: 'Billing', account: { id: 'acc_3MP8VA', name: 'Stillwater Yoga', plan: 'Studio', mrr: 79, locations: 1, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' } },
      expect: { status: 'success', visits: ['classify:1', 'route-billing', 'zendesk', 'big:1'], skips: ['csm'] },
    },
    {
      id: 'bug',
      label: 'Reminders at the wrong time',
      summary: 'A physio clinic’s reminder texts go out an hour early since the clocks changed. The classifier calls it a bug: Jira SUP-1482 is opened and linked on the Zendesk ticket.',
      start: at(2, 16, 12),
      input: [ticketItem({ account_id: 'acc_9QD4TR', name: 'Dr. Tom Ellery', email: 'tom@ellerypt.example', subject: 'Reminders going out an hour early', message: 'Since the weekend our reminder texts say 9am for 10am appointments. Patients are turning up early.' })],
      fixtures: { category: 'Bug', account: { id: 'acc_9QD4TR', name: 'Ellery Physiotherapy', plan: 'Clinic', mrr: 149, locations: 2, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' } },
      expect: { status: 'success', visits: ['classify:2', 'jira', 'route-bug', 'zendesk'], skips: ['incident'] },
    },
    {
      id: 'howto',
      label: 'How do I add a deposit?',
      summary: 'A barber asks how to take deposits. How-to, Tier 1, low priority, where the help-center macros live.',
      start: at(3, 11, 25),
      input: [ticketItem({ account_id: 'acc_5KJ1NB', name: 'Marco Bianchi', email: 'marco@bianchibarbers.example', subject: 'Deposits for new clients?', message: 'How do I ask new clients for a $10 deposit when they book?' })],
      fixtures: { category: 'How-to', account: { id: 'acc_5KJ1NB', name: 'Bianchi Barbers', plan: 'Studio', mrr: 39, locations: 1, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' } },
      expect: { status: 'success', visits: ['classify:3', 'route-howto'] },
    },
    {
      id: 'other',
      label: 'Just a thank-you',
      summary: '“You guys are great, that’s all!” fits none of the four. The extra Other output catches it, so it still becomes a ticket, in Tier 1 and tagged ai-other, instead of being discarded.',
      start: at(4, 10, 2),
      input: [ticketItem({ account_id: 'acc_3MP8VA', name: 'Sara Lind', email: 'sara@stillwateryoga.example', subject: 'Thank you!', message: 'Refund came through. You guys are great, that’s all!' })],
      fixtures: { category: 'Other', account: { id: 'acc_3MP8VA', name: 'Stillwater Yoga', plan: 'Studio', mrr: 79, locations: 1, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' } },
      expect: { status: 'success', visits: ['classify:4', 'route-other', 'zendesk'] },
    },
    {
      id: 'api-down',
      label: 'The account API is down',
      summary: 'Slotwise’s internal API times out during a deploy. On Error is Continue, so the error becomes the item, the ticket is still classified and created, and the plan field says unknown.',
      start: at(0, 17, 48),
      input: [ticketItem({ account_id: 'acc_7HX2QK', name: 'Imani Brooks', email: 'imani@lumenhair.example', subject: 'Where do I change opening hours?', message: 'How can I change our opening hours for the holiday?' })],
      fixtures: { category: 'How-to' },
      failures: { account: [{ status: 504, message: 'Gateway Timeout' }] },
      expect: { status: 'success', visits: ['account', 'classify:3', 'zendesk', 'big:1'], skips: ['csm'] },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Slotwise backend to n8n (header auth)', type: 'Header Auth', note: 'The product’s backend holds the secret; the form in the browser never calls n8n directly.' },
      { name: 'Slotwise internal API (header auth)', type: 'Header Auth', note: 'A read-only service key for the accounts endpoint.' },
      { name: 'Slotwise OpenAI', type: 'OpenAI API', note: 'A project key with a monthly budget cap. API data is not used to train OpenAI’s models by default.' },
      { name: 'Slotwise Jira (API token)', type: 'Jira SW Cloud API', note: 'A service account that can create issues in SUP only.' },
      { name: 'Slotwise Zendesk (API token)', type: 'Zendesk API', note: 'Used through HTTP Request as a predefined credential type.' },
      { name: 'Slotwise Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #incidents and can message staff directly.' },
    ],
    fields: [
      { name: 'plan, mrr, locations, csm, csm_email', where: 'Internal API: GET /accounts/:id', type: 'JSON', note: 'mrr in dollars per month' },
      { name: 'group_id, type, priority, tags', where: 'Zendesk ticket', type: 'Ticket fields', note: 'Set by the route' },
      { name: 'Plan (36011804)', where: 'Zendesk custom field', type: 'Text', note: 'unknown when the account lookup failed' },
    ],
    variables: [
      { key: 'api_base', value: vars.api_base },
      { key: 'jira_project', value: vars.jira_project },
    ],
  },
  build: [
    { title: 'The backend calls n8n, not the browser', body: 'Slotwise’s backend adds the account ID from the user’s session and posts to the Webhook with a header secret. Respond: Immediately with 202, because the app needs no answer beyond “received”.' },
    { title: 'Look things up, but do not depend on it', body: 'HTTP Request to the internal accounts API with a 5-second timeout and On Error set to Continue. If the API is slow during a deploy, the error becomes the item and triage carries on. A support ticket matters more than its enrichment.' },
    { title: 'Classify with descriptions, not keywords', body: 'A Text Classifier root node with an OpenAI Chat Model sub-node at temperature 0. Each category has a description of what belongs in it, which is what makes “reminders an hour early” a bug and not an outage. When No Clear Match sends anything odd to an extra Other output instead of discarding it, which is the default.' },
    { title: 'Send the model only what it needs', body: 'The Input Prompt is the subject and the message. Names, emails and account details stay out of the request to OpenAI; the routing reads them from earlier nodes with $().' },
    { title: 'Side effects per route, one ticket', body: 'Outages post to #incidents first; bugs open a Jira issue first. Each route then sets the same four fields with Edit Fields, all five outputs meet at a Merge with Number of Inputs set to 5, and one HTTP Request creates the Zendesk ticket.' },
    { title: 'Use the API where the node stops short', body: 'HTTP Request with the predefined Zendesk credential type, so authentication is handled by the saved credential, and the full ticket API is available in one call: requester, group, type, priority, tags and custom fields.' },
    { title: 'Measure the classifier', body: 'Before going live I ran 200 of last quarter’s tickets through a copy, pinned as data, and compared its answers with the tags support had given them by hand. Felix reviews the ai-other tag weekly, and the descriptions are adjusted from that.' },
  ],
  edgeCases: [
    { title: 'The model is wrong', body: 'A how-to marked as a bug opens a Jira issue that engineering closes in a click, and the Zendesk ticket can be moved by hand like any other. Every AI-routed ticket is tagged ai-triaged, so wrong calls can be counted.' },
    { title: 'OpenAI is down or slow', body: 'The classifier fails and the execution stops, so the ticket would be missing. A follow-up I proposed: an error output on the classifier wired straight to the Merge with the Other route’s fields, so the ticket is created untriaged instead.' },
    { title: 'Someone writes in two languages', body: 'The model handles it; the categories are about meaning, not words. The simulator’s keyword rules do not, which is one of the differences between them.' },
    { title: 'The same customer sends three tickets in a minute', body: 'Three tickets. Zendesk’s own side conversations and merge tool handle it; n8n deduplicating messages from a human would hide real follow-ups.' },
    { title: 'A message contains a password or card number', body: 'It reaches Zendesk as the customer wrote it, as it would by email, and the model sees it. Zendesk’s redaction is the fix; a future Code node could mask card-like numbers before the classifier.' },
  ],
  qa: [
    '200 historical tickets as pinned data: classifier agreed with support’s hand tags on 9 in 10, and every disagreement was read',
    'One test ticket per category: right group, type, priority and tags in Zendesk; Jira only for bugs; #incidents only for outages',
    'Unknown account and a stopped internal API: ticket still created, Plan unknown, no direct message',
    'A $400 account: the CSM gets one direct message with the ticket number',
    'The OpenAI request in the execution data holds the subject and message and nothing else',
  ],
  snippets: [
    { title: 'Category descriptions (Text Classifier)', language: 'text', code: categories, note: 'What the model reads to decide. The fifth output, Other, comes from When No Clear Match.' },
    { title: 'Create ticket (HTTP Request body)', language: 'json', code: zendeskBody, note: 'Predefined Credential Type: Zendesk API. Group ids come from the route.' },
  ],
  features: ['Webhook (Respond Immediately)', 'Header Auth', 'HTTP Request', 'On Error: Continue', 'Text Classifier', 'OpenAI Chat Model', 'Other branch', 'Edit Fields (Set)', 'Jira Software', 'Merge (5 inputs)', 'Predefined credential in HTTP Request', 'Retry On Fail', 'If', 'Slack'],
};
