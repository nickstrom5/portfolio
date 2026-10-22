import type { FormDemo } from '@/lib/clickup/types';
import { S1, S2, S3, S4 } from './triage';

export const form: FormDemo = {
  title: 'Report a bug',
  description: 'For the support team. One report per bug; check the Bug Inbox first. The Severity guide explains each level.',
  url: 'app.clickup.com/9016xxxx/v/fo/report-a-bug',
  fields: [
    { name: 'summary', label: 'What’s broken? (one line)', type: 'text', required: true, placeholder: 'Send invoice fails on the web app', maps: 'name' },
    { name: 'severity', label: 'Severity', type: 'select', required: true, options: [S1, S2, S3, S4], initial: S3, maps: { field: 'Severity' } },
    { name: 'platform', label: 'Platform', type: 'select', required: true, options: ['Web', 'iOS', 'Android', 'API'], maps: { field: 'Platform' } },
    { name: 'plan', label: 'Customer’s plan', type: 'select', options: ['Free', 'Pro', 'Business'], maps: { field: 'Customer plan' } },
    { name: 'ticket', label: 'Support ticket link', type: 'text', placeholder: 'https://support.tallyway.example/t/…', maps: { field: 'Support ticket' } },
    { name: 'steps', label: 'Steps to reproduce', type: 'textarea', placeholder: '1. Open… 2. Press… 3. See…', maps: { field: 'Steps to reproduce' } },
  ],
  submitLabel: 'Submit bug',
  thanks: 'Thanks. Triage happens twice a day; S1 reports reach the on-call engineer immediately.',
  feeds: 'triage',
  behaviors: [
    { value: 'triaged', label: 'The engineering lead triages it straight away', scenario: 'major' },
    { value: 'info', label: 'Engineering needs more detail first', scenario: 'vague' },
    { value: 'outage', label: 'It turns out to be an outage', scenario: 'outage' },
  ],
  steps: [
    'ClickUp creates a task in Product › Bug Inbox, with you as the task creator.',
    'Severity, platform and plan land in Custom Fields.',
    'Severity sets the priority and owner: S1 goes to the on-call engineer, into the sprint and to #incidents.',
    'When it is triaged, it goes into the current sprint or the backlog by priority.',
  ],
  notes: [
    { title: 'An internal Form', body: 'Shared inside the Workspace, so each submission records which support agent sent it, and Needs info can go back to them.' },
    { title: 'Severity in words', body: 'Each option says what it means, so Automations can match it exactly and agents don’t guess.' },
    { title: 'Steps are optional, on purpose', body: 'Asking for steps up front slows down outage reports. The Needs info loop asks for them only when engineering needs them.' },
    { title: 'Links, not copies', body: 'The support ticket link keeps the customer conversation in the support tool; the bug task holds only what engineering needs.' },
  ],
};
