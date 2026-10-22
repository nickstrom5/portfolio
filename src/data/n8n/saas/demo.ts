/** The in-app Contact support form, rebuilt as a working demo that feeds 01 · Support triage. */
import type { DemoForm } from '@/lib/n8n/types';
import { ticketItem } from './automations/support-triage';

const big = { id: 'acc_7HX2QK', name: 'Lumen Hair Group', plan: 'Scale', mrr: 400, locations: 12, csm: 'Chloe Martin', csm_email: 'chloe@slotwise.example' };
const small = { id: 'acc_5KJ1NB', name: 'Bianchi Barbers', plan: 'Studio', mrr: 39, locations: 1, csm: 'Omar Haddad', csm_email: 'omar@slotwise.example' };

export const demo: DemoForm = {
  url: 'app.slotwise.example/help/contact',
  title: 'Contact support',
  description: 'Tell us what is going on. We read every message, and urgent problems reach an engineer within minutes.',
  fields: [
    { name: 'name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'Reminders went out at the wrong time' },
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'What happened, and what did you expect?' },
  ],
  submitLabel: 'Send to support',
  ending: 'Thanks, we have your message. You will get a reply by email.',
  feeds: 'support-triage',
  toItem: (a) => ticketItem({ account_id: 'acc_DEMO01', name: a.name ?? '', email: a.email ?? '', subject: a.subject ?? '', message: a.message ?? '' }),
  behaviors: [
    { value: 'big', label: 'You are a big account ($400 a month)', fixtures: { account: { ...big, id: 'acc_DEMO01' } } },
    { value: 'small', label: 'You are a small studio ($39 a month)', fixtures: { account: { ...small, id: 'acc_DEMO01' } } },
    { value: 'down', label: 'The account API is down', failures: { account: [{ status: 504, message: 'Gateway Timeout' }] } },
  ],
  note: 'Write it like a customer would: “the booking page won’t load”, “I was charged twice”, “how do I add a deposit?”. In this simulator keyword rules stand in for the AI model, so plain words work best.',
  notes: [
    { title: 'Signed in, so no account field', body: 'The form is inside the app. Slotwise’s backend adds the account ID from the session and posts to n8n, so a customer can never file a ticket as someone else.' },
    { title: 'Respond: Immediately, 202', body: 'The app shows its thank-you as soon as n8n has the request. Classification and the Zendesk ticket happen after.' },
    { title: 'What the model sees', body: 'The subject and message only. Name, email and account details are joined back in from earlier nodes after classifying.' },
    { title: 'Production URL only', body: 'The backend calls /webhook/support, live while the workflow is published. Staging calls a copy of the workflow with its own URL.' },
  ],
};
