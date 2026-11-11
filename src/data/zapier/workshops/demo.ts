/** A workshop's Stripe checkout, rebuilt as a working demo that feeds 01 · Paid seat. */
import type { DemoForm } from '@/lib/zapier/types';

export const demo: DemoForm = {
  url: 'buy.stripe.example/fieldnote-workshop',
  title: 'Reserve your seat',
  description: 'Live on Zoom, 90 minutes, with the recording included. Pay by card and your join link arrives within a minute.',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    {
      name: 'workshop',
      label: 'Workshop',
      type: 'dropdown',
      required: true,
      options: ['Grant budgets that get funded · $129', 'Year-end appeals that work · $89', 'Board reports people read · $149 (new, not set up in the Zap yet)'],
      help: 'In real life each workshop has its own payment link. The third shows what happens when one is forgotten.',
    },
    { name: 'news', label: 'Send me new workshop dates', type: 'dropdown', required: true, options: ['Yes, by email', 'No thanks'] },
  ],
  submitLabel: 'Pay',
  ending: 'Payment received. No card was charged: this is a demo.',
  feeds: 'paid-seat',
  toTrigger: (a) => ({
    ID: 'cs_live_demo0001',
    'Customer Details Name': a.name,
    'Customer Details Email': a.email,
    'Payment Status': 'paid',
    'Amount Total': a.workshop.includes('$129') ? '12900' : a.workshop.includes('$89') ? '8900' : '14900',
    Currency: 'usd',
    'Metadata Workshop': a.workshop.split(' · ')[0],
    'Consent Promotions': a.news.startsWith('Yes') ? 'opt_in' : 'opt_out',
  }),
  behaviors: [
    { value: 'ok', label: 'Every app is working' },
    { value: 'zoom', label: 'Zoom is unreachable for a moment', failures: { register: { message: 'Zoom: “Service temporarily unavailable.” (503)', replays: 1 } } },
    { value: 'slack', label: 'Someone has archived the #registrations channel', failures: { tell: { message: 'Slack: “is_archived”. The channel #registrations has been archived.' } } },
  ],
  note: 'Choose “No thanks” and the run ends as Filtered just before Mailchimp, with your seat already given. Choose the third workshop and the Zoom step errors, because the lookup table has no row for it.',
  notes: [
    { title: 'Stripe payment links, one per workshop', body: 'No checkout page was built. Each workshop is a product with a payment link, and each link carries a metadata field, Workshop, that Stripe copies onto the checkout session.' },
    { title: 'The consent box is Stripe’s own', body: 'Payment links can show an optional promotions box. Its answer arrives on the checkout session as Consent › Promotions, which the Zap’s last filter reads.' },
    { title: 'A restricted key for Zapier', body: 'The Stripe connection uses a restricted API key that can read checkout sessions and nothing else, so the Zapier account could never move money.' },
    { title: 'Tested in Stripe’s test mode first', body: 'The Zap was built and run end to end against a test-mode payment link and a practice Zoom webinar, then its connection was switched to live mode.' },
  ],
};
