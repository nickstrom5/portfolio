import type { LandingPage } from '@/lib/ghl/types';
import { nextWorkshop } from './business';

export const landing: LandingPage = {
  url: 'trailheadcareers.example/pivot-plan',
  brand: {
    name: 'Trailhead Career Coaching',
    logo: 'peak',
    colors: { primary: '#1f2a44', primaryDark: '#141c30', bg: '#f6f4ef', accent: '#f2a541', accentInk: '#1b1405', ink: '#1a1f2b', muted: '#565d6d', logo: '#f2a541' },
  },
  kicker: 'Free live workshop · Thursdays, 7 PM Central',
  headline: 'Change careers without starting over.',
  sub: 'A free 60-minute workshop for mid-career professionals: how to map the skills you already have to a new field, and a 90-day plan to make the move.',
  points: ['Live Q&A with coach Morgan Hale', 'Replay for 48 hours if you cannot make it', 'Free, no credit card'],
  formTitle: 'Save my seat',
  submitLabel: 'Register free',
  fields: [
    { name: 'first', label: 'First name', type: 'text', required: true, autocomplete: 'given-name', half: true, maps: 'firstName' },
    { name: 'last', label: 'Last name', type: 'text', autocomplete: 'family-name', maps: 'lastName' },
    { name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', maps: 'email' },
    { name: 'phone', label: 'Mobile phone (for text reminders)', type: 'tel', autocomplete: 'tel', placeholder: '(312) 555-0100', maps: 'phone' },
    {
      name: 'role',
      label: 'Where are you now?',
      type: 'select',
      options: ['Individual contributor', 'Manager', 'Senior leader', 'Between roles'],
      initial: 'Individual contributor',
      maps: { field: 'current_role' },
    },
    {
      name: 'goal',
      label: 'What do you want next?',
      type: 'select',
      required: true,
      options: ['A new industry', 'A new role', 'Freelancing', 'Not sure yet'],
      maps: { field: 'goal' },
    },
  ],
  consent: {
    transactional: 'Text me workshop reminders and, if I enroll, course and billing notices from Trailhead Career Coaching. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.',
    marketing: 'Also text me about future workshops and offers. Reply STOP to opt out.',
    fine: 'Consent is optional and not a condition of purchase. Privacy Policy · Terms of Service',
  },
  thanks: {
    title: 'You are in, {first}.',
    body: 'Step 2 of 2: the confirmation page. In the live funnel it shows the workshop time in your time zone, add-to-calendar buttons and a short welcome video from Morgan.',
    slots: ['Add to Google Calendar', 'Add to Outlook'],
  },
  feeds: 'webinar',
  trigger: 0,
  textWindow: { start: '08:00', end: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
  demoNote: 'It runs at your local time, and every reminder counts back from the next Thursday at 7 PM, so the log jumps to that evening.',
  behaviors: [
    {
      value: 'attends',
      label: 'Show up live',
      scenario: 'attends',
      events: ({ start }) => [{ at: nextWorkshop(start) - start + 3, type: 'link_clicked', value: 'join', label: 'Workshop Join, three minutes in' }],
    },
    {
      value: 'replay',
      label: 'Miss it, watch the replay',
      scenario: 'replay',
      events: ({ start }) => [{ at: nextWorkshop(start) - start + 20 * 60, type: 'link_clicked', value: 'replay', label: 'Workshop Replay, from the replay email' }],
    },
    { value: 'no-show', label: 'Register and forget', scenario: 'no-show', events: () => [] },
  ],
  steps: [
    'The form creates the contact, saves their current role and goal, and records which consent boxes they ticked.',
    'Form Submitted fires 01 · Workshop · Registration and Reminders, which sets the workshop date with Event Start Date.',
    'Reminders count back from that date: an email the day before, a text an hour before if you ticked the box, and the replay if you miss it.',
  ],
  notes: [
    { title: 'One promise, no income claims', body: 'The headline promises a plan, not a salary. The FTC treats earnings claims as claims that need proof, so the page and every follow-up avoid them.' },
    { title: 'Two questions that earn their place', body: 'Current role and goal go on the contact record, so Devon sees them in every alert about this person, and the role feeds the readiness score if they apply for coaching later.' },
    { title: 'Phone optional, texts opt-in', body: 'Email is required, the phone is not. The text box is unticked and optional and says what the texts cover, and ticking it without a number asks for one.' },
    { title: 'A confirmation page that works', body: 'The workshop time in the visitor’s time zone, add-to-calendar buttons and a request to reply to the welcome email, which helps the next emails reach the inbox.' },
    { title: 'Order form on the offer step', body: 'The page after the workshop uses a Two-Step Order form with an order bump. Order Form Submission fires on submit and Order Submitted only on payment, which is what makes cart recovery possible.' },
    { title: 'Tracking that counts sales, not clicks', body: 'The Meta Pixel and Conversions API send registrations and purchases from both browser and server with deduplication, so ad reporting survives browsers that block pixels.' },
  ],
};
