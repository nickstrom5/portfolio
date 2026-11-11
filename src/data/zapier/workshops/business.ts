/**
 * Case study 3: a small company that sells seats at live online workshops.
 * Stripe, Zoom, a spreadsheet and Mailchimp are joined up by three Zaps.
 * Fictional company, people, workshops and links.
 */
import type { Business, Connection, Json } from '@/lib/zapier/types';

export const business: Business = {
  id: 'workshops',
  name: 'Fieldnote Workshops',
  industry: 'Live online training',
  area: 'Remote; attendees across the US and Canada',
  blurb: 'A three-person training company running paid workshops on Zoom: a paid seat becomes a Zoom registration in seconds, everyone gets their link again the day before, and afterwards attendees and no-shows each get the right email.',
  intro:
    'Fieldnote runs 90-minute live workshops for nonprofit fundraisers, two or three a month, with 40 to 120 people in each. A seat is bought through a Stripe payment link. Until this year the founder registered each buyer in Zoom by hand from Stripe’s receipt emails, usually the same evening, so people who paid at the last minute sometimes had no link when the session began. After a workshop, the recording went out to everyone in one email that thanked the people who had missed it for coming. Three Zaps now cover the path from payment to follow-up.',
  disclaimer: 'Fieldnote Workshops is a fictional business. The people, workshops, emails and links are samples.',
  setup:
    'One Zapier account on the Professional plan, which Paths and Looping need; polling triggers check every 2 minutes. The Zaps are numbered in the order an attendee meets them, and all six apps are connected by the operations lead with the company’s shared logins.',
  pollMinutes: 2,
  stack: ['Stripe', 'Zoom', 'Google Sheets', 'Slack', 'Mailchimp', 'Gmail'],
  team: [
    { name: 'Nadia Farouk', role: 'Founder and lead trainer' },
    { name: 'Jules Bennett', role: 'Operations (owns the Zaps)' },
    { name: 'Ama Owusu', role: 'Community and support' },
  ],
  handoff: {
    'paid-seat': 'Payment → Zoom seat, roster row, team told',
    'day-before': 'New registrant → their link again, a day ahead',
    'after-workshop': 'Recording ready → one email each, by who came',
  },
  tint: { light: '#6b4bc4', dark: '#c3b0ff' },
};

export const connections: Connection[] = [
  { app: 'Stripe', icon: 'card', account: 'Fieldnote (live mode, restricted key)', use: 'One payment link per workshop. A completed checkout starts Zap 01.' },
  { app: 'Zoom', icon: 'video', account: 'workshops@fieldnote.example (Webinars licence)', use: 'Registers each buyer for their webinar; new registrants and finished recordings start Zaps 02 and 03.' },
  { app: 'Google Sheets', icon: 'sheet', account: 'ops@fieldnote.example', use: 'The Attendees worksheet: one row per paid seat, read back after the workshop.' },
  { app: 'Slack', icon: 'slack', account: 'Fieldnote workspace (ops)', use: 'A line in #registrations for each seat sold.' },
  { app: 'Mailchimp', icon: 'megaphone', account: 'Fieldnote audience (ops)', use: 'Adds buyers who asked to hear about new dates, tagged with the workshop they bought.' },
  { app: 'Gmail', icon: 'mail', account: 'hello@fieldnote.example', use: 'The day-before email and the follow-ups after each workshop.' },
];

/** Each workshop's Zoom webinar and start time, by the name its Stripe payment link carries. */
export const WORKSHOPS: Record<string, { zoom: string; starts: string }> = {
  'Grant budgets that get funded': { zoom: '86120450917', starts: '2026-03-05T13:00:00' },
  'Year-end appeals that work': { zoom: '84477201563', starts: '2026-03-04T12:00:00' },
};

/** Sample records in the connected apps that the Zaps search. */
export const world: Record<string, Json[]> = {
  Attendees: [
    { Workshop: 'Grant budgets that get funded', Name: 'Renata Silva', Email: 'renata.silva@example.com' },
    { Workshop: 'Grant budgets that get funded', Name: 'Kwame Mensah', Email: 'kwame.mensah@example.com' },
    { Workshop: 'Grant budgets that get funded', Name: 'Beth Lindqvist', Email: 'beth.lindqvist@example.com' },
    { Workshop: 'Grant budgets that get funded', Name: 'Arjun Rao', Email: 'arjun.rao@example.com' },
    { Workshop: 'Year-end appeals that work', Name: 'Mei Tanaka', Email: 'mei.tanaka@example.com' },
    { Workshop: 'Year-end appeals that work', Name: 'Luis Ortega', Email: 'luis.ortega@example.com' },
  ],
  'Zoom participants': [
    { 'Webinar ID': '86120450917', Email: 'renata.silva@example.com' },
    { 'Webinar ID': '86120450917', Email: 'kwame.mensah@example.com' },
    { 'Webinar ID': '86120450917', Email: 'arjun.rao@example.com' },
  ],
};
