import type { FormDemo } from '@/lib/clickup/types';
import { EMERGENCY, ROUTINE, URGENT } from './maintenance';

export const form: FormDemo = {
  title: 'Maintenance request',
  description: 'Something broken in your apartment or building? Tell us here. For fire or a gas smell, call 911 first.',
  url: 'forms.clickup.com/9015xxxx/f/maintenance-request',
  fields: [
    { name: 'problem', label: 'What’s the problem?', type: 'text', required: true, placeholder: 'Kitchen tap drips all night', maps: 'name' },
    { name: 'property', label: 'Building', type: 'select', required: true, options: ['Cedar Row Flats', 'Maple Court', 'The Linden', 'Birch Commons'], maps: { field: 'Property' } },
    { name: 'unit', label: 'Apartment number', type: 'text', required: true, placeholder: '3B', maps: { field: 'Unit' } },
    { name: 'category', label: 'Type of problem', type: 'select', required: true, options: ['Plumbing', 'Electrical', 'Heating and cooling', 'Appliance', 'Pests', 'Other'], maps: { field: 'Category' } },
    { name: 'urgency', label: 'How urgent is it?', type: 'select', required: true, options: [EMERGENCY, URGENT, ROUTINE], initial: ROUTINE, maps: { field: 'Urgency' } },
    { name: 'entry', label: 'Can we enter if you’re out?', type: 'select', options: ['Yes, anytime', 'Call me first'], maps: { field: 'Permission to enter' } },
    { name: 'email', label: 'Your email', type: 'email', required: true, autocomplete: 'email', maps: { field: 'Resident email' } },
    { name: 'details', label: 'Anything else we should know?', type: 'textarea', maps: 'description' },
  ],
  submitLabel: 'Send request',
  thanks: 'Got it. Emergencies are answered right away; everything else within one business day.',
  feeds: 'maintenance',
  behaviors: [
    { value: 'quick', label: 'A technician comes the same day', scenario: 'heat' },
    { value: 'vendor', label: 'It needs a part from a vendor who goes quiet', scenario: 'vendor' },
    { value: 'night', label: 'It is the middle of the night', scenario: 'leak' },
  ],
  steps: [
    'ClickUp creates a work order in Maintenance › Work Orders, named after the problem you described.',
    'Your building, apartment, problem type and urgency land in Custom Fields.',
    'The urgency you picked sets the priority, the person and the due date: today, 48 hours or a week.',
    'An emergency also posts to the on-call technicians’ Chat channel.',
  ],
  notes: [
    { title: 'Urgency in plain words', body: 'Each option says what it covers. Residents choose well when the choice is concrete: water, gas, no heat, no power.' },
    { title: 'A Form, not an email inbox', body: 'Every request becomes a task with the same fields, so the Board, the Dashboard and the Automations all work from day one.' },
    { title: 'Phone still works', body: 'Office staff fill in the same Form when a resident calls, so phone requests follow the same rules.' },
    { title: 'Photos', body: 'The live Form has a file question; photos arrive as attachments on the task. Left out of this demo, which stores nothing.' },
  ],
};
