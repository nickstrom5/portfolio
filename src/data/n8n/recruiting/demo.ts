/** The careers page's application form, rebuilt as a working demo that feeds 01 · Application intake. */
import type { DemoForm } from '@/lib/n8n/types';
import { ROLES, applicationItem } from './automations/application-intake';

export const demo: DemoForm = {
  url: 'harrowfinch.example/jobs/apply',
  title: 'Apply for a role',
  description: 'Pick a search and paste your résumé or a short summary. A recruiter reads every application; an AI step pulls out your experience first so they can reply faster.',
  fields: [
    { name: 'name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'role', label: 'Role', type: 'dropdown', required: true, options: ROLES },
    { name: 'location', label: 'Where you live', type: 'text', autocomplete: 'address-level2' },
    { name: 'resume', label: 'Résumé or summary', type: 'textarea', required: true, placeholder: 'Assistant Controller at Lakeshore Foods. CPA, 9 years, NetSuite, led a team of 4.' },
  ],
  submitLabel: 'Apply',
  ending: 'Thanks for applying. You will hear from us by email.',
  feeds: 'application-intake',
  toItem: (a) => applicationItem({ name: a.name ?? '', email: a.email ?? '', role: a.role ?? ROLES[0], location: a.location ?? '', resume: a.resume ?? '' }),
  behaviors: [
    { value: 'normal', label: 'Nobody steps in' },
    { value: 'override', label: 'A recruiter moves you to review during the two days', fixtures: { stageLater: 'To review' } },
  ],
  note: 'Try “CPA, 10 years, NetSuite, led a team” for the Controller role, then the same without “CPA”. In this simulator keyword rules stand in for the AI model, so plain words work best.',
  notes: [
    { title: 'The server posts, not the browser', body: 'The careers page’s server calls the n8n Webhook with a header secret, so the URL and the secret never reach a visitor.' },
    { title: 'Respond: Immediately', body: 'The 202 comes back before the AI step runs, so the candidate is never kept waiting on a model.' },
    { title: 'Telling candidates', body: 'The form says an AI step reads applications and a recruiter reviews them. Illinois expects that notice from 2026, and candidates trust it more than finding out later.' },
    { title: 'Test URL and production URL', body: 'The careers page calls /webhook/apply, live while the workflow is published. Recruiters test changes against /webhook-test/apply with the editor listening.' },
  ],
};
