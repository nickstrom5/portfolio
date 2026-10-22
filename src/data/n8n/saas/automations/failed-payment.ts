import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const MS_DAY = 86400000;
const vars = business.env.vars;

/** A Stripe invoice.payment_failed event, trimmed to what this workflow reads. */
function event(o: { id: string; invoice: string; customer: string; account: string; amount: number; attempt: number; created: string; next?: string }): Item {
  return item({
    id: o.id,
    object: 'event',
    type: 'invoice.payment_failed',
    created: o.created,
    data: {
      object: {
        id: o.invoice,
        object: 'invoice',
        customer: o.customer,
        amount_due: o.amount * 100,
        currency: 'usd',
        attempt_count: o.attempt,
        next_payment_attempt: o.next ?? null,
        hosted_invoice_url: `https://invoice.stripe.example/i/${o.invoice}`,
        status: 'open',
        subscription_details: { metadata: { account_id: o.account } },
      },
    },
  });
}

const inv = (ctx: RunContext) => (ctx.$('The invoice')[0]?.json ?? {}) as Record<string, string | number>;
const acct = (ctx: RunContext) => (ctx.$('Look up the account')[0]?.json ?? {}) as Record<string, string | number>;

export const failedPayment: Automation = {
  id: 'failed-payment',
  number: '03',
  name: 'Failed payment follow-up',
  kicker: 'Revenue recovery',
  tagline: 'When a subscription payment fails, Stripe’s own retries and emails keep working, and n8n adds what Stripe cannot: a billing banner inside the app for every account, and for accounts worth $300 a month or more, a message to their success manager and a check three days later on whether the invoice got paid.',
  problem:
    'Stripe retried failed cards and emailed the customer, and that was all. The emails went to whoever set up billing, often a salon owner who never opened them, while the front desk using Slotwise every day had no idea. Large accounts churned without anyone at Slotwise speaking to them first.',
  solution:
    'A Stripe Trigger receives invoice.payment_failed. Remove Duplicates drops an event Stripe delivers twice. Edit Fields pulls out the invoice, the amount and the attempt number, and the internal API returns the account. A POST to the same API turns on the in-app billing banner for everyone. Then an If picks out large accounts on their first failure: their success manager gets a direct message with the amount and the invoice link, the workflow waits three days, and an HTTP Request with the predefined Stripe credential fetches the invoice again. Paid: the manager hears it worked. Still open: #success gets an escalation to call.',
  workflow: {
    name: '03 · Billing · Failed payment',
    folder: 'Slotwise / Billing',
    tags: ['stripe', 'billing'],
    trigger: {
      id: 'stripe',
      name: 'Payment failed',
      type: 'Stripe Trigger',
      operation: 'Events: invoice.payment_failed',
      icon: 'card',
      tone: 'trigger',
      summary: 'n8n creates the Stripe webhook endpoint for this one event when the workflow is published, and checks Stripe’s signature on every delivery. Stripe’s Smart Retries and its failed-payment emails stay on; this workflow does not email the customer, so nobody gets two.',
      credential: 'Slotwise Stripe (restricted key)',
      params: [{ k: 'Events', v: 'invoice.payment_failed' }],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'UTC',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'The three-day Wait saves the execution to the database. In queue mode any worker can resume it, and a deploy of n8n in between does not lose it.',
        'Save successful executions on, pruned after 14 days: long enough to cover the wait and a little after.',
        'Stripe’s customer emails stay in Stripe, where the dunning settings and the legal footer already are.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'dedupe',
          name: 'Each event once',
          type: 'Remove Duplicates',
          operation: 'Remove Items Processed in Previous Executions',
          icon: 'dedupe',
          tone: 'core',
          summary: 'Value Is New, on the Stripe event id. Stripe can deliver an event more than once; a second delivery stops here, before a banner or a message happens twice.',
          params: [
            { k: 'Keep Items Where', v: 'Value Is New' },
            { k: 'Value to Dedupe On', v: '{{ $json.id }}' },
          ],
          run: (items, ctx) => {
            const seen = (ctx.fixtures.seenEvents as string[] | undefined) ?? [];
            const out = items.filter((it) => !seen.includes(String(it.json.id)));
            return { items: out, log: out.length ? 'A new event.' : 'Already processed this event.' };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'shape',
          name: 'The invoice',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'The six fields that matter, with the amount in dollars and the account ID from the subscription’s metadata, which Slotwise sets when the subscription is created.',
          params: [
            { k: 'account_id', v: '{{ $json.data.object.subscription_details.metadata.account_id }}' },
            { k: 'amount (Number)', v: '{{ $json.data.object.amount_due / 100 }}' },
            { k: 'attempt', v: '{{ $json.data.object.attempt_count }}' },
          ],
          run: (items) => ({
            items: items.map((it) => {
              const o = (it.json.data as Json).object as Json;
              return item({ invoice_id: o.id, customer: o.customer, account_id: (o.subscription_details as { metadata: Json }).metadata.account_id, amount: Number(o.amount_due) / 100, attempt: o.attempt_count, invoice_url: o.hosted_invoice_url });
            }),
          }),
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
          summary: 'The same endpoint as 01: name, plan, revenue and success manager. Retry On Fail, because this workflow is useless without it, and Stop Workflow if it is really down: Stripe’s own emails still go out.',
          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
          params: [{ k: 'URL', v: `${vars.api_base}/accounts/{{ $json.account_id }}` }],
          run: (items, ctx) => ({ items: items.map(() => item(ctx.fixtures.account as Json)), log: `${(ctx.fixtures.account as Json).name}, $${(ctx.fixtures.account as Json).mrr} a month.` }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'banner',
          name: 'Turn on the billing banner',
          type: 'HTTP Request',
          operation: 'POST /internal/accounts/:id/flags',
          icon: 'http',
          tone: 'app',
          credential: 'Slotwise internal API (header auth)',
          summary: 'Sets billing_issue on the account, which shows every staff member a banner with an Update card button. The product clears the flag itself when Stripe reports the invoice paid. Idempotent, so a second failure sets it again harmlessly.',
          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
          params: [
            { k: 'URL', v: `${vars.api_base}/accounts/{{ $('The invoice').item.json.account_id }}/flags` },
            { k: 'Body', v: '{ "billing_issue": true, "invoice_url": "{{ $(\'The invoice\').item.json.invoice_url }}" }' },
          ],
          run: (items, ctx) => ({ items: items.map(() => item({ ok: true, flags: { billing_issue: true } })), messages: [{ channel: 'task', to: `In the app · ${acct(ctx).name}`, subject: 'Billing banner on', body: 'Your last payment did not go through. Update your card to keep bookings running. [Update card]' }] }),
        },
      },
      {
        kind: 'split',
        node: {
          id: 'worth',
          name: 'Big account, first failure?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'AND: revenue of $300 a month or more, and attempt 1. Stripe sends the event again on every failed retry; only the first should start a person’s follow-up.',
          params: [
            { k: 'Condition 1', v: "{{ $('Look up the account').item.json.mrr }} is greater than or equal to 300" },
            { k: 'Condition 2', v: "{{ $('The invoice').item.json.attempt }} is equal to 1" },
            { k: 'Combine', v: 'AND' },
          ],
          run: (items, ctx) => {
            const yes = Number(acct(ctx).mrr) >= 300 && Number(inv(ctx).attempt) === 1;
            return { outputs: yes ? [items, []] : [[], items], log: yes ? 'Yes.' : Number(acct(ctx).mrr) >= 300 ? `Attempt ${inv(ctx).attempt}: the CSM already knows.` : 'A smaller account: Stripe and the banner handle it.' };
          },
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'tell-csm',
                  name: 'Tell the CSM',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Slotwise Slack (bot)',
                  summary: 'A direct message with the amount, the account and Stripe’s invoice link, which the CSM can forward to whoever pays the bills.',
                  params: [{ k: 'Send Message To', v: "User · {{ $('Look up the account').item.json.csm_email }}" }],
                  run: (items, ctx) => {
                    const a = acct(ctx);
                    const i = inv(ctx);
                    return { items, messages: [{ channel: 'slack', to: `DM to ${a.csm}`, body: `${a.name}’s $${i.amount} payment failed (${a.plan}, ${a.locations} locations). Stripe will retry; the in-app banner is on. Worth a friendly note to their billing contact: ${i.invoice_url}` }] };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'wait',
                  name: 'Give it three days',
                  type: 'Wait',
                  operation: 'Resume: After Time Interval',
                  icon: 'clock',
                  tone: 'flow',
                  summary: 'Three days covers Stripe’s first Smart Retries and gives the customer time to update their card from the banner or the email.',
                  wait: { mode: 'interval', ms: 3 * MS_DAY },
                  params: [{ k: 'Wait Amount', v: '3 days' }],
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'recheck',
                  name: 'Get the invoice again',
                  type: 'HTTP Request',
                  operation: 'GET https://api.stripe.com/v1/invoices/:id',
                  icon: 'http',
                  tone: 'app',
                  credential: 'Slotwise Stripe (restricted key)',
                  summary: 'The Stripe node has no invoice resource, so this is HTTP Request with the predefined Stripe credential type: the same saved key, any endpoint. Asking Stripe for the invoice’s status now is simpler and more reliable than listening for every event that could have changed it.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [
                    { k: 'Authentication', v: 'Predefined Credential Type · Stripe API' },
                    { k: 'URL', v: "https://api.stripe.com/v1/invoices/{{ $('The invoice').item.json.invoice_id }}" },
                  ],
                  run: (items, ctx) => ({ items: items.map(() => item({ id: inv(ctx).invoice_id, object: 'invoice', status: String(ctx.fixtures.statusLater ?? 'open'), amount_paid: ctx.fixtures.statusLater === 'paid' ? Number(inv(ctx).amount) * 100 : 0 })), log: `Status ${ctx.fixtures.statusLater ?? 'open'}.` }),
                },
              },
              {
                kind: 'split',
                node: {
                  id: 'paid',
                  name: 'Paid now?',
                  type: 'If',
                  icon: 'split',
                  tone: 'logic',
                  summary: 'status is equal to paid.',
                  params: [{ k: 'Condition', v: '{{ $json.status }} is equal to paid' }],
                  run: (items) => ({ outputs: items[0].json.status === 'paid' ? [items, []] : [[], items] }),
                },
                branches: [
                  {
                    label: 'true',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'recovered',
                          name: 'Tell the CSM it worked',
                          type: 'Slack',
                          operation: 'Message › Send',
                          icon: 'slack',
                          tone: 'app',
                          credential: 'Slotwise Slack (bot)',
                          summary: 'Closes the loop, so the CSM does not chase a customer who has already paid.',
                          run: (items, ctx) => ({ items, messages: [{ channel: 'slack', to: `DM to ${acct(ctx).csm}`, body: `Good news: ${acct(ctx).name} paid the $${inv(ctx).amount} invoice. Nothing to chase.` }] }),
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
                          id: 'escalate',
                          name: 'Escalate in #success',
                          type: 'Slack',
                          operation: 'Message › Send',
                          icon: 'slack',
                          tone: 'app',
                          credential: 'Slotwise Slack (bot)',
                          summary: 'In the channel, not a DM, so the team lead sees it too: three days, still unpaid, a large account. The ask is a phone call.',
                          params: [{ k: 'Channel', v: vars.success_channel }],
                          run: (items, ctx) => {
                            const a = acct(ctx);
                            const i = inv(ctx);
                            return { items, messages: [{ channel: 'slack', to: vars.success_channel, subject: `Still unpaid after 3 days: ${a.name}`, body: `$${i.amount} (${a.plan}, $${a.mrr}/mo). ${a.csm}, could you call them today? Stripe keeps retrying, but at this size a person should talk to them first. ${i.invoice_url}` }] };
                          },
                        },
                      },
                    ],
                  },
                ],
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
      id: 'recovered',
      label: 'Big account, card updated',
      summary: 'Lumen Hair Group’s $400 payment fails on Monday. Banner on, Chloe hears at once, the execution waits three days, and Stripe now says paid: Chloe is told there is nothing to chase.',
      start: at(0, 9, 2),
      input: [event({ id: 'evt_1QzK8sLumen0001', invoice: 'in_1QzK8rLumen', customer: 'cus_QmLumen7HX2', account: 'acc_7HX2QK', amount: 400, attempt: 1, created: '2026-03-02T09:02:11Z' })],
      fixtures: { account: { name: 'Lumen Hair Group', plan: 'Scale', mrr: 400, locations: 12, csm: 'Chloe Martin', csm_email: 'chloe@slotwise.example' }, statusLater: 'paid' },
      expect: { status: 'success', visits: ['dedupe', 'shape', 'account', 'banner', 'worth:0', 'tell-csm', 'wait', 'recheck', 'paid:0', 'recovered'], skips: ['escalate'] },
    },
    {
      id: 'unpaid',
      label: 'Big account, still unpaid',
      summary: 'A physio group’s $400 card is expired and nobody updates it. Three days later the invoice is still open, and #success gets an escalation for Chloe to call.',
      start: at(1, 14, 30),
      input: [event({ id: 'evt_1QzM2tCoast0001', invoice: 'in_1QzM2sCoast', customer: 'cus_QmCoast4LP', account: 'acc_4LPW9C', amount: 400, attempt: 1, created: '2026-03-03T14:30:42Z' })],
      fixtures: { account: { name: 'Coastline Physio Group', plan: 'Scale', mrr: 400, locations: 6, csm: 'Chloe Martin', csm_email: 'chloe@slotwise.example' }, statusLater: 'open' },
      expect: { status: 'success', visits: ['wait', 'paid:1', 'escalate'] },
    },
    {
      id: 'small',
      label: 'A small studio',
      summary: 'A $79 studio’s card is declined. The banner goes on and Stripe’s emails and retries do the rest. No person is involved, because at this size that would cost more than it saves.',
      start: at(2, 7, 45),
      input: [event({ id: 'evt_1QzN9aStill0001', invoice: 'in_1QzN9aStill', customer: 'cus_QmStill3MP', account: 'acc_3MP8VA', amount: 79, attempt: 1, created: '2026-03-04T07:45:03Z' })],
      fixtures: { account: { name: 'Stillwater Yoga', plan: 'Studio', mrr: 79, locations: 1, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' } },
      expect: { status: 'success', visits: ['banner', 'worth:1'], skips: ['tell-csm', 'wait'] },
    },
    {
      id: 'retry-fail',
      label: 'Stripe’s second try fails too',
      summary: 'Stripe retries Coastline’s card two days later and it fails again: a new event with attempt 2. The banner is set again, harmlessly, and the If stops there, since Chloe was told on the first failure and the first execution is still waiting.',
      start: at(3, 14, 31),
      input: [event({ id: 'evt_1QzQ7bCoast0002', invoice: 'in_1QzM2sCoast', customer: 'cus_QmCoast4LP', account: 'acc_4LPW9C', amount: 400, attempt: 2, created: '2026-03-05T14:31:07Z' })],
      fixtures: { account: { name: 'Coastline Physio Group', plan: 'Scale', mrr: 400, locations: 6, csm: 'Chloe Martin', csm_email: 'chloe@slotwise.example' } },
      expect: { status: 'success', visits: ['banner', 'worth:1'], skips: ['tell-csm'] },
    },
    {
      id: 'duplicate',
      label: 'Stripe sends the event twice',
      summary: 'A network blip and Stripe redelivers Lumen’s event a minute later. Remove Duplicates has its id, outputs nothing, and nothing else runs.',
      start: at(0, 9, 3),
      input: [event({ id: 'evt_1QzK8sLumen0001', invoice: 'in_1QzK8rLumen', customer: 'cus_QmLumen7HX2', account: 'acc_7HX2QK', amount: 400, attempt: 1, created: '2026-03-02T09:02:11Z' })],
      fixtures: { seenEvents: ['evt_1QzK8sLumen0001'] },
      expect: { status: 'success', visits: ['dedupe'], skips: ['shape', 'banner'], items: { dedupe: 0 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Slotwise Stripe (restricted key)', type: 'Stripe API', note: 'A restricted key: read invoices, and write webhook endpoints so the trigger can register itself. Nothing that can move money.' },
      { name: 'Slotwise internal API (header auth)', type: 'Header Auth', note: 'A service key that can read accounts and set the billing flag.' },
      { name: 'Slotwise Slack (bot)', type: 'Slack OAuth2', note: 'Direct messages and #success.' },
    ],
    fields: [
      { name: 'subscription_details.metadata.account_id', where: 'Stripe invoice', type: 'Metadata', note: 'Set by Slotwise when it creates the subscription' },
      { name: 'attempt_count', where: 'Stripe invoice', type: 'Number', note: '1 on the first failure, then up on each Smart Retry' },
      { name: 'billing_issue', where: 'Slotwise account flag', type: 'Boolean', note: 'Shows the banner; the product clears it on invoice.paid' },
    ],
  },
  build: [
    { title: 'Let Stripe do what Stripe does', body: 'Smart Retries and Stripe’s failed-payment emails stay on. This workflow adds the two things Stripe cannot see: the people inside the product, and which accounts are worth a person’s time.' },
    { title: 'Trigger on one event, once', body: 'The Stripe Trigger registers an endpoint for invoice.payment_failed only and checks signatures itself. Remove Duplicates on the event id makes a redelivered event harmless.' },
    { title: 'Tell the people who use the app', body: 'The billing banner is a POST to Slotwise’s own API, set for every account on every failure. Front-desk staff see it the same day; the product clears it when the invoice is paid, so n8n never has to.' },
    { title: 'People only where they pay off', body: 'An If with AND picks accounts at $300 a month or more on their first attempt. Later attempts arrive as new events; the attempt condition stops them from messaging the CSM again.' },
    { title: 'Wait, then ask Stripe directly', body: 'A Wait of three days, then HTTP Request with the predefined Stripe credential type, because the Stripe node has no invoice resource. Asking for the invoice’s current status beats tracking every event that might have changed it.' },
    { title: 'Close the loop', body: 'Paid: the CSM is told, so they do not chase a customer who already fixed it. Still open: an escalation in #success where the team lead sees it too.' },
  ],
  edgeCases: [
    { title: 'The customer pays during the wait', body: 'The product clears the banner on invoice.paid. This execution wakes up on day three, finds the invoice paid and tells the CSM; nothing else changes.' },
    { title: 'Stripe gives up and cancels the subscription', body: 'Stripe’s own setting decides when, after its last retry. That fires different events, which the churn workflow handles; this one has done its job by then.' },
    { title: 'The internal API is down', body: 'Retry On Fail, then the execution stops and is saved as Error. Stripe’s emails still go to the customer; Nadia retries the execution from Executions, which repeats nothing already done, since a retry starts at the failed node.' },
    { title: 'An invoice with no account ID', body: 'An old subscription created before the metadata existed. The lookup returns 404 and the execution fails visibly, which is how those few were found and backfilled.' },
    { title: 'A test-mode event', body: 'The trigger is registered with the live key, so test-mode events go to a separate copy of this workflow pointed at staging. Nothing in test mode can message a CSM.' },
  ],
  qa: [
    'Stripe CLI test events against a staging copy: banner set, and the If takes the right path for $79 and $400 accounts',
    'The same event sent twice: one execution does the work, the second stops at Remove Duplicates',
    'An attempt-2 event: banner set again, no CSM message',
    'Wait shortened to 2 minutes in the copy: paid and open invoices take their own branches',
    'Restricted key cannot create charges or refunds: refused by Stripe',
  ],
  features: ['Stripe Trigger', 'Remove Duplicates (across executions)', 'Edit Fields (Set)', 'HTTP Request', 'Predefined credential type', 'Retry On Fail', 'If (AND)', 'Wait (time interval)', 'Slack', 'Queue mode'],
};
