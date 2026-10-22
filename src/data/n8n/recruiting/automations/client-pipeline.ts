import type { Automation, Item, Json } from '@/lib/n8n/types';
import { dayKey, item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

/** Open searches in the Jobs table, one per role, with the client's contact. */
const JOBS: Json[] = [
  { job_id: 'J-118', role: 'Controller', client: 'Lakeshore Foods', contact: 'Jordan Pike', contact_email: 'jordan@lakeshorefoods.example', opened: '2026-02-09' },
  { job_id: 'J-121', role: 'Senior Accountant', client: 'Prairie Dental Partners', contact: 'Alicia Ford', contact_email: 'alicia@prairiedental.example', opened: '2026-02-16' },
  { job_id: 'J-122', role: 'Staff Accountant', client: 'Prairie Dental Partners', contact: 'Alicia Ford', contact_email: 'alicia@prairiedental.example', opened: '2026-02-23' },
  { job_id: 'J-124', role: 'Operations Manager', client: 'Crossroads Distribution', contact: 'Ben Ortiz', contact_email: 'ben@crossroadsdist.example', opened: '2026-02-24' },
  { job_id: 'J-126', role: 'FP&A Analyst', client: 'Halsted Manufacturing', contact: 'Kim Nguyen', contact_email: 'kim@halstedmfg.example', opened: '2026-03-01' },
];

/** Candidates past the first screen, by job. */
const PIPELINE: Json[] = [
  { job_id: 'J-118', candidate: 'Elena K.', stage: 'Screen booked' },
  { job_id: 'J-118', candidate: 'Ray O.', stage: 'Submitted' },
  { job_id: 'J-118', candidate: 'Mei L.', stage: 'Client interview' },
  { job_id: 'J-121', candidate: 'Tom B.', stage: 'Screen booked' },
  { job_id: 'J-121', candidate: 'Grace P.', stage: 'Offer' },
  { job_id: 'J-122', candidate: 'Andre W.', stage: 'Submitted' },
  { job_id: 'J-124', candidate: 'Sam W.', stage: 'Client interview' },
  { job_id: 'J-124', candidate: 'Luis R.', stage: 'Submitted' },
];

const groupCode = `// Code node, JavaScript, Mode: Run Once for All Items.
// Each item is one open search, enriched with one candidate in its pipeline
// (or none). Group them into one report per client contact.
const byClient = {};
for (const { json: j } of $input.all()) {
  const c = (byClient[j.client] ??= { client: j.client, contact: j.contact, contact_email: j.contact_email, searches: {} });
  const s = (c.searches[j.role] ??= { role: j.role, opened: j.opened, candidates: [] });
  if (j.candidate) s.candidates.push(\`\${j.candidate}: \${j.stage}\`);
}
return Object.values(byClient).map((c) => ({
  json: {
    ...c,
    body: Object.values(c.searches)
      .map((s) => \`\${s.role} (open since \${s.opened})\\n\` + (s.candidates.length ? s.candidates.map((x) => '  - ' + x).join('\\n') : '  - Still sourcing; first submittals expected this week'))
      .join('\\n\\n'),
  },
}));`;

function reports(rows: Json[]): Item[] {
  const by: Record<string, { client: string; contact: string; contact_email: string; searches: Record<string, { role: string; opened: string; candidates: string[] }> }> = {};
  for (const j of rows) {
    const c = (by[String(j.client)] ??= { client: String(j.client), contact: String(j.contact), contact_email: String(j.contact_email ?? ''), searches: {} });
    const s = (c.searches[String(j.role)] ??= { role: String(j.role), opened: String(j.opened), candidates: [] });
    if (j.candidate) s.candidates.push(`${j.candidate}: ${j.stage}`);
  }
  return Object.values(by).map((c) =>
    item({
      client: c.client,
      contact: c.contact,
      contact_email: c.contact_email,
      body: Object.values(c.searches)
        .map((s) => `${s.role} (open since ${s.opened})\n${s.candidates.length ? s.candidates.map((x) => `  - ${x}`).join('\n') : '  - Still sourcing; first submittals expected this week'}`)
        .join('\n\n'),
    }),
  );
}

export const clientPipeline: Automation = {
  id: 'client-pipeline',
  number: '03',
  name: 'Monday client pipeline',
  kicker: 'Client reporting',
  tagline: 'Every Monday at 7:30 AM, each client gets one email with every open search they have with Harrow & Finch and where each candidate stands, built from Airtable. Dana gets one Slack line saying what went out, and the one that did not.',
  problem:
    'Clients asked “any update?” several times a week, and recruiters spent Monday mornings writing status emails from Airtable by hand. Some clients got three updates a week and others none, and a search with no candidates yet often went unmentioned, which read as no work being done.',
  solution:
    'A Schedule Trigger fans out to two Airtable searches: the open searches, and the candidates in play. A Merge combines them by job ID with Enrich Input 1, so every open search comes through, with or without candidates. A Code node groups the rows into one report per client contact, Gmail sends each one, and its error output catches a report that cannot be sent, typically a client with no contact email on file. Both outputs meet at a Merge, a Code node counts them, and Dana gets one message in Slack.',
  workflow: {
    name: '03 · Clients · Monday pipeline report',
    folder: 'Harrow & Finch / Clients',
    tags: ['clients', 'schedule', 'client-facing'],
    trigger: {
      id: 'schedule',
      name: 'Monday 7:30 AM',
      type: 'Schedule Trigger',
      operation: 'Custom (Cron): 30 7 * * 1',
      icon: 'clock',
      tone: 'trigger',
      summary: 'In the workflow’s time zone, America/Chicago, so the report is in clients’ inboxes before their Monday meetings.',
      params: [{ k: 'Trigger Rules', v: 'Custom (Cron) · 30 7 * * 1' }],
      run: (items, ctx) => ({ items: items.map(() => item({ timestamp: `${dayKey(ctx.now)}T07:30:00.000-06:00`, Timezone: 'America/Chicago (UTC-06:00)' })) }),
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      timeout: 600,
      notes: [
        'Execution order v1: the open-searches branch, drawn on top, finishes before the candidates branch starts, and the Merge waits for both.',
        'Timeout 10 minutes. A normal Monday takes a few seconds; anything stuck should fail where Jo will see it, not run into the day.',
      ],
    },
    steps: [
      {
        kind: 'split',
        id: 'fan',
        branches: [
          {
            label: 'Open searches',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'jobs',
                  name: 'Open searches',
                  type: 'Airtable',
                  operation: 'Record › Search',
                  icon: 'db',
                  tone: 'app',
                  credential: 'Harrow & Finch Airtable (token)',
                  summary: 'Jobs table, Filter By Formula {Status} = \'Open\', with the client and contact looked up from the Clients table. One item per search.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [
                    { k: 'Table', v: 'Jobs' },
                    { k: 'Filter By Formula', v: "{Status} = 'Open'" },
                  ],
                  run: (_items, ctx) => {
                    const missing = ctx.fixtures.missingEmail as string | undefined;
                    const out = JOBS.map((j) => item(j.client === missing ? { ...j, contact_email: '' } : j));
                    return { items: out, log: `${out.length} open searches.` };
                  },
                },
              },
            ],
          },
          {
            label: 'Candidates in play',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'pipeline',
                  name: 'Candidates in play',
                  type: 'Airtable',
                  operation: 'Record › Search',
                  icon: 'db',
                  tone: 'app',
                  credential: 'Harrow & Finch Airtable (token)',
                  summary: 'Candidates whose Stage is Screen booked, Submitted, Client interview or Offer. First name and last initial only: a client sees full details when a recruiter submits someone, not in a status email. Airtable allows five requests a second per base, and a 429 gets a retry.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [
                    { k: 'Table', v: 'Candidates' },
                    { k: 'Filter By Formula', v: "OR({Stage} = 'Screen booked', {Stage} = 'Submitted', {Stage} = 'Client interview', {Stage} = 'Offer')" },
                  ],
                  run: () => ({ items: PIPELINE.map((r) => item(r)), log: `${PIPELINE.length} candidates.` }),
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'combine',
          name: 'Searches with their candidates',
          type: 'Merge',
          operation: 'Combine › Matching Fields',
          icon: 'merge',
          tone: 'flow',
          summary: 'Input 1 the searches, input 2 the candidates, matched on job_id. Output Type: Enrich Input 1, so a search with no candidates still comes through, and Multiple Matches: Include All Matches, so a search with three candidates becomes three items.',
          params: [
            { k: 'Fields to Match', v: 'job_id = job_id' },
            { k: 'Output Type', v: 'Enrich Input 1' },
            { k: 'Multiple Matches', v: 'Include All Matches' },
          ],
          run: (_items, _ctx, inputs) => {
            const [jobs = [], cands = []] = inputs ?? [];
            const out: Item[] = [];
            for (const j of jobs) {
              const m = cands.filter((c) => c.json.job_id === j.json.job_id);
              if (!m.length) out.push(item({ ...j.json }));
              for (const c of m) out.push(item({ ...j.json, ...c.json }));
            }
            return { items: out, log: `${out.length} rows from ${jobs.length} searches.` };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'group',
          name: 'One report per client',
          type: 'Code',
          operation: 'JavaScript · Run Once for All Items',
          icon: 'code',
          tone: 'core',
          summary: 'Groups the rows by client: each search with its candidates and stages, and a line for a search still being sourced, so no search silently disappears from a report.',
          code: { language: 'javascript', source: groupCode },
          run: (items) => {
            const out = reports(items.map((i) => i.json));
            return { items: out, log: `${out.length} reports.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'send',
          name: 'Email each client',
          type: 'Gmail',
          operation: 'Message › Send',
          icon: 'mail',
          tone: 'app',
          credential: 'Harrow & Finch Gmail (OAuth2)',
          summary: 'One email per item, from Dana, To the client contact. On Error: Continue (using error output): one client Gmail cannot send to goes out of the Error output and the others still get theirs.',
          settings: { onError: 'error-output' },
          params: [
            { k: 'To', v: '{{ $json.contact_email }}' },
            { k: 'Subject', v: "Your searches with Harrow & Finch, week of {{ $now.toFormat('MMM d') }}" },
            { k: 'Options', v: 'Sender Name Dana Whitlock · Append n8n Attribution off' },
          ],
          run: (items) => ({
            items: items.map((it, i) => item({ id: `18e3b0${i}c4f7`, labelIds: ['SENT'], client: it.json.client })),
            messages: items.slice(0, 2).map((it) => ({ channel: 'email' as const, to: String(it.json.contact_email), subject: 'Your searches with Harrow & Finch this week', body: `Hi ${String(it.json.contact).split(' ')[0]},\n\nHere is where each of your searches stands this Monday:\n\n${it.json.body}\n\nReply to this email with any questions, or to set up a call.\n\nDana Whitlock\nHarrow & Finch Recruiting, Chicago` })),
            log: `${items.length} sent${items.length > 2 ? ' (the first two shown)' : ''}.`,
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
                  id: 'sent',
                  name: 'Sent',
                  type: 'Edit Fields (Set)',
                  icon: 'pen',
                  tone: 'core',
                  summary: 'ok true and the client’s name, read back from the report.',
                  run: (items) => ({ items: items.map((it) => item({ ok: true, client: it.json.client })) }),
                },
              },
            ],
          },
          {
            label: 'Error',
            rule: 'Gmail refused the message.',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'unsent',
                  name: 'Not sent',
                  type: 'Edit Fields (Set)',
                  icon: 'pen',
                  tone: 'core',
                  summary: 'ok false, the client, and Gmail’s message, so the Slack line says why.',
                  run: (items) => ({ items: items.map((it) => item({ ok: false, client: it.json.client, error: (it.json.error as Json).message })) }),
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'all',
          name: 'All reports',
          type: 'Merge',
          operation: 'Append',
          icon: 'merge',
          tone: 'flow',
          summary: 'Sent ones first, then any that were not. Append passes on whatever arrived.',
          params: [{ k: 'Mode', v: 'Append' }],
          run: (items) => ({ items }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'tell-dana',
          name: 'Tell Dana',
          type: 'Slack',
          operation: 'Message › Send',
          icon: 'slack',
          tone: 'app',
          credential: 'Harrow & Finch Slack (bot)',
          summary: 'Execute Once on, so a single message covers every report: who got one, and who did not and why. Dana fixes a missing contact in Airtable and forwards that one by hand.',
          settings: { executeOnce: true },
          params: [
            { k: 'Send Message To', v: 'User · Dana Whitlock' },
            { k: 'Text', v: "{{ $input.all().filter(i => i.json.ok).length }} pipeline reports sent…" },
          ],
          run: (_items, ctx) => {
            const all = ctx.$('All reports');
            const ok = all.filter((i) => i.json.ok).map((i) => i.json.client);
            const bad = all.filter((i) => !i.json.ok);
            return {
              items: [item({ ok: true, ts: '1772458200.120044' })],
              messages: [{ channel: 'slack', to: 'DM to Dana Whitlock', subject: `Monday reports: ${ok.length} sent${bad.length ? `, ${bad.length} not sent` : ''}`, body: `Sent to ${ok.join(', ')}.${bad.length ? `\nNot sent: ${bad.map((b) => `${b.json.client} (${b.json.error})`).join('; ')}. Add the contact email in Airtable and forward it from the Executions list.` : ''}` }],
            };
          },
        },
      },
    ],
  },
  scenarios: [
    {
      id: 'monday',
      label: 'A normal Monday',
      summary: 'Five open searches across four clients, eight candidates in play. Nine rows after the Merge, four reports, four emails, and one line to Dana. Halsted’s new search has no candidates yet and still gets a line.',
      start: at(0, 7, 30),
      input: [item({})],
      expect: { status: 'success', visits: ['fan:0', 'fan:1', 'jobs', 'pipeline', 'combine', 'group', 'send', 'send:0', 'sent', 'all', 'tell-dana'], skips: ['unsent'], items: { jobs: 5, pipeline: 8, combine: 9, group: 4, sent: 4 } },
    },
    {
      id: 'no-contact',
      label: 'A client with no contact email',
      summary: 'Crossroads’ contact left and their email was cleared in Airtable. Gmail refuses that one report; the other three go out, and Dana’s message names Crossroads and the reason.',
      start: at(0, 7, 30),
      input: [item({})],
      fixtures: { missingEmail: 'Crossroads Distribution' },
      failures: { send: [{ status: 400, message: 'Invalid To header', items: [2] }] },
      expect: { status: 'success', visits: ['send:0', 'send:1', 'unsent', 'tell-dana'], items: { sent: 3, unsent: 1, all: 4 } },
    },
    {
      id: 'rate-limit',
      label: 'Airtable says slow down',
      summary: 'A recruiter’s bulk edit is running, and the candidates search gets 429 Too Many Requests once. Retry On Fail waits two seconds; the second try works and Monday carries on.',
      start: at(0, 7, 30),
      input: [item({})],
      failures: { pipeline: [{ status: 429, message: 'Too Many Requests' }] },
      expect: { status: 'success', visits: ['pipeline', 'tell-dana'], items: { sent: 4 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Harrow & Finch Airtable (token)', type: 'Airtable Personal Access Token', note: 'Read access to Jobs, Clients and Candidates is enough here.' },
      { name: 'Harrow & Finch Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Sends as Dana, so clients reply to the managing partner.' },
      { name: 'Harrow & Finch Slack (bot)', type: 'Slack OAuth2', note: 'Direct message to Dana.' },
    ],
    fields: [
      { name: 'job_id, role, client, contact, contact_email, opened', where: 'Airtable: Jobs (with Clients lookups)', type: 'Fields', note: 'Status = Open selects them' },
      { name: 'job_id, candidate, stage', where: 'Airtable: Candidates', type: 'Fields', note: 'Candidate is first name and last initial only' },
    ],
  },
  build: [
    { title: 'Two reads, one join', body: 'The Schedule Trigger connects to two Airtable searches. A Merge with Combine by Matching Fields on job_id, Output Type Enrich Input 1 and Include All Matches, is a left join without code: every search, each candidate on its own row.' },
    { title: 'Group in code, once', body: 'A Code node in Run Once for All Items mode turns rows into one report per client, with a line for searches still being sourced. Clients told “still sourcing” trust the report more than clients who notice a search missing.' },
    { title: 'Share what a client should see', body: 'Candidates appear by first name and last initial and stage only. Full details go to a client when a recruiter submits the candidate, with the candidate’s agreement.' },
    { title: 'One bad address, not a lost Monday', body: 'Gmail’s On Error is Continue (using error output). The failed report leaves through the Error output with Gmail’s reason, and both outputs meet at a Merge before the summary.' },
    { title: 'One summary, not twenty', body: 'The Slack node has Execute Once on and reads every report with $(\'All reports\'), so Dana gets one message whatever the number of clients.' },
  ],
  edgeCases: [
    { title: 'A client has no open searches', body: 'They are not in the first search at all, so they get no email that week, which is what they would expect.' },
    { title: 'A candidate is in two searches', body: 'They appear under each search, which is accurate: the client sees two pipelines.' },
    { title: 'A recruiter wants to add a personal note', body: 'The real build runs on Monday at 7:30 so recruiters can change a Stage on Friday and see it reflected. Personal notes stay personal: they reply on the thread.' },
    { title: 'The schedule misses a Monday', body: 'n8n Cloud runs the schedule while the workflow is published. If it was unpublished by mistake, nothing fails and nothing is sent; the Executions list shows the gap and Jo checks it each Monday.' },
  ],
  qa: [
    'Pinned Airtable data: 5 searches, 8 candidates, 9 merged rows, 4 reports, and the new search with a “still sourcing” line',
    'One contact email cleared in a copy: three sent, one on the Error output, Dana’s message names it',
    'Every report shows first names and last initials only',
    'Execute Once on the Slack node: one message for any number of clients',
    'The cron fires at 7:30 AM Chicago time on both sides of the March clock change',
  ],
  snippets: [{ title: 'One report per client (Code node)', language: 'javascript', code: groupCode, note: 'Run Once for All Items. Each input row is one search, enriched with one candidate or none.' }],
  features: ['Schedule Trigger (cron)', 'Parallel branches', 'Airtable search', 'Merge (Enrich Input 1, all matches)', 'Code (all items)', 'Gmail', 'Error output (per item)', 'Merge (Append)', 'Execute Once', 'Slack', 'Retry On Fail', 'Workflow timeout'],
};
