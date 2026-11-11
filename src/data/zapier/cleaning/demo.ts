/** The “Get a quote” form on the website, rebuilt as a working demo that feeds 01 · New quote request. */
import type { DemoForm } from '@/lib/zapier/types';

export const demo: DemoForm = {
  url: 'mapleandmain.example/quote',
  title: 'Get a quote',
  description: 'Tell us about your home and we will email a price range within a minute. No obligation.',
  fields: [
    { name: 'name', label: 'Full name', type: 'text', required: true, autocomplete: 'name', placeholder: 'Try typing it in capitals' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', placeholder: '(614) 555-0142', help: 'Any format. The Zap tidies it.' },
    {
      name: 'zip',
      label: 'ZIP code',
      type: 'dropdown',
      required: true,
      options: ['43214 · Clintonville', '43201 · Short North', '43085 · Worthington', '45202 · Cincinnati (outside the service area)'],
      help: 'A real form takes any ZIP code. These four show both outcomes.',
    },
    { name: 'size', label: 'Home size', type: 'dropdown', required: true, options: ['Studio or 1 bedroom', '2 bedrooms', '3 bedrooms', '4 or more bedrooms'] },
    { name: 'service', label: 'Service', type: 'dropdown', required: true, options: ['One-time deep clean', 'Recurring, every 2 weeks', 'Recurring, weekly', 'Move-out clean'] },
    { name: 'notes', label: 'Anything we should know?', type: 'textarea', placeholder: 'Pets, stairs, a tricky oven…' },
  ],
  submitLabel: 'Get my quote',
  ending: 'Thanks. Your price range is on its way to your inbox.',
  feeds: 'quote-request',
  toTrigger: (a, submittedAt) => ({
    'Full Name': a.name,
    Email: a.email,
    Phone: a.phone,
    'ZIP Code': a.zip.slice(0, 5),
    'Home Size': a.size,
    Service: a.service,
    Notes: a.notes,
    'Submission ID': '6184500001',
    'Submission Date': submittedAt,
  }),
  behaviors: [
    { value: 'ok', label: 'Every app is working' },
    { value: 'gmail', label: 'Gmail has a brief outage as the reply goes out', failures: { reply: { message: 'Gmail: “The service is currently unavailable.” (503)', replays: 1 } } },
    { value: 'slack', label: 'Someone has archived the #new-leads channel', failures: { tell: { message: 'Slack: “is_archived”. The channel #new-leads has been archived.' } } },
  ],
  note: 'Pick a ZIP code inside the service area with a recurring service and two paths run. Pick Cincinnati and only the fallback does. The two failure choices apply to in-area requests, since those are the ones that send the email and the Slack post.',
  notes: [
    { title: 'Jotform’s own Zapier connection', body: 'The form is connected through Jotform’s New Submission trigger, which is instant: Jotform tells Zapier as each submission arrives. Nothing is embedded in the page.' },
    { title: 'Field names are the contract', body: 'The Zap maps fields by their label in Jotform. Renaming “ZIP Code” on the form breaks the mapping, so the form’s labels are listed in the handoff guide as things not to rename.' },
    { title: 'Validation belongs in the form', body: 'ZIP code is limited to five digits and Email must look like an email, both in Jotform. The person can fix a typo while they are still on the page; the Zap cannot ask them.' },
    { title: 'A test submission before turning it on', body: 'The trigger was tested with a real submission from the live form, not Jotform’s sample data, so every mapped field shows a real value while the steps are built.' },
  ],
};
