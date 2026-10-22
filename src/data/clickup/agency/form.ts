import type { FormDemo } from '@/lib/clickup/types';

export const form: FormDemo = {
  title: 'Start a project',
  description: 'Tell us what you need. We reply within one business day, budget or not.',
  url: 'forms.clickup.com/9014xxxx/f/start-a-project',
  fields: [
    { name: 'company', label: 'Company or project name', type: 'text', required: true, placeholder: 'Juniper Dental', autocomplete: 'organization', maps: 'name' },
    { name: 'email', label: 'Your email', type: 'email', required: true, autocomplete: 'email', maps: { field: 'Contact email' } },
    { name: 'service', label: 'What do you need?', type: 'select', required: true, options: ['Website', 'Brand identity', 'Brand + website', 'Ongoing support'], maps: { field: 'Service' } },
    { name: 'budget', label: 'Budget', type: 'select', required: true, options: ['Under $10k', '$10k–$25k', '$25k–$60k', '$60k+'], initial: '$25k–$60k', maps: { field: 'Budget' } },
    { name: 'timeline', label: 'Timeline', type: 'select', options: ['Under 6 weeks', '6–12 weeks', 'Flexible'], initial: '6–12 weeks', maps: { field: 'Timeline' } },
    { name: 'heard', label: 'How did you hear about us?', type: 'select', options: ['Referral', 'Google', 'Dribbble', 'Instagram', 'Other'], maps: { field: 'Heard about us' } },
    { name: 'brief', label: 'Tell us about the project', type: 'textarea', placeholder: 'A few lines is plenty.', maps: 'description' },
  ],
  submitLabel: 'Send request',
  thanks: 'Thanks. Sam will reply within one business day.',
  feeds: 'intake',
  behaviors: [
    { value: 'fast', label: 'Sam replies the same morning and you sign', scenario: 'website-fast' },
    { value: 'slow', label: 'Nobody replies for a day', scenario: 'brand-friday' },
    { value: 'no', label: 'It turns out not to be a fit', scenario: 'small' },
  ],
  steps: [
    'ClickUp creates a task in Sales & Intake › Project Requests, named after your company.',
    'Your answers land in Custom Fields: Service, Budget, Timeline, Contact email.',
    'Automations set a reply-by date, assign Sam and bring in the right lead from your answers.',
    'A $60k+ budget alerts the founder; under $10k gets the polite-no tag.',
  ],
  notes: [
    { title: 'Answers become fields', body: 'Each question is mapped to a Custom Field in Form view, so Automations and Dashboards can use the answer. Free text only where no rule reads it.' },
    { title: 'Conditional logic', body: 'Timeline is hidden when Service is Ongoing support. Hidden questions stay empty, and no Automation depends on them.' },
    { title: 'No assignee on the Form', body: 'Form view can assign every submission to one person. Left blank on purpose: the Automation assigns, so the rule lives in one place.' },
    { title: 'Spam', body: 'The Form is public. A required email and dropdowns cut most junk; anything that gets through is archived from the Needs a reply view.' },
  ],
};
