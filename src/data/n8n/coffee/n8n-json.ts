/**
 * What n8n needs to rebuild Copperleaf's workflows: node type, version and
 * parameters for every node on the page, by node id. src/lib/n8n/export.ts
 * joins these with the page's data; `npm run n8n:check` fails if a node has
 * no spec. Code nodes take their program from the page itself.
 */
import type { Specs } from '@/lib/n8n/export';
import { assign, cond, ex, ifParams, rl, switchParams, conditions } from '../spec-helpers';
import { business } from './business';

const v = business.env.vars;
const slack = (channel: string, text: string) => ({
  type: 'n8n-nodes-base.slack',
  typeVersion: 2.3,
  credentialType: 'slackOAuth2Api',
  parameters: { authentication: 'oAuth2', resource: 'message', operation: 'post', select: 'channel', channelId: rl(channel, 'name'), text, otherOptions: {} },
});
const gmail = (subject: string, message: string, attachments?: string) => ({
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.1,
  credentialType: 'gmailOAuth2',
  parameters: {
    resource: 'message',
    operation: 'send',
    sendTo: ex("{{ $('Score the fit').item.json.email }}"),
    subject,
    emailType: 'text',
    message,
    options: { appendAttribution: false, senderName: 'Maya Okoye', ...(attachments ? { attachmentsUi: { attachmentsBinary: [{ property: attachments }] } } : {}) },
  },
});
const sheetDoc = rl('1CopperleafProductionSheetId', 'list', 'Copperleaf Production');

export const coffeeSpecs: Record<string, Specs> = {
  'wholesale-inquiry': {
    form: {
      type: 'n8n-nodes-base.formTrigger',
      typeVersion: 2.2,
      webhookId: '6f0e4f43-1c0b-4c3e-9d0a-wholesale0001',
      parameters: {
        formTitle: 'Wholesale coffee for your business',
        formDescription: 'Tell us a little about your café, restaurant or shop. Maya, our owner, reads every one, and you will hear back by email within the hour.',
        formFields: {
          values: [
            { fieldLabel: 'Business name', requiredField: true },
            { fieldLabel: 'Your name', requiredField: true },
            { fieldLabel: 'Email', fieldType: 'email', requiredField: true },
            { fieldLabel: 'Business type', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: ['Café or coffee shop', 'Restaurant', 'Grocery or retail', 'Office', 'Other'].map((option) => ({ option })) } },
            { fieldLabel: 'Coffee per week (lbs)', fieldType: 'number', requiredField: true },
            { fieldLabel: 'City and state' },
            { fieldLabel: 'Mostly espresso or brewed?', fieldType: 'dropdown', fieldOptions: { values: ['Mostly espresso', 'Mostly brewed', 'About half and half'].map((option) => ({ option })) } },
            { fieldLabel: 'Anything else?', fieldType: 'textarea' },
          ],
        },
        responseMode: 'onReceived',
        options: { appendAttribution: false, ignoreBots: true, useWorkflowTimezone: true, respondWithOptions: { values: { formSubmittedText: 'Thanks! Maya will be in touch by email shortly.' } } },
      },
    },
    clean: {
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      parameters: assign([
        ['business_name', ex("{{ $json['Business name'].trim() }}")],
        ['contact_name', ex("{{ $json['Your name'].trim() }}")],
        ['first_name', ex("{{ $json['Your name'].trim().split(' ')[0] }}")],
        ['email', ex('{{ $json.Email.trim().toLowerCase() }}')],
        ['business_type', ex("{{ $json['Business type'] }}")],
        ['lbs_per_week', ex("{{ Number($json['Coffee per week (lbs)']) }}"), 'number'],
        ['location', ex("{{ $json['City and state'].trim() }}")],
        ['focus', ex("{{ $json['Mostly espresso or brewed?'] }}")],
        ['message', ex("{{ $json['Anything else?'].trim() }}")],
        ['submitted_at', ex('{{ $json.submittedAt }}')],
        ['source', 'wholesale-form'],
      ]),
    },
    score: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForEachItem' } },
    hubspot: {
      type: 'n8n-nodes-base.hubspot',
      typeVersion: 2.1,
      credentialType: 'hubspotAppToken',
      parameters: {
        authentication: 'appToken',
        resource: 'contact',
        operation: 'upsert',
        email: ex('{{ $json.email }}'),
        additionalFields: {
          companyName: ex('{{ $json.business_name }}'),
          firstName: ex('{{ $json.first_name }}'),
          lifeCycleStage: 'lead',
          customPropertiesUi: {
            customPropertiesValues: [
              { property: 'wholesale_fit_score', value: ex('{{ $json.fit_score }}') },
              { property: 'lbs_per_week', value: ex('{{ $json.lbs_per_week }}') },
            ],
          },
        },
      },
    },
    'slack-hubspot': slack(v.wholesale_channel, ex("HubSpot did not take {{ $('Score the fit').item.json.business_name }} ({{ $('Score the fit').item.json.email }}): {{ $json.error.message }}. Please add them by hand. Their reply email is still going out.")),
    merge: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: {} },
    route: {
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      parameters: switchParams(
        [
          { key: 'Priority', when: [cond(ex("{{ $('Score the fit').item.json.tier }}"), { type: 'string', operation: 'equals' }, 'priority')] },
          { key: 'Standard', when: [cond(ex("{{ $('Score the fit').item.json.tier }}"), { type: 'string', operation: 'equals' }, 'standard')] },
        ],
        'Small',
      ),
    },
    'slack-priority': {
      ...slack(v.wholesale_channel, ex("Wholesale lead: {{ $('Score the fit').item.json.business_name }}")),
      parameters: {
        authentication: 'oAuth2',
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: rl(v.wholesale_channel, 'name'),
        messageType: 'block',
        blocksUi: ex(
          JSON.stringify({
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: "Wholesale lead: {{ $('Score the fit').item.json.business_name }}" } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: "*Who*\n{{ $('Score the fit').item.json.contact_name }}" },
                  { type: 'mrkdwn', text: "*Where*\n{{ $('Score the fit').item.json.location }}" },
                  { type: 'mrkdwn', text: "*Volume*\n{{ $('Score the fit').item.json.lbs_per_week }} lb a week" },
                  { type: 'mrkdwn', text: "*Fit*\n{{ $('Score the fit').item.json.fit_score }}/100" },
                ],
              },
            ],
          }),
        ),
        text: ex("Wholesale lead: {{ $('Score the fit').item.json.business_name }}"),
        otherOptions: {},
      },
    },
    'mail-priority': gmail(
      ex("Coffee for {{ $('Score the fit').item.json.business_name }}"),
      ex(
        "Hi {{ $('Score the fit').item.json.first_name }},\n\nThanks for reaching out about wholesale. At {{ $('Score the fit').item.json.lbs_per_week }} pounds a week we would love to roast for {{ $('Score the fit').item.json.business_name }}.\n\nThe best next step is a short call and a box of samples, so you can taste three of our espresso and filter roasts on your own equipment. Pick a time here: " +
          v.booking_link +
          '\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville',
      ),
    ),
    drive: {
      type: 'n8n-nodes-base.googleDrive',
      typeVersion: 3,
      credentialType: 'googleDriveOAuth2Api',
      parameters: { operation: 'download', fileId: rl('1CopperleafPriceList2026', 'list', v.price_list_file), options: { binaryPropertyName: 'data' } },
    },
    'mail-standard': gmail(
      'Copperleaf wholesale prices',
      ex(
        "Hi {{ $('Score the fit').item.json.first_name }},\n\nThanks for asking about wholesale for {{ $('Score the fit').item.json.business_name }}. Our price list is attached. At {{ $('Score the fit').item.json.lbs_per_week }} pounds a week you are on our standard tier, with free delivery in Buncombe County and two-day shipping everywhere else.\n\nIf you would like samples first, reply with your address and I will send a box this week.\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville",
      ),
      'data',
    ),
    'mail-small': gmail(
      'Fresh coffee for your team',
      ex(
        "Hi {{ $('Score the fit').item.json.first_name }},\n\nThanks for thinking of us for {{ $('Score the fit').item.json.business_name }}. Wholesale starts at 10 pounds a week, so for {{ $('Score the fit').item.json.lbs_per_week }} pounds our office subscription is the better deal: freshly roasted bags every week or two, cancel any time. The code TEAM15 takes 15% off the first three months at copperleaf.example/subscribe.\n\nIf you grow into wholesale, just reply and I will set it up.\n\nMaya Okoye\nCopperleaf Coffee Roasters, Asheville",
      ),
    ),
  },

  'roast-queue': {
    shopify: { type: 'n8n-nodes-base.shopifyTrigger', typeVersion: 1, credentialType: 'shopifyAccessTokenApi', webhookId: '0d6b1f2a-7c3e-4b8a-9f21-roastqueue001', parameters: { authentication: 'accessToken', topic: 'orders/paid' } },
    'not-test': { type: 'n8n-nodes-base.filter', typeVersion: 2.2, parameters: { conditions: conditions([cond(ex('{{ $json.test }}'), { type: 'boolean', operation: 'false' })]), options: {} } },
    dedupe: { type: 'n8n-nodes-base.removeDuplicates', typeVersion: 2, parameters: { operation: 'removeItemsSeenInPreviousExecutions', dedupeValue: ex('{{ $json.id }}'), options: {} } },
    split: { type: 'n8n-nodes-base.splitOut', typeVersion: 1, parameters: { fieldToSplitOut: 'line_items', include: 'selectedOtherFields', fieldsToInclude: 'name, created_at, note', options: {} } },
    kind: {
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      parameters: switchParams(
        [
          { key: 'Coffee', when: [cond(ex('{{ $json.sku }}'), { type: 'string', operation: 'startsWith' }, 'CF-')] },
          { key: 'Gear', when: [cond(ex('{{ $json.sku }}'), { type: 'string', operation: 'startsWith' }, 'GR-')] },
        ],
        'Other',
      ),
    },
    'roast-day': { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForEachItem' } },
    'sheet-roast': {
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      credentialType: 'googleSheetsOAuth2Api',
      parameters: { operation: 'append', documentId: sheetDoc, sheetName: rl('gid=0', 'list', 'Roast queue'), columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} },
    },
    'sheet-pick': {
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      credentialType: 'googleSheetsOAuth2Api',
      parameters: {
        operation: 'append',
        documentId: sheetDoc,
        sheetName: rl('gid=1', 'list', 'Pick list'),
        columns: {
          mappingMode: 'defineBelow',
          value: { order: ex('{{ $json.name }}'), item: ex('{{ $json.title }}'), qty: ex('{{ $json.quantity }}') },
          matchingColumns: [],
          schema: ['order', 'item', 'qty'].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })),
        },
        options: {},
      },
    },
    merge: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: {} },
    aggregate: { type: 'n8n-nodes-base.aggregate', typeVersion: 1, parameters: { aggregate: 'aggregateAllItemData', destinationFieldName: 'lines', options: {} } },
    'heads-up': {
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      parameters: ifParams(
        [
          cond(ex("{{ $('New paid order').first().json.note }}"), { type: 'string', operation: 'notEmpty' }),
          cond(ex("{{ $('New paid order').first().json.shipping_lines[0].title }}"), { type: 'string', operation: 'contains' }, 'Express'),
        ],
        'or',
      ),
    },
    'slack-packing': slack(
      v.packing_channel,
      ex("{{ $('New paid order').first().json.name }} for {{ $('New paid order').first().json.customer.first_name }} {{ $('New paid order').first().json.customer.last_name }}\n{{ $json.lines.map(l => l.coffee ? `${l.bags} × ${l.coffee}, ${l.grind}, ${l.size} (roast ${l.roast_by})` : `${l.qty} × ${l.item}`).join('\\n') }}\nGift note: {{ $('New paid order').first().json.note || 'none' }}"),
    ),
  },

  'stock-check': {
    schedule: { type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * 1-6' }] } } },
    products: { type: 'n8n-nodes-base.shopify', typeVersion: 1, credentialType: 'shopifyAccessTokenApi', parameters: { authentication: 'accessToken', resource: 'product', operation: 'getAll', returnAll: true, additionalFields: {} } },
    flatten: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForAllItems' } },
    points: { type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, credentialType: 'googleSheetsOAuth2Api', parameters: { operation: 'read', documentId: sheetDoc, sheetName: rl('gid=2', 'list', 'Reorder points'), options: {} } },
    match: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: { mode: 'combine', fieldsToMatchString: 'sku', options: {} } },
    low: {
      type: 'n8n-nodes-base.filter',
      typeVersion: 2.2,
      parameters: { conditions: conditions([cond(ex('{{ $json.on_hand }}'), { type: 'number', operation: 'lte' }, ex('{{ $json.reorder_point }}'))]), options: {} },
    },
    weekly: { type: 'n8n-nodes-base.removeDuplicates', typeVersion: 2, parameters: { operation: 'removeItemsSeenInPreviousExecutions', dedupeValue: ex("{{ $json.sku }}|{{ $now.startOf('week').toISODate() }}"), options: {} } },
    line: { type: 'n8n-nodes-base.set', typeVersion: 3.4, parameters: assign([['line', ex('{{ $json.name }}: {{ $json.on_hand }} left (point {{ $json.reorder_point }}). {{ $json.supplier }}, {{ $json.reorder_qty }}.')]]) },
    gather: { type: 'n8n-nodes-base.aggregate', typeVersion: 1, parameters: { fieldsToAggregate: { fieldToAggregate: [{ fieldToAggregate: 'line', renameField: true, outputFieldName: 'lines' }] }, options: {} } },
    slack: slack(v.ops_channel, ex("Low stock this morning:\n{{ $json.lines.join('\\n') }}")),
  },
};
