/** The Apply form, rebuilt as a working demo that feeds 01 · New application. */
import type { DemoForm } from '@/lib/airtable/types';

const roles: Record<string, string> = {
  'Controller · Ridgeway Foods': 'recRolCtrl',
  'FP&A Manager · Altamont Health': 'recRolFpa',
  'Operations Director · Copper Range Logistics': 'recRolOps',
};

export const demo: DemoForm = {
  url: 'airtable.com/appLarkspurDesk/shrApply?prefill_Role=…',
  title: 'Apply with Larkspur Talent',
  description: 'One short form for any of our open searches. A recruiter reads every application.',
  fields: [
    { name: 'role', label: 'Role', type: 'dropdown', required: true, options: Object.keys(roles), help: 'On the real form this is filled in and hidden by the role’s Apply link. Here you can pick.' },
    { name: 'name', label: 'Applicant name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Applicant email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'https://' },
    { name: 'note', label: 'Cover note', type: 'textarea' },
  ],
  submitLabel: 'Submit',
  ending: 'Thank you for applying. A confirmation is on its way.',
  feeds: 'new-application',
  toRecord: (a) => ({ 'Applicant name': a.name, 'Applicant email': a.email, LinkedIn: a.linkedin || null, 'Cover note': a.note || null, Role: [roles[a.role] ?? 'recRolCtrl'] }),
  behaviors: [
    { value: 'new', label: 'You are new to Larkspur' },
    {
      value: 'returning',
      label: 'You applied last year with this email',
      setup: (a) => ({ by: 'You are already a candidate from last year', create: [{ table: 'Candidates', fields: { Name: a.name, Email: a.email.trim().toLowerCase(), Source: 'Apply form' } }] }),
    },
  ],
  note: 'Submit once as new, then again as returning: the script matches the existing candidate (try it with different capitals), and the desk is told on Slack.',
  notes: [
    { title: 'One form for every role', body: 'Role is a link field, filled in and hidden by each role’s Apply link (prefill_Role and hide_Role=true), so one form serves every search.' },
    { title: 'Resume upload', body: 'The real form has a Resume attachment field. The demo leaves it out because nothing is uploaded here.' },
    { title: 'The candidate is not on the form', body: 'Forms create one record in one table. The applicant’s details land on the Application; the automation’s script links or creates the Candidate.' },
  ],
};
