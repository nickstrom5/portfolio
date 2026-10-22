/** The website's onboarding form, rebuilt as a working demo that posts to 01 · New client onboarding. */
import type { DemoForm } from '@/lib/n8n/types';
import { SERVICES, webhookItem } from './automations/client-onboarding';

export const demo: DemoForm = {
  url: 'ledgerline.example/start',
  title: 'Start your onboarding',
  description: 'You have signed your engagement letter. Tell us where to send things and we will set up your private folder and your bookkeeper right away.',
  fields: [
    { name: 'business_name', label: 'Business name', type: 'text', required: true, autocomplete: 'organization' },
    { name: 'contact_name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'service', label: 'Service', type: 'dropdown', required: true, options: SERVICES },
    { name: 'software', label: 'Accounting software today', type: 'dropdown', options: ['QuickBooks Online', 'Xero', 'Spreadsheets', 'Nothing yet'] },
  ],
  submitLabel: 'Start onboarding',
  ending: 'Thanks! Check your inbox for a welcome email from Ledgerline.',
  feeds: 'client-onboarding',
  toItem: (a) => webhookItem({ business_name: a.business_name ?? '', contact_name: a.contact_name ?? '', email: a.email ?? '', service: a.service ?? SERVICES[0], software: a.software ?? '' }),
  behaviors: [
    { value: 'normal', label: 'Everything works' },
    { value: 'drive', label: 'Google Drive fails (500 on every try)', failures: { folder: [{ status: 500, message: 'Internal Error' }, { status: 500, message: 'Internal Error' }, { status: 500, message: 'Internal Error' }] } },
  ],
  note: 'Pick a service to see which bookkeeper gets the task. Choose “Google Drive fails” to watch the execution stop and the error workflow, 03, take over in the same log.',
  notes: [
    { title: 'The site’s server posts, not the browser', body: 'The form submits to Ledgerline’s site, whose server calls the n8n Webhook with the X-Ledgerline-Key header. The secret never reaches a browser.' },
    { title: 'Header Auth on the Webhook', body: 'A request without the right header gets a 403 from n8n before any node runs, and no execution is created.' },
    { title: 'Respond to Webhook, early', body: 'The site gets 200 or 422 right after the input is checked. Folder, task and emails happen after the response.' },
    { title: 'Test URL and production URL', body: 'The site calls /webhook/new-client, which only answers while the workflow is published. /webhook-test/new-client answers only while the editor is listening, which is how the build was tested.' },
  ],
};
