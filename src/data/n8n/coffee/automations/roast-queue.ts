import type { Automation, Item, Json } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

interface Line {
  sku: string;
  title: string;
  variant_title: string;
  quantity: number;
  gift_card?: boolean;
  price: string;
}

/** A Shopify orders/paid payload, trimmed to the fields this workflow reads. */
function order(o: { id: number; name: string; created_at: string; customer: string; note?: string; shipping: string; lines: Line[]; test?: boolean }): Item {
  const [first, last] = o.customer.split(' ');
  return item({
    id: o.id,
    name: o.name,
    created_at: o.created_at,
    financial_status: 'paid',
    test: !!o.test,
    note: o.note ?? null,
    customer: { first_name: first, last_name: last },
    shipping_lines: [{ title: o.shipping }],
    line_items: o.lines.map((l, i) => ({ id: o.id * 10 + i, gift_card: false, requires_shipping: !l.gift_card, ...l })),
  });
}

/** Theo roasts on Tuesdays and Thursdays: an order roasts on the next one after the day it came in. */
function roastDay(createdAt: string): string {
  const [y, m, d] = createdAt.slice(0, 10).split('-').map(Number);
  let t = Date.UTC(y, m - 1, d) + 86400000;
  while (![2, 4].includes(new Date(t).getUTCDay())) t += 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

const roastCode = `// Code node, JavaScript, Mode: Run Once for Each Item.
// Luxon's DateTime is built into the Code node.
const line = $input.item.json;
const ordered = DateTime.fromISO(line.created_at, { zone: 'America/New_York' });

// Theo roasts on Tuesdays (weekday 2) and Thursdays (4). An order roasts on
// the next roast day after the day it came in, so beans are never roasted
// before the order exists and never sit more than two days.
let day = ordered.plus({ days: 1 }).startOf('day');
while (![2, 4].includes(day.weekday)) day = day.plus({ days: 1 });

// Variant titles read "Whole bean / 12 oz".
const [grind, size] = String(line.variant_title).split(' / ');

return {
  json: {
    order: line.name,
    roast_by: day.toISODate(),
    coffee: line.title,
    grind,
    size,
    bags: line.quantity,
    sku: line.sku,
  },
};`;

const orderOf = (j: Json) => j as { name: string; note: string | null; customer: { first_name: string; last_name: string }; shipping_lines: { title: string }[] };

export const roastQueue: Automation = {
  id: 'roast-queue',
  number: '02',
  name: 'Orders to the roast queue',
  kicker: 'Fulfillment',
  tagline: 'Every paid order becomes one row per bag in Theo’s roast queue and one row per mug or grinder in Jess’s pick list, with the roast day worked out. Gift notes and express orders get a heads-up in #packing.',
  problem:
    'Each morning Theo opened Shopify, read the new orders and copied every bag onto a whiteboard: which coffee, which grind, which size. It took half an hour, gift notes were missed about once a week, and a Monday-night order could be roasted Tuesday or Thursday depending on who looked.',
  solution:
    'The Shopify Trigger fires on every paid order. Test orders are filtered out and a Remove Duplicates node makes sure an order Shopify delivers twice is only counted once. Split Out turns the order into one item per line, and a Switch sends coffee to a Code node that picks the roast day and appends it to the Roast queue sheet, while mugs and grinders go to the Pick list sheet. Gift cards ship nothing and stop there. The lines meet again at a Merge, an Aggregate folds them back into one item per order, and an If posts to #packing only when there is a gift note or express shipping.',
  workflow: {
    name: '02 · Orders · Roast queue',
    folder: 'Copperleaf / Orders',
    tags: ['shopify', 'fulfillment'],
    trigger: {
      id: 'shopify',
      name: 'New paid order',
      type: 'Shopify Trigger',
      operation: 'Topic: Order Paid (orders/paid)',
      icon: 'cart',
      tone: 'trigger',
      summary: 'n8n registers the Shopify webhook when the workflow is published and verifies Shopify’s HMAC signature on every delivery. Order Paid rather than Order Created, so a bank-transfer order that is paid on Thursday arrives on Thursday, not before it is paid.',
      credential: 'Copperleaf Shopify (access token)',
      params: [{ k: 'Topic', v: 'Order Paid' }],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/New_York',
      saveFailed: true,
      saveSuccess: false,
      notes: [
        'Execution order v1: when the Switch sends lines down several outputs, the Coffee branch finishes before the Gear branch starts, and the Merge waits for both. Branch order follows their position on the canvas, top to bottom.',
        'Save successful production executions off: around 120 orders a day, and Shopify already keeps every order. Failed executions are kept, so a broken one can be retried from the Executions list.',
        'No timeout: a run takes about two seconds, but a slow Google Sheets API should not cut an order in half.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'not-test',
          name: 'Real orders only',
          type: 'Filter',
          icon: 'filter',
          tone: 'logic',
          summary: 'Drops Shopify test orders (test is true when the order came through the Bogus Gateway or a test card). A Filter has one output: items that fail simply leave, and with none left nothing after it runs.',
          params: [{ k: 'Conditions', v: '{{ $json.test }} is false' }],
          run: (items) => {
            const out = items.filter((it) => !it.json.test);
            return { items: out, log: out.length ? 'Kept: a real order.' : 'Dropped: a test order.' };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'dedupe',
          name: 'Each order once',
          type: 'Remove Duplicates',
          operation: 'Remove Items Processed in Previous Executions',
          icon: 'dedupe',
          tone: 'core',
          summary: 'Keep Items Where Value Is New, on the order id. Shopify can deliver the same webhook more than once, and the history is kept across executions (the default 10,000 ids is about three months of orders), so a second delivery stops here.',
          params: [
            { k: 'Keep Items Where', v: 'Value Is New' },
            { k: 'Value to Dedupe On', v: '{{ $json.id }}' },
          ],
          run: (items, ctx) => {
            const seen = (ctx.fixtures.seenOrders as number[] | undefined) ?? [];
            const out = items.filter((it) => !seen.includes(Number(it.json.id)));
            return { items: out, log: out.length ? `Order ${items[0].json.id} is new; it is now in the history.` : `Order ${items[0].json.id} was already processed by an earlier execution.` };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'split',
          name: 'One item per line',
          type: 'Split Out',
          icon: 'list',
          tone: 'core',
          summary: 'Fields To Split Out: line_items. Include: Selected Other Fields, so each line keeps the order number, date and note. One order with three lines becomes three items, and every node after this runs once per line.',
          params: [
            { k: 'Fields To Split Out', v: 'line_items' },
            { k: 'Include', v: 'Selected Other Fields: name, created_at, note' },
          ],
          run: (items) => {
            const out = items.flatMap((it) => (it.json.line_items as Json[]).map((l) => item({ ...l, name: it.json.name, created_at: it.json.created_at, note: it.json.note })));
            return { items: out, log: `${out.length} line${out.length === 1 ? '' : 's'}.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'kind',
          name: 'What kind of line?',
          type: 'Switch',
          operation: 'Rules',
          icon: 'switch',
          tone: 'logic',
          summary: 'Shopify line items carry no product type, so the rules read the SKU prefix the shop uses: CF- for coffee, GR- for gear. Each item goes to the first rule it matches. Gift cards and anything new fall to the Fallback output, which connects to nothing.',
          params: [
            { k: 'Rules', v: '{{ $json.sku }} starts with CF- · starts with GR-' },
            { k: 'Fallback Output', v: 'Extra Output (Other)' },
          ],
          run: (items) => {
            const outs: Item[][] = [[], [], []];
            for (const it of items) {
              const sku = String(it.json.sku);
              outs[sku.startsWith('CF-') ? 0 : sku.startsWith('GR-') ? 1 : 2].push(it);
            }
            return { outputs: outs, log: `Coffee ${outs[0].length}, gear ${outs[1].length}, other ${outs[2].length}.` };
          },
        },
        branches: [
          {
            label: 'Coffee',
            rule: 'sku starts with CF-',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'roast-day',
                  name: 'Pick the roast day',
                  type: 'Code',
                  operation: 'JavaScript · Run Once for Each Item',
                  icon: 'code',
                  tone: 'core',
                  summary: 'Works out the next Tuesday or Thursday after the order day with Luxon, and splits “Whole bean / 12 oz” into grind and size. Returns exactly the columns of the Roast queue sheet.',
                  code: { language: 'javascript', source: roastCode },
                  run: (items) => {
                    const out = items.map((it) => {
                      const j = it.json as unknown as Line & { name: string; created_at: string };
                      const [grind, size] = j.variant_title.split(' / ');
                      return item({ order: j.name, roast_by: roastDay(j.created_at), coffee: j.title, grind, size, bags: j.quantity, sku: j.sku });
                    });
                    return { items: out, log: `Roast by ${out[0]?.json.roast_by}.` };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'sheet-roast',
                  name: 'Add to Roast queue',
                  type: 'Google Sheets',
                  operation: 'Row › Append',
                  icon: 'sheet',
                  tone: 'app',
                  credential: 'Copperleaf Google (OAuth2)',
                  summary: 'Appends one row per item to the Roast queue tab. Mapping Column Mode: Map Automatically, so the Code node’s keys must match the column headers, which they do by design. Theo sorts the tab by roast_by.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 1000 } },
                  params: [
                    { k: 'Document', v: 'Copperleaf Production' },
                    { k: 'Sheet', v: 'Roast queue' },
                    { k: 'Mapping Column Mode', v: 'Map Automatically' },
                  ],
                  run: (items) => ({ items, log: `${items.length} row${items.length === 1 ? '' : 's'} appended.` }),
                },
              },
            ],
          },
          {
            label: 'Gear',
            rule: 'sku starts with GR-',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'sheet-pick',
                  name: 'Add to Pick list',
                  type: 'Google Sheets',
                  operation: 'Row › Append',
                  icon: 'sheet',
                  tone: 'app',
                  credential: 'Copperleaf Google (OAuth2)',
                  summary: 'Mugs, grinders and filters ship from the shelf, not the roaster. Map Each Column Manually here, because the Split Out item has more fields than the Pick list has columns.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 1000 } },
                  params: [
                    { k: 'Sheet', v: 'Pick list' },
                    { k: 'Columns', v: 'order = {{ $json.name }} · item = {{ $json.title }} · qty = {{ $json.quantity }}' },
                  ],
                  run: (items) => ({ items: items.map((it) => item({ order: it.json.name, item: it.json.title, qty: it.json.quantity })), log: `${items.length} row${items.length === 1 ? '' : 's'} appended.` }),
                },
              },
            ],
          },
          { label: 'Other', rule: 'Fallback: gift cards and any new SKU prefix. Not connected, so these lines stop here.', steps: [] },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'merge',
          name: 'All shipped lines',
          type: 'Merge',
          operation: 'Append',
          icon: 'merge',
          tone: 'flow',
          summary: 'Input 1 from the roast queue, input 2 from the pick list. Append outputs input 1’s items, then input 2’s. An order with only coffee still comes through: only the input that got items has any.',
          params: [{ k: 'Mode', v: 'Append' }],
          run: (items) => ({ items, log: `${items.length} line${items.length === 1 ? '' : 's'} together again.` }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'aggregate',
          name: 'Back to one order',
          type: 'Aggregate',
          operation: 'All Item Data (Into a Single List)',
          icon: 'list',
          tone: 'core',
          summary: 'Folds the lines into one item with a lines list, so the If and the Slack post run once per order, not once per bag.',
          params: [{ k: 'Put Output in Field', v: 'lines' }],
          run: (items) => ({ items: [item({ lines: items.map((it) => it.json) })], log: `1 item, ${items.length} lines.` }),
        },
      },
      {
        kind: 'split',
        node: {
          id: 'heads-up',
          name: 'Gift note or express?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'OR of two conditions on the original order, read with $(\'New paid order\').first(), since there is one order per execution. Anything else needs no heads-up: the sheets are enough.',
          params: [
            { k: 'Condition 1', v: "{{ $('New paid order').first().json.note }} is not empty" },
            { k: 'Condition 2', v: "{{ $('New paid order').first().json.shipping_lines[0].title }} contains Express" },
            { k: 'Combine', v: 'OR' },
          ],
          run: (items, ctx) => {
            const o = orderOf(ctx.$('New paid order')[0].json);
            const yes = !!o.note || /Express/.test(o.shipping_lines[0]?.title ?? '');
            return { outputs: [yes ? items : [], yes ? [] : items], log: yes ? (o.note ? 'Has a gift note.' : 'Express shipping.') : 'No note, standard shipping.' };
          },
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'slack-packing',
                  name: 'Heads-up to #packing',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Copperleaf Slack (bot)',
                  summary: 'The order, the note in quotes so Jess copies it onto the card exactly, and the roast day, which is also the ship day.',
                  params: [
                    { k: 'Channel', v: vars.packing_channel },
                    { k: 'Text', v: "{{ $('New paid order').first().json.name }}: {{ $json.lines.map(l => l.bags + ' × ' + l.coffee).join(', ') }}" },
                  ],
                  run: (items, ctx) => {
                    const o = orderOf(ctx.$('New paid order')[0].json);
                    const lines = (items[0].json.lines as Json[]).map((l) => (l.coffee ? `${l.bags} × ${l.coffee}, ${String(l.grind).toLowerCase()}, ${l.size} (roast ${l.roast_by})` : `${l.qty} × ${l.item}`));
                    const express = /Express/.test(o.shipping_lines[0]?.title ?? '');
                    return {
                      items: [item({ ok: true, channel: 'C04PACKING', ts: '1772470801.300112' })],
                      messages: [{ channel: 'slack', to: vars.packing_channel, body: `${o.name} for ${o.customer.first_name} ${o.customer.last_name}${express ? ', EXPRESS: ship the day it roasts' : ''}\n${lines.join('\n')}${o.note ? `\nGift note: “${o.note}”` : ''}` }],
                    };
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
      id: 'gift',
      label: 'Gift order: two coffees and a mug',
      summary: 'Ana’s Monday-morning order has two coffee lines, a mug and a birthday note. Three items after Split Out, two roast rows for Tuesday, one pick-list row, then one #packing post with the note.',
      start: at(0, 9, 12),
      input: [
        order({
          id: 5734120882210,
          name: '#1042',
          created_at: '2026-03-02T09:12:44-05:00',
          customer: 'Ana Ruiz',
          note: 'Happy birthday Dad! Love, Ana',
          shipping: 'Standard (3 to 5 days)',
          lines: [
            { sku: 'CF-ETH-GUJ-12-WB', title: 'Ethiopia Guji', variant_title: 'Whole bean / 12 oz', quantity: 2, price: '19.00' },
            { sku: 'CF-DEC-SWP-12-DR', title: 'Swiss Water Decaf', variant_title: 'Drip grind / 12 oz', quantity: 1, price: '18.00' },
            { sku: 'GR-MUG-COP', title: 'Copperleaf enamel mug', variant_title: 'Default Title', quantity: 1, price: '16.00' },
          ],
        }),
      ],
      expect: { status: 'success', visits: ['not-test', 'dedupe', 'split', 'kind:0', 'roast-day', 'sheet-roast', 'kind:1', 'sheet-pick', 'merge', 'aggregate', 'heads-up:0', 'slack-packing'], items: { split: 3, 'sheet-roast': 2, 'sheet-pick': 1, merge: 3, aggregate: 1 } },
    },
    {
      id: 'subscription',
      label: 'Subscription renewal',
      summary: 'Ben’s fortnightly subscription renews on Tuesday evening: one bag, no note, standard shipping. One roast row for Thursday, and #packing is left alone.',
      start: at(1, 19, 30),
      input: [
        order({
          id: 5734131904011,
          name: '#1057',
          created_at: '2026-03-03T19:30:02-05:00',
          customer: 'Ben Achebe',
          shipping: 'Standard (3 to 5 days)',
          lines: [{ sku: 'CF-HSE-BLD-2L-WB', title: 'House Blend', variant_title: 'Whole bean / 2 lb', quantity: 1, price: '42.00' }],
        }),
      ],
      expect: { status: 'success', visits: ['kind:0', 'sheet-roast', 'merge', 'heads-up:1'], skips: ['sheet-pick', 'slack-packing'], items: { 'sheet-roast': 1 } },
    },
    {
      id: 'gift-card',
      label: 'Express coffee plus a gift card',
      summary: 'Lena buys a bag with express shipping and a $25 gift card. The gift card line takes the Fallback output and goes nowhere; the coffee alone reaches the Merge, and #packing hears it is express.',
      start: at(3, 7, 55),
      input: [
        order({
          id: 5734152210877,
          name: '#1083',
          created_at: '2026-03-05T07:55:19-05:00',
          customer: 'Lena Fischer',
          shipping: 'Express (1 to 2 days)',
          lines: [
            { sku: 'CF-COL-HUI-12-ES', title: 'Colombia Huila', variant_title: 'Espresso grind / 12 oz', quantity: 1, price: '19.00' },
            { sku: 'GC-25', title: 'Copperleaf gift card', variant_title: '$25', quantity: 1, price: '25.00', gift_card: true },
          ],
        }),
      ],
      expect: { status: 'success', visits: ['kind:0', 'kind:2', 'merge', 'heads-up:0', 'slack-packing'], skips: ['sheet-pick'], items: { merge: 1 } },
    },
    {
      id: 'duplicate',
      label: 'Shopify delivers #1042 again',
      summary: 'Shopify’s webhook delivery retries and #1042 arrives a second time. Remove Duplicates has its id from the first execution, outputs nothing, and nothing after it runs: no second set of rows.',
      start: at(0, 9, 14),
      input: [
        order({
          id: 5734120882210,
          name: '#1042',
          created_at: '2026-03-02T09:12:44-05:00',
          customer: 'Ana Ruiz',
          note: 'Happy birthday Dad! Love, Ana',
          shipping: 'Standard (3 to 5 days)',
          lines: [{ sku: 'CF-ETH-GUJ-12-WB', title: 'Ethiopia Guji', variant_title: 'Whole bean / 12 oz', quantity: 2, price: '19.00' }],
        }),
      ],
      fixtures: { seenOrders: [5734120882210] },
      expect: { status: 'success', visits: ['not-test', 'dedupe'], skips: ['split', 'sheet-roast'], items: { dedupe: 0 } },
    },
    {
      id: 'test-order',
      label: 'A test order from the shop admin',
      summary: 'Sam places a test order with Shopify’s Bogus Gateway to check the checkout. The Filter drops it, so it never reaches the history, the sheets or Slack.',
      start: at(4, 15, 2),
      input: [
        order({
          id: 5734170019345,
          name: '#1101',
          created_at: '2026-03-06T15:02:51-05:00',
          customer: 'Sam Ortiz',
          shipping: 'Standard (3 to 5 days)',
          test: true,
          lines: [{ sku: 'CF-ETH-GUJ-12-WB', title: 'Ethiopia Guji', variant_title: 'Whole bean / 12 oz', quantity: 1, price: '19.00' }],
        }),
      ],
      expect: { status: 'success', visits: ['not-test'], skips: ['dedupe', 'split'], items: { 'not-test': 0 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Copperleaf Shopify (access token)', type: 'Shopify Access Token API', note: 'A custom app in the Shopify admin with read_orders and read_products only.' },
      { name: 'Copperleaf Google (OAuth2)', type: 'Google Sheets OAuth2', note: 'The same Google connection as the price list, with Sheets scope added.' },
      { name: 'Copperleaf Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #packing.' },
    ],
    fields: [
      { name: 'order, roast_by, coffee, grind, size, bags, sku', where: 'Sheet: Roast queue', type: 'Columns', note: 'Header names match the Code node’s keys exactly, for Map Automatically' },
      { name: 'order, item, qty', where: 'Sheet: Pick list', type: 'Columns', note: 'Mapped one by one' },
      { name: 'CF-, GR-, GC-', where: 'Shopify SKUs', type: 'Prefix', note: 'The Switch depends on them; new products follow the same scheme' },
    ],
  },
  build: [
    { title: 'Pick the right topic', body: 'Order Created fires for unpaid bank-transfer orders too. Order Paid fires once payment is in, which is when Theo should roast. The Shopify Trigger registers the webhook itself on publish and checks Shopify’s HMAC signature, so there is no secret to copy around.' },
    { title: 'Guard the door', body: 'A Filter drops test orders before anything is recorded. Then Remove Duplicates, with Remove Items Processed in Previous Executions on the order id, because a webhook can arrive twice and two sets of roast rows would mean roasting twice.' },
    { title: 'Think in items', body: 'Split Out turns one order into one item per line, keeping the order number and note on each. From there every node runs once per line, with no loop node needed: n8n nodes already process every item they receive.' },
    { title: 'Route lines, not orders', body: 'The Switch reads the SKU prefix, because Shopify line items do not carry a product type. Coffee and gear each get their own sheet. The Fallback output is deliberately left unconnected, so gift cards end quietly and a new SKU prefix shows up as “other” in the item counts instead of in the wrong sheet.' },
    { title: 'Roast day in code, columns by name', body: 'Luxon in a Code node finds the next Tuesday or Thursday. It returns exactly the sheet’s column names, so the Google Sheets node maps automatically and a new column is one line of code.' },
    { title: 'Join, fold, decide once', body: 'Both sheet branches meet at a Merge in Append mode; with the v1 execution order the coffee branch finishes first. An Aggregate folds the lines into one item, so the If and the Slack post run once per order. The If reads the original order with $(\'New paid order\').first().' },
    { title: 'Test with real payloads', body: 'I pinned four real orders on the trigger (a gift order, a subscription, a gift card and a test order) and executed the workflow against a copy of the sheet, checking item counts on every node before pointing it at the live one.' },
  ],
  edgeCases: [
    { title: 'An order is edited after payment', body: 'Order Paid fires once. If a customer changes a grind by email, Jess edits the row by hand; an Order Updated workflow would also fire for every fulfilment and tracking change, which is noisier than it is worth here.' },
    { title: 'A refund or cancellation', body: 'Not handled here on purpose: the row stays and Theo crosses it off. A cancelled order before roast day is rare, and a person should decide whether the beans go back on the shelf.' },
    { title: 'Google Sheets says 429', body: 'Retry On Fail, three tries a second apart, covers the per-minute quota. A longer outage fails the execution, which is saved, and Sam retries it from the Executions list once Sheets is back. A retry starts again at the failed node with the data the earlier nodes already produced, so Remove Duplicates, which has already seen this order, does not stop it.' },
    { title: 'A new kind of product', body: 'Its SKU prefix matches no rule, so it lands in the Fallback output and the count shows in the execution. Adding GR- or CF- to its SKU, or a third rule, is the fix.' },
    { title: 'Two webhooks for one order at the same moment', body: 'Remove Duplicates checks the history when its node runs. Two deliveries a second apart could both pass, which is why the roast sheet is also sorted by order number: a doubled order is easy to spot. Shopify’s retries usually come minutes apart.' },
  ],
  qa: [
    'Four pinned orders: item counts on Split Out, both sheets, the Merge and the Aggregate match the line counts',
    'Same order executed twice in production: one set of rows, second execution stops at Remove Duplicates',
    'Test order from the Bogus Gateway: no rows, no Slack post',
    'Monday, Tuesday-evening, Wednesday and Saturday orders: roast_by lands on the next Tuesday or Thursday',
    'Gift note and express shipping each post once; a plain order posts nothing',
    'Sheet columns renamed in a copy: Map Automatically leaves the renamed column empty, which is why the header names are locked with a protected range',
  ],
  snippets: [{ title: 'Pick the roast day (Code node)', language: 'javascript', code: roastCode, note: 'Run Once for Each Item. DateTime is Luxon, available in every Code node without an import.' }],
  features: ['Shopify Trigger', 'Filter', 'Remove Duplicates (across executions)', 'Split Out', 'Switch with fallback', 'Code with Luxon', 'Google Sheets', 'Merge (Append)', 'Aggregate', 'If (OR)', 'Slack', 'Execution order v1', 'Retry On Fail'],
};
