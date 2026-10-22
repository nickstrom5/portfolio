/**
 * Case study 2: a remote bookkeeping firm that self-hosts n8n to onboard
 * clients, chase their documents and report its own failures. Fictional
 * firm, people, clients and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/n8n/types';

export const business: Business = {
  id: 'bookkeeping',
  name: 'Ledgerline Bookkeeping',
  industry: 'Professional services (bookkeeping)',
  area: 'Remote team, small-business clients across the US',
  blurb: 'A bookkeeping firm that self-hosts n8n: new clients set up in a minute from one form, a document chase that waits days for a click and escalates when nobody answers, and an error workflow that tells the right person when anything breaks.',
  intro:
    'Ledgerline keeps the books for about 140 small businesses: plumbers, dental practices, a few restaurants. Every new client used to mean forty minutes of setup (a Drive folder, a row in the client list, a task for the bookkeeper, a welcome email) and then two weeks of “did you get a chance to send those statements?” emails. The founder wanted onboarding to start itself, document chasing to stop depending on someone’s memory, and to hear about a broken automation before a client did.',
  disclaimer: 'Ledgerline Bookkeeping is a fictional firm. The people, clients, emails and links are samples.',
  hosting: 'Self-hosted with Docker on one small cloud server, behind HTTPS, with Postgres for n8n’s own data. Client documents pass through Ledgerline’s server and Google Workspace and nothing else, which is how the firm’s engagement letter describes it. Tom updates n8n monthly after reading the release notes.',
  stack: ['Website form (webhook)', 'Google Drive', 'Google Sheets', 'ClickUp', 'Gmail', 'Slack'],
  team: [
    { name: 'Hannah Mercer', role: 'Founder' },
    { name: 'Grace Kim', role: 'Senior bookkeeper' },
    { name: 'Marcus Bell', role: 'Payroll specialist' },
    { name: 'Ines Duarte', role: 'Catch-up and cleanup' },
    { name: 'Tom Reyes', role: 'Client success (owns n8n)' },
  ],
  env: {
    baseUrl: 'https://n8n.ledgerline.example',
    vars: {
      clients_folder: 'Ledgerline / Clients',
      onboarding_list: 'Onboarding',
      ops_channel: '#ops',
      onboarding_channel: '#onboarding',
      thanks_page: 'https://ledgerline.example/documents-received',
    },
  },
  handoff: {
    'client-onboarding': 'Signed client → folder, task, welcome',
    'document-chase': 'Welcome → documents in, or a call',
    'error-handler': 'Any failure → the right person, once',
  },
  tint: { light: '#0f6e5a', dark: '#6fd6bd' },
};
