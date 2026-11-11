/** The Facebook lead form, rebuilt as a working demo that feeds 01 · Lead routing. */
import type { DemoForm } from '@/lib/zapier/types';

export const demo: DemoForm = {
  url: 'facebook.com/ads/lead_gen · Kettlebrook Solar',
  title: 'Get a free solar estimate',
  description: 'Answer four questions and a Kettlebrook advisor will call you with an estimate for your home.',
  fields: [
    { name: 'name', label: 'Full name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    { name: 'phone', label: 'Phone number', type: 'tel', autocomplete: 'tel', placeholder: '(602) 555-0188' },
    { name: 'state', label: 'State', type: 'dropdown', required: true, options: ['Arizona', 'Nevada', 'New Mexico', 'Utah'], help: 'Kettlebrook covers the first three. Pick Utah to see where an out-of-territory lead goes.' },
    { name: 'owner', label: 'Do you own your home?', type: 'dropdown', required: true, options: ['Yes', 'No'] },
    { name: 'bill', label: 'Monthly electric bill', type: 'dropdown', required: true, options: ['Under $150', '$150 to $250', 'Over $250'] },
  ],
  submitLabel: 'Submit',
  ending: 'Thanks. An advisor will call you shortly.',
  feeds: 'lead-routing',
  toTrigger: (a, submittedAt) => ({
    'Full Name': a.name,
    Email: a.email,
    'Phone Number': a.phone,
    State: a.state,
    'Homeowner?': a.owner,
    'Monthly Electric Bill': a.bill,
    'Form Name': 'Free solar estimate',
    'Ad Name': 'Spring estimate',
    'Lead ID': '1184600001',
    'Created Time': submittedAt,
  }),
  behaviors: [
    { value: 'new', label: 'You have never contacted Kettlebrook' },
    {
      value: 'returning',
      label: 'You asked for an estimate last year (same email)',
      world: (a) => ({ 'HubSpot contacts': [{ Id: '29871', Email: a.email, 'First Name': a.name.trim().split(/\s+/)[0], 'Last Name': a.name.trim().split(/\s+/).slice(1).join(' '), State: a.state, 'Contact Owner': 'Tom Whitaker', 'Lead Status': 'Attempted to contact' }] }),
    },
    { value: 'limit', label: 'HubSpot is over its rate limit for a moment', failures: { contact: { message: 'HubSpot: “You have reached your secondly limit.” (429)', replays: 1 } } },
  ],
  note: 'Answer No to owning your home and the run ends at the filter. Choose “asked last year” and Paths takes its fallback: your record keeps its owner and gets a note.',
  notes: [
    { title: 'A lead form, not a landing page', body: 'Facebook lead ads keep the form inside Facebook and prefill it from the person’s profile. Zapier’s New Lead trigger receives each submission as it happens.' },
    { title: 'Custom questions arrive as named fields', body: '“Do you own your home?” and “Monthly electric bill” are custom questions on the form. Zapier shows each as its own field, mapped by name in the filter and the steps after it.' },
    { title: 'Test with a real lead', body: 'Facebook’s lead ads testing tool creates a real test lead for the form. The Zap was built against one of those, so every mapped field shows a value.' },
    { title: 'One Zap for every ad', body: 'The trigger watches the form, not an ad. New ads that reuse the form are routed with no change to the Zap, and the ad’s name is saved on the contact.' },
  ],
};
