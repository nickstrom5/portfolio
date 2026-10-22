/**
 * What n8n needs to rebuild Harrow & Finch's workflows: node type, version
 * and parameters for every node on the page, by node id. See
 * src/lib/n8n/export.ts.
 */
import type { Specs } from '@/lib/n8n/export';
import { assign, cond, conditions, ex, ifParams, openAiModel, rl, switchParams } from '../spec-helpers';
import { business } from './business';

const v = business.env.vars;
const a = "$('The application').item.json";
const m = "$('Match to the role').item.json";
const p = "$('Booked or cancelled').item.json.payload";
const base = rl('appHarrowFinchRecruit', 'list', 'Recruiting');
const table = (name: string) => rl(`tbl${name}`, 'list', name);

const slackUser = (user: string, text: string) => ({
  type: 'n8n-nodes-base.slack',
  typeVersion: 2.3,
  credentialType: 'slackOAuth2Api',
  parameters: { authentication: 'oAuth2', resource: 'message', operation: 'post', select: 'user', user: rl(user, 'username'), text, otherOptions: {} },
});
const gmail = (to: string, subject: string, message: string, sender: string) => ({
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.1,
  credentialType: 'gmailOAuth2',
  parameters: { resource: 'message', operation: 'send', sendTo: to, subject, emailType: 'text', message, options: { appendAttribution: false, senderName: sender } },
});
const airtable = (parameters: Record<string, unknown>) => ({ type: 'n8n-nodes-base.airtable', typeVersion: 2.1, credentialType: 'airtableTokenApi', parameters: { authentication: 'airtableTokenApi', base, ...parameters } });
const columns = (value: Record<string, string>, match: string[]) => ({
  mappingMode: 'defineBelow',
  value,
  matchingColumns: match,
  schema: Object.keys(value).map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })),
});
const signoff = `{{ ${m}.recruiter }}\nHarrow & Finch Recruiting, Chicago`;

export const recruitingSpecs: Record<string, Specs> = {
  'application-intake': {
    webhook: {
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      credentialType: 'httpHeaderAuth',
      webhookId: '9a3b5c7d-1e2f-4a6b-8c0d-applyform001',
      parameters: { httpMethod: 'POST', path: 'apply', authentication: 'headerAuth', responseMode: 'onReceived', options: { responseCode: 202 } },
    },
    shape: {
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      parameters: assign([
        ['name', ex('{{ $json.body.name.trim() }}')],
        ['first_name', ex("{{ $json.body.name.trim().split(' ')[0] }}")],
        ['email', ex('{{ $json.body.email.trim().toLowerCase() }}')],
        ['role', ex('{{ $json.body.role }}')],
        ['location', ex('{{ $json.body.location }}')],
        ['resume_text', ex('{{ $json.body.resume }}')],
      ]),
    },
    extract: {
      type: '@n8n/n8n-nodes-langchain.informationExtractor',
      typeVersion: 1.1,
      parameters: {
        text: ex('{{ $json.resume_text }}'),
        schemaType: 'fromJson',
        jsonSchemaExample: '{\n  "years_experience": 7,\n  "most_recent_title": "Senior Accountant",\n  "skills": ["GAAP", "reconciliations", "month-end close"],\n  "tools": ["NetSuite", "Excel"],\n  "certifications": ["CPA"]\n}',
        options: {
          systemPromptTemplate:
            'Extract only job-related facts from the résumé: years of professional experience in the field, most recent title, skills, software and certifications. Do not infer or return age, gender, ethnicity, health, family status or anything else not about the work. If a fact is not in the text, leave it empty rather than guessing.',
        },
      },
      model: openAiModel('Harrow & Finch OpenAI'),
    },
    match: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForEachItem' } },
    save: airtable({
      operation: 'upsert',
      table: table('Candidates'),
      columns: columns(
        {
          Email: ex(`{{ ${a}.email }}`),
          Name: ex(`{{ ${a}.name }}`),
          Role: ex(`{{ ${a}.role }}`),
          Stage: ex("{{ { strong: 'Strong match', possible: 'To review', not_yet: 'Not yet' }[$json.tier] }}"),
          Score: ex('{{ $json.match_score }}'),
          'Most recent title': ex('{{ $json.most_recent_title }}'),
          Years: ex('{{ $json.years_experience }}'),
        },
        ['Email'],
      ),
      options: {},
    }),
    tier: {
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      parameters: switchParams(
        [
          { key: 'Strong', when: [cond(ex(`{{ ${m}.tier }}`), { type: 'string', operation: 'equals' }, 'strong')] },
          { key: 'Possible', when: [cond(ex(`{{ ${m}.tier }}`), { type: 'string', operation: 'equals' }, 'possible')] },
        ],
        'Not yet',
      ),
    },
    'tell-recruiter': slackUser(ex(`{{ ${m}.recruiter }}`), ex(`Strong match: {{ ${a}.name }} for {{ ${a}.role }}. {{ ${m}.most_recent_title }}, {{ ${m}.years_experience }} years. Score {{ ${m}.match_score }}. They have a booking link now.`)),
    invite: gmail(ex(`{{ ${a}.email }}`), ex(`Your application for {{ ${a}.role }}`), ex(`Hi {{ ${a}.first_name }},\n\nThanks for applying for the {{ ${a}.role }} role. Your background looks like a close fit, and I would like to hear more.\n\nCould you pick a time for a 20-minute call? ${v.calendly_link}\n\n${signoff}`), ex(`{{ ${m}.recruiter }}`)),
    ack: gmail(ex(`{{ ${a}.email }}`), 'We have your application', ex(`Hi {{ ${a}.first_name }},\n\nThanks for applying for the {{ ${a}.role }} role. A recruiter reads every application personally and will be in touch within three business days either way.\n\n${signoff}`), ex(`{{ ${m}.recruiter }}`)),
    pause: { type: 'n8n-nodes-base.wait', typeVersion: 1.1, webhookId: '9a3b5c7d-1e2f-4a6b-8c0d-applywait01', parameters: { amount: 2, unit: 'days' } },
    recheck: airtable({ operation: 'get', table: table('Candidates'), id: ex("{{ $('Save the candidate').item.json.id }}"), options: {} }),
    still: { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: ifParams([cond(ex('{{ $json.fields.Stage }}'), { type: 'string', operation: 'equals' }, 'Not yet')]) },
    decline: gmail(ex(`{{ ${a}.email }}`), ex(`Your application for {{ ${a}.role }}`), ex(`Hi {{ ${a}.first_name }},\n\nThank you for applying for the {{ ${a}.role }} role. This search asks for {{ ${m}.missing.join(' and ') }}, so we will not put you forward for it.\n\nWe place finance and operations roles every week, and your details stay with us. Our open searches are at ${v.careers_page}, and if I have misread your background, just reply.\n\n${signoff}`), ex(`{{ ${m}.recruiter }}`)),
  },

  'screen-booked': {
    calendly: { type: 'n8n-nodes-base.calendlyTrigger', typeVersion: 2, credentialType: 'calendlyOAuth2Api', webhookId: '2e4f6a8b-0c1d-4e3f-9a5b-calendly0001', parameters: { scope: 'organization', events: ['invitee.created', 'invitee.canceled'] } },
    'only-screens': { type: 'n8n-nodes-base.filter', typeVersion: 2.2, parameters: { conditions: conditions([cond(ex('{{ $json.payload.scheduled_event.name }}'), { type: 'string', operation: 'equals' }, 'Screening call')]), options: {} } },
    find: airtable({ operation: 'search', table: table('Candidates'), filterByFormula: ex("LOWER({Email}) = '{{ $json.payload.email.toLowerCase() }}'"), options: {} }),
    known: { type: 'n8n-nodes-base.if', typeVersion: 2.2, parameters: ifParams([cond(ex('{{ $json.id }}'), { type: 'string', operation: 'exists' })], 'and', true) },
    which: {
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      parameters: switchParams([
        { key: 'Booked', when: [cond(ex("{{ $('Booked or cancelled').item.json.event }}"), { type: 'string', operation: 'equals' }, 'invitee.created')] },
        {
          key: 'Cancelled',
          when: [cond(ex("{{ $('Booked or cancelled').item.json.event }}"), { type: 'string', operation: 'equals' }, 'invitee.canceled'), cond(ex(`{{ ${p}.rescheduled === true }}`), { type: 'boolean', operation: 'false' })],
        },
      ]),
    },
    'stage-booked': airtable({ operation: 'update', table: table('Candidates'), columns: columns({ id: ex('{{ $json.id }}'), Stage: 'Screen booked', 'Screen at': ex(`{{ ${p}.scheduled_event.start_time }}`) }, ['id']), options: {} }),
    brief: {
      type: 'n8n-nodes-base.googleDocs',
      typeVersion: 2,
      credentialType: 'googleDocsOAuth2Api',
      parameters: { authentication: 'oAuth2', folderId: '1HarrowFinchBriefsFolder', title: ex("Brief · {{ $json.fields.Name }} · {{ $now.toFormat('MMM d') }}") },
    },
    'brief-text': {
      type: 'n8n-nodes-base.googleDocs',
      typeVersion: 2,
      credentialType: 'googleDocsOAuth2Api',
      parameters: {
        authentication: 'oAuth2',
        operation: 'update',
        documentURL: ex('{{ $json.id }}'),
        actionsUi: {
          actionFields: [
            {
              action: 'insert',
              text: ex(
                `Screening call: {{ $('Find the candidate').item.json.fields.Name }}, {{ $('Find the candidate').item.json.fields.Role }}\nWhen: {{ ${p}.scheduled_event.start_time }}\n\nMost recent title: {{ $('Find the candidate').item.json.fields['Most recent title'] }}\nExperience: {{ $('Find the candidate').item.json.fields.Years }} years\nThey said: {{ ${p}.questions_and_answers[0]?.answer || 'nothing' }}\n\nAsk about: notice period, salary expectations, why now.`,
              ),
            },
          ],
        },
      },
    },
    dm: slackUser(ex(`{{ ${p}.scheduled_event.event_memberships[0].user_email }}`), ex(`Screening call booked: {{ $('Find the candidate').item.json.fields.Name }}, {{ $('Find the candidate').item.json.fields.Role }}. Brief: https://docs.google.com/document/d/{{ $json.documentId }}`)),
    'stage-back': airtable({ operation: 'update', table: table('Candidates'), columns: columns({ id: ex('{{ $json.id }}'), Stage: 'Strong match', 'Screen at': '' }, ['id']), options: {} }),
    rebook: gmail(ex(`{{ ${p}.email }}`), 'Another time for our call?', ex(`Hi {{ ${p}.name.split(' ')[0] }},\n\nNo problem about the call. If you would still like to talk about the {{ $('Find the candidate').item.json.fields.Role }} role, pick any time that suits you: ${v.calendly_link}\n\nIf your plans have changed, a one-line reply is plenty.\n\n{{ $('Find the candidate').item.json.fields.Recruiter }}\nHarrow & Finch Recruiting, Chicago`), 'Harrow & Finch'),
    stranger: {
      type: 'n8n-nodes-base.slack',
      typeVersion: 2.3,
      credentialType: 'slackOAuth2Api',
      parameters: { authentication: 'oAuth2', resource: 'message', operation: 'post', select: 'channel', channelId: rl(v.team_channel, 'name'), text: ex(`{{ ${p}.name }} ({{ ${p}.email }}) booked a screening call, but that email is not in Candidates. Same person under another address, or a referral?`), otherOptions: {} },
    },
  },

  'client-pipeline': {
    schedule: { type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, parameters: { rule: { interval: [{ field: 'cronExpression', expression: '30 7 * * 1' }] } } },
    jobs: airtable({ operation: 'search', table: table('Jobs'), filterByFormula: "{Status} = 'Open'", options: {} }),
    pipeline: airtable({ operation: 'search', table: table('Candidates'), filterByFormula: "OR({Stage} = 'Screen booked', {Stage} = 'Submitted', {Stage} = 'Client interview', {Stage} = 'Offer')", options: {} }),
    combine: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: { mode: 'combine', fieldsToMatchString: 'job_id', joinMode: 'enrichInput1', options: { multipleMatches: 'all' } } },
    group: { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { mode: 'runOnceForAllItems' } },
    send: gmail(ex('{{ $json.contact_email }}'), ex("Your searches with Harrow & Finch, week of {{ $now.toFormat('MMM d') }}"), ex("Hi {{ $json.contact.split(' ')[0] }},\n\nHere is where each of your searches stands this Monday:\n\n{{ $json.body }}\n\nReply to this email with any questions, or to set up a call.\n\nDana Whitlock\nHarrow & Finch Recruiting, Chicago"), 'Dana Whitlock'),
    sent: { type: 'n8n-nodes-base.set', typeVersion: 3.4, parameters: assign([['ok', true, 'boolean'], ['client', ex("{{ $('One report per client').item.json.client }}")]]) },
    unsent: { type: 'n8n-nodes-base.set', typeVersion: 3.4, parameters: assign([['ok', false, 'boolean'], ['client', ex("{{ $('One report per client').item.json.client }}")], ['error', ex('{{ $json.error.message }}')]]) },
    all: { type: 'n8n-nodes-base.merge', typeVersion: 3.2, parameters: {} },
    'tell-dana': slackUser('dana', ex("Monday reports: {{ $('All reports').all().filter(i => i.json.ok).length }} sent{{ $('All reports').all().some(i => !i.json.ok) ? ', not sent: ' + $('All reports').all().filter(i => !i.json.ok).map(i => i.json.client + ' (' + i.json.error + ')').join('; ') : '' }}.")),
  },
};
