/**
 * Case study 3: a recruiting agency that uses n8n between its careers page,
 * an Airtable candidate base, Calendly and its clients. Fictional agency,
 * people, candidates, clients and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/n8n/types';

export const business: Business = {
  id: 'recruiting',
  name: 'Harrow & Finch Recruiting',
  industry: 'Recruiting agency',
  area: 'Chicago; places finance and operations roles across the Midwest',
  blurb: 'A recruiting agency: every application read by an AI step and matched to the role in seconds, screening calls briefed before the recruiter picks up, and a Monday pipeline report to every client without anyone writing one.',
  intro:
    'Harrow & Finch places accountants, controllers and operations managers with mid-size companies, about 25 open searches at a time. Six recruiters, and each role draws 80 to 200 applications. The founder wanted strong candidates to hear back the same day instead of next week, recruiters to stop retyping résumés into Airtable, and clients to get a pipeline update every Monday without a recruiter losing their morning to it. Recruiters make every hiring call; n8n only sorts, files and reminds.',
  disclaimer: 'Harrow & Finch Recruiting is a fictional agency. The people, candidates, clients, roles and links are samples.',
  hosting: 'n8n Cloud, Pro plan: no server to run, and execution history long enough to answer “when did we email this candidate?” months later.',
  stack: ['Careers page (webhook)', 'OpenAI', 'Airtable (candidates and jobs)', 'Calendly', 'Google Docs', 'Gmail', 'Slack'],
  team: [
    { name: 'Dana Whitlock', role: 'Founder and managing partner' },
    { name: 'Marcus Lee', role: 'Recruiter, accounting and finance' },
    { name: 'Priya Raman', role: 'Recruiter, operations' },
    { name: 'Jo Alvarez', role: 'Recruiting coordinator (owns n8n)' },
  ],
  env: {
    baseUrl: 'https://harrowfinch.app.n8n.cloud',
    vars: {
      calendly_link: 'calendly.example/harrowfinch/screen',
      careers_page: 'harrowfinch.example/jobs',
      team_channel: '#recruiting',
    },
  },
  handoff: {
    'application-intake': 'Application → read, matched, answered',
    'screen-booked': 'Call booked → recruiter briefed',
    'client-pipeline': 'Every Monday → each client’s pipeline',
  },
  tint: { light: '#7c3aed', dark: '#c4b5fd' },
};
