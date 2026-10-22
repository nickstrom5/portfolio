import type { Automation, Item, Json } from '@/lib/n8n/types';
import { dayKey, item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

/** What Shopify has on hand this morning, by SKU. */
type Stock = Record<string, number>;

const CATALOG: { product: string; id: number; variants: { sku: string; title: string }[] }[] = [
  { product: 'Ethiopia Guji', id: 8123401, variants: [{ sku: 'CF-ETH-GUJ-12-WB', title: 'Whole bean / 12 oz' }, { sku: 'CF-ETH-GUJ-2L-WB', title: 'Whole bean / 2 lb' }] },
  { product: 'House Blend', id: 8123402, variants: [{ sku: 'CF-HSE-BLD-12-WB', title: 'Whole bean / 12 oz' }, { sku: 'CF-HSE-BLD-2L-WB', title: 'Whole bean / 2 lb' }] },
  { product: 'Swiss Water Decaf', id: 8123403, variants: [{ sku: 'CF-DEC-SWP-12-WB', title: 'Whole bean / 12 oz' }] },
  { product: 'Copperleaf enamel mug', id: 8123404, variants: [{ sku: 'GR-MUG-COP', title: 'Default Title' }] },
];

/** The Reorder points sheet: one row per SKU Sam tracks. */
const REORDER: Json[] = [
  { sku: 'CF-ETH-GUJ-12-WB', reorder_point: 24, reorder_qty: 60, supplier: 'Theo roasts (green in stock)' },
  { sku: 'CF-ETH-GUJ-2L-WB', reorder_point: 8, reorder_qty: 20, supplier: 'Theo roasts (green in stock)' },
  { sku: 'CF-HSE-BLD-12-WB', reorder_point: 30, reorder_qty: 80, supplier: 'Theo roasts (green in stock)' },
  { sku: 'CF-HSE-BLD-2L-WB', reorder_point: 10, reorder_qty: 30, supplier: 'Theo roasts (green in stock)' },
  { sku: 'CF-DEC-SWP-12-WB', reorder_point: 12, reorder_qty: 30, supplier: 'Order green: Ridgeline Importers, 9 days' },
  { sku: 'GR-MUG-COP', reorder_point: 15, reorder_qty: 48, supplier: 'Order: Blue Ridge Enamel Co., 3 weeks' },
];

const products = (stock: Stock): Json[] =>
  CATALOG.map((p) => ({ id: p.id, title: p.product, status: 'active', variants: p.variants.map((v, i) => ({ id: p.id * 100 + i, sku: v.sku, title: v.title, inventory_quantity: stock[v.sku] ?? 50 })) }));

const flattenCode = `// Code node, JavaScript, Mode: Run Once for All Items.
// Shopify returns one item per product; the sheet has one row per variant.
const out = [];
for (const product of $input.all()) {
  for (const v of product.json.variants) {
    out.push({
      json: {
        sku: v.sku,
        name: \`\${product.json.title}, \${v.title === 'Default Title' ? 'each' : v.title}\`,
        on_hand: v.inventory_quantity,
      },
    });
  }
}
return out;`;

export const stockCheck: Automation = {
  id: 'stock-check',
  number: '03',
  name: 'Morning stock check',
  kicker: 'Inventory',
  tagline: 'At 6 AM, Monday to Saturday, Shopify stock is matched against the reorder points in a sheet. Anything at or below its point is posted to #ops once a week, with how many to make or order, and a morning with nothing low posts nothing.',
  problem:
    'Copperleaf ran out of its best-selling 12 oz Guji twice in one winter, and the decaf once, which takes nine days to restock because the green coffee comes from an importer. Shopify can email when stock is low, but only per product and with no idea that one item is roasted in-house and another ordered from overseas.',
  solution:
    'A Schedule Trigger runs at 6 AM in the roastery’s time zone. One branch asks Shopify for every product and a Code node flattens them to one item per SKU; the other reads the Reorder points sheet Sam keeps. A Merge joins the two on SKU, a Filter keeps what is at or below its point, and Remove Duplicates, keyed on the SKU and the week, means each item is raised once a week rather than every morning. An Edit Fields node writes one line per item, an Aggregate gathers them, and one Slack message lands in #ops. Shopify’s rate limit is handled by Retry On Fail.',
  workflow: {
    name: '03 · Inventory · Morning stock check',
    folder: 'Copperleaf / Inventory',
    tags: ['schedule', 'inventory'],
    trigger: {
      id: 'schedule',
      name: 'Every morning at 6',
      type: 'Schedule Trigger',
      operation: 'Custom (Cron): 0 6 * * 1-6',
      icon: 'clock',
      tone: 'trigger',
      summary: 'A cron expression, because the simple interval options cannot skip Sundays. It runs in the workflow’s time zone, set to America/New_York, so 6 AM stays 6 AM across daylight saving.',
      params: [{ k: 'Trigger Rules', v: 'Custom (Cron) · 0 6 * * 1-6' }],
      run: (items, ctx) => ({ items: items.map(() => item({ timestamp: `${dayKey(ctx.now)}T06:00:00.000-05:00`, 'Readable date': 'This morning, 6:00 AM', Timezone: 'America/New_York (UTC-05:00)' })) }),
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/New_York',
      saveFailed: true,
      saveSuccess: true,
      timeout: 300,
      notes: [
        'Timezone America/New_York: Schedule Triggers and $now both use it. Left at the instance default, the cron would follow the server’s clock.',
        'Execution order v1: the Shopify branch, drawn on top, runs to its end before the sheet branch starts, and the Merge runs once both are done.',
        'Timeout 5 minutes. A normal run takes three seconds; a stuck one should not hold the 6 AM slot into the next day.',
      ],
    },
    steps: [
      {
        kind: 'split',
        id: 'fan',
        branches: [
          {
            label: 'Stock',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'products',
                  name: 'Get all products',
                  type: 'Shopify',
                  operation: 'Product › Get Many',
                  icon: 'cart',
                  tone: 'app',
                  credential: 'Copperleaf Shopify (access token)',
                  summary: 'Return All on, so n8n pages through Shopify itself. Shopify allows about two REST calls a second per app; a busy moment answers 429, and Retry On Fail waits five seconds and tries again.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 5000 } },
                  params: [
                    { k: 'Return All', v: 'On' },
                    { k: 'Filters', v: 'Status: Active' },
                  ],
                  run: (_items, ctx) => {
                    const ps = products((ctx.fixtures.stock as Stock) ?? {});
                    return { items: ps.map((p) => item(p)), log: `${ps.length} products.` };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'flatten',
                  name: 'One item per SKU',
                  type: 'Code',
                  operation: 'JavaScript · Run Once for All Items',
                  icon: 'code',
                  tone: 'core',
                  summary: 'Run Once for All Items, returning an array of { json }. Each variant becomes its own item with the SKU, a readable name and what is on hand.',
                  code: { language: 'javascript', source: flattenCode },
                  run: (items) => {
                    const out = items.flatMap((p) =>
                      (p.json.variants as Json[]).map((v) => item({ sku: v.sku, name: `${p.json.title}, ${v.title === 'Default Title' ? 'each' : v.title}`, on_hand: v.inventory_quantity })),
                    );
                    return { items: out, log: `${out.length} SKUs.` };
                  },
                },
              },
            ],
          },
          {
            label: 'Reorder points',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'points',
                  name: 'Read reorder points',
                  type: 'Google Sheets',
                  operation: 'Row › Get Row(s)',
                  icon: 'sheet',
                  tone: 'app',
                  credential: 'Copperleaf Google (OAuth2)',
                  summary: 'Every row of the Reorder points tab: SKU, reorder point, how many to make or order, and who supplies it. Sam changes the numbers in the sheet, never in n8n.',
                  params: [
                    { k: 'Document', v: 'Copperleaf Production' },
                    { k: 'Sheet', v: 'Reorder points' },
                  ],
                  run: () => ({ items: REORDER.map((r) => item(r)), log: `${REORDER.length} rows.` }),
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'match',
          name: 'Match stock to points',
          type: 'Merge',
          operation: 'Combine › Matching Fields',
          icon: 'merge',
          tone: 'flow',
          summary: 'Input 1 is the SKUs, input 2 the sheet rows, matched on sku in both. Output Type: Keep Matches, so a product nobody has given a reorder point is left out rather than guessed at.',
          params: [
            { k: 'Fields to Match', v: 'sku = sku' },
            { k: 'Output Type', v: 'Keep Matches' },
          ],
          run: (_items, _ctx, inputs) => {
            const [skus = [], rows = []] = inputs ?? [];
            const out: Item[] = [];
            for (const s of skus) {
              const r = rows.find((x) => x.json.sku === s.json.sku);
              if (r) out.push(item({ ...s.json, ...r.json }));
            }
            return { items: out, log: `${out.length} of ${skus.length} SKUs have a reorder point.` };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'low',
          name: 'At or below the point',
          type: 'Filter',
          icon: 'filter',
          tone: 'logic',
          summary: 'Number comparison, on_hand is less than or equal to reorder_point. On a quiet morning nothing passes, and since Always Output Data is off, nothing after this runs and #ops hears nothing.',
          params: [{ k: 'Conditions', v: '{{ $json.on_hand }} is less than or equal to {{ $json.reorder_point }}' }],
          run: (items) => {
            const out = items.filter((it) => Number(it.json.on_hand) <= Number(it.json.reorder_point));
            return { items: out, log: out.length ? `${out.length} low.` : 'Nothing is low.' };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'weekly',
          name: 'Once a week per SKU',
          type: 'Remove Duplicates',
          operation: 'Remove Items Processed in Previous Executions',
          icon: 'dedupe',
          tone: 'core',
          summary: 'Value Is New, on the SKU plus the Monday of this week. A SKU raised on Monday is not raised again on Tuesday, but is raised again next Monday if it is still low.',
          params: [
            { k: 'Keep Items Where', v: 'Value Is New' },
            { k: 'Value to Dedupe On', v: "{{ $json.sku }}|{{ $now.startOf('week').toISODate() }}" },
          ],
          run: (items, ctx) => {
            const seen = (ctx.fixtures.seen as string[] | undefined) ?? [];
            const week = (() => {
              const d = new Date(`${dayKey(ctx.now)}T00:00:00Z`);
              return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
            })();
            const out = items.filter((it) => !seen.includes(`${it.json.sku}|${week}`));
            const dropped = items.length - out.length;
            return { items: out, log: `${out.length} new this week${dropped ? `, ${dropped} already raised since Monday` : ''}.` };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'line',
          name: 'Write the line',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'One readable line per SKU in a field called line, so the Slack message is a plain list.',
          params: [{ k: 'line', v: '{{ $json.name }}: {{ $json.on_hand }} left (point {{ $json.reorder_point }}). {{ $json.supplier }}, {{ $json.reorder_qty }}.' }],
          run: (items) => ({
            items: items.map((it) => item({ line: `${it.json.name}: ${it.json.on_hand} left (point ${it.json.reorder_point}). ${it.json.supplier}, ${it.json.reorder_qty}.` })),
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'gather',
          name: 'Gather the lines',
          type: 'Aggregate',
          operation: 'Individual Fields',
          icon: 'list',
          tone: 'core',
          summary: 'Input Field Name line, output field lines: one item holding the list, so Slack is called once.',
          params: [{ k: 'Input Field Name', v: 'line → lines' }],
          run: (items) => ({ items: [item({ lines: items.map((it) => it.json.line) })] }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'slack',
          name: 'Post to #ops',
          type: 'Slack',
          operation: 'Message › Send',
          icon: 'slack',
          tone: 'app',
          credential: 'Copperleaf Slack (bot)',
          summary: 'One message with every low item on its own line. Theo reads it before the first roast; Sam places any outside orders.',
          params: [
            { k: 'Channel', v: vars.ops_channel },
            { k: 'Text', v: "Low stock this morning:\\n{{ $json.lines.join('\\n') }}" },
          ],
          run: (items) => {
            const lines = items[0].json.lines as string[];
            return { items: [item({ ok: true, channel: 'C04OPS', ts: '1772449202.410077' })], messages: [{ channel: 'slack', to: vars.ops_channel, subject: `Low stock this morning (${lines.length})`, body: lines.join('\n') }] };
          },
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'monday',
      label: 'Monday: three things low',
      summary: 'After a big weekend the 12 oz Guji, the decaf and the mugs are at or under their points. Six SKUs match six sheet rows, three pass the Filter, and one #ops message lists all three.',
      start: at(0, 6, 0),
      input: [item({})],
      fixtures: { stock: { 'CF-ETH-GUJ-12-WB': 18, 'CF-DEC-SWP-12-WB': 12, 'GR-MUG-COP': 9, 'CF-HSE-BLD-12-WB': 41 } },
      expect: { status: 'success', visits: ['products', 'fan:0', 'fan:1', 'flatten', 'points', 'match', 'low', 'weekly', 'line', 'gather', 'slack'], items: { products: 4, flatten: 6, points: 6, match: 6, low: 3, weekly: 3, gather: 1 } },
    },
    {
      id: 'tuesday',
      label: 'Tuesday: two still low, one new',
      summary: 'The decaf and the mugs are still low, but #ops heard about them yesterday. Remove Duplicates drops those two, and the message names only the House Blend 2 lb, which dipped overnight.',
      start: at(1, 6, 0),
      input: [item({})],
      fixtures: {
        stock: { 'CF-ETH-GUJ-12-WB': 70, 'CF-DEC-SWP-12-WB': 10, 'GR-MUG-COP': 8, 'CF-HSE-BLD-2L-WB': 6 },
        seen: ['CF-ETH-GUJ-12-WB|2026-03-02', 'CF-DEC-SWP-12-WB|2026-03-02', 'GR-MUG-COP|2026-03-02'],
      },
      expect: { status: 'success', visits: ['weekly', 'slack'], items: { low: 3, weekly: 1 } },
    },
    {
      id: 'quiet',
      label: 'A quiet Saturday',
      summary: 'Theo roasted on Thursday and the mugs came in. Nothing is at its point, the Filter outputs no items, and the run ends there: no “all good” message for anyone to learn to ignore.',
      start: at(5, 6, 0),
      input: [item({})],
      fixtures: { stock: { 'GR-MUG-COP': 52 } },
      expect: { status: 'success', visits: ['match', 'low'], skips: ['weekly', 'slack'], items: { low: 0 } },
    },
    {
      id: 'rate-limit',
      label: 'Shopify says slow down',
      summary: 'A bulk price edit is running in the Shopify admin, and the first two calls get 429 Too Many Requests. Retry On Fail waits five seconds each time; the third try works and the morning goes on as normal.',
      start: at(3, 6, 0),
      input: [item({})],
      fixtures: { stock: { 'CF-ETH-GUJ-2L-WB': 5 } },
      failures: { products: [{ status: 429, message: 'Too Many Requests: Exceeded 2 calls per second for api client' }, { status: 429, message: 'Too Many Requests: Exceeded 2 calls per second for api client' }] },
      expect: { status: 'success', visits: ['products', 'slack'], items: { weekly: 1 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Copperleaf Shopify (access token)', type: 'Shopify Access Token API', note: 'Same custom app as 02; read_products covers inventory quantities.' },
      { name: 'Copperleaf Google (OAuth2)', type: 'Google Sheets OAuth2', note: 'Reads the Reorder points tab.' },
      { name: 'Copperleaf Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #ops.' },
    ],
    fields: [
      { name: 'sku', where: 'Sheet: Reorder points', type: 'Text', note: 'Must match Shopify exactly; the Merge matches on it' },
      { name: 'reorder_point, reorder_qty', where: 'Sheet: Reorder points', type: 'Number', note: 'Sam reviews them each season' },
      { name: 'supplier', where: 'Sheet: Reorder points', type: 'Text', note: 'Who makes or ships it, and the lead time' },
    ],
  },
  build: [
    { title: 'Cron in the right time zone', body: 'The Schedule Trigger’s cron 0 6 * * 1-6 skips Sundays, when nobody roasts. The workflow’s own Timezone setting is America/New_York; without it, schedules follow the instance’s default and drift by an hour twice a year.' },
    { title: 'Fan out, then join on a key', body: 'The trigger connects to two branches. With the v1 execution order the top one, Shopify, finishes first, then the sheet. The Merge waits for both and combines them on sku with Keep Matches: an inner join, done without a line of code.' },
    { title: 'Shape the data to match', body: 'Shopify returns one item per product with variants inside; the sheet is one row per SKU. A Code node in Run Once for All Items mode flattens the products so both sides of the Merge speak the same shape.' },
    { title: 'Say nothing when nothing is wrong', body: 'The Filter passes only what is at or below its point. Always Output Data stays off, so an empty result stops the run there. A daily “all fine” message gets muted within a week, and then the one that matters is missed.' },
    { title: 'Once a week, not every morning', body: 'Remove Duplicates keeps a history across executions. Keying it on the SKU plus the Monday of the week, with Luxon’s $now.startOf(\'week\'), raises each low item once a week and again the next week if nobody acted.' },
    { title: 'One message, not six', body: 'Edit Fields writes a line per SKU and an Aggregate gathers them into a list, so Slack is called once with every line. Retry On Fail on the Shopify node, five seconds apart, rides out its rate limit.' },
  ],
  edgeCases: [
    { title: 'A new product with no reorder point', body: 'Keep Matches drops it, so it is never raised. That is deliberate: a guessed number is worse than none. Sam adds new SKUs to the sheet when they launch, and the QA list below includes checking for strays.' },
    { title: 'The sheet has a typo in a SKU', body: 'Same as above: no match, no alert. Switching the Merge to Keep Everything for a test run lists the unmatched SKUs on both sides.' },
    { title: 'Stock goes negative', body: 'Shopify allows overselling when Continue selling when out of stock is on. A negative number is still below the point, so it is raised like any other.' },
    { title: 'Shopify is down at 6 AM', body: 'Three tries five seconds apart, then the execution fails and is saved. Sam sees the red row in Executions and retries it once Shopify is back; there is no error workflow in this small instance, which is a choice to revisit if the workflow count grows.' },
    { title: 'Someone wants the full list on a Tuesday', body: 'Monday’s message is still in #ops, and it is the list. To see everything low right now, Sam executes a copy of the workflow with Remove Duplicates disabled, so the real history is not touched.' },
  ],
  qa: [
    'Monday pinned stock: item counts 4 products, 6 SKUs, 6 rows, 6 matches, and the right three past the Filter',
    'A second run the same week: only SKUs not raised since Monday appear',
    'A morning with nothing low: the execution ends at the Filter and #ops gets nothing',
    'A SKU missing from the sheet: dropped by Keep Matches; a temporary Keep Everything run lists it',
    'Shopify returning 429: retries visible in the execution, run succeeds on a later try',
    'Cron fires at 6:00 AM Eastern on both sides of the March daylight-saving change',
  ],
  snippets: [{ title: 'Flatten products to SKUs (Code node)', language: 'javascript', code: flattenCode, note: 'Run Once for All Items: $input.all() is every product, and the node returns an array of { json } items.' }],
  features: ['Schedule Trigger (cron)', 'Workflow timezone', 'Parallel branches', 'Shopify', 'Retry On Fail', 'Code (all items)', 'Google Sheets', 'Merge (Combine by Matching Fields)', 'Filter', 'Remove Duplicates (across executions)', 'Aggregate', 'Slack', 'Luxon in expressions'],
};
