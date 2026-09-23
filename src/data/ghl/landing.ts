import type { LandingPage } from '@/lib/ghl/types';
import { nextWeekdayAt } from '@/lib/ghl/engine';

/** Case study 1: the roofing company's inspection page, which feeds workflow 01. */
export const roofingLanding: LandingPage = {
  url: 'harborpine.example/free-inspection',
  brand: {
    name: 'Harbor & Pine Roofing',
    logo: 'pine',
    phone: '(312) 555-0142',
    colors: { primary: '#1d4d3b', primaryDark: '#133529', bg: '#f7f3ea', accent: '#e0892b', accentInk: '#1b1206', ink: '#1c231f', muted: '#56615a', logo: '#7fc3a2' },
  },
  kicker: 'Chicago suburbs · Free inspection',
  headline: 'Storm damage? Get a free roof inspection this week.',
  sub: 'A local crew checks your roof, photographs anything that needs attention and leaves a written estimate. No pressure and no cost.',
  points: ['Licensed and insured', 'Photos of every issue we find', 'Help with insurance claims'],
  formTitle: 'Book your free inspection',
  submitLabel: 'Get my free inspection',
  fields: [
    { name: 'first', label: 'First name', type: 'text', required: true, autocomplete: 'given-name', half: true, maps: 'firstName' },
    { name: 'last', label: 'Last name', type: 'text', autocomplete: 'family-name', maps: 'lastName' },
    { name: 'phone', label: 'Mobile phone', type: 'tel', required: true, autocomplete: 'tel', placeholder: '(312) 555-0100', maps: 'phone' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', maps: 'email' },
    { name: 'service', label: 'What do you need?', type: 'select', required: true, options: ['Storm damage', 'Leak or repair', 'Full replacement', 'Not sure yet'], maps: { field: 'service_needed' } },
    { name: 'age', label: 'How old is the roof?', type: 'select', options: ['Under 10 years', '10-20 years', 'Over 20 years', 'Not sure'], initial: 'Not sure', maps: { field: 'roof_age' } },
  ],
  consent: {
    transactional: 'Text me about my inspection, estimate and job: scheduling, reminders and updates from Harbor & Pine Roofing. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.',
    marketing: 'Also text me occasional offers and seasonal roof reminders. Reply STOP to opt out.',
    fine: 'Consent is optional and not a condition of purchase. Privacy Policy · Terms of Service',
  },
  thanks: {
    title: 'Thanks, {first}. Your request is in.',
    body: 'Step 2 of 2: pick a time. In the live funnel, the Roof Inspection calendar sits here, already filled in with your details by Sticky Contact.',
    slots: ['Thu 10:00 AM', 'Thu 2:30 PM', 'Fri 9:00 AM'],
  },
  feeds: 'speed-to-lead',
  trigger: 0,
  textWindow: { start: '08:00', end: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
  behaviors: [
    {
      value: 'replies',
      label: 'Reply to the first message',
      scenario: 'replies',
      events: ({ firstText, texts }) => [{ at: firstText + 3, type: 'reply', channel: texts ? 'sms' : 'email', value: 'Yes please. Tomorrow after 3 works for me.' }],
    },
    {
      value: 'books',
      label: 'Book from the link',
      scenario: 'books',
      events: ({ start, firstText }) => [{ at: firstText + 25, type: 'appointment_booked', value: 'Roof Inspection', appointmentAt: nextWeekdayAt(start, 10 * 60) - start }],
    },
    { value: 'quiet', label: 'Ignore everything', scenario: 'quiet', events: () => [] },
  ],
  steps: [
    'The form creates the contact and saves each answer to a custom field, plus hidden UTM fields read from the page URL.',
    'Form Submitted fires 01 · Lead Intake · Speed to Lead.',
    'A rep is assigned and alerted, you get an email straight away, and a text if you ticked the first box, but never after 8 PM your time.',
  ],
  notes: [
    { title: 'One goal, one action', body: 'No navigation menu on the step, and every button on the page leads to the same form. The copy is short, plain and specific to the offer.' },
    { title: 'A short, honest form', body: 'Single column, labels above the fields, six questions. The two SMS consent boxes are separate (inspection updates, and offers), unticked and optional, with the Privacy Policy and Terms linked, which is what A2P reviewers look for.' },
    { title: 'Hidden UTM fields', body: 'Custom fields utm_source, utm_medium and utm_campaign with Hidden on and a Query Key that matches the URL parameter exactly. GHL already records First and Latest Attribution by itself; the fields are there so workflows, filters and merge fields can use the values.' },
    { title: 'Thank-you step with the calendar', body: 'Step 2 embeds the Roof Inspection calendar. Sticky Contact prefills the booking form, so nobody types their details twice, and booking fires workflow 03.' },
    { title: 'Tracking that survives edits', body: 'Meta Pixel and GA4 go in the funnel’s head tracking code. GHL does not copy tracking code when a step is cloned, so re-checking it is on the launch checklist.' },
    { title: 'Fast on a phone', body: 'Optimize JavaScript and Image Optimization on, hero image under 200 KB. Any custom script listens for the hydrationDone event, so deferred loading does not break it.' },
    { title: 'Test the headline, not the button color', body: 'A split-test variation on the step with a 50/50 slider. The Stats tab reports opt-in rate as opt-ins divided by unique page views, and one variation wins before the next test starts.' },
  ],
};
