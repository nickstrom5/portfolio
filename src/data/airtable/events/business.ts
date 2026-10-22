/**
 * Case study 1: a small conference company running its speaker program in
 * Airtable. Fictional company, people, sessions and links (.example domains
 * cannot resolve).
 */
import type { Business } from '@/lib/airtable/types';

export const business: Business = {
  id: 'events',
  name: 'Brightwater Summits',
  industry: 'Conferences and events',
  area: 'Portland, Oregon; events across the Pacific Northwest',
  blurb: 'A six-person conference team: speaker pitches matched to speakers and acknowledged in a minute, accepted talks turned into tasks, and a Monday chase for missing slides that names names.',
  intro:
    'Brightwater runs a two-day summit on running greener operations each spring, plus half-day workshops around the region. Around 120 people pitch a talk each year and about 40 get a slot. Pitches used to arrive through a survey tool, land in a spreadsheet, and get answered by hand weeks later; slides were chased in reply-all threads until the night before. Now one Airtable base holds the program: pitches, speakers, events and the tasks that get a session on stage, with three automations doing the follow-up.',
  disclaimer: 'Brightwater Summits is a fictional business. The people, sessions, emails and links are samples.',
  setup: 'One base, “Brightwater Program”, on the Team plan. The team edits it directly; outside reviewers see only an interface page with the pitches to score. Slack is connected through the automation’s own Slack action, so nothing else needs to run.',
  stack: ['Airtable form', 'Airtable automations', 'Interfaces', 'Scripting', 'Slack', 'Synced table'],
  team: [
    { name: 'Priya Raman', role: 'Program director', email: 'priya@brightwatersummits.example' },
    { name: 'Hannah Lee', role: 'Speaker coordinator', email: 'hannah@brightwatersummits.example' },
    { name: 'Dev Castillo', role: 'Event producer', email: 'dev@brightwatersummits.example' },
    { name: 'Marcus Webb', role: 'Operations (owns the base)', email: 'marcus@brightwatersummits.example' },
  ],
  handoff: {
    'new-pitch': 'Pitch sent → speaker matched, thanked, team told',
    'pitch-accepted': 'Accepted → tasks for slides, travel and room',
    'slides-chase': 'Every Monday → one digest and one nudge per speaker',
  },
  tint: { light: '#0b6f8a', dark: '#7fd0ea' },
};
