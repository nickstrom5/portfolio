/**
 * Case study 2: a residential solar company's sales team. Ad leads, booked
 * consultations and HubSpot are joined up by three Zaps. Fictional company,
 * people, addresses and numbers.
 */
import type { Business, Connection, Json } from '@/lib/zapier/types';

export const business: Business = {
  id: 'solar',
  name: 'Kettlebrook Solar',
  industry: 'Residential solar sales',
  area: 'Arizona, Nevada and New Mexico',
  blurb: 'A 30-person sales team: ad leads in HubSpot with an owner and a call-now message in under a minute, booked consultations turned into deals, and one end-of-day roundup instead of forty pings.',
  intro:
    'Kettlebrook sells and installs home solar in three states, with thirty people in sales. Leads from Facebook lead ads were downloaded as a spreadsheet twice a day and shared out by hand, so a homeowner who asked for an estimate at nine might hear back at four. Consultations booked in Calendly were retyped into HubSpot when someone had a minute, and managers learned what had been booked by asking around. Three Zaps now do the carrying: each lead reaches the right territory at once, each booking becomes a deal, and the day’s bookings arrive as one message.',
  disclaimer: 'Kettlebrook Solar is a fictional business. The people, emails, phone numbers and HubSpot records are samples.',
  setup:
    'One Zapier account on the Team plan, so the Zaps, folders and app connections are shared and no Zap stops when one person leaves; polling triggers check every minute. HubSpot, Slack and Calendly are each connected once with a service login owned by sales operations.',
  pollMinutes: 1,
  stack: ['Facebook Lead Ads', 'HubSpot', 'Slack', 'Calendly', 'Gmail'],
  team: [
    { name: 'Monica Reyes', role: 'VP of sales' },
    { name: 'Darius Cole', role: 'Sales operations (owns the Zaps)' },
    { name: 'Elena Park', role: 'Territory lead, Arizona' },
    { name: 'Tom Whitaker', role: 'Territory lead, Nevada' },
    { name: 'Sofia Marin', role: 'Territory lead, New Mexico' },
  ],
  handoff: {
    'lead-routing': 'Ad lead → HubSpot contact with an owner, rep told at once',
    'consult-booked': 'Calendly booking → HubSpot deal, team told, added to the day’s list',
    'daily-roundup': 'Weekdays at 5:30 → the day’s bookings in one message',
  },
  tint: { light: '#1d6f5f', dark: '#7fdcc7' },
};

export const connections: Connection[] = [
  { app: 'Facebook Lead Ads', icon: 'megaphone', account: 'Kettlebrook Solar page (sales ops)', use: 'The “Free solar estimate” lead form. Each new lead starts Zap 01.' },
  { app: 'HubSpot', icon: 'crm', account: 'zapier@kettlebrook.example (service login)', use: 'Contacts and deals. The Zaps find or create both, set the owner and add notes.' },
  { app: 'Slack', icon: 'slack', account: 'Kettlebrook workspace (sales ops bot)', use: 'Direct messages to territory leads, and posts to #consults, #sales-ops and #sales-floor.' },
  { app: 'Calendly', icon: 'calendar', account: 'Kettlebrook team account (sales ops)', use: 'Home solar consultations. A new or moved booking starts Zap 02.' },
  { app: 'Gmail', icon: 'mail', account: 'salesops@kettlebrook.example', use: 'The end-of-day roundup to the VP of sales.' },
];

/** Who gets a state's leads: the name, their HubSpot owner ID and their Slack member ID. */
export const TERRITORY: Record<string, { lead: string; hubspot: string; slack: string }> = {
  Arizona: { lead: 'Elena Park', hubspot: '71820455', slack: 'U04EPARK' },
  Nevada: { lead: 'Tom Whitaker', hubspot: '71820467', slack: 'U04TWHIT' },
  'New Mexico': { lead: 'Sofia Marin', hubspot: '71820471', slack: 'U04SMARI' },
};
/** Leads from anywhere else wait in sales operations' queue. */
export const QUEUE = { lead: 'Darius Cole (sales ops queue)', hubspot: '71820002', slack: 'U04DCOLE' };

/** Sample records in the connected apps that the Zaps search. */
export const world: Record<string, Json[]> = {
  'HubSpot contacts': [
    { Id: '30114', Email: 'marcus.lee@example.com', 'First Name': 'Marcus', 'Last Name': 'Lee', State: 'Nevada', 'Contact Owner': 'Tom Whitaker', 'Lead Status': 'Attempted to contact' },
    { Id: '30127', Email: 'priya.shah@example.com', 'First Name': 'Priya', 'Last Name': 'Shah', State: 'Arizona', 'Contact Owner': 'Elena Park', 'Lead Status': 'Consult booked' },
  ],
  'HubSpot deals': [{ Id: '8841', 'Deal Name': 'Solar consult · Priya Shah', 'Deal Stage': 'Consult booked', 'Deal Owner': 'Elena Park', 'Consult Date': '2026-03-04T15:00:00' }],
};
