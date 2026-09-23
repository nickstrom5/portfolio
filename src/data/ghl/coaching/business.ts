/**
 * Case study 3: an online coaching business that sells a course and 1:1
 * coaching through a free workshop. Fictional business, people, numbers and
 * links (555-01xx numbers are reserved for fiction; .example domains cannot
 * resolve).
 */
import type { Business } from '@/lib/ghl/types';
import { nextDayAt } from '@/lib/ghl/engine';

/** The free workshop runs every Thursday at 7 PM (contact's time zone in the sample). */
export const WORKSHOP = { dow: 3, minute: 19 * 60, lengthMinutes: 60 };

/** The next workshop at least two hours after `from`, as the Event Start Date step would set it. */
export function nextWorkshop(from: number): number {
  return nextDayAt(from, WORKSHOP.dow, WORKSHOP.minute, 120);
}

export const business: Business = {
  id: 'coaching',
  name: 'Trailhead Career Coaching',
  industry: 'Online coaching and courses',
  area: 'Online, US and Canada',
  blurb: 'An online coach who runs on funnels and payments: a free workshop, a $497 course and an application for 1:1 coaching.',
  intro:
    'Trailhead helps mid-career professionals change fields. People find it through a free weekly workshop, buy a self-paced course, and the best fits apply for 1:1 coaching. The founder needed the workshop to fill and show up, abandoned checkouts recovered, new students actually started, failed payments chased politely, and applications routed to the enrollment advisor without anyone copying data between tools.',
  disclaimer: 'Trailhead Career Coaching is a fictional business. The people, phone numbers, prices and links are samples.',
  pipeline: { name: 'Enrollment', stages: ['Registered', 'Attended', 'Checkout Started', 'Customer', 'Applied', 'Call Booked', 'Coaching Client'] },
  team: [
    { key: 'morgan', name: 'Morgan Hale', role: 'Founder and head coach' },
    { key: 'devon', name: 'Devon Brooks', role: 'Enrollment advisor' },
    { key: 'sasha', name: 'Sasha Kim', role: 'Operations and billing' },
    { key: 'jules', name: 'Jules Ortega', role: 'Student success' },
  ],
  env: {
    location: {
      name: 'Trailhead Career Coaching',
      phone: '(312) 555-0130',
      address: '222 W Merchandise Mart Plaza, Suite 1200, Chicago, IL',
      city: 'Chicago',
      website: 'trailheadcareers.example',
    },
    users: {
      morgan: { name: 'Morgan Hale', first_name: 'Morgan', phone: '(312) 555-0131', email: 'morgan@trailheadcareers.example' },
      devon: { name: 'Devon Brooks', first_name: 'Devon', phone: '(312) 555-0133', email: 'devon@trailheadcareers.example' },
      sasha: { name: 'Sasha Kim', first_name: 'Sasha', phone: '(312) 555-0135', email: 'sasha@trailheadcareers.example' },
      jules: { name: 'Jules Ortega', first_name: 'Jules', phone: '(312) 555-0137', email: 'jules@trailheadcareers.example' },
    },
    customValues: {
      company_name: 'Trailhead Career Coaching',
      support_email: 'help@trailheadcareers.example',
      workshop_title: 'The Career Pivot Plan',
      course_name: 'Career Pivot Blueprint',
      course_price: '$497',
      payment_plan: '3 payments of $179',
      course_login: 'trailheadcareers.example/portal',
      update_card_link: 'trailheadcareers.example/billing',
      refund_policy: '14-day money-back guarantee',
      coaching_name: '1:1 Pivot Coaching',
      call_booking_link: 'trailheadcareers.example/strategy-call',
      testimonial_link: 'trailheadcareers.example/share',
      founder_first_name: 'Morgan',
    },
    triggerLinks: {
      join: 'trailheadcareers.example/l/join',
      replay: 'trailheadcareers.example/l/replay',
      checkout: 'trailheadcareers.example/l/checkout',
      apply: 'trailheadcareers.example/l/apply',
    },
  },
  sampleContact: {
    firstName: 'Marcus',
    lastName: 'Lee',
    phone: '(312) 555-0177',
    email: 'marcus.lee@example.com',
    timezone: 'America/Chicago',
    source: 'Workshop page',
    tags: [],
    dnd: {},
    fields: {},
  },
  fieldLabels: {
    current_role: 'Current role',
    goal: 'Goal',
    sms_consent: 'SMS consent',
    sms_marketing_consent: 'Marketing texts',
    workshop_date: 'Workshop',
    attended: 'Attended live',
    purchase: 'Purchase',
    payment_plan: 'Payment plan',
    course_progress: 'Course progress',
    application_score: 'Application score',
    reply_intent: 'Reply intent',
  },
  handoff: {
    webinar: 'Registered → attended, or the replay',
    'cart-recovery': 'Checkout Started → Customer',
    onboarding: 'Customer → started the course',
    'failed-payment': 'Failed payment → recovered',
    application: 'Applied → Call Booked',
    completion: 'Course completed → testimonial, upgrade',
  },
  tint: { light: '#b4531a', dark: '#f5a25d' },
};
