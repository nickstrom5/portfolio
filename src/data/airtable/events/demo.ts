/** The Call for speakers form, rebuilt as a working demo that feeds 01 · New pitch. */
import type { DemoForm } from '@/lib/airtable/types';

const events: Record<string, string> = { 'Workshop day · Portland': 'recEvtPdx', 'Brightwater Summit 2026': 'recEvtSum' };

export const demo: DemoForm = {
  url: 'airtable.com/appBrightwater/shrCallForSpeakers',
  title: 'Speak at Brightwater',
  description: 'Pitch a talk, panel or workshop for one of our events. Every pitch is read by the program team and two outside reviewers, and you will hear back either way.',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'What would you call your session?' },
    { name: 'name', label: 'Speaker name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Speaker email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'company', label: 'Company', type: 'text', autocomplete: 'organization' },
    { name: 'format', label: 'Format', type: 'dropdown', required: true, options: ['Talk', 'Panel', 'Workshop', 'Keynote'] },
    { name: 'track', label: 'Track', type: 'dropdown', options: ['Operations', 'Supply chain', 'Finance', 'People'] },
    { name: 'event', label: 'Event', type: 'dropdown', required: true, options: Object.keys(events), help: 'Only events open for pitches are listed.' },
    { name: 'abstract', label: 'Abstract', type: 'textarea', required: true, placeholder: 'Two or three sentences on what people will take away.' },
    { name: 'travel', label: 'Needs travel', type: 'dropdown', options: ['No', 'Yes'], help: 'Will you need us to book travel to the event?' },
  ],
  submitLabel: 'Submit',
  ending: 'Thank you for pitching. A confirmation is on its way to your inbox.',
  feeds: 'new-pitch',
  toRecord: (a) => ({
    Title: a.title,
    'Speaker name': a.name,
    'Speaker email': a.email,
    Company: a.company || null,
    Format: a.format,
    Track: a.track || null,
    Abstract: a.abstract,
    Event: [events[a.event] ?? 'recEvtSum'],
    'Needs travel': a.travel === 'Yes',
  }),
  behaviors: [
    { value: 'first', label: 'You are new to Brightwater' },
    {
      value: 'returning',
      label: 'You spoke here last year (same email)',
      setup: (a) => ({ by: 'You are already in Speakers from last year', create: [{ table: 'Speakers', fields: { Name: a.name, Email: a.email, Company: a.company || null } }] }),
    },
    { value: 'slack', label: 'Slack has been disconnected', failures: { slack: 'The Slack account for this action needs to be reconnected.' } },
  ],
  note: 'Try it once as a newcomer, then again as a returning speaker, and watch which conditional group runs. Choose “Slack has been disconnected” to see a run fail without undoing the steps before it.',
  notes: [
    { title: 'A form view on Sessions', body: 'Each answer goes straight into a field of a new Sessions record. Fields the public should not see, like Status and Score, are simply not on the form.' },
    { title: 'Linked-record picker, limited to a view', body: 'Event is a link field. On the form its picker is limited to the Events view “Open for pitches”, so locked events cannot be chosen.' },
    { title: 'Required fields and help text', body: 'Required fields are set on the form, not the table, so the team can still add a half-finished pitch by hand. Field descriptions show under each question.' },
    { title: 'Prefilled links', body: 'The website’s “Pitch for Portland” button opens the form with ?prefill_Event=Workshop%20day%20%C2%B7%20Portland, so the event is chosen already.' },
  ],
};
