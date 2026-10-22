/** 02 · Stage changes: moving a card on the Pipeline sends the email that stage needs, and a placement becomes an invoice. */
import type { Action, Automation, Ctx } from '@/lib/airtable/types';
import { fx, shortDate } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;
const cand = (c: Ctx) => c.record('Candidates', (T(c).get('Candidate') as string[])[0]);
const role = (c: Ctx) => c.record('Roles', (T(c).get('Role') as string[])[0]);
const first = (c: Ctx) => cand(c).name.split(' ')[0];

const email = (id: string, title: string, summary: string, to: string, subject: string, make: (c: Ctx) => { to: string; subject: string; body: string }): Action => ({
  kind: 'action',
  id,
  type: 'Send email',
  title,
  summary,
  params: [
    { k: 'To', v: to },
    { k: 'From name', v: 'Larkspur Talent' },
    { k: 'Reply to', v: '{Trigger › Recruiter › Email}' },
    { k: 'Subject', v: subject },
  ],
  run: (c) => ({ messages: [{ channel: 'email', ...make(c) }] }),
});

export const stageChange: Automation = {
  id: 'stage-change',
  number: '02',
  name: 'Stage changes',
  kicker: 'Card moved → the right email',
  tagline: 'Recruiters move cards; the automation writes the emails. A placement turns into a fee and an invoice request the same minute.',
  problem: 'Every stage meant an email typed from scratch: a call invitation, a candidate summary for the client, a polite no. Some went out late, some never. Placements were invoiced when Leo noticed them, and fees were worked out by hand from the client agreement.',
  solution: 'One automation watches the Stage field, and its one conditional group has a branch for each move that needs something: Screen sends the candidate the recruiter’s booking link; Client interview sends the client contact a short summary; Placed creates the placement record, whose fee is computed from the offer and the client’s rate, and emails Leo to invoice it; Rejected sends the standard decline only when the recruiter ticked Send decline.',
  trigger: {
    type: 'When a record is updated',
    table: 'Applications',
    summary: 'Fires each time an application’s Stage changes, from the Pipeline interface or the grid. Edits to other fields do not start it.',
    params: [
      { k: 'Table', v: 'Applications' },
      { k: 'Fields', v: 'Stage' },
    ],
    watch: ['Stage'],
  },
  steps: [
    {
      kind: 'if',
      id: 'g-stage',
      branches: [
        {
          name: 'Screen',
          when: 'Trigger › Stage is Screen',
          test: (c) => T(c).get('Stage') === 'Screen',
          steps: [
            email('screen-email', 'Invite the candidate to a call', 'With the recruiter’s own booking link.', '{Trigger › Candidate email}', 'A quick call about {Trigger › Role}?', (c) => {
              const r = role(c).text('Recruiter');
              return {
                to: fx.str(T(c).get('Candidate email')),
                subject: `A quick call about ${role(c).name}?`,
                body: `Hi ${first(c)},\n\nThanks for your application for ${role(c).name}. I’d like to set up a 20-minute call to hear more about what you’re looking for. Pick any time that suits you here: larkspurtalent.example/book/${r.split(' ')[0].toLowerCase()}\n\n${r}\nLarkspur Talent`,
              };
            }),
          ],
        },
        {
          name: 'Client interview',
          when: 'Trigger › Stage is Client interview',
          test: (c) => T(c).get('Stage') === 'Client interview',
          steps: [
            email('client-email', 'Introduce the candidate to the client', 'A short summary; the resume follows from the recruiter.', '{Trigger › Client contact email}', 'Candidate for {Trigger › Role}: {Trigger › Candidate}', (c) => {
              const cl = c.record('Clients', (role(c).get('Client') as string[])[0]);
              return {
                to: fx.str(T(c).get('Client contact email')),
                subject: `Candidate for ${role(c).name}: ${cand(c).name}`,
                body: `Hi ${cl.text('Contact name').split(' ')[0]},\n\nI’d like you to meet ${cand(c).name} for the ${role(c).text('Role').split(' · ')[0]} role.${T(c).text('LinkedIn') ? ` Profile: ${T(c).text('LinkedIn')}` : ''}\n\n${role(c).text('Recruiter')} will send the resume and our screening notes separately today, with times that work for ${first(c)} next week.\n\nLarkspur Talent`,
              };
            }),
          ],
        },
        {
          name: 'Placed',
          when: 'Trigger › Stage is Placed',
          test: (c) => T(c).get('Stage') === 'Placed',
          steps: [
            {
              kind: 'action',
              id: 'create-placement',
              type: 'Create record',
              title: 'Create the placement',
              summary: 'Its salary, fee rate and fee are computed from the links.',
              params: [
                { k: 'Table', v: 'Placements' },
                { k: 'Application', v: '{Trigger › Airtable record ID}' },
                { k: 'Start date', v: '{Trigger › Start date}' },
                { k: 'Invoice status', v: 'To invoice' },
              ],
              run: (c) => ({ create: [{ table: 'Placements', fields: { Application: [T(c).id], 'Start date': T(c).get('Start date'), 'Invoice status': 'To invoice' } }] }),
            },
            email('billing-email', 'Ask Leo to invoice', 'Quotes the fee from the new placement record.', 'leo@larkspurtalent.example', 'Invoice: {Create record › Placement}', (c) => {
              const p = c.record('Placements', c.out('create-placement').record as string);
              return {
                to: c.email('Leo Marsh'),
                subject: `Invoice: ${p.name}`,
                body: `${p.name} is placed.\n\nSalary: ${p.text('Salary')}\nFee rate: ${p.text('Fee %')}\nFee: ${p.text('Fee')}\nStart date: ${shortDate(p.get('Start date'))}\nGuarantee ends: ${shortDate(p.get('Guarantee ends'))}\n\nIt is in the To invoice list on the Billing dashboard.`,
              };
            }),
          ],
        },
        {
          name: 'Rejected, decline wanted',
          when: 'Trigger › Stage is Rejected · and Trigger › Send decline is checked',
          test: (c) => T(c).get('Stage') === 'Rejected' && !!T(c).get('Send decline'),
          steps: [
            email('decline-email', 'Send the standard decline', 'Kind, short, and sent only when asked for.', '{Trigger › Candidate email}', 'Your application for {Trigger › Role}', (c) => ({
              to: fx.str(T(c).get('Candidate email')),
              subject: `Your application for ${role(c).name}`,
              body: `Hi ${first(c)},\n\nThank you for your time on ${role(c).name}. The client has decided to go ahead with other candidates. We keep your details on file and will be in touch when a role fits your background.\n\n${role(c).text('Recruiter')}\nLarkspur Talent`,
            })),
          ],
        },
      ],
    },
  ],
  notify: 'Leo Marsh',
  scenarios: [
    {
      id: 'screen',
      label: 'Applied → Screen',
      summary: 'Nadia moves Malik to Screen: he gets her booking link.',
      start: 555,
      setup: { by: 'Nadia drags Malik’s card to Screen on the Pipeline page', update: [{ table: 'Applications', id: 'recAppMalik', fields: { Stage: 'Screen' } }] },
      record: 'recAppMalik',
      expect: { status: 'success', visits: ['screen-email', 'g-stage:0'], emails: 1 },
    },
    {
      id: 'interview',
      label: 'Screen → Client interview',
      summary: 'Helen goes forward: Ridgeway’s contact gets a short introduction.',
      start: 1440 + 840,
      setup: { by: 'Nadia moves Helen to Client interview', update: [{ table: 'Applications', id: 'recAppHelen', fields: { Stage: 'Client interview' } }] },
      record: 'recAppHelen',
      expect: { status: 'success', visits: ['client-email', 'g-stage:1'], emails: 1 },
    },
    {
      id: 'placed',
      label: 'Offer → Placed',
      summary: 'Theo accepts: the placement is created with a $28,160 fee and Leo is asked to invoice.',
      start: 2 * 1440 + 1000,
      setup: { by: 'Owen moves Theo to Placed', update: [{ table: 'Applications', id: 'recAppTheo', fields: { Stage: 'Placed' } }] },
      record: 'recAppTheo',
      expect: { status: 'success', visits: ['create-placement', 'billing-email', 'g-stage:2'], emails: 1 },
    },
    {
      id: 'declined',
      label: 'Rejected, with the decline email',
      summary: 'Copper Range passes on Ruth; Nadia ticks Send decline as she moves the card.',
      start: 3 * 1440 + 690,
      setup: { by: 'Nadia ticks Send decline and moves Ruth to Rejected', update: [{ table: 'Applications', id: 'recAppRuth', fields: { 'Send decline': true, Stage: 'Rejected' } }] },
      record: 'recAppRuth',
      expect: { status: 'success', visits: ['decline-email', 'g-stage:3'], emails: 1 },
    },
    {
      id: 'quiet-reject',
      label: 'Rejected after a phone call',
      summary: 'Owen already called Dan, so Send decline stays unticked and nothing is sent.',
      start: 3 * 1440 + 900,
      setup: { by: 'Owen moves Dan to Rejected', update: [{ table: 'Applications', id: 'recAppDan', fields: { Stage: 'Rejected' } }] },
      record: 'recAppDan',
      expect: { status: 'success', visits: ['g-stage:none'], skips: ['decline-email'], emails: 0 },
    },
  ],
  fields: [
    { table: 'Applications', field: 'Stage', use: 'The only field the trigger watches.' },
    { table: 'Applications', field: 'Send decline', use: 'Second condition on the decline group.' },
    { table: 'Applications', field: 'Candidate email, Client contact email, Recruiter', use: 'Lookups through Candidate and Role, used as recipients and reply-to.' },
    { table: 'Placements', field: 'Salary, Fee %, Fee', use: 'Rollups through Application and a formula; quoted to Leo.' },
    { table: 'Clients', field: 'Fees placed', use: 'Rises as soon as the placement exists, through three rollups.' },
  ],
  build: [
    { title: 'Updated, watching one field', body: '“When a record is updated” with Stage as its only watched field fires on every stage move and ignores note edits. Matches conditions would need one automation per stage; this keeps the whole pipeline in one place.' },
    { title: 'One group, a branch per stage that needs something', body: 'Screen, Client interview, Placed, and Rejected with Send decline ticked. Applied, Offer and moves backwards match no branch, and with no Otherwise the run ends quietly. Stage has one value, so at most one branch can match anyway.' },
    { title: 'The fee is never typed', body: 'Placements › Fee is Salary × Fee %, where both are rollups through the application, and Fee % comes from the client’s agreement through two lookups. The email to Leo quotes the computed fee, and Clients › Fees placed rises the same moment.' },
    { title: 'Declines are opt-in', body: 'A rejected card sends nothing unless Send decline is ticked. Recruiters often call strong candidates instead, and an automatic email after a kind phone call reads badly.' },
    { title: 'No resume links in emails', body: 'Airtable’s attachment links expire after a few hours, so the client email does not link the resume. The recruiter sends it, with screening notes, the same day.' },
  ],
  edgeCases: [
    { title: 'A card moved back and forward', body: 'Moving Helen to Screen again sends the booking link again. The Pipeline is the source of truth, and recruiters know a move is a message.' },
    { title: 'Placed with no start date', body: 'The placement is created with an empty Start date, so Guarantee ends is empty and the check-in never comes due. The To invoice list shows the missing date, and Leo fills it before invoicing.' },
    { title: 'Moved to Placed twice', body: 'A second placement record would be created. Moving off Placed and back is rare; the Billing dashboard shows two placements for one application, which Leo deletes.' },
    { title: 'Bulk edit in the grid', body: 'Pasting Rejected into twenty rows fires twenty runs. Only rows with Send decline ticked get an email.' },
  ],
  qa: [
    'Each stage that needs an email sends exactly one, to the right person.',
    'Applied and Offer moves send nothing.',
    'Placed creates one placement with the fee computed from salary and the client’s rate.',
    'Rejected sends the decline only with Send decline ticked.',
    'Editing a note on an application starts nothing.',
  ],
  features: ['When a record is updated (watched fields)', 'Conditional group branches', 'Create record', 'Send email', 'Lookup through links', 'Rollup of a lookup', 'Formula', 'Last modified time', 'Kanban interface page'],
};
