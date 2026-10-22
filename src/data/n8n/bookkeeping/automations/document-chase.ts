import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const MS_DAY = 86400000;
const vars = business.env.vars;

/** What 01 passes in: the fields this trigger declares. */
const input = (o: { client_id: string; first_name: string; email: string; service: string; accountant: string; business_name: string }): Item =>
  item({ ...o, folder_id: '1Qm7vH2kLpX9aTz4', folder_url: 'https://drive.google.com/drive/folders/1Qm7vH2kLpX9aTz4', task_id: '86b2qx4fh' });

/** Each document, and the word in a file name that counts for it. */
const DOCS = {
  bank: { name: 'Bank statements', match: 'bank' },
  card: { name: 'Credit card statements', match: 'credit' },
  tax: { name: 'Last tax return', match: 'tax' },
  payroll: { name: 'Payroll register', match: 'payroll' },
  loan: { name: 'Loan statements', match: 'loan' },
};
type Doc = { name: string; match: string };
const LISTS: Record<string, Doc[]> = {
  'Monthly bookkeeping': [DOCS.bank, DOCS.card, DOCS.tax],
  'Bookkeeping and payroll': [DOCS.bank, DOCS.card, DOCS.tax, DOCS.payroll],
  'Catch-up (behind on the books)': [DOCS.bank, DOCS.card, DOCS.tax, DOCS.loan],
};

/** A Wait node that resumed on its webhook outputs the request; one that timed out passes its input on. */
const clicked = (it: Item | undefined) => !!(it?.json.query as Json | undefined)?.client;
const resumed = (client: string): Json => ({ headers: { host: 'n8n.ledgerline.example', 'user-agent': 'Mozilla/5.0' }, params: {}, query: { client }, body: {} });

const listCode = `// Code node, JavaScript, Mode: Run Once for Each Item.
// The list depends on the service. Each document has a name, which is what
// the client reads, and the one word in a file name that counts for it.
const bank = { name: 'Bank statements', match: 'bank' };
const card = { name: 'Credit card statements', match: 'credit' };
const tax = { name: 'Last tax return', match: 'tax' };
const lists = {
  'Monthly bookkeeping': [bank, card, tax],
  'Bookkeeping and payroll': [bank, card, tax, { name: 'Payroll register', match: 'payroll' }],
  'Catch-up (behind on the books)': [bank, card, tax, { name: 'Loan statements', match: 'loan' }],
};
const docs = lists[$input.item.json.service] ?? lists['Monthly bookkeeping'];
return { json: { ...$input.item.json, docs, docs_text: docs.map((d) => '- ' + d.name).join('\\n') } };`;

const missingCode = `// Code node, JavaScript, Mode: Run Once for All Items.
// Drive returns one item per file. With Always Output Data on, an empty
// folder still arrives as one empty item, so this always runs.
const docs = $('The document list').first().json.docs;
const names = $input.all().map((f) => (f.json.name || '').toLowerCase());

// A file counts for a document if its name holds the document's word:
// "Chase bank statements Jan-Mar.pdf" counts as Bank statements.
const missing = docs.filter((d) => !names.some((n) => n.includes(d.match))).map((d) => d.name);

return [{ json: { files: names.filter(Boolean).length, missing, missing_text: missing.map((d) => '- ' + d).join('\\n') } }];`;

const docsOf = (ctx: RunContext) => (ctx.$('The document list')[0]?.json ?? {}) as { docs: Doc[]; docs_text: string; first_name: string; email: string; business_name: string; accountant: string; client_id: string; folder_url: string };
const firstName = (n: string) => n.split(' ')[0];

const askEmail = (ctx: RunContext, reminder: boolean) => {
  const d = docsOf(ctx);
  const link = `${business.env.baseUrl}/webhook-waiting/${ctx.executionId}?client=${d.client_id}`;
  return {
    channel: 'email' as const,
    to: d.email,
    subject: reminder ? `Reminder: documents for ${d.business_name}` : `The documents we need from ${d.business_name}`,
    body: reminder
      ? `Hi ${d.first_name},\n\nA quick nudge on the documents for your first month. We still need:\n${d.docs_text}\n\nDrop them in your folder: ${d.folder_url}\nThen press this link so we know: ${link}\n\nIf anything is hard to find, reply and ${firstName(d.accountant)} will help.\n\nThe Ledgerline team`
      : `Hi ${d.first_name},\n\nTo start your books, ${firstName(d.accountant)} needs these, for the last three months:\n${d.docs_text}\n\nUpload them to your private folder: ${d.folder_url}\nWhen you are done, press this link so we know: ${link}\n\nPDFs or photos are both fine.\n\nThe Ledgerline team`,
  };
};

export const documentChase: Automation = {
  id: 'document-chase',
  number: '02',
  name: 'Document chase',
  kicker: 'Waiting on the client',
  tagline: 'One email with the documents a new client’s service needs and a link to press when they are uploaded. n8n waits for that click for three days, reminds once, waits four more, then checks the folder itself and tells the bookkeeper exactly what is in and what is not.',
  problem:
    'Chasing documents was the slowest part of onboarding. Bookkeepers kept their own reminders, some clients were chased three times in a week and others not at all, and “I sent them already” meant opening the folder and comparing it to a list by hand.',
  solution:
    '01 starts this workflow as a sub-workflow with the client’s details. A Code node picks the document list for the service, and Gmail sends it with the folder link and a link to the Wait node’s resume URL. The Wait node pauses the execution for up to three days, saved in the database, until that link is pressed. No click means one reminder and a second wait of four days. Both paths meet at a Merge, and an If asks the only question left: did they ever press it? If they did, the client lands on a thank-you page, Drive lists the folder, and a Code node compares the files to the list: anything missing gets a friendly “almost there”, and a complete folder moves the ClickUp task to Ready and tells the bookkeeper. If they never did, the bookkeeper is asked to call.',
  workflow: {
    name: '02 · Onboarding · Document chase',
    folder: 'Ledgerline / Onboarding',
    tags: ['onboarding', 'sub-workflow', 'client-facing'],
    trigger: {
      id: 'start',
      name: 'When Executed by Another Workflow',
      type: 'Execute Sub-workflow Trigger',
      operation: 'Input data: Define using fields below',
      icon: 'flow',
      tone: 'trigger',
      summary: 'Declares the eight fields 01 must send: client_id, first_name, email, business_name, service, accountant, folder_id and task_id. 01’s Execute Sub-workflow node shows them as inputs to fill, so a renamed field shows up at build time, not at run time.',
      params: [
        { k: 'Input data mode', v: 'Define using fields below' },
        { k: 'Fields', v: 'client_id, first_name, email, business_name, service, accountant, folder_id, task_id' },
      ],
    },
    settings: {
      executionOrder: 'v1',
      errorWorkflow: 'error-handler',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      callerPolicy: 'Workflows from a list: 01 · Onboarding · New client',
      notes: [
        'This workflow can be called by: only 01. Nothing else should start a chase, and a test workflow cannot email a client by accident.',
        'A Wait longer than 65 seconds saves the execution to n8n’s database and frees the worker. A chase that waits a week costs nothing while it waits, and it survives a restart of the server.',
        'Error workflow: 03, like 01. A Gmail failure on day four would otherwise leave a client half-chased with nobody aware.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'list',
          name: 'The document list',
          type: 'Code',
          operation: 'JavaScript · Run Once for Each Item',
          icon: 'code',
          tone: 'core',
          summary: 'Picks the list for the service and writes it twice: as an array of names and match words, for the Drive check, and as text, for the emails.',
          code: { language: 'javascript', source: listCode },
          run: (items) => ({
            items: items.map((it) => {
              const docs = LISTS[String(it.json.service)] ?? LISTS['Monthly bookkeeping'];
              return item({ ...it.json, docs, docs_text: docs.map((d) => `- ${d.name}`).join('\n') });
            }),
            log: `${(LISTS[String(items[0].json.service)] ?? []).length} documents for ${items[0].json.service}.`,
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'ask',
          name: 'Ask for the documents',
          type: 'Gmail',
          operation: 'Message › Send',
          icon: 'mail',
          tone: 'app',
          credential: 'Ledgerline Gmail (OAuth2)',
          summary: 'The list, the folder link, and a link to {{ $execution.resumeUrl }} with the client ID added, which resumes this very execution. Reply To is the bookkeeper.',
          params: [
            { k: 'To', v: '{{ $json.email }}' },
            { k: 'Message', v: '… press this link when you are done: {{ $execution.resumeUrl }}?client={{ $json.client_id }}' },
          ],
          run: (items, ctx) => ({ items: items.map(() => item({ id: '18e1f0d71c0b6a55', labelIds: ['SENT'] })), messages: [askEmail(ctx, false)] }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'wait-1',
          name: 'Wait for the click',
          type: 'Wait',
          operation: 'Resume: On Webhook Call',
          icon: 'clock',
          tone: 'flow',
          summary: 'HTTP Method GET, since the client presses a link. Limit Wait Time 3 days. Respond: Using ‘Respond to Webhook’ Node, so the click opens Ledgerline’s thank-you page instead of n8n’s plain “Workflow was started”.',
          wait: { mode: 'webhook', limitMs: 3 * MS_DAY },
          params: [
            { k: 'Resume', v: 'On Webhook Call · GET' },
            { k: 'Limit Wait Time', v: '3 days' },
            { k: 'Respond', v: 'Using ‘Respond to Webhook’ Node' },
          ],
        },
      },
      {
        kind: 'split',
        node: {
          id: 'first-click',
          name: 'Pressed it the first time?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'A Wait that resumes on its webhook outputs the request; one that reaches its limit passes on what it was holding. So query.client is there only after a click.',
          params: [{ k: 'Condition', v: '{{ $json.query?.client }} exists' }],
          run: (items) => ({ outputs: clicked(items[0]) ? [items, []] : [[], items], log: clicked(items[0]) ? 'The request has query.client.' : 'No request: the limit ran out.' }),
        },
        branches: [
          { label: 'true', joins: true, steps: [] },
          {
            label: 'false',
            joins: true,
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'remind',
                  name: 'One reminder',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Ledgerline Gmail (OAuth2)',
                  summary: 'Shorter, same list, same resume URL: it belongs to the execution, so the next Wait answers to it. One reminder only; after that a person calls.',
                  run: (items, ctx) => ({ items: items.map(() => item({ id: '18e2a41f09cd7e02', labelIds: ['SENT'] })), messages: [askEmail(ctx, true)] }),
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'wait-2',
                  name: 'Wait again',
                  type: 'Wait',
                  operation: 'Resume: On Webhook Call',
                  icon: 'clock',
                  tone: 'flow',
                  summary: 'Same settings, Limit Wait Time 4 days, so a client who never answers is a phone call one week after the first email.',
                  wait: { mode: 'webhook', limitMs: 4 * MS_DAY },
                  params: [
                    { k: 'Resume', v: 'On Webhook Call · GET' },
                    { k: 'Limit Wait Time', v: '4 days' },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'node',
        node: {
          id: 'either',
          name: 'Either way',
          type: 'Merge',
          operation: 'Append',
          icon: 'merge',
          tone: 'flow',
          summary: 'Input 1 is a click on the first email, input 2 everything after the reminder. Only one ever has the item, so Append passes on whichever it is.',
          params: [{ k: 'Mode', v: 'Append' }],
          run: (items) => ({ items }),
        },
      },
      {
        kind: 'split',
        node: {
          id: 'ever-click',
          name: 'Pressed it at all?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'The same test as before, now covering both waits: a click on either email has query.client, and a week of silence does not.',
          params: [{ k: 'Condition', v: '{{ $json.query?.client }} exists' }],
          run: (items) => ({ outputs: clicked(items[0]) ? [items, []] : [[], items], log: clicked(items[0]) ? 'They pressed the link.' : 'A week and no click.' }),
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'thanks',
                  name: 'Show the thank-you page',
                  type: 'Respond to Webhook',
                  operation: 'Respond With: Redirect',
                  icon: 'reply',
                  tone: 'flow',
                  summary: 'Answers the click that resumed the Wait with a redirect to Ledgerline’s own page. First, so the client is not left waiting while Drive is checked.',
                  params: [{ k: 'Redirect URL', v: vars.thanks_page }],
                  run: (items) => ({ items, messages: [{ channel: 'http', to: 'the client’s browser', subject: 'HTTP 307 Redirect', body: `Location: ${vars.thanks_page}` }] }),
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'files',
                  name: 'List the folder',
                  type: 'Google Drive',
                  operation: 'File/Folder › Search',
                  icon: 'folder',
                  tone: 'app',
                  credential: 'Ledgerline Google (OAuth2)',
                  summary: 'Filter: in the client’s folder, files only. Always Output Data on, so an empty folder still produces one item and the check below still runs.',
                  settings: { alwaysOutputData: true, retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [
                    { k: 'Filter', v: "Folder = {{ $('When Executed by Another Workflow').first().json.folder_id }} · What to Search: Files" },
                    { k: 'Return All', v: 'On' },
                  ],
                  run: (_items, ctx) => {
                    const names = (ctx.fixtures.files as string[] | undefined) ?? [];
                    return names.length ? { items: names.map((n, i) => item({ id: `1f${i}xQ`, name: n, mimeType: n.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' })), log: `${names.length} files.` } : { items: [item({})], log: 'Empty folder; Always Output Data sends one empty item.' };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'missing',
                  name: 'What is still missing?',
                  type: 'Code',
                  operation: 'JavaScript · Run Once for All Items',
                  icon: 'code',
                  tone: 'core',
                  summary: 'Compares file names to the list. A file counts for a document if its name holds that document’s word (bank, credit, tax…), which is how clients actually name things.',
                  code: { language: 'javascript', source: missingCode },
                  run: (items, ctx) => {
                    const docs = docsOf(ctx).docs;
                    const names = items.map((f) => String(f.json.name ?? '').toLowerCase()).filter(Boolean);
                    const missing = docs.filter((d) => !names.some((n) => n.includes(d.match))).map((d) => d.name);
                    return { items: [item({ files: names.length, missing, missing_text: missing.map((d) => `- ${d}`).join('\n') })], log: missing.length ? `Missing ${missing.join(', ')}.` : 'Everything is in.' };
                  },
                },
              },
              {
                kind: 'split',
                node: {
                  id: 'complete',
                  name: 'Anything missing?',
                  type: 'If',
                  icon: 'split',
                  tone: 'logic',
                  summary: 'Array condition: missing is not empty.',
                  params: [{ k: 'Condition', v: '{{ $json.missing }} is not empty' }],
                  run: (items) => {
                    const yes = (items[0].json.missing as string[]).length > 0;
                    return { outputs: yes ? [items, []] : [[], items] };
                  },
                },
                branches: [
                  {
                    label: 'true',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'almost',
                          name: 'Almost there',
                          type: 'Gmail',
                          operation: 'Message › Send',
                          icon: 'mail',
                          tone: 'app',
                          credential: 'Ledgerline Gmail (OAuth2)',
                          summary: 'Thanks them for what came in and names only what is missing, from the Code node. The bookkeeper is on Reply To and picks it up from here.',
                          run: (items, ctx) => {
                            const d = docsOf(ctx);
                            return {
                              items: [item({ id: '18e2c90a33f1b8e7', labelIds: ['SENT'] })],
                              messages: [{ channel: 'email', to: d.email, subject: 'Thanks, nearly everything is in', body: `Hi ${d.first_name},\n\nThank you, we have your files. To finish, we still need:\n${items[0].json.missing_text}\n\nSame folder as before: ${d.folder_url}\nReply here if you are not sure where to find them, and ${firstName(d.accountant)} will help.\n\nThe Ledgerline team` }],
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
                          id: 'ready',
                          name: 'Task to Ready',
                          type: 'ClickUp',
                          operation: 'Task › Update',
                          icon: 'task',
                          tone: 'app',
                          credential: 'Ledgerline ClickUp (OAuth2)',
                          summary: 'The task 01 created moves to the Ready status, which is what the bookkeepers’ ClickUp view sorts on.',
                          params: [
                            { k: 'Task ID', v: "{{ $('When Executed by Another Workflow').first().json.task_id }}" },
                            { k: 'Update Fields', v: 'Status = ready' },
                          ],
                          run: () => ({ items: [item({ id: '86b2qx4fh', status: { status: 'ready' } })] }),
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'tell-ready',
                          name: 'Tell the bookkeeper',
                          type: 'Slack',
                          operation: 'Message › Send',
                          icon: 'slack',
                          tone: 'app',
                          credential: 'Ledgerline Slack (bot)',
                          summary: 'A direct message (Send Message To: User) to the bookkeeper, with the folder and the file count.',
                          params: [{ k: 'Send Message To', v: 'User · the bookkeeper' }],
                          run: (_items, ctx) => {
                            const d = docsOf(ctx);
                            const files = ctx.$('What is still missing?')[0].json.files;
                            return { items: [item({ ok: true, ts: '1772902800.330019' })], messages: [{ channel: 'slack', to: `DM to ${d.accountant}`, body: `${d.business_name} (${d.client_id}) has everything in: ${files} files. Ready for setup. ${d.folder_url}` }] };
                          },
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
                  id: 'call',
                  name: 'Ask the bookkeeper to call',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Ledgerline Slack (bot)',
                  summary: 'Two emails and a week of silence: a person is better than a third email. A direct message to the bookkeeper with the client’s details and the folder.',
                  params: [{ k: 'Send Message To', v: 'User · the bookkeeper' }],
                  run: (_items, ctx) => {
                    const d = docsOf(ctx);
                    return { items: [item({ ok: true, ts: '1773162000.118342' })], messages: [{ channel: 'slack', to: `DM to ${d.accountant}`, body: `${d.business_name} (${d.client_id}) has not answered two document emails in a week. Could you give ${d.first_name} a call? ${d.email}. Folder: ${d.folder_url}` }] };
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
      id: 'quick',
      label: 'Uploads everything the next day',
      summary: 'Carmen uploads her statements and last return on Wednesday and presses the link. The Wait resumes with her click, she lands on the thank-you page, Drive finds four files, and Grace hears she is ready.',
      start: at(1, 10, 22),
      input: [input({ client_id: 'LL-2603-5121', first_name: 'Carmen', email: 'carmen@ruizplumbing.example', business_name: 'Ruiz Family Plumbing LLC', service: 'Monthly bookkeeping', accountant: 'Grace Kim' })],
      resume: { 'wait-1': { afterMs: MS_DAY + 3 * 3600000, json: resumed('LL-2603-5121') } },
      fixtures: { files: ['Chase bank statements Dec-Feb.pdf', 'Amex credit card Dec-Feb.pdf', '2025 tax return.pdf', 'IMG_2231.jpg'] },
      expect: { status: 'success', visits: ['ask', 'wait-1', 'first-click:0', 'either', 'ever-click:0', 'thanks', 'files', 'missing', 'complete:1', 'ready', 'tell-ready'], skips: ['remind', 'almost', 'call'] },
    },
    {
      id: 'partial',
      label: 'Uploads some, forgets payroll',
      summary: 'Jamal presses the link after two days, but his payroll register is not in the folder. He gets a short email naming only that, and Marcus is on Reply To.',
      start: at(2, 15, 30),
      input: [input({ client_id: 'LL-2603-5144', first_name: 'Jamal', email: 'jamal@harbordental.example', business_name: 'Harbor Dental Studio', service: 'Bookkeeping and payroll', accountant: 'Marcus Bell' })],
      resume: { 'wait-1': { afterMs: 2 * MS_DAY, json: resumed('LL-2603-5144') } },
      fixtures: { files: ['Bank statements Q4.pdf', 'Credit card - Capital One.pdf', 'Tax return 2025.pdf'] },
      expect: { status: 'success', visits: ['first-click:0', 'complete:0', 'almost'], skips: ['ready'] },
    },
    {
      id: 'after-reminder',
      label: 'Answers the reminder',
      summary: 'Ines’s catch-up client misses the first email. After three days the reminder goes out; he uploads everything the next morning and presses the link, which resumes the second Wait.',
      start: at(0, 13, 10),
      input: [input({ client_id: 'LL-2603-5098', first_name: 'Wes', email: 'wes@prairieroofing.example', business_name: 'Prairie Roofing Co.', service: 'Catch-up (behind on the books)', accountant: 'Ines Duarte' })],
      resume: { 'wait-2': { afterMs: 20 * 3600000, json: resumed('LL-2603-5098') } },
      fixtures: { files: ['bank statements 2025.pdf', 'credit cards 2025.pdf', 'last tax return.pdf', 'loan statements SBA.pdf'] },
      expect: { status: 'success', visits: ['first-click:1', 'remind', 'wait-2', 'either', 'ever-click:0', 'complete:1', 'tell-ready'] },
    },
    {
      id: 'silent',
      label: 'Never answers',
      summary: 'A week passes with no click on either email. Both limits run out, the If takes false, and Grace gets a direct message asking her to call. No third email.',
      start: at(3, 9, 0),
      input: [input({ client_id: 'LL-2603-5170', first_name: 'Dana', email: 'dana@bluecanyoncafe.example', business_name: 'Blue Canyon Café', service: 'Monthly bookkeeping', accountant: 'Grace Kim' })],
      expect: { status: 'success', visits: ['remind', 'wait-2', 'ever-click:1', 'call'], skips: ['thanks', 'files'] },
    },
    {
      id: 'empty',
      label: 'Presses the link with nothing uploaded',
      summary: 'Lena presses the link straight away, before uploading. Drive finds no files; Always Output Data keeps the run going with one empty item, and she gets the full list back.',
      start: at(4, 16, 40),
      input: [input({ client_id: 'LL-2603-5188', first_name: 'Lena', email: 'lena@fischerdesign.example', business_name: 'Fischer Design Studio', service: 'Monthly bookkeeping', accountant: 'Grace Kim' })],
      resume: { 'wait-1': { afterMs: 6 * 60000, json: resumed('LL-2603-5188') } },
      fixtures: { files: [] },
      expect: { status: 'success', visits: ['files', 'missing', 'almost'], items: { files: 1 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Ledgerline Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Sends as hello@ledgerline.example.' },
      { name: 'Ledgerline Google (OAuth2)', type: 'Google OAuth2 (Drive and Sheets)', note: 'The automations@ Workspace user owns every client folder, so it can list them.' },
      { name: 'Ledgerline ClickUp (OAuth2)', type: 'ClickUp OAuth2', note: 'Updates task status.' },
      { name: 'Ledgerline Slack (bot)', type: 'Slack OAuth2', note: 'Can send direct messages to staff.' },
    ],
    fields: [
      { name: 'client_id, first_name, email, business_name, service, accountant, folder_id, task_id', where: 'Sub-workflow inputs', type: 'Declared fields', note: '01 fills them in its Execute Sub-workflow node' },
      { name: 'docs, docs_text', where: 'Workflow item', type: 'Array, String', note: 'From the document list Code node' },
      { name: 'query.client', where: 'Wait node output', type: 'String', note: 'Present only when the client pressed the link' },
    ],
    variables: [{ key: 'thanks_page', value: vars.thanks_page }],
  },
  build: [
    { title: 'A sub-workflow with a contract', body: 'The Execute Sub-workflow Trigger declares its eight input fields, so 01 shows them as boxes to fill and a typo is visible at build time. This workflow can be called only by 01, set under Settings › This workflow can be called by.' },
    { title: 'A link that wakes the execution up', body: 'The Wait node’s On Webhook Call resume gives each execution its own $execution.resumeUrl. The email links to it with the client ID added, and HTTP Method is GET because a click on a link is a GET.' },
    { title: 'Waiting costs nothing', body: 'A Wait over 65 seconds saves the execution to the database and lets go of it. Ledgerline has a few dozen chases waiting at any time, and none of them hold memory or survive a restart badly.' },
    { title: 'Tell a click from a timeout', body: 'After a click, the Wait outputs the request, with query.client. When Limit Wait Time runs out, it passes on what it held. So an If on query.client is the honest test, and the same test after the Merge covers both waits.' },
    { title: 'Branches that meet again', body: 'The click after the first email and everything after the reminder meet at a Merge in Append mode. Unlike GoHighLevel, n8n lets branches join, so the folder check is built once.' },
    { title: 'Check the folder, not the client’s word', body: 'Google Drive Search lists the folder with Always Output Data on, so an empty folder still reaches the Code node. The Code node compares names loosely, because nobody names a file “Bank statements”.' },
    { title: 'Respond, then think', body: 'The Wait is set to respond Using ‘Respond to Webhook’ Node. The redirect to the thank-you page is the first node after the click, so the client’s browser is answered before Drive is called.' },
  ],
  edgeCases: [
    { title: 'The client presses the link twice', body: 'The first press resumes the Wait. By the second, this execution has moved on or finished, and n8n answers that the execution is not waiting. The client already saw the thank-you page the first time.' },
    { title: 'The client forwards the email', body: 'Anyone with the link can resume the chase. The link only says “check the folder”, which is harmless; the folder itself is shared with the client’s email only.' },
    { title: 'Files named in ways the check cannot read', body: '“Scan0042.pdf” counts for nothing, so the client is told a document is missing that might be there. The bookkeeper is on Reply To and sorts it out in one reply; the email’s wording is gentle for that reason.' },
    { title: 'n8n is restarted during the wait', body: 'Waiting executions are in the database, not in memory, so they resume on time after a restart or an update. Tom checks the Executions list for Waiting rows after each update anyway.' },
    { title: 'The bookkeeper changes', body: 'The accountant is passed in when the chase starts. Reassigning a client mid-chase means the Slack message goes to the old owner, who forwards it; rare enough not to build for.' },
  ],
  qa: [
    'Manual test from 01 with pinned data: 02 shows its own execution, and the email’s link holds a resume URL',
    'Press the link: the browser lands on the thank-you page and the execution continues within a second',
    'Let the 3-day limit run out (shortened to 2 minutes in a copy): the reminder goes, the second Wait starts',
    'Folder empty, partial and complete: “almost there” with all, some or none of the list, and Ready only when complete',
    'Restart the n8n container during a wait: the execution is still Waiting and resumes on time',
    'Call 02 from any workflow other than 01: refused by the caller policy',
  ],
  snippets: [
    { title: 'What is still missing? (Code node)', language: 'javascript', code: missingCode, note: 'Run Once for All Items. $(\'The document list\').first() reaches back past the Waits and the Merge to the list made at the start.' },
    { title: 'Document list (Code node)', language: 'javascript', code: listCode },
  ],
  features: ['Execute Sub-workflow Trigger', 'Caller policy', 'Wait (On Webhook Call)', '$execution.resumeUrl', 'Limit Wait Time', 'If', 'Merge (Append)', 'Respond to Webhook (Redirect)', 'Google Drive search', 'Always Output Data', 'Code (all items)', 'ClickUp', 'Slack direct messages'],
};
