/**
 * Case study 3: a booking-software company that runs n8n in queue mode
 * next to its own product: AI support triage, a nightly product-usage sync
 * to the CRM, and failed-payment follow-up. Fictional company, people,
 * numbers and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/n8n/types';

export const business: Business = {
  id: 'saas',
  name: 'Slotwise',
  industry: 'Business software (SaaS)',
  area: 'Remote team; salons, studios and clinics in the US and UK',
  blurb: 'A booking-software company: support tickets triaged by an AI classifier and routed in seconds, product usage synced to HubSpot every night in rate-limited batches, and failed payments followed up before they turn into churn. The most technical of the three.',
  intro:
    'Slotwise sells online booking and reminders to about 3,000 salons, yoga studios and physio clinics, from $39 to $400 a month. Support is four people, success is two, and the RevOps lead also owns n8n. They needed tickets sorted before a person read them, sales and success to see real product usage in HubSpot instead of guessing, and a failed card on a big account to reach a human before Stripe gave up on it. n8n runs inside Slotwise’s own cloud account, next to the product database it reads.',
  disclaimer: 'Slotwise is a fictional software company. The people, accounts, tickets, amounts and links are samples.',
  hosting: 'Self-hosted in Slotwise’s AWS account in queue mode: a main instance for the editor and webhooks, two workers that take executions from Redis, and Postgres for n8n’s data. Reading the product database never leaves the private network.',
  stack: ['In-app support form (webhook)', 'Postgres (read replica)', 'OpenAI', 'Zendesk', 'Jira', 'HubSpot', 'Stripe', 'Slack'],
  team: [
    { name: 'Nadia Hussain', role: 'RevOps lead (owns n8n)' },
    { name: 'Felix Grant', role: 'Head of support' },
    { name: 'Chloe Martin', role: 'Customer success, large accounts' },
    { name: 'Omar Haddad', role: 'Customer success, growth accounts' },
    { name: 'Ravi Menon', role: 'Engineering lead, on call' },
  ],
  env: {
    baseUrl: 'https://n8n.slotwise.example',
    vars: {
      api_base: 'https://api.slotwise.example/internal',
      incidents_channel: '#incidents',
      revops_channel: '#revops',
      success_channel: '#success',
      jira_project: 'SUP',
    },
  },
  handoff: {
    'support-triage': 'Ticket → classified, routed, flagged',
    'usage-sync': 'Every night → usage on every HubSpot company',
    'failed-payment': 'Card fails → customer told, CSM if it matters',
  },
  tint: { light: '#4338ca', dark: '#a5b4fc' },
};
