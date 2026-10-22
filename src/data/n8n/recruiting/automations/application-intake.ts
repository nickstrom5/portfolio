import type { Automation, Item, Json, RunContext } from '@/lib/n8n/types';
import { item } from '@/lib/n8n/engine';
import { business } from '../business';

const DAY = 1440;
const at = (day: number, h: number, m = 0) => day * DAY + h * 60 + m;
const MS_DAY = 86400000;
const vars = business.env.vars;

export const ROLES = ['Senior Accountant (Naperville, IL)', 'Controller (Milwaukee, WI)', 'Operations Manager (Indianapolis, IN)'];

/** What each search needs, straight from its job posting. */
const REQUIREMENTS: Record<string, { years: number; must: string[]; nice: string[]; recruiter: { name: string; first: string; email: string } }> = {
  'Senior Accountant (Naperville, IL)': { years: 4, must: ['GAAP', 'reconciliations'], nice: ['NetSuite', 'CPA', 'month-end close'], recruiter: { name: 'Marcus Lee', first: 'Marcus', email: 'marcus@harrowfinch.example' } },
  'Controller (Milwaukee, WI)': { years: 8, must: ['CPA'], nice: ['NetSuite', 'audit', 'team leadership'], recruiter: { name: 'Marcus Lee', first: 'Marcus', email: 'marcus@harrowfinch.example' } },
  'Operations Manager (Indianapolis, IN)': { years: 5, must: ['team leadership'], nice: ['lean', 'warehouse', 'ERP'], recruiter: { name: 'Priya Raman', first: 'Priya', email: 'priya@harrowfinch.example' } },
};

/** What the careers page posts: the Webhook node's item. */
export const applicationItem = (b: { name: string; email: string; role: string; location: string; resume: string }): Item =>
  item({
    headers: { host: 'harrowfinch.app.n8n.cloud', 'content-type': 'application/json', 'x-harrowfinch-key': '••••••••' },
    params: {},
    query: {},
    body: b,
    webhookUrl: 'https://harrowfinch.app.n8n.cloud/webhook/apply',
    executionMode: 'production',
  });

/**
 * Stands in for the language model in this simulator: plain keyword rules
 * that fill the same schema the Information Extractor returns. In the real
 * build the model reads the résumé; here anything you paste is read by these
 * rules, so plain words work best.
 */
export function extract(text: string): Json {
  const t = ` ${text} `;
  const has = (re: RegExp) => re.test(t);
  const years = Math.max(0, ...[...t.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)/gi)].map((m) => Number(m[1])));
  const skills = [
    has(/\bGAAP\b/i) && 'GAAP',
    has(/reconcil/i) && 'reconciliations',
    has(/month[- ]end|close process/i) && 'month-end close',
    has(/\baudit/i) && 'audit',
    has(/\blean\b|six sigma|kaizen/i) && 'lean',
    has(/warehouse|distribution|logistics|fulfil/i) && 'warehouse',
    has(/\b(led|managed|supervis\w*|manag\w+ a team|team of \d+)/i) && 'team leadership',
    has(/\bERP\b|NetSuite|SAP\b|Oracle/i) && 'ERP',
  ].filter(Boolean) as string[];
  const tools = ['NetSuite', 'QuickBooks', 'SAP', 'Excel', 'Power BI', 'Oracle'].filter((x) => new RegExp(`\\b${x}\\b`, 'i').test(t));
  const certifications = has(/\bCPA\b/) ? ['CPA'] : [];
  const title = text.match(/^(.{3,60}?)(?: at | \(|,|\n|$)/)?.[1]?.trim() ?? '';
  return { years_experience: years, most_recent_title: title, skills, tools, certifications };
}

/** Same logic as the Code node below, so the simulator scores exactly like the build. */
function match(role: string, x: { years_experience: number; skills: string[]; tools: string[]; certifications: string[] }) {
  const req = REQUIREMENTS[role] ?? REQUIREMENTS[ROLES[0]];
  const have = new Set([...x.skills, ...x.tools, ...x.certifications]);
  const missing = req.must.filter((m) => !have.has(m));
  if (x.years_experience < req.years) missing.unshift(`${req.years}+ years`);
  const nice = req.nice.filter((n) => have.has(n));
  let score = Math.min(40, Math.round((x.years_experience / req.years) * 30));
  score += (req.must.length - req.must.filter((m) => !have.has(m)).length) * Math.round(30 / req.must.length);
  score += nice.length * 10;
  score = Math.min(100, score);
  const tier = missing.length ? 'not_yet' : score >= 70 ? 'strong' : 'possible';
  return { match_score: score, missing, nice_to_haves: nice, tier, recruiter: req.recruiter.name, recruiter_email: req.recruiter.email, recruiter_first: req.recruiter.first };
}

const exampleSchema = `{
  "years_experience": 7,
  "most_recent_title": "Senior Accountant",
  "skills": ["GAAP", "reconciliations", "month-end close"],
  "tools": ["NetSuite", "Excel"],
  "certifications": ["CPA"]
}`;

const systemPrompt = `Extract only job-related facts from the résumé: years of
professional experience in the field, most recent title, skills, software
and certifications. Do not infer or return age, gender, ethnicity, health,
family status or anything else not about the work. If a fact is not in the
text, leave it empty rather than guessing.`;

const matchCode = `// Code node, JavaScript, Mode: Run Once for Each Item.
// $json.output is what the Information Extractor returned. The rules are
// the job posting's own: hard requirements, then nice-to-haves.
const app = $('The application').item.json;
const x = $json.output;
const roles = {
  'Senior Accountant (Naperville, IL)': { years: 4, must: ['GAAP', 'reconciliations'], nice: ['NetSuite', 'CPA', 'month-end close'], recruiter: 'Marcus Lee' },
  'Controller (Milwaukee, WI)': { years: 8, must: ['CPA'], nice: ['NetSuite', 'audit', 'team leadership'], recruiter: 'Marcus Lee' },
  'Operations Manager (Indianapolis, IN)': { years: 5, must: ['team leadership'], nice: ['lean', 'warehouse', 'ERP'], recruiter: 'Priya Raman' },
};
const req = roles[app.role];
const have = new Set([...x.skills, ...x.tools, ...x.certifications]);

const missing = req.must.filter((m) => !have.has(m));
if (x.years_experience < req.years) missing.unshift(\`\${req.years}+ years\`);
const nice = req.nice.filter((n) => have.has(n));

// Experience counts up to 40, each hard requirement met adds its share of
// 30, each nice-to-have 10. The score only orders the queue.
let score = Math.min(40, Math.round((x.years_experience / req.years) * 30));
score += (req.must.length - req.must.filter((m) => !have.has(m)).length) * Math.round(30 / req.must.length);
score += nice.length * 10;
score = Math.min(100, score);

const tier = missing.length ? 'not_yet' : score >= 70 ? 'strong' : 'possible';
return { json: { ...x, match_score: score, missing, nice_to_haves: nice, tier, recruiter: req.recruiter } };`;

const app = (ctx: RunContext) => (ctx.$('The application')[0]?.json ?? {}) as Record<string, string>;
const fit = (ctx: RunContext) => (ctx.$('Match to the role')[0]?.json ?? {}) as Record<string, string | number | string[]>;
const signoff = (f: ReturnType<typeof fit>) => `${f.recruiter}\nHarrow & Finch Recruiting, Chicago`;

export const applicationIntake: Automation = {
  id: 'application-intake',
  number: '01',
  name: 'Application intake',
  kicker: 'AI extraction',
  tagline: 'An application arrives from the careers page. An AI step reads the résumé into a few job-related facts, a Code node checks them against the job posting, Airtable gets the candidate, and the candidate hears back the same day: an invitation to book a call, a real acknowledgment, or, after two days in which a recruiter can step in, a kind no.',
  problem:
    'Each search drew 80 to 200 applications into a shared inbox. Recruiters opened every résumé, typed the good ones into Airtable, and strong candidates often waited a week for a reply, by which time some had taken other offers. Candidates who were not a fit usually heard nothing at all.',
  solution:
    'The careers page posts to an n8n Webhook. Edit Fields tidies the application, and an Information Extractor with an OpenAI chat model turns the résumé into five fields: years, most recent title, skills, tools and certifications, and nothing personal. A Code node compares them with the posting’s hard requirements and nice-to-haves and gives a tier. Airtable creates or updates the candidate by email. A Switch then answers: strong matches get a direct message to the recruiter and an email from them with a Calendly link; possible matches get an honest acknowledgment; candidates missing a hard requirement wait two days, Airtable is checked again in case a recruiter moved them on, and only then do they get a kind no.',
  workflow: {
    name: '01 · Candidates · Application intake',
    folder: 'Harrow & Finch / Candidates',
    tags: ['candidates', 'ai', 'webhook'],
    trigger: {
      id: 'webhook',
      name: 'Application',
      type: 'Webhook',
      operation: 'POST /webhook/apply',
      icon: 'webhook',
      tone: 'trigger',
      summary: 'Called by the careers page’s server when someone applies, with a header secret. Respond: Immediately, with 202, so the candidate sees “thanks, we have it” at once; reading and matching happen after.',
      credential: 'Careers page to n8n (header auth)',
      params: [
        { k: 'HTTP Method', v: 'POST' },
        { k: 'Authentication', v: 'Header Auth' },
        { k: 'Respond', v: 'Immediately · Response Code 202' },
      ],
    },
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Chicago',
      saveFailed: true,
      saveSuccess: true,
      notes: [
        'Timezone America/Chicago, the agency’s, for dates in Airtable and the two-day wait.',
        'Saved executions are kept 30 days. They hold résumés, so they are not kept longer than a search usually lasts; Airtable is the record.',
        'No error workflow in this instance yet: a failure shows in Executions, which Jo checks every morning. Airtable has Retry On Fail because that is the call most likely to blip.',
      ],
    },
    steps: [
      {
        kind: 'node',
        node: {
          id: 'shape',
          name: 'The application',
          type: 'Edit Fields (Set)',
          icon: 'pen',
          tone: 'core',
          summary: 'Name, first name, lowercased email, role, location and résumé text from the request body, and the time it came in. Every later node reads the application from here with $(\'The application\').',
          params: [
            { k: 'email', v: '{{ $json.body.email.trim().toLowerCase() }}' },
            { k: 'first_name', v: "{{ $json.body.name.trim().split(' ')[0] }}" },
            { k: 'resume_text', v: '{{ $json.body.resume }}' },
          ],
          run: (items) => ({
            items: items.map((it) => {
              const b = it.json.body as Record<string, string>;
              const name = b.name.trim();
              return item({ name, first_name: name.split(' ')[0] || 'there', email: b.email.trim().toLowerCase(), role: b.role, location: b.location, resume_text: b.resume });
            }),
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'extract',
          name: 'Read the résumé',
          type: 'Information Extractor',
          operation: 'Model: OpenAI Chat Model (gpt-4.1-mini, temperature 0)',
          icon: 'ai',
          tone: 'ai',
          credential: 'Harrow & Finch OpenAI',
          summary: 'An AI root node with an OpenAI Chat Model sub-node. Schema Type: Generate From JSON Example, so the answer always has the same five fields, under output. The system prompt asks for job-related facts only, and the schema has no place for anything else.',
          params: [
            { k: 'Text', v: '{{ $json.resume_text }}' },
            { k: 'Schema Type', v: 'Generate From JSON Example (below)' },
            { k: 'System Prompt Template', v: 'Job-related facts only (below)' },
          ],
          code: { language: 'json', source: `${exampleSchema}\n\n// System prompt\n${systemPrompt}` },
          run: (items, ctx) => ({
            items: items.map((it) => item({ output: (ctx.fixtures.extracted as Json | undefined) ?? extract(String(it.json.resume_text)) })),
            log: ctx.fixtures.extracted ? 'Five fields extracted.' : 'Five fields extracted. (In this simulator, keyword rules stand in for the model.)',
          }),
        },
      },
      {
        kind: 'node',
        node: {
          id: 'match',
          name: 'Match to the role',
          type: 'Code',
          operation: 'JavaScript · Run Once for Each Item',
          icon: 'code',
          tone: 'core',
          summary: 'Checks the extracted facts against the posting: hard requirements first, then nice-to-haves, and a 0 to 100 score that only orders the queue. Tier strong, possible, or not yet when a hard requirement is missing. Picks the recruiter for the search.',
          code: { language: 'javascript', source: matchCode },
          run: (items, ctx) => {
            const out = items.map((it) => {
              const x = it.json.output as { years_experience: number; skills: string[]; tools: string[]; certifications: string[] };
              return item({ ...x, ...match(app(ctx).role, x) });
            });
            const j = out[0].json;
            return { items: out, log: `Score ${j.match_score}, tier “${j.tier}”${(j.missing as string[]).length ? `, missing ${(j.missing as string[]).join(', ')}` : ''}.` };
          },
        },
      },
      {
        kind: 'node',
        node: {
          id: 'save',
          name: 'Save the candidate',
          type: 'Airtable',
          operation: 'Record › Create or Update',
          icon: 'db',
          tone: 'app',
          credential: 'Harrow & Finch Airtable (token)',
          summary: 'Candidates table, matched on email, so someone who applies to two searches stays one candidate with two applications. Writes the extracted fields, the score, the tier as Stage, and the role.',
          settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
          params: [
            { k: 'Base · Table', v: 'Recruiting · Candidates' },
            { k: 'Columns to match on', v: 'Email' },
            { k: 'Stage', v: "{{ { strong: 'Strong match', possible: 'To review', not_yet: 'Not yet' }[$json.tier] }}" },
          ],
          run: (_items, ctx) => {
            const a = app(ctx);
            const f = fit(ctx);
            const stage = { strong: 'Strong match', possible: 'To review', not_yet: 'Not yet' }[String(f.tier)];
            return { items: [item({ id: String(ctx.fixtures.recordId ?? 'recK8d2Qx7LmP0aZ'), fields: { Name: a.name, Email: a.email, Role: a.role, Stage: stage, Score: f.match_score } })], log: `${ctx.fixtures.existing ? 'Updated' : 'Created'} ${a.name}, Stage “${stage}”.` };
          },
        },
      },
      {
        kind: 'split',
        node: {
          id: 'tier',
          name: 'How close a match?',
          type: 'Switch',
          operation: 'Rules',
          icon: 'switch',
          tone: 'logic',
          summary: 'Reads the tier back from the Code node, since the item here is Airtable’s answer. Fallback Output: Extra Output, named Not yet, so anything unexpected lands where a person double-checks before anyone is declined.',
          params: [
            { k: 'Value', v: "{{ $('Match to the role').item.json.tier }}" },
            { k: 'Rules', v: 'is equal to strong · is equal to possible' },
            { k: 'Fallback Output', v: 'Extra Output (Not yet)' },
          ],
          run: (items, ctx) => {
            const t = String(fit(ctx).tier);
            const i = t === 'strong' ? 0 : t === 'possible' ? 1 : 2;
            return { outputs: [0, 1, 2].map((k) => (k === i ? items : [])) };
          },
        },
        branches: [
          {
            label: 'Strong',
            rule: 'Every hard requirement and a score of 70 or more',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'tell-recruiter',
                  name: 'Tell the recruiter',
                  type: 'Slack',
                  operation: 'Message › Send',
                  icon: 'slack',
                  tone: 'app',
                  credential: 'Harrow & Finch Slack (bot)',
                  summary: 'A direct message to the recruiter for the search, with the extracted facts and the Airtable link, so they can call a standout before the candidate even books.',
                  params: [{ k: 'Send Message To', v: "User · {{ $('Match to the role').item.json.recruiter }}" }],
                  run: (items, ctx) => {
                    const a = app(ctx);
                    const f = fit(ctx);
                    return { items, messages: [{ channel: 'slack', to: `DM to ${f.recruiter}`, subject: `Strong match: ${a.name} for ${a.role}`, body: `${f.most_recent_title || 'Title not given'}, ${f.years_experience} years. ${[...(f.nice_to_haves as string[])].join(', ') || 'No nice-to-haves'}. Score ${f.match_score}. They have a booking link now.` }] };
                  },
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'invite',
                  name: 'Invite to a call',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Harrow & Finch Gmail (OAuth2)',
                  summary: 'From the recruiter’s name, Reply To the recruiter, with the Calendly link for a 20-minute screening call. Plain text, no attribution line.',
                  params: [
                    { k: 'To', v: "{{ $('The application').item.json.email }}" },
                    { k: 'Options', v: 'Sender Name = the recruiter · Reply To = the recruiter · Append n8n Attribution off' },
                  ],
                  run: (items, ctx) => {
                    const a = app(ctx);
                    const f = fit(ctx);
                    return {
                      items,
                      messages: [{ channel: 'email', to: a.email, subject: `Your application for ${a.role.replace(/ \(.*/, '')}`, body: `Hi ${a.first_name},\n\nThanks for applying for the ${a.role} role. Your background looks like a close fit, and I would like to hear more.\n\nCould you pick a time for a 20-minute call? ${vars.calendly_link}\n\n${signoff(f)}` }],
                    };
                  },
                },
              },
            ],
          },
          {
            label: 'Possible',
            rule: 'Every hard requirement, score under 70',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'ack',
                  name: 'Acknowledge',
                  type: 'Gmail',
                  operation: 'Message › Send',
                  icon: 'mail',
                  tone: 'app',
                  credential: 'Harrow & Finch Gmail (OAuth2)',
                  summary: 'An honest “we have it, a recruiter reads every application within three business days”. They sit in the To review view in Airtable, sorted by score.',
                  run: (items, ctx) => {
                    const a = app(ctx);
                    const f = fit(ctx);
                    return { items, messages: [{ channel: 'email', to: a.email, subject: 'We have your application', body: `Hi ${a.first_name},\n\nThanks for applying for the ${a.role} role. ${f.recruiter_first} reads every application personally and will be in touch within three business days either way.\n\n${signoff(f)}` }] };
                  },
                },
              },
            ],
          },
          {
            label: 'Not yet',
            rule: 'Fallback: a hard requirement is missing',
            steps: [
              {
                kind: 'node',
                node: {
                  id: 'pause',
                  name: 'Give a recruiter two days',
                  type: 'Wait',
                  operation: 'Resume: After Time Interval',
                  icon: 'clock',
                  tone: 'flow',
                  summary: 'Nobody is declined by a rule alone. For two days the candidate sits in the Not yet view, where a recruiter can move them to To review; a declined email sent within seconds also reads as automatic, because it is.',
                  wait: { mode: 'interval', ms: 2 * MS_DAY },
                  params: [{ k: 'Wait Amount', v: '2 days' }],
                },
              },
              {
                kind: 'node',
                node: {
                  id: 'recheck',
                  name: 'Check the stage again',
                  type: 'Airtable',
                  operation: 'Record › Get',
                  icon: 'db',
                  tone: 'app',
                  credential: 'Harrow & Finch Airtable (token)',
                  summary: 'Gets the same record by the id Save the candidate returned, to see whether a recruiter changed the Stage during the wait.',
                  settings: { retryOnFail: { maxTries: 3, waitMs: 2000 } },
                  params: [{ k: 'Record ID', v: "{{ $('Save the candidate').item.json.id }}" }],
                  run: (_items, ctx) => ({ items: [item({ id: 'recK8d2Qx7LmP0aZ', fields: { Stage: String(ctx.fixtures.stageLater ?? 'Not yet') } })], log: `Stage is “${ctx.fixtures.stageLater ?? 'Not yet'}”.` }),
                },
              },
              {
                kind: 'split',
                node: {
                  id: 'still',
                  name: 'Still not yet?',
                  type: 'If',
                  icon: 'split',
                  tone: 'logic',
                  summary: 'Stage is equal to Not yet. Anything else means a person has taken it over, and the workflow steps aside.',
                  params: [{ k: 'Condition', v: '{{ $json.fields.Stage }} is equal to Not yet' }],
                  run: (items) => {
                    const yes = (items[0].json.fields as Json).Stage === 'Not yet';
                    return { outputs: yes ? [items, []] : [[], items], log: yes ? 'Nobody changed it.' : 'A recruiter moved them on.' };
                  },
                },
                branches: [
                  {
                    label: 'true',
                    steps: [
                      {
                        kind: 'node',
                        node: {
                          id: 'decline',
                          name: 'A kind no',
                          type: 'Gmail',
                          operation: 'Message › Send',
                          icon: 'mail',
                          tone: 'app',
                          credential: 'Harrow & Finch Gmail (OAuth2)',
                          summary: 'Says which requirement of the posting was missing, so the no is useful, and invites them to other searches. From the recruiter, who can be replied to.',
                          run: (items, ctx) => {
                            const a = app(ctx);
                            const f = fit(ctx);
                            return { items, messages: [{ channel: 'email', to: a.email, subject: `Your application for ${a.role.replace(/ \(.*/, '')}`, body: `Hi ${a.first_name},\n\nThank you for applying for the ${a.role} role. This search asks for ${(f.missing as string[]).join(' and ')}, so we will not put you forward for it.\n\nWe place finance and operations roles every week, and your details stay with us. Our open searches are at ${vars.careers_page}, and if I have misread your background, just reply.\n\n${signoff(f)}` }] };
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
        ],
      },
    ],
  },
  scenarios: [
    {
      id: 'strong',
      label: 'A CPA controller, ten years in',
      summary: 'Elena applies for the Controller search: CPA, ten years, NetSuite, led a team of six. Strong match: Marcus gets a direct message and she has a booking link within seconds.',
      start: at(1, 8, 42),
      input: [applicationItem({ name: 'Elena Kowalski', email: 'Elena.Kowalski@example.com', role: ROLES[1], location: 'Milwaukee, WI', resume: 'Assistant Controller at Lakeshore Foods. CPA. 10 years in accounting, led a team of 6 through a NetSuite migration and two clean audits.' })],
      expect: { status: 'success', visits: ['shape', 'extract', 'match', 'save', 'tier:0', 'tell-recruiter', 'invite'], skips: ['ack', 'pause'] },
    },
    {
      id: 'possible',
      label: 'A senior accountant, no NetSuite',
      summary: 'Tom has the GAAP and reconciliation experience the Naperville search needs, five years of it, but none of the nice-to-haves. Possible: an honest acknowledgment, and he waits in To review for Marcus.',
      start: at(1, 12, 5),
      input: [applicationItem({ name: 'Tom Brennan', email: 'tom.brennan@example.com', role: ROLES[0], location: 'Aurora, IL', resume: 'Staff Accountant at Brennan & Co. 5 years. GAAP financial statements, bank reconciliations, QuickBooks and Excel.' })],
      expect: { status: 'success', visits: ['tier:1', 'ack'], skips: ['invite', 'pause'] },
    },
    {
      id: 'not-yet',
      label: 'No CPA for the Controller role',
      summary: 'Ray has eight years and strong ERP skills but no CPA, which the Controller posting requires. Two days pass, nobody moves him, and he gets a kind no that names the requirement.',
      start: at(2, 19, 30),
      input: [applicationItem({ name: 'Ray Okafor', email: 'ray.okafor@example.com', role: ROLES[1], location: 'Madison, WI', resume: 'Accounting Manager at Badger Supply. 8 years. Month-end close, audit prep, SAP and Excel, managed 3 accountants.' })],
      expect: { status: 'success', visits: ['tier:2', 'pause', 'recheck', 'still:0', 'decline'] },
    },
    {
      id: 'override',
      label: 'A recruiter steps in',
      summary: 'Sam’s résumé never says “led” or “managed”, so the rules miss the team leadership the Operations role needs. Priya reads it the next morning, moves Sam to To review, and the two-day check finds it: no decline goes out.',
      start: at(3, 10, 15),
      input: [applicationItem({ name: 'Sam Whitfield', email: 'sam.whitfield@example.com', role: ROLES[2], location: 'Indianapolis, IN', resume: 'Shift lead at Crossroads Distribution, 7 years in warehouse operations, lean projects, responsible for 40 associates on nights.' })],
      fixtures: { stageLater: 'To review' },
      expect: { status: 'success', visits: ['tier:2', 'recheck', 'still:1'], skips: ['decline'] },
    },
  ],
  dataModel: {
    credentials: [
      { name: 'Careers page to n8n (header auth)', type: 'Header Auth', note: 'The careers page’s server holds the secret; the browser never calls n8n.' },
      { name: 'Harrow & Finch OpenAI', type: 'OpenAI API', note: 'A project key with a monthly budget cap. API data is not used to train OpenAI’s models by default.' },
      { name: 'Harrow & Finch Airtable (token)', type: 'Airtable Personal Access Token', note: 'Scoped to the Recruiting base, records read and write.' },
      { name: 'Harrow & Finch Gmail (OAuth2)', type: 'Gmail OAuth2', note: 'Sends as careers@harrowfinch.example with each recruiter’s name.' },
      { name: 'Harrow & Finch Slack (bot)', type: 'Slack OAuth2', note: 'Direct messages to recruiters.' },
    ],
    fields: [
      { name: 'years_experience, most_recent_title, skills, tools, certifications', where: 'Information Extractor output', type: 'JSON', note: 'Job-related facts only; the schema has no other fields' },
      { name: 'Email', where: 'Airtable: Candidates', type: 'Email', note: 'The upsert key' },
      { name: 'Stage', where: 'Airtable: Candidates', type: 'Single select', note: 'Strong match, To review, Not yet, then the recruiters’ own stages' },
      { name: 'Score', where: 'Airtable: Candidates', type: 'Number', note: 'Orders the To review view; never decides on its own' },
    ],
    variables: [{ key: 'calendly_link', value: vars.calendly_link }],
  },
  build: [
    { title: 'Answer the candidate first', body: 'The Webhook responds Immediately with 202, so the careers page can say “thanks, we have it” before anything else runs.' },
    { title: 'Let the AI read, not decide', body: 'An Information Extractor turns free-form résumés into five fields, with Generate From JSON Example so the shape never changes and temperature 0 so the same résumé reads the same way twice. The system prompt and the schema keep it to job-related facts.' },
    { title: 'Rules from the posting, in one place', body: 'A Code node holds each search’s hard requirements and nice-to-haves, copied from the job posting. A recruiter changing a posting changes one object here. The score only orders the review queue.' },
    { title: 'One candidate, many applications', body: 'Airtable Create or Update matches on email, so a candidate who applies to two searches is one record. Retry On Fail covers Airtable’s occasional 429.' },
    { title: 'A person can always step in', body: 'Candidates missing a hard requirement wait two days in a Not yet view. The workflow then gets the record again and only declines if nobody changed the Stage. Every decline names the requirement, so it is useful to the candidate.' },
    { title: 'Test with real, anonymized résumés', body: 'Forty past applications, with names and contact details removed, were pinned on the trigger and run through a copy. Recruiters compared the tiers with their own calls before the workflow was published.' },
  ],
  edgeCases: [
    { title: 'The model misreads a résumé', body: 'It can only fill five job-related fields, and nobody is declined for two days, as the “recruiter steps in” test event shows. The Not yet view is short enough to skim each morning.' },
    { title: 'AI in hiring and the law', body: 'Illinois amended its Human Rights Act to cover AI used in employment decisions, including telling people about it, from January 2026. The careers page says an AI step reads applications and that a recruiter reviews them, and no candidate is turned down without a person able to stop it.' },
    { title: 'The same person applies twice', body: 'Create or Update keeps one record, the second application updates the role and score, and they get one email per application, which is what they asked for.' },
    { title: 'A résumé in another language', body: 'The model reads it and returns the same English fields. The simulator’s keyword rules do not, which is one of the differences between them.' },
    { title: 'OpenAI is slow or down', body: 'The execution fails at Read the résumé and is saved as Error, with the application in it. Jo retries it from the failed node once OpenAI is back; the candidate already has their thank-you.' },
  ],
  qa: [
    'Forty anonymized past applications as pinned data: tiers agreed with the recruiters’ own calls on 37, and the three that did not were read together',
    'Extractor output on every pinned résumé holds only the five schema fields',
    'Same email, two searches: one Airtable record, two emails',
    'Wait shortened to 2 minutes in a copy: a Stage changed during the wait stops the decline',
    'Every email reads right in Gmail and Outlook, with the recruiter as sender and Reply To',
  ],
  snippets: [
    { title: 'Match to the role (Code node)', language: 'javascript', code: matchCode, note: 'Run Once for Each Item. $json.output is the Information Extractor’s answer; the application comes from $(\'The application\').' },
    { title: 'Extraction schema and system prompt', language: 'text', code: `${exampleSchema}\n\n${systemPrompt}`, note: 'Schema Type: Generate From JSON Example. Values are ignored; the names and types become the schema.' },
  ],
  features: ['Webhook (Respond Immediately)', 'Header Auth', 'Edit Fields (Set)', 'Information Extractor', 'OpenAI Chat Model', 'Code', 'Airtable (upsert)', 'Retry On Fail', 'Switch with fallback', 'Wait (time interval)', 'If', 'Gmail', 'Slack'],
};
