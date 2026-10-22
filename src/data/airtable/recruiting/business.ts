/**
 * Case study 3: a small recruiting firm running its pipeline, from
 * application to placement and invoice, in Airtable. Fictional company,
 * people, roles, salaries and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/airtable/types';

export const business: Business = {
  id: 'recruiting',
  name: 'Larkspur Talent',
  industry: 'Recruiting (finance and operations roles)',
  area: 'Denver, Colorado; clients across the Mountain West',
  blurb: 'A four-person search firm: every applicant matched to one candidate record, each stage change sending the right email, and placements turned into invoices, guarantee check-ins and overdue-payment reminders.',
  intro:
    'Larkspur places controllers, FP&A managers and operations leaders with mid-size companies, about 30 placements a year. Its pipeline lived in a spreadsheet per role, so a candidate who applied twice was two strangers, stage emails were typed fresh each time, and the fee for a placement was worked out from a calculator when Leo remembered to invoice. The base links clients, roles, candidates, applications and placements, so a fee is computed the moment someone is placed and rolls up to the client.',
  disclaimer: 'Larkspur Talent is a fictional business. The people, clients, roles, salaries, fees and links are samples.',
  setup: 'One base, “Larkspur Desk”, on the Team plan. Recruiters work from a Kanban interface page; Leo works from a billing dashboard. The public apply form is an Airtable form opened from each role’s own link, with the role filled in and hidden.',
  stack: ['Airtable form', 'Airtable automations', 'Interfaces', 'Scripting', 'Slack'],
  team: [
    { name: 'Nadia Hassan', role: 'Founder and senior recruiter', email: 'nadia@larkspurtalent.example' },
    { name: 'Owen Fitch', role: 'Recruiter', email: 'owen@larkspurtalent.example' },
    { name: 'Grace Kim', role: 'Recruiting coordinator', email: 'grace@larkspurtalent.example' },
    { name: 'Leo Marsh', role: 'Operations and billing (owns the base)', email: 'leo@larkspurtalent.example' },
  ],
  handoff: {
    'new-application': 'Applies → one candidate record, acknowledged',
    'stage-change': 'Stage moves → the email that stage needs',
    'guarantee-checkins': 'Every morning → check-ins and overdue invoices',
  },
  tint: { light: '#6b3fa6', dark: '#c9a8ff' },
};
