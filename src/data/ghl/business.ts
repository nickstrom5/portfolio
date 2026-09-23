/**
 * The sample sub-account every automation on /ghl/ runs in. The business,
 * people, phone numbers and links are fictional: 555-01xx numbers are
 * reserved for fiction and .example domains cannot resolve.
 */
import type { Business, Contact } from '@/lib/ghl/types';
import type { MergeEnv } from '@/lib/ghl/engine';

export const business = {
  name: 'Harbor & Pine Roofing',
  industry: 'Residential roofing',
  area: 'Chicago suburbs',
  /** Shown on the page so nobody mistakes the sample for a client. */
  disclaimer: 'Harbor & Pine Roofing is a fictional company. The people, phone numbers and links are samples.',
};

export const pipeline = {
  name: 'Roofing Sales',
  stages: ['New Lead', 'Contacted', 'Inspection Booked', 'Inspected', 'Estimate Sent', 'Job Scheduled', 'Job Complete'],
};

export const env: MergeEnv = {
  location: {
    name: 'Harbor & Pine Roofing',
    phone: '(312) 555-0142',
    address: '1200 W Lake St',
    city: 'Oak Park',
    state: 'IL',
    postal_code: '60302',
    full_address: '1200 W Lake St, Oak Park, IL 60302',
    website: 'harborpine.example',
  },
  users: {
    maya: { name: 'Maya Ortiz', first_name: 'Maya', phone: '(312) 555-0161', email: 'maya@harborpine.example' },
    luis: { name: 'Luis Grant', first_name: 'Luis', phone: '(312) 555-0163', email: 'luis@harborpine.example' },
    jordan: { name: 'Jordan Blake', first_name: 'Jordan', phone: '(312) 555-0165', email: 'jordan@harborpine.example' },
    sam: { name: 'Sam Rivera', first_name: 'Sam', phone: '(312) 555-0167', email: 'sam@harborpine.example' },
  },
  customValues: {
    company_name: 'Harbor & Pine Roofing',
    office_phone: '(312) 555-0142',
    booking_link: 'harborpine.example/book',
    review_link: 'harborpine.example/review',
    feedback_link: 'harborpine.example/how-did-we-do',
    financing_link: 'harborpine.example/financing',
    referral_link: 'harborpine.example/refer',
    warranty_link: 'harborpine.example/warranty',
    owner_first_name: 'Jordan',
    owner_name: 'Jordan Blake',
    production_manager: 'Sam Rivera',
  },
  triggerLinks: {
    financing: 'harborpine.example/l/financing',
    reviews: 'harborpine.example/l/review',
  },
};

/** Who does what in the sample account. Used by the page and by the automations' copy. */
export const team = [
  { key: 'maya', name: 'Maya Ortiz', role: 'Estimator (sales)' },
  { key: 'luis', name: 'Luis Grant', role: 'Estimator (sales)' },
  { key: 'jordan', name: 'Jordan Blake', role: 'Owner and office manager' },
  { key: 'sam', name: 'Sam Rivera', role: 'Production manager' },
];

/** The default test contact. Scenarios override what they need. */
export const sampleContact: Contact = {
  firstName: 'Dana',
  lastName: 'Whitfield',
  phone: '(312) 555-0199',
  email: 'dana.w@example.com',
  timezone: 'America/Chicago',
  source: 'Website form',
  tags: [],
  dnd: {},
  fields: {},
};

/** Custom fields shown on the simulator's contact record, in this order. */
export const fieldLabels: Record<string, string> = {
  service_needed: 'Service needed',
  roof_age: 'Roof age',
  sms_consent: 'SMS consent (service)',
  sms_marketing_consent: 'SMS consent (offers)',
  lead_score: 'Lead score',
  call_priority: 'Call priority',
  utm_source: 'UTM source',
  utm_campaign: 'UTM campaign',
  estimate_amount: 'Estimate',
  job_date: 'Job date',
  satisfaction: 'Satisfaction',
  reply_intent: 'Reply intent',
};

/** The roofing company as a case study (the exports above stay for the workflow files). */
export const roofingBusiness: Business = {
  id: 'roofing',
  name: business.name,
  industry: 'Residential roofing',
  area: 'Chicago suburbs',
  blurb: 'A local roofer that lives on the phone: speed to lead, missed calls, inspections, estimates, reviews.',
  intro:
    'Harbor & Pine is a local roofing company with two estimators, an office manager and a production crew. Leads came from the website, Facebook and the phone, and too many went cold before anyone called back. The owner needed every lead answered in seconds, inspections that people actually show up to, estimates that get a decision, a clean hand-off to the crew, and reviews from every finished job.',
  disclaimer: business.disclaimer,
  pipeline,
  team,
  env,
  sampleContact,
  fieldLabels,
  handoff: {
    'speed-to-lead': 'New Lead, then a person on reply',
    'missed-call': 'New Lead from a missed call',
    'inspection-booked': 'Inspection Booked → Inspected',
    'estimate-follow-up': 'Estimate Sent → Won',
    'job-handoff': 'Job Scheduled → Job Complete',
    'reviews-referrals': 'Review and referral asks',
    reactivation: 'Old leads back to New Lead',
  },
  tint: { light: '#1d6b4f', dark: '#6fd1a6' },
};
