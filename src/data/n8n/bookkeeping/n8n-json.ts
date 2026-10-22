/**
 * What n8n needs to rebuild Ledgerline's workflows: node type, version and
 * parameters for every node on the page, by node id. See src/lib/n8n/export.ts.
 */
import type { Specs } from '@/lib/n8n/export';
import { assign, cond, ex, ifParams, rl } from '../spec-helpers';
import { business } from './business';

const v = business.env.vars;
const c = "$('Client ID and folder name').item.json";
const d = "$('The document list').first().json";
const start = "$('When Executed by Another Workflow').first().json";

const slackChannel = (channel: string, text: string) => ({
  type: 'n8n-nodes-base.slack',
  typeVersion: 2.3,
  credentialType: 'slackOAuth2Api',
  parameters: { authentication: 'oAuth2', resource: 'message', operation: 'post', select: 'channel', channelId: rl(channel, 'name'), text, otherOptions: {} },
});
const slackUser = (user: string, text: string) => ({
  type: 'n8n-nodes-base.slack',
  typeVersion: 2.3,
  credentialType: 'slackOAuth2Api',
  parameters: { authentication: 'oAuth2', resource: 'message', operation: 'post', select: 'user', user: rl(user, 'username'), text, otherOptions: {} },
});
const gmail = (to: string, subject: string, message: string, replyTo?: string) => ({
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.1,
  credentialType: 'gmailOAuth2',
  parameters: { resource: 'message', operation: 'send', sendTo: to, subject, emailType: 'text', message, options: { appendAttribution: false, senderName: 'Ledgerline', ...(replyTo ? { replyTo } : {}) } },
});
const clientList = { documentId: rl('1LedgerlineClientListSheet', 'list', 'Client list'), sheetName: rl('gid=0', 'list', 'Clients') };
const wait = (days: number, webhookId: string) => ({
  type: 'n8n-nodes-base.wait',
  typeVersion: 1.1,
  webhookId,
  parameters: { resume: 'webhook', httpMethod: 'GET', responseMode: 'responseNode', limitWaitTime: true, limitType: 'afterTimeInterval', resumeAmount: days, resumeUnit: 'days', options: {} },
});
const clicked = () => ifParams([cond(ex('{{ $json.query?.client }}'), { type: 'string', operation: 'exists' })], 'and', true);

export const bookkeepingSpecs: Record<string, Specs> = {
  'client-onboarding': {
    webhook: {
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      credentialType: 'httpHeaderAuth',
      webhookId: '4d2c7e1a-9b3f-4c8e-a6d5-newclient001',
      parameters: { httpMethod: 'POST', path: 'new-client', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
    },
    valid: {
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      parameters: ifParams([
        cond(ex('{{ $json.body.business_name }}'), { type: 'string', operation: 'notEmpty' }),
        cond(ex('{{ $json.body.email }}'), { type: 'string', operation: 'regex' }, '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
        cond(ex("{{ ['Monthly bookkeeping', 'Bookkeeping and payroll', 'Catch-up (behind on the books)'].includes($json.body.service) }}"), { type: 'boolean', operation: 'true' }),
      ]),
    },
    'respond-ok': {
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      parameters: { respondWith: 'json', responseBody: '{\n  "ok": true,\n  "message": "Thanks! Check your inbox for a welcome email from Ledgerline."\n}', options: { responseCode: 200 } },
    },
    'respond-422': {
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      parameters: {
        respondWith: 'json',
        responseBody: ex("{{ JSON.stringify({ ok: false, missing: [!$json.body.business_name && 'business_name', !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test($json.body.email || '') && 'email', !$json.body.service && 'service'].filter(Boolean) }) }}"),
        options: { responseCode: 422 },
      },
    },
    lookup: {
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      credentialType: 'googleSheetsOAuth2Api',
      parameters: { operation: 'read', ...clientList, filtersUI: { values: [{ lookupColumn: 'email', lookupValue: ex('{{ $json.body.email.trim().toLowerCase() }}') }] }, options: {} },
    },
    returning: { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: ifParams([cond(ex('{{ $json.client_id }}'), { type: 'string', operation: 'notEmpty' })], 'and', true) },
    'slack-returning': slackChannel(v.onboarding_channel, ex("{{ $('New client form').item.json.body.business_name }} filled in the onboarding form again ({{ $('New client form').item.json.body.email }}, {{ $('New client form').item.json.body.service }}). They are already {{ $json.client_id }} with {{ $json.accountant }}, so nothing new was created. Folder: {{ $json.folder_url }}")),
    ids: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForEachItem' } },
    folder: {
      type: 'n8n-nodes-base.googleDrive',
      typeVersion: 3,
      credentialType: 'googleDriveOAuth2Api',
      parameters: { resource: 'folder', name: ex('{{ $json.folder_name }}'), driveId: rl('My Drive', 'list', 'My Drive'), folderId: rl('1LedgerlineClientsFolder', 'list', v.clients_folder), options: {} },
    },
    share: {
      type: 'n8n-nodes-base.googleDrive',
      typeVersion: 3,
      credentialType: 'googleDriveOAuth2Api',
      parameters: {
        resource: 'folder',
        operation: 'share',
        folderNoRootId: rl(ex('{{ $json.id }}'), 'id'),
        permissionsUi: { permissionsValues: { role: 'writer', type: 'user', emailAddress: ex(`{{ ${c}.email }}`) } },
        options: { sendNotificationEmail: false },
      },
    },
    'log-client': {
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      credentialType: 'googleSheetsOAuth2Api',
      parameters: {
        operation: 'append',
        ...clientList,
        columns: {
          mappingMode: 'defineBelow',
          value: {
            client_id: ex(`{{ ${c}.client_id }}`),
            business_name: ex(`{{ ${c}.business_name }}`),
            email: ex(`{{ ${c}.email }}`),
            service: ex(`{{ ${c}.service }}`),
            accountant: ex(`{{ ${c}.accountant }}`),
            folder_url: ex("{{ $('Create the client folder').item.json.webViewLink }}"),
            status: 'Onboarding',
            started: ex('{{ $today.toISODate() }}'),
          },
          matchingColumns: [],
          schema: ['client_id', 'business_name', 'email', 'service', 'accountant', 'folder_url', 'status', 'started'].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })),
        },
        options: {},
      },
    },
    task: {
      type: 'n8n-nodes-base.clickUp',
      typeVersion: 1,
      credentialType: 'clickUpOAuth2Api',
      parameters: {
        authentication: 'oAuth2',
        team: '9011001',
        space: '90110021',
        folderless: true,
        list: '901100211',
        name: ex(`Onboard {{ ${c}.business_name }}`),
        additionalFields: { assignees: ex(`{{ ${c}.clickup_assignee }}`), content: ex(`{{ ${c}.service }}. Client {{ ${c}.client_id }}, {{ ${c}.email }}. Folder: {{ $('Create the client folder').item.json.webViewLink }}`) },
      },
    },
    welcome: gmail(
      ex(`{{ ${c}.email }}`),
      ex(`Welcome to Ledgerline, {{ ${c}.business_name }}`),
      ex(`Hi {{ ${c}.first_name }},\n\nWelcome aboard. {{ ${c}.accountant }} will look after your {{ ${c}.service.toLowerCase() }}, and replies to this email go straight to them.\n\nWe have set up a private Google Drive folder for your documents: {{ $('Create the client folder').item.json.webViewLink }}\nYour client ID is {{ ${c}.client_id }}.\n\nIn a separate email you will get the short list of documents we need to start. Most clients have everything in within a week.\n\nThe Ledgerline team`),
      ex(`{{ ${c}.accountant_email }}`),
    ),
    chase: {
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.2,
      parameters: {
        workflowId: rl('bookkeeping-document-chase', 'list', '02 · Onboarding · Document chase'),
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            client_id: ex(`{{ ${c}.client_id }}`),
            first_name: ex(`{{ ${c}.first_name }}`),
            email: ex(`{{ ${c}.email }}`),
            business_name: ex(`{{ ${c}.business_name }}`),
            service: ex(`{{ ${c}.service }}`),
            accountant: ex(`{{ ${c}.accountant }}`),
            folder_id: ex("{{ $('Create the client folder').item.json.id }}"),
            task_id: ex("{{ $('Task for the bookkeeper').item.json.id }}"),
          },
          matchingColumns: [],
          schema: ['client_id', 'first_name', 'email', 'business_name', 'service', 'accountant', 'folder_id', 'task_id'].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' })),
        },
        mode: 'each',
        options: { waitForSubWorkflow: false },
      },
    },
  },

  'document-chase': {
    start: {
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      parameters: { workflowInputs: { values: ['client_id', 'first_name', 'email', 'business_name', 'service', 'accountant', 'folder_id', 'task_id'].map((name) => ({ name })) } },
    },
    list: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForEachItem' } },
    ask: gmail(
      ex('{{ $json.email }}'),
      ex('The documents we need from {{ $json.business_name }}'),
      ex("Hi {{ $json.first_name }},\n\nTo start your books, {{ $json.accountant.split(' ')[0] }} needs these, for the last three months:\n{{ $json.docs_text }}\n\nUpload them to your private folder: https://drive.google.com/drive/folders/{{ $json.folder_id }}\nWhen you are done, press this link so we know: {{ $execution.resumeUrl }}?client={{ $json.client_id }}\n\nPDFs or photos are both fine.\n\nThe Ledgerline team"),
    ),
    'wait-1': wait(3, '7c1d2e3f-4a5b-4c6d-8e9f-docchase0001'),
    'first-click': { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: clicked() },
    remind: gmail(
      ex(`{{ ${d}.email }}`),
      ex(`Reminder: documents for {{ ${d}.business_name }}`),
      ex(`Hi {{ ${d}.first_name }},\n\nA quick nudge on the documents for your first month. We still need:\n{{ ${d}.docs_text }}\n\nDrop them in your folder, then press this link so we know: {{ $execution.resumeUrl }}?client={{ ${d}.client_id }}\n\nThe Ledgerline team`),
    ),
    'wait-2': wait(4, '7c1d2e3f-4a5b-4c6d-8e9f-docchase0002'),
    either: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: {} },
    'ever-click': { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: clicked() },
    thanks: { type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, parameters: { respondWith: 'redirect', redirectURL: v.thanks_page, options: {} } },
    files: {
      type: 'n8n-nodes-base.googleDrive',
      typeVersion: 3,
      credentialType: 'googleDriveOAuth2Api',
      parameters: { resource: 'fileFolder', operation: 'search', returnAll: true, filter: { folderId: rl(ex(`{{ ${start}.folder_id }}`), 'id'), whatToSearch: 'files' }, options: {} },
    },
    missing: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForAllItems' } },
    complete: { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: ifParams([cond(ex('{{ $json.missing }}'), { type: 'array', operation: 'notEmpty' })]) },
    almost: gmail(
      ex(`{{ ${d}.email }}`),
      'Thanks, nearly everything is in',
      ex(`Hi {{ ${d}.first_name }},\n\nThank you, we have your files. To finish, we still need:\n{{ $json.missing_text }}\n\nSame folder as before. Reply here if you are not sure where to find them.\n\nThe Ledgerline team`),
    ),
    ready: {
      type: 'n8n-nodes-base.clickUp',
      typeVersion: 1,
      credentialType: 'clickUpOAuth2Api',
      parameters: { authentication: 'oAuth2', operation: 'update', id: ex(`{{ ${start}.task_id }}`), updateFields: { status: 'ready' } },
    },
    'tell-ready': slackUser(ex(`{{ ${d}.accountant }}`), ex(`{{ ${d}.business_name }} ({{ ${d}.client_id }}) has everything in: {{ $('What is still missing?').item.json.files }} files. Ready for setup.`)),
    call: slackUser(ex(`{{ ${d}.accountant }}`), ex(`{{ ${d}.business_name }} ({{ ${d}.client_id }}) has not answered two document emails in a week. Could you give {{ ${d}.first_name }} a call? {{ ${d}.email }}`)),
  },

  'error-handler': {
    error: { type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, parameters: {} },
    what: {
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      parameters: assign([
        ['workflow', ex('{{ $json.workflow.name }}')],
        ['workflow_id', ex('{{ $json.workflow.id }}')],
        ['node', ex('{{ $json.execution.lastNodeExecuted }}')],
        ['message', ex('{{ $json.execution.error.message }}')],
        ['execution_id', ex('{{ $json.execution.id }}')],
        ['url', ex(`{{ $json.execution.url ?? '${business.env.baseUrl}/workflow/' + $json.workflow.id }}`)],
      ]),
    },
    hourly: { type: 'n8n-nodes-base.removeDuplicates', typeVersion: 2, parameters: { operation: 'removeItemsSeenInPreviousExecutions', dedupeValue: ex("{{ $json.workflow_id }}|{{ $json.node }}|{{ $now.toFormat('yyyy-MM-dd HH') }}"), options: {} } },
    client: { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: ifParams([cond(ex('{{ $json.workflow }}'), { type: 'string', operation: 'regex' }, '^0[12] · ')]) },
    urgent: slackChannel(v.ops_channel, ex('<!here> {{ $json.workflow }} failed. A client is waiting on this one.\nNode: {{ $json.node }}\nError: {{ $json.message }}\nExecution {{ $json.execution_id }}: {{ $json.url }}')),
    task: {
      type: 'n8n-nodes-base.clickUp',
      typeVersion: 1,
      credentialType: 'clickUpOAuth2Api',
      parameters: {
        authentication: 'oAuth2',
        team: '9011001',
        space: '90110021',
        folderless: true,
        list: '901100219',
        name: ex("Fix: {{ $('What broke').item.json.workflow }} at {{ $('What broke').item.json.node }}"),
        additionalFields: { content: ex("{{ $('What broke').item.json.message }}. Retry the execution once fixed: {{ $('What broke').item.json.url }}"), dueDate: ex('{{ $today.toISO() }}') },
      },
    },
    quiet: slackChannel(v.ops_channel, ex('{{ $json.workflow }} failed.\nNode: {{ $json.node }}\nError: {{ $json.message }}\nExecution {{ $json.execution_id }}: {{ $json.url }}')),
  },
};
