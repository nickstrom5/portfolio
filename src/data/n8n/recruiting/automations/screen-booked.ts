import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const vars = business.env.vars;

/** A Calendly webhook delivery, trimmed to what this workflow reads. */
function calendly(o: { event: 'invitee.created' | 'invitee.canceled'; name: string; email: string; type?: string; start: string; host: string; note?: string }): Item {
  return item({
    event: o.event,
    created_at: '2026-03-03T14:02:11.000000Z',
    payload: {
      name: o.name,
      email: o.email,
      status: o.event === 'invitee.created' ? 'active' : 'canceled',
      scheduled_event: { name: o.type ?? 'Screening call', start_time: o.start, event_memberships: [{ user_email: o.host }] },
      questions_and_answers: o.note ? [{ question: 'Anything we should know before the call?', answer: o.note }] : [],
      reschedule_url: 'https://calendly.example/reschedulings/AB12CD',
    },
  });
}

/** A Candidates record as Airtable returns it. */
const candidate = (f: Json): Json => ({ id: 'recK8d2Qx7LmP0aZ', createdTime: '2026-03-02T14:42:09.000Z', fields: f });

const p = (ctx: RunContext) => (ctx.$('Booked or cancelled')[0]?.json.payload ?? {}) as { name: string; email: string; scheduled_event: { start_time: string; name: string }; questions_and_answers: { answer: string }[] };
const rec = (ctx: RunContext) => ((ctx.$('Find the candidate')[0]?.json.fields ?? {}) as Record<string, string | number | string[]>);
/** "Wed, Mar 4 at 9:00 AM" from Calendly's UTC start time, in Chicago time (UTC-6 in the sample week). */
const when = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 6 * 3600000);
  const h = d.getUTCHours();
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCDate()} at ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const briefText = `Screening call: {{ $json.fields.Name }}, {{ $json.fields.Role }}
When: {{ $('Booked or cancelled').item.json.payload.scheduled_event.start_time }}

Most recent title: {{ $json.fields['Most recent title'] }}
Experience: {{ $json.fields.Years }} years
Has: {{ $json.fields.Skills.join(', ') }}
Missing from the posting: {{ $json.fields.Missing || 'nothing' }}
They said: {{ $('Booked or cancelled').item.json.payload.questions_and_answers[0]?.answer || 'nothing' }}

Ask about: notice period, salary expectations, why now.`;

export const screenBooked: Automation = {
  id: 'screen-booked',
  number: '02',
  name: 'Screening call booked',
  kicker: 'Scheduling',
  tagline: 'When a candidate books or cancels a screening call in Calendly, Airtable’s stage follows, the recruiter gets a one-page brief in Google Docs before the call, and a cancellation gets a friendly rebooking link instead of silence.',
  problem:
    'Calendly put calls on recruiters’ calendars, but Airtable never knew. Stages went stale, recruiters opened three tabs to prepare for each call, and a candidate who cancelled was often never contacted again.',
  solution:
    'The Calendly Trigger fires on two events, booked and cancelled. A Filter keeps screening calls only, since recruiters book client meetings through Calendly too. Airtable finds the candidate by email, with Always Output Data on so a stranger still produces an item, and an If sends unknown bookers to the team channel. For candidates on file, a Switch on the event takes over. Booked: Airtable moves the stage, Google Docs gets a brief built from the record and the candidate’s own note, and the recruiter gets a direct message with the link. Cancelled: the stage goes back to Strong match and the candidate gets their rebooking link.',
  workflow: {
    name: '02 · Candidates · Screening call booked',
    folder: 'Harrow & Finch / Candidates',
    tags: ['candidates', 'calendly'],
    trigger: {
      id: 'calendly',
      name: 'Booked or cancelled',
      type: 'Calendly Trigger',
      operation: 'Events: Event Created, Event Canceled',
      icon: 'clock',
      tone: 'trigger',
      summary: 'n8n registers a Calendly webhook for both events when the workflow is published. One workflow for both keeps the lookup in one place; the Switch further down tells them apart by the event field.',
      credential: 'Harrow & Finch Calendly (OAuth2)',
      params: [{ k: 'Events', v: 'Event Created · Event Canceled' }],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'Timezone America/Chicago. Calendly sends start times in UTC; the brief and the messages show them in the agency’s time.',
        'Every recruiter’s Calendly events reach this workflow, so the Filter right after the trigger does the most important job: client meetings never touch candidate records.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'only-screens',
          name: 'Screening calls only',
          type: 'Filter',
          icon: 'filter',
          tone: 'logic',
          summary: 'Event type name is Screening call. A client meeting or an intake call leaves here, and nothing after it runs.',
          params: [{ k: 'Conditions', v: '{{ $json.payload.scheduled_event.name }} is equal to Screening call' }],
          run: (items) => {
            const out = items.filter((it) => ((it.json.payload as Json).scheduled_event as Json).name === 'Screening call');
            return { items: out, log: out.length ? 'A screening call.' : 'Not a screening call: dropped.' };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'find',
          name: 'Find the candidate',
          type: 'Airtable',
          operation: 'Record › Search',
          icon: 'db',
          tone: 'app',
          credential: 'Harrow & Finch Airtable (token)',
          summary: 'Filter By Formula on the lowercased email, the same key 01 upserts on. Always Output Data on, so “nobody found” is still an item and the If below can say so.',
          settings: { alwaysOutputData: true, retryOnFail: { maxTries: 3, waitMs: 2000 } },
          params: [
            { k: 'Table', v: 'Candidates' },
            { k: 'Filter By Formula', v: "LOWER({Email}) = '{{ $json.payload.email.toLowerCase() }}'" },
          ],
          run: (_items, ctx) => {
            const r = ctx.fixtures.record as Json | undefined;
            return r ? { items: [item(r)], log: `Found ${(r.fields as Json).Name}.` } : { items: [item({})], log: 'No match. Always Output Data sends one empty item on.' };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'known',
          name: 'On file?',
          type: 'If',
          icon: 'split',
          tone: 'logic',
          summary: 'True when the search returned a record id.',
          params: [{ k: 'Condition', v: '{{ $json.id }} exists' }],
          run: (items) => ({ outputs: items[0].json.id ? [items, []] : [[], items] }),
        },
        branches: [
          {
            label: 'true',
            steps: [
              {
                kind: 'split',
                node: {
                  id: 'which',
                  name: 'Booked or cancelled?',
                  type: 'Switch',
                  operation: 'Rules',
                  icon: 'switch',
                  tone: 'logic',
                  summary: 'On the trigger’s event field, read back with $() because the item here is the Airtable record. A reschedule arrives as a cancellation with rescheduled true, followed by a new booking; the second rule skips it, so only the booking counts.',
                  params: [
                    { k: 'Value', v: "{{ $('Booked or cancelled').item.json.event }}" },
                    { k: 'Rules', v: 'is equal to invitee.created · is equal to invitee.canceled AND payload.rescheduled is false' },
                  ],
                  run: (items, ctx) => {
                    const e = ctx.$('Booked or cancelled')[0].json.event;
                    return { outputs: e === 'invitee.created' ? [items, []] : [[], items], log: String(e) };
                  },
                },
                branches: [
                  {
                    label: 'Booked',
                    rule: 'invitee.created',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'stage-booked',
                          name: 'Stage: Screen booked',
                          type: 'Airtable',
                          operation: 'Record › Update',
                          icon: 'db',
                          tone: 'app',
                          credential: 'Harrow & Finch Airtable (token)',
                          summary: 'Stage Screen booked and the call’s start time, so the pipeline view and 03’s Monday report are right without anyone touching Airtable.',
                          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                          params: [
                            { k: 'Record ID', v: '{{ $json.id }}' },
                            { k: 'Fields', v: "Stage = Screen booked · Screen at = {{ $('Booked or cancelled').item.json.payload.scheduled_event.start_time }}" },
                          ],
                          run: (items) => ({ items: items.map((it) => item({ id: it.json.id, fields: { ...(it.json.fields as Json), Stage: 'Screen booked' } })) }),
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'brief',
                          name: 'Start the brief',
                          type: 'Google Docs',
                          operation: 'Document › Create',
                          icon: 'pen',
                          tone: 'app',
                          credential: 'Harrow & Finch Google (OAuth2)',
                          summary: 'Creates an empty document in the Briefs folder, named after the candidate and the date. Create only makes the file; the next node writes into it.',
                          params: [
                            { k: 'Folder', v: 'Briefs' },
                            { k: 'Title', v: "Brief · {{ $json.fields.Name }} · {{ $now.toFormat('MMM d') }}" },
                          ],
                          run: (_items, ctx) => {
                            const r = rec(ctx);
                            return { items: [item({ id: '1hF3vB9qL2xR8mKa', name: `Brief · ${r.Name}` })], log: `Document for ${r.Name}.` };
                          },
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'brief-text',
                          name: 'Write the brief',
                          type: 'Google Docs',
                          operation: 'Document › Update',
                          icon: 'pen',
                          tone: 'app',
                          credential: 'Harrow & Finch Google (OAuth2)',
                          summary: 'Inserts the brief, built from the Airtable record and the candidate’s own Calendly answer, into the document just created.',
                          params: [
                            { k: 'Doc ID or URL', v: '{{ $json.id }}' },
                            { k: 'Actions', v: 'Insert text (below)' },
                          ],
                          code: { language: 'text', source: briefText },
                          run: (items) => ({ items: items.map((it) => item({ documentId: it.json.id, url: `https://docs.google.com/document/d/${it.json.id}` })) }),
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'dm',
                          name: 'Send the recruiter the brief',
                          type: 'Slack',
                          operation: 'Message › Send',
                          icon: 'slack',
                          tone: 'app',
                          credential: 'Harrow & Finch Slack (bot)',
                          summary: 'A direct message to the recruiter hosting the call, with the time and the brief, which is everything they need to prepare in one click.',
                          params: [{ k: 'Send Message To', v: "User · {{ $('Booked or cancelled').item.json.payload.scheduled_event.event_memberships[0].user_email }}" }],
                          run: (items, ctx) => {
                            const r = rec(ctx);
                            const pl = p(ctx);
                            const note = pl.questions_and_answers[0]?.answer;
                            return { items, messages: [{ channel: 'slack', to: `DM to ${r.Recruiter}`, subject: `Screening call booked: ${r.Name}`, body: `${when(pl.scheduled_event.start_time)}, ${r.Role}.\n${r['Most recent title']}, ${r.Years} years.${note ? `\nThey wrote: “${note}”` : ''}\nBrief: ${items[0].json.url}` }] };
                          },
                        },
                      },
                    ],
                  },
                  {
                    label: 'Cancelled',
                    rule: 'invitee.canceled, and not a reschedule',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'stage-back',
                          name: 'Stage: back to Strong match',
                          type: 'Airtable',
                          operation: 'Record › Update',
                          icon: 'db',
                          tone: 'app',
                          credential: 'Harrow & Finch Airtable (token)',
                          summary: 'Puts the stage back and clears the call time, so the candidate is in the recruiter’s Strong match view again.',
                          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                          params: [{ k: 'Fields', v: 'Stage = Strong match · Screen at = (empty)' }],
                          run: (items) => ({ items: items.map((it) => item({ id: it.json.id, fields: { ...(it.json.fields as Json), Stage: 'Strong match' } })) }),
                        },
                      },
                      {
                        kind: 'node',
                        node: {
                          id: 'rebook',
                          name: 'Offer another time',
                          type: 'Gmail',
                          operation: 'Message › Send',
                          icon: 'mail',
                          tone: 'app',
                          credential: 'Harrow & Finch Gmail (OAuth2)',
                          summary: 'A short, warm note from the recruiter with the booking link again. No pressure, and a reply reaches a person.',
                          run: (items, ctx) => {
                            const r = rec(ctx);
                            const pl = p(ctx);
                            return { items, messages: [{ channel: 'email', to: pl.email, subject: 'Another time for our call?', body: `Hi ${pl.name.split(' ')[0]},\n\nNo problem about the call. If you would still like to talk about the ${r.Role} role, pick any time that suits you: ${vars.calendly_link}\n\nIf your plans have changed, a one-line reply is plenty.\n\n${r.Recruiter}\nHarrow & Finch Recruiting, Chicago` }] };
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
                  id: 'stranger',
                  name: 'Flag an unknown booking',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Harrow & Finch Slack (bot)',
                  summary: 'Someone booked a screening call with an email that is not in Airtable: usually a candidate using a personal address, or a referral who got the link from a friend. #recruiting decides; nothing is created automatically.',
                  params: [{ k: 'Channel', v: vars.team_channel }],
                  run: (items, ctx) => {
                    const pl = p(ctx);
                    return { items, messages: [{ channel: 'slack', to: vars.team_channel, body: `${pl.name} (${pl.email}) booked a screening call for ${when(pl.scheduled_event.start_time)}, but that email is not in Candidates. Same person under another address, or a referral?` }] };
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
      id: 'booked',
      label: 'Elena books her call',
      summary: 'Elena, the strong match from 01, books Wednesday at 9 AM and mentions a 30-day notice period. Airtable moves her to Screen booked, a brief is written, and Marcus has it in Slack a second later.',
      start: at(1, 8, 2),
      input: [calendly({ event: 'invitee.created', name: 'Elena Kowalski', email: 'elena.kowalski@example.com', start: '2026-03-04T15:00:00.000000Z', host: 'marcus@harrowfinch.example', note: 'Happy where I am, but open to it. 30-day notice.' })],
      fixtures: { record: candidate({ Name: 'Elena Kowalski', Email: 'elena.kowalski@example.com', Role: 'Controller (Milwaukee, WI)', Stage: 'Strong match', 'Most recent title': 'Assistant Controller', Years: 10, Skills: ['CPA', 'NetSuite', 'audit', 'team leadership'], Recruiter: 'Marcus Lee' }) },
      expect: { status: 'success', visits: ['only-screens', 'find', 'known:0', 'which:0', 'stage-booked', 'brief', 'brief-text', 'dm'], skips: ['stage-back', 'stranger'] },
    },
    {
      id: 'cancelled',
      label: 'A candidate cancels',
      summary: 'Tom cancels Thursday’s call the night before. His stage goes back to Strong match and he gets a friendly note with the booking link.',
      start: at(2, 21, 14),
      input: [calendly({ event: 'invitee.canceled', name: 'Tom Brennan', email: 'tom.brennan@example.com', start: '2026-03-05T16:30:00.000000Z', host: 'marcus@harrowfinch.example' })],
      fixtures: { record: candidate({ Name: 'Tom Brennan', Email: 'tom.brennan@example.com', Role: 'Senior Accountant (Naperville, IL)', Stage: 'Screen booked', 'Most recent title': 'Staff Accountant', Years: 5, Skills: ['GAAP', 'reconciliations'], Recruiter: 'Marcus Lee' }) },
      expect: { status: 'success', visits: ['which:1', 'stage-back', 'rebook'], skips: ['brief'] },
    },
    {
      id: 'stranger',
      label: 'An email Airtable does not know',
      summary: 'Someone books with a personal Gmail address that is not on any application. The search finds nothing, and #recruiting gets a note to match them up by hand.',
      start: at(3, 11, 40),
      input: [calendly({ event: 'invitee.created', name: 'Sam Whitfield', email: 'samw.ops@example.net', start: '2026-03-06T19:00:00.000000Z', host: 'priya@harrowfinch.example' })],
      expect: { status: 'success', visits: ['find', 'known:1', 'stranger'], skips: ['which'] },
    },
    {
      id: 'client-meeting',
      label: 'A client meeting, not a screen',
      summary: 'Dana books an intake call with a new client through the same Calendly account. The Filter drops it, and no candidate record is touched.',
      start: at(0, 15, 20),
      input: [calendly({ event: 'invitee.created', name: 'Jordan Pike', email: 'jordan@lakeshorefoods.example', type: 'New search intake', start: '2026-03-03T17:00:00.000000Z', host: 'dana@harrowfinch.example' })],
      expect: { status: 'success', visits: ['only-screens'], skips: ['find'], items: { 'only-screens': 0 } },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Harrow & Finch Calendly (OAuth2)', type: 'Calendly OAuth2', note: 'Connected by the organization owner, so every recruiter’s events are covered.' },
      { name: 'Harrow & Finch Airtable (token)', type: 'Airtable Personal Access Token', note: 'Same token as 01.' },
      { name: 'Harrow & Finch Google (OAuth2)', type: 'Google Docs OAuth2', note: 'Writes to the shared Briefs folder only.' },
      { name: 'Harrow & Finch Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Sends as careers@ with the recruiter’s name.' },
      { name: 'Harrow & Finch Slack (bot)', type: 'Slack OAuth2', note: 'Direct messages and #recruiting.' },
    ],
    fields: [
      { name: 'event', where: 'Calendly webhook', type: 'Text', note: 'invitee.created or invitee.canceled' },
      { name: 'payload.scheduled_event.name', where: 'Calendly webhook', type: 'Text', note: 'The event type; the Filter keeps Screening call' },
      { name: 'Stage, Screen at', where: 'Airtable: Candidates', type: 'Single select, Date', note: 'Moved here and read by 03' },
    ],
  },
  build: [
    { title: 'One trigger, two events', body: 'The Calendly Trigger listens for Event Created and Event Canceled together. The lookup is the same for both, so it is built once, and a Switch on the event field splits them afterwards.' },
    { title: 'Filter first', body: 'Every recruiter’s Calendly events arrive, client meetings included. A Filter on the event type name is the first node, so nothing else can act on a meeting that is not a screen.' },
    { title: 'Look up, and say so when it fails', body: 'Airtable Search with a formula on the lowercased email. Always Output Data on, because without it an unknown email means no items, nothing runs, and nobody hears about a candidate who booked a call.' },
    { title: 'A brief, not a profile', body: 'One Google Docs node creates the document and a second inserts the text, from the Airtable record and the candidate’s own Calendly answer. The recruiter gets one link in Slack.' },
    { title: 'Cancellations are a second chance', body: 'The stage goes back to Strong match and the candidate gets the booking link once more, from the recruiter, with an easy way to say no.' },
  ],
  edgeCases: [
    { title: 'The candidate reschedules', body: 'Calendly reports a reschedule as a cancellation with rescheduled set to true, then a new booking. The cancellation matches neither Switch rule and stops there; the new booking moves the stage and sends a fresh brief.' },
    { title: 'Two candidates share an email', body: 'They cannot: 01 upserts on email. A couple applying from one shared inbox would be one record, which a recruiter splits by hand.' },
    { title: 'Calendly’s webhook stops', body: 'If the Calendly connection is revoked, the webhook stops arriving and nothing fails visibly. Jo’s weekly check compares Calendly’s screening calls with Screen booked stages; a mismatch means reconnecting the credential and publishing again.' },
    { title: 'A booking with the wrong recruiter', body: 'The direct message goes to whoever hosts the call in Calendly, not to the recruiter on the record, because that is who will be on the phone.' },
  ],
  qa: [
    'Booking and cancelling a test call: one execution each, stage moved and moved back',
    'A client meeting through the same account: dropped by the Filter, no record touched',
    'An unknown email: one #recruiting post, no record created',
    'The brief’s document holds every field, with the call time in Chicago time',
    'Reschedule in Calendly: no “another time?” email',
  ],
  snippets: [{ title: 'Brief text (Google Docs Update)', language: 'text', code: briefText, note: 'Inserted into the document the Create node made. Field names are the Airtable columns.' }],
  features: ['Calendly Trigger', 'Filter', 'Airtable search', 'Always Output Data', 'If', 'Switch', 'Airtable update', 'Google Docs', 'Gmail', 'Slack', 'Retry On Fail'],
};
