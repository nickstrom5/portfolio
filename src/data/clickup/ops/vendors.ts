import type { Process } from '@/lib/clickup/types';

const D = 1440;
const vendor = (dueDay: number) => ({
  name: 'Northside Plumbing',
  status: 'Active',
  dueDay,
  fields: { Trade: 'Plumbing', 'Vendor contact': 'office@northsideplumbing.example', 'Annual spend': '$38,200' },
});

export const vendors: Process = {
  id: 'vendors',
  number: '04',
  name: 'Vendor insurance',
  kicker: 'Certificates that never lapse unseen',
  tagline: 'Thirty days before a vendor’s insurance expires, the renewal request goes out; on the day it lapses, dispatch stops.',
  problem:
    'Cedar Row requires every contractor to carry liability insurance and send a certificate each year. The dates lived in a spreadsheet. Twice a plumber was sent to a building with an expired certificate, which would have left the company exposed if anything had gone wrong.',
  solution:
    'Each vendor is a task in the Vendors List, and its due date is the day their certificate expires. Thirty days before, an Automation marks the vendor Renewal requested and sends the details to the email tool that asks the vendor for a new certificate. If the date arrives with no new certificate, the vendor goes to Do not dispatch and the maintenance channel is told. Moving the due date to the new expiry clears it.',
  location: { space: 'Operations', folder: 'Compliance', list: 'Vendors' },
  statuses: [
    { name: 'Onboarding', group: 'not_started', color: '#87909e' },
    { name: 'Active', group: 'active', color: '#008844' },
    { name: 'Renewal requested', group: 'active', color: '#e16b16' },
    { name: 'Do not dispatch', group: 'active', color: '#d33d44' },
    { name: 'Inactive', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Trade', type: 'Dropdown', options: ['Plumbing', 'Electrical', 'HVAC', 'Appliances', 'Pest control', 'Cleaning', 'Landscaping'] },
    { name: 'Vendor contact', type: 'Email' },
    { name: 'Certificate', type: 'Files', note: 'The current certificate of insurance, as a PDF.' },
    { name: 'Annual spend', type: 'Money', private: true },
  ],
  views: [
    { type: 'List', name: 'Register', note: 'Every vendor, grouped by Trade, with the due date labeled “Insurance expires”.' },
    { type: 'Calendar', name: 'Expiries', note: 'Due dates on a calendar for the year ahead.' },
    { type: 'Board', name: 'Compliance', note: 'By status. Do not dispatch should always be an empty column.' },
  ],
  pieces: [
    { kind: 'Doc', name: 'Vendor handbook', note: 'Insurance minimums, the renewal email, and how to approve a new vendor.' },
    { kind: 'Form', name: 'Vendor onboarding', note: 'New vendors upload their certificate and W-9; each response creates a task in Onboarding.' },
  ],
  automations: [
    {
      id: 'renew',
      name: '30 days out: request the new certificate',
      trigger: { type: 'date_before_after', date: 'due', days: 30, when: 'before' },
      conditions: [{ type: 'status', is: ['Active'] }],
      actions: [
        { type: 'change_status', to: 'Renewal requested' },
        { type: 'change_assignees', mode: 'reassign', to: ['ana'] },
        { type: 'call_webhook', url: 'https://hooks.cedarrow.example/coi-renewal', payload: '{\n  "vendor": "{{task.name}}",\n  "email": "{{field.Vendor contact}}",\n  "expires": "{{task.due}}"\n}' },
        { type: 'add_comment', body: '@Ana Ruiz the insurance certificate for {{task.name}} expires {{task.due}}. The renewal email has gone to {{field.Vendor contact}}; follow up by phone in two weeks if nothing arrives.' },
      ],
      note: 'Call webhook hands the vendor’s details to the email tool that sends the request, so the vendor never needs a ClickUp login. The payload carries no insurance data.',
    },
    {
      id: 'lapsed',
      name: 'Expired: stop dispatching',
      trigger: { type: 'due_date_arrives' },
      conditions: [{ type: 'status', is: ['Renewal requested'] }],
      actions: [
        { type: 'change_status', to: 'Do not dispatch' },
        { type: 'change_priority', to: 'Urgent' },
        { type: 'send_channel_message', channel: '#maintenance', body: 'Do not dispatch {{task.name}}: their insurance expired {{task.due}}. Use another {{field.Trade}} vendor until Ana clears them.' },
      ],
    },
    {
      id: 'cleared',
      name: 'New expiry date: back to active',
      trigger: { type: 'due_date_changes' },
      conditions: [{ type: 'status', is: ['Renewal requested', 'Do not dispatch'] }],
      actions: [
        { type: 'change_status', to: 'Active' },
        { type: 'change_priority', to: null },
        { type: 'add_comment', body: '@Elena Petrov {{task.name}} is cleared to dispatch. Their insurance now runs to {{task.due}}.' },
      ],
      note: 'Ana attaches the new certificate and moves the due date to its expiry. Correcting a date on an Active vendor does nothing, thanks to the Status Condition.',
    },
  ],
  scenarios: [
    {
      id: 'early',
      label: 'Renewed before it expires',
      summary: 'The request goes out 30 days ahead and the plumber sends the new certificate nine days later.',
      start: 540,
      task: vendor(31),
      events: [
        { at: 9 * D + 120, type: 'note', text: 'Northside emails the new certificate; Ana attaches it' },
        { at: 9 * D + 125, type: 'due', day: 396, by: 'ana' },
      ],
      until: 10 * D,
      expect: { status: 'Active', fires: ['renew', 'cleared'], assignees: ['ana'] },
    },
    {
      id: 'lapsed',
      label: 'It lapses, then gets fixed',
      summary: 'No certificate by the expiry date, so dispatch stops for two days until it arrives.',
      start: 540,
      task: vendor(31),
      events: [
        { at: 15 * D + 60, type: 'note', text: 'Ana phones Northside: “we’re on it”' },
        { at: 33 * D + 60, type: 'note', text: 'The new certificate arrives' },
        { at: 33 * D + 65, type: 'due', day: 398, by: 'ana' },
      ],
      expect: { status: 'Active', fires: ['renew', 'lapsed', 'cleared'] },
    },
    {
      id: 'inactive',
      label: 'A date fixed, then the vendor retired',
      summary: 'Ana corrects a typo in the expiry date, then Cedar Row stops using the vendor. Neither date fires anything.',
      start: 540,
      task: vendor(40),
      events: [
        { at: D + 60, type: 'due', day: 42, by: 'ana' },
        { at: 3 * D, type: 'status', to: 'Inactive', by: 'rosa' },
      ],
      until: 43 * D,
      expect: { status: 'Inactive', fires: [], blocks: ['cleared', 'renew', 'lapsed'] },
    },
  ],
  build: [
    { title: 'The due date is the expiry', body: 'Using the task’s own due date means the Calendar view, overdue filters and date Triggers all work without extra fields. The List view renames the column for the team.' },
    { title: 'Thirty days of warning', body: 'Date is Before/After, 30 days before the due date, with a Status Condition so retired vendors are skipped.' },
    { title: 'A webhook for the email', body: 'Call webhook sends the vendor’s name, email and expiry to the company’s email tool, which sends the request from Ana’s address. Vendors never need a ClickUp login.' },
    { title: 'A hard stop', body: 'Due date arrives with the vendor still in Renewal requested moves them to Do not dispatch and posts to #maintenance, the channel the coordinators watch.' },
    { title: 'One action clears it', body: 'Moving the due date to the new expiry is the Trigger to reactivate, so updating the record and clearing the vendor are the same step.' },
  ],
  edgeCases: [
    { title: 'What if a vendor sends the certificate before the 30-day mark?', body: 'Ana moves the due date. The vendor is Active, so the clear-to-dispatch Automation stays quiet, and the 30-day warning follows the new date.' },
    { title: 'What if the webhook fails?', body: 'Ana’s comment still arrives, and it names the email address, so she can send the request by hand. The Automation’s activity shows the failed call.' },
    { title: 'What if someone dispatches a vendor anyway?', body: 'ClickUp can’t block a phone call. Do not dispatch vendors are pinned at the top of the coordinators’ Board, and the Dashboard card should always be empty.' },
    { title: 'What if a vendor is retired?', body: 'Inactive is a Closed status. Both date Automations check the status, so nothing fires for them again.' },
  ],
  qa: [
    'A test vendor due in 31 days: Renewal requested at 4 AM the next day, with the webhook call in the Automation’s activity and Ana’s comment.',
    'A test vendor left in Renewal requested past its due date: Do not dispatch, Urgent and the #maintenance message.',
    'Moving the due date in each status: only Renewal requested and Do not dispatch reactivate.',
    'The webhook receiver logs the payload with the three fields and nothing else.',
  ],
  snippets: [
    {
      title: 'Webhook payload',
      language: 'json',
      code: '{\n  "vendor": "Northside Plumbing",\n  "email": "office@northsideplumbing.example",\n  "expires": "Thu, Apr 2"\n}',
      note: 'What the email tool receives. Its template turns it into the renewal request from Ana.',
    },
  ],
  features: ['Date is Before/After', 'Due date arrives', 'Due date changes', 'Call webhook', 'Files Custom Field', 'Private Custom Fields', 'Calendar view', 'Forms'],
};
