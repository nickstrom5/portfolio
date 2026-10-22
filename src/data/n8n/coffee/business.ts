/**
 * Case study 1: a small coffee roaster that sells online and to cafés, with
 * n8n joining Shopify, HubSpot, Google Sheets and Slack. Fictional company,
 * people, numbers and links (.example domains cannot resolve).
 */
import type { Business } from '@/lib/n8n/types';

export const business: Business = {
  id: 'coffee',
  name: 'Copperleaf Coffee Roasters',
  industry: 'Online store and wholesale (Shopify)',
  area: 'Asheville, North Carolina; ships across the US',
  blurb: 'A small roaster with a Shopify store and a growing café list: wholesale leads scored and answered in a minute, every paid order turned into roast tickets, and a morning stock check that only speaks up when something is low.',
  intro:
    'Copperleaf roasts about 900 pounds a week: retail bags and subscriptions through Shopify, plus 40 cafés and restaurants on wholesale. Nine people, one roaster, and nobody whose job is IT. The owner wanted three things off her plate: wholesale inquiries that sat in an inbox for days, a roast schedule copied by hand from Shopify every morning, and running out of a best-seller because nobody looked at stock until it hit zero. n8n Cloud runs the glue, so there is no server to look after.',
  disclaimer: 'Copperleaf Coffee Roasters is a fictional business. The people, orders, prices, emails and links are samples.',
  hosting: 'n8n Cloud, Starter plan. The workload is a few hundred executions a day, so a hosted instance costs less than anyone’s time spent patching a server.',
  stack: ['n8n Form', 'Shopify', 'HubSpot (free CRM)', 'Google Sheets', 'Google Drive', 'Gmail', 'Slack'],
  team: [
    { name: 'Maya Okoye', role: 'Owner and wholesale lead' },
    { name: 'Theo Brandt', role: 'Head roaster' },
    { name: 'Jess Liang', role: 'Packing and shipping' },
    { name: 'Sam Ortiz', role: 'Operations (owns n8n)' },
  ],
  env: {
    baseUrl: 'https://copperleaf.app.n8n.cloud',
    vars: {
      wholesale_channel: '#wholesale',
      packing_channel: '#packing',
      ops_channel: '#ops',
      price_list_file: 'Copperleaf Wholesale Price List 2026.pdf',
      booking_link: 'copperleaf.example/wholesale-call',
    },
  },
  handoff: {
    'wholesale-inquiry': 'Café asks → scored, in HubSpot, answered',
    'roast-queue': 'Paid order → roast tickets and pick list',
    'stock-check': 'Every morning → reorder list in #ops',
  },
  tint: { light: '#a1491a', dark: '#f0a476' },
};
