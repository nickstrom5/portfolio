import type { LandingPage } from '@/lib/ghl/types';

export const landing: LandingPage = {
  url: 'crewlo.example/demo',
  brand: {
    name: 'Crewlo',
    logo: 'peak',
    colors: { primary: '#312e81', primaryDark: '#1e1b4b', bg: '#f5f6fb', accent: '#22c55e', accentInk: '#052e12', ink: '#171a2b', muted: '#565b73', logo: '#a5b4fc' },
  },
  kicker: 'Scheduling and dispatch for field-service teams',
  headline: 'One live schedule for every crew.',
  sub: 'See how Crewlo turns a whiteboard and a group chat into one live schedule your techs can see on their phones. A 30-minute demo, tailored to how your team works.',
  points: ['Drag-and-drop dispatch board', 'Works with QuickBooks and Google Calendar', 'Free 14-day trial after the demo'],
  formTitle: 'Book a demo',
  submitLabel: 'Book my demo',
  fields: [
    { name: 'first', label: 'First name', type: 'text', required: true, autocomplete: 'given-name', half: true, maps: 'firstName' },
    { name: 'last', label: 'Last name', type: 'text', required: true, autocomplete: 'family-name', maps: 'lastName' },
    { name: 'email', label: 'Work email', type: 'email', required: true, autocomplete: 'email', maps: 'email' },
    { name: 'company', label: 'Company', type: 'text', required: true, autocomplete: 'organization', maps: { field: 'company' } },
    {
      name: 'size',
      label: 'How many people schedule or get scheduled?',
      type: 'select',
      required: true,
      options: ['1-10', '11-50', '51-200', '201-1,000', '1,000+'],
      maps: { field: 'company_size' },
    },
    { name: 'role', label: 'Your role', type: 'select', options: ['Owner or executive', 'Operations or dispatch', 'IT', 'Other'], initial: 'Owner or executive', maps: { field: 'job_role' } },
    { name: 'phone', label: 'Mobile phone (optional)', type: 'tel', autocomplete: 'tel', placeholder: '(415) 555-0100', maps: 'phone' },
  ],
  consent: {
    transactional: 'Text me about my demo booking and reminders from Crewlo. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.',
    marketing: 'Also text me product news and event invites. Reply STOP to opt out.',
    fine: 'Consent is optional and not a condition of purchase. Privacy Policy · Terms of Service',
  },
  thanks: {
    title: 'Thanks, {first}. Pick a time that suits you.',
    body: 'Step 2 of 2: in the live funnel, the Product Demo calendar sits here. It is round robin with Always Book with Assigned User on, so once the workflow has picked your rep, you see their times and book with them.',
    slots: ['Tue 11:00 AM', 'Wed 2:30 PM', 'Thu 10:00 AM'],
  },
  feeds: 'demo-request',
  trigger: 0,
  textWindow: { start: '08:00', end: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
  behaviors: [
    {
      value: 'books',
      label: 'Book a time on the next page',
      scenario: 'books',
      events: () => [{ at: 2, type: 'appointment_booked', value: 'Product Demo', appointmentAt: 26 * 60 }],
    },
    {
      value: 'replies',
      label: 'Reply to the email instead',
      scenario: 'replies',
      events: () => [{ at: 35, type: 'reply', channel: 'email', value: 'Thanks. Can we do Thursday afternoon? I would like our dispatcher on the call too.' }],
    },
    { value: 'quiet', label: 'Close the tab and forget', scenario: 'quiet', events: () => [] },
  ],
  steps: [
    'The form creates the contact with their company, team size and role, and records the optional text consent.',
    'Form Submitted fires 01 · Inbound · Demo Request, where Custom Code scores the fit and picks the segment.',
    'The segment decides who gets you: enterprise to Aisha, mid-market to Ben, small teams to the weekly live demo with Priya following up. The rep hears about it in Slack within seconds.',
  ],
  notes: [
    { title: 'Qualify with the form, not a call', body: 'Team size and role are the two questions routing needs, so the form asks exactly those. Company size ranges match the Custom Code thresholds, word for word.' },
    { title: 'Work email, optional phone', body: 'B2B buyers expect email. The phone is optional and texting is opt-in with its own consent box, so nobody gets a text they did not ask for.' },
    { title: 'Round-robin calendar on the thank-you step', body: 'The Product Demo calendar is round robin across the reps, with Always Book with Assigned User on, the form first in the widget and Allow Staff Selection off, so the booking lands with the rep the routing chose. Booking straight after the form catches people while they still care.' },
    { title: 'Fast, even on a site full of scripts', body: 'Optimize JavaScript defers the chat widget and analytics until the page is interactive, and the hero is a compressed screenshot, not a video.' },
    { title: 'Source you can trust', body: 'UTM hidden fields plus GHL’s own First and Latest Attribution. The Custom Webhook to Slack includes the source, so reps know whether they are talking to a Google ad click or a referral.' },
    { title: 'One page per audience', body: 'Paid campaigns for HVAC, plumbing and cleaning companies each get a split-test variation of the headline and screenshot, measured by opt-in rate in the Stats tab.' },
  ],
};
