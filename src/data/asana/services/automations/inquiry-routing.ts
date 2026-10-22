import type { Automation } from '@/lib/asana/types';

const D = 1440;

export const inquiryRouting: Automation = {
  id: 'inquiry-routing',
  number: '01',
  name: 'Inquiry routing',
  kicker: 'Website form → the right partner',
  tagline: 'Every inquiry goes to the person who sells that service, with a call to book by tomorrow.',
  problem:
    'Inquiries landed in a shared inbox that Sam checked between onboarding calls. A $4M manufacturer asking about tax waited two days because it looked like every other email, and the partners argued about whose prospect a fractional CFO lead was.',
  solution:
    'The public form asks three things that decide routing: service, business type and annual revenue. An automation on the intake board reads them the moment a task lands. Fractional CFO work goes to Elena. Tax for businesses over $1M goes to Marcus, smaller tax work to Jordan. Bookkeeping goes to Sam. Anyone who picked Not sure goes to Owen with a comment telling him what to ask. Every routed inquiry moves to Discovery call with a due date one business day out, which is the firm’s reply promise.',
  automation: {
    name: '01 · Route new inquiries',
    project: 'New Client Intake',
    triggers: [{ type: 'added' }],
    actions: [{ type: 'due', days: 1 }],
    paths: [
      {
        id: 'p-cfo',
        label: 'Fractional CFO',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Fractional CFO' }],
        actions: [{ type: 'assign', user: 'elena' }, { type: 'move', section: 'Discovery call' }],
      },
      {
        id: 'p-tax-large',
        label: 'Tax, $1M and up',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Tax' }, { type: 'field', key: 'Revenue band', op: 'is_any', value: ['$1M–$5M', 'Over $5M'] }],
        actions: [{ type: 'assign', user: 'marcus' }, { type: 'move', section: 'Discovery call' }],
      },
      {
        id: 'p-tax-small',
        label: 'Tax, under $1M',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Tax' }, { type: 'field', key: 'Revenue band', op: 'is', value: 'Under $1M' }],
        actions: [{ type: 'assign', user: 'jordan' }, { type: 'move', section: 'Discovery call' }],
      },
      {
        id: 'p-books',
        label: 'Bookkeeping',
        when: [{ type: 'field', key: 'Service', op: 'is', value: 'Bookkeeping' }],
        actions: [{ type: 'assign', user: 'sam' }, { type: 'move', section: 'Discovery call' }],
      },
      {
        id: 'p-unsure',
        label: 'Not sure',
        when: [],
        actions: [
          { type: 'assign', user: 'owen' },
          { type: 'comment', body: '@Owen Carter this prospect isn’t sure what they need. Reply from this task to book a 15-minute call, find out whether it’s bookkeeping, tax or CFO work, set Service, and move it to Discovery call.' },
        ],
      },
    ],
    settings: {
      triggeredByOthers: false,
      runsOn: 'tasks',
      notes: [
        'The due date is set before the Check if, because every inquiry gets the same one-day reply promise whichever path it takes.',
        'Two conditions on one path must both be true: Tax and a revenue band of $1M or more.',
        'Not sure stays in Inquiries on purpose: it isn’t ready for a partner’s call yet.',
      ],
    },
  },
  scenarios: [
    {
      id: 'books',
      label: 'A bakery that needs a bookkeeper',
      summary: 'A small LLC, books three months behind.',
      start: 1 * D + 620,
      submitted: true,
      task: { name: 'Larkspur Bakery LLC', section: 'Inquiries', fields: { Service: 'Bookkeeping', 'Entity type': 'LLC', 'Revenue band': 'Under $1M', 'Referral source': 'Client referral' } },
      events: [],
      expect: { section: 'Discovery call', assignee: 'sam', paths: ['p-books'] },
    },
    {
      id: 'tax-large',
      label: 'A $3M clinic asking about tax',
      summary: 'An S corp physical therapy practice with a deadline coming.',
      start: 2 * D + 1290,
      submitted: true,
      task: { name: 'Ridgeway Physical Therapy', section: 'Inquiries', fields: { Service: 'Tax', 'Entity type': 'S corp', 'Revenue band': '$1M–$5M', 'Referral source': 'Bank or lawyer' } },
      events: [],
      expect: { section: 'Discovery call', assignee: 'marcus', paths: ['p-tax-large'] },
    },
    {
      id: 'tax-small',
      label: 'A sole proprietor’s taxes',
      summary: 'A photographer who has outgrown doing taxes alone.',
      start: 3 * D + 540,
      submitted: true,
      task: { name: 'Mara Quinn Photography', section: 'Inquiries', fields: { Service: 'Tax', 'Entity type': 'Sole proprietor', 'Revenue band': 'Under $1M', 'Referral source': 'Website' } },
      events: [],
      expect: { section: 'Discovery call', assignee: 'jordan', paths: ['p-tax-small'] },
    },
    {
      id: 'cfo',
      label: 'A startup that needs a CFO',
      summary: 'A robotics company raising its next round.',
      start: 0 * D + 980,
      submitted: true,
      task: { name: 'Vantage Robotics', section: 'Inquiries', fields: { Service: 'Fractional CFO', 'Entity type': 'C corp', 'Revenue band': 'Over $5M', 'Referral source': 'Client referral' } },
      events: [],
      expect: { section: 'Discovery call', assignee: 'elena', paths: ['p-cfo'] },
    },
    {
      id: 'unsure',
      label: 'Not sure what they need',
      summary: 'A cafe owner who just knows the books are a mess.',
      start: 4 * D + 1050,
      submitted: true,
      task: { name: 'Harbor Light Cafe', section: 'Inquiries', fields: { Service: 'Not sure', 'Entity type': 'Sole proprietor', 'Revenue band': 'Under $1M' } },
      events: [
        { at: 7 * D + 560, by: 'owen', type: 'field', key: 'Service', value: 'Bookkeeping', note: 'After a short call on Monday.' },
        { at: 7 * D + 562, by: 'owen', type: 'assign', user: 'sam' },
        { at: 7 * D + 563, by: 'owen', type: 'move', section: 'Discovery call' },
      ],
      expect: { section: 'Discovery call', assignee: 'sam', paths: ['p-unsure'] },
    },
  ],
  build: [
    { title: 'Fields that route', body: 'Service, Entity type and Revenue band as single-selects, required on the form. A band rather than a number, because a range is answered honestly and an exact figure is skipped.' },
    { title: 'Trigger', body: 'Task added to this project.' },
    { title: 'Before the Check if', body: 'Set due date to tomorrow. Every path shares it.' },
    { title: 'Five paths', body: 'Fractional CFO; Tax and $1M or more; Tax and under $1M; Bookkeeping; No other path is matching for Not sure. No two can match the same task.' },
    { title: 'Reply promise on the Dashboard', body: 'A chart of overdue tasks in Discovery call by assignee. It should be empty every morning.' },
  ],
  edgeCases: [
    { title: 'Submitted on a Friday night', body: 'Due tomorrow lands on Saturday. The firm treats Monday morning as on time, and the Dashboard chart counts overdue, not due, so it stays honest.' },
    { title: 'Elena is booked solid', body: 'Fractional CFO leads still go to her: only she can scope them. She hands the call to Priya when she must, by reassigning, which keeps the history.' },
    { title: 'The same business submits twice', body: 'Both are routed. Owen merges the second into the first with Mark as duplicate, which keeps both sets of answers.' },
    { title: 'Spam', body: 'A junk submission has a Service like any other and gets routed. The partner moves it to Not a fit; the public form’s Report abuse link exists for worse.' },
  ],
  qa: [
    'One submission per service lands with the right partner, due tomorrow, in Discovery call.',
    'Tax at $1M–$5M goes to Marcus; Tax under $1M goes to Jordan.',
    'Not sure stays in Inquiries with the comment for Owen.',
    'The confirmation email reaches the submitter.',
  ],
  features: ['Forms', 'Form branching', 'Field mapping', 'Automations', 'Check if paths', 'Request tracking', 'Board view', 'Dashboards'],
};
