/** The wholesale form, rebuilt as a working demo that feeds 01 · Wholesale inquiry. */
import type { DemoForm } from '@/lib/n8n/types';
import { formItem } from './automations/wholesale-inquiry';

export const demo: DemoForm = {
  url: 'copperleaf.app.n8n.cloud/form/wholesale',
  title: 'Wholesale coffee for your business',
  description: 'Tell us a little about your café, restaurant or shop. Maya, our owner, reads every one, and you will hear back by email within the hour.',
  fields: [
    { name: 'business', label: 'Business name', type: 'text', required: true, autocomplete: 'organization' },
    { name: 'name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'type', label: 'Business type', type: 'dropdown', required: true, options: ['Café or coffee shop', 'Restaurant', 'Grocery or retail', 'Office', 'Other'] },
    { name: 'lbs', label: 'Coffee per week (lbs)', type: 'number', required: true, placeholder: '25' },
    { name: 'city', label: 'City and state', type: 'text', autocomplete: 'address-level2' },
    { name: 'focus', label: 'Mostly espresso or brewed?', type: 'dropdown', options: ['Mostly espresso', 'Mostly brewed', 'About half and half'] },
    { name: 'note', label: 'Anything else?', type: 'textarea' },
  ],
  submitLabel: 'Send',
  ending: 'Thanks! Maya will be in touch by email shortly.',
  feeds: 'wholesale-inquiry',
  toItem: formItem,
  behaviors: [
    { value: 'normal', label: 'HubSpot answers normally', fixtures: { hubspotId: 90437 } },
    { value: 'down', label: 'HubSpot is down (503)', failures: { hubspot: [{ status: 503, message: 'Service Unavailable' }] } },
  ],
  note: 'Try a big espresso café and then a four-pound office to see the Switch pick a different email. Choose “HubSpot is down” to watch the error output keep the lead moving.',
  notes: [
    { title: 'Field labels are the keys', body: 'The Form Trigger outputs each answer under its label, plus submittedAt and formMode. Edit Fields renames them straight away.' },
    { title: 'Respond When: Form Is Submitted', body: 'The thank-you page shows at once. With Workflow Finishes, a slow HubSpot would keep the café staring at a spinner, and a failure would show them an error.' },
    { title: 'Test URL and production URL', body: 'The test URL works while the editor listens for a test event, and the submission appears on the canvas. The production URL works once the workflow is published, and its runs appear under Executions.' },
    { title: 'Ignore Bots, no attribution', body: 'Ignore Bots skips link previewers and crawlers. Append n8n Attribution is off, so the page carries Copperleaf’s name only.' },
  ],
};
