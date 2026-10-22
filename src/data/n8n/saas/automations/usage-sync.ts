import type { Automation, Item, Json } from '@/lib/n8n/types';
import { dayKey, item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

const PLANS = ['Studio', 'Studio', 'Clinic', 'Studio', 'Scale'];

/** The rows the read replica returns for a night with `n` changed accounts. Deterministic, so runs repeat exactly. */
function rows(n: number): Json[] {
  return Array.from({ length: n }, (_, i) => {
    const plan = PLANS[i % PLANS.length];
    const locations = plan === 'Scale' ? 4 + (i % 9) : plan === 'Clinic' ? 1 + (i % 3) : 1;
    return {
      account_id: `acc_${(48211 + i * 37).toString(36).toUpperCase()}`,
      plan,
      mrr: plan === 'Scale' ? 400 : plan === 'Clinic' ? 149 : 79 - (i % 2) * 40,
      locations,
      active_staff_30d: 1 + ((i * 7) % (locations * 6)),
      bookings_30d: 40 + ((i * 131) % 2400),
      last_active_at: '2026-03-02',
    };
  });
}

const sql = `-- Postgres node, Execute Query, against the read replica.
-- Accounts whose plan, size or usage changed in the last 26 hours: two
-- hours of overlap, so a late or retried run never leaves a gap.
SELECT a.id                       AS account_id,
       a.plan,
       a.mrr_cents / 100          AS mrr,
       count(DISTINCT l.id)       AS locations,
       u.active_staff_30d,
       u.bookings_30d,
       u.last_active_at::date     AS last_active_at
FROM accounts a
JOIN account_usage_daily u ON u.account_id = a.id AND u.day = current_date - 1
LEFT JOIN locations l      ON l.account_id = a.id AND l.archived_at IS NULL
WHERE a.status = 'active'
  AND (a.updated_at > now() - interval '26 hours'
       OR u.updated_at > now() - interval '26 hours')
GROUP BY a.id, a.plan, a.mrr_cents, u.active_staff_30d, u.bookings_30d, u.last_active_at;`;

const batchCode = `// Code node, JavaScript, Mode: Run Once for All Items.
// HubSpot's batch upsert takes up to 100 records per call, so 1,842 rows
// become 19 requests instead of 1,842.
const rows = $input.all().map((i) => i.json);
const size = 100;
const out = [];
for (let i = 0; i < rows.length; i += size) {
  const chunk = rows.slice(i, i + size);
  out.push({
    json: {
      batch: out.length + 1,
      first: chunk[0].account_id,
      last: chunk[chunk.length - 1].account_id,
      inputs: chunk.map((r) => ({
        idProperty: 'slotwise_account_id',   // a unique property on companies
        id: r.account_id,
        properties: {
          slotwise_plan: r.plan,
          slotwise_mrr: r.mrr,
          slotwise_locations: r.locations,
          slotwise_active_staff_30d: r.active_staff_30d,
          slotwise_bookings_30d: r.bookings_30d,
          slotwise_last_active: r.last_active_at,
          slotwise_usage_synced: $now.toISODate(),
        },
      })),
    },
  });
}
return out;`;

const sumCode = `// Code node, JavaScript, Mode: Run Once for All Items.
// One item per batch arrives here: ok ones from the success output, failed
// ones from the error output, in that order (Merge, Append).
const all = $input.all().map((i) => i.json);
const failed = all.filter((b) => !b.ok);
return [{
  json: {
    batches: all.length,
    synced: all.filter((b) => b.ok).reduce((n, b) => n + b.count, 0),
    failed: failed.length,
    failed_lines: failed.map((b) => \`batch \${b.batch} (\${b.first} to \${b.last}): \${b.error}\`),
  },
}];`;

const batchesOf = (items: Item[]) => {
  const all = items.map((i) => i.json);
  const out: Item[] = [];
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    out.push(item({ batch: out.length + 1, first: chunk[0].account_id, last: chunk[chunk.length - 1].account_id, inputs: chunk.map((r) => ({ idProperty: 'slotwise_account_id', id: r.account_id, properties: { slotwise_plan: r.plan, slotwise_mrr: r.mrr } })) }));
  }
  return out;
};

export const usageSync: Automation = {
  id: 'usage-sync',
  number: '02',
  name: 'Nightly usage sync',
  kicker: 'Data sync',
  tagline: 'Every night, accounts whose plan or usage changed are read from the product database, packed into batches of 100 and upserted onto their HubSpot companies, a request every 250 ms to stay well inside HubSpot’s rate limit. A batch HubSpot rejects goes out of the error output and is named in #revops; a clean night says nothing.',
  problem:
    'Sales and success worked from HubSpot, but HubSpot did not know how Slotwise was used. Whether an account had grown to six locations, or had not taken a booking in three weeks, lived in the product database, and Nadia exported a CSV for the team every few Fridays.',
  solution:
    'A Schedule Trigger runs at 2:15 AM UTC. The Postgres node queries the read replica for accounts changed in the last 26 hours. A Code node packs the rows into batches of 100, the most HubSpot’s batch upsert takes, and one HTTP Request per batch upserts the companies by a unique Slotwise account ID property, using the predefined HubSpot credential. Batching sends one request every 250 ms. The request’s error output catches a batch HubSpot rejects, so one bad record never stops the other 1,800; both outputs meet at a Merge, a Code node totals them, and #revops hears only when something failed, with the account range to look at.',
  workflow: {
    name: '02 · RevOps · Nightly usage sync',
    folder: 'Slotwise / RevOps',
    tags: ['schedule', 'hubspot', 'postgres'],
    trigger: {
      id: 'schedule',
      name: 'Every night at 2:15',
      type: 'Schedule Trigger',
      operation: 'Custom (Cron): 15 2 * * *',
      icon: 'clock',
      tone: 'trigger',
      summary: 'In UTC, after the product’s own nightly usage rollup has finished at 1:30, and at a quiet hour for the HubSpot portal. Off the hour, so it does not queue behind every other 2:00 job.',
      params: [{ k: 'Trigger Rules', v: 'Custom (Cron) · 15 2 * * *' }],
      run: (items, ctx) => ({ items: items.map(() => item({ timestamp: `${dayKey(ctx.now)}T02:15:00.000+00:00`, Timezone: 'UTC' })) }),
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'UTC',
      saveFailed: true,
      saveSuccess: true,
      timeout: 1800,
      notes: [
        'Timeout 30 minutes. A normal night takes under ten seconds; a run still going at 2:45 is stuck, and should fail where someone will see it.',
        'Runs on a queue-mode worker like everything else, so a long night never blocks a support ticket on the main instance.',
        'Saved executions are pruned after 14 days. The HubSpot property slotwise_usage_synced shows freshness on every company long after that.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'query',
          name: 'Changed accounts',
          type: 'Postgres',
          operation: 'Execute Query',
          icon: 'db',
          tone: 'app',
          credential: 'Slotwise replica (read-only)',
          summary: 'Against the read replica, as a role that can only SELECT. One item per row. On a night with no changes it returns no items, and nothing after it runs.',
          settings: { retryOnFail: { maxTries: 3, waitMs: 5000 } },
          code: { language: 'sql', source: sql },
          run: (_items, ctx) => {
            const n = Number(ctx.fixtures.rows ?? 0);
            return { items: rows(n).map((r) => item(r)), log: n ? `${n.toLocaleString('en-US')} rows.` : 'No rows.' };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'batch',
          name: 'Batches of 100',
          type: 'Code',
          operation: 'JavaScript · Run Once for All Items',
          icon: 'code',
          tone: 'core',
          summary: 'Turns rows into HubSpot’s batch format, 100 records per item, keyed by the unique slotwise_account_id property, and stamps today’s date as the sync date.',
          code: { language: 'javascript', source: batchCode },
          run: (items) => {
            const out = batchesOf(items);
            return { items: out, log: `${out.length} batch${out.length === 1 ? '' : 'es'}.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'upsert',
          name: 'Upsert companies',
          type: 'HTTP Request',
          operation: 'POST /crm/v3/objects/companies/batch/upsert',
          icon: 'http',
          tone: 'app',
          credential: 'Slotwise HubSpot (app token)',
          summary: 'One request per batch item, with Batching at 1 item every 250 ms: four requests a second, well under a private app’s limit. Upsert by a unique property is idempotent, so a rerun never duplicates a company. On Error: Continue (using error output), so a rejected batch is an item, not the end of the night.',
          settings: { onError: 'error-output' },
          ms: 4800,
          params: [
            { k: 'Authentication', v: 'Predefined Credential Type · HubSpot App Token' },
            { k: 'Body', v: '{{ JSON.stringify({ inputs: $json.inputs }) }}' },
            { k: 'Options', v: 'Batching: Items per Batch 1, Batch Interval 250 ms · Timeout 30000 ms' },
          ],
          run: (items) => ({
            items: items.map((it) => item({ status: 'COMPLETE', batch: it.json.batch, results: (it.json.inputs as Json[]).map((r) => ({ id: String(9100000000 + Number(String(r.id).length * 7919)), properties: { slotwise_account_id: r.id } })) })),
            log: `${items.length} request${items.length === 1 ? '' : 's'} at 4 a second.`,
          }),
        },
        branches: [
          {
            label: 'Success',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'ok',
                  name: 'Count the batch',
                  type: 'Edit Fields (Set)',
                  icon: 'pen',
                  tone: 'core',
                  summary: 'ok true, the batch number, and how many companies HubSpot returned.',
                  params: [{ k: 'count (Number)', v: '{{ $json.results.length }}' }],
                  run: (items) => ({ items: items.map((it) => item({ ok: true, batch: it.json.batch, count: (it.json.results as Json[]).length })) }),
                },
              },
            ],
          },
          {
            label: 'Error',
            rule: 'HubSpot rejected the batch.',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'bad',
                  name: 'Note the failed batch',
                  type: 'Edit Fields (Set)',
                  icon: 'pen',
                  tone: 'core',
                  summary: 'ok false, the batch number, its first and last account IDs, and HubSpot’s error message, which names the property and value it refused.',
                  params: [{ k: 'error', v: '{{ $json.error.message }}' }],
                  run: (items) => ({ items: items.map((it) => item({ ok: false, batch: it.json.batch, first: it.json.first, last: it.json.last, error: (it.json.error as Json).message })) }),
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
          name: 'All batches',
          type: 'Merge',
          operation: 'Append',
          icon: 'merge',
          tone: 'flow',
          summary: 'Successes first, then failures. On a clean night only input 1 has items, and Append passes them on.',
          params: [{ k: 'Mode', v: 'Append' }],
          run: (items) => ({ items }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'sum',
          name: 'Sum it up',
          type: 'Code',
          operation: 'JavaScript · Run Once for All Items',
          icon: 'code',
          tone: 'core',
          summary: 'One item: batches, companies synced, batches failed, and a line per failure.',
          code: { language: 'javascript', source: sumCode },
          run: (items) => {
            const all = items.map((i) => i.json);
            const failed = all.filter((b) => !b.ok);
            const synced = all.filter((b) => b.ok).reduce((n, b) => n + Number(b.count), 0);
            return { items: [item({ batches: all.length, synced, failed: failed.length, failed_lines: failed.map((b) => `batch ${b.batch} (${b.first} to ${b.last}): ${b.error}`) })], log: `${synced.toLocaleString('en-US')} synced, ${failed.length} failed.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'any-failed',
          name: 'Anything failed?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'failed is greater than 0. A clean night posts nothing; freshness is visible on every HubSpot company instead.',
          params: [{ k: 'Condition', v: '{{ $json.failed }} is greater than 0' }],
          run: (items) => ({ outputs: Number(items[0].json.failed) > 0 ? [items, []] : [[], items] }),
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'slack',
                  name: 'Warn #revops',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Slotwise Slack (bot)',
                  summary: 'What synced, what did not, and HubSpot’s own reason for each failed batch, so the fix (usually a dropdown option missing in HubSpot) is obvious.',
                  params: [{ k: 'Channel', v: vars.revops_channel }],
                  run: (items) => {
                    const j = items[0].json;
                    return { items, messages: [{ channel: 'slack', to: vars.revops_channel, subject: `Usage sync: ${j.failed} of ${j.batches} batches failed`, body: `${Number(j.synced).toLocaleString('en-US')} companies updated.\n${(j.failed_lines as string[]).join('\n')}\nThose accounts are picked up again tomorrow night if they change; to resync now, fix the cause and rerun the workflow.` }] };
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
      id: 'normal',
      label: 'A normal night',
      summary: '1,842 accounts changed. 19 batches, 19 requests over about five seconds, every one accepted. Nothing is posted: the sync date on each company is the record.',
      start: at(1, 2, 15),
      input: [item({})],
      fixtures: { rows: 1842 },
      expect: { status: 'success', visits: ['query', 'batch', 'upsert', 'upsert:0', 'ok', 'merge', 'sum', 'any-failed:1'], skips: ['bad', 'slack'], items: { query: 1842, batch: 19, ok: 19, sum: 1 } },
    },
    {
      id: 'rejected',
      label: 'HubSpot rejects one batch',
      summary: 'Product launched a Scale+ plan yesterday, and the plan dropdown in HubSpot has no Scale+ option yet. HubSpot refuses batch 8; the other 18 go through, and #revops is told exactly which value is missing.',
      start: at(2, 2, 15),
      input: [item({})],
      fixtures: { rows: 1871 },
      failures: { upsert: [{ status: 400, message: 'Property values were not valid: slotwise_plan "Scale+" is not one of the allowed options', items: [7] }] },
      expect: { status: 'success', visits: ['upsert:0', 'upsert:1', 'bad', 'any-failed:0', 'slack'], items: { ok: 18, bad: 1, merge: 19 } },
    },
    {
      id: 'quiet',
      label: 'Nothing changed',
      summary: 'A holiday: no account changed in 26 hours. The query returns no rows, so the Code node never runs and nothing is sent anywhere.',
      start: at(6, 2, 15),
      input: [item({})],
      fixtures: { rows: 0 },
      expect: { status: 'success', visits: ['query'], skips: ['batch', 'upsert'], items: { query: 0 } },
    },
    {
      id: 'replica-down',
      label: 'The replica is down',
      summary: 'The read replica is being replaced. Three tries five seconds apart, then the execution stops and is saved as Error; nothing reaches HubSpot half-done. Tomorrow’s 26-hour window covers tonight.',
      start: at(3, 2, 15),
      input: [item({})],
      failures: { query: [{ status: 0, message: 'connect ECONNREFUSED 10.0.12.40:5432' }, { status: 0, message: 'connect ECONNREFUSED 10.0.12.40:5432' }, { status: 0, message: 'connect ECONNREFUSED 10.0.12.40:5432' }] },
      expect: { status: 'error', visits: ['query'], skips: ['batch'] },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Slotwise replica (read-only)', type: 'Postgres', note: 'Role n8n_reader with SELECT on four tables, over the private network with SSL.' },
      { name: 'Slotwise HubSpot (app token)', type: 'HubSpot App Token', note: 'A private app with companies read and write, used as a predefined credential type in HTTP Request.' },
      { name: 'Slotwise Slack (bot)', type: 'Slack OAuth2', note: 'Posts to #revops.' },
    ],
    fields: [
      { name: 'slotwise_account_id', where: 'HubSpot company property', type: 'Single-line text, unique', note: 'The upsert key; HubSpot enforces uniqueness' },
      { name: 'slotwise_plan', where: 'HubSpot company property', type: 'Dropdown', note: 'Options must match the product’s plans; the usual cause of a rejected batch' },
      { name: 'slotwise_mrr, slotwise_locations, slotwise_active_staff_30d, slotwise_bookings_30d', where: 'HubSpot company properties', type: 'Number' },
      { name: 'slotwise_last_active, slotwise_usage_synced', where: 'HubSpot company properties', type: 'Date' },
    ],
  },
  build: [
    { title: 'Read from a replica, as a reader', body: 'The Postgres credential is a role that can only SELECT, pointed at the read replica. A heavy query at 2 AM can never slow down someone booking a haircut, and a mistake in n8n can never write to production.' },
    { title: 'A window with overlap', body: 'The query takes the last 26 hours, not 24. A run that starts late, or a rerun the next morning, overlaps the one before instead of leaving a gap, and upserting the same company twice is harmless.' },
    { title: 'Batch in the shape the API wants', body: 'HubSpot’s batch upsert takes up to 100 records. A Code node in Run Once for All Items mode packs the rows, so 1,842 accounts are 19 requests. The unique slotwise_account_id property is the upsert key, so HubSpot matches companies itself.' },
    { title: 'Pace the requests', body: 'The HTTP Request’s Batching option sends one item every 250 ms. That keeps the sync far below the private app’s rate limit, leaving room for the sales team’s own HubSpot integrations at the same hour.' },
    { title: 'One bad record, not a lost night', body: 'On Error: Continue (using error output). A batch HubSpot rejects leaves through the Error output with HubSpot’s message, the rest carry on, and both meet at a Merge. Retry On Fail is not set on this node: a node that continues on error hands failures on as items, and a 400 will not fix itself by trying again.' },
    { title: 'Say something only when it matters', body: 'A Code node totals the batches and an If posts to #revops only when something failed, naming the batch, its account range and HubSpot’s reason. Freshness is on every company as slotwise_usage_synced.' },
  ],
  edgeCases: [
    { title: 'A new plan the CRM does not know', body: 'The dropdown rejects it and that batch fails, as in the second test event. Nadia adds the option in HubSpot and reruns the workflow from the editor; upserts make the rerun safe.' },
    { title: 'HubSpot answers 429 anyway', body: 'Another integration used up the shared limit. The batch fails like any other and is named in #revops. If it happened often, the Batch Interval would go up, which costs seconds, not accuracy.' },
    { title: 'A company was deleted in HubSpot', body: 'Upsert creates it again with the Slotwise ID, which is right: it is still a customer. Merging duplicates by hand in HubSpot keeps the ID on the survivor.' },
    { title: 'An account cancels', body: 'The query only takes active accounts, so a cancelled one stops being updated and its last values stay. A separate Stripe-driven workflow marks churned companies; mixing that in here would make this one harder to trust.' },
    { title: 'The replica is down', body: 'Three tries, then the execution fails and is saved as Error. No partial upload, since nothing ran after the query, and the next night’s 26-hour window is wider than the gap.' },
  ],
  qa: [
    'Query run by hand on the replica: row count matches the product’s own admin report for the day',
    '1,842 pinned rows: 19 batch items, each with at most 100 records and the right first and last IDs',
    'A sandbox HubSpot portal: companies created on the first run and updated, not duplicated, on the second',
    'One record with an unknown dropdown value: that batch on the Error output, the other 18 synced, one #revops post',
    'Credential with SELECT only: an UPDATE in the query is refused by Postgres',
    'Execution time under ten seconds for a normal night; timeout fails a deliberately stuck copy at 30 minutes',
  ],
  snippets: [
    { title: 'Changed accounts (Postgres query)', language: 'sql', code: sql },
    { title: 'Batches of 100 (Code node)', language: 'javascript', code: batchCode, note: 'Each output item is one HubSpot request body.' },
    { title: 'Sum it up (Code node)', language: 'javascript', code: sumCode },
  ],
  features: ['Schedule Trigger (cron)', 'Postgres (read replica)', 'Code (all items)', 'HTTP Request', 'Predefined credential type', 'Batching', 'Error output', 'Merge (Append)', 'If', 'Slack', 'Workflow timeout', 'Retry On Fail', 'Queue mode'],
};
