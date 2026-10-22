/**
 * Case study 1: a brand and web design studio running client delivery in
 * ClickUp. Fictional studio, people, clients and links (.example domains
 * cannot resolve).
 */
import type { Workspace } from '@/lib/clickup/types';

export const workspace: Workspace = {
  id: 'agency',
  name: 'Fernhill Studio',
  industry: 'Design agency',
  area: '11 people in Portland, OR, clients across the US',
  blurb: 'A brand and web studio: project requests sorted before anyone reads them, client review rounds that cannot stall in silence, and a launch plan that starts itself when the last blocker clears.',
  intro:
    'Fernhill Studio designs brand identities and websites for clinics, restaurants and small B2B companies, usually eight to twelve projects at once. Requests came in by email and Instagram DM, client approvals sat in inboxes for a week, and launches slipped because nobody noticed the one blocker still open. The founder wanted one place for all of it, where a new request, a waiting client or a late launch shows up on its own, without a project manager chasing each one by hand.',
  disclaimer: 'Fernhill Studio and its clients are fictional. The people, budgets, dates and links are samples.',
  team: [
    { key: 'priya', name: 'Priya Nair', role: 'Founder and creative director (Workspace owner)' },
    { key: 'sam', name: 'Sam Ortiz', role: 'Account manager' },
    { key: 'jo', name: 'Jo Adeyemi', role: 'Project manager (owns ClickUp)' },
    { key: 'maya', name: 'Maya Brooks', role: 'Web lead' },
    { key: 'theo', name: 'Theo Lindqvist', role: 'Brand lead' },
    { key: 'lena', name: 'Lena Cho', role: 'Designer' },
    { key: 'kenji', name: 'Kenji Ward', role: 'Developer' },
    { key: 'dana', name: 'Dana Whitfield', role: 'Client: marketing manager, Juniper Dental', guest: true },
  ],
  hierarchy: [
    { space: 'Sales & Intake', note: 'Requests and proposals. Members only; no guests.', folders: [], lists: ['Project Requests', 'Proposals'] },
    {
      space: 'Client Delivery',
      note: 'One Folder per client project, created from the Folder template “Website project”. Clients are guests with access to their own Folder only.',
      folders: [
        { name: 'Juniper Dental · Website', lists: ['Deliverables', 'Launch plan'] },
        { name: 'Copperleaf Bakery · Brand', lists: ['Deliverables'] },
      ],
      lists: ['Kickoffs'],
    },
    { space: 'Studio Ops', note: 'Retainer clients and internal work.', folders: [], lists: ['Retainer Requests', 'Studio admin'] },
  ],
  dashboard: {
    name: 'Studio pulse',
    note: 'Pinned for Priya and Jo; reviewed in the Monday studio meeting.',
    widgets: [
      { title: 'New requests waiting', type: 'Task List', note: 'Project Requests where status is New request, sorted by due date. Should be empty by noon.' },
      { title: 'Pipeline by status', type: 'Pie chart', note: 'Project Requests grouped by status, with the Budget field shown on hover.' },
      { title: 'Waiting on clients', type: 'Task List', note: 'Every Deliverables List, status Client review, with the days in status column.' },
      { title: 'Who is overloaded', type: 'Workload', note: 'Time estimates per person for the next two weeks against a 30-hour week.' },
      { title: 'Retainer hours this month', type: 'Time Reporting', note: 'Time tracked in Retainer Requests, grouped by the Client field.' },
    ],
  },
  goals: [
    {
      name: 'Q4 · Faster first replies',
      note: 'In the Goal Folder “Studio 2026”, owned by Sam.',
      targets: [
        { name: 'Requests answered within one business day', type: 'Number', target: '95%' },
        { name: 'Every request has a Budget and Service set', type: 'True/False', target: 'Done' },
      ],
    },
    {
      name: 'Q4 · Launches on the planned date',
      note: 'Owned by Jo. The task target counts launch tasks closed.',
      targets: [
        { name: 'Launch tasks closed on or before their due date', type: 'Task', target: '6 launches' },
        { name: 'Signed revenue', type: 'Currency', target: '$240,000' },
      ],
    },
  ],
  docs: [
    { name: 'Delivery handbook', note: 'How a project runs, review rounds, what counts as a change order. Linked from every Deliverables List.' },
    { name: 'Launch runbook', note: 'DNS, redirects, analytics and the go-live checklist, page by page.' },
    { name: 'How we use ClickUp', note: 'Statuses, fields, naming and which Automations exist, with an owner for each.' },
  ],
  handoff: {
    intake: 'Form → routed, answered in a day',
    review: 'Draft → client approval',
    launch: 'Blockers cleared → live',
    retainer: 'Small request → done this week',
  },
  tint: { light: '#7b3fe4', dark: '#c4a8ff' },
};
