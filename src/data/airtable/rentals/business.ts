/**
 * Case study 2: a film-equipment rental house tracking assets, repairs,
 * supplies and vendors in Airtable. Fictional company, people, gear prices
 * and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/airtable/types';

export const business: Business = {
  id: 'rentals',
  name: 'Kestrel Grip & Lighting',
  industry: 'Equipment rental (film and video)',
  area: 'Atlanta, Georgia',
  blurb: 'A rental house with about 1,400 pieces of gear: damaged items pulled from the shelf the minute they are reported, supplies reordered before they run out, and double bookings caught the night before instead of at pickup.',
  intro:
    'Kestrel rents cameras, lenses, lights and grip to film and TV productions around Atlanta. Every piece of gear has an asset tag, and the warehouse crew of five checks it out and back in. The problems were the expensive kind: a light with a frayed cable went back on the shelf because the note about it was on a whiteboard; the warehouse ran out of gaffer tape mid-week; and twice a year two productions turned up for the same light. The base tracks the assets, bookings, repairs and supplies, with the vendor list synced in from the finance team’s base.',
  disclaimer: 'Kestrel Grip & Lighting is a fictional business. The people, productions, gear, prices and links are samples.',
  setup: 'One base, “Kestrel Inventory”, on the Team plan. The rental desk and the owner edit it; the warehouse crew are interface-only collaborators who count, check in and report damage from a tablet without seeing prices. Vendors come in as a synced table from the finance base, so there is one list of approved vendors and their addresses.',
  stack: ['Airtable form', 'Airtable automations', 'Interfaces', 'Scripting', 'Synced table', 'Slack'],
  team: [
    { name: 'Rosa Delgado', role: 'Owner', email: 'rosa@kestrelgrip.example' },
    { name: 'Andre Mills', role: 'Rental desk lead', email: 'andre@kestrelgrip.example' },
    { name: 'Kim Tran', role: 'Warehouse and repairs', email: 'kim@kestrelgrip.example' },
    { name: 'Jordan Price', role: 'Operations (owns the base)', email: 'jordan@kestrelgrip.example' },
  ],
  handoff: {
    'damage-report': 'Damage reported → off the shelf, vendor asked, desk warned',
    reorder: 'Count drops → purchase order and vendor email',
    'conflict-check': 'Every night → double bookings flagged',
  },
  tint: { light: '#a14700', dark: '#f5b16a' },
};
