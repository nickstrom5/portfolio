import type { Process } from '@/lib/clickup/types';

const D = 1440;
const FORM = 'Maintenance request';
export const EMERGENCY = 'Emergency: water, gas, no heat or no power';
export const URGENT = 'Urgent: within 48 hours';
export const ROUTINE = 'Routine';

export const maintenance: Process = {
  id: 'maintenance',
  number: '01',
  name: 'Maintenance requests',
  kicker: 'Request to fixed',
  tagline: 'A burst pipe at midnight reaches the on-call technician in seconds; a dripping tap gets a date; a slow vendor gets chased.',
  problem:
    'Residents phoned, emailed or left notes at the front desk. A leak reported at 11 PM sat in the voicemail until morning. Routine jobs had no target date, jobs waiting on a vendor were forgotten for weeks, and nobody called the resident afterwards to check the fix held.',
  solution:
    'Residents use one ClickUp Form. The urgency they pick sets the priority, the owner and the due date: emergencies go to the on-call technician with a Chat alert, urgent jobs get 48 hours, routine jobs a week. A weekday-morning check flags any job that has waited on a vendor for more than two days, and every completed job goes to resident services for a follow-up call.',
  location: { space: 'Maintenance', list: 'Work Orders' },
  statuses: [
    { name: 'New', group: 'not_started', color: '#87909e' },
    { name: 'Scheduled', group: 'active', color: '#1090e0' },
    { name: 'Waiting on vendor', group: 'active', color: '#e16b16' },
    { name: 'In progress', group: 'active', color: '#5f55ee' },
    { name: 'Completed', group: 'done', color: '#008844' },
    { name: 'Closed', group: 'closed', color: '#656f7d' },
  ],
  fields: [
    { name: 'Property', type: 'Dropdown', options: ['Cedar Row Flats', 'Maple Court', 'The Linden', 'Birch Commons'] },
    { name: 'Unit', type: 'Text' },
    { name: 'Category', type: 'Dropdown', options: ['Plumbing', 'Electrical', 'Heating and cooling', 'Appliance', 'Pests', 'Other'] },
    { name: 'Urgency', type: 'Dropdown', options: [EMERGENCY, URGENT, ROUTINE], note: 'The resident picks it; Automations read it. The Form explains each choice in plain words.' },
    { name: 'Permission to enter', type: 'Dropdown', options: ['Yes, anytime', 'Call me first'] },
    { name: 'Resident email', type: 'Email' },
    { name: 'Vendor', type: 'Dropdown', options: ['In-house', 'Northside Plumbing', 'Brightline Electric', 'Pest Pros', 'Arctic Air HVAC', 'Hearth Appliance Repair'] },
  ],
  views: [
    { type: 'Form', name: FORM, note: 'Linked from the resident portal and printed as a QR code in each lobby.' },
    { type: 'Board', name: 'Today', note: 'Grouped by status, filtered to Urgent and High priority. The technicians’ morning view on the mobile app.' },
    { type: 'List', name: 'By building', note: 'Grouped by Property, sorted by due date.' },
    { type: 'Workload', name: 'Technicians', note: 'Marcus and Ray, by task count per day, so a big week is visible before Monday.' },
  ],
  pieces: [
    { kind: 'Form', name: FORM, note: 'Required: building, unit, category, urgency and a description. Photos upload as attachments on the task.' },
    { kind: 'Doc', name: 'Maintenance handbook', note: 'Defines each urgency level; the Form links to it.' },
    { kind: 'ClickApp', name: 'Time in Status', note: 'Switched on so the vendor check can measure how long a job has waited.' },
  ],
  automations: [
    {
      id: 'emergency',
      name: 'Emergency: on-call technician now',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Urgency', op: 'eq', value: EMERGENCY }],
      actions: [
        { type: 'change_priority', to: 'Urgent' },
        { type: 'change_assignees', mode: 'reassign', to: ['marcus'] },
        { type: 'change_due_date', daysAfter: 0 },
        { type: 'send_channel_message', channel: '#maintenance-oncall', body: 'EMERGENCY at {{field.Property}}, unit {{field.Unit}}: {{task.name}} ({{field.Category}}). Marcus has it. Call the resident now.' },
      ],
      note: 'The Chat channel pushes to the on-call phone. The handbook keeps a phone backup: if nobody acknowledges within 15 minutes, the answering service calls Ray.',
    },
    {
      id: 'urgent',
      name: 'Urgent: 48 hours',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Urgency', op: 'eq', value: URGENT }],
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'change_assignees', mode: 'reassign', to: ['elena'] },
        { type: 'change_due_date', daysAfter: 2 },
      ],
    },
    {
      id: 'routine',
      name: 'Routine: within a week',
      trigger: { type: 'task_created', form: FORM },
      conditions: [{ type: 'field', field: 'Urgency', op: 'eq', value: ROUTINE }],
      actions: [
        { type: 'change_priority', to: 'Normal' },
        { type: 'change_assignees', mode: 'reassign', to: ['elena'] },
        { type: 'change_due_date', daysAfter: 7 },
      ],
    },
    {
      id: 'vendor-late',
      name: 'Waiting on a vendor too long',
      trigger: { type: 'every', days: [0, 1, 2, 3, 4], at: '08:00' },
      conditions: [
        { type: 'time_in_status', status: 'Waiting on vendor', moreThanMinutes: 2 * D },
        { type: 'tag', lacks: ['vendor-late'] },
      ],
      actions: [
        { type: 'change_priority', to: 'High' },
        { type: 'change_tags', add: ['vendor-late'] },
        { type: 'add_comment', body: '@Elena Petrov {{task.name}} has waited on {{field.Vendor}} for more than two days. Call them for a date and update the resident.' },
      ],
      note: 'Time in Status measures how long the job has sat in Waiting on vendor. The tag Condition means Elena is told once, not every morning.',
    },
    {
      id: 'follow-up',
      name: 'Completed: resident follow-up',
      trigger: { type: 'status_changes', to: ['Completed'] },
      actions: [
        { type: 'change_assignees', mode: 'reassign', to: ['tasha'] },
        { type: 'change_due_date', daysAfter: 2 },
        { type: 'change_tags', remove: ['vendor-late'] },
        { type: 'add_comment', body: '@Tasha Green please check with the resident at {{field.Property}}, unit {{field.Unit}}, that the fix held, then close the work order.' },
      ],
    },
  ],
  scenarios: [
    {
      id: 'leak',
      label: 'A leak at 11:40 PM on Sunday',
      summary: 'Water coming through a bathroom ceiling. The on-call technician has it within seconds and is there in 35 minutes.',
      start: 6 * D + 1420,
      created: 'form',
      task: { name: 'Water dripping through the bathroom ceiling', fields: { Property: 'Maple Court', Unit: '3B', Category: 'Plumbing', Urgency: EMERGENCY, 'Permission to enter': 'Yes, anytime', 'Resident email': 'j.morales@example.com', Vendor: 'In-house' } },
      events: [
        { at: 35, type: 'status', to: 'In progress', by: 'marcus' },
        { at: 50, type: 'comment', body: 'Supply line under the sink upstairs (4B) burst. Water off, line replaced, ceiling drying. Drywall patch Thursday.', by: 'marcus' },
        { at: 170, type: 'status', to: 'Completed', by: 'marcus' },
        { at: 10 * 60 + 20 + 20, type: 'note', text: 'Tasha calls the resident: ceiling is dry, no more drips' },
        { at: 10 * 60 + 20 + 25, type: 'status', to: 'Closed', by: 'tasha' },
      ],
      expect: { status: 'Closed', fires: ['emergency', 'follow-up'], blocks: ['urgent', 'routine'], assignees: ['tasha'] },
    },
    {
      id: 'vendor',
      label: 'Routine repair, slow vendor',
      summary: 'A dishwasher that won’t drain. The part is on order with the appliance vendor, who goes quiet.',
      start: 600,
      created: 'form',
      task: { name: 'Dishwasher doesn’t drain', fields: { Property: 'The Linden', Unit: '210', Category: 'Appliance', Urgency: ROUTINE, 'Permission to enter': 'Yes, anytime', 'Resident email': 'pat.ng@example.com', Vendor: 'Hearth Appliance Repair' } },
      events: [
        { at: 240, type: 'status', to: 'Waiting on vendor', by: 'elena' },
        { at: 4 * D - 600 + 660, type: 'note', text: 'The vendor fits the new pump' },
        { at: 4 * D - 600 + 720, type: 'status', to: 'Completed', by: 'elena' },
      ],
      until: 5 * D,
      expect: { status: 'Completed', fires: ['routine', 'vendor-late', 'follow-up'], blocks: ['emergency', 'urgent', 'vendor-late'], assignees: ['tasha'] },
    },
    {
      id: 'heat',
      label: 'No heat in one room, call first',
      summary: 'A cold bedroom radiator on Tuesday morning. The resident wants a call before anyone enters.',
      start: D + 555,
      created: 'form',
      task: { name: 'Bedroom radiator is cold', fields: { Property: 'Cedar Row Flats', Unit: '5A', Category: 'Heating and cooling', Urgency: URGENT, 'Permission to enter': 'Call me first', 'Resident email': 'k.osei@example.com', Vendor: 'In-house' } },
      events: [
        { at: 45, type: 'note', text: 'Elena calls the resident and books Wednesday 9 AM' },
        { at: 50, type: 'status', to: 'Scheduled', by: 'elena' },
        { at: 50, type: 'assign', add: 'marcus', by: 'elena' },
        { at: D - 555 + 545, type: 'status', to: 'In progress', by: 'marcus' },
        { at: D - 555 + 600, type: 'status', to: 'Completed', by: 'marcus' },
        { at: 2 * D - 555 + 600, type: 'status', to: 'Closed', by: 'tasha' },
      ],
      expect: { status: 'Closed', fires: ['urgent', 'follow-up'], blocks: ['emergency', 'routine', 'vendor-late'] },
    },
  ],
  build: [
    { title: 'One Form, plain words', body: 'The resident Form asks what any resident can answer, with urgency explained beside each choice. Every answer the Automations read is a Dropdown.' },
    { title: 'Three Automations, one Trigger', body: 'Emergency, urgent and routine each have a single Condition on Urgency, so exactly one of them acts on every request and the rules read like the handbook.' },
    { title: 'The emergency path', body: 'Urgent priority, the on-call technician, a due date of today and a message to the #maintenance-oncall Chat channel, which the technicians have set to notify on their phones.' },
    { title: 'Time in Status for vendors', body: 'An Every… Trigger at 8 AM on weekdays with a Time in Status Condition finds jobs that have waited on a vendor more than two days. The tag stops it repeating each morning.' },
    { title: 'Closing the loop with residents', body: 'Completed hands the task to resident services with a two-day due date. Only they move it to Closed, after speaking to the resident.' },
  ],
  edgeCases: [
    { title: 'What if a resident marks a dripping tap as an emergency?', body: 'The on-call technician gets it at night. Elena changes the Urgency the next morning and resets the due date; the handbook link on the Form keeps this rare. Changing the field later does not re-run the creation Automations.' },
    { title: 'What if the technician on call changes?', body: 'The emergency Automation assigns one person. The rota changes weekly, so Rosa edits that Action every Monday; it is the first line of the Monday checklist. A People field cannot stand in here, because a new task has nothing in it yet.' },
    { title: 'What if the vendor comes but the job isn’t finished?', body: 'Elena moves it back to Waiting on vendor. Time in Status counts total time in that status, so the tag is what decides whether she is told again; she removes it if she wants another reminder.' },
    { title: 'What if the resident reports the same problem twice?', body: 'Two tasks. Elena merges them and the comments from both stay on the one that remains.' },
    { title: 'What if the fix fails?', body: 'Tasha moves the task back to Scheduled instead of Closed and @mentions Elena. The history stays on one task.' },
  ],
  qa: [
    'One Form submission per Urgency: priority, assignee and due date for each.',
    'An emergency submission: the #maintenance-oncall message arrives on a technician’s phone.',
    'A task in Waiting on vendor for three weekdays: one comment and the vendor-late tag, then silence.',
    'Completed reassigns to Tasha and removes vendor-late.',
    'The Form on a phone, from the lobby QR code, logged out.',
  ],
  features: ['Forms', 'Dropdown Custom Fields', 'Automations with Conditions', 'Every… Trigger', 'Time in Status Condition', 'Chat channel messages', 'Workload view', 'Mobile app'],
};
