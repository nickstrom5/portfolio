/**
 * Case study 2: a property management company running maintenance, unit
 * turnovers, inspections and vendor compliance in ClickUp. Fictional company,
 * people, properties and links (.example domains cannot resolve).
 */
import type { Workspace } from '@/lib/clickup/types';

export const workspace: Workspace = {
  id: 'ops',
  name: 'Cedar Row Property Management',
  industry: 'Operations team',
  area: '340 apartments in four buildings, Columbus, OH',
  blurb: 'An operations office: repair requests routed by urgency, apartment turnovers that run from a template, monthly inspections that recur on their own, and vendors who can’t be sent out once their insurance lapses.',
  intro:
    'Cedar Row manages four apartment buildings with a small office team and two in-house technicians. Repair requests came by phone, email and sticky note; emergencies at midnight depended on who picked up; apartment turnovers ran from memory; and the yearly insurance check on vendors was a spreadsheet nobody opened. The operations director wanted the recurring work to run itself, with every exception landing on one person’s desk.',
  disclaimer: 'Cedar Row Property Management, its buildings, residents and vendors are fictional. The people, units, dates and links are samples.',
  team: [
    { key: 'rosa', name: 'Rosa Delgado', role: 'Operations director (owns ClickUp)' },
    { key: 'elena', name: 'Elena Petrov', role: 'Maintenance coordinator' },
    { key: 'ray', name: 'Ray Okoye', role: 'Maintenance supervisor' },
    { key: 'marcus', name: 'Marcus Hale', role: 'Technician, on call this week' },
    { key: 'tasha', name: 'Tasha Green', role: 'Resident services' },
    { key: 'devon', name: 'Devon Price', role: 'Leasing agent' },
    { key: 'ana', name: 'Ana Ruiz', role: 'Accounts payable and vendor compliance' },
  ],
  hierarchy: [
    { space: 'Maintenance', note: 'Everyone in the office and both technicians. Technicians use the mobile app.', folders: [], lists: ['Work Orders'] },
    { space: 'Leasing', note: 'Leasing and the maintenance supervisor.', folders: [], lists: ['Unit Turns', 'Available Units'] },
    {
      space: 'Operations',
      note: 'Recurring compliance work and the vendor register. Annual spend is a private field.',
      folders: [{ name: 'Compliance', lists: ['Inspections', 'Vendors'] }],
      lists: ['Office admin'],
    },
  ],
  dashboard: {
    name: 'Operations this week',
    note: 'On the office TV, and Rosa’s Monday review.',
    widgets: [
      { title: 'Open work orders by urgency', type: 'Bar chart', note: 'Work Orders not in Completed or Closed, grouped by the Urgency field.' },
      { title: 'Waiting on a vendor', type: 'Task List', note: 'Status Waiting on vendor, with time in status, longest first.' },
      { title: 'Turns in progress', type: 'Task List', note: 'Unit Turns with their subtask progress and due dates.' },
      { title: 'Inspections due', type: 'Calendar', note: 'Inspections by due date for the next 30 days.' },
      { title: 'Do not dispatch', type: 'Task List', note: 'Vendors in status Do not dispatch. Should be empty.' },
    ],
  },
  goals: [
    {
      name: 'Q4 · Repairs done on time',
      note: 'Owned by Elena.',
      targets: [
        { name: 'Emergencies attended within 2 hours', type: 'Number', target: '100%' },
        { name: 'Routine work orders completed within 7 days', type: 'Number', target: '90%' },
      ],
    },
    {
      name: 'Q4 · Turns in 7 days',
      note: 'Owned by Ray. The task target counts turns completed.',
      targets: [
        { name: 'Turns completed', type: 'Task', target: '18 turns' },
        { name: 'Every vendor’s insurance current', type: 'True/False', target: 'Done' },
      ],
    },
  ],
  docs: [
    { name: 'Maintenance handbook', note: 'What counts as an emergency, entry rules, the on-call rota.' },
    { name: 'Inspections SOP', note: 'One page per inspection type, with photos of what “pass” looks like. Linked from each recurring task.' },
    { name: 'Vendor handbook', note: 'Insurance requirements, the renewal email template, and who may approve a new vendor.' },
  ],
  handoff: {
    maintenance: 'Request → routed by urgency',
    turnover: 'Notice → ready to show',
    inspections: 'Monthly → passed or fixed',
    vendors: 'Insurance → renewed or paused',
  },
  tint: { light: '#0f766e', dark: '#5fd3c4' },
};
