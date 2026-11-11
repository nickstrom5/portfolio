/**
 * Case study 1: a local home-cleaning company whose form, spreadsheet,
 * QuickBooks, calendar and Slack are joined up by three Zaps. Fictional
 * company, people, addresses and numbers (.example domains cannot resolve,
 * and 555-01xx phone numbers are reserved for examples).
 */
import type { Business, Connection, Json } from '@/lib/zapier/types';

export const business: Business = {
  id: 'cleaning',
  name: 'Maple & Main Cleaning',
  industry: 'Home cleaning',
  area: 'Columbus, Ohio',
  blurb: 'A local cleaning company: every quote request answered in a minute with a price range, an invoice sent the day a job is done, and a reminder text the day before each visit. The easiest place to start.',
  intro:
    'Maple & Main cleans about 140 homes a month around Columbus with three crews. Quote requests used to sit in the website form’s inbox until someone had a quiet hour, invoices went out in a batch on Fridays, often a week after the job, and reminder calls happened when the office remembered. Nothing here needed new software. The form, the spreadsheet, QuickBooks, the calendar and Slack were already in place, so three Zaps now pass the work between them.',
  disclaimer: 'Maple & Main Cleaning is a fictional business. The people, addresses, emails and phone numbers are samples.',
  setup:
    'One Zapier account on the Professional plan, which Paths needs; polling triggers check every 2 minutes. The Zaps sit in one folder, numbered in the order a customer meets them. Every app is connected once, by the office manager, so no Zap depends on a crew member’s login.',
  pollMinutes: 2,
  stack: ['Jotform', 'Google Sheets', 'Gmail', 'Slack', 'QuickBooks Online', 'Google Calendar', 'Twilio'],
  team: [
    { name: 'Renee Alvarado', role: 'Owner' },
    { name: 'Marcus Bell', role: 'Office manager (owns the Zaps)' },
    { name: 'Tasha Greene', role: 'Crew lead' },
    { name: 'Priya Nair', role: 'Bookkeeper, two days a week' },
  ],
  handoff: {
    'quote-request': 'Form sent → priced reply, lead logged, office told',
    'job-done': 'Job marked Done → invoice sent, review asked two days later',
    'visit-reminder': 'Day before a visit → a reminder text to the client',
  },
  tint: { light: '#b4541a', dark: '#ffb27a' },
};

export const connections: Connection[] = [
  { app: 'Jotform', icon: 'form', account: 'Maple & Main (Marcus)', use: 'The “Get a quote” form on the website. Each submission starts Zap 01.' },
  { app: 'Google Sheets', icon: 'sheet', account: 'office@mapleandmain.example', use: 'One spreadsheet, “Maple & Main Ops”, with the Leads, Jobs and Clients worksheets the office already used.' },
  { app: 'Gmail', icon: 'mail', account: 'office@mapleandmain.example', use: 'Replies to quote requests, review requests, and the fallback when a text cannot be sent.' },
  { app: 'Slack', icon: 'slack', account: 'Maple & Main workspace (Marcus)', use: 'Posts to #new-leads and #office, and messages Renee directly about recurring leads.' },
  { app: 'QuickBooks Online', icon: 'invoice', account: 'Maple & Main books (Marcus, admin)', use: 'Finds or creates the customer, then creates and sends the invoice.' },
  { app: 'Google Calendar', icon: 'calendar', account: 'office@mapleandmain.example', use: 'The “Crew schedule” calendar. An event one day away starts Zap 03.' },
  { app: 'Twilio', icon: 'sms', account: 'Office line, 614-555-0100', use: 'Sends the day-before reminder texts from the office number.' },
];

/** Sample records in the connected apps that the Zaps search. */
export const world: Record<string, Json[]> = {
  'QuickBooks customers': [
    { Id: '58', 'Display Name': 'Dana Whitfield', Email: 'dana.whitfield@example.com' },
    { Id: '61', 'Display Name': 'Gordon Pruitt', Email: 'gordon.pruitt@example.com' },
    { Id: '64', 'Display Name': 'Imani Brooks', Email: 'imani.brooks@example.com' },
  ],
  Clients: [
    { Client: 'Dana Whitfield', Email: 'dana.whitfield@example.com', Phone: '+16145550142', 'Door Notes': 'Side door. The dog is friendly.' },
    { Client: 'Gordon Pruitt', Email: 'gordon.pruitt@example.com', Phone: '+16145550177', 'Door Notes': 'Ring twice.' },
    { Client: 'Imani Brooks', Email: 'imani.brooks@example.com', Phone: '+16145550119', 'Door Notes': 'Key in the lockbox, code on file.' },
  ],
};
