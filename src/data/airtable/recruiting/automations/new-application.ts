/** 01 · New application: a script matches the applicant to one candidate record, then the applicant is thanked. */
import type { Automation, Ctx } from '@/lib/airtable/types';
import { fx } from '@/lib/airtable/engine';

const T = (c: Ctx) => c.trigger!;
const role = (c: Ctx) => c.record('Roles', (T(c).get('Role') as string[])[0]);

const SCRIPT = `// Finds the candidate by email, ignoring case and stray spaces;
// creates one if they are new; links the application to them.
const { applicationId, email, name, linkedIn } = input.config();
const key = email.trim().toLowerCase();

const candidates = base.getTable('Candidates');
const query = await candidates.selectRecordsAsync({ fields: ['Email', 'Times applied'] });
const match = query.records.find(
  (r) => r.getCellValueAsString('Email').trim().toLowerCase() === key
);

const candidateId = match
  ? match.id
  : await candidates.createRecordAsync({
      'Name': name.trim(),
      'Email': key,
      'LinkedIn': linkedIn || null,
      'Source': { name: 'Apply form' },
    });

await base.getTable('Applications').updateRecordAsync(applicationId, {
  'Candidate': [{ id: candidateId }],
});

output.set('candidateId', candidateId);
output.set('returning', match ? 'yes' : 'no');
output.set('before', match ? match.getCellValue('Times applied') : 0);`;

export const newApplication: Automation = {
  id: 'new-application',
  number: '01',
  name: 'New application',
  kicker: 'Form → one candidate, thanked',
  tagline: 'However someone types their email, they end up as one candidate with every application they have made, and they hear back in a minute.',
  problem: 'Each role had its own spreadsheet, so someone who applied for two roles, or came back a year later, was a stranger every time. “Jamie.Ortiz@” and “jamie.ortiz@” were two people. Applicants heard nothing until a recruiter got to them.',
  solution: 'Every role has an Apply link that opens the Airtable form with the role filled in and hidden. When an application arrives, a short script looks the applicant up by email, ignoring capitals and spaces, links the application to the existing candidate or creates one, and reports whether they are returning. The applicant gets an acknowledgement, and a returning applicant is flagged to the desk on Slack.',
  trigger: {
    type: 'When a form is submitted',
    table: 'Applications',
    view: 'Apply',
    summary: 'Runs once for each application sent through the Apply form.',
    params: [
      { k: 'Table', v: 'Applications' },
      { k: 'Form', v: 'Apply' },
    ],
  },
  steps: [
    {
      kind: 'action',
      id: 'match',
      type: 'Run a script',
      title: 'Match or create the candidate',
      summary: 'Normalizes the email, finds or creates the candidate, links the application.',
      params: [
        { k: 'Input variable applicationId', v: '{Trigger › Airtable record ID}' },
        { k: 'Input variable email', v: '{Trigger › Applicant email}' },
        { k: 'Input variable name', v: '{Trigger › Applicant name}' },
        { k: 'Input variable linkedIn', v: '{Trigger › LinkedIn}' },
      ],
      script: {
        inputs: [
          { name: 'applicationId', value: 'Trigger › Airtable record ID' },
          { name: 'email', value: 'Trigger › Applicant email' },
          { name: 'name', value: 'Trigger › Applicant name' },
          { name: 'linkedIn', value: 'Trigger › LinkedIn' },
        ],
        source: SCRIPT,
      },
      run: (c) => {
        const key = fx.str(T(c).get('Applicant email')).trim().toLowerCase();
        const match = c.records('Candidates').find((r) => fx.str(r.get('Email')).trim().toLowerCase() === key);
        if (match) {
          const before = fx.num(match.get('Times applied'));
          return {
            log: `Matched ${match.name} (applied ${before} time${before === 1 ? '' : 's'} before) · output.set: candidateId, returning yes, before ${before}`,
            update: [{ table: 'Applications', id: T(c).id, fields: { Candidate: [match.id] } }],
            output: { candidateId: match.id, returning: 'yes', before },
          };
        }
        return {
          log: 'No match: created a candidate and linked it · output.set: candidateId, returning no, before 0',
          create: [{ table: 'Candidates', fields: { Name: fx.str(T(c).get('Applicant name')).trim(), Email: key, LinkedIn: T(c).get('LinkedIn') || null, Source: 'Apply form' } }],
          then: ([id]) => [{ table: 'Applications', id: T(c).id, fields: { Candidate: [id] } }],
          output: { returning: 'no', before: 0 },
        };
      },
    },
    {
      kind: 'action',
      id: 'ack',
      type: 'Send email',
      title: 'Thank the applicant',
      summary: 'Names the role and the recruiter who will read it.',
      params: [
        { k: 'To', v: '{Trigger › Applicant email}' },
        { k: 'From name', v: 'Larkspur Talent' },
        { k: 'Reply to', v: '{Trigger › Recruiter › Email}' },
        { k: 'Subject', v: 'Your application: {Trigger › Role}' },
      ],
      run: (c) => ({
        messages: [
          {
            channel: 'email',
            to: fx.str(T(c).get('Applicant email')).trim(),
            subject: `Your application: ${role(c).name}`,
            body: `Hi ${fx.str(T(c).get('Applicant name')).trim().split(' ')[0]},\n\nThanks for applying for ${role(c).name}. ${role(c).text('Recruiter')} is running this search and reads every application personally. If your background fits, you will hear from us within a week to set up a short call.\n\nLarkspur Talent`,
          },
        ],
      }),
    },
    {
      kind: 'if',
      id: 'g-returning',
      branches: [
        {
          name: 'Returning candidate',
          when: 'Run a script › returning is yes',
          test: (c) => c.out('match').returning === 'yes',
          steps: [
            {
              kind: 'action',
              id: 'slack-returning',
              type: 'Send a Slack message',
              title: 'Flag a returning candidate',
              summary: 'Someone already known to the desk deserves a look today.',
              params: [
                { k: 'Channel', v: '#desk' },
                { k: 'Message', v: 'Returning candidate: {Trigger › Applicant name} applied for {Trigger › Role} ({Run a script › before} earlier applications).' },
              ],
              run: (c) => {
                const before = c.out('match').before as number;
                return { messages: [{ channel: 'slack', to: '#desk', body: `Returning candidate: ${fx.str(T(c).get('Applicant name')).trim()} applied for ${role(c).name} (${before} earlier application${before === 1 ? '' : 's'}). ${role(c).text('Recruiter')}, their history is on the candidate record.` }] };
              },
            },
          ],
        },
      ]
    },
  ],
  notify: 'Leo Marsh',
  scenarios: [
    {
      id: 'new',
      label: 'A first-time applicant',
      summary: 'Morgan applies for the Controller role: a candidate is created and linked.',
      start: 1440 + 1190,
      form: { 'Applicant name': 'Morgan Lee', 'Applicant email': 'morgan.lee@mailbox.example', LinkedIn: 'https://linkedin.example/in/morganlee', Resume: ['morgan-lee-resume.pdf'], 'Cover note': 'Eight years in food manufacturing finance, last three as assistant controller.', Role: ['recRolCtrl'] },
      expect: { status: 'success', visits: ['match', 'ack', 'g-returning:none'], skips: ['slack-returning'], emails: 1 },
    },
    {
      id: 'returning',
      label: 'A returning applicant, typed differently',
      summary: 'Jamie applied last year as jamie.ortiz@; this time the email has capitals and a space. Same candidate.',
      start: 2 * 1440 + 610,
      form: { 'Applicant name': 'Jamie Ortiz', 'Applicant email': ' Jamie.Ortiz@Fastmail.example', Resume: ['jamie-ortiz-2026.pdf'], Role: ['recRolFpa'] },
      expect: { status: 'success', visits: ['match', 'ack', 'g-returning:0', 'slack-returning'], emails: 1 },
    },
  ],
  fields: [
    { table: 'Applications', field: 'Applicant name, Applicant email, LinkedIn', use: 'Script inputs.' },
    { table: 'Applications', field: 'Candidate', use: 'Linked by the script with updateRecordAsync.' },
    { table: 'Candidates', field: 'Email', use: 'Stored lower-case, matched ignoring case and spaces.' },
    { table: 'Candidates', field: 'Times applied', use: 'Count of linked applications, quoted on Slack.' },
    { table: 'Roles', field: 'Apply link', use: 'Formula with prefill_Role and hide_Role, posted on job boards.' },
  ],
  build: [
    { title: 'Why a script here', body: 'Find records matches the value as given. Applicants type their email differently from one year to the next, so the script compares a trimmed, lower-case version of both sides and stores new emails that way too.' },
    { title: 'The script reports, groups decide', body: 'The script sets returning to yes or no. A conditional group reads that output, so the business rules (who is told what) stay visible in the automation editor rather than buried in code.' },
    { title: 'Role prefilled and hidden', body: 'Each role’s Apply link is a formula: the form URL plus prefill_Role and hide_Role=true. Applicants cannot pick the wrong role, and one form serves every search.' },
    { title: 'Reply goes to the recruiter', body: 'Reply to is the role’s recruiter, through a lookup of a user field, so an applicant’s reply reaches the person running the search.' },
  ],
  edgeCases: [
    { title: 'Same person, new email address', body: 'A different address makes a new candidate. Grace checks the Candidates grid by name when a resume looks familiar, and merges by hand.' },
    { title: 'Applies twice for the same role', body: 'Both applications link to one candidate and both are acknowledged. The Pipeline shows two cards for one person, and the recruiter rejects one with Send decline unticked.' },
    { title: 'The script fails', body: 'The application exists but has no candidate, and no email goes out. Leo gets the failure email; the Application name falls back to the typed name, so nothing is lost.' },
    { title: 'Role filled while the link is still posted', body: 'The application still arrives. The recruiter declines it from the Pipeline; Grace removes the link from the job board when a role closes.' },
  ],
  qa: [
    'A new email creates one candidate, stored lower-case, and links it.',
    'An email with different capitals or spaces matches the existing candidate.',
    'The acknowledgement names the role and its recruiter.',
    'Only returning applicants are posted to #desk.',
    'The Apply link opens the form with the role filled in and hidden.',
  ],
  features: ['Form view', 'Prefilled and hidden form fields', 'When a form is submitted', 'Run a script', 'Script input and output variables', 'Conditional groups', 'Update record', 'Send email', 'Send a Slack message', 'Formula (ENCODE_URL_COMPONENT)'],
};
